import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { BotaoGoogle } from "./BotaoGoogle.jsx";
import { TrialAviso } from "./TrialAviso";
import { FaixaDeConta } from "./FaixaDeConta.jsx";
import { BoasVindasModal } from "./BoasVindasModal";
import { PulsoTrialModal } from "./PulsoTrialModal";
import { PedidoDeAvaliacao } from "./PedidoDeAvaliacao";
import { ComunicadoDeNovidades } from "./novidades/ComunicadoDeNovidades";
import { ComunicadoAvulso } from "./ComunicadoAvulso";
import { PedidoDeEmail } from "./PedidoDeEmail";
import { baseDaVitrine } from "../utils/enderecoVitrine";
import { planoInfo } from "../utils/planos";
import { relatoriosVisiveis, PARAMETRO_DE } from "../utils/relatorios";
import { gruposDoModulo } from "./navegacaoDoPainel.jsx";
import { FLOW, HUB, MODULOS, SIMBOLO_OMNIMOB, moduloDaRota, moduloInfo, modulosDoUsuario } from "../utils/modulos";
import { SeletorDeModulo } from "./SeletorDeModulo.jsx";
import { PrimeiroAcessoTour } from "./PrimeiroAcessoTour";
import { PrimeiroAcessoFlow } from "./PrimeiroAcessoFlow.jsx";
import { TourDeTela } from "./TourDeTela";
import { AjudaModal } from "./AjudaModal";
import { EVENTO_CHAMADOS } from "../utils/suporte";
import { corDeTextoPara } from "./adminUi";
import { montarTourDeTela, telaDaRota } from "../utils/tourTelas";
import { IconeRelatorios, ICONES_RELATORIOS } from "../utils/iconesRelatorios";
import { abasVisiveis } from "../utils/abasConfiguracoes";
import { podeImportar } from "./ImportadorDados.jsx";
import { SeloBeta } from "./SeloBeta.jsx";
import { MenuDoPerfil } from "./MenuDoPerfil.jsx";
import { MenuDeCanto } from "./MenuDeCanto.jsx";
import { CabecalhoDoPainel } from "./CabecalhoDoPainel.jsx";
import { TrilhaDaFaixa } from "./TrilhaDaFaixa.jsx";
import { lerHistorico, registrarTela } from "../utils/historicoDeTelas";
import { BuscaDeAtalhos } from "./BuscaDeAtalhos.jsx";
import { ProvedorDeCabecalho } from "../utils/contextoDeCabecalho.jsx";
import { ModalRascunhosDeImovel } from "./RascunhosDeImovel.jsx";
import { ModalPreferencias, ModalMeusDados } from "./ModaisDoPerfil.jsx";
import { TEMAS, observarSistema, temaEfetivo, temaEscolhido } from "../utils/temaDoPainel";
import { sincronizarComOServidor } from "../utils/layoutCentrado";
import { lerDoTenant, lerDoUsuario, gravarNoUsuario, CHAVES } from "../utils/chaveDoTenant";
import { clearSession } from "../session";
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
  List,
  MagnifyingGlass,
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

/* O `SeloPlano` mudou de casa: ele desenhava o plano dentro do `ds-head`, que
   deixou de existir, e hoje vive na segunda face do rolo — ver
   `SeletorDeModulo`. O CSS dele (`.ds-plano`) continua aqui, junto com o resto
   da folha da barra. */

// ── Item de navegação ──────────────────────────────────────────────────────────
/* `tourId` vira `data-tour` no elemento. É o gancho que o tour guiado usa para
   achar o item — nomeado de propósito, em vez de seletor estrutural: um
   `.ds-nav > div:nth-child(3) a` quebraria calado no dia em que um grupo novo
   entrar no meio do menu. */
