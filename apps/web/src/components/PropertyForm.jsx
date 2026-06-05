import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { loadSession } from "../session.js";
import { COMODIDADES, EMPTY_COMODIDADES, OSM_TO_KEY } from "../utils/comodidades.js";

function formatCep(value) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function formatCurrencyBRL(rawValue) {
  const digits = rawValue.replace(/\D/g, "");
  if (!digits) return "";
  const amount = Number(digits) / 100;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
}

function parseCurrencyBRL(rawValue) {
  const digits = rawValue.replace(/\D/g, "");
  if (!digits) return NaN;
  return Number(digits) / 100;
}

// ─── Enriquecimento de endereço por CEP (ViaCEP → Nominatim → Overpass) ────────

// Converte um endereço em latitude/longitude usando o Nominatim (OpenStreetMap).
// Tenta primeiro com logradouro; se falhar, tenta só pelo bairro.
async function geocodeEndereco({ logradouro, bairro, cidade, uf }) {
  const tentativas = [
    [logradouro, bairro, cidade, uf, "Brasil"].filter(Boolean).join(", "),
    [bairro, cidade, uf, "Brasil"].filter(Boolean).join(", "),
  ].filter((q) => q && q.length > "Brasil".length);

  for (const q of tentativas) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=1`;
    const res = await fetch(url, { headers: { "Accept-Language": "pt-BR" } });
    if (!res.ok) continue;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    }
  }
  return null;
}

// Consulta o Overpass API por pontos de interesse num raio de 2 km.
async function buscarPois(lat, lon) {
  const query = `[out:json];
(
  node(around:2000,${lat},${lon})["amenity"];
  node(around:2000,${lat},${lon})["shop"];
  node(around:2000,${lat},${lon})["tourism"];
  node(around:2000,${lat},${lon})["leisure"];
);
out body;`;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: query,
  });
  if (!res.ok) throw new Error("Falha ao consultar pontos de interesse.");
  const data = await res.json();
  return Array.isArray(data.elements) ? data.elements : [];
}

// Analisa os POIs e retorna quais comodidades existem na região (sempre true).
function detectarComodidades(elements) {
  const detectadas = {};
  for (const el of elements) {
    const tags = el.tags || {};
    for (const valor of [tags.amenity, tags.shop, tags.tourism, tags.leisure]) {
      const key = OSM_TO_KEY[valor];
      if (key) detectadas[key] = true;
    }
  }
  return detectadas;
}

const EMPTY = {
  tipoImovelId: "",
  atributosIds: [],
  title: "",
  description: "",
  price: "",
  cep: "",
  address: "",
  neighborhood: "",
  city: "",
  state: "",
  bedrooms: "",
  parkingSpots: "",
  suites: "",
  squareFootage: "",
  finalidade: "RESIDENCIAL",
  areaConstruida: "",
  areaPrivativa: "",
  areaTotal: "",
  andamento: "PRONTO_PARA_MORAR",
  aceitaPermuta: false,
  status: "ACTIVE",
  comodidades: { ...EMPTY_COMODIDADES },
};

const STEPS = [
  { key: "basico", label: "Identificação" },
  { key: "localizacao", label: "Localização" },
  { key: "detalhes", label: "Detalhes" },
  { key: "fotos", label: "Fotos" },
  { key: "divulgar", label: "Divulgar" },
];

// ─── Ícones ───────────────────────────────────────────────────────────────────

function IconHome() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconBed() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4v16M22 4v16M2 12h20M2 8h6a2 2 0 0 1 2 2v2H2V8zM14 8h6a2 2 0 0 1 2 2v2h-8v-4z" />
    </svg>
  );
}

function IconCar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="11" width="22" height="9" rx="2" />
      <path d="M5 11V7a7 7 0 0 1 14 0v4" />
      <circle cx="8" cy="17" r="1" /><circle cx="16" cy="17" r="1" />
    </svg>
  );
}

function IconArea() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ─── Indicador de etapas (clicável) ──────────────────────────────────────────

function StepIndicator({ current, onStepClick, lockedSteps = [] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: "32px" }}>
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const locked = lockedSteps.includes(i);
        const clickable = i !== current && !locked;
        return (
          <div key={step.key} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <div
                onClick={() => clickable && onStepClick(i)}
                style={{
                  width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "12px", fontWeight: "700", flexShrink: 0, transition: "all 0.3s ease",
                  background: locked ? "rgba(255,255,255,0.03)" : done ? "var(--primary, #6366f1)" : active ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.06)",
                  border: locked ? "2px dashed rgba(255,255,255,0.12)" : done ? "2px solid var(--primary, #6366f1)" : active ? "2px solid rgba(99,102,241,0.8)" : "2px solid rgba(255,255,255,0.12)",
                  color: locked ? "rgba(255,255,255,0.2)" : done ? "#fff" : active ? "rgba(99,102,241,1)" : "var(--text-muted)",
                  boxShadow: active ? "0 0 0 4px rgba(99,102,241,0.15)" : "none",
                  cursor: locked ? "not-allowed" : clickable ? "pointer" : "default",
                  opacity: locked ? 0.5 : 1,
                }}
              >
                {done ? <IconCheck /> : i + 1}
              </div>
              <span
                onClick={() => clickable && onStepClick(i)}
                style={{
                  fontSize: "11px", fontWeight: active ? "600" : "400",
                  color: locked ? "rgba(255,255,255,0.2)" : active ? "var(--text)" : "var(--text-muted)",
                  whiteSpace: "nowrap", transition: "all 0.3s",
                  cursor: locked ? "not-allowed" : clickable ? "pointer" : "default",
                  opacity: locked ? 0.5 : 1,
                }}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: "2px", marginBottom: "18px", marginLeft: "8px", marginRight: "8px", background: done ? "var(--primary, #6366f1)" : "rgba(255,255,255,0.08)", borderRadius: "2px", transition: "background 0.4s ease" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Checkboxes de atributos ──────────────────────────────────────────────────

function AtributosSection({ atributos, selecionados, onChange, disabled }) {
  if (!atributos || atributos.length === 0) return null;

  const grupos = atributos.reduce((acc, atr) => {
    const g = atr.grupo || "Outros";
    if (!acc[g]) acc[g] = [];
    acc[g].push(atr);
    return acc;
  }, {});

  function toggle(id) {
    onChange(selecionados.includes(id) ? selecionados.filter((x) => x !== id) : [...selecionados, id]);
  }

  return (
    <div style={{ marginTop: "4px" }}>
      <span style={{ display: "block", marginBottom: "12px", fontSize: "13px", fontWeight: "600", color: "var(--text-muted)" }}>
        Atributos do imóvel
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {Object.entries(grupos).map(([grupo, itens]) => (
          <div key={grupo}>
            <span style={{ display: "block", fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.45, marginBottom: "8px" }}>
              {grupo}
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px" }}>
              {itens.map((atr) => {
                const checked = selecionados.includes(atr.id);
                return (
                  <label key={atr.id} style={{
                    display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px",
                    borderRadius: "8px", cursor: disabled ? "not-allowed" : "pointer",
                    border: checked ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.08)",
                    background: checked ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.02)",
                    transition: "all 0.15s ease", fontSize: "13px", userSelect: "none",
                    opacity: disabled ? 0.55 : 1,
                  }}>
                    <input
                      type="checkbox" checked={checked} onChange={() => toggle(atr.id)} disabled={disabled}
                      style={{ accentColor: "var(--primary, #6366f1)", width: "14px", height: "14px", flexShrink: 0 }}
                    />
                    {atr.descricao}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Card de pré-visualização com carrossel ───────────────────────────────────

function PropertyPreviewCard({ form, previewUrls }) {
  const [idx, setIdx] = useState(0);

  // Reset index when urls change
  useEffect(() => { setIdx(0); }, [previewUrls.length]);

  // Auto-avança a cada 3,5s
  useEffect(() => {
    if (previewUrls.length <= 1) return;
    const timer = setInterval(() => setIdx((i) => (i + 1) % previewUrls.length), 3500);
    return () => clearInterval(timer);
  }, [previewUrls.length]);

  const price = parseCurrencyBRL(String(form.price));
  const hasPrice = Number.isFinite(price) && price > 0;
  const hasLocation = form.neighborhood || form.city || form.state;
  const hasStats = form.squareFootage || form.bedrooms || form.parkingSpots;
  const statusLabel = { ACTIVE: "Ativo", INACTIVE: "Inativo", DRAFT: "Rascunho" }[form.status] || "Rascunho";
  const statusColor = { ACTIVE: "#10b981", INACTIVE: "#ef4444", DRAFT: "#f59e0b" }[form.status] || "#f59e0b";
  const currentUrl = previewUrls[idx] || null;

  function prev(e) { e.stopPropagation(); setIdx((i) => (i - 1 + previewUrls.length) % previewUrls.length); }
  function next(e) { e.stopPropagation(); setIdx((i) => (i + 1) % previewUrls.length); }

  return (
    <div style={{ position: "sticky", top: "80px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
          Pré-visualização
        </span>
        <span style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", color: statusColor, background: `${statusColor}20`, padding: "2px 8px", borderRadius: "999px" }}>
          {statusLabel}
        </span>
      </div>

      <article style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(15px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Imagem com carrossel */}
        <div style={{ position: "relative", width: "100%", height: "200px", overflow: "hidden", background: "rgba(255,255,255,0.04)" }}>
          {currentUrl ? (
            <img
              key={currentUrl}
              src={currentUrl}
              alt="preview"
              style={{ width: "100%", height: "100%", objectFit: "cover", animation: "fadeIn 0.3s ease-in-out" }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", color: "rgba(255,255,255,0.15)" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span style={{ fontSize: "12px" }}>Foto aparecerá aqui</span>
            </div>
          )}

          {/* Chevrons */}
          {previewUrls.length > 1 && (
            <>
              <button type="button" onClick={prev} style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", width: "28px", height: "28px", borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "16px", lineHeight: 1 }}>‹</button>
              <button type="button" onClick={next} style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", width: "28px", height: "28px", borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "16px", lineHeight: 1 }}>›</button>
              <span style={{ position: "absolute", bottom: "8px", left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.45)", color: "#fff", fontSize: "10px", padding: "2px 8px", borderRadius: "999px" }}>
                {idx + 1}/{previewUrls.length}
              </span>
            </>
          )}

          {/* Dots de andamento e permuta */}
          {form.andamento && (
            <span style={{ position: "absolute", top: "10px", left: "10px", fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", color: "#fff", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", padding: "3px 8px", borderRadius: "999px" }}>
              {{ PRONTO_PARA_MORAR: "Pronto para morar", EM_CONSTRUCAO: "Em construção" }[form.andamento]}
            </span>
          )}
          {form.aceitaPermuta && (
            <span style={{ position: "absolute", bottom: previewUrls.length > 1 ? "28px" : "10px", left: "10px", fontSize: "10px", fontWeight: "600", color: "#fff", background: "rgba(99,102,241,0.75)", backdropFilter: "blur(4px)", padding: "3px 8px", borderRadius: "999px" }}>
              Aceita permuta
            </span>
          )}
        </div>

        {/* Info */}
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "600", color: form.title ? "#fff" : "rgba(255,255,255,0.2)", lineHeight: "1.3", margin: 0 }}>
            {form.title || "Título do imóvel"}
          </h3>

          {hasLocation && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
              <IconPin />
              <span>{[form.neighborhood, form.city, form.state].filter(Boolean).join(", ")}</span>
            </div>
          )}

          {form.description && (
            <p style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.5", margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {form.description}
            </p>
          )}

          {hasStats && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "2px" }}>
              {form.squareFootage && (
                <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: "6px" }}>
                  <IconArea /> {form.squareFootage} m²
                </span>
              )}
              {form.bedrooms && (
                <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: "6px" }}>
                  <IconBed /> {form.bedrooms} qto{form.bedrooms !== "1" ? "s" : ""}
                  {form.suites ? ` · ${form.suites} suíte${form.suites !== "1" ? "s" : ""}` : ""}
                </span>
              )}
              {form.parkingSpots && (
                <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: "6px" }}>
                  <IconCar /> {form.parkingSpots} vaga{form.parkingSpots !== "1" ? "s" : ""}
                </span>
              )}
            </div>
          )}

          <div style={{ marginTop: "4px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>Valor</span>
            <p style={{ fontSize: "22px", fontWeight: "700", color: hasPrice ? "#fff" : "rgba(255,255,255,0.15)", margin: "2px 0 0 0", letterSpacing: "-0.5px" }}>
              {hasPrice ? `R$ ${price.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "R$ —"}
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}

