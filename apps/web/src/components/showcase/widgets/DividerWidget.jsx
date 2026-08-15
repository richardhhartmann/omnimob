import { ShowcaseTexto } from "../contexto.jsx";

export function DividerWidget({ widget }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 0", height: "100%", display: "flex", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "24px", width: "100%" }}>
        <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15))" }} />
        <ShowcaseTexto
          as="span"
          campo={`widget|${widget.id}|title`}
          umaLinha
          html={widget.title}
          style={{ fontSize: "15px", opacity: 0.7, letterSpacing: "0.2em", textTransform: "uppercase" }}
        />
        <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg, rgba(255,255,255,0.15), transparent)" }} />
      </div>
    </div>
  );
}
