import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { api, setApiToken, setAdminToken } from "./api";
import { initPointerGradient } from "./utils/pointerGradient";
import { DashboardPage, ImovelListPage, ImovelFormPage } from "./pages/DashboardPage";
import { LeadsPage } from "./pages/LeadsPage";
import { RelatoriosPage } from "./pages/RelatoriosPage";
import { LoginPage } from "./pages/LoginPage";
import { PropertyInsightsPage } from "./pages/PropertyInsightsPage";
import { ShowcasePropertyPage } from "./pages/ShowcasePropertyPage";
import { ShowcasePage } from "./pages/ShowcasePage";
import { TrialConfirmarPage } from "./pages/TrialConfirmarPage";
import { RecuperarSenhaPage } from "./pages/RecuperarSenhaPage";
import { AdminLayout } from "./components/AdminLayout";
import { CargosPage } from "./pages/CargosPage";
import { AuditoriaPage } from "./pages/AuditoriaPage.jsx";
import { ClientesPage } from "./pages/ClientesPage";
import { ConfiguracaoPage } from "./pages/ConfiguracaoPage";
import { TiposImovelPage } from "./pages/TiposImovelPage";
import { UsuariosPage } from "./pages/UsuariosPage";
import { clearSession, loadSession, saveSession } from "./session";
import { ContaSuspensaPage } from "./pages/ContaSuspensaPage";
import { ehDominioDaOmnimob, slugDoDominioAtual } from "./utils/dominioVitrine";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { clearAdminSession, loadAdminSession, saveAdminSession } from "./adminSession";
import { LimiteDeErro } from "./components/LimiteDeErro.jsx";

/* ── Divisão por rota ────────────────────────────────────────────────────────
   Tudo vivia num pacote só: quem abria a landing baixava o formulário de
   imóvel, o editor de vitrine e o painel inteiro antes de ver a primeira
   palavra. Em máquina fraca isso não é só download — é a linha principal
   travada interpretando megabytes de JavaScript que aquela pessoa não vai usar.

   As três famílias abaixo NUNCA aparecem juntas na mesma sessão:
     · a landing é para quem ainda não é cliente;
     · o editor de vitrine é uma tela inteira, aberta de propósito;
     · o super-admin é a Omnimob olhando os clientes dela.

   O resto do painel fica junto de propósito: são telas que a mesma pessoa
   percorre na mesma sessão, e fatiá-las trocaria um download grande por doze
   esperas pequenas no meio da navegação. */
const OmnimobLandingPage = lazy(() =>
  import("./pages/OmnimobLandingPage").then((m) => ({ default: m.OmnimobLandingPage })));
const ShowcaseEditorPage = lazy(() =>
  import("./pages/ShowcaseEditorPage").then((m) => ({ default: m.ShowcaseEditorPage })));
const SuperAdminPage = lazy(() =>
  import("./pages/SuperAdminPage").then((m) => ({ default: m.SuperAdminPage })));

/* As páginas públicas fora da landing: termos, privacidade, sobre, contato e a
   galeria de vitrines. Carregadas sob demanda e SEPARADAS da landing — quem
   abre a Política de Privacidade não deve baixar a página de vendas inteira
   para ler um texto. Ver `components/PaginaPublica.jsx`. */
const TermosPage = lazy(() =>
  import("./pages/publicas/TermosPage.jsx").then((m) => ({ default: m.TermosPage })));
const PrivacidadePage = lazy(() =>
  import("./pages/publicas/PrivacidadePage.jsx").then((m) => ({ default: m.PrivacidadePage })));
const SobrePage = lazy(() =>
  import("./pages/publicas/SobrePage.jsx").then((m) => ({ default: m.SobrePage })));
const ContatoPage = lazy(() =>
  import("./pages/publicas/ContatoPage.jsx").then((m) => ({ default: m.ContatoPage })));
const VitrinesPage = lazy(() =>
  import("./pages/publicas/VitrinesPage.jsx").then((m) => ({ default: m.VitrinesPage })));

/* Enquanto o pedaço desce. Fundo sólido e nada mais: a landing tem tela de
   abertura própria (`OmnimobSplash`), e um segundo indicador antes dela seria
   duas esperas encavaladas para o mesmo carregamento. */
function Carregando() {
  return <div style={{ minHeight: "100vh", background: "#0a0a0b" }} aria-busy="true" />;
}

