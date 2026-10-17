import { normalizeShowcaseConfig } from "../utils/showcaseConfig";
import { toPieces } from "../components/showcase/engine/pieces";
import { WIDGET_LIBRARY } from "../components/builder/data/biblioteca.jsx";

/* Os tipos de widget que a biblioteca conhece. Um widget traduzido vira o
   componente PRÓPRIO dele (`Widget_stats`), e não o genérico: é isso que lhe dá
   nome na estrutura da página ("Números", e não "Peça da vitrine") e os campos
   do inspetor. Enquanto a tradução usava o genérico, a página migrada nascia
   com catorze peças anônimas e sem opção nenhuma — enquanto a mesma peça
   arrastada da gaveta vinha completa. Duas origens, dois resultados. */
const TIPOS_CONHECIDOS = new Set(WIDGET_LIBRARY.map((m) => m.type));

/* ────────────────────────────────────────────────────────────────────────────
   FASE 2 — traduzir o `showcaseConfig` para o documento do Puck.

   É aqui que o custo real da migração aparece, porque os dois formatos não
   falam a mesma língua:

     hoje    peças em COORDENADAS — `x`/`w` em % da folha, `y`/`h` em pixels —
             podendo se sobrepor, com dois conjuntos independentes (desktop e
             mobile) e uma engine que resolve colisão.
     Puck    uma ÁRVORE ordenada. Não existe posição: existe ordem, e
             aninhamento por `slot`.

   Traduzir é, então, descobrir a INTENÇÃO por trás das coordenadas. E isso não
   é sempre possível — daí esta função devolver, junto com o documento, uma
   lista do que ela não soube converter.

   ── AS TRÊS REGRAS ──

   1. A ORDEM DE LEITURA MANDA. Ordena por `y` e, no empate, por `x`: é a ordem
      em que a página é lida de cima para baixo, da esquerda para a direita.

   2. QUEM ESTÁ LADO A LADO VIRA COLUNA. Duas peças que se cruzam na vertical e
      não se cruzam na horizontal estavam, na prática, numa fileira. Empilhá-las
      seria perder a intenção de quem montou. Elas entram num `Secao` com o
      número de colunas igual ao número de peças da fileira.

      A tolerância existe porque coordenada feita à mão nunca é exata: dois
      cartões "na mesma linha" costumam ter alguns pixels de diferença no `y`.

   3. O MOBILE É DESCARTADO, e isso é decisão tomada. O Puck tem UM documento —
      viewport nele é largura de prévia, não dado por breakpoint. O layout
      desktop é o que sobrevive; o mobile passa a ser consequência do CSS.

   ── O QUE ELA NÃO FAZ ──

   Não grava nada. Traduzir é uma função pura sobre o documento; quem decide
   escrever é quem chama, e na fase 2 ninguém escreve.
   ──────────────────────────────────────────────────────────────────────────── */

/* Quanto dois `y` podem diferir e ainda contarem como "a mesma fileira".
   Um cartão de 200px de altura com 24px de diferença no topo continua sendo
   fileira; com 120px, já é outra seção. */
const TOLERANCIA_FILEIRA = 40;

/* Os cinco blocos fixos viram componentes de nome próprio. O mapa existe para o
   tradutor não precisar saber o que cada um desenha — e para a lista de tipos
   ser um lugar só, conferível. */
const COMPONENTE_DO_BLOCO = {
  header: "BlocoCabecalho",
  title: "BlocoTitulo",
  highlights: "BlocoDestaques",
  properties: "BlocoImoveis",
  footer: "BlocoRodape",
};

/** Duas peças ocupam faixas verticais que se cruzam? */
function cruzamNaVertical(a, b) {
  return a.y < b.y + b.h && b.y < a.y + a.h;
}

/** E ficam lado a lado, sem invadir a coluna uma da outra? */
function ladoALado(a, b) {
  return a.x + a.w <= b.x + 0.5 || b.x + b.w <= a.x + 0.5;
}

/**
 * Agrupa as peças em FILEIRAS na ordem de leitura.
 *
 * Uma fileira é um conjunto de peças que começam em alturas próximas e não se
 * sobrepõem horizontalmente. Peça que não couber em nenhuma fileira aberta
 * começa a sua.
 */
export function agruparEmFileiras(pecas) {
  const ordenadas = [...pecas].sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const fileiras = [];

  for (const peca of ordenadas) {
    const atual = fileiras[fileiras.length - 1];
    const cabe = atual
      && Math.abs(atual[0].y - peca.y) <= TOLERANCIA_FILEIRA
      && atual.every((outra) => cruzamNaVertical(outra, peca) && ladoALado(outra, peca));

    if (cabe) atual.push(peca);
    else fileiras.push([peca]);
  }

  // Dentro da fileira, a ordem é a horizontal — é como ela será lida.
  return fileiras.map((f) => [...f].sort((a, b) => a.x - b.x));
}

let contador = 0;
function novoId(tipo) {
  contador += 1;
  return `${tipo}-${contador}`;
}

/* Uma peça vira um item do Puck. Widget carrega o objeto inteiro: o
   renderizador do lado do Puck é o `ShowcaseWidget` de sempre, então nada do
   conteúdo precisa ser reinterpretado aqui — e essa é justamente a parte que
   não queremos reescrever. */
