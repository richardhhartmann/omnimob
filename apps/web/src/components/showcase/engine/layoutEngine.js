import { DEFAULT_LAYOUT } from "../../../utils/showcaseConfig.js";
import {
  BLOCK_KEYS,
  applyPieces,
  blockPieceId,
  layoutKeyOf,
  parsePieceId,
  pieceRect,
  toPieces,
} from "./pieces.js";
import { limitarResize, resolverColisoes } from "./collision.js";
import { encaixarX, encaixarY } from "./snapping.js";

/* ────────────────────────────────────────────────────────────────────────────
   A engine de layout da Omnimob.

   Tudo aqui recebe um `showcaseConfig` normalizado e devolve outro — sem DOM,
   sem React, sem saber que existe ponteiro ou zoom. As entradas de gesto já
   chegam convertidas para as unidades do layout (% no X, px no Y).

   É a fronteira que faltava: antes, física, medição do DOM, estado do React e
   desenho estavam no mesmo arquivo de 2.600 linhas, e mexer em qualquer um
   deles significava reler os outros três.
   ──────────────────────────────────────────────────────────────────────────── */

/** Respiro vertical usado ao reempilhar por conteúdo. */
export const GAP_REEMPILHAMENTO = 56;

/**
 * Grade magnética horizontal.
 *
 * O layout continua livre em qualquer outro lugar. A grade só assume o gesto
 * quando um WIDGET atravessa a faixa vertical de uma linha de widgets. Nessa
 * faixa, 1..4 peças passam a ocupar slots semânticos de 100 / 50 / 33 / 25%.
 *
 * Isso é deliberadamente separado da colisão comum: a colisão responde
 * "ninguém pode atravessar ninguém"; a grade responde "estas peças agora formam
 * uma linha". Misturar as duas regras faria a cascata desfazer o encaixe.
 */
export const MAX_COLUNAS_MAGNETICAS = 4;
const TOLERANCIA_AGRUPAR_LINHA = 44;
const ALCANCE_IMA_VERTICAL = 36;

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function distanciaVerticalAteLinha(y, h, linha) {
  const top = y;
  const bottom = y + h;
  if (bottom < linha.top) return linha.top - bottom;
  if (top > linha.bottom) return top - linha.bottom;
  return 0;
}

function agruparLinhasDeWidgets(pecas) {
  const widgets = pecas
    .filter((p) => p.kind === "widget")
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const linhas = [];

  for (const peca of widgets) {
    let melhor = null;
    let melhorDistancia = Infinity;

    for (const linha of linhas) {
      const distanciaTopo = Math.abs(peca.y - linha.y);
      const sobreposicao = Math.max(
        0,
        Math.min(peca.y + peca.h, linha.bottom) - Math.max(peca.y, linha.top)
      );
      const baseSobreposicao = Math.max(1, Math.min(peca.h, linha.bottom - linha.top));
      const mesmaFaixa =
        distanciaTopo <= TOLERANCIA_AGRUPAR_LINHA ||
        sobreposicao / baseSobreposicao >= 0.55;

      if (!mesmaFaixa) continue;
      if (distanciaTopo < melhorDistancia) {
        melhor = linha;
        melhorDistancia = distanciaTopo;
      }
    }

    if (!melhor) {
      linhas.push({
        y: peca.y,
        top: peca.y,
        bottom: peca.y + peca.h,
        pecas: [peca],
      });
      continue;
    }

    melhor.pecas.push(peca);
    melhor.pecas.sort((a, b) => a.x - b.x);
    melhor.top = Math.min(melhor.top, peca.y);
    melhor.bottom = Math.max(melhor.bottom, peca.y + peca.h);
    melhor.y = Math.min(...melhor.pecas.map((p) => p.y));
  }

  return linhas;
}


/**
 * Pseudo-seções do builder.
 *
 * Elas NÃO existem no JSON salvo: são uma leitura das linhas de widgets que já
 * existem. Um widget sozinho forma 1/1; widgets que compartilham a mesma faixa
 * vertical formam a mesma pseudo-seção. Assim mover uma peça para outra linha
 * recompõe as seções automaticamente, sem estado duplicado para sincronizar.
 */
