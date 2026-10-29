import { PERMISSOES } from "./cargosPadrao.js";
import { MODULOS, cargoAlcancaModulo, tenantTemModulo } from "./modulos.js";
import { emailNovidades } from "./emailTemplates.js";
import { sendEmail, isEmailEnabled } from "./notificationService.js";

/* ────────────────────────────────────────────────────────────────────────────
   AS NOVIDADES DA SEMANA — a regra, sem rota e sem banco.

   Porte do `modules/dashboard/novidades.py` do VYA. Toda terça a rotina
   escreve o que mudou e entrega como RASCUNHO; uma pessoa revisa no super-admin
   e publica; cada cliente vê a apresentação UMA vez ao entrar no painel, e
   depois pode rever em Ajuda › Notas de versão. O formato do conteúdo é o do
   `docs/novidades/exemplo/conteudo.json`.

   ── O QUE CADA UM VÊ ──

   As três perguntas do produto valem aqui também. Cada item pode dizer:

     · `modulo` ("HUB" | "FLOW") — a conta contratou E o cargo alcança. Uma
       novidade do Omniflow não aparece para quem só tem o Omnimob;
     · `permissao` (uma coluna do `Cargo`) — o corretor não vê a novidade das
       Configurações, que ele não abre.

   O corte é no SERVIDOR (a tela recebe só o que é dela), e o e-mail usa o
   mesmo, para a pessoa não receber a notícia de uma tela que não tem.
   ──────────────────────────────────────────────────────────────────────────── */

export const TIPOS = ["novo", "melhoria", "correcao", "mudanca"];
const ID = /^[a-z0-9][a-z0-9-]{0,59}$/;
const CHAVE = /^\d{4}-\d{2}-\d{2}$/;

