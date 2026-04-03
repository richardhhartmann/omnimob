import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { api } from "../api";
import { saveSession } from "../session";
import {
  DEFAULT_LAYOUT,
  blockHasBackgroundImage,
  mergeBlockWrapperStyle,
  normalizeShowcaseConfig,
  sectionSurfaceStyle,
} from "../utils/showcaseConfig";

const PRESET_THEMES = {
  CLASSICO: { primaryColor: "#6366f1", secondaryColor: "#d4af37" },
  PALETA_AZUL: { primaryColor: "#2563eb", secondaryColor: "#f8fafc" },
  ESMERALDA: { primaryColor: "#10b981", secondaryColor: "#14b8a6" },
  OCEANO: { primaryColor: "#0ea5e9", secondaryColor: "#38bdf8" },
};

/** Clicks on <input type="color"> may target shadow-internal nodes where closest() cannot see the toolbar. */
function isNodeUnderFormatToolbar(node, toolbarEl) {
  if (!toolbarEl || !node) return false;
  let n = node.nodeType === 1 ? node : node.parentElement;
  if (!n || n.nodeType !== 1) return false;
  while (n) {
    if (n === toolbarEl) return true;
    if (typeof toolbarEl.contains === "function" && toolbarEl.contains(n)) return true;
    const root = n.getRootNode && n.getRootNode();
    if (root instanceof ShadowRoot) n = root.host;
    else n = n.parentElement;
  }
  return false;
}