// ─── Campo com label ──────────────────────────────────────────────────────────

function Field({ label, children, hint }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </label>
      {children}
      {hint && <span style={{ fontSize: "11px", color: "var(--text-muted)", opacity: 0.7 }}>{hint}</span>}
    </div>
  );
}

// ─── Grade de fotos com drag-to-reorder ──────────────────────────────────────

function PhotoGrid({ images, onRemove, onReorder }) {
  const dragFrom = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  if (!images.length) return null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "10px" }}>
      {images.map((img, i) => (
        <div
          key={img.id}
          draggable
          onDragStart={() => { dragFrom.current = i; }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(i); }}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(null);
            if (dragFrom.current !== null && dragFrom.current !== i) {
              onReorder(dragFrom.current, i);
            }
            dragFrom.current = null;
          }}
          onDragEnd={() => { dragFrom.current = null; setDragOver(null); }}
          style={{
            position: "relative", borderRadius: "10px", overflow: "hidden",
            border: dragOver === i ? "2px solid rgba(99,102,241,0.8)" : "2px solid rgba(255,255,255,0.08)",
            cursor: "grab", transition: "border-color 0.15s, opacity 0.15s",
            opacity: dragOver === i ? 0.7 : 1,
            aspectRatio: "1",
          }}
        >
          <img src={img.previewUrl} alt={`foto ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} />

          {/* Overlay de hover com botão delete */}
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0)", transition: "background 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.35)"; e.currentTarget.querySelector("button").style.opacity = "1"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0)"; e.currentTarget.querySelector("button").style.opacity = "0"; }}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(i); }}
              style={{
                position: "absolute", top: "6px", right: "6px", width: "22px", height: "22px",
                borderRadius: "50%", background: "rgba(239,68,68,0.9)", border: "none",
                color: "#fff", fontSize: "14px", lineHeight: 1, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: 0, transition: "opacity 0.2s",
              }}
            >×</button>
          </div>

          {/* Badge CAPA */}
          {i === 0 && (
            <span style={{ position: "absolute", bottom: "6px", left: "6px", fontSize: "9px", fontWeight: "700", background: "rgba(0,0,0,0.65)", color: "#fff", padding: "2px 6px", borderRadius: "999px", pointerEvents: "none" }}>
              CAPA
            </span>
          )}

          {/* Número */}
          <span style={{ position: "absolute", top: "6px", left: "6px", fontSize: "9px", fontWeight: "700", background: "rgba(0,0,0,0.5)", color: "rgba(255,255,255,0.8)", padding: "1px 5px", borderRadius: "999px", pointerEvents: "none" }}>
            {i + 1}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Menu de gerenciamento ────────────────────────────────────────────────────

export function PropertyManagement({ onSubmitProperty, disabled, initialData }) {
  const [view, setView] = useState(initialData?.id ? "PROPERTY" : "MENU");
  const navigate = useNavigate();

  useEffect(() => {
    if (initialData?.id) setView("PROPERTY");
  }, [initialData?.id]);

  return (
    <div className="management-container">
      {view === "MENU" && (
        <div className="glass-panel" style={{ textAlign: "center", padding: "56px 40px", animation: "fadeIn 0.4s ease-out" }}>
          <h2 style={{ marginBottom: "8px", fontSize: "28px", fontWeight: "700" }}>Gerenciar Imóveis</h2>
          <p style={{ marginBottom: "48px", color: "var(--text-muted)", fontSize: "16px" }}>
            Selecione o tipo de operação que deseja realizar no sistema.
          </p>
          <div className="grid grid-2" style={{ gap: "32px", maxWidth: "800px", margin: "0 auto" }}>
            {[
              {
                onClick: () => setView("PROPERTY"),
                icon: <IconHome />,
                title: "Novo Imóvel",
                desc: "Cadastre propriedades, defina valores, envie fotos e gerencie as informações.",
              },
              {
                onClick: () => navigate("/tipos-imovel"),
                icon: (
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                  </svg>
                ),
                title: "Categoria de Imóvel",
                desc: "Adicione novas tipologias ao sistema para categorizar seu portfólio.",
              },
            ].map((card) => (
              <button
                key={card.title}
                onClick={card.onClick}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  padding: "48px 32px", borderRadius: "24px", cursor: "pointer",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 100%)",
                  backdropFilter: "blur(12px)", color: "inherit", gap: "24px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-6px)";
                  e.currentTarget.style.border = "1px solid rgba(255,255,255,0.3)";
                  e.currentTarget.style.background = "linear-gradient(145deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 100%)";
                  e.currentTarget.style.boxShadow = "0 20px 40px rgba(0,0,0,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.border = "1px solid rgba(255,255,255,0.15)";
                  e.currentTarget.style.background = "linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 100%)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{ background: "rgba(255,255,255,0.1)", padding: "20px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {card.icon}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "22px", fontWeight: "600", letterSpacing: "-0.5px" }}>{card.title}</span>
                  <span style={{ fontSize: "14px", opacity: 0.7, fontWeight: "400", lineHeight: "1.5" }}>{card.desc}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {view === "PROPERTY" && (
        <PropertyForm
          onSubmit={onSubmitProperty}
          disabled={disabled}
          initialData={initialData}
          onCancelEdit={() => setView("MENU")}
        />
      )}
    </div>
  );
}

// ─── Formulário principal em etapas ──────────────────────────────────────────

export function PropertyForm({ onSubmit, disabled, initialData, onCancelEdit }) {
  const [form, setForm] = useState(EMPTY);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [comodidadesLoading, setComodidadesLoading] = useState(false);
  const [comodidadesMsg, setComodidadesMsg] = useState("");
  // images: Array<{ id: string, file: File, previewUrl: string }>
  const [images, setImages] = useState([]);
  const [tipos, setTipos] = useState([]);
  const isEditing = Boolean(initialData?.id);

  // ── Estado do step "Divulgar" ──
  const [savedPropertyId, setSavedPropertyId] = useState(null);
  const [caption, setCaption] = useState("");
  const [socialStatus, setSocialStatus] = useState(null);
  const [publishLoading, setPublishLoading] = useState({ facebook: false, instagram: false });
  const [publishResults, setPublishResults] = useState({});
  const [, setSearchParams] = useSearchParams();

  const session = loadSession();
  const tenantSlug = session?.tenant?.slug;
  const cargo = session?.usuario?.cargo;

  useEffect(() => {
    if (!tenantSlug) return;
    api.getTiposImovel(tenantSlug).then(setTipos).catch(() => {});
  }, [tenantSlug]);

  // Limpa URLs ao desmontar
  useEffect(() => {
    return () => { images.forEach((img) => URL.revokeObjectURL(img.previewUrl)); };
  }, []);

  // Carrega status social e gera legenda ao entrar no step Divulgar
  useEffect(() => {
    if (step !== 4 || !tenantSlug || !savedPropertyId) return;
    api.getSocialStatus(tenantSlug).then(setSocialStatus).catch(() => {});

    const price = parseCurrencyBRL(String(form.price));
    const priceStr = Number.isFinite(price) && price > 0
      ? `R$ ${price.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
      : "";
    const location = [form.neighborhood, form.city, form.state].filter(Boolean).join(", ");
    const stats = [
      form.bedrooms ? `${form.bedrooms} quarto${form.bedrooms !== "1" ? "s" : ""}` : "",
      form.squareFootage ? `${form.squareFootage} m²` : "",
      form.parkingSpots ? `${form.parkingSpots} vaga${form.parkingSpots !== "1" ? "s" : ""}` : "",
    ].filter(Boolean).join(" · ");
    const tipoSel = tipos.find((t) => String(t.id) === String(form.tipoImovelId));
    const atribs = tipoSel?.atributos
      ?.filter((a) => form.atributosIds.includes(a.id))
      .map((a) => a.descricao) || [];
    const vitrineUrl = `${window.location.origin}/vitrine/${tenantSlug}/imovel/${savedPropertyId}`;
    const whatsapp = session?.tenant?.whatsapp || "";

    const lines = [
      `🏠 ${form.title}`,
      location ? `📍 ${location}` : "",
      priceStr ? `💰 ${priceStr}` : "",
      stats ? `📐 ${stats}` : "",
      atribs.length > 0 ? `✅ ${atribs.join(" · ")}` : "",
      form.aceitaPermuta ? "🔄 Aceita permuta" : "",
      "",
      form.description || "",
      "",
      `🔗 Ver detalhes: ${vitrineUrl}`,
      whatsapp ? `📲 Contato: ${whatsapp}` : "",
    ].filter((l, i, arr) => !(l === "" && arr[i - 1] === ""));
    setCaption(lines.join("\n").trim());
  }, [step, savedPropertyId]);

  useEffect(() => {
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setImages([]);

    if (!initialData) {
      setForm(EMPTY);
      setStep(0);
      return;
    }
    const atributosIds = initialData.atributos?.map((a) => a.atributoId ?? a.atributo?.id) ?? [];
    setForm({
      tipoImovelId: initialData.tipoImovelId ? String(initialData.tipoImovelId) : "",
      atributosIds,
      title: initialData.title || "",
      description: initialData.description || "",
      price: formatCurrencyBRL(String(initialData.price ?? "")),
      cep: formatCep(initialData.cep || ""),
      address: initialData.address || "",
      neighborhood: initialData.neighborhood || "",
      city: initialData.city || "",
      state: initialData.state || "",
      bedrooms: initialData.bedrooms != null ? String(initialData.bedrooms) : "",
      parkingSpots: initialData.parkingSpots != null ? String(initialData.parkingSpots) : "",
      suites: initialData.suites != null ? String(initialData.suites) : "",
      squareFootage: initialData.squareFootage != null ? String(initialData.squareFootage) : "",
      finalidade: initialData.finalidade || "",
      areaConstruida: initialData.areaConstruida != null ? String(initialData.areaConstruida) : "",
      areaPrivativa: initialData.areaPrivativa != null ? String(initialData.areaPrivativa) : "",
      areaTotal: initialData.areaTotal != null ? String(initialData.areaTotal) : "",
      andamento: initialData.andamento || "",
      aceitaPermuta: Boolean(initialData.aceitaPermuta),
      status: initialData.status || "DRAFT",
      comodidades: { ...EMPTY_COMODIDADES, ...(initialData.comodidades || {}) },
    });
    setComodidadesMsg("");
    setStep(0);
  }, [initialData]);

  const tipoSelecionado = tipos.find((t) => String(t.id) === String(form.tipoImovelId));

  // URLs para o preview: novas selecionadas, ou imagens já salvas no servidor
  const existingUrls = initialData?.images?.map((img) => img.url) ?? [];
  const previewUrls = images.length > 0 ? images.map((img) => img.previewUrl) : existingUrls;

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function addImages(files) {
    const newItems = files.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setImages((prev) => [...prev, ...newItems]);
  }

  function removeImage(i) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[i].previewUrl);
      return prev.filter((_, idx) => idx !== i);
    });
  }

  function reorderImages(from, to) {
    setImages((prev) => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
  }

  function validateStep(s) {
    if (s === 0) {
      if (!form.title || form.title.length < 3) return "Título deve ter ao menos 3 caracteres.";
      if (!form.description || form.description.length < 10) return "Descrição deve ter ao menos 10 caracteres.";
      if (!form.tipoImovelId) return "Selecione o tipo de imóvel.";
      const p = parseCurrencyBRL(String(form.price));
      if (!Number.isFinite(p) || p <= 0) return "Informe um preço válido maior que zero.";
    }
    if (s === 1) {
      if (!form.address || form.address.length < 5) return "Informe o endereço completo.";
      if (!form.neighborhood || form.neighborhood.length < 2) return "Informe o bairro.";
      if (!form.city || form.city.length < 2) return "Informe a cidade.";
      if (!form.state || form.state.length < 2) return "Informe o estado (UF).";
    }
    if (s === 2) {
      const bed = Number(form.bedrooms);
      const park = Number(form.parkingSpots);
      const suite = Number(form.suites);
      if ([bed, park, suite].some((v) => !Number.isInteger(v) || v < 0))
        return "Quartos, vagas e suítes devem ser números inteiros ≥ 0.";
      const sqft = parseFloat(form.squareFootage);
      if (!Number.isFinite(sqft) || sqft <= 0) return "Informe a metragem (m²).";
      const areas = [
        ["área construída", form.areaConstruida],
        ["área privativa", form.areaPrivativa],
        ["área total", form.areaTotal],
      ];
      for (const [nome, valor] of areas) {
        if (valor === "" || valor == null) continue;
        const n = parseFloat(valor);
        if (!Number.isFinite(n) || n < 0) return `Informe um valor válido para ${nome} (m²).`;
      }
    }
    return null;
  }

  function handleStepClick(target) {
    if (target === step) return;
    if (target === 4 && !savedPropertyId) return; // travado até salvar
    if (target < step) {
      setError("");
      setStep(target);
      return;
    }
    for (let s = step; s < target; s++) {
      if (s >= 3) break; // não valida step 4
      const err = validateStep(s);
      if (err) { setError(err); return; }
    }
    setError("");
    setStep(target);
  }

  function handleNext() {
    const err = validateStep(step);
    if (err) { setError(err); return; }
    setError("");
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleBack() {
    setError("");
    setStep((s) => s - 1);
  }

  async function handleSubmit() {
    setError("");
    for (let i = 0; i <= 2; i++) {
      const err = validateStep(i);
      if (err) { setStep(i); setError(err); return; }
    }
    const normalizedPrice = parseCurrencyBRL(String(form.price));
    const saved = await onSubmit({
      tipoImovelId: form.tipoImovelId ? Number(form.tipoImovelId) : undefined,
      atributosIds: form.atributosIds,
      title: form.title,
      description: form.description,
      price: normalizedPrice,
      cep: form.cep.replace(/\D/g, ""),
      address: form.address,
      neighborhood: form.neighborhood,
      city: form.city,
      state: form.state,
      bedrooms: Number(form.bedrooms),
      parkingSpots: Number(form.parkingSpots),
      suites: Number(form.suites),
      squareFootage: parseFloat(form.squareFootage),
      finalidade: form.finalidade || null,
      areaConstruida: form.areaConstruida !== "" ? parseFloat(form.areaConstruida) : null,
      areaPrivativa: form.areaPrivativa !== "" ? parseFloat(form.areaPrivativa) : null,
      areaTotal: form.areaTotal !== "" ? parseFloat(form.areaTotal) : null,
      andamento: form.andamento || null,
      aceitaPermuta: Boolean(form.aceitaPermuta),
      status: form.status,
      comodidades: form.comodidades,
      imageFiles: images.map((img) => img.file),
    });

    if (!isEditing) {
      images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      setImages([]);
      if (saved?.id) {
        setSavedPropertyId(saved.id);
        setPublishResults({});
        setStep(4);
      } else {
        setForm(EMPTY);
        setStep(0);
      }
    }
  }

  async function handleCepBlur() {
    const cleanCep = String(form.cep || "").replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    setCepLoading(true);
    setError("");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (!response.ok) throw new Error("Falha ao consultar CEP.");
      const data = await response.json();
      if (data.erro) throw new Error("CEP não encontrado.");
      const street = [data.logradouro, data.complemento].filter(Boolean).join(" - ");
      setForm((prev) => ({
        ...prev,
        cep: formatCep(cleanCep),
        address: street || prev.address,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
      }));
      // Enriquece em segundo plano: geocodifica e detecta comodidades da região.
      enriquecerComodidades({
        logradouro: data.logradouro,
        bairro: data.bairro,
        cidade: data.localidade,
        uf: data.uf,
      });
    } catch (err) {
      setError(err.message || "Não foi possível buscar o CEP.");
    } finally {
      setCepLoading(false);
    }
  }

  // Geocodifica o endereço, busca POIs próximos e marca as comodidades
  // encontradas. Nunca desmarca o que já estava marcado.
  async function enriquecerComodidades({ logradouro, bairro, cidade, uf }) {
    if (!cidade || !uf) return;
    setComodidadesLoading(true);
    setComodidadesMsg("");
    try {
      const coords = await geocodeEndereco({ logradouro, bairro, cidade, uf });
      if (!coords) {
        setComodidadesMsg("Não foi possível localizar as coordenadas deste endereço.");
        return;
      }
      const pois = await buscarPois(coords.lat, coords.lon);
      const detectadas = detectarComodidades(pois);
      const qtd = Object.keys(detectadas).length;
      setForm((prev) => ({
        ...prev,
        comodidades: { ...prev.comodidades, ...detectadas },
      }));
      setComodidadesMsg(
        qtd > 0
          ? `${qtd} tipo(s) de comodidade detectado(s) num raio de 2 km.`
          : "Nenhuma comodidade detectada nas proximidades."
      );
    } catch {
      setComodidadesMsg("Não foi possível analisar as comodidades da região.");
    } finally {
      setComodidadesLoading(false);
    }
  }

  function toggleComodidade(key) {
    setForm((prev) => ({
      ...prev,
      comodidades: { ...prev.comodidades, [key]: !prev.comodidades?.[key] },
    }));
  }

  async function handlePublish(platform) {
    if (!tenantSlug || !savedPropertyId) return;
    setPublishLoading((prev) => ({ ...prev, [platform]: true }));
    try {
      const result = await api.publishProperty(tenantSlug, savedPropertyId, {
        platforms: [platform],
        caption,
      });
      setPublishResults((prev) => ({ ...prev, ...result }));
    } catch (err) {
      setPublishResults((prev) => ({ ...prev, [platform]: { success: false, error: err.message } }));
    } finally {
      setPublishLoading((prev) => ({ ...prev, [platform]: false }));
    }
  }

  function handleWhatsApp() {
    const vitrineUrl = `${window.location.origin}/vitrine/${tenantSlug}/imovel/${savedPropertyId}`;
    const text = caption || `🏠 ${form.title}\n🔗 ${vitrineUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  const inputStyle = {
    width: "100%", boxSizing: "border-box",
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "10px", color: "inherit", padding: "12px 14px", fontSize: "14px",
    outline: "none", transition: "border-color 0.2s",
  };
  const selectStyle = { ...inputStyle, cursor: "pointer" };

  return (
    <section className="glass-panel" style={{ animation: "fadeIn 0.3s ease-in-out" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "8px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ margin: 0, marginBottom: "4px" }}>{isEditing ? "Editar Imóvel" : "Novo Imóvel"}</h2>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)" }}>
            {isEditing ? "Atualize as informações do imóvel abaixo." : "Preencha as etapas para cadastrar um novo imóvel."}
          </p>
        </div>
        <button type="button" className="button-secondary" onClick={onCancelEdit} disabled={disabled} style={{ fontSize: "13px", padding: "8px 16px", width: "auto" }}>
          {isEditing ? "Cancelar edição" : "Voltar ao menu"}
        </button>
      </div>

      <StepIndicator current={step} onStepClick={handleStepClick} lockedSteps={savedPropertyId ? [] : [4]} />

      {error ? <div className="error" style={{ marginBottom: "16px" }}>{error}</div> : null}

      <div style={{ display: "flex", gap: "40px", alignItems: "flex-start" }}>

        {/* ── Painel do formulário ─── */}
        <div style={step === 4
          ? { width: "100%", maxWidth: "660px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }
          : { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "20px" }
        }>

          {/* Etapa 0 — Identificação */}
          {step === 0 && (
            <>
              <Field label="Título do imóvel">
                <input style={inputStyle} placeholder="Ex: Apartamento 3 quartos no Setor Bueno" value={form.title} onChange={(e) => set("title", e.target.value)} disabled={disabled} />
              </Field>
              <Field label="Descrição">
                <textarea style={{ ...inputStyle, resize: "vertical", minHeight: "100px", lineHeight: "1.6" }} placeholder="Descreva os principais atrativos do imóvel, diferenciais, acabamento..." value={form.description} onChange={(e) => set("description", e.target.value)} rows={4} disabled={disabled} />
              </Field>
              <Field label="Preço">
                <input style={inputStyle} placeholder="R$ 0,00" type="text" inputMode="numeric" value={form.price} onChange={(e) => set("price", formatCurrencyBRL(e.target.value))} disabled={disabled} />
              </Field>
              <Field label="Tipo de imóvel">
                <select style={selectStyle} value={form.tipoImovelId} onChange={(e) => setForm((prev) => ({ ...prev, tipoImovelId: e.target.value, atributosIds: [] }))} disabled={disabled}>
                  <option value="" disabled hidden>Selecione uma categoria...</option>
                  {tipos.map((t) => <option key={t.id} value={t.id}>{t.descricao}</option>)}
                </select>
              </Field>
              {tipoSelecionado && tipoSelecionado.atributos?.length > 0 && (
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "16px" }}>
                  <AtributosSection atributos={tipoSelecionado.atributos} selecionados={form.atributosIds} onChange={(ids) => set("atributosIds", ids)} disabled={disabled} />
                </div>
              )}
            </>
          )}

          {/* Etapa 1 — Localização */}
          {step === 1 && (
            <>
              <Field label="CEP" hint="Preencha o CEP para auto-completar o endereço.">
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <input style={{ ...inputStyle, maxWidth: "160px" }} placeholder="00000-000" value={form.cep} onChange={(e) => set("cep", formatCep(e.target.value))} onBlur={handleCepBlur} maxLength={9} disabled={disabled || cepLoading} />
                  {cepLoading && <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Consultando...</span>}
                </div>
              </Field>
              <Field label="Endereço">
                <input style={inputStyle} placeholder="Rua, número, complemento" value={form.address} onChange={(e) => set("address", e.target.value)} disabled={disabled} />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <Field label="Bairro">
                  <input style={inputStyle} placeholder="Bairro" value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} disabled={disabled} />
                </Field>
                <Field label="Cidade">
                  <input style={inputStyle} placeholder="Cidade" value={form.city} onChange={(e) => set("city", e.target.value)} disabled={disabled} />
                </Field>
              </div>
              <Field label="Estado (UF)">
                <input style={{ ...inputStyle, maxWidth: "100px", textTransform: "uppercase" }} placeholder="GO" maxLength={2} value={form.state} onChange={(e) => set("state", e.target.value.toUpperCase())} disabled={disabled} />
              </Field>

              {/* Comodidades da região — detectadas automaticamente pelo CEP */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "4px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-muted)" }}>
                    Comodidades da região
                  </span>
                  {comodidadesLoading ? (
                    <span style={{ fontSize: "12px", color: "rgba(99,102,241,1)" }}>Analisando proximidades…</span>
                  ) : comodidadesMsg ? (
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{comodidadesMsg}</span>
                  ) : null}
                </div>
                <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", opacity: 0.7, marginBottom: "12px" }}>
                  Preenchido automaticamente a partir do CEP. Você pode ajustar manualmente.
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px" }}>
                  {COMODIDADES.map((c) => {
                    const checked = Boolean(form.comodidades?.[c.key]);
                    return (
                      <label key={c.key} style={{
                        display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px",
                        borderRadius: "8px", cursor: disabled ? "not-allowed" : "pointer",
                        border: checked ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.08)",
                        background: checked ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.02)",
                        transition: "all 0.15s ease", fontSize: "13px", userSelect: "none",
                        opacity: disabled ? 0.55 : 1,
                      }}>
                        <input
                          type="checkbox" checked={checked} onChange={() => toggleComodidade(c.key)} disabled={disabled}
                          style={{ accentColor: "var(--primary, #6366f1)", width: "14px", height: "14px", flexShrink: 0 }}
                        />
                        {c.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Etapa 2 — Detalhes */}
          {step === 2 && (
            <>
              <Field label="Finalidade">
                <select style={selectStyle} value={form.finalidade} onChange={(e) => set("finalidade", e.target.value)} disabled={disabled}>
                  <option value="">Não informado</option>
                  <option value="RESIDENCIAL">Residencial</option>
                  <option value="COMERCIAL">Comercial</option>
                </select>
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <Field label="Quartos"><input style={inputStyle} type="number" min="0" placeholder="0" value={form.bedrooms} onChange={(e) => set("bedrooms", e.target.value)} disabled={disabled} /></Field>
                <Field label="Suítes"><input style={inputStyle} type="number" min="0" placeholder="0" value={form.suites} onChange={(e) => set("suites", e.target.value)} disabled={disabled} /></Field>
                <Field label="Vagas de garagem"><input style={inputStyle} type="number" min="0" placeholder="0" value={form.parkingSpots} onChange={(e) => set("parkingSpots", e.target.value)} disabled={disabled} /></Field>
                <Field label="Metragem (m²)"><input style={inputStyle} type="number" min="1" step="0.01" placeholder="0,00" value={form.squareFootage} onChange={(e) => set("squareFootage", e.target.value)} disabled={disabled} /></Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
                <Field label="Área construída (m²)"><input style={inputStyle} type="number" min="0" step="0.01" placeholder="0,00" value={form.areaConstruida} onChange={(e) => set("areaConstruida", e.target.value)} disabled={disabled} /></Field>
                <Field label="Área privativa (m²)"><input style={inputStyle} type="number" min="0" step="0.01" placeholder="0,00" value={form.areaPrivativa} onChange={(e) => set("areaPrivativa", e.target.value)} disabled={disabled} /></Field>
                <Field label="Área total (m²)"><input style={inputStyle} type="number" min="0" step="0.01" placeholder="0,00" value={form.areaTotal} onChange={(e) => set("areaTotal", e.target.value)} disabled={disabled} /></Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <Field label="Status">
                  <select style={selectStyle} value={form.status} onChange={(e) => set("status", e.target.value)} disabled={disabled}>
                    <option value="DRAFT">Rascunho</option>
                    <option value="ACTIVE">Ativo</option>
                    <option value="INACTIVE">Inativo</option>
                  </select>
                </Field>
                <Field label="Andamento">
                  <select style={selectStyle} value={form.andamento} onChange={(e) => set("andamento", e.target.value)} disabled={disabled}>
                    <option value="">Não informado</option>
                    <option value="PRONTO_PARA_MORAR">Pronto para morar</option>
                    <option value="EM_CONSTRUCAO">Em construção</option>
                  </select>
                </Field>
              </div>
              <label style={{
                display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", borderRadius: "12px",
                cursor: disabled ? "not-allowed" : "pointer",
                border: form.aceitaPermuta ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.08)",
                background: form.aceitaPermuta ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.02)",
                transition: "all 0.2s ease", userSelect: "none", opacity: disabled ? 0.55 : 1,
              }}>
                <input type="checkbox" checked={form.aceitaPermuta} onChange={(e) => set("aceitaPermuta", e.target.checked)} disabled={disabled} style={{ accentColor: "var(--primary, #6366f1)", width: "16px", height: "16px", flexShrink: 0 }} />
                <div>
                  <span style={{ fontSize: "14px", fontWeight: "500" }}>Aceita permuta</span>
                  <span style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>Proprietário aceita troca parcial ou total</span>
                </div>
              </label>
            </>
          )}

          {/* Etapa 3 — Fotos */}
          {step === 3 && (
            <>
              {/* Área de upload */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "2px dashed rgba(255,255,255,0.1)", borderRadius: "16px", padding: "32px 24px", textAlign: "center" }}>
                <div style={{ color: "rgba(255,255,255,0.2)", marginBottom: "14px" }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
                <p style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: "600" }}>
                  {images.length > 0 ? "Adicionar mais fotos" : "Adicionar fotos"}
                </p>
                <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: "var(--text-muted)" }}>
                  {images.length > 0
                    ? `${images.length} foto(s) selecionada(s) — arraste para reordenar, ✕ para remover`
                    : "Selecione uma ou mais fotos. JPG, PNG, WEBP. Arraste para reordenar."
                  }
                </p>
                <input
                  type="file" accept="image/*" multiple id="foto-upload"
                  onChange={(e) => { addImages(Array.from(e.target.files || [])); e.target.value = ""; }}
                  disabled={disabled} style={{ display: "none" }}
                />
                <label htmlFor="foto-upload" style={{
                  display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 24px",
                  borderRadius: "10px", cursor: disabled ? "not-allowed" : "pointer",
                  background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)",
                  color: "rgba(99,102,241,1)", fontSize: "14px", fontWeight: "600",
                  opacity: disabled ? 0.55 : 1,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Selecionar fotos
                </label>
              </div>

              {/* Grade de fotos com drag-to-reorder */}
              <PhotoGrid images={images} onRemove={removeImage} onReorder={reorderImages} />

              {images.length > 1 && (
                <p className="hint" style={{ marginTop: "-8px" }}>
                  Arraste as fotos para reordenar. A primeira (nº 1) será a capa do anúncio.
                </p>
              )}
            </>
          )}

          {/* Etapa 4 — Divulgar */}
          {step === 4 && (
            <>
              {/* Banner de sucesso */}
              <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "18px 20px", borderRadius: "14px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "rgba(16,185,129,0.2)", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <div>
                  <div style={{ fontWeight: "600", fontSize: "14px" }}>Imóvel salvo com sucesso!</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                    Agora você pode divulgá-lo nas redes sociais.
                  </div>
                </div>
              </div>

              {/* Legenda editável */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Legenda do post
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={8}
                  style={{ ...inputStyle, resize: "vertical", lineHeight: "1.6", fontFamily: "inherit", minHeight: "160px" }}
                  placeholder="Escreva a legenda do post..."
                />
                <span style={{ fontSize: "11px", color: "var(--text-muted)", opacity: 0.7 }}>
                  Edite a legenda antes de publicar. Ela será usada no Facebook e Instagram.
                </span>
              </div>

              {/* Aviso se não tem permissão de publicar nas redes */}
              {!cargo?.publicarRedes && (
                <div style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", fontSize: "13px", color: "#fbbf24" }}>
                  Você não tem permissão para publicar nas redes sociais. Contate o administrador.
                </div>
              )}

              {/* Botões de publicação */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {/* Facebook */}
                {cargo?.publicarRedes && (
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", borderRadius: "12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#1877f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "600", fontSize: "13px" }}>Facebook</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px" }}>
                        {socialStatus === null ? "Verificando conexão…" : socialStatus.facebook.connected ? `Página: ${socialStatus.facebook.pageName}` : "Não conectado — configure em Configurações"}
                      </div>
                    </div>
                    {publishResults.facebook ? (
                      <span style={{ fontSize: "12px", fontWeight: "600", color: publishResults.facebook.success ? "#10b981" : "#ef4444", whiteSpace: "nowrap" }}>
                        {publishResults.facebook.success ? "✓ Publicado" : `✗ ${publishResults.facebook.error}`}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePublish("facebook")}
                        disabled={!socialStatus?.facebook?.connected || publishLoading.facebook}
                        style={{ padding: "7px 16px", borderRadius: "8px", fontSize: "12px", fontWeight: "600", background: "#1877f2", color: "#fff", border: "none", cursor: socialStatus?.facebook?.connected ? "pointer" : "not-allowed", opacity: socialStatus?.facebook?.connected ? 1 : 0.4, flexShrink: 0, width: "auto" }}
                      >
                        {publishLoading.facebook ? "Publicando…" : "Publicar"}
                      </button>
                    )}
                  </div>
                )}

                {/* Instagram */}
                {cargo?.publicarRedes && (
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", borderRadius: "12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "600", fontSize: "13px" }}>Instagram</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px" }}>
                        {socialStatus === null ? "Verificando conexão…" : socialStatus.instagram.connected ? "Conta Business conectada" : "Não conectado — vincule ao Facebook em Configurações"}
                      </div>
                    </div>
                    {publishResults.instagram ? (
                      <span style={{ fontSize: "12px", fontWeight: "600", color: publishResults.instagram.success ? "#10b981" : "#ef4444", whiteSpace: "nowrap" }}>
                        {publishResults.instagram.success ? "✓ Publicado" : `✗ ${publishResults.instagram.error}`}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePublish("instagram")}
                        disabled={!socialStatus?.instagram?.connected || publishLoading.instagram}
                        style={{ padding: "7px 16px", borderRadius: "8px", fontSize: "12px", fontWeight: "600", background: "linear-gradient(135deg, #f09433, #dc2743, #bc1888)", color: "#fff", border: "none", cursor: socialStatus?.instagram?.connected ? "pointer" : "not-allowed", opacity: socialStatus?.instagram?.connected ? 1 : 0.4, flexShrink: 0, width: "auto" }}
                      >
                        {publishLoading.instagram ? "Publicando…" : "Publicar"}
                      </button>
                    )}
                  </div>
                )}

                {/* WhatsApp — sempre disponível */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", borderRadius: "12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#25d366", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.999 2C6.477 2 2 6.477 2 12c0 1.785.476 3.456 1.302 4.914L2 22l5.233-1.274A9.96 9.96 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "600", fontSize: "13px" }}>WhatsApp</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px" }}>
                      Abre o WhatsApp com a legenda pronta para compartilhar
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleWhatsApp}
                    style={{ padding: "7px 16px", borderRadius: "8px", fontSize: "12px", fontWeight: "600", background: "#25d366", color: "#fff", border: "none", cursor: "pointer", flexShrink: 0, width: "auto" }}
                  >
                    Compartilhar
                  </button>
                </div>
              </div>

              {/* Ações finais */}
              <div style={{ display: "flex", gap: "12px", marginTop: "4px", flexWrap: "wrap", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <button
                  type="button"
                  onClick={() => { setSavedPropertyId(null); setForm(EMPTY); setStep(0); setPublishResults({}); }}
                  style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 20px", borderRadius: "10px", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "rgba(99,102,241,1)", fontSize: "13px", fontWeight: "600", cursor: "pointer", width: "auto" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  Cadastrar novo imóvel
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setSearchParams({ tab: "list" })}
                  style={{ fontSize: "13px", padding: "9px 20px", width: "auto" }}
                >
                  Ver portfólio
                </button>
              </div>
            </>
          )}

          {/* Navegação (steps 0–3) */}
          {step < 4 && (
            <div style={{ display: "flex", gap: "12px", marginTop: "8px", flexWrap: "wrap" }}>
              {step > 0 && (
                <button type="button" className="button-secondary" onClick={handleBack} disabled={disabled} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                  Voltar
                </button>
              )}
              {step < 3 ? (
                <button type="button" onClick={handleNext} disabled={disabled} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  Continuar
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              ) : (
                <button type="button" onClick={handleSubmit} disabled={disabled}>
                  {isEditing ? "Salvar alterações" : "Publicar imóvel"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Painel de preview (apenas steps 0–3) ─── */}
        {step < 4 && (
          <div style={{ width: "300px", flexShrink: 0 }}>
            <PropertyPreviewCard form={form} previewUrls={previewUrls} />
          </div>
        )}
      </div>
    </section>
  );
}