/** A chave é a terça em que a semana fecha (AAAA-MM-DD). */
export function chaveValida(chave) {
  if (!CHAVE.test(String(chave || ""))) return false;
  const d = new Date(`${chave}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === chave && d.getUTCDay() === 2;
}

/** O print é uma imagem já hospedada (Cloudinary): só https, e no máximo dois. */
const printValido = (p) => typeof p === "string" && /^https:\/\/[^\s"'<>]+$/.test(p) && p.length <= 500;

function texto(v, maximo, onde) {
  const t = String(v ?? "").replace(/\s+/g, " ").trim();
  if (!t) throw erro(`Falta ${onde}.`);
  if (t.length > maximo) throw erro(`${onde[0].toUpperCase()}${onde.slice(1)} passa de ${maximo} caracteres.`);
  return t;
}

function erro(mensagem) {
  const e = new Error(mensagem);
  e.status = 400;
  return e;
}

/**
 * O conteúdo validado e limpo. Lança com `.status = 400` e o motivo em
 * português: é ele que a rotina lê para corrigir e reenviar.
 */
export function normalizarNovidade(bruto, chave) {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) throw erro("Conteúdo inválido.");
  const enc = bruto.encerramento && typeof bruto.encerramento === "object" ? bruto.encerramento : {};
  const saida = {
    mes: chave,
    titulo: texto(bruto.titulo, 60, "o título"),
    subtitulo: texto(bruto.subtitulo || "Omnimob", 60, "o subtítulo"),
    chamada: texto(bruto.chamada, 220, "a chamada da capa"),
    encerramento: {
      titulo: texto(enc.titulo || "Dúvidas? Fale com a gente", 60, "o título do encerramento"),
      texto: texto(enc.texto || "O suporte está pronto para ajudar a sua equipe.", 220, "o texto do encerramento"),
    },
    secoes: [],
  };
  if (!Array.isArray(bruto.secoes) || !bruto.secoes.length) throw erro("Inclua ao menos uma área com novidades.");

  const vistos = new Set();
  for (const s of bruto.secoes.slice(0, 12)) {
    if (!s || typeof s !== "object") throw erro("Área inválida.");
    const sec = {
      id: String(s.id || ""),
      titulo: texto(s.titulo, 40, "o nome da área"),
      icone: String(s.icone || "Sparkle").slice(0, 40),
      resumo: texto(s.resumo, 160, `o resumo de ${s.titulo}`),
      itens: [],
    };
    if (!ID.test(sec.id)) throw erro(`Identificador da área ${sec.titulo} inválido.`);
    for (const it of (Array.isArray(s.itens) ? s.itens : []).slice(0, 15)) {
      if (!it || typeof it !== "object") throw erro("Novidade inválida.");
      const id = String(it.id || "");
      if (!ID.test(id) || vistos.has(id)) throw erro(`Identificador de novidade inválido ou repetido: ${id}`);
      vistos.add(id);
      const tipo = it.tipo || "novo";
      if (!TIPOS.includes(tipo)) throw erro(`${it.titulo}: tipo inválido (${tipo}).`);
      const passos = (Array.isArray(it.passos) ? it.passos : []).slice(0, 4).map((p) => texto(p, 170, `um passo de ${it.titulo}`));
      if (!passos.length && (tipo === "novo" || tipo === "melhoria")) throw erro(`${it.titulo}: inclua os passos de como usar.`);
      const item = {
        id,
        tipo,
        titulo: texto(it.titulo, 60, "o título da novidade"),
        icone: String(it.icone || "Sparkle").slice(0, 40),
        paraQue: texto(it.paraQue, 320, `o para que serve de ${it.titulo}`),
        passos,
        onde: texto(it.onde, 90, `o onde fica de ${it.titulo}`),
      };
      if (it.modulo != null && it.modulo !== "") {
        if (!MODULOS.includes(it.modulo)) throw erro(`${it.titulo}: módulo desconhecido (${it.modulo}).`);
        item.modulo = it.modulo;
      }
      if (it.permissao != null && it.permissao !== "") {
        if (!PERMISSOES.includes(it.permissao)) throw erro(`${it.titulo}: permissão desconhecida (${it.permissao}).`);
        item.permissao = it.permissao;
      }
      const prints = (Array.isArray(it.print) ? it.print : it.print ? [it.print] : []).filter(printValido).slice(0, 2);
      if (prints.length) item.print = prints.length > 1 ? prints : prints[0];
      sec.itens.push(item);
    }
    if (sec.itens.length) saida.secoes.push(sec);
  }
  if (!saida.secoes.length) throw erro("Inclua ao menos uma novidade.");
  return saida;
}

/** Esta pessoa alcança o item? `tenant` precisa de `modulos`; `cargo` é a linha do `Cargo`. */
export function alcancaOItem(item, { tenant, cargo }) {
  if (item.modulo && !(tenantTemModulo(tenant, item.modulo) && cargoAlcancaModulo(cargo, item.modulo))) return false;
  if (item.permissao && !cargo?.[item.permissao]) return false;
  return true;
}

/** O conteúdo só com o que esta pessoa alcança; `null` se não sobrar nada. */
export function oQueVe(conteudo, quem) {
  const secoes = (conteudo?.secoes || [])
    .map((s) => ({ ...s, itens: s.itens.filter((i) => alcancaOItem(i, quem)) }))
    .filter((s) => s.itens.length);
  return secoes.length ? { ...conteudo, secoes } : null;
}

export const contarItens = (conteudo) => (conteudo?.secoes || []).reduce((t, s) => t + s.itens.length, 0);

/** A linha da lista do painel. */
export function resumoDaNovidade(n) {
  return {
    chave: n.chave,
    status: n.status,
    titulo: n.conteudo?.titulo || "",
    versao: n.versao,
    itens: contarItens(n.conteudo),
    origem: n.origem,
    atualizadoEm: n.updatedAt,
    atualizadoPor: n.atualizadoPor,
    publicadoEm: n.publicadoEm,
    publicadoPor: n.publicadoPor,
  };
}

const ROTULO = { novo: "Novo", melhoria: "Melhorou", correcao: "Corrigido", mudanca: "Mudou de lugar" };

/**
 * Manda a novidade publicada a quem tem e-mail, cada um com o seu recorte.
 * Disparado e esquecido por quem publica: devolve na hora quantos vão
 * receber, e os envios seguem um de cada vez (o transporte tem teto de 10 s, e
 * mandar centenas juntos estouraria o limite do provedor).
 */
export async function enviarNovidadesPorEmail(prisma, novidade) {
  if (!isEmailEnabled()) return { destinatarios: 0, motivo: "sem transporte de e-mail neste ambiente" };
  const base = (process.env.APP_URL || "").trim().replace(/\/+$/, "") || "https://omnimob.app";
  const link = `${base}/?novidades=${encodeURIComponent(novidade.chave)}`;
  const usuarios = await prisma.usuario.findMany({
    where: { ativo: true, email: { not: null }, tenant: { ativo: true } },
    select: { nome: true, email: true, cargo: true, tenant: { select: { modulos: true } } },
  });
  const fila = [];
  for (const u of usuarios) {
    const visto = oQueVe(novidade.conteudo, { tenant: u.tenant, cargo: u.cargo });
    if (!visto || !u.email?.includes("@")) continue;
    const itens = visto.secoes.flatMap((s) => s.itens.map((i) => ({ titulo: i.titulo, onde: i.onde, rotulo: ROTULO[i.tipo] || "Novo" })));
    fila.push({ to: u.email, ...emailNovidades({ nome: u.nome, titulo: visto.titulo, versao: novidade.versao, itens, link }) });
  }
  (async () => {
    for (const m of fila) await sendEmail({ to: m.to, subject: m.subject, body: m.body, html: m.html }).catch(() => {});
  })();
  return { destinatarios: fila.length };
}
