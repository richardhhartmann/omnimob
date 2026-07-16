import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { blockHasBackgroundImage } from "../../utils/showcaseConfig";

export function ShowcaseHeader({ tenant, tenantSlug, blockStyles, isMobileViewport, whatsappHref }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const bs = blockStyles?.header || {};
  const primary = tenant?.primaryColor || "#6366f1";
  const tenantName = tenant?.name || tenantSlug?.toUpperCase() || "Domus";
  const initialLetter = tenantName.charAt(0).toUpperCase();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function getHeaderClass() {
    return `luxury-header-wrapper ${isScrolled ? "is-scrolled" : "not-scrolled"}`;
  }

  // Se a página for rolada, anula as cores inline para que o CSS garanta o contraste com o fundo glass.
  // Caso contrário, usa a cor customizada do painel (se houver), ou herda automaticamente o Dark/Light mode.
  const dynamicColor = isScrolled ? undefined : (bs.color || undefined);

  const logoEl = tenant?.logoUrl
    ? <img src={tenant.logoUrl} alt={tenantName} className="brand-logo-image" style={{ width: isScrolled ? "40px" : "54px", transition: "width 0.4s ease" }} />
    : <span style={{ fontSize: isScrolled ? "18px" : "24px", fontWeight: "700", transition: "font-size 0.4s ease" }}>{initialLetter}</span>;

  if (isMobileViewport) {
    return (
      <div className={getHeaderClass()}>
        <div style={{ padding: "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: "70px" }}>
          <Link to={`/vitrine/${tenantSlug}`} style={{ display: "flex", alignItems: "center", gap: "12px", textDecoration: "none" }}>
            <div className="brand-logo-exclusive" style={{ width: isScrolled ? "36px" : "44px", height: isScrolled ? "36px" : "44px", background: tenant?.logoUrl ? "transparent" : `linear-gradient(135deg, ${tenant?.secondaryColor || primary}, ${primary})`, boxShadow: tenant?.logoUrl ? "none" : undefined, transition: "all 0.4s ease" }}>
              {logoEl}
            </div>
            <div className="brand-title-group" style={{ minWidth: 0, color: dynamicColor }}>
              <h1 style={{ fontSize: isScrolled ? "14px" : "16px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", transition: "font-size 0.4s ease" }}>
                {tenantName}
              </h1>
            </div>
          </Link>
          {whatsappHref ? (
            <a href={whatsappHref} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, background: primary, color: "#fff", padding: "10px 16px", borderRadius: "100px", fontWeight: "600", fontSize: "13px", textDecoration: "none", boxShadow: `0 4px 12px ${primary}55` }}>
              Contato
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={getHeaderClass()}>
      <div style={{ padding: "0 48px", maxWidth: "1400px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link to={`/vitrine/${tenantSlug}`} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "16px" }}>
          <div className="brand-logo-exclusive" style={{ width: isScrolled ? "46px" : "60px", height: isScrolled ? "46px" : "60px", background: tenant?.logoUrl ? "transparent" : `linear-gradient(135deg, ${tenant?.secondaryColor || primary}, ${primary})`, boxShadow: tenant?.logoUrl ? "none" : undefined, transition: "all 0.4s ease" }}>
            {logoEl}
          </div>
          <div className="brand-title-group" style={{ color: dynamicColor }}>
            <h1 style={{ fontSize: isScrolled ? "18px" : "22px", letterSpacing: "-0.5px", transition: "font-size 0.4s ease" }}>{tenantName}</h1>
            <p style={{ fontSize: "11px", letterSpacing: "1.5px", textTransform: "uppercase", opacity: 0.7, marginTop: "2px" }}>
              {tenant?.slogan || [tenant?.creci ? `CRECI ${tenant.creci}` : null, tenant?.cidade || null].filter(Boolean).join(" · ") || "Alto Padrão"}
            </p>
          </div>
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: "36px" }}>
          <Link to={`/vitrine/${tenantSlug}#destaques`} className="luxury-nav-link" style={{ color: dynamicColor, textDecoration: "none", fontSize: "14px", fontWeight: "500", transition: "color 0.3s ease" }}>Imóveis</Link>
          <Link to={`/vitrine/${tenantSlug}#destaques`} className="luxury-nav-link" style={{ color: dynamicColor, textDecoration: "none", fontSize: "14px", fontWeight: "500", transition: "color 0.3s ease" }}>Destaques</Link>
          <Link to={`/vitrine/${tenantSlug}#footer`} className="luxury-nav-link" style={{ color: dynamicColor, textDecoration: "none", fontSize: "14px", fontWeight: "500", transition: "color 0.3s ease" }}>Sobre nós</Link>
          <Link to={`/login?tenant=${tenantSlug}`} className="luxury-nav-link" style={{ color: dynamicColor, textDecoration: "none", fontSize: "14px", fontWeight: "500", opacity: 0.7, transition: "all 0.3s ease" }}>Acesso</Link>
        </nav>

        <div style={{ minWidth: "180px", display: "flex", justifyContent: "flex-end" }}>
          {whatsappHref ? (
            <a href={whatsappHref} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: "8px", background: isScrolled ? primary : "transparent", border: `1px solid ${isScrolled ? "transparent" : (dynamicColor || "currentColor")}`, color: isScrolled ? "#fff" : (dynamicColor || "currentColor"), padding: "12px 28px", borderRadius: "100px", fontWeight: "600", fontSize: "14px", textDecoration: "none", transition: "all 0.3s ease", boxShadow: isScrolled ? `0 8px 24px ${primary}66` : "none" }} onMouseEnter={(e) => { e.currentTarget.style.background = primary; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.transform = "translateY(-2px)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = isScrolled ? primary : "transparent"; e.currentTarget.style.color = isScrolled ? "#fff" : (dynamicColor || "currentColor"); e.currentTarget.style.borderColor = isScrolled ? "transparent" : (dynamicColor || "currentColor"); e.currentTarget.style.transform = "translateY(0)"; }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              Consultoria
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}