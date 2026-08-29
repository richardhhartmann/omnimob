import { useEffect, useRef } from "react";
import { registrarNovo } from "../utils/registroDeNovo";
import { TeclaDeAtalho } from "./ContextoDeAtalhos.jsx";
const BASE = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "32px",
  height: "32px",
  padding: "0",
  borderRadius: "8px",
  border: "1px solid var(--linha-10, rgba(255,255,255,0.1))",
  background: "var(--sup-04, rgba(255,255,255,0.04))",
  cursor: "pointer",
  flexShrink: 0,
  transition: "background 0.15s ease, border-color 0.15s ease",
  color: "var(--text-main)",
};

function IconBtn({ title, onClick, disabled, style, className, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={{ ...BASE, ...style }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = style?.background ?? "rgba(255,255,255,0.04)"; }}
    >
      {children}
    </button>
  );
}

export function BtnEditar({ onClick, disabled }) {
  return (
    <IconBtn title="Editar" onClick={onClick} disabled={disabled}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </IconBtn>
  );
}

export function BtnExcluir({ onClick, disabled }) {
  return (
    <IconBtn
      title="Excluir"
      onClick={onClick}
      disabled={disabled}
      className="btn-danger"
      style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.2)", background: "rgba(248,113,113,0.06)" }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      </svg>
    </IconBtn>
  );
}

export function BtnDesativar({ onClick, disabled }) {
  return (
    <IconBtn
      title="Desativar"
      onClick={onClick}
      disabled={disabled}
      className="btn-danger"
      style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.2)", background: "rgba(248,113,113,0.06)" }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      </svg>
    </IconBtn>
  );
}

export function BtnAtivar({ onClick, disabled }) {
  return (
    <IconBtn
      title="Ativar"
      onClick={onClick}
      disabled={disabled}
      style={{ color: "#10b981", borderColor: "rgba(16,185,129,0.2)", background: "rgba(16,185,129,0.06)" }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    </IconBtn>
  );
}

export function BtnGerenciar({ onClick, disabled, title = "Gerenciar" }) {
  return (
    <IconBtn title={title} onClick={onClick} disabled={disabled} style={{ color: "#a5b4fc", borderColor: "rgba(165,180,252,0.2)", background: "rgba(165,180,252,0.06)" }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    </IconBtn>
  );
}

/* ── O botão que responde ao "N" ────────────────────────────────────────────

   Quatro telas o usam — Clientes, Usuários, Cargos e Tipos de Imóvel —, e é por
   isso que o registro mora AQUI e não em cada página: a tecla passa a funcionar
   em toda tela que já tem o botão, e em toda tela nova que vier a usá-lo, sem
   ninguém lembrar de ligar nada. Uma página que esquecesse o registro teria o
   atalho falhando em silêncio, que é exatamente o defeito que existia.

   O selo da tecla vai DENTRO do botão: um atalho que ninguém descobre não é
   atalho. `TeclaDeAtalho` devolve `null` quando a imobiliária desligou os
   atalhos ou a pessoa desligou este, e aí o botão fica igual ao de antes. */
export function BtnNovo({ onClick, label = "Novo" }) {
  /* `useRef` para o efeito não depender da identidade da função: quase toda
     página passa uma arrow nova a cada render, e sem isto o registro seria
     desfeito e refeito em todo ciclo. */
  const acao = useRef(onClick);
  acao.current = onClick;
  useEffect(() => registrarNovo(() => acao.current?.()), []);

  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        width: "auto",
        padding: "8px 14px",
        borderRadius: "8px",
        border: "none",
        background: "var(--accent)",
        color: "#fff",
        fontSize: "13px",
        fontWeight: "600",
        cursor: "pointer",
        flexShrink: 0,
        transition: "opacity 0.15s ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      {label}
      <TeclaDeAtalho acao="global.novo" className="tecla-atalho--no-botao" />
    </button>
  );
}

export function BtnVoltar({ onClick, label = "Voltar" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        width: "auto",
        padding: "7px 12px",
        borderRadius: "8px",
        border: "1px solid var(--linha-10, rgba(255,255,255,0.1))",
        background: "var(--sup-04, rgba(255,255,255,0.04))",
        color: "var(--text-muted)",
        fontSize: "13px",
        fontWeight: "500",
        cursor: "pointer",
        flexShrink: 0,
        transition: "background 0.15s ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      {label}
    </button>
  );
}
