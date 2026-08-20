import { memo } from "react";
import { mergeBlockWrapperStyle } from "../../utils/showcaseConfig";
import { ShowcasePropertyCard } from "./ShowcasePropertyCard.jsx";
import { imovelPassaNoFiltro, useFiltroDaVitrine } from "./contexto.jsx";

/* A grade de imóveis.

   Em `memo` por um motivo medido: é a subárvore mais cara das duas telas — cada
   cartão traz imagem, carrossel e comodidades, e uma imobiliária com trinta
   anúncios renderiza trinta deles. No editor, sem isso, arrastar um bloco
   reconstruía a grade inteira a cada movimento do ponteiro.

   O `id="destaques"` é o alvo da âncora do menu e o seletor que a medição de
   altura usa nas duas telas. */

function Grade({ properties, tenantSlug, carouselIndexes, onProxima, onAnterior, estilo, carregando, erro }) {
  /* O filtro que os widgets de Busca e de Regiões escrevem. No editor ele é
     sempre nulo — a prancheta mostra o acervo inteiro, sempre. */
  const { filtro, aplicarFiltro } = useFiltroDaVitrine();
  const visiveis = filtro ? properties.filter((p) => imovelPassaNoFiltro(p, filtro)) : properties;

  /* O rótulo do filtro em vigor, para a pessoa saber por que a grade encolheu.
     Sem ele, clicar num bairro e ver três imóveis onde havia trinta lê como
     "o site quebrou" — o filtro é invisível e o resultado, não. */
  const rotuloFiltro = filtro
    ? [filtro.contrato, filtro.tipo, filtro.regiao].filter(Boolean).join(" · ")
    : "";

  return (
    <div id="destaques" className="property-grid" style={estilo}>
      {erro ? <div className="error" style={{ gridColumn: "1 / -1" }}>{erro}</div> : null}

      {carregando ? (
        <p style={{ color: "var(--text-muted)", gridColumn: "1 / -1", textAlign: "center" }}>Carregando vitrine...</p>
      ) : null}

      {filtro ? (
        <div className="property-grid__filtro" style={{ gridColumn: "1 / -1" }}>
          <span>
            Mostrando <strong>{visiveis.length}</strong>
            {visiveis.length === 1 ? " imóvel em " : " imóveis em "}
            <strong>{rotuloFiltro}</strong>
          </span>
          <button type="button" onClick={() => aplicarFiltro(null)}>
            Ver todos
            <span aria-hidden>×</span>
          </button>
        </div>
      ) : null}

      {!carregando && visiveis.length === 0 ? (
        <p style={{ color: "var(--text-muted)", gridColumn: "1 / -1", textAlign: "center", padding: "40px 0" }}>
          {filtro
            ? "Nenhum imóvel encontrado com esses critérios."
            : "Nenhum imóvel disponível no momento."}
        </p>
      ) : null}

      {visiveis.map((p) => (
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
