import { useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { api, setApiToken, setAdminToken } from "./api";
import { DashboardPage, ImovelListPage, ImovelFormPage } from "./pages/DashboardPage";
import { LeadsPage } from "./pages/LeadsPage";
import { LoginPage } from "./pages/LoginPage";
import { PropertyInsightsPage } from "./pages/PropertyInsightsPage";
import { ShowcaseEditorPage } from "./pages/ShowcaseEditorPage";
import { ShowcasePropertyPage } from "./pages/ShowcasePropertyPage";
import { ShowcasePage } from "./pages/ShowcasePage";
import { AdminLayout } from "./components/AdminLayout";
import { CargosPage } from "./pages/CargosPage";
import { ClientesPage } from "./pages/ClientesPage";
import { ConfiguracaoPage } from "./pages/ConfiguracaoPage";
import { TiposImovelPage } from "./pages/TiposImovelPage";
import { UsuariosPage } from "./pages/UsuariosPage";
import { clearSession, loadSession, saveSession } from "./session";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { SuperAdminPage } from "./pages/SuperAdminPage";
import { DomusLandingPage } from "./pages/DomusLandingPage";
import { clearAdminSession, loadAdminSession, saveAdminSession } from "./adminSession";

export default function App() {
  const [session, setSession] = useState(() => {
    const s = loadSession();
    if (s?.token) setApiToken(s.token);
    return s;
  });
  const location = useLocation();
  const DEFAULT_PUBLIC_SHOWCASE = "/vitrine/imobiliaria-centro";

  const [adminSession, setAdminSession] = useState(() => {
    const a = loadAdminSession();
    if (a?.token) setAdminToken(a.token);
    return a;
  });

  useEffect(() => {
    setApiToken(session?.token || null);
  }, [session]);

  useEffect(() => {
    setAdminToken(adminSession?.token || null);
  }, [adminSession]);

  // Navegação SPA: ao trocar de rota, volta ao topo (salvo quando a URL traz
  // uma âncora #seção — aí a página de destino cuida de rolar até ela).
  useEffect(() => {
    if (!location.hash) window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);

  function handleAdminLogin(next) {
    saveAdminSession(next);
    setAdminSession(next);
  }
  function handleAdminLogout() {
    clearAdminSession();
    setAdminToken(null);
    setAdminSession(null);
  }

  // Mantém referência estável à sessão para usar dentro de event listeners
  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);

  // Busca permissões frescas do servidor (no mount e ao focar a janela)
  useEffect(() => {
    function refreshPermissoes() {
      const s = sessionRef.current;
      if (!s?.token || !s?.tenant?.slug) return;
      api.getMe(s.tenant.slug)
        .then((usuario) => {
          const next = { ...s, usuario };
          saveSession(next);
          setSession(next);
        })
        .catch(() => {});
    }

    refreshPermissoes();
    window.addEventListener("focus", refreshPermissoes);
    return () => window.removeEventListener("focus", refreshPermissoes);
  }, []); // roda uma vez — usa ref para acessar sessão atual

  function handleLogin(nextSession) {
    saveSession(nextSession);
    setSession(nextSession);
  }

  function handleSessionUpdate(nextSession) {
    saveSession(nextSession);
    setSession(nextSession);
  }

  function handleLogout() {
    clearSession();
    setSession(null);
  }

  const cargo = session?.usuario?.cargo;
  const canAccessTenantPanel = Boolean(cargo?.acessarPainel || cargo?.editarPagina);
  const defaultPublicPath = session?.tenant?.slug ? `/vitrine/${session.tenant.slug}` : DEFAULT_PUBLIC_SHOWCASE;

  return (
    <Routes location={location}>
      <Route
        path="/login"
        element={
          session ? <Navigate to={canAccessTenantPanel ? "/" : defaultPublicPath} replace /> : <LoginPage onLogin={handleLogin} />
        }
      />
      <Route path="/vitrine/:tenantSlug" element={<ShowcasePage />} />
      <Route path="/vitrine/:tenantSlug/imovel/:propertyId" element={<ShowcasePropertyPage />} />

      {/* Painel super-admin da Domus (sessão independente do tenant) */}
      <Route
        path="/admin/login"
        element={adminSession ? <Navigate to="/admin" replace /> : <AdminLoginPage onLogin={handleAdminLogin} />}
      />
      <Route
        path="/admin"
        element={adminSession ? <SuperAdminPage session={adminSession} onLogout={handleAdminLogout} /> : <Navigate to="/admin/login" replace />}
      />

      {/* Raiz: landing da Domus para visitantes; dashboard para tenant logado */}
      <Route
        element={
          session && canAccessTenantPanel ? (
            <AdminLayout session={session} onLogout={handleLogout} />
          ) : session ? (
            <Navigate to={defaultPublicPath} replace />
          ) : (
            <DomusLandingPage />
          )
        }
      >
        <Route path="/" element={<DashboardPage session={session} />} />
      </Route>

      <Route
        element={
          session && canAccessTenantPanel ? (
            <AdminLayout session={session} onLogout={handleLogout} />
          ) : (
            <Navigate to={session ? defaultPublicPath : "/login"} replace />
          )
        }
      >
        <Route path="/imoveis" element={
          cargo?.gerenciarImoveis
            ? <ImovelListPage session={session} />
            : <Navigate to={defaultPublicPath} replace />
        } />
        <Route path="/imoveis/novo" element={
          cargo?.gerenciarImoveis
            ? <ImovelFormPage session={session} />
            : <Navigate to={defaultPublicPath} replace />
        } />
        <Route path="/leads" element={
          cargo?.gerenciarLeads
            ? <LeadsPage session={session} />
            : <Navigate to={defaultPublicPath} replace />
        } />
        <Route path="/usuarios" element={
          cargo?.gerenciarUsuarios
            ? <UsuariosPage session={session} />
            : <Navigate to={defaultPublicPath} replace />
        } />
        <Route path="/cargos" element={
          cargo?.gerenciarCargos
            ? <CargosPage session={session} onSessionUpdate={handleSessionUpdate} />
            : <Navigate to={defaultPublicPath} replace />
        } />
        <Route path="/clientes" element={
          cargo?.gerenciarClientes
            ? <ClientesPage session={session} />
            : <Navigate to={defaultPublicPath} replace />
        } />
        <Route path="/tipos-imovel" element={
          cargo?.gerenciarImoveis
            ? <TiposImovelPage session={session} />
            : <Navigate to={defaultPublicPath} replace />
        } />
        <Route path="/configuracoes" element={
          cargo?.editarPagina || cargo?.gerenciarUsuarios
            ? <ConfiguracaoPage session={session} onSessionUpdate={handleSessionUpdate} />
            : <Navigate to={defaultPublicPath} replace />
        } />
        <Route path="/vitrine/:tenantSlug/editar" element={
          cargo?.editarPagina
            ? <ShowcaseEditorPage session={session} onSessionUpdate={setSession} />
            : <Navigate to={defaultPublicPath} replace />
        } />
        <Route path="/imoveis/:propertyId" element={
          cargo?.gerenciarImoveis
            ? <PropertyInsightsPage session={session} />
            : <Navigate to={defaultPublicPath} replace />
        } />
      </Route>

      <Route path="*" element={<Navigate to={defaultPublicPath} replace />} />
    </Routes>
  );
}
