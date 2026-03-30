import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { PropertyInsightsPage } from "./pages/PropertyInsightsPage";
import { ShowcaseEditorPage } from "./pages/ShowcaseEditorPage";
import { ShowcasePropertyPage } from "./pages/ShowcasePropertyPage";
import { ShowcasePage } from "./pages/ShowcasePage";
import { clearSession, loadSession, saveSession } from "./session";

export default function App() {
  const [session, setSession] = useState(() => loadSession());
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
    <Routes>
      <Route
        path="/login"
        element={
          session ? <Navigate to={canAccessTenantPanel ? "/" : defaultPublicPath} replace /> : <LoginPage onLogin={handleLogin} />
        }
      />
      <Route
        path="/"
        element={
          session && canAccessTenantPanel ? (
            <DashboardPage session={session} onLogout={handleLogout} />
          ) : (
            <Navigate to={defaultPublicPath} replace />
          )
        }
      />
      <Route
        path="/vitrine/:tenantSlug/editar"
        element={
          session && canAccessTenantPanel ? (
            <ShowcaseEditorPage session={session} onLogout={handleLogout} onSessionUpdate={setSession} />
          ) : (
            <Navigate to={session ? defaultPublicPath : "/login"} replace />
          )
        }
      />
      <Route
        path="/imoveis/:propertyId"
        element={
          session && isAdmin ? (
            <PropertyInsightsPage session={session} />
          ) : (
            <Navigate to={session ? defaultPublicPath : "/login"} replace />
          )
        }
      />
      <Route path="/vitrine/:tenantSlug" element={<ShowcasePage />} />
      <Route path="/vitrine/:tenantSlug/imovel/:propertyId" element={<ShowcasePropertyPage />} />
      <Route path="*" element={<Navigate to={defaultPublicPath} replace />} />
    </Routes>
  );
}
