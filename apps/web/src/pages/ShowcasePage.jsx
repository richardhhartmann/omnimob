import { useEffect, useLayoutEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import {
  blockHasBackgroundImage,
  mergeBlockWrapperStyle,
  normalizeShowcaseConfig,
  sectionSurfaceStyle,
} from "../utils/showcaseConfig";
import { ShowcaseHeader } from "../components/showcase/ShowcaseHeader";
import { comodidadesAtivas } from "../utils/comodidades";

const SHOWCASE_FONT_FAMILIES = [
  "Inter","Playfair+Display","Montserrat","Raleway","Lato","Merriweather","Poppins",
];

// Elemento interno (sem min-height) usado para medir a altura REAL de cada bloco.
const SECTION_INNER_SEL = {
  title: ".showcase-title-section",
  highlights: ".showcase-highlights",
  properties: "#destaques",
  footer: ".showcase-footer",
};
const STACK_BLOCK_ORDER = ["header", "title", "highlights", "properties", "footer"];

export function ShowcasePage() {
  const { tenantSlug } = useParams();
  const [payload, setPayload] = useState(null);
  const [carouselIndexes, setCarouselIndexes] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.innerWidth < 768);
  const [reflowTick, setReflowTick] = useState(0);
  // Desktop: ajuste do bloco de imóveis (altura real do grid + deslocamento dos blocos abaixo).
  const [propsShift, setPropsShift] = useState(null);
  // Mobile: empilhamento vertical de todas as seções/widgets por conteúdo (coluna única).
  const [mobileStack, setMobileStack] = useState(null);

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

  useEffect(() => {
    const handler = () => {
      setIsMobileViewport(window.innerWidth < 768);
      setReflowTick((t) => t + 1);
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${SHOWCASE_FONT_FAMILIES.join("&family=")}&display=swap`;
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch {} };
  }, []);

  // O layout salvo (posições absolutas) é medido no editor, em larguras diferentes
  // das do visitante. Aqui medimos o conteúdo real e ajustamos as posições:
  //  - Desktop: mantém o layout livre, só desloca os blocos abaixo de "imóveis"
  //    conforme a grade cresce/encolhe (evita sobreposição e vão gigante).
  //  - Mobile: empilha tudo numa coluna única por conteúdo (os widgets não têm
  //    posição mobile própria, então cairiam em cima dos cards de imóveis).
  useLayoutEffect(() => {
    if (!payload) { setPropsShift(null); setMobileStack(null); return; }
    const cfg = normalizeShowcaseConfig(payload.tenant?.showcaseConfig);
    const hidden = cfg.hiddenBlocks || [];
    const measureInner = (sel) => {
      const el = sel ? document.querySelector(sel) : null;
      return el ? Math.ceil(el.getBoundingClientRect().height) : null;
    };

    if (isMobileViewport) {
      setPropsShift(null);
      const al = cfg.mobileLayout || {};
      const items = [];
      for (const k of STACK_BLOCK_ORDER) {
        if (hidden.includes(k)) continue;
        const lay = al[k] || {};
        const h = k === "header" ? (lay.h || 80) : (measureInner(SECTION_INNER_SEL[k]) ?? lay.h ?? 120);
        items.push({ key: k, y: lay.y ?? 0, h });
      }
      for (const w of cfg.widgets || []) {
        if (w.hidden) continue;
        items.push({ key: `widget-${w.id}`, y: w.y ?? 1080, h: w.h ?? 200 });
      }
      items.sort((a, b) => a.y - b.y);
      const GAP = 22;
      let cursor = 0;
      const stack = {};
      for (const it of items) {
        stack[it.key] = { y: cursor, h: it.h };
        cursor += it.h + GAP;
      }
      setMobileStack({ ...stack, __bottom: cursor });
      return;
    }

    // Desktop
    setMobileStack(null);
    if (hidden.includes("properties")) { setPropsShift(null); return; }
    const propsLayout = (cfg.layout || {}).properties;
    const gridH = measureInner("#destaques");
    if (!propsLayout || gridH == null) { setPropsShift(null); return; }
    const naturalH = gridH + 56;
    const delta = naturalH - (propsLayout.h || 0);
    setPropsShift(Math.abs(delta) < 8 ? null : { y: propsLayout.y || 0, h: naturalH, delta });
  }, [payload, isMobileViewport, reflowTick]);

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

  if (!payload && !error) {
    return <div style={{ minHeight: "100vh", background: "#0f172a" }} />;
  }

  const tenantName = payload?.tenant?.name || tenantSlug?.toUpperCase() || "Domus";
  const tenant = payload?.tenant || {};
  const showcaseConfig = normalizeShowcaseConfig(tenant.showcaseConfig);
  const layout = showcaseConfig.layout;
  const mobileLayout = showcaseConfig.mobileLayout;
  const activeLayout = isMobileViewport ? mobileLayout : layout;
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
  const globalFont = showcaseConfig.globalFont || "Inter";
  const themeStyle = {
    "--accent": tenant.primaryColor || "#818cf8",
    "--accent-hover": tenant.primaryColor || "#6366f1",
    "--tenant-secondary": tenant.secondaryColor || "#d4af37",
    "--showcase-font": `'${globalFont}', system-ui, sans-serif`,
    fontFamily: `'${globalFont}', system-ui, sans-serif`,
  };
  const isLightMode = showcaseConfig.appearanceMode === "light";
  const layoutMax = Math.max(0, ...Object.values(activeLayout).map((block) => (block?.y || 0) + (block?.h || 0)));
  const widgetMax = showcaseConfig.widgets.length > 0
    ? Math.max(...showcaseConfig.widgets.filter(w => !w.hidden).map(w => (w.y || 0) + (w.h || 0)))
    : 0;
  const canvasHeight = mobileStack
    ? mobileStack.__bottom + 60
    : Math.max(1800, layoutMax, widgetMax) + 40 + (propsShift ? propsShift.delta : 0);

  // Desktop: desloca os blocos abaixo de "imóveis" conforme a grade real.
  function shiftedY(y) {
    return propsShift && (y || 0) > propsShift.y ? (y || 0) + propsShift.delta : (y || 0);
  }

  // Posição final do widget (mobile = coluna única empilhada; desktop = layout salvo + shift).
  function widgetPos(w) {
    const ms = mobileStack && mobileStack[`widget-${w.id}`];
    if (ms) return { left: 0, top: ms.y, width: 100, minHeight: ms.h };
    return { left: w.x ?? 0, top: shiftedY(w.y ?? 1080), width: w.w ?? 50, minHeight: w.h ?? 200 };
  }

  function sectionCombinedStyle(key) {
    const bs = blockStyles[key];
    const hasBanner = blockHasBackgroundImage(bs);
    const blockLayout = activeLayout[key] || layout[key];

    let topY = blockLayout.y;
    let minH = blockLayout.h;
    const ms = mobileStack && mobileStack[key];
    if (ms) {
      topY = ms.y;
      minH = ms.h;
    } else if (propsShift) {
      if (key === "properties") minH = propsShift.h;
      else topY = shiftedY(blockLayout.y);
    }

    const layoutPart = {
      left: hasBanner ? "calc(50% - 50vw)" : `${blockLayout.x}%`,
      top: `${topY}px`,
      width: hasBanner ? "100vw" : `${blockLayout.w}%`,
      maxWidth: hasBanner ? "100vw" : undefined,
      minHeight: `${minH}px`,
      boxSizing: hasBanner ? "border-box" : undefined,
      zIndex: hasBanner ? 0 : 10,
    };

    if (hasBanner) {
      return { ...layoutPart, ...sectionSurfaceStyle(bs), backgroundPosition: "top center" };
    }
    return { ...layoutPart, ...mergeBlockWrapperStyle(bs) };
  }

  const titleColor = blockStyles.title?.color;
  const footerColor = blockStyles.footer?.color;
  const isVisible = (key) => !hiddenBlocks.includes(key);

  function isLancamento(createdAt) {
    if (!createdAt) return false;
    return (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24) <= 30;
  }

  const IcPin  = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
  const IcArea = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9V3h6"/><path d="M3 3l6 6"/><path d="M21 15v6h-6"/><path d="M21 21l-6-6"/></svg>;
  const IcBed  = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4v16"/><path d="M22 8v12"/><path d="M2 8h20"/><rect x="6" y="4" width="12" height="4" rx="1"/></svg>;
  const IcCar  = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="10" width="20" height="10" rx="2"/><path d="m6 10 3-6h6l3 6"/><circle cx="7" cy="17" r="1" fill="currentColor"/><circle cx="17" cy="17" r="1" fill="currentColor"/></svg>;

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
      
      <div className="showcase-container showcase-builder-canvas" style={{ minHeight: `${canvasHeight}px`, position: "relative" }}>

        {isVisible("header") ? (
        <section
          id="header"
          className={`showcase-layout-block${blockHasBackgroundImage(blockStyles.header) ? " showcase-section-has-bg" : ""}`}
          style={{
            ...sectionCombinedStyle("header"),
            left: "calc(50% - 50vw)",
            width: "100vw",
            maxWidth: "100vw",
            boxSizing: "border-box",
            zIndex: 9999
          }}
        >
          <ShowcaseHeader
            tenant={tenant}
            tenantSlug={tenantSlug}
            blockStyles={blockStyles}
            isMobileViewport={isMobileViewport}
            whatsappHref={whatsappHref}
          />
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
              const lancamento = isLancamento(p.createdAt);
              const andamentoLabel = { PRONTO_PARA_MORAR: "Pronto para morar", EM_CONSTRUCAO: "Em construção" }[p.andamento];
              
              return (
                <Link
                  key={p.id}
                  to={`/vitrine/${tenantSlug}/imovel/${p.id}`}
                  style={{ textDecoration: "none", display: "block" }}
                >
                  <article className={`property-card-luxury ${lancamento ? "is-lancamento" : ""}`}>
                    <div className="card-image-wrapper">
                      <img
                        key={mainImage}
                        src={mainImage}
                        alt={p.title}
                      />
                      {lancamento && (
                        <span className="featured-badge" style={{ background: "linear-gradient(135deg,#f59e0b,#ef4444)", color: "#fff", border: "none" }}>
                          Lançamento
                        </span>
                      )}
                      {!lancamento && andamentoLabel && (
                        <span className="featured-badge">
                          {andamentoLabel}
                        </span>
                      )}
                      {p.aceitaPermuta && (
                        <span className="featured-badge" style={{ top: "auto", bottom: "16px", background: "rgba(99,102,241,0.8)", borderColor: "transparent" }}>
                          Aceita permuta
                        </span>
                      )}
                      {images.length > 1 && (
                        <>
                          <button type="button" className="carousel-btn prev" onClick={(e) => { e.preventDefault(); e.stopPropagation(); prevImage(p.id, images.length); }}>‹</button>
                          <button type="button" className="carousel-btn next" onClick={(e) => { e.preventDefault(); e.stopPropagation(); nextImage(p.id, images.length); }}>›</button>
                          <span className="carousel-counter">{currentIndex + 1}/{images.length}</span>
                        </>
                      )}
                    </div>

                    <div className="card-info-wrapper">
                      <h3>{p.title}</h3>
                      {(p.neighborhood || p.city) && (
                        <div className="card-location">
                          <IcPin />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {[p.neighborhood, p.city, p.state].filter(Boolean).join(", ")}
                          </span>
                        </div>
                      )}
                      {p.description && (
                        <p style={{ fontSize: "14px", color: "var(--text-muted)", lineHeight: "1.6", margin: "0 0 16px 0", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {p.description}
                        </p>
                      )}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
                        {p.squareFootage ? <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-muted)", background: "rgba(255,255,255,0.04)", padding: "6px 12px", borderRadius: "8px" }}><IcArea />{p.squareFootage} m²</span> : null}
                        {p.bedrooms ? <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-muted)", background: "rgba(255,255,255,0.04)", padding: "6px 12px", borderRadius: "8px" }}><IcBed />{p.bedrooms} qto{p.bedrooms !== 1 ? "s" : ""}{p.suites ? ` · ${p.suites} suíte${p.suites !== 1 ? "s" : ""}` : ""}</span> : null}
                        {p.parkingSpots ? <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-muted)", background: "rgba(255,255,255,0.04)", padding: "6px 12px", borderRadius: "8px" }}><IcCar />{p.parkingSpots} vaga{p.parkingSpots !== 1 ? "s" : ""}</span> : null}
                      </div>
                      {(() => {
                        const ativas = comodidadesAtivas(p.comodidades);
                        if (ativas.length === 0) return null;
                        const visiveis = ativas.slice(0, 6);
                        const restantes = ativas.length - visiveis.length;
                        return (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px" }}>
                            {visiveis.map((c) => (
                              <span key={c.key} title={c.label} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "var(--text-muted)", background: "rgba(255,255,255,0.04)", padding: "5px 10px", borderRadius: "999px" }}>
                                <span style={{ fontSize: "13px", lineHeight: 1 }}>{c.icon}</span>{c.label}
                              </span>
                            ))}
                            {restantes > 0 && (
                              <span style={{ display: "flex", alignItems: "center", fontSize: "12px", color: "var(--text-muted)", background: "rgba(255,255,255,0.04)", padding: "5px 10px", borderRadius: "999px" }}>+{restantes}</span>
                            )}
                          </div>
                        );
                      })()}
                      <div className="card-price-wrapper">
                        <div>
                          <span className="price-label">Valor</span>
                          <p className="card-price">
                            R$ {Number(p.price).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        </section>
        ) : null}

        {showcaseConfig.widgets.filter(w => !w.hidden).map((widget) => (
        <section
          key={widget.id}
          className="showcase-layout-block"
          style={{
            position: "absolute",
            left: `${widgetPos(widget).left}%`,
            top: `${widgetPos(widget).top}px`,
            width: `${widgetPos(widget).width}%`,
            minHeight: `${widgetPos(widget).minHeight}px`,
            zIndex: 10,
            boxSizing: "border-box",
            padding: "8px",
          }}
        >
          <article className="widget-card" style={{ ...mergeBlockWrapperStyle(widget), height: "100%", boxSizing: "border-box" }}>
            {widget.type === "testimonial" ? (
              <div style={{ textAlign: "center", padding: "16px" }}>
                <div className="widget-testimonial-stars">★★★★★</div>
                <div className="widget-testimonial-content" dangerouslySetInnerHTML={{ __html: widget.content }} />
                <h3 style={{ fontSize: "16px", fontWeight: "600", color: "var(--accent)", margin: 0 }} dangerouslySetInnerHTML={{ __html: widget.title }} />
              </div>
            ) : widget.type === "stats" ? (
              <div style={{ padding: "8px" }}>
                <h3 style={{ textAlign: "center", marginBottom: "24px" }} dangerouslySetInnerHTML={{ __html: widget.title }} />
                <div className="widget-stats-grid">
                  {(widget.content || "").split("|").reduce((acc, val, i) => {
                    if (i % 2 === 0) acc.push([val]);
                    else acc[acc.length - 1].push(val);
                    return acc;
                  }, []).slice(0, 4).map(([num, label], i) => (
                    <div key={i} className="widget-stat-box">
                      <div className="widget-stat-number">{num}</div>
                      <div className="widget-stat-label">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : widget.type === "cta" ? (
              <div className="widget-cta-box">
                <h3 dangerouslySetInnerHTML={{ __html: widget.title }} />
                <p style={{ fontSize: "16px", margin: "16px 0" }} dangerouslySetInnerHTML={{ __html: widget.content }} />
                {widget.ctaLabel ? (
                  <a
                    href={widget.ctaUrl || "#"}
                    target={widget.ctaUrl ? "_blank" : undefined}
                    rel={widget.ctaUrl ? "noreferrer" : undefined}
                    className="widget-cta-button"
                    dangerouslySetInnerHTML={{ __html: widget.ctaLabel }}
                  />
                ) : null}
              </div>
            ) : widget.type === "social" ? (
              <div style={{ textAlign: "center", padding: "8px" }}>
                <h3 dangerouslySetInnerHTML={{ __html: widget.title }} />
                <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "16px", marginTop: "24px" }}>
                  {(widget.content || "").split("|").filter(Boolean).map((url, i) => {
                    const isWa = url.includes("wa.me") || url.includes("whatsapp");
                    const isIg = url.includes("instagram");
                    const isFb = url.includes("facebook");
                    const label = isWa ? "WhatsApp" : isIg ? "Instagram" : isFb ? "Facebook" : "Acessar";
                    const bg = isWa ? "#25D366" : isIg ? "linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)" : isFb ? "#1877F2" : "var(--accent)";
                    const icon = isWa ? "W" : isIg ? "I" : isFb ? "F" : "S";
                    return (
                      <a key={i} href={url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 28px", background: bg, borderRadius: "16px", color: "#fff", fontSize: "15px", fontWeight: "600", textDecoration: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.15)", transition: "transform 0.3s ease" }} onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-3px)"} onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}>
                        <span style={{ fontWeight: "800", fontSize: "18px" }}>{icon}</span> {label}
                      </a>
                    );
                  })}
                </div>
              </div>
            ) : widget.type === "divider" ? (
              <div style={{ textAlign: "center", padding: "32px 0", height: "100%", display: "flex", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "24px", width: "100%" }}>
                  <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15))" }} />
                  <span style={{ fontSize: "15px", opacity: 0.7, letterSpacing: "0.2em", textTransform: "uppercase" }} dangerouslySetInnerHTML={{ __html: widget.title }} />
                  <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg, rgba(255,255,255,0.15), transparent)" }} />
                </div>
              </div>
            ) : widget.type === "map" ? (
              <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <h3 dangerouslySetInnerHTML={{ __html: widget.title }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", marginTop: "20px", background: "rgba(0,0,0,0.15)", borderRadius: "20px", padding: "32px", textAlign: "center", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "16px" }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <p style={{ fontSize: "16px", color: "var(--text-main)", margin: 0, fontWeight: "500" }} dangerouslySetInnerHTML={{ __html: widget.content }} />
                </div>
              </div>
            ) : (
              <div>
                <h3 dangerouslySetInnerHTML={{ __html: widget.title }} />
                <p dangerouslySetInnerHTML={{ __html: widget.content }} />
              </div>
            )}
          </article>
        </section>
        ))}

        {isVisible("footer") ? (
        <section
          id="footer"
          className={`showcase-layout-block${blockHasBackgroundImage(blockStyles.footer) ? " showcase-section-has-bg" : ""}`}
          style={sectionCombinedStyle("footer")}
        >
          <footer
            className="showcase-footer"
            style={mergeBlockWrapperStyle(blockStyles.footer)}
          >
            <div className="showcase-footer-grid">
              <div className="footer-col">
                <h4 style={{ color: footerColor || "inherit" }} dangerouslySetInnerHTML={{ __html: showcaseConfig.footerTitle }} />
                <p style={{ color: footerColor || "var(--text-muted)" }} dangerouslySetInnerHTML={{ __html: tenant.description || "Encontre seu próximo imóvel com segurança e transparência." }} />
              </div>
              
              <div className="footer-col">
                <h4 style={{ color: footerColor || "inherit" }}>Imobiliária</h4>
                <p style={{ color: footerColor || "var(--text-muted)", margin: "0 0 8px 0" }}>{tenantName}</p>
                {tenant.creci ? <p style={{ color: footerColor || "var(--text-muted)", margin: "0 0 8px 0" }}>CRECI {tenant.creci}</p> : null}
                {tenant.cidade ? <p style={{ color: footerColor || "var(--text-muted)", margin: "0 0 8px 0" }}>{tenant.cidade}</p> : null}
              </div>

              <div className="footer-col">
                <h4 style={{ color: footerColor || "inherit" }}>Contato</h4>
                {tenant.email ? <a href={`mailto:${tenant.email}`} style={{ color: footerColor || "var(--text-muted)" }} dangerouslySetInnerHTML={{ __html: tenant.email }} /> : null}
                {whatsappHref ? <a href={whatsappHref} target="_blank" rel="noreferrer" style={{ color: footerColor || "var(--text-muted)" }} dangerouslySetInnerHTML={{ __html: tenant.whatsapp }} /> : null}
              </div>
            </div>
            
            <div className="footer-bottom" style={{ color: footerColor || "var(--text-muted)" }}>
              &copy; {new Date().getFullYear()} {tenantName}. Todos os direitos reservados.
            </div>
          </footer>
        </section>
        ) : null}
      </div>
    </div>
  );
}