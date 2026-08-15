import { PointerSensor, KeyboardSensor, PointerActivationConstraints } from "@dnd-kit/dom";

/* ────────────────────────────────────────────────────────────────────────────
   O dnd-kit no editor de vitrine — só a camada de entrada.

   ── POR QUE ELE FICOU (e por que não trocamos por react-grid-layout) ──

   O editor não é lista ordenável nem "soltar num alvo": é canvas de posição
   livre, com x em %, y em px, colisão retângulo-a-retângulo, empurrão em
   cascata com âncora, encaixe, altura medida do conteúdo, peça travada e dois
   layouts independentes. Nenhuma biblioteca de grade traz isso — o `react-grid-
   layout` compacta em linhas inteiras e não tem noção de âncora, então adotá-lo
   significaria escrever um adaptador E reescrever a física por cima dele.

   O que o dnd-kit dá, e que não vale reescrever:

     · sensores de ponteiro, toque e TECLADO — mover um bloco sem mouse era a
       maior falha de acessibilidade do editor;
     · limiar de ativação, para clicar num bloco não virar arrasto de 1px;
     · cancelamento por Esc e um ciclo de vida (start/move/end) num lugar só.

   Toda a geometria continua em `engine/`, porque é regra de produto.

   ── POR QUE `feedback: "none"` (em AlcaDeArrasto) ──

   Por padrão o dnd-kit move o elemento arrastado por conta própria. Aqui isso
   seria movimento em dobro: quem posiciona a peça é o nosso estado, a partir de
   `operation.transform`. Com "none" ele só mede e avisa; desenhar é conosco.
   ──────────────────────────────────────────────────────────────────────────── */

/* Distância antes de o gesto virar arrasto.

   O padrão do dnd-kit é não exigir nada quando se arrasta pela alça com mouse.
   Aqui exigimos 4px mesmo na alça: a etiqueta é pequena e clicar nela também
   SELECIONA a peça, então sem limiar todo clique de seleção empurrava a peça
   alguns pixels — era metade da sensação de "escorregadio" que o editor tinha.

   No toque fica o atraso de 250ms do próprio dnd-kit, que é o que permite rolar
   a página com o dedo por cima de uma peça sem arrastá-la. */
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