function itemDaPeca(peca, config) {
  if (peca.kind === "block") {
    const tipo = COMPONENTE_DO_BLOCO[peca.key];
    if (!tipo) return null;

    /* O estilo do bloco viaja INTEIRO em `estilo`, e as duas cores saem dele
       para campos próprios.

       A duplicação é deliberada: o que a pessoa edita precisa ser campo do
       Puck, e o que ainda não tem controle precisa sobreviver. Quem monta o
       estilo final espalha `estilo` primeiro e os campos depois — os editáveis
       vencem, e nada do resto é descartado no caminho.

       Cinco campos hoje: as duas cores e os três do banner. O objeto inteiro
       continua viajando porque a lista pode crescer no `blockStyles` sem que
       este arquivo saiba. */
    const estilo = config.blockStyles?.[peca.key] || {};
    const props = {
      id: novoId(tipo),
      estilo,
      backgroundColor: estilo.backgroundColor || "",
      color: estilo.color || "",
      backgroundImage: estilo.backgroundImage || "",
      backgroundOverlay: typeof estilo.backgroundOverlay === "number" ? estilo.backgroundOverlay : 0,
      backgroundBrightness: typeof estilo.backgroundBrightness === "number" ? estilo.backgroundBrightness : 1,
    };

    /* Destaques leva o próprio conteúdo junto: ele é o único bloco fixo que
       desenha só com o que está no config, sem depender do acervo. */
    if (peca.key === "highlights") {
      props.highlights = config.highlights;
      props.highlightStyles = config.highlightStyles;
    }
    if (peca.key === "footer") props.footerTitle = config.footerTitle;

    return { type: tipo, props };
  }
  const widget = (config.widgets || []).find((w) => w.id === peca.key);
  if (!widget) return null;

  /* Tipo desconhecido cai no genérico em vez de sumir. Acontece com widget
     gravado por uma versão que tinha um tipo que hoje não existe mais — o
     "Divisor" aposentado é o precedente. Sem peça no documento, a pessoa
     abriria o editor e veria um vão sem explicação. */
  const tipo = TIPOS_CONHECIDOS.has(widget.type) ? `Widget_${widget.type}` : "Widget";
  return {
    type: tipo,
    props: {
      id: novoId("widget"),
      widget,
      /* As cores e o banner saem para campos do inspetor, como nos blocos. */
      backgroundColor: widget.backgroundColor || "",
      color: widget.color || "",
      backgroundImage: widget.backgroundImage || "",
      backgroundOverlay: typeof widget.backgroundOverlay === "number" ? widget.backgroundOverlay : 0,
      backgroundBrightness: typeof widget.backgroundBrightness === "number" ? widget.backgroundBrightness : 1,
    },
  };
}

/**
 * @param {object} showcaseConfig  o documento gravado no tenant
 * @returns {{ data: object, avisos: string[] }}
 *   `data` no formato do Puck; `avisos` é o que a tradução perdeu ou adivinhou —
 *   e existe para a migração ser conferível em vez de silenciosa.
 */
export function traduzirParaPuck(showcaseConfig) {
  contador = 0;
  const config = normalizeShowcaseConfig(showcaseConfig);
  const avisos = [];

  /* Só o desktop. `toPieces` já devolve as peças com o layout do modo pedido, e
     é a mesma função que a engine usa — ler as coordenadas por conta própria
     aqui seria uma segunda interpretação do mesmo formato.

     `includeHidden` para poder CONTAR o que ficou de fora: sem ele a função
     entrega só as visíveis e o aviso de "peças ocultas" nunca dispararia — ele
     existiria como consolo, dizendo sempre zero. */
  const todas = toPieces(config, "desktop", { includeHidden: true });
  const visiveis = todas.filter((p) => !p.hidden);

  if (todas.length !== visiveis.length) {
    avisos.push(`${todas.length - visiveis.length} peça(s) oculta(s) não foram trazidas.`);
  }
  if (config.mobileLayout) {
    avisos.push("O layout mobile foi descartado: o Puck tem um documento só, e a responsividade passa a ser do CSS.");
  }

  const content = [];
  for (const fileira of agruparEmFileiras(visiveis)) {
    const itens = fileira.map((p) => itemDaPeca(p, config)).filter(Boolean);
    if (!itens.length) continue;

    if (itens.length === 1) {
      content.push(itens[0]);
      continue;
    }
    /* Fileira de duas ou mais: vira uma seção com colunas, preservando a
       intenção de quem pôs as peças lado a lado. */
    content.push({
      type: "Secao",
      props: { id: novoId("secao"), colunas: Math.min(4, itens.length), conteudo: itens },
    });
    if (itens.length > 4) {
      avisos.push(`Uma fileira tinha ${itens.length} peças e virou uma seção de 4 colunas.`);
    }
  }

  if (!content.length) avisos.push("Nada foi convertido: a vitrine não tem peças visíveis.");

  /* A raiz carrega as opções da PÁGINA. Elas não são peças, mas são editadas no
     mesmo lugar (o inspetor sem seleção) e precisam viajar com o documento —
     senão abrir o editor de uma vitrine clara a mostraria escura. */
  const root = {
    props: {
      appearanceMode: config.appearanceMode,
      // Ausente no config = ligado. É o padrão do produto, e vale para toda página antiga.
      zebrado: config.zebrado === false ? "nao" : "sim",
      // Mesma regra: só `false` solta o cabeçalho; o motor antigo sempre o fixava.
      cabecalhoFixo: config.cabecalhoFixo === false ? "nao" : "sim",
      larguraDaPagina: config.larguraLivre === true ? "livre" : "travada",
      larguraDasPecas: Number(config.larguraDasPecas) || 100,
      espacoInterno: Number(config.espacamento?.interno) || 0,
      espacoExterno: Number(config.espacamento?.externo) || 0,
      globalFont: config.globalFont,
      corPrimaria: config.corPrimaria || "",
      corSecundaria: config.corSecundaria || "",
    },
  };

  return { data: { content, root }, avisos };
}
