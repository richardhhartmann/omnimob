import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { normalizeShowcaseConfig } from "../utils/showcaseConfig";
import { ShowcaseHeader } from "../components/showcase/ShowcaseHeader";
import { Panorama360 } from "../components/Panorama360";
import { comodidadesAtivas } from "../utils/comodidades";
import { loadShowcaseFonts, getCachedTenant, setCachedTenant } from "../utils/showcaseFonts";

const IcPin  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const IcArea = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9V3h6"/><path d="M3 3l6 6"/><path d="M21 15v6h-6"/><path d="M21 21l-6-6"/></svg>;
const IcBed  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4v16"/><path d="M22 8v12"/><path d="M2 8h20"/><rect x="6" y="4" width="12" height="4" rx="1"/></svg>;
const IcCar  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="10" width="20" height="10" rx="2"/><path d="m6 10 3-6h6l3 6"/><circle cx="7" cy="17" r="1" fill="currentColor"/><circle cx="17" cy="17" r="1" fill="currentColor"/></svg>;
const IcSuite = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 22V8l9-6 9 6v14"/><path d="M9 22V12h6v10"/></svg>;
const IcHome = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5 12 3l9 6.5V21H3V9.5z"/><path d="M9 21v-6h6v6"/></svg>;
const IcCheck = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;

function isLancamento(createdAt) {
  if (!createdAt) return false;
  return (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24) <= 30;
}

