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
 * Move uma peça para (x, y), aplica encaixe e roda a cascata.
 *
 * A peça movida é a ÂNCORA: ela fica onde a pessoa a colocou, e quem estava no
 * caminho é que se desloca. Sem isso, arrastar um bloco por cima de outro faria
 * o próprio bloco arrastado saltar para longe do ponteiro.
 */
export function moverPeca(cfg, mode, pieceId, destino, { larguraCanvas = 1200, encaixar = true } = {}) {
  const pecas = toPieces(cfg, mode);
  const alvo = pecas.find((p) => p.id === pieceId);
  if (!alvo) return { config: cfg, encostadas: new Set(), guias: { x: null, y: null } };

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
    x = Math.min(Math.max(x, 0), Math.max(0, 100 - alvo.w));
    y = Math.max(0, y);
  }

  alvo.x = x;
  alvo.y = y;

  const { pecas: resolvidas, encostadas } = resolverColisoes(pecas, pieceId);
  return {
    config: applyPieces(cfg, mode, resolvidas),
    encostadas,
    guias: { x: guiaX, y: guiaY },
  };
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
 * 40% permite duas colunas de propósito (dois cartões lado a lado num celular
 * é uma escolha legítima) e barra o que não é escolha, é engano.
 */
export const LARGURA_MINIMA_MOBILE = 40;

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
