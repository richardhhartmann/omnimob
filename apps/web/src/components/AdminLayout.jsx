import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { TrialAviso } from "./TrialAviso";
import { BoasVindasModal } from "./BoasVindasModal";
import { PulsoTrialModal } from "./PulsoTrialModal";
import { baseDaVitrine } from "../utils/enderecoVitrine";
import { planoInfo } from "../utils/planos";
import { PrimeiroAcessoTour } from "./PrimeiroAcessoTour";
import { TourDeTela } from "./TourDeTela";
import { AjudaModal } from "./AjudaModal";
import { corDeTextoPara } from "./adminUi";
import { montarTourDeTela, telaDaRota } from "../utils/tourTelas";
import { IconeRelatorios, ICONES_RELATORIOS } from "../utils/iconesRelatorios";
import { ABAS_CONFIG } from "../utils/abasConfiguracoes";
import { podeImportar } from "./ImportadorDados.jsx";
import { SeloBeta } from "./SeloBeta.jsx";
import { TEMAS, observarSistema, temaEfetivo, temaEscolhido } from "../utils/temaDoPainel";
import { lerDoTenant, CHAVES } from "../utils/chaveDoTenant";
import { useBrilhoDeBorda } from "../utils/brilhoDeBorda";
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
  Question,
  PlusCircle,
  Tag,
  ClockCounterClockwise,
  Sun,
  Moon,
  CircleHalf,
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
        {collapsed && badge > 0 ? <span className="ds-item__pip" /> : null}
      </span>
      {!collapsed ? <span className="ds-item__label">{label}</span> : null}
      {/* Só com a barra expandida. Recolhida sobram 28px, onde nem o nome cabe
          — e a dica lateral já diz de que item se trata. */}
      {!collapsed && beta ? <SeloBeta /> : null}
      {!collapsed && badge > 0 ? (
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

/* ── O botão de tema, ao lado do nome ────────────────────────────────────────
   Cicla entre as três opções em vez de abrir menu: são três estados e o ícone
   mostra em qual você está, então um clique basta. O `title` diz o próximo
   destino — é o que evita a pessoa clicar duas vezes para descobrir a ordem. */
const ICONE_DO_TEMA = { claro: Sun, escuro: Moon, auto: CircleHalf };

function SeletorDeTema({ escolhido, aoTrocar }) {
  /* Só claro e escuro no atalho do perfil. "Automático" existe, mas é uma
     escolha de configuração, não de alternância rápida: quem clica aqui quer
     TROCAR a tela agora, e um terceiro estado que "depende do sistema" faz o
     clique não ter efeito visível quando o sistema já está naquele modo.

     Ele continua disponível em Configurações › Aparência e no primeiro acesso,
     onde a pessoa está decidindo com calma. E quem escolheu automático por lá
     vê o ícone dele aqui — o botão mostra o estado real, só não oferece o
     terceiro destino. */
  const ordem = ["claro", "escuro"];
  /* Vindo de "automático", o índice é -1 e o próximo seria "claro" por
     acidente. Partimos do que está NA TELA: quem vê escuro espera que o clique
     leve ao claro, independente de como chegou nele. */
  const atualNaTela = escolhido === "claro" ? "claro" : "escuro";
  const proximo = ordem[(ordem.indexOf(atualNaTela) + 1) % ordem.length];
  const Icone = ICONE_DO_TEMA[escolhido] || Moon;
  const rotulo = TEMAS.find((t) => t.id === proximo)?.rotulo || proximo;

  return (
    <button
      type="button"
      className="ds-tema"
      onClick={() => aoTrocar(proximo)}
      title={`Tema: ${TEMAS.find((t) => t.id === escolhido)?.rotulo}. Clique para ${rotulo.toLowerCase()}.`}
      aria-label={`Trocar o tema do painel para ${rotulo}`}
    >
      <Icone size={15} weight="fill" />
    </button>
  );
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
  const userInitial = session?.usuario?.nome?.charAt(0)?.toUpperCase() || "U";
  const userName    = session?.usuario?.nome || "";
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

  // ── Fila de modais de entrada ─────────────────────────────────────────────────
  // O tour só entra depois que o aviso de conta se resolve (ver o JSX abaixo).
  const [contaResolvida, setContaResolvida] = useState(false);
  const marcarContaResolvida = useCallback(() => setContaResolvida(true), []);
  // Enquanto o tour global ocupa a tela, os tours de tela esperam a vez.
  const [tourGlobalAtivo, setTourGlobalAtivo] = useState(false);

  // ── Ajuda ─────────────────────────────────────────────────────────────────────
  /* `pedidoTour` é um contador que o TourDeTela observa: incrementar reabre o
     tour da tela atual mesmo que ela já tenha sido concluída. Contador e não
     flag porque pedir "rever" duas vezes seguidas tem que funcionar as duas. */
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const [pedidoTour, setPedidoTour] = useState(0);

  // ── Toast ─────────────────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState([]);
  const showToast = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

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
  const grupos = useMemo(() => {
    const g = [
      {
        itens: [{ key: "inicio", Icon: House, label: "Início", active: isDashboard, onClick: () => navigate("/") }],
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
              { key: "rel-leads", Icon: ICONES_RELATORIOS.LEADS, label: "Leads", active: ver === "leads", onClick: () => navigate("/relatorios?ver=leads") },
              { key: "rel-mensal", Icon: ICONES_RELATORIOS.MENSAL, label: "Relatório mensal", active: ver === "mensal", onClick: () => navigate("/relatorios?ver=mensal") },
              { key: "rel-funil", Icon: ICONES_RELATORIOS.FUNIL, label: "Funil de vendas", active: ver === "funil", onClick: () => navigate("/relatorios?ver=funil") },
              { key: "rel-comissoes", Icon: ICONES_RELATORIOS.COMISSOES, label: "Comissões", active: ver === "comissoes", onClick: () => navigate("/relatorios?ver=comissoes") },
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
          cargo?.verAuditoria && { key: "auditoria", Icon: ClockCounterClockwise, label: "Registro de atividade", active: isAuditoria, onClick: () => navigate("/auditoria") },
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
            subitens: ABAS_CONFIG
              .filter((a) => a.key !== "dados" || podeImportar(cargo))
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

  const c = collapsed;

  return (
    <Tooltip.Provider>
      <style>{CSS}</style>

      {/* Fila de dois: primeiro o aviso da CONTA (assinou / está em teste),
          depois o convite ao tour, que é da PESSOA. O segundo espera o
          primeiro se resolver — inclusive quando ele decide não aparecer. */}
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

      <AjudaModal
        open={ajudaAberta}
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
        <aside className={`ds-side${c ? " is-collapsed" : ""}`} data-tour="sidebar">

          {/* Header */}
          <div className="ds-head">
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
                    {item.subitens?.length && !c ? (
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

            {/* Ajuda mora no rodapé, junto das ações que são sobre o sistema e
                não sobre o trabalho — recolher menu, sair, perfil. E fica acima
                delas porque é a única que alguém procura com pressa. */}
            <SideTooltip label="Ajuda" collapsed={c}>
              <button type="button" className="ds-item ds-item--ajuda" data-tour="ajuda" onClick={() => setAjudaAberta(true)}>
                <span className="ds-item__icon"><Question size={16} /></span>
                {!c ? <span className="ds-item__label">Ajuda</span> : null}
              </button>
            </SideTooltip>

            <SideTooltip label="Expandir menu" collapsed={c}>
              <button type="button" className="ds-item" onClick={toggleCollapsed}>
                <span className="ds-item__icon">{c ? <CaretRight size={16} /> : <CaretLeft size={16} />}</span>
                {!c ? <span className="ds-item__label">Recolher menu</span> : null}
              </button>
            </SideTooltip>

            <NavItem Icon={SignOut} label="Encerrar Sessão" onClick={onLogout} collapsed={c} />

            <div className="ds-profile" data-tour="perfil">
              <div className="ds-avatar">{userInitial}</div>
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
                  <SeletorDeTema escolhido={escolhido} aoTrocar={trocarTema} />
                </>
              ) : null}
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
.ds-side.is-collapsed .ds-profile { justify-content: center; padding: 10px 8px; }
.ds-avatar {
  width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: var(--s-avatar); color: var(--s-avatar-ink); font-size: 11px; font-weight: 700;
}
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
  /* O submenu continua abrindo e fechando — só deixa de deslizar. */
  .ds-sub,
  .ds-sub__rail,
  .ds-shell .ds-subitem { transition: none; }
  .ds-sub.is-open .ds-subitem { transition-delay: 0ms; }
}
`;