export function pseudoSecoesDeWidgets(cfg, mode) {
  const pecas = toPieces(cfg, mode);
  return agruparLinhasDeWidgets(pecas).map((linha) => {
    const membros = linha.pecas.slice().sort((a, b) => a.x - b.x);
    const pieceIds = membros.map((p) => p.id);
    return {
      id: `pseudo:${pieceIds.slice().sort().join("|")}`,
      pieceIds,
      y: linha.top,
      h: Math.max(1, linha.bottom - linha.top),
      colunas: membros.length,
      travada: membros.some((p) => p.locked),
    };
  });
}

function mesmosIds(a, b) {
  if (a.length !== b.length) return false;
  const conjunto = new Set(a);
  return b.every((id) => conjunto.has(id));
}

function secoesEstruturais(pecas) {
  const linhas = agruparLinhasDeWidgets(pecas);
  const secoes = [];

  for (const linha of linhas) {
    const membros = linha.pecas.slice().sort((a, b) => a.x - b.x);
    const ids = membros.map((p) => p.id);
    secoes.push({
      id: `widgets:${ids.slice().sort().join("|")}`,
      kind: "widgets",
      pieceIds: ids,
      y: linha.top,
      h: Math.max(1, linha.bottom - linha.top),
      locked: membros.some((p) => p.locked),
    });
  }

  for (const peca of pecas) {
    if (peca.kind !== "block") continue;
    secoes.push({
      id: `block:${peca.id}`,
      kind: "block",
      pieceIds: [peca.id],
      y: peca.y,
      h: peca.h,
      locked: peca.locked,
    });
  }

  secoes.sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));
  return secoes;
}

function gapDepoisDasSecoes(secoes) {
  const mapa = new Map();
  for (let i = 0; i < secoes.length; i += 1) {
    const atual = secoes[i];
    const proxima = secoes[i + 1];
    const bruto = proxima ? proxima.y - (atual.y + atual.h) : 24;
    // O gap acompanha a seção, mas não deixa uma anomalia antiga virar um vale
    // de 400px nem comprime o layout a ponto de colar duas faixas.
    mapa.set(atual.id, clamp(Number.isFinite(bruto) ? bruto : 24, 18, 160));
  }
  return mapa;
}

function deslocarSecao(pecasPorId, secao, novoY) {
  const delta = novoY - secao.y;
  if (Math.abs(delta) < 0.01) return;
  for (const id of secao.pieceIds) {
    const peca = pecasPorId.get(id);
    if (peca) peca.y += delta;
  }
  secao.y = novoY;
}

/**
 * Move uma pseudo-seção verticalmente.
 *
 * A linha inteira é tratada como uma unidade estrutural. Ao cruzar o centro da
 * faixa vizinha, ela troca de posição e as seções atravessadas ocupam o espaço
 * deixado — o comportamento de "empurrar a página" de Webflow, sem transformar
 * a pseudo-seção em uma entidade persistida.
 *
 * Blocos fixos participam da pilha como seções estruturais; portanto mover uma
 * linha de widgets também pode empurrar título, imóveis, rodapé e outras linhas.
 * Uma seção travada é barreira: se o rearranjo precisasse movê-la, o quadro é
 * recusado e o gesto para ali.
 */
