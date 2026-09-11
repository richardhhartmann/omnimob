/* ────────────────────────────────────────────────────────────────────────────
   "AO LADO DE" — A INTENÇÃO QUE O ARRASTO DO PUCK NÃO SABE REPRESENTAR.

   Cada zona de soltura do Puck é uma LISTA. Soltar significa sempre "antes ou
   depois de", e não existe destino que signifique "à direita desta, virando
   duas colunas". Foi por isso que lado a lado nasceu como ação de barra.

   Este módulo acrescenta o GESTO por cima disso, e o faz observando o ponteiro:
   enquanto se arrasta, ele anota sobre qual peça o ponteiro está e se está na
   faixa lateral dela. Ao soltar, a página consulta essa anotação e, havendo
   uma, agrupa em vez de aceitar a reordenação que o Puck acabou de fazer.

   ── A ANOTAÇÃO MORRE COM O GESTO SEGUINTE, E NÃO COM O RELÓGIO ──

   Isto já foi um prazo de 500ms, e o prazo era um defeito. Ele corria contra a
   MÃO de quem edita: a pessoa arrasta até o terço lateral, PARA para conferir a
   mira — que é o que a mira existe para permitir — e só então solta. Meio
   segundo de conferência bastava para a anotação expirar, e o gesto que ela viu
   prometido virava uma reordenação comum.

   Isso passou por três correções sem ser encontrado porque a sondagem soltava
   no mesmo quadro do último movimento; o robô nunca hesitou.

   O que a anotação precisa é sobreviver do último movimento até o `pointerup`
   DAQUELE gesto. O fim natural dela não é um relógio: é o gesto seguinte
   começar. Quem apaga é o `pointerdown` — e ele cobre melhor o caso que o prazo
   queria cobrir, porque qualquer ação posterior (clicar em duplicar, abrir um
   menu, selecionar outra peça) começa com um `pointerdown`.

   ── POR QUE UM MÓDULO COM ESTADO, E NÃO CONTEXTO ──

   Quem observa o ponteiro é a ponte de edição, que vive DENTRO do iframe da
   prévia; quem recebe o `onAction` do drop é a página, fora dele. Os dois lados
   não compartilham árvore de React, e passar isso por contexto exigiria um
   provedor atravessando o iframe só para carregar duas variáveis.

   O estado é um só porque só existe um editor por vez na tela. A validade por
   TEMPO é o que impede uma anotação velha de contaminar uma ação que não veio
   de arrasto nenhum — sem ela, um clique em "duplicar" meia hora depois
   agruparia peças por conta própria.

   ── A DICA VISUAL NÃO É ENFEITE ──

   O indicador do Puck vai continuar dizendo "abaixo desta peça" enquanto o
   ponteiro estiver na faixa lateral, porque para ele é isso mesmo que está
   acontecendo. Sem uma segunda marca dizendo "vai virar coluna", o gesto seria
   adivinhação: a pessoa solta esperando uma coisa e recebe outra. A barra
   vertical no lado do alvo é o que torna a intenção legível ANTES do resultado.
   ──────────────────────────────────────────────────────────────────────────── */

/* Quanto da largura da peça, em cada ponta, conta como "ao lado".
   Um terço de cada lado deixa o meio — o alvo de quem quer só reordenar — com
   mais espaço do que as duas faixas somadas, que é a proporção certa: reordenar
   é o gesto comum, agrupar é o gesto especial. */
const FAIXA = 0.33;

let intencao = null;

export function anotarIntencao(alvoId, lado) {
  intencao = { alvoId, lado, quando: Date.now() };
}

/* `quando` continua gravado e não é lido por ninguém: ele serve a quem for
   depurar um drop que não agrupou, para saber se a anotação era daquele gesto
   ou de outro. Ler o relógio para DECIDIR foi justamente o defeito. */

export function limparIntencao() {
  intencao = null;
}

/** A intenção anotada. Consumi-la a APAGA — ela serve a um drop só. */
export function consumirIntencao() {
  const atual = intencao;
  intencao = null;
  return atual;
}

/**
 * De qual lado da peça o ponteiro está — ou `null` se está no meio dela.
 *
 * @param {DOMRect} rect  a caixa da peça sob o ponteiro
 * @param {number}  x     a coordenada do ponteiro, no mesmo sistema do rect
 */
export function ladoDoPonteiro(rect, x) {
  if (!rect || !rect.width) return null;
  const relativo = (x - rect.left) / rect.width;
  if (relativo <= FAIXA) return "esquerda";
  if (relativo >= 1 - FAIXA) return "direita";
  return null;
}
