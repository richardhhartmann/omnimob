import { prisma } from "../db.js";
import { emailVencimentoProximo } from "./emailTemplates.js";
import { sendEmail } from "./notificationService.js";
import { renovaSozinho } from "./pagamentos.js";

/**
 * ─── Aviso de vencimento ─────────────────────────────────────────────────────
 *
 * Manda um lembrete ANTES de a conta cair. Nasceu junto com o Pix mensal, e a
 * ordem importa: enquanto tudo era cartão, a assinatura renovava sozinha e o
 * único aviso necessário era o de cobrança recusada. Com o Pix **nada renova
 * sozinho** — Pix Automático não existe para conta brasileira nem no Stripe nem
 * nas assinaturas do Mercado Pago —, então o desfecho normal de um cliente
 * satisfeito passou a ser a conta vencer em silêncio.
 *
 * ── OS DOIS DEGRAUS ──
 * D-7 dá tempo de resolver (achar o cartão, pedir ao financeiro, trocar de
 * plano). D-1 pega quem viu o primeiro e deixou para depois. Um terceiro degrau
 * no meio não acrescenta informação, e cada e-mail a mais gasta a paciência que
 * o próximo vai precisar.
 *
 * ── A TRAVA DE REENVIO ──
 * `Tenant.avisoVencimento`, no formato `<vencimento>:<degrau>`. É persistente
 * de propósito, ao contrário da trava em memória do relatório mensal: aqui o
 * laço roda VÁRIAS VEZES POR DIA (para não depender de a instância estar viva
 * numa hora exata), e sem marca no banco um reinício mandaria o mesmo aviso de
 * novo. Receber duas vezes o relatório do mês é chato; receber duas vezes
 * "sua conta vence amanhã" parece defeito de cobrança.
 *
 * A data do vencimento entra na chave porque é ela que FECHA o ciclo: pago o
 * plano, `proximoVencimento` anda, a chave deixa de casar, e a próxima rodada
 * começa sozinha. Sem limpeza, sem backfill.
 *
 * ── ENSAIO POR PADRÃO ──
 * Como a faxina e o relatório: `aplicar: false` monta tudo e não envia nada.
 * E-mail enviado não volta.
 */

/* Do mais distante para o mais próximo — a ordem é o que torna a marca de um
   campo só suficiente: gravado o `:1`, não há mais nada a mandar. */
export const DEGRAUS = [7, 1];

/* ── O fuso ─────────────────────────────────────────────────────────────────

   Tudo aqui é contado no calendário de São Paulo, e não no do servidor. Não é
   preciosismo: em produção a API roda em UTC, e entre 21h e meia-noite de
   Brasília o servidor já virou o dia. Um aviso disparado às 21h05 diria "vence
   amanhã" para uma conta que, para quem lê, vence depois de amanhã.

   `en-CA` porque ele formata como `2026-09-04` — a mesma forma que a chave
   guarda e que compara direito como texto. */
const FUSO = "America/Sao_Paulo";
const FORMATO = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** A data-calendário de um instante, em São Paulo: "2026-09-04". */
export function dataLocal(instante) {
  return FORMATO.format(new Date(instante));
}

/** A chave gravada em `Tenant.avisoVencimento` para um vencimento e um degrau. */
export function chaveDoAviso(vencimento, degrau) {
  return `${dataLocal(vencimento)}:${degrau}`;
}

/**
 * Quantos dias INTEIROS faltam para o vencimento, contados por DATA e não por
 * horas.
 *
 * A diferença não é preciosismo: `proximoVencimento` costuma ter a hora em que
 * a assinatura foi criada, então um vencimento às 23h de daqui a sete dias dá
 * 6,9 dias em horas e cairia no degrau errado — ou em nenhum. Quem lê o e-mail
 * pensa em datas de calendário, e é isso que o cálculo precisa espelhar.
 */
export function diasAte(vencimento, agora = new Date()) {
  const meiaNoite = (v) => Date.parse(`${dataLocal(v)}T00:00:00Z`);
  return Math.round((meiaNoite(vencimento) - meiaNoite(agora)) / 86400000);
}

/**
 * Quem precisa ser avisado agora, e por qual degrau.
 *
 * Função PURA sobre a lista de tenants — é ela que o teste consegue conferir
 * sem rede e sem e-mail. A regra tem três partes, e cada uma já foi um defeito
 * em potencial:
 *   · o degrau é o MENOR que ainda cabe (`dias <= degrau`), senão quem passou
 *     de 7 para 5 dias sem receber nada — API parada no fim de semana — só
 *     seria avisado na véspera;
 *   · conta sem e-mail não entra: não há para onde mandar;
 *   · vencida (`dias < 0`) também não: aí o assunto é outro, e quem fala é o
 *     `emailTrialExpirado`. Dizer "vence em breve" para quem já venceu é o tipo
 *     de mensagem que faz o cliente desconfiar de tudo que vem depois.
 */
