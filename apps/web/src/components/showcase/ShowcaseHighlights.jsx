import { mergeBlockWrapperStyle } from "../../utils/showcaseConfig";
import { ShowcaseTexto } from "./contexto.jsx";

/* Os três (ou mais) cartões de diferencial.

   A barra de cores por cartão que flutuava aqui dentro no editor saiu para o
   inspetor. Ela era uma peça de interface do construtor desenhada POR CIMA do
   conteúdo, então mudava a altura do cartão em relação ao publicado — e
   ocupava, dentro da caixa, um espaço que o visitante nunca veria. */

export function ShowcaseHighlights({ config, blockStyles }) {
  return (
    <section className="showcase-highlights" style={mergeBlockWrapperStyle(blockStyles?.highlights)}>
      {config.highlights.map((item, index) => {
        const hs = config.highlightStyles[index] || { backgroundColor: "", color: "" };
        const cor = hs.color ? { color: hs.color } : undefined;
        return (
          <div className="highlight-box" key={`highlight-${index}`} style={mergeBlockWrapperStyle(hs)}>
            <ShowcaseTexto as="h3" campo={`highlight|${index}|title`} umaLinha html={item.title} style={cor} />
            <ShowcaseTexto as="p" campo={`highlight|${index}|description`} html={item.description} style={cor} />
          </div>
        );
      })}
    </section>
  );
}
