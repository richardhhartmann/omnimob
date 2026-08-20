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

export function CartaoDeMenu({ icon, title, desc, accent, onClick, tourId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-tour={tourId}
      className="pg-follow menu-cartao"
      /* Repouso e hover moram no CSS (`.menu-cartao`), não aqui. Escritos nos
         handlers de mouse, eles eram brancos translúcidos fixos — corretos no
         escuro e invisíveis no claro, sem forma de o tema alcançá-los. */
      style={{ "--pg-accent": accent || "#94a3b8" }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-6px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
      onMouseDown={(e) => {
        spawnRipple(e, accent || "rgba(255,255,255,0.85)");
        e.currentTarget.style.transform = "translateY(-1px) scale(0.98)";
      }}
      onMouseUp={(e) => { e.currentTarget.style.transform = "translateY(-6px)"; }}
    >
      <div className="menu-cartao__disco">
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
        className="ui-pilula"
        style={{
          width: "auto", padding: "7px 13px", borderRadius: "999px", cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: "7px", fontSize: "12.5px",
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
