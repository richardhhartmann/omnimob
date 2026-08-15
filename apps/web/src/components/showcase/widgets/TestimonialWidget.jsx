import { IconeEstrela } from "../../Icones.jsx";
import { ShowcaseTexto } from "../contexto.jsx";

/* As estrelas eram cinco `IconeEstrela` na vitrine e a string "★★★★★" no
   editor. O glifo depende da fonte do sistema e nem sequer tem o mesmo tamanho;
   agora é o mesmo SVG nos dois lados. */
export function TestimonialWidget({ widget }) {
  const cor = widget.color ? { color: widget.color } : undefined;
  return (
    <div style={{ textAlign: "center", padding: "16px" }}>
      <div className="widget-testimonial-stars" aria-label="5 de 5 estrelas">
        {[0, 1, 2, 3, 4].map((n) => <IconeEstrela key={n} size={13} />)}
      </div>
      <ShowcaseTexto
        as="div"
        className="widget-testimonial-content"
        campo={`widget|${widget.id}|content`}
        html={widget.content}
        style={cor}
      />
      <ShowcaseTexto
        as="h3"
        campo={`widget|${widget.id}|title`}
        umaLinha
        html={widget.title}
        style={{ fontSize: "16px", fontWeight: 600, color: "var(--accent)", margin: 0, ...cor }}
      />
    </div>
  );
}
