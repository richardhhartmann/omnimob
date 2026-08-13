import { PointerSensor, KeyboardSensor, PointerActivationConstraints } from "@dnd-kit/dom";

/* ────────────────────────────────────────────────────────────────────────────
   Arrasto do editor de vitrine sobre o dnd-kit.

   ── O QUE O DND-KIT FAZ AQUI, E O QUE CONTINUA NOSSO ──

   O editor não é lista ordenável nem "soltar num alvo": é canvas de posição
   livre, com x em %, y em px, colisão retângulo-a-retângulo, empurrão em
   cascata, encaixe em guias e redimensionamento. O dnd-kit não tem nada disso —
   e não precisa ter. Ele entra como CAMADA DE ENTRADA, e é ótimo nisso:

     · sensores de ponteiro, toque e TECLADO — hoje não há como mover um bloco
       sem mouse, e essa é a maior falha de acessibilidade do editor;
     · limiar de ativação, para clicar num bloco não virar um arrasto de 1px;
     · cancelamento por Esc e ciclo de vida (start / move / end) num lugar só.

   Toda a geometria — colisão, cascata, guias, resize, zoom, layout mobile —
   continua sendo nossa, porque é regra de produto e não de biblioteca.

   ── POR QUE `feedback: "none"` ──

   Por padrão o dnd-kit MOVE o elemento arrastado por conta própria (translate
   no DOM). Aqui isso seria movimento em dobro: quem posiciona o bloco é o
   nosso estado, a partir de `operation.transform`. Com "none" ele só mede e
   avisa; desenhar continua conosco.

   ── DE ONDE SAI O DELTA ──

   `event.operation.transform` é o deslocamento acumulado em PIXELS desde o
   início do gesto, já passado pelos modificadores. É exatamente o que o código
   anterior calculava à mão com `clientX - startX`. A conversão para % e a
   divisão pelo zoom continuam iguais — ver `aplicarDeltaNoBloco`.
   ──────────────────────────────────────────────────────────────────────────── */

/* Distância antes de o gesto virar arrasto.

   O padrão do dnd-kit é não exigir nada quando se arrasta pela alça com mouse
   (ele devolve `undefined` nesse caso). Aqui exigimos 4px mesmo na alça: o
   editor tem alça pequena e clicar nela também SELECIONA o bloco, então sem
   limiar todo clique de seleção empurrava a peça alguns pixels — era metade da
   sensação de "escorregadio" que o editor tinha.

   No toque fica o atraso de 250ms do próprio dnd-kit, que é o que permite
   rolar a página com o dedo por cima de um bloco sem arrastá-lo. */
export const SENSORES_EDITOR = [
  PointerSensor.configure({
    activationConstraints(event) {
      if (event.pointerType === "touch") {
        return [new PointerActivationConstraints.Delay({ value: 250, tolerance: 5 })];
      }
      return [new PointerActivationConstraints.Distance({ value: 4 })];
    },
  }),
  KeyboardSensor,
];

/* Identificadores. O `id` do draggable precisa distinguir bloco de widget, e o
   bloco fixo compartilha nome com a chave do layout — daí o prefixo. */
export const idDoBloco = (chave) => `bloco:${chave}`;
export const idDoWidget = (widgetId) => `widget:${widgetId}`;

/** Lê o id de volta. Devolve `{ tipo, chave }` ou null se não for nosso. */
export function lerId(id) {
  if (typeof id !== "string") return null;
  const [tipo, ...resto] = id.split(":");
  if (tipo !== "bloco" && tipo !== "widget") return null;
  return { tipo, chave: resto.join(":") };
}

/**
 * Converte o deslocamento em pixels que o dnd-kit reporta para as unidades do
 * layout: x em porcentagem da largura do canvas, y em pixels já descontado o
 * zoom.
 *
 * Mesma conta do arrasto manual anterior — ela não mudou de lugar por acaso:
 * é a fronteira entre "quanto o ponteiro andou" (do dnd-kit) e "o que isso
 * significa no layout" (nosso).
 */
export function deltaParaLayout(transform, larguraCanvas, zoom) {
  const largura = Math.max(larguraCanvas || 1, 1);
  return {
    dxPercent: ((transform?.x || 0) / largura) * 100,
    dyPx: (transform?.y || 0) / (zoom || 1),
  };
}
