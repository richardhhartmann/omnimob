import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/* ────────────────────────────────────────────────────────────────────────────
   Confirmação para decisão que a pessoa não desfaz sozinha.

   Diferente do `ConfirmModal`: lá a pergunta é "tem certeza?" e a resposta é um
   clique. Aqui o risco não está em errar o botão — está em não ter lido. Por
   isso a caixa de ciência: ela não é enfeite jurídico, é o que separa "cliquei
   rápido" de "eu li e assumo".

   Enquanto a caixa não estiver marcada, o botão de confirmar fica desabilitado.
   ──────────────────────────────────────────────────────────────────────────── */

export function ModalCiencia({
  aberto,
  titulo,
  descricao,
  riscos = [],
  textoCiencia,
  confirmarLabel = "Confirmar",
  aoConfirmar,
  aoCancelar,
}) {
  const [ciente, setCiente] = useState(false);

  /* A marca some ao fechar, e é o ponto todo do componente: mantida, a segunda
     concessão herdaria o "estou ciente" da primeira e passaria com um clique —
     que é exatamente o clique apressado que este modal existe para impedir. */
  useEffect(() => {
    if (!aberto) setCiente(false);
  }, [aberto]);

  useEffect(() => {
    if (aberto) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [aberto]);

  // Esc cancela. Não há atalho para confirmar: só o clique, e só depois da caixa.
  useEffect(() => {
    if (!aberto) return undefined;
    const aoTeclar = (e) => { if (e.key === "Escape") aoCancelar?.(); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto, aoCancelar]);

  return createPortal(
    <>
      <div
        onClick={aoCancelar}
        style={{
          position: "fixed", inset: 0, zIndex: 9000,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: aberto ? "blur(6px)" : "blur(0px)",
          WebkitBackdropFilter: aberto ? "blur(6px)" : "blur(0px)",
          opacity: aberto ? 1 : 0,
          pointerEvents: aberto ? "auto" : "none",
          transition: "opacity 0.22s ease, backdrop-filter 0.22s ease",
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        style={{
          position: "fixed", inset: 0, zIndex: 9001,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "24px",
          pointerEvents: aberto ? "auto" : "none",
        }}
      >
        <div style={{
          width: "100%", maxWidth: "480px",
          background: "rgba(18,22,36,0.98)",
          border: "1px solid rgba(245,158,11,0.28)",
          borderRadius: "16px",
          padding: "26px 26px 22px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
          opacity: aberto ? 1 : 0,
          transform: aberto ? "scale(1) translateY(0)" : "scale(0.96) translateY(10px)",
          transition: "opacity 0.22s ease, transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)",
          maxHeight: "90vh", overflowY: "auto",
        }}>
          <div style={{
            width: "40px", height: "40px", borderRadius: "10px",
            background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.24)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: "14px",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>

          <h3 style={{ margin: "0 0 10px", fontSize: "17px", fontWeight: 700, color: "#f1f5f9" }}>
            {titulo}
          </h3>

          {descricao ? (
            <p style={{ margin: "0 0 14px", fontSize: "13.5px", lineHeight: 1.6, color: "#cbd5e1" }}>
              {descricao}
            </p>
          ) : null}

          {riscos.length ? (
            <ul style={{
              margin: "0 0 18px", padding: "12px 14px 12px 30px",
              borderRadius: "10px",
              background: "rgba(245,158,11,0.07)",
              border: "1px solid rgba(245,158,11,0.18)",
              display: "flex", flexDirection: "column", gap: "7px",
            }}>
              {riscos.map((r, i) => (
                <li key={i} style={{ fontSize: "13px", lineHeight: 1.55, color: "#e2e8f0" }}>{r}</li>
              ))}
            </ul>
          ) : null}

          {/* Alvo grande de propósito: a caixa é a decisão, não um detalhe. */}
          <label style={{
            display: "flex", alignItems: "flex-start", gap: "10px",
            padding: "12px 14px", borderRadius: "10px", cursor: "pointer",
            border: ciente ? "1px solid rgba(245,158,11,0.5)" : "1px solid rgba(255,255,255,0.12)",
            background: ciente ? "rgba(245,158,11,0.10)" : "rgba(255,255,255,0.03)",
            transition: "border-color .15s ease, background .15s ease",
            marginBottom: "18px", userSelect: "none",
          }}>
            <input
              type="checkbox"
              checked={ciente}
              onChange={(e) => setCiente(e.target.checked)}
              style={{ accentColor: "#f59e0b", width: "15px", height: "15px", flexShrink: 0, marginTop: "1px" }}
            />
            <span style={{ fontSize: "13px", lineHeight: 1.5, color: "#e2e8f0" }}>{textoCiencia}</span>
          </label>

          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={aoCancelar}
              style={{
                padding: "8px 18px", borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.05)", color: "#94a3b8",
                fontSize: "13px", fontWeight: 500, cursor: "pointer",
                width: "auto", boxShadow: "none", transform: "none",
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!ciente}
              onClick={() => ciente && aoConfirmar?.()}
              style={{
                padding: "8px 18px", borderRadius: "8px",
                border: `1px solid ${ciente ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.10)"}`,
                background: ciente ? "rgba(245,158,11,0.22)" : "rgba(255,255,255,0.04)",
                color: ciente ? "#fde68a" : "#64748b",
                fontSize: "13px", fontWeight: 600,
                cursor: ciente ? "pointer" : "not-allowed",
                width: "auto", boxShadow: "none", transform: "none",
                transition: "background .15s, color .15s, border-color .15s",
              }}
            >
              {confirmarLabel}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

export default ModalCiencia;
