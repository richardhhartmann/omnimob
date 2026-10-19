import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createUsePuck } from "@puckeditor/core";
import { comProps } from "./agrupar.js";

/* ────────────────────────────────────────────────────────────────────────────
   O NOME PRÓPRIO DE CADA SEÇÃO.

   Com três seções em colunas, a Estrutura listava "Seção (colunas)" três vezes
   — e para achar a dos depoimentos a pessoa tinha de clicar em cada uma. A
   seção ganha um campo `nome` (inspetor), e o nome aparece onde a pessoa
   procura: na linha dela na ESTRUTURA e no TÍTULO do inspetor quando ela está
   selecionada.

   ── POR QUE ESTE DESVIO ──

   O Puck 0.23 não tem rótulo por item: a Estrutura e o título do inspetor
   leem sempre o `label` do TIPO (`config.components[tipo].label`), e nenhuma
   sobrescrita alcança esses dois textos — `overrides.outline` recebe a árvore
   já montada, e o título fica fora de `overrides.fields`.

   Então o nome é aplicado por cima, e por CSS: o elemento ganha `data-nome` e
   a classe `puck-nome-proprio`, que esconde o texto do Puck e desenha o nome
   no `::after` (styles.css). O texto do React NÃO é trocado — e isso não é
   detalhe: trocar o nó de texto que o React gerencia faria a próxima
   atualização dele cair num nó solto, e o título ficaria preso no valor
   antigo. Atributo e classe o React não toca.

   O Puck redesenha esses nós a cada seleção e a cada arrasto, por isso um
   `MutationObserver` reaplica — em um quadro, para não rodar a cada nó.

   ── RENOMEIA-SE ONDE SE LÊ ──

   O nome era um campo do inspetor, entre os de aparência — longe da linha da
   Estrutura, que é onde a pessoa o procura. Agora é o DUPLO CLIQUE no nome da
   seção, na própria Estrutura: uma caixa de texto abre por cima dele (portal,
   posição medida), Enter ou clicar fora grava, Esc desiste, e apagar o texto
   devolve a seção a "Seção (colunas)". O duplo clique e não o clique simples
   porque o simples já é do Puck: seleciona a peça e rola a prancheta até ela.
   ──────────────────────────────────────────────────────────────────────────── */

const usarPuck = createUsePuck();

/** Os ids de toda Secao, com nome ou sem, inclusive as aninhadas. */
export function idsDasSecoes(itens, saida = new Set()) {
  for (const item of itens || []) {
    if (!item?.props) continue;
    if (item.type === "Secao") saida.add(item.props.id);
    for (const valor of Object.values(item.props)) {
      if (Array.isArray(valor) && valor.some((v) => v && v.type && v.props)) idsDasSecoes(valor, saida);
    }
  }
  return saida;
}

/** id → nome, de toda Secao com nome, inclusive as aninhadas em slots. */
export function nomesDasSecoes(itens, saida = new Map()) {
  for (const item of itens || []) {
    if (!item?.props) continue;
    if (item.type === "Secao" && typeof item.props.nome === "string" && item.props.nome.trim()) {
      saida.set(item.props.id, item.props.nome.trim());
    }
    for (const valor of Object.values(item.props)) {
      if (Array.isArray(valor) && valor.some((v) => v && v.type && v.props)) nomesDasSecoes(valor, saida);
    }
  }
  return saida;
}

const DICA_DE_RENOMEAR = "Clique duas vezes para renomear";

function nomear(el, nome, renomeavel = false) {
  if (!el) return;
  const dica = renomeavel ? `${nome ? `${nome} — ` : ""}${DICA_DE_RENOMEAR}` : nome;
  if (dica) {
    if (el.getAttribute("title") !== dica) el.setAttribute("title", dica);
  } else if (el.hasAttribute("title")) {
    el.removeAttribute("title");
  }
  if (nome) {
    if (el.getAttribute("data-nome") === nome) return;
    /* O tamanho da letra é medido ANTES de esconder o texto do Puck: o
       `::after` herda dele, e a classe zera o do elemento. */
    if (!el.classList.contains("puck-nome-proprio")) {
      el.style.setProperty("--nome-tamanho", getComputedStyle(el).fontSize);
    }
    el.setAttribute("data-nome", nome);
    el.classList.add("puck-nome-proprio");
  } else if (el.classList.contains("puck-nome-proprio")) {
    el.removeAttribute("data-nome");
    el.classList.remove("puck-nome-proprio");
    el.style.removeProperty("--nome-tamanho");
  }
}

/* O elemento do nome na linha da Estrutura — o da PRÓPRIA linha: a seção
   contém outras linhas, e o primeiro "nome" lá dentro pode ser o de um filho. */
const nomeDaLinha = (linha) =>
  [...linha.querySelectorAll("[class*='Layer-name']")].find((el) => el.closest("[data-puck-layer-tree-id]") === linha);

/* Onde desenhar a caixa: em cima do nome, um pouco maior que ele. */
function caixaSobre(id) {
  const linha = document.querySelector(`[data-puck-layer-tree-id="${CSS.escape(id)}"]`);
  const alvo = linha && nomeDaLinha(linha);
  if (!alvo) return null;
  const r = alvo.getBoundingClientRect();
  return { left: r.left - 7, top: r.top - 3, width: r.width + 14, height: r.height + 6 };
}

