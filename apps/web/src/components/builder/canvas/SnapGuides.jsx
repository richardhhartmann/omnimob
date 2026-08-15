/* Guias de encaixe.

   Linhas finas no accent, desenhadas só enquanto o encaixe está acontecendo.
   São a explicação do movimento: sem elas a peça "pula" alguns pixels e a
   pessoa não sabe se foi ela ou o editor.

   O eixo X vem em % (é a unidade do layout) e o Y em px — a mesma assimetria do
   resto do editor, e a razão de as duas guias não poderem compartilhar código. */

export function SnapGuides({ guias }) {
  if (!guias) return null;
  const { x, y } = guias;
  if (!x && !y) return null;

  return (
    <>
      {x ? (
        <div
          aria-hidden
          className={`editor-snap-guide is-vertical ${x.tipo === "centro" ? "is-centro" : ""}`}
          style={{ left: `${x.pos}%` }}
        />
      ) : null}
      {y ? (
        <div
          aria-hidden
          className="editor-snap-guide is-horizontal"
          style={{ top: `${y.pos}px` }}
        />
      ) : null}
    </>
  );
}
