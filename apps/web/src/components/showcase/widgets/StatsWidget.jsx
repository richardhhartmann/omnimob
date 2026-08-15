import { ShowcaseTexto } from "../contexto.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   Bloco de números.

   Era a pior divergência da vitrine inteira. O conteúdo é gravado como uma
   string com barras — `"200+|Imóveis vendidos|15 anos|De experiência"` — e a
   página pública quebrava isso numa grade de cartões. O editor, não: ele
   mostrava a string crua num campo editável. A pessoa via uma linha de texto
   com barras no construtor e uma grade de três cartões na página publicada.

   Aqui a grade é a mesma nos dois, e no editor cada célula é editável no lugar.
   Editar o número onde o número aparece é, além de fiel, muito melhor do que
   contar barras numa linha de texto.
   ──────────────────────────────────────────────────────────────────────────── */

/** `"200+|Vendidos|15 anos|Experiência"` → `[["200+","Vendidos"],["15 anos","Experiência"]]` */
export function paresDeEstatistica(conteudo) {
  const partes = String(conteudo || "").split("|");
  const pares = [];
  for (let i = 0; i < partes.length; i += 2) {
    pares.push([partes[i] ?? "", partes[i + 1] ?? ""]);
  }
  return pares.slice(0, 4);
}

/** Caminho de volta: troca uma célula e devolve a string inteira. */
export function comCelulaTrocada(conteudo, indicePar, indiceCelula, valor) {
  const partes = String(conteudo || "").split("|");
  partes[indicePar * 2 + indiceCelula] = valor;
  return partes.join("|");
}

export function StatsWidget({ widget }) {
  const cor = widget.color ? { color: widget.color } : undefined;
  const pares = paresDeEstatistica(widget.content);

  return (
    <div style={{ padding: "8px" }}>
      <ShowcaseTexto
        as="h3"
        campo={`widget|${widget.id}|title`}
        umaLinha
        html={widget.title}
        style={{ textAlign: "center", marginBottom: "24px", ...cor }}
      />
      <div className="widget-stats-grid">
        {pares.map(([numero, rotulo], i) => (
          <div key={i} className="widget-stat-box">
            <ShowcaseTexto
              as="div"
              className="widget-stat-number"
              campo={`widget|${widget.id}|stat|${i}|0`}
              umaLinha
              html={numero}
            />
            <ShowcaseTexto
              as="div"
              className="widget-stat-label"
              campo={`widget|${widget.id}|stat|${i}|1`}
              umaLinha
              html={rotulo}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
