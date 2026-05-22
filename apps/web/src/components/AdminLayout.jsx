import { useMemo } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";


export function AdminLayout({ session, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const tenantSlug = session?.tenant?.slug || "";
  const initialLetter = session?.tenant?.name?.charAt(0)?.toUpperCase() || "D";
  const userInitial = session?.user?.name?.charAt(0)?.toUpperCase() || "U";

  const showcaseLink = useMemo(() => (tenantSlug ? `/vitrine/${tenantSlug}` : "#"), [tenantSlug]);
  const showcaseEditorLink = useMemo(() => (tenantSlug ? `/vitrine/${tenantSlug}/editar` : "#"), [tenantSlug]);

  const isDashboard = location.pathname === "/";
  const isLeads = location.pathname === "/leads";
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
            className={`nav-button ${isDashboard && activeTab === "create" ? "active" : ""}`}
            onClick={() => navigate("/?tab=create")}
          >
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Cadastrar Ativo
          </button>

          <button
            type="button"
            className={`nav-button ${isDashboard && activeTab === "list" ? "active" : ""}`}
            onClick={() => navigate("/?tab=list")}
          >
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            Portfólio Ativo
          </button>

          <button
            type="button"
            className={`nav-button ${isLeads ? "active" : ""}`}
            onClick={() => navigate("/leads")}
          >
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Leads
          </button>

          <div style={{ height: "1px", background: "var(--glass-border)", margin: "8px 0" }} />

          <Link to={showcaseEditorLink} className={`nav-button ${location.pathname.includes('/editar') ? 'active' : ''}`}>
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            Editar página
          </Link>

          <Link to={showcaseLink} className="nav-button" target="_blank">
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            Acessar página
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
              <span className="user-name">{session?.user?.name}</span>
              <span className="user-role">Operador de Conta</span>
            </div>
          </div>
        </div>
      </aside>

      <main className={`main-content${isShowcaseEditor ? " main-content--editor-vitrine" : ""}`}>
        <div key={location.pathname + location.search} style={{ animation: "chicEntrance 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards" }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}