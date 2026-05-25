import { useEffect, useState } from "react";

function SectionTitle({ children }) {
  return (
    <p style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 10px" }}>
      {children}
    </p>
  );
}

function Divider() {
  return <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", margin: "16px 0" }} />;
}

function FieldInput({ label, value, onChange, type = "text", placeholder }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        style={{
          padding: "7px 10px", borderRadius: "8px",
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(0,0,0,0.25)", color: "#fff",
          fontSize: "12px", width: "100%", boxSizing: "border-box", outline: "none",
        }}
      />
    </label>
  );
}

function BlockStyleSection({ blockKey, blockStyles, updateBlockStyle, clearBlockStyle }) {
  const s = blockStyles[blockKey] || {};
  const hasBanner = typeof s.backgroundImage === "string" && s.backgroundImage.trim() !== "";
  const overlayPct = Math.round((typeof s.backgroundOverlay === "number" ? s.backgroundOverlay : 0) * 100);
  const brightSlider = Math.round((typeof s.backgroundBrightness === "number" ? s.backgroundBrightness : 1) * 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <FieldInput
        label="URL de Banner (imagem de fundo)"
        value={s.backgroundImage || ""}
        onChange={(val) => updateBlockStyle(blockKey, "backgroundImage", val)}
        placeholder="https://imagem.com/foto.jpg"
      />

      <label style={{ display: "flex", flexDirection: "column", gap: "4px", opacity: hasBanner ? 0.4 : 1, pointerEvents: hasBanner ? "none" : "auto" }}>
        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>
          Cor de Fundo{hasBanner ? " (bloqueada com banner)" : ""}
        </span>
        <div style={{ position: "relative", height: "34px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: s.backgroundColor || "#1e293b", overflow: "hidden" }}>
          <input type="color" value={s.backgroundColor || "#1e293b"}
            onChange={(e) => updateBlockStyle(blockKey, "backgroundColor", e.target.value)}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }} />
        </div>
      </label>

      {hasBanner ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
              Escurecer <b style={{ color: "#fff" }}>{overlayPct}%</b>
            </span>
            <input type="range" min={0} max={100} value={overlayPct}
              onChange={(e) => updateBlockStyle(blockKey, "backgroundOverlay", Number(e.target.value) / 100)}
              style={{ width: "100%", accentColor: "var(--accent, #818cf8)" }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
              Brilho <b style={{ color: "#fff" }}>{(brightSlider / 100).toFixed(1)}×</b>
            </span>
            <input type="range" min={30} max={200} value={brightSlider}
              onChange={(e) => updateBlockStyle(blockKey, "backgroundBrightness", Number(e.target.value) / 100)}
              style={{ width: "100%", accentColor: "var(--accent, #818cf8)" }}
            />
          </label>
        </div>
      ) : null}

      <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>Cor do Texto</span>
        <div style={{ position: "relative", height: "34px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: s.color || "#f8fafc", overflow: "hidden" }}>
          <input type="color" value={s.color || "#f8fafc"}
            onChange={(e) => updateBlockStyle(blockKey, "color", e.target.value)}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }} />
        </div>
      </label>

      <button type="button" onClick={() => clearBlockStyle(blockKey)}
        style={{ padding: "6px", borderRadius: "7px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5", fontSize: "11px", cursor: "pointer" }}
      >
        Limpar Estilos do Bloco
      </button>
    </div>
  );
}