export function moverPseudoSecaoWidgets(cfg, mode, pieceIds, destinoY) {
  const ids = Array.from(new Set(pieceIds || []));
  if (!ids.length) return { config: cfg, secao: null, bloqueada: true };

  const pecas = toPieces(cfg, mode);
  const porId = new Map(pecas.map((p) => [p.id, p]));
  const secoes = secoesEstruturais(pecas);
  const indiceOrigem = secoes.findIndex(
    (secao) => secao.kind === "widgets" && mesmosIds(secao.pieceIds, ids)
  );
  if (indiceOrigem < 0) return { config: cfg, secao: null, bloqueada: true };

  const selecionada = secoes[indiceOrigem];
  if (selecionada.locked) {
    return { config: cfg, secao: { ...selecionada }, bloqueada: true };
  }

  const gaps = gapDepoisDasSecoes(secoes);
  const yDesejado = Math.max(0, Number.isFinite(destinoY) ? destinoY : selecionada.y);
  const centroDesejado = yDesejado + selecionada.h / 2;
  const outras = secoes.filter((_, i) => i !== indiceOrigem);

  let indiceDestino = outras.findIndex((secao) => centroDesejado < secao.y + secao.h / 2);
  if (indiceDestino < 0) indiceDestino = outras.length;

  const ordem = outras.slice();
  ordem.splice(indiceDestino, 0, selecionada);
  const idsAntigos = secoes.map((s) => s.id);
  const idsNovos = ordem.map((s) => s.id);

  let inicio = idsAntigos.findIndex((id, i) => id !== idsNovos[i]);

  // Ainda não cruzou outra seção: a linha acompanha o ponteiro dentro do vão
  // disponível. Isso evita o aspecto de "handle preso" antes da primeira troca.
  if (inicio < 0) {
    const anterior = secoes[indiceOrigem - 1];
    const proxima = secoes[indiceOrigem + 1];
    const minimo = anterior
      ? anterior.y + anterior.h + (gaps.get(anterior.id) || 24)
      : 0;
    const maximo = proxima
      ? proxima.y - selecionada.h - (gaps.get(selecionada.id) || 24)
      : Infinity;
    const novoY = clamp(yDesejado, minimo, Math.max(minimo, maximo));
    deslocarSecao(porId, selecionada, novoY);
    return {
      config: applyPieces(cfg, mode, pecas),
      secao: { ...selecionada },
      bloqueada: false,
    };
  }

  let fim = idsAntigos.length - 1;
  while (fim > inicio && idsAntigos[fim] === idsNovos[fim]) fim -= 1;

  // A área afetada começa no slot antigo mais alto. Quando a pessoa leva a
  // seção para o topo absoluto, o próprio ponteiro pode abrir espaço acima dele.
  let cursor = Math.max(0, Math.min(secoes[inicio]?.y ?? 0, yDesejado));
  const novosYs = new Map();

  for (let i = inicio; i <= fim; i += 1) {
    const secao = ordem[i];
    novosYs.set(secao.id, cursor);
    cursor += secao.h + (gaps.get(secao.id) || 24);
  }

  // Se a seção movida for mais alta que a que ela substituiu, a diferença
  // continua empurrando as faixas de baixo até encontrar espaço livre.
  for (let i = fim + 1; i < ordem.length; i += 1) {
    const secao = ordem[i];
    if (secao.y >= cursor - 0.01) break;
    novosYs.set(secao.id, cursor);
    cursor += secao.h + (gaps.get(secao.id) || 24);
  }

  // Cadeado é uma barreira estrutural, não só uma peça que ignora o mouse.
  for (const secao of secoes) {
    const novoY = novosYs.get(secao.id);
    if (secao.locked && Number.isFinite(novoY) && Math.abs(novoY - secao.y) > 0.01) {
      return { config: cfg, secao: { ...selecionada }, bloqueada: true };
    }
  }

  for (const secao of ordem) {
    const novoY = novosYs.get(secao.id);
    if (Number.isFinite(novoY)) deslocarSecao(porId, secao, novoY);
  }

  return {
    config: applyPieces(cfg, mode, pecas),
    secao: { ...selecionada },
    bloqueada: false,
  };
}

function normalizarLinhaEmSlots(pecas, ids, { y = null, ordem = null } = {}) {
  const porId = new Map(pecas.map((p) => [p.id, p]));
  let membros = (ordem || ids)
    .map((id) => porId.get(id))
    .filter(Boolean);

  if (!membros.length || membros.length > MAX_COLUNAS_MAGNETICAS) return false;
  // Cadeado é literal: uma peça travada não pode encolher nem correr de slot.
  if (membros.some((p) => p.locked)) return false;

  if (!ordem) membros = membros.slice().sort((a, b) => a.x - b.x);

  const largura = 100 / membros.length;
  const linhaY = Number.isFinite(y) ? y : Math.min(...membros.map((p) => p.y));

  membros.forEach((peca, indice) => {
    peca.x = indice * largura;
    peca.y = linhaY;
    peca.w = largura;
  });

  return true;
}

