import { useEffect, useState } from "react";
import { ShowcaseLink, ShowcaseLinkExterno, useVitrine } from "./contexto.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   O cabeçalho da vitrine.

   Este componente já existia e já era usado pela página pública — mas o editor
   desenhava um cabeçalho PRÓPRIO, com outro padding, outros tamanhos de logo e
   um botão de contato de estilo diferente. Era a divergência mais visível da
   tela: a primeira coisa que a pessoa via no construtor não era a primeira
   coisa que o visitante recebia.

   Agora é este, nos dois.

   ── A ÚNICA DIFERENÇA, E POR QUE ELA É INEVITÁVEL ──

   Na vitrine o cabeçalho é `position: fixed` e encolhe ao rolar a página. Dentro
   do editor não existe "rolar a página": a prancheta é um retângulo estático, e
   um elemento fixo escaparia dela para a janela do navegador. Então no editor
   ele fica no fluxo (regra em `styles.css`) e sempre no estado NÃO rolado — que
   é exatamente o estado em que o visitante encontra a página ao chegar.
   ──────────────────────────────────────────────────────────────────────────── */

export function ShowcaseHeader({ tenant, tenantSlug, blockStyles, isMobileViewport, whatsappHref }) {
  const { modo } = useVitrine();
  const noEditor = modo === "editor";
  const [rolado, setRolado] = useState(false);

  useEffect(() => {
    if (noEditor) return undefined;
    const aoRolar = () => setRolado(window.scrollY > 50);
    window.addEventListener("scroll", aoRolar);
    return () => window.removeEventListener("scroll", aoRolar);
  }, [noEditor]);

  const bs = blockStyles?.header || {};
  const primary = tenant?.primaryColor || "#6366f1";
  const nome = tenant?.name || tenantSlug?.toUpperCase() || "Omnimob";
  const inicial = nome.charAt(0).toUpperCase();

  // Rolada, a barra ganha fundo de vidro e o CSS assume o contraste; parada,
  // vale a cor escolhida no painel (ou a herdada do modo claro/escuro).
  const cor = rolado ? undefined : (bs.color || undefined);

  const logo = tenant?.logoUrl ? (
    <img src={tenant.logoUrl} alt={nome} className="brand-logo-image" style={{ width: rolado ? "40px" : "54px", transition: "width 0.4s ease" }} />
  ) : (
    <span style={{ fontSize: rolado ? "18px" : "24px", fontWeight: "700", transition: "font-size 0.4s ease" }}>{inicial}</span>
  );

  const marca = (tamanho) => (
    <div
      className="brand-logo-exclusive"
      style={{
        width: tamanho, height: tamanho,
        background: tenant?.logoUrl ? "transparent" : `linear-gradient(135deg, ${tenant?.secondaryColor || primary}, ${primary})`,
        boxShadow: tenant?.logoUrl ? "none" : undefined,
        transition: "all 0.4s ease",
      }}
    >
      {logo}
    </div>
  );

  const classe = `luxury-header-wrapper ${rolado ? "is-scrolled" : "not-scrolled"}`;

  if (isMobileViewport) {
    return (
      <div className={classe}>
        <div style={{ padding: "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: "70px" }}>
          <ShowcaseLink para={`/vitrine/${tenantSlug}`} style={{ display: "flex", alignItems: "center", gap: "12px", textDecoration: "none" }}>
            {marca(rolado ? "36px" : "44px")}
            <div className="brand-title-group" style={{ minWidth: 0, color: cor }}>
              <h1 style={{ fontSize: rolado ? "14px" : "16px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", transition: "font-size 0.4s ease" }}>
                {nome}
              </h1>
            </div>
          </ShowcaseLink>
          {whatsappHref ? (
            <ShowcaseLinkExterno
              href={whatsappHref}
              style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, background: primary, color: "#fff", padding: "10px 16px", borderRadius: "100px", fontWeight: "600", fontSize: "13px", textDecoration: "none", boxShadow: `0 4px 12px ${primary}55` }}
            >
              Contato
            </ShowcaseLinkExterno>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={classe}>
      <div style={{ padding: "0 48px", maxWidth: "1400px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <ShowcaseLink para={`/vitrine/${tenantSlug}`} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "16px" }}>
          {marca(rolado ? "46px" : "60px")}
          <div className="brand-title-group" style={{ color: cor }}>
            <h1 style={{ fontSize: rolado ? "18px" : "22px", letterSpacing: "-0.5px", transition: "font-size 0.4s ease" }}>{nome}</h1>
            <p style={{ fontSize: "11px", letterSpacing: "1.5px", textTransform: "uppercase", opacity: 0.7, marginTop: "2px" }}>
              {tenant?.slogan || [tenant?.creci ? `CRECI ${tenant.creci}` : null, tenant?.cidade || null].filter(Boolean).join(" · ") || "Alto Padrão"}
            </p>
          </div>
        </ShowcaseLink>

        <nav style={{ display: "flex", alignItems: "center", gap: "36px" }}>
          {[["Imóveis", "#destaques"], ["Destaques", "#destaques"], ["Sobre nós", "#footer"]].map(([rotulo, ancora]) => (
            <ShowcaseLink
              key={rotulo}
              para={`/vitrine/${tenantSlug}${ancora}`}
              className="luxury-nav-link"
              style={{ color: cor, textDecoration: "none", fontSize: "14px", fontWeight: "500", transition: "color 0.3s ease" }}
            >
              {rotulo}
            </ShowcaseLink>
          ))}
        </nav>

        <div style={{ minWidth: "180px", display: "flex", justifyContent: "flex-end" }}>
          {whatsappHref ? (
            <ShowcaseLinkExterno
              href={whatsappHref}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                background: rolado ? primary : "transparent",
                border: `1px solid ${rolado ? "transparent" : (cor || "currentColor")}`,
                color: rolado ? "#fff" : (cor || "currentColor"),
                padding: "12px 28px", borderRadius: "100px", fontWeight: "600", fontSize: "14px",
                textDecoration: "none", transition: "all 0.3s ease",
                boxShadow: rolado ? `0 8px 24px ${primary}66` : "none",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              Consultoria
            </ShowcaseLinkExterno>
          ) : null}
        </div>
      </div>
    </div>
  );
}
