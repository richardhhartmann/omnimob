import { useEffect, useState } from "react";
import { toPieces } from "../../showcase/engine/pieces.js";

function IconeAlinhar({ tipo }) {
  const linhas = {
    left: ["M5 4v16", "M5 7h10", "M5 12h14", "M5 17h8"],
    "center-x": ["M12 4v16", "M7 7h10", "M5 12h14", "M8 17h8"],
    right: ["M19 4v16", "M9 7h10", "M5 12h14", "M11 17h8"],
    top: ["M4 5h16", "M7 5v10", "M12 5v14", "M17 5v8"],
    "center-y": ["M4 12h16", "M7 7v10", "M12 5v14", "M17 8v8"],
    bottom: ["M4 19h16", "M7 9v10", "M12 5v14", "M17 11v8"],
    horizontal: ["M5 5v14", "M19 5v14", "M9 8v8", "M15 8v8", "M7 12h2", "M15 12h2"],
    vertical: ["M5 5h14", "M5 19h14", "M8 9h8", "M8 15h8", "M12 7v2", "M12 15v2"],
  };
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      {(linhas[tipo] || []).map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

export function BuilderMultiToolbar({
  config,
  mode,
  selecionados,
  zoom = 1,
  onAlinhar,
  onDistribuir,
}) {
  const ids = Array.from(selecionados || []);
  const [acaoAtiva, setAcaoAtiva] = useState(null);

  const assinaturaSelecao = ids
    .slice()
    .sort()
    .join("|");

  useEffect(() => {
    setAcaoAtiva(null);
  }, [assinaturaSelecao, mode]);

  function alinhar(tipo) {
    setAcaoAtiva(tipo);
    onAlinhar?.(tipo);
  }

  function distribuir(eixo) {
    setAcaoAtiva(`distribuir-${eixo}`);
    onDistribuir?.(eixo);
  }
  if (ids.length < 2) return null;

  const conjunto = new Set(ids);
  const pecas = toPieces(config, mode).filter((p) => conjunto.has(p.id));
  if (pecas.length < 2) return null;

  const left = Math.min(...pecas.map((p) => p.x));
  const right = Math.max(...pecas.map((p) => p.x + p.w));
  const top = Math.min(...pecas.map((p) => p.y));
  const escala = Math.max(0.4, Number(zoom) || 1);
  const dentro = top < 58 / escala;
  const tresOuMais = pecas.length >= 3;

  return (
    <div
      className={`builder-multi-toolbar ${dentro ? "is-inside" : ""}`}
      style={{
        left: `${(left + right) / 2}%`,
        top: `${dentro ? top + 9 : top}px`,
        "--multi-toolbar-scale": 1 / escala,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span className="builder-multi-toolbar__count">{pecas.length}</span>
      <span
        className="builder-multi-toolbar__group"
        aria-label="Alinhamento horizontal"
      >
        <button
          type="button"
          className={acaoAtiva === "left" ? "is-active" : ""}
          aria-pressed={acaoAtiva === "left"}
          title="Alinhar à esquerda"
          onClick={() => alinhar("left")}
        >
          <IconeAlinhar tipo="left" />
        </button>

        <button
          type="button"
          className={acaoAtiva === "center-x" ? "is-active" : ""}
          aria-pressed={acaoAtiva === "center-x"}
          title="Centralizar horizontalmente"
          onClick={() => alinhar("center-x")}
        >
          <IconeAlinhar tipo="center-x" />
        </button>

        <button
          type="button"
          className={acaoAtiva === "right" ? "is-active" : ""}
          aria-pressed={acaoAtiva === "right"}
          title="Alinhar à direita"
          onClick={() => alinhar("right")}
        >
          <IconeAlinhar tipo="right" />
        </button>
      </span>

      <span className="builder-multi-toolbar__divider" aria-hidden />

      <span
        className="builder-multi-toolbar__group"
        aria-label="Alinhamento vertical"
      >
        <button
          type="button"
          className={acaoAtiva === "top" ? "is-active" : ""}
          aria-pressed={acaoAtiva === "top"}
          title="Alinhar ao topo"
          onClick={() => alinhar("top")}
        >
          <IconeAlinhar tipo="top" />
        </button>

        <button
          type="button"
          className={acaoAtiva === "center-y" ? "is-active" : ""}
          aria-pressed={acaoAtiva === "center-y"}
          title="Centralizar verticalmente"
          onClick={() => alinhar("center-y")}
        >
          <IconeAlinhar tipo="center-y" />
        </button>

        <button
          type="button"
          className={acaoAtiva === "bottom" ? "is-active" : ""}
          aria-pressed={acaoAtiva === "bottom"}
          title="Alinhar à base"
          onClick={() => alinhar("bottom")}
        >
          <IconeAlinhar tipo="bottom" />
        </button>
      </span>

      <span className="builder-multi-toolbar__divider" aria-hidden />

      <span
        className="builder-multi-toolbar__group"
        aria-label="Distribuição"
      >
        <button
          type="button"
          className={acaoAtiva === "distribuir-horizontal" ? "is-active" : ""}
          aria-pressed={acaoAtiva === "distribuir-horizontal"}
          disabled={!tresOuMais}
          title={tresOuMais ? "Distribuir horizontalmente" : "Selecione 3 ou mais peças"}
          onClick={() => distribuir("horizontal")}
        >
          <IconeAlinhar tipo="horizontal" />
        </button>

        <button
          type="button"
          className={acaoAtiva === "distribuir-vertical" ? "is-active" : ""}
          aria-pressed={acaoAtiva === "distribuir-vertical"}
          disabled={!tresOuMais}
          title={tresOuMais ? "Distribuir verticalmente" : "Selecione 3 ou mais peças"}
          onClick={() => distribuir("vertical")}
        >
          <IconeAlinhar tipo="vertical" />
        </button>
      </span>
    </div>
  );
}