function liberarLinhaDeOrigem(pecas, pieceId) {
  const linhas = agruparLinhasDeWidgets(pecas);
  const origem = linhas.find((linha) => linha.pecas.some((p) => p.id === pieceId));
  if (!origem) return null;

  const restantes = origem.pecas.filter((p) => p.id !== pieceId);
  if (!restantes.length) return origem;

  normalizarLinhaEmSlots(
    pecas,
    restantes.map((p) => p.id),
    { y: origem.y }
  );
  return origem;
}

function tentarGradeMagnetica(
  pecas,
  pieceId,
  destino,
  { cursorX = null, ignorarLinhaOrigem = false } = {}
) {
  const alvo = pecas.find((p) => p.id === pieceId);
  if (!alvo || alvo.kind !== "widget") return null;

  const linhasBase = agruparLinhasDeWidgets(pecas);
  const origem = ignorarLinhaOrigem
    ? null
    : linhasBase.find((linha) => linha.pecas.some((p) => p.id === pieceId)) || null;

  const outras = pecas.filter((p) => p.id !== pieceId);
  const linhas = agruparLinhasDeWidgets(outras);
  const candidatas = linhas
    .filter((linha) => linha.pecas.length < MAX_COLUNAS_MAGNETICAS)
    .filter((linha) => !linha.pecas.some((p) => p.locked))
    .map((linha) => ({
      linha,
      distancia: distanciaVerticalAteLinha(destino.y, alvo.h, linha),
    }))
    .filter(({ distancia }) => distancia <= ALCANCE_IMA_VERTICAL)
    .sort((a, b) => a.distancia - b.distancia);

  const alvoLinha = candidatas[0]?.linha || null;
  if (!alvoLinha) return null;

  const idsOrigem = new Set(origem?.pecas.map((p) => p.id) || []);
  const ehMesmaLinha =
    Boolean(origem) &&
    alvoLinha.pecas.length > 0 &&
    alvoLinha.pecas.every((p) => idsOrigem.has(p.id));

  // Se saiu de uma linha e entrou em outra, a linha antiga fecha o buraco
  // imediatamente: 2→1 vira 100%, 3→2 vira 50/50, 4→3 vira terços.
  if (origem && !ehMesmaLinha) {
    const restantes = origem.pecas.filter((p) => p.id !== pieceId);
    if (restantes.length) {
      normalizarLinhaEmSlots(
        pecas,
        restantes.map((p) => p.id),
        { y: origem.y }
      );
    }
  }

  const membros = alvoLinha.pecas
    .map((p) => pecas.find((atual) => atual.id === p.id))
    .filter(Boolean)
    .sort((a, b) => a.x - b.x);

  const xDoGesto = Number.isFinite(cursorX)
    ? clamp(cursorX, 0, 100)
    : clamp(destino.x + alvo.w / 2, 0, 100);

  let indice = membros.findIndex((p) => xDoGesto < p.x + p.w / 2);
  if (indice < 0) indice = membros.length;

  const ordem = membros.map((p) => p.id);
  ordem.splice(indice, 0, pieceId);

  const encaixou = normalizarLinhaEmSlots(
    pecas,
    ordem,
    { y: alvoLinha.y, ordem }
  );
  if (!encaixou) return null;

  const largura = 100 / ordem.length;
  return {
    pecas,
    encostadas: new Set(ordem),
    guias: {
      x: indice * largura,
      y: alvoLinha.y,
    },
    magnetico: true,
    grade: {
      colunas: ordem.length,
      indice,
      y: alvoLinha.y,
    },
  };
}