export function ShowcasePropertyPage() {
  const { tenantSlug, propertyId } = useParams();
  const [property, setProperty] = useState(null);
  const [tenant, setTenant] = useState(() => getCachedTenant(tenantSlug));
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sendingInterest, setSendingInterest] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [interestForm, setInterestForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.innerWidth < 768);
  const thumbsRef = useRef(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxClosing, setLightboxClosing] = useState(false);

  useEffect(() => {
    const handler = () => setIsMobileViewport(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => { loadShowcaseFonts(); }, []);

  useEffect(() => {
    if (!tenantSlug || !propertyId) return;
    setLoading(true);
    setError("");
    api.getPublicPropertyById(tenantSlug, propertyId)
      .then((data) => {
        setProperty(data.property);
        setTenant(data.tenant);
        setCachedTenant(tenantSlug, data.tenant);
        setCarouselIndex(0);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [tenantSlug, propertyId]);

  useEffect(() => {
    if (!tenantSlug) return;
    api.getPublicShowcase(tenantSlug)
      .then((data) => {
        setSuggestions((data.properties || []).filter((p) => p.id !== propertyId).slice(0, 4));
      })
      .catch(() => {});
  }, [tenantSlug, propertyId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [propertyId]);

  async function handleInterest() {
    if (!tenantSlug || !propertyId) return;
    setSendingInterest(true);
    setSuccessMessage("");
    setError("");
    try {
      const response = await api.registerPublicInterest(tenantSlug, propertyId, interestForm);
      setProperty((prev) => prev ? { ...prev, leadCount: response.property.leadCount } : prev);
      setSuccessMessage("Interesse enviado! A imobiliária entrará em contato em breve.");
      setInterestForm({ name: "", email: "", phone: "", message: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingInterest(false);
    }
  }

  const images = property?.images?.length ? property.images : [{ url: "/property-placeholder.svg" }];
  const current360 = Boolean(images[carouselIndex]?.is360); // foto atual é panorâmica 360°?

  function goTo(i) {
    const next = (i + images.length) % images.length;
    setCarouselIndex(next);
    const thumb = thumbsRef.current?.children[next];
    if (thumb) thumb.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }

  function openLightbox() { setLightboxClosing(false); setLightboxOpen(true); }
  function closeLightbox() {
    setLightboxClosing(true);
    setTimeout(() => { setLightboxOpen(false); setLightboxClosing(false); }, 280);
  }

  // Lightbox: trava o scroll do body enquanto aberto.
  useEffect(() => {
    if (!lightboxOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [lightboxOpen]);

  // Lightbox: teclado — Esc fecha, setas navegam.
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowRight") goTo(carouselIndex + 1);
      else if (e.key === "ArrowLeft") goTo(carouselIndex - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, carouselIndex]);

  // Carrossel (modo normal): passa para a próxima foto automaticamente a cada 5s.
  // Pausa quando o lightbox está aberto (lá a navegação é manual). A barrinha de
  // progresso do carrossel, keyed por carouselIndex, dura os mesmos 5s.
  useEffect(() => {
    // Não auto-avança enquanto o usuário explora uma foto 360°.
    if (lightboxOpen || images.length <= 1 || current360) return;
    const t = setTimeout(() => goTo(carouselIndex + 1), 5000);
    return () => clearTimeout(t);
  }, [lightboxOpen, carouselIndex, images.length, current360]);

  const showcaseConfig = normalizeShowcaseConfig(tenant?.showcaseConfig);
  const isLightMode = showcaseConfig.appearanceMode === "light";
  const globalFont = showcaseConfig.globalFont || "Inter";
  const primaryColor = tenant?.primaryColor || "#6366f1";
  const themeStyle = {
    "--accent": primaryColor,
    "--accent-hover": primaryColor,
    "--tenant-secondary": tenant?.secondaryColor || "#d4af37",
    "--showcase-font": `'${globalFont}', system-ui, sans-serif`,
    fontFamily: `'${globalFont}', system-ui, sans-serif`,
  };

  const headerWhatsappHref = tenant?.whatsapp
    ? `https://wa.me/${String(tenant.whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(`Olá, tenho interesse nos imóveis da ${tenant?.name || tenantSlug}.`)}`
    : null;
  const whatsappHref = tenant?.whatsapp && property
    ? `https://wa.me/${String(tenant.whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(`Olá, tenho interesse no imóvel "${property?.title}" (${property?.city}/${property?.state}).`)}`
    : null;

  const andamentoLabel = { PRONTO_PARA_MORAR: "Pronto para morar", EM_CONSTRUCAO: "Em construção" }[property?.andamento];
  const lancamento = isLancamento(property?.createdAt);

  const stat = (icon, label, value) => value ? (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "16px", background: "rgba(255,255,255,0.04)", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-muted)", fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em" }}>{icon} {label}</div>
      <div style={{ fontSize: "20px", fontWeight: "800", color: isLightMode ? "#0f172a" : "#fff", letterSpacing: "-0.4px", lineHeight: 1 }}>{value}</div>
    </div>
  ) : null;

  const inputStyle = { width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: isLightMode ? "#0f172a" : "#fff", fontSize: "13px", boxSizing: "border-box", outline: "none" };

  return (
    <div className={`showcase-body ${isLightMode ? "showcase-theme-light" : ""}`} style={themeStyle}>
      <style>{`
        .showcase-body span[style*="color"], .showcase-body font[color] { -webkit-text-fill-color: currentcolor !important; -webkit-background-clip: initial !important; background: none !important; }
        .prop-thumb { transition: opacity 0.2s, border-color 0.2s; }
        .prop-thumb:hover { opacity: 1 !important; }
        .sug-card { transition: transform 0.2s, box-shadow 0.2s; }
        .sug-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.3) !important; }

        @keyframes propLbFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes propLbZoom { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        @keyframes propLbProgress { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        .prop-lightbox { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 6vh 5vw; background: rgba(3,6,16,0.85); -webkit-backdrop-filter: blur(18px) brightness(0.6); backdrop-filter: blur(18px) brightness(0.6); animation: propLbFade 0.3s ease both; cursor: zoom-out; }
        .prop-lightbox.is-closing { animation: propLbFade 0.26s ease reverse both; }
        .prop-lightbox-stage { position: relative; max-width: 100%; max-height: 100%; display: flex; animation: propLbZoom 0.42s cubic-bezier(0.22,1,0.36,1) both; }
        .prop-lightbox.is-closing .prop-lightbox-stage { animation: propLbZoom 0.24s ease reverse both; }
        .prop-lightbox-img { max-width: 100%; max-height: 88vh; object-fit: contain; border-radius: 14px; box-shadow: 0 40px 90px rgba(0,0,0,0.65); cursor: default; animation: fadeIn 0.3s ease; }
        .prop-lightbox-close { position: absolute; top: 20px; right: 24px; width: 44px; height: 44px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.1); color: #fff; font-size: 17px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s, transform 0.3s; z-index: 3; }
        .prop-lightbox-close:hover { background: rgba(255,255,255,0.22); transform: rotate(90deg); }
        .prop-lightbox-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 52px; height: 52px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.1); color: #fff; font-size: 26px; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s, transform 0.2s; z-index: 3; }
        .prop-lightbox-nav:hover { background: rgba(255,255,255,0.22); transform: translateY(-50%) scale(1.08); }
        .prop-lightbox-nav.prev { left: 22px; } .prop-lightbox-nav.next { right: 22px; }
        .prop-lightbox-counter { position: absolute; bottom: 22px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.45); color: #fff; font-size: 13px; font-weight: 600; padding: 5px 14px; border-radius: 999px; z-index: 3; }
        .prop-carousel-progress { position: absolute; top: 0; left: 0; right: 0; height: 3px; background: rgba(255,255,255,0.22); z-index: 4; }
        .prop-carousel-progress-fill { height: 100%; background: var(--accent, #818cf8); transform-origin: left; animation: propLbProgress 5s linear; }
        @media (prefers-reduced-motion: reduce) { .prop-lightbox, .prop-lightbox-stage, .prop-lightbox-img { animation: none; } }
      `}</style>

      {/* ── Header ── */}
      <div className="showcase-detail-header" style={{ position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(20px)" }}>
        <ShowcaseHeader
          tenant={tenant}
          tenantSlug={tenantSlug}
          blockStyles={showcaseConfig.blockStyles}
          isMobileViewport={isMobileViewport}
          whatsappHref={headerWhatsappHref}
          isLightMode={isLightMode}
        />
      </div>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px 80px" }}>
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
          <Link to={`/vitrine/${tenantSlug}`} style={{ display: "flex", alignItems: "center", gap: "5px", textDecoration: "none", fontSize: "13px", fontWeight: "600", color: "var(--text-muted)", opacity: 0.8 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Vitrine
          </Link>
          {property ? (
            <>
              <span style={{ color: "var(--text-muted)", opacity: 0.35, fontSize: "13px" }}>›</span>
              <span style={{ fontSize: "13px", color: "var(--text-muted)", opacity: 0.65, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "400px" }}>{property.title}</span>
            </>
          ) : null}
        </div>

        {error ? <div className="error" style={{ marginBottom: "24px" }}>{error}</div> : null}
        {successMessage ? <div className="success-banner" style={{ marginBottom: "24px" }}>{successMessage}</div> : null}
        {loading ? <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "80px 0" }}>Carregando detalhes...</p> : null}

        {!loading && property ? (
          <>
            {/* ── CAROUSEL ── */}
            <div style={{ marginBottom: "32px" }}>
              {/* Main image */}
              <div style={{ position: "relative", width: "100%", height: "520px", borderRadius: "20px", overflow: "hidden", background: "rgba(0,0,0,0.3)" }}>
                {current360 ? (
                  <Panorama360 key={`pano-${carouselIndex}`} src={images[carouselIndex]?.url} height={520} />
                ) : (
                  <img
                    key={carouselIndex}
                    src={images[carouselIndex]?.url}
                    alt={`${property.title} — foto ${carouselIndex + 1}`}
                    onClick={openLightbox}
                    style={{ width: "100%", height: "100%", objectFit: "cover", animation: "fadeIn 0.3s ease", cursor: "zoom-in" }}
                  />
                )}
                {/* Timer de auto-avanço (barra de progresso) — some no modo 360 */}
                {images.length > 1 && !lightboxOpen && !current360 && (
                  <div className="prop-carousel-progress"><div key={carouselIndex} className="prop-carousel-progress-fill" /></div>
                )}
                {/* Gradient overlay bottom */}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 45%)", pointerEvents: "none" }} />

                {/* Badges */}
                <div style={{ position: "absolute", top: "16px", left: "16px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {lancamento && <span style={{ fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.06em", color: "#fff", background: "linear-gradient(135deg,#f59e0b,#ef4444)", padding: "4px 12px", borderRadius: "999px", boxShadow: "0 2px 10px rgba(245,158,11,0.5)" }}>✦ Lançamento</span>}
                  {andamentoLabel && <span style={{ fontSize: "11px", fontWeight: "700", color: "#fff", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", padding: "4px 12px", borderRadius: "999px" }}>{andamentoLabel}</span>}
                  {property.aceitaPermuta && <span style={{ fontSize: "11px", fontWeight: "700", color: "#fff", background: "rgba(99,102,241,0.85)", backdropFilter: "blur(6px)", padding: "4px 12px", borderRadius: "999px" }}>✓ Aceita permuta</span>}
                </div>

                {/* Counter */}
                {images.length > 1 && (
                  <span style={{ position: "absolute", top: "16px", right: "16px", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", color: "#fff", fontSize: "12px", fontWeight: "600", padding: "4px 12px", borderRadius: "999px" }}>{carouselIndex + 1} / {images.length}</span>
                )}

                {/* Navigation arrows */}
                {images.length > 1 && (
                  <>
                    <button type="button" onClick={() => goTo(carouselIndex - 1)} style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", width: "44px", height: "44px", borderRadius: "50%", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: "22px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, transition: "background 0.2s" }}>‹</button>
                    <button type="button" onClick={() => goTo(carouselIndex + 1)} style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", width: "44px", height: "44px", borderRadius: "50%", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: "22px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, transition: "background 0.2s" }}>›</button>
                  </>
                )}

                {/* Dot indicators */}
                {images.length > 1 && images.length <= 12 && (
                  <div style={{ position: "absolute", bottom: "16px", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "6px" }}>
                    {images.map((_, i) => (
                      <button key={i} type="button" onClick={() => goTo(i)} style={{ width: i === carouselIndex ? "20px" : "6px", height: "6px", borderRadius: "3px", background: i === carouselIndex ? "#fff" : "rgba(255,255,255,0.45)", border: "none", cursor: "pointer", padding: 0, transition: "all 0.3s" }} />
                    ))}
                  </div>
                )}
              </div>

              {/* Thumbnail strip */}
              {images.length > 1 && (
                <div ref={thumbsRef} style={{ display: "flex", gap: "8px", overflowX: "auto", padding: "12px 0", scrollbarWidth: "none" }}>
                  {images.map((img, i) => (
                    <button key={i} type="button" className="prop-thumb" onClick={() => goTo(i)} style={{ position: "relative", flexShrink: 0, width: "88px", height: "64px", borderRadius: "10px", overflow: "hidden", border: `2px solid ${i === carouselIndex ? primaryColor : "transparent"}`, padding: 0, cursor: "pointer", opacity: i === carouselIndex ? 1 : 0.55 }}>
                      <img src={img.url} alt={`Foto ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      {img.is360 && (
                        <span style={{ position: "absolute", bottom: "4px", right: "4px", fontSize: "8px", fontWeight: 800, letterSpacing: "0.03em", color: "#fff", background: "rgba(99,102,241,0.95)", padding: "1px 5px", borderRadius: "999px", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>360°</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── CONTENT GRID ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "40px", alignItems: "start" }}>
              {/* Left: property info */}
              <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
                {/* Title + price */}
                <div>
                  {property.propertyType && (
                    <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", color: primaryColor, marginBottom: "8px", display: "block" }}>
                      <IcHome style={{ display: "inline" }} /> {property.propertyType}
                    </span>
                  )}
                  <h1 style={{ fontSize: "32px", fontWeight: "800", letterSpacing: "-0.5px", margin: "0 0 12px", color: isLightMode ? "#0f172a" : "#fff", lineHeight: 1.2 }}>
                    {property.title}
                  </h1>
                  <p style={{ fontSize: "36px", fontWeight: "800", color: primaryColor, margin: 0, letterSpacing: "-1px" }}>
                    R$ {Number(property.price).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                </div>

                {/* Stats grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "10px" }}>
                  {stat(<IcArea />, "Área", property.squareFootage ? `${property.squareFootage} m²` : null)}
                  {stat(<IcBed />, "Quartos", property.bedrooms || null)}
                  {stat(<IcSuite />, "Suítes", property.suites || null)}
                  {stat(<IcCar />, "Vagas", property.parkingSpots || null)}
                </div>

                {/* Description */}
                {property.description && (
                  <div>
                    <p style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: "10px" }}>Descrição</p>
                    <p style={{ fontSize: "15px", color: isLightMode ? "#334155" : "#cbd5e1", lineHeight: "1.7", margin: 0 }}>{property.description}</p>
                  </div>
                )}

                {/* Location */}
                <div style={{ padding: "20px", borderRadius: "14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <p style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: "12px" }}>Localização</p>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", color: isLightMode ? "#334155" : "#cbd5e1" }}>
                    <span style={{ color: primaryColor, marginTop: "2px", flexShrink: 0 }}><IcPin /></span>
                    <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.6" }}>
                      {property.address && <><strong>{property.address}</strong><br /></>}
                      {[property.neighborhood, property.city, property.state].filter(Boolean).join(", ")}
                      {property.cep && <> · CEP {property.cep}</>}
                    </p>
                  </div>
                </div>

                {/* Comodidades da região */}
                {(() => {
                  const ativas = comodidadesAtivas(property.comodidades);
                  if (ativas.length === 0) return null;
                  return (
                    <div>
                      <p style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: "12px" }}>
                        O que tem por perto
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
                        {ativas.map((c) => (
                          <div key={c.key} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", background: "rgba(255,255,255,0.04)", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.07)" }}>
                            <span style={{ fontSize: "22px", lineHeight: 1, flexShrink: 0 }}>{c.icon}</span>
                            <span style={{ fontSize: "14px", fontWeight: "600", color: isLightMode ? "#0f172a" : "#fff" }}>{c.label}</span>
                          </div>
                        ))}
                      </div>
                      <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "12px 0 0", opacity: 0.75 }}>
                        Estabelecimentos identificados num raio de aproximadamente 2 km.
                      </p>
                    </div>
                  );
                })()}
              </div>

              {/* Right: lead form */}
              <div style={{ position: "sticky", top: "80px", background: "rgba(255,255,255,0.03)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px", padding: "28px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <p style={{ fontSize: "17px", fontWeight: "700", color: isLightMode ? "#0f172a" : "#fff", margin: "0 0 4px" }}>Tenho interesse</p>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>Preencha e nossa equipe entrará em contato.</p>
                </div>
                <input placeholder="Seu nome" value={interestForm.name} onChange={(e) => setInterestForm((p) => ({ ...p, name: e.target.value }))} style={inputStyle} />
                <input type="email" placeholder="E-mail" value={interestForm.email} onChange={(e) => setInterestForm((p) => ({ ...p, email: e.target.value }))} style={inputStyle} />
                <input placeholder="WhatsApp / Telefone" value={interestForm.phone} onChange={(e) => setInterestForm((p) => ({ ...p, phone: e.target.value }))} style={inputStyle} />
                <textarea placeholder="Mensagem (opcional)" value={interestForm.message} onChange={(e) => setInterestForm((p) => ({ ...p, message: e.target.value }))} rows={3} style={{ ...inputStyle, resize: "vertical", minHeight: "80px" }} />
                <button type="button" onClick={handleInterest} disabled={sendingInterest} style={{ padding: "13px", borderRadius: "12px", background: primaryColor, color: "#fff", fontWeight: "700", fontSize: "14px", border: "none", cursor: "pointer", boxShadow: `0 4px 18px ${primaryColor}44`, transition: "opacity 0.2s", opacity: sendingInterest ? 0.7 : 1 }}>
                  {sendingInterest ? "Enviando..." : "Enviar interesse"}
                </button>
                {whatsappHref && (
                  <a href={whatsappHref} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "12px", borderRadius: "12px", background: "#25D366", color: "#fff", fontWeight: "700", fontSize: "14px", textDecoration: "none" }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/></svg>
                    Chamar no WhatsApp
                  </a>
                )}
                {property.leadCount > 0 && (
                  <p style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", margin: 0 }}>
                    {property.leadCount} pessoa{property.leadCount !== 1 ? "s" : ""} já demonstrou interesse
                  </p>
                )}
              </div>
            </div>

            {/* ── SUGGESTIONS ── */}
            {suggestions.length > 0 && (
              <section style={{ marginTop: "64px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
                  <h2 style={{ fontSize: "22px", fontWeight: "800", color: isLightMode ? "#0f172a" : "#fff", margin: 0, letterSpacing: "-0.4px" }}>Mais imóveis disponíveis</h2>
                  <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.07)" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "20px" }}>
                  {suggestions.map((s) => {
                    const sImg = s.images?.[0]?.url || "/property-placeholder.svg";
                    const sLancamento = isLancamento(s.createdAt);
                    return (
                      <Link key={s.id} to={`/vitrine/${tenantSlug}/imovel/${s.id}`} style={{ textDecoration: "none", display: "block" }}>
                        <article className="sug-card" style={{ background: "rgba(255,255,255,0.03)", border: sLancamento ? "1.5px solid #f59e0b" : "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", overflow: "hidden", boxShadow: sLancamento ? "0 0 18px rgba(245,158,11,0.2)" : "none" }}>
                          <div style={{ height: "170px", overflow: "hidden" }}>
                            <img src={sImg} alt={s.title} style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.4s" }} />
                          </div>
                          <div style={{ padding: "16px" }}>
                            {sLancamento && <span style={{ fontSize: "10px", fontWeight: "800", textTransform: "uppercase", color: "#f59e0b", letterSpacing: "0.06em" }}>Lançamento · </span>}
                            <h3 style={{ fontSize: "14px", fontWeight: "700", color: isLightMode ? "#0f172a" : "#fff", margin: "4px 0 6px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s.title}</h3>
                            {(s.neighborhood || s.city) && (
                              <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 8px", display: "flex", alignItems: "center", gap: "4px" }}>
                                <IcPin /> {[s.neighborhood, s.city].filter(Boolean).join(", ")}
                              </p>
                            )}
                            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
                              {s.squareFootage ? <span style={{ fontSize: "11px", color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: "5px" }}>{s.squareFootage} m²</span> : null}
                              {s.bedrooms ? <span style={{ fontSize: "11px", color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: "5px" }}>{s.bedrooms} qtos</span> : null}
                            </div>
                            <p style={{ fontSize: "18px", fontWeight: "800", color: primaryColor, margin: 0, letterSpacing: "-0.5px" }}>
                              R$ {Number(s.price).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </p>
                          </div>
                        </article>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        ) : null}
      </div>

      {/* ── Lightbox (galeria em tela cheia) ── */}
      {lightboxOpen && (
        <div className={`prop-lightbox${lightboxClosing ? " is-closing" : ""}`} onClick={closeLightbox} role="dialog" aria-modal="true">
          <button type="button" className="prop-lightbox-close" onClick={closeLightbox} aria-label="Fechar">✕</button>
          {images.length > 1 && (
            <>
              <button type="button" className="prop-lightbox-nav prev" onClick={(e) => { e.stopPropagation(); goTo(carouselIndex - 1); }} aria-label="Foto anterior">‹</button>
              <button type="button" className="prop-lightbox-nav next" onClick={(e) => { e.stopPropagation(); goTo(carouselIndex + 1); }} aria-label="Próxima foto">›</button>
            </>
          )}
          <div className="prop-lightbox-stage" onClick={(e) => e.stopPropagation()}>
            <img key={carouselIndex} src={images[carouselIndex]?.url} alt={`Foto ${carouselIndex + 1}`} className="prop-lightbox-img" />
          </div>
          {images.length > 1 && (
            <span className="prop-lightbox-counter">{carouselIndex + 1} / {images.length}</span>
          )}
        </div>
      )}
    </div>
  );
}
