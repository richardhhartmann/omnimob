import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

// ── Modal de confirmação ──────────────────────────────────────────────────────

/* `tone` continua em "danger" por padrão: quase toda confirmação daqui é sobre
   apagar ou desativar algo, e mudar o padrão repintaria a metade do painel.
   "primary" existe para o caso oposto — confirmar um upgrade de plano em
   vermelho faz a pessoa hesitar diante de uma coisa boa. */
const TONS = {
  danger:  { ico: "#f87171", icoBg: "rgba(239,68,68,0.12)", icoBorda: "rgba(239,68,68,0.2)",
             borda: "rgba(239,68,68,0.35)", fundo: "rgba(239,68,68,0.15)", texto: "#fca5a5",
             fundoHover: "rgba(239,68,68,0.28)" },
  primary: { ico: "#a5b4fc", icoBg: "rgba(99,102,241,0.14)", icoBorda: "rgba(99,102,241,0.24)",
             borda: "rgba(99,102,241,0.45)", fundo: "rgba(99,102,241,0.20)", texto: "#c7d2fe",
             fundoHover: "rgba(99,102,241,0.34)" },
};

export function ConfirmModal({ open, message, confirmLabel = "Confirmar", tone = "danger", onConfirm, onCancel }) {
  const t = TONS[tone] || TONS.danger;
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return createPortal(
    <>
      {/* Backdrop com blur — sempre montado; opacidade controlada via CSS */}
      <div
        onClick={onCancel}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9000,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: open ? "blur(6px)" : "blur(0px)",
          WebkitBackdropFilter: open ? "blur(6px)" : "blur(0px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.22s ease, backdrop-filter 0.22s ease",
        }}
      />

      {/* Caixa do modal */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9001,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <div
          className="modal-cartao"
          style={{
            width: "100%",
            maxWidth: "400px",
            background: "rgba(18,22,36,0.98)",
            border: "1px solid var(--linha-10, rgba(255,255,255,0.1))",
            borderRadius: "16px",
            padding: "28px 28px 24px",
            boxShadow: "0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
            opacity: open ? 1 : 0,
            transform: open ? "scale(1) translateY(0)" : "scale(0.96) translateY(10px)",
            transition: "opacity 0.22s ease, transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {/* Ícone de aviso */}
          <div style={{
            width: "40px", height: "40px", borderRadius: "10px",
            background: t.icoBg, border: `1px solid ${t.icoBorda}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: "16px",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.ico} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>

          <p style={{
            margin: "0 0 24px",
            fontSize: "14px",
            lineHeight: "1.6",
            color: "#e2e8f0",
            fontWeight: 400,
          }}>
            {message}
          </p>

          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: "8px 18px",
                borderRadius: "8px",
                border: "1px solid var(--linha-12, rgba(255,255,255,0.12))",
                background: "var(--sup-05, rgba(255,255,255,0.05))",
                color: "#94a3b8",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                width: "auto",
                transition: "background 0.15s, color 0.15s",
                boxShadow: "none",
                transform: "none",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.10)"; e.currentTarget.style.color = "#f1f5f9"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#94a3b8"; }}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={tone === "danger" ? "btn-danger" : undefined}
              onClick={onConfirm}
              style={{
                padding: "8px 18px",
                borderRadius: "8px",
                border: `1px solid ${t.borda}`,
                background: t.fundo,
                color: t.texto,
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                width: "auto",
                transition: "background 0.15s, color 0.15s",
                boxShadow: "none",
                transform: "none",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = t.fundoHover; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = t.fundo; e.currentTarget.style.color = t.texto; }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useConfirm() {
  const [state, setState] = useState({ open: false, message: "", confirmLabel: "Confirmar", tone: "danger", resolve: null });

  const confirm = useCallback((message, confirmLabel = "Confirmar", tone = "danger") => {
    return new Promise((resolve) => {
      setState({ open: true, message, confirmLabel, tone, resolve });
    });
  }, []);

  function close(value) {
    setState((prev) => {
      prev.resolve?.(value);
      // O tom sai junto com o resto no fechamento, senão a próxima confirmação
      // herdaria a cor da anterior durante a animação de saída.
      return { open: false, message: "", confirmLabel: "Confirmar", tone: "danger", resolve: null };
    });
  }

  const modal = (
    <ConfirmModal
      open={state.open}
      message={state.message}
      confirmLabel={state.confirmLabel}
      tone={state.tone}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );

  return { confirm, modal };
}