function PagePanel({
  form, updateField, showcaseConfig,
  isLightMode, setAppearanceMode,
  currentTheme, applyPreset, PRESET_THEMES,
  DEFAULT_BLOCK_LABELS, restoreBlock,
}) {
  const THEME_LABELS = { CLASSICO: "Clássico", PALETA_AZUL: "Azul", ESMERALDA: "Esmeralda", OCEANO: "Oceano" };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <SectionTitle>Aparência</SectionTitle>

      <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
        {[["dark", "🌙 Dark"], ["light", "☀️ Light"]].map(([mode, label]) => {
          const active = (mode === "dark" && !isLightMode) || (mode === "light" && isLightMode);
          return (
            <button key={mode} type="button" onClick={() => setAppearanceMode(mode)}
              style={{
                flex: 1, padding: "8px 4px", borderRadius: "8px", cursor: "pointer",
                fontSize: "12px", fontWeight: active ? "700" : "400",
                border: active ? "1px solid var(--accent, #818cf8)" : "1px solid rgba(255,255,255,0.08)",
                background: active ? "rgba(129,140,248,0.15)" : "rgba(255,255,255,0.03)",
                color: active ? "#fff" : "var(--text-muted)",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <SectionTitle>Tema de Cores</SectionTitle>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "12px" }}>
        {Object.entries(PRESET_THEMES).map(([key, preset]) => {
          const isActive = currentTheme === key;
          return (
            <button key={key} type="button" onClick={() => applyPreset(key)}
              style={{
                padding: "8px 10px", borderRadius: "8px", cursor: "pointer",
                border: isActive ? "1.5px solid var(--accent, #818cf8)" : "1px solid rgba(255,255,255,0.08)",
                background: isActive ? "rgba(129,140,248,0.12)" : "rgba(255,255,255,0.03)",
                display: "flex", alignItems: "center", gap: "6px",
                fontSize: "11px", color: isActive ? "#fff" : "var(--text-muted)",
                fontWeight: isActive ? "600" : "400",
              }}
            >
              <div style={{ display: "flex", gap: "3px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: preset.primaryColor, display: "inline-block" }} />
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: preset.secondaryColor, display: "inline-block" }} />
              </div>
              {THEME_LABELS[key]}
            </button>
          );
        })}
        {currentTheme === "PERSONALIZADO" ? (
          <div style={{
            gridColumn: "1 / -1", padding: "8px 10px", borderRadius: "8px",
            border: "1.5px solid var(--accent, #818cf8)", background: "rgba(129,140,248,0.12)",
            display: "flex", alignItems: "center", gap: "6px",
            fontSize: "11px", color: "#fff", fontWeight: "600",
          }}>
            <div style={{ display: "flex", gap: "3px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: form.primaryColor, display: "inline-block" }} />
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: form.secondaryColor, display: "inline-block" }} />
            </div>
            Personalizado
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>Primária</span>
          <div style={{ position: "relative", height: "34px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: form.primaryColor, cursor: "pointer", overflow: "hidden" }}>
            <input type="color" value={form.primaryColor} onChange={(e) => updateField("primaryColor", e.target.value)}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }} />
          </div>
        </label>
        <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>Secundária</span>
          <div style={{ position: "relative", height: "34px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: form.secondaryColor, cursor: "pointer", overflow: "hidden" }}>
            <input type="color" value={form.secondaryColor} onChange={(e) => updateField("secondaryColor", e.target.value)}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }} />
          </div>
        </label>
      </div>

      <Divider />
      <SectionTitle>Dados da Empresa</SectionTitle>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
        <FieldInput label="Logo URL" value={form.logoUrl} onChange={(v) => updateField("logoUrl", v)} placeholder="https://..." />
        <FieldInput label="Slogan" value={form.slogan} onChange={(v) => updateField("slogan", v)} placeholder="Seu novo endereço..." />
        <FieldInput label="WhatsApp" value={form.whatsapp} onChange={(v) => updateField("whatsapp", v)} placeholder="5511999999999" />
        <FieldInput label="Email" type="email" value={form.email} onChange={(v) => updateField("email", v)} placeholder="contato@..." />
      </div>

      {showcaseConfig.hiddenBlocks.filter((k) => k !== "topbar").length > 0 ? (
        <>
          <Divider />
          <SectionTitle>Blocos Ocultos</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {showcaseConfig.hiddenBlocks.filter((k) => k !== "topbar").map((blockKey) => (
              <button key={`restore-${blockKey}`} type="button" onClick={() => restoreBlock(blockKey)}
                style={{
                  padding: "8px 12px", borderRadius: "8px", cursor: "pointer",
                  border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)",
                  color: "var(--text-muted)", fontSize: "12px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}
              >
                <span>{DEFAULT_BLOCK_LABELS[blockKey] || blockKey}</span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function BlockPanel({
  activeBlock, blockStyles, updateBlockStyle, clearBlockStyle,
  hideBlock, showcaseConfig,
  updateHighlightStyle, addHighlight, removeHighlight,
  updateWidget, removeWidget, addWidget,
  WIDGET_LIBRARY, DEFAULT_BLOCK_LABELS,
}) {
  if (!activeBlock) {
    return (
      <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-muted)" }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.25, marginBottom: "12px", display: "block", margin: "0 auto 12px" }}>
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
        </svg>
        <p style={{ fontSize: "13px", lineHeight: "1.6", margin: 0 }}>
          Clique em qualquer bloco para editar seus detalhes aqui.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
        <span style={{ fontSize: "13px", fontWeight: "700", color: "#fff" }}>
          {DEFAULT_BLOCK_LABELS[activeBlock] || activeBlock}
        </span>
        <button type="button" onClick={() => hideBlock(activeBlock)}
          style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#fca5a5", fontSize: "11px", cursor: "pointer", width: "100%" }}
        >
          Ocultar bloco
        </button>
      </div>

      <BlockStyleSection
        blockKey={activeBlock}
        blockStyles={blockStyles}
        updateBlockStyle={updateBlockStyle}
        clearBlockStyle={clearBlockStyle}
      />

      {activeBlock === "highlights" ? (
        <>
          <Divider />
          <SectionTitle>Destaques</SectionTitle>
          <button type="button" onClick={addHighlight}
            style={{ width: "100%", padding: "7px", borderRadius: "8px", border: "1px dashed rgba(255,255,255,0.15)", background: "transparent", color: "var(--text-muted)", fontSize: "12px", cursor: "pointer", marginBottom: "10px" }}
          >
            + Adicionar Destaque
          </button>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {showcaseConfig.highlights.map((item, index) => {
              const hs = showcaseConfig.highlightStyles[index] || {};
              return (
                <div key={`hs-panel-${index}`} style={{ padding: "10px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ fontSize: "11px", color: "#fff", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "140px" }}
                      dangerouslySetInnerHTML={{ __html: item.title.replace(/<[^>]+>/g, "") }}
                    />
                    <button type="button" onClick={() => removeHighlight(index)} disabled={showcaseConfig.highlights.length <= 1}
                      style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px", opacity: showcaseConfig.highlights.length <= 1 ? 0.3 : 1, flexShrink: 0 }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3px", fontSize: "10px", color: "var(--text-muted)" }}>
                      Fundo
                      <input type="color" value={hs.backgroundColor || "#1e293b"}
                        onChange={(e) => updateHighlightStyle(index, "backgroundColor", e.target.value)}
                        style={{ width: "100%", height: "26px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}
                      />
                    </label>
                    <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3px", fontSize: "10px", color: "var(--text-muted)" }}>
                      Texto
                      <input type="color" value={hs.color || "#f8fafc"}
                        onChange={(e) => updateHighlightStyle(index, "color", e.target.value)}
                        style={{ width: "100%", height: "26px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {activeBlock === "widgets" ? (
        <>
          <Divider />
          <SectionTitle>Adicionar Widget</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
            {WIDGET_LIBRARY.map((template) => (
              <button key={template.type} type="button" onClick={() => addWidget(template)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px dashed rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.02)", color: "var(--text-muted)", fontSize: "12px", cursor: "pointer", textAlign: "left" }}
              >
                + {template.title}
              </button>
            ))}
          </div>

          {showcaseConfig.widgets.length > 0 ? (
            <>
              <SectionTitle>Widgets Ativos</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {showcaseConfig.widgets.map((widget, index) => (
                  <div key={widget.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)" }}>
                    <span style={{ fontSize: "12px", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      dangerouslySetInnerHTML={{ __html: widget.title.replace(/<[^>]+>/g, "") }}
                    />
                    <button type="button" onClick={() => removeWidget(index)}
                      style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px", flexShrink: 0 }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </>
      ) : null}

      {activeBlock === "properties" ? (
        <>
          <Divider />
          <div style={{ padding: "12px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.6", margin: 0 }}>
              Os imóveis são gerenciados no <strong style={{ color: "#fff" }}>Portfólio</strong>. Apenas os imóveis com status <strong style={{ color: "#fff" }}>Ativo</strong> são exibidos na vitrine.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function BuilderSidePanel({
  activeBlock,
  form,
  showcaseConfig,
  blockStyles,
  currentTheme,
  isLightMode,
  PRESET_THEMES,
  DEFAULT_BLOCK_LABELS,
  WIDGET_LIBRARY,
  updateField,
  setAppearanceMode,
  applyPreset,
  hideBlock,
  restoreBlock,
  updateBlockStyle,
  clearBlockStyle,
  addHighlight,
  removeHighlight,
  updateHighlightStyle,
  addWidget,
  removeWidget,
  updateWidget,
}) {
  const [activeTab, setActiveTab] = useState("page");

  useEffect(() => {
    if (activeBlock) setActiveTab("block");
  }, [activeBlock]);

  return (
    <div style={{
      width: "272px",
      flexShrink: 0,
      background: "rgba(10, 15, 28, 0.97)",
      backdropFilter: "blur(24px)",
      borderLeft: "1px solid rgba(255,255,255,0.06)",
      display: "flex",
      flexDirection: "column",
      position: "sticky",
      top: "56px",
      height: "calc(100vh - 56px)",
      overflow: "hidden",
      alignSelf: "flex-start",
    }}>
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
        {[["page", "Página"], ["block", "Bloco"]].map(([tab, label]) => {
          const isActive = activeTab === tab;
          return (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, padding: "12px 8px", border: "none",
                borderBottom: isActive ? "2px solid var(--accent, #818cf8)" : "2px solid transparent",
                background: "transparent",
                color: isActive ? "#fff" : "var(--text-muted)",
                fontSize: "13px", fontWeight: isActive ? "600" : "400",
                cursor: "pointer", transition: "all 0.2s",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
        {activeTab === "page" ? (
          <PagePanel
            form={form}
            updateField={updateField}
            showcaseConfig={showcaseConfig}
            isLightMode={isLightMode}
            setAppearanceMode={setAppearanceMode}
            currentTheme={currentTheme}
            applyPreset={applyPreset}
            PRESET_THEMES={PRESET_THEMES}
            DEFAULT_BLOCK_LABELS={DEFAULT_BLOCK_LABELS}
            restoreBlock={restoreBlock}
          />
        ) : (
          <BlockPanel
            activeBlock={activeBlock}
            blockStyles={blockStyles}
            updateBlockStyle={updateBlockStyle}
            clearBlockStyle={clearBlockStyle}
            hideBlock={hideBlock}
            showcaseConfig={showcaseConfig}
            updateHighlightStyle={updateHighlightStyle}
            addHighlight={addHighlight}
            removeHighlight={removeHighlight}
            updateWidget={updateWidget}
            removeWidget={removeWidget}
            addWidget={addWidget}
            WIDGET_LIBRARY={WIDGET_LIBRARY}
            DEFAULT_BLOCK_LABELS={DEFAULT_BLOCK_LABELS}
          />
        )}
      </div>
    </div>
  );
}