function NavItem({ Icon, label, active, onClick, href, collapsed, external, badge, tourId, beta, bloqueado, menu }) {
  /* `has-beta` solta o rótulo do `flex: 1` para o selo sentar ENCOSTADO no
     nome, e não na borda direita do item. Na borda ele leria como o contador de
     leads, que é o outro elemento que mora ali. */
  const cls = `ds-item${active ? " is-active" : ""}${!collapsed && beta ? " has-beta" : ""}${bloqueado ? " is-bloqueado" : ""}`;

  const content = (
    <>
      <span className="ds-item__icon">
        <Icon size={22} weight={active ? "fill" : "regular"} />
        {/* O pip é o contador na forma recolhida: ponto vermelho no canto do
            ícone, porque o número não cabe embaixo do rótulo de 9px. Os dois no
            DOM, um visível de cada vez. */}
        {badge > 0 ? <span className="ds-item__pip" /> : null}
      </span>
      {/* O rótulo é UM só nos dois estados da barra, e é o CSS que o veste:
          ao lado do ícone com a barra aberta, embaixo dele e em 9px com a barra
          recolhida. Dois elementos — um "nome" e uma "legenda" — divergiriam no
          primeiro item renomeado, e o repositório já pagou esse preço no editor
          de vitrine. */}
      <span className="ds-item__label">{label}</span>
      {beta ? <SeloBeta /> : null}
      {/* O degrau de plano, dito no próprio item. O item continua CLICÁVEL: a
          tela do outro lado é o convite ao upgrade, e um item morto na barra só
          ensina que aquele pedaço do produto não funciona. O selo existe para a
          pessoa saber que há um degrau ali antes de gastar o clique. */}
      {bloqueado ? <span className="ds-item__cadeado">{bloqueado}</span> : null}
      {badge > 0 && !bloqueado ? (
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

  const comDica = <SideTooltip label={label} collapsed={collapsed}>{el}</SideTooltip>;

  /* ── Os três pontinhos, quando o item guarda mais do que o destino dele ────
     O "⋮" é IRMÃO do item, e não filho: os dois seriam `<button>`, e botão
     dentro de botão é HTML inválido — o navegador desmonta a árvore e o clique
     de dentro nunca chega. A caixa `.mkb-hospedeiro` abraça os dois, e o CSS
     põe o "⋮" onde o contador de leads já mora. Ver `MenuDeCanto`. */
  if (!menu?.itens?.length) return comDica;

  return (
    <span className="mkb-hospedeiro">
      {comDica}
      <MenuDeCanto
        itens={menu.itens}
        rotulo={menu.rotulo || `Mais opções de ${label}`}
        badge={menu.badge || 0}
        className="mkb-caixa--nav"
        /* Só AQUI, e não no cartão da tela inicial: é a barra que se recolhe
           quando o ponteiro a deixa, e o balão sai por portal. Ver o efeito
           correspondente em `MenuDeCanto`. */
        aoAlternarAberto={menu.aoAlternarAberto}
      />
    </span>
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
  /* O pedido de abrir as Novidades: do menu (a mais recente) ou do link do
     e-mail, que traz a semana em `?novidades=`. O parâmetro sai do endereço ao
     ser lido, para um F5 não abrir de novo. */
  const [pedidoNovidades, setPedidoNovidades] = useState(() => {
    const chave = new URLSearchParams(window.location.search).get("novidades");
    return chave ? { chave } : null;
  });
  const atenderNovidades = useCallback(() => {
    setPedidoNovidades(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has("novidades")) {
      url.searchParams.delete("novidades");
      window.history.replaceState(window.history.state, "", url);
    }
  }, []);
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
  /* A sessão de DEMONSTRAÇÃO (ver DemoPage e `POST /api/auth/demo`): conta
     compartilhada, somente leitura, com o tour obrigatório. O que muda no
     layout: o assistente de boas-vindas não entra (ele grava), o tour entra
     direto sem convite, e uma faixa avisa que nada é salvo. Quem trava a
     escrita é o servidor — aqui é só a conversa com a pessoa. */
  const demo        = Boolean(session?.demo);
  /* Sair da demonstração: limpa a sessão e volta à LANDING — não ao login,
     que é para onde o logout normal vai. Quem estava na demo não tem conta
     para entrar; o lugar dela é a página de onde veio. */
  const sairDaDemo = useCallback((destino = "/") => {
    clearSession();
    /* Navegação completa, e não pelo roteador: a sessão saiu do storage mas
       continua no estado do App, e o `/` com sessão viva cairia no painel. */
    window.location.assign(typeof destino === "string" ? destino : "/");
  }, []);

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

  /* Telas centradas ou em largura total (aba "Painel"). O script do index.html
     já decidiu antes da primeira pintura, pela cópia do navegador ou pelo
     automático; a escolha gravada no SERVIDOR chega com a sessão e é a única
     que pode contrariá-lo — é o que faz a escolha feita noutra máquina valer
     aqui. Nula ("nunca escolhi") não mexe em nada. */
  const layoutDoServidor = session?.usuario?.layoutCentrado;
  useEffect(() => { sincronizarComOServidor(layoutDoServidor); }, [layoutDoServidor]);

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

  /* ── A MOLDURA GANHA FUNDO QUANDO A PÁGINA ROLA ────────────────────────────
     A faixa do topo e o cabeçalho da tela não têm fundo de propósito: parados
     no alto de uma página que cabe na janela, eles são só texto sobre o fundo
     do painel. Mas os dois são presos ao topo (fixed e sticky), e no `/inicio`
     — a primeira tela com rolagem de verdade — o conteúdo passava por baixo
     deles e o título virava texto sobre texto.

     A marca é um atributo no shell, e não estado do React: rolagem dispara
     dezenas de vezes por segundo, e cada uma re-renderizando o layout inteiro
     (barra, cabeçalho, conteúdo) por causa de uma cor de fundo seria pagar
     caro por um sim/não. O DOM muda só quando a resposta muda.

     Refeito a cada troca de rota, porque a rolagem volta a zero e o ouvinte
     não é avisado disso. */
  useEffect(() => {
    const el = shellRef.current;
    if (!el) return undefined;
    let rolou = null;
    function medir() {
      const agora = window.scrollY > 4;
      if (agora === rolou) return;
      rolou = agora;
      if (agora) el.setAttribute("data-rolou", "");
      else el.removeAttribute("data-rolou");
    }
    medir();
    window.addEventListener("scroll", medir, { passive: true });
    return () => window.removeEventListener("scroll", medir);
  }, [location.pathname]);

  /* ── A BARRA ABRE POR CLIQUE, E NÃO MAIS POR HOVER ─────────────────────────

     Ela já viveu recolhida abrindo no `:hover`, e o argumento era que o gesto
     dá os dois — espaço o tempo todo, rótulo quando o olho vai lá. O que ele
     dava de fato era uma barra que se mexia sozinha: atravessar a tela em
     diagonal para chegar num botão do conteúdo abria 176px de menu no caminho,
     e o submenu do índice entrava animando por um gesto que ninguém pediu.

     Agora quem manda é o hambúrguer, no topo da barra. É o arranjo do YouTube,
     e ele resolve o que o hover não resolvia: a barra só muda de tamanho quando
     a pessoa diz para mudar, e recolhida ela continua legível porque cada ícone
     leva o nome embaixo — que era o único trabalho que o hover fazia bem.

     O estado é da PESSOA e mora no navegador dela, como o módulo ativo e a
     última tela: numa recepção com computador compartilhado, quem gosta da
     barra aberta não impõe isso a quem trabalha o dia inteiro no portfólio.
     ────────────────────────────────────────────────────────────────────────── */
  const [barraAberta, setBarraAberta] = useState(() => {
    const guardado = lerDoUsuario(CHAVES.barraAberta, tenantId, session?.usuario?.id);
    /* Recolhida é o padrão: é o estado que devolve a tela inteira ao conteúdo,
       e com os rótulos embaixo dos ícones ele não esconde mais nada. */
    return guardado === "1";
  });
  /* ── O FECHAMENTO TAMBÉM ANIMA ──────────────────────────────────────────────
     A largura da barra leva 0,2s nos dois sentidos, mas só a abertura parecia
     animada. Ao abrir, os rótulos já nascem ao lado dos ícones e o
     `overflow: hidden` os revela conforme a borda anda. Ao recolher, a classe
     saía na hora: os rótulos sumiam no mesmo quadro e, como a barra não tem
     fundo, não sobrava nada visível para encolher — o recolhimento era um
     corte seco com uma transição rodando à toa por baixo.

     `barraFechando` segura a forma ABERTA (`.is-fechando`, tratada como
     `.is-aberta` em toda regra de recolhimento) durante a transição: a borda
     anda para a esquerda recortando os rótulos, que é exatamente o filme da
     abertura ao contrário. Só depois a barra assume a forma de tira. */
  const [barraFechando, setBarraFechando] = useState(false);
  const alternarBarra = useCallback(() => {
    setBarraAberta((v) => {
      const proximo = !v;
      gravarNoUsuario(CHAVES.barraAberta, tenantId, session?.usuario?.id, proximo ? "1" : "0");
      setBarraFechando(!proximo);
      return proximo;
    });
  }, [tenantId, session?.usuario?.id]);
  useEffect(() => {
    if (!barraFechando) return undefined;
    // A MESMA duração da transição de largura de .ds-side__interno.
    const id = setTimeout(() => setBarraFechando(false), 200);
    return () => clearTimeout(id);
  }, [barraFechando]);

  // ── Fila de modais de entrada ─────────────────────────────────────────────────
  /* O tour só entra depois que o aviso de conta se resolve (ver o JSX abaixo).
     Para quem NÃO administra a conta ele já nasce resolvido: o assistente da
     conta nem é montado para essa pessoa, então ninguém chamaria `aoResolver`
     e o tour esperaria para sempre um sinal que não vem. */
  const [contaResolvida, setContaResolvida] = useState(() => demo || !cargo?.verConfiguracoes);
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

  /* ── OS NÚMEROS DOS CHAMADOS ──────────────────────────────────────────────
     `novidades` (o que a pessoa ainda não viu: o suporte respondeu, resolveu…)
     vira o selo vermelho na foto do perfil e no item Ajuda do menu;
     `aguardando` é o "N esperando você" de Meus chamados. Uma ida pequena, na
     abertura, a cada 90 s com a aba à vista, ao voltar para a aba, ao abrir o
     menu e quando uma tela avisa que algo mudou (`EVENTO_CHAMADOS` — abrir o
     chamado marca o visto, e o selo tem de descer na hora). A demonstração não
     pergunta: a conta é de todo visitante, e ninguém ali abre chamado. */
  const [chamados, setChamados] = useState({ aguardando: 0, novidades: 0 });
  const lerChamados = useCallback(() => {
    if (demo || !tenantSlug) return;
    api.chamadosPendentes(tenantSlug)
      .then((d) => setChamados({ aguardando: Number(d?.aguardando) || 0, novidades: Number(d?.novidades) || 0 }))
      .catch(() => { /* o menu funciona sem o selo */ });
  }, [demo, tenantSlug]);
  useEffect(() => {
    lerChamados();
    const relogio = setInterval(() => { if (document.visibilityState === "visible") lerChamados(); }, 90000);
    const aoVoltar = () => { if (document.visibilityState === "visible") lerChamados(); };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener(EVENTO_CHAMADOS, lerChamados);
    return () => {
      clearInterval(relogio);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener(EVENTO_CHAMADOS, lerChamados);
    };
  }, [lerChamados]);
  useEffect(() => { if (menuPerfil) lerChamados(); }, [menuPerfil, lerChamados]);
  /* "Abrir chamado" de dentro de uma tela (Meus chamados) cai no MESMO modal
     do menu — um segundo formulário seria a mesma regra em dois lugares. */
  const abrirChamadoNoModal = useCallback(() => { setAjudaEm("chamado"); setAjudaAberta(true); }, []);

  // ── Toast ─────────────────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState([]);
  const showToast = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  /* Escrita recusada na demonstração (o cliente HTTP avisa por evento — ver
     `request` em api.js). Um aviso só, do layout, em vez de cada formulário
     traduzir o 403 do seu jeito. Sem repetição em rajada: um clique em
     "salvar" pode disparar mais de uma requisição. */
  useEffect(() => {
    if (!demo) return undefined;
    let ultimo = 0;
    const aoBloquear = () => {
      const agora = Date.now();
      if (agora - ultimo < 2500) return;
      ultimo = agora;
      showToast("Isto é uma demonstração: nada é salvo. Crie sua conta para usar de verdade.", "warning");
    };
    window.addEventListener("omnimob:demo-bloqueado", aoBloquear);
    return () => window.removeEventListener("omnimob:demo-bloqueado", aoBloquear);
  }, [demo, showToast]);

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
  /* ── SUB-ROTA TAMBÉM ACENDE O ITEM ──────────────────────────────────────
     Metade dos cadastros do painel virou rota de verdade: `/clientes/novo`,
     `/cargos/:id`, `/tipos-imovel/:id/atributos`. Com `===` puro, abrir um
     desses APAGAVA o item da barra — a pessoa está dentro de Clientes e a
     navegação não mostra nada aceso, como se ela tivesse saído do painel.

     A conferência é por prefixo com a barra: `p.startsWith("/clientes")` sozinho
     acenderia "Clientes" numa hipotética `/clientes-inativos`, que é o tipo de
     rota que aparece meses depois e ninguém liga uma coisa à outra. */
  const sob = (base) => p === base || p.startsWith(`${base}/`);

  const isTiposImovel   = sob("/tipos-imovel");
  const isGerenciarImoveis = p === "/imoveis" || p === "/imoveis/novo" || isTiposImovel;
  const isImovelList    = p === "/imoveis/portfolio";
  /* Insights de um imóvel é `/imoveis/<id>` — qualquer coisa sob o prefixo que
     não seja um dos caminhos nomeados. A lista com um imóvel aberto continua
     sendo "onde a pessoa está" para o item Portfólio. */
  const isInsights      = p.startsWith("/imoveis/") && !isGerenciarImoveis && !isImovelList && p !== "/imoveis/editar";
  const isLeads         = p === "/relatorios" || p === "/leads";
  const isClientes      = sob("/clientes");
  const isUsuarios      = sob("/usuarios");
  const isCargos        = sob("/cargos");
  const isAuditoria     = p === "/auditoria";
  const isConfiguracoes = p === "/configuracoes";
  // Apenas o editor da vitrine (/vitrine/:slug/editar) — não confundir com
  // /imoveis/editar, que é o formulário de imóvel.
  const isShowcaseEditor = p.startsWith("/vitrine/") && p.endsWith("/editar");

  /* ═══════════════════════════════════════════════════════════════════════
     O MÓDULO ATIVO
     ═══════════════════════════════════════════════════════════════════════

     Três fontes, e a precedência resolve todos os casos reais:

       1. A ROTA manda, sempre. Chegar em `/flow/negocios/412` por um link do
          WhatsApp tem que abrir o Flow, mesmo que a última visita tenha sido no
          Hub. Deixar a preferência ganhar aqui mostraria a barra do Hub em
          cima de uma tela do Flow — e a pessoa procuraria o menu que não está
          lá.
       2. A PREFERÊNCIA, para as rotas comuns aos dois (`/configuracoes`) e para
          a entrada em `/`.
       3. O primeiro módulo que a pessoa alcança, quando nada mais diz.

     `disponiveis` cruza o que a conta contratou com o que o cargo abre. É ele
     que também decide se o seletor existe: com um item só, não há o que
     selecionar. */
  const disponiveis = useMemo(
    () => modulosDoUsuario(session?.tenant, cargo),
    [session?.tenant, cargo],
  );

  const moduloDestaRota = moduloDaRota(p);
  /* Rota que pertence aos DOIS. `/configuracoes` é o caso: o Flow acrescenta uma
     aba lá dentro em vez de ter uma tela de configuração própria, então estar
     nela não diz em que módulo a pessoa está. */
  const rotaCompartilhada = p === "/configuracoes";

  const [moduloPreferido, setModuloPreferido] = useState(() => {
    const guardado = lerDoUsuario(CHAVES.moduloAtivo, tenantId, session?.usuario?.id);
    return guardado === FLOW || guardado === HUB ? guardado : null;
  });

  /* O módulo que a barra desenha. Nunca um que a pessoa não alcança — a
     conferência contra `disponiveis` acontece aqui e não na gravação, porque o
     acesso pode ser retirado enquanto a marca antiga segue no navegador. */
  const moduloAtivo = useMemo(() => {
    const candidato = rotaCompartilhada ? (moduloPreferido || moduloDestaRota) : moduloDestaRota;
    if (disponiveis.includes(candidato)) return candidato;
    return disponiveis[0] || HUB;
  }, [rotaCompartilhada, moduloPreferido, moduloDestaRota, disponiveis]);

  /* Guarda a preferência quando ela muda de verdade. Roda depois da renderização
     de propósito: gravar durante o cálculo do módulo faria um efeito colateral
     dentro de um `useMemo`, e o React tem toda liberdade de reexecutá-lo. */
  useEffect(() => {
    if (!tenantId || !session?.usuario?.id) return;
    if (moduloAtivo === moduloPreferido) return;
    setModuloPreferido(moduloAtivo);
    gravarNoUsuario(CHAVES.moduloAtivo, tenantId, session.usuario.id, moduloAtivo);
  }, [moduloAtivo, moduloPreferido, tenantId, session?.usuario?.id]);

  const infoModulo = moduloInfo(moduloAtivo);

  /* Os módulos que esta pessoa alcança MENOS o que ela está usando. É o que a
     seção "Mais da Omnimob" desenha no fim da barra; vazio, ela não existe. */
  const outrosModulos = useMemo(
    () => MODULOS.filter((m) => disponiveis.includes(m.key) && m.key !== moduloAtivo),
    [disponiveis, moduloAtivo],
  );

  /* A paleta de busca. Ctrl+K (⌘K no Mac) é a tecla que todo produto usa para
     isto, e é por isso que ela não passa pelo catálogo de atalhos do painel:
     aquele catálogo é o que a imobiliária PODE remapear, e remapear o ⌘K seria
     desfazer a única convenção que a pessoa já traz de fora. */
  const [buscaAberta, setBuscaAberta] = useState(false);
  /* ⌘ no Mac, Ctrl no resto. Mostrar a tecla errada é pior que não mostrar
     nenhuma: quem lê "Ctrl K" num Mac aperta e não acontece nada, e conclui que
     o atalho está quebrado. */
  const noMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
  const atalhoDeBusca = noMac ? "⌘ K" : "Ctrl K";

  useEffect(() => {
    function aoTeclar(e) {
      if (e.key !== "k" && e.key !== "K") return;
      if (!(e.metaKey || e.ctrlKey)) return;
      /* `preventDefault` porque o Ctrl+K nativo do Firefox foca a barra de
         busca do navegador, e o do Chrome faz o mesmo na omnibox. */
      e.preventDefault();
      setBuscaAberta((v) => !v);
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  /* ── A troca de módulo ──────────────────────────────────────────────────

     O seletor mudou de casa: ele ocupava o topo da barra lateral, onde hoje
     mora o hambúrguer, e agora vive na faixa de marca que atravessa o topo da
     tela. O que ele FAZ não mudou nada.

     Trocar de módulo NAVEGA. Só mudar a barra deixaria a pessoa no Dashboard do
     Hub com o menu do Flow em volta — e o primeiro clique dela seria num item
     que não tem nada a ver com o que está na tela. O destino de cada módulo
     mora em `utils/modulos.js`, junto do resto da definição dele. */
  const trocarDeModulo = useCallback((proximo) => {
    const usuarioId = session?.usuario?.id;

    /* ── ONDE EU ESTAVA ──────────────────────────────────────────────────────
       Guarda a tela atual do módulo que está sendo DEIXADO e tenta reabrir a
       última do módulo de destino. Sem isso, ir ao Flow conferir um negócio e
       voltar jogava a pessoa no Dashboard — e ela tinha de refazer o caminho
       até a tela em que estava trabalhando.

       Duas gavetas, uma por módulo: a volta ao Hub não pode depender do que
       aconteceu no Flow, nem o contrário.

       A tela guardada é só uma SUGESTÃO. Se o cargo perdeu a permissão daquela
       rota no meio do caminho, o painel redireciona como faria com qualquer
       link antigo — e a memória não vira uma porta trancada. */
    const atual = moduloDaRota(location.pathname);
    if (tenantId && usuarioId && atual && atual !== proximo) {
      gravarNoUsuario(
        `${CHAVES.ultimaTelaDoModulo}_${atual}`,
        tenantId,
        usuarioId,
        `${location.pathname}${location.search}`,
      );
    }

    const lembrada = tenantId && usuarioId
      ? lerDoUsuario(`${CHAVES.ultimaTelaDoModulo}_${proximo}`, tenantId, usuarioId)
      : null;
    /* Confere que a rota lembrada é MESMO daquele módulo: uma gaveta antiga,
       de antes de uma rota mudar de lugar, mandaria a pessoa para o módulo
       errado — que é pior do que abrir na tela inicial. */
    const destino = lembrada && moduloDaRota(lembrada) === proximo
      ? lembrada
      : moduloInfo(proximo).inicial(cargo);

    if (tenantId && usuarioId) {
      gravarNoUsuario(CHAVES.moduloAtivo, tenantId, usuarioId, proximo);
    }
    setModuloPreferido(proximo);
    navigate(destino);
  }, [cargo, navigate, tenantId, session?.usuario?.id, location.pathname, location.search]);

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

  /* ── Negócios parados ─────────────────────────────────────────────────────
     O contador do Flow NÃO conta negócios novos, e é a diferença que importa:
     no Hub, "chegou lead" é notícia; no Flow, negócio chegando é o normal do
     dia. O que merece um marcador vermelho é negócio ESQUECIDO — o que ninguém
     encosta há dias e morre de silêncio.

     A conta é do servidor (`GET /api/flow/painel`), e não daqui: "parado" é
     regra de negócio e ela tem que valer igual para o painel, para a barra e
     para o alerta da tela inicial. */
  const [negociosBadge, setNegociosBadge] = useState(0);
  const podeNegocios = Boolean(cargo?.acessarFlow && cargo?.gerenciarNegocios);
  useEffect(() => {
    if (!tenantSlug || !podeNegocios) return undefined;
    let vivo = true;
    function conferir() {
      api.painelFlow(tenantSlug)
        .then((r) => { if (vivo) setNegociosBadge(r?.parados ?? 0); })
        .catch(() => {});
    }
    conferir();
    window.addEventListener("focus", conferir);
    return () => { vivo = false; window.removeEventListener("focus", conferir); };
  }, [tenantSlug, podeNegocios]);

  /* ── Cadastros de imóvel interrompidos ────────────────────────────────────
     O formulário de imóvel é a tela mais longa do painel, e sair dele no meio é
     o normal — falta a metragem, falta o CEP, o cliente ligou. Até aqui isso
     apagava tudo. O rascunho é gravado no servidor pelo próprio formulário
     (`PropertyForm`); o que mora AQUI é a porta de volta.

     Ela fica no `AdminLayout` e não numa rota porque a pergunta ("onde parei?")
     se faz de passagem, a caminho de outra coisa — e porque na maioria dos dias
     a resposta é "não há nada", que não justifica atravessar uma tela para
     descobrir. Chega-se a ela pelos três pontinhos do item "Gerenciar Imóveis",
     na barra e no cartão da tela inicial.

     A releitura acontece ao voltar o foco para a janela e ao SAIR do formulário
     (`isFormularioImovel` deixa de valer): é exatamente aí que um rascunho novo
     acabou de nascer, ou o que existia acabou de virar imóvel publicado. */
  const [rascunhos, setRascunhos] = useState([]);
  const [rascunhosAbertos, setRascunhosAbertos] = useState(false);
  const podeImoveis = Boolean(cargo?.gerenciarImoveis);
  const noFormularioDeImovel = p === "/imoveis/novo" || p === "/imoveis/editar";

  const lerRascunhos = useCallback(async () => {
    if (!tenantSlug || !podeImoveis) return;
    try {
      const r = await api.listarRascunhosImovel(tenantSlug);
      setRascunhos(r?.rascunhos || []);
    } catch {
      /* Silencioso de propósito: é uma conveniência de canto de tela, e um
         toast vermelho por causa dela atrapalharia o trabalho de verdade que
         a pessoa está fazendo na tela de baixo. */
    }
  }, [tenantSlug, podeImoveis]);

  useEffect(() => {
    if (noFormularioDeImovel) return undefined;
    lerRascunhos();
    window.addEventListener("focus", lerRascunhos);
    return () => window.removeEventListener("focus", lerRascunhos);
  }, [lerRascunhos, noFormularioDeImovel]);

  /* O menu dos três pontinhos de "Gerenciar Imóveis", montado uma vez e usado
     nos dois lugares que desenham aquele item — a barra e o cartão da tela
     inicial. Duas cópias divergiriam na primeira opção nova. */
  const menuDeImoveis = useMemo(() => {
    if (!podeImoveis) return null;
    return {
      rotulo: "Mais opções de Gerenciar Imóveis",
      badge: rascunhos.length,
      /* Aqui viajava um `aoAlternarAberto` avisando o layout de que o balão dos
         três pontinhos estava no ar — a barra precisava saber disso para não se
         recolher por baixo dele, já que o balão sai por portal e alcançá-lo com
         o ponteiro era sair do `<aside>`.

         A barra não abre mais por hover: ela fica onde a pessoa a deixou, e o
         balão pode nascer onde quiser. O aviso deixou de ter destinatário. */
      itens: [
        {
          key: "rascunhos",
          Icone: ClockCounterClockwise,
          rotulo: "Cadastros em andamento",
          detalhe: rascunhos.length
            ? "Retome de onde você parou."
            : "Nada pela metade no momento.",
          badge: rascunhos.length,
          aoClicar: () => setRascunhosAbertos(true),
        },
        {
          key: "novo",
          Icone: PlusCircle,
          rotulo: "Novo imóvel",
          detalhe: "Começa um cadastro do zero.",
          aoClicar: () => navigate("/imoveis/novo"),
        },
      ],
    };
  }, [podeImoveis, rascunhos.length, navigate]);

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

  /* ── A navegação sai daqui ─────────────────────────────────────────────────
     Os itens de cada módulo moram em `navegacaoDoPainel.jsx`. O layout continua
     sendo UM: o que troca é o conteúdo da <nav>, e nada mais. `ds-mod`,
     `ds-foot` e a mecânica de recolher/expandir são os mesmos
     elementos nos dois módulos, na mesma posição — é isso que faz a troca
     parecer virar de página em vez de entrar em outro sistema. */
  const grupos = useMemo(
    () => gruposDoModulo(moduloAtivo, {
      cargo,
      plano: session?.tenant?.plano,
      temFlow: disponiveis.includes(FLOW),
      navigate,
      rota: p,
      ver,
      leadsBadge,
      negociosBadge,
      menuDeImoveis,
      showcaseLink,
      showcaseEditorLink,
      flags: {
        isDashboard, isGerenciarImoveis, isImovelList, isInsights, isLeads, isTiposImovel,
        isClientes, isUsuarios, isCargos, isAuditoria, isConfiguracoes, isShowcaseEditor,
      },
    }),
    [
      moduloAtivo, cargo, session?.tenant?.plano, disponiveis, navigate, leadsBadge, negociosBadge,
      menuDeImoveis, showcaseEditorLink, showcaseLink,
      isDashboard, isGerenciarImoveis, isImovelList, isInsights, isLeads, isTiposImovel,
      isClientes, isUsuarios, isCargos, isAuditoria, isConfiguracoes, isShowcaseEditor,
      p, ver,
    ],
  );

  /* ── O ÍCONE DA TELA, no cabeçalho ────────────────────────────────────────
     Ele sai da MESMA lista que a barra lateral desenha, e não de uma tabela
     rota → ícone escrita à parte. É o que garante que o desenho ao lado do
     título e o item aceso no menu nunca discordem — com duas listas, a
     primeira tela nova entraria numa e não na outra.

     O item mais ESPECÍFICO vence: "Categoria de Imóvel" e o pai dela
     "Gerenciar Imóveis" podem estar acesos ao mesmo tempo, e o ícone certo é o
     da tela em que a pessoa está. Como o subitem vem depois do pai na lista
     achatada, o último aceso é o mais fundo. */
  const itemDaTela = useMemo(() => {
    const achatar = (itens) => (itens || []).flatMap((i) => (i ? [i, ...(i.subitens || [])] : []));
    const acesos = grupos.flatMap((g) => achatar(g.itens)).filter((i) => i?.active);
    return acesos.length ? acesos[acesos.length - 1] : null;
  }, [grupos]);
  const IconeDaTela = itemDaTela?.Icon || null;

  /* E o mesmo item alimenta o HISTÓRICO das sugestões da paleta de busca. A
     fonte é uma só de propósito: uma segunda tabela rota → tela discordaria do
     item aceso no menu na primeira tela nova, e o histórico passaria a sugerir
     um nome que a barra não usa. Ver `utils/historicoDeTelas`. */
  useEffect(() => {
    registrarTela(session?.tenant?.id, session?.usuario?.id, itemDaTela?.key);
  }, [itemDaTela?.key, session?.tenant?.id, session?.usuario?.id]);

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
      {cargo?.verConfiguracoes && !demo ? (
      <BoasVindasModal
        tenantSlug={tenantSlug}
        tenantId={tenantId}
        aoResolver={marcarContaResolvida}
        showcaseConfig={session?.tenant?.showcaseConfig}
        /* A ficha preenchida ali dentro traz cores e logo. Sem repassar a
           sessão adiante, o painel só mostraria a identidade nova no próximo
           login — logo depois de a pessoa acabar de escolhê-la. */
        aoAtualizarTenant={(campos) =>
          onSessionUpdate?.({ ...session, tenant: { ...session.tenant, ...campos } })}
      />
      ) : null}

      {/* ── UM TOUR POR MÓDULO ──────────────────────────────────────────
          O do Hub vale para todo mundo que entra no painel; o do Flow só é
          montado quando a pessoa ESTÁ no Flow.

          Montá-lo sempre faria uma consulta ao progresso do tutorial em toda
          sessão de quem só usa o Hub — que é a maioria das contas. E emendar os
          passos do Flow no tour do Hub não funcionaria: a etapa `boas-vindas`
          já está FINALIZADA no banco de todo cliente atual, então nada novo
          dentro daquele fluxo voltaria a aparecer para quem vai contratar o
          módulo. Ver `utils/tourFlow.js`. */}
      {moduloAtivo === FLOW ? (
        <PrimeiroAcessoFlow
          session={session}
          pronto={contaResolvida}
          aoMudarEstado={setTourGlobalAtivo}
        />
      ) : (
        <PrimeiroAcessoTour
          session={session}
          pronto={contaResolvida}
          aoMudarEstado={setTourGlobalAtivo}
          demo={demo}
          aoSairDaDemo={sairDaDemo}
        />
      )}

      {/* Tours de tela: abrem só quando a pessoa entra na página por vontade
          própria, e ficam quietos enquanto o global estiver na frente. */}
      {/* Na demonstração só existe o tour global: os de tela gravam progresso
          ao terminar, e na conta compartilhada isso vira o aviso de "nada é
          salvo" no fim de cada um — ruído sem informação. */}
      {demo ? null : (
        <TourDeTela
          session={session}
          globalAtivo={tourGlobalAtivo}
          pronto={contaResolvida}
          pedido={pedidoTour}
        />
      )}

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

      {/* A avaliação do painel, para quem já é cliente (o trial tem a pergunta
          acima, e o servidor recusa as duas ao mesmo tempo). Nem na
          demonstração nem com o suporte dentro da conta. */}
      {/* O aviso avulso da Omnimob e o pedido de e-mail. Os três avisos (estes
          e as Novidades, abaixo) fazem fila pelo registro de tour: o aberto
          segura os outros. */}
      <ComunicadoAvulso tenantSlug={tenantSlug} pronto={contaResolvida && !tourGlobalAtivo} registrar={!demo && !session?.suporte} />
      {!demo && !session?.suporte ? (
        <PedidoDeEmail session={session} pronto={contaResolvida && !tourGlobalAtivo} onSessionUpdate={onSessionUpdate} />
      ) : null}

      {/* As Novidades da semana: abrem sozinhas uma vez por pessoa (o servidor
          diz qual e já corta o que ela não alcança) e a pedido, por Ajuda ›
          Notas de versão ou pelo link do e-mail (`?novidades=<chave>`). */}
      <ComunicadoDeNovidades
        tenantSlug={tenantSlug}
        pronto={contaResolvida && !tourGlobalAtivo}
        registrar={!demo && !session?.suporte}
        pedido={pedidoNovidades}
        aoAtender={atenderNovidades}
      />

      {!demo && !session?.suporte ? (
        <PedidoDeAvaliacao
          tenantSlug={tenantSlug}
          tenantId={tenantId}
          usuarioId={session?.usuario?.id || ""}
          pronto={contaResolvida && !tourGlobalAtivo}
        />
      ) : null}

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

      {/* Os cadastros de imóvel que ficaram pela metade. Mora aqui, e não numa
          rota, porque a pergunta se faz de passagem — ver o comentário do
          estado, mais acima. */}
      {podeImoveis ? (
        <ModalRascunhosDeImovel
          aberto={rascunhosAbertos}
          aoFechar={() => setRascunhosAbertos(false)}
          tenantSlug={tenantSlug}
          rascunhos={rascunhos}
          aoMudar={lerRascunhos}
          showToast={showToast}
        />
      ) : null}

      {/* A paleta. Fora do `.ds-shell` como os outros modais do layout: ela sai
          por portal, e o que importa é ela existir enquanto o painel existir. */}
      <BuscaDeAtalhos
        aberta={buscaAberta}
        aoFechar={() => setBuscaAberta(false)}
        grupos={grupos}
        modulo={moduloAtivo}
        /* Lido a cada ABERTURA, e não na montagem do layout: o layout não
           remonta ao trocar de tela, então um valor lido lá ficaria congelado
           no que o histórico era quando a sessão começou. */
        historico={buscaAberta ? lerHistorico(session?.tenant?.id, session?.usuario?.id) : null}
      />

      <AjudaModal
        open={ajudaAberta}
        passoInicial={ajudaEm}
        onClose={() => setAjudaAberta(false)}
        tourDaTela={tourDaTela}
        aoReverTour={() => setPedidoTour((n) => n + 1)}
        contexto={{ rota: p, tenantSlug, usuario: session?.usuario?.login || userName, suporte: session?.suporte || null }}
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
        data-modulo={moduloAtivo}
        /* ── Duas cores, duas perguntas ────────────────────────────────────
           `--tenant-primary` é a cor da IMOBILIÁRIA: avatar, iniciais, botão
           primário. Ela é do cliente e varia de conta para conta.

           `--modulo-acento` é a cor do MÓDULO: o seletor, o item ativo da barra
           e os realces do Flow. Ela é do PRODUTO e é igual em toda conta — é
           justamente por não variar que ela consegue dizer, de relance, em qual
           metade do sistema a pessoa está. Colapsá-las numa só faria a troca de
           módulo passar despercebida em qualquer imobiliária que use índigo. */
        style={{
          "--tenant-primary": corPrimaria,
          "--tenant-primary-ink": tintaPrimaria,
          "--modulo-acento": infoModulo.acento,
          "--modulo-acento-suave": infoModulo.acentoSuave,
        }}
      >
        {/* ══ A FAIXA DO TOPO ══════════════════════════════════════════════
            Uma linha atravessando a tela, acima da barra lateral e da coluna, e
            dentro dela UMA caixa com o hambúrguer e o wordmark lado a lado.

            ── POR QUE OS DOIS NA MESMA CAIXA ──

            Eles já moraram em divs separadas — o hambúrguer no alto da barra, o
            wordmark no alto da coluna —, e o preço era um vão de 38px entre os
            dois com uma fronteira invisível no meio: a borda da tira de 92px.
            Duas peças que se leem como um controle único não podem depender de
            duas caixas ficarem alinhadas por coincidência de números.

            ── E A CAIXA É O QUE DEFINE A LARGURA DA BARRA ──

            `.ds-topbar__grupo` mede exatamente `--s-aberta`. Então a barra
            aberta termina onde o grupo termina, e a fronteira entre a moldura e
            o conteúdo é UMA linha vertical contínua do topo ao rodapé — em vez
            de um degrau. Quem manda no número é o token, num lugar só.

            Clicar no wordmark abre o Painel do Gestor; o chevron ao lado troca
            de módulo. Ver `SeletorDeModulo`. */}
        {/* O provedor do cabeçalho abre AQUI, e não na coluna do conteúdo:
            a trilha mora na faixa e lê os degraus do mesmo contexto em que a
            tela grava o próprio título. Abrisse na coluna, a faixa ficaria
            fora dele e a trilha voltaria a nascer só da rota — a tela de
            detalhe ("Negócio #412") perderia o último degrau. */}
        <ProvedorDeCabecalho>
        <header className="ds-topbar">
          <div className="ds-topbar__grupo">
            {/* O ÚNICO jeito de a barra mudar de tamanho: sem ele, ela fica
                onde a pessoa deixou. Ele não anda quando a barra abre — está
                fora dela agora, o que resolve por construção o passo para a
                esquerda que o recuo calculado corrigia à mão. */}
            <button
              type="button"
              className="ds-hamburguer"
              onClick={alternarBarra}
              aria-expanded={barraAberta}
              aria-controls="ds-navegacao"
              aria-label={barraAberta ? "Recolher menu" : "Expandir menu"}
              title={barraAberta ? "Recolher menu" : "Expandir menu"}
            >
              <List size={22} weight="bold" />
            </button>

            <SeletorDeModulo
              atual={moduloAtivo}
              imobiliaria={{
                nome: tenantName,
                slug: session?.tenant?.slug,
                logoUrl: session?.tenant?.logoUrl,
                plano: session?.tenant?.plano,
              }}
              podeVerPainel={podeVerPainel}
              painelAtivo={isInicio}
              aoAbrirPainel={() => navigate("/inicio")}
            />
          </div>

          {/* ── A TRILHA, LOGO DEPOIS DO GRUPO ──────────────────────────────
              Ela começa onde o grupo termina — a mesma vertical em que o
              conteúdo começa lá embaixo, então o caminho se lê alinhado com a
              página que ele descreve. Ver `TrilhaDaFaixa` para o histórico dos
              lugares por onde ela passou. O editor de vitrine não a desenha: a
              barra de ferramentas dele já diz o nome do documento. */}
          {isShowcaseEditor ? null : <TrilhaDaFaixa />}

          {/* ── A SITUAÇÃO DA CONTA, NO MEIO DA FAIXA ──────────────────────
              Ela era uma tarja de largura inteira logo abaixo do cabeçalho, e
              cobrava a altura dela de toda tela do painel, o dia inteiro. Aqui
              vira uma pílula do tamanho do próprio recado, centrada na faixa
              que já existe — a mesma informação, sem uma linha nova na página.

              Centro de verdade: `position: absolute` mais `left/right: 0` e
              `margin: auto` na pílula. Como item do flex ela seria empurrada
              pelo grupo da esquerda (que tem `--s-aberta` de largura) e pela
              busca da direita, e o "meio" cairia diferente conforme a barra
              estivesse aberta ou fechada. Absoluta, ela ignora os dois.

              O `pointer-events` volta só na pílula: a faixa de posicionamento
              atravessa a barra inteira e engoliria o clique do hambúrguer e o
              da busca se recebesse ponteiro. */}
          <div className="ds-topbar__conta">
            <FaixaDeConta tenantSlug={session?.tenant?.slug} />
          </div>

          {/* ── A BUSCA MORA AQUI, E NÃO NO CABEÇALHO DA TELA ───────────────
              Ela desenhava no `.ds-topo__dir`, ao lado do botão primário da
              página. Só que a paleta não é da PÁGINA: ela abre qualquer tela do
              painel, e o que serve a todas as telas pertence à moldura — foi o
              mesmo argumento que trouxe o título da tela para o cabeçalho e a
              navegação para a barra.

              Duas consequências práticas. O botão primário fica sozinho no
              `__dir`, e deixa de disputar o canto com um controle que não tem
              nada a ver com ele. E o editor de vitrine, que troca o cabeçalho
              do painel pela barra de ferramentas própria, passa a ter busca —
              lá só existia o Ctrl+K, para quem soubesse dele.

              O botão tem CARA de campo e é um `<button>` de propósito: o que ele
              abre é a paleta, e um `<input>` aqui prometeria digitar num lugar
              onde ninguém vai digitar. */}
          <button
            type="button"
            className="ds-busca"
            onClick={() => setBuscaAberta(true)}
            aria-label="Buscar telas do painel"
          >
            <MagnifyingGlass size={15} weight="bold" />
            <span className="ds-busca__texto">Buscar no painel…</span>
            <kbd className="ds-busca__tecla">{atalhoDeBusca}</kbd>
          </button>
        </header>

        {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
        {/* `ds-side` reserva a tira no fluxo; `ds-side__interno` é quem cresce,
            por cima do conteúdo. Fosse a própria `aside` a crescer, abrir o menu
            refluiria a página inteira em vez de passar por cima dela. */}
        <aside
          className={`ds-side${barraAberta ? " is-aberta" : ""}${!barraAberta && barraFechando ? " is-fechando" : ""}`}
          data-tour="sidebar"
        >
          <div className="ds-side__interno">

          {/* O hambúrguer subiu para a faixa do topo, junto do wordmark: os
              dois são um controle só para quem olha, e estavam em duas caixas.
              Ver o cabeçalho da `.ds-topbar`, acima. */}

          {/* Navegação */}
          <nav className="ds-nav" id="ds-navegacao">
            {grupos.map((grupo, gi) => (
              <div className="ds-group" key={grupo.label || `g-${gi}`}>
                {/* Recolhida, o nome do grupo simplesmente NÃO aparece.

                    Havia um fio (`ds-group__rule`) fazendo o papel dele ali —
                    separar sem precisar de largura. Ele saiu: com o rótulo
                    embaixo de cada ícone, a tira já tem texto suficiente para
                    o olho achar onde uma coisa termina e outra começa, e o fio
                    virou uma terceira linha horizontal disputando atenção com
                    esses nomes. O que separa os grupos agora é o espaço. */}
                {grupo.label ? <span className="ds-group__label">{grupo.label}</span> : null}
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
                      bloqueado={item.bloqueado}
                      menu={item.menu}
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
                                <sub.Icon size={17} weight={sub.active ? "fill" : "regular"} />
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

            {/* ══ OS OUTROS MÓDULOS ═════════════════════════════════════════
                O esquema do "Mais do YouTube": uma seção no fim da lista, com
                título próprio, oferecendo os OUTROS produtos da casa.

                ── POR QUE ELA SUBSTITUI O CHEVRON ──

                A troca de módulo era um chevron colado no wordmark, no alto da
                barra. Ele funcionava para quem já sabia que existia — e o
                Omniflow é justamente o que a imobiliária pode ainda não ter
                descoberto. Um item com nome, na lista que a pessoa lê todo dia,
                se anuncia sozinho; um chevron dentro da marca, não.

                ── SÓ QUEM TEM O OUTRO MÓDULO VÊ ──

                `disponiveis` já responde as duas perguntas que importam: a
                imobiliária CONTRATOU (`Tenant.modulos`) e este cargo ALCANÇA
                (`Cargo.acessarFlow`). Quem tem um módulo só não vê seção
                nenhuma — e não uma seção vazia, nem um convite de upgrade
                disfarçado de navegação.

                A lista é simétrica: no Omnimob ela oferece o Omniflow, no
                Omniflow ela oferece o Omnimob. É a mesma volta, e é por isso
                que ela sai de `disponiveis` filtrando o atual, em vez de
                perguntar "tem Flow?".

                ── SÓ COM A BARRA ABERTA ──

                Quem esconde é o CSS (`.ds-modulos`), como o resto da barra.
                Recolhida, o nome do módulo não caberia embaixo do ícone sem
                virar duas linhas de três letras, e um símbolo sozinho ali seria
                indistinguível dos onze ícones acima dele. */}
            {outrosModulos.length ? (
              <div className="ds-group ds-modulos">
                <span className="ds-group__label">Mais da Omnimob</span>
                {outrosModulos.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    className="ds-item ds-modulos__item"
                    onClick={() => trocarDeModulo(m.key)}
                    title={m.descricao}
                  >
                    {/* O WORDMARK INTEIRO, e não ícone mais texto.

                        Aqui estava o símbolo da casa dentro de um anel na cor
                        do acento, mais o nome ao lado — e o símbolo é o MESMO
                        nos dois módulos, então quem diferenciava era só a
                        tinta do anel. Um item que leva para outro produto pede
                        a marca daquele produto, não uma pista de cor.

                        As duas artes entram, e quem escolhe é o tema, pelo
                        mesmo mecanismo da faixa do topo: `logoClaro` (letras
                        pretas) quando o painel está claro, `logo` (letras
                        brancas) quando está escuro. Módulo sem arte clara cai
                        no `logo` e no nome em texto — ver `.ds-modulos__tipo`
                        no CSS. */}
                    <img className="ds-modulos__tipo" src={m.logo} alt={m.nome} />
                    {m.logoClaro ? (
                      <img className="ds-modulos__tipo ds-modulos__tipo--claro" src={m.logoClaro} alt={m.nome} />
                    ) : null}
                    {m.logoClaro ? null : <span className="ds-item__label">{m.nome}</span>}
                  </button>
                ))}
              </div>
            ) : null}
          </nav>

          {/* Rodapé */}
          <div className="ds-foot">
            {/* ── O fluxo de assinatura, SEM o selo ─────────────────────────
                O selo de dias restantes saiu daqui: quem diz a situação da
                conta agora é a `FaixaDeConta`, abaixo do cabeçalho. Manter os
                dois faria a mesma contagem aparecer duas vezes na tela e
                discordar no dia em que uma das regras mudasse.

                O COMPONENTE fica: ele é o fluxo inteiro — três passos, Pix,
                Stripe — e escuta `pedirTelaDeAssinatura`, que é o que a faixa
                emite ao ser clicada. Tirá-lo daqui levaria o checkout junto.

                `podeAssinar` segue `verConfiguracoes` — assinar é decisão de
                quem responde pela conta, e é a mesma permissão que abre
                Configurações, onde o plano vive. Era `gerenciarUsuarios`. */}
            <TrialAviso
              tenantSlug={tenantSlug}
              podeAssinar={Boolean(cargo?.verConfiguracoes)}
              aoAssinar={() => window.location.reload()}
              mostrarSelo={false}
            />

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
                aoAbrirChamado={abrirChamadoNoModal}
                aoAbrirSuporte={(numero) => navigate(numero ? `/suporte/${numero}` : "/suporte")}
                aoAbrirNovidades={() => setPedidoNovidades({ chave: null })}
                chamados={chamados}
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
                title={chamados.novidades
                  ? `Sua conta · ${chamados.novidades === 1 ? "1 novidade" : `${chamados.novidades} novidades`} nos seus chamados`
                  : "Sua conta"}
              >
              {/* A inicial some quando há foto; a foto some se falhar ao
                  carregar (URL do Google expira) — e aí a inicial volta, em vez
                  de sobrar um quadrado quebrado. O selo vermelho: chamado
                  respondido (ou resolvido) que a pessoa ainda não abriu. */}
              <span className="ds-avatar-caixa">
                <div className={`ds-avatar${userFoto ? " tem-foto" : ""}`}>
                  {userFoto
                    ? <img src={userFoto} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.remove(); }} />
                    : userInitial}
                </div>
                {chamados.novidades ? (
                  <span className="ds-avatar__aviso" aria-label={`${chamados.novidades} novidades nos seus chamados`}>
                    {chamados.novidades > 9 ? "9+" : chamados.novidades}
                  </span>
                ) : null}
              </span>
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
        {/* ── A COLUNA DO CONTEÚDO ──────────────────────────────────────────
            O cabeçalho e o `<main>` são irmãos dentro dela, e não pai e filho:
            o `<main>` do editor de vitrine ocupa a tela inteira, e um cabeçalho
            dentro dele roubaria altura da prancheta. Ver `data-sem-topo`. */}
        <div className="ds-coluna" data-tema={efetivo}>
        {/* O editor de vitrine é a única tela sem a faixa: ele tem a própria
            barra de ferramentas, com o nome do documento e o estado do
            salvamento, e dois cabeçalhos empilhados comeriam um terço da
            prancheta. */}
        {isShowcaseEditor ? null : (
          <>
            <CabecalhoDoPainel Icone={IconeDaTela} />
            {/* A situação da conta MUDOU DE LUGAR: agora é uma pílula no meio
                da `.ds-topbar`. Ver o comentário lá em cima, no cabeçalho. */}
          </>
        )}
        <main
          className={isShowcaseEditor ? "main-content--editor-vitrine" : "main-content"}
          data-tema={efetivo}
          style={{ flex: 1, minWidth: 0 }}
        >
          {/* A trilha não abre mais o conteúdo: subiu para a `.ds-topbar`,
              ao lado do wordmark. Ver `TrilhaDaFaixa`. */}
          <div key={location.pathname} style={{ animation: "chicEntrance 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards" }}>
            {/* O provedor envolve só o CONTEÚDO, e não a barra: os selos de
                tecla vivem nos botões das telas, e a barra tem os próprios
                rótulos. Envolver tudo obrigaria a barra a re-renderizar a cada
                troca de rota só por causa do contexto. */}
            <ProvedorDeAtalhos session={session}>
              {/* `menuDeImoveis` desce pelo contexto porque o cartão "Gerenciar
                  Imóveis" da tela inicial precisa do MESMO menu que o item da
                  barra — montá-lo de novo lá daria duas listas de opções para
                  o mesmo item, e elas divergiriam na primeira opção nova.
                  `aoMudarRascunhos` é como o formulário avisa que gravou ou
                  descartou um, sem esperar o próximo foco na janela. */}
              <Outlet context={{ showToast, menuDeImoveis, aoMudarRascunhos: lerRascunhos, abrirChamado: abrirChamadoNoModal }} />
            </ProvedorDeAtalhos>
          </div>
        </main>
        </div>
        </ProvedorDeCabecalho>

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
/* ══════════════════════════════════════════════════════════════════════════
   A COLUNA DO CONTEUDO E A FAIXA DE CIMA
   ══════════════════════════════════════════════════════════════════════════

   A coluna existe porque o cabecalho e o <main> sao IRMAOS, e nao pai e filho:
   o editor de vitrine ocupa a tela inteira e nao desenha a faixa, e um <main>
   por dentro do cabecalho o obrigaria a reservar altura para uma faixa que ali
   nao existe.

   A faixa e sticky, e nao fixed: assim ela acompanha a rolagem sem sair do
   fluxo, e o conteudo abaixo continua comecando onde deveria. Fixa, mudar a
   altura dela exigiria lembrar de mudar o padding do <main> no mesmo
   commit — e esquecer disso e como o conteudo acaba escondido atras da barra.
   (Sem crases nestes comentarios: template literal.) */
/* Posicao relativa e z-index 1 porque a regra que fazia isso era
   .ds-shell > main, e o <main> deixou de ser filho direto do shell. Sem ela o
   conteudo volta a disputar camada com a iluminacao do fundo (o ::before).
   (Sem crases nestes comentarios: template literal.) */
.ds-coluna {
  flex: 1; min-width: 0; display: flex; flex-direction: column;
  position: relative; z-index: 1;
}

/* ── A FAIXA CEDE ESPACO QUANDO A BARRA ABRE ────────────────────────────────
   A barra reserva 64px no fluxo e cresce para 240 POR CIMA do conteudo — e tem
   de ser assim, senao cada passada de mouse empurraria a pagina inteira para o
   lado. So que a faixa e o unico elemento que comeca colado nesses 64px: com a
   barra aberta, ela cobria a trilha e o comeco do titulo.

   O conserto e um recuo, nao uma largura: a faixa continua ocupando a coluna
   toda (o fundo desfocado precisa disso, senao aparece uma falha clara entre a
   barra e ela) e apenas o CONTEUDO dela anda para a direita. Continua CSS puro,
   pelo seletor de irmao: a classe muda no <aside> e a coluna inteira responde
   sem que nenhuma tela do painel precise saber que a barra existe.

   O avanco e a diferenca entre os dois estados da barra, e mora em --s-avanco
   (ver o bloco do .ds-shell). Era 176px cravado em seis lugares deste
   repositorio; qualquer mexida na largura da tira exigia acertar todos, e o
   sintoma de esquecer um e o conteudo escondido atras da barra. O padding base
   de 28px entra somado, no proprio calc. */
.ds-side.is-aberta ~ .ds-coluna .ds-topo { padding-left: calc(var(--s-avanco) + 28px); }

/* O conteudo anda junto com a faixa. Antes ele nao precisava: com o teto de
   1200px e a margem automatica sobrava calha dos dois lados, e a barra aberta
   passava por cima de espaco vazio. Sem o teto, a primeira coluna da tabela
   comeca na borda — e a barra a cobria.

   O padding-left aqui SUBSTITUI o das 32/28px do estado normal, entao a conta e
   a mesma da faixa: o avanco da barra mais o respiro que ja existia. As duas
   transicoes compartilham curva e duracao, para o cabecalho e a tabela andarem
   como uma coisa so. */
.ds-side.is-aberta ~ .ds-coluna .main-content { padding-left: calc(var(--s-avanco) + 28px); }
.ds-coluna .main-content { transition: padding-left 0.2s cubic-bezier(0.4,0,0.2,1); }

/* ── O LAYOUT CENTRADO (aba Painel das Configuracoes) ──────────────────────
   Porte do VYA, com as mesmas contas. Com html[data-layout=centrado] — posto
   pelo script do index.html antes da primeira pintura, e trocado ao vivo pelo
   modal; ver utils/layoutCentrado.js —, a barra do topo, o cabecalho da tela e
   o conteudo ficam numa coluna de no maximo --largura-centrada, com a sobra
   dividida entre os dois lados.

   --s-recuo e o quanto a barra aberta avanca sobre a coluna (zero fechada). A
   coluna que centra e a que SOBRA depois dele, entao o recuo entra somado a
   esquerda e descontado da largura. O max() segura o respiro de sempre (28px)
   quando a tela e estreita demais para haver sobra.

   O editor de vitrine fica de fora: ele precisa da tela inteira, e a prancheta
   ja centra a folha sozinha. */
.ds-shell { --s-recuo: 0px; --largura-centrada: 1320px; }
.ds-shell:has(.ds-side.is-aberta) { --s-recuo: var(--s-avanco); }
html[data-layout="centrado"] .ds-shell .ds-coluna .ds-topo,
html[data-layout="centrado"] .ds-shell .ds-coluna .main-content:not(.main-content--editor-vitrine) {
  padding-left: max(calc(var(--s-recuo) + 28px), calc(var(--s-recuo) + (100% - var(--s-recuo) - var(--largura-centrada)) / 2));
  padding-right: max(28px, calc((100% - var(--s-recuo) - var(--largura-centrada)) / 2));
}
/* A faixa do topo ocupa a janela inteira (a coluna comeca depois da tira),
   por isso a tira entra na conta: a busca termina na mesma vertical em que o
   conteudo termina. */
html[data-layout="centrado"] .ds-shell .ds-topbar {
  padding-right: max(28px, calc((100% - var(--s-rail) - var(--s-recuo) - var(--largura-centrada)) / 2));
}
/* A marca comeca onde o CONTEUDO comeca. Com as telas centradas, o conteudo
   recua para o meio e a marca ficava sozinha na ponta esquerda, sem nada
   embaixo dela. Alinhados, a faixa do topo e a pagina tem a mesma margem.

   A conta: a coluna comeca depois da tira (--s-rail) mais o avanco da barra
   aberta (--s-recuo), e dentro dela o conteudo ainda recua metade da sobra ate
   --largura-centrada. Do resultado tiram-se o recuo do grupo (20px), o
   hamburguer (40px) e o vao (8px) — o que ja existe a esquerda da marca. O
   max(0px) segura a marca no lugar quando a tela e estreita demais. */
html[data-layout="centrado"] .ds-shell {
  --alinhamento-marca: max(0px, calc(
    var(--s-rail) + var(--s-recuo)
    + max(28px, (100vw - var(--s-rail) - var(--s-recuo) - var(--largura-centrada)) / 2)
    - 68px
  ));
}
/* O grupo cresce para caber o empurrao; o HAMBURGUER fica onde estava, colado
   na tira da barra lateral. So a marca anda. A largura da marca vira FIXA (a
   que ela ja tinha: o grupo menos hamburguer, vao e recuo): solto o grupo, o
   flex 1 dela nao teria sobra para dividir e ela colapsaria para zero. */
html[data-layout="centrado"] .ds-shell .ds-topbar__grupo { width: auto; }
html[data-layout="centrado"] .ds-shell .ds-topbar .ds-mod {
  flex: none;
  width: calc(var(--s-aberta) - 68px);
  margin-left: var(--alinhamento-marca);
  transition: margin-left 0.25s ease;
}
/* O modal troca o atributo na hora; a transicao evita o pulo. */
.ds-shell .ds-coluna .ds-topo, .ds-shell .ds-topbar { transition: padding 0.25s ease; }
.ds-shell .ds-coluna .main-content { transition: padding 0.25s ease; }
@media (prefers-reduced-motion: reduce) {
  html[data-layout="centrado"] .ds-shell .ds-topbar .ds-mod,
  .ds-shell .ds-coluna .ds-topo, .ds-shell .ds-topbar, .ds-shell .ds-coluna .main-content { transition: none; }
}
/* No celular nenhum recuo vale: o respiro e o do celular de sempre, e a marca
   fica no lugar dela. */
@media (max-width: 900px) {
  html[data-layout="centrado"] .ds-shell { --alinhamento-marca: 0px; }
  html[data-layout="centrado"] .ds-shell .ds-coluna .ds-topo,
  html[data-layout="centrado"] .ds-shell .ds-coluna .main-content:not(.main-content--editor-vitrine) { padding-left: 18px; padding-right: 18px; }
  html[data-layout="centrado"] .ds-shell .ds-topbar { padding-right: 18px; }
}

/* ── A FAIXA DE MARCA NAO SE MEXE, E ISSO E O DESENHO ──────────────────────
   Ela e a unica peca da coluna que nao cede espaco, e o hamburguer ao lado dela
   tambem nao: os dois formam UMA linha no topo da tela, e uma linha que anda
   quando o menu abre deixa de ser moldura.

   Ela sobrevive a barra aberta porque a barra nao tem fundo, e porque o topo
   dela guarda so o hamburguer: na altura que a faixa ocupa, a barra aberta esta
   vazia, e o wordmark continua visivel atraves dela. Se um dia a barra voltar a
   ser opaca, e ESTA a regra que passa a precisar de um recuo. */

/* ── E A FAIXA DE CONTA, QUE CEDE POR MARGEM E NAO POR PADDING ─────────────
   Ela ficou para tras das outras tres, e o sintoma dela era diferente: o
   conteudo e CENTRALIZADO, entao nada desaparecia atras da barra — o aviso so
   deixava de estar no meio do espaco livre, e caminhava para a esquerda a cada
   abertura do menu.

   MARGEM, e nao padding como o cabecalho e o conteudo usam. A faixa e a unica
   peca com fundo de COR PROPRIA (papel quente, ambar ou vermelho conforme a
   situacao da conta), e com padding a CAIXA continuaria comecando nos 92px: o
   papel colorido aparecia por baixo da barra aberta — que nao tem fundo — como
   uma tira rosa atravessando o menu. A margem move a caixa inteira, e a cor
   passa a comecar onde a barra termina.

   O respiro base dela e 20px, e nao 28 como o do cabecalho: a conta e a mesma,
   o numero e o dela. A regra vence a de .fc-faixa (que mora no style do proprio
   componente) por especificidade, e nao por ordem de folha — as duas folhas
   entram em momentos diferentes, e a ordem nao e coisa que este arquivo
   controle.
   (Sem crases nestes comentarios: template literal.) */
.ds-topo {
  /* Cola embaixo da faixa de marca, que e sticky no topo da mesma coluna: as
     duas coladas no topo ao mesmo tempo se sobreporiam. Ver --s-topbar no
     bloco do .ds-shell. */
  position: sticky; top: var(--s-topbar); z-index: 30;
  display: flex; align-items: flex-end; justify-content: space-between; gap: 20px;
  padding: 18px 28px 14px;
  /* O desfoque e o que permite a faixa ser translucida sem o texto de baixo
     atravessar. O prefixo -webkit- junto porque o Safari ainda o exige. */
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  /* Sem fundo no topo da pagina; com a pagina rolada, o fundo do CONTEUDO
     (--bg-gradient-1, que o tema claro redefine logo abaixo) a 88% — o
     desfoque acima faz o resto. Ver data-rolou no JSX. */
  background: transparent; border-bottom: 1px solid transparent;
  /* A MESMA curva e a mesma duracao da barra (ver .ds-side__interno): com
     tempos diferentes, o titulo chegava no lugar antes ou depois da barra e o
     gesto lia como dois movimentos em vez de um. */
  transition: padding-left 0.2s cubic-bezier(0.4,0,0.2,1), background-color 0.2s ease, border-color 0.2s ease;
}
.ds-shell[data-rolou] .ds-topo {
  background: color-mix(in srgb, var(--bg-gradient-1) 88%, transparent);
  border-bottom-color: var(--s-border);
}
/* ── COM A FAIXA, O CABECALHO PERDE A PROPRIA LINHA ─────────────────────────

   Cabecalho e faixa sao coisas diferentes no codigo e UMA coisa so para quem
   olha: as duas ficam grudadas no topo, na largura inteira, acima do conteudo.
   Com duas bordas de baixo elas se leem como dois blocos empilhados; com uma
   so, embaixo da faixa, leem-se como um cabecalho de duas alturas — que e o que
   sao.

   Vale para os tres tons da faixa, e nao so para o de teste. Eles sao estados
   do mesmo componente, no mesmo lugar, e nunca aparecem juntos: a linha que
   fecha o topo e a da faixa que estiver ali.

   Especificidade dobrada com .ds-shell de proposito. A regra do tema claro no
   styles.css repinta border-bottom-color com o mesmo peso (0,3,0), e qual das
   duas venceria passaria a depender da ordem em que as folhas entram — que nao
   e coisa que este arquivo controle.
   (Sem crases nestes comentarios: template literal.) */
/* A esquerda do cabecalho e uma LINHA: o icone da tela, e ao lado a coluna com
   titulo e subtitulo. Era so a coluna — o icone entrou depois que a trilha
   desceu para o conteudo e sobrou ar aqui.
   (Sem crases nestes comentarios: template literal.) */
.ds-topo__esq { min-width: 0; display: flex; align-items: center; gap: 12px; }
.ds-topo__texto { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
/* Tingido pelo acento do MODULO, como o resto da moldura: e ele que diz se voce
   esta no Omnimob ou no Omniflow, e o icone da tela e o lugar mais visivel onde
   essa distincao cabe sem ocupar espaco novo. */
.ds-topo__icone {
  flex: none; width: 34px; height: 34px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  color: var(--modulo-acento, #6366f1);
  background: color-mix(in srgb, var(--modulo-acento, #6366f1) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--modulo-acento, #6366f1) 22%, transparent);
}
/* Em tela estreita ele sai: ali a largura toda e do titulo. */
@media (max-width: 560px) {
  .ds-topo__icone { display: none; }
}
.ds-topo__titulo {
  margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;
  color: var(--text-main); line-height: 1.2;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ds-topo__sub {
  margin: 0; font-size: 12.5px; color: var(--text-muted); line-height: 1.45;
  overflow: hidden; text-overflow: ellipsis;
  /* Duas linhas no maximo: alguns subtitulos do Flow tem tres frases, e a faixa
     e sticky — cada linha dela e altura que o conteudo perde em toda rolagem. */
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.ds-topo__dir { display: flex; align-items: center; gap: 12px; flex: none; }
.ds-topo__acao { flex: none; }

/* O gatilho da busca tem CARA de campo e e um botao: o que ele abre e a paleta,
   e um <input> aqui prometeria digitar no lugar onde ninguem vai digitar. */
.ds-shell .ds-busca, .ds-busca {
  display: flex; align-items: center; gap: 9px; width: auto;
  padding: 8px 12px; border-radius: 10px; cursor: pointer;
  background: var(--sup-04, rgba(255,255,255,0.04));
  border: 1px solid var(--linha-10, rgba(255,255,255,0.1));
  color: var(--text-muted); font-family: inherit; font-size: 12.5px; font-weight: 500;
  box-shadow: none; transform: none;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}
.ds-shell .ds-busca:hover, .ds-busca:hover {
  color: var(--text-main); background: var(--sup-06, rgba(255,255,255,0.06));
  border-color: var(--linha-18, rgba(255,255,255,0.18));
  box-shadow: none; transform: none;
}
.ds-busca__texto { min-width: 128px; text-align: left; }
.ds-busca__tecla {
  padding: 2px 6px; border-radius: 5px; font-size: 10.5px; font-weight: 600;
  font-family: var(--s-mono, ui-monospace, monospace);
  background: var(--sup-08, rgba(255,255,255,0.08));
  border: 1px solid var(--linha-10, rgba(255,255,255,0.1));
}

/* Em tela estreita o rotulo e a tecla saem e sobra a lupa: o titulo da tela e o
   botao primario tem prioridade sobre um atalho que, no celular, nem existe. */
@media (max-width: 900px) {
  .ds-topo { padding: 14px 18px 12px; gap: 12px; }
  .ds-side.is-aberta ~ .ds-coluna .ds-topo,
  .ds-side.is-aberta ~ .ds-coluna .main-content { padding-left: 18px; }
  .ds-busca__texto, .ds-busca__tecla { display: none; }
  .ds-busca { padding: 8px; }
  .ds-topbar { padding-right: 18px; }
}

.ds-shell {
  /* ── A GEOMETRIA DA BARRA, NUM LUGAR SO ──────────────────────────────────
     --s-rail e a tira recolhida, --s-aberta e a barra aberta, e --s-avanco e a
     diferenca entre as duas — que e o quanto o conteudo ao lado precisa ceder.
     Estavam cravadas como 64px, 240px e 176px espalhadas por este arquivo e
     pelo styles.css; mudar a tira de tamanho pedia acertar seis lugares.

     A tira cresceu de 64 para 92px porque agora ela carrega o NOME embaixo de
     cada icone. Em 64px o rotulo saia em duas linhas de tres letras; em 84 a
     palavra mais longa do menu ("Configuracoes") ainda quebrava e deixava um
     "s" orfao na segunda linha. Quem manda no numero e a palavra mais longa,
     nao a estetica da tira.
     (Sem crases nestes comentarios: template literal.) */
  --s-rail: 92px;
  /* ── A LARGURA DA BARRA ABERTA E A DO GRUPO DO TOPO ──────────────────────
     Os 268px nao sao gosto: e o que [hamburguer + ladrilho + wordmark +
     chevron] pede para caber lado a lado sem apertar a arte. E como a
     .ds-topbar__grupo mede exatamente este token, a barra aberta termina onde o
     wordmark termina e a fronteira da moldura vira uma linha vertical unica.
     Encolher isto aperta o grupo; alargar abre um vao a direita do chevron. */
  --s-aberta: 268px;
  --s-avanco: calc(var(--s-aberta) - var(--s-rail));
  /* A faixa de marca do topo. Tres elementos leem este numero — o padding do
     shell, o topo da barra lateral e o do cabecalho sticky —, e um deles
     ficando para tras e o sintoma classico: conteudo escondido atras de barra.
     (Sem crases nestes comentarios: template literal.) */
  --s-topbar: 52px;

  /* Acompanha o escurecimento do fundo: contra o novo #0a0a0b quase neutro, o
     azul-noite que a sidebar tinha (#0c0f1a) deixava de ser sutil e passava a
     ler como um painel de outra cor. Continua um degrau acima do conteúdo, para
     as duas áreas não virarem uma chapa só. */
  --s-bg: #0d0d12;
  --s-border: rgba(255,255,255,0.07);
  --s-sep: rgba(255,255,255,0.06);
  --s-text: #94a3b8;
  --s-rotulo: #64748b;
  --s-strong: #f1f5f9;
  --s-hover: rgba(255,255,255,0.05);
  /* A pilula do item ativo. NEUTRA, e nao tingida pelo acento do modulo: o
     acento ja diz em que modulo a pessoa esta em quatro outros lugares da
     moldura, e aqui ele competia com o proprio icone preenchido. Cinza a 50%
     sobre o quase-preto da barra da o degrau sem virar uma cor. */
  --s-ativo: rgba(70,70,70,0.5);
  --s-accent: #818cf8;
  --s-sombra: 24px 0 60px -24px rgba(0,0,0,0.75);
  /* Vem do perfil do tenant (inline, logo acima no JSX). O #4f46e5 é só a rede
     de segurança para quando a sessão ainda não trouxe a cor. */
  --s-avatar: var(--tenant-primary, #4f46e5);
  --s-avatar-ink: var(--tenant-primary-ink, #fff);
  --s-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;

  display: flex; min-height: 100vh;
  font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
  position: relative;
  /* O espaco da faixa fixa do topo. Com o box-sizing border-box global
     (styles.css, no reset) ele entra DENTRO dos 100vh e nao cria rolagem. */
  padding-top: var(--s-topbar);
}

/* ══════════════════════════════════════════════════════════════════════════
   A FAIXA DO TOPO, E O GRUPO QUE DEFINE A LARGURA DA BARRA
   ══════════════════════════════════════════════════════════════════════════

   Uma linha atravessando a tela inteira, acima da barra lateral e da coluna.

   Ela ja morou dentro da coluna, comecando onde a tira de 92px terminava. O que
   isso custava era o hamburguer de um lado da fronteira e o wordmark do outro,
   com um vao de 38px no meio — duas caixas que precisavam ficar alinhadas por
   coincidencia de numeros para se lerem como um controle unico.

   ── O GRUPO ──

   .ds-topbar__grupo mede exatamente --s-aberta, e e isso que amarra as duas
   metades da moldura: a barra aberta termina onde o grupo termina, e a fronteira
   entre moldura e conteudo passa a ser UMA linha vertical continua, do topo ao
   rodape, em vez de um degrau. Mexer no token move as duas juntas.

   z-index 50 e ela ACIMA da barra (que tem 10 no aside e 40 no interno): a barra
   aberta desliza por baixo da faixa, e o hamburguer nao fica coberto pelo painel
   que ele mesmo abriu.

   Fixed e nao sticky: a barra lateral tambem e fixa, e uma faixa que rolasse
   para fora deixaria uma tira vazia de 52px acima dela no primeiro scroll.

   Pinta com --s-bg, a familia da barra e nao a do conteudo: as duas sao a
   MOLDURA, e o L so se le como uma peca se tiverem o mesmo tom.
   (Sem crases nestes comentarios: template literal.) */
.ds-topbar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 50;
  height: var(--s-topbar);
  display: flex; align-items: center;
  /* So a direita: o recuo da esquerda e do grupo, que alinha o hamburguer com o
     eixo dos icones da tira. Os 28px sao os mesmos que o cabecalho da tela usa
     do outro lado — a busca desceu de altura, nao de coluna, e continua na
     mesma vertical em que a mao ja a procurava. */
  padding-right: 28px;
  /* Sem fundo enquanto a pagina esta no topo; ganha o da MOLDURA (--s-bg, a
     familia da barra, que ja e o tom certo em cada tema) quando ela rola —
     ver data-rolou no JSX. A transicao e para a cor nao aparecer de estalo no
     primeiro pixel de rolagem. */
  background: transparent; border-bottom: 1px solid transparent;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}
.ds-shell[data-rolou] .ds-topbar {
  background: var(--s-bg); border-bottom-color: var(--s-border);
}
/* A faixa e o cabecalho colam no topo, um sobre o outro; a linha que fecha o
   conjunto e a de baixo, entao a da faixa some quando os dois estao pintados.
   Vale so no caso em que ha cabecalho abaixo dela (nao ha no editor). */
.ds-shell[data-rolou]:has(.ds-topo) .ds-topbar { border-bottom-color: transparent; }
.ds-topbar__grupo {
  width: var(--s-aberta); flex: none; box-sizing: border-box;
  display: flex; align-items: center; gap: 8px;
  padding: 0 0 0 20px;
}

/* ── A TRILHA DENTRO DA FAIXA ──────────────────────────────────────────────
   Ela e um item do flex logo depois do grupo, e por isso comeca onde a barra
   aberta termina — a mesma vertical do conteudo la embaixo. flex: 0 1 auto
   com min-width: 0 e o que a deixa ENCOLHER quando a tela aperta: sem o
   min-width, o nowrap dos degraus a faria empurrar a busca para fora da
   tela em vez de reticenciar o texto (o .trilha__texto ja tem ellipsis).

   nowrap e margin zero desfazem o que a folha base da trilha assume — la
   ela era uma linha do conteudo, com respiro embaixo e quebra livre; aqui
   ela tem a altura da faixa e uma linha so.

   As cores sao da familia --s-*, pelo mesmo motivo da busca logo abaixo: os
   tokens de conteudo (--text-muted, --text-main) so trocam de valor dentro
   do <main> no tema claro, e fora dali a trilha ficaria cinza-claro sobre
   fundo claro. Moldura le os tokens da moldura.

   O respiro a esquerda e menor que o vao do grupo: o ultimo elemento do
   grupo e o chevron do seletor de modulo, e a trilha colada nele leria como
   parte dele. Abaixo de 900px a faixa ja esta apertada entre hamburguer e
   busca, e a trilha sai — e a mesma regra da pilula da conta; o cabecalho da
   tela continua dizendo onde a pessoa esta.
   (Sem crases nestes comentarios: template literal.) */
.ds-topbar__trilha {
  flex: 0 1 auto; min-width: 0;
  padding-left: 10px;
  --trilha-hover: var(--s-hover);
}
.ds-topbar__trilha .trilha { flex-wrap: nowrap; margin: 0; }
.ds-topbar__trilha .trilha__degrau,
.ds-topbar__trilha .trilha__seta { color: var(--s-text); }
.ds-topbar__trilha .trilha__degrau:hover:not(:disabled),
.ds-topbar__trilha .trilha__degrau.is-atual { color: var(--s-strong); }
@media (max-width: 900px) {
  .ds-topbar__trilha { display: none; }
}

/* ── A PILULA DA CONTA, NO CENTRO DA FAIXA ────────────────────────────────
   O invólucro só posiciona; quem desenha continua sendo a .fc-faixa, na folha
   do proprio FaixaDeConta. Ele atravessa a barra de ponta a ponta para o
   margin:auto ter contra o que centralizar, e por isso NAO recebe ponteiro:
   se recebesse, engoliria o clique do hamburguer e o da busca, que ficam por
   baixo dele nas pontas.

   max-width em vez de largura: o recado encolhe com a tela em vez de passar
   por cima da busca. Abaixo de 900px ela sai — ali a faixa ja esta apertada
   entre o hamburguer e a busca, e uma pilula de 200px cortada no meio nao
   informa nada. Quem precisa da situacao da conta continua tendo o modal.
   (Sem crases nestes comentarios: template literal.) */
.ds-topbar__conta {
  position: absolute; left: 0; right: 0; margin: 0 auto;
  width: max-content; max-width: min(560px, calc(100% - var(--s-aberta) - 260px));
  pointer-events: none;
}
.ds-topbar__conta > * { pointer-events: auto; }

/* A tarja vira pilula: cantos redondos, sem borda de baixo (ela nao separa mais
   nada — nao ha conteudo embaixo dela), e o respiro apertado para caber na
   altura da faixa sem empurra-la. */
.ds-topbar__conta .fc-faixa {
  --fc-respiro: 4px;
  border-radius: 999px;
  border-bottom: 0;
  padding-right: 38px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.10), inset 0 0 0 1px rgba(255,255,255,0.07);
  white-space: nowrap;
}
.ds-topbar__conta .fc-sub { overflow: hidden; text-overflow: ellipsis; }
.ds-topbar__conta .fc-fechar { right: 8px; }

@media (max-width: 900px) {
  .ds-topbar__conta { display: none; }
}

/* ── A BUSCA DENTRO DA FAIXA ───────────────────────────────────────────────
   margin-left auto e o que a joga para a direita: a faixa e um flex de dois
   filhos, e o grupo da esquerda tem largura fixa. Ela fica no mesmo canto da
   tela onde ja estava quando morava no cabecalho — o que mudou foi a altura,
   nao o lado, e a mao vai para o mesmo lugar.

   As cores saem da familia --s-*, e nao dos tokens de conteudo. A regra base
   dela le --text-muted e --sup-04, que o tema claro so redefine DENTRO do
   <main>: fora dali ela ficaria com os valores do escuro — texto cinza-claro e
   fundo branco a 4% sobre uma faixa clara, ou seja, quase invisivel. Aqui ela e
   moldura, e moldura le os tokens da moldura.
   (Sem crases nestes comentarios: template literal.) */
.ds-shell .ds-topbar .ds-busca {
  margin-left: auto; flex: none;
  color: var(--s-text);
  background: var(--s-hover);
  border-color: var(--s-border);
}
.ds-shell .ds-topbar .ds-busca:hover {
  color: var(--s-strong);
  background: var(--s-hover);
  border-color: color-mix(in srgb, var(--s-strong) 22%, transparent);
}
.ds-topbar .ds-busca__tecla {
  background: color-mix(in srgb, var(--s-strong) 8%, transparent);
  border-color: var(--s-border);
}

/* ── O SELETOR DE MODULO DENTRO DA FAIXA ───────────────────────────────────
   A folha dele nasceu para o alto da barra lateral: uma faixa de identidade da
   largura da barra, com fundo tingido pelo acento e borda embaixo. Numa barra
   horizontal isso vira uma segunda faixa dentro da faixa.

   Aqui ele volta a ser o que e — um controle inline. Especificidade dupla
   (.ds-topbar .ds-mod) vence a regra base sem depender da ordem da folha, que e
   o que impede este bloco de virar um jogo de quem vem primeiro.

   O ladrilho do simbolo continua escondido, e agora por um motivo novo: a marca
   a esquerda ja desenha o predio, e dois predios na mesma linha leem como erro
   de montagem — o mesmo argumento que ja valia com a barra aberta.
   (Sem crases nestes comentarios: template literal.) */
.ds-topbar .ds-mod {
  border-bottom: 0; border-radius: 10px;
  background: transparent;
}
.ds-topbar .ds-mod__atual, .ds-topbar .ds-mod.is-solo {
  height: 36px; padding: 0 6px 0 10px; gap: 8px;
}
/* O rolo encolhe para caber nos 36px da faixa. A janela e o trilho vivem de
   --altura, entao um numero resolve os dois.

   flex 1 e min-width 0, e nao uma largura minima: o rolo e a peca ELASTICA do
   grupo, entao a soma [hamburguer + ladrilho + rolo + chevron] fecha exatamente
   nos --s-aberta e o chevron encosta na borda direita do grupo. Com min-width
   fixo, mexer no token de largura da barra ou trocar a arte do wordmark
   estouraria o grupo e o chevron sairia do lugar. */
.ds-shell .ds-topbar .ds-mod { flex: 1; min-width: 0; }
.ds-shell .ds-topbar .ds-mod__rolo { --altura: 32px; flex: 1; min-width: 0; }
.ds-topbar .ds-mod__face { padding: 0 6px; }
/* O ladrilho do simbolo volta SO NO TEMA CLARO, e a condicao nao e estetica: e
   ali que a arte do wordmark da lugar ao texto (ver abaixo), e sem o ladrilho a
   faixa ficaria sem marca nenhuma. No escuro a arte JA traz o predio dentro
   dela, e os dois lado a lado leem como erro de montagem — foi o que a captura
   mostrou: dois predios dourados em sequencia antes da palavra. */
.ds-shell[data-tema="claro"] .ds-topbar .ds-mod__marca { display: flex; }
/* ... menos quando o modulo TEM a arte clara: ai a tipografia volta inteira,
   com o predio dentro dela, e o ladrilho voltaria a ser o segundo predio. */
.ds-shell[data-tema="claro"] .ds-topbar .ds-mod--arte-clara .ds-mod__marca { display: none; }

/* ── O NOME DO MODULO NA FAIXA CLARA ───────────────────────────────────────
   As artes do wordmark tem as letras BRANCAS. Sobre a faixa clara do painel
   elas desapareciam: a captura mostrava "OMNIMOB" invisivel ao lado do
   ladrilho.

   Filtro nao resolve. brightness(0) escurece a imagem inteira e mata o ROSA do
   "flow", que e o sinal do modulo; invert() vira o dourado do predio em azul.
   As duas metades da arte precisam de tratamentos opostos, e filtro so sabe
   fazer um. Entao sao DUAS SAIDAS, e o modulo escolhe pela arte que tem:

   1. TEM arte clara (logoClaro, letras pretas) — hoje so o Omnimob. Troca-se
      a imagem, e nada mais muda: as duas tem o mesmo quadro 2852x603 e o
      simbolo em x 0..499, entao a altura serve para as duas. E a saida boa: a
      tipografia da marca aparece nos dois temas.

   2. NAO TEM — hoje o Omniflow. Entra a PALAVRA, tingida pelo acento (rosa no
      Omniflow), que e o que os dois faziam antes de a arte preta existir. Nao
      e sobra de codigo: e o que faz um modulo novo, ou uma arte que ainda nao
      foi desenhada, aparecer com marca em vez de aparecer vazio.

   As formas ficam TODAS no DOM e quem escolhe e o tema, no CSS. Nao sao versoes
   de um componente: sao renderizacoes de UM nome, que sai de modulo.nome nas
   tres. Ver LogoModulo e NomeDoModulo, no componente.
   (Sem crases nestes comentarios: template literal.) */
.ds-mod__palavra { display: none; }
/* Um seletor a mais do que parece preciso, e por um motivo: a arte clara TAMBEM
   e um .ds-mod__tipo, e a regra de tamanho dela (mais abaixo neste arquivo)
   declara display:block. Com a mesma especificidade, quem vem depois ganha — e
   as duas artes apareciam juntas no escuro. O .ds-mod__logo desempata. */
.ds-mod__logo .ds-mod__tipo--claro { display: none; }

/* 1. Com arte clara: troca-se a imagem. */
.ds-shell[data-tema="claro"] .ds-mod--arte-clara .ds-mod__tipo { display: none; }
.ds-shell[data-tema="claro"] .ds-mod--arte-clara .ds-mod__tipo--claro { display: block; }

/* 2. Sem arte clara: a arte branca sai e entra a palavra. */
.ds-shell[data-tema="claro"] .ds-mod:not(.ds-mod--arte-clara) .ds-mod__face .ds-mod__logo {
  display: none;
}
.ds-shell[data-tema="claro"] .ds-mod:not(.ds-mod--arte-clara) .ds-mod__palavra {
  display: block;
  font-size: 15px; font-weight: 700; letter-spacing: -0.015em;
  color: var(--modulo-acento, #6366f1); white-space: nowrap;
}

/* Em tela estreita a faixa aperta, e o nome da imobiliaria dentro do rolo do
   seletor e o primeiro a sobrar. */
@media (max-width: 560px) {
  .ds-shell .ds-topbar .ds-mod__rolo { min-width: 120px; }
}

/* ══════════════════════════════════════════════════════════════════════════
   A BARRA ACOMPANHA O TEMA
   ══════════════════════════════════════════════════════════════════════════

   Ate aqui a barra ficava escura nos dois temas, e o argumento estava escrito
   em tres arquivos: ela e a moldura do produto, e uma tira escura na esquerda
   seria a ancora visual que identifica o Omnimob.

   O argumento nao se sustentou no uso. No tema claro o painel inteiro e #f6f7f9
   e a barra era uma faixa quase preta colada nele — nao lia como moldura, lia
   como um painel de outro programa aberto do lado. Tema e uma escolha da
   PESSOA, e escolher o claro e escolher a tela toda clara.

   Sao os mesmos tokens --s-*, redefinidos. Nenhuma regra da barra e reescrita:
   quem le --s-bg, --s-text e --s-hover ja e todo mundo aqui, e escrever um
   segundo bloco de regras por tema seria a segunda folha de estilo que este
   arquivo passa o tempo todo evitando.

   O fundo e EXATAMENTE o do shell (#f6f7f9), e nao um branco ou um cinza um
   degrau acima: no claro a separacao quem faz e a borda de 1px: um degrau de
   tom viraria uma tira cinza atravessando a tela.
   (Sem crases nestes comentarios: template literal.) */
.ds-shell[data-tema="claro"] {
  --s-bg: #f6f7f9;
  --s-border: rgba(15,23,42,0.10);
  --s-sep: rgba(15,23,42,0.08);
  /* O icone nao selecionado: contorno ESCURO sobre o claro, como o claro pede.
     E o simetrico do #94a3b8 do tema escuro — mesmo papel, tinta invertida. */
  --s-text: #475569;
  --s-rotulo: #7c8797;
  --s-strong: #0f172a;
  --s-hover: rgba(15,23,42,0.055);
  /* O simetrico da pilula: sobre #f6f7f9 quem da o degrau e a tinta ESCURA a
     8%. O cinza a 50% do tema escuro, aqui, seria mais claro que o fundo. */
  --s-ativo: rgba(15,23,42,0.08);
  --s-accent: #4f46e5;
  /* A sombra preta a 75% do escuro vira uma nuvem cinza sobre fundo claro.
     Aqui ela encolhe e clareia — mesma funcao, tinta de novo invertida. */
  --s-sombra: 18px 0 40px -22px rgba(15,23,42,0.30);
}

/* O selo do teste vive na barra e nao no conteudo, entao ele nao alcanca os
   tokens do tema — as cores dele sao literais. No claro, o dourado claro
   (#e8d79b) sobre fundo claro era texto quase invisivel. */
.ds-shell[data-tema="claro"] .tv-botao {
  background: rgba(212,175,55,0.16); border-color: rgba(212,175,55,0.45); color: #7a611a;
}
.ds-shell[data-tema="claro"] .tv-botao:hover {
  background: rgba(212,175,55,0.26); border-color: rgba(212,175,55,0.65); color: #5c480f;
}
.ds-shell[data-tema="claro"] .tv-botao.is-expirado {
  background: rgba(239,68,68,0.10); border-color: rgba(239,68,68,0.32); color: #b91c1c;
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
    radial-gradient(700px 500px at 98% 92%, rgba(99,102,241,0.07), transparent 70%);
}

/* Acima da iluminação. A sidebar já tinha z-index próprio; o conteúdo não. */
.ds-shell > main { position: relative; z-index: 1; }

/* ── A barra vive RECOLHIDA e abre no HAMBURGUER ─────────────────────────────
   A aside guarda a tira no fluxo e nunca muda de tamanho. Quem cresce e a
   sobrepõe é o filho, em position fixed — assim o conteúdo ao lado não é
   empurrado, e a página não refaz o layout inteiro por causa de um clique.

   O gatilho e uma CLASSE agora (.is-aberta), e nao mais :hover/:focus-within.
   Com o hover, a barra se abria sozinha quando o ponteiro cruzava a esquerda
   da tela a caminho de outra coisa; e para nao recolher por baixo dos baloes
   que saem por portal, ela precisava de um estado preso, de um ouvinte de
   pointermove e de uma folga medida em pixels. Tudo isso saiu junto.
   (Sem crases nestes comentarios: eles vivem dentro de um template literal.) */
/* A barra comeca EMBAIXO da faixa do topo e vai ate o rodape da janela. O
   hamburguer que a abre mora la em cima agora, junto do wordmark, e e por isso
   que ela pode ceder esses 52px sem perder nada.

   Escrito aqui, e nao num bloco de correcao mais adiante, porque esta regra e a
   ULTIMA a falar de .ds-side na folha — um override antes dela perderia por
   ordem, calado. */
.ds-side {
  width: var(--s-rail); min-width: var(--s-rail); flex-shrink: 0;
  height: calc(100vh - var(--s-topbar));
  position: sticky; top: var(--s-topbar); z-index: 10;
}
.ds-side__interno {
  position: fixed; left: 0; top: var(--s-topbar); bottom: 0; z-index: 40;
  width: var(--s-rail);
  display: flex; flex-direction: column;
  overflow-x: hidden; overflow-y: auto;
  transition: width 0.2s cubic-bezier(0.4,0,0.2,1), box-shadow 0.2s ease;
}
.ds-side.is-aberta .ds-side__interno {
  width: var(--s-aberta);
}
/* Enquanto FECHA, a barra continua vestida de aberta (rotulos ao lado dos
   icones) e so a largura anda — ver barraFechando no JSX. Por isso toda regra
   de recolhimento abaixo exclui .is-fechando junto com .is-aberta: a tira so
   assume a forma dela quando a borda ja chegou. */

/* ── O que some ao recolher ──────────────────────────────────────────────────
   display: none, e NAO opacity. Elemento invisivel por opacidade continua
   ocupando a caixa dele e continua contando como item de flex — o resultado
   era uma tira cheia de vaos, com o gap separando icones de rotulos que
   ninguem via.

   O ROTULO DO ITEM NAO ESTA MAIS NESTA LISTA. Ele e o que mudou de verdade
   nesta refatoracao: recolhida, a barra continua mostrando o nome de cada
   destino, so que embaixo do icone e em 9px. Era o unico servico que a
   expansao por hover prestava, e agora ele nao custa gesto nenhum.
   (Sem crases nestes comentarios: template literal.) */
.ds-side:not(.is-aberta):not(.is-fechando) .ds-profile__text,
.ds-side:not(.is-aberta):not(.is-fechando) .ds-group__label,
.ds-side:not(.is-aberta):not(.is-fechando) .ds-item__badge,
.ds-side:not(.is-aberta):not(.is-fechando) .ds-item__cadeado,
.ds-side:not(.is-aberta):not(.is-fechando) .selo-beta,
.ds-side:not(.is-aberta):not(.is-fechando) .mkb-caixa,
.ds-side:not(.is-aberta):not(.is-fechando) .ds-sub { display: none; }

/* E o que some ao ABRIR: as formas recolhidas dos mesmos elementos. O pip e o
   contador de leads em ponto vermelho, que substitui o numero quando ele nao
   caberia. */
.ds-side.is-aberta .ds-item__pip { display: none; }

/* ── RECOLHIDA, O ITEM ATIVO NAO GANHA PILULA ──────────────────────────────
   O fundo tingido e a borda de acento continuam na barra ABERTA, onde o item e
   uma faixa larga e a pilula tem forma. Na tira eles viravam um retangulo
   apertado em volta de um icone com legenda — cabendo mal, e brigando com o
   proprio rotulo por espaco.

   O que diz onde a pessoa esta, ali, e o ICONE: preenchido (weight fill, no
   JSX) e na tinta forte do tema, contra o contorno em tinta fraca dos outros.
   E a mesma distincao que a barra do YouTube usa recolhida, e ela basta.
   (Sem crases nestes comentarios: template literal.) */
.ds-side:not(.is-aberta):not(.is-fechando) .ds-shell .ds-item.is-active,
.ds-side:not(.is-aberta):not(.is-fechando) .ds-item.is-active {
  background: transparent; border-color: transparent;
}

/* ── Geometria da barra recolhida: o icone com o NOME embaixo ───────────────
   Coluna em vez de linha, e o rotulo vira legenda. Duas linhas no maximo:
   "Registro de Atividade" e "Fontes de Captacao" nao cabem em uma so, e cortar
   no meio da primeira palavra ("Regis…") nao diz nada. Em duas linhas o corte
   cai depois de uma palavra inteira, que ainda identifica o destino.

   text-align center e nao left: em 84px o bloco de texto e quase tao largo
   quanto a caixa, e o eixo do icone e o unico alinhamento que sobra.
   (Sem crases nestes comentarios: template literal.) */
/* ── O ICONE NAO ANDA ENTRE OS DOIS ESTADOS ─────────────────────────────────
   Recolhida, a tira tem 92px e o icone senta no eixo dela (x = 46). Aberta, o
   item era uma linha com 12px de recuo, e o icone caia em x = 31 — um passo
   para a ESQUERDA a cada abertura, e o passo de volta ao fechar. O recuo da
   barra aberta e calculado para o icone ficar no MESMO eixo: metade da tira
   menos metade do icone, descontado o padding da nav. E o mesmo eixo do
   hamburguer la em cima.

   E a LARGURA da forma recolhida e FIXA, e nao 100%: a classe sai na hora e
   a largura da barra leva 0,2s para encolher; com 100%, o icone centrado
   deslizava de x = 134 ate x = 46 acompanhando a borda. Com a largura da tira
   cravada, o icone ja nasce onde vai ficar e a borda encolhe sozinha.
   (Sem crases nestes comentarios: template literal.) */
.ds-side:not(.is-aberta):not(.is-fechando) .ds-shell .ds-item,
.ds-side:not(.is-aberta):not(.is-fechando) .ds-item {
  flex-direction: column; justify-content: center; align-items: center;
  gap: 6px; padding: 10px 3px 8px; white-space: normal;
  width: calc(var(--s-rail) - 16px);
}
.ds-side:not(.is-aberta):not(.is-fechando) .ds-item__label {
  flex: none; width: 100%; text-align: center;
  font-size: 9px; font-weight: 600; line-height: 1.25; letter-spacing: 0.01em;
  /* O clamp de duas linhas. -webkit-box e o unico jeito que funciona em todos
     os navegadores que o painel atende; o overflow hidden do .ds-item ja
     estava la. */
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; text-overflow: ellipsis; word-break: break-word;
}
/* O perfil nao ganha legenda: o avatar E o rotulo dele, e "Voce" embaixo de
   uma foto da propria pessoa seria a unica linha da barra que nao informa
   nada. */
.ds-side:not(.is-aberta):not(.is-fechando) .ds-shell button.ds-profile,
.ds-side:not(.is-aberta):not(.is-fechando) button.ds-profile {
  justify-content: center; padding: 10px 8px; gap: 0;
  width: calc(var(--s-rail) - 16px);
}

/* ══════════════════════════════════════════════════════════════════════════
   O HAMBURGUER — o unico controle do tamanho da barra
   ══════════════════════════════════════════════════════════════════════════

   Ele fica no topo, no mesmo canto nos dois estados. Recolhido, a caixa e a
   tira inteira e ele senta no meio dela; aberto, a caixa e a coluna inteira e
   ele fica na ponta esquerda — o botao nao anda, o que anda e a borda direita
   da caixa. E o arranjo do YouTube, e a razao e a mesma: um controle que muda
   de lugar conforme o estado obriga a procura-lo duas vezes.

   ── E ELE NAO ANDA, AGORA POR CONSTRUCAO ──

   Ele ficava dentro da barra, numa .ds-barra-topo que crescia junto com ela: 26px
   de recuo viravam 12, e o botao dava um passo para a esquerda no meio do
   proprio gesto que o disparou. Houve um recuo calculado para corrigir isso, e
   depois ele saiu da barra — de dentro do grupo da faixa, que tem largura fixa,
   nao ha o que o mova.
   (Sem crases nestes comentarios: template literal.) */
.ds-shell .ds-hamburguer {
  width: 40px; height: 40px; padding: 0; flex: none;
  display: flex; align-items: center; justify-content: center;
  border-radius: 10px; border: 1px solid transparent;
  background: transparent; box-shadow: none; transform: none;
  color: var(--s-text); cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.ds-shell .ds-hamburguer:hover {
  background: var(--s-hover); color: var(--s-strong);
  box-shadow: none; transform: none; border-color: transparent;
}

/* ══════════════════════════════════════════════════════════════════════════
   O SELETOR DE MODULO — agora na faixa do topo
   ══════════════════════════════════════════════════════════════════════════

   Ele morou no alto da barra lateral, e a folha nasceu para lá: uma faixa de
   identidade com borda embaixo, ocupando a largura da barra. Hoje ele vive na
   .ds-topbar, e as diferencas estao no bloco DELA (fundo, borda, altura) — o
   que sobrou aqui e o que nao depende de onde ele esta: o rolo, o balao, o
   dimensionamento do wordmark por tinta.

   As regras que ainda falam de .ds-side continuam escritas: elas descrevem a
   forma RECOLHIDA do seletor, que nao e desenhada hoje mas custa duas linhas de
   guarda-chuva — e voltam a valer no dia em que ele reaparecer numa barra.

   Uma faixa de identidade com um chevron no canto. A lista de modulos NAO
   cresce para dentro da barra: ela brota ao LADO, como o submenu do menu do
   perfil (.mp-flutuante). Crescer para dentro empurrava a navegacao inteira
   dois centimetros para baixo a cada passada de mouse no topo — um sobressalto
   por um gesto que quase sempre e acidental.
   (SEM CRASES nestes comentarios: eles vivem dentro de um template literal, e
   uma crase aqui encerra a string no meio da folha.) */
.ds-mod {
  flex-shrink: 0;
  border-bottom: 1px solid var(--s-border);
  background: color-mix(in srgb, var(--modulo-acento, #6366f1) 7%, transparent);
}
.ds-mod__atual, .ds-mod.is-solo {
  display: flex; align-items: center; gap: 10px;
  height: 52px; padding: 0 12px 0 14px;
}

/* ── O ladrilho do simbolo: SO com a barra recolhida ────────────────────────
   Aberta, ele sumia por repeticao — o predio ja esta dentro do tipo_header, e
   dois predios lado a lado na mesma linha leem como erro de montagem.
   A tinta do acento e o unico sinal do modulo em 64px: sem o anel, Hub e Flow
   ficam identicos ali. */
.ds-mod__marca {
  flex: none; width: 28px; height: 28px; border-radius: 8px; overflow: hidden;
  display: none; align-items: center; justify-content: center;
}
.ds-mod__marca img { width: 68%; height: 68%; object-fit: contain; }
.ds-side:not(.is-aberta):not(.is-fechando) .ds-mod__marca { display: flex; }

/* ── O WORDMARK DO MODULO ───────────────────────────────────────────────────

   Uma imagem so por modulo (modulo.logo), e nao mais tipo + palavra coladas
   lado a lado. A composicao caiu junto com os nomes: "Omnimob" nao tem palavra
   para acrescentar, e "Omniflow" e uma palavra unica.

   O que sobrou e o dimensionamento, e ele continua sendo por TINTA e nao por
   quadro. As artes tem sobra dentro do arquivo: tipo_header_alt e 2852x603 com
   as letras ocupando so a faixa y=197..403 — 34% da altura, porque o simbolo do
   predio, esse sim, vai de borda a borda. Dar height ao quadro faria a
   PALAVRA sair com um terco do tamanho pretendido.

   O fator foi MEDIDO nas artes, nao estimado:

     603 / 207 = 2,913   quanto o quadro e maior que as letras dentro dele

   E ele vale para as DUAS: omnimob_flow.png tem o mesmo quadro 2852x603, o
   simbolo na mesma faixa (x 0..499) e a mesma altura de letra (207px). Foi essa
   coincidencia — deliberada na arte — que permitiu apagar a regra por modulo.
   Trocar uma arte por outra de proporcao diferente traz a matematica de volta.

   Mexer no tamanho da logo e mexer em --tinta, num lugar so. */
.ds-mod__logo {
  --tinta: 10px;
  flex: 1; min-width: 0;
  display: flex; align-items: flex-start;
  overflow: hidden;
}
.ds-mod__tipo {
  height: calc(var(--tinta) * 2.913); width: auto; flex: none; display: block;
}
.ds-side:not(.is-aberta):not(.is-fechando) .ds-mod__atual,
.ds-side:not(.is-aberta):not(.is-fechando) .ds-mod.is-solo { justify-content: center; padding: 0; gap: 0; }

/* O gatilho (.ds-mod__gatilho), o chevron e o balao de modulos sairam daqui
   junto com o dropdown. A troca de modulo virou um item da navegacao — ver
   .ds-modulos, mais abaixo, e o comentario no SeletorDeModulo. */

/* ══════════════════════════════════════════════════════════════════════════
   O ROLO — a marca da imobiliaria dentro da faixa do modulo
   ══════════════════════════════════════════════════════════════════════════

   Duas faces empilhadas num trilho de altura dupla, dentro de uma janela com
   overflow hidden. O hover desloca o trilho em metade da altura dele, e a face
   de baixo toma o lugar da de cima. So transform entra na conta: e propriedade
   de composicao, entao a animacao nao repinta a barra inteira a cada quadro.

   O tamanho vive num lugar so (--altura). As faces usam 50% do trilho e o
   trilho usa 200% da janela, entao mexer na altura da janela move tudo junto.
   (SEM CRASES nestes comentarios: template literal.) */
.ds-shell .ds-mod__rolo {
  --altura: 36px;
  flex: 1; min-width: 0; height: var(--altura);
  position: relative; overflow: hidden;
  /* ── display BLOCK, e isto custou uma captura de tela para achar ──────────
     Como <button>, ele herda o reset do painel, que e display:flex com
     align-items:center. Um trilho de 72px CENTRALIZADO numa janela de 36px
     sobra 18px para cada lado — e o que aparecia era meia face de cima e meia
     de baixo ao mesmo tempo, com o wordmark cortado no meio. A geometria media
     toda certa (36 / 72 / 36+36); o que estava errado era o alinhamento.
     Por isso o trilho tambem e ABSOLUTO logo abaixo: ancorado no topo, ele
     ignora qualquer alinhamento que o reset de botao traga no futuro. */
  display: block;
  /* O resto do reset: sem isto ele nasce com o padding global de 14px/20px e a
     faixa ganha uma altura que nao e a dela. */
  width: auto; margin: 0; padding: 0; border: 0; border-radius: 8px;
  background: transparent; color: inherit; font: inherit; text-align: left;
  box-shadow: none; transform: none;
  transition: background 0.15s ease;
}
.ds-mod__rolo.is-link { cursor: pointer; }
.ds-shell .ds-mod__rolo:hover, .ds-shell .ds-mod__rolo.is-ativo {
  background: var(--s-hover); box-shadow: none; transform: none;
}
/* Sem hover para quem nao pode entrar: o fundo aceso seria a promessa de
   clique que a <div> nao cumpre. */
.ds-shell .ds-mod__rolo:not(.is-link):hover { background: transparent; }

.ds-mod__trilho {
  position: absolute; top: 0; left: 0; right: 0;
  display: block; height: 200%;
  transition: transform 0.42s cubic-bezier(0.16, 1, 0.3, 1);
}
.ds-mod__face {
  height: 50%; display: flex; align-items: center; gap: 9px;
  padding: 0 8px; box-sizing: border-box;
}
/* O gesto: hover, foco de teclado, ou estar NO Painel do Gestor. O ultimo trava
   a segunda face — e onde a pessoa esta, e a face que diz isso e a da casa. */
.ds-mod__rolo.is-link:hover .ds-mod__trilho,
.ds-mod__rolo.is-link:focus-visible .ds-mod__trilho,
.ds-mod__rolo:not(.is-link):hover .ds-mod__trilho,
.ds-mod__rolo.is-ativo .ds-mod__trilho { transform: translateY(-50%); }

.ds-mod__casa { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 1px; }
/* A face da casa e mais apertada que o cabecalho antigo: o mesmo conteudo em
   36px em vez de 56px. Dai a marca menor. */
.ds-mod__face--casa .ds-mark { width: 24px; height: 24px; border-radius: 7px; font-size: 12px; }
.ds-mod__face--casa .ds-plano { padding: 2px 7px; font-size: 9px; }
.ds-mod__face--casa .ds-mod__nome { font-size: 12.5px; }

@media (prefers-reduced-motion: reduce) {
  .ds-mod__trilho { transition: none; }
}

.ds-mark {
  width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  background: var(--s-avatar); color: var(--s-avatar-ink); font-weight: 700; font-size: 13px;
}
.ds-mark.has-logo { background: transparent; }
.ds-mark img { width: 100%; height: 100%; object-fit: contain; }
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
.ds-mod__nome {
  font-size: 13px; font-weight: 600; color: var(--s-strong); letter-spacing: -0.01em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ds-mod__slug {
  font-family: var(--s-mono); font-size: 8.5px; letter-spacing: 0.08em;
  color: var(--s-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* ── Navegação ──────────────────────────────────────────────────────────────
   Os itens respiram. Eles estavam a 2px um do outro, herdado de quando o item
   tinha 32px de altura e a barra precisava caber tudo em 64px de largura; com o
   icone maior e o nome embaixo dele, essa colagem virava um bloco unico de
   desenhos onde nada tinha comeco nem fim.

   O gap e maior na tira recolhida que na barra aberta, e nao por simetria: ali
   cada item tem DUAS linhas de altura (icone + nome), e sem a folga extra o
   nome de um encostava no icone do seguinte.
   (Sem crases nestes comentarios: template literal.) */
.ds-nav { flex: 1; overflow-y: auto; padding: 12px 0px 0px 0px; display: flex; flex-direction: column; gap: 14px; }
.ds-group { display: flex; flex-direction: column; gap: 6px; }
.ds-side:not(.is-aberta):not(.is-fechando) .ds-group { gap: 10px; }
.ds-side:not(.is-aberta):not(.is-fechando) .ds-nav { padding: 10px 3px; gap: 12px; }
.ds-group__label {
  font-family: var(--s-mono); font-size: 8.5px; letter-spacing: 0.16em;
  text-transform: uppercase; color: var(--s-rotulo); font-weight: 600;
  padding: 4px 25px 5px;
}
/* O .ds-group__rule foi embora. Ver o comentario no JSX: com o nome de cada
   destino desenhado embaixo do icone, o fio passou a ser uma terceira linha
   horizontal competindo com esses nomes. Quem separa os grupos e o espaco.
   (SEM CRASES neste comentario: ele vive dentro de um template literal, e uma
   crase aqui encerra a folha no meio — foi exatamente o que aconteceu.) */

/* ══════════════════════════════════════════════════════════════════════════
   MAIS DA OMNIMOB — os outros modulos, no fim da navegacao
   ══════════════════════════════════════════════════════════════════════════

   O esquema do "Mais do YouTube": uma secao com titulo proprio, separada por um
   fio, oferecendo os outros produtos da casa. Ver o JSX para por que ela
   substituiu o chevron que ficava colado no wordmark.

   SO COM A BARRA ABERTA. Na tira, o nome do modulo sairia em duas linhas de
   tres letras embaixo de um simbolo que e IGUAL ao dos onze itens acima — a
   entrada nao se distinguiria de mais um destino do modulo atual, que e
   exatamente o contrario do que ela diz.

   O fio no topo e a excecao a regra que tirou os separadores da navegacao: os
   grupos dali sao telas do MESMO modulo, e o espaco basta para separa-los; esta
   secao leva para FORA, e a mudanca de natureza merece a linha.
   (Sem crases nestes comentarios: template literal.) */
.ds-modulos {
  margin-top: 6px; padding-top: 12px;
  border-top: 1px solid var(--s-sep);
}
.ds-side:not(.is-aberta):not(.is-fechando) .ds-modulos { display: none; }

/* ── O ITEM E A ARTE, E MAIS NADA ──────────────────────────────────────────

   Ele era um .ds-item como os outros: fundo no hover, icone num anel colorido,
   rotulo ao lado. Agora e o wordmark do outro modulo, cru — sem caixa, sem
   anel, sem texto ao lado, porque a arte JA traz o nome dentro dela e repeti-lo
   seria ler "Omniflow" duas vezes na mesma linha.

   O reset e explicito (padding, fundo, borda, gap) porque .ds-item continua
   valendo por cima: a classe fica no elemento para o alinhamento e a altura da
   lista continuarem os mesmos dos itens de navegacao.

   A altura sai de --tinta, como na faixa do topo, e pelo mesmo motivo: as duas
   artes tem o quadro 2852x603, entao um numero serve para as duas. Modulo sem
   arte clara mantem o rotulo em texto (o JSX so o desenha nesse caso) — e e o
   que faz um modulo novo aparecer nomeado em vez de aparecer vazio.
   (Sem crases nestes comentarios: template literal.) */
.ds-shell .ds-modulos__item {
  padding: 8px 10px; gap: 8px;
  background: none; border: 0;
  justify-content: flex-start;
}
.ds-shell .ds-modulos__item:hover { background: var(--s-fill-hover, rgba(127,127,127,0.12)); }

.ds-modulos__tipo {
  --tinta: 9px;
  height: calc(var(--tinta) * 2.913); width: auto; flex: none;
  display: block; opacity: 0.86;
}
.ds-shell .ds-modulos__item:hover .ds-modulos__tipo { opacity: 1; }

/* A escolha por tema, igual a da faixa do topo. O seletor tem um nivel a mais
   do que parece preciso porque a arte clara TAMBEM e um .ds-modulos__tipo, e a
   regra de tamanho dela declara display:block — com a mesma especificidade,
   quem vem depois ganha, e as duas apareceriam juntas. */
.ds-modulos__item .ds-modulos__tipo--claro { display: none; }
.ds-shell[data-tema="claro"] .ds-modulos__item .ds-modulos__tipo { display: none; }
.ds-shell[data-tema="claro"] .ds-modulos__item .ds-modulos__tipo--claro { display: block; }

/* A caixa que abraca o item e os tres pontinhos. Ocupa a largura inteira porque
   o "⋮" e absoluto e se ancora nela: numa caixa do tamanho do texto ele
   sentaria no meio da linha. O padding a direita e do ITEM, e nao daqui — e o
   que impede o rotulo longo de passar por baixo do botao.
   (Sem crases nestes comentarios: template literal.) */
.mkb-hospedeiro { display: block; width: 100%; }
/* ── E SO COM A BARRA ABERTA ────────────────────────────────────────────────
   Recolhida, o "⋮" nao e desenhado (.mkb-caixa esta em display none), mas o
   padding continuava entrando — e num item que centraliza o conteudo em coluna,
   34px de folga a direita empurram o icone para a ESQUERDA. O sintoma era um
   pulo lateral no hover, e so em "Gerenciar Imoveis": e o unico item da barra
   que tem menu de canto.

   Abrir espaco para um botao que nao existe e o defeito; o conserto e a
   condicao, nao um valor menor.
   (Sem crases nestes comentarios: template literal.) */
.ds-side.is-aberta .ds-nav .mkb-hospedeiro:hover .ds-item,
.ds-side.is-aberta .ds-nav .mkb-hospedeiro:focus-within .ds-item,
/* Com o balao aberto o ponteiro esta FORA do item (ele sai por portal), entao
   nenhuma das duas condicoes acima vale — e o rotulo voltava ao lugar largo
   por baixo do "⋮", que continua aceso. O :has cobre o intervalo em que o menu
   esta no ar. (Sem crases aqui: template literal.) */
.ds-side.is-aberta .ds-nav .mkb-hospedeiro:has(.mkb.is-aberto) .ds-item { padding-right: 34px; }

.ds-shell .ds-item {
  display: flex; align-items: center; gap: 12px;
  /* Recuo a esquerda = (tira - icone) / 2 - padding da nav = (92 - 22) / 2 - 8.
     Ver o bloco "O icone nao anda" acima. */
  width: 100%; padding: 10px 12px 10px 27px; border-radius: 10px;
  font-family: inherit; font-size: 13.5px; font-weight: 500; text-align: left;
  color: var(--s-text); background: transparent;
  border: 1px solid transparent; box-shadow: none; transform: none;
  cursor: pointer; text-decoration: none; white-space: nowrap; overflow: hidden;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.ds-shell .ds-item:hover {
  background: var(--s-hover); color: var(--s-strong);
  box-shadow: none; transform: none; border-color: transparent;
}
/* ── A PILULA DO ITEM ATIVO E NEUTRA, E UMA POR TEMA ───────────────────────
   Ela ja foi indigo cravado, depois o acento do MODULO com uma borda derivada
   dele. O acento saiu daqui: ele continua dizendo em que modulo a pessoa esta
   no icone do cabecalho, no fio do submenu e no proprio seletor — e dentro da
   pilula ele competia com o icone preenchido, que e o que de fato marca o item.

   Sobra o degrau de tom, e ele nao pode ser o MESMO nos dois temas: cinza a 50%
   sobre o quase-preto da barra e um degrau para cima; sobre #f6f7f9 seria um
   degrau para BAIXO, mais claro que o fundo. Por isso --s-ativo, redefinido no
   bloco do tema claro junto com o resto da familia --s-*.

   Sem borda: no escuro ela virava um contorno cinza claro em volta de um fundo
   cinza, e no claro nao tinha o que separar.
   (Sem crases nestes comentarios: eles vivem dentro de um template literal.) */
.ds-shell .ds-item.is-active {
  background: var(--s-ativo);
  color: var(--s-strong);
}
/* ── O ICONE SELECIONADO SEGUE O TEMA, E NAO O ACENTO ───────────────────────
   Ele era pintado com o acento do modulo, e no tema claro isso deixava o item
   ativo com um indigo claro sobre um fundo indigo claro — a peca de menor
   contraste da barra era justamente a que diz onde a pessoa esta.

   Quem carrega o modulo e o FUNDO da pilula, que continua tingido pelo acento.
   O icone leva a tinta forte do tema: escuro no claro, claro no escuro. E a
   troca de peso (regular para fill, la no JSX) que faz o resto do trabalho.
   (Sem crases nestes comentarios: template literal.) */
.ds-shell .ds-item.is-active .ds-item__icon { color: var(--s-strong); }

/* Item que o PLANO nao libera. Continua clicavel de proposito: a tela do outro
   lado e o convite ao upgrade, e um item morto na barra so ensina que aquele
   pedaco do produto nao funciona. O cadeado diz que ha um degrau ali antes de a
   pessoa gastar o clique. */
.ds-shell .ds-item.is-bloqueado { opacity: 0.62; }
.ds-item__cadeado {
  margin-left: auto; flex: none;
  font-size: 8.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  font-family: var(--s-mono);
  padding: 2px 6px; border-radius: 5px;
  color: #d4af37; background: rgba(212,175,55,0.12);
  border: 1px solid rgba(212,175,55,0.28);
}

/* O dourado da marca só neste item: é o que faz o olho achá-lo no rodapé sem
   precisar de um botão flutuante por cima do conteúdo. */
.ds-shell .ds-item--ajuda:hover { color: #d4af37; background: rgba(212,175,55,0.09); }
.ds-shell .ds-item--ajuda:hover .ds-item__icon { color: #d4af37; }

.ds-item__icon { display: flex; flex-shrink: 0; position: relative; color: currentColor; }
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
   ele tem 22px e começa nos 12px de padding do item, então o meio cai em 23px.
   Os dois números cresceram nesta refatoração — mexer num sem o outro
   desalinha o fio do ícone, que é a única coisa que ele faz.
   Desce ao abrir e recolhe ao fechar. */
.ds-sub__rail {
  position: absolute;
  left: 23px;
  top: 4px;
  bottom: 6px;
  width: 1px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--modulo-acento, #818cf8) 45%, transparent), var(--s-sep));
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
  width: 100%; padding: 7px 10px 7px 32px; border-radius: 8px;
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
}
.ds-subitem__icon { display: flex; flex-shrink: 0; color: currentColor; }
.ds-subitem__label { flex: 1; overflow: hidden; text-overflow: ellipsis; }

/* ── Rodapé ── */
.ds-foot {
  padding: 8px; flex-shrink: 0;
  display: flex; flex-direction: column; gap: 2px;
}
.ds-profile {
  display: flex; align-items: center; gap: 10px;
  /* Mesma conta dos itens, com o avatar de 28px: (92 - 28) / 2 - 8 = 24. */
  padding: 10px 10px 10px 24px; margin-top: 4px;
  border-top: 1px solid var(--s-sep);
}
/* 28px e nao 24: o avatar e o unico desenho do rodape, e ele precisa ficar do
   tamanho dos icones da navegacao — senao a barra recolhida termina com uma
   peca visivelmente menor que todas as outras.
   (Sem crases neste comentario: template literal.) */
.ds-avatar {
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  background: var(--s-avatar); color: var(--s-avatar-ink); font-size: 12px; font-weight: 700;
}
/* Com foto, o disco colorido vira moldura e some por baixo da imagem. */
.ds-avatar.tem-foto { background: transparent; }
/* A caixa do avatar existe para o selo de novidades dos chamados poder
   sobrar para fora do círculo sem ser cortado pelo overflow dele. */
.ds-avatar-caixa { position: relative; display: inline-flex; flex-shrink: 0; }
.ds-avatar__aviso {
  position: absolute; top: -4px; right: -5px; min-width: 17px; height: 17px; padding: 0 4px;
  border-radius: 999px; display: inline-flex; align-items: center; justify-content: center;
  background: #ef4444; color: #fff; font-size: 10px; font-weight: 800; line-height: 1;
  box-shadow: 0 0 0 2px var(--s-bg, #0a0a0b);
}
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
/* ── A faixa da demonstracao ──────────────────────────────────────────────
   Uma pilula fixa no pe da tela, no centro, acima do conteudo e abaixo dos
   modais (o tour precisa passar por cima dela). Escura nos dois temas: ela e
   um aviso, nao parte da moldura, e o contraste com o painel claro e o que a
   faz ser lida.
   (Sem crases nestes comentarios: template literal.) */
.ds-demo {
  position: fixed; left: 50%; bottom: 18px; z-index: 9000;
  transform: translateX(-50%);
  display: flex; align-items: center; gap: 12px;
  padding: 9px 10px 9px 16px; border-radius: 999px;
  background: rgba(14,14,19,0.94); color: #e5e7eb;
  border: 1px solid rgba(255,255,255,0.12);
  box-shadow: 0 20px 48px -18px rgba(0,0,0,0.9);
  font-size: 13px; white-space: nowrap;
}
.ds-demo__ponto { width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; box-shadow: 0 0 0 4px rgba(245,158,11,0.18); flex: none; }
.ds-demo__texto strong { color: #fff; font-weight: 700; }
.ds-shell .ds-demo__sair, .ds-demo__sair {
  width: auto; padding: 7px 10px; border-radius: 999px; flex: none; cursor: pointer;
  background: transparent; border: 1px solid transparent; color: #9ca3af;
  font: inherit; font-size: 12.5px; font-weight: 600; box-shadow: none; transform: none;
}
.ds-shell .ds-demo__sair:hover, .ds-demo__sair:hover { color: #fff; background: rgba(255,255,255,0.08); box-shadow: none; transform: none; }
.ds-shell .ds-demo__cta, .ds-demo__cta {
  width: auto; padding: 7px 14px; border-radius: 999px; background: #f1f5f9; color: #0c0f1a;
  border: 1px solid #f1f5f9; font: inherit; font-size: 13px; font-weight: 600; text-decoration: none; flex: none;
  cursor: pointer; box-shadow: none; transform: none;
}
.ds-shell .ds-demo__cta:hover, .ds-demo__cta:hover { background: #fff; color: #0c0f1a; box-shadow: none; transform: none; }
@media (max-width: 640px) {
  .ds-demo { left: 12px; right: 12px; transform: none; white-space: normal; }
}

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
