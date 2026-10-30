import { createHash } from "node:crypto";
import { sendEmail } from "./notificationService.js";
import { versaoAtual } from "./versao.js";

/* ────────────────────────────────────────────────────────────────────────────
   O QUE QUEBRA PRECISA CHEGAR EM ALGUÉM.

   Porte da sentinela do VYA. Metade do sistema roda no navegador: um
   `undefined` numa tela do painel não passa pelo servidor e não aparece em log
   nenhum — quem descobre é o cliente, e o que chega ao suporte é "a tela ficou
   branca". O navegador manda o relato para `POST /public/erros`; o tratamento
   de erro do Express manda os 500 que ninguém previu. Os dois caem aqui.

   ── AGRUPADO, NÃO UM POR OCORRÊNCIA ──

   A impressão digital é a mensagem sem números (ids, posições, horários) mais
   a primeira linha da pilha. O mesmo erro avisa UMA vez por hora, com quantas
   vezes aconteceu desde o último aviso; e há um teto por hora no total, porque
   um deploy quebrado produz cem erros diferentes em um minuto e cem e-mails
   não ajudam ninguém a consertar.

   A memória é do processo, e é de propósito: reiniciar zera a contagem, e o
   primeiro erro depois de um deploy é exatamente o que se quer ver.

   Destino: `CHAMADOS_INTERNOS_EMAIL` (o desenvolvimento), ou `CONTATO_EMAIL`.
   Sem nenhum dos dois, só o console.
   ──────────────────────────────────────────────────────────────────────────── */

const JANELA_MS = 60 * 60 * 1000;
const TETO_POR_HORA = 20;

const vistos = new Map(); // impressão → { avisadoEm, desde }
let enviados = []; // instantes dos e-mails da última hora

/** A impressão digital: o mesmo defeito em outro id é o mesmo defeito. */
export function impressaoDoErro({ origem, mensagem, pilha }) {
  const msg = String(mensagem || "").replace(/\d+/g, "#").slice(0, 300);
  const linha = String(pilha || "").split("\n").map((l) => l.trim()).find((l) => l.startsWith("at ") || l.includes("@")) || "";
  return createHash("sha1").update(`${origem}|${msg}|${linha.replace(/\d+/g, "#")}`).digest("hex").slice(0, 12);
}

/**
 * Decide se este erro vira e-mail agora. Devolve `null` (segura) ou
 * `{ vezes }` — quantas vezes ele aconteceu desde o último aviso. Pura no
 * relógio: o teste passa o `agora`.
 */
export function deveAvisar(impressao, agora = Date.now()) {
  enviados = enviados.filter((t) => agora - t < JANELA_MS);
  const visto = vistos.get(impressao);
  if (visto && agora - visto.avisadoEm < JANELA_MS) {
    visto.desde += 1;
    return null;
  }
  if (enviados.length >= TETO_POR_HORA) return null;
  const vezes = (visto?.desde || 0) + 1;
  vistos.set(impressao, { avisadoEm: agora, desde: 0 });
  enviados.push(agora);
  return { vezes };
}

/** Só para o teste: começa do zero. */
export function esquecerErros() {
  vistos.clear();
  enviados = [];
}

/**
 * Registra o erro e, se for a hora, avisa por e-mail. Nunca lança e nunca é
 * aguardado por quem chama: avisar de um erro não pode virar um segundo erro.
 */
export function avisarErro({ origem, mensagem, pilha, url, contexto } = {}) {
  try {
    const impressao = impressaoDoErro({ origem, mensagem, pilha });
    console.error(`[erro:${origem}] ${impressao} ${mensagem}${url ? ` (${url})` : ""}`);
    const decisao = deveAvisar(impressao);
    const para = (process.env.CHAMADOS_INTERNOS_EMAIL || process.env.CONTATO_EMAIL || "").trim();
    if (!decisao || !para) return;

    const versao = versaoAtual();
    const linhas = [
      `Onde: ${origem === "navegador" ? "no navegador de um cliente" : "no servidor"}`,
      url ? `Página: ${url}` : null,
      `Versão: ${versao.numero}${versao.commit ? ` (${versao.commit})` : ""}`,
      decisao.vezes > 1 ? `Aconteceu ${decisao.vezes} vezes desde o último aviso.` : null,
      ...Object.entries(contexto || {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`),
      "",
      String(mensagem || ""),
      "",
      String(pilha || "(sem pilha)").slice(0, 4000),
    ].filter((l) => l !== null);

    sendEmail({
      to: para,
      subject: `[Omnimob] Erro ${origem === "navegador" ? "no navegador" : "no servidor"}: ${String(mensagem || "").slice(0, 80)}`,
      body: linhas.join("\n"),
    }).catch(() => {});
  } catch { /* o aviso é acessório */ }
}
