import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { InteressadosNoImovel } from "../components/InteressadosNoImovel.jsx";
import { comodidadesAtivas } from "../utils/comodidades";
import { tipoContratoInfo, tipoContratoLabel } from "../utils/tiposContrato";
import { Panorama360 } from "../components/Panorama360";

const STATUS_LABEL = { ACTIVE: "Ativo", INACTIVE: "Inativo", DRAFT: "Rascunho" };
const STATUS_COLOR = { ACTIVE: "#10b981", INACTIVE: "#ef4444", DRAFT: "#f59e0b" };
const ANDAMENTO_LABEL = { PRONTO_PARA_MORAR: "Pronto para morar", EM_CONSTRUCAO: "Em construção" };
const FINALIDADE_LABEL = { RESIDENCIAL: "Residencial", COMERCIAL: "Comercial" };

function formatPrice(value) {
  const n = Number(value);
  if (!n) return "—";
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtArea(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m²`;
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

function IconBath() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12V5a2 2 0 0 1 2-2 2 2 0 0 1 2 2M4 12h17a1 1 0 0 1 1 1v2a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-3z" /><line x1="6" y1="19" x2="6" y2="22" /><line x1="18" y1="19" x2="18" y2="22" />
    </svg>
  );
}

function IconDoor() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17" /><circle cx="15" cy="12" r="1" fill="currentColor" />
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

// ─── Carrossel de fotos (somente leitura) ──────────────────────────────────────
// A edição das fotos é feita exclusivamente pela rota /imoveis/editar.

function PhotoCarousel({ images }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => { if (idx > images.length - 1) setIdx(Math.max(0, images.length - 1)); }, [images.length]); // eslint-disable-line
  const total = images.length;
  const current = images[idx];
  const go = (d) => (e) => { e.stopPropagation(); setIdx((i) => (i + d + total) % total); };

  const arrow = (side) => ({
    position: "absolute", top: "50%", [side]: "10px", transform: "translateY(-50%)",
    width: "34px", height: "34px", borderRadius: "50%", border: "1px solid var(--linha-25, rgba(255,255,255,0.25))",
    background: "rgba(0,0,0,0.5)", color: "#fff", cursor: "pointer", padding: 0, fontSize: "20px", lineHeight: 1,
    display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(3px)",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0d1018" }}>
      <div style={{ position: "relative", flex: 1, minHeight: "300px", overflow: "hidden" }}>
        {current && current.is360 ? (
          <Panorama360 key={`pano-${current.id || current.url}`} src={current.url} height="100%" />
        ) : current ? (
          <img key={idx} src={current.url} alt={`foto ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", animation: "fadeIn 0.3s ease" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", minHeight: "300px", display: "flex", flexDirection: "column", gap: "10px", alignItems: "center", justifyContent: "center", color: "var(--tinta-15, rgba(255,255,255,0.15))" }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
            </svg>
            <span style={{ fontSize: "13px" }}>Sem fotos</span>
          </div>
        )}

        {total > 1 && (
          <>
            <button type="button" onClick={go(-1)} aria-label="Anterior" style={arrow("left")}>‹</button>
            <button type="button" onClick={go(1)} aria-label="Próxima" style={arrow("right")}>›</button>
            <span style={{ position: "absolute", top: "12px", left: "12px", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "999px" }}>
              {idx + 1} / {total}
            </span>
          </>
        )}
      </div>

      {/* Miniaturas (navegação) — fundo é a imagem atual bem borrada */}
      {total > 1 && (
        <div style={{ position: "relative", borderTop: "1px solid var(--linha-06, rgba(255,255,255,0.06))", overflow: "hidden" }}>
          {current && (
            <div
              aria-hidden
              style={{
                position: "absolute", inset: 0,
                backgroundImage: `url(${current.url})`, backgroundSize: "cover", backgroundPosition: "center",
                filter: "blur(30px)", transform: "scale(1.3)", opacity: 0.5, transition: "background-image 0.3s ease",
              }}
            />
          )}
          <div style={{ position: "absolute", inset: 0, background: "rgba(10,13,20,0.45)" }} />
          <div style={{ position: "relative", display: "flex", gap: "6px", padding: "10px", overflowX: "auto" }}>
          {images.map((img, i) => (
            <button
              key={img.id || i}
              type="button"
              onClick={() => setIdx(i)}
              style={{ position: "relative", width: "52px", height: "52px", flexShrink: 0, borderRadius: "8px", overflow: "hidden", padding: 0, cursor: "pointer", border: i === idx ? "2px solid #6366f1" : "2px solid var(--linha-12, rgba(255,255,255,0.12))", background: "none" }}
            >
              <img src={img.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              {img.is360 && (
                <span style={{ position: "absolute", bottom: "2px", right: "2px", fontSize: "7px", fontWeight: 800, color: "#fff", background: "rgba(99,102,241,0.95)", padding: "1px 4px", borderRadius: "999px", lineHeight: 1.3 }}>360°</span>
              )}
            </button>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Card de métrica ──────────────────────────────────────────────────────────

function MetricCard({ icon, label, value, color, subtitle }) {
  return (
    <div style={{
      background: "var(--sup-03, rgba(255,255,255,0.03))", border: "1px solid var(--linha-08, rgba(255,255,255,0.08))",
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
    <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "var(--text-muted)", background: "var(--sup-05, rgba(255,255,255,0.05))", padding: "5px 10px", borderRadius: "6px" }}>
      {icon} {label}
    </span>
  );
}

// ─── Seção genérica ───────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div style={{ background: "var(--sup-03, rgba(255,255,255,0.03))", border: "1px solid var(--linha-08, rgba(255,255,255,0.08))", borderRadius: "16px", padding: "24px" }}>
      <h3 style={{ margin: "0 0 16px 0", fontSize: "15px", fontWeight: "600" }}>{title}</h3>
      {children}
    </div>
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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

  useEffect(() => { loadAll(dateFrom, dateTo); }, [tenantSlug, propertyId]); // eslint-disable-line

  const status = property?.status || "DRAFT";
  const isComercial = property?.finalidade === "COMERCIAL";
  const atributos = (property?.atributos || []).map((a) => a.atributo?.descricao).filter(Boolean);
  const comodidades = comodidadesAtivas(property?.comodidades);

  // Linhas do bloco "Detalhes do Ativo" (só as que têm valor)
  const detalhes = property ? [
    ["Tipo de contrato", tipoContratoLabel(property.tipoContrato)],
    ["Finalidade", FINALIDADE_LABEL[property.finalidade] || "—"],
    ["Tipo", property.propertyType || property.tipoImovel?.descricao || "—"],
    property.andamento ? ["Andamento", ANDAMENTO_LABEL[property.andamento]] : null,
    ["Aceita permuta", property.aceitaPermuta ? "Sim" : "Não"],
    ["Área útil", fmtArea(property.squareFootage) || "—"],
    fmtArea(property.areaTerreno) ? ["Área do terreno", fmtArea(property.areaTerreno)] : null,
    fmtArea(property.areaConstruida) ? ["Área construída", fmtArea(property.areaConstruida)] : null,
    fmtArea(property.areaPrivativa) ? ["Área privativa", fmtArea(property.areaPrivativa)] : null,
    fmtArea(property.areaTotal) ? ["Área total", fmtArea(property.areaTotal)] : null,
    isComercial ? ["Salas", property.salas ?? 0] : ["Quartos", property.bedrooms ?? 0],
    isComercial ? ["Banheiros", property.banheiros ?? 0] : ["Suítes", property.suites ?? 0],
    ["Vagas", property.parkingSpots ?? 0],
    ["CEP", property.cep || "—"],
    ["Endereço", property.address || "—"],
    ["Bairro", property.neighborhood || "—"],
    ["Cidade / UF", `${property.city || "—"} / ${property.state || "—"}`],
  ].filter(Boolean) : [];

  return (
    <div style={{ maxWidth: "1000px", display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* ── Cabeçalho ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <button
            type="button"
            onClick={() => navigate("/imoveis/portfolio")}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", width: "auto", alignSelf: "flex-start", background: "none", border: "none", color: "var(--text-muted)", fontSize: "13px", cursor: "pointer", padding: "0", marginBottom: "12px" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Voltar
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

      {/* ── Card do imóvel: carrossel + resumo ───────────────────────────────── */}
      <div style={{
        background: "var(--sup-03, rgba(255,255,255,0.03))", border: "1px solid var(--linha-08, rgba(255,255,255,0.08))",
        borderRadius: "20px", overflow: "hidden", display: "flex", flexWrap: "wrap",
      }}>
        {/* Carrossel */}
        <div style={{ flex: "1 1 400px", minWidth: "300px", minHeight: "360px", display: "flex" }}>
          <div style={{ width: "100%" }}>
            <PhotoCarousel images={images} />
          </div>
        </div>

        {/* Resumo */}
        <div style={{ flex: "1 1 320px", minWidth: "280px", padding: "24px 28px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em", color: STATUS_COLOR[status], background: `${STATUS_COLOR[status]}18`, padding: "3px 10px", borderRadius: "999px" }}>
                {STATUS_LABEL[status]}
              </span>
              {tipoContratoInfo(property?.tipoContrato) && (
                <span
                  title={tipoContratoInfo(property.tipoContrato).descricao}
                  style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", color: tipoContratoInfo(property.tipoContrato).cor, background: `${tipoContratoInfo(property.tipoContrato).cor}1f`, border: `1px solid ${tipoContratoInfo(property.tipoContrato).cor}59`, padding: "3px 10px", borderRadius: "999px" }}
                >
                  {tipoContratoInfo(property.tipoContrato).label}
                </span>
              )}
              {property?.finalidade && (
                <span style={{ fontSize: "10px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "#a5b4fc", background: "rgba(99,102,241,0.15)", padding: "3px 10px", borderRadius: "999px" }}>
                  {FINALIDADE_LABEL[property.finalidade]}
                </span>
              )}
              {property?.andamento && (
                <span style={{ fontSize: "10px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", background: "var(--sup-07, rgba(255,255,255,0.07))", padding: "3px 10px", borderRadius: "999px" }}>
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

            {property?.description && (
              <p style={{ margin: "14px 0 0", fontSize: "13px", lineHeight: 1.6, color: "var(--text-muted)", whiteSpace: "pre-wrap" }}>
                {property.description}
              </p>
            )}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {property?.propertyType && (
              <span style={{ fontSize: "12px", color: "var(--text-muted)", background: "var(--sup-05, rgba(255,255,255,0.05))", padding: "4px 10px", borderRadius: "6px" }}>
                {property.propertyType}
              </span>
            )}
            <StatChip icon={<IconArea />} label={fmtArea(property?.squareFootage)} />
            {isComercial ? (
              <>
                <StatChip icon={<IconDoor />} label={property?.salas ? `${property.salas} sala${property.salas !== 1 ? "s" : ""}` : null} />
                <StatChip icon={<IconBath />} label={property?.banheiros ? `${property.banheiros} banheiro${property.banheiros !== 1 ? "s" : ""}` : null} />
              </>
            ) : (
              <StatChip icon={<IconBed />} label={property?.bedrooms != null ? `${property.bedrooms} quarto${property.bedrooms !== 1 ? "s" : ""}${property.suites ? ` · ${property.suites} suíte${property.suites !== 1 ? "s" : ""}` : ""}` : null} />
            )}
            <StatChip icon={<IconCar />} label={property?.parkingSpots ? `${property.parkingSpots} vaga${property.parkingSpots !== 1 ? "s" : ""}` : null} />
          </div>
        </div>
      </div>

      {/* ── Filtro de período ──────────────────────────────────────────────── */}
      <div style={{ background: "var(--sup-02, rgba(255,255,255,0.015))", border: "1px solid var(--linha-04, rgba(255,255,255,0.04))", borderRadius: "14px", padding: "16px 20px" }}>
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
        <MetricCard icon={<IconEye />} label="Acessos" color="#3b82f6" value={metrics?.property?.viewCount ?? 0} subtitle="Total acumulado" />
        <MetricCard icon={<IconUser />} label="Leads" color="#8b5cf6" value={metrics?.property?.leadCount ?? 0} subtitle="Total acumulado" />
        <MetricCard icon={<IconKey />} label="Vendas" color="#10b981" value={metrics?.property?.saleCount ?? 0} subtitle="Total acumulado" />
        <MetricCard icon={<IconPercent />} label="Conv. Acesso→Lead" color="#f59e0b" value={`${leadRate}%`} subtitle="Leads por acesso" />
        <MetricCard icon={<IconPercent />} label="Conv. Lead→Venda" color="#059669" value={`${saleRate}%`} subtitle="Vendas por lead" />
      </div>

      {/* ── Detalhes do ativo ─────────────────────────────────────────────── */}
      {/* Quem da carteira estava esperando por este imóvel. Vem ANTES dos
          detalhes porque é acionável — "ligue para estas três pessoas" — e o
          resto da tela é leitura. */}
      {property ? <InteressadosNoImovel propertyId={property.id} tenantSlug={tenantSlug} /> : null}

      <Section title="Detalhes do Ativo">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px" }}>
          {detalhes.map(([label, val]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px", paddingBottom: "10px", borderBottom: "1px solid var(--linha-05, rgba(255,255,255,0.05))" }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "500", flexShrink: 0 }}>{label}</span>
              <span style={{ fontSize: "13px", textAlign: "right", fontWeight: "500" }}>{val}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Atributos do imóvel ───────────────────────────────────────────── */}
      {atributos.length > 0 && (
        <Section title="Atributos">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {atributos.map((a) => (
              <span key={a} style={{ fontSize: "13px", color: "#c7d2fe", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)", padding: "6px 12px", borderRadius: "999px" }}>
                {a}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* ── Comodidades da região ─────────────────────────────────────────── */}
      {comodidades.length > 0 && (
        <Section title="Comodidades da região">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {comodidades.map((c) => (
              <span key={c.key} style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "13px", color: "var(--text)", background: "var(--sup-04, rgba(255,255,255,0.04))", border: "1px solid var(--linha-08, rgba(255,255,255,0.08))", padding: "6px 12px", borderRadius: "10px" }}>
                <c.Icone size={15} /> {c.label}
              </span>
            ))}
          </div>
        </Section>
      )}

    </div>
  );
}
