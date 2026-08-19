import { mergeBlockWrapperStyle } from "../../utils/showcaseConfig";
import { CtaWidget } from "./widgets/CtaWidget.jsx";
import { DividerWidget } from "./widgets/DividerWidget.jsx";
import { FaqWidget } from "./widgets/FaqWidget.jsx";
import { FinanceWidget } from "./widgets/FinanceWidget.jsx";
import { MapWidget } from "./widgets/MapWidget.jsx";
import { PropertySearchWidget } from "./widgets/PropertySearchWidget.jsx";
import { RegionsWidget } from "./widgets/RegionsWidget.jsx";
import { SocialWidget } from "./widgets/SocialWidget.jsx";
import { StatsWidget } from "./widgets/StatsWidget.jsx";
import { StepsWidget } from "./widgets/StepsWidget.jsx";
import { TeamWidget } from "./widgets/TeamWidget.jsx";
import { TestimonialWidget } from "./widgets/TestimonialWidget.jsx";
import { TextWidget } from "./widgets/TextWidget.jsx";

/* Um despachante, uma implementação visual. O editor e a página pública passam
   pelo mesmo componente; comportamento interativo muda via `contexto.jsx`. */
const RENDERIZADORES = {
  testimonial: TestimonialWidget,
  stats: StatsWidget,
  cta: CtaWidget,
  social: SocialWidget,
  divider: DividerWidget,
  map: MapWidget,
  text: TextWidget,
  note: TextWidget,
  hours: TextWidget,
  faq: FaqWidget,
  "property-search": PropertySearchWidget,
  regions: RegionsWidget,
  steps: StepsWidget,
  team: TeamWidget,
  finance: FinanceWidget,
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