function moverPecaLivre(
  cfg,
  mode,
  pieceId,
  destino,
  { larguraCanvas = 1200, encaixar = true, pecasIniciais = null } = {}
) {
  const pecas = pecasIniciais || toPieces(cfg, mode);
  const alvo = pecas.find((p) => p.id === pieceId);
  if (!alvo) {
    return {
      config: cfg,
      encostadas: new Set(),
      guias: { x: null, y: null },
      magnetico: false,
      grade: null,
    };
  }

  const outras = pecas.filter((p) => p.id !== pieceId);
  let x = destino.x;
  let y = destino.y;
  let guiaX = null;
  let guiaY = null;

  if (encaixar) {
    const rx = encaixarX(x, alvo.w, outras, larguraCanvas);
    x = rx.x;
    guiaX = rx.guia;
    const ry = encaixarY(y, outras);
    y = ry.y;
    guiaY = ry.guia;
  } else {
    x = clamp(x, 0, Math.max(0, 100 - alvo.w));
    y = Math.max(0, y);
  }

  alvo.x = x;
  alvo.y = y;

  const { pecas: resolvidas, encostadas } = resolverColisoes(pecas, pieceId);
  return {
    config: applyPieces(cfg, mode, resolvidas),
    encostadas,
    guias: { x: guiaX, y: guiaY },
    magnetico: false,
    grade: null,
  };
}

/**
 * Move uma peça para (x, y).
 *
 * Widgets ganham uma camada anterior à colisão comum: ao atravessar a faixa de
 * uma linha de widgets eles formam uma grade de 1/1, 1/2, 1/3 ou 1/4. Fora
 * dessa faixa o comportamento continua exatamente o freeform anterior.
 */
export function moverPeca(
  cfg,
  mode,
  pieceId,
  destino,
  {
    larguraCanvas = 1200,
    encaixar = true,
    magnetico = true,
    cursorX = null,
    ignorarLinhaOrigem = false,
  } = {}
) {
  const pecas = toPieces(cfg, mode);
  const alvo = pecas.find((p) => p.id === pieceId);
  if (!alvo) {
    return {
      config: cfg,
      encostadas: new Set(),
      guias: { x: null, y: null },
      magnetico: false,
      grade: null,
    };
  }

  if (magnetico && encaixar && alvo.kind === "widget") {
    const encaixe = tentarGradeMagnetica(
      pecas,
      pieceId,
      destino,
      { cursorX, ignorarLinhaOrigem }
    );

    if (encaixe) {
      return {
        config: applyPieces(cfg, mode, encaixe.pecas),
        encostadas: encaixe.encostadas,
        guias: encaixe.guias,
        magnetico: true,
        grade: encaixe.grade,
      };
    }

    // Fora de qualquer linha ocupada, o widget vira uma linha 1/1. Isto fecha a
    // gramática do auto-layout: sozinho = 100%, dois = metades, três = terços,
    // quatro = quartos. Ao sair de uma linha, a origem fecha o buraco ao vivo.
    if (!ignorarLinhaOrigem) liberarLinhaDeOrigem(pecas, pieceId);

    const alvoSolo = pecas.find((p) => p.id === pieceId);
    const outras = pecas.filter((p) => p.id !== pieceId);
    const ry = encaixarY(destino.y, outras);
    alvoSolo.x = 0;
    alvoSolo.y = Math.max(0, ry.y);
    alvoSolo.w = 100;

    const { pecas: resolvidas, encostadas } = resolverColisoes(pecas, pieceId);
    return {
      config: applyPieces(cfg, mode, resolvidas),
      encostadas,
      guias: { x: 0, y: ry.guia },
      magnetico: true,
      grade: { colunas: 1, indice: 0, y: alvoSolo.y },
    };
  }

  return moverPecaLivre(
    cfg,
    mode,
    pieceId,
    destino,
    { larguraCanvas, encaixar, pecasIniciais: pecas }
  );
}


function pecasSeSobrepoem(a, b) {
  const folga = 0.05;
  return !(
    a.x + a.w <= b.x + folga ||
    b.x + b.w <= a.x + folga ||
    a.y + a.h <= b.y + folga ||
    b.y + b.h <= a.y + folga
  );
}

function layoutTemSobreposicao(pecas) {
  for (let i = 0; i < pecas.length; i += 1) {
    for (let j = i + 1; j < pecas.length; j += 1) {
      if (pecasSeSobrepoem(pecas[i], pecas[j])) return true;
    }
  }
  return false;
}

