import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { uploadToCloudinary } from "../utils/uploadToCloudinary";

export function PropertyInsightsPage({ session }) {
  const { propertyId } = useParams();
  const tenantSlug = session?.tenant?.slug || "";
  const [property, setProperty] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [images, setImages] = useState([]);
  const [manualImageUrl, setManualImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const leadRate = metrics?.summary?.leadConversionRate ?? 0;
  const saleRate = metrics?.summary?.saleConversionRate ?? 0;

  const eventsMap = useMemo(() => {
    const map = { VIEW: 0, LEAD: 0, SALE: 0 };
    (metrics?.eventsByType || []).forEach((entry) => {
      map[entry.type] = entry.count;
    });
    return map;
  }, [metrics]);

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

  useEffect(() => {
    loadAll(dateFrom, dateTo);
  }, [tenantSlug, propertyId]);

  async function handleMetric(type) {
    setLoading(true);
    setError("");
    try {
      if (type === "VIEW") await api.registerPropertyView(tenantSlug, propertyId);
      if (type === "LEAD") await api.registerPropertyLead(tenantSlug, propertyId);
      if (type === "SALE") await api.registerPropertySale(tenantSlug, propertyId);
      await loadAll(dateFrom, dateTo);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  function handleFilterApply(e) {
    e.preventDefault();
    loadAll(dateFrom, dateTo);
  }

  function handleFilterClear() {
    setDateFrom("");
    setDateTo("");
    loadAll("", "");
  }

  async function handleManualImageAdd(event) {
    event.preventDefault();
    if (!manualImageUrl.trim()) return;
    setLoading(true);
    setError("");
    try {
      await api.addPropertyImage(tenantSlug, propertyId, { url: manualImageUrl.trim() });
      setManualImageUrl("");
      await loadAll();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");
    try {
      const uploaded = await uploadToCloudinary(file);
      await api.addPropertyImage(tenantSlug, propertyId, uploaded);
      await loadAll();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    } finally {
      event.target.value = "";
    }
  }

  async function handleDeleteImage(imageId) {
    setLoading(true);
    setError("");
    try {
      await api.deletePropertyImage(tenantSlug, propertyId, imageId);
      await loadAll();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="main-content" style={{ maxWidth: "1000px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
        <div>
          <h1 style={{ fontSize: "28px", marginBottom: "8px" }}>Painel de Performance</h1>
          <p style={{ color: "var(--text-muted)" }}>{property ? property.title : "Sincronizando dados..."}</p>
        </div>
        <Link to="/" className="button-secondary link-button" style={{ width: "auto" }}>
          Voltar ao Portfólio
        </Link>
      </header>

      {error ? <div className="error">{error}</div> : null}
      {loading ? <p style={{ color: "var(--text-muted)", marginBottom: "16px" }}>Processando requisição...</p> : null}

      <form
        onSubmit={handleFilterApply}
        style={{ display: "flex", gap: "12px", alignItems: "flex-end", marginBottom: "24px", flexWrap: "wrap" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>De</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            disabled={loading}
            style={{ width: "160px" }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "12px", color: "var(--text-muted)" }}>Até</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            disabled={loading}
            style={{ width: "160px" }}
          />
        </div>
        <button type="submit" style={{ width: "auto", padding: "8px 16px" }} disabled={loading}>
          Filtrar
        </button>
        {(dateFrom || dateTo) ? (
          <button
            type="button"
            className="button-secondary"
            style={{ width: "auto", padding: "8px 16px" }}
            onClick={handleFilterClear}
            disabled={loading}
          >
            Limpar
          </button>
        ) : null}
        {metrics?.filter ? (
          <span style={{ fontSize: "13px", color: "var(--text-muted)", alignSelf: "center" }}>
            Exibindo período filtrado
          </span>
        ) : null}
      </form>

      <section className="metrics-grid">
        <div className="glass-panel metric-card">
          <p className="metric-label">Acessos</p>
          <h2>{metrics?.property?.viewCount ?? 0}</h2>
        </div>
        <div className="glass-panel metric-card">
          <p className="metric-label">Leads</p>
          <h2>{metrics?.property?.leadCount ?? 0}</h2>
        </div>
        <div className="glass-panel metric-card">
          <p className="metric-label">Vendas</p>
          <h2>{metrics?.property?.saleCount ?? 0}</h2>
        </div>
        <div className="glass-panel metric-card">
          <p className="metric-label">Conversão (Acesso &gt; Lead)</p>
          <h2>{leadRate}%</h2>
        </div>
        <div className="glass-panel metric-card">
          <p className="metric-label">Conversão (Lead &gt; Venda)</p>
          <h2>{saleRate}%</h2>
        </div>
      </section>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <section className="glass-panel">
          <h2 style={{ marginBottom: "16px" }}>Detalhes do Ativo</h2>
          <div style={{ display: "grid", gap: "12px", color: "var(--text-muted)" }}>
            <p><strong>Tipo:</strong> {property?.propertyType || "-"} | <strong>Área:</strong> {property?.squareFootage != null ? `${property.squareFootage} m²` : "-"}</p>
            <p><strong>Quartos:</strong> {property?.bedrooms ?? 0} | <strong>Suítes:</strong> {property?.suites ?? 0} | <strong>Vagas:</strong> {property?.parkingSpots ?? 0}</p>
            <p><strong>CEP:</strong> {property?.cep || "-"} | <strong>Bairro:</strong> {property?.neighborhood || "-"}</p>
            <p><strong>Localidade:</strong> {property?.city || "-"} / {property?.state || "-"}</p>
            <p><strong>Endereço:</strong> {property?.address || "-"}</p>
          </div>
        </section>

        <section className="glass-panel">
          <h2 style={{ marginBottom: "16px" }}>Controle Manual de Eventos</h2>
          <div className="actions" style={{ flexDirection: "column" }}>
            <button type="button" onClick={() => handleMetric("VIEW")} disabled={loading}>
              Registrar Acesso (+1)
            </button>
            <button type="button" onClick={() => handleMetric("LEAD")} disabled={loading}>
              Registrar Lead (+1)
            </button>
            <button type="button" className="button-secondary" style={{ borderColor: "var(--success)", color: "var(--success)" }} onClick={() => handleMetric("SALE")} disabled={loading}>
              Registrar Venda (+1)
            </button>
          </div>
          <p className="hint">
            Histórico consolidado: VIEW {eventsMap.VIEW} | LEAD {eventsMap.LEAD} | SALE {eventsMap.SALE}
          </p>
        </section>
      </div>

      <section className="glass-panel" style={{ marginTop: "16px" }}>
        <h2 style={{ marginBottom: "16px" }}>Galeria de Mídia</h2>
        
        <div className="grid grid-2" style={{ marginBottom: "24px" }}>
          <div>
            <span style={{ display: "block", marginBottom: "8px", fontSize: "14px" }}>Upload Direto</span>
            <input type="file" accept="image/*" onChange={handleFileUpload} disabled={loading} />
          </div>
          <form onSubmit={handleManualImageAdd} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ display: "block", fontSize: "14px" }}>Link Externo</span>
            <input
              placeholder="Cole a URL da imagem"
              value={manualImageUrl}
              onChange={(e) => setManualImageUrl(e.target.value)}
              disabled={loading}
            />
            <button type="submit" disabled={loading} className="button-secondary">
              Adicionar via URL
            </button>
          </form>
        </div>

        {images.length === 0 ? (
          <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "24px 0" }}>Nenhuma mídia vinculada a este ativo.</p>
        ) : (
          <div className="image-grid">
            {images.map((image) => (
              <article key={image.id} className="image-card">
                <img src={image.url} alt="Mídia do imóvel" />
                <button type="button" onClick={() => handleDeleteImage(image.id)} disabled={loading}>
                  Remover
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}