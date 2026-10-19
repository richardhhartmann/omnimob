/* ────────────────────────────────────────────────────────────────────────────
   A PEÇA "NA MÃO", PARA COLOCAR COM UM CLIQUE.

   Até aqui a única forma de acrescentar uma peça era arrastá-la da gaveta até
   a página — e arrastar uma distância grande, rolando a prancheta no caminho,
   é o gesto mais difícil do editor, em especial no trackpad. Agora um clique
   no cartão da gaveta ARMA a peça; o próximo clique na prancheta a põe ali,
   com a mesma prévia e as mesmas regras do arrasto (ver `useColocarAoClicar`,
   em `PonteDeEdicao`). Esc, ou clicar de novo no cartão, desarma.

   ── POR QUE MÓDULO, E NÃO ESTADO ──

   Quem arma é o cartão da gaveta, no documento do editor; quem coloca é a
   ponte, que desenha dentro do iframe da prévia. São duas árvores do React que
   não se encontram por props. O módulo é o ponto comum — o mesmo arranjo de
   `estiloCopiado.js` —, e AVISA quem assinou: sem o aviso, o cartão não
   acenderia no mesmo clique que o armou.
   ──────────────────────────────────────────────────────────────────────────── */

let armada = null;
const ouvintes = new Set();

function avisar() {
  for (const ouvinte of ouvintes) ouvinte();
}

/** Assina as mudanças. Devolve a função que cancela. */
export function assinarPecaArmada(ouvinte) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

/** `{ tipo, rotulo }` da peça armada, ou `null`. */
export function pecaArmada() {
  return armada;
}

/** Arma a peça; armar a mesma de novo desarma (o clique no cartão alterna). */
export function alternarPecaArmada(tipo, rotulo) {
  armada = armada?.tipo === tipo ? null : { tipo, rotulo: rotulo || "a peça nova" };
  avisar();
}

export function desarmarPeca() {
  if (!armada) return;
  armada = null;
  avisar();
}
