import { prisma } from "../db.js";
import { emailLeadsParados } from "./emailTemplates.js";
import { sendEmail } from "./notificationService.js";

/**
 * ─── Lead parado ─────────────────────────────────────────────────────────────
 *
 * Um lead ABERTO em que ninguém encosta há X horas. É a pergunta que o dono da
 * imobiliária faz e que a lista de leads não respondia: "quem está esquecido?".
 * A lista ordenava por chegada, e um lead de dez dias atrás sem nenhuma nota
 * parecia igual a um de dez minutos.
 *
 * ── O QUE CONTA COMO "ENCOSTAR" ──
 * Um EVENTO no histórico — mudar de estágio, trocar o responsável, escrever uma
 * nota. Não é `updatedAt`: o próprio aviso de "parado" grava no lead
 * (`avisoParadoEm`), e se a régua fosse `updatedAt` o aviso zeraria o
 * cronômetro que ele mesmo mede. Também não é o clique no botão do WhatsApp —
 * abrir a conversa não é prova de que a conversa aconteceu, e a nota é o
 * lugar de registrar que aconteceu.
 *
 * ── ENCERRADO NÃO CONTA ──
 * GANHO e PERDIDO ficam parados para sempre, por definição. Contá-los faria o
 * alerta crescer sem parar até virar ruído que ninguém olha — a mesma regra
 * do "negócio parado" do Flow (`flowRoutes.js`, painel).
 *
 * ── A REGRA MORA AQUI ──
 * A lista de leads, o contador, o filtro e o e-mail fazem a mesma pergunta, e
 * ela tem uma resposta só. Duas contas de "parado" divergiriam na primeira
 * mudança de prazo.
 *
 * ── UM AVISO POR SILÊNCIO ──
 * O e-mail sai uma vez por lead esquecido, e só sai de novo se alguém encostar
 * no lead e ele parar de novo. Avisar todo dia do mesmo lead ensina a apagar o
 * e-mail sem ler — e o segundo lead esquecido passa junto.
 *
 * ── ENSAIO POR PADRÃO ──
 * Como os outros laços: `aplicar: false` monta tudo e não envia nada.
 */

export const HORAS_PADRAO = 48;
const ESTAGIOS_ENCERRADOS = ["GANHO", "PERDIDO"];

/** O instante antes do qual "sem evento" vira "parado". */
export function corteDeParado(horas, agora = new Date()) {
  const h = Number.isFinite(Number(horas)) && Number(horas) > 0 ? Number(horas) : HORAS_PADRAO;
  return new Date(agora.getTime() - h * 60 * 60 * 1000);
}

/**
 * O `where` do Prisma para os leads parados de uma imobiliária. É um fragmento
 * para ser ESPALHADO num `where` maior — a lista soma os filtros dela por cima.
 *
 * "Criado antes do corte E nenhum evento depois do corte": um lead novo já
 * chega com o evento CRIADO, mas leads vindos pela API ou por captação podem
 * não ter — daí a data de criação entrar na conta também.
 */
export function filtroDeParados({ horas, agora = new Date() } = {}) {
  const corte = corteDeParado(horas, agora);
  return {
    estagio: { notIn: ESTAGIOS_ENCERRADOS },
    createdAt: { lt: corte },
    eventos: { none: { createdAt: { gte: corte } } },
  };
}

/** Último toque num lead: o evento mais recente, ou a chegada. */
export function ultimoToque(lead) {
  const evento = lead.eventos?.[0]?.createdAt;
  const criado = lead.createdAt;
  if (!evento) return criado;
  return new Date(evento) > new Date(criado) ? evento : criado;
}

/**
 * Anota em cada lead da lista se ele está parado e desde quando. Espera que a
 * consulta tenha incluído o evento mais recente (`eventos: take 1, desc`) — e
 * REMOVE esse array da saída: a tela decide se busca o histórico completo pela
 * ausência de `eventos`, e um array de um elemento a enganaria.
 */
export function marcarParados(leads, { horas, agora = new Date() } = {}) {
  const corte = corteDeParado(horas, agora);
  return leads.map(({ eventos, ...lead }) => {
    const toque = ultimoToque({ ...lead, eventos });
    const aberto = !ESTAGIOS_ENCERRADOS.includes(lead.estagio);
    const parado = aberto && new Date(toque) < corte;
    return { ...lead, ultimoToqueEm: toque, parado };
  });
}