/** Caixa coletiva de uma seleção. */
function caixaDaSelecao(pecas) {
  return {
    left: Math.min(...pecas.map((p) => p.x)),
    top: Math.min(...pecas.map((p) => p.y)),
    right: Math.max(...pecas.map((p) => p.x + p.w)),
    bottom: Math.max(...pecas.map((p) => p.y + p.h)),
  };
}

/**
 * Alinhamento de seleção múltipla com semântica de ferramenta de design.
 * Não roda magnetismo nem cascata: uma ação explícita de alinhamento precisa
 * respeitar exatamente o eixo pedido, do mesmo jeito que um valor digitado no
 * inspetor não é "corrigido" pelo snap.
 */
export function alinharPecas(cfg, mode, pieceIds, alinhamento) {
  const ids = new Set(pieceIds || []);
  const pecas = toPieces(cfg, mode);
  const selecionadas = pecas.filter((p) => ids.has(p.id));
  if (selecionadas.length < 2) return cfg;

  const caixa = caixaDaSelecao(selecionadas);
  const centroX = (caixa.left + caixa.right) / 2;
  const centroY = (caixa.top + caixa.bottom) / 2;

  for (const peca of selecionadas) {
    if (peca.locked) continue;
    if (alinhamento === "left") peca.x = caixa.left;
    else if (alinhamento === "center-x") peca.x = centroX - peca.w / 2;
    else if (alinhamento === "right") peca.x = caixa.right - peca.w;
    else if (alinhamento === "top") peca.y = caixa.top;
    else if (alinhamento === "center-y") peca.y = centroY - peca.h / 2;
    else if (alinhamento === "bottom") peca.y = caixa.bottom - peca.h;

    peca.x = clamp(peca.x, 0, Math.max(0, 100 - peca.w));
    peca.y = Math.max(0, peca.y);
  }

  // Page builder não tem camada livre como o Figma: alinhar não pode produzir
  // sobreposição silenciosa. Se a operação invadir outra peça, nada é gravado.
  if (layoutTemSobreposicao(pecas)) return cfg;
  return applyPieces(cfg, mode, pecas);
}

/** Distribui três ou mais peças mantendo os extremos da seleção. */
export function distribuirPecas(cfg, mode, pieceIds, eixo) {
  const ids = new Set(pieceIds || []);
  const pecas = toPieces(cfg, mode);
  const selecionadas = pecas.filter((p) => ids.has(p.id));
  if (selecionadas.length < 3) return cfg;

  if (eixo === "horizontal") {
    const ordem = selecionadas.slice().sort((a, b) => a.x - b.x);
    const inicio = ordem[0].x;
    const fim = ordem[ordem.length - 1].x + ordem[ordem.length - 1].w;
    const soma = ordem.reduce((acc, p) => acc + p.w, 0);
    const gap = (fim - inicio - soma) / Math.max(1, ordem.length - 1);
    let cursor = inicio;
    for (const peca of ordem) {
      if (!peca.locked) peca.x = clamp(cursor, 0, Math.max(0, 100 - peca.w));
      cursor += peca.w + gap;
    }
  } else if (eixo === "vertical") {
    const ordem = selecionadas.slice().sort((a, b) => a.y - b.y);
    const inicio = ordem[0].y;
    const fim = ordem[ordem.length - 1].y + ordem[ordem.length - 1].h;
    const soma = ordem.reduce((acc, p) => acc + p.h, 0);
    const gap = (fim - inicio - soma) / Math.max(1, ordem.length - 1);
    let cursor = inicio;
    for (const peca of ordem) {
      if (!peca.locked) peca.y = Math.max(0, cursor);
      cursor += peca.h + gap;
    }
  }

  if (layoutTemSobreposicao(pecas)) return cfg;
  return applyPieces(cfg, mode, pecas);
}

