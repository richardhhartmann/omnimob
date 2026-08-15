import { ShowcaseLinkExterno, ShowcaseTexto } from "../contexto.jsx";

/* Redes sociais.

   O conteúdo é uma lista de endereços separados por barra. A vitrine sempre
   desenhou botões a partir deles; o editor mostrava a lista de URLs como texto
   corrido. Agora os dois desenham os botões, e os endereços são editados no
   inspetor — eles são configuração, e pintá-los na prancheta seria desenhar
   algo que a página publicada não tem. */

export function redesDoConteudo(conteudo) {
  return String(conteudo || "")
    .split("|")
    .map((url) => url.trim())
    .filter(Boolean)
    .map((url) => {
      const wa = url.includes("wa.me") || url.includes("whatsapp");
      const ig = url.includes("instagram");
      const fb = url.includes("facebook");
      return {
        url,
        rotulo: wa ? "WhatsApp" : ig ? "Instagram" : fb ? "Facebook" : "Acessar",
        inicial: wa ? "W" : ig ? "I" : fb ? "F" : "S",
        fundo: wa
          ? "#25D366"
          : ig
            ? "linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)"
            : fb
              ? "#1877F2"
              : "var(--accent)",
      };
    });
}

export function SocialWidget({ widget }) {
  const cor = widget.color ? { color: widget.color } : undefined;
  const redes = redesDoConteudo(widget.content);

  return (
    <div style={{ textAlign: "center", padding: "8px" }}>
      <ShowcaseTexto as="h3" campo={`widget|${widget.id}|title`} umaLinha html={widget.title} style={cor} />
      <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "16px", marginTop: "24px" }}>
        {redes.map((rede, i) => (
          <ShowcaseLinkExterno
            key={i}
            href={rede.url}
            style={{
              display: "flex", alignItems: "center", gap: "10px", padding: "14px 28px",
              background: rede.fundo, borderRadius: "16px", color: "#fff", fontSize: "15px",
              fontWeight: "600", textDecoration: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            }}
          >
            <span style={{ fontWeight: "800", fontSize: "18px" }}>{rede.inicial}</span> {rede.rotulo}
          </ShowcaseLinkExterno>
        ))}
      </div>
    </div>
  );
}
