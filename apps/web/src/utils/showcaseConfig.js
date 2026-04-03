export const DEFAULT_HIGHLIGHTS = [
  {
    title: "Curadoria local",
    description: "Imoveis selecionados com foco em localizacao, liquidez e potencial de valorizacao.",
  },
  {
    title: "Atendimento rapido",
    description: "A equipe da imobiliaria recebe seu interesse imediatamente para agilizar a resposta.",
  },
  {
    title: "Detalhes completos",
    description: "Veja fotos, metragem, tipo do imovel, quartos, suites, vagas e informacoes da regiao.",
  },
];

export const DEFAULT_LAYOUT = {
  header: { x: 0, y: 0, w: 100, h: 80 },
  title: { x: 0, y: 150, w: 100, h: 300 },
  highlights: { x: 0, y: 380, w: 100, h: 200 },
  properties: { x: 0, y: 580, w: 100, h: 400 },
  widgets: { x: 0, y: 980, w: 100, h: 200 },
  footer: { x: 0, y: 1180, w: 100, h: 150 }
};

const BLOCK_KEYS = ["topbar", "header", "title", "highlights", "properties", "widgets", "footer"];

function emptyBlockStyle() {
  return { backgroundColor: "", color: "", backgroundImage: "", backgroundOverlay: 0, backgroundBrightness: 1 };
}

function clamp01(n) {
  return Math.min(1, Math.max(0, n));
}

function clampBrightness(n) {
  return Math.min(2, Math.max(0.3, n));
}

function normalizeBlockStyles(raw) {
  const base = raw && typeof raw === "object" ? raw : {};
  return Object.fromEntries(
    BLOCK_KEYS.map((key) => {
      const b = base[key] || {};
      const overlayRaw = b.backgroundOverlay;
      const brightRaw = b.backgroundBrightness;
      let overlay = 0;
      if (typeof overlayRaw === "number" && Number.isFinite(overlayRaw)) overlay = clamp01(overlayRaw);
      else if (typeof overlayRaw === "string" && overlayRaw !== "") {
        const p = parseFloat(overlayRaw);
        if (Number.isFinite(p)) overlay = clamp01(p);
      }
      let brightness = 1;
      if (typeof brightRaw === "number" && Number.isFinite(brightRaw)) brightness = clampBrightness(brightRaw);
      else if (typeof brightRaw === "string" && brightRaw !== "") {
        const p = parseFloat(brightRaw);
        if (Number.isFinite(p)) brightness = clampBrightness(p);
      }
      return [
        key,
        {
          backgroundColor: typeof b.backgroundColor === "string" ? b.backgroundColor : "",
          color: typeof b.color === "string" ? b.color : "",
          backgroundImage: typeof b.backgroundImage === "string" ? b.backgroundImage : "",
          backgroundOverlay: overlay,
          backgroundBrightness: brightness,
        },
      ];
    })
  );
}

function normalizeHighlightStylesRow(row) {
  const r = row && typeof row === "object" ? row : {};
  return {
    backgroundColor: typeof r.backgroundColor === "string" ? r.backgroundColor : "",
    color: typeof r.color === "string" ? r.color : "",
  };
}

function normalizeWidget(widget, index) {
  const w = widget && typeof widget === "object" ? widget : {};
  return {
    id: typeof w.id === "string" && w.id ? w.id : `widget-${Date.now()}-${index}`,
    type: typeof w.type === "string" && w.type ? w.type : "text",
    title: typeof w.title === "string" ? w.title : "Novo widget",
    content: typeof w.content === "string" ? w.content : "Conteudo do widget.",
    ctaLabel: typeof w.ctaLabel === "string" ? w.ctaLabel : "",
    ctaUrl: typeof w.ctaUrl === "string" ? w.ctaUrl : "",
    backgroundColor: typeof w.backgroundColor === "string" ? w.backgroundColor : "",
    color: typeof w.color === "string" ? w.color : "",
  };
}

/**
 * Config JSON salvo no tenant.showcaseConfig
 */
