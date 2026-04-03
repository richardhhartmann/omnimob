import { useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { PropertyInsightsPage } from "./pages/PropertyInsightsPage";
import { ShowcaseEditorPage } from "./pages/ShowcaseEditorPage";
import { ShowcasePropertyPage } from "./pages/ShowcasePropertyPage";
import { ShowcasePage } from "./pages/ShowcasePage";
import { AdminLayout } from "./components/AdminLayout";
import { clearSession, loadSession, saveSession } from "./session";

export default function App() {
  const [session, setSession] = useState(() => loadSession());
  const location = useLocation();
  const DEFAULT_PUBLIC_SHOWCASE = "/vitrine/imobiliaria-centro";

  function handleLogin(nextSession) {
    saveSession(nextSession);
    setSession(nextSession);
  }

  function handleLogout() {
    clearSession();
    setSession(null);
  }

  const isAdmin = session?.user?.role === "ADMIN";
  const isShowcaseEditor = session?.user?.role === "SHOWCASE_EDITOR";
  const canAccessTenantPanel = isAdmin || isShowcaseEditor;
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
        <Route path="/vitrine/:tenantSlug/editar" element={<ShowcaseEditorPage session={session} onSessionUpdate={setSession} />} />
        <Route path="/imoveis/:propertyId" element={<PropertyInsightsPage session={session} />} />
      </Route>

      <Route path="*" element={<Navigate to={defaultPublicPath} replace />} />
    </Routes>
  );
}