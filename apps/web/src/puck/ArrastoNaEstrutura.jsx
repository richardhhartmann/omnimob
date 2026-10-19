import { useEffect } from "react";
import { useGetPuck } from "@puckeditor/core";
import { levarParaOFim } from "./agrupar.js";

/* ────────────────────────────────────────────────────────────────────────────
   "DEPOIS DA SEÇÃO", NA ESTRUTURA.

   Rodapé em cima, seção aberta embaixo, e as duas são as últimas da página.
   Arrastar o rodapé para baixo da seção na aba Estrutura só oferecia UM
   destino: dentro dela, depois da última peça. Medido, ponto a ponto: com o
   ponteiro abaixo da última linha, o Puck propõe sempre "depois da última peça
   da seção" — nenhum ponto da lista quer dizer "depois da seção".

   ── POR QUE ACONTECE ──

   Cada linha da Estrutura é um alvo, e "antes/depois" é decidido pela linha
   sob o ponteiro. A linha de baixo de tudo é a da última peça da seção, então
   tudo que fica abaixo dela é "dentro". O "depois da seção" existe, mas só
   com o ponteiro EM CIMA do título da seção, com a linha desenhada lá embaixo
   — longe de onde a pessoa está mirando, e indistinguível na prática.

   ── O QUE ESTE VIGIA FAZ ──

   Com uma linha de dentro de seção sendo a última da lista, o espaço ABAIXO
   dela passa a significar "no fim da página": a linha de soltura do Puck some
   e a nossa aparece rente à lista inteira, sem recuo. Ao soltar ali, o arrasto
   do Puck é CANCELADO (Esc, que o dnd-kit já entende) e a peça é levada para o
   fim — um despacho só, uma entrada só no desfazer. Na linha da última peça,
   o "dentro da seção" continua sendo o do Puck: as duas opções existem.

   Sem `dispatch` não há como mover, e ele só existe dentro do provedor do
   Puck — por isso mora em `overrides.puck`, como `NomesDasSecoes`. Não
   desenha nada: a linha é um `::after` da lista (styles.css).
   ──────────────────────────────────────────────────────────────────────────── */

const CLASSE_NO_FIM = "puck-estrutura--no-fim";

/**
 * O ponteiro está no "fim da página"? Abaixo da última linha da lista, quando
 * essa linha é de dentro de uma seção, e dentro da largura da lista.
 *
 * @param {{x:number,y:number}} ponteiro
 * @param {{base:number, aninhada:boolean}|null} ultima a última linha visível
 * @param {{esquerda:number, direita:number}|null} lista a lista de fora
 */
export function soltarNoFim(ponteiro, ultima, lista) {
  if (!ultima || !lista || !ultima.aninhada) return false;
  return ponteiro.y > ultima.base && ponteiro.x >= lista.esquerda && ponteiro.x <= lista.direita;
}

const linhaDe = (el) => el?.closest?.("[data-puck-layer-tree-id]") || null;
const miolo = (li) => [...li.children].find((el) => /Layer-inner/.test(el.className));

/* O Puck marca o quadro da prévia enquanto a Estrutura arrasta (`setPreviewFence`).
   É o sinal de que o gesto é o da lista, e não o da prancheta. */
const arrastandoNaEstrutura = () =>
  document.getElementById("preview-frame")?.hasAttribute("data-puck-outline-dragging");

function medir() {
  const linhas = [...document.querySelectorAll("[data-puck-layer-tree-id]")];
  const raiz = linhas.find((li) => !li.parentElement.closest("[data-puck-layer-tree-id]"))?.parentElement;
  if (!raiz) return {};
  let ultima = null;
  for (const li of linhas) {
    const r = miolo(li)?.getBoundingClientRect();
    if (r && r.height > 0) ultima = { li, base: r.bottom };
  }
  const caixa = raiz.getBoundingClientRect();
  return {
    raiz,
    lista: { esquerda: caixa.left, direita: caixa.right },
    ultima: ultima && { base: ultima.base, aninhada: Boolean(ultima.li.parentElement.closest("[data-puck-layer-tree-id]")) },
  };
}

export function ArrastoNaEstrutura() {
  const pegarPuck = useGetPuck();

  useEffect(() => {
    let arrastado = null;
    let raizMarcada = null;

    const marcar = (raiz) => {
      if (raizMarcada === raiz) return;
      raizMarcada?.classList.remove(CLASSE_NO_FIM);
      raiz?.classList.add(CLASSE_NO_FIM);
      raizMarcada = raiz;
    };

    const aoApertar = (e) => {
      const li = linhaDe(e.target);
      arrastado = li && miolo(li)?.contains(e.target) ? li.getAttribute("data-puck-layer-tree-id") : null;
    };

    const aoMover = (e) => {
      if (!arrastado || !arrastandoNaEstrutura()) { marcar(null); return; }
      const { raiz, lista, ultima } = medir();
      marcar(soltarNoFim({ x: e.clientX, y: e.clientY }, ultima, lista) ? raiz : null);
    };

    const aoSoltar = () => {
      const id = arrastado;
      const noFim = Boolean(raizMarcada);
      arrastado = null;
      marcar(null);
      if (!noFim || !id) return;
      /* Cancela a soltura do Puck ANTES de ela acontecer: este ouvinte é de
         captura na janela, e o do dnd-kit é de captura no documento. Sem
         isso a peça cairia dentro da seção e depois sairia — dois passos no
         desfazer para um gesto só. */
      /* `cancelable`: o dnd-kit chama `preventDefault` no Esc, e é isso que
         impede o "Esc sai da tela" do painel (`useSaidaDaTela`) de levar a
         pessoa para fora do editor. Sem ele, o evento sintético saía. */
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      setTimeout(() => {
        pegarPuck().dispatch({
          type: "setData",
          data: (anterior) => {
            const novo = levarParaOFim(anterior.content, id);
            return novo ? { ...anterior, content: novo } : anterior;
          },
        });
        /* A peça continua selecionada no lugar novo. Pelo id, e não pelo
           índice: se ela era a última de uma seção, a seção vazia é podada
           (`PodarSecoesVazias`) e o índice muda. */
        setTimeout(() => {
          const { getSelectorForId, dispatch } = pegarPuck();
          const seletor = getSelectorForId(id);
          if (seletor) dispatch({ type: "setUi", ui: { itemSelector: seletor } });
        }, 0);
      }, 0);
    };

    window.addEventListener("pointerdown", aoApertar, true);
    window.addEventListener("pointermove", aoMover, true);
    window.addEventListener("pointerup", aoSoltar, true);
    return () => {
      window.removeEventListener("pointerdown", aoApertar, true);
      window.removeEventListener("pointermove", aoMover, true);
      window.removeEventListener("pointerup", aoSoltar, true);
      marcar(null);
    };
  }, [pegarPuck]);

  return null;
}