const WIDGET_LIBRARY = [
  {
    type: "text",
    title: "Bloco de Texto",
    content: "Use este bloco para descrever diferenciais, condições especiais ou informações adicionais importantes.",
    preview: <div style={{width: '100%', height: '4px', background: 'var(--text-muted)', borderRadius: '2px', opacity: 0.5, marginBottom: '4px'}} />,
  },
  {
    type: "cta",
    title: "Chamada para Ação (CTA)",
    content: "Fale com nossa equipe e receba as melhores opções para seu perfil.",
    ctaLabel: "Falar no WhatsApp",
    ctaUrl: "https://wa.me/",
    preview: <div style={{width: '60%', height: '12px', background: 'var(--accent)', borderRadius: '4px', marginTop: '4px'}} />,
  },
  {
    type: "note",
    title: "Aviso Importante",
    content: "Documentação e simulação de financiamento sob análise da imobiliária. Valores sujeitos a alteração.",
    preview: <div style={{width: '100%', border: '1px solid rgba(255,255,255,0.2)', height: '12px', borderRadius: '4px', marginTop: '4px'}} />,
  },
  {
    type: "faq",
    title: "Dúvida Frequente (FAQ)",
    content: "Como funciona o processo de locação sem fiador?",
    preview: <div style={{display: 'flex', gap: '4px', alignItems: 'center'}}><div style={{width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)'}}/><div style={{flex: 1, height: '4px', background: 'var(--text-muted)', borderRadius: '2px', opacity: 0.5}} /></div>,
  },
  {
    type: "hours",
    title: "Horário de Atendimento",
    content: "Segunda a Sexta: 09h às 18h<br>Sábados: 09h às 13h<br>Domingos e Feriados: Fechado",
    preview: <div style={{display: 'grid', gap: '2px'}}><div style={{width: '80%', height: '4px', background: 'var(--text-muted)', opacity: 0.5}}/><div style={{width: '60%', height: '4px', background: 'var(--text-muted)', opacity: 0.5}}/></div>,
  },
];

const DEFAULT_BLOCK_LABELS = {
  header: "Cabecalho",
  title: "Hero / titulo",
  highlights: "Highlights",
  properties: "Lista de imoveis",
  widgets: "Widgets extras",
  footer: "Rodape",
};

function normalizeHex(value, fallback) {
  if (typeof value !== "string") return fallback;
  const v = value.trim();
  return /^#([0-9a-fA-F]{6})$/.test(v) ? v : fallback;
}

function coerceLayoutNumber(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function detectTheme(primaryColor, secondaryColor) {
  const primary = normalizeHex(primaryColor, PRESET_THEMES.CLASSICO.primaryColor).toLowerCase();
  const secondary = normalizeHex(secondaryColor, PRESET_THEMES.CLASSICO.secondaryColor).toLowerCase();
  for (const [key, value] of Object.entries(PRESET_THEMES)) {
    if (value.primaryColor.toLowerCase() === primary && value.secondaryColor.toLowerCase() === secondary) {
      return key;
    }
  }
  return "PERSONALIZADO";
}

function BlockStyleToolbar({ label, blockKey, styles, onChange, onClear }) {
  const s = styles[blockKey] || {};
  const hasBanner = typeof s.backgroundImage === "string" && s.backgroundImage.trim() !== "";
  const overlayPct = Math.round((typeof s.backgroundOverlay === "number" ? s.backgroundOverlay : 0) * 100);
  const brightSlider = Math.round((typeof s.backgroundBrightness === "number" ? s.backgroundBrightness : 1) * 100);

  return (
    <div 
      className="builder-block-toolbar" 
      onPointerDown={(e) => e.stopPropagation()} 
      onKeyDown={(e) => e.stopPropagation()} 
      style={{ borderRadius: "12px", padding: "8px 12px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}
    >
      <span className="builder-toolbar-label" style={{ fontWeight: "700", color: "#fff" }}>{label}</span>
      <div style={{ width: "1px", height: "16px", background: "rgba(255,255,255,0.2)" }} />
      {!hasBanner ? (
        <label className="builder-color-mini" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          Fundo
          <input
            type="color"
            value={s.backgroundColor || "#1e293b"}
            onChange={(e) => onChange(blockKey, "backgroundColor", e.target.value)}
            style={{ width: "24px", height: "24px", borderRadius: "6px", cursor: "pointer", border: "1px solid rgba(255,255,255,0.2)", padding: 0 }}
          />
        </label>
      ) : (
        <>
          <label className="builder-color-mini" style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "120px" }}>
            Escurecer
            <input
              type="range"
              min={0}
              max={100}
              value={overlayPct}
              onChange={(e) => onChange(blockKey, "backgroundOverlay", Number(e.target.value) / 100)}
              style={{ width: "100px", accentColor: "var(--accent, #818cf8)" }}
            />
            <span style={{ fontSize: "10px", color: "var(--text-muted)", width: "28px" }}>{overlayPct}%</span>
          </label>
          <label className="builder-color-mini" style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "120px" }}>
            Brilho
            <input
              type="range"
              min={30}
              max={200}
              value={brightSlider}
              onChange={(e) => onChange(blockKey, "backgroundBrightness", Number(e.target.value) / 100)}
              style={{ width: "100px", accentColor: "var(--accent, #818cf8)" }}
            />
            <span style={{ fontSize: "10px", color: "var(--text-muted)", width: "36px" }}>{(brightSlider / 100).toFixed(1)}×</span>
          </label>
        </>
      )}
      <label className="builder-color-mini" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        Texto
        <input 
          type="color" 
          value={s.color || "#f8fafc"} 
          onChange={(e) => onChange(blockKey, "color", e.target.value)} 
          style={{ width: "24px", height: "24px", borderRadius: "6px", cursor: "pointer", border: "1px solid rgba(255,255,255,0.2)", padding: 0 }}
        />
      </label>
      <div style={{ width: "1px", height: "16px", background: "rgba(255,255,255,0.2)" }} />
      <label className="builder-color-mini" style={{ flex: 1, minWidth: "140px", display: "flex", alignItems: "center", gap: "6px" }}>
        Banner URL
        <input
          type="text"
          placeholder="https://..."
          value={s.backgroundImage || ""}
          onChange={(e) => onChange(blockKey, "backgroundImage", e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          style={{ width: "100%", height: "28px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.2)", padding: "0 8px", background: "rgba(0,0,0,0.3)", color: "#fff", fontSize: "12px" }}
        />
      </label>
      <button type="button" className="builder-toolbar-clear" onClick={() => onClear(blockKey)} style={{ borderRadius: "6px", marginLeft: "auto" }}>
        Limpar
      </button>
    </div>
  );
}

export function ShowcaseEditorPage({ session, onLogout, onSessionUpdate }) {
  const tenantSlug = session?.tenant?.slug || "";
  const initializedRef = useRef(false);
  const saveTimerRef = useRef(null);
  const canvasRef = useRef(null);
  const actionRef = useRef(null);
  const dragStateRef = useRef(null);

  const [activeBlock, setActiveBlock] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [snapCenterActive, setSnapCenterActive] = useState(false);
  const [snapTopActive, setSnapTopActive] = useState(false);
  const [widgetMenuOpen, setWidgetMenuOpen] = useState(false);
  const [textSelection, setTextSelection] = useState(null);
  const [activeRange, setActiveRange] = useState(null);
  const activeRangeRef = useRef(null);
  const formatToolbarRef = useRef(null);
  const isFormattingRef = useRef(false);
  
  const [form, setForm] = useState({
    whatsapp: "",
    email: "",
    description: "",
    slogan: "",
    logoUrl: "",
    primaryColor: "#6366f1",
    secondaryColor: "#d4af37",
    showcaseHeadline: "",
    showcaseSubheadline: "",
    showcaseConfig: normalizeShowcaseConfig(null),
  });
  const [previewProperties, setPreviewProperties] = useState([]);
  const [carouselIndexes, setCarouselIndexes] = useState({});
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function loadEditorData() {
      if (!tenantSlug) return;
      setLoadingInitial(true);
      setError("");
      try {
        const [data, showcase] = await Promise.all([api.getTenantProfile(tenantSlug), api.getPublicShowcase(tenantSlug)]);
        setForm({
          whatsapp: data.whatsapp || "",
          email: data.email || "",
          description: data.description || "",
          slogan: data.slogan || "",
          logoUrl: data.logoUrl || "",
          primaryColor: data.primaryColor || "#6366f1",
          secondaryColor: data.secondaryColor || "#d4af37",
          showcaseHeadline: data.showcaseHeadline || "",
          showcaseSubheadline: data.showcaseSubheadline || "",
          showcaseConfig: normalizeShowcaseConfig(data.showcaseConfig),
        });
        setPreviewProperties(showcase.properties || []);
        const indexes = {};
        (showcase.properties || []).forEach((property) => {
          indexes[property.id] = 0;
        });
        setCarouselIndexes(indexes);
        initializedRef.current = true;
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingInitial(false);
      }
    }

    loadEditorData();
  }, [tenantSlug]);

  function syncRichHtmlFromEditable(editable) {
    const key = editable.getAttribute("data-rich-sync");
    if (!key) return;
    const html = editable.innerHTML;
    if (key === "footerTitle") {
      updateShowcaseConfig((prev) => ({ ...prev, footerTitle: html }));
      return;
    }
    const parts = key.split("|");
    const kind = parts[0];
    if (kind === "form") {
      updateField(parts[1], html);
      return;
    }
    if (kind === "topHeader") {
      const field = parts[1];
      updateShowcaseConfig((prev) => ({
        ...prev,
        topHeader: { ...prev.topHeader, [field]: html },
      }));
      return;
    }
    if (kind === "highlight") {
      const index = parseInt(parts[1], 10);
      const field = parts[2];
      updateHighlight(index, field, html);
      return;
    }
    if (kind === "widget") {
      const index = parseInt(parts[1], 10);
      const field = parts[2];
      updateWidget(index, field, html);
      return;
    }
  }

  useEffect(() => {
    const dismissFormatToolbar = (e) => {
      const toolbarEl = formatToolbarRef.current;
      const path = typeof e.composedPath === "function" ? e.composedPath() : [e.target];
      const inside = path.some((node) => isNodeUnderFormatToolbar(node, toolbarEl));
      if (inside) return;

      // SALVA O ESTADO AQUI: O usuário clicou fora. Antes de fechar o menu 
      // e destruir a referência, nós sincronizamos o HTML final com o React de uma vez só!
      if (activeRangeRef.current) {
        const node = activeRangeRef.current.commonAncestorContainer;
        const editable =
          node.nodeType === 3 ? node.parentElement?.closest(".editable-inline") : node.closest(".editable-inline");
        if (editable) {
          syncRichHtmlFromEditable(editable);
        }
      }

      setTextSelection(null);
      setActiveRange(null);
      activeRangeRef.current = null;
      isFormattingRef.current = false;
    };
    
    document.addEventListener("pointerdown", dismissFormatToolbar, true);
    return () => document.removeEventListener("pointerdown", dismissFormatToolbar, true);
  }, []);

  useEffect(() => {
    const handleSelection = () => {
      const sel = window.getSelection();
      if (!sel.isCollapsed && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const node = range.commonAncestorContainer;
        const parent = node.nodeType === 3 ? node.parentElement : node;
        if (parent && parent.closest(".editable-inline")) {
          const rect = range.getBoundingClientRect();
          const cloned = range.cloneRange();
          setTextSelection({
            x: rect.left + rect.width / 2,
            y: rect.top - 8,
          });
          setActiveRange(cloned);
          activeRangeRef.current = cloned;
        }
      }
    };
    document.addEventListener("selectionchange", handleSelection);
    return () => document.removeEventListener("selectionchange", handleSelection);
  }, []);

  const applyFormat = (command, value) => {
    const range = activeRangeRef.current;
    if (!range) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    
    try {
      document.execCommand("styleWithCSS", false, true);
      document.execCommand(command, false, value);
    } catch {
    }

    // A MÁGICA AQUI: O navegador acabou de aplicar a cor e criar um <span> novo.
    // Precisamos capturar essa nova seleção para que o próximo milissegundo 
    // do arrasto de cor altere o elemento certo, e não o antigo.
    if (sel.rangeCount > 0) {
      activeRangeRef.current = sel.getRangeAt(0).cloneRange();
    }

    // Removemos o syncRichHtmlFromEditable daqui para que o React 
    // não destrua o texto enquanto o usuário ainda está brincando com a paleta.
    isFormattingRef.current = false;
  };

  function applyPreset(themeKey) {
    const preset = PRESET_THEMES[themeKey];
    if (!preset) return;
    setForm((prev) => ({ ...prev, primaryColor: preset.primaryColor, secondaryColor: preset.secondaryColor }));
  }

  function setAppearanceMode(mode) {
    const getBrightness = (c) => {
      if (!c) return 255;
      let hex = c.replace('#', '').trim();
      if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
      if (hex.length !== 6) return 255;
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      return (0.299 * r + 0.587 * g + 0.114 * b);
    };

    updateShowcaseConfig((prev) => {
      const flipColor = (color) => {
        const c = color || (prev.appearanceMode === 'light' ? '#1e293b' : '#f8fafc');
        const brightness = getBrightness(c);
        if (mode === "dark" && brightness < 128) return "#f8fafc";
        if (mode === "light" && brightness >= 128) return "#1e293b";
        return color;
      };

      const newBlockStyles = { ...prev.blockStyles };
      Object.keys(newBlockStyles).forEach(k => {
        if (newBlockStyles[k].color) {
          newBlockStyles[k].color = flipColor(newBlockStyles[k].color);
        }
      });

      const newHighlightStyles = prev.highlightStyles.map(hs => ({
        ...hs,
        color: hs.color ? flipColor(hs.color) : hs.color
      }));

      const newWidgets = prev.widgets.map(w => ({
        ...w,
        color: w.color ? flipColor(w.color) : w.color
      }));

      return {
        ...prev,
        appearanceMode: mode,
        blockStyles: newBlockStyles,
        highlightStyles: newHighlightStyles,
        widgets: newWidgets
      };
    });
  }

  function resetLayoutOnly() {
    updateShowcaseConfig((prev) => ({
      ...prev,
      layout: Object.fromEntries(Object.entries(DEFAULT_LAYOUT).map(([k, v]) => [k, { ...v }])),
    }));
  }

  function resetAllBuilder() {
    if(window.confirm("Tem certeza que deseja resetar todo o layout e textos para o padrão?")) {
      setForm((prev) => ({
        ...prev,
        whatsapp: "",
        email: "",
        description: "",
        slogan: "",
        showcaseHeadline: "",
        showcaseSubheadline: "",
        showcaseConfig: {
          ...normalizeShowcaseConfig(null),
          hiddenBlocks: ["topbar"] // Força a topbar a iniciar escondida
        },
      }));
    }
  }

  function isBlockVisible(blockKey) {
    return !showcaseConfig.hiddenBlocks.includes(blockKey);
  }

  function hideBlock(blockKey) {
    updateShowcaseConfig((prev) => ({
      ...prev,
      hiddenBlocks: Array.from(new Set([...prev.hiddenBlocks, blockKey])),
    }));
  }

  function restoreBlock(blockKey) {
    updateShowcaseConfig((prev) => ({
      ...prev,
      hiddenBlocks: prev.hiddenBlocks.filter((k) => k !== blockKey),
    }));
    setWidgetMenuOpen(false);
  }

  function updateBlockStyle(blockKey, field, value) {
    updateShowcaseConfig((prev) => ({
      ...prev,
      blockStyles: {
        ...prev.blockStyles,
        [blockKey]: { ...prev.blockStyles[blockKey], [field]: value },
      },
    }));
  }

  function clearBlockStyle(blockKey) {
    updateShowcaseConfig((prev) => ({
      ...prev,
      blockStyles: {
        ...prev.blockStyles,
        [blockKey]: {
          backgroundColor: "",
          color: "",
          backgroundImage: "",
          backgroundOverlay: 0,
          backgroundBrightness: 1,
        },
      },
    }));
  }

  function updateHighlightStyle(index, field, value) {
    updateShowcaseConfig((prev) => ({
      ...prev,
      highlightStyles: prev.highlightStyles.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    }));
  }

  function clearHighlightStyle(index) {
    updateShowcaseConfig((prev) => ({
      ...prev,
      highlightStyles: prev.highlightStyles.map((row, i) => (i === index ? { backgroundColor: "", color: "" } : row)),
    }));
  }

  function addHighlight() {
    updateShowcaseConfig((prev) => ({
      ...prev,
      highlights: [...prev.highlights, { title: "Novo destaque", description: "Descreva o beneficio aqui." }],
      highlightStyles: [...prev.highlightStyles, { backgroundColor: "", color: "" }],
    }));
  }

  function addWidget(template) {
    updateShowcaseConfig((prev) => ({
      ...prev,
      widgets: [
        ...prev.widgets,
        {
          id: `widget-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: template.type,
          title: template.title,
          content: template.content,
          ctaLabel: template.ctaLabel || "",
          ctaUrl: template.ctaUrl || "",
          backgroundColor: "",
          color: "",
        },
      ],
    }));
    setWidgetMenuOpen(false);
  }

  function updateWidget(index, field, value) {
    updateShowcaseConfig((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w, i) => (i === index ? { ...w, [field]: value } : w)),
    }));
  }

  function removeWidget(index) {
    updateShowcaseConfig((prev) => ({
      ...prev,
      widgets: prev.widgets.filter((_, i) => i !== index),
    }));
  }

  function removeHighlight(index) {
    updateShowcaseConfig((prev) => {
      if (prev.highlights.length <= 1) return prev;
      return {
        ...prev,
        highlights: prev.highlights.filter((_, i) => i !== index),
        highlightStyles: prev.highlightStyles.filter((_, i) => i !== index),
      };
    });
  }

  function nextImage(propertyId, total) {
    setCarouselIndexes((prev) => ({ ...prev, [propertyId]: ((prev[propertyId] || 0) + 1) % total }));
  }

  function prevImage(propertyId, total) {
    setCarouselIndexes((prev) => ({ ...prev, [propertyId]: ((prev[propertyId] || 0) - 1 + total) % total }));
  }

  const previewTenant = useMemo(
    () => ({ name: session?.tenant?.name || "Imobiliaria", slug: tenantSlug, ...form }),
    [form, session?.tenant?.name, tenantSlug]
  );
  const showcaseConfig = useMemo(() => normalizeShowcaseConfig(form.showcaseConfig), [form.showcaseConfig]);

  const layout = showcaseConfig.layout;
  const blockStyles = showcaseConfig.blockStyles;

  const previewStyle = useMemo(
    () => ({
      "--accent": previewTenant.primaryColor || "#818cf8",
      "--accent-hover": previewTenant.primaryColor || "#6366f1",
      "--tenant-secondary": previewTenant.secondaryColor || "#d4af37",
    }),
    [previewTenant.primaryColor, previewTenant.secondaryColor]
  );

  const previewHeadline = previewTenant.showcaseHeadline || "Encontre o imóvel ideal para seu próximo passo";
  const previewSubheadline =
    previewTenant.showcaseSubheadline ||
    "Compare opções, visualize fotos detalhadas e converse com a imobiliária em poucos cliques.";
  const currentTheme = useMemo(
    () => detectTheme(previewTenant.primaryColor, previewTenant.secondaryColor),
    [previewTenant.primaryColor, previewTenant.secondaryColor]
  );

  const isLightMode = showcaseConfig.appearanceMode === "light";

  useEffect(() => {
    if (!initializedRef.current || !tenantSlug) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      setError("");
      setSuccess("");
      try {
        const updated = await api.updateTenantProfile(tenantSlug, form);
        const nextSession = { ...session, tenant: { ...session.tenant, ...updated } };
        saveSession(nextSession);
        onSessionUpdate(nextSession);
        setSuccess("Alterações salvas.");
      } catch (err) {
        setError(err.message);
      } finally {
        setSaving(false);
        setTimeout(() => setSuccess(""), 3000); 
      }
    }, 1000); 

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [form, tenantSlug]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateShowcaseConfig(updater) {
    setForm((prev) => ({
      ...prev,
      showcaseConfig: updater(normalizeShowcaseConfig(prev.showcaseConfig)),
    }));
  }

  function updateHighlight(index, key, value) {
    updateShowcaseConfig((prev) => ({
      ...prev,
      highlights: prev.highlights.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    }));
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function startBuilderAction(blockKey, mode, event) {
    if (!canvasRef.current) return;
    event.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    
    const currentBlock = layout?.[blockKey] || DEFAULT_LAYOUT?.[blockKey] || {};
    const startBlock = {
      x: currentBlock.x ?? 0,
      y: currentBlock.y ?? 0,
      w: currentBlock.w ?? 100,
      h: currentBlock.h ?? 200,
    };

    const activeKeys = Object.keys(DEFAULT_BLOCK_LABELS).filter(k => k !== blockKey && !showcaseConfig.hiddenBlocks.includes(k));
    const staticBlocks = activeKeys.map(key => {
      const defaults = DEFAULT_LAYOUT[key] || { x: 0, y: 0, w: 100, h: 200 };
      const block = layout?.[key] || {};
      return {
        key,
        x: coerceLayoutNumber(block.x, defaults.x),
        y: coerceLayoutNumber(block.y, defaults.y),
        w: coerceLayoutNumber(block.w, defaults.w),
        h: coerceLayoutNumber(block.h, defaults.h),
      };
    });

    actionRef.current = {
      blockKey,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startBlock,
      canvasWidth: rect.width,
      staticBlocks,
      lastValidX: startBlock.x,
      lastValidY: startBlock.y,
      lastValidW: startBlock.w,
      lastValidH: startBlock.h,
    };

    const onMove = (moveEvent) => {
      const action = actionRef.current;
      if (!action || !canvasRef.current) return;
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const dxPx = moveEvent.clientX - action.startX;
      const dyPx = moveEvent.clientY - action.startY;
      const dxPercent = (dxPx / Math.max(canvasRect.width, 1)) * 100;

      const checkCollision = (testRect) => {
        for (const other of action.staticBlocks) {
          if (
            testRect.left < other.x + other.w - 0.1 &&
            testRect.right > other.x + 0.1 &&
            testRect.top < other.y + other.h - 0.1 &&
            testRect.bottom > other.y + 0.1
          ) {
            return true;
          }
        }
        return false;
      };

      if (action.mode === "resize") {
        const nextW = clamp(action.startBlock.w + dxPercent, 20, 100 - action.startBlock.x);
        const nextH = Math.max(120, action.startBlock.h + dyPx);
        
        let finalW = action.lastValidW;
        let finalH = action.lastValidH;

        const rectTestW = { left: action.startBlock.x, right: action.startBlock.x + nextW, top: action.startBlock.y, bottom: action.startBlock.y + finalH };
        if (!checkCollision(rectTestW)) finalW = nextW;

        const rectTestH = { left: action.startBlock.x, right: action.startBlock.x + finalW, top: action.startBlock.y, bottom: action.startBlock.y + nextH };
        if (!checkCollision(rectTestH)) finalH = nextH;

        action.lastValidW = finalW;
        action.lastValidH = finalH;

        setSnapCenterActive(false);
        setSnapTopActive(false);
        
        updateShowcaseConfig((prev) => ({
          ...prev,
          layout: {
            ...prev.layout,
            [action.blockKey]: {
              ...prev.layout[action.blockKey],
              w: finalW,
              h: finalH,
            },
          },
        }));
        return;
      }

      let nextX = clamp(action.startBlock.x + dxPercent, 0, 100 - action.startBlock.w);
      const center = nextX + action.startBlock.w / 2;
      const thresholdPct = (8 / Math.max(canvasRect.width, 1)) * 100;
      let snapped = false;
      
      if (Math.abs(center - 50) <= thresholdPct) {
        nextX = clamp(50 - action.startBlock.w / 2, 0, 100 - action.startBlock.w);
        snapped = true;
      }

      let nextY = action.startBlock.y + dyPx;
      let snappedTop = false;
      
      if (nextY <= 15) {
        nextY = 0;
        snappedTop = true;
      }

      let finalX = action.lastValidX;
      let finalY = action.lastValidY;

      const rectTestX = { left: nextX, right: nextX + action.startBlock.w, top: finalY, bottom: finalY + action.startBlock.h };
      if (!checkCollision(rectTestX)) {
        finalX = nextX;
      } else {
        snapped = false;
      }

      const rectTestY = { left: finalX, right: finalX + action.startBlock.w, top: nextY, bottom: nextY + action.startBlock.h };
      if (!checkCollision(rectTestY)) {
        finalY = Math.max(0, nextY);
      } else {
        snappedTop = false;
      }

      action.lastValidX = finalX;
      action.lastValidY = finalY;

      setSnapCenterActive(snapped);
      setSnapTopActive(snappedTop);

      updateShowcaseConfig((prev) => ({
        ...prev,
        layout: {
          ...prev.layout,
          [action.blockKey]: {
            ...prev.layout[action.blockKey],
            x: finalX,
            y: finalY,
          },
        },
      }));
    };

    const onUp = () => {
      setSnapCenterActive(false);
      setSnapTopActive(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      actionRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function startWidgetDrag(template, event) {
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const state = { template, x: startX, y: startY, snapIndex: -1 };
    dragStateRef.current = state;
    setDragState(state);

    const onMove = (e) => {
      let snapIndex = -1;
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        if (e.clientX >= rect.left - 100 && e.clientX <= rect.right + 100 &&
            e.clientY >= rect.top - 100 && e.clientY <= rect.bottom + 100) {
          const dropZone = document.getElementById("widgets-drop-zone");
          if (dropZone) {
            const cards = Array.from(dropZone.querySelectorAll('.widget-card:not(.preview-card)'));
            let closest = cards.length;
            let minDist = Infinity;
            cards.forEach((card, i) => {
              const cr = card.getBoundingClientRect();
              const cy = cr.top + cr.height / 2;
              const cx = cr.left + cr.width / 2;
              const dist = Math.hypot(cx - e.clientX, cy - e.clientY);
              if (dist < minDist) {
                minDist = dist;
                closest = (e.clientY > cy || e.clientX > cx + cr.width / 2) ? i + 1 : i;
              }
            });
            snapIndex = closest;
          } else {
            snapIndex = showcaseConfig.widgets.length;
          }
        }
      }
      dragStateRef.current = { template, x: e.clientX, y: e.clientY, snapIndex };
      setDragState(dragStateRef.current);
    };

    const onUp = (e) => {
      const finalState = dragStateRef.current;
      const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
      
      if (dist < 10) {
        addWidget(template);
      } else if (finalState && finalState.snapIndex !== -1) {
        updateShowcaseConfig((prev) => {
          let hiddenBlocks = prev.hiddenBlocks;
          if (hiddenBlocks.includes("widgets")) {
            hiddenBlocks = hiddenBlocks.filter((b) => b !== "widgets");
          }
          const newWidget = {
            id: `widget-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: finalState.template.type,
            title: finalState.template.title,
            content: finalState.template.content,
            ctaLabel: finalState.template.ctaLabel || "",
            ctaUrl: finalState.template.ctaUrl || "",
            backgroundColor: "",
            color: "",
          };
          const newWidgets = [...prev.widgets];
          newWidgets.splice(finalState.snapIndex, 0, newWidget);
          return {
            ...prev,
            hiddenBlocks,
            widgets: newWidgets,
          };
        });
        setWidgetMenuOpen(false);
      }
      
      dragStateRef.current = null;
      setDragState(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function renderEditableText(field, fallback, className, tag = "p", textColorOverride) {
    const value = form[field] || "";
    const content = value || fallback;
    const textColor = textColorOverride ?? (field === "showcaseHeadline" || field === "showcaseSubheadline" ? blockStyles.title?.color : undefined);

    let colorStyle = {};
    if (textColor) {
      colorStyle =
        tag === "h2"
          ? {
              color: textColor,
              background: "none",
              backgroundImage: "none",
              WebkitBackgroundClip: "unset",
              backgroundClip: "unset",
            }
          : { color: textColor };
    }

    const Component = tag;
    return (
      <Component
        className={`${className} editable-inline`}
        data-rich-sync={`form|${field}`}
        style={{
          ...colorStyle,
          cursor: "text",
          transition: "all 0.2s",
        }}
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => updateField(field, e.currentTarget.innerHTML)}
        onKeyDown={(e) => {
          if (tag === "h2" && e.key === "Enter") e.preventDefault();
        }}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  function getBlockStyle(blockKey) {
    const defaults = DEFAULT_LAYOUT[blockKey] || { x: 0, y: 0, w: 100, h: 200 };
    const block = layout?.[blockKey] || {};
    const x = coerceLayoutNumber(block.x, defaults.x);
    const y = coerceLayoutNumber(block.y, defaults.y);
    const wRaw = coerceLayoutNumber(block.w, defaults.w);
    const hRaw = coerceLayoutNumber(block.h, defaults.h);
    const w = Math.min(100, Math.max(15, wRaw));
    const h = Math.max(48, hRaw);
    const xClamped = Math.min(100 - w, Math.max(0, x));

    return {
      position: "absolute",
      left: `${xClamped}%`,
      top: `${y}px`,
      width: `${w}%`,
      minHeight: `${h}px`,
      boxSizing: "border-box",
    };
  }

  function mergedBlockWrapper(blockKey) {
    const base = { ...getBlockStyle(blockKey) };
    const bs = blockStyles[blockKey];
    const hasBanner = blockHasBackgroundImage(bs);
    const z = activeBlock === blockKey ? 50 : (hasBanner ? 0 : 10);

    if (hasBanner) {
      return { 
        ...base, 
        ...sectionSurfaceStyle(bs),
        left: 0,
        width: "100%",
        boxSizing: "border-box",
        zIndex: z,
        backgroundPosition: "top center"
      };
    }
    return { 
      ...base, 
      ...mergeBlockWrapperStyle(bs),
      zIndex: z
    };
  }

  function sectionBgClass(blockKey) {
    return blockHasBackgroundImage(blockStyles[blockKey]) ? " showcase-section-has-bg" : "";
  }

  function headerInnerStyle() {
    const bs = blockStyles.header || {};
    const primary = previewTenant.primaryColor || "#6366f1";
    if (blockHasBackgroundImage(bs)) {
      return {
        background: "transparent",
        ...(bs.color ? { color: bs.color } : {}),
      };
    }
    if (bs.backgroundColor) {
      return {
        background: bs.backgroundColor,
        ...(bs.color ? { color: bs.color } : {}),
      };
    }
    return {
      background: `linear-gradient(135deg, ${primary}55, rgba(255,255,255,0.03))`,
      ...(bs.color ? { color: bs.color } : {}),
    };
  }

  const canvasHeight = useMemo(() => {
    const blocks = Object.keys(DEFAULT_BLOCK_LABELS).map(k => layout?.[k] || DEFAULT_LAYOUT?.[k] || {});
    const maxBottom = blocks.reduce((acc, block) => Math.max(acc, (block.y ?? 0) + (block.h ?? 200)), 0);
    return Math.max(1800, maxBottom + 40);
  }, [layout]);

  function renderEditableSingleLine(field, fallback, className, color) {
    return (
      <span
        className={`${className} editable-inline`}
        data-rich-sync={`form|${field}`}
        style={{ ...(color ? { color } : {}), cursor: "text" }}
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => updateField(field, e.currentTarget.innerHTML)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
        dangerouslySetInnerHTML={{ __html: form[field] || fallback }}
      />
    );
  }

  return (
    <div
      className={`showcase-body showcase-editor-full ${isLightMode ? "showcase-theme-light" : ""} page-transition`}
      style={previewStyle}
    >
      <style>{`
        .builder-block {
          border-color: transparent !important;
          transition: border-color 0.2s ease-in-out;
        }
        .builder-block:hover {
          border-color: rgba(255, 255, 255, 0.3) !important;
        }
        .showcase-theme-light .builder-block:hover {
          border-color: rgba(15, 23, 42, 0.3) !important;
        }
        
        .builder-block.is-active {
          border-color: rgba(255, 255, 255, 0.5) !important;
          z-index: 50;
        }
        .showcase-theme-light .builder-block.is-active {
          border-color: rgba(15, 23, 42, 0.5) !important;
        }

        .builder-block .builder-block-handle,
        .builder-block .builder-delete-icon,
        .builder-block .builder-block-toolbar,
        .builder-block .builder-resize-handle {
          opacity: 0;
          visibility: hidden;
          transition: all 0.2s ease-in-out;
        }
        .builder-block:hover .builder-block-handle,
        .builder-block:hover .builder-delete-icon,
        .builder-block:hover .builder-block-toolbar,
        .builder-block:hover .builder-resize-handle,
        .builder-block.is-active .builder-block-handle,
        .builder-block.is-active .builder-delete-icon,
        .builder-block.is-active .builder-block-toolbar,
        .builder-block.is-active .builder-resize-handle {
          opacity: 1;
          visibility: visible;
        }

        .highlight-box-editable .highlight-mini-toolbar {
          opacity: 0;
          visibility: hidden;
          transition: all 0.2s ease;
        }
        .highlight-box-editable:hover .highlight-mini-toolbar {
          opacity: 1;
          visibility: visible;
        }

        .widget-card .widget-delete,
        .widget-card .highlight-mini-toolbar {
          opacity: 0;
          visibility: hidden;
          transition: all 0.2s ease;
        }
        .widget-card:hover .widget-delete,
        .widget-card:hover .highlight-mini-toolbar {
          opacity: 1;
          visibility: visible;
        }
        
        /* ADICIONE ESTA NOVA REGRA AQUI: */
        .editable-inline span[style*="color"],
        .editable-inline font[color] {
          -webkit-text-fill-color: currentcolor !important;
          -webkit-background-clip: initial !important;
          background: none !important;
        }
      `}</style>

{textSelection
        ? createPortal(
            <div
              ref={formatToolbarRef}
              className="text-format-toolbar"
              role="presentation"
              contentEditable={false}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              style={{
                position: "fixed",
                top: textSelection.y - 10,
                left: textSelection.x,
                transform: "translate(-50%, -100%)",
                background: "#1e293b",
                padding: "8px",
                borderRadius: "8px",
                zIndex: 2147483647,
                display: "flex",
                gap: "8px",
                alignItems: "center",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.1)",
                userSelect: "none",
                pointerEvents: "auto",
              }}
            >
              <input
                type="color"
                title="Cor da fonte"
                defaultValue="#6366f1"
                onChange={(e) => applyFormat("foreColor", e.currentTarget.value)}
                style={{ width: "28px", height: "28px", padding: 0, border: "none", borderRadius: "4px", cursor: "pointer" }}
              />
              <select
                title="Família da Fonte"
                onChange={(e) => applyFormat("fontName", e.target.value)}
                style={{
                  padding: "4px 8px",
                  borderRadius: "4px",
                  background: "rgba(0,0,0,0.3)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: "12px",
                  outline: "none",
                }}
              >
                <option value="">Fonte Padrão</option>
                <option value="Arial">Arial</option>
                <option value="Georgia">Georgia</option>
                <option value="Courier New">Courier New</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Verdana">Verdana</option>
              </select>
              <select
                title="Tamanho da Fonte"
                onChange={(e) => applyFormat("fontSize", e.target.value)}
                style={{
                  padding: "4px 8px",
                  borderRadius: "4px",
                  background: "rgba(0,0,0,0.3)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: "12px",
                  outline: "none",
                }}
              >
                <option value="">Tamanho</option>
                <option value="1">Muito Pequeno</option>
                <option value="2">Pequeno</option>
                <option value="3">Normal</option>
                <option value="4">Médio</option>
                <option value="5">Grande</option>
                <option value="6">Muito Grande</option>
                <option value="7">Gigante</option>
              </select>
            </div>,
            document.body
          )
        : null}

      <div className="showcase-editor-topbar" style={{ padding: "12px 24px", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
        
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div>
            <strong style={{ fontSize: "16px", display: "block" }}>Editor de Vitrine</strong>
            <span className="editor-status" style={{ fontSize: "12px", color: success ? "#4ade80" : "var(--text-muted)", transition: "color 0.3s" }}>
              {loadingInitial ? "Carregando..." : saving ? "Salvando..." : success ? "✓ Alterações salvas" : "Pronto para edição"}
            </span>
          </div>
        </div>

        <div className="showcase-editor-actions" style={{ gap: "20px" }}>
          
          <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "rgba(255,255,255,0.05)", padding: "6px 12px", borderRadius: "12px" }}>
            <span className="editor-mode-group" style={{ border: "none", padding: 0 }}>
              <button type="button" className={!isLightMode ? "active" : ""} onClick={() => setAppearanceMode("dark")} style={{ borderRadius: "8px 0 0 8px" }}>
                Dark
              </button>
              <button type="button" className={isLightMode ? "active" : ""} onClick={() => setAppearanceMode("light")} style={{ borderRadius: "0 8px 8px 0" }}>
                Light
              </button>
            </span>
            
            <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.1)" }} />
            
            <select 
              value={currentTheme} 
              onChange={(e) => applyPreset(e.target.value)}
              style={{ width: "auto", minWidth: "140px", padding: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <option value="PERSONALIZADO" disabled>Cor Personalizada</option>
              <option value="CLASSICO">Tema Clássico</option>
              <option value="PALETA_AZUL">Paleta Azul</option>
              <option value="ESMERALDA">Tema Esmeralda</option>
              <option value="OCEANO">Tema Oceano</option>
            </select>

            <div style={{ display: "flex", gap: "8px" }}>
              <label className="input-label compact" title="Cor Primária">
                <input type="color" value={form.primaryColor} onChange={(e) => updateField("primaryColor", e.target.value)} style={{ width: "28px", height: "28px", border: "none" }} />
              </label>
              <label className="input-label compact" title="Cor Secundária">
                <input type="color" value={form.secondaryColor} onChange={(e) => updateField("secondaryColor", e.target.value)} style={{ width: "28px", height: "28px", border: "none" }}/>
              </label>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button type="button" className="button-secondary" onClick={resetLayoutOnly} title="Restaura posições e tamanhos">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px" }}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              Posições
            </button>
            <button type="button" className="button-secondary" onClick={resetAllBuilder} title="Restaura tudo para o estado padrão" style={{ color: "#fca5a5", borderColor: "rgba(239, 68, 68, 0.3)" }}>
              Resetar Tudo
            </button>
          </div>

          <div style={{ width: "1px", height: "30px", background: "rgba(255,255,255,0.1)" }} />

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Link className="link-button" to={`/vitrine/${tenantSlug}`} target="_blank" style={{ padding: "10px 16px" }}>
              Ver Site
            </Link>
          </div>
        </div>
      </div>

      {error ? <div className="error" style={{ margin: "24px 24px 0" }}>{error}</div> : null}

      <div 
        className="showcase-container showcase-builder-canvas" 
        ref={canvasRef} 
        onClick={(e) => {
          if (e.target === canvasRef.current) setActiveBlock(null);
        }}
        style={{ 
          position: "relative",
          width: "100%",
          maxWidth: "100%",
          overflow: "hidden",
          minHeight: `${canvasHeight}px`,
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          marginTop: "24px",
          borderRadius: "24px",
          border: "1px solid rgba(255,255,255,0.05)"
        }}
      >
        {snapCenterActive ? <div className="builder-snap-guide" aria-hidden /> : null}
        
        {snapTopActive ? (
          <div 
            className="builder-snap-guide-top" 
            aria-hidden 
            style={{ position: "absolute", top: 0, left: 0, right: 0, height: "4px", background: "#4ade80", zIndex: 9999, boxShadow: "0 0 12px #4ade80" }} 
          />
        ) : null}

        {isBlockVisible("header") ? (
        <section className={`builder-block${sectionBgClass("header")} ${activeBlock === "header" ? "is-active" : ""}`} style={mergedBlockWrapper("header")} onClick={() => setActiveBlock("header")}>
          <BlockStyleToolbar
            label="Barra de Navegação"
            blockKey="header"
            styles={blockStyles}
            onChange={updateBlockStyle}
            onClear={clearBlockStyle}
          />
          <header style={{ ...headerInnerStyle(), display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 40px", width: "100%", boxSizing: "border-box" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: "bold", overflow: "hidden" }}>
                {previewTenant.logoUrl ? (
                  <img src={previewTenant.logoUrl} alt={previewTenant.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  (previewTenant.name || "D").charAt(0).toUpperCase()
                )}
              </div>
              <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700", ...(blockStyles.header?.color ? { color: blockStyles.header.color } : {}) }}>
                {previewTenant.name}
              </h1>
            </div>
            
            <nav style={{ display: "flex", gap: "32px", alignItems: "center" }}>
              <a href="#preview-destaques" style={{ color: blockStyles.header?.color || "inherit", textDecoration: "none", fontSize: "16px", fontWeight: "600", cursor: "pointer" }}>
                Ver imóveis
              </a>
              <a href="#footer" style={{ color: blockStyles.header?.color || "inherit", textDecoration: "none", fontSize: "16px", fontWeight: "600", cursor: "pointer" }}>
                Sobre nós
              </a>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--accent)", color: "#fff", padding: "10px 20px", borderRadius: "8px", fontWeight: "600" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                {renderEditableSingleLine("whatsapp", "5511999999999", "editable-inline", "#ffffff")}
              </div>
            </nav>
          </header>
        </section>
        ) : null}

        {isBlockVisible("title") ? (
        <section className={`builder-block${sectionBgClass("title")} ${activeBlock === "title" ? "is-active" : ""}`} style={mergedBlockWrapper("title")} onClick={() => setActiveBlock("title")}>
          <div className="builder-block-handle" onPointerDown={(event) => startBuilderAction("title", "drag", event)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px" }}><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
            Hero / Título
          </div>
          <button type="button" className="builder-delete-icon" onClick={() => hideBlock("title")} title="Remover bloco">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
          <BlockStyleToolbar label="Título Principal" blockKey="title" styles={blockStyles} onChange={updateBlockStyle} onClear={clearBlockStyle} />
          <section
            className={`showcase-title-section${blockStyles.title?.color ? " showcase-title-section--custom-text" : ""}`}
            style={{ ...mergeBlockWrapperStyle(blockStyles.title), padding: "40px 0" }}
          >
            {renderEditableText("showcaseHeadline", previewHeadline, "editor-headline", "h2")}
            {renderEditableText("showcaseSubheadline", previewSubheadline, "", "p")}
          </section>
          <div className="builder-resize-handle" onPointerDown={(event) => startBuilderAction("title", "resize", event)} />
        </section>
        ) : null}

        {isBlockVisible("highlights") ? (
        <section className={`builder-block${sectionBgClass("highlights")} ${activeBlock === "highlights" ? "is-active" : ""}`} style={mergedBlockWrapper("highlights")} onClick={() => setActiveBlock("highlights")}>
          <div className="builder-block-handle" onPointerDown={(event) => startBuilderAction("highlights", "drag", event)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px" }}><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
            Destaques
          </div>
          <button type="button" className="builder-delete-icon" onClick={() => hideBlock("highlights")} title="Remover bloco">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
          <BlockStyleToolbar
            label="Área de Destaques"
            blockKey="highlights"
            styles={blockStyles}
            onChange={updateBlockStyle}
            onClear={clearBlockStyle}
          />
          <div className="builder-highlight-actions" style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
            <button type="button" onClick={addHighlight} className="button-secondary" style={{ padding: "8px 16px", borderRadius: "8px" }}>
              + Adicionar Destaque
            </button>
          </div>
          <section className="showcase-highlights" style={mergeBlockWrapperStyle(blockStyles.highlights)}>
            {showcaseConfig.highlights.map((item, index) => {
              const hs = showcaseConfig.highlightStyles[index] || { backgroundColor: "", color: "" };
              return (
                <div className="highlight-box highlight-box-editable" key={`highlight-${index}`} style={{ ...mergeBlockWrapperStyle(hs), transition: "all 0.3s" }}>
                  <div className="highlight-mini-toolbar" onPointerDown={(e) => e.stopPropagation()}>
                    <label className="builder-color-mini">
                      Fundo
                      <input
                        type="color"
                        value={hs.backgroundColor || "#1e293b"}
                        onChange={(e) => updateHighlightStyle(index, "backgroundColor", e.target.value)}
                        style={{ width: "20px", height: "20px" }}
                      />
                    </label>
                    <label className="builder-color-mini">
                      Texto
                      <input type="color" value={hs.color || "#f8fafc"} onChange={(e) => updateHighlightStyle(index, "color", e.target.value)} style={{ width: "20px", height: "20px" }} />
                    </label>
                    <button type="button" className="builder-toolbar-clear" onClick={() => clearHighlightStyle(index)} style={{ padding: "2px 6px" }}>
                      Limpar
                    </button>
                    <button type="button" className="builder-remove-highlight" onClick={() => removeHighlight(index)} disabled={showcaseConfig.highlights.length <= 1} style={{ padding: "2px 6px", borderRadius: "4px" }}>
                      X
                    </button>
                  </div>
                  <h3
                    className="editable-inline"
                    data-rich-sync={`highlight|${index}|title`}
                    style={{ ...(hs.color ? { color: hs.color } : {}), cursor: "text", display: "inline-block", width: "100%" }}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => updateHighlight(index, "title", e.currentTarget.innerHTML)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.preventDefault();
                    }}
                    dangerouslySetInnerHTML={{ __html: item.title }}
                  />
                  <p
                    className="editable-inline"
                    data-rich-sync={`highlight|${index}|description`}
                    style={{ ...(hs.color ? { color: hs.color } : {}), cursor: "text", display: "inline-block", width: "100%" }}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => updateHighlight(index, "description", e.currentTarget.innerHTML)}
                    dangerouslySetInnerHTML={{ __html: item.description }}
                  />
                </div>
              );
            })}
          </section>
          <div className="builder-resize-handle" onPointerDown={(event) => startBuilderAction("highlights", "resize", event)} />
        </section>
        ) : null}

        {isBlockVisible("properties") ? (
        <section className={`builder-block${sectionBgClass("properties")} ${activeBlock === "properties" ? "is-active" : ""}`} style={mergedBlockWrapper("properties")} onClick={() => setActiveBlock("properties")}>
          <div className="builder-block-handle" onPointerDown={(event) => startBuilderAction("properties", "drag", event)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px" }}><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
            Lista de Imóveis
          </div>
          <button type="button" className="builder-delete-icon" onClick={() => hideBlock("properties")} title="Remover bloco">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
          <BlockStyleToolbar
            label="Vitrine de Imóveis"
            blockKey="properties"
            styles={blockStyles}
            onChange={updateBlockStyle}
            onClear={clearBlockStyle}
          />
          <div id="preview-destaques" className="property-grid" style={mergeBlockWrapperStyle(blockStyles.properties)}>
            {previewProperties.map((p) => {
              const images = p.images?.length ? p.images : [{ url: "/property-placeholder.svg" }];
              const currentIndex = carouselIndexes[p.id] || 0;
              const mainImage = images[currentIndex]?.url;
              return (
                <article key={p.id} className="property-card-luxury">
                  <div className="card-image-wrapper">
                    <img src={mainImage} alt={p.title} />
                    {images.length > 1 ? (
                      <>
                        <button type="button" className="carousel-btn prev" onClick={() => prevImage(p.id, images.length)}>
                          ‹
                        </button>
                        <button type="button" className="carousel-btn next" onClick={() => nextImage(p.id, images.length)}>
                          ›
                        </button>
                        <span className="carousel-counter">
                          {currentIndex + 1}/{images.length}
                        </span>
                      </>
                    ) : null}
                    <span className="featured-badge">Disponível</span>
                  </div>
                  <div className="card-info-wrapper">
                    <h3>{p.title}</h3>
                    <div className="card-location">
                      <span>
                        {p.neighborhood}, {p.city} - {p.state}
                      </span>
                    </div>
                    <p className="hint" style={{ textAlign: "left", marginTop: 0 }}>
                      {p.description}
                    </p>
                    <div className="card-price-wrapper">
                      <div>
                        <span className="price-label">Valor</span>
                        <p className="card-price">
                          R$ {Number(p.price).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                      </div>
                    </div>
                    <span className="btn-view-details" style={{ pointerEvents: "none", opacity: 0.85 }}>
                      Ver detalhes do imóvel
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="builder-resize-handle" onPointerDown={(event) => startBuilderAction("properties", "resize", event)} />
        </section>
        ) : null}

        {isBlockVisible("widgets") ? (
        <section className={`builder-block${sectionBgClass("widgets")} ${activeBlock === "widgets" ? "is-active" : ""}`} style={mergedBlockWrapper("widgets")} onClick={() => setActiveBlock("widgets")}>
          <div className="builder-block-handle" onPointerDown={(event) => startBuilderAction("widgets", "drag", event)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px" }}><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
            Widgets Extras
          </div>
          <button type="button" className="builder-delete-icon" onClick={() => hideBlock("widgets")} title="Remover bloco">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
          <BlockStyleToolbar label="Área de Widgets" blockKey="widgets" styles={blockStyles} onChange={updateBlockStyle} onClear={clearBlockStyle} />
          
          <div id="widgets-drop-zone" className="widget-grid" style={mergeBlockWrapperStyle(blockStyles.widgets)}>
            {showcaseConfig.widgets.length === 0 && (!dragState || dragState.snapIndex === -1) ? (
              <div style={{ textAlign: "center", padding: "40px", border: "1px dashed rgba(255,255,255,0.2)", borderRadius: "16px", gridColumn: "1 / -1" }}>
                <p className="hint" style={{ marginTop: 0 }}>
                  Nenhum widget adicionado. Arraste do menu ou use o botão + no canto inferior direito.
                </p>
              </div>
            ) : null}
            
            {(() => {
              const renderedCards = showcaseConfig.widgets.map((widget, index) => (
                <article key={widget.id} className="widget-card" style={{ ...mergeBlockWrapperStyle(widget), transition: "all 0.3s" }}>
                  <button type="button" className="builder-delete-icon widget-delete" onClick={() => removeWidget(index)} title="Remover widget">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                  <div className="highlight-mini-toolbar" onPointerDown={(e) => e.stopPropagation()}>
                    <label className="builder-color-mini">
                      Fundo
                      <input type="color" value={widget.backgroundColor || "#1e293b"} onChange={(e) => updateWidget(index, "backgroundColor", e.target.value)} style={{ width: "20px", height: "20px" }} />
                    </label>
                    <label className="builder-color-mini">
                      Texto
                      <input type="color" value={widget.color || "#f8fafc"} onChange={(e) => updateWidget(index, "color", e.target.value)} style={{ width: "20px", height: "20px" }} />
                    </label>
                  </div>
                  <h3
                    className="editable-inline"
                    data-rich-sync={`widget|${index}|title`}
                    style={{ cursor: "text", display: "inline-block", width: "100%" }}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => updateWidget(index, "title", e.currentTarget.innerHTML)}
                    dangerouslySetInnerHTML={{ __html: widget.title }}
                  />
                  <p
                    className="editable-inline"
                    data-rich-sync={`widget|${index}|content`}
                    style={{ cursor: "text", display: "inline-block", width: "100%" }}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => updateWidget(index, "content", e.currentTarget.innerHTML)}
                    dangerouslySetInnerHTML={{ __html: widget.content }}
                  />
                  {widget.type === "cta" ? (
                    <div style={{ marginTop: "16px", padding: "12px", background: "rgba(0,0,0,0.2)", borderRadius: "8px" }}>
                      <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: "600", textTransform: "uppercase" }}>Configuração do Botão</p>
                      <span
                        className="editable-inline"
                        data-rich-sync={`widget|${index}|ctaLabel`}
                        style={{ cursor: "text", display: "inline-block", width: "100%", background: "var(--accent)", color: "#fff", padding: "8px", borderRadius: "6px", textAlign: "center", fontWeight: "600", marginBottom: "8px" }}
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => updateWidget(index, "ctaLabel", e.currentTarget.innerHTML)}
                        dangerouslySetInnerHTML={{ __html: widget.ctaLabel || "Texto do Botão" }}
                      />
                      <span
                        className="editable-inline"
                        data-rich-sync={`widget|${index}|ctaUrl`}
                        style={{ cursor: "text", display: "inline-block", width: "100%", fontSize: "12px", color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.1)", padding: "4px 8px", borderRadius: "4px" }}
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => updateWidget(index, "ctaUrl", e.currentTarget.innerHTML)}
                        dangerouslySetInnerHTML={{ __html: widget.ctaUrl || "https://link.com" }}
                      />
                    </div>
                  ) : null}
                </article>
              ));

              if (dragState && dragState.snapIndex !== -1) {
                const previewElement = (
                  <article key="dnd-preview" className="widget-card preview-card" style={{ border: '2px dashed var(--accent)', background: 'rgba(255,255,255,0.05)', opacity: 0.9, pointerEvents: 'none', transform: 'scale(1.02)', transition: 'all 0.2s', zIndex: 10 }}>
                    <h3 style={{color: 'var(--accent)', marginTop: 0}} dangerouslySetInnerHTML={{ __html: dragState.template.title }} />
                    <p dangerouslySetInnerHTML={{ __html: dragState.template.content }} />
                    {dragState.template.type === 'cta' ? (
                      <div style={{ marginTop: "16px", padding: "8px", background: "var(--accent)", color: "#fff", borderRadius: "6px", textAlign: "center", fontWeight: "600" }} dangerouslySetInnerHTML={{ __html: dragState.template.ctaLabel || "Texto do Botão" }} />
                    ) : null}
                  </article>
                );
                renderedCards.splice(dragState.snapIndex, 0, previewElement);
              }
              return renderedCards;
            })()}
          </div>
          <div className="builder-resize-handle" onPointerDown={(event) => startBuilderAction("widgets", "resize", event)} />
        </section>
        ) : null}

        {isBlockVisible("footer") ? (
        <section className={`builder-block${sectionBgClass("footer")} ${activeBlock === "footer" ? "is-active" : ""}`} style={mergedBlockWrapper("footer")} onClick={() => setActiveBlock("footer")}>
          <div className="builder-block-handle" onPointerDown={(event) => startBuilderAction("footer", "drag", event)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px" }}><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
            Rodapé
          </div>
          <button type="button" className="builder-delete-icon" onClick={() => hideBlock("footer")} title="Remover bloco">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
          <BlockStyleToolbar label="Rodapé" blockKey="footer" styles={blockStyles} onChange={updateBlockStyle} onClear={clearBlockStyle} />
          <footer
            style={{
              marginTop: "20px",
              paddingTop: "40px",
              textAlign: "center",
              ...mergeBlockWrapperStyle(blockStyles.footer),
            }}
          >
            <p
              className="editable-inline"
              data-rich-sync="footerTitle"
              style={{
                fontSize: "18px",
                fontWeight: "700",
                marginBottom: "12px",
                color: blockStyles.footer?.color || "#fff",
                cursor: "text"
              }}
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) =>
                updateShowcaseConfig((prev) => ({
                  ...prev,
                  footerTitle: e.currentTarget.innerHTML,
                }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              dangerouslySetInnerHTML={{ __html: showcaseConfig.footerTitle }}
            />
            {renderEditableText(
              "description",
              "Domus Showcase - Encontre seu próximo imóvel com segurança e transparência.",
              "editable-footer",
              "p",
              blockStyles.footer?.color
            )}
            
            <div style={{ display: "flex", justifyContent: "center", gap: "24px", marginTop: "20px", flexWrap: "wrap" }}>
              <p style={{ fontSize: "13px", color: blockStyles.footer?.color || "var(--text-muted)" }}>
                Email:{" "}
                {renderEditableSingleLine("email", "contato@imobiliaria.com", "editable-inline small-inline", blockStyles.footer?.color)}
              </p>
              <p style={{ fontSize: "13px", color: blockStyles.footer?.color || "var(--text-muted)" }}>
                WhatsApp:{" "}
                {renderEditableSingleLine("whatsapp", "5511999999999", "editable-inline small-inline", blockStyles.footer?.color)}
              </p>
            </div>
            
          </footer>
          <div className="builder-resize-handle" onPointerDown={(event) => startBuilderAction("footer", "resize", event)} />
        </section>
        ) : null}
      </div>

      <div className="widget-fab-shell">
        {widgetMenuOpen ? <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: -1, animation: "fadeIn 0.2s" }} onClick={() => setWidgetMenuOpen(false)} /> : null}
        
        {widgetMenuOpen ? (
          <div className="widget-fab-menu" style={{ 
            padding: "20px", 
            boxShadow: "0 20px 40px rgba(0,0,0,0.5)", 
            width: "320px",
            animation: "chicEntrance 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards",
            transformOrigin: "bottom right"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#fff", margin: 0 }}>Adicionar Widget</h3>
              <button onClick={() => setWidgetMenuOpen(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            
            <div style={{ display: "grid", gap: "12px", maxHeight: "60vh", overflowY: "auto", paddingRight: "4px" }}>
              {WIDGET_LIBRARY.map((template) => (
                <button 
                  key={template.type} 
                  type="button" 
                  onPointerDown={(e) => startWidgetDrag(template, e)}
                  className="button-secondary" 
                  style={{ 
                    padding: "16px", 
                    borderRadius: "12px", 
                    display: "flex", 
                    flexDirection: "column", 
                    alignItems: "flex-start", 
                    gap: "12px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    textAlign: "left",
                    cursor: "grab"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", pointerEvents: "none" }}>
                    <div style={{ background: "rgba(255,255,255,0.1)", padding: "6px", borderRadius: "6px" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                    </div>
                    <span style={{ fontWeight: "600", fontSize: "14px" }} dangerouslySetInnerHTML={{ __html: template.title }} />
                  </div>
                  
                  <div style={{ width: "100%", padding: "12px", background: "rgba(0,0,0,0.3)", borderRadius: "8px", border: "1px dashed rgba(255,255,255,0.1)", pointerEvents: "none" }}>
                    <div style={{ width: "40%", height: "6px", background: "#fff", borderRadius: "3px", marginBottom: "8px" }} />
                    {template.preview}
                  </div>
                </button>
              ))}
            </div>
            
            {showcaseConfig.hiddenBlocks.length > 0 ? (
              <>
                <div style={{ height: "1px", background: "rgba(255,255,255,0.1)", margin: "20px 0" }} />
                <h3 style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-muted)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Restaurar Blocos</h3>
                <div style={{ display: "grid", gap: "8px" }}>
                {showcaseConfig.hiddenBlocks
                  .filter(blockKey => blockKey !== "topbar") // Adicione este filtro
                  .map((blockKey) => (
                    <button 
                      key={`restore-${blockKey}`} 
                      type="button" 
                      onClick={() => restoreBlock(blockKey)} 
                      className="button-secondary" 
                      style={{ padding: "10px 16px", borderRadius: "8px", justifyContent: "space-between" }}
                    >
                      <span>{DEFAULT_BLOCK_LABELS[blockKey] || blockKey}</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                    </button>
                ))}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
        
        <button 
          type="button" 
          className="widget-fab-button" 
          onClick={() => setWidgetMenuOpen((v) => !v)} 
          style={{ 
            background: widgetMenuOpen ? "var(--bg-gradient-2)" : "var(--accent)", 
            color: "#fff", 
            border: "none",
            transform: widgetMenuOpen ? "rotate(45deg)" : "rotate(0deg)",
            transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.3s"
          }}
          title={widgetMenuOpen ? "Fechar Menu" : "Adicionar Widgets"}
        >
          +
        </button>
      </div>

      {dragState ? (
        <div style={{
          position: 'fixed',
          left: dragState.x,
          top: dragState.y,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          zIndex: 99999,
          background: 'var(--bg-gradient-2, #1e293b)',
          padding: '16px',
          borderRadius: '12px',
          border: '1px solid var(--accent)',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          width: '240px',
          opacity: (dragState.snapIndex !== -1 && document.getElementById("widgets-drop-zone")) ? 0 : 0.9,
          transition: 'opacity 0.2s'
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: "var(--accent)"}}><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            <span style={{ fontWeight: "600", fontSize: "14px", color: "#fff" }} dangerouslySetInnerHTML={{ __html: dragState.template.title }} />
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Solte para adicionar widget
          </div>
        </div>
      ) : null}
    </div>
  );
}