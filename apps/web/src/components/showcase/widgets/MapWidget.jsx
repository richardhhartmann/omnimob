import { ShowcaseTexto } from "../contexto.jsx";

/* Localização. Ainda é um cartão com o endereço, não um mapa embutido — mas
   agora é o MESMO cartão nos dois lados. O editor desenhava um invólucro com
   borda e raio próprios (`editor-mapa-placeholder`), diferente do que a vitrine
   publicava. */

export function MapWidget({ widget }) {
  const cor = widget.color ? { color: widget.color } : undefined;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ShowcaseTexto as="h3" campo={`widget|${widget.id}|title`} umaLinha html={widget.title} style={cor} />
      <div
        style={{
          flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          marginTop: "20px", background: "rgba(0,0,0,0.15)", borderRadius: "20px", padding: "32px",
          textAlign: "center", border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "16px" }} aria-hidden>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
        </svg>
        <ShowcaseTexto
          as="p"
          campo={`widget|${widget.id}|content`}
          html={widget.content}
          style={{ fontSize: "16px", color: "var(--text-main)", margin: 0, fontWeight: "500" }}
        />
      </div>
    </div>
  );
}