/**
 * Roda a rodada de avisos: um e-mail por imobiliária, com os leads que pararam
 * desde o último aviso. Vai para o e-mail da imobiliária e para cada corretor
 * responsável por algum dos leads da lista.
 * @param {{aplicar?: boolean, agora?: Date}} opcoes
 */
export async function avisarLeadsParados({ aplicar = false, agora = new Date() } = {}) {
  const tenants = await prisma.tenant.findMany({
    where: { ativo: true, statusPagamento: { not: "CANCELADO" }, email: { not: "" } },
    select: { id: true, name: true, slug: true, email: true, leadParadoHoras: true },
  });

  const base = (process.env.APP_URL || "").replace(/\/+$/, "");
  const enviados = [];
  const falhas = [];
  let avaliados = 0;

  for (const tenant of tenants) {
    const horas = tenant.leadParadoHoras || HORAS_PADRAO;
    const parados = await prisma.propertyLead.findMany({
      where: { tenantId: tenant.id, ...filtroDeParados({ horas, agora }) },
      select: {
        id: true, name: true, phone: true, email: true, estagio: true, createdAt: true, avisoParadoEm: true,
        property: { select: { title: true } },
        responsavel: { select: { nome: true, email: true } },
        eventos: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
      /* Teto por rodada. Uma conta abandonada com mil leads não vira um e-mail
         de mil linhas; os mais antigos vão primeiro e o resto sai na próxima. */
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    avaliados += parados.length;

    /* Só quem ainda não foi avisado DESTE silêncio: ou nunca foi avisado, ou o
       aviso é anterior ao último toque (alguém mexeu, e ele parou de novo). */
    const pendentes = parados.filter((l) => !l.avisoParadoEm || new Date(l.avisoParadoEm) < new Date(ultimoToque(l)));
    if (!pendentes.length) continue;

    const destinatarios = [...new Set([tenant.email, ...pendentes.map((l) => l.responsavel?.email)].filter(Boolean))];
    const linhas = pendentes.map((l) => ({
      nome: l.name || "Sem nome",
      contato: l.phone || l.email || "",
      imovel: l.property?.title || "",
      responsavel: l.responsavel?.nome || "",
      horas: Math.floor((agora.getTime() - new Date(ultimoToque(l)).getTime()) / 3_600_000),
    }));

    if (!aplicar) {
      enviados.push({ tenant: tenant.name, destinatarios, leads: linhas.length, ensaio: true });
      continue;
    }

    try {
      const { subject, body, html } = emailLeadsParados({ imobiliaria: tenant.name, horas, leads: linhas, base });
      await sendEmail({ to: destinatarios, subject, body, html });
      /* A marca só DEPOIS do envio — a ordem inversa perderia o aviso de quem
         tivesse uma falha de rede no meio. */
      await prisma.propertyLead.updateMany({
        where: { id: { in: pendentes.map((l) => l.id) } },
        data: { avisoParadoEm: agora },
      });
      enviados.push({ tenant: tenant.name, destinatarios, leads: linhas.length });
    } catch (erro) {
      falhas.push({ tenant: tenant.name, erro: erro.message });
    }
  }

  return { avaliados, enviados, falhas };
}

/* ── O agendador ────────────────────────────────────────────────────────────
   Desligado por padrão, como os outros: com duas instâncias no ar, as duas
   mandariam. Ligue com LEADS_PARADOS_AUTOMATICO=true quando houver uma só; do
   contrário, `npm run leads-parados -- --aplicar` num cron externo.

   De hora em hora, porque o prazo é em horas — e a marca no banco faz a
   frequência ser questão de robustez, não de incômodo. */
const INTERVALO_MS = 60 * 60 * 1000;

export function iniciarAvisosDeLeadsParados() {
  if (process.env.LEADS_PARADOS_AUTOMATICO !== "true") return null;

  async function rodar() {
    try {
      const r = await avisarLeadsParados({ aplicar: true });
      if (r.enviados.length || r.falhas.length) {
        console.log(`[leads-parados] ${r.enviados.length} e-mail(s), ${r.falhas.length} falha(s), ${r.avaliados} lead(s) parado(s).`);
      }
    } catch (erro) {
      console.error("[leads-parados] falhou:", erro.message);
    }
  }

  const inicial = setTimeout(rodar, 120_000);
  const repetido = setInterval(rodar, INTERVALO_MS);
  inicial.unref?.();
  repetido.unref?.();

  console.log("[leads-parados] avisos automáticos ligados.");
  return () => {
    clearTimeout(inicial);
    clearInterval(repetido);
  };
}
