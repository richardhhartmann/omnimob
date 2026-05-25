import { useMemo } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";


export function AdminLayout({ session, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const tenantSlug = session?.tenant?.slug || "";
  const initialLetter = session?.tenant?.name?.charAt(0)?.toUpperCase() || "D";
  const userInitial = session?.usuario?.nome?.charAt(0)?.toUpperCase() || "U";
  const cargo = session?.usuario?.cargo;

  const showcaseLink = useMemo(() => (tenantSlug ? `/vitrine/${tenantSlug}` : "#"), [tenantSlug]);
  const showcaseEditorLink = useMemo(() => (tenantSlug ? `/vitrine/${tenantSlug}/editar` : "#"), [tenantSlug]);

  const isDashboard = location.pathname === "/";
  const isLeads = location.pathname === "/leads";
  const isUsuarios = location.pathname === "/usuarios";
  const isCargos = location.pathname === "/cargos";
  const isConfiguracoes = location.pathname === "/configuracoes";
  const isTiposImovel = location.pathname === "/tipos-imovel";
  const isShowcaseEditor = location.pathname.endsWith("/editar");
  const searchParams = new URLSearchParams(location.search);
  const activeTab = searchParams.get("tab") || "create";

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="tenant-logo">{initialLetter}</div>
          <div className="tenant-title-group">
            <h1>{session?.tenant?.name || "Domus"}</h1>
          </div>
        </div>

        <nav className="sidebar-nav" style={{ marginTop: "24px" }}>
          <button
            type="button"
            className={`nav-button ${isDashboard && searchParams.get("tab") === null ? "active" : ""}`}
            onClick={() => navigate("/")}
          >
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            Início
          </button>

          {cargo?.gerenciarImoveis && (
            <>
              <button
                type="button"
                className={`nav-button ${(isDashboard && searchParams.get("tab") === "create") || isTiposImovel ? "active" : ""}`}
                onClick={() => navigate("/?tab=create")}
              >
                <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Gerenciar Imóveis
              </button>
              <button
                type="button"
                className={`nav-button ${isDashboard && searchParams.get("tab") === "list" ? "active" : ""}`}
                onClick={() => navigate("/?tab=list")}
              >
                <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                Portfólio Ativo
              </button>
            </>
          )}

          {cargo?.gerenciarLeads && (
            <button
              type="button"
              className={`nav-button ${isLeads ? "active" : ""}`}
              onClick={() => navigate("/leads")}
            >
              <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Leads
            </button>
          )}

          {cargo?.gerenciarUsuarios && (
            <>
              <button
                type="button"
                className={`nav-button ${isUsuarios ? "active" : ""}`}
                onClick={() => navigate("/usuarios")}
              >
                <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                Usuários
              </button>
              <button
                type="button"
                className={`nav-button ${isCargos ? "active" : ""}`}
                onClick={() => navigate("/cargos")}
              >
                <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                Cargos
              </button>
            </>
          )}

          <div style={{ height: "1px", background: "var(--glass-border)", margin: "8px 0" }} />

          {(cargo?.editarPagina || cargo?.gerenciarUsuarios) && (
            <button
              type="button"
              className={`nav-button ${isConfiguracoes ? "active" : ""}`}
              onClick={() => navigate("/configuracoes")}
            >
              <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} /></svg>
              Configurações
            </button>
          )}

          {cargo?.editarPagina && (
            <Link to={showcaseEditorLink} className={`nav-button ${location.pathname.includes('/editar') ? 'active' : ''}`} style={{ textDecoration: "none" }}>
              <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              Editar vitrine
            </Link>
          )}

          <Link to={showcaseLink} className="nav-button" target="_blank" style={{ textDecoration: "none" }}>
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            Ver página
          </Link>
        </nav>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column" }}>
          <button type="button" className="nav-button" onClick={onLogout} style={{ marginBottom: "16px" }}>
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Encerrar Sessão
          </button>

          <div className="user-profile" style={{ marginTop: 0 }}>
            <div className="avatar">{userInitial}</div>
            <div className="user-details">
              <span className="user-name">{session?.usuario?.nome}</span>
              <span className="user-role">{session?.usuario?.cargo?.descricao || "Operador"}</span>
            </div>
          </div>
        </div>
      </aside>

      <main className={`main-content${isShowcaseEditor ? " main-content--editor-vitrine" : ""}`}>
        <div key={location.pathname} style={{ animation: "chicEntrance 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards" }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
