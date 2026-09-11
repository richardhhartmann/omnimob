import { createContext, useContext, useMemo } from "react";
import { blockHasBackgroundImage, sectionSurfaceStyle } from "../utils/showcaseConfig";

/* ────────────────────────────────────────────────────────────────────────────
   O BANNER PRECISA DE UM INVÓLUCRO.

   Descobri isto tarde, e vale escrever: `mergeBlockWrapperStyle` — que é o que
   os blocos e os widgets já aplicavam em si mesmos — NÃO desenha a imagem de
   fundo. Ela só decide se a cor de fundo entra (não entra, quando há imagem).
   Quem desenha a imagem é `sectionSurfaceStyle`, e ela precisa de um elemento
   com a classe `showcase-section-has-bg`, porque a imagem e o escurecimento são
   dois pseudo-elementos.

   Na engine de coordenadas esse elemento existia de graça: o `ShowcaseRenderer`
   punha cada peça dentro de uma `<section>` posicionada, e era nela que o
   banner ia. A árvore do Puck não tem esse invólucro — as peças desenham
   direto. O resultado, até aqui, era um campo de banner que aceitava a URL,
   gravava, e não pintava nada: a peça só PERDIA a cor de fundo, porque a
   presença da imagem a suprime.

   Campo que aceita valor e não faz efeito é a pior forma de não ter o recurso.
   Este componente devolve o invólucro que faltava.

   ── SÓ ENVOLVE QUANDO HÁ IMAGEM ──

   Sem banner, um `<div>` a mais em toda peça mudaria a marcação da vitrine
   inteira sem motivo — e a paridade entre editor e página publicada é medida
   por HTML idêntico. Sem imagem, não há invólucro.
   ──────────────────────────────────────────────────────────────────────────── */

/* ── QUEM ESTÁ DEBAIXO DE UM BANNER ─────────────────────────────────────────

   A seção em colunas também tem banner, e a regra que a pessoa espera é a de
   qualquer editor: o fundo da seção é o fundo da seção. Uma peça lá dentro que
   guardasse a própria cor de fundo cobriria a imagem em retalhos, e o resultado
   seria uma foto aparecendo só nas frestas entre os widgets.

   Este contexto é como a peça de dentro descobre que precisa abrir mão do
   próprio fundo. Vive aqui, e não em `configVitrine`, porque quem SABE que há
   um banner é este componente — é ele que decide envolver.

   Só o fundo. A cor do TEXTO continua sendo de cada peça: sobre uma foto
   escura, quem escolheu texto claro num widget quer o texto claro. */
const ContextoDeBanner = createContext(false);

/** `true` quando alguma peça acima já está pintando um banner. */
export function useSobBanner() {
  return useContext(ContextoDeBanner);
}

export function ComBanner({ estilo, children }) {
  const temImagem = blockHasBackgroundImage(estilo);
  const superficie = useMemo(() => (temImagem ? sectionSurfaceStyle(estilo) : null), [temImagem, estilo]);

  if (!temImagem) return children;

  return (
    <ContextoDeBanner.Provider value>
      <div className="showcase-section-has-bg puck-banner" style={superficie}>
        {children}
      </div>
    </ContextoDeBanner.Provider>
  );
}