/* A caixa de renomear. Grava uma vez só: Enter e o `blur` que vem logo depois
   chegariam os dois aqui.

   Ela ACOMPANHA a linha em vez de fechar quando algo rola: o clique que
   seleciona a seção faz o Puck rolar a Estrutura e a prancheta até ela, e a
   primeira versão (fechar ao rolar) fechava a caixa no instante em que abria. */
function CaixaDeRenomear({ edicao, aoTerminar }) {
  const [texto, setTexto] = useState(edicao.nome);
  const [caixa, setCaixa] = useState(edicao.caixa);
  useEffect(() => {
    let quadro = 0;
    const seguir = () => {
      if (quadro) return;
      quadro = requestAnimationFrame(() => { quadro = 0; const nova = caixaSobre(edicao.id); if (nova) setCaixa(nova); });
    };
    window.addEventListener("scroll", seguir, true);
    window.addEventListener("resize", seguir);
    return () => {
      window.removeEventListener("scroll", seguir, true);
      window.removeEventListener("resize", seguir);
      if (quadro) cancelAnimationFrame(quadro);
    };
  }, [edicao.id]);
  const { left, top, width, height } = caixa;
  const encerrada = useRef(false);
  const encerrar = (gravar) => {
    if (encerrada.current) return;
    encerrada.current = true;
    aoTerminar(gravar ? texto.trim() : null);
  };
  return createPortal(
    <input
      className="puck-renomear"
      aria-label="Nome da seção"
      placeholder="Seção (colunas)"
      style={{ left, top, width: Math.max(width, 140), height: Math.max(height, 24) }}
      value={texto}
      autoFocus
      onFocus={(e) => e.target.select()}
      onChange={(e) => setTexto(e.target.value)}
      /* As teclas ficam aqui: os atalhos do editor (desfazer, apagar a peça
         selecionada) não podem disparar enquanto se digita um nome. */
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") encerrar(true);
        if (e.key === "Escape") { e.preventDefault(); encerrar(false); }
      }}
      onBlur={() => encerrar(true)}
    />,
    document.body,
  );
}

export function NomesDasSecoes() {
  const conteudo = usarPuck((s) => s.appState.data.content);
  const selecionado = usarPuck((s) => s.selectedItem);
  const rotuloDaSecao = usarPuck((s) => s.config.components?.Secao?.label);
  const despachar = usarPuck((s) => s.dispatch);
  const nomes = useMemo(() => nomesDasSecoes(conteudo), [conteudo]);
  const secoes = useMemo(() => idsDasSecoes(conteudo), [conteudo]);
  /* A seção sendo renomeada: id, nome atual e onde desenhar a caixa. */
  const [edicao, setEdicao] = useState(null);

  useEffect(() => {
    const aoDuploClique = (e) => {
      const linha = e.target.closest?.("[data-puck-layer-tree-id]");
      const id = linha?.getAttribute("data-puck-layer-tree-id");
      if (!id || !secoes.has(id)) return;
      /* Só o duplo clique no título da PRÓPRIA linha; o de uma linha filha é
         dela (e o `closest` acima já teria achado a filha). */
      const alvo = nomeDaLinha(linha);
      if (!alvo) return;
      e.preventDefault();
      setEdicao({ id, nome: nomes.get(id) || "", caixa: caixaSobre(id) });
    };
    document.addEventListener("dblclick", aoDuploClique);
    return () => document.removeEventListener("dblclick", aoDuploClique);
  }, [secoes, nomes]);

  const terminar = (nome) => {
    const id = edicao?.id;
    setEdicao(null);
    if (nome === null || !id || nome === (nomes.get(id) || "")) return;
    despachar({
      type: "setData",
      data: (anterior) => ({ ...anterior, content: comProps(anterior.content, id, { nome }) }),
    });
  };

  useEffect(() => {
    const doc = document;
    const nomeSelecionado = selecionado?.type === "Secao" ? nomes.get(selecionado.props?.id) : null;

    const aplicar = () => {
      /* A Estrutura: cada linha tem o id da peça (`data-puck-layer-tree-id`).
         O nome é o da PRÓPRIA linha — a seção contém outras linhas, e o
         primeiro "nome" lá dentro pode ser o de um filho. */
      for (const linha of doc.querySelectorAll("[data-puck-layer-tree-id]")) {
        const id = linha.getAttribute("data-puck-layer-tree-id");
        nomear(nomeDaLinha(linha), nomes.get(id) || null, secoes.has(id));
      }
      /* O título do inspetor: o cabeçalho que mostra o rótulo do TIPO. */
      for (const titulo of doc.querySelectorAll("[class*='SidebarSection-heading'] h2")) {
        const ehDaSecao = titulo.getAttribute("data-nome") !== null || titulo.textContent.trim() === rotuloDaSecao;
        nomear(titulo, ehDaSecao ? nomeSelecionado : null);
      }
    };

    let quadro = 0;
    const agendar = () => {
      if (quadro) return;
      quadro = requestAnimationFrame(() => { quadro = 0; aplicar(); });
    };
    aplicar();
    const observador = new MutationObserver(agendar);
    observador.observe(doc.body, { childList: true, subtree: true, characterData: true });
    return () => {
      observador.disconnect();
      if (quadro) cancelAnimationFrame(quadro);
    };
  }, [nomes, secoes, selecionado, rotuloDaSecao]);

  return edicao ? <CaixaDeRenomear key={edicao.id} edicao={edicao} aoTerminar={terminar} /> : null;
}
