import { useEffect } from "react";
import { useGetPuck } from "@puckeditor/core";
import { acharPeca, agruparCom, levarParaOFim, motivoParaNaoAgrupar } from "./agrupar.js";
import { limparIntencao } from "./intencaoDeAgrupar.js";

/* ────────────────────────────────────────────────────────────────────────────
   OS DOIS DESTINOS QUE A ESTRUTURA DO PUCK NÃO TEM.

   A lista do Puck sabe uma coisa: pôr a linha ANTES ou DEPOIS de outra. Este
   vigia acrescenta, durante o mesmo arrasto, os dois gestos que faltavam — e
   deixa os de fábrica onde estão.

   ── 1. EM CIMA DE OUTRA LINHA: VIRA SEÇÃO ──

   Até aqui, montar colunas era só no canvas, soltando uma peça na lateral de
   outra. Na Estrutura, a linha arrastada sobre o MEIO de outra linha passa a
   significar "junto desta": a linha-alvo acende (pulsando) com o selo do que
   vai acontecer — "Criar seção", "Entrar na seção" ou "Pôr ao lado" — e ao
   soltar as duas viram colunas. A regra é a MESMA do canvas (`agruparCom`, e
   `motivoParaNaoAgrupar` para a recusa, que aparece no selo): duas portas, um
   resultado só.

   Só o MEIO, e não a linha inteira, porque as bordas continuam sendo do Puck:
   perto da borda de cima ou de baixo é "antes"/"depois", como sempre. É isso
   que deixa as duas coisas no mesmo gesto — levar para cima ou para baixo, ou
   juntar — sem um modo para alternar.

   ── 2. ABAIXO DE TUDO: FIM DA PÁGINA ──

   Rodapé em cima, seção aberta embaixo, e as duas são as últimas da página.
   Arrastar o rodapé para baixo da seção só oferecia UM destino: dentro dela,
   depois da última peça. Medido, ponto a ponto: com o ponteiro abaixo da
   última linha, o Puck propõe sempre "depois da última peça da seção". A linha
   de baixo de tudo é a da última peça da seção, então tudo que fica abaixo
   dela é "dentro".

   Com uma linha de dentro de seção sendo a última da lista, o espaço ABAIXO
   dela passa a significar "no fim da página": a linha de soltura do Puck some
   e a nossa aparece rente à lista inteira, sem recuo.

   ── COMO OS DOIS TERMINAM ──

   Ao soltar num destino nosso, o arrasto do Puck é CANCELADO (Esc, que o
   dnd-kit já entende) e a árvore muda num despacho só — uma entrada só no
   desfazer. Sem `dispatch` não há como mover, e ele só existe dentro do
   provedor do Puck — por isso mora em `overrides.puck`, como `NomesDasSecoes`.
   Não desenha nada: o destaque e as linhas são CSS (styles.css), pendurados em
   classes e atributos que este vigia põe e tira.
   ──────────────────────────────────────────────────────────────────────────── */

const CLASSE_NO_FIM = "puck-estrutura--no-fim";
/* Na lista inteira, enquanto há uma linha-alvo: esconde a linha de soltura do
   Puck, que diria "antes/depois" ao mesmo tempo que o selo diz "seção". */
const CLASSE_AGRUPANDO = "puck-estrutura--agrupando";
const CLASSE_ALVO = "puck-estrutura__alvo";

/* Quanto da altura da linha, de cada borda, continua sendo "antes/depois".
   A linha tem ~28px: sobram uns 13px no meio para "juntar", que é alvo de
   sobra para a mão, e as bordas ficam com o suficiente para reordenar. */
const BORDA_DE_REORDENAR = 0.27;

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

/**
 * O ponteiro está no MEIO da linha (juntar), e não perto das bordas (que
 * continuam sendo "antes/depois" do Puck)?
 *
 * @param {{x:number,y:number}} ponteiro
 * @param {{topo:number, base:number, esquerda:number, direita:number}} linha
 */
