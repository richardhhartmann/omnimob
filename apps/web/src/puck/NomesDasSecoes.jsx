import { useEffect, useMemo } from "react";
import { createUsePuck } from "@puckeditor/core";

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
   ──────────────────────────────────────────────────────────────────────────── */

const usarPuck = createUsePuck();

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

function nomear(el, nome) {
  if (!el) return;
  if (nome) {
    if (el.getAttribute("data-nome") === nome) return;
    /* O tamanho da letra é medido ANTES de esconder o texto do Puck: o
       `::after` herda dele, e a classe zera o do elemento. */
    if (!el.classList.contains("puck-nome-proprio")) {
      el.style.setProperty("--nome-tamanho", getComputedStyle(el).fontSize);
    }
    el.setAttribute("data-nome", nome);
    el.setAttribute("title", nome);
    el.classList.add("puck-nome-proprio");
  } else if (el.classList.contains("puck-nome-proprio")) {
    el.removeAttribute("data-nome");
    el.removeAttribute("title");
    el.classList.remove("puck-nome-proprio");
    el.style.removeProperty("--nome-tamanho");
  }
}

export function NomesDasSecoes() {
  const conteudo = usarPuck((s) => s.appState.data.content);
  const selecionado = usarPuck((s) => s.selectedItem);
  const rotuloDaSecao = usarPuck((s) => s.config.components?.Secao?.label);
  const nomes = useMemo(() => nomesDasSecoes(conteudo), [conteudo]);

  useEffect(() => {
    const doc = document;
    const nomeSelecionado = selecionado?.type === "Secao" ? nomes.get(selecionado.props?.id) : null;

    const aplicar = () => {
      /* A Estrutura: cada linha tem o id da peça (`data-puck-layer-tree-id`).
         O nome é o da PRÓPRIA linha — a seção contém outras linhas, e o
         primeiro "nome" lá dentro pode ser o de um filho. */
      for (const linha of doc.querySelectorAll("[data-puck-layer-tree-id]")) {
        const id = linha.getAttribute("data-puck-layer-tree-id");
        const alvo = [...linha.querySelectorAll("[class*='Layer-name']")].find((el) => el.closest("[data-puck-layer-tree-id]") === linha);
        nomear(alvo, nomes.get(id) || null);
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
  }, [nomes, selecionado, rotuloDaSecao]);

  return null;
}
