/* ────────────────────────────────────────────────────────────────────────────
   A ÁREA DE TRANSFERÊNCIA DE ESTILO.

   Copiar a aparência de uma peça e colar noutra — o editor clássico tinha, e é
   o que faz três blocos ficarem iguais sem digitar a mesma cor três vezes.

   ── O QUE É "ESTILO" AQUI ──

   Tudo que a pessoa ajusta na APARÊNCIA da peça: as duas cores, o banner (a
   imagem, o enquadramento dela, o escurecimento e o brilho), a largura, os
   dois espaçamentos e o arredondamento. Conteúdo NÃO
   viaja: colar o estilo de um Rodapé num Cabeçalho não pode trazer o texto do
   rodapé junto, e a fronteira entre as duas coisas é o que impede a ação de
   virar "duplicar por engano". `oculto` e `travado` também ficam: são estado
   da peça, não aparência.

   ── O VAZIO TAMBÉM É COPIADO ──

   Uma peça sem cor de fundo tem, como estilo, "sem fundo". Copiar só o que
   estava preenchido fazia o colar MISTURAR os dois estilos: a cor de texto
   vinha, e o fundo vermelho do destino ficava. Por isso cada campo que a
   ORIGEM aceita vai na cópia, preenchido ou não — e colar um vazio devolve o
   destino ao padrão (as props vencem o `estilo` legado mesmo vazias; ver
   `useEstiloDoBloco`).

   ── A PENEIRA É O QUE O DESTINO ACEITA ──

   O Widget genérico não tem cor, e colar a cor nele criaria uma prop que
   nenhum componente lê — lixo que viaja no documento. A primeira versão
   peneirava pelo que o destino JÁ TINHA preenchido, e por isso uma peça nova,
   ainda sem cor nenhuma, não recebia cor nenhuma. Agora a peneira são os
   CAMPOS do componente de destino, que quem chama tira da config do Puck.

   ── POR QUE MÓDULO, E NÃO ESTADO ──

   A barra da peça é remontada a cada troca de seleção — é justamente o que
   acontece entre copiar e colar. Estado local morreria no caminho; o módulo
   sobrevive, e some ao recarregar a tela, que é a vida útil certa para isto.
   O módulo AVISA quem assinou (`assinarEstiloCopiado`): sem o aviso, o botão
   "colar" só aparecia na próxima vez que a barra se redesenhasse por outro
   motivo, e a pessoa concluía que copiar não tinha funcionado.
   ──────────────────────────────────────────────────────────────────────────── */

export const CAMPOS_DE_ESTILO = [
  "backgroundColor",
  "color",
  "backgroundImage",
  "backgroundOverlay",
  "backgroundBrightness",
  "enquadramento",
  "larguraDaPeca",
  "largura",
  "espacoInterno",
  "espacoExterno",
  "arredondamento",
];

let guardado = null;
const ouvintes = new Set();

function avisar() {
  for (const ouvinte of ouvintes) ouvinte();
}

/** Assina as mudanças da área de transferência. Devolve a função que cancela. */
export function assinarEstiloCopiado(ouvinte) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

/**
 * Guarda a aparência da peça.
 *
 * @param {object} props        as props da peça de origem
 * @param {Iterable<string>} camposDaOrigem os campos que o componente de origem aceita
 */
export function copiarEstilo(props, camposDaOrigem) {
  const aceitos = new Set(camposDaOrigem || []);
  const copia = {};
  for (const campo of CAMPOS_DE_ESTILO) {
    if (aceitos.has(campo)) copia[campo] = props ? props[campo] : undefined;
  }
  guardado = Object.keys(copia).length ? copia : null;
  avisar();
  return Boolean(guardado);
}

export function temEstiloCopiado() {
  return Boolean(guardado);
}

/** Esquece o que foi copiado (os testes começam do zero). */
export function esquecerEstiloCopiado() {
  guardado = null;
  avisar();
}

/**
 * O estilo guardado, só com os campos que o DESTINO aceita.
 *
 * @param {Iterable<string>} camposDoDestino os campos do componente de destino
 * @returns {object|null} as props a aplicar, ou `null` se nada se aplica.
 */
export function colarEstilo(camposDoDestino) {
  if (!guardado) return null;
  const aceitos = new Set(camposDoDestino || []);
  const saida = {};
  for (const [campo, valor] of Object.entries(guardado)) {
    if (aceitos.has(campo)) saida[campo] = valor;
  }
  return Object.keys(saida).length ? saida : null;
}