export function noMeioDaLinha(ponteiro, linha) {
  if (ponteiro.x < linha.esquerda || ponteiro.x > linha.direita) return false;
  const borda = (linha.base - linha.topo) * BORDA_DE_REORDENAR;
  return ponteiro.y > linha.topo + borda && ponteiro.y < linha.base - borda;
}

/**
 * O que o selo da linha-alvo diz. A recusa vence; senão, o que `agruparCom`
 * vai fazer com aquele alvo.
 */
export function rotuloDeAgrupar(conteudo, id, alvoId) {
  const motivo = motivoParaNaoAgrupar(conteudo, id, alvoId);
  if (motivo) return { motivo, texto: motivo };
  if (acharPeca(conteudo, alvoId)?.type === "Secao") return { motivo: null, texto: "Entrar na seção" };
  const dentroDeSecao = (lista, dentro = false) => {
    for (const item of lista || []) {
      if (item?.props?.id === alvoId) return dentro;
      if (Array.isArray(item?.props?.conteudo)) {
        const achado = dentroDeSecao(item.props.conteudo, item.type === "Secao");
        if (achado !== null) return achado;
      }
    }
    return null;
  };
  return { motivo: null, texto: dentroDeSecao(conteudo) ? "Pôr ao lado" : "Criar seção" };
}

const linhaDe = (el) => el?.closest?.("[data-puck-layer-tree-id]") || null;
const miolo = (li) => [...li.children].find((el) => /Layer-inner/.test(el.className));
const idDe = (li) => li?.getAttribute("data-puck-layer-tree-id") || null;

/* O Puck marca o quadro da prévia enquanto a Estrutura arrasta (`setPreviewFence`).
   É o sinal de que o gesto é o da lista, e não o da prancheta. */
const arrastandoNaEstrutura = () =>
  document.getElementById("preview-frame")?.hasAttribute("data-puck-outline-dragging");

function medir(arrastadoId) {
  const linhas = [...document.querySelectorAll("[data-puck-layer-tree-id]")];
  const raiz = linhas.find((li) => !li.parentElement.closest("[data-puck-layer-tree-id]"))?.parentElement;
  if (!raiz) return {};
  const arrastadaLi = linhas.find((li) => idDe(li) === arrastadoId) || null;
  let ultima = null;
  const caixas = [];
  for (const li of linhas) {
    const el = miolo(li);
    const r = el?.getBoundingClientRect();
    if (!r || r.height <= 0) continue;
    ultima = { li, base: r.bottom };
    /* A própria linha e as de dentro dela não são alvo: juntar uma seção com
       uma peça que já mora nela não é um gesto. */
    if (arrastadaLi && arrastadaLi.contains(li)) continue;
    caixas.push({ li, el, linha: { topo: r.top, base: r.bottom, esquerda: r.left, direita: r.right } });
  }
  const caixa = raiz.getBoundingClientRect();
  return {
    raiz,
    caixas,
    lista: { esquerda: caixa.left, direita: caixa.right },
    ultima: ultima && { base: ultima.base, aninhada: Boolean(ultima.li.parentElement.closest("[data-puck-layer-tree-id]")) },
  };
}

