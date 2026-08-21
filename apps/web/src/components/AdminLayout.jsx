import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { BotaoGoogle } from "./BotaoGoogle.jsx";
import { TrialAviso } from "./TrialAviso";
import { BoasVindasModal } from "./BoasVindasModal";
import { PulsoTrialModal } from "./PulsoTrialModal";
import { baseDaVitrine } from "../utils/enderecoVitrine";
import { planoInfo } from "../utils/planos";
import { relatoriosVisiveis, PARAMETRO_DE } from "../utils/relatorios";
import { PrimeiroAcessoTour } from "./PrimeiroAcessoTour";
import { TourDeTela } from "./TourDeTela";
import { AjudaModal } from "./AjudaModal";
import { corDeTextoPara } from "./adminUi";
import { montarTourDeTela, telaDaRota } from "../utils/tourTelas";
import { IconeRelatorios, ICONES_RELATORIOS } from "../utils/iconesRelatorios";
import { abasVisiveis } from "../utils/abasConfiguracoes";
import { podeImportar } from "./ImportadorDados.jsx";
import { SeloBeta } from "./SeloBeta.jsx";
import { MenuDoPerfil } from "./MenuDoPerfil.jsx";
import { ModalPreferencias, ModalMeusDados } from "./ModaisDoPerfil.jsx";
import { TEMAS, observarSistema, temaEfetivo, temaEscolhido } from "../utils/temaDoPainel";
import { lerDoTenant, CHAVES } from "../utils/chaveDoTenant";
import { useBrilhoDeBorda } from "../utils/brilhoDeBorda";
import { useAtalhos } from "./useAtalhos";
import { ProvedorDeAtalhos } from "./ContextoDeAtalhos.jsx";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  House,
  ChartPieSlice,
  Buildings,
  SquaresFour,
  Users,
  UserCircle,
  UserSquare,
  Shield,
  GearSix,
  PencilSimple,
  ArrowSquareOut,
  CheckCircle,
  XCircle,
  WarningCircle,
  PlusCircle,
  Tag,
  ClockCounterClockwise,
} from "@phosphor-icons/react";

/* ────────────────────────────────────────────────────────────────────────────
   Layout do painel do tenant (sidebar + conteúdo).

   A sidebar segue a mesma linguagem visual da landing — micro-labels em
   JetBrains Mono, itens com raio de 10px, estado ativo com borda de acento,
   separadores hairline — mas mantendo a paleta que ela já tinha (#0c0f1a,
   texto #64748b/#f1f5f9, ativo em indigo a 10%, avatar #4f46e5).

   IMPORTANTE: os estilos são escopados em `.ds-*` de propósito. O kit
   (`styles/omnimobKit.jsx`) traz um reset em `.dl-root` que vazaria pelo
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

/* Selo do plano contratado, no alto da sidebar.

   Fica ao lado do nome da imobiliária porque responde uma pergunta de
   identidade — "que Omnimob é esta?" — e não de navegação. Quem opera o painel
   precisa saber disso de relance: metade das telas esconde recurso por plano, e
   sem o selo a ausência de um botão parece defeito em vez de limite do plano. */
function SeloPlano({ plano }) {
  const info = planoInfo(plano);
  if (!info) return null;
  return (
    <span className="ds-plano" style={{ "--plano": info.cor }} title={`Plano ${info.nome}`}>
      {info.nome}
    </span>
  );
}

// ── Item de navegação ──────────────────────────────────────────────────────────
/* `tourId` vira `data-tour` no elemento. É o gancho que o tour guiado usa para
   achar o item — nomeado de propósito, em vez de seletor estrutural: um
   `.ds-nav > div:nth-child(3) a` quebraria calado no dia em que um grupo novo
   entrar no meio do menu. */
