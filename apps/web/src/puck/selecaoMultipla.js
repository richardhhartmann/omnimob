/* ────────────────────────────────────────────────────────────────────────────
   A SELEÇÃO DE VÁRIAS PEÇAS.

   O Puck tem UMA peça selecionada — `itemSelector`, um endereço só. É o que o
   inspetor lê, o que a barra da peça decora e o que o atalho de excluir usa.
   Selecionar duas não cabe nesse formato, e trocar o formato dele não é opção:
   ele é o contrato com a biblioteca inteira.

   Então a seleção múltipla vive AO LADO. Este módulo é a lista, e nada mais:
   quem desenha o realce é o CSS, quem oferece as ações é a barra flutuante, e
   quem escreve no documento continua sendo o `dispatch` do Puck.

   ── POR QUE UM MÓDULO COM ESTADO, E NÃO CONTEXTO ──

   Mesma razão de `intencaoDeAgrupar`, e ela vale ainda mais aqui: quem escuta o
   clique é a ponte, DENTRO do iframe da prévia; quem desenha a barra e a
   Estrutura está FORA dele. Os dois lados não compartilham árvore de React, e
   um provedor atravessando o iframe carregaria uma lista de strings.

   O estado é um só porque só existe um editor por vez na tela.

   ── A ÂNCORA ──

   `shift` seleciona um INTERVALO, e intervalo precisa de um começo. A âncora é
   a última peça escolhida sem shift — é dela até a clicada que o intervalo se
   estende. Sem guardar isso, o segundo shift+clique mediria a partir da peça
   errada e a faixa saltaria.
   ──────────────────────────────────────────────────────────────────────────── */

let ids = [];
let ancora = null;
const ouvintes = new Set();

function avisar() {
  for (const f of ouvintes) f(ids);
}

/** Avisa a cada mudança. Devolve a função que cancela a inscrição. */
export function observarSelecao(f) {
  ouvintes.add(f);
  f(ids);
  return () => ouvintes.delete(f);
}

export function idsSelecionados() {
  return ids;
}

export function estaSelecionada(id) {
  return ids.includes(id);
}

export function ancoraDaSelecao() {
  return ancora;
}

/** Uma peça só, e ela vira a âncora. É o que o clique simples faz. */
export function definirSelecao(novos, novaAncora = null) {
  ids = Array.from(new Set(novos.filter(Boolean)));
  ancora = novaAncora ?? (ids.length === 1 ? ids[0] : ancora);
  avisar();
}

/** Ctrl/⌘: entra quem está fora, sai quem está dentro. */
export function alternarNaSelecao(id) {
  if (!id) return;
  ids = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  /* A âncora acompanha o último gesto: quem acabou de entrar passa a ser o
     começo do próximo intervalo. Tirando a última, não sobra âncora. */
  ancora = ids.includes(id) ? id : (ids[ids.length - 1] || null);
  avisar();
}

export function limparSelecao() {
  if (!ids.length && !ancora) return;
  ids = [];
  ancora = null;
  avisar();
}

/**
 * Shift: tudo entre a âncora e `id`, na ordem em que `ordem` lista.
 *
 * `ordem` é a lista achatada de ids como eles aparecem na página — quem a monta
 * é quem tem o documento à mão. Aqui só se recorta a faixa.
 */
export function selecionarIntervalo(id, ordem) {
  if (!id) return;
  if (!ancora || !ordem.includes(ancora)) {
    definirSelecao([id], id);
    return;
  }
  const a = ordem.indexOf(ancora);
  const b = ordem.indexOf(id);
  if (a < 0 || b < 0) { definirSelecao([id], id); return; }
  const faixa = ordem.slice(Math.min(a, b), Math.max(a, b) + 1);
  /* A âncora NÃO muda: arrastar o shift para cima e para baixo tem de medir
     sempre do mesmo começo, senão a faixa cresce sozinha a cada clique. */
  ids = faixa;
  avisar();
}
