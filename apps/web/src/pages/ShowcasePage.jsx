import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { mergeBlockWrapperStyle, normalizeShowcaseConfig } from "../utils/showcaseConfig";

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
    return {
      ...{
        left: `${layout[key].x}%`,
        top: `${layout[key].y}px`,
        width: `${layout[key].w}%`,
        minHeight: `${layout[key].h}px`,
      },
      ...mergeBlockWrapperStyle(blockStyles[key]),
    };
  }

  function headerInnerStyle() {
    const bs = blockStyles.header || {};
    const primary = tenant.primaryColor || "#6366f1";
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
      <div className="showcase-container showcase-builder-canvas" style={{ minHeight: `${canvasHeight}px` }}>
        {isVisible("topbar") ? (
        <section className="showcase-layout-block" style={sectionCombinedStyle("topbar")}>
          <section className="showcase-top-header-inline" style={mergeBlockWrapperStyle(blockStyles.topbar)}>
            <p style={blockStyles.topbar?.color ? { color: blockStyles.topbar.color } : undefined}>{showcaseConfig.topHeader.title}</p>
            <small style={blockStyles.topbar?.color ? { color: blockStyles.topbar.color } : undefined}>{showcaseConfig.topHeader.subtitle}</small>
          </section>
        </section>
        ) : null}

        {isVisible("header") ? (
        <section className="showcase-layout-block" style={sectionCombinedStyle("header")}>
          <header className="showcase-header" style={headerInnerStyle()}>
            <div className="showcase-brand">
              <div className="brand-logo-exclusive">
                {tenant.logoUrl ? <img src={tenant.logoUrl} alt={`Logo ${tenantName}`} className="brand-logo-image" /> : initialLetter}
              </div>
              <div className="brand-title-group">
                <h1 style={blockStyles.header?.color ? { color: blockStyles.header.color } : undefined}>{tenantName}</h1>
                <p style={blockStyles.header?.color ? { color: blockStyles.header.color } : undefined}>
                  {tenant.slogan || "Atendimento especializado em imoveis"}
                </p>
              </div>
            </div>
            <nav className="showcase-nav">
              {whatsappHref ? (
                <a href={whatsappHref} target="_blank" rel="noreferrer" className="nav-button" style={{ fontSize: "14px" }}>
                  Falar com consultor
                </a>
              ) : (
                <a href="#destaques" className="nav-button" style={{ fontSize: "14px" }}>
                  Ver destaques
                </a>
              )}
              <Link to={`/login?tenant=${tenantSlug}`} className="nav-button" style={{ fontSize: "14px" }}>
                Login do tenant
              </Link>
            </nav>
          </header>
        </section>
        ) : null}

        {isVisible("title") ? (
        <section className="showcase-layout-block" style={sectionCombinedStyle("title")}>
          <section className="showcase-title-section" style={mergeBlockWrapperStyle(blockStyles.title)}>
            <h2
              style={
                titleColor
                  ? { color: titleColor, WebkitTextFillColor: titleColor, background: "none", backgroundClip: "unset" }
                  : undefined
              }
            >
              {showcaseHeadline}
            </h2>
            <p style={titleColor ? { color: titleColor } : undefined}>{showcaseSubheadline}</p>
          </section>
        </section>
        ) : null}

        {isVisible("highlights") ? (
        <section className="showcase-layout-block" style={sectionCombinedStyle("highlights")}>
          <section className="showcase-highlights" style={mergeBlockWrapperStyle(blockStyles.highlights)}>
            {showcaseConfig.highlights.map((item, index) => {
              const hs = showcaseConfig.highlightStyles[index] || { backgroundColor: "", color: "" };
              return (
                <div className="highlight-box" key={`highlight-${index}`} style={mergeBlockWrapperStyle(hs)}>
                  <h3 style={hs.color ? { color: hs.color } : undefined}>{item.title}</h3>
                  <p style={hs.color ? { color: hs.color } : undefined}>{item.description}</p>
                </div>
              );
            })}
          </section>
        </section>
        ) : null}

        {isVisible("properties") ? (
        <section className="showcase-layout-block" style={sectionCombinedStyle("properties")}>
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
                        <span>{p.squareFootage || "-"} m2</span>
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
        <section className="showcase-layout-block" style={sectionCombinedStyle("widgets")}>
          <div className="widget-grid" style={mergeBlockWrapperStyle(blockStyles.widgets)}>
            {showcaseConfig.widgets.map((widget) => (
              <article key={widget.id} className="widget-card" style={mergeBlockWrapperStyle(widget)}>
                <h3>{widget.title}</h3>
                <p>{widget.content}</p>
                {widget.type === "cta" && widget.ctaLabel ? (
                  <a
                    href={widget.ctaUrl || "#"}
                    target={widget.ctaUrl ? "_blank" : undefined}
                    rel={widget.ctaUrl ? "noreferrer" : undefined}
                    className="btn-view-details"
                  >
                    {widget.ctaLabel}
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        </section>
        ) : null}

        {isVisible("footer") ? (
        <section className="showcase-layout-block" style={sectionCombinedStyle("footer")}>
          <footer
            style={{
              marginTop: "20px",
              borderTop: "1px solid rgba(255,255,255,0.05)",
              paddingTop: "40px",
              textAlign: "center",
              ...mergeBlockWrapperStyle(blockStyles.footer),
            }}
          >
            <p style={{ fontSize: "16px", color: footerColor || (isLightMode ? "#0f172a" : "#fff"), marginBottom: "10px" }}>
              {showcaseConfig.footerTitle} {tenantName}
            </p>
            <p style={{ fontSize: "12px", color: footerColor || "var(--text-muted)" }}>
              {tenant.description || "Domus Showcase - Encontre seu proximo imovel com seguranca e transparencia."}
            </p>
            {(tenant.email || tenant.whatsapp) ? (
              <p style={{ fontSize: "12px", marginTop: "8px", color: footerColor || "var(--text-muted)" }}>
                {tenant.email ? `Email: ${tenant.email}` : ""} {tenant.email && tenant.whatsapp ? " | " : ""}
                {tenant.whatsapp ? `WhatsApp: ${tenant.whatsapp}` : ""}
              </p>
            ) : null}
          </footer>
        </section>
        ) : null}
      </div>
    </div>
  );
}
