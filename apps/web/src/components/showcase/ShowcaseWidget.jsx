import { mergeBlockWrapperStyle } from "../../utils/showcaseConfig";
import { useFaixaDoWidget } from "./useFaixaDoWidget";
import { CtaWidget } from "./widgets/CtaWidget.jsx";
import { FaqWidget } from "./widgets/FaqWidget.jsx";
import { FinanceWidget } from "./widgets/FinanceWidget.jsx";
import { HoursWidget } from "./widgets/HoursWidget.jsx";
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
  map: MapWidget,
  text: TextWidget,
  note: TextWidget,
  /* `hours` caía no renderizador de texto e o conteúdo era uma string com
     `<br>` no meio. Agora tem componente próprio, porque passou a ter dado
     próprio: as faixas de atendimento vivem no cadastro da imobiliária. */
  hours: HoursWidget,
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
  /* A medição mora AQUI, no despachante, e não em cada renderizador: é um
     observador por peça em vez de treze implementações da mesma pergunta, e
     garante que todo widget — inclusive os que ainda não adaptam nada — já
     nasça com a faixa no atributo, à disposição do CSS. */
  const [ref, faixa] = useFaixaDoWidget();

  return (
    <article
      ref={ref}
      className="widget-card"
      /* `data-faixa` para o CSS (grades, gaps, tamanhos) e a prop `faixa` para
         quem precisa mudar o CONTEÚDO — quantos corretores mostrar, quantas
         perguntas abrir. A maior parte da adaptação é CSS; a prop é para o que
         o CSS não alcança. */
      data-faixa={faixa}
      style={{ ...mergeBlockWrapperStyle(widget), height: "100%", boxSizing: "border-box" }}
    >
      <Renderizador widget={widget} faixa={faixa} />
    </article>
  );
}
