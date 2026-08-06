import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { TrialAviso } from "./TrialAviso";
import { BoasVindasModal } from "./BoasVindasModal";
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

/* ────────────────────────────────────────────────────────────────────────────
   Layout do painel do tenant (sidebar + conteúdo).

   A sidebar segue a mesma linguagem visual da landing — micro-labels em
   JetBrains Mono, itens com raio de 10px, estado ativo com borda de acento,
   separadores hairline — mas mantendo a paleta que ela já tinha (#0c0f1a,
   texto #64748b/#f1f5f9, ativo em indigo a 10%, avatar #4f46e5).

   IMPORTANTE: os estilos são escopados em `.ds-*` de propósito. O kit
   (`styles/domusKit.jsx`) traz um reset em `.dl-root` que vazaria pelo
   <Outlet/> e quebraria as telas internas do painel, que ainda vivem no
   styles.css global.
   ──────────────────────────────────────────────────────────────────────────── */

// ── Tooltip lateral (só quando recolhida) ─────────────────────────────────────
function SideTooltip({ label, collapsed, children }) {
  if (!collapsed || !label) return children;
  return (
    <Tooltip.Root delayDuration={300}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        {/* Renderiza fora da sidebar (portal), então o estilo fica inline. */}
        <Tooltip.Content
          side="right"
          sideOffset={10}
          style={{
            background: "#141821",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: "10px",
            padding: "7px 12px",
            fontSize: "12px",
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: "#f1f5f9",
            boxShadow: "0 18px 40px -16px rgba(0,0,0,0.85)",
            zIndex: 9999,
          }}
        >
          {label}
          <Tooltip.Arrow style={{ fill: "#141821" }} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

// ── Item de navegação ──────────────────────────────────────────────────────────
function NavItem({ Icon, label, active, onClick, href, collapsed, external, badge }) {
  const cls = `ds-item${active ? " is-active" : ""}`;

  const content = (
    <>
      <span className="ds-item__icon">
        <Icon size={16} weight={active ? "fill" : "regular"} />
        {collapsed && badge > 0 ? <span className="ds-item__pip" /> : null}
      </span>
      {!collapsed ? <span className="ds-item__label">{label}</span> : null}
      {!collapsed && badge > 0 ? (
        <span className="ds-item__badge">{badge > 99 ? "99+" : badge}</span>
      ) : null}
    </>
  );

  const el = href ? (
    <Link to={href} className={cls} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
      {content}
    </Link>
  ) : (
    <button type="button" className={cls} onClick={onClick}>
      {content}
    </button>
  );

  return <SideTooltip label={label} collapsed={collapsed}>{el}</SideTooltip>;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
const TOAST_META = {
  success: { Icon: CheckCircle,   cor: "#10b981" },
  error:   { Icon: XCircle,       cor: "#ef4444" },
  warning: { Icon: WarningCircle, cor: "#f59e0b" },
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

  // ── Grupos de navegação ───────────────────────────────────────────────────────
  // Um grupo só aparece se sobrar algum item depois do filtro de permissões.
  const grupos = useMemo(() => {
    const g = [
      {
        itens: [{ key: "inicio", Icon: House, label: "Início", active: isDashboard, onClick: () => navigate("/") }],
      },
      {
        label: "IMÓVEIS",
        itens: cargo?.gerenciarImoveis ? [
          { key: "imoveis-novo", Icon: Buildings, label: "Gerenciar Imóveis", active: isImovelNovo, onClick: () => navigate("/imoveis/novo") },
          { key: "imoveis-lista", Icon: SquaresFour, label: "Portfólio Ativo", active: isImovelList || isInsights, onClick: () => navigate("/imoveis") },
        ] : [],
      },
      {
        label: "RELACIONAMENTO",
        itens: [
          cargo?.gerenciarLeads && { key: "leads", Icon: Users, label: "Leads", active: isLeads, onClick: () => navigate("/leads"), badge: leadsBadge },
          cargo?.gerenciarClientes && { key: "clientes", Icon: UserCircle, label: "Clientes", active: isClientes, onClick: () => navigate("/clientes") },
        ].filter(Boolean),
      },
      {
        label: "EQUIPE",
        itens: [
          cargo?.gerenciarUsuarios && { key: "usuarios", Icon: UserSquare, label: "Usuários", active: isUsuarios, onClick: () => navigate("/usuarios") },
          cargo?.gerenciarCargos && { key: "cargos", Icon: Shield, label: "Cargos", active: isCargos, onClick: () => navigate("/cargos") },
        ].filter(Boolean),
      },
      {
        label: "VITRINE",
        itens: [
          (cargo?.editarPagina || cargo?.gerenciarUsuarios) && { key: "config", Icon: GearSix, label: "Configurações", active: isConfiguracoes, onClick: () => navigate("/configuracoes") },
          cargo?.editarPagina && { key: "editar-pagina", Icon: PencilSimple, label: "Editar página", active: isShowcaseEditor, href: showcaseEditorLink },
          { key: "ver-pagina", Icon: ArrowSquareOut, label: "Ver página", href: showcaseLink, external: true },
        ].filter(Boolean),
      },
    ];
    return g.filter((grupo) => grupo.itens.length > 0);
  }, [
    cargo, navigate, leadsBadge, showcaseEditorLink, showcaseLink,
    isDashboard, isImovelNovo, isImovelList, isInsights, isLeads,
    isClientes, isUsuarios, isCargos, isConfiguracoes, isShowcaseEditor,
  ]);

  const c = collapsed;

  return (
    <Tooltip.Provider>
      <style>{CSS}</style>

      {/* Recebe quem acabou de assinar, uma vez só, já dentro do produto. */}
      <BoasVindasModal tenantSlug={tenantSlug} />

      <div className="ds-shell">
        {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
        <aside className={`ds-side${c ? " is-collapsed" : ""}`}>

          {/* Header */}
          <div className="ds-head">
            <div className={`ds-mark${session?.tenant?.logoUrl ? " has-logo" : ""}`}>
              {session?.tenant?.logoUrl
                ? <img src={session.tenant.logoUrl} alt={tenantName} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                : tenantName.charAt(0).toUpperCase()}
            </div>
            {!c ? (
              <div className="ds-head__text">
                <span className="ds-head__name">{tenantName}</span>
                {tenantSlug ? <span className="ds-head__slug">/{tenantSlug}</span> : null}
              </div>
            ) : null}
          </div>

          {/* Navegação */}
          <nav className="ds-nav">
            {grupos.map((grupo, gi) => (
              <div className="ds-group" key={grupo.label || `g-${gi}`}>
                {grupo.label ? (
                  c
                    ? <span className="ds-group__rule" aria-hidden="true" />
                    : <span className="ds-group__label">{grupo.label}</span>
                ) : null}
                {grupo.itens.map((item) => (
                  <NavItem
                    key={item.key}
                    Icon={item.Icon}
                    label={item.label}
                    active={item.active}
                    onClick={item.onClick}
                    href={item.href}
                    external={item.external}
                    badge={item.badge}
                    collapsed={c}
                  />
                ))}
              </div>
            ))}
          </nav>

          {/* Rodapé */}
          <div className="ds-foot">
            {/* Só aparece enquanto o tenant estiver em teste; some ao assinar. */}
            <SideTooltip label="Assinar a Domus" collapsed={c}>
              <div>
                <TrialAviso
                  tenantSlug={tenantSlug}
                  podeAssinar={Boolean(cargo?.gerenciarUsuarios)}
                  aoAssinar={() => window.location.reload()}
                />
              </div>
            </SideTooltip>

            <SideTooltip label="Expandir menu" collapsed={c}>
              <button type="button" className="ds-item" onClick={toggleCollapsed}>
                <span className="ds-item__icon">{c ? <CaretRight size={16} /> : <CaretLeft size={16} />}</span>
                {!c ? <span className="ds-item__label">Recolher menu</span> : null}
              </button>
            </SideTooltip>

            <NavItem Icon={SignOut} label="Encerrar Sessão" onClick={onLogout} collapsed={c} />

            <div className="ds-profile">
              <div className="ds-avatar">{userInitial}</div>
              {!c ? (
                <div className="ds-profile__text">
                  <span className="ds-profile__name">{userName}</span>
                  <span className="ds-profile__role">{userRole}</span>
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        {/* ── Conteúdo principal ───────────────────────────────────────────────── */}
        <main className={isShowcaseEditor ? "main-content--editor-vitrine" : "main-content"} style={{ flex: 1, minWidth: 0 }}>
          <div key={location.pathname} style={{ animation: "chicEntrance 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards" }}>
            <Outlet context={{ showToast }} />
          </div>
        </main>

        {/* ── Toasts ───────────────────────────────────────────────────────────── */}
        <div className="ds-toasts">
          {toasts.map((toast) => {
            const meta = TOAST_META[toast.type] ?? TOAST_META.success;
            return (
              <div key={toast.id} className="ds-toast">
                <span className="ds-toast__icon" style={{ color: meta.cor }}>
                  <meta.Icon size={15} weight="fill" />
                </span>
                <span>{toast.message}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Tooltip.Provider>
  );
}

/* ── Estilos da sidebar ──────────────────────────────────────────────────────
   Escopados em `.ds-*`. A paleta é a mesma de antes; o que mudou foi a
   linguagem: raio de 10px, borda de acento no item ativo, labels de grupo em
   mono e hairlines no lugar dos separadores sólidos.
   ────────────────────────────────────────────────────────────────────────── */

const CSS = `
.ds-shell {
  --s-bg: #0c0f1a;
  --s-border: rgba(255,255,255,0.07);
  --s-sep: rgba(255,255,255,0.06);
  --s-text: #64748b;
  --s-strong: #f1f5f9;
  --s-hover: rgba(255,255,255,0.05);
  --s-active: rgba(129,140,248,0.10);
  --s-accent: #818cf8;
  --s-avatar: #4f46e5;
  --s-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;

  display: flex; min-height: 100vh;
  font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
}

.ds-side {
  width: 240px; min-width: 240px;
  height: 100vh; position: sticky; top: 0; z-index: 10; flex-shrink: 0;
  display: flex; flex-direction: column;
  background: var(--s-bg);
  border-right: 1px solid var(--s-border);
  overflow-x: hidden; overflow-y: auto;
  transition: width 0.25s cubic-bezier(0.4,0,0.2,1), min-width 0.25s cubic-bezier(0.4,0,0.2,1);
}
.ds-side.is-collapsed { width: 64px; min-width: 64px; }

/* ── Header ── */
.ds-head {
  display: flex; align-items: center; gap: 10px;
  height: 56px; padding: 0 14px; flex-shrink: 0;
  border-bottom: 1px solid var(--s-border);
}
.ds-side.is-collapsed .ds-head { justify-content: center; padding: 0; gap: 0; }
.ds-mark {
  width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  background: var(--s-avatar); color: #fff; font-weight: 700; font-size: 13px;
}
.ds-mark.has-logo { background: transparent; }
.ds-mark img { width: 100%; height: 100%; object-fit: contain; }
.ds-head__text { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.ds-head__name {
  font-size: 13px; font-weight: 600; color: var(--s-strong); letter-spacing: -0.01em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ds-head__slug {
  font-family: var(--s-mono); font-size: 8.5px; letter-spacing: 0.08em;
  color: var(--s-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* ── Navegação ── */
.ds-nav { flex: 1; overflow-y: auto; padding: 10px 8px; display: flex; flex-direction: column; gap: 12px; }
.ds-group { display: flex; flex-direction: column; gap: 2px; }
.ds-group__label {
  font-family: var(--s-mono); font-size: 8.5px; letter-spacing: 0.16em;
  text-transform: uppercase; color: #475569; font-weight: 500;
  padding: 4px 10px 5px;
}
.ds-group__rule { height: 1px; background: var(--s-sep); margin: 4px 6px 5px; }

.ds-shell .ds-item {
  display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 8px 10px; border-radius: 10px;
  font-family: inherit; font-size: 13px; font-weight: 500; text-align: left;
  color: var(--s-text); background: transparent;
  border: 1px solid transparent; box-shadow: none; transform: none;
  cursor: pointer; text-decoration: none; white-space: nowrap; overflow: hidden;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.ds-shell .ds-item:hover {
  background: var(--s-hover); color: var(--s-strong);
  box-shadow: none; transform: none; border-color: transparent;
}
.ds-shell .ds-item.is-active {
  background: var(--s-active); color: var(--s-strong);
  border-color: rgba(129,140,248,0.26);
}
.ds-side.is-collapsed .ds-item { justify-content: center; padding: 8px; gap: 0; }

.ds-item__icon { display: flex; flex-shrink: 0; position: relative; color: currentColor; }
.ds-item.is-active .ds-item__icon { color: #fff; }
.ds-item__label { overflow: hidden; text-overflow: ellipsis; flex: 1; }
.ds-item__pip {
  position: absolute; top: -4px; right: -4px; width: 8px; height: 8px;
  border-radius: 50%; background: #ef4444; border: 1.5px solid var(--s-bg);
}
.ds-item__badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px;
  background: #ef4444; color: #fff; font-size: 10px; font-weight: 700; flex-shrink: 0;
}

/* ── Rodapé ── */
.ds-foot {
  padding: 8px; flex-shrink: 0;
  border-top: 1px solid var(--s-border);
  display: flex; flex-direction: column; gap: 2px;
}
.ds-profile {
  display: flex; align-items: center; gap: 10px;
  padding: 10px; margin-top: 4px;
  border-top: 1px solid var(--s-sep);
}
.ds-side.is-collapsed .ds-profile { justify-content: center; padding: 10px 8px; }
.ds-avatar {
  width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: var(--s-avatar); color: #fff; font-size: 11px; font-weight: 700;
}
.ds-profile__text { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
.ds-profile__name {
  font-size: 12px; font-weight: 600; color: var(--s-strong); line-height: 1.3;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ds-profile__role {
  font-family: var(--s-mono); font-size: 8.5px; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--s-text); line-height: 1.3;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* ── Toasts ── */
.ds-toasts {
  position: fixed; bottom: 24px; right: 24px; z-index: 99999;
  display: flex; flex-direction: column; gap: 8px; pointer-events: none;
}
.ds-toast {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px; border-radius: 12px; max-width: 360px;
  font-size: 13px; font-weight: 500; color: var(--s-strong);
  background: rgba(20,24,33,0.92);
  backdrop-filter: blur(14px) saturate(150%); -webkit-backdrop-filter: blur(14px) saturate(150%);
  border: 1px solid rgba(255,255,255,0.10);
  box-shadow: 0 20px 48px -18px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.06);
  pointer-events: auto;
  animation: toastIn 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
.ds-toast__icon { display: flex; flex-shrink: 0; }

@media (prefers-reduced-motion: reduce) {
  .ds-side { transition: none; }
  .ds-toast { animation: none; }
}
`;
