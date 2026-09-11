import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePuck } from "@puckeditor/core";
import { agruparCom, moverJunto, ordemDasPecas, removerPeca } from "./agrupar.js";
import { idsSelecionados, limparSelecao, observarSelecao } from "./selecaoMultipla.js";

/* ────────────────────────────────────────────────────────────────────────────
   O QUE FAZER COM VÁRIAS PEÇAS SELECIONADAS.

   O inspetor do Puck fala com UMA peça — é o `itemSelector` dele. Com duas ou
   mais escolhidas não há onde oferecer nada, e uma seleção que não faz nada é
   um realce bonito e inútil.

   Esta barra é o lugar. Ela aparece quando há duas ou mais e some sozinha
   quando sobra uma — nunca tira espaço de quem está editando uma peça só.

   ── AS DUAS AÇÕES SÃO AS QUE O DOCUMENTO JÁ SABE FAZER ──

   Agrupar em seção e excluir. As duas existem em `agrupar.js` e são as mesmas
   que a barra da peça oferece para uma — aqui elas valem para a lista inteira,
   e é essa a única diferença.

   MOVER não está aqui, e não é esquecimento: mover é gesto, não botão. Arrastar
   qualquer peça da seleção leva as outras junto (ver `PonteDeEdicao`).

   ── ELA SAI POR PORTAL ──

   Ela é montada dentro do cabeçalho do Puck (é lá que o `dispatch` existe), e
   `position: fixed` lá dentro NÃO mede pela janela: um ancestral com
   `transform` vira bloco de contenção, e a barra apareceu com `y: -124` — fora
   da tela, por cima. É a armadilha recorrente desta base, a mesma que o
   fantasma do arrasto do editor clássico já tinha pisado.

   No `body` ela mede pela janela, que é o que `fixed` promete.

   ── UMA GRAVAÇÃO SÓ ──

   As duas ações constroem o documento inteiro e despacham uma vez. Com uma
   gravação por peça, desfazer devolveria as peças uma a uma — e a pessoa veria
   estados intermediários que nunca existiram na tela dela.
   ──────────────────────────────────────────────────────────────────────────── */
export function BarraDaSelecao() {
  const { dispatch } = usePuck();
  const [ids, setIds] = useState(idsSelecionados);

  useEffect(() => observarSelecao(setIds), []);

  if (ids.length < 2) return null;

  /* A âncora do agrupamento é a PRIMEIRA na ordem da página, e não a primeira
     clicada: agrupar tem de produzir a mesma seção independentemente de a
     pessoa ter escolhido de cima para baixo ou o contrário. */
  const agrupar = () => {
    dispatch({
      type: "setData",
      data: (atual) => {
        const ordem = ordemDasPecas(atual.content).filter((x) => ids.includes(x));
        if (ordem.length < 2) return atual;
        const [ancora, ...outras] = ordem;
        /* Junta primeiro e agrupa depois: `agruparCom` trabalha entre vizinhas,
           e as selecionadas podem estar espalhadas pela página. */
        let conteudo = moverJunto(atual.content, ordem, ancora) || atual.content;
        for (const id of outras) {
          conteudo = agruparCom(conteudo, id, ancora, "direita") || conteudo;
        }
        return { ...atual, content: conteudo };
      },
    });
    limparSelecao();
  };

  const excluir = () => {
    dispatch({
      type: "setData",
      data: (atual) => {
        let conteudo = atual.content;
        for (const id of ids) {
          const sem = removerPeca(conteudo, id);
          if (sem) conteudo = sem;
        }
        return { ...atual, content: conteudo };
      },
    });
    limparSelecao();
  };

  return createPortal(
    <div className="puck-selecao" role="toolbar" aria-label="Ações das peças selecionadas">
      <strong>{ids.length} peças selecionadas</strong>
      <button type="button" onClick={agrupar}>Agrupar em seção</button>
      <button type="button" className="puck-selecao--perigo" onClick={excluir}>Excluir</button>
      <button type="button" className="puck-selecao__fechar" onClick={limparSelecao} aria-label="Limpar seleção">×</button>
    </div>,
    document.body,
  );
}
