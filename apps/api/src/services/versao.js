import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* ────────────────────────────────────────────────────────────────────────────
   A VERSÃO DA OMNIMOB: MAIOR.SEMANA.ENTREGA, tirada do git.

   A mesma régua do VYA (`apps/api/core/versao.py` de lá), para o suporte ler as
   duas do mesmo jeito: "corrigido na 1.4.2" = segunda entrega da semana 4, e
   quem está na 1.4.2 ou depois já tem a correção.

   · MAIOR muda à mão, só numa virada grande. Ao trocar, ponha em INICIO a
     terça (15h01) em que ela começa.
   · SEMANA é a das Novidades: de terça 15h01 a terça 15h01 (Brasília). A
     apresentação de cada terça conta a MAIOR.SEMANA que acabou de fechar.
   · ENTREGA é a ordem do commit na `main` dentro da semana, começando em 1.
     Aqui cada commit da `main` é um PR (merge por squash), então cada entrega
     tem o título do PR — no VYA as mensagens são todas `update`.

   No servidor não há histórico garantido: o build guarda o que precisa em
   `versoes.json` (`scripts/versao.js --gravar`, chamado pelo `npm run build`).
   Sem git e sem o arquivo, a versão é "dev" — nunca um número inventado.
   ──────────────────────────────────────────────────────────────────────────── */

export const MAIOR = 1;
/** 27/10/2026, 15h01 de Brasília (18h01 UTC): o começo da semana 1. */
export const INICIO = Date.UTC(2026, 9, 27, 18, 1) / 1000;
const SEMANA = 7 * 24 * 3600;
/** Por versão, no máximo isto de arquivos na lista (o total vai à parte). */
const MAX_ARQUIVOS = 150;

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const ARQUIVO_DO_HISTORICO = path.resolve(AQUI, "..", "..", "versoes.json");

/** A SEMANA de um instante (epoch em segundos). Antes do INICIO é 0. */
export const semanaDe = (ts) => Math.max(0, Math.floor((Number(ts) - INICIO) / SEMANA) + 1);

/** MAIOR.SEMANA da apresentação que chega na terça `dia` (AAAA-MM-DD): a semana que fecha às 15h01 dela. */
export function daApresentacao(dia) {
  const [a, m, d] = String(dia).split("-").map(Number);
  const fecha = Date.UTC(a, m - 1, d, 18, 1) / 1000;
  return `${MAIOR}.${semanaDe(fecha - 1)}`;
}

/**
 * Numera os commits (do mais antigo ao mais novo) e devolve o histórico da aba
 * Versionamento, o mais novo primeiro. Função pura: o teste não precisa de git.
 * `antes` são as datas dos commits anteriores ao INICIO (a 1.0, resumida).
 */
export function montarHistorico(commits, antes = []) {
  const contagem = new Map();
  const versoes = commits.map((c) => {
    const semana = semanaDe(c.ts);
    contagem.set(semana, (contagem.get(semana) || 0) + 1);
    return {
      versao: `${MAIOR}.${semana}.${contagem.get(semana)}`,
      semana: `${MAIOR}.${semana}`,
      commit: c.commit,
      data: new Date(c.ts * 1000).toISOString(),
      autor: c.autor,
      titulo: c.titulo,
      arquivos: c.arquivos.slice(0, MAX_ARQUIVOS),
      total_arquivos: c.arquivos.length,
    };
  });
  const iso = (ts) => new Date(ts * 1000).toISOString();
  return {
    inicio: iso(INICIO),
    versoes: versoes.reverse(),
    antes: {
      versao: `${MAIOR}.0`,
      commits: antes.length,
      de: antes.length ? iso(Math.min(...antes)) : null,
      ate: antes.length ? iso(Math.max(...antes)) : null,
    },
  };
}

/** A saída do git, ou null sem git ou com clone raso (contaria menos entregas). */
function git(...args) {
  try {
    const rodar = (...a) => execFileSync("git", a, { cwd: AQUI, encoding: "utf8", timeout: 20000, stdio: ["ignore", "pipe", "ignore"] });
    if (rodar("rev-parse", "--is-shallow-repository").trim() === "true") return null;
    return rodar(...args);
  } catch {
    return null;
  }
}

/** O histórico desde o INICIO, lido do git. null sem git. */
export function historicoDoGit() {
  const saida = git("log", "--first-parent", "--reverse", `--since=@${INICIO}`, "--format=%x1e%H%x1f%ct%x1f%an%x1f%s", "--name-only");
  const antes = git("log", "--first-parent", `--until=@${INICIO - 1}`, "--format=%ct");
  if (saida == null || antes == null) return null;
  const commits = saida.split("\x1e").slice(1).map((bloco) => {
    const [cabeca, ...resto] = bloco.split("\n");
    const [commit, ts, autor, titulo] = cabeca.split("\x1f");
    return { commit, ts: Number(ts), autor, titulo, arquivos: resto.map((l) => l.trim()).filter(Boolean) };
  });
  return montarHistorico(commits, antes.split(/\s+/).filter(Boolean).map(Number));
}

function doArquivo() {
  try {
    return JSON.parse(readFileSync(ARQUIVO_DO_HISTORICO, "utf8"));
  } catch {
    return null;
  }
}

/** O histórico do git quando há um (dev), senão o que o build gravou. */
export function historico() {
  return historicoDoGit() || doArquivo();
}

let atual = null;

/**
 * A versão no ar: `{ numero, commit }`. Lida uma vez por processo — o código
 * não muda sem reiniciar. O commit vem do ambiente (o Render o injeta), e na
 * falta dele, do próprio histórico.
 */
export function versaoAtual() {
  if (!atual) {
    const h = historico();
    const topo = h?.versoes?.[0] || null;
    const commit = (process.env.RENDER_GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT || topo?.commit || "").slice(0, 7) || null;
    /* Sem versão nova desde o INICIO, quem está no ar é a 1.0. A imagem
       Docker não leva o .git: lá o número chega pronto em OMNIMOB_VERSAO. */
    const numero = topo?.versao || (h ? h.antes.versao : (process.env.OMNIMOB_VERSAO || "").trim() || "dev");
    atual = { numero, commit };
  }
  return atual;
}