export function ArrastoNaEstrutura() {
  const pegarPuck = useGetPuck();

  useEffect(() => {
    let arrastado = null;
    /* O destino do momento: `{ modo: "fim", raiz }`, `{ modo: "agrupar",
       raiz, el, alvoId, motivo }` ou nulo. É a única coisa que a soltura lê. */
    let destino = null;

    const marcar = (novo) => {
      const igual = destino?.modo === novo?.modo && destino?.el === novo?.el && destino?.raiz === novo?.raiz
        && destino?.texto === novo?.texto;
      if (igual) return;
      if (destino?.raiz) destino.raiz.classList.remove(CLASSE_NO_FIM, CLASSE_AGRUPANDO);
      if (destino?.el) {
        destino.el.classList.remove(CLASSE_ALVO, "is-recusa");
        destino.el.removeAttribute("data-agrupar");
      }
      if (novo?.modo === "fim") novo.raiz.classList.add(CLASSE_NO_FIM);
      if (novo?.modo === "agrupar") {
        novo.raiz.classList.add(CLASSE_AGRUPANDO);
        novo.el.classList.add(CLASSE_ALVO);
        novo.el.classList.toggle("is-recusa", Boolean(novo.motivo));
        novo.el.setAttribute("data-agrupar", novo.texto);
      }
      destino = novo;
    };

    const aoApertar = (e) => {
      const li = linhaDe(e.target);
      arrastado = li && miolo(li)?.contains(e.target) ? idDe(li) : null;
    };

    const aoMover = (e) => {
      if (!arrastado || !arrastandoNaEstrutura()) { marcar(null); return; }
      const ponteiro = { x: e.clientX, y: e.clientY };
      const { raiz, caixas, lista, ultima } = medir(arrastado);
      if (!raiz) { marcar(null); return; }

      const sob = caixas.find((c) => noMeioDaLinha(ponteiro, c.linha));
      if (sob) {
        const alvoId = idDe(sob.li);
        const { motivo, texto } = rotuloDeAgrupar(pegarPuck().appState.data.content, arrastado, alvoId);
        marcar({ modo: "agrupar", raiz, el: sob.el, alvoId, motivo, texto });
        return;
      }
      marcar(soltarNoFim(ponteiro, ultima, lista) ? { modo: "fim", raiz } : null);
    };

    /* Cancela a soltura do Puck ANTES de ela acontecer: este ouvinte é de
       captura na JANELA, e o do dnd-kit é de captura no documento — o nosso
       roda primeiro. Sem isso a peça cairia no "antes/depois" do Puck e depois
       mudaria de novo — dois passos no desfazer para um gesto só.

       `cancelable`: o dnd-kit chama `preventDefault` no Esc, e é isso que
       impede o "Esc sai da tela" do painel (`useSaidaDaTela`) de levar a
       pessoa para fora do editor. Sem ele, o evento sintético saía. */
    const cancelarSolturaDoPuck = () =>
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));

    const aplicar = (id, transformar) => {
      setTimeout(() => {
        pegarPuck().dispatch({
          type: "setData",
          data: (anterior) => {
            const novo = transformar(anterior.content);
            return novo ? { ...anterior, content: novo } : anterior;
          },
        });
        /* A peça continua selecionada no lugar novo. Pelo id, e não pelo
           índice: a seção que ela deixou pode ser podada (`PodarSecoesVazias`)
           ou dissolvida, e o índice muda. */
        setTimeout(() => {
          const { getSelectorForId, dispatch } = pegarPuck();
          const seletor = getSelectorForId(id);
          if (seletor) dispatch({ type: "setUi", ui: { itemSelector: seletor } });
        }, 0);
      }, 0);
    };

    const aoSoltar = () => {
      const id = arrastado;
      const fim = destino;
      arrastado = null;
      marcar(null);
      if (!id || !fim) return;

      cancelarSolturaDoPuck();
      /* A ponte do canvas também escuta este gesto (ela reconhece arrasto
         vindo da Estrutura) e pode ter anotado uma intenção de colunas se o
         ponteiro passou pela prancheta. Quem decide esta soltura é a lista. */
      limparIntencao();

      if (fim.modo === "fim") { aplicar(id, (conteudo) => levarParaOFim(conteudo, id)); return; }
      /* Recusada (seção cheia): soltar não faz nada — o selo já disse por quê.
         Deixar o Puck reordenar aqui seria fazer uma coisa que ninguém pediu. */
      if (fim.motivo) return;
      aplicar(id, (conteudo) => agruparCom(conteudo, id, fim.alvoId, "direita"));
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