function NavItem({ Icon, label, active, onClick, href, collapsed, external, badge, tourId, beta }) {
  /* `has-beta` solta o rótulo do `flex: 1` para o selo sentar ENCOSTADO no
     nome, e não na borda direita do item. Na borda ele leria como o contador de
     leads, que é o outro elemento que mora ali. */
  const cls = `ds-item${active ? " is-active" : ""}${!collapsed && beta ? " has-beta" : ""}`;

  const content = (
    <>
      <span className="ds-item__icon">
        <Icon size={16} weight={active ? "fill" : "regular"} />
        {/* O pip é o contador na forma recolhida: ponto vermelho no canto do
            ícone, porque o número não cabe em 28px. Os dois no DOM, um visível
            de cada vez. */}
        {badge > 0 ? <span className="ds-item__pip" /> : null}
      </span>
      {/* Rótulo, selo e contador existem SEMPRE no DOM; quem os mostra é o CSS,
          conforme a barra esteja recolhida ou aberta pelo hover. O React não
          fica sabendo da entrada do ponteiro, e um estado só para isso traria
          de volta o re-render que a expansão por CSS evita. */}
      <span className="ds-item__label">{label}</span>
      {beta ? <SeloBeta /> : null}
      {badge > 0 ? (
        <span className="ds-item__badge">{badge > 99 ? "99+" : badge}</span>
      ) : null}
    </>
  );

  /* Endereço absoluto sai do domínio do painel — é o caso da vitrine em domínio
     próprio. `<Link>` faz navegação de rota e trataria "https://..." como
     caminho a resolver dentro do app; âncora comum é o que sai daqui de fato. */
  const externo = typeof href === "string" && /^https?:\/\//.test(href);

  const el = externo ? (
    <a href={href} className={cls} data-tour={tourId} target="_blank" rel="noreferrer">
      {content}
    </a>
  ) : href ? (
    <Link to={href} className={cls} data-tour={tourId} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
      {content}
    </Link>
  ) : (
    <button type="button" className={cls} data-tour={tourId} onClick={onClick}>
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
export function AdminLayout({ session, onLogout, onSessionUpdate }) {
  const location  = useLocation();
  const navigate  = useNavigate();
  const tenantSlug = session?.tenant?.slug  || "";
  /* O que identifica a imobiliária para o armazenamento local. NÃO é o slug —
     ele é reutilizável entre empresas ao longo do tempo. Ver
     `utils/chaveDoTenant.js` para o estrago que isso causava. */
  const tenantId   = session?.tenant?.id    || "";
  const tenantName = session?.tenant?.name  || "Omnimob";
  /* ── O retrato que a PESSOA vê de si ─────────────────────────────────────
     Com a conta Google vinculada, a moldura do painel passa a mostrar a foto e
     o nome de lá. Não é vaidade: o cadastro costuma trazer o nome funcional
     ("Administrador", "Recepção"), e o painel é o único lugar do produto onde
     quem está olhando é a própria pessoa.

     A precedência para AQUI, e só aqui. O cadastro segue intocado e continua
     sendo o que aparece na vitrine, nas listas e no widget de Equipe — vincular
     a conta pessoal de um corretor não pode trocar o nome dele na página
     pública da imobiliária. */
  const google      = session?.usuario?.google || null;
  const userFoto    = google?.foto || session?.usuario?.foto || "";
  const userName    = google?.nome || session?.usuario?.nome || "";
  const userInitial = userName.charAt(0)?.toUpperCase() || "U";
  const userRole    = session?.usuario?.cargo?.descricao || "Operador";
  const cargo       = session?.usuario?.cargo;

  /* A cor da imobiliária, publicada uma vez para tudo que fica embaixo do
     shell: o ladrilho da marca, o avatar do perfil e as iniciais das listas de
     leads, clientes, usuários e cargos. Como variável CSS e não como prop
     porque o `<Outlet/>` está a três níveis daqui — passar a cor de mão em mão
     até cada linha de lista seria plumbing para uma coisa que a cascata já
     sabe fazer. Ela acompanha a troca em Configurações: aquela tela chama
     `onSessionUpdate`, e a sessão é a fonte lida aqui. */
  const corPrimaria = session?.tenant?.primaryColor || "#4f46e5";
  const tintaPrimaria = corDeTextoPara(corPrimaria);

  /* ── O tema do painel ──────────────────────────────────────────────────────
     Duas fontes, e a ordem é a regra: a preferência da PESSOA ganha, e o tema
     da IMOBILIÁRIA é o padrão para quem nunca escolheu. `temaPainel` nulo é o
     que distingue "quero escuro" de "nunca opinei" — sem ele, o administrador
     não teria como definir um padrão sem passar por cima de quem já decidiu.

     `escolhido` é o que a pessoa quer ("auto" incluso); `efetivo` é o que a
     tela desenha. Os dois existem porque "auto" precisa continuar sendo "auto"
     quando gravado, e virar claro ou escuro só na hora de pintar. */
  const [temaPessoal, setTemaPessoal] = useState(() => session?.usuario?.temaPainel ?? null);
  const escolhido = temaEscolhido(temaPessoal, session?.tenant?.temaImobiliaria);
  const [efetivo, setEfetivo] = useState(() => temaEfetivo(escolhido));

  useEffect(() => { setEfetivo(temaEfetivo(escolhido)); }, [escolhido]);

  /* ── O tema também no <html> ──────────────────────────────────────────────
     Modais e tours (`tg-cartao`, `pt-caixa`, o convite do tour) são renderizados
     ANTES do `.ds-shell`, como irmãos dele — não como descendentes. Então o
     `data-tema` do shell não os alcança, e eles ficavam escuros sobre um painel
     claro.

     Um marcador na raiz resolve sem mover ninguém de lugar. Ele é limpo na
     saída porque a vitrine pública vive na mesma aplicação: navegar do painel
     para `/vitrine/...` deixaria o atributo pendurado, e a página do cliente
     passaria a responder a um tema que é do painel. */
  useEffect(() => {
    document.documentElement.dataset.temaPainel = efetivo;
    return () => { delete document.documentElement.dataset.temaPainel; };
  }, [efetivo]);

  /* ── O esmaecido entre um tema e outro ────────────────────────────────────
     A troca é instantânea porque ela é uma troca de TOKENS: o navegador
     recalcula tudo no mesmo quadro e a tela pisca de um estado ao outro.

     A marca fica na raiz do documento e vale por um terço de segundo. Nesse
     intervalo — e só nele — uma regra no styles.css põe transição de cor em
     tudo. Deixar essa transição sempre ligada seria pagar por ela em cada
     hover, cada foco, cada abertura de menu, e ainda atrasaria realces que
     precisam ser imediatos para parecerem resposta ao clique.

     Na RAIZ e não no shell porque a troca também alcança o que mora fora dele:
     o tour, os modais de trial, a lista aberta do SelectCustom (que sai por
     portal). Um deles ficando para trás estragaria o efeito inteiro.

     Reage a `efetivo`, e não a quem clicou: assim vale para o atalho do perfil,
     para Configurações › Aparência e para o sistema operacional mudando de tema
     com a pessoa no modo automático. */
  const temaPintado = useRef(efetivo);
  useEffect(() => {
    if (temaPintado.current === efetivo) return undefined;
    temaPintado.current = efetivo;

    // Quem pediu menos movimento não pede menos contraste: a troca acontece,
    // só não é encenada.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;

    const raiz = document.documentElement;
    raiz.classList.add("trocando-tema");
    const t = setTimeout(() => raiz.classList.remove("trocando-tema"), 360);
    return () => { clearTimeout(t); raiz.classList.remove("trocando-tema"); };
  }, [efetivo]);
  // Só com "auto" o sistema operacional manda; nos outros a escolha é explícita.
  useEffect(() => observarSistema(escolhido, setEfetivo), [escolhido]);

  /* A troca grava e segue — sem esperar a rede. Um tema que só muda depois da
     resposta pisca; e se a gravação falhar, a pior consequência é a preferência
     não sobreviver ao próximo login, não a tela travar. */
  const trocarTema = useCallback((proximo) => {
    setTemaPessoal(proximo);
    api.salvarMeuTema(proximo).catch(() => {});
    onSessionUpdate?.({ ...session, usuario: { ...session.usuario, temaPainel: proximo } });
  }, [session, onSessionUpdate]);

  /* Brilho de borda direcional em todo botão do painel. Um listener delegado
     aqui na raiz alimenta o CSS — ver `utils/brilhoDeBorda.js` e o bloco
     `.ds-shell button::after` no styles.css. */
  const shellRef = useRef(null);
  useBrilhoDeBorda(shellRef);

  /* ── A barra não tem mais estado de colapso ────────────────────────────────
     Ela vive recolhida e abre no hover, por CSS. Havia um botão para alternar e
     uma preferência guardada, e os dois foram embora pelo mesmo motivo: eram
     uma pergunta que o produto fazia à pessoa e que ela não tinha como
     responder bem. Quem recolhe ganha espaço e perde os rótulos; quem deixa
     aberta perde 240px em toda tela. O hover dá os dois — espaço o tempo todo,
     rótulo quando o olho vai lá.

     Sem estado em JavaScript de propósito: `:hover` no CSS não re-renderiza
     nada, e uma barra que remonta a cada entrada e saída do ponteiro seria cara
     numa tela que já tem submenu animado.
     ────────────────────────────────────────────────────────────────────────── */

  // ── Fila de modais de entrada ─────────────────────────────────────────────────
  /* O tour só entra depois que o aviso de conta se resolve (ver o JSX abaixo).
     Para quem NÃO administra a conta ele já nasce resolvido: o assistente da
     conta nem é montado para essa pessoa, então ninguém chamaria `aoResolver`
     e o tour esperaria para sempre um sinal que não vem. */
  const [contaResolvida, setContaResolvida] = useState(() => !cargo?.verConfiguracoes);
  const marcarContaResolvida = useCallback(() => setContaResolvida(true), []);
  // Enquanto o tour global ocupa a tela, os tours de tela esperam a vez.
  const [tourGlobalAtivo, setTourGlobalAtivo] = useState(false);

  // ── Ajuda ─────────────────────────────────────────────────────────────────────
  /* `pedidoTour` é um contador que o TourDeTela observa: incrementar reabre o
     tour da tela atual mesmo que ela já tenha sido concluída. Contador e não
     flag porque pedir "rever" duas vezes seguidas tem que funcionar as duas. */
  const [ajudaAberta, setAjudaAberta] = useState(false);
  /* O menu do perfil e o que ele abre. `ajudaEm` diz em que passo o modal de
     ajuda deve nascer: "menu" é a central, "chamado" pula direto para o
     formulário — o menu oferece as duas coisas como itens distintos, e cair na
     central depois de clicar em "abrir chamado" seria um passo a mais para uma
     escolha que a pessoa já fez. */
  const [menuPerfil, setMenuPerfil] = useState(false);
  const [ajudaEm, setAjudaEm] = useState("menu");
  const [preferenciasAbertas, setPreferenciasAbertas] = useState(false);
  const [meusDadosAbertos, setMeusDadosAbertos] = useState(false);
  const perfilRef = useRef(null);

  const [pedidoTour, setPedidoTour] = useState(0);

  // ── Toast ─────────────────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState([]);
  const showToast = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  /* Vincular a conta do Google.

     O token do Google vai para o servidor, que confere a assinatura antes de
     gravar qualquer coisa — nada aqui decide nada. Ver `services/google.js`.

     Ao dar certo, a sessão é atualizada na hora: sem isso o menu continuaria
     oferecendo "vincular" para quem acabou de vincular, até o próximo
     recarregamento. */
  /* Abre o modal com o botão do Google.

     Não dá para vincular direto do item do menu: o botão é DESENHADO pelo
     Google dentro de um elemento, não é uma chamada que abre uma janela. A
     primeira versão tentava `prompt()` (o One Tap) para evitar o modal — e o
     navegador suprimiu em toda tentativa. O modal é o preço de usar o caminho
     que funciona. */
  const [vinculandoGoogle, setVinculandoGoogle] = useState(null);
  const vincularGoogle = useCallback(async () => {
    try {
      const { clientId, disponivel } = await api.googleDisponivel();
      if (!disponivel) {
        showToast("Entrar com Google não está configurado neste ambiente.", "error");
        return;
      }
      setVinculandoGoogle(clientId);
    } catch (erro) {
      showToast(erro.message || "Não consegui falar com o Google.", "error");
    }
  }, [showToast]);

  const concluirVinculo = useCallback(async (credencial) => {
    try {
      const r = await api.vincularGoogle(tenantSlug, credencial);
      setVinculandoGoogle(null);
      onSessionUpdate?.({
        ...session,
        usuario: {
          ...session.usuario,
          google: { email: r.googleEmail, foto: r.googleFoto, nome: r.googleNome },
        },
      });
      showToast("Conta do Google vinculada. Da próxima vez você pode entrar por ela.");
    } catch (erro) {
      showToast(erro.message || "Não consegui vincular a conta do Google.", "error");
    }
  }, [tenantSlug, session, onSessionUpdate, showToast]);

  /* ── Links ────────────────────────────────────────────────────────────────
     "Ver página" leva ao endereço PÚBLICO da vitrine — o domínio da
     imobiliária, quando ela tem um. É o endereço que ela divulga e que os
     clientes conhecem; mandar para o caminho interno mostraria o mesmo
     conteúdo, mas ensinaria o endereço errado a quem for copiar da barra.

     O editor é o oposto: vive no painel da Omnimob e não existe no domínio do
     cliente, então continua sendo caminho interno. */
  const showcaseLink       = useMemo(() => (tenantSlug ? baseDaVitrine(session?.tenant) : "#"), [tenantSlug, session?.tenant]);
  const showcaseEditorLink = useMemo(() => tenantSlug ? `/vitrine/${tenantSlug}/editar`  : "#", [tenantSlug]);

  // ── Estado ativo ──────────────────────────────────────────────────────────────
  const p = location.pathname;
  /* Três itens da barra são ÍNDICES: abrem uma tela de cartões, e o destino
     escolhido tem endereço próprio. É o que permite ao submenu apontar para o
     destino final em vez de largar a pessoa no índice para escolher de novo.
     No índice, nenhum subitem fica aceso — nenhum deles é onde a pessoa está.

     "Relatórios" e "Configurações" guardam a escolha em `?ver=`, porque cada
     destino é um pedaço da MESMA tela. "Gerenciar Imóveis" guarda no caminho
     (`/imoveis` → `/imoveis/novo`), porque o formulário é outra tela — e um
     caminho que já dizia "novo" mais um `?ver=novo` atrás diziam a mesma coisa
     duas vezes. */
  const ver = new URLSearchParams(location.search).get("ver");
  const isInicio        = p === "/inicio";
  const isDashboard     = p === "/";
  /* "Gerenciar Imóveis" é o índice (`/imoveis`) e acende também quando a pessoa
     está numa das telas que ele leva a — o formulário e as categorias. */
  const isGerenciarImoveis = p === "/imoveis" || p === "/imoveis/novo" || p === "/tipos-imovel";
  const isImovelList    = p === "/imoveis/portfolio";
  /* Insights de um imóvel é `/imoveis/<id>` — qualquer coisa sob o prefixo que
     não seja um dos caminhos nomeados. A lista com um imóvel aberto continua
     sendo "onde a pessoa está" para o item Portfólio. */
  const isInsights      = p.startsWith("/imoveis/") && !isGerenciarImoveis && !isImovelList && p !== "/imoveis/editar";
  const isLeads         = p === "/relatorios" || p === "/leads";
  const isClientes      = p === "/clientes";
  const isUsuarios      = p === "/usuarios";
  const isCargos        = p === "/cargos";
  const isAuditoria     = p === "/auditoria";
  const isConfiguracoes = p === "/configuracoes";
  // Apenas o editor da vitrine (/vitrine/:slug/editar) — não confundir com
  // /imoveis/editar, que é o formulário de imóvel.
  const isShowcaseEditor = p.startsWith("/vitrine/") && p.endsWith("/editar");

  /* Esta tela tem tour? A resposta decide se o modal de ajuda oferece "rever o
     tour" ou explica que aqui não existe um. Vem da mesma fonte que o TourDeTela
     consulta — nada de uma segunda lista de rotas para desencontrar da primeira. */
  const tourDaTela = useMemo(() => {
    const tela = telaDaRota(p);
    if (!tela) return null;
    const roteiro = montarTourDeTela(tela, { plano: session?.tenant?.plano });
    return roteiro ? { chave: tela, titulo: roteiro.titulo } : null;
  }, [p, session?.tenant?.plano]);

  // ── Badge de novos leads ──────────────────────────────────────────────────────
  const [leadsBadge, setLeadsBadge] = useState(0);
  const canSeeLeads = Boolean(cargo?.verRelatorios);
  useEffect(() => {
    if (!tenantSlug || !canSeeLeads) return;
    function checkLeads() {
      api.listLeads(tenantSlug, { page: 1, limit: 1 }).then((result) => {
        const total = result.total ?? (result.leads?.length ?? 0);
        // Por ID e não por slug: com slug, a imobiliária que herda um endereço
        // livre herdava junto o contador de "já vistos" da anterior, e leads
        // novos não acendiam o marcador. Ver utils/chaveDoTenant.js.
        const seen = parseInt(lerDoTenant(CHAVES.leadsVistos, tenantId) || "0", 10);
        setLeadsBadge(Math.max(0, total - (Number.isFinite(seen) ? seen : 0)));
      }).catch(() => {});
    }
    checkLeads();
    window.addEventListener("focus", checkLeads);
    return () => window.removeEventListener("focus", checkLeads);
  }, [tenantSlug, tenantId, canSeeLeads]);
  useEffect(() => { if (isLeads) setLeadsBadge(0); }, [isLeads]);

  // ── Grupos de navegação ───────────────────────────────────────────────────────
  // Um grupo só aparece se sobrar algum item depois do filtro de permissões.
  const podeVerPainel = Boolean(cargo?.verPainelGestor);

  /* ── O teclado ────────────────────────────────────────────────────────────
     Mora aqui porque o layout envolve TODAS as telas do painel: um hook por
     página significaria lembrar de ligá-lo em cada página nova, e o esquecimento
     seria silencioso — a tecla simplesmente não faria nada naquela tela.

     `inicial` é para onde o Esc leva quando não há de onde voltar, e depende do
     cargo pela mesma razão que o destino após o login depende. */
  useAtalhos({
    cargo,
    doTenant: session?.tenant?.atalhos || undefined,
    doUsuario: session?.usuario?.atalhos || undefined,
    inicial: cargo?.verPainelGestor ? "/inicio" : "/",
    ativos: session?.tenant?.atalhosAtivos !== false,
  });

  const grupos = useMemo(() => {
    const g = [
      {
        /* O Painel do Gestor NÃO tem item aqui: chega-se a ele pelo cabeçalho
           da barra, logo acima. Dois caminhos para a mesma tela — um item de
           menu e o logotipo — fariam a pessoa se perguntar se são telas
           diferentes. */
        itens: [{ key: "dashboard", Icon: House, label: "Dashboard", active: isDashboard, onClick: () => navigate("/") }],
      },
      {
        label: "IMÓVEIS",
        itens: cargo?.gerenciarImoveis ? [
          {
            key: "imoveis-novo", Icon: Buildings, label: "Gerenciar Imóveis",
            active: isGerenciarImoveis, onClick: () => navigate("/imoveis"),
            subitens: [
              { key: "imovel-form", Icon: PlusCircle, label: "Novo Imóvel", active: p === "/imoveis/novo", onClick: () => navigate("/imoveis/novo") },
              { key: "imovel-tipos", Icon: Tag, label: "Categoria de Imóvel", active: p === "/tipos-imovel", onClick: () => navigate("/tipos-imovel") },
            ],
          },
          { key: "imoveis-lista", Icon: SquaresFour, label: "Portfólio Ativo", active: isImovelList || isInsights, onClick: () => navigate("/imoveis/portfolio") },
        ] : [],
      },
      {
        label: "RELACIONAMENTO",
        itens: [
          /* Um item só para tudo que é leitura do que aconteceu: leads, relatório
             mensal, funil e comissões. O rótulo é "Relatórios" e o destino é a
             página que reúne os quatro — cada recurso novo entra LÁ DENTRO, e não
             como mais uma linha nesta barra. */
          cargo?.verRelatorios && {
            key: "leads", Icon: IconeRelatorios, label: "Relatórios",
            active: isLeads, onClick: () => navigate("/relatorios"), badge: leadsBadge,
            subitens: [
              /* Os subitens saem da MESMA lista que desenha os cartões do
                 índice (`utils/relatorios.js`), inclusive a regra de plano.
                 Uma cópia aqui já deu um menu que oferecia o relatório mensal
                 no Básico enquanto a tela mostrava convite de upgrade. */
              ...relatoriosVisiveis(session?.tenant?.plano).map((r) => ({
                key: `rel-${PARAMETRO_DE[r.chave]}`,
                Icon: ICONES_RELATORIOS[r.chave],
                label: r.title,
                active: ver === PARAMETRO_DE[r.chave],
                onClick: () => navigate(`/relatorios?ver=${PARAMETRO_DE[r.chave]}`),
              })),
            ],
          },
          cargo?.gerenciarClientes && { key: "clientes", Icon: UserCircle, label: "Clientes", active: isClientes, onClick: () => navigate("/clientes") },
        ].filter(Boolean),
      },
      {
        label: "EQUIPE",
        itens: [
          cargo?.gerenciarUsuarios && { key: "usuarios", Icon: UserSquare, label: "Usuários", active: isUsuarios, onClick: () => navigate("/usuarios") },
          cargo?.gerenciarCargos && { key: "cargos", Icon: Shield, label: "Cargos", active: isCargos, onClick: () => navigate("/cargos") },
          /* Registro de atividade vive em EQUIPE, e não em Configurações: a
             pergunta que ele responde é sobre PESSOAS — quem apagou, quem
             alterou —, e é ao lado de Usuários e Cargos que ela é feita. */
          cargo?.verAuditoria && { key: "auditoria", Icon: ClockCounterClockwise, label: "Registro de Atividade", active: isAuditoria, onClick: () => navigate("/auditoria") },
        ].filter(Boolean),
      },
      {
        label: "VITRINE",
        itens: [
          /* Permissão própria, e só do Administrador. Saía de
             `editarPagina || gerenciarUsuarios`: tirar "Gerenciar Usuários" de
             um cargo levava junto Configurações, que não tem nada a ver com
             gerir gente — e, do outro lado, o Editor de Vitrine entrava numa
             tela com plano, cobrança e cancelamento de assinatura. */
          cargo?.verConfiguracoes && {
            key: "config", Icon: GearSix, label: "Configurações",
            active: isConfiguracoes, onClick: () => navigate("/configuracoes"),
            /* Os subitens saem da MESMA lista que desenha os cartões da tela
               (`utils/abasConfiguracoes.js`), inclusive a regra de permissão da
               seção de Dados. Uma cópia aqui daria um menu que promete uma
               seção que a tela não abre. */
            subitens: abasVisiveis(cargo, session?.tenant?.plano, { podeImportar })
              .map((a) => ({
                key: `config-${a.key}`, Icon: a.Icon, label: a.label,
                active: isConfiguracoes && ver === a.key,
                onClick: () => navigate(`/configuracoes?ver=${a.key}`),
              })),
          },
          /* O editor de vitrine ainda está em Beta, e o selo aparece aqui e no
             topo do próprio editor — a mesma tag, o mesmo componente. Aqui
             porque é onde a pessoa decide entrar; lá porque é onde ela trabalha
             e precisa continuar sabendo. */
          cargo?.editarPagina && { key: "editar-pagina", Icon: PencilSimple, label: "Editar Página", active: isShowcaseEditor, href: showcaseEditorLink, beta: true },
          { key: "ver-pagina", Icon: ArrowSquareOut, label: "Ver Página", href: showcaseLink, external: true },
        ].filter(Boolean),
      },
    ];
    return g.filter((grupo) => grupo.itens.length > 0);
  }, [
    cargo, navigate, leadsBadge, showcaseEditorLink, showcaseLink,
    isDashboard, isGerenciarImoveis, isImovelList, isInsights, isLeads,
    isClientes, isUsuarios, isCargos, isAuditoria, isConfiguracoes, isShowcaseEditor,
    p, ver,
  ]);

  /* Os rótulos são SEMPRE desenhados agora, e quem os esconde é o CSS.
     Antes o JSX os removia do DOM quando recolhida — com a expansão por hover
     isso não funciona: o React não sabe que o ponteiro entrou, e um estado só
     para isso traria de volta o re-render que o CSS evita. */
  const c = false;
  /* `c` fica como constante porque `SideTooltip` e `NavItem` recebem `collapsed`
     e sabem o que fazer com ele. Com `false`, a dica lateral não aparece — e é
     o certo: ela existia para dizer o nome do item quando o rótulo não cabia, e
     agora o próprio rótulo aparece ao passar o mouse. Duas coisas dizendo a
     mesma palavra no mesmo gesto é ruído. */

  return (
    <Tooltip.Provider>
      <style>{CSS}</style>

      {/* ── Fila de dois, e cada um é de um DONO diferente ─────────────────
          O primeiro é da CONTA: assinatura, ficha da imobiliária, endereço da
          vitrine, importação da base. O segundo é da PESSOA: o convite ao tour.
          O segundo espera o primeiro se resolver — inclusive quando ele decide
          não aparecer.

          Por isso o primeiro só vale para quem ADMINISTRA a conta. Um corretor
          recebia um assistente pedindo que escolhesse o domínio da imobiliária
          e importasse a base — decisões que não são dele, em telas que o cargo
          dele nem abre. `verConfiguracoes` é a marca de quem administra neste
          schema: é ela que abre plano, cobrança e domínio.

          Quem não administra segue direto para o convite do tour, que é o que
          faz sentido no primeiro acesso de qualquer pessoa. */}
      {cargo?.verConfiguracoes ? (
      <BoasVindasModal
        tenantSlug={tenantSlug}
        tenantId={tenantId}
        aoResolver={marcarContaResolvida}
        /* A ficha preenchida ali dentro traz cores e logo. Sem repassar a
           sessão adiante, o painel só mostraria a identidade nova no próximo
           login — logo depois de a pessoa acabar de escolhê-la. */
        aoAtualizarTenant={(campos) =>
          onSessionUpdate?.({ ...session, tenant: { ...session.tenant, ...campos } })}
      />
      ) : null}

      {/* Vale para todo mundo: dono, corretor, tenant pagante e tenant em
          teste. O tour é sobre onde ficam as telas — pergunta que independe
          de quem pagou a conta. */}
      <PrimeiroAcessoTour
        session={session}
        pronto={contaResolvida}
        aoMudarEstado={setTourGlobalAtivo}
      />

      {/* Tours de tela: abrem só quando a pessoa entra na página por vontade
          própria, e ficam quietos enquanto o global estiver na frente. */}
      <TourDeTela
        session={session}
        globalAtivo={tourGlobalAtivo}
        pronto={contaResolvida}
        pedido={pedidoTour}
      />

      {/* Pergunta espontânea de quem está em teste. Vem por último na fila e
          por um motivo: os três acima são de ENTRADA (recepção, tour, tour de
          tela) e disputam o primeiro minuto de uso; este só acorda depois de a
          pessoa ter cadastrado ou editado alguma coisa. `pronto` cobre o
          encontro entre eles — enquanto o tour global estiver na tela, nenhuma
          pergunta sobe por cima. */}
      <PulsoTrialModal
        tenantSlug={tenantSlug}
        tenantId={tenantId}
        pronto={contaResolvida && !tourGlobalAtivo}
      />

      {preferenciasAbertas ? (
        <ModalPreferencias
          onClose={() => setPreferenciasAbertas(false)}
          tema={escolhido}
          aoTrocarTema={trocarTema}
          session={session}
          onSessionUpdate={onSessionUpdate}
        />
      ) : null}

      {vinculandoGoogle ? (
        <>
          <div className="mp-veu" onMouseDown={() => setVinculandoGoogle(null)} />
          <div className="mp-modal mp-modal--curto" role="dialog" aria-modal="true" aria-label="Vincular conta Google">
            <header className="mp-modal__cab">
              <div>
                <h2>Vincular conta Google</h2>
                <p>Escolha a conta que você quer usar para entrar na Omnimob.</p>
              </div>
              <button type="button" className="mp-modal__fechar" onClick={() => setVinculandoGoogle(null)} aria-label="Fechar">×</button>
            </header>
            <div className="mp-modal__corpo">
              <BotaoGoogle clientId={vinculandoGoogle} aoReceber={concluirVinculo} largura={320} />
              <p className="mp-nota" style={{ textAlign: "center" }}>
                Seu login e senha continuam funcionando. Vincular só acrescenta um caminho.
              </p>
            </div>
          </div>
        </>
      ) : null}

      {meusDadosAbertos ? (
        <ModalMeusDados onClose={() => setMeusDadosAbertos(false)} session={session} onSessionUpdate={onSessionUpdate} />
      ) : null}

      <AjudaModal
        open={ajudaAberta}
        passoInicial={ajudaEm}
        onClose={() => setAjudaAberta(false)}
        tourDaTela={tourDaTela}
        aoReverTour={() => setPedidoTour((n) => n + 1)}
        contexto={{ rota: p, tenantSlug, usuario: session?.usuario?.login || userName }}
      />

      {/* `data-tema` no SHELL, e não só no `<main>`.

          O `.main-content` tem `max-width: 1200px` e `margin: 0 auto`: a caixa
          do `<main>` é mais estreita que a coluna, então pintar o fundo nela
          deixava faixas escuras dos dois lados. Quem precisa ficar claro é a
          ÁREA, e a área é o shell.

          O `.ds-side` continua escuro sem esforço: ele pinta com os próprios
          tokens (`--s-bg`), de outra família, que este tema não toca. */}
      <div
        ref={shellRef}
        className="ds-shell"
        data-tema={efetivo}
        style={{ "--tenant-primary": corPrimaria, "--tenant-primary-ink": tintaPrimaria }}
      >
        {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
        {/* `ds-side` reserva os 64px no fluxo; `ds-side__interno` é quem cresce,
            por cima do conteúdo. Fosse a própria `aside` a crescer, cada passada
            de mouse empurraria a página inteira para o lado. */}
        <aside className="ds-side" data-tour="sidebar">
          <div className="ds-side__interno">

          {/* ── Header: a porta do Painel do Gestor ────────────────────────
              Ele é a marca da imobiliária, e é por isso que serve: "clicar no
              logotipo para ver como a casa está" é o gesto que a pessoa já tem.

              Vira BOTÃO só para quem tem `verPainelGestor`. Para os outros
              continua sendo uma `<div>` — e não um botão desabilitado: um
              cursor de mão que não leva a lugar nenhum promete uma tela que
              aquela pessoa não vai ver nunca. */}
          {podeVerPainel ? (
          <button
            type="button"
            className={`ds-head ds-head--link${isInicio ? " is-ativo" : ""}`}
            onClick={() => navigate("/inicio")}
            title="Painel do Gestor"
            aria-current={isInicio ? "page" : undefined}
          >
            <div className={`ds-mark${session?.tenant?.logoUrl ? " has-logo" : ""}`}>
              {session?.tenant?.logoUrl
                ? <img src={session.tenant.logoUrl} alt={tenantName} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                : tenantName.charAt(0).toUpperCase()}
            </div>
            {!c ? (
              <>
                {/* Só o nome. O slug era detalhe de endereço num lugar que
                    responde "de quem é este painel" — e com o selo do plano ao
                    lado, três informações empilhadas em 56px de altura viravam
                    ruído. Quem precisa do endereço tem "Ver página" no menu e a
                    seção de endereço em Configurações. */}
                <div className="ds-head__text">
                  <span className="ds-head__name">{tenantName}</span>
                </div>
                {/* Selo do plano. Some com a sidebar recolhida: ali sobram 28px
                    e a marca tem prioridade. A cor vem de `planos.js`, a mesma
                    que a landing e o painel super-admin usam — plano é uma só
                    ideia no produto e deve ter uma só aparência. */}
                <SeloPlano plano={session?.tenant?.plano} />
              </>
            ) : null}
          </button>
          ) : (
          <div className="ds-head">
            <div className={`ds-mark${session?.tenant?.logoUrl ? " has-logo" : ""}`}>
              {session?.tenant?.logoUrl
                ? <img src={session.tenant.logoUrl} alt={tenantName} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                : tenantName.charAt(0).toUpperCase()}
            </div>
            {!c ? (
              <>
                <div className="ds-head__text">
                  <span className="ds-head__name">{tenantName}</span>
                </div>
                <SeloPlano plano={session?.tenant?.plano} />
              </>
            ) : null}
          </div>
          )}

          {/* Navegação */}
          <nav className="ds-nav">
            {grupos.map((grupo, gi) => (
              <div className="ds-group" key={grupo.label || `g-${gi}`}>
                {/* Recolhida, o nome do grupo vira um fio: ele separa sem
                    precisar de largura. Os dois no DOM pelo mesmo motivo do
                    rótulo acima. */}
                {grupo.label ? (
                  <>
                    <span className="ds-group__rule" aria-hidden="true" />
                    <span className="ds-group__label">{grupo.label}</span>
                  </>
                ) : null}
                {grupo.itens.map((item) => (
                  <div key={item.key}>
                    <NavItem
                      Icon={item.Icon}
                      label={item.label}
                      active={item.active}
                      onClick={item.onClick}
                      href={item.href}
                      external={item.external}
                      badge={item.badge}
                      beta={item.beta}
                      collapsed={c}
                      tourId={`nav-${item.key}`}
                    />

                    {/* Submenu do índice. Fica fora do DOM quando a barra está
                        recolhida — em 64px não há onde escrever "Relatório
                        mensal", e a dica lateral já cobre o nome do pai.

                        `aria-hidden` e `tabIndex: -1` quando fechado: o bloco
                        continua no DOM para poder animar, e sem isso o Tab
                        entraria em itens invisíveis. */}
                    {item.subitens?.length ? (
                      <div className={`ds-sub${item.active ? " is-open" : ""}`} aria-hidden={!item.active}>
                        <div className="ds-sub__inner">
                          <span className="ds-sub__rail" aria-hidden="true" />
                          {item.subitens.map((sub, si) => (
                            <button
                              key={sub.key}
                              type="button"
                              /* Mesmo esquema do item pai (`nav-<key>`): o tour
                                 precisa apontar para o submenu desde que
                                 Relatórios e Configurações viraram índices — o
                                 roteiro falava deles como se fossem uma tela
                                 só, sem caminho para os destinos de dentro. */
                              data-tour={`nav-${sub.key}`}
                              className={`ds-subitem${sub.active ? " is-active" : ""}`}
                              style={{ "--i": si }}
                              tabIndex={item.active ? 0 : -1}
                              onClick={sub.onClick}
                            >
                              <span className="ds-subitem__icon">
                                <sub.Icon size={14} weight={sub.active ? "fill" : "regular"} />
                              </span>
                              <span className="ds-subitem__label">{sub.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ))}
          </nav>

          {/* Rodapé */}
          <div className="ds-foot">
            {/* Só aparece enquanto o tenant estiver em teste; some ao assinar.

                `podeAssinar` segue `verConfiguracoes` — assinar é decisão de
                quem responde pela conta, e é a mesma permissão que abre
                Configurações, onde o plano vive. Era `gerenciarUsuarios`. */}
            <SideTooltip label="Assinar a Omnimob" collapsed={c}>
              <div>
                <TrialAviso
                  tenantSlug={tenantSlug}
                  podeAssinar={Boolean(cargo?.verConfiguracoes)}
                  aoAssinar={() => window.location.reload()}
                />
              </div>
            </SideTooltip>

            {/* Ajuda e Encerrar Sessão saíram daqui para o menu do perfil.

                Elas não eram navegação: são coisas sobre VOCÊ e sobre o
                SISTEMA, não sobre o trabalho da imobiliária. No meio de Início,
                Imóveis e Relatórios, competiam pelo olho com os itens que a
                pessoa usa o dia inteiro — e "Sair" ao alcance de um clique
                distraído, logo abaixo de "Recolher menu", era um convite ao
                acidente. Ver `MenuDoPerfil`. */}
            {/* O perfil vira BOTÃO, e o menu sobe daqui.

                `is-menu-aberto` mantém o realce enquanto o balão está no ar: sem
                isso o item que originou o menu se apaga assim que o ponteiro
                entra nele, e o balão parece vir de lugar nenhum. */}
            <div className="ds-profile-caixa" ref={perfilRef}>
              <MenuDoPerfil
                aberto={menuPerfil}
                aoFechar={() => setMenuPerfil(false)}
                usuario={session?.usuario}
                tenant={session?.tenant}
                ancoraRef={perfilRef}
                aoAbrirAjuda={() => { setAjudaEm("menu"); setAjudaAberta(true); }}
                aoAbrirChamado={() => { setAjudaEm("chamado"); setAjudaAberta(true); }}
                aoAbrirPreferencias={() => setPreferenciasAbertas(true)}
                aoAbrirPerfil={() => setMeusDadosAbertos(true)}
                aoVincularGoogle={vincularGoogle}
                aoSair={onLogout}
              />
              <button
                type="button"
                className={`ds-profile${menuPerfil ? " is-menu-aberto" : ""}`}
                data-tour="perfil"
                onClick={() => setMenuPerfil((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuPerfil}
                title="Sua conta"
              >
              {/* A inicial some quando há foto; a foto some se falhar ao
                  carregar (URL do Google expira) — e aí a inicial volta, em vez
                  de sobrar um quadrado quebrado. */}
              <div className={`ds-avatar${userFoto ? " tem-foto" : ""}`}>
                {userFoto
                  ? <img src={userFoto} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.remove(); }} />
                  : userInitial}
              </div>
              {!c ? (
                <>
                  <div className="ds-profile__text">
                    <span className="ds-profile__name">{userName}</span>
                    <span className="ds-profile__role">{userRole}</span>
                  </div>
                  {/* O atalho de tema mora no perfil porque a escolha é da
                      PESSOA, não da imobiliária — e é ao lado do próprio nome
                      que se procura o que é seu. O caminho da casa fica em
                      Configurações › Aparência, que é do administrador.

                      Cicla claro → escuro → automático, e o ícone diz onde
                      está. Um menu para três opções custaria dois cliques onde
                      um resolve. */}
                </>
              ) : null}
              </button>
              {/* O atalho de tema saiu daqui e foi para o modal de
                  preferências. Dois motivos: dentro do botão do perfil ele
                  abriria o menu a cada clique, e um botão dentro de outro é
                  HTML inválido; fora, competia com o próprio perfil por um
                  canto de 240px. E o lugar dele é junto das outras escolhas da
                  pessoa — tema, barra, tours —, não solto na moldura. */}
            </div>
          </div>
          </div>
        </aside>

        {/* ── Conteúdo principal ───────────────────────────────────────────────── */}
        {/* ── O tema pinta AQUI, não na barra ────────────────────────────────
            `data-tema` no `<main>`, e o `ds-side` fica de fora de propósito: a
            barra lateral é a moldura do produto e mantém a identidade escura em
            qualquer tema. O conteúdo é onde a pessoa trabalha, e é ele que pode
            ser claro. Pintar as duas faria o painel claro perder a âncora
            visual que o identifica como Omnimob. */}
        <main
          className={isShowcaseEditor ? "main-content--editor-vitrine" : "main-content"}
          data-tema={efetivo}
          style={{ flex: 1, minWidth: 0 }}
        >
          <div key={location.pathname} style={{ animation: "chicEntrance 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards" }}>
            {/* O provedor envolve só o CONTEÚDO, e não a barra: os selos de
                tecla vivem nos botões das telas, e a barra tem os próprios
                rótulos. Envolver tudo obrigaria a barra a re-renderizar a cada
                troca de rota só por causa do contexto. */}
            <ProvedorDeAtalhos session={session}>
              <Outlet context={{ showToast }} />
            </ProvedorDeAtalhos>
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
  /* Acompanha o escurecimento do fundo: contra o novo #0a0a0b quase neutro, o
     azul-noite que a sidebar tinha (#0c0f1a) deixava de ser sutil e passava a
     ler como um painel de outra cor. Continua um degrau acima do conteúdo, para
     as duas áreas não virarem uma chapa só. */
  --s-bg: #0d0d12;
  --s-border: rgba(255,255,255,0.07);
  --s-sep: rgba(255,255,255,0.06);
  --s-text: #64748b;
  --s-strong: #f1f5f9;
  --s-hover: rgba(255,255,255,0.05);
  --s-active: rgba(129,140,248,0.10);
  --s-accent: #818cf8;
  /* Vem do perfil do tenant (inline, logo acima no JSX). O #4f46e5 é só a rede
     de segurança para quando a sessão ainda não trouxe a cor. */
  --s-avatar: var(--tenant-primary, #4f46e5);
  --s-avatar-ink: var(--tenant-primary-ink, #fff);
  --s-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;

  display: flex; min-height: 100vh;
  font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
  position: relative;
}

/* Os detalhes da marca sobre o preto: dois halos roxos e um dourado, a mesma
   receita da landing e do painel super-admin.

   Posição fixa e não absoluta: o conteúdo rola, e um brilho que sobe junto com
   a lista de imóveis lê como um elemento da página, não como iluminação do
   ambiente. Fica preso à janela e o conteúdo passa por cima.

   As opacidades são de um dígito de propósito — 0,10 no roxo e 0,05 no
   dourado. Acima disso o fundo deixa de ser fundo e começa a competir com os
   cartões de vidro, que são translúcidos e absorvem qualquer cor que venha por
   baixo. */
.ds-shell::before {
  content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 0;
  background:
    radial-gradient(880px 460px at 82% -6%, rgba(139,92,246,0.11), transparent 68%),
    radial-gradient(560px 340px at 14% 2%, rgba(212,175,55,0.075), transparent 62%),
    radial-gradient(700px 500px at 98% 92%, rgba(99,102,241,0.07), transparent 70%),
    radial-gradient(420px 300px at 2% 96%, rgba(212,175,55,0.05), transparent 64%);
}

/* Acima da iluminação. A sidebar já tinha z-index próprio; o conteúdo não. */
.ds-shell > main { position: relative; z-index: 1; }

/* ── A barra vive RECOLHIDA e abre no hover ──────────────────────────────────
   A aside guarda 64px no fluxo e nunca muda de tamanho. Quem cresce e a
   sobrepõe é o filho, em position fixed — assim o conteúdo ao lado não é
   empurrado a cada passada de mouse. Empurrar refazia o layout da tela inteira
   por um gesto que costuma durar meio segundo.
   (Sem crases nestes comentarios: eles vivem dentro de um template literal.) */
.ds-side {
  width: 64px; min-width: 64px; flex-shrink: 0;
  height: 100vh; position: sticky; top: 0; z-index: 10;
}
.ds-side__interno {
  position: fixed; left: 0; top: 0; bottom: 0; z-index: 40;
  width: 64px;
  display: flex; flex-direction: column;
  background: var(--s-bg);
  border-right: 1px solid var(--s-border);
  overflow-x: hidden; overflow-y: auto;
  transition: width 0.2s cubic-bezier(0.4,0,0.2,1), box-shadow 0.2s ease;
}
.ds-side:hover .ds-side__interno,
/* focus-within porque quem navega por teclado nunca passa o mouse: sem isto a
   barra ficaria de 64px com o foco dentro, e o item focado seria invisivel.
   (Sem crases: template literal.) */
.ds-side:focus-within .ds-side__interno {
  width: 240px;
  box-shadow: 24px 0 60px -24px rgba(0,0,0,0.75);
}

/* ── O que some ao recolher ──────────────────────────────────────────────────
   display: none, e NAO opacity. Elemento invisivel por opacidade continua
   ocupando a caixa dele e continua contando como item de flex — o resultado
   era uma barra de 64px cheia de vaos, com o gap de 10px separando icones de
   rotulos que ninguem via. Fora do fluxo, o item recolhido fica do tamanho do
   icone, que e o comportamento que a versao com botao tinha.

   O preco e a transicao: nao da para animar display. Some seco, como antes.
   (Sem crases nestes comentarios: template literal.) */
.ds-side:not(:hover):not(:focus-within) .ds-item__label,
.ds-side:not(:hover):not(:focus-within) .ds-head__text,
.ds-side:not(:hover):not(:focus-within) .ds-plano,
.ds-side:not(:hover):not(:focus-within) .ds-profile__text,
.ds-side:not(:hover):not(:focus-within) .ds-group__label,
.ds-side:not(:hover):not(:focus-within) .ds-item__badge,
.ds-side:not(:hover):not(:focus-within) .selo-beta,
.ds-side:not(:hover):not(:focus-within) .ds-sub { display: none; }

/* E o que some ao ABRIR: as formas recolhidas dos mesmos elementos. */
.ds-side:hover .ds-group__rule,
.ds-side:focus-within .ds-group__rule,
.ds-side:hover .ds-item__pip,
.ds-side:focus-within .ds-item__pip { display: none; }
.ds-side:not(:hover):not(:focus-within) .ds-group__rule { display: block; }

/* Geometria da barra recolhida — os mesmos valores que a classe is-collapsed
   tinha. O gap zerado importa: com ele, o icone centralizado ficava deslocado
   pela metade da folga que sobrava do rotulo ausente. */
.ds-side:not(:hover):not(:focus-within) .ds-shell .ds-item,
.ds-side:not(:hover):not(:focus-within) .ds-item { justify-content: center; padding: 8px; gap: 0; }
.ds-side:not(:hover):not(:focus-within) .ds-head { justify-content: center; padding: 0; gap: 0; }
.ds-side:not(:hover):not(:focus-within) .ds-shell button.ds-profile,
.ds-side:not(:hover):not(:focus-within) button.ds-profile { justify-content: center; padding: 10px 8px; gap: 0; }

/* ── Header ── */
.ds-head {
  display: flex; align-items: center; gap: 10px;
  height: 56px; padding: 0 14px; flex-shrink: 0;
  border-bottom: 1px solid var(--s-border);
}
/* O cabecalho vira a porta do Painel do Gestor para quem tem a permissao.
   Como <button>, ele herda o reset de botao do painel — dai zerar largura,
   fundo e alinhamento aqui, senao ele nasce com o padding global de 14px/20px
   e a barra ganha uma altura que nao e a dela.
   (Sem crases nestes comentarios: eles vivem dentro de um template literal.) */
.ds-head--link {
  width: 100%; margin: 0; border: 0; border-bottom: 1px solid var(--s-border);
  border-radius: 0; background: transparent; color: inherit;
  text-align: left; cursor: pointer; font: inherit;
  transition: background 0.15s ease;
}
.ds-head--link:hover { background: var(--s-hover); }
.ds-head--link.is-ativo { background: var(--s-hover); }
/* A marca ganha o realce quando a tela esta aberta: a barra recolhida mostra so
   ela, e sem isto nao haveria como saber que o Painel do Gestor e o atual. */
.ds-head--link.is-ativo .ds-mark { box-shadow: 0 0 0 2px var(--tenant-primary, #6366f1); }
.ds-mark {
  width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  background: var(--s-avatar); color: var(--s-avatar-ink); font-weight: 700; font-size: 13px;
}
.ds-mark.has-logo { background: transparent; }
.ds-mark img { width: 100%; height: 100%; object-fit: contain; }
.ds-head__text { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
/* Pílula do plano. O margin-left auto empurra para a direita sem depender de
   ninguém no meio; o flex-shrink zero impede que ela vire "Premi…" quando o
   nome da imobiliária é comprido — quem encolhe é o nome, que tem reticências.
   (Sem crases neste comentário: ele vive dentro de um template literal.)

   A cor vem do próprio plano (planos.js), a mesma que a landing e o painel
   super-admin usam: plano é uma ideia só no produto e merece uma aparência só. */
.ds-plano {
  margin-left: auto; flex-shrink: 0;
  padding: 3px 9px; border-radius: 999px;
  font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
  color: var(--plano);
  background: color-mix(in srgb, var(--plano) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--plano) 34%, transparent);
  line-height: 1.5; white-space: nowrap;
}
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
.ds-group__rule { display: none; height: 1px; background: var(--s-sep); margin: 4px 6px 5px; }

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

/* O dourado da marca só neste item: é o que faz o olho achá-lo no rodapé sem
   precisar de um botão flutuante por cima do conteúdo. */
.ds-shell .ds-item--ajuda:hover { color: #d4af37; background: rgba(212,175,55,0.09); }
.ds-shell .ds-item--ajuda:hover .ds-item__icon { color: #d4af37; }

.ds-item__icon { display: flex; flex-shrink: 0; position: relative; color: currentColor; }
.ds-item.is-active .ds-item__icon { color: #fff; }
.ds-item__label { overflow: hidden; text-overflow: ellipsis; flex: 1; }
/* Com selo ao lado, o rótulo ocupa só o que precisa — senão o selo é empurrado
   para a borda direita e vira mais um contador aos olhos de quem lê rápido. */
.ds-item.has-beta .ds-item__label { flex: 0 1 auto; }
.ds-item__pip {
  position: absolute; top: -4px; right: -4px; width: 8px; height: 8px;
  border-radius: 50%; background: #ef4444; border: 1.5px solid var(--s-bg);
}
.ds-item__badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px;
  background: #ef4444; color: #fff; font-size: 10px; font-weight: 700; flex-shrink: 0;
}

/* ── Submenu do índice ───────────────────────────────────────────────────────
   Abre sozinho quando o item pai está ativo — nada de clique extra para
   revelar. Quem chegou em Relatórios já demonstrou que quer o que tem lá
   dentro; pedir mais um clique para VER as opções seria cobrar duas vezes.

   A animação é de grade, não de altura: 'grid-template-rows' interpola de 0fr
   a 1fr e o navegador anima até a altura natural do conteúdo. É o jeito de
   abrir algo de altura desconhecida sem medir nada em JavaScript e sem cravar
   um 'max-height' chutado, que ou corta a lista ou deixa a saída lenta quando o
   valor é generoso demais.

   Três coisas acontecem juntas, e é a soma delas que dá o movimento: a caixa
   cresce, o fio vertical desce da esquerda e os itens entram um após o outro
   deslizando da margem. O escalonamento é pelo --i que o JSX injeta.
   ────────────────────────────────────────────────────────────────────────── */
.ds-sub {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}
.ds-sub.is-open { grid-template-rows: 1fr; }

/* O respiro vem de MARGEM nos filhos, não de padding aqui.

   Com padding, o bloco fechado media 5px em vez de 0: a faixa da grade colapsa
   para altura zero, mas o padding é somado por fora da caixa de conteúdo
   esticada — sobrava uma tira vazia sob todo item de índice que não estivesse
   ativo. Margem fica DENTRO da área recortada e some junto. */
.ds-sub__inner {
  position: relative;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.ds-sub__inner .ds-subitem:first-of-type { margin-top: 3px; }
.ds-sub__inner .ds-subitem:last-of-type { margin-bottom: 2px; }

/* O fio que liga o item pai aos filhos. Alinhado com o CENTRO do ícone do pai:
   ele tem 16px e começa nos 10px de padding do item, então o meio cai em 18px.
   Desce ao abrir e recolhe ao fechar. */
.ds-sub__rail {
  position: absolute;
  left: 18px;
  top: 4px;
  bottom: 6px;
  width: 1px;
  background: linear-gradient(180deg, rgba(129,140,248,0.45), var(--s-sep));
  transform: scaleY(0);
  transform-origin: top;
  transition: transform 0.36s cubic-bezier(0.22, 1, 0.36, 1) 0.04s;
}
.ds-sub.is-open .ds-sub__rail { transform: scaleY(1); }

.ds-shell .ds-subitem {
  position: relative;
  display: flex; align-items: center; gap: 9px;
  /* justify-content explícito, e não por herança.

     O seletor global de button no styles.css declara justify-content: center.
     O item PAI escapa disso porque o rótulo dele ocupa a sobra (flex: 1) —
     aqui não ocupava, e o par ícone+texto ia parar no meio da barra, com uma
     folga à esquerda que parecia recuo de hierarquia mas era centralização.

     (Sem crases neste comentário: ele vive dentro de um template literal, e uma
     crase aqui encerra a string e derruba o build.) */
  justify-content: flex-start;
  width: 100%; padding: 6px 10px 6px 26px; border-radius: 8px;
  font-family: inherit; font-size: 12.5px; font-weight: 500; text-align: left;
  color: var(--s-text); background: transparent;
  border: 1px solid transparent; box-shadow: none;
  cursor: pointer; white-space: nowrap; overflow: hidden;
  opacity: 0; transform: translateX(-10px);
  transition:
    opacity 0.26s ease,
    transform 0.34s cubic-bezier(0.22, 1, 0.36, 1),
    background 0.15s ease,
    color 0.15s ease;
}

/* O atraso escalonado vale só na ENTRADA. Aplicado dos dois lados, fechar
   ficaria com o último item sumindo um quarto de segundo depois do primeiro —
   o que lê como travamento, não como acabamento. */
.ds-sub.is-open .ds-subitem {
  opacity: 1;
  transform: translateX(0);
  transition-delay: calc(var(--i) * 55ms);
}

.ds-shell .ds-subitem:hover {
  background: var(--s-hover); color: var(--s-strong);
  box-shadow: none; transform: translateX(0); border-color: transparent;
}
.ds-shell .ds-subitem.is-active {
  color: var(--s-strong);
  background: rgba(129,140,248,0.08);
}
.ds-subitem__icon { display: flex; flex-shrink: 0; color: currentColor; }
.ds-subitem.is-active .ds-subitem__icon { color: #fff; }
.ds-subitem__label { flex: 1; overflow: hidden; text-overflow: ellipsis; }

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
.ds-avatar {
  width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  background: var(--s-avatar); color: var(--s-avatar-ink); font-size: 11px; font-weight: 700;
}
/* Com foto, o disco colorido vira moldura e some por baixo da imagem. */
.ds-avatar.tem-foto { background: transparent; }
.ds-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ds-profile__text { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }

/* Botão de tema, à direita do nome. Discreto em repouso e legível no hover: ele
   é usado uma vez por pessoa, não todo dia, e não deve competir com a navegação
   pelo canto do olho. */
.ds-tema {
  width: 28px; height: 28px; padding: 0; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 8px; border: 1px solid transparent;
  background: transparent; box-shadow: none; transform: none;
  color: var(--s-text); cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.ds-shell .ds-tema:hover {
  background: var(--s-hover); color: var(--s-strong);
  box-shadow: none; transform: none; border-color: transparent;
}
.ds-profile__name {
  font-size: 12px; font-weight: 600; color: var(--s-strong); line-height: 1.3;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ds-profile__role {
  font-family: var(--s-mono); font-size: 8.5px; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--s-text); line-height: 1.3;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* ── Toasts ──────────────────────────────────────────────────────────────────
   Seguem o tema do conteúdo, e o atributo data-tema que os alcança é o do
   SHELL: eles ficam fora do main.
   (Sem crases neste comentário: ele vive dentro de um template literal, e uma
   crase aqui encerra a string e derruba o build.)

   Antes eu os deixara escuros nos dois temas, argumentando que flutuam sobre a
   tela inteira, inclusive sobre a barra lateral. O argumento é fraco: o toast
   comenta o que acabou de acontecer NO CONTEÚDO ("imóvel salvo", "lead
   excluído"), e é sobre o conteúdo que ele aparece — a barra tem 240px e nem
   fica embaixo dele. Um cartão quase preto sobre um painel claro lê como aviso
   do sistema operacional, não do produto.
   ────────────────────────────────────────────────────────────────────────── */
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

.ds-shell[data-tema="claro"] .ds-toast {
  color: #0f172a;
  background: rgba(255,255,255,0.94);
  border-color: rgba(15,23,42,0.10);
  /* A sombra do escuro é preta a 90%: sobre fundo claro ela vira uma nuvem
     cinza em volta do cartão. Aqui ela encolhe e clareia, e o realce interno
     inverte — no escuro é um fio de luz no topo, no claro seria invisível. */
  box-shadow: 0 18px 40px -16px rgba(15,23,42,0.28), inset 0 1px 0 rgba(255,255,255,0.9);
}

@media (prefers-reduced-motion: reduce) {
  .ds-side { transition: none; }
  .ds-toast { animation: none; }
  /* O submenu continua abrindo e fechando — só deixa de deslizar. */
  .ds-sub,
  .ds-sub__rail,
  .ds-shell .ds-subitem { transition: none; }
  .ds-sub.is-open .ds-subitem { transition-delay: 0ms; }
}
`;
