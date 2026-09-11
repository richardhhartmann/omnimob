import { ShowcaseTexto, useVitrine } from "./contexto.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   O título de um widget — e o espaço que ele devolve quando não existe.

   Todo widget desenhava o próprio `<h3>` direto. Com o título apagado, o
   elemento continuava lá: vazio, mas cobrando a altura da linha e a margem. Num
   widget de 200px isso é um décimo da peça gasto com nada, e apagar o título
   era a única forma de pedir mais espaço para o conteúdo — que era exatamente o
   que não acontecia.

   ── VAZIO É MAIS QUE STRING VAZIA ──

   O título é editado por `contentEditable`, e um campo esvaziado pelo teclado
   quase nunca volta como `""`: volta como `<br>`, como `&nbsp;`, como
   `<p></p>`. Comparar com string vazia deixaria o buraco de pé justamente no
   caminho mais comum de apagar. Por isso o teste é sobre o TEXTO que sobra
   depois de tirar marcação e espaço.

   ── A ÚNICA DIVERGÊNCIA ENTRE OS DOIS MODOS, E POR QUE ELA É LEGÍTIMA ──

   No público, título vazio não existe: nada é renderizado, e o conteúdo sobe.

   No EDITOR ele continua no lugar, com um marca-lugar apagado. Some-lo ali
   tiraria a única forma de escrever o título de volta — a peça ficaria sem
   título para sempre, sem nada na tela que dissesse que um título é possível.

   Isso é afordância de edição, da mesma família do `contentEditable` e da alça
   de arrasto: aparato EM VOLTA do conteúdo, e não conteúdo diferente. A regra
   que não se quebra continua de pé — com título preenchido, os dois modos
   produzem exatamente a mesma marcação, e é isso que `test/paridade` verifica.
   ──────────────────────────────────────────────────────────────────────────── */

/** Sobra alguma palavra depois de tirar marcação e espaço? */
export function tituloVazio(html) {
  return !String(html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, "")
    .trim();
}

export function TituloDoWidget({ widget, as = "h3", className = "", style, umaLinha = false }) {
  const { modo } = useVitrine();
  const vazio = tituloVazio(widget.title);

  // No público, título vazio não ocupa nada — nem o elemento.
  if (vazio && modo !== "editor") return null;

  return (
    <ShowcaseTexto
      as={as}
      campo={`widget|${widget.id}|title`}
      /* Vazio vai como string vazia, e não como o `<br>` que o navegador
         deixou: é o que torna o elemento realmente `:empty` e faz o marca-lugar
         do CSS aparecer — e sumir na primeira letra digitada, sem ninguém
         precisar administrar isso. */
      html={vazio ? "" : widget.title}
      umaLinha={umaLinha}
      className={`${vazio ? "widget-titulo--vazio" : ""} ${className}`.trim()}
      style={style}
    />
  );
}
