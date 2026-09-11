import { comCelulaTrocada } from "../components/showcase/widgets/StatsWidget.jsx";
import { comDadoTrocado } from "../components/showcase/widgets/widgetData.js";

/* ────────────────────────────────────────────────────────────────────────────
   O QUE UMA EDIÇÃO NA PRANCHETA FAZ COM UM WIDGET.

   Todo texto editável da vitrine declara o próprio endereço, e o formato é
   sempre o mesmo:

     widget|<id>|title                    o título da peça
     widget|<id>|content                  o corpo, quando é texto corrido
     widget|<id>|stat|<par>|<celula>      uma célula do bloco de números
     widget|<id>|dados|<caminho...>       um campo do conteúdo estruturado

   O editor não sabe o que cada widget guarda, e não precisa: quem declara o
   caminho é o próprio componente, no `data-rich-sync`. Aqui só se atravessa.

   ── POR QUE ISTO SAIU DE DENTRO DO EDITOR ──

   Porque agora há DOIS editores. Enquanto a regra morava no roteador de campos
   da `ShowcaseEditorPage`, o editor do Puck só tinha dois caminhos: chamar uma
   página inteira para pedir uma linha, ou reescrever a interpretação do
   endereço por conta própria. A segunda é a que sempre parece mais barata, e é
   ela que faz o widget de números aceitar edição num editor e recusar no outro.

   A função é PURA e devolve um widget novo. Quem grava é quem chamou: o editor
   antigo escreve no `showcaseConfig`, o novo despacha para o documento do Puck.
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * @param {object}   widget  a peça como está gravada
 * @param {string[]} partes  o endereço já quebrado, SEM o `widget|<id>` da frente
 * @param {*}        valor   o que a edição produziu (HTML, quase sempre)
 * @returns {object} o widget com a alteração aplicada
 */
export function aplicarEdicaoNoWidget(widget, partes, valor) {
  if (!widget || !partes?.length) return widget;

  if (partes[0] === "stat") {
    const par = parseInt(partes[1], 10);
    const celula = parseInt(partes[2], 10);
    return { ...widget, content: comCelulaTrocada(widget.content, par, celula, valor) };
  }

  if (partes[0] === "dados") {
    return { ...widget, content: comDadoTrocado(widget.content, partes.slice(1), valor) };
  }

  return { ...widget, [partes[0]]: valor };
}