export default function App() {
  const [session, setSession] = useState(() => {
    const s = loadSession();
    if (s?.token) setApiToken(s.token);
    return s;
  });
  const location = useLocation();
  const navegar = useNavigate();
  const DEFAULT_PUBLIC_SHOWCASE = "/vitrine/imobiliaria-centro";

  /* ─── Vitrine em domínio próprio ────────────────────────────────────────────
     Quando a imobiliária traz o domínio dela, a página abre em
     `imobiliaria.com.br/` — sem slug em lugar nenhum da URL. O host é a única
     pista de quem é aquela vitrine, e a tradução host → slug é a primeira coisa
     que este componente faz.

     `undefined` = ainda perguntando · `null` = é endereço da Omnimob ou não há
     vitrine aqui · string = slug do dono. A distinção importa: renderizar a
     landing enquanto a resposta não chegou faria a vitrine do cliente piscar a
     página da Omnimob antes de aparecer. Em domínio da Omnimob a função nem vai
     à rede, então essa espera não existe no caminho comum. */
  const [slugDoDominio, setSlugDoDominio] = useState(() =>
    ehDominioDaOmnimob() ? null : undefined,
  );

  useEffect(() => {
    if (slugDoDominio !== undefined) return;
    let vivo = true;
    slugDoDominioAtual().then((s) => { if (vivo) setSlugDoDominio(s); });
    return () => { vivo = false; };
  }, [slugDoDominio]);

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
      /* A sessão de uma conta SUSPENSA não passa por aqui.

         Ela tem escopo reduzido: alcança ver a situação e assinar, e o
         `authMiddleware` recusa o resto com 403 — de propósito. Só que o 403 é
         justamente o que este efeito trata como "sessão morta, derruba".

         O resultado era absurdo de ver: a pessoa abria a parede de reativação,
         dava um alt+tab, a janela recuperava o foco, este efeito perguntava por
         `/auth/me`, levava o 403 previsto e a mandava para o login. O caminho
         de recuperar a conta se auto-destruía a cada troca de janela.

         E não há o que reler aqui: o cargo dela veio no login e não vai mudar
         enquanto a conta estiver suspensa. */
      if (s.suspenso) return;
      api.getMe(s.tenant.slug)
        .then((usuario) => {
          /* A sessão pode ter acabado enquanto esta resposta vinha.

             Sem esta guarda, sair da conta com um `getMe` em voo ressuscitava
             a sessão: a resposta chegava depois do logout e o `.then` gravava
             tudo de volta no localStorage e no estado — a pessoa era devolvida
             ao painel e tinha que sair de novo. Como este efeito também roda a
             cada foco da janela, e a API leva segundos, a corrida acontecia
             sempre.

             Comparar o token resolve: se ele mudou (ou sumiu), esta resposta é
             de uma sessão que não existe mais e deve ser descartada. */
          if (sessionRef.current?.token !== s.token) return;
          const next = { ...s, usuario };
          saveSession(next);
          setSession(next);
        })
        .catch((err) => {
          /* 403 aqui significa uma coisa só: o token guardado é de OUTRO tenant
             (o `requireTenant` compara o slug enviado com o tenantId do token).
             Acontece ao trocar de imobiliária na mesma máquina — provisionar um
             tenant novo e entrar nele, por exemplo.

             Engolir esse erro deixava o painel de pé com uma sessão morta: cada
             tela pedia seus dados e recebia 403, então nada carregava, nenhum
             modal aparecia e a única pista era o console. Melhor derrubar a
             sessão e mandar para o login, que é o que a pessoa faria de qualquer
             jeito depois de dez minutos achando que o sistema quebrou.

             Só no 403 genérico: 401 sem marca pode ser token expirado com
             renovação em curso, e falha de rede não diz nada sobre a validade
             da sessão. */
          // Mesma guarda: 403 de uma sessão que já foi embora não derruba a
          // sessão nova de quem acabou de entrar com outra conta.
          const daSessaoAtual = sessionRef.current?.token === s.token;
          if (!daSessaoAtual) return;

          /* Acesso RETIRADO enquanto a pessoa usava o painel: o usuário foi
             desativado, mudou de imobiliária, ou a conta foi desligada. A API
             marca esses casos (`sessaoEncerrada`, `contaInativa`) exatamente
             para o painel poder distinguir de um 401 comum e dizer o motivo —
             antes, o acesso continuava valendo por até sete dias e essa
             situação simplesmente não existia. Ver `authMiddleware.js`. */
          const motivo =
            err?.body?.sessaoEncerrada ? "acesso-revogado" :
            err?.body?.contaInativa ? "conta-inativa" : null;

          if (motivo) {
            clearSession();
            setSession(null);
            navegarParaLogin(motivo);
            return;
          }

          if (err?.status === 403) {
            clearSession();
            setSession(null);
          }
        });
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
    /* Sair do painel leva ao LOGIN, e não à vitrine pública.

       Antes era só limpar a sessão: sem ela, a rota protegida caía no
       `defaultPublicPath` e a pessoa aterrissava na vitrine da própria
       imobiliária — a página dos CLIENTES dela. Quem clica em "Encerrar sessão"
       ou está indo embora, ou vai entrar com outra conta; nos dois casos o
       destino é a porta, não a vitrine.

       `replace` para o botão Voltar não devolver ao painel já deslogado, que
       só quicaria de volta. O `motivo` é lido uma vez pela tela de login e
       descartado — ver `LoginPage`. */
    clearSession();
    setSession(null);
    navegarParaLogin("sessao-encerrada");
  }

  /* Um caminho só para a porta de saída. Três situações levam a ela — sair por
     vontade própria, ter o acesso retirado e a conta ser desligada — e as três
     precisam do mesmo `replace` e do mesmo recado no state. */
  function navegarParaLogin(motivo) {
    navegar("/login", { replace: true, state: { motivo } });
  }

  const cargo = session?.usuario?.cargo;
  const canAccessTenantPanel = Boolean(cargo?.acessarPainel || cargo?.editarPagina);
  const defaultPublicPath = session?.tenant?.slug ? `/vitrine/${session.tenant.slug}` : DEFAULT_PUBLIC_SHOWCASE;

  /* ── Conta suspensa: a parede antes de qualquer rota ──────────────────────
     A sessão de uma conta vencida vem marcada com `suspenso`. Ela alcança duas
     rotas no servidor — ver a situação e assinar — e mais nada; o painel não é
     montado aqui de propósito, e não por falta de dados: montar telas que só
     dariam 403 mostraria uma interface quebrando aos poucos, sem nunca dizer o
     motivo.

     Vem ANTES da resolução de domínio porque não depende dela: quem chegou com
     esta sessão chegou pelo painel. */
  if (session?.suspenso) {
    return <ContaSuspensaPage session={session} onLogout={handleLogout} />;
  }

  // Ainda perguntando de quem é este domínio: não decide nada antes da resposta.
  if (slugDoDominio === undefined) {
    return <div style={{ minHeight: "100vh", background: "#0f172a" }} />;
  }

  /* Domínio da imobiliária: o site inteiro É a vitrine dela. As rotas do
     produto (login, painel, editor) não existem aqui — quem entra por este
     endereço é cliente da imobiliária, não usuário da Omnimob, e qualquer
     caminho desconhecido volta para a home da vitrine em vez de oferecer um
     login que não faz sentido nenhum para ele. */
  if (slugDoDominio) {
    return (
      <Routes location={location}>
        <Route path="/" element={<ShowcasePage slugFixo={slugDoDominio} />} />
        <Route path="/imovel/:propertyId" element={<ShowcasePropertyPage slugFixo={slugDoDominio} />} />
        {/* Os links internos da vitrine ainda montam `/vitrine/:slug/imovel/:id`
            — é o caminho que existe nos endereços da Omnimob. Aceitá-los aqui
            evita que navegar para um imóvel caia no catch-all e volte para a
            home. O canonical continua sendo o caminho curto. */}
        <Route path="/vitrine/:tenantSlug" element={<ShowcasePage slugFixo={slugDoDominio} />} />
        <Route
          path="/vitrine/:tenantSlug/imovel/:propertyId"
          element={<ShowcasePropertyPage slugFixo={slugDoDominio} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    /* Uma fronteira só, no topo: as três rotas tardias estão em ramos
       diferentes da árvore, e cercar cada uma daria três fallbacks para uma
       espera que nunca acontece em paralelo. */
    /* A barreira envolve o Suspense, e não o contrário: o que pode falhar é o
       DOWNLOAD do pedaço, e essa falha chega como promessa rejeitada — o
       Suspense não a captura, ele só espera. Sem a barreira por fora, o erro
       sobe e desmonta a árvore inteira: tela branca sem saída. */
    <LimiteDeErro>
    <Suspense fallback={<Carregando />}>
    <Routes location={location}>
      <Route
        path="/login"
        element={
          session ? <Navigate to={canAccessTenantPanel ? "/" : defaultPublicPath} replace /> : <LoginPage onLogin={handleLogin} />
        }
      />
      {/* Destino do link mágico do teste grátis: público e sem sessão. */}
      <Route path="/comecar" element={<TrialConfirmarPage />} />

      {/* Recuperação de senha. Dois caminhos para a MESMA página: `/recuperar-
          senha` pede o link, `/redefinir-senha?token=…` é para onde o e-mail
          aponta. Separá-los em componentes faria a segunda tela precisar de um
          jeito próprio de voltar para a primeira quando o link expira.

          Públicas por definição: quem esqueceu a senha não tem sessão. E sem o
          `session ?` do login — quem está logado e clicou no link do e-mail
          quer trocar a senha, não ser mandado de volta ao painel. */}
      {/* Públicas e independentes de sessão: quem está logado também precisa
          conseguir ler os termos sem ser jogado para o painel. */}
      <Route path="/termos" element={<TermosPage />} />
      <Route path="/privacidade" element={<PrivacidadePage />} />
      <Route path="/sobre" element={<SobrePage />} />
      <Route path="/contato" element={<ContatoPage />} />
      <Route path="/vitrines" element={<VitrinesPage />} />

      <Route path="/recuperar-senha" element={<RecuperarSenhaPage onLogin={handleLogin} />} />
      <Route path="/redefinir-senha" element={<RecuperarSenhaPage onLogin={handleLogin} />} />

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
        {/* ── Imóveis ───────────────────────────────────────────────────────
            Cada endereço diz o que a tela é, e é isso que mudou aqui.

            Antes, "Gerenciar Imóveis" — o índice de cartões — morava em
            `/imoveis/novo`, e o formulário só aparecia com `?ver=novo` grudado
            atrás. Quem olhava a barra do navegador lia "novo" numa tela que não
            cadastra nada, e o link do formulário carregava um parâmetro que
            repetia o que o caminho já dizia.

            A lista, que ocupava `/imoveis`, passa a ter nome próprio:
            `/imoveis/portfolio`. É ela que os botões "Ver portfólio", "Voltar" e
            o atalho da tela inicial procuram — todos foram atualizados junto.

            `/imoveis/portfolio` vem antes de `/imoveis/:propertyId` por clareza;
            o roteador já prefere o trecho literal ao parâmetro, mas ler as duas
            linhas na ordem em que se resolvem poupa a dúvida. */}
        <Route path="/imoveis" element={
          cargo?.gerenciarImoveis
            ? <ImovelFormPage session={session} />
            : <Navigate to={defaultPublicPath} replace />
        } />
        <Route path="/imoveis/novo" element={
          cargo?.gerenciarImoveis
            ? <ImovelFormPage session={session} />
            : <Navigate to={defaultPublicPath} replace />
        } />
        <Route path="/imoveis/portfolio" element={
          cargo?.gerenciarImoveis
            ? <ImovelListPage session={session} />
            : <Navigate to={defaultPublicPath} replace />
        } />
        <Route path="/imoveis/editar" element={
          cargo?.gerenciarImoveis
            ? <ImovelFormPage session={session} />
            : <Navigate to={defaultPublicPath} replace />
        } />
        {/* "Relatórios" reúne leads, relatório mensal, funil e comissões.
            /leads continua respondendo (redireciona) porque havia link para ele
            no menu, no badge e em tours — quebrar endereço antigo por
            renomeação de tela é o tipo de coisa que só aparece semanas depois. */}
        <Route path="/relatorios" element={
          cargo?.verRelatorios
            ? <RelatoriosPage session={session} />
            : <Navigate to={defaultPublicPath} replace />
        } />
        <Route path="/leads" element={<Navigate to="/relatorios" replace />} />
        <Route path="/usuarios" element={
          cargo?.gerenciarUsuarios
            ? <UsuariosPage session={session} />
            : <Navigate to={defaultPublicPath} replace />
        } />
        {/* Só leitura, e só para quem tem `verAuditoria` — que nasce apenas no
            cargo Administrador. A trilha mostra a movimentação de todo mundo,
            inclusive de quem administra a conta. */}
        <Route path="/auditoria" element={
          cargo?.verAuditoria
            ? <AuditoriaPage session={session} />
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
          cargo?.verConfiguracoes
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
    </Suspense>
    </LimiteDeErro>
  );
}
