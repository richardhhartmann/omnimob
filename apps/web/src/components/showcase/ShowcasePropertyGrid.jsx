import { memo } from "react";
import { mergeBlockWrapperStyle } from "../../utils/showcaseConfig";
import { ShowcasePropertyCard } from "./ShowcasePropertyCard.jsx";

/* A grade de imóveis.

   Em `memo` por um motivo medido: é a subárvore mais cara das duas telas — cada
   cartão traz imagem, carrossel e comodidades, e uma imobiliária com trinta
   anúncios renderiza trinta deles. No editor, sem isso, arrastar um bloco
   reconstruía a grade inteira a cada movimento do ponteiro.

   O `id="destaques"` é o alvo da âncora do menu e o seletor que a medição de
   altura usa nas duas telas. */

function Grade({ properties, tenantSlug, carouselIndexes, onProxima, onAnterior, estilo, carregando, erro }) {
  return (
    <div id="destaques" className="property-grid" style={estilo}>
      {erro ? <div className="error" style={{ gridColumn: "1 / -1" }}>{erro}</div> : null}

      {carregando ? (
        <p style={{ color: "var(--text-muted)", gridColumn: "1 / -1", textAlign: "center" }}>Carregando vitrine...</p>
      ) : null}

      {!carregando && properties.length === 0 ? (
        <p style={{ color: "var(--text-muted)", gridColumn: "1 / -1", textAlign: "center", padding: "40px 0" }}>
          Nenhum imóvel disponível no momento.
        </p>
      ) : null}

      {properties.map((p) => (
        <ShowcasePropertyCard
          key={p.id}
          property={p}
          tenantSlug={tenantSlug}
          carouselIndex={carouselIndexes[p.id] || 0}
          onProxima={onProxima}
          onAnterior={onAnterior}
        />
      ))}
    </div>
  );
}

export const ShowcasePropertyGrid = memo(Grade);

/** Ajuda quem monta o bloco: o estilo do bloco vira o estilo da grade. */
export function estiloDaGrade(blockStyles) {
  return mergeBlockWrapperStyle(blockStyles?.properties);
}
