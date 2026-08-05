import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* ────────────────────────────────────────────────────────────────────────────
   Combo com design próprio — substitui o <select> nativo em todo o painel.

   Motivo: o navegador desenha a lista de opções do <select> por conta própria
   (sempre clara, fora do tema escuro do Domus) e não aceita estilização das
   <option>. Aqui a lista é um listbox nosso, com o mesmo vocabulário visual
   dos inputs do painel.

   Cada opção aceita `description` (linha secundária) e `color` (bolinha à
   esquerda + destaque quando selecionada) — usados, por exemplo, no tipo de
   contrato do imóvel.

   Acessibilidade: gatilho é um <button> com aria-haspopup/aria-expanded; a
   lista é um role="listbox" navegável por ↑/↓, Home/End, Enter/Espaço e Esc,
   fechando ao clicar fora ou ao sair com Tab.

   A lista vai para um PORTAL no <body>, com position:fixed. Isso é necessário,
   não estético: `.glass-panel` usa `backdrop-filter`, que cria um stacking
   context — dentro dele nenhum z-index consegue passar por cima dos cards
   vizinhos, e `overflow` de containers cortaria a lista. No portal ela escapa
   de ambos. A posição é recalculada em scroll/resize.
   ──────────────────────────────────────────────────────────────────────────── */

const MUTED = "var(--text-muted, #94a3b8)";

