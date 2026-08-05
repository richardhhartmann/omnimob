import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Buildings,
  PaintBrushBroad,
  ChartLineUp,
  Megaphone,
  UsersThree,
  ShieldCheck,
} from "@phosphor-icons/react";
import { PLANOS, RECURSOS_PLANOS, planoInfo } from "../utils/planos";
import {
  ACCENT_SOFT,
  GOLD,
  MINT,
  ROSE,
  Button,
  DomusStyles,
  Eyebrow,
  LOGO_LOCKUP_HEADER_SRC,
  LOGO_SRC,
  LogoLockup,
  Reveal,
  Scallop,
  StatValue,
  useReveal,
} from "../styles/domusKit";

/* ────────────────────────────────────────────────────────────────────────────
   Landing pública da Domus.

   Os tokens e as primitivas (botões, vidro, reveal, contagem, eyebrow, grids
   de hairline) vêm de `styles/domusKit.jsx` — aqui ficam só os blocos
   exclusivos desta página: nav, hero com mockup isométrico, jornada, editor,
   marquee, planos, FAQ, CTA clara e footer.
   ──────────────────────────────────────────────────────────────────────────── */

// ── Conteúdo ────────────────────────────────────────────────────────────────

const HERO_BULLETS = [
  "Cadastro de imóveis com fotos, atributos e status",
  "Vitrine pública com editor visual de arrastar e soltar",
  "Captura de leads e métricas por imóvel em tempo real",
  "Publicação em Facebook, Instagram e WhatsApp",
];

const HERO_ASIDE = [
  "Editor de arrastar e soltar, sem escrever código",
  "Layout do mobile independente do desktop",
  "Cada lead já chega vinculado ao imóvel",
  "Facebook, Instagram e WhatsApp integrados",
  "Descrição e legenda geradas por IA",
];

// Números de vitrine. Os três primeiros são os mesmos que já estavam na página;
// o último sai de planos.js.
const STATS = [
  { n: "+1.200", label: "Imóveis publicados" },
  { n: "98%", label: "Satisfação dos clientes" },
  { n: "24/7", label: "Vitrine sempre no ar" },
  { n: String(PLANOS.length), label: "Planos, do autônomo ao alto padrão" },
];

const JORNADA = [
  {
    title: "Cadastre sua imobiliária",
    desc: "Seu ambiente sobe em minutos, com painel administrativo e vitrine pública já no ar.",
  },
  {
    title: "Suba os imóveis",
    desc: "Fotos, atributos, tipo, preço e status. As imagens vão direto para o Cloudinary, sem passar pelo servidor.",
    chips: ["CLOUDINARY"],
  },
  {
    title: "Monte a vitrine do seu jeito",
    desc: "Editor visual de arrastar e soltar, com layout independente para desktop e mobile.",
    chips: ["EDITOR VISUAL"],
  },
  {
    title: "Gere o conteúdo com IA",
    desc: "Descrição, título, hashtags, post e anúncio escritos automaticamente a partir do cadastro do imóvel.",
    chips: ["IA · PREMIUM"],
  },
  {
    title: "Divulgue nas redes",
    desc: "Publique o imóvel no Facebook, Instagram e WhatsApp com legenda pronta, em poucos cliques.",
    chips: ["REDES · PROFISSIONAL"],
  },
  {
    title: "Receba leads e acompanhe",
    desc: "Todo interessado que chega pela vitrine vira lead no painel, com visualizações e conversões por imóvel.",
  },
];

// Ícones do mesmo conjunto (Phosphor) usado na sidebar do painel — nada de
// emoji, que renderiza com a fonte do sistema e destoa entre Windows e Mac.
const RECURSOS = [
  { Icon: Buildings, title: "Gestão de imóveis", desc: "Cadastre imóveis com fotos, atributos, tipos e status. Tudo organizado e pronto para divulgar." },
  { Icon: PaintBrushBroad, title: "Vitrine personalizável", desc: "Um editor visual de arrastar e soltar para montar a página pública da sua imobiliária, do seu jeito." },
  { Icon: ChartLineUp, title: "Leads e métricas", desc: "Capture interessados pela vitrine e acompanhe visualizações, leads e vendas por imóvel." },
  { Icon: Megaphone, title: "Publicação em redes", desc: "Divulgue imóveis no Facebook, Instagram e WhatsApp com legenda pronta em poucos cliques." },
  { Icon: UsersThree, title: "Usuários e permissões", desc: "Crie cargos com permissões granulares para corretores, marketing, gerência e mais." },
  { Icon: ShieldCheck, title: "Multi-tenant seguro", desc: "Cada imobiliária com seus próprios dados, usuários e vitrine — isolados e seguros." },
];

// Itens do menu em tela cheia. A numeração e o atraso em cascata saem do
// índice, então a ordem aqui é a ordem que aparece.
const MENU_ITENS = [
  { label: "Início", href: "#topo" },
  { label: "Recursos", href: "#recursos" },
  { label: "Como funciona", href: "#jornada" },
  { label: "Planos", href: "#planos" },
  { label: "Dúvidas", href: "#faq" },
  { label: "Contato", href: "#contato" },
];

const INTEGRACOES = [
  { type: "REDES", name: "Facebook" },
  { type: "REDES", name: "Instagram" },
  { type: "MENSAGENS", name: "WhatsApp" },
  { type: "MÍDIA", name: "Cloudinary" },
  { type: "IA", name: "Google Gemini" },
  { type: "VITRINE", name: "Página pública" },
  { type: "LEADS", name: "Formulário de contato" },
  { type: "MÉTRICAS", name: "Painel de desempenho" },
];

// Faixa horizontal de destaques. Cards claros funcionam como "marca-texto"
// no meio dos escuros — mesma ideia da faixa de depoimentos da referência.
const FAIXA = [
  { kind: "stat", value: "+1.200", label: "Imóveis publicados na plataforma", tone: "mint" },
  { kind: "text", title: "Vitrine no ar em minutos", desc: "Sem desenvolvedor, sem template travado. Você arrasta, solta e publica." },
  { kind: "text", title: "Layout mobile independente", desc: "Monte o desktop e ajuste o mobile separadamente — ou copie um para o outro num clique." },
  { kind: "stat", value: "3", label: "Canais de divulgação integrados", tone: "accent" },
  { kind: "text", title: "Desfazer e refazer sempre", desc: "Cinquenta passos de histórico no editor, com Ctrl+Z e Ctrl+Y." },
  { kind: "stat", value: "24/7", label: "Vitrine pública sempre disponível", tone: "gold" },
  { kind: "text", title: "Conteúdo escrito por IA", desc: "Descrição, título, hashtags e post prontos a partir do cadastro do imóvel." },
  { kind: "text", title: "Cada imobiliária isolada", desc: "Dados, usuários e vitrine separados por tenant, do banco à requisição." },
];

const FAQ = [
  {
    q: "Preciso de alguém técnico para montar a vitrine?",
    a: "Não. A vitrine é montada num editor visual de arrastar e soltar: você posiciona os blocos, troca cores, sobe um banner e escreve os textos direto na página. O que você vê no editor é o que o visitante vê.",
  },
  {
    q: "A vitrine funciona bem no celular?",
    a: "Sim, e o layout mobile é independente do desktop. Você pode posicionar os blocos de um jeito no computador e de outro no celular — ou copiar o layout do desktop para o mobile e ajustar só o que precisar.",
  },
  {
    q: "Como os leads chegam até mim?",
    a: "Todo visitante que preenche o formulário de contato na vitrine vira um lead no painel, vinculado ao imóvel que ele estava vendo. Na tela de cada imóvel você acompanha visualizações, leads e vendas.",
  },
  {
    q: "Quem pode acessar o painel da minha imobiliária?",
    a: "Só quem você cadastrar. Existem os papéis de administrador, corretor e editor de vitrine, e você monta cargos com permissões granulares para cada time.",
  },
  {
    q: "A publicação nas redes sociais está em qual plano?",
    a: "A partir do plano Profissional. A geração de conteúdo por inteligência artificial é exclusiva do plano Premium. Todo o resto — imóveis, vitrine, leads, clientes, usuários e relatórios — já vem no Básico.",
  },
  {
    q: "Os dados da minha imobiliária ficam separados dos das outras?",
    a: "Ficam. A Domus é multi-tenant: cada imobiliária tem seus próprios imóveis, usuários, leads e vitrine, e toda requisição é filtrada pelo tenant de origem.",
  },
];

// ── Planos ──────────────────────────────────────────────────────────────────

// Preço é informação de marketing e não existe em planos.js, então fica mapeado
// aqui — ajuste à vontade.
const PRECOS = {
  BASICO: { price: "R$ 99", per: "/mês", nota: "cobrado mensalmente" },
  PROFISSIONAL: { price: "R$ 199", per: "/mês", nota: "cobrado mensalmente" },
  PREMIUM: { price: "Sob consulta", per: "", nota: "proposta sob medida" },
};

// Linhas da tabela comparativa. As linhas "Tudo do Plano X" existem só para os
// cards resumidos do painel e não fazem sentido numa comparação lado a lado.
const LINHAS_PLANO = RECURSOS_PLANOS.filter((r) => !String(r.label).startsWith("Tudo do Plano"));

const NIVEL_MINIMO = { BASICO: 0, PROFISSIONAL: 1, PREMIUM: 2 };

// `plans` vem como string (recurso base, todos os planos têm) ou array com o
// primeiro plano que libera o recurso.
function incluiRecurso(planKey, recurso) {
  const exigido = Array.isArray(recurso.plans) ? recurso.plans[0] : recurso.plans;
  return planoInfo(planKey).nivel >= (NIVEL_MINIMO[exigido] ?? 0);
}

