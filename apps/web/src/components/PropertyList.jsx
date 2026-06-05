import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { loadSession } from "../session.js";

// ─── Modal de publicação retroativa ──────────────────────────────────────────

function PublishModal({ property, tenantSlug, onClose, onSuccess }) {
  const session = loadSession();
  const cargo = session?.usuario?.cargo;

  const [caption, setCaption] = useState("");
  const [socialStatus, setSocialStatus] = useState(null);
  const [publishLoading, setPublishLoading] = useState({ facebook: false, instagram: false });
  const [publishResults, setPublishResults] = useState({});

  useEffect(() => {
    const price = Number(property.price);
    const priceStr = price > 0
      ? `R$ ${price.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
      : "";
    const location = [property.neighborhood, property.city, property.state].filter(Boolean).join(", ");
    const stats = [
      property.bedrooms ? `${property.bedrooms} quarto${property.bedrooms !== 1 ? "s" : ""}` : "",
      property.squareFootage ? `${property.squareFootage} m²` : "",
      property.parkingSpots ? `${property.parkingSpots} vaga${property.parkingSpots !== 1 ? "s" : ""}` : "",
    ].filter(Boolean).join(" · ");
    const atribs = property.atributos?.map(a => a.atributo?.descricao).filter(Boolean) || [];
    const vitrineUrl = `${window.location.origin}/vitrine/${tenantSlug}/imovel/${property.id}`;
    const whatsapp = session?.tenant?.whatsapp || "";

    const lines = [
      `🏠 ${property.title}`,
      location ? `📍 ${location}` : "",
      priceStr ? `💰 ${priceStr}` : "",
      stats ? `📐 ${stats}` : "",
      atribs.length > 0 ? `✅ ${atribs.join(" · ")}` : "",
      property.aceitaPermuta ? "🔄 Aceita permuta" : "",
      "",
      property.description || "",
      "",
      `🔗 Ver detalhes: ${vitrineUrl}`,
      whatsapp ? `📲 Contato: ${whatsapp}` : "",
    ].filter((l, i, arr) => !(l === "" && arr[i - 1] === ""));
    setCaption(lines.join("\n").trim());

    // Pre-populate results from existing successful publications
    const results = {};
    const fbPub = property.publications?.find(p => p.channel === "FACEBOOK" && p.status === "PUBLISHED");
    const igPub = property.publications?.find(p => p.channel === "INSTAGRAM" && p.status === "PUBLISHED");
    if (fbPub) results.facebook = { success: true };
    if (igPub) results.instagram = { success: true };
    setPublishResults(results);

    api.getSocialStatus(tenantSlug).then(setSocialStatus).catch(() => {});
  }, [property.id]);

  async function handlePublish(platform) {
    setPublishLoading(prev => ({ ...prev, [platform]: true }));
    try {
      const result = await api.publishProperty(tenantSlug, property.id, { platforms: [platform], caption });
      setPublishResults(prev => ({ ...prev, ...result }));
      if (result[platform]?.success) onSuccess?.();
    } catch (err) {
      setPublishResults(prev => ({ ...prev, [platform]: { success: false, error: err.message } }));
    } finally {
      setPublishLoading(prev => ({ ...prev, [platform]: false }));
    }
  }

  function handleWhatsApp() {
    const vitrineUrl = `${window.location.origin}/vitrine/${tenantSlug}/imovel/${property.id}`;
    const text = caption || `🏠 ${property.title}\n🔗 ${vitrineUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  const inputStyle = {
    width: "100%", boxSizing: "border-box",
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "10px", color: "inherit", padding: "12px 14px", fontSize: "13px",
    outline: "none", transition: "border-color 0.2s", resize: "vertical",
    lineHeight: "1.6", fontFamily: "inherit",
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", animation: "fadeIn 0.15s ease-out" }}
      onClick={onClose}
    >
      <div
        style={{ background: "rgba(18,18,30,0.99)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "20px", padding: "28px", width: "100%", maxWidth: "500px", maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
          <div>
            <div style={{ fontSize: "16px", fontWeight: "700" }}>Divulgar Imóvel</div>
            <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "360px" }}>{property.title}</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "var(--text-muted)", cursor: "pointer", padding: "6px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Caption */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
          <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Legenda do post
          </label>
          <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={6} style={{ ...inputStyle, minHeight: "120px" }} placeholder="Escreva a legenda..." />
          <span style={{ fontSize: "11px", color: "var(--text-muted)", opacity: 0.7 }}>Edite antes de publicar. Usada no Facebook e Instagram.</span>
        </div>

        {/* Permission warning */}
        {!cargo?.publicarRedes && (
          <div style={{ padding: "10px 14px", borderRadius: "10px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", fontSize: "13px", color: "#fbbf24", marginBottom: "12px" }}>
            Você não tem permissão para publicar nas redes sociais.
          </div>
        )}

        {/* Platform cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {/* Facebook */}
          {cargo?.publicarRedes && (
            <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#1877f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: "600", fontSize: "13px" }}>Facebook</div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px" }}>
                  {socialStatus === null ? "Verificando…" : socialStatus.facebook.connected ? `Página: ${socialStatus.facebook.pageName}` : "Não conectado — configure em Configurações"}
                </div>
              </div>
              {publishResults.facebook ? (
                <span style={{ fontSize: "11px", fontWeight: "600", color: publishResults.facebook.success ? "#10b981" : "#ef4444", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {publishResults.facebook.success ? "✓ Publicado" : "✗ Erro"}
                </span>
              ) : (
                <button type="button" onClick={() => handlePublish("facebook")}
                  disabled={!socialStatus?.facebook?.connected || publishLoading.facebook}
                  style={{ padding: "6px 14px", borderRadius: "7px", fontSize: "12px", fontWeight: "600", background: "#1877f2", color: "#fff", border: "none", cursor: socialStatus?.facebook?.connected ? "pointer" : "not-allowed", opacity: socialStatus?.facebook?.connected ? 1 : 0.4, flexShrink: 0, width: "auto" }}>
                  {publishLoading.facebook ? "…" : "Publicar"}
                </button>
              )}
            </div>
          )}

          {/* Instagram */}
          {cargo?.publicarRedes && (
            <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: "600", fontSize: "13px" }}>Instagram</div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px" }}>
                  {socialStatus === null ? "Verificando…" : socialStatus.instagram.connected ? "Conta Business conectada" : "Não conectado — configure em Configurações"}
                </div>
              </div>
              {publishResults.instagram ? (
                <span style={{ fontSize: "11px", fontWeight: "600", color: publishResults.instagram.success ? "#10b981" : "#ef4444", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {publishResults.instagram.success ? "✓ Publicado" : "✗ Erro"}
                </span>
              ) : (
                <button type="button" onClick={() => handlePublish("instagram")}
                  disabled={!socialStatus?.instagram?.connected || publishLoading.instagram}
                  style={{ padding: "6px 14px", borderRadius: "7px", fontSize: "12px", fontWeight: "600", background: "linear-gradient(135deg, #f09433, #dc2743, #bc1888)", color: "#fff", border: "none", cursor: socialStatus?.instagram?.connected ? "pointer" : "not-allowed", opacity: socialStatus?.instagram?.connected ? 1 : 0.4, flexShrink: 0, width: "auto" }}>
                  {publishLoading.instagram ? "…" : "Publicar"}
                </button>
              )}
            </div>
          )}

          {/* WhatsApp */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#25d366", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.999 2C6.477 2 2 6.477 2 12c0 1.785.476 3.456 1.302 4.914L2 22l5.233-1.274A9.96 9.96 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: "600", fontSize: "13px" }}>WhatsApp</div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "1px" }}>Abre o WhatsApp com a legenda pronta</div>
            </div>
            <button type="button" onClick={handleWhatsApp}
              style={{ padding: "6px 14px", borderRadius: "7px", fontSize: "12px", fontWeight: "600", background: "#25d366", color: "#fff", border: "none", cursor: "pointer", flexShrink: 0, width: "auto" }}>
              Compartilhar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Badges de publicação social ─────────────────────────────────────────────

const SOCIAL_PLATFORMS = [
  {
    channel: "FACEBOOK",
    label: "Facebook",
    brand: "#1877f2",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>,
  },
  {
    channel: "INSTAGRAM",
    label: "Instagram",
    brand: "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>,
  },
];

function SocialBadges({ publications }) {
  return (
    <div style={{ display: "flex", gap: "7px" }}>
      {SOCIAL_PLATFORMS.map(({ channel, label, brand, icon }) => {
        const pub = publications?.find(p => p.channel === channel);
        const ok = pub?.status === "PUBLISHED";
        const fail = pub?.status === "FAILED";
        return (
          <span key={channel}
            title={`${label}: ${ok ? "Publicado" : fail ? "Falhou" : "Não publicado"}`}
            style={{
              position: "relative",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: "28px", height: "28px", borderRadius: "9px",
              background: ok ? brand : "rgba(255,255,255,0.04)",
              border: ok ? "none" : "1px solid rgba(255,255,255,0.08)",
              color: ok ? "#fff" : "rgba(255,255,255,0.28)",
              filter: fail ? "grayscale(1)" : "none",
              boxShadow: ok ? "0 2px 8px rgba(0,0,0,0.25)" : "none",
              transition: "all 0.2s",
            }}>
            {icon}
            {(ok || fail) && (
              <span style={{
                position: "absolute", top: "-3px", right: "-3px",
                width: "12px", height: "12px", borderRadius: "50%",
                background: ok ? "#22c55e" : "#ef4444",
                border: "2px solid #12121e",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                  {ok ? <polyline points="20 6 9 17 4 12" /> : <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>}
                </svg>
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

// ─── Lista de imóveis ─────────────────────────────────────────────────────────

export function PropertyList({ properties = [], onDelete, onToggleStatus, onEdit, onPublishSuccess, disabled }) {
  const navigate = useNavigate();
  const session = loadSession();
  const tenantSlug = session?.tenant?.slug;

  const [viewMode, setViewMode] = useState("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [minPriceFilter, setMinPriceFilter] = useState("");
  const [maxPriceFilter, setMaxPriceFilter] = useState("");
  const [bedroomsFilter, setBedroomsFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [publishingProperty, setPublishingProperty] = useState(null);

  const uniqueCities = useMemo(() => {
    const cities = properties.map((p) => p.city).filter(Boolean);
    return [...new Set(cities)].sort();
  }, [properties]);

  const uniqueTypes = useMemo(() => {
    const types = properties.map((p) => p.propertyType).filter(Boolean);
    return [...new Set(types)].sort();
  }, [properties]);

  const filteredProperties = useMemo(() => {
    return properties.filter((property) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        property.title?.toLowerCase().includes(searchLower) ||
        property.description?.toLowerCase().includes(searchLower);

      const matchesType = !typeFilter || property.propertyType === typeFilter;

      const matchesMinPrice = !minPriceFilter || Number(property.price) >= Number(minPriceFilter);
      const matchesMaxPrice = !maxPriceFilter || Number(property.price) <= Number(maxPriceFilter);

      const matchesBedrooms = !bedroomsFilter || Number(property.bedrooms || 0) >= Number(bedroomsFilter);

      const matchesCity = !cityFilter || property.city === cityFilter;

      return matchesSearch && matchesType && matchesMinPrice && matchesMaxPrice && matchesBedrooms && matchesCity;
    });
  }, [properties, searchTerm, typeFilter, minPriceFilter, maxPriceFilter, bedroomsFilter, cityFilter]);

  const getStatusColor = (status) => {
    switch (status) {
      case "ACTIVE":
        return { bg: "rgba(34, 197, 94, 0.2)", text: "#86efac", border: "rgba(34, 197, 94, 0.3)" };
      case "INACTIVE":
        return { bg: "rgba(239, 68, 68, 0.2)", text: "#fca5a5", border: "rgba(239, 68, 68, 0.3)" };
      case "DRAFT":
      default:
        return { bg: "rgba(168, 164, 206, 0.2)", text: "#c0b8e4", border: "rgba(168, 164, 206, 0.3)" };
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "ACTIVE": return "Ativo";
      case "INACTIVE": return "Inativo";
      case "DRAFT":
      default: return "Status";
    }
  };

  const btnShare = {
    padding: "10px", borderRadius: "8px", background: "transparent",
    border: "1px solid rgba(255,255,255,0.2)", color: "#fff",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.2s",
  };

  return (
    <section style={{ animation: "fadeIn 0.4s ease-out", display: "flex", flexDirection: "column", gap: "24px" }}>
      <div className="glass-panel" style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h2 style={{ fontSize: "24px", fontWeight: "700", margin: 0 }}>Portfólio Ativo</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
              Mostrando {filteredProperties.length} de {properties.length} imóveis
            </p>
          </div>

          <div style={{ display: "flex", background: "rgba(0,0,0,0.2)", borderRadius: "8px", padding: "4px", border: "1px solid rgba(255,255,255,0.1)" }}>
            <button
              onClick={() => setViewMode("grid")}
              style={{
                padding: "8px 12px", borderRadius: "6px", border: "none",
                background: viewMode === "grid" ? "rgba(255,255,255,0.15)" : "transparent",
                color: viewMode === "grid" ? "#fff" : "var(--text-muted)",
                cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: "8px",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode("list")}
              style={{
                padding: "8px 12px", borderRadius: "6px", border: "none",
                background: viewMode === "list" ? "rgba(255,255,255,0.15)" : "transparent",
                color: viewMode === "list" ? "#fff" : "var(--text-muted)",
                cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: "8px",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", padding: "16px", background: "rgba(255,255,255,0.03)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.05)" }}>
          <input
            placeholder="Buscar por termo ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ gridColumn: "1 / -1" }}
            disabled={disabled}
          />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} disabled={disabled}>
            <option value="">Todos os Tipos</option>
            {uniqueTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} disabled={disabled}>
            <option value="">Todas as Cidades</option>
            {uniqueCities.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>
          <input type="number" placeholder="Preço Mínimo (R$)" value={minPriceFilter} onChange={(e) => setMinPriceFilter(e.target.value)} disabled={disabled} />
          <input type="number" placeholder="Preço Máximo (R$)" value={maxPriceFilter} onChange={(e) => setMaxPriceFilter(e.target.value)} disabled={disabled} />
          <select value={bedroomsFilter} onChange={(e) => setBedroomsFilter(e.target.value)} disabled={disabled}>
            <option value="">Quartos (Mínimo)</option>
            <option value="1">1+ Quarto</option>
            <option value="2">2+ Quartos</option>
            <option value="3">3+ Quartos</option>
            <option value="4">4+ Quartos</option>
            <option value="5">5+ Quartos</option>
          </select>
        </div>
      </div>

      {filteredProperties.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: "center", padding: "64px 24px" }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "16px" }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <p style={{ color: "var(--text-muted)", fontSize: "16px" }}>Nenhum imóvel encontrado com estes filtros.</p>
          <button onClick={() => { setSearchTerm(""); setTypeFilter(""); setMinPriceFilter(""); setMaxPriceFilter(""); setBedroomsFilter(""); setCityFilter(""); }} className="button-secondary" style={{ marginTop: "16px" }}>
            Limpar Filtros
          </button>
        </div>
      ) : null}

      {/* ── Grade ─── */}
      {viewMode === "grid" && filteredProperties.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "24px" }}>
          {filteredProperties.map((property) => {
            const statusStyle = getStatusColor(property.status);
            return (
              <article
                key={property.id}
                onClick={() => navigate(`/imoveis/${property.id}`)}
                className="glass-panel"
                style={{ padding: "0", display: "flex", flexDirection: "column", overflow: "hidden", cursor: "pointer", transition: "transform 0.3s ease, box-shadow 0.3s ease", border: "1px solid rgba(255, 255, 255, 0.15)", background: "linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)" }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 24px rgba(0,0,0,0.2)"; e.currentTarget.style.border = "1px solid rgba(255,255,255,0.25)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.border = "1px solid rgba(255, 255, 255, 0.15)"; }}
              >
                <div style={{ padding: "24px", flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                    <div style={{ flex: 1, paddingRight: "12px" }}>
                      <span style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)", fontWeight: "600", display: "block", marginBottom: "4px" }}>
                        {property.propertyType || "Não definido"}
                      </span>
                      <h3 style={{ fontSize: "20px", margin: 0, fontWeight: "600", lineHeight: "1.3", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {property.title}
                      </h3>
                    </div>
                    <span style={{ background: statusStyle.bg, color: statusStyle.text, border: `1px solid ${statusStyle.border}`, padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap" }}>
                      {getStatusLabel(property.status)}
                    </span>
                  </div>

                  <p style={{ fontSize: "24px", fontWeight: "700", color: "#fff", marginBottom: "20px" }}>
                    R$ {Number(property.price).toLocaleString("pt-BR")}
                  </p>

                  <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "20px", color: "var(--text-muted)", fontSize: "14px" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: "2px" }}>
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                    </svg>
                    <span style={{ lineHeight: "1.4", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {property.address}{property.neighborhood ? `, ${property.neighborhood}` : ""}<br />
                      {property.city ? property.city : ""}{property.state ? ` / ${property.state}` : ""}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "16px", padding: "16px 0", borderTop: "1px solid rgba(255,255,255,0.1)", borderBottom: "1px solid rgba(255,255,255,0.1)", marginBottom: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "#e2e8f0" }} title="Quartos">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 22v-8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8" /><path d="M7 22v-2" /><path d="M17 22v-2" /><path d="M5 12V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5" /></svg>
                      <strong>{property.bedrooms ?? 0}</strong>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "#e2e8f0" }} title="Suítes">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                      <strong>{property.suites ?? 0}</strong>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "#e2e8f0" }} title="Vagas">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"/></svg>
                      <strong>{property.parkingSpots ?? 0}</strong>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "#e2e8f0" }} title="Metragem">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><path d="M9 9h6v6H9z"/></svg>
                      <strong>{property.squareFootage || "-"}</strong>
                    </div>
                  </div>
                </div>

                {/* Footer com badges sociais + ações */}
                <div style={{ padding: "12px 24px", background: "rgba(0,0,0,0.2)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <SocialBadges publications={property.publications} />
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={(e) => { e.stopPropagation(); setPublishingProperty(property); }} disabled={disabled} style={{ ...btnShare }} onMouseEnter={(e) => !disabled && (e.currentTarget.style.background = "rgba(99,102,241,0.1)")} onMouseLeave={(e) => !disabled && (e.currentTarget.style.background = "transparent")} title="Divulgar nas redes sociais">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onEdit(property); }} disabled={disabled} style={{ ...btnShare }} onMouseEnter={(e) => !disabled && (e.currentTarget.style.background = "rgba(255,255,255,0.05)")} onMouseLeave={(e) => !disabled && (e.currentTarget.style.background = "transparent")} title="Editar">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onToggleStatus(property.id, property.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"); }} disabled={disabled} style={{ ...btnShare }} onMouseEnter={(e) => !disabled && (e.currentTarget.style.background = "rgba(255,255,255,0.05)")} onMouseLeave={(e) => !disabled && (e.currentTarget.style.background = "transparent")} title={property.status === "ACTIVE" ? "Desativar" : "Ativar"}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(property.id); }} disabled={disabled} style={{ padding: "10px", borderRadius: "8px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#fca5a5", cursor: disabled ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }} onMouseEnter={(e) => !disabled && (e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)")} onMouseLeave={(e) => !disabled && (e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)")} title="Excluir">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ── Lista ─── */}
      {viewMode === "list" && filteredProperties.length > 0 && (
        <div className="glass-panel" style={{ padding: "0", overflow: "hidden" }}>
          <div style={{ display: "grid", gap: "1px", background: "rgba(255,255,255,0.05)" }}>
            {filteredProperties.map((property) => {
              const statusStyle = getStatusColor(property.status);
              return (
                <div
                  key={property.id}
                  onClick={() => navigate(`/imoveis/${property.id}`)}
                  style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: "20px", alignItems: "center", padding: "14px 24px", cursor: "pointer", background: "linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)", transition: "background 0.2s" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)"}
                >
                  <div>
                    <span style={{ background: statusStyle.bg, color: statusStyle.text, border: `1px solid ${statusStyle.border}`, padding: "4px 8px", borderRadius: "16px", fontSize: "11px", fontWeight: "600", whiteSpace: "nowrap", display: "inline-block", marginBottom: "8px" }}>
                      {getStatusLabel(property.status)}
                    </span>
                    <p style={{ fontSize: "16px", fontWeight: "700", color: "#fff", margin: 0 }}>
                      R$ {Number(property.price).toLocaleString("pt-BR")}
                    </p>
                  </div>

                  <div>
                    <h3 style={{ fontSize: "16px", margin: "0 0 4px 0", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "400px" }}>
                      {property.title}
                    </h3>
                    <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>
                      {property.propertyType || "Tipo não definido"} • {property.city || "Cidade não informada"} • {property.bedrooms ?? 0} quartos
                    </p>
                  </div>

                  <SocialBadges publications={property.publications} />

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={(e) => { e.stopPropagation(); setPublishingProperty(property); }} disabled={disabled} style={{ padding: "8px", borderRadius: "8px", background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.2s", display: "flex", alignItems: "center" }} onMouseEnter={(e) => !disabled && (e.currentTarget.style.background = "rgba(99,102,241,0.1)")} onMouseLeave={(e) => !disabled && (e.currentTarget.style.background = "transparent")} title="Divulgar">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onEdit(property); }} disabled={disabled} style={{ padding: "8px", borderRadius: "8px", background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.2s", display: "flex", alignItems: "center" }} onMouseEnter={(e) => !disabled && (e.currentTarget.style.background = "rgba(255,255,255,0.05)")} onMouseLeave={(e) => !disabled && (e.currentTarget.style.background = "transparent")} title="Editar">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(property.id); }} disabled={disabled} style={{ padding: "8px", borderRadius: "8px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#fca5a5", cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.2s", display: "flex", alignItems: "center" }} onMouseEnter={(e) => !disabled && (e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)")} onMouseLeave={(e) => !disabled && (e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)")} title="Excluir">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Modal de publicação ─── */}
      {publishingProperty && tenantSlug && (
        <PublishModal
          property={publishingProperty}
          tenantSlug={tenantSlug}
          onClose={() => setPublishingProperty(null)}
          onSuccess={() => { onPublishSuccess?.(); }}
        />
      )}
    </section>
  );
}
