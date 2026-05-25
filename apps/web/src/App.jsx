import { useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { api, setApiToken } from "./api";
import { DashboardPage } from "./pages/DashboardPage";
import { LeadsPage } from "./pages/LeadsPage";
import { LoginPage } from "./pages/LoginPage";
import { PropertyInsightsPage } from "./pages/PropertyInsightsPage";
import { ShowcaseEditorPage } from "./pages/ShowcaseEditorPage";
import { ShowcasePropertyPage } from "./pages/ShowcasePropertyPage";
import { ShowcasePage } from "./pages/ShowcasePage";
import { AdminLayout } from "./components/AdminLayout";
import { CargosPage } from "./pages/CargosPage";
import { ConfiguracaoPage } from "./pages/ConfiguracaoPage";
import { TiposImovelPage } from "./pages/TiposImovelPage";
import { UsuariosPage } from "./pages/UsuariosPage";
import { clearSession, loadSession, saveSession } from "./session";

export default function App() {
  const [session, setSession] = useState(() => {
    const s = loadSession();
    if (s?.token) setApiToken(s.token);
    return s;
  });
  const location = useLocation();
  const DEFAULT_PUBLIC_SHOWCASE = "/vitrine/imobiliaria-centro";

  useEffect(() => {
    setApiToken(session?.token || null);
  }, [session]);

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

      <Route
        element={
          session && canAccessTenantPanel ? (
            <AdminLayout session={session} onLogout={handleLogout} />
          ) : (
            <Navigate to={session ? defaultPublicPath : "/login"} replace />
          )
        }
      >
        <Route path="/" element={<DashboardPage session={session} />} />
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
          cargo?.gerenciarUsuarios
            ? <CargosPage session={session} onSessionUpdate={handleSessionUpdate} />
            : <Navigate to={defaultPublicPath} replace />
        } />
        <Route path="/tipos-imovel" element={
          cargo?.gerenciarImoveis
            ? <TiposImovelPage session={session} />
            : <Navigate to={defaultPublicPath} replace />
        } />
        <Route path="/configuracoes" element={
          cargo?.editarPagina || cargo?.gerenciarUsuarios
            ? <ConfiguracaoPage session={session} />
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
