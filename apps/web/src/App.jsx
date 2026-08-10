import { useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { api, setApiToken, setAdminToken } from "./api";
import { initPointerGradient } from "./utils/pointerGradient";
import { DashboardPage, ImovelListPage, ImovelFormPage } from "./pages/DashboardPage";
import { LeadsPage } from "./pages/LeadsPage";
import { LoginPage } from "./pages/LoginPage";
import { PropertyInsightsPage } from "./pages/PropertyInsightsPage";
import { ShowcaseEditorPage } from "./pages/ShowcaseEditorPage";
import { ShowcasePropertyPage } from "./pages/ShowcasePropertyPage";
import { ShowcasePage } from "./pages/ShowcasePage";
import { TrialConfirmarPage } from "./pages/TrialConfirmarPage";
import { AdminLayout } from "./components/AdminLayout";
import { CargosPage } from "./pages/CargosPage";
import { ClientesPage } from "./pages/ClientesPage";
import { ConfiguracaoPage } from "./pages/ConfiguracaoPage";
import { TiposImovelPage } from "./pages/TiposImovelPage";
import { UsuariosPage } from "./pages/UsuariosPage";
import { clearSession, loadSession, saveSession } from "./session";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { SuperAdminPage } from "./pages/SuperAdminPage";
import { OmnimobLandingPage } from "./pages/OmnimobLandingPage";
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

  // Realce/gradiente dos botões seguindo o ponteiro (estilo Windows).
  useEffect(() => initPointerGradient(), []);

  useEffect(() => {
    setAdminToken(adminSession?.token || null);
  }, [adminSession]);

  // Navegação SPA: ao trocar de rota, volta ao topo (salvo quando a URL traz
  // uma âncora #seção — aí a página de destino cuida de rolar até ela).
  useEffect(() => {
    if (!location.hash) window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);

  /* Entrada do painel logo depois do login.

     A classe fica só durante a animação e depois sai: enquanto ela vale, o
     invólucro tem `transform`, e um transform diferente de `none` vira bloco
     de contenção — elementos `position: fixed` (toasts, modais) passariam a se
     posicionar por ele em vez de pela viewport. */
  const [entrando, setEntrando] = useState(false);
  useEffect(() => {
    if (!entrando) return undefined;
    const t = setTimeout(() => setEntrando(false), 800);
    return () => clearTimeout(t);
  }, [entrando]);

  /* O invólucro é sempre renderizado, mesmo sem a classe. Se ele aparecesse e
     sumisse, o tipo do elemento naquela posição mudaria de <div> para o próprio
     painel, e o React desmontaria e remontaria a árvore inteira ao fim da
     animação — perdendo estado e refazendo as requisições. */
  function comEntrada(node) {
    return <div className={entrando ? "authx-in" : undefined}>{node}</div>;
  }

  function handleAdminLogin(next) {
    saveAdminSession(next);
    setAdminSession(next);
    setEntrando(true);
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
    setEntrando(true);
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
      {/* Destino do link mágico do teste grátis: público e sem sessão. */}
      <Route path="/comecar" element={<TrialConfirmarPage />} />

      <Route path="/vitrine/:tenantSlug" element={<ShowcasePage />} />
      <Route path="/vitrine/:tenantSlug/imovel/:propertyId" element={<ShowcasePropertyPage />} />

      {/* Painel super-admin da Omnimob (sessão independente do tenant) */}
      <Route
        path="/admin/login"
        element={adminSession ? <Navigate to="/admin" replace /> : <AdminLoginPage onLogin={handleAdminLogin} />}
      />
      <Route
        path="/admin"
        element={adminSession ? comEntrada(<SuperAdminPage session={adminSession} onLogout={handleAdminLogout} />) : <Navigate to="/admin/login" replace />}
      />

      {/* Raiz + painel: UM layout só, de propósito.
          Havia duas rotas de layout — uma para "/" e outra para o resto —, e
          cada uma montava o seu próprio <AdminLayout>. Ir do Início para
          qualquer outra tela trocava de branch, e o React desmontava o painel
          inteiro e montava outro: sidebar recolhida voltava, o badge de leads
          refazia a busca, toasts sumiam no meio e o tour guiado morria na
          primeira troca de página (ele vive dentro do layout).
          É o mesmo motivo do invólucro sempre presente em `comEntrada`, uma
          camada acima — mudar o tipo do elemento naquela posição remonta tudo.

          Visitante continua caindo onde caía: landing na raiz, login no resto. */}
      <Route
        element={
          session && canAccessTenantPanel ? (
            comEntrada(<AdminLayout session={session} onLogout={handleLogout} onSessionUpdate={handleSessionUpdate} />)
          ) : session ? (
            <Navigate to={defaultPublicPath} replace />
          ) : location.pathname === "/" ? (
            <OmnimobLandingPage />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route path="/" element={<DashboardPage session={session} />} />
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
        <Route path="/imoveis/editar" element={
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
          cargo?.gerenciarImoveis && cargo?.verRelatorios
            ? <PropertyInsightsPage session={session} />
            : <Navigate to={defaultPublicPath} replace />
        } />
      </Route>

      <Route path="*" element={<Navigate to={defaultPublicPath} replace />} />
    </Routes>
  );
}
