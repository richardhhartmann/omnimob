import { useEffect, useRef, useState } from "react";
import { IconeCheck, IconeLink } from "../../Icones.jsx";
import {
  IconeAjustar,
  IconeDesfazer,
  IconeDesktop,
  IconeDuplicar,
  IconeExterno,
  IconeMais,
  IconeMaisMenu,
  IconeMenos,
  IconeMobile,
  IconeRefazer,
  IconeRelogio,
  IconeReset,
} from "../iconesEditor";

/* ────────────────────────────────────────────────────────────────────────────
   Barra superior.

   Antes eram doze botões do mesmo peso visual em fila — Templates, Cores,
   Posições, Resetar Tudo, Histórico, Copiar Link, Ver Página, mais zoom, fonte,
   undo/redo e o alternador de modo. Nada dizia o que era frequente e o que era
   raro, e "Resetar Tudo" ficava a um clique de distância de "Posições".

   A hierarquia agora é explícita:

     esquerda — onde estou e se está salvo;
     centro   — o que estou editando (desktop ou mobile), que é a decisão que
                muda o significado de tudo o mais;
     direita  — desfazer/refazer e zoom, que são contínuos; o resto vai para o
                menu "•••", onde ações destrutivas podem morar sem sobressalto.
   ──────────────────────────────────────────────────────────────────────────── */

const ROTULO_STATUS = {
  carregando: "Carregando…",
  salvando: "Salvando…",
  salvo: "Salvo",
  erro: "Erro ao salvar",
  ocioso: "Tudo salvo",
};

function StatusDeSalvamento({ estado }) {
  return (
    <span className={`editor-save-status is-${estado}`}>
      <i className="editor-save-dot" aria-hidden />
      {ROTULO_STATUS[estado] || ROTULO_STATUS.ocioso}
    </span>
  );
}

function MenuSecundario({ itens }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;
    const aoClicarFora = (e) => {
      if (!ref.current?.contains(e.target)) setAberto(false);
    };
    const aoTeclar = (e) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("pointerdown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("pointerdown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  return (
    <div className="editor-menu" ref={ref} data-tour="vitrine-acoes">
      <button
        type="button"
        className="editor-icon-button"
        title="Mais ações"
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
      >
        <IconeMaisMenu size={16} />
      </button>
      {aberto ? (
        <div className="editor-menu-pop" role="menu">
          {itens.map((item) =>
            item.separador ? (
              <hr key={item.id} className="editor-menu-sep" />
            ) : (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={`editor-menu-item ${item.perigo ? "is-danger" : ""}`}
                onClick={() => { setAberto(false); item.acao(); }}
              >
                {item.Icone ? <item.Icone size={13} /> : <span className="editor-menu-spacer" />}
                {item.rotulo}
              </button>
            )
          )}
        </div>
      ) : null}
    </div>
  );
}

export function BuilderTopbar({
  estadoSalvamento,
  mode,
  onMode,
  mobilePersonalizado,
  onCopiarDesktop,
  onDesfazer,
  onRefazer,
  podeDesfazer,
  podeRefazer,
  zoom,
  onZoom,
  onAjustarZoom,
  onResetarPosicoes,
  onResetarTudo,
  onHistorico,
  onCopiarLink,
  linkCopiado,
  linkVitrine,
}) {
  const ehMobile = mode === "mobile";

  return (
    <header className="editor-topbar" data-tour="vitrine-topbar">
      <div className="editor-topbar-side">
        <strong className="editor-topbar-title">Editor de Vitrine</strong>
        <StatusDeSalvamento estado={estadoSalvamento} />
      </div>

      <div className="editor-topbar-center" data-tour="vitrine-modo">
        {/* `aria-pressed` e não só a classe: para um leitor de tela, dois
            botões sem estado são duas ações idênticas, e nada diz qual layout
            está sendo editado — que é a informação mais importante da barra. */}
        <div className="editor-segmented is-compact" role="group" aria-label="Layout em edição">
          <button type="button" className={!ehMobile ? "is-active" : ""} aria-pressed={!ehMobile} onClick={() => onMode("desktop")} title="Editar layout desktop">
            <IconeDesktop size={14} /> Desktop
          </button>
          <button type="button" className={ehMobile ? "is-active" : ""} aria-pressed={ehMobile} onClick={() => onMode("mobile")} title="Editar layout mobile">
            <IconeMobile size={14} /> Mobile
          </button>
        </div>
        {ehMobile ? (
          <button type="button" className="editor-chip-action" onClick={onCopiarDesktop} title="Substitui o layout mobile pelo desktop">
            <IconeDuplicar size={12} />
            Copiar do desktop
            {mobilePersonalizado ? <em>·  já personalizado</em> : null}
          </button>
        ) : null}
      </div>

      <div className="editor-topbar-side is-end">
        <div className="editor-group">
          <button type="button" className="editor-icon-button" disabled={!podeDesfazer} onClick={onDesfazer} title="Desfazer (Ctrl+Z)">
            <IconeDesfazer size={14} />
          </button>
          <button type="button" className="editor-icon-button" disabled={!podeRefazer} onClick={onRefazer} title="Refazer (Ctrl+Shift+Z)">
            <IconeRefazer size={14} />
          </button>
        </div>

        {!ehMobile ? (
          <div className="editor-group editor-zoom">
            <button type="button" className="editor-icon-button" onClick={() => onZoom((z) => z - 0.1)} title="Diminuir zoom">
              <IconeMenos size={13} />
            </button>
            <button type="button" className="editor-zoom-valor" onClick={() => onZoom(1)} title="Voltar a 100% (Ctrl+0)">
              {Math.round(zoom * 100)}%
            </button>
            <button type="button" className="editor-icon-button" onClick={() => onZoom((z) => z + 0.1)} title="Aumentar zoom">
              <IconeMais size={13} />
            </button>
            <button type="button" className="editor-icon-button" onClick={onAjustarZoom} title="Encaixar na largura">
              <IconeAjustar size={13} />
            </button>
          </div>
        ) : null}

        <MenuSecundario
          itens={[
            { id: "link", rotulo: linkCopiado ? "Link copiado!" : "Copiar link da vitrine", Icone: linkCopiado ? IconeCheck : IconeLink, acao: onCopiarLink },
            { id: "historico", rotulo: "Histórico de versões", Icone: IconeRelogio, acao: onHistorico },
            { id: "sep1", separador: true },
            { id: "posicoes", rotulo: "Resetar posições", Icone: IconeReset, acao: onResetarPosicoes },
            { id: "tudo", rotulo: "Resetar tudo", perigo: true, acao: onResetarTudo },
          ]}
        />

        <a className="editor-button is-primary" href={linkVitrine} target="_blank" rel="noreferrer">
          <IconeExterno size={13} /> Ver página
        </a>
      </div>
    </header>
  );
}
