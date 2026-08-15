import { mergeBlockWrapperStyle } from "../../utils/showcaseConfig";
import { CtaWidget } from "./widgets/CtaWidget.jsx";
import { DividerWidget } from "./widgets/DividerWidget.jsx";
import { MapWidget } from "./widgets/MapWidget.jsx";
import { SocialWidget } from "./widgets/SocialWidget.jsx";
import { StatsWidget } from "./widgets/StatsWidget.jsx";
import { TestimonialWidget } from "./widgets/TestimonialWidget.jsx";
import { TextWidget } from "./widgets/TextWidget.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   O despachante de widgets — o único do projeto.

   Existiam dois blocos condicionais gigantes desenhando os mesmos tipos: um em
   `ShowcasePage.jsx` e outro em `WidgetEditavel.jsx`. Os dois tinham derivado, e
   três tipos (stats, social, cta) mostravam coisas visivelmente diferentes.

   O mapa abaixo é explícito: todo tipo da biblioteca aponta para um componente,
   e um tipo desconhecido cai no `TextWidget` porque é o desenho mais neutro
   possível — não porque ninguém pensou nele.

   O invólucro `.widget-card` (o vidro, a borda, o padding de 24px) mora AQUI, e
   não no invólucro de posição. Era a diferença mais silenciosa das duas telas:
   a vitrine envolvia o widget nesse cartão e o editor não, então a mesma peça
   tinha uma caixa a menos — e altura diferente — enquanto estava sendo montada.
   ──────────────────────────────────────────────────────────────────────────── */

const RENDERIZADORES = {
  testimonial: TestimonialWidget,
  stats: StatsWidget,
  cta: CtaWidget,
  social: SocialWidget,
  divider: DividerWidget,
  map: MapWidget,
  text: TextWidget,
  note: TextWidget,
  faq: TextWidget,
  hours: TextWidget,
};

/** Todos os tipos com renderizador próprio — usado pelo teste de paridade. */
export const TIPOS_DE_WIDGET = Object.keys(RENDERIZADORES);

export function ShowcaseWidget({ widget }) {
  const Renderizador = RENDERIZADORES[widget.type] || TextWidget;
  return (
    <article className="widget-card" style={{ ...mergeBlockWrapperStyle(widget), height: "100%", boxSizing: "border-box" }}>
      <Renderizador widget={widget} />
    </article>
  );
}