export function aQuemAvisar(tenants, agora = new Date()) {
  const alvos = [];
  for (const t of tenants) {
    if (!t.proximoVencimento || !t.email) continue;

    const dias = diasAte(t.proximoVencimento, agora);
    if (dias < 0) continue;

    /* O MENOR degrau que ainda cabe. `DEGRAUS` está em ordem decrescente —
       porque é essa ordem que faz a marca de um campo só bastar —, então a
       busca precisa ser do fim para o começo. Procurando do começo, `1 <= 7`
       casava e TUDO virava degrau 7: o D-1 nunca dispararia, e quem já tivesse
       recebido o D-7 nunca mais receberia nada. Os testes pegaram isto. */
    const degrau = [...DEGRAUS].sort((a, b) => a - b).find((d) => dias <= d);
    if (degrau == null) continue;

    const chave = chaveDoAviso(t.proximoVencimento, degrau);
    /* Já mandei este, ou um mais próximo do vencimento? Como os degraus estão
       em ordem decrescente, "já mandei o :1" cobre o :7 automaticamente —
       comparar só igualdade deixaria o :7 escapar depois do :1 num vencimento
       que fosse adiado e voltasse. */
    if (t.avisoVencimento === chave) continue;
    if (t.avisoVencimento && t.avisoVencimento.startsWith(`${chave.split(":")[0]}:`)) {
      const jaMandado = Number(t.avisoVencimento.split(":")[1]);
      if (Number.isFinite(jaMandado) && jaMandado <= degrau) continue;
    }

    alvos.push({ tenant: t, dias, degrau, chave });
  }
  return alvos;
}

/**
 * Roda a rodada de avisos.
 * @param {{aplicar?: boolean, agora?: Date}} opcoes
 */
export async function avisarVencimentos({ aplicar = false, agora = new Date() } = {}) {
  /* Só quem está PAGANDO. Trial não entra: quem está testando já tem o próprio
     selo com a contagem no painel, e um e-mail de vencimento no meio do teste
     lê como cobrança de quem ainda não comprou. */
  const tenants = await prisma.tenant.findMany({
    where: {
      statusPagamento: "EM_DIA",
      ativo: true,
      email: { not: "" },
      proximoVencimento: { not: null },
    },
    select: {
      id: true,
      name: true,
      email: true,
      plano: true,
      proximoVencimento: true,
      avisoVencimento: true,
      /* Quem paga por Pix não renova sozinho, e a mensagem é outra. A pista é
         a cobrança avulsa registrada: `cobrancaProvedor` só existe para quem
         pagou por fora da assinatura recorrente. */
      cobrancaProvedor: true,
      assinaturaId: true,
    },
  });

  const alvos = aQuemAvisar(tenants, agora);
  const base = (process.env.APP_URL || "").replace(/\/+$/, "");
  const enviados = [];
  const falhas = [];

  for (const { tenant, dias, degrau, chave } of alvos) {
    /* A regra mora em `pagamentos.js`: a tela de cobrança faz a MESMA pergunta,
       e duas respostas diferentes para "isto renova sozinho?" seria o e-mail
       contradizendo o painel. */
    const automatico = renovaSozinho(tenant);

    if (!aplicar) {
      enviados.push({ tenant: tenant.name, email: tenant.email, dias, degrau, renovaSozinho: automatico, ensaio: true });
      continue;
    }

    try {
      const { subject, body, html } = emailVencimentoProximo({
        imobiliaria: tenant.name,
        dias,
        vence: tenant.proximoVencimento,
        plano: tenant.plano,
        renovaSozinho: automatico,
        base,
      });
      await sendEmail({ to: tenant.email, subject, body, html });

      /* A marca só é gravada DEPOIS do envio. A ordem inversa perderia o aviso
         de quem tivesse uma falha de rede no meio — e ninguém saberia. */
      await prisma.tenant.update({ where: { id: tenant.id }, data: { avisoVencimento: chave } });
      enviados.push({ tenant: tenant.name, email: tenant.email, dias, degrau, renovaSozinho: automatico });
    } catch (erro) {
      falhas.push({ tenant: tenant.name, erro: erro.message });
    }
  }

  return { avaliados: tenants.length, enviados, falhas };
}

/* ── O agendador ────────────────────────────────────────────────────────────

   DESLIGADO POR PADRÃO, pelo mesmo motivo da faxina e do relatório: com duas
   instâncias no ar, as duas mandariam. Ligue com AVISO_VENCIMENTO_AUTOMATICO=true
   quando houver uma instância só; em qualquer outro cenário, chame
   `npm run avisos -- --aplicar` de um cron externo.

   De seis em seis horas, e não uma vez por dia numa hora fixa: a instância pode
   estar reiniciando justo naquele minuto, e um aviso de D-1 perdido não tem
   segunda chance. Rodar quatro vezes é seguro porque a marca no banco impede o
   reenvio — é ela que torna a frequência uma decisão de robustez, e não de
   incômodo. */
const INTERVALO_MS = 6 * 60 * 60 * 1000;

export function iniciarAvisosDeVencimento() {
  if (process.env.AVISO_VENCIMENTO_AUTOMATICO !== "true") return null;

  async function rodar() {
    try {
      const r = await avisarVencimentos({ aplicar: true });
      if (r.enviados.length || r.falhas.length) {
        console.log(
          `[aviso-vencimento] ${r.enviados.length} enviado(s), ${r.falhas.length} falha(s), ` +
            `de ${r.avaliados} conta(s) em dia.`,
        );
      }
    } catch (erro) {
      console.error("[aviso-vencimento] falhou:", erro.message);
    }
  }

  // Mesma cautela dos outros: não sai mandando e-mail no segundo em que a API
  // sobe, antes de atender a primeira requisição.
  const inicial = setTimeout(rodar, 90_000);
  const repetido = setInterval(rodar, INTERVALO_MS);
  inicial.unref?.();
  repetido.unref?.();

  console.log("[aviso-vencimento] avisos automáticos ligados.");
  return () => {
    clearTimeout(inicial);
    clearInterval(repetido);
  };
}
