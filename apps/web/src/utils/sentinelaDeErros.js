import { enviarRelatoDeErro } from "../api";
import { loadSession } from "../session";

/* ────────────────────────────────────────────────────────────────────────────
   O QUE QUEBRA NO NAVEGADOR TAMBÉM PRECISA CHEGAR EM ALGUÉM.

   Porte da sentinela do VYA. Um erro numa tela do painel não passa pelo
   servidor e não aparece em log nenhum; quem descobre é o cliente. Esta
   sentinela escuta as duas portas por onde um erro escapa e manda o relato
   para `POST /public/erros`, que avisa o desenvolvimento por e-mail
   (`api/services/avisoDeErro.js`).

     · `error` — a exceção que ninguém pegou;
     · `unhandledrejection` — a Promise rejeitada sem `.catch`, por onde sai
       quase todo `fetch` que falhou dentro de um `useEffect`.

   O que estoura DURANTE o render é pego pelo `LimiteDeErro`, que chama
   `relatarErro` direto: ali o React já engoliu o erro e a janela não o vê.

   Fica de fora o que não é erro de ninguém: extensão do navegador, o
   "ResizeObserver loop" do Chrome, queda de conexão e o pedaço que não baixou
   depois de um deploy (o `LimiteDeErro` já oferece recarregar). E o mesmo
   erro só viaja uma vez por aba: o servidor também agrupa, mas o que não sai
   daqui não gasta a rede de quem está no meio de um problema.
   ──────────────────────────────────────────────────────────────────────────── */

const RUIDO = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /Failed to fetch|NetworkError|Load failed|Network request failed/i,
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError/i,
  /chrome-extension:|moz-extension:|safari-extension:/i,
  /AbortError|The user aborted a request/i,
];

const jaRelatados = new Set();

export function relatarErro(erro, extra = {}) {
  try {
    const mensagem = String(erro?.message || erro || "").trim();
    const pilha = String(erro?.stack || extra.pilha || "");
    if (!mensagem || RUIDO.some((r) => r.test(mensagem) || r.test(pilha.split("\n")[1] || ""))) return;
    const chave = `${mensagem}|${pilha.split("\n")[1] || ""}`;
    if (jaRelatados.has(chave)) return;
    jaRelatados.add(chave);

    const sessao = loadSession();
    enviarRelatoDeErro({
      mensagem,
      pilha,
      url: window.location.pathname + window.location.search,
      tenant: sessao?.tenant?.slug || "",
      usuario: sessao?.usuario?.login || sessao?.usuario?.nome || "",
    });
  } catch { /* a sentinela nunca vira o segundo erro */ }
}

export function instalarSentinela() {
  window.addEventListener("error", (e) => {
    // Recurso que não carregou (<img>, <script>) chega sem `error`: não é defeito de código.
    if (!e.error && !e.message) return;
    relatarErro(e.error || { message: e.message, stack: `${e.filename}:${e.lineno}:${e.colno}` });
  });
  window.addEventListener("unhandledrejection", (e) => relatarErro(e.reason));
}
