import { ShowcaseLinkExterno, ShowcaseTexto } from "../contexto.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   Chamada para ação.

   O editor desenhava aqui uma caixa "Configuração do Botão" com o rótulo dentro
   de um retângulo e o endereço logo abaixo, num campo com borda tracejada. Nada
   daquilo ia para a página: o visitante recebia um botão arredondado, grande,
   centralizado. Eram duas peças diferentes com o mesmo nome.

   Agora o botão é o botão. O ENDEREÇO saiu do canvas e foi para o inspetor, que
   é onde ele deve estar — é configuração, não conteúdo visível, e mostrá-lo na
   prancheta significaria desenhar algo que a vitrine não tem.
   ──────────────────────────────────────────────────────────────────────────── */

const IconeWhats = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }} aria-hidden>
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
  </svg>
);

export function ehWhatsApp(url) {
  return /wa\.me|whatsapp|api\.whatsapp/i.test(url || "");
}

export function CtaWidget({ widget }) {
  const cor = widget.color ? { color: widget.color } : undefined;
  const whats = ehWhatsApp(widget.ctaUrl);

  return (
    <div className="widget-cta-box">
      <ShowcaseTexto as="h3" campo={`widget|${widget.id}|title`} html={widget.title} style={cor} />
      <ShowcaseTexto
        as="p"
        campo={`widget|${widget.id}|content`}
        html={widget.content}
        style={{ fontSize: "16px", margin: "16px 0", ...cor }}
      />
      {widget.ctaLabel ? (
        <ShowcaseLinkExterno
          href={widget.ctaUrl || "#"}
          className="widget-cta-button"
          style={whats ? { background: "#25D366", display: "inline-flex", alignItems: "center", gap: "10px", boxShadow: "0 8px 22px rgba(37,211,102,0.4)" } : undefined}
        >
          {whats ? <IconeWhats /> : null}
          <ShowcaseTexto as="span" campo={`widget|${widget.id}|ctaLabel`} umaLinha html={widget.ctaLabel} />
        </ShowcaseLinkExterno>
      ) : null}
    </div>
  );
}
