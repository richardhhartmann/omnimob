/* ────────────────────────────────────────────────────────────────────────────
   QUANDO PEDIR A AVALIAÇÃO DO PAINEL — porte do pulso de avaliação do VYA, que
   por sua vez veio do pulso do trial daqui (`pulsoTrial.js`).

   A pergunta nasce de TRABALHO FEITO: cada operação que o pulso do trial já
   reconhece (cadastrar imóvel, cliente, usuário, cargo, mexer na vitrine) soma
   1. A cada 5, a pergunta fica PENDENTE e só aparece quando a pessoa SAI da
   tela onde trabalhou — a mesma regra do trial: salvar quase nunca é o fim da
   tarefa, e um modal no meio dela é interrupção.

   Contador e pendência PRÓPRIOS, e não os do trial: os dois consomem a
   pendência na troca de rota, e dividir uma só faria um apagar a vez do outro.

   Quem decide de verdade é o servidor (`GET /api/avaliacoes/minha`): já
   respondeu, conta em teste, suporte dentro da conta, demonstração. Ele só é
   perguntado quando o contador diz que é a hora.

   Memória no navegador, por imobiliária e pessoa: mandar cada operação para a
   API só para alimentar esta conta seria uma requisição a mais em cada
   salvamento.
   ──────────────────────────────────────────────────────────────────────────── */

export const OPERACOES_POR_PERGUNTA = 5;
const VALIDADE_PENDENCIA_MS = 6 * 60 * 60 * 1000;
// O auto-save da vitrine salva a cada segundo: uma sessão de edição conta uma vez a cada 5 min.
const JANELA_VITRINE_MS = 5 * 60 * 1000;

let dono = null; // "<tenantId>:<usuarioId>"

export function definirDonoDoPulsoDeAvaliacao(tenantId, usuarioId) {
  dono = tenantId && usuarioId ? `${tenantId}:${usuarioId}` : null;
}

const chave = () => (dono ? `omnimob_pulso_avaliacao:${dono}` : null);

function ler() {
  try {
    const c = chave();
    const dados = c ? JSON.parse(localStorage.getItem(c) || "{}") : {};
    return dados && typeof dados === "object" ? dados : {};
  } catch {
    return {};
  }
}

function gravar(dados) {
  try {
    const c = chave();
    if (c) localStorage.setItem(c, JSON.stringify(dados));
  } catch { /* sem armazenamento, sem pergunta: o lado seguro de errar */ }
}

/** Chamado pelo pulso do trial a cada operação reconhecida. Nunca lança. */
export function contarParaAvaliacao(origem, agora = Date.now()) {
  try {
    const d = ler();
    if (!dono || d.respondeu) return;
    if (origem === "vitrine" && d.ultimaVitrine && agora - d.ultimaVitrine < JANELA_VITRINE_MS) return;
    const operacoes = (d.operacoes || 0) + 1;
    const pendencia =
      operacoes >= OPERACOES_POR_PERGUNTA ? { rota: typeof window !== "undefined" ? window.location.pathname : "", em: agora } : d.pendencia || null;
    gravar({
      ...d,
      operacoes: operacoes >= OPERACOES_POR_PERGUNTA ? 0 : operacoes,
      pendencia,
      ...(origem === "vitrine" ? { ultimaVitrine: agora } : {}),
    });
  } catch { /* acessório */ }
}

/**
 * Há pergunta pendente, de trabalho feito em OUTRA tela? Devolve `true` e
 * apaga a marca — o mesmo trabalho não rende duas perguntas.
 */
export function consumirPendenciaDeAvaliacao(rotaAtual, agora = Date.now()) {
  const d = ler();
  const p = d.pendencia;
  if (!p || d.respondeu) return false;
  if (agora - p.em > VALIDADE_PENDENCIA_MS) {
    gravar({ ...d, pendencia: null });
    return false;
  }
  if (p.rota === rotaAtual) return false;
  gravar({ ...d, pendencia: null });
  return true;
}

/** O tour subiu no meio: a pergunta volta a valer na próxima saída de tela. */
export function devolverPendenciaDeAvaliacao(rotaAtual) {
  gravar({ ...ler(), pendencia: { rota: rotaAtual, em: Date.now() } });
}

/** Respondeu (ou o servidor disse que não pergunta mais): nunca mais conta. */
export function encerrarPulsoDeAvaliacao() {
  gravar({ respondeu: true });
}