export function normalizeShowcaseConfig(raw) {
  const cfg = raw && typeof raw === "object" ? raw : {};
  const highlightsRaw = Array.isArray(cfg.highlights) ? cfg.highlights : [];

  let highlights;
  if (highlightsRaw.length === 0) {
    highlights = DEFAULT_HIGHLIGHTS.map((h) => ({ ...h }));
  } else {
    highlights = highlightsRaw.map((h, i) => ({
      title: (h && typeof h.title === "string" && h.title) || DEFAULT_HIGHLIGHTS[i]?.title || "Novo destaque",
      description:
        (h && typeof h.description === "string" && h.description) ||
        DEFAULT_HIGHLIGHTS[i]?.description ||
        "Descreva o beneficio aqui.",
    }));
  }

  const layout = cfg.layout && typeof cfg.layout === "object" ? cfg.layout : {};
  const mergedLayoutBase = Object.fromEntries(
    Object.entries(DEFAULT_LAYOUT).map(([key, base]) => {
      const next = layout[key] || {};
      return [
        key,
        {
          x: Number.isFinite(next.x) ? next.x : base.x,
          y: Number.isFinite(next.y) ? next.y : base.y,
          w: Number.isFinite(next.w) ? next.w : base.w,
          h: Number.isFinite(next.h) ? next.h : base.h,
        },
      ];
    })
  );
  // Avoid overlap for older saved layouts that do not have widgets.
  const mergedLayout = {
    ...mergedLayoutBase,
    widgets: layout.widgets
      ? mergedLayoutBase.widgets
      : {
          ...mergedLayoutBase.widgets,
          y: mergedLayoutBase.footer.y + mergedLayoutBase.footer.h + 20,
        },
  };

  const stylesFromCfg = Array.isArray(cfg.highlightStyles) ? cfg.highlightStyles : [];
  const highlightStyles = highlights.map((_, i) => normalizeHighlightStylesRow(stylesFromCfg[i]));

  const appearanceMode = cfg.appearanceMode === "light" ? "light" : "dark";
  const widgets = Array.isArray(cfg.widgets) ? cfg.widgets.map(normalizeWidget) : [];
  const hiddenBlocksRaw = Array.isArray(cfg.hiddenBlocks) ? cfg.hiddenBlocks : [];
  const hiddenBlocks = hiddenBlocksRaw.filter((key) => BLOCK_KEYS.includes(key));
  const topHeader =
    cfg.topHeader && typeof cfg.topHeader === "object"
      ? {
          title:
            typeof cfg.topHeader.title === "string" && cfg.topHeader.title
              ? cfg.topHeader.title
              : "Atendimento premium e oportunidades atualizadas",
          subtitle:
            typeof cfg.topHeader.subtitle === "string" && cfg.topHeader.subtitle
              ? cfg.topHeader.subtitle
              : "Converse com nossa equipe e encontre o imovel ideal mais rapido.",
        }
      : {
          title: "Atendimento premium e oportunidades atualizadas",
          subtitle: "Converse com nossa equipe e encontre o imovel ideal mais rapido.",
        };

  return {
    highlights,
    footerTitle: typeof cfg.footerTitle === "string" && cfg.footerTitle ? cfg.footerTitle : "Atendimento especializado",
    layout: mergedLayout,
    appearanceMode,
    blockStyles: normalizeBlockStyles(cfg.blockStyles),
    highlightStyles,
    widgets,
    topHeader,
    hiddenBlocks,
  };
}

export function mergeBlockWrapperStyle(blockStyle) {
  const s = blockStyle || emptyBlockStyle();
  const out = {};
  const hasBgImage = typeof s.backgroundImage === "string" && s.backgroundImage.trim() !== "";
  if (s.backgroundColor && !hasBgImage) out.backgroundColor = s.backgroundColor;
  if (s.color) out.color = s.color;
  return out;
}

function escapeUrlForCss(url) {
  return String(url).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Estilo da secção exterior com imagem de fundo (variáveis CSS para ::before/::after).
 * Quando não há URL, delega em mergeBlockWrapperStyle.
 */
export function sectionSurfaceStyle(blockStyle) {
  const s = blockStyle || emptyBlockStyle();
  const url = typeof s.backgroundImage === "string" && s.backgroundImage.trim();
  if (!url) {
    return mergeBlockWrapperStyle(s);
  }
  const overlay = clamp01(typeof s.backgroundOverlay === "number" ? s.backgroundOverlay : 0);
  const brightness = clampBrightness(typeof s.backgroundBrightness === "number" ? s.backgroundBrightness : 1);
  const out = {};
  if (s.color) out.color = s.color;
  out["--showcase-bg-url"] = `url("${escapeUrlForCss(url)}")`;
  out["--showcase-bg-overlay"] = String(overlay);
  out["--showcase-bg-brightness"] = String(brightness);
  return out;
}

export function blockHasBackgroundImage(blockStyle) {
  return typeof blockStyle?.backgroundImage === "string" && blockStyle.backgroundImage.trim() !== "";
}