const PLANS = PLANOS.map((p) => ({
  key: p.key,
  name: p.nome,
  desc: p.descricao,
  price: PRECOS[p.key]?.price ?? "",
  per: PRECOS[p.key]?.per ?? "",
  nota: PRECOS[p.key]?.nota ?? "",
  linhas: LINHAS_PLANO.map((r) => ({ label: r.label, incluso: incluiRecurso(p.key, r) })),
  highlight: p.key === "PROFISSIONAL",
}));

/* Cabeçalho fixo + menu em tela cheia, no modelo do Header do Contable: a
   barra não tem fundo próprio, flutua sobre o conteúdo e só encolhe o respiro
   ao rolar; o menu abre por um clip-path circular que nasce no botão e cresce
   até cobrir a tela, com os links subindo em cascata e o hambúrguer virando X.

   Uma adaptação necessária: ao rolar, a barra ganha um vidro discreto. A
   referência é escura de ponta a ponta e pode ficar transparente sempre; aqui
   o CTA final é uma seção clara, e sem o vidro o menu sumiria ao passar por
   ela. */
function LandingHeader() {
  const [rolou, setRolou] = useState(false);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const onScroll = () => setRolou(window.scrollY > 50);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Menu em tela cheia trava a rolagem atrás e responde ao Esc.
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e) => { if (e.key === "Escape") setAberto(false); };
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", onKey);
    };
  }, [aberto]);

  const fechar = () => setAberto(false);

  return (
    <>
      <div className={`dl-menu${aberto ? " is-open" : ""}`} id="menu-principal" aria-hidden={!aberto}>
        <span className="dl-menu__ghost" aria-hidden="true">menu</span>

        <nav className="dl-menu__inner">
          <div>
            <span className="dl-mono dl-menu__label">Navegação</span>
            <ul className="dl-menu__links">
              {MENU_ITENS.map((item, i) => (
                <li key={item.href}>
                  <a href={item.href} onClick={fechar} tabIndex={aberto ? 0 : -1}>
                    <span className="dl-mono dl-menu__num">{String(i + 1).padStart(2, "0")}</span>
                    <span className="dl-menu__text">{item.label}</span>
                    <span className="dl-menu__arrow" aria-hidden="true">
                      <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
                      </svg>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="dl-menu__side">
            <div className="dl-menu__block">
              <span className="dl-mono dl-menu__side-label">Acesso</span>
              <Link to="/login" onClick={fechar} tabIndex={aberto ? 0 : -1}>Painel da imobiliária</Link>
              <Link to="/admin/login" onClick={fechar} tabIndex={aberto ? 0 : -1}>Área administrativa</Link>
            </div>
            <div className="dl-menu__block">
              <span className="dl-mono dl-menu__side-label">E-mail</span>
              <a href="mailto:contato@domus.com" onClick={fechar} tabIndex={aberto ? 0 : -1}>contato@domus.com</a>
            </div>
            <div className="dl-menu__block">
              <span className="dl-mono dl-menu__side-label">Social</span>
              <div className="dl-menu__socials">
                <a href="https://wa.me/" target="_blank" rel="noreferrer" tabIndex={aberto ? 0 : -1}>WhatsApp</a>
                <a href="https://instagram.com/" target="_blank" rel="noreferrer" tabIndex={aberto ? 0 : -1}>Instagram</a>
              </div>
            </div>
          </div>
        </nav>
      </div>

      <header className={`dl-header${rolou ? " is-scrolled" : ""}${aberto ? " is-menu-open" : ""}`}>
        <Link to="/" className="dl-header__logo" onClick={fechar} aria-label="Domus — início">
          {/* Arte própria do cabeçalho. Sem `height`: aqui o tamanho vem do
              CSS, para encolher junto com a barra ao rolar. */}
          <LogoLockup src={LOGO_LOCKUP_HEADER_SRC} className="dl-header__tipo" />
        </Link>

        <div className="dl-header__right">
          <Button href="#contato" variant="primary" className="dl-header__cta">Agendar demonstração</Button>

          <button
            type="button"
            className="dl-burger"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            aria-controls="menu-principal"
            aria-label={aberto ? "Fechar menu" : "Abrir menu"}
          >
            <span className="dl-mono dl-burger__label">{aberto ? "Fechar" : "Menu"}</span>
            <span className="dl-burger__lines" aria-hidden="true">
              <i /><i /><i />
            </span>
          </button>
        </div>
      </header>
    </>
  );
}

// ── Peças da página ─────────────────────────────────────────────────────────

// Cabeçalho de seção: título grande à esquerda em duas cores, parágrafo curto
// alinhado pela base à direita.
function SectionHead({ eyebrow, eyebrowTone, strong, soft, children }) {
  return (
    <Reveal className="dl-head">
      <div>
        <Eyebrow tone={eyebrowTone}>{eyebrow}</Eyebrow>
        <h2 className="dl-h2">
          <span className="dl-h2__strong">{strong}</span>
          {soft ? <span className="dl-h2__soft">{soft}</span> : null}
        </h2>
      </div>
      {children ? <p className="dl-head__desc">{children}</p> : null}
    </Reveal>
  );
}

/* Mockup isométrico do painel para o lado direito do hero.
   O flutuar (translateY) fica no wrapper e a inclinação no card, então o hover
   pode endireitar o card sem brigar com a animação. */
function DashboardMockup() {
  const KPIS = [
    ["Imóveis", "128"],
    ["Leads", "46"],
    ["Visitas", "2.4k"],
  ];
  const BARRAS = [38, 62, 45, 78, 54, 90, 68];

  return (
    <div className="dl-stage">
      <span className="dl-stage__glow" aria-hidden="true" />

      <div className="dl-stage__float">
        <div className="dl-mockup dl-glass" aria-hidden="true">
          <div className="dl-mockup__bar">
            <span className="dl-dot" style={{ background: "#f87171" }} />
            <span className="dl-dot" style={{ background: "#fbbf24" }} />
            <span className="dl-dot" style={{ background: "#4ade80" }} />
            <span className="dl-mono dl-mockup__url">domus.app / painel</span>
          </div>

          <div className="dl-mockup__body">
            <aside className="dl-mockup__side">
              <img className="dl-mockup__logo" src={LOGO_SRC} alt="" />
              {["Imóveis", "Leads", "Vitrine", "Métricas"].map((item, i) => (
                <span key={item} className={`dl-mockup__nav${i === 0 ? " is-active" : ""}`}>{item}</span>
              ))}
            </aside>

            <div className="dl-mockup__main">
              <div className="dl-mockup__kpis">
                {KPIS.map(([rotulo, valor]) => (
                  <div key={rotulo} className="dl-mockup__kpi dl-glass">
                    <span>{rotulo}</span>
                    <strong>{valor}</strong>
                  </div>
                ))}
              </div>

              <div className="dl-mockup__chart">
                {BARRAS.map((h, i) => (
                  <i key={i} style={{ height: `${h}%` }} />
                ))}
              </div>

              <div className="dl-mockup__rows">
                {[0, 1].map((i) => (
                  <div key={i} className="dl-mockup__row">
                    <span className="dl-mockup__thumb" />
                    <span className="dl-mockup__lines">
                      <i className="dl-skel" style={{ width: "68%" }} />
                      <i className="dl-skel" style={{ width: "36%", opacity: 0.5 }} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="dl-chip-float dl-chip-float--a dl-glass" aria-hidden="true">
        <span className="dl-pulse" />
        Novo lead · Apto. Centro
      </div>
      <div className="dl-chip-float dl-chip-float--b dl-glass" aria-hidden="true">
        <span style={{ color: MINT, fontWeight: 700 }}>✓</span>
        Vitrine publicada
      </div>
    </div>
  );
}

// Mock do painel dentro de uma moldura de navegador (seção de recursos).
function BrowserMock({ caption }) {
  return (
    <figure className="dl-browser-wrap">
      {caption ? <figcaption className="dl-mono dl-browser-cap">▪ {caption}</figcaption> : null}
      <div className="dl-browser">
        <div className="dl-browser__chrome">
          <span className="dl-dot" style={{ background: "#f87171" }} />
          <span className="dl-dot" style={{ background: "#fbbf24" }} />
          <span className="dl-dot" style={{ background: "#4ade80" }} />
          <span className="dl-browser__url">domus.app / vitrine</span>
        </div>
        <div className="dl-browser__body">
          <div className="dl-skel" style={{ width: "42%", height: "13px" }} />
          <div className="dl-browser__grid">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="dl-browser__card">
                <div className="dl-browser__thumb" />
                <div className="dl-skel" style={{ width: "72%" }} />
                <div className="dl-skel" style={{ width: "40%", opacity: 0.6 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}

/* Palavra gigante ao fundo da seção, revelada por um foco que segue o mouse.

   O truque (mesmo do hero do projeto Contable): a palavra é pintada na cor do
   fundo da própria seção, então ela não existe visualmente — quem desenha o
   relevo são as quatro sombras douradas em camadas. Por cima, uma máscara
   radial centrada no cursor decide onde esse relevo aparece.

   As coordenadas do mouse entram como variáveis CSS (--mx/--my) em vez de
   estado do React: é um write direto no style, sem re-render a cada pixel. */
function GhostWord({ children }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // O listener é no window (e não no elemento) para o foco também "sair"
    // quando o cursor deixa a seção, em vez de congelar na última posição.
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const dentro =
        e.clientX >= r.left && e.clientX <= r.right &&
        e.clientY >= r.top && e.clientY <= r.bottom;
      el.style.setProperty("--mx", dentro ? `${e.clientX - r.left}px` : "-600px");
      el.style.setProperty("--my", dentro ? `${e.clientY - r.top}px` : "-600px");
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div className="dl-ghost" ref={ref} aria-hidden="true">
      <span>{children}</span>
    </div>
  );
}

/* Item do FAQ que abre e fecha animado.

   A resposta fica sempre no DOM (antes ela era montada e desmontada, e por
   isso não havia o que animar) dentro de um painel com overflow escondido; o
   que transiciona é a altura máxima desse painel.

   A referência usa um max-height fixo e generoso. Aqui a altura real é medida:
   com valor fixo, o fechamento fica com um atraso perceptível — a transição
   gasta a maior parte do tempo percorrendo o espaço vazio entre o teto
   arbitrário e o tamanho verdadeiro do texto, e só no fim o painel se move. */
function FaqItem({ item, indice, aberto, onToggle }) {
  const corpoRef = useRef(null);
  const [altura, setAltura] = useState(0);

  useEffect(() => {
    const el = corpoRef.current;
    if (!el) return;
    const medir = () => setAltura(el.offsetHeight);
    medir();
    // O texto reflui quando a janela muda de largura; sem remedir, um item
    // que já estava aberto ficaria cortado ou com sobra embaixo.
    const observer = new ResizeObserver(medir);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const idPainel = `faq-resposta-${indice}`;

  return (
    <Reveal className={`dl-faq__item${aberto ? " is-open" : ""}`} delay={indice * 60}>
      <button
        type="button"
        className="dl-faq__q"
        aria-expanded={aberto}
        aria-controls={idPainel}
        onClick={onToggle}
      >
        <span className="dl-mono dl-faq__num">F.{String(indice + 1).padStart(2, "0")}</span>
        <span className="dl-faq__label">{item.q}</span>
        {/* Duas barras formando um "+": a vertical encolhe até sumir e sobra
            o "−", em vez de trocar o caractere de um quadro para o outro. */}
        <span className="dl-faq__toggle" aria-hidden="true">
          <i className="dl-faq__bar" />
          <i className="dl-faq__bar dl-faq__bar--v" />
        </span>
      </button>

      <div className="dl-faq__panel" id={idPainel} style={{ maxHeight: aberto ? `${altura}px` : 0 }}>
        <p className="dl-faq__a" ref={corpoRef}>{item.a}</p>
      </div>
    </Reveal>
  );
}

// Grid de métricas: um observer só para o bloco inteiro, então os quatro
// números começam a contar juntos enquanto os cards entram em cascata.
function StatsGrid() {
  const [ref, visivel] = useReveal();
  return (
    <div className="dl-grid-hair dl-grid-hair--4" ref={ref}>
      {STATS.map((s, i) => (
        <div
          key={s.label}
          className={`dl-reveal${visivel ? " is-visible" : ""} dl-cell dl-stat`}
          style={{ transitionDelay: `${i * 110}ms` }}
        >
          <span className="dl-mono dl-index">[{String(i + 1).padStart(2, "0")}]</span>
          <strong className="dl-stat__n">
            <StatValue raw={s.n} ativo={visivel} />
          </strong>
          <span className="dl-stat__l">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Página ──────────────────────────────────────────────────────────────────

export function DomusLandingPage() {
  const [faqAberto, setFaqAberto] = useState(0);
  const ano = new Date().getFullYear();

  return (
    <div className="dl-root">
      <DomusStyles extra={CSS} />

      <LandingHeader />

      {/* ── Hero ── */}
      <section className="dl-hero" id="topo">
        <div className="dl-hero__shapes" aria-hidden="true">
          <Scallop size={168} color={GOLD} style={{ position: "absolute", top: "8%", right: "6%", opacity: 0.55 }} />
          <span className="dl-shape dl-shape--halfs" />
          <span className="dl-shape dl-shape--circle" />
          <span className="dl-shape dl-shape--square" />
          <span className="dl-shape dl-shape--violet" />
        </div>

        <div className="dl-wrap">
          <div className="dl-hud dl-mono dl-glass" aria-hidden="true">
            <span><b>PAGE</b> /</span>
            <span><b>BUILD</b> vitrine + painel</span>
            <span><b>STATUS</b> <em>● no ar</em></span>
          </div>

          <div className="dl-hero__grid">
            <div className="dl-hero__copy">
              <Reveal>
                <span className="dl-badge dl-glass dl-mono">● IMÓVEIS + VITRINE + LEADS + IA</span>
              </Reveal>

              <Reveal delay={90}>
                <h1 className="dl-h1">
                  <span>Gestão imobiliária</span>
                  <span className="dl-h1__accent">e vitrine digital.</span>
                </h1>
              </Reveal>

              <Reveal delay={170}>
                <p className="dl-lead">
                  Do cadastro do imóvel ao lead fechado, num só lugar. Suba os imóveis, monte uma vitrine
                  impecável sem escrever código, capture interessados e divulgue nas redes — com a
                  inteligência artificial escrevendo o conteúdo por você.
                </p>
              </Reveal>

              <Reveal delay={250}>
                <ul className="dl-checks">
                  {HERO_BULLETS.map((b) => (
                    <li key={b}>
                      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke={ACCENT_SOFT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 8.5 6.5 12 13 4.5" />
                      </svg>
                      {b}
                    </li>
                  ))}
                </ul>
              </Reveal>

              <Reveal delay={330}>
                <div className="dl-btn-row">
                  <Button href="#contato" variant="primary">Agendar demonstração</Button>
                  <Button href="#planos" variant="ghost" arrow={false}>Ver planos</Button>
                </div>
              </Reveal>

              <Reveal delay={410}>
                <p className="dl-mono dl-note">
                  // inclui · painel administrativo · vitrine pública · editor visual
                  <br />
                  Divulgação em redes a partir do plano Profissional; recursos de IA no Premium.
                </p>
              </Reveal>
            </div>

            <Reveal className="dl-hero__side" delay={220}>
              <DashboardMockup />

              <div className="dl-hero__aside dl-glass">
                <p className="dl-hero__claim">
                  Imóvel sem vitrine
                  <span> é imóvel invisível.</span>
                </p>
                <ul className="dl-hero__list">
                  {HERO_ASIDE.map((item) => (
                    <li key={item}>
                      <i aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Números ── */}
      <section className="dl-section dl-section--alt">
        <div className="dl-wrap">
          <SectionHead eyebrow="NÚMEROS DA DOMUS" strong="A plataforma completa" soft="para quem vive de vender imóveis.">
            Uma base só, pensada para imobiliárias brasileiras: imóveis, vitrine, leads, equipe e divulgação
            no mesmo painel.
          </SectionHead>

          <StatsGrid />

          <p className="dl-mono dl-note">// números da plataforma, atualizados periodicamente</p>
        </div>
      </section>

      {/* ── O desafio ── */}
      <section className="dl-section dl-section--ghost">
        <GhostWord>+ visibilidade.</GhostWord>
        <div className="dl-wrap">
          <SectionHead eyebrow="O DESAFIO" eyebrowTone={GOLD} strong="Pare de perder cliente" soft="por falta de presença digital.">
            Anúncio espalhado em grupo de WhatsApp, foto solta no Instagram, planilha desatualizada. O
            interessado aparece, não encontra nada organizado e vai para a concorrência.
          </SectionHead>

          <Reveal className="dl-callout">
            <p>
              Com a Domus, cada imóvel entra uma vez e aparece em todo lugar — na vitrine da sua imobiliária,
              no post pronto para as redes e no painel de quem precisa acompanhar.
            </p>
            <p style={{ color: ACCENT_SOFT }}>
              E com a IA, sua equipe para de travar na parte chata: descrição, título, hashtags e legenda saem
              prontos a partir do cadastro do imóvel, com você só revisando e publicando.
            </p>
          </Reveal>

          <Reveal className="dl-btn-row" delay={120} style={{ marginTop: "26px" }}>
            <Button href="#contato" variant="primary">Quero conhecer</Button>
          </Reveal>
        </div>
      </section>

      {/* ── Jornada ── */}
      <section id="jornada" className="dl-section dl-section--alt">
        <div className="dl-wrap">
          <SectionHead eyebrow="JORNADA COMPLETA" strong="Do cadastro ao lead" soft="numa plataforma só.">
            A Domus organiza a rotina comercial da imobiliária. Cada passo abaixo já existe no produto — não é
            promessa de roadmap.
          </SectionHead>

          <ol className="dl-journey">
            {JORNADA.map((s, i) => (
              <Reveal as="li" key={s.title} className="dl-journey__item" delay={i * 70}>
                <span className="dl-mono dl-journey__num">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="dl-journey__title">{s.title}</h3>
                <p className="dl-journey__desc">{s.desc}</p>
                {s.chips ? (
                  <span className="dl-journey__tag">
                    <i className="dl-journey__dash" aria-hidden="true" />
                    <span className="dl-mono">{s.chips.join(" · ")}</span>
                  </span>
                ) : null}
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Recursos + mock ── */}
      <section id="recursos" className="dl-section">
        <div className="dl-wrap">
          <SectionHead eyebrow="RECURSOS" strong="Tudo que sua imobiliária" soft="precisa. Em um só lugar.">
            Um sistema, do cadastro à conversão — sem juntar cinco ferramentas para dar conta da operação.
          </SectionHead>

          <div className="dl-split">
            <div className="dl-grid-hair dl-grid-hair--2">
              {RECURSOS.map((f, i) => (
                <Reveal key={f.title} className="dl-cell dl-feature" delay={i * 80}>
                  <span className="dl-feature__icon" aria-hidden="true">
                    <f.Icon size={17} weight="duotone" />
                  </span>
                  <span className="dl-mono dl-index">[{String(i + 1).padStart(2, "0")}]</span>
                  <h3 className="dl-feature__title">{f.title}</h3>
                  <p className="dl-feature__desc">{f.desc}</p>
                </Reveal>
              ))}
            </div>
            <Reveal delay={160} style={{ display: "flex" }}>
              <BrowserMock caption="PAINEL WEB · DOMUS" />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Editor de vitrine ── */}
      <section className="dl-section dl-section--alt">
        <div className="dl-wrap dl-editor">
          <Reveal>
            <Eyebrow tone={ROSE}>EDITOR VISUAL</Eyebrow>
            <h2 className="dl-h2">
              <span className="dl-h2__strong">Sua vitrine,</span>
              <span className="dl-h2__soft">montada arrastando e soltando.</span>
            </h2>
            <p className="dl-lead" style={{ maxWidth: "460px" }}>
              Posicione cabeçalho, destaques, imóveis e widgets onde quiser. Troque cores, suba um banner,
              ajuste brilho e sobreposição, escreva o texto direto na página.
            </p>
            <p className="dl-body" style={{ maxWidth: "460px" }}>
              O layout do mobile é independente do desktop — e, se preferir, você copia um para o outro num
              clique. Tudo salva sozinho enquanto você edita.
            </p>
            <div className="dl-btn-row">
              <Button href="#contato" variant="primary">Ver o editor funcionando</Button>
            </div>
          </Reveal>

          <Reveal className="dl-editor__panel dl-glass" delay={140}>
            <span className="dl-mono dl-browser-cap">▪ EDITOR DE VITRINE · BLOCOS</span>
            <ul className="dl-editor__blocks">
              {[
                ["Cabeçalho", "header"],
                ["Título", "title"],
                ["Destaques", "highlights"],
                ["Imóveis", "properties"],
                ["Widgets", "widgets"],
                ["Rodapé", "footer"],
              ].map(([label, key], i) => (
                <li key={key} className={i === 2 ? "is-active" : undefined}>
                  <span className="dl-mono">{String(i + 1).padStart(2, "0")}</span>
                  {label}
                  <em className="dl-mono">{key}</em>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ── Integrações ── */}
      <section className="dl-section">
        <div className="dl-wrap">
          <SectionHead eyebrow="CANAIS E INTEGRAÇÕES" strong="Conectada aos canais" soft="onde seu cliente já está.">
            A Domus liga o cadastro do imóvel aos canais que realmente trazem cliente, com a IA cuidando do
            conteúdo dentro da própria plataforma.
          </SectionHead>

          <div className="dl-grid-hair dl-grid-hair--4">
            {INTEGRACOES.map((it, i) => (
              <Reveal key={it.name} className="dl-cell dl-int" delay={i * 60}>
                <span className="dl-mono dl-int__type">{it.type}</span>
                <span className="dl-int__name">{it.name}</span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Faixa de destaques ── */}
      <section className="dl-section dl-section--alt dl-section--tight">
        <div className="dl-wrap">
          <SectionHead eyebrow="POR QUE DOMUS" strong="O que muda no dia a dia" soft="de quem usa.">
            Detalhes pequenos que aparecem toda semana na rotina da imobiliária.
          </SectionHead>
        </div>

        <Reveal className="dl-marquee">
          <div className="dl-marquee__track">
            {[...FAIXA, ...FAIXA].map((c, i) => (
              <div key={`${c.kind}-${i}`} className={`dl-fcard ${c.kind === "stat" ? `dl-fcard--${c.tone}` : ""}`}>
                {c.kind === "stat" ? (
                  <>
                    <strong className="dl-fcard__value">{c.value}</strong>
                    <span className="dl-fcard__label">{c.label}</span>
                  </>
                ) : (
                  <>
                    <span className="dl-fcard__quote" aria-hidden="true">”</span>
                    <h3 className="dl-fcard__title">{c.title}</h3>
                    <p className="dl-fcard__desc">{c.desc}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── Planos ── */}
      <section id="planos" className="dl-section">
        <div className="dl-wrap">
          <SectionHead eyebrow="PLANOS" eyebrowTone={GOLD} strong="Escolha o plano ideal" soft="para sua imobiliária.">
            Sem fidelidade, cancele quando quiser. Todo o núcleo do produto já está no Básico.
          </SectionHead>

          <div className="dl-plans">
            {PLANS.map((p, i) => (
              <Reveal key={p.key} className={`dl-plan${p.highlight ? " is-highlight" : ""}`} delay={i * 110}>
                {p.highlight ? <span className="dl-plan__tag dl-mono">● MAIS POPULAR</span> : null}
                <h3 className="dl-plan__name">{p.name}</h3>
                <p className="dl-plan__desc">{p.desc}</p>
                <div className="dl-plan__price">
                  <strong>{p.price}</strong>
                  {p.per ? <span>{p.per}</span> : null}
                </div>
                <span className="dl-mono dl-plan__nota">{p.nota}</span>
                <ul className="dl-plan__list">
                  {p.linhas.map((l) => (
                    <li key={l.label} className={l.incluso ? "" : "is-off"}>
                      <span aria-hidden="true">{l.incluso ? "✓" : "✕"}</span>
                      {l.label}
                    </li>
                  ))}
                </ul>
                <Button href="#contato" variant={p.highlight ? "primary" : "outline"} className="dl-btn--block">
                  Quero este plano
                </Button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="dl-section dl-section--alt">
        <div className="dl-wrap">
          <SectionHead eyebrow="PERGUNTAS FREQUENTES" strong="Tudo sobre a Domus," soft="direto ao ponto.">
            As dúvidas que mais aparecem antes de começar.
          </SectionHead>

          <div className="dl-faq">
            {FAQ.map((item, i) => (
              <FaqItem
                key={item.q}
                item={item}
                indice={i}
                aberto={faqAberto === i}
                onToggle={() => setFaqAberto(faqAberto === i ? -1 : i)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── O que é a Domus ── */}
      <section className="dl-section">
        <div className="dl-wrap">
          <Reveal>
            <Eyebrow>SOBRE O PRODUTO</Eyebrow>
            <h2 className="dl-h2">
              <span className="dl-h2__strong">O que é a</span>
              <span className="dl-h2__soft">Domus?</span>
            </h2>
          </Reveal>

          <Reveal className="dl-def" delay={120}>
            <h3>Domus — plataforma de gestão imobiliária com vitrine digital</h3>
            <p>
              A Domus é uma plataforma para imobiliárias e corretores que atuam com venda e locação de imóveis.
              Ela cobre o cadastro do imóvel com fotos e atributos, a página pública de vitrine, a captura de
              leads, a gestão de clientes, os cargos e permissões da equipe e os relatórios de desempenho.
            </p>
            <p>
              A plataforma também gera conteúdo com inteligência artificial — descrições, títulos, hashtags,
              posts e anúncios a partir dos dados do imóvel — e publica nos canais sociais da imobiliária.
            </p>
            <p>
              Cada imobiliária opera como um ambiente isolado, com seus próprios imóveis, usuários, leads e
              vitrine personalizável.
            </p>
            <span className="dl-mono dl-def__updated">// última atualização · {ano}</span>
          </Reveal>
        </div>
      </section>

      {/* ── CTA final (seção clara) ── */}
      <section id="contato" className="dl-cta">
        <div className="dl-cta__shapes" aria-hidden="true">
          <Scallop size={170} color="#c7d2fe" style={{ position: "absolute", top: "-30px", left: "-50px" }} />
          <Scallop size={120} color="#fde68a" style={{ position: "absolute", bottom: "-20px", right: "-30px" }} />
        </div>
        <Reveal className="dl-wrap dl-cta__inner">
          {/* A marca fecha a página aqui, e não por acaso: esta é a única
              seção clara, a única em que os vazados do PNG (as janelas e o
              miolo do "D") têm fundo para aparecer. */}
          <span className="dl-cta__brand">
            <img src={LOGO_SRC} alt="Domus" />
          </span>
          <Eyebrow tone={ACCENT_SOFT}>PRÓXIMO PASSO</Eyebrow>
          <h2 className="dl-cta__title">
            <span>Pronto para vender</span>
            <span>mais imóveis</span>
            <span className="dl-cta__grad">com processo?</span>
          </h2>
          <p className="dl-cta__sub">
            Agende uma demonstração e veja a Domus funcionando com os imóveis da sua imobiliária.
          </p>
          <div className="dl-btn-row dl-btn-row--center">
            <Button href="https://wa.me/" target="_blank" rel="noreferrer" variant="dark">Falar no WhatsApp</Button>
            <Button href="mailto:contato@domus.com" variant="light" arrow={false}>Enviar e-mail</Button>
          </div>
          <p className="dl-mono dl-cta__note">DOMUS · IMÓVEIS · VITRINE · LEADS · IA · GESTÃO DE IMOBILIÁRIAS</p>
        </Reveal>
      </section>

      {/* ── Footer ── */}
      <footer className="dl-footer">
        <div className="dl-wrap dl-footer__inner">
          <div className="dl-footer__brand">
            <Link to="/" className="dl-footer__logo" aria-label="Domus — início">
              <LogoLockup height={40} />
            </Link>
            <p>
              Plataforma de gestão imobiliária com vitrine digital personalizável, captura de leads e
              divulgação nas redes sociais.
            </p>
          </div>

          <div className="dl-footer__cols">
            <div>
              <span className="dl-mono">PRODUTO</span>
              <a href="#recursos">Recursos</a>
              <a href="#jornada">Como funciona</a>
              <a href="#planos">Planos</a>
              <a href="#faq">Dúvidas</a>
            </div>
            <div>
              <span className="dl-mono">ACESSO</span>
              <Link to="/login">Acesso do cliente</Link>
              <Link to="/admin/login">Área administrativa</Link>
            </div>
            <div>
              <span className="dl-mono">CONTATO</span>
              <a href="https://wa.me/" target="_blank" rel="noreferrer">WhatsApp</a>
              <a href="mailto:contato@domus.com">contato@domus.com</a>
            </div>
          </div>
        </div>
        <div className="dl-wrap dl-footer__bottom dl-mono">
          <span>© {ano} DOMUS</span>
          <span>FEITO PARA IMOBILIÁRIAS BRASILEIRAS</span>
        </div>
      </footer>
    </div>
  );
}

/* ── Estilos exclusivos desta página ─────────────────────────────────────────
   Tokens, reset, tipografia base, botões, vidro, reveal e grids de hairline
   vêm do kit. Aqui ficam só os blocos da landing.
   ────────────────────────────────────────────────────────────────────────── */

const CSS = `
/* ── Cabeçalho fixo ──
   Sem barra própria: flutua sobre o conteúdo e só encolhe o respiro ao rolar.
   O vidro entra a partir de .is-scrolled para o menu não sumir sobre a seção
   clara do CTA. */
.dl-header {
  position: fixed; top: 0; left: 0; width: 100%; z-index: 1000;
  display: flex; align-items: center; justify-content: space-between; gap: 24px;
  padding: 24px clamp(20px, 5vw, 56px);
  border-bottom: 1px solid transparent;
  transition: padding 0.5s var(--ease-out), background 0.4s ease, border-color 0.4s ease;
}
.dl-header.is-scrolled {
  padding-top: 13px; padding-bottom: 13px;
  background: rgba(10,10,11,0.72);
  backdrop-filter: blur(16px) saturate(140%); -webkit-backdrop-filter: blur(16px) saturate(140%);
  border-bottom-color: var(--line-soft);
}
/* Com o menu aberto o vidro apareceria por cima da cortina. */
.dl-header.is-menu-open {
  background: none; border-bottom-color: transparent;
  backdrop-filter: none; -webkit-backdrop-filter: none;
}

.dl-header__logo { z-index: 1001; display: inline-flex; align-items: center; transition: opacity 0.4s var(--ease-out); }
.dl-header.is-menu-open .dl-header__logo { opacity: 0; pointer-events: none; }
.dl-header__tipo { height: 44px; transition: height 0.45s var(--ease-out); }
.dl-header.is-scrolled .dl-header__tipo { height: 34px; }
.dl-header__right { display: flex; align-items: center; gap: 22px; z-index: 1001; }
.dl-header__cta { transition: opacity 0.4s var(--ease-out); }
.dl-header.is-menu-open .dl-header__cta { opacity: 0; pointer-events: none; }

/* ── Botão do menu ── */
.dl-root .dl-burger {
  display: flex; align-items: center; gap: 14px;
  background: none; border: 0; box-shadow: none; transform: none;
  padding: 10px 0; cursor: pointer; color: var(--strong);
}
.dl-root .dl-burger:hover { background: none; box-shadow: none; transform: none; }
.dl-burger__label { color: var(--subtle); font-size: 9.5px; letter-spacing: 0.2em; transition: color 0.3s ease; }
.dl-burger:hover .dl-burger__label { color: var(--strong); }
.dl-burger__lines {
  width: 28px; height: 18px; flex: 0 0 auto;
  display: flex; flex-direction: column; justify-content: space-between;
}
.dl-burger__lines i {
  display: block; width: 100%; height: 1.5px; background: var(--strong); transform-origin: center;
  transition: transform 0.5s var(--ease-out), opacity 0.3s ease, background 0.5s ease;
}
.dl-header.is-menu-open .dl-burger__lines i:nth-child(1) { transform: rotate(45deg) translate(5.5px, 5.5px); background: var(--gold); }
.dl-header.is-menu-open .dl-burger__lines i:nth-child(2) { opacity: 0; }
.dl-header.is-menu-open .dl-burger__lines i:nth-child(3) { transform: rotate(-45deg) translate(5.5px, -5.5px); background: var(--gold); }

/* ── Menu em tela cheia ──
   O círculo nasce no canto do botão e cresce até cobrir a tela. O raio final
   passa bem de 100% porque o círculo precisa alcançar o canto oposto, que
   está mais longe que a borda mais próxima. */
.dl-menu {
  position: fixed; inset: 0; z-index: 999; display: flex; overflow: hidden;
  background: #060607; pointer-events: none;
  clip-path: circle(0% at calc(100% - 60px) 36px);
  transition: clip-path 0.8s cubic-bezier(0.77, 0, 0.175, 1);
}
.dl-menu.is-open { clip-path: circle(150% at calc(100% - 60px) 36px); pointer-events: auto; }
.dl-menu__ghost {
  position: absolute; bottom: -6%; right: 4%; pointer-events: none; user-select: none;
  font-size: clamp(11rem, 24vw, 28rem); font-weight: 800; line-height: 0.8;
  letter-spacing: -0.05em; color: #0d0d0f;
}
.dl-menu__inner {
  width: 100%; display: grid; grid-template-columns: 1.5fr 1fr; gap: 60px;
  align-content: center; padding: 120px clamp(20px, 5vw, 56px) 60px;
}
.dl-menu__label { display: block; margin-bottom: 32px; color: #3a3a42; font-size: 9px; letter-spacing: 0.42em; }

.dl-menu__links li { border-bottom: 1px solid #17171a; overflow: hidden; }
.dl-menu__links li:first-child { border-top: 1px solid #17171a; }
.dl-menu__links a {
  display: flex; align-items: center; gap: 20px; padding: 18px 0;
  font-size: clamp(1.5rem, 3.4vw, 2.8rem); font-weight: 800; letter-spacing: -0.03em;
  color: #4a4a55; transform: translateY(110%);
  transition: transform 0.6s var(--ease-out), color 0.3s ease;
}
.dl-menu.is-open .dl-menu__links a { transform: translateY(0); }
.dl-menu__links li:nth-child(1) a { transition-delay: 0.05s; }
.dl-menu__links li:nth-child(2) a { transition-delay: 0.10s; }
.dl-menu__links li:nth-child(3) a { transition-delay: 0.15s; }
.dl-menu__links li:nth-child(4) a { transition-delay: 0.20s; }
.dl-menu__links li:nth-child(5) a { transition-delay: 0.25s; }
.dl-menu__links li:nth-child(6) a { transition-delay: 0.30s; }
.dl-menu__num { min-width: 26px; font-size: 9.5px; color: #3a3a42; transition: color 0.3s ease; }
.dl-menu__text { flex: 1; }
.dl-menu__arrow {
  display: flex; color: #2a2a30; opacity: 0; transform: translateX(-10px);
  transition: opacity 0.3s ease, transform 0.3s ease, color 0.3s ease;
}
.dl-menu__links a:hover { color: var(--gold); }
.dl-menu__links a:hover .dl-menu__num { color: var(--gold); }
.dl-menu__links a:hover .dl-menu__arrow { opacity: 1; transform: translateX(0); color: var(--gold); }

.dl-menu__side {
  display: flex; flex-direction: column; justify-content: flex-end; gap: 32px;
  opacity: 0; transform: translateY(20px);
  transition: opacity 0.5s ease 0.3s, transform 0.5s ease 0.3s;
}
.dl-menu.is-open .dl-menu__side { opacity: 1; transform: none; }
.dl-menu__side-label { display: block; margin-bottom: 10px; color: #3a3a42; font-size: 9px; letter-spacing: 0.34em; }
.dl-menu__block a { display: block; font-size: 14.5px; line-height: 1.9; color: #74747f; transition: color 0.3s ease; }
.dl-menu__block a:hover { color: var(--gold); }
.dl-menu__socials { display: flex; gap: 20px; }
.dl-menu__socials a { position: relative; font-size: 13px; }
.dl-menu__socials a::after {
  content: ""; position: absolute; left: 0; bottom: 2px; width: 0; height: 1px;
  background: var(--gold); transition: width 0.3s ease;
}
.dl-menu__socials a:hover::after { width: 100%; }

/* ── Cabeçalho de seção ── */
.dl-head {
  display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 40px;
  align-items: end; margin-bottom: 44px;
}
.dl-head__desc { font-size: 14px; line-height: 1.78; color: var(--subtle); padding-bottom: 6px; }

/* ── Seções ── */
.dl-section { padding: clamp(64px, 8vw, 112px) 0; border-top: 1px solid var(--line-soft); }
.dl-section--alt { background: var(--bg-alt); }
.dl-section--tight { padding-bottom: clamp(48px, 6vw, 80px); }

/* ── Palavra-fantasma ──
   A seção precisa conter e recortar a palavra, que é bem mais larga que ela.
   O conteúdo não precisa de z-index: .dl-wrap já é relative com z-index 1, e
   a palavra fica no 0. */
.dl-section--ghost { position: relative; overflow: hidden; }
.dl-ghost {
  position: absolute; inset: 0; z-index: 0;
  display: flex; align-items: center; justify-content: center;
  pointer-events: none; user-select: none;
  /* Longe da tela até o primeiro mousemove, senão a palavra nasceria acesa
     no canto superior esquerdo. */
  --mx: -600px; --my: -600px;
  -webkit-mask-image: radial-gradient(circle 460px at var(--mx) var(--my), #000 0%, rgba(0,0,0,0.55) 50%, transparent 100%);
  mask-image: radial-gradient(circle 460px at var(--mx) var(--my), #000 0%, rgba(0,0,0,0.55) 50%, transparent 100%);
}
.dl-ghost span {
  /* Atenção: isto dimensiona a letra, não a palavra — a largura final depende
     do número de caracteres. Trocar a palavra por uma mais longa pede baixar
     este valor na mesma proporção (22vw servia para 8 caracteres). */
  font-size: 16vw; font-weight: 800; letter-spacing: -0.05em; line-height: 0.85;
  white-space: nowrap;
  /* Mesma cor do fundo: a palavra some, e só o relevo das sombras aparece. */
  color: var(--bg);
  /* A primeira camada é mais fechada e mais opaca: é ela que dá a aresta do
     relevo perto do cursor. As outras três só espalham o brilho. */
  text-shadow:
    22px 22px 46px rgba(212,175,55,0.50),
    40px 40px 90px rgba(212,175,55,0.30),
    64px 64px 140px rgba(212,175,55,0.16),
    92px 92px 200px rgba(212,175,55,0.08);
}
/* Se a palavra for para uma seção alternada, ela acompanha o fundo de lá. */
.dl-section--alt .dl-ghost span { color: var(--bg-alt); }

/* O callout fica bem em cima da palavra e, opaco, cortava justamente o miolo
   dela. Aqui — e só aqui, o callout do kit segue sólido em qualquer outro uso
   — ele vira vidro: o desfoque deixa o brilho atravessar como um borrão de
   luz, sem competir com o texto branco por cima.

   O blur é baixo de propósito: a partir de uns 14px as letras viram uma
   mancha dourada sem forma, e o que se quer é justamente reconhecê-las. */
.dl-section--ghost .dl-callout {
  background: rgba(20,20,22,0.58);
  backdrop-filter: blur(9px) saturate(140%);
  -webkit-backdrop-filter: blur(9px) saturate(140%);
  border-color: rgba(255,255,255,0.10);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
}

/* ── Hero ──
   O topo abre espaço para o cabeçalho, que é fixo e não ocupa mais fluxo. */
.dl-hero { position: relative; padding: clamp(124px, 12vw, 168px) 0 clamp(64px, 8vw, 104px); overflow: hidden; }
.dl-hero::before {
  content: ""; position: absolute; inset: -20% 0 auto 0; height: 700px; pointer-events: none; z-index: 0;
  background:
    radial-gradient(760px 420px at 74% 4%, rgba(99,102,241,0.22), transparent 70%),
    radial-gradient(560px 340px at 6% 22%, rgba(212,175,55,0.10), transparent 70%);
}
.dl-hero__shapes { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
.dl-shape { position: absolute; display: block; border-radius: 999px; }
.dl-shape--halfs {
  left: -18px; top: 46%; width: 72px; height: 92px;
  background: #a78bfa; border-radius: 0 999px 999px 0;
  box-shadow: 46px 0 0 -6px #c4b5fd;
}
.dl-shape--circle { right: 8%; top: 62%; width: 46px; height: 46px; background: #e879b9; }
.dl-shape--square { right: 44%; top: 10%; width: 26px; height: 34px; border-radius: 4px; background: #14b8a6; }
.dl-shape--violet {
  right: 34%; top: 48%; width: 190px; height: 190px;
  background: radial-gradient(closest-side, rgba(139,92,246,0.55), transparent);
  filter: blur(6px);
}

/* Sobe para dentro do respiro do cabeçalho: no zero ele encostava no topo do
   mockup, que começa 44px abaixo e é mais alto que a folga. */
.dl-hud {
  position: absolute; top: -54px; right: 24px; z-index: 2;
  display: flex; flex-direction: column; gap: 5px; text-align: right;
  padding: 10px 14px; border-radius: 12px;
  color: var(--placeholder); line-height: 1.6; font-size: 9.5px;
}
.dl-hud b { font-weight: 500; color: #55555f; margin-right: 8px; }
.dl-hud em { font-style: normal; color: var(--mint); }

.dl-hero__grid { display: grid; grid-template-columns: 1.02fr 0.98fr; gap: 52px; align-items: center; margin-top: 44px; }
.dl-checks { display: grid; gap: 11px; margin-top: 24px; }
.dl-checks li { display: flex; align-items: center; gap: 10px; font-size: 14px; line-height: 1.6; color: var(--subtle); }
.dl-checks svg { flex: 0 0 auto; }

/* ── Palco do mockup isométrico ──
   A perspectiva vai dentro do próprio transform do mockup: ele é neto do palco
   (por causa do wrapper que faz o flutuar) e uma perspective declarada no avô
   não alcançaria sem preserve-3d no meio. */
.dl-stage { position: relative; }
.dl-stage__glow {
  position: absolute; inset: 8% -8% -14% -8%; z-index: 0; pointer-events: none;
  background: radial-gradient(closest-side, rgba(99,102,241,0.30), transparent 72%);
  filter: blur(12px);
}
.dl-stage__float { position: relative; z-index: 1; animation: dlFloat 9s ease-in-out infinite; }
@keyframes dlFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }

.dl-mockup {
  border-radius: 16px; overflow: hidden;
  transform: perspective(1700px) rotateY(-15deg) rotateX(7deg) rotateZ(1.2deg);
  transform-origin: 60% 50%;
  transition: transform 0.9s var(--ease-out), box-shadow 0.9s var(--ease-out);
  box-shadow:
    0 60px 120px -40px rgba(0,0,0,0.92),
    0 20px 44px -24px rgba(99,102,241,0.35),
    inset 0 1px 0 rgba(255,255,255,0.08);
}
.dl-stage:hover .dl-mockup { transform: perspective(1700px) rotateY(-6deg) rotateX(3deg) rotateZ(0deg); }

.dl-mockup__bar {
  display: flex; align-items: center; gap: 6px; padding: 10px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03);
}
.dl-mockup__url { margin-left: 10px; color: var(--placeholder); font-size: 8.5px; letter-spacing: 0.05em; }
.dl-mockup__body { display: grid; grid-template-columns: 88px 1fr; min-height: 250px; }
.dl-mockup__side {
  display: grid; gap: 7px; align-content: start; padding: 14px 10px;
  border-right: 1px solid rgba(255,255,255,0.07);
}
.dl-mockup__logo {
  width: 22px; height: 22px; margin-bottom: 6px;
  object-fit: contain; display: block;
}
.dl-mockup__nav { font-size: 9.5px; font-weight: 600; color: var(--placeholder); padding: 6px 8px; border-radius: 7px; }
.dl-mockup__nav.is-active { background: rgba(99,102,241,0.20); color: #cfd2ff; }
.dl-mockup__main { padding: 14px; display: grid; gap: 12px; align-content: start; }
.dl-mockup__kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.dl-mockup__kpi { border-radius: 10px; padding: 9px 10px; display: grid; gap: 3px; box-shadow: none; }
.dl-mockup__kpi span { font-size: 8px; color: var(--placeholder); letter-spacing: 0.06em; text-transform: uppercase; }
.dl-mockup__kpi strong { font-size: 15px; font-weight: 700; letter-spacing: -0.03em; color: var(--strong); }
.dl-mockup__chart {
  display: flex; align-items: flex-end; gap: 6px; height: 62px;
  padding: 10px; border-radius: 10px; background: rgba(255,255,255,0.03);
}
.dl-mockup__chart i {
  flex: 1; border-radius: 3px 3px 1px 1px;
  background: linear-gradient(180deg, var(--accent-soft), rgba(99,102,241,0.25));
}
.dl-mockup__chart i:nth-child(6) { background: linear-gradient(180deg, var(--gold), rgba(212,175,55,0.25)); }
.dl-mockup__rows { display: grid; gap: 7px; }
.dl-mockup__row {
  display: flex; align-items: center; gap: 9px;
  padding: 8px; border-radius: 9px; background: rgba(255,255,255,0.03);
}
.dl-mockup__thumb {
  width: 30px; height: 24px; border-radius: 6px; flex: 0 0 auto;
  background: linear-gradient(135deg, rgba(99,102,241,0.55), rgba(212,175,55,0.35));
}
.dl-mockup__lines { display: grid; gap: 5px; flex: 1; }

/* Cartões flutuantes de vidro em volta do mockup */
.dl-chip-float {
  position: absolute; z-index: 2;
  display: inline-flex; align-items: center; gap: 8px;
  padding: 9px 14px; border-radius: 999px;
  font-size: 11.5px; font-weight: 600; color: var(--strong); white-space: nowrap;
  animation: dlFloat 7s ease-in-out infinite;
}
.dl-chip-float--a { top: 4%; left: -6%; animation-delay: -1.6s; }
.dl-chip-float--b { bottom: 6%; right: -4%; animation-delay: -3.8s; }
.dl-pulse {
  width: 7px; height: 7px; border-radius: 999px; background: var(--accent-soft); flex: 0 0 auto;
  box-shadow: 0 0 0 0 rgba(129,140,248,0.6); animation: dlPulse 2.4s ease-out infinite;
}
@keyframes dlPulse {
  0% { box-shadow: 0 0 0 0 rgba(129,140,248,0.55); }
  70% { box-shadow: 0 0 0 9px rgba(129,140,248,0); }
  100% { box-shadow: 0 0 0 0 rgba(129,140,248,0); }
}

/* ── Bloco lateral do hero ── */
.dl-hero__aside { margin-top: 30px; padding: 22px 24px; border-radius: 18px; }
.dl-hero__claim { font-size: 18.5px; font-weight: 700; letter-spacing: -0.028em; line-height: 1.38; color: var(--strong); }
.dl-hero__claim span { color: var(--accent-soft); }
.dl-hero__list { display: grid; gap: 12px; margin-top: 20px; }
.dl-hero__list li {
  display: flex; align-items: baseline; gap: 11px;
  font-size: 13.5px; line-height: 1.75; color: #d2d2dc; letter-spacing: -0.004em; 
}
.dl-hero__list i {
  width: 4px; height: 4px; border-radius: 999px; flex: 0 0 auto;
  background: var(--accent-soft); transform: translateY(-3px); opacity: 0.85;
}

/* ── Recursos e integrações ── */
.dl-feature { display: flex; flex-direction: column; gap: 7px; }
.dl-feature__icon {
  width: 34px; height: 34px; border-radius: 10px; margin-bottom: 6px;
  display: flex; align-items: center; justify-content: center;
  color: #fff;
  background: rgba(129,140,248,0.12); border: 1px solid rgba(129,140,248,0.18);
  transition: background 0.2s ease, border-color 0.2s ease;
}
.dl-feature:hover .dl-feature__icon {
  background: rgba(129,140,248,0.20); border-color: rgba(129,140,248,0.34);
}
.dl-feature__title { font-size: 14.5px; font-weight: 700; color: var(--strong); letter-spacing: -0.015em; }
.dl-feature__desc { font-size: 13px; line-height: 1.72; color: var(--subtle); }
.dl-split { display: grid; grid-template-columns: 1fr 0.92fr; gap: 26px; align-items: stretch; }
.dl-int { display: flex; flex-direction: column; gap: 5px; }
.dl-int__type { color: var(--accent-soft); font-size: 9px; }
.dl-int__name { font-size: 13.5px; font-weight: 600; color: var(--strong); }

/* ── Jornada ──
   Colunas abertas por uma régua fina, sem cartão: o passo inteiro reage ao
   hover — a régua acende em dourado, o número acompanha e o texto clareia. */
.dl-journey { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0 40px; }
.dl-journey__item {
  display: flex; flex-direction: column;
  padding: 32px 0 38px;
  border-top: 1px solid var(--line);
  transition: border-top-color 0.4s ease;
}
.dl-journey__item:hover { border-top-color: var(--gold); }
.dl-journey__num {
  color: #4a4a55; font-size: 10px; margin-bottom: 24px;
  transition: color 0.3s ease;
}
.dl-journey__item:hover .dl-journey__num { color: var(--gold); }
.dl-journey__title { font-size: 16px; font-weight: 700; color: var(--strong); letter-spacing: -0.022em; }
.dl-journey__desc {
  font-size: 13.5px; line-height: 1.78; color: var(--placeholder); margin-top: 11px;
  transition: color 0.3s ease;
}
.dl-journey__item:hover .dl-journey__desc { color: var(--subtle); }
/* O margin-top auto alinha a etiqueta pela base: como as descrições têm
   alturas diferentes, sem isso cada coluna terminaria num ponto. */
.dl-journey__tag { display: flex; align-items: center; gap: 14px; margin-top: auto; padding-top: 26px; }
.dl-journey__dash { width: 25px; height: 1px; background: var(--gold); flex: 0 0 auto; }
.dl-journey__tag span { color: var(--placeholder); font-size: 8.5px; letter-spacing: 0.16em; }

/* ── Mock de navegador ── */
.dl-browser-wrap { display: flex; flex-direction: column; flex: 1; }
.dl-browser-cap { color: var(--placeholder); margin-bottom: 10px; font-size: 9px; display: block; }
.dl-browser {
  flex: 1; border-radius: 14px; overflow: hidden;
  background: var(--bg); border: 1px solid var(--line);
  box-shadow: 0 28px 50px -20px rgba(0,0,0,0.6);
}
.dl-browser__chrome {
  display: flex; align-items: center; gap: 6px; padding: 10px 14px;
  background: var(--surface); border-bottom: 1px solid var(--line);
}
.dl-browser__url {
  margin-left: 10px; font-family: 'JetBrains Mono', monospace;
  font-size: 9px; color: var(--placeholder); letter-spacing: 0.05em;
}
.dl-browser__body { padding: 18px; display: grid; gap: 14px; }
.dl-browser__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.dl-browser__card {
  border-radius: 11px; border: 1px solid var(--line); background: var(--surface);
  padding: 11px; display: grid; gap: 7px;
}
.dl-browser__thumb {
  height: 56px; border-radius: 8px;
  background: linear-gradient(135deg, rgba(99,102,241,0.38), rgba(212,175,55,0.24));
}

/* ── Editor ── */
.dl-editor { display: grid; grid-template-columns: 1fr 0.85fr; gap: 48px; align-items: center; }
.dl-editor__panel { border-radius: 18px; padding: 20px; }
.dl-editor__blocks { display: grid; gap: 2px; margin-top: 14px; }
.dl-editor__blocks li {
  display: flex; align-items: center; gap: 12px; padding: 12px 14px;
  border-radius: 10px; background: rgba(255,255,255,0.04); border: 1px solid transparent;
  font-size: 13px; font-weight: 600; color: var(--default);
  transition: background 0.2s ease;
}
.dl-editor__blocks li:hover { background: rgba(255,255,255,0.07); }
.dl-editor__blocks li span { color: var(--placeholder); font-size: 9.5px; }
.dl-editor__blocks li em { margin-left: auto; font-style: normal; color: var(--placeholder); font-size: 9px; }
.dl-editor__blocks li.is-active {
  border-color: rgba(99,102,241,0.45); background: rgba(99,102,241,0.14); color: var(--strong);
}
.dl-editor__blocks li.is-active em { color: var(--accent-soft); }

/* ── Faixa horizontal ── */
.dl-marquee {
  margin-top: 8px; overflow: hidden;
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent);
  mask-image: linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent);
}
.dl-marquee__track { display: flex; gap: 14px; width: max-content; animation: dlMarquee 60s linear infinite; }
.dl-marquee:hover .dl-marquee__track { animation-play-state: paused; }
@keyframes dlMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.dl-fcard {
  flex: 0 0 auto; width: 268px; min-height: 168px; padding: 22px 24px;
  border-radius: 18px; background: var(--surface); border: 1px solid var(--line);
  display: flex; flex-direction: column; gap: 9px;
}
.dl-fcard__quote { font-size: 26px; line-height: 0.6; color: var(--accent-soft); }
.dl-fcard__title { font-size: 14px; font-weight: 700; color: var(--strong); letter-spacing: -0.02em; }
.dl-fcard__desc { font-size: 13px; line-height: 1.7; color: var(--subtle); }
.dl-fcard__value { font-size: 38px; font-weight: 700; letter-spacing: -0.05em; line-height: 1; margin-top: auto; }
.dl-fcard__label { font-size: 12.5px; line-height: 1.6; opacity: 0.78; }
.dl-fcard--mint { background: #a7f3d0; border-color: #a7f3d0; color: #052e21; }
.dl-fcard--gold { background: #fde68a; border-color: #fde68a; color: #3b2f05; }
.dl-fcard--accent { background: var(--accent); border-color: var(--accent); color: #fff; }

/* ── Planos ── */
.dl-plans {
  display: grid; grid-template-columns: repeat(3, 1fr);
  border: 1px solid var(--line); border-radius: 20px; overflow: hidden;
}
.dl-plan {
  position: relative; padding: 32px 26px; display: flex; flex-direction: column;
  border-right: 1px solid var(--line);
}
.dl-plan:last-child { border-right: 0; }
.dl-plan.is-highlight { background: var(--surface); }
.dl-plan__tag {
  position: absolute; top: 14px; right: 18px; font-size: 8.5px; letter-spacing: 0.13em;
  color: var(--accent-soft);
}
.dl-plan__name { font-size: 26px; font-weight: 700; letter-spacing: -0.035em; color: var(--strong); }
.dl-plan__desc { font-size: 13px; line-height: 1.7; color: var(--subtle); margin-top: 8px; min-height: 66px; }
.dl-plan__price { margin-top: 18px; display: flex; align-items: baseline; gap: 6px; }
.dl-plan__price strong { font-size: 34px; font-weight: 700; letter-spacing: -0.045em; color: var(--strong); }
.dl-plan__price span { font-size: 13px; color: var(--subtle); }
.dl-plan__nota { color: var(--placeholder); font-size: 9px; margin-top: 6px; display: block; }
/* Respiro maior antes do botão: separa a lista do CTA sem precisar de régua. */
.dl-plan__list { display: grid; gap: 11px; margin: 22px 0 38px; flex: 1; }
.dl-plan__list li { display: flex; gap: 10px; font-size: 13px; line-height: 1.55; color: var(--default); }
.dl-plan__list li span { color: var(--mint); font-weight: 700; flex: 0 0 auto; }
.dl-plan__list li.is-off { color: var(--placeholder); }
.dl-plan__list li.is-off span { color: #4a4a52; }
.dl-plans__note {
  margin-top: 18px; padding: 14px 18px; border-radius: 12px;
  background: var(--surface); border-left: 2px solid var(--accent);
  font-size: 13px; line-height: 1.75; color: var(--subtle);
}
.dl-plans__note b { color: var(--default); }

/* ── FAQ ── */
.dl-faq { border-top: 1px solid var(--line); }
.dl-faq__item { border-bottom: 1px solid var(--line); }
.dl-root .dl-faq__q {
  width: 100%; display: grid; grid-template-columns: 56px 1fr 24px; align-items: center; gap: 16px;
  padding: 18px 0; background: none; border: 0; border-radius: 0; cursor: pointer; text-align: left;
  font-family: inherit; color: inherit;
}
.dl-root .dl-faq__q:hover { background: none; transform: none; box-shadow: none; }
.dl-faq__num { color: var(--placeholder); font-size: 9.5px; transition: color 0.3s ease; }
.dl-faq__q:hover .dl-faq__num,
.dl-faq__item.is-open .dl-faq__num { color: var(--gold); }
.dl-faq__label { font-size: 14.5px; font-weight: 600; color: var(--strong); letter-spacing: -0.02em; transition: color 0.3s ease; }
.dl-faq__q:hover .dl-faq__label { color: var(--gold); }

/* Alternador: o giro de meia-volta é o da referência; a barra vertical
   encolhendo é o que faz o "+" virar "−" sem trocar de caractere. */
.dl-faq__toggle {
  position: relative; width: 22px; height: 22px; flex: 0 0 auto;
  border-radius: 999px; border: 1px solid var(--line);
  transition: border-color 0.3s ease, transform 0.45s var(--ease-out);
}
.dl-faq__q:hover .dl-faq__toggle { border-color: var(--gold); }
.dl-faq__item.is-open .dl-faq__toggle { border-color: var(--gold); transform: rotate(180deg); }
.dl-faq__bar {
  position: absolute; top: 50%; left: 50%; width: 9px; height: 1.5px;
  margin: -0.75px 0 0 -4.5px; border-radius: 1px;
  background: var(--subtle); transition: background 0.3s ease, transform 0.45s var(--ease-out);
}
.dl-faq__bar--v { transform: rotate(90deg); }
.dl-faq__item.is-open .dl-faq__bar--v { transform: rotate(90deg) scaleX(0); }
.dl-faq__q:hover .dl-faq__bar,
.dl-faq__item.is-open .dl-faq__bar { background: var(--gold); }

/* O painel é o que anima; o respiro de baixo vive no parágrafo, para entrar
   na medida da altura e sumir junto ao fechar. */
.dl-faq__panel {
  overflow: hidden; max-height: 0;
  transition: max-height 0.45s var(--ease-out);
}
.dl-faq__a {
  font-size: 14px; line-height: 1.82; color: var(--subtle);
  padding: 0 24px 22px 72px; max-width: 82ch;
  opacity: 0; transform: translateY(-6px);
  transition: opacity 0.35s ease, transform 0.45s var(--ease-out);
}
.dl-faq__item.is-open .dl-faq__a { opacity: 1; transform: none; }

/* ── Definição ── */
.dl-def {
  margin-top: 34px; padding: 34px 38px; border-radius: 20px;
  background: var(--surface); border: 1px solid var(--line);
}
.dl-def h3 { font-size: 15px; font-weight: 700; color: var(--strong); letter-spacing: -0.02em; }
.dl-def p { font-size: 13.5px; line-height: 1.85; color: var(--subtle); margin-top: 14px; }
.dl-def__updated { display: block; margin-top: 20px; color: var(--placeholder); font-size: 9px; }

/* ── CTA final (claro) ── */
.dl-cta {
  position: relative; overflow: hidden;
  background: #f4f5f7; color: #0c121a;
  padding: clamp(72px, 9vw, 128px) 0;
}
.dl-cta__shapes { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
.dl-cta__inner { text-align: center; display: flex; flex-direction: column; align-items: center; }

/* Marca de fechamento. O halo é ::before e a imagem é relative de propósito:
   as duas são caixas posicionadas, então quem vem depois no DOM pinta por
   cima — sem isso o brilho cobriria a logo. */
.dl-cta__brand { position: relative; display: inline-flex; margin-bottom: 24px; }
.dl-cta__brand::before {
  content: ""; position: absolute; inset: -60%; pointer-events: none;
  background: radial-gradient(closest-side, rgba(212,175,55,0.30), transparent 72%);
}
.dl-cta__brand img {
  position: relative; display: block;
  width: 82px; height: 82px; object-fit: contain;
  filter: drop-shadow(0 12px 26px rgba(180,145,50,0.32));
}
.dl-cta__title {
  display: flex; flex-direction: column; margin: 18px 0 0;
  font-size: clamp(34px, 5vw, 66px); line-height: 1.04;
  letter-spacing: -0.045em; font-weight: 800; color: #0c121a;
}
.dl-cta__grad {
  background: linear-gradient(100deg, var(--accent), var(--accent-soft) 45%, var(--gold));
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: transparent;
}
.dl-cta__sub { margin-top: 20px; font-size: 15.5px; line-height: 1.72; color: #4b5563; max-width: 46ch; }
.dl-cta__note { margin-top: 32px; color: #9aa2ad; font-size: 9px; letter-spacing: 0.16em; }
.dl-cta .dl-eyebrow { color: #4b5563; }
.dl-cta .dl-eyebrow__line { background: rgba(12,18,26,0.2); }

/* ── Footer ── */
.dl-footer { position: relative; background: #050506; padding: 56px 0 26px; overflow: hidden; }
.dl-footer::before {
  content: ""; position: absolute; left: -80px; top: -60px; width: 420px; height: 260px;
  background: radial-gradient(closest-side, rgba(99,102,241,0.22), transparent);
  pointer-events: none;
}
.dl-footer__inner { display: grid; grid-template-columns: 1fr 1.35fr; gap: 48px; }
.dl-footer__logo { display: inline-flex; align-items: center; }
.dl-footer__brand p { font-size: 13px; line-height: 1.8; color: var(--placeholder); margin-top: 14px; max-width: 34ch; }
.dl-footer__cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
.dl-footer__cols > div { display: grid; gap: 11px; align-content: start; }
.dl-footer__cols span { color: #55555f; font-size: 9px; letter-spacing: 0.14em; }
.dl-footer__cols a { font-size: 13px; color: var(--subtle); transition: color 0.18s ease; }
.dl-footer__cols a:hover { color: var(--strong); }
.dl-footer__bottom {
  display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap;
  margin-top: 46px; padding-top: 20px; border-top: 1px solid var(--line);
  color: var(--placeholder); font-size: 9px;
}

/* ── Responsivo ── */
@media (max-width: 1024px) {
  .dl-hero__grid, .dl-split, .dl-editor, .dl-footer__inner { grid-template-columns: 1fr; }
  .dl-hero__grid { gap: 56px; }
  .dl-journey { grid-template-columns: repeat(2, 1fr); gap: 0 32px; }
  .dl-head { grid-template-columns: 1fr; align-items: start; gap: 18px; }
  .dl-h2 { max-width: none; }
  .dl-plans { grid-template-columns: 1fr; }
  .dl-plan { border-right: 0; border-bottom: 1px solid var(--line); }
  .dl-plan:last-child { border-bottom: 0; }
  .dl-plan__desc { min-height: 0; }
  .dl-hud { display: none; }
  /* Mockup quase de frente quando não há espaço lateral para a isometria. */
  .dl-mockup { transform: perspective(1700px) rotateY(-5deg) rotateX(3deg); }
  .dl-chip-float--a { left: 0; }
  .dl-chip-float--b { right: 0; }

  /* O painel lateral do menu desce para baixo dos links. */
  .dl-menu__inner { grid-template-columns: 1fr; gap: 46px; align-content: start; padding-top: 108px; }
  .dl-menu__ghost { font-size: 11rem; }
}
@media (max-width: 640px) {
  .dl-browser__grid, .dl-footer__cols { grid-template-columns: 1fr; }
  .dl-hero__shapes { display: none; }
  .dl-def { padding: 22px 20px; }
  .dl-journey { grid-template-columns: 1fr; }
  .dl-journey__item { padding: 26px 0 30px; }
  .dl-root .dl-faq__q { grid-template-columns: 40px 1fr 24px; gap: 12px; }
  .dl-faq__a { padding: 0 0 20px 52px; }
  /* Sem largura para o CTA nem para o rótulo: sobram o logo e o hambúrguer, e
     o CTA continua alcançável de dentro do menu. */
  .dl-header__cta, .dl-burger__label { display: none; }
  .dl-header__tipo, .dl-header.is-scrolled .dl-header__tipo { height: 32px; }
  .dl-menu__socials { flex-direction: column; gap: 8px; }
  .dl-menu__ghost { font-size: 7.5rem; }
  /* Sem cursor não há foco para revelar a palavra — ela só ocuparia memória. */
  .dl-ghost { display: none; }
  .dl-cta__brand img { width: 66px; height: 66px; }
  .dl-mockup { transform: none; }
  .dl-mockup__body { grid-template-columns: 72px 1fr; }
  .dl-chip-float { display: none; }
  .dl-stage__float { animation: none; }
}

@media (prefers-reduced-motion: reduce) {
  .dl-marquee__track, .dl-stage__float, .dl-chip-float, .dl-pulse { animation: none; }
  .dl-stage:hover .dl-mockup { transform: perspective(1700px) rotateY(-15deg) rotateX(7deg) rotateZ(1.2deg); }

  /* O menu troca de estado sem o círculo crescendo nem os links subindo, e o
     FAQ abre e fecha direto. Ambos continuam funcionando, só sem percurso. */
  .dl-menu, .dl-menu__side { transition: none; }
  .dl-menu__links a { transform: none; transition: color 0.3s ease; transition-delay: 0s; }
  .dl-faq__panel, .dl-faq__a, .dl-faq__toggle, .dl-faq__bar { transition: none; }
}
`;
