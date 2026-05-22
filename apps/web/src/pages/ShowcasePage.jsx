import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import {
  blockHasBackgroundImage,
  mergeBlockWrapperStyle,
  normalizeShowcaseConfig,
  sectionSurfaceStyle,
} from "../utils/showcaseConfig";

export function ShowcasePage() {
  const { tenantSlug } = useParams();
  const [payload, setPayload] = useState(null);
  const [carouselIndexes, setCarouselIndexes] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadShowcaseData() {
    if (!tenantSlug) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.getPublicShowcase(tenantSlug);
      setPayload(data);
      const indexes = {};
      (data.properties || []).forEach((property) => {
        indexes[property.id] = 0;
      });
      setCarouselIndexes(indexes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShowcaseData();
  }, [tenantSlug]);

  function nextImage(propertyId, total) {
    setCarouselIndexes((prev) => ({
      ...prev,
      [propertyId]: ((prev[propertyId] || 0) + 1) % total,
    }));
  }

  function prevImage(propertyId, total) {
    setCarouselIndexes((prev) => ({
      ...prev,
      [propertyId]: ((prev[propertyId] || 0) - 1 + total) % total,
    }));
  }

  const tenantName = payload?.tenant?.name || tenantSlug?.toUpperCase() || "Domus";
  const tenant = payload?.tenant || {};
  const showcaseConfig = normalizeShowcaseConfig(tenant.showcaseConfig);
  const layout = showcaseConfig.layout;
  const blockStyles = showcaseConfig.blockStyles;
  const hiddenBlocks = showcaseConfig.hiddenBlocks || [];
  const initialLetter = tenantName.charAt(0).toUpperCase();
  const properties = payload?.properties || [];
  const showcaseHeadline = tenant.showcaseHeadline || "Encontre o imovel ideal para seu proximo passo";
  const showcaseSubheadline =
    tenant.showcaseSubheadline ||
    "Compare opcoes, visualize fotos detalhadas, conheca a localizacao e entre em contato com a imobiliaria com um clique.";
  const whatsappHref = tenant.whatsapp
    ? `https://wa.me/${String(tenant.whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(
        `Ola, tenho interesse nos imoveis da ${tenantName}.`
      )}`
    : null;
  const themeStyle = {
    "--accent": tenant.primaryColor || "#818cf8",
    "--accent-hover": tenant.primaryColor || "#6366f1",
    "--tenant-secondary": tenant.secondaryColor || "#d4af37",
  };
  const isLightMode = showcaseConfig.appearanceMode === "light";
  const canvasHeight = Math.max(1800, ...Object.values(layout).map((block) => (block?.y || 0) + (block?.h || 0))) + 40;

  function sectionCombinedStyle(key) {
    const bs = blockStyles[key];
    const hasBanner = blockHasBackgroundImage(bs);
    
    const layoutPart = {
      left: hasBanner ? "calc(50% - 50vw)" : `${layout[key].x}%`,
      top: `${layout[key].y}px`,
      width: hasBanner ? "100vw" : `${layout[key].w}%`,
      maxWidth: hasBanner ? "100vw" : undefined,
      minHeight: `${layout[key].h}px`,
      boxSizing: hasBanner ? "border-box" : undefined,
      zIndex: hasBanner ? 0 : 10,
    };
    
    if (hasBanner) {
      return { 
        ...layoutPart, 
        ...sectionSurfaceStyle(bs),
        backgroundPosition: "top center"
      };
    }
    return { ...layoutPart, ...mergeBlockWrapperStyle(bs) };
  }

  function headerInnerStyle() {
    const bs = blockStyles.header || {};
    const primary = tenant.primaryColor || "#6366f1";
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
      background: `linear-gradient(135deg, ${primary}33, rgba(255,255,255,0.03))`,
      ...(bs.color ? { color: bs.color } : {}),
    };
  }

  const titleColor = blockStyles.title?.color;
  const footerColor = blockStyles.footer?.color;
  const isVisible = (key) => !hiddenBlocks.includes(key);

  return (
    <div className={`showcase-body ${isLightMode ? "showcase-theme-light" : ""}`} style={themeStyle}>
      {/* ADICIONE ESTE BLOCO DE STYLE AQUI: */}
      <style>{`
        .showcase-body span[style*="color"],
        .showcase-body font[color] {
          -webkit-text-fill-color: currentcolor !important;
          -webkit-background-clip: initial !important;
          background: none !important;
        }
      `}</style>
      
      <div className="showcase-container showcase-builder-canvas" style={{ minHeight: `${canvasHeight}px` }}>

        {isVisible("header") ? (
        <section
          id="header"
          className={`showcase-layout-block${blockHasBackgroundImage(blockStyles.header) ? " showcase-section-has-bg" : ""}`}
          style={{
            ...sectionCombinedStyle("header"),
            left: "calc(50% - 50vw)",
            width: "100vw",
            maxWidth: "100vw",
            boxSizing: "border-box"
          }}
        >
          <header style={{ ...headerInnerStyle(), display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 5%", width: "100%", boxSizing: "border-box" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: "bold", overflow: "hidden" }}>
                {tenant.logoUrl ? (
                  <img src={tenant.logoUrl} alt={tenantName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  initialLetter
                )}
              </div>
              <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700", ...(blockStyles.header?.color ? { color: blockStyles.header.color } : {}) }}>
                {tenantName}
              </h1>
            </div>
            
            <nav style={{ display: "flex", gap: "32px", alignItems: "center" }}>
              <a href="#destaques" style={{ color: blockStyles.header?.color || "inherit", textDecoration: "none", fontSize: "16px", fontWeight: "600", cursor: "pointer" }}>
                Ver imóveis
              </a>
              <a href="#footer" style={{ color: blockStyles.header?.color || "inherit", textDecoration: "none", fontSize: "16px", fontWeight: "600", cursor: "pointer" }}>
                Sobre nós
              </a>
              {whatsappHref ? (
                <a href={whatsappHref} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--accent)", color: "#fff", padding: "10px 20px", borderRadius: "8px", fontWeight: "600", textDecoration: "none" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  Falar com consultor
                </a>
              ) : null}
              <Link to={`/login?tenant=${tenantSlug}`} style={{ color: blockStyles.header?.color || "inherit", textDecoration: "none", fontSize: "14px", fontWeight: "500", marginLeft: "16px", opacity: 0.8 }}>
                Acesso
              </Link>
            </nav>
          </header>
        </section>
        ) : null}

        {isVisible("title") ? (   
        <section
          className={`showcase-layout-block${blockHasBackgroundImage(blockStyles.title) ? " showcase-section-has-bg" : ""}`}
          style={sectionCombinedStyle("title")}
        >
          <section
            className={`showcase-title-section${titleColor ? " showcase-title-section--custom-text" : ""}`}
            style={mergeBlockWrapperStyle(blockStyles.title)}
          >
            <h2
              style={
                titleColor
                  ? {
                      color: titleColor,
                      background: "none",
                      backgroundImage: "none",
                      WebkitBackgroundClip: "unset",
                      backgroundClip: "unset",
                    }
                  : undefined
              }
              dangerouslySetInnerHTML={{ __html: showcaseHeadline }}
            />
            <p style={titleColor ? { color: titleColor } : undefined} dangerouslySetInnerHTML={{ __html: showcaseSubheadline }} />
          </section>
        </section>
        ) : null}

        {isVisible("highlights") ? (
        <section
          className={`showcase-layout-block${blockHasBackgroundImage(blockStyles.highlights) ? " showcase-section-has-bg" : ""}`}
          style={sectionCombinedStyle("highlights")}
        >
          <section className="showcase-highlights" style={mergeBlockWrapperStyle(blockStyles.highlights)}>
            {showcaseConfig.highlights.map((item, index) => {
              const hs = showcaseConfig.highlightStyles[index] || { backgroundColor: "", color: "" };
              return (
                <div className="highlight-box" key={`highlight-${index}`} style={mergeBlockWrapperStyle(hs)}>
                  <h3 style={hs.color ? { color: hs.color } : undefined} dangerouslySetInnerHTML={{ __html: item.title }} />
                  <p style={hs.color ? { color: hs.color } : undefined} dangerouslySetInnerHTML={{ __html: item.description }} />
                </div>
              );
            })}
          </section>
        </section>
        ) : null}

        {isVisible("properties") ? (
        <section
          className={`showcase-layout-block${blockHasBackgroundImage(blockStyles.properties) ? " showcase-section-has-bg" : ""}`}
          style={sectionCombinedStyle("properties")}
        >
          {error ? <div className="error">{error}</div> : null}
          {loading ? <p style={{ color: "var(--text-muted)", textAlign: "center" }}>Carregando vitrine...</p> : null}
          {!loading && properties.length === 0 ? (
            <p style={{ color: "var(--text-muted)", textAlign: "center" }}>Nenhuma propriedade disponivel no momento.</p>
          ) : null}

          <div id="destaques" className="property-grid" style={mergeBlockWrapperStyle(blockStyles.properties)}>
            {properties.map((p) => {
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
                      <svg className="stat-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{p.neighborhood}, {p.city} - {p.state}</span>
                    </div>

                    <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "15px", lineHeight: "1.5", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {p.description || "Confira os detalhes deste imovel e fale com nossa equipe."}
                    </p>

                    <div className="card-stats-grid">
                      <div className="stat-item">
                        <svg className="stat-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 4l-5 5M4 16v4m0 0h4M4 4l10 10m-4-2h10" />
                        </svg>
                        <span>{p.squareFootage != null ? `${p.squareFootage} m²` : "-"}</span>
                      </div>
                      <div className="stat-item">
                        <svg className="stat-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <span>{p.bedrooms || 0} quartos ({p.suites || 0} suites)</span>
                      </div>
                      <div className="stat-item">
                        <svg className="stat-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                        <span>{p.parkingSpots || 0} vagas</span>
                      </div>
                      <div className="stat-item">
                        <svg className="stat-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        <span>{p.propertyType}</span>
                      </div>
                    </div>

                    <div className="card-price-wrapper">
                      <div>
                        <span className="price-label">Valor</span>
                        <p className="card-price">
                          R$ {Number(p.price).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                      </div>
                    </div>
                    <Link to={`/vitrine/${tenantSlug}/imovel/${p.id}`} className="btn-view-details">
                      Ver detalhes do imovel
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        ) : null}

        {isVisible("widgets") ? (
        <section
          className={`showcase-layout-block${blockHasBackgroundImage(blockStyles.widgets) ? " showcase-section-has-bg" : ""}`}
          style={sectionCombinedStyle("widgets")}
        >
          <div className="widget-grid" style={mergeBlockWrapperStyle(blockStyles.widgets)}>
            {showcaseConfig.widgets.map((widget) => (
              <article key={widget.id} className="widget-card" style={mergeBlockWrapperStyle(widget)}>
                <h3 dangerouslySetInnerHTML={{ __html: widget.title }} />
                <p dangerouslySetInnerHTML={{ __html: widget.content }} />
                {widget.type === "cta" && widget.ctaLabel ? (
                  <a
                    href={widget.ctaUrl || "#"}
                    target={widget.ctaUrl ? "_blank" : undefined}
                    rel={widget.ctaUrl ? "noreferrer" : undefined}
                    className="btn-view-details"
                    dangerouslySetInnerHTML={{ __html: widget.ctaLabel }}
                  />
                ) : null}
              </article>
            ))}
          </div>
        </section>
        ) : null}

        {isVisible("footer") ? (
        <section
          id="footer"
          className={`showcase-layout-block${blockHasBackgroundImage(blockStyles.footer) ? " showcase-section-has-bg" : ""}`}
          style={sectionCombinedStyle("footer")}
        >
          <footer
            style={{
              marginTop: "20px",
              borderTop: "1px solid rgba(255,255,255,0.05)",
              paddingTop: "40px",
              textAlign: "center",
              ...mergeBlockWrapperStyle(blockStyles.footer),
            }}
          >
            <p style={{ fontSize: "16px", color: footerColor || (isLightMode ? "#0f172a" : "#fff"), marginBottom: "10px" }} dangerouslySetInnerHTML={{ __html: showcaseConfig.footerTitle + " " + tenantName }} />
            <p style={{ fontSize: "12px", color: footerColor || "var(--text-muted)" }} dangerouslySetInnerHTML={{ __html: tenant.description || "Domus Showcase - Encontre seu proximo imovel com seguranca e transparencia." }} />
            
            {(tenant.email || tenant.whatsapp) ? (
              <p style={{ fontSize: "12px", marginTop: "8px", color: footerColor || "var(--text-muted)" }}>
                {tenant.email ? <span dangerouslySetInnerHTML={{ __html: `Email: ${tenant.email}` }} /> : null} {tenant.email && tenant.whatsapp ? " | " : ""}
                {tenant.whatsapp ? <span dangerouslySetInnerHTML={{ __html: `WhatsApp: ${tenant.whatsapp}` }} /> : null}
              </p>
            ) : null}
          </footer>
        </section>
        ) : null}
      </div>
    </div>
  );
}