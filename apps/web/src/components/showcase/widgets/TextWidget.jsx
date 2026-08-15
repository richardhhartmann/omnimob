import { ShowcaseTexto } from "../contexto.jsx";

/* Título + parágrafo. Atende `text`, `note`, `faq` e `hours` — quatro tipos da
   biblioteca que sempre desenharam a mesma coisa nas duas telas. O mapa em
   `ShowcaseWidget` aponta os quatro para cá de propósito: antes eles caíam num
   `else` final, e um tipo novo herdava esse desenho por acidente em vez de por
   decisão. */
export function TextWidget({ widget }) {
  const cor = widget.color ? { color: widget.color } : undefined;
  return (
    <div>
      <ShowcaseTexto as="h3" campo={`widget|${widget.id}|title`} html={widget.title} style={cor} />
      <ShowcaseTexto as="p" campo={`widget|${widget.id}|content`} html={widget.content} style={cor} />
    </div>
  );
}
