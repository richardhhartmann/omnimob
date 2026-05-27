import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { uploadToCloudinary } from "../utils/uploadToCloudinary";

const STATUS_LABEL = { ACTIVE: "Ativo", INACTIVE: "Inativo", DRAFT: "Rascunho" };
const STATUS_COLOR = { ACTIVE: "#10b981", INACTIVE: "#ef4444", DRAFT: "#f59e0b" };
const ANDAMENTO_LABEL = { PRONTO_PARA_MORAR: "Pronto para morar", EM_CONSTRUCAO: "Em construção" };

function formatPrice(value) {
  const n = Number(value);
  if (!n) return "—";
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ─── Ícones ───────────────────────────────────────────────────────────────────

function IconEye() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconKey() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="17" r="4" /><path d="M10.85 13.15l8.65-8.65" /><path d="M19.5 4.5l.5 3-3 .5" />
    </svg>
  );
}

function IconPercent() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" />
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
      <rect x="1" y="11" width="22" height="9" rx="2" /><path d="M5 11V7a7 7 0 0 1 14 0v4" />
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

function IconPin() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function IconLink() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

// ─── Card de métrica ──────────────────────────────────────────────────────────

function MetricCard({ icon, label, value, color, subtitle }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "16px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </span>
        <div style={{ padding: "8px", borderRadius: "10px", background: `${color}18`, color }}>
          {icon}
        </div>
      </div>
      <div>
        <span style={{ fontSize: "32px", fontWeight: "700", color: "#fff", letterSpacing: "-1px", lineHeight: 1 }}>
          {value}
        </span>
        {subtitle && (
          <span style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Chip de stat do imóvel ───────────────────────────────────────────────────

function StatChip({ icon, label }) {
  if (!label) return null;
  return (
    <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "5px 10px", borderRadius: "6px" }}>
      {icon} {label}
    </span>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function PropertyInsightsPage({ session }) {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const tenantSlug = session?.tenant?.slug || "";

  const [property, setProperty] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [images, setImages] = useState([]);
  const [manualImageUrl, setManualImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [error, setError] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showUrlForm, setShowUrlForm] = useState(false);

  const leadRate = metrics?.summary?.leadConversionRate ?? 0;
  const saleRate = metrics?.summary?.saleConversionRate ?? 0;


  async function loadAll(from, to) {
    if (!tenantSlug || !propertyId) return;
    setLoading(true);
    setError("");
    try {
      const [propertyData, metricData, imageData] = await Promise.all([
        api.getPropertyById(tenantSlug, propertyId),
        api.getPropertyMetrics(tenantSlug, propertyId, { from: from || undefined, to: to || undefined }),
        api.listPropertyImages(tenantSlug, propertyId),
      ]);
      setProperty(propertyData);
      setMetrics(metricData);
      setImages(imageData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(dateFrom, dateTo); }, [tenantSlug, propertyId]);

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadLoading(true);
    setError("");
    try {
      const uploaded = await uploadToCloudinary(file);
      await api.addPropertyImage(tenantSlug, propertyId, uploaded);
      await loadAll(dateFrom, dateTo);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadLoading(false);
      e.target.value = "";
    }
  }

  async function handleManualImageAdd(e) {
    e.preventDefault();
    if (!manualImageUrl.trim()) return;
    setUploadLoading(true);
    setError("");
    try {
      await api.addPropertyImage(tenantSlug, propertyId, { url: manualImageUrl.trim() });
      setManualImageUrl("");
      setShowUrlForm(false);
      await loadAll(dateFrom, dateTo);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadLoading(false);
    }
  }

  async function handleDeleteImage(imageId) {
    setUploadLoading(true);
    setError("");
    try {
      await api.deletePropertyImage(tenantSlug, propertyId, imageId);
      await loadAll(dateFrom, dateTo);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadLoading(false);
    }
  }

  const coverUrl = images[0]?.url;
  const status = property?.status || "DRAFT";

  return (
    <div style={{ maxWidth: "1000px", display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* ── Cabeçalho ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <button
            type="button"
            onClick={() => navigate("/?tab=list")}
            style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "var(--text-muted)", fontSize: "13px", cursor: "pointer", padding: "0", marginBottom: "12px" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Portfólio Ativo
          </button>
          <h1 style={{ margin: 0, fontSize: "26px", fontWeight: "700", lineHeight: 1.2 }}>
            Painel de Performance
          </h1>
        </div>
        {loading && (
          <span style={{ fontSize: "13px", color: "var(--text-muted)", alignSelf: "flex-end", paddingBottom: "4px" }}>
            Atualizando...
          </span>
        )}
      </div>

      {error ? <div className="error">{error}</div> : null}

      {/* ── Card do imóvel ─────────────────────────────────────────────────── */}
      <div style={{
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "20px", overflow: "hidden", display: "flex", gap: "0",
      }}>
        {/* Foto */}
        <div style={{ width: "220px", flexShrink: 0, background: "rgba(255,255,255,0.04)", position: "relative" }}>
          {coverUrl ? (
            <img src={coverUrl} alt="capa" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", minHeight: "160px", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.12)" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
          )}
          {images.length > 1 && (
            <span style={{ position: "absolute", bottom: "10px", right: "10px", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: "10px", fontWeight: "700", padding: "3px 8px", borderRadius: "999px" }}>
              +{images.length - 1} fotos
            </span>
          )}
        </div>

        {/* Info */}
        <div style={{ padding: "24px 28px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em", color: STATUS_COLOR[status], background: `${STATUS_COLOR[status]}18`, padding: "3px 10px", borderRadius: "999px" }}>
                {STATUS_LABEL[status]}
              </span>
              {property?.andamento && (
                <span style={{ fontSize: "10px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", background: "rgba(255,255,255,0.07)", padding: "3px 10px", borderRadius: "999px" }}>
                  {ANDAMENTO_LABEL[property.andamento]}
                </span>
              )}
              {property?.aceitaPermuta && (
                <span style={{ fontSize: "10px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "#818cf8", background: "rgba(99,102,241,0.12)", padding: "3px 10px", borderRadius: "999px" }}>
                  Aceita permuta
                </span>
              )}
            </div>

            <h2 style={{ margin: "0 0 6px 0", fontSize: "20px", fontWeight: "700", lineHeight: 1.3 }}>
              {property?.title || "Carregando..."}
            </h2>

            {(property?.neighborhood || property?.city) && (
              <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "13px", color: "var(--text-muted)", marginBottom: "8px" }}>
                <IconPin />
                {[property.neighborhood, property.city, property.state].filter(Boolean).join(", ")}
              </div>
            )}

            <p style={{ margin: 0, fontSize: "22px", fontWeight: "700", letterSpacing: "-0.5px", color: "#fff" }}>
              {formatPrice(property?.price)}
            </p>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {property?.propertyType && (
              <span style={{ fontSize: "12px", color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: "6px" }}>
                {property.propertyType}
              </span>
            )}
            <StatChip icon={<IconArea />} label={property?.squareFootage ? `${property.squareFootage} m²` : null} />
            <StatChip icon={<IconBed />} label={property?.bedrooms != null ? `${property.bedrooms} quartos${property.suites ? ` · ${property.suites} suítes` : ""}` : null} />
            <StatChip icon={<IconCar />} label={property?.parkingSpots != null ? `${property.parkingSpots} vagas` : null} />
          </div>
        </div>
      </div>

      {/* ── Filtro de período ──────────────────────────────────────────────── */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "16px 20px" }}>
        <form onSubmit={(e) => { e.preventDefault(); loadAll(dateFrom, dateTo); }} style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}>
          <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", alignSelf: "center", marginRight: "4px" }}>
            Período
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>De</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} disabled={loading} style={{ width: "150px", padding: "8px 12px", fontSize: "13px" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>Até</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} disabled={loading} style={{ width: "150px", padding: "8px 12px", fontSize: "13px" }} />
          </div>
          <button type="submit" disabled={loading} style={{ padding: "8px 20px", fontSize: "13px", width: "auto" }}>
            Filtrar
          </button>
          {(dateFrom || dateTo) && (
            <button type="button" className="button-secondary" onClick={() => { setDateFrom(""); setDateTo(""); loadAll("", ""); }} disabled={loading} style={{ padding: "8px 16px", fontSize: "13px", width: "auto" }}>
              Limpar
            </button>
          )}
          {metrics?.filter && (
            <span style={{ fontSize: "12px", color: "var(--text-muted)", alignSelf: "center", fontStyle: "italic" }}>
              Período filtrado ativo
            </span>
          )}
        </form>
      </div>

      {/* ── Métricas ──────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "12px" }}>
        <MetricCard
          icon={<IconEye />} label="Acessos" color="#3b82f6"
          value={metrics?.property?.viewCount ?? 0}
          subtitle="Total acumulado"
        />
        <MetricCard
          icon={<IconUser />} label="Leads" color="#8b5cf6"
          value={metrics?.property?.leadCount ?? 0}
          subtitle="Total acumulado"
        />
        <MetricCard
          icon={<IconKey />} label="Vendas" color="#10b981"
          value={metrics?.property?.saleCount ?? 0}
          subtitle="Total acumulado"
        />
        <MetricCard
          icon={<IconPercent />} label="Conv. Acesso→Lead" color="#f59e0b"
          value={`${leadRate}%`}
          subtitle="Leads por acesso"
        />
        <MetricCard
          icon={<IconPercent />} label="Conv. Lead→Venda" color="#059669"
          value={`${saleRate}%`}
          subtitle="Vendas por lead"
        />
      </div>

      {/* ── Detalhes do ativo ─────────────────────────────────────────────── */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "24px" }}>
        <h3 style={{ margin: "0 0 16px 0", fontSize: "15px", fontWeight: "600" }}>Detalhes do Ativo</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px" }}>
          {[
            ["Tipo", property?.propertyType || "—"],
            ["Área", property?.squareFootage != null ? `${property.squareFootage} m²` : "—"],
            ["Quartos", property?.bedrooms ?? "—"],
            ["Suítes", property?.suites ?? "—"],
            ["Vagas", property?.parkingSpots ?? "—"],
            ["CEP", property?.cep || "—"],
            ["Endereço", property?.address || "—"],
            ["Bairro", property?.neighborhood || "—"],
            ["Cidade / UF", property ? `${property.city} / ${property.state}` : "—"],
          ].map(([label, val]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px", paddingBottom: "10px", borderBottom: "1px solid rgba(255,255,255,0.05)", marginBottom: "0" }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "500", flexShrink: 0 }}>{label}</span>
              <span style={{ fontSize: "13px", textAlign: "right", fontWeight: "500" }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