/**
 * Largura mínima de uma peça no layout MOBILE, em % da largura da tela.
 *
 * Existe porque a vitrine publicada passou a respeitar o `w` do mobile — antes
 * ela achatava tudo para 100% por conta própria, e o editor mostrava uma coisa
 * enquanto o visitante recebia outra. Respeitar significa que uma peça de 12%
 * seria publicada com 12%: numa tela de 390px, 47 pixels de largura.
 *
 * A resposta certa para isso não é a página redesenhar o layout escondido — é
 * o construtor não deixar chegar lá. O limite é aplicado no gesto, então a
 * pessoa esbarra nele enquanto arrasta e vê exatamente o que será publicado.
 *
 * O auto-layout magnético agora trabalha com até quatro colunas também no
 * mobile. O limite acompanha essa gramática: 25% é o menor slot possível.
 */
export const LARGURA_MINIMA_MOBILE = 25;

/**
 * Redimensiona uma peça. Não empurra ninguém — para na primeira peça
 * encontrada, para que ajustar um canto não sacuda a página inteira.
 */
export function redimensionarPeca(cfg, mode, pieceId, tamanho) {
  const pecas = toPieces(cfg, mode);
  const alvo = pecas.find((p) => p.id === pieceId);
  if (!alvo) return { config: cfg };

  const outras = pecas.filter((p) => p.id !== pieceId);
  const kind = parsePieceId(pieceId)?.kind;
  const minW = mode === "mobile"
    ? LARGURA_MINIMA_MOBILE
    : (kind === "block" ? 20 : 10);
  const minH = kind === "block" ? 120 : 80;

  const { w, h } = limitarResize(alvo, outras, tamanho, minW, minH);
  alvo.w = w;
  alvo.h = h;

  return { config: applyPieces(cfg, mode, pecas) };
}

/**
 * Assenta um layout inteiro: as peças descem até parar de se cruzar.
 *
 * Sem âncora, porque não há peça sendo segurada — o que estiver mais acima
 * manda, que é a leitura natural de quem olha a página de cima para baixo.
 *
 * Roda na ABERTURA porque a física só valia durante um gesto: configuração
 * salva por uma versão antiga do editor abria sobreposta e continuava assim até
 * alguém arrastar cada peça na mão.
 */
export function assentarModo(cfg, mode) {
  const pecas = toPieces(cfg, mode);
  if (!pecas.length) return cfg;
  const { pecas: resolvidas } = resolverColisoes(pecas, null);
  return applyPieces(cfg, mode, resolvidas);
}

/** Assenta os dois modos. O mobile tem posições próprias e sofre do mesmo mal. */
export function assentarLayout(cfg) {
  return assentarModo(assentarModo(cfg, "desktop"), "mobile");
}

/**
 * Alinha o `h` guardado com a altura que a peça REALMENTE ocupa.
 *
 * O `h` entra no CSS como `min-height`: o conteúdo pode passar disso, e passa —
 * um bloco de imóveis declara 640px e desenha 1051 dependendo do acervo. A
 * física trabalhava sobre a caixa declarada, então duas peças "separadas" nos
 * números apareciam encaixadas na tela.
 *
 * Só CRESCE. Encolher aqui brigaria com quem definiu uma altura maior de
 * propósito para deixar respiro.
 *
 * Devolve `null` quando nada mudou — o chamador usa isso para não gravar estado
 * à toa, que é o que transformaria uma medição em laço de render.
 */
export function ajustarAlturasMedidas(cfg, mode, alturas) {
  const pecas = toPieces(cfg, mode);
  let mudou = false;

  for (const peca of pecas) {
    const medida = alturas[peca.id];
    if (!Number.isFinite(medida) || medida <= 0) continue;
    if (medida > peca.h + 2) {
      peca.h = medida;
      mudou = true;
    }
  }
  if (!mudou) return null;

  const { pecas: resolvidas } = resolverColisoes(pecas, null);
  return applyPieces(cfg, mode, resolvidas);
}

/**
 * Reempilha tudo pela altura REAL do conteúdo, com respiro constante.
 *
 * Diferente de `ajustarAlturasMedidas`, que só conserta o que ficou pequeno:
 * aqui as peças são reordenadas por `y` e empilhadas de novo, uma abaixo da
 * outra. É o que "Resetar posições" faz — e o que deixa a página resetada
 * espaçada em vez de com vãos herdados do layout anterior.
 */
