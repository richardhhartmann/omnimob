import { Render } from "@puckeditor/core";
import { configVitrine } from "../../puck/configVitrine.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   A vitrine desenhada pelo Puck.

   Um arquivo de dez linhas úteis, e é essa a notícia: trocar a engine de
   coordenadas pelo `<Render>` não exigiu reescrever peça nenhuma. Cabeçalho,
   destaques, grade de imóveis, widgets e rodapé são os mesmos componentes que
   a vitrine sempre usou — o que mudou foi só quem decide onde eles ficam.

   ── POR QUE ELE MORA EM `showcase/`, E NÃO EM `puck/` ──

   Mesmo motivo pelo qual a engine mora aqui: a página PÚBLICA depende dele.
   Vitrine importando de uma pasta de editor é a porta pela qual o construtor
   volta a vazar para dentro dela, e este projeto já pagou esse preço duas vezes.

   ── O QUE ELE NÃO TEM ──

   Medição de altura, reflow, `ResizeObserver`, layout por breakpoint. Nada
   disso é necessário quando as peças estão numa árvore e não em coordenadas —
   é a troca que a fase 2 fez, e este arquivo é a prova de que ela compensou.
   ──────────────────────────────────────────────────────────────────────────── */

export function VitrinePorPuck({ documento, metadata }) {
  return <Render config={configVitrine} data={documento} metadata={metadata} />;
}