function IconChevron({ aberto, size = 14 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, transition: "transform 0.2s ease", transform: aberto ? "rotate(180deg)" : "none" }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IconCheck({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

const TAMANHOS = {
  md: { padding: "11px 14px", fonte: "14px", radius: "10px", gap: "10px", optPadding: "10px 12px", optFonte: "13.5px" },
  sm: { padding: "7px 10px", fonte: "12px", radius: "8px", gap: "8px", optPadding: "7px 10px", optFonte: "12.5px" },
};

export function SelectCustom({
  value,
  options = [],
  onChange,
  placeholder = "Selecione...",
  disabled = false,
  invalid = false,
  flash = false,
  id,
  size = "md",
  style,
  title,
  ariaLabel,
  zIndex = 100000,
}) {
  const [aberto, setAberto] = useState(false);
  const [marcado, setMarcado] = useState(-1); // índice destacado (teclado/mouse)
  const [pos, setPos] = useState(null); // { left, width, top } | { left, width, bottom }
  const rootRef = useRef(null);
  const listRef = useRef(null);

  const t = TAMANHOS[size] || TAMANHOS.md;
  const selecionadoIdx = options.findIndex((o) => o.value === value);
  const selecionado = selecionadoIdx >= 0 ? options[selecionadoIdx] : null;

  useEffect(() => { if (disabled) setAberto(false); }, [disabled]);

  // Fecha ao clicar fora — o clique pode cair na lista, que vive no portal e
  // portanto não é descendente do root.
  useEffect(() => {
    if (!aberto) return undefined;
    function onDocDown(e) {
      if (rootRef.current?.contains(e.target)) return;
      if (listRef.current?.contains(e.target)) return;
      setAberto(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [aberto]);

  // Posiciona a lista colada no gatilho; vira para cima se faltar espaço embaixo.
  useLayoutEffect(() => {
    if (!aberto) { setPos(null); return undefined; }

    function medir() {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const espacoAbaixo = window.innerHeight - r.bottom;
      const paraCima = espacoAbaixo < 260 && r.top > espacoAbaixo;
      setPos({
        left: r.left,
        width: r.width,
        ...(paraCima
          ? { bottom: window.innerHeight - r.top + 6, maxHeight: Math.min(300, r.top - 16) }
          : { top: r.bottom + 6, maxHeight: Math.min(300, espacoAbaixo - 16) }),
      });
    }

    medir();
    // `capture` para pegar rolagem de qualquer ancestral, não só da janela.
    window.addEventListener("scroll", medir, true);
    window.addEventListener("resize", medir);
    return () => {
      window.removeEventListener("scroll", medir, true);
      window.removeEventListener("resize", medir);
    };
  }, [aberto]);

  // Ao abrir, o destaque começa no item já escolhido.
  useEffect(() => {
    if (aberto) setMarcado(selecionadoIdx >= 0 ? selecionadoIdx : 0);
  }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mantém o item destacado visível quando a lista rola.
  useEffect(() => {
    if (!aberto || marcado < 0) return;
    listRef.current?.children[marcado]?.scrollIntoView({ block: "nearest" });
  }, [aberto, marcado]);

  function escolher(i) {
    const opt = options[i];
    if (!opt || opt.disabled) return;
    onChange?.(opt.value);
    setAberto(false);
  }

  function handleKeyDown(e) {
    if (disabled) return;
    if (!aberto) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setAberto(true);
      }
      return;
    }
    switch (e.key) {
      case "Escape": e.preventDefault(); setAberto(false); break;
      case "Tab": setAberto(false); break;
      case "Enter": case " ": e.preventDefault(); escolher(marcado); break;
      case "ArrowDown": e.preventDefault(); setMarcado((i) => Math.min(options.length - 1, i + 1)); break;
      case "ArrowUp": e.preventDefault(); setMarcado((i) => Math.max(0, i - 1)); break;
      case "Home": e.preventDefault(); setMarcado(0); break;
      case "End": e.preventDefault(); setMarcado(options.length - 1); break;
      default: break;
    }
  }

  const corBorda = invalid
    ? "rgba(239,68,68,0.6)"
    : aberto ? "rgba(99,102,241,0.7)" : "rgba(255,255,255,0.1)";

  return (
    <div ref={rootRef} style={{ position: "relative", ...style }}>
      <button
        type="button"
        id={id}
        title={title}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setAberto((v) => !v)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        style={{
          display: "flex", alignItems: "center", gap: t.gap, width: "100%",
          boxSizing: "border-box", padding: t.padding, borderRadius: t.radius,
          background: "rgba(255,255,255,0.04)", border: `1px solid ${corBorda}`,
          color: "inherit", fontSize: t.fonte, fontFamily: "inherit", fontWeight: 400,
          textAlign: "left", lineHeight: 1.3,
          cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1,
          // Neutraliza o `button:hover` global do styles.css (translateY + sombra).
          transform: "none",
          boxShadow: aberto ? "0 0 0 3px rgba(99,102,241,0.15)" : "none",
          transition: "border-color 0.2s, box-shadow 0.2s",
          ...(flash ? { animation: "field-flash-red 0.5s ease-in-out 0s 4" } : {}),
        }}
      >
        {selecionado ? (
          <>
            {selecionado.color && (
              <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: selecionado.color, flexShrink: 0 }} />
            )}
            <span style={{ fontWeight: selecionado.description ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {selecionado.label}
            </span>
            {selecionado.description && (
              <span style={{ fontSize: "12px", color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                · {selecionado.description}
              </span>
            )}
          </>
        ) : (
          <span style={{ color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {placeholder}
          </span>
        )}
        <span style={{ marginLeft: "auto", display: "flex", color: MUTED, paddingLeft: "4px" }}>
          <IconChevron aberto={aberto} size={size === "sm" ? 12 : 14} />
        </span>
      </button>

      {aberto && pos && createPortal(
        <ul
          ref={listRef}
          role="listbox"
          aria-labelledby={id}
          // Marca a lista para quem precisa saber que este clique ainda é "dentro"
          // do combo, mesmo ela morando no <body> (ex.: a toolbar de formatação
          // do editor de vitrine, que descarta a seleção ao clicar fora).
          data-selectcustom-list=""
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            left: `${pos.left}px`, width: `${pos.width}px`,
            ...(pos.top != null ? { top: `${pos.top}px` } : { bottom: `${pos.bottom}px` }),
            maxHeight: `${Math.max(120, pos.maxHeight)}px`,
            // Acima dos modais (1000) e dos toasts (99999). A toolbar de formatação
            // do editor usa o máximo do int e passa um zIndex próprio.
            zIndex,
            listStyle: "none", margin: 0, padding: "6px", overflowY: "auto",
            background: "rgba(18,18,26,0.98)",
            backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px",
            boxShadow: "0 22px 48px rgba(0,0,0,0.55)",
            animation: "fadeIn 0.15s ease-out",
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            color: "#f8fafc",
          }}
        >
          {options.length === 0 && (
            <li style={{ padding: t.optPadding, fontSize: t.optFonte, color: MUTED }}>Nenhuma opção disponível</li>
          )}
          {options.map((opt, i) => {
            const ativo = i === marcado;
            const escolhido = opt.value === value;
            const cor = opt.color;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={escolhido}
                onMouseEnter={() => setMarcado(i)}
                onClick={() => escolher(i)}
                style={{
                  display: "flex", alignItems: opt.description ? "flex-start" : "center", gap: "10px",
                  padding: t.optPadding, borderRadius: "9px", cursor: "pointer",
                  background: escolhido && cor ? `${cor}1f` : escolhido ? "rgba(99,102,241,0.14)" : ativo ? "rgba(255,255,255,0.06)" : "transparent",
                  border: `1px solid ${escolhido ? (cor ? `${cor}59` : "rgba(99,102,241,0.4)") : "transparent"}`,
                  transition: "background 0.12s",
                }}
              >
                {cor && (
                  <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: cor, flexShrink: 0, marginTop: opt.description ? "5px" : 0 }} />
                )}
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontSize: t.optFonte, fontWeight: opt.description ? 600 : 500, color: escolhido && cor ? cor : "inherit" }}>
                    {opt.label}
                  </span>
                  {opt.description && (
                    <span style={{ display: "block", fontSize: "11.5px", color: MUTED, lineHeight: 1.5, marginTop: "2px" }}>
                      {opt.description}
                    </span>
                  )}
                </span>
                {escolhido && (
                  <span style={{ color: cor || "#a5b4fc", flexShrink: 0, marginTop: opt.description ? "3px" : 0, display: "flex" }}>
                    <IconCheck />
                  </span>
                )}
              </li>
            );
          })}
        </ul>,
        document.body,
      )}
    </div>
  );
}
