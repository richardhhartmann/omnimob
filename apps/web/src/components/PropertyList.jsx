import { useEffect, useMemo, useState } from "react";
import { DivulgarModal } from "./DivulgarModal";
import { useConfirm } from "./ConfirmModal";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { loadSession } from "../session.js";
import { planoLiberaRedes } from "../utils/planos.js";
import { SkeletonCards } from "./Skeleton";

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

// ─── Carrossel de fotos do card ───────────────────────────────────────────────

function PropertyCarousel({ images = [] }) {
  const [idx, setIdx] = useState(0);
  const urls = (images || []).map((img) => img.url).filter(Boolean);

  if (urls.length === 0) {
    return (
      <div style={{ height: "190px", background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.18)" }}>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
        </svg>
      </div>
    );
  }

  const safe = idx % urls.length;
  const prev = (e) => { e.stopPropagation(); setIdx((i) => (i - 1 + urls.length) % urls.length); };
  const next = (e) => { e.stopPropagation(); setIdx((i) => (i + 1) % urls.length); };
  const chevron = {
    position: "absolute", top: "50%", transform: "translateY(-50%)",
    width: "30px", height: "30px", padding: 0, borderRadius: "50%",
    background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.3)",
    color: "#fff", fontSize: "18px", lineHeight: 1, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
  };

  return (
    <div style={{ position: "relative", height: "190px", overflow: "hidden", background: "rgba(0,0,0,0.25)" }}>
      <img key={urls[safe]} src={urls[safe]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", animation: "fadeIn 0.3s ease" }} />
      {urls.length > 1 && (
        <>
          <button type="button" onClick={prev} style={{ ...chevron, left: "8px" }}>‹</button>
          <button type="button" onClick={next} style={{ ...chevron, right: "8px" }}>›</button>
          <span style={{ position: "absolute", bottom: "8px", left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: "10px", fontWeight: "600", padding: "2px 8px", borderRadius: "999px" }}>
            {safe + 1}/{urls.length}
          </span>
        </>
      )}
    </div>
  );
}

// ─── Lista de imóveis ─────────────────────────────────────────────────────────

export function PropertyList({ properties = [], onDelete, onToggleStatus, onEdit, onPublishSuccess, disabled, loading = false }) {
  const { confirm, modal: confirmModal } = useConfirm();
  const navigate = useNavigate();
  const session = loadSession();
  const tenantSlug = session?.tenant?.slug;
  const cargo = session?.usuario?.cargo;
  const canViewReports = Boolean(cargo?.verRelatorios); // abre o Painel de Performance
  const canPublish = Boolean(cargo?.publicarRedes) && planoLiberaRedes(session?.tenant?.plano); // divulgar exige plano Profissional+

  const openInsights = (id) => { if (canViewReports) navigate(`/imoveis/${id}`); };

  async function handleDelete(id) {
    if (!await confirm("Excluir este imóvel permanentemente?", "Excluir")) return;
    onDelete(id);
  }

  const [viewMode, setViewMode] = useState("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [minPriceFilter, setMinPriceFilter] = useState("");
  const [maxPriceFilter, setMaxPriceFilter] = useState("");
  const [bedroomsFilter, setBedroomsFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [publishingProperty, setPublishingProperty] = useState(null);

  // Auto-sincroniza ao abrir o portfólio (sem o usuário precisar clicar), em
  // segundo plano. Throttle de 60s via localStorage para não martelar a Graph API
  // a cada navegação. Se algo foi removido das redes, recarrega para sumir o ícone.
  useEffect(() => {
    if (!tenantSlug) return;
    const key = `domus_social_sync_${tenantSlug}`;
    const last = Number(localStorage.getItem(key) || 0);
    if (Date.now() - last < 60 * 1000) return;
    localStorage.setItem(key, String(Date.now()));
    api.reconcileAllSocial(tenantSlug)
      .then((res) => { if (res.removedCount > 0) onPublishSuccess?.(); })
      .catch(() => {});
  }, [tenantSlug]);

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
    <section className="main-content" style={{ animation: "fadeIn 0.4s ease-out", display: "flex", flexDirection: "column", gap: "24px" }}>
      {confirmModal}
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

      {loading ? (
        <SkeletonCards count={6} />
      ) : filteredProperties.length === 0 ? (
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
      {!loading && viewMode === "grid" && filteredProperties.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "24px" }}>
          {filteredProperties.map((property) => {
            const statusStyle = getStatusColor(property.status);
            return (
              <article
                key={property.id}
                onClick={() => openInsights(property.id)}
                className="glass-panel"
                style={{ padding: "0", display: "flex", flexDirection: "column", overflow: "hidden", cursor: canViewReports ? "pointer" : "default", transition: "transform 0.3s ease, box-shadow 0.3s ease", border: "1px solid rgba(255, 255, 255, 0.15)", background: "linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)" }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 24px rgba(0,0,0,0.2)"; e.currentTarget.style.border = "1px solid rgba(255,255,255,0.25)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.border = "1px solid rgba(255, 255, 255, 0.15)"; }}
              >
                <PropertyCarousel images={property.images} />
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

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 16px", padding: "16px 0", borderTop: "1px solid rgba(255,255,255,0.1)", borderBottom: "1px solid rgba(255,255,255,0.1)", marginBottom: "20px" }}>
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
                <div style={{ padding: "12px 24px", background: "rgba(0,0,0,0.2)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px 8px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <SocialBadges publications={property.publications} />
                  <div style={{ display: "flex", gap: "8px" }}>
                    {canPublish && (
                      <button onClick={(e) => { e.stopPropagation(); setPublishingProperty(property); }} disabled={disabled} style={{ ...btnShare }} onMouseEnter={(e) => !disabled && (e.currentTarget.style.background = "rgba(99,102,241,0.1)")} onMouseLeave={(e) => !disabled && (e.currentTarget.style.background = "transparent")} title="Divulgar nas redes sociais">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); onEdit(property); }} disabled={disabled} style={{ ...btnShare }} onMouseEnter={(e) => !disabled && (e.currentTarget.style.background = "rgba(255,255,255,0.05)")} onMouseLeave={(e) => !disabled && (e.currentTarget.style.background = "transparent")} title="Editar">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button className={property.status === "ACTIVE" ? "btn-danger" : undefined} onClick={(e) => { e.stopPropagation(); onToggleStatus(property.id, property.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"); }} disabled={disabled} style={{ ...btnShare }} onMouseEnter={(e) => !disabled && (e.currentTarget.style.background = "rgba(255,255,255,0.05)")} onMouseLeave={(e) => !disabled && (e.currentTarget.style.background = "transparent")} title={property.status === "ACTIVE" ? "Desativar" : "Ativar"}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                    </button>
                    <button className="btn-danger" onClick={(e) => { e.stopPropagation(); handleDelete(property.id); }} disabled={disabled} style={{ padding: "10px", borderRadius: "8px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#fca5a5", cursor: disabled ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }} onMouseEnter={(e) => !disabled && (e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)")} onMouseLeave={(e) => !disabled && (e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)")} title="Excluir">
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
      {!loading && viewMode === "list" && filteredProperties.length > 0 && (
        <div className="glass-panel" style={{ padding: "0", overflow: "hidden" }}>
          <div style={{ display: "grid", gap: "1px", background: "rgba(255,255,255,0.05)" }}>
            {filteredProperties.map((property, index) => {
              const statusStyle = getStatusColor(property.status);
              // Efeito zebrado: linhas alternam o tom de fundo para facilitar a leitura.
              const rowBg = index % 2 === 0 ? "rgba(255,255,255,0.015)" : "rgba(255,255,255,0.055)";
              const rowHover = "rgba(255,255,255,0.10)";
              return (
                <div
                  key={property.id}
                  onClick={() => openInsights(property.id)}
                  style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: "20px", alignItems: "center", padding: "14px 24px", cursor: canViewReports ? "pointer" : "default", background: rowBg, transition: "background 0.2s" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = rowHover}
                  onMouseLeave={(e) => e.currentTarget.style.background = rowBg}
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
                    {canPublish && (
                      <button onClick={(e) => { e.stopPropagation(); setPublishingProperty(property); }} disabled={disabled} style={{ padding: "8px", borderRadius: "8px", background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.2s", display: "flex", alignItems: "center" }} onMouseEnter={(e) => !disabled && (e.currentTarget.style.background = "rgba(99,102,241,0.1)")} onMouseLeave={(e) => !disabled && (e.currentTarget.style.background = "transparent")} title="Divulgar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); onEdit(property); }} disabled={disabled} style={{ padding: "8px", borderRadius: "8px", background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.2s", display: "flex", alignItems: "center" }} onMouseEnter={(e) => !disabled && (e.currentTarget.style.background = "rgba(255,255,255,0.05)")} onMouseLeave={(e) => !disabled && (e.currentTarget.style.background = "transparent")} title="Editar">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button className="btn-danger" onClick={(e) => { e.stopPropagation(); handleDelete(property.id); }} disabled={disabled} style={{ padding: "8px", borderRadius: "8px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#fca5a5", cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.2s", display: "flex", alignItems: "center" }} onMouseEnter={(e) => !disabled && (e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)")} onMouseLeave={(e) => !disabled && (e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)")} title="Excluir">
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
        <DivulgarModal
          property={publishingProperty}
          tenantSlug={tenantSlug}
          onClose={() => setPublishingProperty(null)}
          onSuccess={() => { onPublishSuccess?.(); }}
        />
      )}
    </section>
  );
}
