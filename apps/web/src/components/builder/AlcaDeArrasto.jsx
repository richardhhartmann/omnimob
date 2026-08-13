import { useDraggable } from "@dnd-kit/react";

/* A alça pela qual um bloco (ou widget) é arrastado.

   Só isto virou dnd-kit: o elemento que INICIA o gesto. O que acontece durante
   o arrasto continua no `ShowcaseEditorPage`, porque é geometria de produto —
   colisão, cascata, guias, zoom. Ver `dndEditor.js`.

   `feedback: "none"` é obrigatório aqui: sem ele o dnd-kit moveria o elemento
   por conta própria, e o bloco andaria em dobro — uma vez pela biblioteca e
   outra pelo nosso estado.

   O `ref` vai na própria alça e o `handle` é ela mesma. Não usamos o `element`
   maior (o bloco inteiro) de propósito: com o bloco todo arrastável, selecionar
   texto dentro dele viraria arrasto. */
export function AlcaDeArrasto({ id, dados, travado, className, style, children, title }) {
  const { ref, isDragging } = useDraggable({
    id,
    data: dados,
    disabled: travado,
    feedback: "none",
  });

  return (
    <div
      ref={ref}
      className={className}
      title={title}
      style={{
        ...style,
        cursor: travado ? "not-allowed" : isDragging ? "grabbing" : "grab",
        // Sem isto o navegador tenta rolar a página no toque em vez de arrastar.
        touchAction: "none",
      }}
    >
      {children}
    </div>
  );
}
