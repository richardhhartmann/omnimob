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
  topbar: { x: 0, y: 0, w: 100, h: 90 },
  header: { x: 0, y: 110, w: 100, h: 130 },
  title: { x: 0, y: 260, w: 100, h: 170 },
  highlights: { x: 0, y: 450, w: 100, h: 220 },
  properties: { x: 0, y: 690, w: 100, h: 920 },
  widgets: { x: 0, y: 1640, w: 100, h: 250 },
  footer: { x: 0, y: 1920, w: 100, h: 170 },
};

const BLOCK_KEYS = ["topbar", "header", "title", "highlights", "properties", "widgets", "footer"];

function emptyBlockStyle() {
  return { backgroundColor: "", color: "" };
}

function normalizeBlockStyles(raw) {
  const base = raw && typeof raw === "object" ? raw : {};
  return Object.fromEntries(
    BLOCK_KEYS.map((key) => {
      const b = base[key] || {};
      return [
        key,
        {
          backgroundColor: typeof b.backgroundColor === "string" ? b.backgroundColor : "",
          color: typeof b.color === "string" ? b.color : "",
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
  if (s.backgroundColor) out.backgroundColor = s.backgroundColor;
  if (s.color) out.color = s.color;
  return out;
}
