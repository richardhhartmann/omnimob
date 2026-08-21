import { spawnRipple } from "../utils/rippleDrop";
import { TeclaDeAtalho } from "./ContextoDeAtalhos.jsx";

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

export function CartaoDeMenu({ icon, title, desc, accent, onClick, tourId, acao }) {
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
      {/* A tecla no canto. `acao` é opcional: cartão sem atalho não desenha
          nada, e cartão com atalho desligado também não. */}
      {acao ? <TeclaDeAtalho acao={acao} className="tecla-atalho--canto" /> : null}
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
