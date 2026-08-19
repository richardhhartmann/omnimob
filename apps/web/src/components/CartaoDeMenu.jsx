import { spawnRipple } from "../utils/rippleDrop";

/* ────────────────────────────────────────────────────────────────────────────
   O cartão dos índices do painel.

   Três telas do produto fazem a mesma pergunta — "para onde vou daqui?" —, e a
   resposta precisa ter sempre a mesma cara: Gerenciar Imóveis, Relatórios e
   Configurações. Eram três cópias do mesmo bloco de estilos, com os mesmos
   valores de transform, borda, sombra e gradiente repetidos linha a linha.
   Idênticas hoje; a primeira a divergir seria aquela em que alguém ajustasse um
   raio sem lembrar das outras duas.

   O `pg-follow` e o `spawnRipple` são o mesmo par usado nos atalhos da tela
   inicial: o gradiente segue o ponteiro (variáveis --px/--py alimentadas por um
   listener global) e o clique solta a onda na cor do cartão.
   ──────────────────────────────────────────────────────────────────────────── */

const REPOUSO = {
  borda: "1px solid rgba(255,255,255,0.15)",
  fundo: "linear-gradient(var(--pg-angle, 145deg), rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 100%)",
};

export function CartaoDeMenu({ icon, title, desc, accent, onClick, tourId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-tour={tourId}
      className="pg-follow"
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "48px 32px", borderRadius: "24px", cursor: "pointer",
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s, box-shadow 0.3s",
        border: REPOUSO.borda,
        background: REPOUSO.fundo,
        backdropFilter: "blur(12px)", color: "inherit", gap: "24px",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-6px)";
        e.currentTarget.style.border = "1px solid rgba(255,255,255,0.3)";
        e.currentTarget.style.background = "radial-gradient(circle at var(--px, 50%) var(--py, 50%), rgba(255,255,255,0.18) 0%, transparent 90%), linear-gradient(var(--pg-angle, 145deg), rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 100%)";
        e.currentTarget.style.boxShadow = "0 20px 40px rgba(0,0,0,0.15)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.border = REPOUSO.borda;
        e.currentTarget.style.background = REPOUSO.fundo;
        e.currentTarget.style.boxShadow = "none";
      }}
      onMouseDown={(e) => {
        spawnRipple(e, accent || "rgba(255,255,255,0.85)");
        e.currentTarget.style.transform = "translateY(-1px) scale(0.98)";
      }}
      onMouseUp={(e) => { e.currentTarget.style.transform = "translateY(-6px)"; }}
    >
      <div style={{ background: "rgba(255,255,255,0.1)", padding: "20px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", textAlign: "center" }}>
        <span style={{ fontSize: "22px", fontWeight: "600", letterSpacing: "-0.5px" }}>{title}</span>
        <span style={{ fontSize: "14px", opacity: 0.7, fontWeight: "400", lineHeight: "1.5" }}>{desc}</span>
      </div>
    </button>
  );
}

/* O caminho de volta ao índice. Também repetido: Relatórios tinha o seu, e
   Configurações precisaria de outro igual. */
export function VoltarAoIndice({ onClick, rotulo, titulo }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={onClick}
        style={{
          width: "auto", padding: "7px 13px", borderRadius: "999px", cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: "7px", fontSize: "12.5px",
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "inherit",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        {rotulo}
      </button>
      <h2 style={{ margin: 0, fontSize: "21px", fontWeight: 700 }}>{titulo}</h2>
    </div>
  );
}
