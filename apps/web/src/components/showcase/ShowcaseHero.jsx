import { mergeBlockWrapperStyle } from "../../utils/showcaseConfig";
import { ShowcaseTexto } from "./contexto.jsx";
import { TEXTO_PADRAO } from "./tema.js";

/* O bloco de título da vitrine.

   O editor desenhava isto com `padding: 0` forçado e uma classe extra
   (`editor-headline`) que zerava o `background` do `h2` — herança de quando o
   título tinha texto em gradiente. Hoje `.showcase-title-section h2` já declara
   `background: none`, então a classe só servia para fazer a mesma coisa duas
   vezes, e o `padding: 0` era uma diferença real de espaçamento entre o que se
   editava e o que se publicava. */

export function ShowcaseHero({ tenant, blockStyles }) {
  const cor = blockStyles?.title?.color;

  return (
    <section
      className={`showcase-title-section${cor ? " showcase-title-section--custom-text" : ""}`}
      style={mergeBlockWrapperStyle(blockStyles?.title)}
    >
      <ShowcaseTexto
        as="h2"
        campo="form|showcaseHeadline"
        umaLinha
        html={tenant?.showcaseHeadline || TEXTO_PADRAO.headline}
        style={
          cor
            ? {
                color: cor,
                background: "none",
                backgroundImage: "none",
                WebkitBackgroundClip: "unset",
                backgroundClip: "unset",
              }
            : undefined
        }
      />
      <ShowcaseTexto
        as="p"
        campo="form|showcaseSubheadline"
        html={tenant?.showcaseSubheadline || TEXTO_PADRAO.subheadline}
        style={cor ? { color: cor } : undefined}
      />
    </section>
  );
}
