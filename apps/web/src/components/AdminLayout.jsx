import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  House,
  Buildings,
  SquaresFour,
  Users,
  UserCircle,
  UserSquare,
  Shield,
  GearSix,
  PencilSimple,
  ArrowSquareOut,
  SignOut,
  CaretLeft,
  CaretRight,
  CheckCircle,
  XCircle,
  WarningCircle,
} from "@phosphor-icons/react";

// ── Paleta da sidebar ─────────────────────────────────────────────────────────
const S = {
  bg:         "#0c0f1a",
  border:     "rgba(255,255,255,0.07)",
  text:       "#64748b",
  textActive: "#f1f5f9",
  hover:      "rgba(255,255,255,0.05)",
  active:     "rgba(129,140,248,0.10)",
  separator:  "rgba(255,255,255,0.06)",
  avatarBg:   "#4f46e5",
};

// ── Tooltip lateral (só quando recolhida) ─────────────────────────────────────
function SideTooltip({ label, collapsed, children }) {
  if (!collapsed) return children;
  return (
    <Tooltip.Root delayDuration={300}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={10}
          style={{
            background: "rgba(15,23,42,0.95)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "6px",
            padding: "5px 10px",
            fontSize: "12px",
            fontWeight: 500,
            color: "#f1f5f9",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            zIndex: 9999,
          }}
        >
          {label}
          <Tooltip.Arrow style={{ fill: "rgba(15,23,42,0.95)" }} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

// ── Item de navegação ──────────────────────────────────────────────────────────
function NavItem({ Icon, label, active, onClick, href, collapsed, external, badge }) {
  const baseStyle = {
    display: "flex",
    alignItems: "center",
    gap: collapsed ? 0 : "10px",
    justifyContent: collapsed ? "center" : "flex-start",
    width: "100%",
    padding: collapsed ? "8px" : "8px 10px",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    textDecoration: "none",
    background: active ? S.active : "transparent",
    color: active ? S.textActive : S.text,
    border: "none",
    boxShadow: "none",
    transform: "none",
    transition: "background 0.15s, color 0.15s",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textAlign: "left",
  };

  function handleMouseEnter(e) {
    if (!active) {
      e.currentTarget.style.background = S.hover;
      e.currentTarget.style.color = S.textActive;
    }
  }
  function handleMouseLeave(e) {
    if (!active) {
      e.currentTarget.style.background = "transparent";
      e.currentTarget.style.color = S.text;
    }
  }

  const content = (
    <>
      <span style={{ display: "flex", flexShrink: 0, color: active ? "#fff" : "currentColor", position: "relative" }}>
        <Icon size={16} weight={active ? "fill" : "regular"} />
        {collapsed && badge > 0 && (
          <span style={{ position: "absolute", top: "-4px", right: "-4px", width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444", border: "1.5px solid #0c0f1a" }} />
        )}
      </span>
      {!collapsed && (
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{label}</span>
      )}
      {!collapsed && badge > 0 && (
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "18px", height: "18px", padding: "0 5px", borderRadius: "999px", background: "#ef4444", color: "#fff", fontSize: "10px", fontWeight: 700, flexShrink: 0 }}>
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </>
  );

  const el = href ? (
    <Link
      to={href}
      style={baseStyle}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {content}
    </Link>
  ) : (
    <button
      type="button"
      style={baseStyle}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {content}
    </button>
  );

  return <SideTooltip label={label} collapsed={collapsed}>{el}</SideTooltip>;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
const TOAST_META = {
  success: { Icon: CheckCircle,   bg: "rgba(16,185,129,0.92)" },
  error:   { Icon: XCircle,       bg: "rgba(239,68,68,0.92)"  },
  warning: { Icon: WarningCircle, bg: "rgba(245,158,11,0.92)" },
};

// ── Layout principal ───────────────────────────────────────────────────────────
export function AdminLayout({ session, onLogout }) {
  const location  = useLocation();
  const navigate  = useNavigate();
  const tenantSlug = session?.tenant?.slug  || "";
  const tenantName = session?.tenant?.name  || "Domus";
  const userInitial = session?.usuario?.nome?.charAt(0)?.toUpperCase() || "U";
  const userName    = session?.usuario?.nome || "";
  const userRole    = session?.usuario?.cargo?.descricao || "Operador";
  const cargo       = session?.usuario?.cargo;

  // ── Colapso ──────────────────────────────────────────────────────────────────
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "true"; } catch { return false; }
  });
  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem("sidebar-collapsed", String(next)); } catch {}
      return next;
    });
  }

  // ── Toast ─────────────────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState([]);
  const showToast = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  // ── Links ─────────────────────────────────────────────────────────────────────
  const showcaseLink       = useMemo(() => tenantSlug ? `/vitrine/${tenantSlug}`         : "#", [tenantSlug]);
  const showcaseEditorLink = useMemo(() => tenantSlug ? `/vitrine/${tenantSlug}/editar`  : "#", [tenantSlug]);

  // ── Estado ativo ──────────────────────────────────────────────────────────────
  const p = location.pathname;
  const isDashboard     = p === "/";
  const isImovelNovo    = p === "/imoveis/novo" || p === "/tipos-imovel";
  const isImovelList    = p === "/imoveis";
  const isInsights      = p.startsWith("/imoveis/") && !isImovelNovo;
  const isLeads         = p === "/leads";
  const isClientes      = p === "/clientes";
  const isUsuarios      = p === "/usuarios";
  const isCargos        = p === "/cargos";
  const isConfiguracoes = p === "/configuracoes";
  // Apenas o editor da vitrine (/vitrine/:slug/editar) — não confundir com
  // /imoveis/editar, que é o formulário de imóvel.
  const isShowcaseEditor = p.startsWith("/vitrine/") && p.endsWith("/editar");

  // ── Badge de novos leads ──────────────────────────────────────────────────────
  const [leadsBadge, setLeadsBadge] = useState(0);
  const canSeeLeads = Boolean(cargo?.gerenciarLeads);
  useEffect(() => {
    if (!tenantSlug || !canSeeLeads) return;
    function checkLeads() {
      api.listLeads(tenantSlug, { page: 1, limit: 1 }).then((result) => {
        const total = result.total ?? (result.leads?.length ?? 0);
        try {
          const seen = parseInt(localStorage.getItem(`domus_leads_seen_${tenantSlug}`) || "0", 10);
          setLeadsBadge(Math.max(0, total - seen));
        } catch { setLeadsBadge(0); }
      }).catch(() => {});
    }
    checkLeads();
    window.addEventListener("focus", checkLeads);
    return () => window.removeEventListener("focus", checkLeads);
  }, [tenantSlug, canSeeLeads]);
  useEffect(() => { if (isLeads) setLeadsBadge(0); }, [isLeads]);

  const c = collapsed;
  const sidebarWidth = c ? 64 : 240;

  return (
    <Tooltip.Provider>
      <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif" }}>

        {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
        <aside style={{
          width: `${sidebarWidth}px`,
          minWidth: `${sidebarWidth}px`,
          height: "100vh",
          position: "sticky",
          top: 0,
          display: "flex",
          flexDirection: "column",
          background: S.bg,
          borderRight: `1px solid ${S.border}`,
          overflowX: "hidden",
          overflowY: "auto",
          transition: "width 0.25s cubic-bezier(0.4,0,0.2,1), min-width 0.25s cubic-bezier(0.4,0,0.2,1)",
          flexShrink: 0,
          zIndex: 10,
        }}>

          {/* Header da sidebar */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: c ? 0 : "10px",
            justifyContent: c ? "center" : "flex-start",
            height: "56px",
            padding: c ? "0" : "0 14px",
            borderBottom: `1px solid ${S.border}`,
            flexShrink: 0,
          }}>
            <div style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              background: session?.tenant?.logoUrl ? "transparent" : S.avatarBg,
              color: "#fff",
              fontWeight: 700,
              fontSize: "13px",
            }}>
              {session?.tenant?.logoUrl
                ? <img src={session.tenant.logoUrl} alt={tenantName} style={{ width: "100%", height: "100%", objectFit: "contain" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                : tenantName.charAt(0).toUpperCase()}
            </div>
            {!c && (
              <span style={{
                fontSize: "13px",
                fontWeight: 600,
                color: S.textActive,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                letterSpacing: "-0.01em",
              }}>
                {tenantName}
              </span>
            )}
          </div>

          {/* Navegação */}
          <nav style={{ flex: 1, overflowY: "auto", padding: "8px", display: "flex", flexDirection: "column", gap: "2px" }}>
            <NavItem Icon={House}          label="Início"           active={isDashboard}              onClick={() => navigate("/")}            collapsed={c} />

            {cargo?.gerenciarImoveis && (<>
              <NavItem Icon={Buildings}    label="Gerenciar Imóveis" active={isImovelNovo}             onClick={() => navigate("/imoveis/novo")} collapsed={c} />
              <NavItem Icon={SquaresFour}  label="Portfólio Ativo"   active={isImovelList || isInsights} onClick={() => navigate("/imoveis")}   collapsed={c} />
            </>)}

            {cargo?.gerenciarLeads && (
              <NavItem Icon={Users}        label="Leads"             active={isLeads}                  onClick={() => navigate("/leads")}       collapsed={c} badge={leadsBadge} />
            )}

            {cargo?.gerenciarClientes && (
              <NavItem Icon={UserCircle}   label="Clientes"          active={isClientes}               onClick={() => navigate("/clientes")}    collapsed={c} />
            )}

            {cargo?.gerenciarUsuarios && (
              <NavItem Icon={UserSquare}   label="Usuários"          active={isUsuarios}               onClick={() => navigate("/usuarios")}    collapsed={c} />
            )}
            {cargo?.gerenciarCargos && (
              <NavItem Icon={Shield}       label="Cargos"            active={isCargos}                 onClick={() => navigate("/cargos")}      collapsed={c} />
            )}

            <div style={{ height: "1px", background: S.separator, margin: "6px 4px" }} />

            {(cargo?.editarPagina || cargo?.gerenciarUsuarios) && (
              <NavItem Icon={GearSix}      label="Configurações"     active={isConfiguracoes}          onClick={() => navigate("/configuracoes")} collapsed={c} />
            )}

            {cargo?.editarPagina && (
              <NavItem Icon={PencilSimple} label="Editar página"    active={isShowcaseEditor}         href={showcaseEditorLink}               collapsed={c} />
            )}

            <NavItem Icon={ArrowSquareOut} label="Ver página"        href={showcaseLink} external      collapsed={c} />
          </nav>

          {/* Rodapé */}
          <div style={{ padding: "8px", borderTop: `1px solid ${S.border}`, display: "flex", flexDirection: "column", gap: "2px", flexShrink: 0 }}>
            {/* Toggle colapso */}
            <SideTooltip label={c ? "Expandir" : ""} collapsed={c}>
              <button
                type="button"
                onClick={toggleCollapsed}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: c ? 0 : "10px",
                  justifyContent: c ? "center" : "flex-start",
                  width: "100%",
                  padding: c ? "8px" : "8px 10px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                  background: "transparent",
                  color: S.text,
                  border: "none",
                  boxShadow: "none",
                  transform: "none",
                  transition: "background 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = S.hover; e.currentTarget.style.color = S.textActive; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = S.text; }}
              >
                <span style={{ display: "flex", flexShrink: 0 }}>
                  {c ? <CaretRight size={16} /> : <CaretLeft size={16} />}
                </span>
                {!c && <span>Recolher menu</span>}
              </button>
            </SideTooltip>

            <NavItem Icon={SignOut} label="Encerrar Sessão" onClick={onLogout} collapsed={c} />

            {/* Perfil */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              justifyContent: c ? "center" : "flex-start",
              padding: c ? "8px" : "8px 10px",
              marginTop: "2px",
            }}>
              <div style={{
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: S.avatarBg,
                color: "#fff",
                fontSize: "11px",
                fontWeight: 700,
              }}>
                {userInitial}
              </div>
              {!c && (
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ margin: 0, fontSize: "12px", fontWeight: 500, color: S.textActive, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3 }}>{userName}</p>
                  <p style={{ margin: "1px 0 0", fontSize: "11px", color: S.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3 }}>{userRole}</p>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ── Conteúdo principal ───────────────────────────────────────────────── */}
        <main
          className={isShowcaseEditor ? "main-content--editor-vitrine" : "main-content"}
          style={{ flex: 1, minWidth: 0 }}
        >
          <div key={location.pathname} style={{ animation: "chicEntrance 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards" }}>
            <Outlet context={{ showToast }} />
          </div>
        </main>

        {/* ── Toasts ───────────────────────────────────────────────────────────── */}
        <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 99999, display: "flex", flexDirection: "column", gap: "8px", pointerEvents: "none" }}>
          {toasts.map((toast) => {
            const meta = TOAST_META[toast.type] ?? TOAST_META.success;
            return (
              <div
                key={toast.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#fff",
                  background: meta.bg,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  maxWidth: "360px",
                  pointerEvents: "auto",
                  animation: "toastIn 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards",
                }}
              >
                <meta.Icon size={15} weight="fill" />
                <span>{toast.message}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Tooltip.Provider>
  );
}
