import { DEFAULT_LAYOUT, widgetRect, withWidgetRect } from "../../../utils/showcaseConfig.js";

/* ────────────────────────────────────────────────────────────────────────────
   BuilderPiece — a representação única da engine.

   Antes existiam duas físicas: uma para os seis blocos fixos (que moram num
   mapa `layout`/`mobileLayout` indexado por chave) e outra, quase inexistente,
   para os widgets (que moram num array). Era daí que saía o "widget dentro do
   bloco": o array não participava de colisão nenhuma.

   Aqui os dois viram a MESMA coisa:

     { id, kind, key, x, y, w, h, locked, hidden }

   `id` é o que a engine e a interface usam para falar de uma peça: `b:header`,
   `w:widget-1712...`. Os adaptadores abaixo são a única parte do código que
   sabe que blocos e widgets são guardados em lugares diferentes — a engine, o
   canvas e o inspetor só conhecem peças.
   ──────────────────────────────────────────────────────────────────────────── */

export const BLOCK_KEYS = ["header", "title", "highlights", "properties", "footer"];

export const BLOCK_LABELS = {
  header: "Cabeçalho",
  title: "Hero / Título",
  highlights: "Destaques",
  properties: "Lista de Imóveis",
  footer: "Rodapé",
};

/** Ordem de leitura da página, usada pelo painel de camadas. */
export const BLOCK_ORDER = BLOCK_KEYS;

export const layoutKeyOf = (mode) => (mode === "mobile" ? "mobileLayout" : "layout");

export const blockPieceId = (key) => `b:${key}`;
export const widgetPieceId = (id) => `w:${id}`;

/** Lê um id de peça de volta. `null` quando não é nosso. */
export function parsePieceId(pieceId) {
  if (typeof pieceId !== "string") return null;
  const sep = pieceId.indexOf(":");
  if (sep < 1) return null;
  const prefixo = pieceId.slice(0, sep);
  const key = pieceId.slice(sep + 1);
  if (prefixo === "b") return { kind: "block", key };
  if (prefixo === "w") return { kind: "widget", key };
  return null;
}

export function isWidgetPiece(pieceId) {
  return parsePieceId(pieceId)?.kind === "widget";
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Retângulo de um bloco fixo no modo pedido. */
export function blockRect(cfg, mode, key) {
  const base = DEFAULT_LAYOUT[key] || { x: 0, y: 0, w: 100, h: 200 };
  const src = (cfg?.[layoutKeyOf(mode)] || {})[key] || {};
  return {
    x: num(src.x, base.x),
    y: num(src.y, base.y),
    w: num(src.w, base.w),
    h: num(src.h, base.h),
  };
}

/** Retângulo de qualquer peça, pelo id. `null` se ela não existe mais. */
export function pieceRect(cfg, mode, pieceId) {
  const alvo = parsePieceId(pieceId);
  if (!alvo) return null;
  if (alvo.kind === "block") return blockRect(cfg, mode, alvo.key);
  const widget = (cfg.widgets || []).find((w) => w.id === alvo.key);
  return widget ? widgetRect(widget, mode) : null;
}

/**
 * Todas as peças do modo, num array só.
 *
 * Peças ocultas ficam de fora por padrão: elas não aparecem na tela, então
 * empurrar alguém com elas produziria vãos que ninguém consegue explicar
 * olhando a página. (O código antigo esquecia esse filtro no arrasto de
 * widget, e blocos ocultos empurravam peças visíveis.)
 */
export function toPieces(cfg, mode, { includeHidden = false } = {}) {
  const hiddenBlocks = cfg.hiddenBlocks || [];
  const lockedBlocks = cfg.lockedBlocks || [];
  const pecas = [];

  for (const key of BLOCK_KEYS) {
    const hidden = hiddenBlocks.includes(key);
    if (hidden && !includeHidden) continue;
    pecas.push({
      id: blockPieceId(key),
      kind: "block",
      key,
      ...blockRect(cfg, mode, key),
      locked: lockedBlocks.includes(key),
      hidden,
    });
  }

  for (const widget of cfg.widgets || []) {
    if (widget.hidden && !includeHidden) continue;
    pecas.push({
      id: widgetPieceId(widget.id),
      kind: "widget",
      key: widget.id,
      ...widgetRect(widget, mode),
      locked: widget.locked === true,
      hidden: widget.hidden === true,
    });
  }

  return pecas;
}

/**
 * Caminho de volta: grava as posições das peças no config, no modo pedido.
 * Peças ausentes do array não são tocadas — quem não entrou na física fica
 * exatamente onde estava.
 */
export function applyPieces(cfg, mode, pecas) {
  const chaveLayout = layoutKeyOf(mode);
  const blocos = { ...(cfg[chaveLayout] || {}) };
  const porWidget = new Map();

  for (const p of pecas) {
    const rect = { x: p.x, y: p.y, w: p.w, h: p.h };
    if (p.kind === "block") blocos[p.key] = { ...(blocos[p.key] || {}), ...rect };
    else porWidget.set(p.key, rect);
  }

  const widgets = (cfg.widgets || []).map((w) =>
    porWidget.has(w.id) ? withWidgetRect(w, mode, porWidget.get(w.id)) : w
  );

  return { ...cfg, [chaveLayout]: blocos, widgets };
}

/** Rótulo de exibição de uma peça (bloco fixo ou widget). */
export function pieceLabel(cfg, pieceId) {
  const alvo = parsePieceId(pieceId);
  if (!alvo) return "";
  if (alvo.kind === "block") return BLOCK_LABELS[alvo.key] || alvo.key;
  const widget = (cfg.widgets || []).find((w) => w.id === alvo.key);
  const bruto = (widget?.title || "Widget").replace(/<[^>]*>/g, "").trim();
  return bruto.slice(0, 32) || "Widget";
}
