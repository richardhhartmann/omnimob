import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { saveSession } from "../session";
import {
  DEFAULT_LAYOUT,
  mergeBlockWrapperStyle,
  normalizeShowcaseConfig,
} from "../utils/showcaseConfig";

const PRESET_THEMES = {
  CLASSICO: { primaryColor: "#6366f1", secondaryColor: "#d4af37" },
  PALETA_AZUL: { primaryColor: "#2563eb", secondaryColor: "#f8fafc" },
  ESMERALDA: { primaryColor: "#10b981", secondaryColor: "#14b8a6" },
  OCEANO: { primaryColor: "#0ea5e9", secondaryColor: "#38bdf8" },
};

const WIDGET_LIBRARY = [
  {
    type: "text",
    title: "Bloco de texto",
    content: "Use este bloco para descrever diferenciais, condicoes especiais ou informacoes adicionais.",
  },
  {
    type: "cta",
    title: "Chamada para acao",
    content: "Fale com nossa equipe e receba as melhores opcoes para seu perfil.",
    ctaLabel: "Falar no WhatsApp",
    ctaUrl: "https://wa.me/",
  },
  {
    type: "note",
    title: "Aviso",
    content: "Documentacao e simulacao de financiamento sob analise da imobiliaria.",
  },
];

const DEFAULT_BLOCK_LABELS = {
  topbar: "Header superior",
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
  const s = styles[blockKey] || { backgroundColor: "", color: "" };
  return (
    <div className="builder-block-toolbar" onPointerDown={(e) => e.stopPropagation()}>
      <span className="builder-toolbar-label">{label}</span>
      <label className="builder-color-mini">
        Fundo
        <input
          type="color"
          value={s.backgroundColor || "#1e293b"}
          onChange={(e) => onChange(blockKey, "backgroundColor", e.target.value)}
        />
      </label>
      <label className="builder-color-mini">
        Texto
        <input type="color" value={s.color || "#f8fafc"} onChange={(e) => onChange(blockKey, "color", e.target.value)} />
      </label>
      <button type="button" className="builder-toolbar-clear" onClick={() => onClear(blockKey)}>
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
  const [snapCenterActive, setSnapCenterActive] = useState(false);
  const [widgetMenuOpen, setWidgetMenuOpen] = useState(false);
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

  function applyPreset(themeKey) {
    const preset = PRESET_THEMES[themeKey];
    if (!preset) return;
    setForm((prev) => ({ ...prev, primaryColor: preset.primaryColor, secondaryColor: preset.secondaryColor }));
  }

  function setAppearanceMode(mode) {
    updateShowcaseConfig((prev) => ({ ...prev, appearanceMode: mode }));
  }

  function resetLayoutOnly() {
    updateShowcaseConfig((prev) => ({
      ...prev,
      layout: Object.fromEntries(Object.entries(DEFAULT_LAYOUT).map(([k, v]) => [k, { ...v }])),
    }));
  }

  function resetAllBuilder() {
    updateShowcaseConfig(() => normalizeShowcaseConfig(null));
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
        [blockKey]: { backgroundColor: "", color: "" },
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

  const previewHeadline = previewTenant.showcaseHeadline || "Encontre o imovel ideal para seu proximo passo";
  const previewSubheadline =
    previewTenant.showcaseSubheadline ||
    "Compare opcoes, visualize fotos detalhadas e converse com a imobiliaria em poucos cliques.";
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
        setSuccess("Alteracoes salvas em tempo real.");
      } catch (err) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
    }, 500);

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
    actionRef.current = {
      blockKey,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startBlock: { ...layout[blockKey] },
      canvasWidth: rect.width,
    };

    const onMove = (moveEvent) => {
      const action = actionRef.current;
      if (!action || !canvasRef.current) return;
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const dxPx = moveEvent.clientX - action.startX;
      const dyPx = moveEvent.clientY - action.startY;
      const dxPercent = (dxPx / Math.max(canvasRect.width, 1)) * 100;

      if (action.mode === "resize") {
        setSnapCenterActive(false);
        updateShowcaseConfig((prev) => {
          const blockKeyInner = action.blockKey;
          const nextW = clamp(action.startBlock.w + dxPercent, 20, 100 - action.startBlock.x);
          return {
            ...prev,
            layout: {
              ...prev.layout,
              [blockKeyInner]: {
                ...prev.layout[blockKeyInner],
                w: nextW,
                h: Math.max(120, action.startBlock.h + dyPx),
              },
            },
          };
        });
        return;
      }

      const startBlock = action.startBlock;
      const blockKeyInner = action.blockKey;
      let nextX = clamp(startBlock.x + dxPercent, 0, 100 - startBlock.w);
      const center = nextX + startBlock.w / 2;
      const thresholdPct = (8 / Math.max(canvasRect.width, 1)) * 100;
      let snapped = false;
      if (Math.abs(center - 50) <= thresholdPct) {
        nextX = clamp(50 - startBlock.w / 2, 0, 100 - startBlock.w);
        snapped = true;
      }
      setSnapCenterActive(snapped);

      updateShowcaseConfig((prev) => ({
        ...prev,
        layout: {
          ...prev.layout,
          [blockKeyInner]: {
            ...prev.layout[blockKeyInner],
            x: nextX,
            y: Math.max(0, startBlock.y + dyPx),
          },
        },
      }));
    };

    const onUp = () => {
      setSnapCenterActive(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      actionRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function renderEditableText(field, fallback, className, tag = "p", textColorOverride) {
    const value = form[field] || "";
    const content = value || fallback;
    const textColor = textColorOverride ?? (field === "showcaseHeadline" || field === "showcaseSubheadline" ? blockStyles.title?.color : undefined);
    if (tag === "h2") {
      return (
        <h2
          className={`${className} editable-inline`}
          style={textColor ? { color: textColor, WebkitTextFillColor: textColor } : undefined}
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => updateField(field, e.currentTarget.textContent || "")}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
        >
          {content}
        </h2>
      );
    }
    return (
      <p
        className={`${className} editable-inline`}
        style={textColor ? { color: textColor } : undefined}
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => updateField(field, e.currentTarget.textContent || "")}
      >
        {content}
      </p>
    );
  }

  function getBlockStyle(blockKey) {
    const block = layout[blockKey] || DEFAULT_LAYOUT[blockKey];
    return {
      left: `${block.x}%`,
      top: `${block.y}px`,
      width: `${block.w}%`,
      minHeight: `${block.h}px`,
    };
  }

  function mergedBlockWrapper(blockKey) {
    return { ...getBlockStyle(blockKey), ...mergeBlockWrapperStyle(blockStyles[blockKey]) };
  }

  function headerInnerStyle() {
    const bs = blockStyles.header || {};
    const primary = previewTenant.primaryColor || "#6366f1";
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
    const blocks = Object.values(layout || {});
    const maxBottom = blocks.reduce((acc, block) => Math.max(acc, (block?.y || 0) + (block?.h || 0)), 0);
    return Math.max(1800, maxBottom + 40);
  }, [layout]);

  function renderEditableSingleLine(field, fallback, className, color) {
    return (
      <span
        className={`${className} editable-inline`}
        style={color ? { color } : undefined}
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => updateField(field, e.currentTarget.textContent || "")}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
      >
        {form[field] || fallback}
      </span>
    );
  }

  return (
    <div
      className={`showcase-body showcase-editor-full ${isLightMode ? "showcase-theme-light" : ""}`}
      style={previewStyle}
    >
      <div className="showcase-editor-topbar">
        <div>
          <strong>Editor da vitrine</strong>
          <span className="editor-status">{loadingInitial ? " Carregando..." : saving ? " Salvando..." : success ? " Salvo" : ""}</span>
        </div>
        <div className="showcase-editor-actions">
          <button type="button" onClick={resetLayoutOnly} title="Restaura posicoes e tamanhos padrao dos blocos">
            Layout padrao
          </button>
          <button type="button" onClick={resetAllBuilder} title="Restaura tudo para o estado padrao">
            Resetar tudo
          </button>
          <span className="editor-mode-group">
            <span className="editor-toolbar-hint">Modo</span>
            <button type="button" className={!isLightMode ? "active" : ""} onClick={() => setAppearanceMode("dark")}>
              Escuro
            </button>
            <button type="button" className={isLightMode ? "active" : ""} onClick={() => setAppearanceMode("light")}>
              Claro
            </button>
          </span>
          <button type="button" onClick={() => applyPreset("CLASSICO")}>
            Tema Classico
          </button>
          <button type="button" onClick={() => applyPreset("PALETA_AZUL")}>
            Paleta Azul
          </button>
          <button type="button" onClick={() => applyPreset("ESMERALDA")}>
            Tema Esmeralda
          </button>
          <button type="button" onClick={() => applyPreset("OCEANO")}>
            Tema Oceano
          </button>
          <span className="editor-theme-tag">Paleta: {currentTheme}</span>
          <label className="input-label compact">
            Primaria
            <input type="color" value={form.primaryColor} onChange={(e) => updateField("primaryColor", e.target.value)} />
          </label>
          <label className="input-label compact">
            Secundaria
            <input type="color" value={form.secondaryColor} onChange={(e) => updateField("secondaryColor", e.target.value)} />
          </label>
          <Link className="link-button" to={`/vitrine/${tenantSlug}`} target="_blank">
            Acessar
          </Link>
          <Link className="button-secondary" to="/">
            Voltar painel
          </Link>
          <button type="button" className="button-secondary" onClick={onLogout}>
            Sair
          </button>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <div className="showcase-container showcase-builder-canvas" ref={canvasRef} style={{ minHeight: `${canvasHeight}px` }}>
        {snapCenterActive ? <div className="builder-snap-guide" aria-hidden /> : null}

        {isBlockVisible("topbar") ? (
          <section className="builder-block" style={mergedBlockWrapper("topbar")}>
            <div className="builder-block-handle" onPointerDown={(event) => startBuilderAction("topbar", "drag", event)}>
              {DEFAULT_BLOCK_LABELS.topbar}
            </div>
            <button type="button" className="builder-delete-icon" onClick={() => hideBlock("topbar")} title="Remover bloco">
              🗑
            </button>
            <BlockStyleToolbar label="Bloco" blockKey="topbar" styles={blockStyles} onChange={updateBlockStyle} onClear={clearBlockStyle} />
            <section className="showcase-top-header-inline" style={mergeBlockWrapperStyle(blockStyles.topbar)}>
              <p
                className="editable-inline"
                style={blockStyles.topbar?.color ? { color: blockStyles.topbar.color } : undefined}
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) =>
                  updateShowcaseConfig((prev) => ({
                    ...prev,
                    topHeader: { ...prev.topHeader, title: e.currentTarget.textContent || "" },
                  }))
                }
              >
                {showcaseConfig.topHeader.title}
              </p>
              <small
                className="editable-inline"
                style={blockStyles.topbar?.color ? { color: blockStyles.topbar.color } : undefined}
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) =>
                  updateShowcaseConfig((prev) => ({
                    ...prev,
                    topHeader: { ...prev.topHeader, subtitle: e.currentTarget.textContent || "" },
                  }))
                }
              >
                {showcaseConfig.topHeader.subtitle}
              </small>
            </section>
            <div className="builder-resize-handle" onPointerDown={(event) => startBuilderAction("topbar", "resize", event)} />
          </section>
        ) : null}

        {isBlockVisible("header") ? (
        <section className="builder-block" style={mergedBlockWrapper("header")}>
          <div className="builder-block-handle" onPointerDown={(event) => startBuilderAction("header", "drag", event)}>
            Cabecalho
          </div>
          <button type="button" className="builder-delete-icon" onClick={() => hideBlock("header")} title="Remover bloco">
            🗑
          </button>
          <BlockStyleToolbar
            label="Bloco"
            blockKey="header"
            styles={blockStyles}
            onChange={updateBlockStyle}
            onClear={clearBlockStyle}
          />
          <header className="showcase-header" style={headerInnerStyle()}>
            <div className="showcase-top-header-inline">
              <p
                className="editable-inline"
                style={blockStyles.header?.color ? { color: blockStyles.header.color } : undefined}
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) =>
                  updateShowcaseConfig((prev) => ({
                    ...prev,
                    topHeader: { ...prev.topHeader, title: e.currentTarget.textContent || "" },
                  }))
                }
              >
                {showcaseConfig.topHeader.title}
              </p>
              <small
                className="editable-inline"
                style={blockStyles.header?.color ? { color: blockStyles.header.color } : undefined}
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) =>
                  updateShowcaseConfig((prev) => ({
                    ...prev,
                    topHeader: { ...prev.topHeader, subtitle: e.currentTarget.textContent || "" },
                  }))
                }
              >
                {showcaseConfig.topHeader.subtitle}
              </small>
            </div>
            <div className="showcase-brand">
              <div className="brand-logo-exclusive">
                {previewTenant.logoUrl ? (
                  <img src={previewTenant.logoUrl} alt={`Logo ${previewTenant.name}`} className="brand-logo-image" />
                ) : (
                  (previewTenant.name || "D").charAt(0).toUpperCase()
                )}
              </div>
              <div className="brand-title-group">
                <h1 style={blockStyles.header?.color ? { color: blockStyles.header.color } : undefined}>{previewTenant.name}</h1>
                {renderEditableText("slogan", "Atendimento especializado em imoveis", "", "p", blockStyles.header?.color)}
              </div>
            </div>
            <nav className="showcase-nav">
              {renderEditableSingleLine("whatsapp", "5511999999999", "editable-inline small-inline", blockStyles.header?.color)}
            </nav>
          </header>
          <div className="builder-resize-handle" onPointerDown={(event) => startBuilderAction("header", "resize", event)} />
        </section>
        ) : null}

        {isBlockVisible("title") ? (
        <section className="builder-block" style={mergedBlockWrapper("title")}>
          <div className="builder-block-handle" onPointerDown={(event) => startBuilderAction("title", "drag", event)}>
            Hero / titulo
          </div>
          <button type="button" className="builder-delete-icon" onClick={() => hideBlock("title")} title="Remover bloco">
            🗑
          </button>
          <BlockStyleToolbar label="Bloco" blockKey="title" styles={blockStyles} onChange={updateBlockStyle} onClear={clearBlockStyle} />
          <section className="showcase-title-section" style={mergeBlockWrapperStyle(blockStyles.title)}>
            {renderEditableText("showcaseHeadline", previewHeadline, "editor-headline", "h2")}
            {renderEditableText("showcaseSubheadline", previewSubheadline, "", "p")}
          </section>
          <div className="builder-resize-handle" onPointerDown={(event) => startBuilderAction("title", "resize", event)} />
        </section>
        ) : null}

        {isBlockVisible("highlights") ? (
        <section className="builder-block" style={mergedBlockWrapper("highlights")}>
          <div className="builder-block-handle" onPointerDown={(event) => startBuilderAction("highlights", "drag", event)}>
            Highlights
          </div>
          <button type="button" className="builder-delete-icon" onClick={() => hideBlock("highlights")} title="Remover bloco">
            🗑
          </button>
          <BlockStyleToolbar
            label="Area"
            blockKey="highlights"
            styles={blockStyles}
            onChange={updateBlockStyle}
            onClear={clearBlockStyle}
          />
          <div className="builder-highlight-actions">
            <button type="button" onClick={addHighlight}>
              + Adicionar destaque
            </button>
          </div>
          <section className="showcase-highlights" style={mergeBlockWrapperStyle(blockStyles.highlights)}>
            {showcaseConfig.highlights.map((item, index) => {
              const hs = showcaseConfig.highlightStyles[index] || { backgroundColor: "", color: "" };
              return (
                <div className="highlight-box highlight-box-editable" key={`highlight-${index}`} style={mergeBlockWrapperStyle(hs)}>
                  <div className="highlight-mini-toolbar" onPointerDown={(e) => e.stopPropagation()}>
                    <label className="builder-color-mini">
                      Fundo
                      <input
                        type="color"
                        value={hs.backgroundColor || "#1e293b"}
                        onChange={(e) => updateHighlightStyle(index, "backgroundColor", e.target.value)}
                      />
                    </label>
                    <label className="builder-color-mini">
                      Texto
                      <input type="color" value={hs.color || "#f8fafc"} onChange={(e) => updateHighlightStyle(index, "color", e.target.value)} />
                    </label>
                    <button type="button" className="builder-toolbar-clear" onClick={() => clearHighlightStyle(index)}>
                      Limpar
                    </button>
                    <button type="button" className="builder-remove-highlight" onClick={() => removeHighlight(index)} disabled={showcaseConfig.highlights.length <= 1}>
                      Remover
                    </button>
                  </div>
                  <h3
                    className="editable-inline"
                    style={hs.color ? { color: hs.color } : undefined}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => updateHighlight(index, "title", e.currentTarget.textContent || "")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.preventDefault();
                    }}
                  >
                    {item.title}
                  </h3>
                  <p
                    className="editable-inline"
                    style={hs.color ? { color: hs.color } : undefined}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => updateHighlight(index, "description", e.currentTarget.textContent || "")}
                  >
                    {item.description}
                  </p>
                </div>
              );
            })}
          </section>
          <div className="builder-resize-handle" onPointerDown={(event) => startBuilderAction("highlights", "resize", event)} />
        </section>
        ) : null}

        {isBlockVisible("properties") ? (
        <section className="builder-block" style={mergedBlockWrapper("properties")}>
          <div className="builder-block-handle" onPointerDown={(event) => startBuilderAction("properties", "drag", event)}>
            Lista de imoveis
          </div>
          <button type="button" className="builder-delete-icon" onClick={() => hideBlock("properties")} title="Remover bloco">
            🗑
          </button>
          <BlockStyleToolbar
            label="Bloco"
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
                    <span className="featured-badge">Disponivel</span>
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
                      Ver detalhes do imovel
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
        <section className="builder-block" style={mergedBlockWrapper("widgets")}>
          <div className="builder-block-handle" onPointerDown={(event) => startBuilderAction("widgets", "drag", event)}>
            Widgets extras
          </div>
          <button type="button" className="builder-delete-icon" onClick={() => hideBlock("widgets")} title="Remover bloco">
            🗑
          </button>
          <BlockStyleToolbar label="Bloco" blockKey="widgets" styles={blockStyles} onChange={updateBlockStyle} onClear={clearBlockStyle} />
          <div className="widget-grid" style={mergeBlockWrapperStyle(blockStyles.widgets)}>
            {showcaseConfig.widgets.length === 0 ? (
              <p className="hint" style={{ marginTop: 0 }}>
                Nenhum widget adicionado ainda. Use o botao + no canto inferior direito.
              </p>
            ) : null}
            {showcaseConfig.widgets.map((widget, index) => (
              <article key={widget.id} className="widget-card" style={mergeBlockWrapperStyle(widget)}>
                <button type="button" className="builder-delete-icon widget-delete" onClick={() => removeWidget(index)} title="Remover widget">
                  🗑
                </button>
                <div className="highlight-mini-toolbar" onPointerDown={(e) => e.stopPropagation()}>
                  <label className="builder-color-mini">
                    Fundo
                    <input type="color" value={widget.backgroundColor || "#1e293b"} onChange={(e) => updateWidget(index, "backgroundColor", e.target.value)} />
                  </label>
                  <label className="builder-color-mini">
                    Texto
                    <input type="color" value={widget.color || "#f8fafc"} onChange={(e) => updateWidget(index, "color", e.target.value)} />
                  </label>
                </div>
                <h3
                  className="editable-inline"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => updateWidget(index, "title", e.currentTarget.textContent || "")}
                >
                  {widget.title}
                </h3>
                <p
                  className="editable-inline"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => updateWidget(index, "content", e.currentTarget.textContent || "")}
                >
                  {widget.content}
                </p>
                {widget.type === "cta" ? (
                  <p className="hint" style={{ marginTop: "8px", textAlign: "left" }}>
                    CTA: {widget.ctaLabel || "Botao"} {widget.ctaUrl ? `-> ${widget.ctaUrl}` : ""}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
          <div className="builder-resize-handle" onPointerDown={(event) => startBuilderAction("widgets", "resize", event)} />
        </section>
        ) : null}

        {isBlockVisible("footer") ? (
        <section className="builder-block" style={mergedBlockWrapper("footer")}>
          <div className="builder-block-handle" onPointerDown={(event) => startBuilderAction("footer", "drag", event)}>
            Rodape
          </div>
          <button type="button" className="builder-delete-icon" onClick={() => hideBlock("footer")} title="Remover bloco">
            🗑
          </button>
          <BlockStyleToolbar label="Bloco" blockKey="footer" styles={blockStyles} onChange={updateBlockStyle} onClear={clearBlockStyle} />
          <footer
            style={{
              marginTop: "10px",
              borderTop: "1px solid rgba(255,255,255,0.05)",
              paddingTop: "26px",
              textAlign: "center",
              ...mergeBlockWrapperStyle(blockStyles.footer),
            }}
          >
            <p
              className="editable-inline"
              style={{
                fontSize: "16px",
                marginBottom: "10px",
                color: blockStyles.footer?.color || "#fff",
              }}
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) =>
                updateShowcaseConfig((prev) => ({
                  ...prev,
                  footerTitle: e.currentTarget.textContent || "",
                }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
            >
              {showcaseConfig.footerTitle} {previewTenant.name}
            </p>
            {renderEditableText(
              "description",
              "Domus Showcase - Encontre seu proximo imovel com seguranca e transparencia.",
              "editable-footer",
              "p",
              blockStyles.footer?.color
            )}
            <p style={{ fontSize: "12px", marginTop: "8px", color: blockStyles.footer?.color || "var(--text-muted)" }}>
              Email:{" "}
              {renderEditableSingleLine("email", "contato@imobiliaria.com", "editable-inline small-inline", blockStyles.footer?.color)}
            </p>
            <p style={{ fontSize: "12px", marginTop: "4px", color: blockStyles.footer?.color || "var(--text-muted)" }}>
              WhatsApp:{" "}
              {renderEditableSingleLine("whatsapp", "5511999999999", "editable-inline small-inline", blockStyles.footer?.color)}
            </p>
            <p style={{ fontSize: "12px", marginTop: "4px", color: blockStyles.footer?.color || "var(--text-muted)" }}>
              Logo URL: {renderEditableSingleLine("logoUrl", "https://...", "editable-inline small-inline", blockStyles.footer?.color)}
            </p>
          </footer>
          <div className="builder-resize-handle" onPointerDown={(event) => startBuilderAction("footer", "resize", event)} />
        </section>
        ) : null}
      </div>

      <div className="widget-fab-shell">
        {widgetMenuOpen ? (
          <div className="widget-fab-menu">
            <p>Adicionar widget</p>
            {showcaseConfig.hiddenBlocks.length > 0 ? (
              <>
                <p>Restaurar blocos</p>
                {showcaseConfig.hiddenBlocks.map((blockKey) => (
                  <button key={`restore-${blockKey}`} type="button" onClick={() => restoreBlock(blockKey)}>
                    {DEFAULT_BLOCK_LABELS[blockKey] || blockKey}
                  </button>
                ))}
              </>
            ) : null}
            {WIDGET_LIBRARY.map((template) => (
              <button key={template.type} type="button" onClick={() => addWidget(template)}>
                {template.title}
              </button>
            ))}
          </div>
        ) : null}
        <button type="button" className="widget-fab-button" onClick={() => setWidgetMenuOpen((v) => !v)}>
          +
        </button>
      </div>
    </div>
  );
}