export function reempilharPorConteudo(cfg, mode, alturas, gap = GAP_REEMPILHAMENTO) {
  const pecas = toPieces(cfg, mode);
  if (!pecas.length) return cfg;

  // Infla a altura com o GAP só para o cálculo; o `h` gravado é o real.
  const inflado = pecas.map((p) => ({
    ...p,
    h: (Number.isFinite(alturas[p.id]) && alturas[p.id] > 0 ? alturas[p.id] : p.h) + gap,
  }));
  const { pecas: resolvidas } = resolverColisoes(inflado, null);

  const finais = resolvidas.map((p) => ({
    ...p,
    h: Number.isFinite(alturas[p.id]) && alturas[p.id] > 0 ? alturas[p.id] : p.h - gap,
  }));
  return applyPieces(cfg, mode, finais);
}

/** Restaura as posições padrão dos blocos naquele modo. Widgets ficam. */
export function resetarPosicoes(cfg, mode) {
  const chaveLayout = layoutKeyOf(mode);
  return {
    ...cfg,
    [chaveLayout]: Object.fromEntries(Object.entries(DEFAULT_LAYOUT).map(([k, v]) => [k, { ...v }])),
  };
}

/**
 * Copia o layout desktop inteiro para o mobile — blocos E widgets.
 *
 * Antes copiava só os blocos, porque widget tinha uma posição só. Com layout
 * por modo, deixar os widgets de fora seria a metade do trabalho: os blocos
 * mudavam de lugar e os widgets ficavam onde o mobile os tinha.
 */
export function copiarDesktopParaMobile(cfg) {
  const pecas = toPieces(cfg, "desktop", { includeHidden: true });
  return applyPieces(cfg, "mobile", pecas);
}

/** O mobile difere do desktop? Usado para confirmar antes de sobrescrever. */
export function mobileFoiPersonalizado(cfg) {
  const desktop = toPieces(cfg, "desktop", { includeHidden: true });
  const mobile = toPieces(cfg, "mobile", { includeHidden: true });
  const porId = new Map(mobile.map((p) => [p.id, p]));
  return desktop.some((d) => {
    const m = porId.get(d.id);
    if (!m) return false;
    return (
      Math.abs(d.x - m.x) > 0.5 ||
      Math.abs(d.y - m.y) > 0.5 ||
      Math.abs(d.w - m.w) > 0.5 ||
      Math.abs(d.h - m.h) > 0.5
    );
  });
}

/** Altura total ocupada no modo, para dimensionar o canvas. */
export function alturaDoConteudo(cfg, mode, minimo = 1800) {
  const pecas = toPieces(cfg, mode);
  const base = pecas.reduce((acc, p) => Math.max(acc, p.y + p.h), 0);
  return Math.max(minimo, base + 80);
}

/**
 * Onde encaixar uma peça nova: logo abaixo de tudo que já existe, no modo
 * ativo. Ficar por cima de alguém e deixar a cascata resolver produziria um
 * salto assim que a peça nasce.
 */
export function proximaPosicaoLivre(cfg, mode, largura = 50) {
  const pecas = toPieces(cfg, mode);
  const base = pecas.reduce((acc, p) => Math.max(acc, p.y + p.h), 0);
  return { x: 0, y: base + 24, w: largura, h: 220 };
}

/**
 * Insere uma peça já posicionada e roda a física com ela como âncora — ela fica
 * ONDE foi solta, e quem estava ali desce. O contrário (empurrar a nova para um
 * vão livre) faria a peça aparecer longe de onde foi mirada.
 */
export function assentarPecaNova(cfg, mode, pieceId) {
  const pecas = toPieces(cfg, mode);
  if (!pecas.some((p) => p.id === pieceId)) return cfg;
  const { pecas: resolvidas } = resolverColisoes(pecas, pieceId);
  return applyPieces(cfg, mode, resolvidas);
}

/** Retângulo atual de uma peça — reexportado para quem só precisa medir. */
export { pieceRect, blockPieceId, BLOCK_KEYS };
