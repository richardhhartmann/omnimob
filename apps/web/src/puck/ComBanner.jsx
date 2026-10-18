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

/* ── O ENQUADRAMENTO DA IMAGEM ───────────────────────────────────────────────

   Zoom, giro e posição da foto DENTRO do banner — o que se faz arrastando a
   imagem no editor de enquadramento do inspetor (`CampoImagemDoBanner`).

   Tudo vira variável CSS no próprio invólucro, lida pelo `::before` que já
   desenha a imagem (`.puck-banner::before`, styles.css): posição pelo
   `background-position`, zoom e giro por `transform`. Nenhum elemento novo
   — a marcação da peça continua a mesma com e sem enquadramento, e o corte do
   que sobra é o `overflow: hidden` que o banner já tinha.

   Ausente ou ilegível, cada eixo cai no neutro: centralizada, 100%, sem giro
   — exatamente o banner de antes. */
export const ENQUADRAMENTO_NEUTRO = { zoom: 100, giro: 0, x: 50, y: 50 };

const entre = (v, min, max, padrao) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao;
};

/** O enquadramento dentro dos limites que o editor oferece. */
export function normalizarEnquadramento(e) {
  const fonte = e && typeof e === "object" ? e : {};
  return {
    zoom: entre(fonte.zoom, 100, 300, ENQUADRAMENTO_NEUTRO.zoom),
    giro: entre(fonte.giro, -180, 180, ENQUADRAMENTO_NEUTRO.giro),
    x: entre(fonte.x, 0, 100, ENQUADRAMENTO_NEUTRO.x),
    y: entre(fonte.y, 0, 100, ENQUADRAMENTO_NEUTRO.y),
  };
}

/** As variáveis CSS do enquadramento — vazias quando ele é o neutro. */
export function variaveisDoEnquadramento(e) {
  const n = normalizarEnquadramento(e);
  const neutro = n.zoom === 100 && n.giro === 0 && n.x === 50 && n.y === 50;
  if (neutro) return {};
  return {
    "--banner-x": `${n.x}%`,
    "--banner-y": `${n.y}%`,
    "--banner-escala": String(n.zoom / 100),
    "--banner-giro": `${n.giro}deg`,
  };
}

export function ComBanner({ estilo, children }) {
  const temImagem = blockHasBackgroundImage(estilo);
  const enquadramento = estilo?.enquadramento;
  const superficie = useMemo(
    () => (temImagem ? { ...sectionSurfaceStyle(estilo), ...variaveisDoEnquadramento(enquadramento) } : null),
    [temImagem, estilo, enquadramento],
  );

  if (!temImagem) return children;

  return (
    <ContextoDeBanner.Provider value>
      <div className="showcase-section-has-bg puck-banner" style={superficie}>
        {children}
      </div>
    </ContextoDeBanner.Provider>
  );
}
