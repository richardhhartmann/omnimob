/* ── Tem um tour na tela? ─────────────────────────────────────────────────────

   ── POR QUE ISTO EXISTE ──

   Os atalhos e o tour disputam o mesmo teclado, e o tour perde sempre. Apertar
   "3" no meio de um passo levava para Relatórios; Esc saía do formulário de
   cliente pela metade. Nos dois casos o tour continuava vivo, apontando para
   elementos de uma tela que já não estava ali — a pessoa fugia do tour sem
   querer e o que sobrava era um holofote perdido.

   ── POR QUE UM REGISTRO DE MÓDULO, E NÃO UMA PROP ──

   Mesmo arranjo (e mesmo motivo) do `registroDeNovo.js`: quem pergunta está
   ACIMA de quem responde. O ouvinte de teclas mora no `AdminLayout`, e os três
   tours — o global do Hub, o do Flow e o de tela — são descendentes dele. Uma
   prop exigiria que cada tour novo lembrasse de avisar o layout, e o
   esquecimento seria silencioso: o atalho voltaria a atropelar o tour e ninguém
   descobriria até alguém apertar uma tecla no lugar errado.

   Quem marca é o `TourGuiado`, que é o motor único dos três. Tour novo nasce
   protegido sem ninguém ligar nada.

   ── CONTADOR, E NÃO UM BOOLEANO ──

   Na virada do tour global para o tour de tela há um instante com os dois
   montados. Com um booleano, o `false` de quem sai apagaria o `true` de quem
   entra, e os atalhos voltariam a valer no meio do tour seguinte.

   ── O "N" É A EXCEÇÃO, E É DELIBERADA ──

   `global.novo` não tira ninguém do tour: ele faz exatamente o que o passo está
   pedindo ("Clique em Novo Cliente"). Bloqueá-lo junto com o resto puniria quem
   já aprendeu o atalho, na única tela em que ele é a resposta certa.
   ────────────────────────────────────────────────────────────────────────── */

/** As ações que continuam valendo com o tour aberto. */
export const ACOES_NO_TOUR = new Set(["global.novo"]);

let abertos = 0;
const ouvintes = new Set();

function avisar() {
  ouvintes.forEach((fn) => fn());
}

/** Marca um tour como aberto. Devolve a função que o fecha. */
export function marcarTourAberto() {
  abertos += 1;
  avisar();
  let fechado = false;
  return () => {
    if (fechado) return;
    fechado = true;
    abertos = Math.max(0, abertos - 1);
    avisar();
  };
}

/** Há um tour rodando agora? */
export function tourAtivo() {
  return abertos > 0;
}

/** Avisa quando a resposta de `tourAtivo` muda. Devolve a função que desassina. */
export function assinarTour(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

/**
 * O mapa de teclas, peneirado pelo tour.
 *
 * Fora do tour devolve o mesmo mapa, sem cópia. Com o tour aberto sobra só o
 * que `ACOES_NO_TOUR` libera — e é por aqui que passam TANTO o ouvinte de
 * teclas quanto o selo desenhado no botão, para que o selo nunca prometa uma
 * tecla que não funciona.
 */
export function filtrarNoTour(mapa) {
  if (!tourAtivo()) return mapa;
  const restrito = new Map();
  for (const [tecla, acao] of mapa) {
    if (ACOES_NO_TOUR.has(acao.id)) restrito.set(tecla, acao);
  }
  return restrito;
}
