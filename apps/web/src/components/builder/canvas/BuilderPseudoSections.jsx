import { pseudoSecoesDeWidgets } from "../../showcase/engine/layoutEngine.js";

function GripLinha() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="5" cy="4" r="1.2" /><circle cx="11" cy="4" r="1.2" />
      <circle cx="5" cy="8" r="1.2" /><circle cx="11" cy="8" r="1.2" />
      <circle cx="5" cy="12" r="1.2" /><circle cx="11" cy="12" r="1.2" />
    </svg>
  );
}

function CadeadoLinha() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="3" y="7" width="10" height="7" rx="2" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}

export function BuilderPseudoSections({
  config,
  mode,
  selecionados,
  gesto,
  zoom = 1,
  onIniciarArrasto,
}) {
  const secoes = pseudoSecoesDeWidgets(config, mode);
  const selecionadosSet = selecionados || new Set();
  const escala = Math.max(0.4, Number(zoom) || 1);
  const ocupadaPorOutroGesto = Boolean(gesto) && gesto?.tipo !== "section";

  return (
    <div className={`builder-pseudo-sections ${ocupadaPorOutroGesto ? "is-busy" : ""}`} aria-hidden="false">
      {secoes.map((secao) => {
        const ativa = secao.pieceIds.some((id) => selecionadosSet.has(id));
        const emArrasto = gesto?.tipo === "section" &&
          secao.pieceIds.length === (gesto.pieceIds || []).length &&
          secao.pieceIds.every((id) => (gesto.pieceIds || []).includes(id));
        const fracao = secao.colunas <= 1 ? "1/1" : `1/${secao.colunas}`;

        return (
          <div
            key={secao.id}
            className={`builder-pseudo-section ${ativa ? "is-active" : ""} ${emArrasto ? "is-dragging" : ""} ${secao.travada ? "is-locked" : ""}`}
            style={{ top: `${secao.y}px`, height: `${secao.h}px` }}
          >
            <button
              type="button"
              className="builder-pseudo-section__handle"
              style={{ "--pseudo-handle-scale": 1 / escala }}
              disabled={secao.travada}
              title={secao.travada ? "Esta seção contém uma peça travada" : `Mover seção inteira (${fracao})`}
              onPointerDown={(e) => onIniciarArrasto?.(secao.pieceIds, e)}
            >
              {secao.travada ? <CadeadoLinha /> : <GripLinha />}
              <span>Seção</span>
              <em>{fracao}</em>
            </button>
          </div>
        );
      })}
    </div>
  );
}
