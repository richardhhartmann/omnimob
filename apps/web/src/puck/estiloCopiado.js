/* ────────────────────────────────────────────────────────────────────────────
   A ÁREA DE TRANSFERÊNCIA DE ESTILO.

   Copiar a aparência de uma peça e colar noutra — o editor clássico tinha, e é
   o que faz três blocos ficarem iguais sem digitar a mesma cor três vezes.

   ── O QUE É "ESTILO" AQUI ──

   Só o que a pessoa escolheu na aba de aparência: as duas cores e os três
   campos do banner. Conteúdo NÃO viaja: colar o estilo de um Rodapé num
   Cabeçalho não pode trazer o texto do rodapé junto, e a fronteira entre as
   duas coisas é o que impede a ação de virar "duplicar por engano".

   ── POR QUE MÓDULO, E NÃO ESTADO ──

   A barra da peça é remontada a cada troca de seleção — é justamente o que
   acontece entre copiar e colar. Estado local morreria no caminho; o módulo
   sobrevive, e some ao recarregar a tela, que é a vida útil certa para isto.
   ──────────────────────────────────────────────────────────────────────────── */

const CAMPOS = [
  "backgroundColor",
  "color",
  "backgroundImage",
  "backgroundOverlay",
  "backgroundBrightness",
];

let guardado = null;

/** Tira da peça só os campos de aparência que ela realmente tem. */
export function copiarEstilo(props) {
  const copia = {};
  for (const campo of CAMPOS) {
    if (props && campo in props) copia[campo] = props[campo];
  }
  guardado = Object.keys(copia).length ? copia : null;
  return Boolean(guardado);
}

export function temEstiloCopiado() {
  return Boolean(guardado);
}

/**
 * Aplica o estilo guardado, respeitando o que a peça de destino aceita.
 *
 * Widget não tem banner, e colar os três campos nele criaria props que nenhum
 * componente lê — lixo que viaja no documento e reaparece num Publish futuro.
 * Por isso a peneira é pelo que o DESTINO já tem, não pelo que a origem deu.
 */
export function colarEstilo(props) {
  if (!guardado) return null;
  const saida = {};
  for (const [campo, valor] of Object.entries(guardado)) {
    if (props && campo in props) saida[campo] = valor;
  }
  return Object.keys(saida).length ? saida : null;
}
