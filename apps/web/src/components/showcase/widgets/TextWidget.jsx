import { ShowcaseTexto } from "../contexto.jsx";

/* Título + parágrafo. Atende os tipos simples `text`, `note` e `hours`.
   Widgets estruturados (FAQ, equipe, regiões etc.) têm renderizadores próprios
   para não esconder sua semântica dentro de um fallback genérico. */
export function TextWidget({ widget }) {
  const cor = widget.color ? { color: widget.color } : undefined;
  return (
    <div>
      <ShowcaseTexto as="h3" campo={`widget|${widget.id}|title`} html={widget.title} style={cor} />
      <ShowcaseTexto as="p" campo={`widget|${widget.id}|content`} html={widget.content} style={cor} />
    </div>
  );
}
