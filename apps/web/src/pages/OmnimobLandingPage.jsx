import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
// A marca do WhatsApp — a cópia local virou `utils/marcasDeRede`.
import { WhatsappMarca } from "../utils/marcasDeRede.jsx";
import { Link } from "react-router-dom";
import { useSeo } from "../utils/seo";
import { useEsquemaDaOmnimob } from "../utils/esquemaDaOmnimob";
import { EfeitosProvider, SeletorDeEfeitos, useEfeitos } from "../components/Efeitos.jsx";
import { Iridescencia } from "../components/Iridescencia.jsx";
import { StaggeredMenu } from "../components/StaggeredMenu.jsx";
import {
  Buildings,
  PaintBrushBroad,
  ChartLineUp,
  Megaphone,
  UsersThree,
  ShieldCheck,
  FacebookLogo,
  InstagramLogo,
} from "@phosphor-icons/react";
import { api } from "../api";
import { OmnimobSplash } from "../components/OmnimobSplash";
import DriftWall from "../components/DriftWall";
import LineSidebar from "../components/LineSidebar";
import Counter from "../components/Counter";
import SpecularButton from "../components/SpecularButton";
import { TrialModal } from "../components/TrialModal";
import {
  CenaDoFluxo,
  GV4_CSS,
  MobileStickyCTA,
  TrustStrip,
  trackLandingEvent,
} from "../components/LandingGrowthV4"; // OMNIMOB_LANDING_GROWTH_V4_IMPORT
import { ExitIntentModal } from "../components/ExitIntentModal"; // OMNIMOB_EXIT_INTENT_V1_IMPORT
import { PLANOS, PACOTES, RECURSOS_PLANOS, RECURSOS_FLOW_PLANOS, planoInfo } from "../utils/planos";
/* Renomeado no import: `MODULOS` sozinho colidiria com a leitura desta
   página, que fala de "módulos" no sentido de seções. */
import { MODULOS as MODULOS_DO_PRODUTO } from "../utils/modulos";
import { ToggleDoFlow } from "../components/ToggleDoFlow.jsx";
import { IconeCheck, IconeX } from "../components/Icones.jsx";
import {
  ACCENT,
  ACCENT_SOFT,
  GOLD,
  MINT,
  ROSE,
  Arrow,
  OmnimobStyles,
  Eyebrow,
  LOGO_LOCKUP_HEADER_SRC,
  LOGO_SRC,
  LOGO_ALT,
  LOGO_SIMBOLO_SRC,
  LogoLockup,
  Reveal,
  Scallop,
  FormaDeFundo,
  parseStat,
  reduzirMovimento,
  useReveal,
} from "../styles/omnimobKit";

/* ── Botões da landing ───────────────────────────────────────────────────────
   Todo botão desta página é um SpecularButton: vidro escuro com uma luz
   correndo pela borda conforme o cursor se aproxima.

   O `Button` aqui é LOCAL, e não mais o do kit, de propósito. O do kit é usado
   por outras nove telas (login, admin, recuperação de senha), e o pedido era
   esta página — trocar lá dentro levaria o efeito, e o custo dele, para telas
   que ninguém pediu.

   ── Sobre a hierarquia ──
   As variantes do kit distinguiam os botões pelo PREENCHIMENTO: `primary` era
   branco sólido, `ghost` era quase transparente, e a página se apoia nisso em
   vários lugares (o par do hero, o cartão de plano em destaque). O especular é
   um botão de vidro: se todos virassem vidro igual, essa leitura se perderia.

   Ela é preservada pelo que o efeito tem de próprio — o véu de fundo, o alcance
   e a intensidade da luz. Quem é o caminho principal acende mais forte e de
   mais longe; o secundário responde de perto e de leve. Mesma pergunta que o
   preenchimento respondia ("qual destes é o daqui?"), com o vocabulário novo. */
const ESPECULAR = {
  primary: { tint: "#ffffff", tintOpacity: 0.16, textColor: "#f6f6f8", lineColor: "#ffffff", baseColor: "#8a8a95", intensity: 1.35, proximity: 320 },
  accent:  { tint: ACCENT,    tintOpacity: 0.30, textColor: "#ffffff", lineColor: "#c7c9ff", baseColor: "#6366f1", intensity: 1.30, proximity: 300 },
  ghost:   { tint: "#ffffff", tintOpacity: 0.04, textColor: "#e7e7ec", lineColor: "#ffffff", baseColor: "#4a4a52", intensity: 0.85, proximity: 210 },
  outline: { tint: "#ffffff", tintOpacity: 0.03, textColor: "#e7e7ec", lineColor: "#ffffff", baseColor: "#4a4a52", intensity: 0.85, proximity: 210 },
  danger:  { tint: "#f87171", tintOpacity: 0.12, textColor: "#fca5a5", lineColor: "#fecaca", baseColor: "#f87171", intensity: 1.05, proximity: 240 },

  /* ── As duas variantes de SEÇÃO CLARA ──
     Atenção ao nome, que engana: no kit, `dark` e `light` não dizem o tom do
     botão em relação ao tema da página, e sim que os dois são feitos para o
     fundo CLARO do CTA final — `dark` é o botão escuro cheio, `light` é o de
     contorno. As duas primeiras versões deste mapa trataram `dark` como "botão
     de tema escuro" e o rótulo branco sumiu dentro da névoa clara da seção.

     Por isso aqui o véu é quase opaco em vez do vidro dos outros: sobre um
     fundo claro, translucidez suficiente para ver a névoa atravessando come o
     contraste do rótulo — e é o preenchimento escuro que dá ao brilho branco
     uma superfície onde aparecer. */
  dark:    { tint: "#0a0a0b", tintOpacity: 0.90, textColor: "#f6f6f8", lineColor: "#ffffff", baseColor: "#0a0a0b", intensity: 1.35, proximity: 300 },
  light:   { tint: "#0c121a", tintOpacity: 0.06, textColor: "#0c121a", lineColor: "#0c121a", baseColor: "#0c121a", intensity: 1.20, proximity: 260 },
};

function Button({ as = "a", variant = "primary", arrow = true, className = "", children, ...rest }) {
  const cfg = ESPECULAR[variant] || ESPECULAR.primary;
  return (
    <SpecularButton
      as={as}
      /* As classes do kit ficam: quarenta regras da página penduram largura,
         posição e respiro nelas (.dl-btn--block, .dl-btn--sm, a largura do par
         do hero, o CTA do cabeçalho). O que o CSS do especular precisa vencer é
         só a aparência, e é o que .dl-btn--especular faz. */
      className={`dl-btn dl-btn--${variant} dl-btn--especular${className ? ` ${className}` : ""}`}
      radius={999}
      shineSize={10}
      shineFade={40}
      thickness={1}
      {...cfg}
      {...rest}
    >
      {children}
      {arrow ? <Arrow /> : null}
    </SpecularButton>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Landing pública da Omnimob.

   Os tokens e as primitivas (botões, vidro, reveal, contagem, eyebrow, grids
   de hairline) vêm de `styles/omnimobKit.jsx` — aqui ficam só os blocos
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
// `tela`, `url` e `legenda` alimentam o mock ao lado: cada recurso mostra a
// parte do produto de que está falando.
/* ── As seis abas de Recursos, e o que cada uma mostra na moldura ────────────

   Três seções viraram esta: "Recursos" (as abas), "Editor de vitrine" (a demo
   interativa) e "Veja acontecer" (as três cenas do fluxo cadastro → vitrine →
   lead). Eram três blocos dizendo a mesma coisa em três desenhos, um atrás do
   outro; agora é uma tela só, e cada aba abre o que antes era uma seção.

   `tela` decide o que a moldura desenha:
   - `editor`   → a demo interativa do editor (EditorAoVivo), que já tem a
                  própria barra de navegador e por isso entra SEM o BrowserMock.
                  No carrossel do celular ela vira a cena "vitrine" do fluxo:
                  a demo reage ao ponteiro, e num carrossel de arrastar isso
                  briga com o gesto.
   - `cadastro`, `vitrine`, `lead` → as cenas do fluxo (CenaDoFluxo, em
                  LandingGrowthV4), dentro do BrowserMock.
   - o resto   → os mocks em silhueta de sempre (Tela). */
const RECURSOS = [
  { Icon: Buildings, title: "Gestão de imóveis", desc: "Cadastre imóveis com fotos, atributos, tipos e status. Tudo organizado e pronto para divulgar.", tela: "cadastro", url: "omnimob.app / imóveis / novo", legenda: "PAINEL WEB · NOVO IMÓVEL" },
  { Icon: PaintBrushBroad, title: "Vitrine personalizável", desc: "Um editor visual intuitivo de arrastar e soltar para montar a página pública da sua imobiliária, do seu jeito.", tela: "editor", url: "omnimob.app / vitrine / editar", legenda: "PAINEL WEB · EDITOR DE VITRINE" },
  { Icon: ChartLineUp, title: "Leads e métricas", desc: "Capture interessados pela vitrine e acompanhe visualizações, leads e vendas por imóvel.", tela: "lead", url: "omnimob.app / leads", legenda: "PAINEL WEB · LEADS" },
  { Icon: Megaphone, title: "Publicação em redes", desc: "Divulgue imóveis no Facebook, Instagram e WhatsApp com legenda pronta em poucos cliques.", tela: "redes", url: "omnimob.app / publicações", legenda: "PAINEL WEB · PUBLICAÇÕES" },
  { Icon: UsersThree, title: "Usuários e permissões", desc: "Crie cargos com permissões granulares para corretores, marketing, gerência e mais.", tela: "usuarios", url: "omnimob.app / usuários", legenda: "PAINEL WEB · EQUIPE" },
  { Icon: ShieldCheck, title: "Multi-tenant seguro", desc: "Cada imobiliária com seus próprios dados, usuários e vitrine — isolados e seguros.", tela: "tenants", url: "omnimob.app / admin", legenda: "SUPER-ADMIN · TENANTS" },
];

// De quantos em quantos milissegundos o carrossel avança sozinho.
const RECURSO_INTERVALO = 3800;
/* No carrossel do celular cada passo troca a tela E o texto ao lado dela; no
   desktop troca só a moldura, com as seis abas sempre à vista. Três segundos
   ali é ritmo de vitrine, aqui seria menos tempo do que a frase leva para ser
   lida. */
const RECURSO_INTERVALO_CARROSSEL = 5200;

/* Quantos cartões distintos existem em cada esteira da tela "imóveis". A lista
   é renderizada duas vezes seguidas e o percurso da animação é exatamente uma
   cópia, então o laço fecha sem emenda (ver .dl-esteira no CSS). */
const ESTEIRA_CARTOES = 6;

/* ── Silhuetas de imóvel ─────────────────────────────────────────────────────
   Um desenho por cartão, para a esteira parecer um acervo de anúncios
   diferentes em vez do mesmo retângulo doze vezes. São volumes chapados no
   mesmo idioma das outras silhuetas da página — uma cor só para a massa, as
   janelas em recorte escuro, sem contorno e sem detalhe. De longe o que precisa
   aparecer é "outro imóvel", não a ilustração.

   Todas no mesmo viewBox de 24 × 18 e assentadas na linha de base y=17, para as
   seis parecerem plantadas no mesmo chão quando passam lado a lado. */
const ESTEIRA_SILHUETAS = [
  // Casa térrea
  <>
    <path className="dl-esteira__vulto" d="M12 2.4 22.4 10.2 20 10.2 20 17 4 17 4 10.2 1.6 10.2Z" />
    <rect className="dl-esteira__vao" x="10.6" y="12.8" width="2.8" height="4.2" />
    <rect className="dl-esteira__vao" x="5.8" y="11.6" width="2.6" height="2.6" />
  </>,
  // Prédio alto
  <>
    <rect className="dl-esteira__vulto" x="7" y="1.6" width="10" height="15.4" />
    {[3.2, 6, 8.8, 11.6].map((y) => (
      <g key={y}>
        <rect className="dl-esteira__vao" x="8.6" y={y} width="2.8" height="1.8" />
        <rect className="dl-esteira__vao" x="12.6" y={y} width="2.8" height="1.8" />
      </g>
    ))}
    <rect className="dl-esteira__vao" x="10.6" y="14.4" width="2.8" height="2.6" />
  </>,
  // Duas torres
  <>
    <rect className="dl-esteira__vulto" x="2.4" y="4.6" width="8" height="12.4" />
    <rect className="dl-esteira__vulto" x="12.4" y="8" width="9.2" height="9" />
    {[6.2, 8.8, 11.4].map((y) => (
      <g key={y}>
        <rect className="dl-esteira__vao" x="3.9" y={y} width="2.2" height="1.6" />
        <rect className="dl-esteira__vao" x="7.1" y={y} width="2.2" height="1.6" />
      </g>
    ))}
    {[9.6, 12.4].map((y) => (
      <g key={y}>
        <rect className="dl-esteira__vao" x="13.9" y={y} width="2.4" height="1.8" />
        <rect className="dl-esteira__vao" x="17.4" y={y} width="2.4" height="1.8" />
      </g>
    ))}
  </>,
  /* Sobrado. A faixa escura entre os andares e as janelas em dois níveis são o
     que o separam da casa térrea: só o telhado mais baixo não bastava — de
     longe os dois viravam o mesmo desenho. */
  <>
    <path className="dl-esteira__vulto" d="M12 2.2 21.6 7.4 2.4 7.4Z" />
    <rect className="dl-esteira__vulto" x="4" y="7.4" width="16" height="9.6" />
    <rect className="dl-esteira__vao" x="4" y="11.8" width="16" height="0.9" />
    <rect className="dl-esteira__vao" x="6.2" y="8.7" width="2.6" height="2.3" />
    <rect className="dl-esteira__vao" x="15.2" y="8.7" width="2.6" height="2.3" />
    <rect className="dl-esteira__vao" x="6.2" y="13.5" width="2.6" height="2.3" />
    <rect className="dl-esteira__vao" x="13.6" y="13" width="2.8" height="4" />
  </>,
  // Prédio escalonado, com a cobertura recuada
  <>
    <rect className="dl-esteira__vulto" x="2.6" y="9.4" width="18.8" height="7.6" />
    <rect className="dl-esteira__vulto" x="8" y="2.6" width="8.4" height="6.8" />
    <rect className="dl-esteira__vao" x="9.4" y="4.4" width="2.2" height="1.8" />
    <rect className="dl-esteira__vao" x="12.8" y="4.4" width="2.2" height="1.8" />
    {[4.2, 8, 11.8, 15.6, 18.6].map((x) => (
      <rect key={x} className="dl-esteira__vao" x={x} y="11.2" width="2.2" height="1.8" />
    ))}
  </>,
  // Casa com garagem
  <>
    <path className="dl-esteira__vulto" d="M8.6 2.6 16.6 8.2 0.6 8.2 15.2 8.2 15.2 17 2 17 2 8.2Z" />
    <rect className="dl-esteira__vulto" x="15.2" y="11.4" width="6.4" height="5.6" />
    <rect className="dl-esteira__vao" x="3.4" y="9.6" width="2.4" height="2.2" />
    <rect className="dl-esteira__vao" x="7.2" y="12.4" width="2.6" height="4.6" />
    <rect className="dl-esteira__vao" x="16.4" y="13" width="4" height="4" />
  </>,
];

/* Que desenho vai em cada cartão, fila por fila (uma linha por esteira, uma
   coluna por cartão da cópia). Escrita à mão, e não sorteada por aritmética:
   com seis desenhos e seis cartões, toda conta modular dá a mesma roda girando,
   só começando em outro ponto — e três filas girando a mesma roda se parecem
   quando o movimento as alinha. */
const ESTEIRA_ORDEM = [
  [0, 4, 1, 5, 2, 3],
  [5, 1, 3, 0, 4, 2],
  [2, 3, 5, 1, 0, 4],
];

// Inclinação do degradê de cada foto. Só para dois cartões vizinhos não terem
// exatamente a mesma luz — mais uma pista de que são anúncios diferentes.
const ESTEIRA_GIROS = ["135deg", "108deg", "158deg", "122deg"];

/* Blocos da vitrine no mock do editor (tela "vitrine"). O arranjo repete o
   padrão do editor de verdade: cabeçalho e título ocupando a linha inteira,
   destaques ao lado dos imóveis, widgets e rodapé fechando embaixo. `sel` é o
   bloco selecionado — o que aparece com contorno e alças de redimensionar. */
const BUILDER_BLOCOS = [
  { id: "cab", nome: "CABEÇALHO" },
  { id: "tit", nome: "TÍTULO" },
  { id: "des", nome: "DESTAQUES" },
  { id: "imo", nome: "IMÓVEIS", sel: true },
  { id: "wid", nome: "WIDGETS" },
  { id: "rod", nome: "RODAPÉ" },
];

/* Imobiliárias do mock de multi-tenant. Cada uma com a própria cor, a própria
   vitrine e a própria parede: é a leitura que uma lista de linhas não dá — ali
   os tenants pareceriam apenas mais registros da mesma tabela, que é o oposto
   do que a célula precisa dizer (e é o que a célula vizinha, de usuários, já
   faz com o mesmo desenho). */
const TENANTS = [
  { slug: "imobiliaria-centro", cor: ACCENT_SOFT },
  { slug: "casa-nobre", cor: GOLD },
  { slug: "alto-padrao", cor: MINT },
  { slug: "vista-mar", cor: ROSE },
];


/* Os três previews da tela de publicações. Cores e degradês são os mesmos do
   passo "Divulgar" do cadastro (PropertyForm), para a landing e o produto
   falarem a mesma língua. `de` é de onde o card entra: os laterais vêm do
   centro, simulando o card único que se divide em três. */
const REDES = [
  {
    nome: "FACEBOOK", Icon: FacebookLogo, raio: "8px", de: "62%",
    cor: "#1877f2",
    anel: "linear-gradient(115deg,#1877f2,#4293ff,#0a58ca,#3b82f6,#1877f2)",
    brilho: "rgba(24,119,242,0.45)",
  },
  {
    nome: "INSTAGRAM", Icon: InstagramLogo, raio: "8px", de: "0%",
    cor: "linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)",
    anel: "linear-gradient(115deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888,#f09433)",
    brilho: "rgba(220,39,67,0.42)",
  },
  {
    nome: "WHATSAPP", Icon: WhatsappMarca, raio: "50%", de: "-62%",
    cor: "#25d366",
    anel: "linear-gradient(115deg,#25d366,#128c7e,#34e07a,#25d366)",
    brilho: "rgba(37,211,102,0.42)",
  },
];

/* ── Editor ao vivo ──────────────────────────────────────────────────────────
   O mock da seção do editor mostra um ponteiro rearranjando os blocos da
   vitrine, em laço. Em vez de escrever os keyframes na mão (seis blocos × seis
   movimentos = muita coordenada para manter à mão e fácil de dessincronizar),
   os passos abaixo descrevem só o LAYOUT de cada momento e o CSS sai calculado
   daí — inclusive o caminho do ponteiro, que é sempre o centro do bloco que
   está sendo levado.

   Cada passo é a vitrine inteira: linhas empilhadas, com um ou dois blocos
   dividindo a largura. `arrasta` é o bloco que o ponteiro leva ao sair deste
   passo para o próximo. O último passo volta ao primeiro, então o laço fecha
   sem salto. ──────────────────────────────────────────────────────────────── */

// Sem rótulo dentro: os blocos são só volumes, como as miniaturas do mockup.
const EDITOR_BLOCOS = ["header", "titulo", "destaques", "imoveis", "widgets", "rodape"];

/* O miolo de cada bloco: quantas silhuetas ele tem e quantas peças vão DENTRO
   de cada silhueta. O arranjo (fila, coluna, grade) fica no CSS de cada
   modificador — aqui só as contagens, porque é o que muda de bloco para bloco.

   As peças existem porque metade dos blocos não se explicava: cabeçalho, título
   e rodapé já tinham forma própria (marca + menu, chamada + apoio, links), mas
   destaques, imóveis e widgets eram o mesmo retângulo liso repetido. Onde
   deveria estar escrito "aqui vai uma grade de imóveis" estava escrito só "aqui
   vai alguma coisa".

     header    marca + três itens de menu
     titulo    sobretítulo, chamada e linha de apoio
     destaques três cartões, cada um com selo e duas linhas
     imoveis   seis cartões de imóvel, cada um com foto e legenda
     widgets   dois painéis, cada um com texto e botão
     rodape    régua fina + três links */
const EDITOR_MIOLO = {
  header: { itens: 4, pecas: 0 },
  titulo: { itens: 3, pecas: 0 },
  destaques: { itens: 3, pecas: 3 },
  imoveis: { itens: 6, pecas: 2 },
  widgets: { itens: 2, pecas: 3 },
  rodape: { itens: 4, pecas: 0 },
};

// Peso de altura de cada bloco; a altura da linha é a do bloco mais alto dela.
const EDITOR_PESO = { header: 1, titulo: 0.8, destaques: 1.5, imoveis: 1.5, widgets: 1.5, rodape: 0.7 };

const EDITOR_PASSOS = [
  { arrasta: "destaques", linhas: [["header"], ["titulo"], ["destaques", "imoveis"], ["widgets"], ["rodape"]] },
  { arrasta: "titulo", linhas: [["header"], ["titulo"], ["imoveis", "destaques"], ["widgets"], ["rodape"]] },
  { arrasta: "rodape", linhas: [["header"], ["imoveis", "destaques"], ["titulo"], ["widgets"], ["rodape"]] },
  { arrasta: "titulo", linhas: [["header"], ["imoveis", "destaques"], ["titulo"], ["widgets", "rodape"]] },
  { arrasta: "rodape", linhas: [["header"], ["titulo"], ["imoveis", "destaques"], ["widgets", "rodape"]] },
  { arrasta: "destaques", linhas: [["header"], ["titulo"], ["imoveis", "destaques"], ["widgets"], ["rodape"]] },
];

/* O que cada bloco é, em uma frase. Aparece quando alguém toca no bloco dentro
   da demonstração — a animação sozinha mostra que os blocos se movem, mas não
   diz o que eles são, e essa é justamente a dúvida de quem nunca abriu o
   editor. */
const EDITOR_INFO = {
  header: { nome: "Cabeçalho", texto: "Sua marca, o menu e o contato. É o que fica no topo de toda a vitrine." },
  titulo: { nome: "Título", texto: "A chamada de abertura da página, escrita direto nela — sem campo, sem formulário." },
  destaques: { nome: "Destaques", texto: "Três cartões para o que você quer primeiro: um bairro, um lançamento, uma condição." },
  imoveis: { nome: "Imóveis", texto: "A vitrine em si. Puxa sozinha o que está publicado no painel, na ordem que você definir." },
  widgets: { nome: "Widgets", texto: "Blocos livres: um texto, um botão, um convite para chamar no WhatsApp." },
  rodape: { nome: "Rodapé", texto: "Links, redes sociais e os dados da imobiliária — CRECI, endereço, telefone." },
};

// Quanto tempo parado antes de a demonstração voltar a andar sozinha.
const EDITOR_ESPERA = 4000;

/* Fechar é em dois tempos: primeiro o texto some, e só depois o bloco volta ao
   tamanho normal. Este é o intervalo entre as duas coisas, e ele precisa cobrir
   o fade do texto (0,16s no CSS).

   Por que em JS e não com transition-delay: a geometria do bloco pertence à
   animação em laço, e transição não age sobre propriedade que uma animação está
   dirigindo — no instante em que a classe cai, o bloco assume a posição do laço
   sem passar por nenhum meio-termo. A única forma de segurá-lo é adiar a queda
   da classe, que é o que este tempo faz. */
const EDITOR_SAIDA = 200;

const EDITOR_VAO = 4; // respiro entre blocos, em % da caixa
const EDITOR_FATIA = 100 / EDITOR_PASSOS.length; // fatia da linha do tempo por movimento
const EDITOR_PEGA = 0.3; // instante em que o ponteiro alcança o bloco
const EDITOR_SOLTA = 0.72; // instante em que o bloco chega ao destino
const EDITOR_ASSENTA = 0.06; // sobra depois de soltar, para o bloco assentar

// Converte um passo (linhas) em caixas x/y/largura/altura, tudo em %.
function editorPosicoes(linhas) {
  const alturas = linhas.map((linha) => Math.max(...linha.map((id) => EDITOR_PESO[id])));
  const soma = alturas.reduce((a, b) => a + b, 0);
  const escala = (100 - EDITOR_VAO * (linhas.length - 1)) / soma;
  const pos = {};
  let y = 0;
  linhas.forEach((linha, i) => {
    const h = alturas[i] * escala;
    const w = (100 - EDITOR_VAO * (linha.length - 1)) / linha.length;
    linha.forEach((id, j) => {
      pos[id] = { x: j * (w + EDITOR_VAO), y, w, h };
    });
    y += h + EDITOR_VAO;
  });
  return pos;
}

function editorCSS() {
  const mapas = EDITOR_PASSOS.map((passo) => editorPosicoes(passo.linhas));
  const n = EDITOR_PASSOS.length;
  const num = (v) => Number(v.toFixed(3));
  const caixa = (p) => `left:${num(p.x)}%;top:${num(p.y)}%;width:${num(p.w)}%;height:${num(p.h)}%`;
  const centro = (p) => ({ x: p.x + p.w / 2, y: p.y + p.h / 2 });
  const EASE = "animation-timing-function:cubic-bezier(0.5,0,0.2,1)";
  const NO_AR = "box-shadow:0 18px 34px -12px rgba(0,0,0,0.8);border-color:rgba(129,140,248,0.55);z-index:3";
  const POUSADO = "box-shadow:0 0 0 0 rgba(0,0,0,0);border-color:transparent;z-index:1";

  let css = "";

  EDITOR_BLOCOS.forEach((id) => {
    // Posição de partida também fora da animação: assim o bloco já nasce no
    // lugar certo, e com movimento reduzido ele simplesmente fica parado ali.
    css += `.dl-ed__bloco--${id}{${caixa(mapas[0][id])};animation-name:edBloco-${id}}\n`;

    const paradas = [];
    for (let k = 0; k < n; k += 1) {
      const t0 = k * EDITOR_FATIA;
      const atual = mapas[k][id];
      const proximo = mapas[(k + 1) % n][id];
      const naMao = EDITOR_PASSOS[k].arrasta === id;
      paradas.push(`${num(t0)}%{${caixa(atual)};${POUSADO}}`);
      paradas.push(`${num(t0 + EDITOR_PEGA * EDITOR_FATIA)}%{${caixa(atual)};${naMao ? NO_AR : POUSADO};${EASE}}`);
      paradas.push(`${num(t0 + EDITOR_SOLTA * EDITOR_FATIA)}%{${caixa(proximo)};${naMao ? NO_AR : POUSADO}}`);
      paradas.push(
        `${num(t0 + (EDITOR_SOLTA + EDITOR_ASSENTA) * EDITOR_FATIA)}%{${caixa(proximo)};${POUSADO}}`,
      );
    }
    paradas.push(`100%{${caixa(mapas[0][id])};${POUSADO}}`);
    css += `@keyframes edBloco-${id}{${paradas.join("")}}\n`;
  });

  // Ponteiro: vai até o centro do bloco da vez, aperta, leva até o destino.
  const inicio = centro(mapas[0][EDITOR_PASSOS[n - 1].arrasta]);
  const ponto = (c, escala) => `left:${num(c.x)}%;top:${num(c.y)}%;scale:${escala}`;
  const paradasP = [`0%{${ponto(inicio, 1)};${EASE}}`];
  for (let k = 0; k < n; k += 1) {
    const t0 = k * EDITOR_FATIA;
    const id = EDITOR_PASSOS[k].arrasta;
    const de = centro(mapas[k][id]);
    const para = centro(mapas[(k + 1) % n][id]);
    paradasP.push(`${num(t0 + EDITOR_PEGA * EDITOR_FATIA)}%{${ponto(de, 0.84)};${EASE}}`);
    paradasP.push(`${num(t0 + EDITOR_SOLTA * EDITOR_FATIA)}%{${ponto(para, 0.84)}}`);
    paradasP.push(`${num(t0 + (EDITOR_SOLTA + EDITOR_ASSENTA) * EDITOR_FATIA)}%{${ponto(para, 1)};${EASE}}`);
  }
  paradasP.push(`100%{${ponto(inicio, 1)}}`);
  css += `@keyframes edPonteiro{${paradasP.join("")}}\n`;

  return css;
}

// Itens do menu em tela cheia. A numeração e o atraso em cascata saem do
// índice, então a ordem aqui é a ordem que aparece.
const MENU_ITENS = [
  { label: "Início", href: "#topo" },
  { label: "Recursos", href: "#recursos" },
  { label: "Como funciona", href: "#jornada" },
  { label: "Planos", href: "#planos" },
  { label: "Dúvidas", href: "#faq" },
  /* Rotulado "Começar" e não "Contato": `#contato` é a seção de chamada para
     ação ("Pronto para vender mais imóveis?"), e desde que existe a página
     /contato os dois nomes iguais mandavam a pessoa para o lugar errado. */
  { label: "Começar", href: "#contato" },
];

/* As páginas da Omnimob que não são a landing. Ficam no menu, e não só no
   rodapé: o rodapé desta página está depois de 5.800 linhas de conteúdo, e
   ninguém rola até lá para procurar "Sobre". */
const PAGINAS_DA_OMNIMOB = [
  { para: "/vitrines", label: "Vitrines publicadas" },
  { para: "/sobre", label: "Sobre a Omnimob" },
  { para: "/contato", label: "Falar com a gente" },
];

/* ── OS RELATOS DA PAREDE ────────────────────────────────────────────────────

   Cada cartão da parede "Por que Omnimob" é uma pessoa falando: nome, cargo,
   imobiliária, cidade e o que ela diz. `frase` é o que cabe no cartão; `relato`
   é o texto inteiro, que abre no painel ao clicar.

   ── TUDO AQUI É FICTÍCIO, E ESTÁ ESCRITO ASSIM DE PROPÓSITO ──
   Pessoas, imobiliárias e cidades não existem — são hipóteses de uso do
   produto, uma por recurso, para a parede não ser uma lista de funcionalidades
   com outro nome. Por isso NÃO há fotos de pessoas: `foto` fica vazio e o
   cartão desenha um avatar de iniciais. No dia em que houver depoimentos de
   verdade, é só preencher `foto` (public/relatos/…) e trocar o texto — e é
   nesse dia que esta seção deixa de ser hipótese. Depoimento inventado com
   rosto de gente numa página que vende é publicidade enganosa (CDC, art. 37).

   `tom` (mint | gold | accent | rose) pinta o cartão como os antigos cartões de
   estatística: é o "marca-texto" que dá ritmo à parede. Os de tom `rose` são
   os do Omniflow.

   ── O TOM DO TEXTO ──
   Escrito como gente escreve, e não como release: minúscula no começo, frase
   sem ponto, "pra", "tá", "kkk", número em algarismo, um parêntese no meio da
   ideia. Vinte e quatro depoimentos todos na mesma gramática perfeita denunciam
   a origem de longe — e é a irregularidade que faz parecer que são pessoas
   diferentes. Ao editar, resista a "corrigir" para o padrão. */
const RELATOS = [
  {
    nome: "Mariana Teles", cargo: "Sócia-diretora", imobiliaria: "Horizonte Azul Imóveis", cidade: "Vila Serena", uf: "SP",
    frase: "o lead chega do site já com o imóvel e o corretor certo. acabou a planilha de segunda de manhã, graças a Deus",
    relato: "Antes os contatos do site caíam num e-mail que alguém lembrava (ou não) de repassar no grupo. Hoje o interessado aparece no painel com o imóvel que ele viu, de onde veio e quem vai atender. Pela primeira vez eu sei de onde vem cada negócio, e olha que já tô nisso há 14 anos.",
  },
  {
    nome: "Rafael Nogueira", cargo: "Corretor", imobiliaria: "Casa & Cia", cidade: "Monte Aurora", uf: "MG",
    frase: "montei a vitrine num sábado de manhã arrastando os bloco. não liguei pra ninguém de TI kkk",
    relato: "Sempre dependi de agência pra mexer no site, e cada vírgula levava uma semana e um boleto. No editor eu mesmo troquei a ordem dos blocos, botei as cores da imobiliária e escrevi direto na página. O que tá no editor é o que sai no ar, sem surpresa.",
    tom: "mint",
  },
  {
    nome: "Cláudia Farias", cargo: "Gerente comercial", imobiliaria: "Lar Serrano", cidade: "Alto do Cedro", uf: "RS",
    frase: "Sei qual imóvel todo mundo abre e ninguém pergunta. Aí é foto ou preço, não tem erro",
    relato: "O desempenho por imóvel me mostra visualização, lead e venda no mesmo cadastro. Apartamento que recebe 300 visitas e zero contato tem alguma coisa errada — antes eu ia descobrir isso 3 meses depois, na reunião de resultado. Agora vejo na quarta-feira.",
  },
  {
    nome: "Diego Salvatti", cargo: "Dono", imobiliaria: "Pontal Imóveis", cidade: "Porto das Garças", uf: "SC",
    frase: "Cadastro uma vez e vai pro site, pro ZAP e pro Instagram. Uma ficha só. Parece bobagem mas não é",
    relato: "Eu mantinha três cadastros do mesmo imóvel: sistema, site e portal. Preço errado em um deles e pronto, dor de cabeça com cliente. Hoje a ficha é uma, o feed dos portais e a publicação nas redes leem dela e eu durmo tranquilo.",
    tom: "gold",
  },
  {
    nome: "Beatriz Camargo", cargo: "Corretora", imobiliaria: "Maresia Imobiliária", cidade: "Baía Clara", uf: "ES",
    frase: "o aviso de lead parado me salvou de perder um cliente que eu tinha esquecido na quinta. ele fechou.",
    relato: "Recebo um e-mail quando um lead fica dois dias sem ninguém encostar. Parece pouco, mas eu atendo umas 30 pessoas por semana e sempre alguém cai no esquecimento, é humano. Agora quem cai volta — e o cliente nem fica sabendo que quase foi esquecido rs",
  },
  {
    nome: "Henrique Dutra", cargo: "Sócio", imobiliaria: "Raiz Imóveis", cidade: "São Bento das Colinas", uf: "PR",
    frase: "cada um vê o que é dele. estagiário não apaga imóvel mais. sim, isso já aconteceu aqui",
    relato: "Criei os cargos: administrador, corretor e um só pra quem edita a vitrine. Antes era todo mundo com a mesma senha de admin, e um belo dia sumiram 12 imóveis e ninguém sabia como. Hoje o registro de atividade diz quem fez o quê, e cada um alcança o que o cargo permite.",
    tom: "accent",
  },
  {
    nome: "Luciana Prado", cargo: "Diretora", imobiliaria: "Bem-Morar", cidade: "Santa Rita das Pedras", uf: "GO",
    frase: "Nosso domínio, nossa cara. O cliente não faz ideia que tem uma Omnimob por trás, e é assim que tem que ser",
    relato: "A vitrine está no nosso endereço, com as nossas cores e o nosso logo. A tecnologia fica invisível. Quem aparece pra quem procura imóvel é a imobiliária — o software é coadjuvante, e o bom coadjuvante ninguém nota.",
  },
  {
    nome: "Tiago Menezes", cargo: "Corretor autônomo", imobiliaria: "Tiago Menezes Imóveis", cidade: "Bosque Alegre", uf: "SP",
    frase: "sou eu sozinho. pago no pix, sem cartão, e o sistema me lembra antes de vencer. nunca mais acordei fora do ar",
    relato: "Não tenho CNPJ com cartão corporativo, é eu e o celular. Pago o plano mensal por Pix e recebo um lembrete 7 dias antes e outro na véspera. Pra quem trabalha sozinho um dia fora do ar é um dia sem trabalhar, então isso pra mim não é detalhe não.",
    tom: "mint",
  },
  {
    nome: "Fernanda Lisboa", cargo: "Marketing", imobiliaria: "Vértice Imóveis", cidade: "Ribeirão Dourado", uf: "MG",
    frase: "A descrição do imóvel a IA escreve em 10 segundos. Eu dou uma revisada, ajusto o tom e vai",
    relato: "Escrever descrição pra 40 imóveis novos por mês era o meu gargalo, sério. Hoje a IA gera título, descrição e legenda a partir da ficha. Eu tiro os exageros, boto a nossa voz e publico. O tempo que sobrou virou vídeo e story, que é o que traz gente de verdade.",
  },
  {
    nome: "Paulo Sérgio Andrade", cargo: "Dono", imobiliaria: "Alameda Imóveis", cidade: "Pedra Branca do Norte", uf: "CE",
    frase: "importei 1.200 imóveis do sistema antigo pela URL do feed. numa tarde. eu tinha pavor disso",
    relato: "Eu tinha medo de trocar de sistema por causa do acervo, era o que me segurava. Colei o endereço do feed do sistema antigo, conferi a prévia — preço no lugar certo, fotos copiadas — e rodei. Entraram como rascunho e a equipe revisou aos poucos antes de publicar. Nem doeu.",
    tom: "gold",
  },
  {
    nome: "Aline Botelho", cargo: "Corretora", imobiliaria: "Sol Nascente", cidade: "Vale dos Ipês", uf: "MT",
    frase: "errei o layout inteiro da vitrine e voltei atrás com ctrl+z. umas 50 vezes, se bobear",
    relato: "No editor eu experimento sem medo: mudo tudo de lugar, não gosto, desfaço. Ele guarda 50 passos e vai salvando sozinho enquanto eu mexo. Nunca mais perdi uma versão que estava boa por ter clicado no lugar errado.",
  },
  {
    nome: "Marcos Vinícius Rocha", cargo: "Gerente", imobiliaria: "Terra Firme Imóveis", cidade: "Campo Sereno", uf: "MS",
    frase: "O celular tem o layout dele. Não é o site do computador espremido — isso muda tudo pra gente",
    relato: "70% dos nossos acessos são pelo celular. Na Omnimob a vitrine do celular é montada separada da do computador: mesma informação, outra ordem, outro tamanho de foto. Foi a diferença entre o cliente rolar a página e o cliente ir embora.",
    tom: "accent",
  },
  {
    nome: "Renata Siqueira", cargo: "Atendimento", imobiliaria: "Novo Lar", cidade: "Serra do Lume", uf: "RJ",
    frase: "o funil me mostrou onde os leads morriam. era na visita. mudamos o roteiro e pronto",
    relato: "O relatório de atendimento mostra até onde cada lead chegou e por que os perdidos se perderam. Descobrimos que a maioria parava depois da visita. Trocamos quem acompanhava as visitas, e o motivo de perda mais comum simplesmente sumiu do gráfico. Dado bom é isso.",
  },
  {
    nome: "Gustavo Amorim", cargo: "Corretor", imobiliaria: "Recanto Imóveis", cidade: "Lagoa Nova do Sul", uf: "RS",
    frase: "peço a arte do status com um toque, publico e vou pra próxima visita. eram 6 por dia no Canva, dentro do carro",
    relato: "O sistema gera a arte do imóvel no formato do status do WhatsApp, com foto, preço e o meu contato. Eu só publico. Parece detalhe mas eu posto 6 imóveis por dia, e antes fazia cada um no Canva, no estacionamento, entre uma visita e outra. Ganhei uma hora por dia fácil.",
    tom: "gold",
  },
  {
    nome: "Simone Carvalho", cargo: "Sócia", imobiliaria: "Trilha Imóveis", cidade: "Cruzeiro das Palmas", uf: "BA",
    frase: "Abri um chamado 22h e de manhã a resposta tava lá no painel, com a conversa inteira. Não é ticket perdido em e-mail",
    relato: "O suporte fica dentro do sistema: abro o chamado, o print da tela vai junto, e a conversa continua ali. Quando resolvem eu sei quem resolveu e quando. Se o problema voltar, reabro o mesmo chamado em vez de explicar tudo de novo pra outra pessoa.",
  },
  {
    nome: "Eduardo Peixoto", cargo: "Diretor", imobiliaria: "Ipê Amarelo Imobiliária", cidade: "Praia do Sol Nascente", uf: "RN",
    frase: "Meus dados são meus. Exportei tudo num arquivo só pra ter certeza — e tinha tudo mesmo",
    relato: "Antes de assinar perguntei como é que eu saía, se um dia quisesse. A resposta foi um botão: exporta imóveis, clientes, leads e equipe num JSON. Testei no primeiro mês. Saber que a porta tá aberta foi, ironicamente, o que me fez ficar.",
    tom: "mint",
  },
  {
    nome: "Patrícia Ramalho", cargo: "Gerente de locação", imobiliaria: "Âncora Imóveis", cidade: "Mirante Alto", uf: "SP",
    frase: "O cliente diz o que procura e o sistema me avisa quando entra um imóvel parecido. Já fechei locação no dia que o imóvel entrou",
    relato: "Cadastro o perfil de busca: bairro, faixa de preço, quartos. Quando entra um imóvel que casa com o perfil, ou quase casa, um pouquinho acima do teto, eu vejo o cruzamento e ligo na hora. Locação é velocidade, quem liga primeiro leva.",
  },
  {
    nome: "Ricardo Tavares", cargo: "Dono", imobiliaria: "Mirante Imobiliária", cidade: "Jardim das Acácias", uf: "PR",
    frase: "a página de cada bairro aparece no Google. gente chega procurando \"apartamento em\" e cai na minha vitrine, do nada",
    relato: "A vitrine gera uma página por bairro e por tipo de imóvel, com o texto certo pra busca. Não fiz nada além de cadastrar bem o endereço. Em 4 meses o site passou a trazer mais contato que o portal que eu pago caro. Tô até repensando o portal.",
    tom: "accent",
  },
  {
    nome: "Camila Ferraz", cargo: "Corretora", imobiliaria: "Aurora Imóveis", cidade: "Terra Nova do Vale", uf: "TO",
    frase: "o interessado marca a visita direto na página do imóvel, com dia e período. metade do vai-e-vem do zap sumiu",
    relato: "O formulário do imóvel tem pedido de visita: a pessoa escolhe a data e se prefere de manhã ou à tarde, e isso chega pra mim como lead já com contexto. Ligo só pra confirmar. Antes eram uns 8 áudios pra marcar uma visita, vocês sabem como é.",
  },
  /* ── O Omniflow ── */
  {
    nome: "Dra. Helena Vasconcelos", cargo: "Jurídico", imobiliaria: "Vale Verde Imobiliária", cidade: "Colinas do Oeste", uf: "MG",
    frase: "O contrato não sai com campo em branco. Falta dado, ele não gera — e me diz o que falta. Pro jurídico isso é tudo",
    relato: "Nas minutas do Omniflow um marcador sem informação vira pendência, não um espaço vazio no documento. Já vi contrato assinado com o CPF do comprador em branco, em outro sistema, e o transtorno que deu. Aqui isso é impossível por construção.",
    tom: "rose",
  },
  {
    nome: "Otávio Brandão", cargo: "Financeiro", imobiliaria: "Acácia Imóveis", cidade: "Enseada Bonita", uf: "SC",
    frase: "a comissão é dividida no fechamento e fica congelada ali. mudou a política depois? o passado não muda. fechar o mês virou conferência",
    relato: "O split do negócio é calculado uma vez, com aritmética decimal (quem já viu 50838,000000000007 numa planilha sabe do que eu falo), e gravado no próprio negócio. Quando a diretoria mudou os percentuais em janeiro, nada de dezembro foi reescrito.",
    tom: "rose",
  },
  {
    nome: "Vanessa Quintela", cargo: "Gerente de vendas", imobiliaria: "Brisa Imobiliária", cidade: "Vila Formosa do Sul", uf: "RS",
    frase: "O negócio só vira ganho com jurídico e financeiro validando. E o painel diz o que falta — acabou o \"quem tava esperando quem\"",
    relato: "A trava de fechamento não bloqueia em silêncio, ela lista os motivos: falta a validação jurídica, falta a financeira, falta o contrato assinado. Cada um sabe o que é seu. Antes era reunião de meia hora pra descobrir que faltava uma assinatura.",
    tom: "rose",
  },
  {
    nome: "Bruno Cavalcanti", cargo: "Corretor", imobiliaria: "Marco Zero Imóveis", cidade: "Pontal das Águas", uf: "PE",
    frase: "o lead do ZAP entra no funil sozinho. colei uma URL no portal e nunca mais copiei e colei nada",
    relato: "Cada portal ganhou um endereço de captação, e é isso que vai no integrador deles. O que chega vira negócio no primeiro estágio, com nome, telefone e o imóvel. Quando um portal mudou o formato do envio, o suporte olhou o corpo original da chamada e ajustou no mesmo dia.",
    tom: "rose",
  },
  {
    nome: "Isabela Monteiro", cargo: "Sócia", imobiliaria: "Girassol Imóveis", cidade: "Morro Azul da Serra", uf: "SP",
    frase: "o contrato vai pra assinatura digital de dentro do negócio e volta assinado pro mesmo lugar. eram 4 sistemas antes",
    relato: "Gero a minuta, mando pra Clicksign sem sair da tela e acompanho quem já assinou. Quando o último assina, o negócio recebe o contrato e libera o fechamento. Antes eram quatro sistemas abertos e um e-mail com anexo pra cada parte. Não sinto falta.",
    tom: "rose",
  },
];

/* Avatar de iniciais, no lugar da foto que não existe (ver o cabeçalho de
   RELATOS). Uma cor por pessoa, tirada do nome, para dois cartões vizinhos não
   saírem iguais. Com `foto` preenchida, a imagem entra no lugar. */
const CORES_DO_AVATAR = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316"];
function AvatarDoRelato({ nome, foto }) {
  if (foto) return <img className="dl-relato__foto" src={foto} alt="" width={44} height={44} loading="lazy" />;
  const partes = nome.replace(/^Dra?\.\s*/, "").split(/\s+/);
  const iniciais = (partes[0][0] + (partes[partes.length - 1][0] || "")).toUpperCase();
  let h = 0;
  for (const ch of nome) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  const cor = CORES_DO_AVATAR[h % CORES_DO_AVATAR.length];
  return (
    <span className="dl-relato__foto dl-relato__foto--iniciais" style={{ "--avatar": cor }} aria-hidden="true">
      {iniciais}
    </span>
  );
}




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
    a: "Ficam. A Omnimob é multi-tenant: cada imobiliária tem seus próprios imóveis, usuários, leads e vitrine.",
  },
  /* A pergunta que trava quem já opera. Ela existe na página porque agora
     existe um caminho para ela: o teste pergunta o perfil logo na abertura e,
     para quem já tem imobiliária, coleta o que precisa ser trazido. A resposta
     promete acompanhamento humano — que é o que a Omnimob faz hoje —, e não uma
     importação automática, que ainda não existe. */
  {
    q: "Já uso outro sistema. Dá para trazer meus imóveis e clientes?",
    a: "Dá, e você não vai redigitar nada sozinho. Ao começar o teste, diga que já tem uma imobiliária: perguntamos qual sistema você usa hoje, o que precisa vir junto (imóveis e fotos, clientes, leads, equipe) e como os dados podem sair de lá.",
  },
];

// ── Planos ──────────────────────────────────────────────────────────────────

/* Não existe tabela de preços escrita aqui — nem de reserva. O único preço que
   esta página exibe é o que /public/planos leu do provedor; até ele chegar, o
   cartão mostra um esqueleto. Um valor de reserva economizaria o esqueleto e
   custaria o pior erro possível numa página de vendas: anunciar, por um
   instante, um preço que não é o que será cobrado. */

const formatarBRL = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    // Centavos redondos viram "R$ 372" em vez de "R$ 372,00"; quebrados
    // mantêm as casas. Preço com centavo pendurado à toa parece erro.
    minimumFractionDigits: Number.isInteger(Number(valor)) ? 0 : 2,
  });

/* Rodapé do preço, por período.

   No MENSAL a etiqueta é uma linha curta. No ANUAL ela carrega mais peso: o
   número grande do cartão passou a ser a MÉDIA MENSAL do plano anual (é assim
   que a pessoa compara os dois períodos — "R$ 1.415,50/ano" ao lado de
   "R$ 149/mês" não se compara de cabeça), e um valor mensal sem explicação
   esconderia justamente o que o anual tem de diferente: o total. Por isso a
   nota diz o total por extenso. */
const NOTA_DO_PERIODO = { mensal: "cobrado mensalmente" };

/* A nota do anual precisa do PLANO, não só do período — ela nomeia o que está
   sendo comprado ("plano Profissional com Flow anual") e diz o total. */
function notaDoAnual(plano, total) {
  const descricao = plano.comFlow ? `${plano.name} com Omniflow` : plano.name;
  return `Valor equivalente à média mensal do plano ${descricao} anual, totalizando ${formatarBRL(total)}, com facilidade de parcelamento em até 6x no cartão ou boleto.`;
}

// Linhas da tabela comparativa. As linhas "Tudo do Plano X" existem só para os
// cards resumidos do painel e não fazem sentido numa comparação lado a lado.
const LINHAS_PLANO = RECURSOS_PLANOS.filter((r) => !String(r.label).startsWith("Tudo do Plano"));

/* ── Resumo do plano (celular) ───────────────────────────────────────────────
   As dez linhas com ✓ e ✕ são uma tabela de comparação: elas funcionam com os
   três planos lado a lado, onde o olho corre na horizontal. No carrossel só há
   um plano por vez, e aí a tabela vira uma lista alta demais, quase toda igual
   entre os três cartões — as sete primeiras linhas são as mesmas em todos.

   O resumo diz a única coisa que muda de um plano para o outro: o que ele
   acrescenta ao anterior. É para isso que servem as linhas "Tudo do Plano X",
   que a comparação descarta. Quem quiser a tabela inteira abre pelo botão.
   ────────────────────────────────────────────────────────────────────────── */
const HERANCA = Object.fromEntries(
  RECURSOS_PLANOS
    .filter((r) => String(r.label).startsWith("Tudo do Plano"))
    .map((r) => [Array.isArray(r.plans) ? r.plans[0] : r.plans, r.label]),
);

// Teto do resumo. Só morde o Básico, que não herda nada e abre com os próprios
// sete recursos; do Profissional em diante a lista já nasce com duas ou três.
const TETO_RESUMO = 4;

function resumoDoPlano(planKey) {
  const proprios = LINHAS_PLANO
    .filter((r) => (Array.isArray(r.plans) ? r.plans[0] : r.plans) === planKey)
    .map((r) => ({ label: r.label, heranca: false }));
  const herdado = HERANCA[planKey];
  const lista = herdado ? [{ label: herdado, heranca: true }, ...proprios] : proprios;
  return lista.slice(0, TETO_RESUMO);
}

const NIVEL_MINIMO = { BASICO: 0, PROFISSIONAL: 1, PREMIUM: 2 };

// `plans` vem como string (recurso base, todos os planos têm) ou array com o
// primeiro plano que libera o recurso.
function incluiRecurso(planKey, recurso) {
  const exigido = Array.isArray(recurso.plans) ? recurso.plans[0] : recurso.plans;
  return planoInfo(planKey).nivel >= (NIVEL_MINIMO[exigido] ?? 0);
}

/* O preço NUNCA é inventado aqui. Ele só existe depois que /public/planos
   responde — até lá o cartão mostra um esqueleto, e não um "R$ --" que parece
   preço e não é. Se a resposta vier sem preço para o plano (provedor desligado,
   ou plano sem cobrança automática), o cartão diz "Sob consulta", que é a
   verdade: aquele plano se fecha falando com o time. */
/* ── A base dos cartões, agora dependente do PACOTE ──────────────────────────

   Com o Omnimob Flow, o mesmo plano tem duas caras: o Hub sozinho e o Hub com
   o Flow junto. O que muda entre elas é o preço e as linhas da tabela — o nome,
   a descrição e o destaque continuam do plano.

   Uma função em vez de uma constante porque as linhas do Flow entram no meio
   da lista. Dois arrays prontos (um por pacote) seriam mais rápidos de ler e
   dobrariam o lugar onde `incluiRecurso` é aplicado — que é exatamente a conta
   que não pode ter duas versões. */
/* ── A LISTA VEM ORDENADA: primeiro o que ENTRA, depois o que fica de fora ──

   Antes as linhas saíam na ordem em que foram escritas — as do Hub e, atrás,
   as do Flow. Num plano intermediário isso produzia ✓✓✓✗✗ ✓✓✗✗, com os dois
   grupos intercalados, e o olho tinha de percorrer a coluna inteira para saber
   o que aquele plano dá.

   Ordenar por inclusão junta as respostas: em cima tudo que o cartão entrega —
   sem distinguir se é Hub ou Flow, porque para quem compra é tudo o mesmo
   produto —, embaixo tudo que falta. Duas leituras, não nove.

   `sort` estável (garantido no JS moderno): dentro de cada grupo a ordem
   original se mantém, então os recursos do Hub continuam vindo antes dos do
   Flow. É o que evita a lista embaralhar a cada render. */
function ordenarPorInclusao(linhas) {
  return [...linhas].sort((a, b) => Number(b.incluso) - Number(a.incluso));
}

/* Recebe um MAPA `{ BASICO: "HUB", PROFISSIONAL: "HUB_FLOW", … }`, e não um
   pacote só: cada cartão tem o seu interruptor. */
function planosBase(pacotes) {
  return PLANOS.map((p) => {
    const comFlow = pacotes[p.key] === "HUB_FLOW";
    const linhas = comFlow ? [...LINHAS_PLANO, ...RECURSOS_FLOW_PLANOS] : LINHAS_PLANO;

    return {
      key: p.key,
      name: p.nome,
      desc: p.descricao,
      price: "",
      per: "",
      nota: "",
      carregando: true,
      comFlow,
      /* `novo` marca as linhas do Flow: e o modulo novo, e o cartao mostra a
         etiqueta ao lado do recurso. So elas — inventar "novo" no resto da
         tabela seria enfeite. */
      linhas: ordenarPorInclusao(
        linhas.map((r) => ({
          label: r.label,
          incluso: incluiRecurso(p.key, r),
          novo: RECURSOS_FLOW_PLANOS.includes(r),
        })),
      ),
      /* No resumo do celular, o Flow entra ANTES dos recursos próprios do plano:
         quem ligou o interruptor ligou por causa dele, e é a primeira coisa que
         o cartão precisa confirmar. */
      resumo: comFlow
        ? [{ label: "Tudo do Omnimob, mais o Omniflow", heranca: true }, ...resumoDoPlano(p.key).slice(0, 3)]
        : resumoDoPlano(p.key),
      highlight: p.key === "PROFISSIONAL",
    };
  });
}

/* Busca os preços vigentes uma vez por carga da página.

   Três estados, e cada um mostra uma coisa diferente no cartão:
     `null`  — ainda não respondeu: esqueleto no lugar do preço;
     `{}`    — respondeu sem preço nenhum (provedor desligado): "Sob consulta";
     com dados — o preço de verdade, com "/mês" ou "/ano".

   Falha de rede cai no segundo caso, não no primeiro: esqueleto eterno faria a
   página parecer travada, e o que aconteceu é que não há preço para mostrar.

   O provedor devolve um par por plano — `{ mensal, anual, economia }` — e a
   economia vem CALCULADA lá, a partir do que o Stripe cobra de verdade nos dois
   preços. Nada de percentual escrito à mão aqui: se o valor mudar no painel, a
   página passa a anunciar o desconto novo sem deploy, e é impossível prometer
   um abatimento que a fatura não pratica. */
function usePrecosVigentes(periodo, pacotes) {
  const [precos, setPrecos] = useState(null);
  useEffect(() => {
    let vivo = true;
    api
      .getPlanosPublicos()
      .then((r) => vivo && setPrecos(r?.precos || {}))
      .catch(() => vivo && setPrecos({}));
    return () => {
      vivo = false;
    };
  }, []);

  const carregando = precos == null;

  /* Existe alguma cobrança anual de verdade? Enquanto as variáveis do Stripe
     não forem criadas, não existe — e oferecer a escolha seria vender o que a
     cobrança recusa. Durante o carregamento o alternador já aparece, senão ele
     surgiria depois do resto e empurraria os cartões para baixo. */
  /* O anual existe para ALGUM dos pacotes em uso? Com o interruptor por cartão,
     perguntar por um pacote só faria o alternador sumir quando o único plano
     sem preço anual fosse justamente o que está com o Flow ligado. */
  const temAnual = carregando || Object.values(precos).some((p) => p?.anual || p?.flow?.anual);

  /* ── O pacote com Flow existe para VENDER? ────────────────────────────────
     Só quando há preço cadastrado para ele no Stripe. Enquanto as variáveis
     `STRIPE_PRICE_*_FLOW` não existirem, o alternador de pacote nem aparece e a
     landing continua exatamente como era. É a mesma escolha do preço anual: o
     recurso novo não pode fazer a página prometer o que a cobrança recusa.

     Durante o carregamento ele NÃO aparece — ao contrário do alternador de
     período, que já nasce visível. A diferença é que este muda o conteúdo da
     TABELA, e não só o número: mostrá-lo e escondê-lo depois faria as linhas
     dos cartões piscarem. */
  const temFlow = !carregando && Object.values(precos).some((p) => p?.flow?.mensal);

  const planos = useMemo(
    () =>
      planosBase(pacotes).map((p) => {
        if (carregando) return p; // p.carregando = true; o cartão desenha o esqueleto
        /* O HUB mora na raiz do plano; o HUB_FLOW em `.flow`. A assimetria é
           deliberada e está explicada em `precosDosPlanos`, no servidor. */
        const vivo = pacotes[p.key] === "HUB_FLOW" ? precos?.[p.key]?.flow : precos?.[p.key];
        // Plano sem preço anual cadastrado continua mostrando o mensal: some a
        // vantagem, não o plano.
        const doPeriodo = vivo?.[periodo] || vivo?.mensal;
        if (!doPeriodo) {
          return { ...p, carregando: false, price: "Sob consulta", per: "", nota: "fale com o time" };
        }
        const ehAnual = periodo === "anual" && Boolean(vivo?.anual);
        /* No anual o cartão mostra a MÉDIA MENSAL, não o valor cobrado. Os dois
           períodos ficam na mesma unidade e a comparação vira uma subtração; a
           nota abaixo diz o total, que é o que a fatura pratica. A divisão é
           feita aqui e não no servidor de propósito: lá o preço é o que o
           provedor cobra, e média mensal é uma leitura desta página. */
        const mediaMensal = ehAnual && doPeriodo.valor > 0 ? doPeriodo.valor / 12 : null;
        return {
          ...p,
          carregando: false,
          /* Número e sufixo separados: o valor vai grande, o "/mês" pequeno ao
             lado. Vêm partidos do servidor — ver o comentário em
             `precosDosPlanos`. O `rotulo` inteiro fica de reserva para o caso de
             uma resposta antiga, ainda sem os campos novos. */
          price: mediaMensal != null ? formatarBRL(mediaMensal) : doPeriodo.numero || doPeriodo.rotulo,
          per: mediaMensal != null ? "/mês" : doPeriodo.numero ? doPeriodo.sufixo || "" : "",
          valor: doPeriodo.valor,
          nota: mediaMensal != null ? notaDoAnual(p, doPeriodo.valor) : NOTA_DO_PERIODO.mensal,
          notaLonga: mediaMensal != null,
          economia: ehAnual ? vivo.economia || null : null,
          /* A economia do anual SEMPRE, independente do periodo em vista: e
             dela que o alternador tira o selo "Anual (2,5 meses gratis)" — e o
             selo so serve enquanto o Mensal esta marcado. `economia`, acima,
             continua condicionada ao periodo porque o "economize R$ …" do
             cartao so faz sentido quando o preco mostrado ja e o anual. */
          economiaAnual: vivo?.economia || null,
        };
      }),
    [precos, periodo, pacotes, carregando],
  );

  return { planos, temAnual, temFlow, carregando };
}

/* Desconto do anual em palavras. Prefere os MESES GRÁTIS ao percentual: "2,5
   meses grátis" é a mesma conta dita de um jeito que a pessoa consegue conferir
   de cabeça, e é assim que a oferta foi desenhada (paga 9,5, leva 12). */
function selosDaEconomia(economia) {
  if (!economia) return null;
  const meses = economia.mesesGratis;
  if (meses >= 0.5) {
    const texto = Number.isInteger(meses)
      ? String(meses)
      : String(meses).replace(".", ",");
    return `${texto} ${meses >= 2 ? "meses grátis" : "mês grátis"}`;
  }
  return economia.percentual > 0 ? `${economia.percentual}% off` : null;
}

/* O alternador de pacote é o `ToggleDoFlow`, o mesmo das três telas de
   pagamento do painel. Ele já foi dois cartões lado a lado aqui — mas Hub e
   Hub+Flow não são opções concorrentes: uma é a outra MAIS alguma coisa, e o
   switch diz isso na forma. Ver o cabeçalho do componente. */

/* Alternador mensal / anual.
   Um grupo de rádio de verdade (não dois botões): são opções mutuamente
   exclusivas de um mesmo campo, e é o que faz as setas do teclado andarem entre
   elas sem nenhum código nosso. */
/* Mensal · [chave] · Anual (selo). Uma chave entre dois rótulos, como na
   referência — e não mais a pílula que desliza. Os rótulos também clicam, para
   quem mira no texto e não na chave; a chave é o `switch` de verdade para
   leitor de tela e teclado. */
function PeriodoToggle({ valor, aoTrocar, selo }) {
  const anual = valor === "anual";
  return (
    <div className="pl-periodo">
      <button
        type="button"
        className={`pl-periodo__rotulo${!anual ? " is-on" : ""}`}
        onClick={() => aoTrocar("mensal")}
      >
        Mensal
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={anual}
        aria-label="Cobrança anual"
        className="pl-periodo__chave"
        onClick={() => aoTrocar(anual ? "mensal" : "anual")}
      />
      <button
        type="button"
        className={`pl-periodo__rotulo${anual ? " is-on" : ""}`}
        onClick={() => aoTrocar("anual")}
      >
        Anual
      </button>
    </div>
  );
}

/* Consulta de mídia como estado. Existe porque três peças desta página mudam de
   comportamento (e não só de aparência) conforme o formato da tela — recursos,
   faixa e planos —, e cada uma tinha a mesma dúzia de linhas copiada. Girar o
   aparelho conta como mudança, daí o listener em vez de uma leitura só na
   montagem. */
function useMedia(consulta) {
  const [bate, setBate] = useState(
    () => typeof window !== "undefined" && window.matchMedia(consulta).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(consulta);
    const aoMudar = (e) => setBate(e.matches);
    setBate(mq.matches);
    mq.addEventListener("change", aoMudar);
    return () => mq.removeEventListener("change", aoMudar);
  }, [consulta]);
  return bate;
}

/* Cabeçalho fixo + menu em tela cheia, no modelo do Header do Contable: a
   barra não tem fundo próprio, flutua sobre o conteúdo e só encolhe o respiro
   ao rolar; o menu abre por um clip-path circular que nasce no botão e cresce
   até cobrir a tela, com os links subindo em cascata e o hambúrguer virando X.

   Uma adaptação necessária: ao rolar, a barra ganha um vidro discreto. A
   referência é escura de ponta a ponta e pode ficar transparente sempre; aqui
   o CTA final é uma seção clara, e sem o vidro o menu sumiria ao passar por
   ela. */
/* O cabeçalho e o menu agora são o `StaggeredMenu` (porte do React Bits).

   Ele assumiu a barra inteira em vez de conviver com ela: dois cabeçalhos
   `position: fixed` disputando o topo é o tipo de arranjo que funciona até a
   primeira mudança de padding. O visual da barra não mudou — as classes
   `.dl-header*` continuam sendo as mesmas —, mudou o que acontece ao abrir.

   Os itens de âncora e os de rota convivem na mesma lista; o componente
   resolve cada um (ver `components/StaggeredMenu.jsx`). */
function CabecalhoDaLanding() {
  return (
    <StaggeredMenu
      itens={MENU_ITENS.map((i) => ({ rotulo: i.label, destino: i.href }))}
      sociais={[
        ...PAGINAS_DA_OMNIMOB.map((pg) => ({ rotulo: pg.label, destino: pg.para })),
        { rotulo: "Entrar", destino: "/login" },
        { rotulo: "WhatsApp", destino: "https://wa.me/" },
      ]}
      cores={["#6366f1", "#d4af37"]}
      corDeDestaque="#d4af37"
      logo={
        <Link to="/" className="dl-header__logo" aria-label="Omnimob — início">
          {/* Sem `height`: o tamanho vem do CSS, para encolher junto com a
              barra ao rolar. */}
          <LogoLockup src={LOGO_LOCKUP_HEADER_SRC} className="dl-header__tipo" />
        </Link>
      }
      acoes={<Button href="#contato" variant="primary" className="dl-header__cta">Agendar demonstração</Button>}
    />
  );
}

// ── Peças da página ─────────────────────────────────────────────────────────

// Cabeçalho de seção: título grande à esquerda em duas cores, parágrafo curto
// alinhado pela base à direita.
/* ── Os dois módulos, lado a lado ────────────────────────────────────────────

   Duas colunas com a MESMA estrutura: marca, o que é, e as quatro coisas que
   ele faz. A simetria é o argumento — ela diz que são dois produtos do mesmo
   tamanho, e não um produto e um acessório.

   As listas são curtas de propósito (quatro itens). A tabela de planos, logo
   abaixo, tem a lista completa; aqui a pergunta é "o que é isso", e uma lista
   de doze itens responde "é complicado".

   Sem ilustração e sem animação: esta seção existe entre duas que já têm
   (o baralho de canais acima, o fundo em ondas dos planos abaixo), e uma
   terceira no meio cansa a rolagem. */
/* ── O MANIFESTO DO FLOW ─────────────────────────────────────────────────────

   Substitui os dois cartoes lado a lado (Hub | Flow). O motivo nao e estetico:
   aqueles cartoes pediam que a pessoa COMPARASSE dois produtos no meio de uma
   pagina que ainda estava explicando o primeiro. Quem chega na landing nao sabe
   o que e o Hub — e a resposta e que o Hub e a pagina inteira. Tudo acima e
   abaixo daqui fala dele: acervo, vitrine, portais, leads, equipe.

   Entao o Flow ganha o palco sozinho, e ganha a unica secao CLARA do site. O
   contraste faz o trabalho que a comparacao fazia, e faz melhor: numa pagina
   preta de ponta a ponta, uma secao branca nao e mais uma secao — e uma
   interrupcao, que e exatamente o que um modulo novo precisa ser.

   A estrutura vem do manifesto da Kenlo, e a divida esta declarada: sobrancelha
   com ponto, uma frase de duas linhas com UM trecho em cor, dois blocos de
   texto lado a lado, um fio, e um fecho de duas linhas onde a segunda e a que
   fica. O que nao veio foi a cor: onde eles usam o azul da marca, aqui e o rosa
   #ec0b5b do wordmark "flow" — e ele sai de `utils/modulos.js`, nao escrito a
   mao, pelo mesmo motivo que os cartoes antigos liam de la. */
function ManifestoDoFlow() {
  const flow = MODULOS_DO_PRODUTO.find((m) => m.key === "FLOW");

  return (
    <div className="dl-manifesto" style={{ "--flow": flow?.acento || "#ec0b5b" }}>
      {/* As duas formas giratorias. Sao a assinatura visual da secao e o unico
          lugar da pagina onde elas aparecem — ver a nota no CSS. */}
      {/* As duas formas do vocabulário da marca. Vieram inline daqui e foram
          para `styles/omnimobKit.jsx` quando o mesmo par passou a aparecer no
          herói e no rodapé: três cópias do mesmo caminho SVG divergem, e o
          projeto já pagou esse preço no editor de vitrine. Aqui ficam só a
          posição e o tamanho, que são decisão desta seção. */}
      <FormaDeFundo
        forma="flor"
        cor="color-mix(in srgb, var(--flow) 13%, transparent)"
        gira={60}
        className="dl-manifesto__forma dl-manifesto__forma--a"
      />
      <FormaDeFundo
        forma="luas"
        cor="color-mix(in srgb, var(--flow) 9%, transparent)"
        gira={80}
        inverso
        className="dl-manifesto__forma dl-manifesto__forma--b"
      />

      <div className="dl-manifesto__wrap">
        <span className="dl-manifesto__olho">
          <i aria-hidden="true" />
          O Omniflow
        </span>

        <div className="dl-manifesto__cabeca">
          <h2 className="dl-manifesto__titulo">
            Anunciar imóvel é metade do trabalho.
            <br />
            <em>Fechar negócio</em> é a outra.
          </h2>
          {/* A unica ilustracao da pagina em fundo BRANCO, e a unica secao clara
              — as duas coisas foram decididas juntas, e o briefing pediu esta
              peca ja pensada para esse fundo. */}
          <img
            className="dl-manifesto__desenho"
            src="/ilustracoes/flow-funil.png"
            alt="Corretor deslizando um negócio de uma coluna do funil para a seguinte"
            width={480}
            height={480}
            loading="lazy"
          />
        </div>

        <div className="dl-manifesto__corpo">
          <p>
            O imóvel entra, aparece na vitrine, vai para os portais e traz interessado. Aí começa a
            parte que nenhum sistema acompanha: o retorno que ninguém deu, a proposta combinada por
            áudio, a documentação cobrada três vezes, o contrato colado no Word, a comissão
            conferida na planilha.
          </p>
          <div>
            <p>
              O Omniflow é essa metade. Ele não é uma aba a mais no painel: é o caminho que o negócio
              percorre depois que o lead chega.
            </p>
            <p>
              O interessado entra sozinho pelo portal, cai na fila de um corretor e anda por um
              funil de sete estágios. A minuta se preenche com os dados do negócio, vai para
              assinatura e volta assinada. E o negócio só vira{" "}
              <strong>ganho quando a documentação está de pé</strong> — com o jurídico e o
              financeiro tendo dito sim, e a comissão já repartida.
            </p>
          </div>
        </div>

        <div className="dl-manifesto__remate">
          <p className="dl-manifesto__fecho">
            O Omnimob cuida do que a sua imobiliária tem.
            <br />
            <em>O Omniflow cuida do que ela está fechando.</em>
          </p>
          {/* A frase que fecha a secao, ao lado da imagem do negocio fechando.
              E o unico ponto da pagina inteira que mostra alguem CONSEGUINDO —
              todo o resto mostra trabalho sendo feito. */}
          <img
            className="dl-manifesto__remate-img"
            src="/ilustracoes/flow-assinatura.png"
            alt="Duas pessoas trocando a chave do imóvel sobre um contrato assinado"
            width={560}
            height={400}
            loading="lazy"
          />
        </div>

        <TelasDoFlow />
      </div>
    </div>
  );
}

/* ── AS TRÊS TELAS DO FLOW ───────────────────────────────────────────────────

   Mockups em DOM, e não imagem. É a decisão que mais importa neste bloco:
   captura de tela envelhece no dia seguinte ao primeiro retoque de interface,
   pesa centenas de kB, borra em tela retina e não muda de tema. Escrito em
   marcação, um preço novo é uma edição de texto.

   ── POR QUE ESTAS TRÊS, E POR QUE COM TEXTO DE VERDADE ──

   As telas que a página já tinha (o painel, o editor, as métricas) são de
   propósito SILHUETAS: blocos cinzas sem conteúdo, porque ali o objetivo é
   reconhecer a ferramenta de relance. Aqui é o contrário, e a razão é que o
   Flow é o módulo que ninguém conhece: um funil em silhueta é um retângulo com
   quatro colunas cinzas — igual ao de qualquer software do mundo. O que vende o
   Flow é ver o negócio #77 parado em VISITA, a minuta recusando sair com duas
   pendências e a comissão já repartida em quatro.

   Os números não são enfeite. O split usa 6% sobre R$ 847.300 porque é
   exatamente a conta que `services/flow/comissoes.js` cita como o motivo de a
   aritmética ser decimal — e os valores abaixo fecham na soma, o que uma tela
   inventada quase nunca faz. Cliente que confere, confere isso.

   Decorativas para leitor de tela: cada cartão tem título e descrição em texto
   real logo abaixo, e é isso que precisa ser lido. A tela em si é ilustração e
   sai da árvore de acessibilidade inteira. */
function TelasDoFlow() {
  return (
    <div className="dl-flowtelas">
      <article className="dl-flowtela dl-flowtela--funil">
        <span className="dl-flowtela__tag"><i aria-hidden="true" />Omniflow · Funil</span>

        <div className="dl-flowtela__quadro" aria-hidden="true">
          <div className="dl-fkanban">
            {[
              { etapa: "Lead", qtd: 12, negocios: [{ n: "#84", t: "Apto 2 quartos", b: "Vila Mariana", v: "R$ 420.000" }] },
              { etapa: "Contato", qtd: 7, negocios: [{ n: "#81", t: "Casa térrea", b: "Santo Amaro", v: "R$ 890.000" }] },
              { etapa: "Visita", qtd: 4, negocios: [{ n: "#77", t: "Sala comercial", b: "Itaim Bibi", v: "R$ 310.000" }] },
              { etapa: "Proposta", qtd: 2, destaque: true, negocios: [{ n: "#72", t: "Cobertura", b: "Moema", v: "R$ 1.240.000" }] },
            ].map((col) => (
              <div key={col.etapa} className={`dl-fkanban__col${col.destaque ? " is-alvo" : ""}`}>
                <span className="dl-fkanban__topo">
                  {col.etapa}
                  <b>{col.qtd}</b>
                </span>
                {col.negocios.map((g) => (
                  <div key={g.n} className="dl-fkanban__card">
                    <span className="dl-fkanban__cod">{g.n}</span>
                    <strong>{g.t}</strong>
                    <span className="dl-fkanban__bairro">{g.b}</span>
                    <span className="dl-fkanban__valor">{g.v}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <span className="dl-fkanban__resto">Negociação · Aprovação · Ganho</span>
        </div>

        <h3>Funil de sete estágios</h3>
        <p>
          Cada negócio tem um código curto que a equipe diz em voz alta, e uma coluna que mostra
          onde ele parou. Perdido fica fora da fila, e não no fim dela.
        </p>
      </article>

      <article className="dl-flowtela dl-flowtela--minuta">
        <span className="dl-flowtela__tag"><i aria-hidden="true" />Omniflow · Contrato</span>

        <div className="dl-flowtela__quadro" aria-hidden="true">
          <div className="dl-fminuta">
            <span className="dl-fminuta__titulo">Compra e venda · negócio #72</span>
            <ul>
              <li className="is-ok"><i />Vendedor<b>Marcos Ribeiro</b></li>
              <li className="is-ok"><i />Imóvel<b>Cobertura · Moema</b></li>
              <li className="is-ok"><i />Valor<b>R$ 1.240.000,00</b></li>
              <li className="is-falta"><i />CPF do comprador<b>faltando</b></li>
              <li className="is-falta"><i />Matrícula do imóvel<b>faltando</b></li>
            </ul>
            <div className="dl-fminuta__pe">
              <span className="dl-fminuta__botao">Gerar contrato</span>
              <span className="dl-fminuta__aviso">2 pendências</span>
            </div>
          </div>
        </div>

        <h3>A minuta que se recusa a sair</h3>
        <p>
          Marcador sem dado não vira espaço em branco: vira pendência, com nome. O contrato só é
          gerado quando não falta nenhum — documento com lacuna parece pronto, e é pior que nenhum.
        </p>
      </article>

      <article className="dl-flowtela dl-flowtela--comissao">
        <span className="dl-flowtela__tag"><i aria-hidden="true" />Omniflow · Comissão</span>

        <div className="dl-flowtela__quadro" aria-hidden="true">
          <div className="dl-fsplit">
            <div className="dl-fsplit__topo">
              <span>Venda</span>
              <b>R$ 847.300,00</b>
            </div>
            <div className="dl-fsplit__taxa">
              <span>Comissão 6%</span>
              <b>R$ 50.838,00</b>
            </div>
            <ul>
              <li><span>Corretor · 40%</span><b>R$ 20.335,20</b></li>
              <li><span>Captador · 15%</span><b>R$ 7.625,70</b></li>
              <li className="is-resto"><span>Imobiliária · resto</span><b>R$ 22.877,10</b></li>
            </ul>
          </div>
        </div>

        <h3>Comissão repartida e congelada</h3>
        <p>
          A parte da imobiliária é o resto da conta, nunca um segundo arredondamento. Os valores
          ficam gravados no negócio: mudar a política depois não reescreve o que já fechou.
        </p>
      </article>
    </div>
  );
}

/* ── Divisor de ondas ──────────────────────────────────────────────────────
   Três ondas sobrepostas (25%, 50% e 100% de opacidade) coladas no TOPO da
   seção que o recebe. Mora dentro da seção seguinte, e não no fim da
   anterior: quem esconde overflow é a seção, e ela recortaria um filho que
   sangrasse para fora.

   Três tons. `escuro` é a seção de cima (--bg) escorrendo sobre o CTA claro,
   e `claro` é o CTA escorrendo sobre o rodapé — as fronteiras escuro ↔ claro
   sem tratamento próprio (o `#modulos` tem o rasgo de papel, e por isso nem
   ele nem o `#porque`, que o rasgo de baixo invade, recebem onda). `grafite`
   é o do miolo: ali as seções alternam --bg e --bg-alt,
   cinco pontos de diferença, e uma onda "na cor da anterior" seria uma faixa
   invisível de 130px. Então ela não finge ser a seção de cima; é um relevo no
   tom --line, que a página já usa nas bordas e lê sobre os dois fundos. */
function DivisorDeOndas({ tom }) {
  return (
    <div className={`dl-ondas dl-ondas--${tom}`} aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
        <path d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z" opacity=".25" />
        <path d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z" opacity=".5" />
        <path d="M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z" />
      </svg>
    </div>
  );
}

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
            <span className="dl-mono dl-mockup__url">omnimob.app / painel</span>
          </div>

          <div className="dl-mockup__body">
            <aside className="dl-mockup__side">
              <img className="dl-mockup__logo" src={LOGO_SIMBOLO_SRC} alt="" />
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
        <IconeCheck size={13} style={{ color: MINT, flexShrink: 0 }} />
        Vitrine publicada
      </div>
    </div>
  );
}

/* Conteúdo do mock, um por recurso. São composições de barras e blocos — não
   capturas reais —, montadas com as mesmas peças (`dl-skel`, cartões, chips)
   para as seis telas parecerem o mesmo produto. */
function Tela({ tipo }) {
  /* As três cenas do fluxo (cadastro → vitrine → lead) vêm do módulo do
     "Veja acontecer", que era uma seção própria — ver o cabeçalho de RECURSOS.
     A cena traz a própria moldura de cartão; dentro do navegador ela perde a
     borda (ver .dl-browser__tela .gv4-cena no CSS). */
  if (tipo === "cadastro" || tipo === "vitrine" || tipo === "lead") {
    return <CenaDoFluxo etapa={tipo} />;
  }

  if (tipo === "metricas") {
    return (
      <>
        <div className="dl-browser__kpis">
          {[["Visitas", "2.4k"], ["Leads", "46"], ["Vendas", "12"]].map(([l, n]) => (
            <div key={l} className="dl-browser__kpi">
              <span>{l}</span>
              <strong>{n}</strong>
            </div>
          ))}
        </div>
        <div className="dl-browser__chart">
          {[38, 62, 45, 78, 56, 88, 70].map((h, i) => (
            <i key={i} style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="dl-browser__rows">
          {[0, 1, 2].map((i) => (
            <div key={i} className="dl-browser__linha">
              <span className="dl-browser__av" />
              <span className="dl-browser__lin">
                <span className="dl-skel" style={{ width: `${70 - i * 10}%` }} />
                <span className="dl-skel" style={{ width: "36%", opacity: 0.55 }} />
              </span>
              <span className="dl-mono dl-browser__chip">LEAD</span>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (tipo === "redes") {
    return (
      <>
        {/* Mesma gramática dos previews do passo "Divulgar" do cadastro: os três
            nascem do centro, o card sob o mouse cresce com anel colorido e os
            outros recuam desfocados. */}
        <div className="dl-redes">
          {REDES.map((r, i) => (
            <div
              key={r.nome}
              className="dl-redes__card"
              style={{ "--marca": r.cor, "--anel": r.anel, "--brilho": r.brilho, "--de": r.de }}
            >
              <div className="dl-redes__anel">
                <div className="dl-redes__inner">
                  <span className="dl-redes__foto" />
                  <span className="dl-redes__linhas">
                    <span className="dl-skel" style={{ width: "78%" }} />
                    <span className="dl-skel" style={{ width: "48%" }} />
                  </span>
                </div>
              </div>
              <span className="dl-redes__logo" style={{ borderRadius: r.raio }}>
                <r.Icon size={15} weight="fill" />
              </span>
              <span className="dl-mono dl-redes__status">{r.nome}</span>
            </div>
          ))}
        </div>
        <div className="dl-browser__chips">
          {["FACEBOOK", "INSTAGRAM", "WHATSAPP"].map((c) => (
            <span key={c} className="dl-mono dl-browser__chip">{c}</span>
          ))}
        </div>
        <div className="dl-browser__rows">
          {["PUBLICADO", "PUBLICADO", "NA FILA"].map((estado, i) => (
            <div key={i} className="dl-browser__linha">
              <span className="dl-browser__av" />
              <span className="dl-browser__lin">
                <span className="dl-skel" style={{ width: `${74 - i * 9}%` }} />
                <span className="dl-skel" style={{ width: "38%", opacity: 0.55 }} />
              </span>
              <span className={`dl-mono dl-browser__chip${i < 2 ? " dl-browser__chip--ok" : ""}`}>
                {estado}
              </span>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (tipo === "usuarios") {
    return (
      <div className="dl-browser__rows">
        {["ADMIN", "CORRETOR", "CORRETOR", "MARKETING", "GERÊNCIA", "CORRETOR"].map((cargo, i) => (
          <div key={i} className="dl-browser__linha">
            <span className="dl-browser__av" />
            <span className="dl-browser__lin">
              <span className="dl-skel" style={{ width: `${74 - (i % 4) * 8}%` }} />
              <span className="dl-skel" style={{ width: "40%", opacity: 0.55 }} />
            </span>
            <span className="dl-mono dl-browser__chip">{cargo}</span>
          </div>
        ))}
      </div>
    );
  }

  /* Multi-tenant não é uma lista — era assim que ela estava, e assim ela era a
     mesma tela da célula de usuários, que é uma lista de verdade. Aqui cada
     imobiliária é um ambiente fechado: quadro próprio, cor própria, vitrine
     própria, e uma parede tracejada separando um do outro. */
  if (tipo === "tenants") {
    return (
      <>
        <div className="dl-browser__chips">
          <span className="dl-mono dl-browser__chip dl-browser__chip--ok">● 4 TENANTS ATIVOS</span>
          <span className="dl-mono dl-browser__chip">BANCO · USUÁRIOS · VITRINE</span>
        </div>
        <div className="dl-tenants">
          {TENANTS.map((t) => (
            <div key={t.slug} className="dl-tenants__box" style={{ "--t": t.cor }}>
              <span className="dl-tenants__topo">
                <i className="dl-tenants__marca" />
                <span className="dl-skel" style={{ width: "56%" }} />
              </span>
              <span className="dl-tenants__vitrine">
                <i /><i /><i /><i /><i /><i />
              </span>
              <span className="dl-mono dl-tenants__selo">
                <ShieldCheck size={9} weight="fill" />
                ISOLADO
              </span>
            </div>
          ))}
        </div>
      </>
    );
  }

  /* imoveis (padrão): a grade da vitrine em três esteiras que correm sozinhas,
     alternando o sentido a cada linha. A grade parada mostrava seis imóveis; a
     esteira mostra acervo, que é o que a célula promete. */
  return (
    <>
      <div className="dl-skel" style={{ width: "42%", height: "13px" }} />
      <div className="dl-esteira">
        {[0, 1, 2].map((linha) => (
          <div
            key={linha}
            className={`dl-esteira__linha${linha === 1 ? " dl-esteira__linha--dir" : ""}`}
          >
            {Array.from({ length: ESTEIRA_CARTOES * 2 }, (_, i) => {
              /* Tudo que varia de cartão para cartão sai do índice DENTRO da
                 cópia, e não do índice absoluto. O laço avança exatamente uma
                 cópia, então na virada o cartão `n` assume o lugar do cartão
                 `n + ESTEIRA_CARTOES`: se os dois tivessem desenhos diferentes,
                 a emenda que a geometria fecha ao pixel voltaria a aparecer —
                 agora pela troca do anúncio, no meio da tela. */
              const n = i % ESTEIRA_CARTOES;
              const desenho = ESTEIRA_ORDEM[linha][n];
              return (
                <span key={i} className="dl-esteira__card">
                  <span
                    className="dl-esteira__foto"
                    style={{ "--giro": ESTEIRA_GIROS[(linha + n) % ESTEIRA_GIROS.length] }}
                  >
                    <svg viewBox="0 0 24 18" aria-hidden="true">{ESTEIRA_SILHUETAS[desenho]}</svg>
                  </span>
                  <span className="dl-skel" style={{ width: `${74 - (n % 3) * 11}%` }} />
                  <span className="dl-skel" style={{ width: "42%", opacity: 0.55 }} />
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}

/* Telas que ocupam a moldura inteira em vez de ficarem ancoradas no topo. Elas
   são quadros — as esteiras do acervo, o editor, os ambientes dos tenants —, e
   quadro que termina no meio da moldura deixa um vão morto embaixo. As outras
   são listas: elas acabam onde o conteúdo acaba, e é assim que devem acabar. */
const TELAS_CHEIAS = new Set(["imoveis", "tenants", "cadastro", "vitrine", "lead"]);

/* Mock do painel dentro de uma moldura de navegador (seção de recursos).

   `vazio` desenha a moldura sem a tela dentro. Serve ao carrossel do celular,
   onde os seis mocks existem ao mesmo tempo: cada tela é um punhado de peças
   animadas (a de imóveis sozinha são três esteiras correndo), e seis delas
   desenhando de uma vez para mostrar uma é o tipo de custo que só aparece no
   aparelho de quem visita. A moldura fica — ela é quem reserva a altura, e sem
   isso o trilho pularia ao entrar cada vizinha. */
function BrowserMock({ recurso, indice, vazio = false, painelId = "dl-tela-recurso" }) {
  return (
    <figure className="dl-browser-wrap">
      <figcaption className="dl-mono dl-browser-cap">▪ {recurso.legenda}</figcaption>
      <div className="dl-browser">
        <div className="dl-browser__chrome">
          <span className="dl-dot" style={{ background: "#f87171" }} />
          <span className="dl-dot" style={{ background: "#fbbf24" }} />
          <span className="dl-dot" style={{ background: "#4ade80" }} />
          <span className="dl-browser__url">{recurso.url}</span>
        </div>
        <div className="dl-browser__body">
          {/* A chave troca com o recurso: o React remonta o bloco e a animação
              de entrada roda de novo a cada mudança. */}
          <div
            className={`dl-browser__tela${TELAS_CHEIAS.has(recurso.tela) ? " is-cheia" : ""}`}
            key={indice}
            id={painelId}
            role="tabpanel"
          >
            {vazio ? null : <Tela tipo={recurso.tela} />}
          </div>
        </div>
      </div>
    </figure>
  );
}

/* Recursos: as células da esquerda são abas e o mock da direita é o painel.
   Enquanto ninguém clicar, avança sozinho de 3 em 3 segundos, em ciclo. O
   primeiro clique entrega o controle ao usuário e a rotação para de vez.

   ── No celular é outro arranjo, não o mesmo espremido ──

   Aqui já houve um painel grudado no topo enquanto as seis abas passavam por
   baixo. Ele lia como tela travada, e o motivo é estrutural: numa seção de
   ~2.100px, quase metade da altura visível ficava imóvel por dois scrolls e
   meio, e a única coisa que se mexia era o conteúdo dentro da moldura. Sem um
   segundo eixo de movimento, "preso de propósito" e "quebrado" são a mesma
   imagem.

   Virou carrossel: um recurso por cartão, com o mock e o texto dele juntos,
   arrastando na horizontal. É o mesmo gesto da seção de planos, logo abaixo —
   e o que rola na vertical volta a rolar de verdade. */
function Recursos() {
  const [ref, visivel] = useReveal();
  const [ativo, setAtivo] = useState(0);
  const [manual, setManual] = useState(false);
  const botoes = useRef([]);
  const trilhoRef = useRef(null);
  // O passo automático lê o índice de dentro do intervalo; em estado ele leria
  // sempre o valor da montagem e o carrossel ficaria pulando entre 0 e 1.
  const ativoRef = useRef(0);
  ativoRef.current = ativo;

  const emMobile = useMedia("(max-width: 860px)");

  function selecionar(i) {
    setAtivo(i);
    setManual(true);
  }

  function aoTeclar(evento, i) {
    const passo =
      evento.key === "ArrowRight" || evento.key === "ArrowDown" ? 1
      : evento.key === "ArrowLeft" || evento.key === "ArrowUp" ? -1
      : 0;
    if (!passo) return;
    evento.preventDefault();
    const proximo = (i + passo + RECURSOS.length) % RECURSOS.length;
    selecionar(proximo);
    botoes.current[proximo]?.focus();
  }

  /* Centraliza o cartão no trilho. A conta sai de getBoundingClientRect, e não
     de offsetLeft, porque offsetLeft é medido a partir do primeiro ancestral
     posicionado — que aqui não é o trilho. */
  function irPara(i) {
    const trilho = trilhoRef.current;
    const cartao = trilho?.children?.[i];
    if (!trilho || !cartao) return;
    const t = trilho.getBoundingClientRect();
    const c = cartao.getBoundingClientRect();
    const alvo = trilho.scrollLeft + (c.left - t.left) - (t.width - c.width) / 2;
    const semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    trilho.scrollTo({ left: alvo, behavior: semMovimento ? "auto" : "smooth" });
  }

  // Rotação automática do painel no desktop.
  useEffect(() => {
    if (emMobile || manual || !visivel) return undefined;
    const id = setInterval(
      () => setAtivo((i) => (i + 1) % RECURSOS.length),
      RECURSO_INTERVALO,
    );
    return () => clearInterval(id);
  }, [emMobile, manual, visivel]);

  /* Passo automático do carrossel: só enquanto a seção está à vista e ninguém
     tocou. Mais lento que o do desktop porque aqui cada passo troca a tela E o
     texto — o do desktop troca só a moldura, com as seis abas sempre à vista. */
  useEffect(() => {
    if (!emMobile || manual || !visivel) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const id = setInterval(() => {
      const proximo = (ativoRef.current + 1) % RECURSOS.length;
      setAtivo(proximo);
      irPara(proximo);
    }, RECURSO_INTERVALO_CARROSSEL);
    return () => clearInterval(id);
  }, [emMobile, manual, visivel]);

  /* Quem manda no ponto aceso é a posição real do trilho, não o clique: assim
     arrastar com o dedo acende o ponto certo, e o passo automático não precisa
     avisar ninguém. */
  useEffect(() => {
    const trilho = trilhoRef.current;
    if (!trilho || !emMobile) return undefined;
    let quadro = 0;
    const aoRolar = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        const meio = trilho.getBoundingClientRect().left + trilho.clientWidth / 2;
        let perto = 0;
        let menor = Infinity;
        Array.from(trilho.children).forEach((cartao, i) => {
          const r = cartao.getBoundingClientRect();
          const dist = Math.abs(r.left + r.width / 2 - meio);
          if (dist < menor) { menor = dist; perto = i; }
        });
        setAtivo(perto);
      });
    };
    trilho.addEventListener("scroll", aoRolar, { passive: true });
    return () => {
      trilho.removeEventListener("scroll", aoRolar);
      cancelAnimationFrame(quadro);
    };
  }, [emMobile]);

  if (emMobile) {
    return (
      <div className="dl-rec-caixa" ref={ref}>
        {/* Os pontos vêm ANTES do trilho: um cartão é mais alto que a tela, e
            embaixo eles só apareceriam depois de rolar o cartão inteiro — tarde
            demais para o que eles servem, que é avisar na chegada que há seis. */}
        <div className="dl-rec-pontos">
          {RECURSOS.map((f, i) => (
            <button
              key={f.title}
              type="button"
              className={`dl-rec-ponto${i === ativo ? " is-on" : ""}`}
              aria-label={`Ver ${f.title}`}
              aria-current={i === ativo}
              onClick={() => { setManual(true); setAtivo(i); irPara(i); }}
            />
          ))}
        </div>

        <div
          className="dl-rec-trilho"
          ref={trilhoRef}
          // Pointerdown e não scroll: rolagem também é disparada pelo passo
          // automático, e aí ele se desligaria sozinho no primeiro movimento.
          onPointerDown={() => setManual(true)}
        >
          {RECURSOS.map((f, i) => (
            <article
              key={f.title}
              className={`dl-rec-slide${i === ativo ? " is-atual" : ""}`}
            >
              {/* Só a tela em foco e as duas vizinhas são desenhadas de fato —
                  ver o `vazio` do BrowserMock. Uma de cada lado é o bastante:
                  o encaixe do trilho não deixa passar mais de um cartão por
                  gesto, então a próxima já chega pronta. */}
              <BrowserMock
                recurso={f.tela === "editor" ? { ...f, tela: "vitrine" } : f}
                indice={i}
                vazio={Math.abs(i - ativo) > 1}
                painelId={`dl-tela-recurso-${i}`}
              />
              <div className="dl-rec-slide__texto">
                <span className="dl-feature__icon" aria-hidden="true">
                  <f.Icon size={17} weight="duotone" />
                </span>
                <span className="dl-mono dl-index">[{String(i + 1).padStart(2, "0")}]</span>
                <h3 className="dl-feature__title">{f.title}</h3>
                <p className="dl-feature__desc">{f.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="dl-split" ref={ref}>
      <div className="dl-grid-hair dl-grid-hair--2" role="tablist" aria-label="Recursos da plataforma">
        {RECURSOS.map((f, i) => (
          <Reveal key={f.title} className="dl-cell dl-cell--aba" delay={i * 80}>
            <button
              type="button"
              role="tab"
              ref={(el) => { botoes.current[i] = el; }}
              aria-selected={i === ativo}
              aria-controls="dl-tela-recurso"
              tabIndex={i === ativo ? 0 : -1}
              className={`dl-feature dl-feature--aba${i === ativo ? " is-ativo" : ""}`}
              onClick={() => selecionar(i)}
              onKeyDown={(e) => aoTeclar(e, i)}
            >
              <span className="dl-feature__icon" aria-hidden="true">
                <f.Icon size={17} weight="duotone" />
              </span>
              <span className="dl-mono dl-index">[{String(i + 1).padStart(2, "0")}]</span>
              <h3 className="dl-feature__title">{f.title}</h3>
              <p className="dl-feature__desc">{f.desc}</p>
            </button>
          </Reveal>
        ))}
      </div>
      <Reveal className="dl-split__tela" delay={160} style={{ display: "flex" }}>
        {RECURSOS[ativo].tela === "editor"
          ? <EditorAoVivo key="editor" />
          : <BrowserMock recurso={RECURSOS[ativo]} indice={ativo} />}
      </Reveal>
    </div>
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
    //
    // Coalescido num quadro. O mousemove dispara bem mais que 60 vezes por
    // segundo, e o corpo aqui faz um getBoundingClientRect — leitura de layout,
    // que força o navegador a recalcular tudo que estiver pendente. Escrever a
    // variável logo em seguida sujava o layout de novo, e o evento seguinte
    // pagava a conta: era um vaivém de ler e invalidar dezenas de vezes por
    // quadro, para produzir uma única posição que só é usada ao desenhar.
    let quadro = 0;
    let ultimo = null;

    const aplicar = () => {
      quadro = 0;
      const e = ultimo;
      if (!e) return;
      const r = el.getBoundingClientRect();
      const dentro =
        e.clientX >= r.left && e.clientX <= r.right &&
        e.clientY >= r.top && e.clientY <= r.bottom;
      el.style.setProperty("--mx", dentro ? `${e.clientX - r.left}px` : "-600px");
      el.style.setProperty("--my", dentro ? `${e.clientY - r.top}px` : "-600px");
    };

    const onMove = (e) => {
      ultimo = e;
      if (!quadro) quadro = requestAnimationFrame(aplicar);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (quadro) cancelAnimationFrame(quadro);
    };
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

/* ── Editor ao vivo ──────────────────────────────────────────────────────────
   A demonstração roda sozinha em laço, e sozinha ela só conta metade: mostra
   que os blocos se movem, não o que cada um deles é. Tocar num bloco congela a
   cena e abre o bloco com uma frase sobre ele.

   Congelar e continuar "de onde parou" é de graça no CSS: animation-play-state
   guarda a posição na linha do tempo, então soltar a pausa retoma o mesmo
   movimento em vez de recomeçar o laço.

   A volta é por inatividade, e não por um botão de fechar: quem está lendo não
   deveria ter de desfazer nada, e quem só tocou por curiosidade não fica preso
   numa cena parada. Qualquer movimento do ponteiro sobre a tela reinicia a
   contagem — é o que separa "parado lendo" de "parado porque esqueceu".
   ────────────────────────────────────────────────────────────────────────── */
function EditorAoVivo() {
  const [aberto, setAberto] = useState(null);
  const [saindo, setSaindo] = useState(false);
  const [fugas, setFugas] = useState({});
  const areaRef = useRef(null);
  const relogio = useRef(0);
  /* Espelho do `saindo` para ler dentro dos handlers sem depender do estado
     daquele render — e, principalmente, para o adiarVolta poder se calar
     enquanto o fechamento está em curso. Ver a trava dentro dele. */
  const saindoRef = useRef(false);

  // Apaga o texto e, só quando ele tiver sumido, devolve o bloco ao laço.
  function fechar() {
    clearTimeout(relogio.current);
    saindoRef.current = true;
    setSaindo(true);
    relogio.current = setTimeout(() => {
      saindoRef.current = false;
      setAberto(null);
      setSaindo(false);
    }, EDITOR_SAIDA);
  }

  /* Fechar leva dois tempos, e no meio deles o bloco AINDA está aberto — o que
     significa que o onPointerMove da tela continua ligado. Sem a trava abaixo,
     qualquer tremida do mouse nesses milissegundos caía aqui, e o relógio que
     este clearTimeout cancelava era justamente o que devolveria o bloco ao laço.
     O resultado era um bloco aberto para sempre e sem texto: `saindo` já tinha
     apagado a explicação, e o segundo tempo do fechamento nunca chegava. */
  function adiarVolta() {
    if (saindoRef.current) return;
    clearTimeout(relogio.current);
    relogio.current = setTimeout(fechar, EDITOR_ESPERA);
  }

  /* Para onde cada bloco sai quando outro abre. A conta é feita no clique, e
     não escrita à mão, porque a posição de cada um depende do instante em que
     a animação parou — o mesmo bloco está no meio da tela num momento e na
     borda no seguinte.

     De cada bloco saem quatro saídas possíveis (uma por borda) e vale a mais
     curta: quem está em cima sai por cima, quem está na lateral sai de lado. É
     o que faz o movimento parecer que o bloco aberto EMPURROU os outros, em vez
     de eles fugirem todos para o mesmo canto.

     Vai em transform de propósito: as keyframes mexem em left/top/width/height,
     e transform é a única propriedade de posição que sobra livre — assim o
     empurrão não briga com a animação nem precisa de !important. */
  function calcularFugas(idAberto) {
    const area = areaRef.current;
    if (!area) return {};
    const a = area.getBoundingClientRect();
    const folga = 14;
    const saida = {};
    area.querySelectorAll("[data-bloco]").forEach((el) => {
      const id = el.dataset.bloco;
      if (id === idAberto) return;
      const r = el.getBoundingClientRect();
      const rotas = [
        { x: -(r.right - a.left + folga), y: 0 },
        { x: a.right - r.left + folga, y: 0 },
        { x: 0, y: -(r.bottom - a.top + folga) },
        { x: 0, y: a.bottom - r.top + folga },
      ];
      saida[id] = rotas.reduce((menor, rota) =>
        Math.abs(rota.x + rota.y) < Math.abs(menor.x + menor.y) ? rota : menor);
    });
    return saida;
  }

  function alternar(id) {
    clearTimeout(relogio.current);
    if (aberto === id) {
      fechar();
      return;
    }
    saindoRef.current = false;
    setSaindo(false);
    setFugas(calcularFugas(id));
    setAberto(id);
    adiarVolta();
  }

  useEffect(() => () => clearTimeout(relogio.current), []);

  useEffect(() => {
    if (!aberto) return undefined;
    const aoTeclar = (e) => { if (e.key === "Escape") fechar(); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  return (
    <Reveal className={`dl-ed dl-glass${aberto ? " is-parado" : ""}${saindo ? " is-saindo" : ""}`} delay={140}>
      <div className="dl-ed__bar">
        <span className="dl-dot" style={{ background: "#f87171" }} />
        <span className="dl-dot" style={{ background: "#fbbf24" }} />
        <span className="dl-dot" style={{ background: "#4ade80" }} />
        <span className="dl-ed__url dl-mono">omnimob.app / vitrine / editar</span>
        {/* Pisca uma vez por movimento, logo depois de soltar o bloco. */}
        <span className="dl-ed__salvo dl-mono" aria-hidden="true">
          <i className="dl-ed__ponto" />
          alterações salvas
        </span>
      </div>

      <div
        className="dl-ed__tela"
        // Mexer o ponteiro aqui dentro conta como ação e adia a volta.
        onPointerMove={aberto ? adiarVolta : undefined}
      >
        <div className="dl-ed__area" ref={areaRef} role="group" aria-label="Blocos da vitrine — toque em um para saber o que ele é">
          {EDITOR_BLOCOS.map((id) => (
            <button
              key={id}
              type="button"
              data-bloco={id}
              className={`dl-ed__bloco dl-ed__bloco--${id}${aberto === id ? " is-aberto" : ""}`}
              style={fugas[id] ? { "--fuga-x": `${Math.round(fugas[id].x)}px`, "--fuga-y": `${Math.round(fugas[id].y)}px` } : undefined}
              onClick={() => alternar(id)}
              aria-expanded={aberto === id}
              aria-label={EDITOR_INFO[id].nome}
            >
              {/* O desenho vive num embrulho só dele, e não solto no bloco: é o
                  embrulho que carrega o arranjo daquele tipo de bloco, e é ele
                  que recua inteiro quando a explicação abre — em vez de as
                  silhuetas terem de ser apagadas uma a uma. */}
              <span className="dl-ed__miolo" aria-hidden="true">
                {Array.from({ length: EDITOR_MIOLO[id].itens }, (_, k) => (
                  <i key={k}>
                    {Array.from({ length: EDITOR_MIOLO[id].pecas }, (_, p) => (
                      <span key={p} />
                    ))}
                  </i>
                ))}
              </span>
              <span className="dl-ed__info">
                <b>{EDITOR_INFO[id].nome}</b>
                <em>{EDITOR_INFO[id].texto}</em>
              </span>
            </button>
          ))}
          <span className="dl-ed__ponteiro" aria-hidden="true" />
        </div>
      </div>

      <span className="dl-mono dl-browser-cap dl-ed__legenda">
        ▪ {aberto ? "TOQUE DE NOVO PARA FECHAR" : "ARRASTE E SOLTE · SALVA SOZINHO"}
      </span>
    </Reveal>
  );
}

/* ── Planos ──────────────────────────────────────────────────────────────────
   No desktop continuam sendo três colunas de uma tabela só: lado a lado é o
   arranjo que deixa comparar, e comparar é a decisão desta seção.

   No celular não existe lado a lado — empilhados, os três viravam três telas de
   rolagem e ninguém comparava nada. Viram carrossel: um plano por vez, centrado,
   com o vizinho aparecendo pela borda para dizer que há mais. O passo automático
   é só para quem chega e não toca em nada; ao primeiro gesto ele para de vez,
   porque carrossel que continua andando embaixo do dedo é armadilha.
   ────────────────────────────────────────────────────────────────────────── */
const CARROSSEL = "(max-width: 640px)";
/* Tela BAIXA. 820px cobre o 1366×768 e o 1440×900 com barra de tarefas — os
   dois monitores em que o cartão de plano completo passava da dobra.
   É `max-height` e não `max-width` de propósito: o problema é vertical. */
const TELA_BAIXA = "(max-height: 820px)";
const INTERVALO_PLANO = 5000;

/* ── Lista de recursos do cartão, que abre e fecha ───────────────────────────
   O botão "Ver todos os recursos" trocava as duas listas de um quadro para o
   outro: o cartão saltava de altura e o texto aparecia já no lugar novo, sem
   nada ligando um estado ao outro.

   Aqui ele abre. O molde é o mesmo do FaqItem — painel de altura animada com
   overflow escondido — com uma diferença que muda a implementação: no FAQ o
   conteúdo é SEMPRE o mesmo, então basta uma altura medida. Aqui as duas listas
   são diferentes de verdade (o resumo tem as linhas "Tudo do Plano X", que a
   comparação descarta, e para no teto de quatro), então não há um conteúdo só
   para medir — há dois, e o painel viaja de um tamanho ao outro.

   Daí as duas ficarem montadas ao mesmo tempo, empilhadas na mesma célula de
   grade: é o que permite medir as duas a qualquer momento e, de quebra, faz a
   troca ser um cruzamento em vez de um corte seco. Quem sai apaga rápido; quem
   entra acende logo atrás, com as linhas escalonadas, enquanto o painel cresce.

   A medida é feita em useLayoutEffect, antes da primeira pintura: com useEffect
   o cartão apareceria por um quadro na altura da grade (a da lista completa,
   que é a mais alta) e desabaria em seguida. Como a altura sai de `auto` para
   pixels, esse primeiro ajuste não anima — que é justamente o certo, porque
   ninguém abriu nada ainda.
   ────────────────────────────────────────────────────────────────────────── */
/* `compacto` e não `emCarrossel`: são duas perguntas que estavam coladas numa
   só, e separá-las é o conserto.

   O resumo com "Ver todos os recursos" existia SÓ no carrossel, disparado por
   `(max-width: 640px)`. Num monitor de 1366×768 a largura passa de 640, então
   o cartão abria com a lista inteira — e a tela é BAIXA, não estreita. O
   resultado era um cartão de plano ocupando a altura inteira do monitor.

   Largura decide o LAYOUT (três colunas ou carrossel). Altura decide o TAMANHO
   do conteúdo. Um monitor largo e baixo precisa da segunda coisa sem a
   primeira. */
function PlanoRecursos({ id, plano, resumido, compacto }) {
  const completaRef = useRef(null);
  const resumoRef = useRef(null);
  const [alturas, setAlturas] = useState(null);

  useLayoutEffect(() => {
    // Fora do carrossel não existe o botão: a lista completa fica solta, sem
    // altura escrita, e volta a ser o item flexível que empurra o botão de
    // teste para o pé do cartão.
    if (!compacto) {
      setAlturas(null);
      return undefined;
    }
    const medir = () =>
      setAlturas({
        completa: completaRef.current?.offsetHeight || 0,
        resumo: resumoRef.current?.offsetHeight || 0,
      });
    medir();
    /* As linhas refluem quando o cartão muda de largura (girar o aparelho) e
       quando a fonte termina de carregar. Sem remedir, um cartão aberto ficaria
       cortado ou com sobra embaixo — o mesmo motivo do FaqItem. */
    const observer = new ResizeObserver(medir);
    if (completaRef.current) observer.observe(completaRef.current);
    if (resumoRef.current) observer.observe(resumoRef.current);
    return () => observer.disconnect();
  }, [compacto]);

  const altura = alturas ? (resumido ? alturas.resumo : alturas.completa) : null;

  return (
    <div
      className={`pl-recursos${resumido ? " is-resumido" : ""}`}
      id={id}
      style={altura ? { height: `${altura}px` } : undefined}
    >
      <ul className="pl-lista" ref={completaRef} aria-hidden={resumido || undefined}>
        {plano.linhas.map((l, i) => (
          <li key={l.label} className={l.incluso ? "" : "is-off"} style={{ "--i": i }}>
            <span aria-hidden="true">{l.incluso ? <IconeCheck size={12} /> : <IconeX size={11} />}</span>
            <span className="pl-lista__texto">
              {l.label}
              {l.novo && l.incluso ? <em className="pl-novo">Novo</em> : null}
            </span>
          </li>
        ))}
      </ul>

      {/* O resumo só existe no modo compacto. Numa tela alta os três planos
          cabem inteiros lado a lado, e é a tabela completa que permite comparar
          de relance — resumir ali tiraria a única vantagem do desktop. */}
      {compacto ? (
        <ul className="pl-lista pl-lista--resumo" ref={resumoRef} aria-hidden={!resumido || undefined}>
          {plano.resumo.map((l) => (
            <li key={l.label} className={l.heranca ? "is-heranca" : ""}>
              <span aria-hidden="true"><IconeCheck size={12} /></span>
              <span className="pl-lista__texto">{l.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ── Os cartões de plano ──────────────────────────────────────────────────────
   Três cartões escuros lado a lado, cada um com uma mancha de luz (branco →
   índigo) desfocada no alto, em posição própria; o do meio se destaca pelo
   botão mais claro. A referência (dribbble.com/shots/26870248) é seguida à
   risca no DESENHO; o que este componente guarda é o COMPORTAMENTO que a
   página já tinha e a referência não mostra:

     · o preço só existe depois que /public/planos responde (esqueleto até lá);
     · o interruptor do Flow, por cartão, entre o preço e a lista;
     · no celular vira carrossel, com passo automático e pontos;
     · em tela baixa a lista vem resumida, com "Ver todos os recursos".

   As ondas WebGL do fundo, o contorno elétrico e a coroa do Premium saíram
   junto com o desenho antigo — eram efeitos daquele cartão, não desta seção. */
function Planos({ planos, aoTestar, temFlow, aoAlternarPacote }) {
  const [caixaRef, visivel] = useReveal();
  const trilhoRef = useRef(null);
  const [atual, setAtual] = useState(0);
  const [manual, setManual] = useState(false);
  // O passo automático lê o índice de dentro do intervalo; em estado ele leria
  // sempre o valor da montagem, e o carrossel ficaria pulando entre 0 e 1.
  const atualRef = useRef(0);
  atualRef.current = atual;

  const emCarrossel = useMedia(CARROSSEL);
  const telaBaixa = useMedia(TELA_BAIXA);
  // Carrossel implica compacto; tela baixa também, mesmo em três colunas.
  const compacto = emCarrossel || telaBaixa;

  // Quais cartões estão com a tabela inteira aberta. Por plano, e não um só
  // aberto por vez: quem abre um está comparando, e fechar o anterior sozinho
  // desfaria justamente a comparação.
  const [abertos, setAbertos] = useState({});

  /* Centraliza o cartão no trilho. A conta sai de getBoundingClientRect, e não
     de offsetLeft, porque offsetLeft é medido a partir do primeiro ancestral
     posicionado — que aqui não é o trilho. */
  function irPara(i) {
    const trilho = trilhoRef.current;
    const cartao = trilho?.children?.[i];
    if (!trilho || !cartao) return;
    const t = trilho.getBoundingClientRect();
    const c = cartao.getBoundingClientRect();
    const alvo = trilho.scrollLeft + (c.left - t.left) - (t.width - c.width) / 2;
    const semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    trilho.scrollTo({ left: alvo, behavior: semMovimento ? "auto" : "smooth" });
  }

  // Passo automático: só no carrossel, só com a seção à vista e só enquanto
  // ninguém tiver tomado o controle.
  useEffect(() => {
    if (!emCarrossel || manual || !visivel) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const id = setInterval(() => {
      const proximo = (atualRef.current + 1) % planos.length;
      setAtual(proximo);
      irPara(proximo);
    }, INTERVALO_PLANO);
    return () => clearInterval(id);
  }, [emCarrossel, manual, visivel, planos.length]);

  /* Quem manda no ponto aceso é a posição real do trilho, não o clique: assim
     arrastar com o dedo acende o ponto certo, e o passo automático não precisa
     avisar ninguém. */
  useEffect(() => {
    const trilho = trilhoRef.current;
    if (!trilho || !emCarrossel) return undefined;
    let quadro = 0;
    const aoRolar = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        const meio = trilho.getBoundingClientRect().left + trilho.clientWidth / 2;
        let perto = 0;
        let menor = Infinity;
        Array.from(trilho.children).forEach((cartao, i) => {
          const r = cartao.getBoundingClientRect();
          const dist = Math.abs(r.left + r.width / 2 - meio);
          if (dist < menor) { menor = dist; perto = i; }
        });
        setAtual(perto);
      });
    };
    trilho.addEventListener("scroll", aoRolar, { passive: true });
    return () => {
      trilho.removeEventListener("scroll", aoRolar);
      cancelAnimationFrame(quadro);
    };
  }, [emCarrossel]);

  return (
    <div className="pl-caixa" ref={caixaRef}>
      <div
        className="pl-cartoes"
        ref={trilhoRef}
        // Pointerdown e não scroll: rolagem também é disparada pelo passo
        // automático, e aí ele se desligaria sozinho no primeiro movimento.
        onPointerDown={() => setManual(true)}
      >
        {planos.map((p, i) => {
                  // Resumido só no carrossel: no desktop os três aparecem juntos e a
          // tabela inteira é o que permite comparar de relance.
          const resumido = compacto && !abertos[p.key];
          // O botão cheio marca "é este aqui". No desktop é o Profissional, o
          // do meio; no carrossel só existe um plano por vez, então o cheio
          // segue o cartão em foco.
          const emDestaque = emCarrossel ? i === atual : p.highlight;
          return (
          <Reveal
            key={p.key}
            className={`pl-cartao${p.highlight ? " is-popular" : ""}${i === atual ? " is-atual" : ""}`}
            delay={i * 110}
          >
            {/* A mancha de luz do cartão: a classe --n muda a posição dela, e é
                isso que faz os três serem irmãos e não cópias (ver o CSS). */}
            <div className={`pl-bolha-cards pl-bolha-cards--${i + 1}`} aria-hidden="true" />
            <h3 className="pl-cartao__nome">{p.name}</h3>
            <p className="pl-cartao__desc">{p.desc}</p>

            {/* Enquanto o preço não chega, um esqueleto no lugar dele. O bloco
                mantém a altura nos dois estados, então a chegada do valor não
                empurra a lista de recursos para baixo. */}
            <div className="pl-cartao__preco" aria-busy={p.carregando || undefined}>
              {p.carregando ? (
                <>
                  <strong className="dl-esqueleto dl-esqueleto--preco" aria-hidden="true">
                    &nbsp;
                  </strong>
                  <span className="dl-so-leitor">Carregando o preço…</span>
                </>
              ) : (
                <>
                  <strong>{p.price}</strong>
                  {p.per ? <span>{p.per}</span> : null}
                </>
              )}
            </div>
            {/* A nota do período fica logo abaixo do número, como o "billed
                annually" da referência. A do anual é uma frase de quatro
                linhas e reserva a altura, para as listas dos três cartões
                começarem na mesma linha. */}
            <p
              className={`pl-cartao__nota${p.notaLonga && !p.carregando ? " pl-cartao__nota--longa" : ""}${p.carregando ? " dl-esqueleto dl-esqueleto--nota" : ""}`}
              aria-hidden={p.carregando || undefined}
            >
              {p.carregando ? " " : p.nota}
            </p>
            {!p.carregando && p.economia?.valor > 0 ? (
              <span className="pl-cartao__economia">economize {formatarBRL(p.economia.valor)}</span>
            ) : null}

            {/* O interruptor do Flow, entre o preço e a lista: muda o número
                acima e as linhas abaixo, e ficar entre os dois é o que torna
                esse efeito legível. */}
            {temFlow ? (
              <div className="pl-flow" onClick={(e) => e.stopPropagation()}>
                <ToggleDoFlow
                  id={`pkg-${p.key.toLowerCase()}`}
                  ligado={Boolean(p.comFlow)}
                  aoAlternar={(on) => aoAlternarPacote(p.key, on)}
                />
              </div>
            ) : null}

            {/* "Recursos" entre duas linhas, como na referência. */}
            <p className="pl-cartao__rotulo"><span>Recursos</span></p>

            <PlanoRecursos
              id={`plano-lista-${p.key}`}
              plano={p}
              resumido={resumido}
              compacto={compacto}
            />

            {/* O botão acompanha o modo compacto, não o carrossel: sem ele, num
                monitor baixo a lista viria resumida e não haveria como abrir. */}
            {compacto ? (
              <button
                type="button"
                className="pl-mais"
                aria-expanded={!resumido}
                aria-controls={`plano-lista-${p.key}`}
                onClick={() => setAbertos((a) => ({ ...a, [p.key]: !a[p.key] }))}
              >
                {resumido ? "Ver todos os recursos" : "Ver menos"}
                <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 6.5 8 10.5l4-4" />
                </svg>
              </button>
            ) : null}
            {/* Todo caminho da página leva ao teste. O plano escolhido vai
                junto como intenção, para o time saber com o que a pessoa se
                identificou. */}
            <button
              type="button"
              className={`pl-btn ${emDestaque ? "pl-btn--cheio" : "pl-btn--contorno"}`}
              onClick={() => aoTestar(p.key)}
            >
              {emDestaque ? "Testar com este plano" : "Testar com este plano"}
            </button>
          </Reveal>
          );
        })}
      </div>

      {emCarrossel ? (
        <div className="pl-pontos">
          {planos.map((p, i) => (
            <button
              key={p.key}
              type="button"
              className={`pl-ponto${i === atual ? " is-on" : ""}`}
              aria-label={`Ver o plano ${p.name}`}
              aria-current={i === atual}
              onClick={() => { setManual(true); setAtual(i); irPara(i); }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* Cartão de destaque como PEÇA da parede.

   Mesma marcação da faixa que existia antes (`dl-fcard`), com um modificador
   que a solta da largura fixa: dentro da parede quem manda no tamanho é a
   peça, e o cartão só precisa preenchê-la. */
function cartaoDaFaixa(r) {
  return (
    <div className={`dl-fcard dl-fcard--parede dl-relato${r.tom ? ` dl-fcard--${r.tom}` : ""}`}>
      <div className="dl-relato__quem">
        <AvatarDoRelato nome={r.nome} foto={r.foto} />
        <div className="dl-relato__nome">
          <strong>{r.nome}</strong>
          <span>{r.cargo} · {r.imobiliaria}</span>
        </div>
      </div>
      <p className="dl-relato__frase">“{r.frase}”</p>
      <span className="dl-relato__onde">{r.cidade} · {r.uf}</span>
    </div>
  );
}

/* Parede de destaques — o fundo desta seção.

   Substitui a esteira horizontal que rolava aqui. Os cartões são os mesmos; o
   que mudou é que agora eles ocupam a seção inteira, em perspectiva, atrás do
   texto.

   DECORATIVA de propósito (`interactive={false}`): o conteúdo dos cartões já
   está escrito no texto da seção, e como a parede repete a lista várias vezes
   para o laço fechar, deixá-la focável encheria a navegação por teclado de
   paradas repetidas antes do próximo link de verdade.

   No celular a parede encolhe em vez de sumir: menos colunas, peças menores e
   menos inclinação — a mesma cena, num palco estreito. */
function ParedeDeDestaques() {
  // Congela a deriva quando a máquina não sustenta o laço por quadro.
  const { podeQuadroAQuadro } = useEfeitos();
  const emMobile = useMedia(CARROSSEL);
  const [aberto, setAberto] = useState(null);
  const fundoRef = useRef(null);
  const [naVista, setNaVista] = useState(false);

  /* A parede só aparece quando a seção dela é a que se está vendo.

     Ela já pausava fora da tela, mas continuava desenhada — ao rolar, as peças
     ficavam paradas na beirada, aparecendo por baixo da seção vizinha. O limiar
     de 35% é o que separa "estou nesta seção" de "ela está passando": com um
     valor baixo demais a parede acenderia enquanto a pessoa ainda lê a seção
     anterior. */
  useEffect(() => {
    const el = fundoRef.current;
    if (!el || typeof IntersectionObserver === "undefined") { setNaVista(true); return undefined; }
    const io = new IntersectionObserver(([e]) => setNaVista(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const pecas = useMemo(
    () => RELATOS.map((r) => ({ title: r.nome, content: cartaoDaFaixa(r), dados: r })),
    [],
  );

  // Esc fecha. O painel cobre a seção, então precisa da saída de teclado.
  useEffect(() => {
    if (!aberto) return undefined;
    const aoTeclar = (e) => { if (e.key === "Escape") setAberto(null); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  return (
    <>
      <div className={`dl-porque__fundo${naVista ? " is-na-vista" : ""}`} ref={fundoRef}>
        <DriftWall
          /* Sem deriva na máquina fraca: os ladrilhos ficam parados e
             continuam clicáveis. O conteúdo é o mesmo; o que some é o
             movimento. */
          paused={!podeQuadroAQuadro}
          items={pecas}
          interactive={false}
          onItemClick={(item) => setAberto(item.dados)}
          columns={emMobile ? 3 : "auto"}
          tileWidth={emMobile ? 190 : 268}
          tileHeight={emMobile ? 140 : 178}
          gap={emMobile ? 12 : 18}
          radius={18}
          tilt={emMobile ? 10 : 15}
          turn={emMobile ? -8 : -12}
          perspective={emMobile ? 900 : 1400}
          depth={emMobile ? 80 : 120}
          speed={emMobile ? 22 : 24}
          variance={0.45}
          parallax={0}
          lift={emMobile ? 0 : 18}
          fade={emMobile ? 0.42 : 0.28}
          /* A peça no celular fica bem mais apagada. Numa tela estreita cabem
             três colunas do tamanho de meia tela cada, então a parede deixa de
             ser textura ao fundo e vira um mural de cartões legíveis brigando
             com o título — que é o único texto da seção. */
          dim={emMobile ? 1 : 0.62}
          overlayColor="transparent"
        />
      </div>

      {/* Lista real da seção, para leitor de tela e para o teclado.

          A parede é `aria-hidden` porque repete as mesmas peças várias vezes
          para o laço fechar — anunciar oito destaques cinco vezes seria pior que
          não anunciar. Aqui eles aparecem uma vez só, na ordem escrita, e cada
          um abre o mesmo painel que o clique na peça abre. */}
      <ul className="dl-porque__lista">
        {RELATOS.map((r) => (
          <li key={r.nome}>
            <button type="button" onClick={() => setAberto(r)}>
              {r.nome}, {r.imobiliaria}
            </button>
          </li>
        ))}
      </ul>

      {aberto ? (
        <div className="dl-porque__painel" role="dialog" aria-modal="true" aria-label={`Relato de ${aberto.nome}`}>
          {/* Fundo clicável para fechar: com a parede andando atrás, um clique
              fora do painel é o gesto que a pessoa tenta primeiro. */}
          <div className="dl-porque__saida" onClick={() => setAberto(null)} aria-hidden="true" />
          <Reveal className="dl-porque__caixa">
            <span className="dl-porque__tag">RELATO</span>
            <div className="dl-relato__quem dl-relato__quem--painel">
              <AvatarDoRelato nome={aberto.nome} foto={aberto.foto} />
              <div className="dl-relato__nome">
                <h3>{aberto.nome}</h3>
                <span>{aberto.cargo} · {aberto.imobiliaria} · {aberto.cidade}, {aberto.uf}</span>
              </div>
            </div>
            <p>“{aberto.frase}”</p>
            <Button
              as="button"
              type="button"
              variant="ghost"
              arrow={false}
              className="dl-porque__fechar"
              onClick={() => setAberto(null)}
            >
              Fechar
            </Button>
          </Reveal>
        </div>
      ) : null}
    </>
  );
}

/* Número da métrica, rolando como marcador mecânico.

   O Counter recebe um número puro, e as métricas daqui não são números puros:
   têm prefixo ("+1.200"), sufixo ("98%") ou simplesmente não são número
   ("24/7"). `parseStat` já separava essas partes para a contagem antiga — aqui
   ela decide se o marcador entra em cena ou se o texto vai cru.

   AS CASAS SÃO FIXADAS PELO VALOR FINAL, e não pelo atual: contando 0 → 1200 o
   marcador precisa nascer com quatro colunas. Deixá-las sair do valor corrente
   faria o número ganhar casas no meio da rolagem e a largura pular a cada
   centena.

   E o valor só sobe quando o bloco aparece: o Counter anima ao ver a prop
   mudar, então até lá ele fica em zero — que é o estado de onde a contagem
   parte. */
function StatNumero({ raw, ativo }) {
  const info = useMemo(() => parseStat(raw), [raw]);
  const caixaRef = useRef(null);

  /* O Counter precisa da altura de cada algarismo EM PIXELS — é dela que sai o
     deslocamento da coluna. Mas `.dl-stat__n` tem tamanho fluido
     (clamp(28px, 3.4vw, 44px)), então fixar um número aqui descolaria o
     marcador do resto do bloco em metade das larguras de tela. Medimos o
     tamanho que o CSS resolveu e reagimos quando ele muda. */
  const [tamanho, setTamanho] = useState(40);
  useEffect(() => {
    const el = caixaRef.current;
    if (!el) return undefined;
    const medir = () => setTamanho(parseFloat(getComputedStyle(el).fontSize) || 40);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* As casas do marcador, com o ponto de milhar no meio quando o número
     original tinha um ("+1.200"). O Counter trata "." como casa literal — a
     mesma peça que ele usa para separar decimais serve aqui de separador, e sem
     ela o número sairia "+1200", perdendo a leitura que a métrica já tinha. */
  const casas = useMemo(() => {
    if (!info) return [];
    const digitos = String(Math.trunc(Math.abs(info.valor)) || 0).length;
    const saida = [];
    for (let i = 0; i < digitos; i += 1) {
      const restantes = digitos - i - 1;
      // Separador antes de cada grupo de três que ainda falta fechar.
      if (info.agrupado && i > 0 && restantes % 3 === 2) saida.push(".");
      saida.push(10 ** restantes);
    }
    return saida;
  }, [info]);

  // "24/7" e afins não têm número para rolar.
  if (!info) return raw;

  return (
    <span className="dl-stat__roll" ref={caixaRef}>
      {info.prefixo}
      <Counter
        value={ativo ? info.valor : 0}
        places={casas}
        fontSize={tamanho}
        padding={2}
        gap={1}
        horizontalPadding={0}
        borderRadius={0}
        gradientHeight={10}
        gradientFrom="var(--bg)"
      />
      {info.sufixo}
    </span>
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
            <StatNumero raw={s.n} ativo={visivel} />
          </strong>
          <span className="dl-stat__l">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Página ──────────────────────────────────────────────────────────────────

/* O provedor precisa ficar ACIMA do conteúdo, e o conteúdo precisa poder
   consultá-lo — daí a página exportada ser só o embrulho. Medir dentro do
   próprio componente que lê a medida daria um ciclo. */
export function OmnimobLandingPage() {
  return (
    <EfeitosProvider>
      <ConteudoDaLanding />
    </EfeitosProvider>
  );
}

function ConteudoDaLanding() {
  /* Repete o que está no index.html de propósito: as tags do HTML são o estado
     inicial de TODAS as rotas, então quem chega aqui vindo de outra tela (o
     React Router não recarrega a página) precisa que elas voltem ao valor da
     home. Sem isto, sair de uma vitrine e voltar deixaria o título da
     imobiliária na aba. */
  // A Omnimob como empresa e produto (Organization/WebSite/SoftwareApplication).
  useEsquemaDaOmnimob();

  useSeo({
    titulo: "Omnimob — Sua imobiliária, em movimento.",
    descricao:
      "Software para imobiliárias e corretores: cadastro de imóveis, vitrine digital personalizável, captação e gestão de leads e publicação nas redes sociais.",
    caminho: "/",
  });

  // -1 = todas fechadas. A lista abre inteira à vista, e quem escolhe o que
  // ler é o visitante — com uma já aberta, a primeira pergunta ganhava um
  // destaque que ela não tem sobre as outras.
  /* Abre na primeira. Antes era -1 (todas fechadas) porque o acordeão empilhado
     dava destaque indevido à primeira pergunta; agora a resposta tem coluna
     própria, e -1 deixaria metade da seção em branco. */
  const [faqAberto, setFaqAberto] = useState(0);
  const ano = new Date().getFullYear();

  /* Uma porta só para a página inteira: o teste. `planoDesejado` guarda com
     qual plano a pessoa se identificou quando ela chega pelos cartões — o teste
     libera tudo de qualquer jeito, mas essa intenção é o que o time usa para
     puxar a conversa depois. */
  const [trialAberto, setTrialAberto] = useState(false);
  const [planoDesejado, setPlanoDesejado] = useState("");
  const abrirTeste = (plano = "", origem = "") => {
    const source = origem || (plano ? "pricing" : "landing");
    trackLandingEvent("trial_open", { source, plan: plano || undefined });
    setPlanoDesejado(plano);
    setTrialAberto(true);
  };

  /* Mensal ou anual. Começa no mensal de propósito: é o menor número da tela,
     e abrir no anual faria o cartão anunciar quatro dígitos para quem só quer
     saber quanto custa. */
  const [periodo, setPeriodo] = useState("mensal");

  /* ── UM PACOTE POR CARTÃO ──────────────────────────────────────────────
     Era um alternador só, no topo da seção, e ele obrigava a comparar os três
     planos sempre no mesmo pacote. Mas a pergunta real de quem está escolhendo
     é outra — "quanto custa o Profissional COM o Flow contra o Premium SEM?" —,
     e com um interruptor único ela exigia trocar, ler, trocar de volta e
     lembrar do número.

     Com um por cartão, os três preços convivem na tela em qualquer combinação.

     Todos começam em HUB pelo mesmo motivo do mensal: é o menor número, e abrir
     no pacote completo faria a página anunciar o preço mais alto para quem só
     quer saber quanto custa. */
  const [pacotes, setPacotes] = useState(
    () => Object.fromEntries(PLANOS.map((p) => [p.key, "HUB"])),
  );
  const alternarPacote = useCallback((planoKey, comFlow) => {
    setPacotes((atuais) => ({ ...atuais, [planoKey]: comFlow ? "HUB_FLOW" : "HUB" }));
  }, []);

  // Valores vigentes no provedor; enquanto não chegam, valem os de reserva.
  const { planos: PLANS, temAnual, temFlow } = usePrecosVigentes(periodo, pacotes);

  /* O selo do alternador é o melhor desconto entre os planos — um número só
     para uma escolha só. Por plano, a economia em reais aparece no cartão. */
  const seloPeriodo = useMemo(() => {
    const melhor = PLANS.map((p) => p.economiaAnual)
      .filter(Boolean)
      .sort((x, y) => (y.mesesGratis || 0) - (x.mesesGratis || 0))[0];
    return selosDaEconomia(melhor);
  }, [PLANS]);

  const vantaRef = useRef(null);
  const { podeWebGL } = useEfeitos();

  /* A instância fica em variável local, não em estado. Guardada em estado, a
     limpeza fechava sobre o valor ANTERIOR (ainda null) e não destruía o efeito
     que aquela mesma execução tinha acabado de criar — no StrictMode, que roda
     efeito/limpeza/efeito, sobrava um canvas órfão e a névoa ficava dobrada.
     Rodando uma vez só, cada execução destrói exatamente o que criou. */
  /* A névoa só existe perto da seção dela.

     Ela nascia no load e ficava viva a página inteira — um contexto WebGL a
     desenhar por trás de tudo enquanto a pessoa lê o topo. Navegador guarda
     poucos contextos, e o custo aparece como queda de quadros na rolagem, longe
     da seção que causa. (Houve um segundo permanente aqui, a fumaça do
     GhostCursor na seção O DESAFIO; ela saiu, e o lugar dela é o relevo da
     palavra-fantasma, que é CSS.) */
  const [nevoaPerto, setNevoaPerto] = useState(false);
  useEffect(() => {
    const el = vantaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") { setNevoaPerto(true); return undefined; }
    const io = new IntersectionObserver(([e]) => setNevoaPerto(e.isIntersecting), { rootMargin: "400px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* ── A NÉVOA DO VANTA SAIU; ENTROU O SHADER DE IRIDESCÊNCIA ────────────────

     As duas travas continuam iguais, e são elas que importam mais que o efeito:
     `podeWebGL` (o orçamento de `capacidadeDaMaquina`) e `nevoaPerto` (só perto
     da seção). Um shader de tela cheia desenhando enquanto a pessoa lê o topo
     da página é custo puro — foi o que fez a névoa antiga ganhar as duas.

     O componente cuida do resto: sem `ativo`, ele não cria contexto nenhum.
     Ver `components/Iridescencia.jsx`. */

  return (
    <div className="dl-root">
      {/* A folha das cenas do fluxo vai junto: elas moram na secao de
          Recursos agora (ver RECURSOS), e nao numa secao propria que trazia o
          proprio <style>. */}
      <OmnimobStyles extra={`${CSS}
${GV4_CSS}`} />

      <OmnimobSplash />

      {/* OMNIMOB_EXIT_INTENT_V1_RENDER_START */}
      <ExitIntentModal
        trialAberto={trialAberto}
        onTeste={() => abrirTeste("", "exit-intent")}
      />
      {/* OMNIMOB_EXIT_INTENT_V1_RENDER_END */}
      {/* OMNIMOB_LANDING_GROWTH_V4_STICKY_START */}
      <MobileStickyCTA
        trialAberto={trialAberto}
        onTeste={() => abrirTeste("", "mobile-sticky")}
      />
      {/* OMNIMOB_LANDING_GROWTH_V4_STICKY_END */}
      <TrialModal
        aberto={trialAberto}
        planos={PLANS}
        planoDesejado={planoDesejado}
        aoFechar={() => setTrialAberto(false)}
      />

      <CabecalhoDaLanding />

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
                  Imóveis, vitrine, leads e divulgação num só lugar — com um editor visual sem código e IA cuidando do conteúdo.
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
                  <Button as="button" type="button" variant="primary" onClick={() => abrirTeste()}>
                    Testar grátis
                  </Button>
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
      {/* Os ids das seções sem âncora de menu existem para o revezamento de
          fundos: no celular a seção do desafio sai de cena e o xadrez precisa
          ser refeito de lá para baixo (ver "Zebra do celular" no CSS). */}
      <section className="dl-section dl-section--alt dl-section--compacto dl-numeros" id="numeros">
        <DivisorDeOndas tom="escuro" />
        {/* A terceira forma da familia. Entra PARADA, e nao girando como as duas
            irmas: ela veio em PNG, e PNG girando a 240px serrilha na diagonal.
            Vira textura de canto — o mesmo papel, sem o movimento. Se um dia
            chegar o SVG dela, ela passa a usar FormaDeFundo como as outras. */}
        <div className="dl-wrap">
          <SectionHead eyebrow="NÚMEROS DA OMNIMOB" strong="A plataforma completa" soft="para quem vive de vender imóveis.">
            Uma base só, pensada para imobiliárias brasileiras: imóveis, vitrine, leads, equipe e divulgação
            no mesmo painel.
          </SectionHead>

          <StatsGrid />

          <p className="dl-mono dl-note">// números da plataforma, atualizados periodicamente</p>
        </div>
      </section>

      {/* ── O desafio ──
          Só no desktop: a seção inteira é construída em torno da palavra
          gigante que o cursor revela, e sem cursor sobra um texto solto num
          fundo vazio. Quem esconde é o CSS, não uma condição em JS — assim não
          há um segundo componente montado por largura de tela, e girar o
          aparelho volta a mostrar a seção sem remontar nada. */}
      <section className="dl-section dl-section--amplo dl-section--ghost" id="desafio">
        <DivisorDeOndas tom="grafite" />
        <GhostWord>+ visibilidade.</GhostWord>
        {/* Duas colunas: o texto explica o problema, a cena mostra ele
            acontecendo. Antes a ilustracao vinha depois do callout e lia como
            anexo; ao lado do conjunto inteiro ela vira a outra metade da frase. */}
        <div className="dl-wrap dl-desafio__grade">
          <div className="dl-desafio__conteudo">
          <SectionHead eyebrow="O DESAFIO" eyebrowTone={GOLD} strong="Pare de perder cliente" soft="por falta de presença digital.">
            Anúncio espalhado, foto solta, planilha desatualizada. O cliente não espera você organizar tudo.
          </SectionHead>

          <Reveal className="dl-callout">
            <p>
              Com a Omnimob, cada imóvel entra uma vez e aparece em todo lugar — na vitrine da sua imobiliária,
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

          {/* A unica ilustracao da pagina que mostra o PROBLEMA. */}
          <Reveal className="dl-desafio__arte" delay={90}>
            <img
              src="/ilustracoes/desafio-bagunca.png"
              alt="Corretora cercada de fotos soltas, grupo de WhatsApp e planilha desatualizada, enquanto um interessado vai embora"
              width={640}
              height={420}
              loading="lazy"
            />
          </Reveal>
        </div>
      </section>

      {/* ── Recursos + mock ── */}
      <section id="recursos" className="dl-section dl-section--alt">
        <DivisorDeOndas tom="escuro" />
        <div className="dl-wrap">
          <SectionHead eyebrow="RECURSOS" strong="Tudo que sua imobiliária" soft="precisa. Em um só lugar.">
            Um sistema, do cadastro à conversão — sem juntar cinco ferramentas para dar conta da operação.
          </SectionHead>

          <Recursos />
        </div>
      </section>

      

      {/* ── Integrações ──────────────────────────────────────────────────────
          Texto de um lado, a arte com as marcas do outro. Substitui a grade de
          doze cartões animados (uma cena por canal): a seção virou uma
          apresentação, não uma lista de consulta — quem quer saber "tem ZAP?"
          vê a marca na arte, e quem quer entender o argumento lê o texto.

          A arte é UMA imagem, e as marcas de terceiros estão nela: os ícones
          próprios que a grade desenhava existiam para não usar logotipo alheio
          sem licença — regra que continua valendo para o que este código
          desenha. A imagem é responsabilidade de quem a montou.

          Arte à esquerda e texto à direita no desktop; empilhados, texto
          primeiro, no celular (o argumento antes da ilustração). */}
      <section className="dl-section dl-section--compacto" id="integracoes">
        <DivisorDeOndas tom="grafite" />
        <div className="dl-wrap dl-canais">
          <Reveal className="dl-canais__copy">
            <Eyebrow>CANAIS E INTEGRAÇÕES</Eyebrow>
            <h2 className="dl-h2">
              <span className="dl-h2__strong">Conectada aos canais</span>
              <span className="dl-h2__soft">onde seu cliente já está.</span>
            </h2>
            <p className="dl-lead">
              Do cadastro aos portais, redes e assinatura digital — sem espalhar a operação por
              várias ferramentas.
            </p>
            <p className="dl-body">
              ZAP, VivaReal, OLX e Mercado Livre recebem os imóveis direto do acervo; Facebook,
              Instagram e WhatsApp, a publicação; o contrato sai assinado pela Clicksign ou DocuSign.
              E há uma API própria, com webhooks, para o que a sua equipe já usa.
            </p>
            <div className="dl-btn-row">
              <Button href="/contato" variant="ghost" arrow={false}>Falar sobre integrações</Button>
            </div>
          </Reveal>

          <Reveal className="dl-canais__arte" delay={120}>
            <img
              src="/plataformas_omnimob.png"
              alt="Marcas dos portais, redes sociais e serviços conectados à Omnimob"
              width={1280}
              height={720}
              loading="lazy"
              decoding="async"
            />
          </Reveal>
        </div>
      </section>

      {/* ── Os dois módulos ─────────────────────────────────────────────────
          Vem depois de Canais e antes de Planos, e a posição é o argumento: a
          pessoa acabou de ver o que o Hub faz, e esta seção diz que existe uma
          segunda metade. Colocada antes, ela apresentaria o Flow para quem
          ainda não sabe o que é o produto; depois dos planos, chegaria tarde —
          a escolha do pacote já teria sido feita sem saber o que se escolhia. */}
      {/* A única seção CLARA da página. Não leva `dl-wrap` nem `SectionHead`: o
          manifesto traz o próprio invólucro e o próprio cabeçalho, porque a
          escala da frase e o alinhamento à esquerda não são os da página. */}
      {/* O rasgo de papel que sobe sobre a seção escura anterior — ver .dl-rasgo. */}
      <div className="dl-rasgo" aria-hidden="true" />
      <section className="dl-section dl-section--claro" id="modulos">
        <ManifestoDoFlow />
      </section>
      {/* E o rasgo de baixo, que desce sobre a seção escura seguinte. */}

      {/* ── Destaques: parede à deriva no fundo da seção inteira ──
          O conteúdo fica por cima da parede, não ao lado dela — por isso a
          seção é o palco (`position: relative`) e a parede é uma camada
          absoluta atrás. */}
      <section className="dl-section dl-section--tight dl-porque" id="porque">
        <DivisorDeOndas tom="claro" />

        <ParedeDeDestaques />

        <div className="dl-wrap dl-porque__frente">
          <SectionHead eyebrow="POR QUE OMNIMOB" strong="O que muda no dia a dia" soft="de quem usa.">
            Detalhes que economizam tempo toda semana na rotina da imobiliária.
          </SectionHead>
        </div>
      </section>

      {/* OMNIMOB_LANDING_GROWTH_V4_TRUST_START */}
      {/* Vazada, e não pintada: a seção de cima é a parede em movimento, e a
          onda deixa a parede escorrer para dentro da faixa. */}
      <TrustStrip className="dl-ondas-vazadas" />
      {/* OMNIMOB_LANDING_GROWTH_V4_TRUST_END */}
      {/* ── Planos ── */}
      <section id="planos" className="dl-section">
        <DivisorDeOndas tom="grafite" />
        <div className="dl-wrap">
          {/* Cabeçalho à esquerda, como o resto da página — mas sem SectionHead:
              aqui o título tem duas linhas curtas e o subtítulo vem colado, e a
              mancha de luz da seção mora no canto direito, onde o SectionHead
              poria a descrição. O alternador de período fica sob o subtítulo:
              é uma escolha da página inteira (ninguém paga um plano no mensal e
              outro no anual); o do Flow desceu para dentro de cada cartão. */}
          <div className="pl-secao">
            {/* ── Os filtros que AMASSAM as manchas ──
                Um radial-gradient é sempre uma elipse perfeita; o que deixa a
                forma "desfigurada", como na referência, é passar a mancha por
                um ruído (feTurbulence) que desloca cada ponto da borda
                (feDisplacementMap). Um filtro por mancha, para cada uma ter o
                seu amassado. Os controles:
                  baseFrequency  o tamanho das bossas — menor = bossas largas e
                                 poucas; maior = borda serrilhada
                  numOctaves     detalhe do ruído (1–3; mais que isso não se vê)
                  seed           outra forma, mesmo tamanho de bossa
                  scale          QUANTO deforma, em px — é o botão principal
                A margem do filtro (x/y/width/height) é a folga para a forma
                deslocada não ser cortada na caixa do elemento. */}
            <svg className="pl-filtros" aria-hidden="true" focusable="false">
              <filter id="pl-deforma-canto" x="-35%" y="-35%" width="170%" height="170%" colorInterpolationFilters="sRGB">
                <feTurbulence type="fractalNoise" baseFrequency="0.005 0.008" numOctaves="2" seed="7" result="ruido" />
                <feDisplacementMap in="SourceGraphic" in2="ruido" scale="160" xChannelSelector="R" yChannelSelector="G" />
              </filter>
              <filter id="pl-deforma-cards" x="-35%" y="-35%" width="170%" height="170%" colorInterpolationFilters="sRGB">
                <feTurbulence type="fractalNoise" baseFrequency="0.004 0.011" numOctaves="2" seed="3" result="ruido" />
                <feDisplacementMap in="SourceGraphic" in2="ruido" scale="110" xChannelSelector="R" yChannelSelector="G" />
              </filter>
            </svg>
            <div className="pl-bolha-canto" aria-hidden="true" />
            <div className="pl-cabeca">
              <h2 className="pl-titulo">
                Escolha o plano ideal
                <br />
                para sua imobiliária
              </h2>
              <p className="pl-sub">Sem fidelidade, cancele quando quiser.</p>
              {temAnual ? (
                <PeriodoToggle valor={periodo} aoTrocar={setPeriodo} selo={seloPeriodo} />
              ) : null}
            </div>

            <Planos
              planos={PLANS}
              aoTestar={abrirTeste}
              temFlow={temFlow}
              aoAlternarPacote={alternarPacote}
            />
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="dl-section dl-section--alt dl-section--compacto">
        <DivisorDeOndas tom="escuro" />
        <div className="dl-wrap">
          <SectionHead eyebrow="PERGUNTAS FREQUENTES" strong="Tudo sobre a Omnimob," soft="direto ao ponto.">
            As dúvidas que mais aparecem antes de começar.
          </SectionHead>

          {/* A lista de perguntas comanda; a resposta aparece ao lado.

              `activeIndex` é passado, não deixado por conta do componente: a
              pergunta destacada na lista e a resposta exibida têm de ser a
              mesma coisa, e duas fontes de verdade para um fato só é como elas
              divergem. */}
          <div className="dl-faq2">
            <LineSidebar
              className="dl-faq2__lista"
              items={FAQ.map((f) => f.q)}
              activeIndex={faqAberto}
              onItemClick={(i) => setFaqAberto(i)}
              accentColor={GOLD}
              textColor="var(--strong)"
              markerColor="var(--placeholder)"
              proximityRadius={90}
              maxShift={18}
              markerLength={52}
              markerGap={18}
              itemGap={22}
              fontSize={0.95}
              smoothing={110}
            />

            <div className="dl-faq2__resposta">
              {/* `key` na pergunta: sem ela o React reaproveita o nó e o texto
                  troca sem a transição de entrada, como se nada tivesse mudado. */}
              <Reveal key={FAQ[faqAberto]?.q || "vazio"} className="dl-faq2__caixa">
                <span className="dl-mono dl-faq2__num">F.{String(faqAberto + 1).padStart(2, "0")}</span>
                <h3 className="dl-faq2__q">{FAQ[faqAberto]?.q}</h3>
                <p className="dl-faq2__a">{FAQ[faqAberto]?.a}</p>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ── Aplicativo mobile ── */}
      <section className="dl-section dl-app-soon" id="aplicativo">
        <DivisorDeOndas tom="grafite" />
        <div className="dl-wrap dl-app-soon__grid">
          <Reveal className="dl-app-soon__copy">
            <Eyebrow tone={GOLD}>OMNIMOB MOBILE</Eyebrow>
            <h2 className="dl-h2">
              <span className="dl-h2__strong">A Omnimob,</span>
              <span className="dl-h2__soft">também no seu bolso.</span>
            </h2>
            <p className="dl-lead">
              Em breve, a experiência da Omnimob também estará disponível em aplicativo para celular,
              com versões para Android e iOS.
            </p>
            <div className="dl-app-soon__stores" aria-label="Disponibilidade futura nas lojas de aplicativos">
              <span className="dl-app-soon__store">
                <span className="dl-app-soon__store-kicker dl-mono">EM BREVE NO</span>
                <strong>Google Play</strong>
              </span>
              <span className="dl-app-soon__store">
                <span className="dl-app-soon__store-kicker dl-mono">EM BREVE NA</span>
                <strong>App Store</strong>
              </span>
            </div>
            <p className="dl-mono dl-note dl-app-soon__note">// ANDROID · IOS · A MESMA OMNIMOB, ONDE VOCÊ ESTIVER</p>
          </Reveal>

          <Reveal className="dl-app-soon__visual" delay={120}>
            {/* Trocou /em_breve.png, que era um PNG de 1,4 MB em 1448x1086 para
                caber em 760. Este vem no tamanho exato de exibicao e pesa 273 kB
                — 1,1 MB a menos na landing, e agora ele pertence a mesma familia
                dos outros dez desenhos em vez de ser a unica peca ilustrada. */}
            <img
              src="/ilustracoes/app-no-bolso.png"
              alt="Corretora a caminho de uma visita, olhando o painel da Omnimob no celular"
              width={760}
              height={570}
              loading="lazy"
            />
          </Reveal>
        </div>
      </section>

      {/* ── O FECHO: CTA + rodapé sobre um fundo só ──────────────────────
          O shader iridescente era o fundo do CTA; agora é o fundo dos DOIS.
          O rodapé virou um cartão escuro arredondado no meio, e o que sobra
          dos lados dele é o shader continuando — a página termina na mesma
          textura em que o CTA começou, em vez de num retângulo preto.

          ── O fundo ──
          Sem escalopes aqui: o shader já é o movimento desta seção, e as
          flores disputavam com ele em cima do mesmo fundo claro.

          `seguirMouse` LIGADO aqui e em nenhuma outra seção: é o fim da
          página, o lugar onde a pessoa já parou para decidir. O deslocamento
          é pequeno (`amplitude`) — o suficiente para o fundo responder sem
          virar brinquedo por cima de um botão. */}
      <div className="dl-fecho">
        {podeWebGL ? (
          <Iridescencia
            ativo={nevoaPerto}
            cor={[0.502, 0.6, 0.8]}
            velocidade={0.55}
            amplitude={0.12}
            seguirMouse
            className="dl-fecho__fundo"
          />
        ) : null}

      {/* ── CTA final (seção clara) ── */}
      <section id="contato" className="dl-cta" ref={vantaRef}>
        {/* Sem onda aqui: a seção escura de cima vira esta por um degradê que
            começa por baixo dela — ver .dl-fecho no CSS. */}
        {/* ── DUAS PLACAS QUE SE ENCAIXAM ──────────────────────────────────
            À esquerda, a placa do texto: um cartão de contorno com o lado
            direito INCLINADO; à direita, uma placa menor, recortada pelo
            `clip-path` no formato complementar, que hoje é só um espaço
            reservado (a imagem entra depois). As duas se sobrepõem um pouco
            (margem negativa) para lerem como peças de um encaixe, e não como
            duas caixas lado a lado.

            As formas são dois SVGs cada (desktop e celular): no celular o
            corte inclinado vira uma base curva, e a placa da direita passa a
            ser uma faixa embaixo do texto. A do contorno é só traço
            (preserveAspectRatio="none", para acompanhar a caixa); a do recorte
            é um clipPath em objectBoundingBox, para valer em qualquer tamanho. */}
        <Reveal className="dl-wrap dl-cta__inner">
          <svg className="dl-cta__defs" aria-hidden="true" width="0" height="0">
            <defs>
              <clipPath id="dl-cta-forma-desktop" clipPathUnits="objectBoundingBox">
                <path transform="scale(0.002331002331002331 0.0016666666666666668)" d="M428.5 520C428.5 564.183 392.682 600 348.5 600L80.5996 600C25.5366 600 -13.0652 545.668 5.05588 493.672L158.401 53.6723C169.601 21.5336 199.91 3.3688e-05 233.944 3.77597e-05L348.499 5.14644e-05C392.682 5.67502e-05 428.5 35.8173 428.5 80.0001L428.5 520Z" />
              </clipPath>
              <clipPath id="dl-cta-forma-mobile" clipPathUnits="objectBoundingBox">
                <path transform="scale(0.002777777777777778 0.006289308176100629)" d="M2.06245e-06 102.967C9.23389e-07 133.895 25.0721 158.967 56 158.967L309.384 158.967C337.338 158.967 360 136.306 360 108.351C360 84.7272 343.659 64.2451 320.625 58.9985L68.437 1.55576C33.3874 -6.42777 5.11036e-06 20.2099 3.78644e-06 56.1572L2.06245e-06 102.967Z" />
              </clipPath>
            </defs>
          </svg>

          <div className="dl-cta__dupla">
            <div className="dl-cta__placa">
              <svg className="dl-cta__contorno dl-cta__contorno--desktop" preserveAspectRatio="none" viewBox="0 0 915 594" aria-hidden="true">
                <path d="M80 0.500007C36.0934 0.500003 0.499999 36.0934 0.499997 80L0.49998 514C0.499978 557.906 36.0933 593.5 80 593.5L681.855 593.5C715.615 593.5 745.693 572.178 756.871 540.323L909.161 106.323C927.303 54.6234 888.936 0.500081 834.146 0.500076L80 0.500007Z" />
              </svg>
              <svg className="dl-cta__contorno dl-cta__contorno--mobile" preserveAspectRatio="none" viewBox="0 0 360 501" aria-hidden="true">
                <path d="M359.5 40.9673C359.5 19.1521 341.815 1.46728 320 1.46728L40.0001 1.46726C18.1849 1.46726 0.500151 19.152 0.500149 40.9672L0.500022 396.121C0.50002 414.526 13.2114 430.492 31.1485 434.616L311.148 498.999C335.892 504.688 359.5 485.893 359.5 460.503L359.5 40.9673Z" />
              </svg>

              <div className="dl-cta__texto">
                {/* Sem `tone`: a bolinha índigo se perdia sobre o shader, do
                    mesmo jeito que os cinzas do texto se perdiam. A eyebrow
                    inteira é branca aqui — as três regras estão juntas em
                    `.dl-cta`. */}
                <Eyebrow>PRÓXIMO PASSO</Eyebrow>
                <h2 className="dl-cta__title">
                  <span>Pronto para vender</span>
                  <span>mais imóveis</span>
                  {/* Dois spans, e nao um: a lapide usa o `background` do
                      elemento para o vidro, e `background-clip: text`
                      recortaria a PLACA no formato das letras. O de dentro
                      carrega o texto e o degrade. */}
                  <span className="dl-cta__grad">
                    <span className="dl-cta__grad-texto">com processo?</span>
                  </span>
                </h2>
                <p className="dl-cta__sub">
                  Crie um ambiente de teste em segundos. Já tem uma imobiliária rodando? A gente
                  traz a sua base junto.
                </p>
              </div>

              {/* O principal continua sendo um só: "Testar grátis". O segundo
                  não concorre com ele — é a saída para quem quer conversar
                  antes de testar, e leva a /contato. */}
              <div className="dl-btn-row">
                <Button as="button" type="button" variant="dark" onClick={() => abrirTeste()}>
                  Testar grátis
                </Button>
                <Button href="/contato" variant="light" arrow={false}>
                  Falar com a gente
                </Button>
              </div>
            </div>

            {/* O espaço da imagem. Vazio de propósito por enquanto — a forma
                já está no lugar para a arte entrar como `object-fit: cover`. */}
            <div className="dl-cta__vaga" aria-hidden="true">
              <svg className="dl-cta__vaga-traco dl-cta__vaga-traco--desktop" preserveAspectRatio="none" viewBox="0 0 429 600">
                <path d="M428.5 520C428.5 564.183 392.682 600 348.5 600L80.5996 600C25.5366 600 -13.0652 545.668 5.05588 493.672L158.401 53.6723C169.601 21.5336 199.91 3.3688e-05 233.944 3.77597e-05L348.499 5.14644e-05C392.682 5.67502e-05 428.5 35.8173 428.5 80.0001L428.5 520Z" />
              </svg>
              <svg className="dl-cta__vaga-traco dl-cta__vaga-traco--mobile" preserveAspectRatio="none" viewBox="0 0 360 159">
                <path d="M2.06245e-06 102.967C9.23389e-07 133.895 25.0721 158.967 56 158.967L309.384 158.967C337.338 158.967 360 136.306 360 108.351C360 84.7272 343.659 64.2451 320.625 58.9985L68.437 1.55576C33.3874 -6.42777 5.11036e-06 20.2099 3.78644e-06 56.1572L2.06245e-06 102.967Z" />
              </svg>
            </div>
          </div>

          <p className="dl-mono dl-cta__note">OMNIMOB · IMÓVEIS · VITRINE · LEADS · IA · GESTÃO DE IMOBILIÁRIAS</p>
        </Reveal>
      </section>

      {/* ── Footer ── */}
      <footer className="dl-footer">
        {/* O cartão: tudo do rodapé mora dentro dele. É ele que é escuro e
            arredondado; o <footer> em si é transparente, e o shader do fecho
            aparece nas laterais e embaixo. */}
        <div className="dl-footer__cartao">
        {/* O par da marca fechando a página. Grande e quase invisível (4%): o
            rodapé é onde o olho já desacelerou, e uma forma discreta ali é a
            diferença entre a página TERMINAR e a página simplesmente parar.
            Mesmo par do manifesto do Flow — é a repetição que faz virar
            assinatura em vez de enfeite. */}
        <FormaDeFundo
          forma="flor"
          cor="rgba(255,255,255,0.04)"
          gira={90}
          className="dl-footer__forma dl-footer__forma--a"
        />
        <FormaDeFundo
          forma="luas"
          cor="rgba(99,102,241,0.07)"
          gira={70}
          inverso
          className="dl-footer__forma dl-footer__forma--b"
        />
        {/* O predio da marca em cena, fechando a pagina. Fica no rodape e nao no
            heroi de proposito: no topo ele competiria com o simbolo de verdade,
            que esta no cabecalho a poucos pixels dali. Aqui ele e a assinatura
            de quem escreveu a pagina. */}
        <img
          className="dl-footer__predio"
          src="/ilustracoes/predio-omnimob.png"
          alt=""
          width={300}
          height={420}
          loading="lazy"
        />
        <div className="dl-wrap dl-footer__inner">
          <div className="dl-footer__brand">
            <Link to="/" className="dl-footer__logo" aria-label="Omnimob — início">
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
              <span className="dl-mono">A OMNIMOB</span>
              <Link to="/vitrines">Vitrines publicadas</Link>
              <Link to="/sobre">Sobre</Link>
              <Link to="/contato">Contato</Link>
            </div>
            <div>
              <span className="dl-mono">ACESSO</span>
              <Link to="/login">Acesso do cliente</Link>
              {/* A área administrativa saiu daqui junto com o link do rodapé do
                  login — ver o comentário em `LoginPage`. Anunciá-la no rodapé
                  da página de VENDAS era o pior dos dois lugares: ela aparecia
                  para quem nem cliente é. */}
            </div>
            <div>
              {/* Termos e Privacidade no rodapé, como em qualquer serviço que
                  cobra assinatura — e a Política é exigência da LGPD, não
                  enfeite. */}
              <span className="dl-mono">LEGAL</span>
              <Link to="/termos">Termos de Uso</Link>
              <Link to="/privacidade">Privacidade</Link>
              <a href="mailto:contato@omnimob.app">contato@omnimob.app</a>
            </div>
          </div>
        </div>
        <div className="dl-wrap dl-footer__bottom dl-mono">
          <span>© {ano} OMNIMOB</span>
          {/* Discordar da detecção automática. Fica no rodapé porque ninguém
              procura isto ao chegar — só depois de sentir a página pesada. */}
          <SeletorDeEfeitos />
          <span>FEITO PARA IMOBILIÁRIAS BRASILEIRAS</span>
        </div>
        </div>
      </footer>
      </div>
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

/* O flex-shrink zerado é o que impede a tipografia de amassar. Sem ele o link é
   um item de flex encolhível, e quando a barra aperta (celular, com o CTA ainda
   dentro dela) ele espremia a arte: a imagem tem largura automática, então ela
   cedia em largura sem ceder em altura e as letras saíam achatadas. */
.dl-header__logo {
  z-index: 1001; display: inline-flex; align-items: center; flex: 0 0 auto;
  transition: opacity 0.4s var(--ease-out);
}
.dl-header.is-menu-open .dl-header__logo { opacity: 0; pointer-events: none; }
/* Segunda trava, agora do lado da imagem: seja qual for a caixa que sobrar, a
   arte cabe dentro dela inteira, na proporção original. */
.dl-header__tipo {
  height: 44px; width: auto; max-width: 100%; object-fit: contain; object-position: left center;
  transition: height 0.45s var(--ease-out);
}
.dl-header.is-scrolled .dl-header__tipo { height: 34px; }
.dl-header__right { display: flex; align-items: center; gap: 22px; z-index: 1001; }
.dl-header__cta { transition: opacity 0.4s var(--ease-out); }
.dl-header.is-menu-open .dl-header__cta { opacity: 0; pointer-events: none; }

/* ── Botão do menu ── */

/* ── Menu em tela cheia ──
   O círculo nasce no canto do botão e cresce até cobrir a tela. O raio final
   passa bem de 100% porque o círculo precisa alcançar o canto oposto, que
   está mais longe que a borda mais próxima. */




/* ── Cabeçalho de seção ── */
.dl-head {
  display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 40px;
  align-items: end; margin-bottom: 44px;
}
.dl-head__desc { font-size: 14px; line-height: 1.78; color: var(--subtle); padding-bottom: 6px; }

/* ── Seções ──
   O respiro é uma variável porque a camada de cor dos planos precisa saber dele:
   ela nasce dentro do .dl-wrap, que só começa DEPOIS do respiro, e sem o valor
   não teria como alcançar as bordas da seção. */
.dl-section { --pad-sec: clamp(64px, 8vw, 112px); padding: var(--pad-sec) 0; border-top: 1px solid var(--line-soft); }
.dl-section--alt { background: var(--bg-alt); }
.dl-section--tight { padding-bottom: clamp(48px, 6vw, 80px); }
/* ── RITMO VERTICAL ──────────────────────────────────────────────────────────
   Todas as secoes respiravam igual, e uma pagina com espacamento constante le
   como lista: secao, vao, secao, vao. O que da cadencia e a DENSIDADE variar de
   proposito — as secoes narrativas abrem, as de consulta fecham.

   Sao modificadores do token que ja existe (--pad-sec), e nao paddings novos:
   a camada de ondas dos planos e a palavra-fantasma leem esse mesmo token para
   sangrar ate a borda da secao, e um padding escrito por fora deixaria as duas
   desalinhadas da secao que habitam.

   A conta fecha em altura: a 1440px sao +32px em cada lado de duas secoes e
   -28px em cada lado de tres. O saldo e cerca de 40px A MENOS de pagina. */
.dl-section--amplo { --pad-sec: clamp(84px, 10vw, 144px); }
.dl-section--compacto { --pad-sec: clamp(52px, 6vw, 84px); }

/* ── Palavra-fantasma ──
   A seção precisa conter e recortar a palavra, que é bem mais larga que ela.
   O conteúdo não precisa de z-index: .dl-wrap já é relative com z-index 1, e
   a palavra fica no 0. */
.dl-section--ghost { position: relative; overflow: hidden; }
/* O conteúdo fica acima da palavra. Os valores são folgados (havia um canvas de
   WebGL em z-index 10 entre os dois, e ele saiu) — mantidos porque só precisam
   respeitar a ordem, e mexer neles não compra nada. */
.dl-section--ghost > .dl-wrap { position: relative; z-index: 12; }
.dl-ghost {
  /* Atrás do conteúdo e à frente do fundo. As letras são pretas como o fundo:
     o que se vê é o relevo dourado vazando por trás delas, e não texto aceso. */
  position: absolute; inset: 0; z-index: 11;
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
  /* O relevo dourado. Ele saiu quando a fumaça em WebGL passou a iluminar a
     seção, e voltou quando ela saiu: a palavra é de novo o único efeito daqui,
     e sem sombra nenhuma ela seria preto sobre preto — invisível mesmo dentro
     do buraco que a máscara abre.

     A primeira camada é mais fechada e mais opaca: é ela que dá a aresta do
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
   mancha dourada sem forma, e o que se quer é justamente reconhecê-las.

   O texto fala em "brilho": é o relevo dourado da palavra. Valia igual quando
   quem iluminava a seção era a fumaça em WebGL, e continua valendo sem ela. */
.dl-section--ghost .dl-callout {
  background: rgba(20,20,22,0.72);
  backdrop-filter: blur(9px) saturate(140%);
  -webkit-backdrop-filter: blur(9px) saturate(140%);
  border-color: rgba(255,255,255,0.10);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
}

/* Legibilidade por cima do relevo.

   Fora do callout o texto da seção não tem fundo nenhum: é letra transparente
   direto sobre a palavra. E o miolo dela — o "bili" de "+ visibilidade." — é
   justamente onde a coluna de leitura cruza a parte mais acesa do relevo: o
   dourado chega ali no auge e o cinza do lead perde o contraste.

   O remédio é um halo escuro em volta de cada glifo, na cor do próprio fundo.
   Sobre o preto ele é invisível (é a mesma cor) e só se manifesta quando há
   brilho atrás — que é exatamente onde precisa aparecer. Baixar o dourado
   resolveria também, mas o dourado é o efeito; quem tem de ceder é o fundo
   imediato das letras, não a seção inteira.

   As camadas são cumulativas de propósito, e repetidas de propósito: uma
   sombra só, por mais opaca, ainda deixa o dourado vazar entre as hastes finas
   de letras como "i" e "l". Repetir o mesmo raio soma opacidade — é o jeito de
   passar de "escurece um pouco" para "abre um buraco no brilho". Ser generoso
   aqui não custa nada fora do halo, porque a sombra é da cor do fundo. */
.dl-section--ghost .dl-eyebrow,
.dl-section--ghost .dl-h2,
.dl-section--ghost .dl-head__desc,
.dl-section--ghost .dl-callout p {
  text-shadow:
    0 0 4px var(--bg), 0 0 4px var(--bg),
    0 0 12px var(--bg), 0 0 12px var(--bg),
    0 0 26px var(--bg), 0 0 26px var(--bg),
    0 0 52px var(--bg);
}

/* ── Botão especular ─────────────────────────────────────────────────────────
   O elemento carrega as DUAS marcações: dl-btn + dl-btn--<variante> (que é onde
   quarenta regras desta página penduram largura, respiro e posição) e
   specular-button (a aparência). Aqui a segunda ganha da primeira no que é
   aparência, e só nisso.

   Os seletores são pesados de propósito: as variantes do kit vêm prefixadas com
   .dl-root para vencerem a regra global de button do styles.css, então qualquer
   coisa menor que isso perde para elas. */
.dl-root .dl-btn--especular {
  /* Preenchimento e borda passam a ser os do especular (variáveis escritas no
     style inline pelo componente). Sem isto, o branco sólido do --primary ou o
     roxo do --accent ficariam POR CIMA do vidro e não sobraria efeito nenhum. */
  background: color-mix(in srgb, var(--sb-tint) calc(var(--sb-tint-opacity) * 100%), transparent);
  border: 1px solid color-mix(in srgb, var(--sb-base-color) 45%, transparent);
  color: var(--sb-text-color);
  /* O brilho já é o realce do hover; a sombra colorida das variantes viraria
     uma segunda luz por baixo dele, com outra forma. */
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
  overflow: visible;
}
/* Estados de hover das variantes: o que acende agora é a borda, não o fundo. */
.dl-root .dl-btn--especular:hover {
  background: color-mix(in srgb, var(--sb-tint) calc(var(--sb-tint-opacity) * 160%), transparent);
  border-color: color-mix(in srgb, var(--sb-base-color) 72%, transparent);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.07);
}
/* A seta herda a cor do texto da variante em vez da pastilha escura do kit —
   sobre vidro, um disco preto no meio do botão lê como buraco. */
.dl-root .dl-btn--especular .dl-btn__arrow {
  background: color-mix(in srgb, var(--sb-text-color) 14%, transparent);
}
/* O rótulo é irmão do canvas e precisa ficar por cima dele; como o conteúdo do
   botão (texto + seta) mora nesse rótulo, é ele que carrega o alinhamento. */
.dl-root .dl-btn--especular .specular-button__label {
  display: inline-flex; align-items: center; gap: inherit;
}
/* O canvas estoura a caixa em 20px por lado (o PAD do componente). Dentro de
   um trilho com recorte — o carrossel de planos — essa sobra seria decepada;
   lá o respiro do trilho já reserva o espaço vertical. */
.dl-root .dl-btn--especular .specular-button__fx { inset: -20px; }

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

/* ── Recursos como abas ──
   A célula virou <button>, e o styles.css global pinta todo button de roxo,
   centralizado e arredondado. Daí a desmontagem abaixo vir prefixada com
   .dl-root: só assim ela ganha do seletor button e do button:hover. As bordas
   de hairline não entram aqui — .dl-cell já vence o "border: none" do global. */
/* A célula cede o respiro ao botão, senão o fundo invertido pararia antes da
   borda de hairline e sobraria uma moldura escura em volta. */
.dl-cell--aba { padding: 0; }
.dl-root .dl-feature--aba {
  width: 100%; height: 100%; padding: 22px;
  background: transparent; color: inherit; border: none;
  font: inherit; text-align: left; border-radius: 0;
  align-items: stretch; justify-content: flex-start;
  cursor: pointer;
  transition: background-color 0.34s var(--ease-out), color 0.34s var(--ease-out);
}
.dl-root .dl-feature--aba:hover {
  background: rgba(255,255,255,0.03); transform: none; box-shadow: none;
}
.dl-root .dl-feature--aba:active { scale: 1; }
.dl-root .dl-feature--aba:focus-visible { outline: 2px solid var(--accent-soft); outline-offset: -3px; }

/* Selecionada: o cartão inverte — fundo claro, texto escuro. */
.dl-root .dl-feature--aba.is-ativo { background: #f6f6f8; color: #0a0a0b; }
.dl-feature--aba.is-ativo .dl-feature__title { color: #0a0a0b; }
.dl-feature--aba.is-ativo .dl-feature__desc { color: #3b3b45; }
.dl-feature--aba.is-ativo .dl-index { color: #7a7a86; }
.dl-feature--aba.is-ativo .dl-feature__icon {
  background: rgba(10,10,11,0.07); border-color: rgba(10,10,11,0.14); color: #0a0a0b;
}
/* O hover não pode clarear ainda mais o que já está claro. */
.dl-root .dl-feature--aba.is-ativo:hover { background: #f6f6f8; }
.dl-split { display: grid; grid-template-columns: 1fr 0.92fr; gap: 26px; align-items: stretch; }
/* ── Integrações ──
   No hover a célula inteira se pinta com a cor da marca e o ícone dela ocupa o
   fundo. O ícone é grande de propósito e o overflow corta o que passa: a
   sensação é de a marca preencher a célula, não de um selo no cantinho. */
.dl-int { position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 5px; }
.dl-int__marca {
  position: absolute; inset: 0; z-index: 0; pointer-events: none;
  display: flex; align-items: center; justify-content: center;
  background: var(--int-cor);
  color: rgba(255,255,255,0.75);
  opacity: 0; transform: scale(1.14);
  transition: opacity 0.38s var(--ease-out), transform 0.55s var(--ease-out);
}
.dl-int:hover .dl-int__marca { opacity: 1; transform: none; }
/* Fundo claro (o dourado das métricas) pede marca escura: branco não se lê. */
.dl-int--claro .dl-int__marca { color: rgba(10,10,11,0.26); }

.dl-int__type,
.dl-int__name { position: relative; z-index: 1; transition: color 0.35s ease; }
.dl-int__type { color: var(--accent-soft); font-size: 9px; }
.dl-int__name { font-size: 13.5px; font-weight: 600; color: var(--strong); }
.dl-int:hover .dl-int__type { color: var(--int-texto); opacity: 0.75; }
.dl-int:hover .dl-int__name { color: var(--int-texto); }

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
/* O teto de altura existe porque a coluna da esquerda (seis células) é bem mais
   alta que qualquer uma das telas: sem ele, a moldura esticava junto e sobrava
   um vazio enorme por dentro. O que sobra agora fica fora da moldura, onde não
   se vê. Continua sendo altura fixa, então trocar de aba não pula o layout. */
.dl-browser {
  flex: 1; max-height: 468px; display: flex; flex-direction: column;
  border-radius: 14px; overflow: hidden;
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

/* ── Esteiras de imóveis (tela "imóveis") ──
   Três filas de cartões correndo sozinhas, em sentidos alternados. A grade
   parada que estava aqui mostrava seis imóveis; a esteira mostra acervo, que é
   o que a célula promete.

   Cada fila continua com a largura da moldura (é item de uma coluna de flex, e
   portanto esticado nela): é isso que deixa a largura do cartão sair de uma
   porcentagem — três por tela, sempre —, e o que passa disso simplesmente
   transborda para os lados, onde o pai recorta.

   O percurso é uma cópia inteira da lista, e não "-50%": a lista tem
   ESTEIRA_CARTOES × 2 cartões, então meia lista são 6 cartões, que medem
   6 × (largura + vão) = 2 × (100% + vão). Com -50% o laço erraria por um vão e
   daria um pulo por volta. */
.dl-esteira {
  --vao: 9px;
  display: flex; flex-direction: column; gap: var(--vao); overflow: hidden;
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 7%, #000 93%, transparent);
  mask-image: linear-gradient(90deg, transparent, #000 7%, #000 93%, transparent);
}
/* As três filas dividem a altura em partes iguais, seja qual for a moldura: a
   base zerada faz o reparto sair só do que sobra, e não do conteúdo de cada uma
   (que é igual nas três, mas depende da altura da foto — daí a circularidade). */
.dl-esteira__linha {
  display: flex; gap: var(--vao); flex: 1 1 0; min-height: 0;
  animation: dlEsteira 26s linear infinite;
}
/* A do meio corre ao contrário. Durações diferentes de propósito: iguais, as
   três filas andariam em bloco e a alternância de sentido viraria um zigue-zague
   marcado em vez de movimento. */
.dl-esteira__linha--dir { animation-direction: reverse; animation-duration: 33s; }
.dl-esteira__linha:last-child { animation-duration: 29s; }
@keyframes dlEsteira {
  from { transform: translateX(0); }
  to { transform: translateX(calc(-2 * (100% + var(--vao)))); }
}
.dl-esteira__card {
  flex: 0 0 calc((100% - var(--vao) * 2) / 3);
  display: flex; flex-direction: column; gap: 5px;
  padding: 8px; border-radius: 9px;
  border: 1px solid var(--line); background: var(--surface);
}
/* A foto é quem cede ou toma altura quando a moldura muda; as legendas embaixo
   têm tamanho de texto e não deveriam esticar junto. O piso é o que segura o
   cartão de pé caso a fila não esteja sendo esticada por ninguém. */
.dl-esteira__foto {
  display: grid; place-items: center; overflow: hidden;
  flex: 1; min-height: 26px; border-radius: 6px;
  background: linear-gradient(var(--giro, 135deg), rgba(99,102,241,0.38), rgba(212,175,55,0.24));
}
/* A silhueta é um selo no meio da foto, não a foto inteira: ela sugere o que o
   anúncio é sem virar ilustração. O teto em pixels impede que ela engorde junto
   com o cartão quando a moldura estica. */
.dl-esteira__foto svg { width: 42%; max-width: 40px; height: auto; display: block; }
.dl-esteira__vulto { fill: rgba(255,255,255,0.26); }
.dl-esteira__vao { fill: rgba(10,10,11,0.36); }
.dl-esteira__card .dl-skel { flex: 0 0 auto; height: 5px; }

/* ── Telas do mock (uma por recurso) ──
   Coluna de flex, e não grade: a moldura tem altura fixa e o miolo dela precisa
   poder ser esticado ou não, tela a tela. Numa grade com align-content: start
   toda tela ficava colada no topo — o que serve às listas e deixava um vão morto
   embaixo dos quadros (ver TELAS_CHEIAS). */
.dl-browser__body { flex: 1; display: flex; flex-direction: column; }
.dl-browser__tela { display: grid; gap: 14px; align-content: start; animation: dlTela 0.42s var(--ease-out) both; }
.dl-browser__tela.is-cheia { display: flex; flex-direction: column; flex: 1; min-height: 0; }
/* O quadro é sempre o último filho — o que vem antes é o rótulo ou os chips. */
.dl-browser__tela.is-cheia > :last-child { flex: 1; min-height: 0; }
/* As cenas do fluxo dentro do navegador: a moldura de cartao que elas trazem
   (borda, raio, sombra, largura de 660px) e do palco antigo; aqui quem e a
   moldura e o proprio navegador. */
.dl-browser__tela .gv4-cena { width: 100%; border: 0; border-radius: 0; box-shadow: none; }
/* A demo do editor no lugar do mock: ela e um grid, e o pai e flex — sem isto
   ela encolhe ao conteudo em vez de ocupar a coluna. */
.dl-split__tela > .dl-ed { flex: 1; min-width: 0; }
@keyframes dlTela {
  from { opacity: 0; transform: translateY(9px); }
  to { opacity: 1; transform: none; }
}


.dl-browser__kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.dl-browser__kpi {
  border-radius: 10px; border: 1px solid var(--line); background: var(--surface);
  padding: 10px 11px; display: grid; gap: 4px;
}
.dl-browser__kpi span { font-size: 8px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--placeholder); }
.dl-browser__kpi strong { font-size: 17px; font-weight: 700; letter-spacing: -0.03em; color: var(--strong); }

.dl-browser__chart {
  display: flex; align-items: flex-end; gap: 7px; height: 92px; padding: 12px;
  border-radius: 10px; border: 1px solid var(--line); background: var(--surface);
}
.dl-browser__chart i {
  flex: 1; border-radius: 3px 3px 1px 1px;
  background: linear-gradient(180deg, var(--accent-soft), rgba(99,102,241,0.22));
}
.dl-browser__chart i:last-child { background: linear-gradient(180deg, var(--gold), rgba(212,175,55,0.22)); }

.dl-browser__rows { display: grid; gap: 10px; }
.dl-browser__linha {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 10px; border-radius: 10px; background: rgba(255,255,255,0.03);
}
.dl-browser__av {
  width: 26px; height: 26px; border-radius: 999px; flex: 0 0 auto;
  background: linear-gradient(135deg, rgba(99,102,241,0.55), rgba(212,175,55,0.38));
}
.dl-browser__lin { display: grid; gap: 5px; flex: 1; }
/* ── Previews de publicação (tela "redes") ──
   Recorte do passo "Divulgar" do cadastro: anel em degradê animado no card em
   foco, os outros recuando desfocados, e a logo da rede flutuando na quina.
   A entrada usa fill-mode backwards de propósito — com "both", o estado final
   da animação venceria o transform do hover e o card em foco não cresceria. */
/* O respiro embaixo é para o rótulo da rede, que fica pendurado fora do card. */
.dl-redes { display: flex; align-items: stretch; gap: 12px; height: 150px; padding: 10px 0 18px; }
.dl-redes__card {
  position: relative; flex: 1 1 0; min-width: 0;
  animation: dlRedesEntra 0.62s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  transition:
    flex-grow 0.5s cubic-bezier(0.22, 1, 0.36, 1),
    filter 0.45s ease, transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}
.dl-redes__card:nth-child(1) { animation-delay: 0.16s; }
.dl-redes__card:nth-child(2) { animation-delay: 0.06s; }
.dl-redes__card:nth-child(3) { animation-delay: 0.16s; }
@keyframes dlRedesEntra {
  from { opacity: 0; transform: translateX(var(--de)) scale(0.62); }
  to { opacity: 1; transform: none; }
}

.dl-redes:hover .dl-redes__card:not(:hover) {
  flex-grow: 0.7; transform: scale(0.8); filter: blur(2px) brightness(0.55) saturate(0.85);
}
.dl-redes__card:hover { flex-grow: 2.4; z-index: 4; }

.dl-redes__anel {
  height: 100%; padding: 2px; border-radius: 12px;
  background: rgba(255,255,255,0.10);
  transition: padding 0.45s ease, background-color 0.45s ease, box-shadow 0.45s ease;
}
.dl-redes__card:hover .dl-redes__anel {
  padding: 3px; background: var(--anel); background-size: 300% 300%;
  box-shadow: 0 14px 34px -12px var(--brilho);
  animation: dlAnelFlui 4.5s ease infinite;
}
@keyframes dlAnelFlui {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

/* O preview no produto é branco, como o feed da rede. Aqui ele é escuro de
   propósito: é só simulação, e um cartão branco no meio da landing brigaria
   com todo o resto. Mesma superfície dos outros mocks (--surface). */
.dl-redes__inner {
  height: 100%; border-radius: 10px; overflow: hidden;
  background: var(--surface); display: flex; flex-direction: column;
}
.dl-redes__foto {
  flex: 1; min-height: 0;
  background: linear-gradient(135deg, rgba(99,102,241,0.42), rgba(212,175,55,0.34));
}
.dl-redes__linhas { display: grid; gap: 5px; padding: 8px; flex: 0 0 auto; }

.dl-redes__logo {
  position: absolute; top: -9px; right: -9px; width: 27px; height: 27px; z-index: 7;
  display: flex; align-items: center; justify-content: center;
  color: #fff; background: var(--marca);
  box-shadow: 0 6px 16px rgba(0,0,0,0.42);
  transform: scale(0.84); opacity: 0.88;
  transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.45s ease;
}
.dl-redes__card:hover .dl-redes__logo { transform: scale(1.1); opacity: 1; }

.dl-redes__status {
  position: absolute; bottom: -15px; left: 50%; transform: translateX(-50%);
  white-space: nowrap; font-size: 8px; color: var(--placeholder);
  opacity: 0; transition: opacity 0.4s ease; pointer-events: none;
}
.dl-redes__card:hover .dl-redes__status { opacity: 1; }

.dl-browser__chips { display: flex; gap: 7px; flex-wrap: wrap; }
.dl-browser__chip {
  padding: 3px 9px; border-radius: 999px; white-space: nowrap;
  border: 1px solid var(--line-soft); color: var(--placeholder); font-size: 8px;
}
.dl-browser__chip--ok { color: var(--mint); border-color: rgba(20,184,166,0.28); }

/* ── Tenants (tela "multi-tenant seguro") ──
   Quatro ambientes fechados, cada um na própria cor e no próprio quadro, com uma
   parede tracejada correndo entre eles. A tela anterior era a mesma lista de
   linhas da célula de usuários: mesmo desenho, mesma leitura — os tenants
   pareciam registros de uma tabela, que é o contrário de "isolados".

   A parede é do contêiner, e não de cada quadro: ela precisa passar POR ENTRE os
   quatro, no vão da grade, e não em volta de cada um (isso a borda já faz). */
.dl-tenants {
  position: relative; display: grid;
  grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 12px;
}
.dl-tenants::before,
.dl-tenants::after { content: ""; position: absolute; pointer-events: none; z-index: 0; }
.dl-tenants::before { left: 50%; top: -3px; bottom: -3px; border-left: 1px dashed rgba(255,255,255,0.11); }
.dl-tenants::after { top: 50%; left: -3px; right: -3px; border-top: 1px dashed rgba(255,255,255,0.11); }

.dl-tenants__box {
  position: relative; z-index: 1;
  display: flex; flex-direction: column; gap: 8px;
  padding: 10px; border-radius: 11px;
  background: var(--surface); border: 1px solid var(--line);
  /* A faixa lateral na cor do tenant é o que faz os quatro quadros pararem de
     ser o mesmo quadro repetido quatro vezes. */
  border-left: 2px solid var(--t);
}
.dl-tenants__topo { display: flex; align-items: center; gap: 7px; }
.dl-tenants__marca {
  width: 15px; height: 15px; border-radius: 5px; flex: 0 0 auto;
  background: var(--t); opacity: 0.85;
}
/* A vitrine é quem absorve a altura que sobra no quadro; a marca em cima e o
   selo embaixo ficam do tamanho que têm. */
.dl-tenants__vitrine {
  display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, 1fr);
  gap: 5px; flex: 1; min-height: 34px;
}
.dl-tenants__vitrine i {
  display: block; border-radius: 5px;
  background: linear-gradient(160deg, color-mix(in srgb, var(--t) 34%, transparent), rgba(255,255,255,0.05));
}
.dl-tenants__selo {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 7.5px; color: var(--t); opacity: 0.9;
}

/* ── Editor ── */
/* ── Editor ao vivo ──
   Uma tela de desktop com os blocos da vitrine sendo reposicionados por um
   ponteiro, em laço. As posições e o caminho do ponteiro são calculados em
   editorCSS(), a partir dos layouts declarados em EDITOR_PASSOS. */
.dl-ed {
  --ed-dur: 13.2s;                       /* 6 movimentos de 2,2 s */
  border-radius: 18px; padding: 14px; display: grid; gap: 12px;
}
.dl-ed__bar {
  display: flex; align-items: center; gap: 6px;
  padding: 2px 4px 11px; border-bottom: 1px solid var(--line-soft);
}
.dl-ed__url { margin-left: 10px; color: var(--placeholder); font-size: 9px; }

/* Aviso de salvo, encostado à direita da barra e no mesmo corpo da URL.
   Um pulso por movimento: a duração é uma fatia da linha do tempo, e o pico
   cai logo depois de EDITOR_SOLTA, quando o bloco assenta no destino. */
.dl-ed__salvo {
  margin-left: auto; display: inline-flex; align-items: center; gap: 6px;
  font-size: 9px; color: var(--mint); white-space: nowrap;
  animation: edSalvo calc(var(--ed-dur) / 6) ease-out infinite both;
}
.dl-ed__ponto {
  width: 6px; height: 6px; border-radius: 999px; flex: 0 0 auto;
  background: var(--mint); box-shadow: 0 0 7px rgba(20,184,166,0.85);
}
@keyframes edSalvo {
  0%, 70% { opacity: 0; transform: translateY(3px); }
  78%, 92% { opacity: 1; transform: none; }
  100% { opacity: 0; transform: none; }
}
.dl-ed__tela {
  position: relative; aspect-ratio: 4 / 3.15; border-radius: 12px; overflow: hidden;
  background: rgba(0,0,0,0.34); border: 1px solid var(--line-soft);
}
/* Caixa interna: os blocos são absolutos e a porcentagem deles corre sobre a
   caixa de padding do pai — sem esta camada, o respiro das bordas sumiria. */
.dl-ed__area { position: absolute; inset: 13px; }
/* Mesmo acabamento das miniaturas do mockup do hero, sem texto: aqui o bloco
   é só volume. A borda nasce transparente só para o realce de "no ar" ter o
   que colorir sem mudar o tamanho da caixa. */
/* Cada bloco é um <button> — ele responde ao toque e abre a explicação.

   ATENÇÃO ao peso desta regra: ela precisa continuar valendo UMA classe. As
   posições e o animation-name de cada bloco saem de editorCSS(), que também
   escreve seletores de uma classe (.dl-ed__bloco--header e companhia) e conta
   com a ordem para vencer. Prefixar isto com .dl-root subiria o peso e mataria
   os dois: os blocos perderiam a animação e encolheriam até o tamanho do
   conteúdo. Foi o que aconteceu na primeira tentativa.

   O que o button traz de fábrica do styles.css (largura cheia, respiro, raio,
   fundo roxo) já perde para as regras de uma classe daqui — só os estados
   interativos precisam de desmontagem à parte, logo abaixo. */
.dl-ed__bloco {
  position: absolute;
  border-radius: 6px; border: 1px solid transparent;
  background: linear-gradient(135deg, rgba(99,102,241,0.55), rgba(212,175,55,0.35));
  animation: var(--ed-dur) linear infinite both;
  /* Só transform e opacity entram na transição: left/top/width/height pertencem
     à animação, e transição não age sobre propriedade que uma animação está
     dirigindo — declará-las aqui seria enfeite morto. Quem cuida do tempo da
     abertura e do fechamento é o JS (EDITOR_SAIDA). */
  transition: transform 0.5s var(--ease-out), opacity 0.3s ease;
}
/* button:hover global desloca o elemento e o pinta de roxo; aqui ele só clareia
   um pouco, sem sair do lugar. */
.dl-root .dl-ed__bloco:hover {
  background: linear-gradient(135deg, rgba(99,102,241,0.72), rgba(212,175,55,0.48));
  transform: none;
}
.dl-root .dl-ed__bloco:active { scale: 1; }
.dl-root .dl-ed__bloco:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }

/* ── Bloco aberto ──
   O !important existe porque quem manda na geometria do bloco é a animação, e
   animação vence declaração comum na cascata — só um !important passa na
   frente dela. É o que permite abrir o bloco sem tirar a animação do ar: ela
   continua lá, pausada, guardando a posição para quando a explicação fechar. */
.dl-root .dl-ed__bloco.is-aberto {
  left: 3% !important; top: 4% !important;
  width: 94% !important; height: 92% !important;
  z-index: 9 !important;
  border-color: rgba(255,255,255,0.34);
  box-shadow: 0 24px 50px -18px rgba(0,0,0,0.9);
  /* Fundo OPACO: o degradê dos blocos é translúcido, e aberto sobre os outros
     cinco ele deixava as silhuetas de trás atravessarem o texto. A camada
     sólida embaixo resolve, e o degradê fica só como cor da casa. */
  background: linear-gradient(135deg, rgba(99,102,241,0.5), rgba(212,175,55,0.26)), #101018;
  cursor: default;
}
/* Os outros são empurrados para fora da tela do editor pela borda mais próxima
   — a rota de cada um é calculada no clique e chega aqui em --fuga-x/--fuga-y.
   O recorte da moldura faz o resto: eles saem de cena, não ficam por baixo. Ao
   fechar, a classe cai e o transform volta a zero, então eles entram de novo
   pelo mesmo caminho. */
.dl-ed.is-parado .dl-ed__bloco:not(.is-aberto) {
  transform: translate(var(--fuga-x, 0px), var(--fuga-y, 0px));
  opacity: 0.5;
}
/* ── O desenho ao abrir ──
   Antes as silhuetas eram apagadas e o bloco aberto ficava só com o texto — logo
   ele, que é o único lugar da demonstração onde dá tempo de olhar o desenho com
   calma. Agora o miolo recua para a faixa de baixo e vira a ilustração do que o
   texto está explicando: quem lê "grade de imóveis" vê a grade de imóveis ali
   embaixo, maior do que ela jamais aparece no laço.

   A geometria é sempre numérica (top/height em %, e não inset zerado) porque é
   o que permite transicionar: de "auto" para 38% não há percurso nenhum. */
.dl-ed__bloco.is-aberto .dl-ed__miolo {
  top: 62%; height: 38%; opacity: 0.66;
  border-top: 1px solid rgba(255,255,255,0.12);
}

.dl-ed__info {
  position: absolute; inset: 0; z-index: 1;
  display: flex; flex-direction: column; justify-content: center; gap: 8px;
  padding: clamp(14px, 4%, 26px); text-align: left;
  opacity: 0; pointer-events: none;
  /* Sumir é rápido e sem espera: o texto tem de ter ido embora ANTES de o bloco
     começar a encolher (a espera correspondente está no .dl-ed__bloco). */
  transition: opacity 0.18s ease;
}
/* Cede a faixa de baixo para o desenho e se centra no que sobra. */
.dl-ed__bloco.is-aberto .dl-ed__info { bottom: 38%; }
/* Aparecer é o contrário: espera o bloco crescer para então escrever nele. */
.dl-ed__bloco.is-aberto .dl-ed__info { opacity: 1; transition: opacity 0.26s ease 0.22s; }
/* Primeiro tempo do fechamento: o bloco ainda está aberto, e só o texto sai. O
   segundo tempo (o bloco voltar ao laço) espera este fade terminar — quem
   segura é o EDITOR_SAIDA, no JS. */
.dl-ed.is-saindo .dl-ed__bloco.is-aberto .dl-ed__info { opacity: 0; transition: opacity 0.16s ease; }
.dl-ed__info b {
  font-size: clamp(14px, 3.4vw, 19px); font-weight: 700; letter-spacing: -0.02em; color: #fff;
}
/* Mesma cor do texto de apoio da página (--subtle, a do .dl-lead): a descrição
   aqui cumpre o mesmo papel que o parágrafo ao lado do mock, e não faz sentido
   ela ter um tom só dela. O nome do bloco continua em branco — ele é título. */
.dl-ed__info em {
  font-style: normal; font-size: clamp(11.5px, 2.6vw, 14px); line-height: 1.62;
  color: var(--subtle); max-width: 46ch;
}

/* ── Miolo dos blocos ──
   Silhuetas de uma cor só, sem texto, insinuando o que cada bloco é — mesma
   ideia das linhas do mockup do hero. Como os blocos mudam de tamanho o tempo
   todo (linha inteira ou meia linha), o arranjo é sempre proporcional.

   Duas camadas de contraste: a silhueta que tem PEÇAS dentro (um cartão, um
   painel) recua para superfície e quem desenha são as peças. Sem esse recuo o
   cartão seria uma mancha clara, e o que estivesse dentro dele desapareceria no
   próprio fundo.

   Todos os seletores daqui para baixo passam por .dl-ed__miolo de propósito: o
   peso de duas classes deixa as regras de tipo (i, span) fora de qualquer
   disputa com o que editorCSS() escreve nos blocos, que é geometria. */
.dl-ed__miolo {
  position: absolute; left: 0; right: 0; top: 0; height: 100%;
  transition: top 0.42s var(--ease-out), height 0.42s var(--ease-out), opacity 0.3s ease;
}
.dl-ed__miolo i { display: block; border-radius: 3px; background: rgba(255,255,255,0.125); }
.dl-ed__miolo span { display: block; border-radius: 999px; background: rgba(255,255,255,0.30); }

/* Cabeçalho: marca à esquerda, menu empurrado para a direita pelo margin auto. */
.dl-ed__bloco--header .dl-ed__miolo {
  display: flex; align-items: center; gap: 6px; padding: 0 9px;
}
.dl-ed__bloco--header .dl-ed__miolo i { width: 15px; height: 4px; border-radius: 999px; }
.dl-ed__bloco--header .dl-ed__miolo i:first-child {
  width: 13px; height: 13px; border-radius: 4px; margin-right: auto;
}

/* Título: sobretítulo curto, a chamada e a linha de apoio — a abertura da
   página, na mesma hierarquia com que ela aparece na vitrine. */
.dl-ed__bloco--titulo .dl-ed__miolo {
  display: flex; flex-direction: column; justify-content: center; gap: 5px; padding: 0 11px;
}
.dl-ed__bloco--titulo .dl-ed__miolo i { width: 52%; height: 6px; border-radius: 999px; }
.dl-ed__bloco--titulo .dl-ed__miolo i:first-child { width: 16%; height: 3px; opacity: 0.6; }
.dl-ed__bloco--titulo .dl-ed__miolo i:last-child { width: 30%; height: 4px; opacity: 0.72; }

/* Destaques: três cartões, cada um com um selo e duas linhas. */
.dl-ed__bloco--destaques .dl-ed__miolo {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; padding: 7px;
}
.dl-ed__bloco--destaques .dl-ed__miolo i {
  border-radius: 5px; background: rgba(255,255,255,0.09);
  display: flex; flex-direction: column; justify-content: center; gap: 4px; padding: 6px;
}
.dl-ed__bloco--destaques .dl-ed__miolo span { width: 78%; height: 3px; }
.dl-ed__bloco--destaques .dl-ed__miolo span:first-child {
  width: 9px; height: 9px; border-radius: 3px; margin-bottom: 2px;
}
.dl-ed__bloco--destaques .dl-ed__miolo span:last-child { width: 48%; opacity: 0.7; }

/* Imóveis: a grade da vitrine. Cada cartão tem a foto e a legenda embaixo — é a
   silhueta que mais precisava de miolo, porque "grade de retângulos" é o que
   qualquer bloco parece de longe. */
.dl-ed__bloco--imoveis .dl-ed__miolo {
  display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, 1fr);
  gap: 5px; padding: 6px;
}
.dl-ed__bloco--imoveis .dl-ed__miolo i {
  border-radius: 4px; background: rgba(255,255,255,0.09);
  display: flex; flex-direction: column; gap: 3px; padding: 3px; min-height: 0;
}
.dl-ed__bloco--imoveis .dl-ed__miolo span:first-child {
  flex: 1; min-height: 5px; border-radius: 3px;
}
.dl-ed__bloco--imoveis .dl-ed__miolo span:last-child { flex: 0 0 auto; width: 66%; height: 3px; }

/* Widgets: painéis livres. O botão é a peça que faz o painel virar convite, e
   não mais um bloco de texto qualquer. */
.dl-ed__bloco--widgets .dl-ed__miolo {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 7px; padding: 7px;
}
.dl-ed__bloco--widgets .dl-ed__miolo i {
  border-radius: 5px; background: rgba(255,255,255,0.09);
  display: flex; flex-direction: column; justify-content: center; gap: 4px; padding: 7px;
}
.dl-ed__bloco--widgets .dl-ed__miolo span { width: 82%; height: 3px; }
.dl-ed__bloco--widgets .dl-ed__miolo span:nth-child(2) { width: 58%; opacity: 0.7; }
.dl-ed__bloco--widgets .dl-ed__miolo span:last-child {
  width: 30px; max-width: 62%; height: 7px; margin-top: 3px;
  background: rgba(255,255,255,0.42);
}

/* Rodapé: a régua que fecha a página e, embaixo dela, os links. A régua é o que
   o separa do cabeçalho — sem ela os dois eram a mesma fila de pílulas. */
.dl-ed__bloco--rodape .dl-ed__miolo {
  display: flex; flex-wrap: wrap; justify-content: center;
  align-items: center; align-content: center; gap: 6px; padding: 0 10px;
}
.dl-ed__bloco--rodape .dl-ed__miolo i { width: 20px; height: 4px; border-radius: 999px; }
.dl-ed__bloco--rodape .dl-ed__miolo i:first-child {
  flex: 0 0 100%; width: auto; height: 1px;
  border-radius: 0; opacity: 0.5; margin-bottom: 3px;
}

/* Ponteiro desenhado em CSS: um losango com a ponta no canto superior
   esquerdo, que é o ponto que a animação leva até o centro do bloco. */
.dl-ed__ponteiro {
  position: absolute;
  width: 15px;
  height: 21px;
  z-index: 5;
  pointer-events: none;
  transform-origin: 0 0;
  filter: drop-shadow(1px 0 0 #ffffff) drop-shadow(-1px 0 0 #ffffff) drop-shadow(0 1px 0 #ffffff) drop-shadow(0 -1px 0 #ffffff) drop-shadow(0 3px 6px rgba(0,0,0,0.6));
  animation: edPonteiro var(--ed-dur) linear infinite both;
}

.dl-ed__ponteiro::before {
  content: "";
  position: absolute;
  inset: 0;
  background: #000000;
  clip-path: polygon(0 0, 0 76%, 27% 59%, 47% 100%, 66% 91%, 46% 51%, 74% 48%);
}
/* Anel do clique: um pulso por movimento, por isso a duração é a fatia. */
.dl-ed__ponteiro::after {
  content: ""; position: absolute; left: -9px; top: -9px; width: 22px; height: 22px;
  border-radius: 999px; border: 1.5px solid rgba(129,140,248,0.9);
  animation: edClique calc(var(--ed-dur) / 6) ease-out infinite both;
}
@keyframes edClique {
  0%, 26% { opacity: 0; scale: 0.4; }
  32% { opacity: 0.95; scale: 0.6; }
  52% { opacity: 0; scale: 1.5; }
  100% { opacity: 0; scale: 1.5; }
}
.dl-ed__legenda { margin: 0; }

/* Fase única. As quatro animações do mock — blocos, ponteiro, anel do clique e
   aviso de salvo — são independentes e só se encaixam se partirem no mesmo
   instante: cada uma começa a contar no quadro em que nasce. Num primeiro
   carregamento ocupado (splash de abertura, névoa em WebGL, fontes) elas não
   nascem no mesmo quadro, e o desencontro fica para sempre — o ponteiro passa a
   arrastar o vazio. Num F5, com a página em cache e sem splash, o quadro é o
   mesmo para todas e o problema não aparece.
   Presas em pausa até o bloco entrar em cena, todas soltam no mesmo recálculo de
   estilo, num momento calmo — e a demonstração ainda começa sempre do princípio,
   em vez de a pessoa pegar o laço no meio.

   A mesma pausa serve ao bloco aberto (.is-parado): a cena congela enquanto
   alguém lê, e soltar a pausa retoma o movimento no ponto em que ele estava —
   animation-play-state guarda a posição na linha do tempo. */
.dl-ed:not(.is-visible) .dl-ed__bloco,
.dl-ed:not(.is-visible) .dl-ed__ponteiro,
.dl-ed:not(.is-visible) .dl-ed__ponteiro::after,
.dl-ed:not(.is-visible) .dl-ed__salvo,
.dl-ed.is-parado .dl-ed__bloco,
.dl-ed.is-parado .dl-ed__ponteiro,
.dl-ed.is-parado .dl-ed__ponteiro::after,
.dl-ed.is-parado .dl-ed__salvo {
  animation-play-state: paused;
}
/* Com a cena congelada o ponteiro desenhado sai de cena: ele fica no meio de um
   arrasto que não termina, e por cima do bloco aberto vira sujeira. */
.dl-ed.is-parado .dl-ed__ponteiro { opacity: 0; transition: opacity 0.25s ease; }

/* Posições de partida + keyframes dos blocos e do ponteiro, calculados. */
${editorCSS()}

/* O marcador rolando dentro do bloco de métrica. O baseline alinha o prefixo
   ("+") e o sufixo ("%") com os algarismos; a caixa do Counter tem overflow
   escondido, então ela precisa herdar o tamanho para o recorte cair na altura
   certa da linha. */
.dl-stat__roll {
  display: inline-flex;
  align-items: baseline;
  font-size: inherit;
  font-weight: inherit;
  letter-spacing: inherit;
}

/* ── Destaques: parede à deriva no fundo da seção ──
   A seção é o palco e a parede é a camada de trás. Altura mínima porque a
   parede precisa de espaço vertical para a perspectiva fazer sentido — só com
   o título dentro, a seção teria uns 200px e a parede sairia achatada. */
.dl-porque {
  position: relative;
  isolation: isolate;
  min-height: clamp(520px, 62vh, 720px);
  display: flex;
  align-items: center;
  overflow: hidden;
}
/* A parede só existe enquanto a seção é a que se está vendo.

   Ela pausava fora da tela (o DriftWall tem o próprio observador), mas seguia
   desenhada: ao rolar, as peças apareciam paradas na beirada da seção vizinha,
   o que denuncia o truque e polui as seções de cima e de baixo. Agora ela some
   por completo, e volta com uma transição — não com um estalo. */
.dl-porque__fundo {
  position: absolute;
  inset: 0;
  z-index: 0;
  opacity: 0;
  transition: opacity 0.55s var(--ease-out, ease);
  /* Não recebe clique nem seleção: quem manda na frente é o texto da seção. */
  pointer-events: none;
}
/* Véu radial entre a parede e o texto. Sem ele o título disputa contorno com os
   cartões que passam atrás — e o que se perde é sempre a leitura do título, que
   é a única coisa ali que precisa ser lida.

   Concentrado no miolo e fraco nas pontas: é no centro que o texto está, e
   escurecer as bordas junto apagaria justamente a parte da parede que numa tela
   grande é a que tem espaço para aparecer. */
.dl-porque__fundo::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
  background: radial-gradient(
    ellipse 58% 62% at 50% 50%,
    rgba(10, 10, 11, 0.93) 0%,
    rgba(10, 10, 11, 0.78) 38%,
    rgba(10, 10, 11, 0.28) 66%,
    rgba(10, 10, 11, 0) 84%
  );
  /* Some junto com o cabeçalho: o véu existe para o texto ser lido, e sem texto
     ele só estaria escondendo a parede que a pessoa foi olhar. */
  transition: opacity 0.45s var(--ease-out, ease);
}
.dl-porque:hover .dl-porque__fundo::after { opacity: 0.35; }
/* Ligada pelo observador da seção (ver ParedeDeDestaques). */
.dl-porque__fundo.is-na-vista { opacity: 1; }

/* O cabeçalho recua no hover para a parede virar o assunto.

   O pointer-events desligado é o que faz o clique atravessar e chegar às peças —
   sem isso o título continuaria interceptando os cliques no meio da seção,
   justamente onde ele está. */
.dl-porque__frente {
  position: relative;
  z-index: 1;
  width: 100%;
  transition: opacity 0.45s var(--ease-out, ease), filter 0.45s var(--ease-out, ease);
}
.dl-porque:hover .dl-porque__frente {
  opacity: 0.14;
  /* Borrado além de apagado: só a opacidade deixava o texto legível por baixo
     dos cartões e as duas camadas brigavam. Desfocado ele vira atmosfera. */
  filter: blur(6px);
  pointer-events: none;
}

/* Lista de acesso: existe para leitor de tela e teclado, não para os olhos.
   Não usa display:none porque isso a tiraria dos dois também. */
.dl-porque__lista {
  position: absolute;
  width: 1px; height: 1px;
  margin: -1px; padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
/* Ao receber foco por teclado ela reaparece, no lugar do cabeçalho. */
.dl-porque__lista:focus-within {
  position: relative;
  width: auto; height: auto;
  margin: 0; overflow: visible; clip-path: none; white-space: normal;
  z-index: 3;
  display: flex; flex-wrap: wrap; gap: 8px;
  justify-content: center; padding: 12px;
}
.dl-porque__lista button {
  background: var(--surface); color: var(--strong);
  border: 1px solid var(--line); border-radius: 999px;
  padding: 8px 14px; font-size: 13px; cursor: pointer;
}

/* Painel do detalhe */
.dl-porque__painel {
  position: absolute; inset: 0; z-index: 4;
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
/* Fundo do modal.

   Era um <button> e saía pintado de roxo: a landing tem estilo global de botão,
   e um botão sem texto no meio da tela herdava a cor de ação. Virou div com
   clique — as saídas acessíveis (o botão "Fechar" e o Esc) já existem dentro do
   painel, então nada se perde.

   O desfoque é o que separa o painel do movimento atrás dele: sem ele a parede
   continua andando nítida ao lado do texto que a pessoa parou para ler. */
.dl-porque__saida {
  position: absolute; inset: 0;
  background: rgba(10, 10, 11, 0.55);
  backdrop-filter: blur(14px) saturate(0.9);
  -webkit-backdrop-filter: blur(14px) saturate(0.9);
  cursor: pointer;
}
.dl-porque__caixa {
  position: relative;
  max-width: 520px; width: 100%;
  padding: 26px 28px;
  border-radius: 20px;
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: 0 30px 80px -24px rgba(0, 0, 0, 0.8);
  display: flex; flex-direction: column; gap: 12px;
}
.dl-porque__tag {
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 11px; letter-spacing: 0.12em;
  color: var(--accent-soft);
}
.dl-porque__caixa h3 { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; color: var(--strong); }
.dl-porque__caixa p { font-size: 14px; line-height: 1.75; color: var(--subtle); }
/* Virou um Button (variante ghost), então preenchimento, borda e cor vêm do
   vidro especular. O que sobra aqui é o encaixe dele no painel. */
.dl-root .dl-porque__fechar {
  align-self: flex-start; margin-top: 4px;
  padding: 8px 16px; font-size: 13px;
}

.dl-fcard {
  flex: 0 0 auto; width: 268px; min-height: 168px; padding: 22px 24px;
  border-radius: 18px; background: var(--surface); border: 1px solid var(--line);
  display: flex; flex-direction: column; gap: 9px;
}
/* Dentro da parede quem manda no tamanho é a peça: o cartão larga a largura
   fixa e preenche o que receber. */
.dl-fcard--parede {
  width: 100%; height: 100%; min-height: 0;
  padding: 18px 20px; border-radius: inherit;
  overflow: hidden;
}
/* ── O cartao de relato ────────────────────────────────────────────────────
   Quem fala em cima (avatar, nome, cargo e imobiliaria), a frase no meio e a
   cidade embaixo, colada no pe. Nos cartoes de tom (mint, gold, accent, rose)
   as cores vem do proprio tom, por currentColor — por isso nada aqui escreve
   uma cor de texto fixa alem da do cartao neutro.
   (Sem crases nestes comentarios: template literal.) */
.dl-relato { gap: 10px; }
.dl-relato__quem { display: flex; align-items: center; gap: 10px; min-width: 0; }
.dl-relato__foto {
  width: 40px; height: 40px; border-radius: 50%; flex: none; object-fit: cover;
  display: inline-flex; align-items: center; justify-content: center;
}
.dl-relato__foto--iniciais {
  background: var(--avatar); color: #fff;
  font-size: 13px; font-weight: 700; letter-spacing: 0.02em;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.18);
}
.dl-relato__nome { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dl-relato__nome strong { font-size: 13.5px; font-weight: 700; letter-spacing: -0.01em; color: var(--strong); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dl-relato__nome span { font-size: 11px; line-height: 1.4; color: var(--subtle); opacity: 0.9; }
.dl-relato__frase { font-size: 13px; line-height: 1.6; color: var(--subtle); margin: 0; }
.dl-relato__onde {
  margin-top: auto; font-family: var(--mono, ui-monospace, monospace);
  font-size: 9.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--placeholder);
}
/* Nos cartoes de tom o texto e escuro (ou branco, no accent) — herda. */
.dl-fcard--mint .dl-relato__nome strong, .dl-fcard--gold .dl-relato__nome strong, .dl-fcard--accent .dl-relato__nome strong, .dl-fcard--rose .dl-relato__nome strong,
.dl-fcard--mint .dl-relato__frase, .dl-fcard--gold .dl-relato__frase, .dl-fcard--accent .dl-relato__frase, .dl-fcard--rose .dl-relato__frase { color: inherit; }
.dl-fcard--mint .dl-relato__nome span, .dl-fcard--gold .dl-relato__nome span, .dl-fcard--accent .dl-relato__nome span, .dl-fcard--rose .dl-relato__nome span,
.dl-fcard--mint .dl-relato__onde, .dl-fcard--gold .dl-relato__onde, .dl-fcard--accent .dl-relato__onde, .dl-fcard--rose .dl-relato__onde { color: inherit; opacity: 0.72; }
/* No painel o mesmo bloco de "quem", maior. */
.dl-relato__quem--painel { margin: 6px 0 4px; }
.dl-relato__quem--painel .dl-relato__foto { width: 52px; height: 52px; font-size: 16px; }
.dl-relato__quem--painel h3 { margin: 0; }
.dl-relato__quem--painel span { font-size: 12.5px; }
.dl-fcard--mint { background: #a7f3d0; border-color: #a7f3d0; color: #052e21; }
.dl-fcard--gold { background: #fde68a; border-color: #fde68a; color: #3b2f05; }
.dl-fcard--accent { background: var(--accent); border-color: var(--accent); color: #fff; }
/* O tom do Omnimob Flow. Pastel como o mint e o gold, e nao o rosa cheio da
   marca: os cartoes de estatistica da parede sao superficie com texto escuro em
   cima, e o acento #ec0b5b nessa funcao vira um bloco vibrante que rouba a
   leitura do titulo da secao — que e o unico texto que a parede tem atras. */
.dl-fcard--rose { background: #fbcfe8; border-color: #fbcfe8; color: #500724; }

/* ── Planos ── */
/* ── PLANOS ──────────────────────────────────────────────────────────────────
   Referência: dribbble.com/shots/26870248 (SaaS Pricing Section). Cabeçalho à
   esquerda, uma MANCHA DE LUZ — branco no miolo, índigo em volta, desfocada —
   no canto da seção e outra no alto de cada cartão, em posição própria. O
   índigo é o --accent da página, então a seção usa os tokens dela em vez de
   uma paleta só sua.

   Sao DUAS manchas, e duas classes independentes de proposito — cada uma
   carrega todas as suas propriedades, e mexer numa nao muda a outra:

     .pl-bolha-canto   a da secao, sangrando pelo canto de cima a direita
     .pl-bolha-cards   a dos cartoes: o que parece uma mancha por cartao e UM
                       clarao so, atravessando os tres (o Basico mostra a
                       cauda esquerda, o Profissional o miolo, o Premium a
                       cauda direita). Como um elemento nao pode ser recortado
                       por tres irmaos, cada cartao desenha a MESMA elipse,
                       deslocada para o centro cair sempre no meio do cartao
                       do meio — --1 empurra um cartao e um vao para a
                       direita, --3 o mesmo para a esquerda. O overflow de
                       cada cartao faz o recorte.

   (Sem crases neste comentario — este CSS mora dentro de um template literal.) */
.pl-secao {
  position: relative; isolation: isolate;
  overflow: hidden;
  border-radius: 20px;
  padding: clamp(28px, 4vw, 56px) clamp(20px, 3.5vw, 48px) clamp(24px, 3.5vw, 44px);
  background: #0e0e10;
  border: 1px solid rgba(255,255,255,0.06);
}
/* ── A mancha do CANTO da seção ──
   Estourada de proposito: o miolo branco vai ate quase um terco do raio, o
   azul em volta chega cheio ate 60% — so dai ele apaga, e rapido. O desfoque
   e curto: blur longo e o que fazia a mancha parecer nevoa em vez de luz.
   O deslocamento para cima e em translate, e nao em top negativo: top em
   porcentagem mede a ALTURA do dono, e a mancha saia inteira pelo recorte;
   translate mede a propria mancha. */
/* O svg dos filtros nao desenha nada; so precisa existir no DOM. */
.pl-filtros { position: absolute; width: 0; height: 0; overflow: hidden; }
.pl-bolha-canto {
  position: absolute; z-index: 0; pointer-events: none;
  width: clamp(520px, 54vw, 780px);
  aspect-ratio: 1; border-radius: 50%;
  right: -35%; top: 0; transform: translateY(-70%);
  /* Quatro camadas: o miolo branco, o corpo azul, e dois LOBOS azuis menores
     — sao eles que dao as bossas que o filtro depois amassa. Cada
     radial-gradient e "tamanho at posicao".
     ATENCAO as posicoes: com right -30% e translateY(-60%), o que aparece
     deste elemento e so o quadrante de BAIXO e a ESQUERDA (x de 0 a ~60%,
     y de 60% a 100%). Miolo fora dessa janela e miolo invisivel. */
  background:
    radial-gradient(40% 36% at 44% 68%, #ffffff 0%, #ffffff 34%, #dcdcff 52%, transparent 76%),
    radial-gradient(74% 70% at 46% 64%, #d9d6ff 0%, #4b3bff 38%, color-mix(in srgb, #3617a7 55%, transparent) 66%, transparent 84%),
    radial-gradient(34% 28% at 14% 82%, #4b3bff 0%, color-mix(in srgb, #3617a7 55%, transparent) 50%, transparent 78%),
    radial-gradient(30% 26% at 66% 94%, #4b3bff 0%, color-mix(in srgb, #3617a7 55%, transparent) 50%, transparent 78%);
  /* Primeiro amassa (o filtro SVG la do JSX), depois desfoca. */
  filter: url(#pl-deforma-canto) blur(14px);
}
.pl-cabeca {
  position: relative; z-index: 1;
  display: flex; flex-direction: column; align-items: flex-start; gap: 14px;
  max-width: 560px;
  margin-bottom: clamp(30px, 4vw, 44px);
}
.pl-titulo {
  margin: 0;
  font-size: clamp(32px, 4vw, 46px); line-height: 1.08;
  font-weight: 600; letter-spacing: -0.03em;
  color: #fff;
}
.pl-sub { margin: 0; font-size: 14px; line-height: 1.6; color: var(--subtle); }

/* ── Alternador mensal / anual: uma chave entre dois rótulos ── */
.pl-periodo {
  display: inline-flex; align-items: center; gap: 12px;
  margin-top: 6px;
  font-size: 13px; color: var(--subtle);
}
.dl-root .pl-periodo__rotulo {
  width: auto; padding: 0; border: 0; border-radius: 0;
  background: none; box-shadow: none; transform: none;
  font: inherit; color: inherit; cursor: pointer;
  transition: color 0.25s ease;
}
.dl-root .pl-periodo__rotulo:hover { background: none; transform: none; color: var(--strong); }
.pl-periodo__rotulo.is-on { color: var(--strong); }
.pl-periodo__selo { color: inherit; }
.dl-root .pl-periodo__chave {
  position: relative; width: 36px; height: 20px; padding: 0;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.12);
  background: #1c1c22;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.5);
  cursor: pointer; transform: none;
}
.dl-root .pl-periodo__chave:hover { transform: none; background: #24242c; }
.pl-periodo__chave::after {
  content: "";
  position: absolute; top: 2px; left: 2px;
  width: 14px; height: 14px; border-radius: 50%;
  background: linear-gradient(180deg, #c7c9ff, var(--accent));
  box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 75%, transparent);
  transition: transform 0.3s var(--ease-out);
}
.pl-periodo__chave[aria-checked="true"]::after { transform: translateX(16px); }

/* ── Os cartões ── */
.pl-caixa { position: relative; z-index: 1; }
.pl-cartoes {
  /* O vão entra na conta do clarão (ver .pl-bolha-cards), por isso é
     variável e não só o gap. */
  --pl-vao: 14px;
  display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--pl-vao);
  align-items: stretch;
}
.pl-cartao {
  position: relative; isolation: isolate; overflow: hidden;
  display: flex; flex-direction: column;
  padding: 26px 22px 22px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.08);
  background: #131316;
  color: var(--default);
}
/* O conteúdo do cartão fica acima da mancha. */
.pl-cartao > :not(.pl-bolha-cards) { position: relative; z-index: 1; }
/* ── A mancha dos CARTÕES ──
   Uma elipse de 2,4 cartões de largura, com o centro no meio do cartão do
   meio. As três regras --1/--2/--3 são o mesmo ponto medido a partir de cada
   cartão (os três têm a mesma largura, então a porcentagem bate). O translate
   sobe a elipse até só a metade de baixo aparecer. Cor, forma e desfoque são
   independentes da mancha do canto. */
.pl-bolha-cards {
  position: absolute; z-index: 0; pointer-events: none;
  width: 300%; aspect-ratio: 2.1 / 1; border-radius: 50%;
  top: 0; transform: translate(-50%, -70%);
  /* TRES cores, e so tres, como na referencia: branco, um lilas bem claro e
     um azul eletrico estourado — em FAIXAS, nao em degrade longo. Cada cor
     entra e sai em poucos pontos percentuais (branco ate 20, lilas de 26 a
     36, azul de 44 a 70) e o blur de 16px e o unico suavizador; e isso que
     da o aspecto de luz posterizada. As cores estao nas variaveis para trocar
     num lugar so. Com translateY(-60%), so os 40% de BAIXO do elemento
     aparecem — o topo do cartao esta em y = 60%; por isso o corpo esta em
     y = 54%: o branco fica so na borda de cima do cartao do meio e o nome
     do plano cai sobre o lilas, onde ainda se le. Os dois lobos
     das pontas sao so o azul, e caem nos cartoes das beiradas. */
  --pl-branco: #ffffff;
  --pl-lilas: #cfc8ff;
  --pl-azul: #2a17ff;
  background:
    radial-gradient(
      84% 62% at 50% 54%,
      var(--pl-branco) 0%, var(--pl-branco) 20%,
      var(--pl-lilas) 50%, var(--pl-lilas) 36%,
      var(--pl-azul) 60%, var(--pl-azul) 70%,
      color-mix(in srgb, var(--pl-azul) 55%, transparent) 80%,
      transparent 92%
    ),
    radial-gradient(28% 34% at 14% 84%, var(--pl-azul) 0%, var(--pl-azul) 40%, transparent 82%),
    radial-gradient(28% 34% at 86% 84%, var(--pl-azul) 0%, var(--pl-azul) 40%, transparent 82%);
  filter: url(#pl-deforma-cards) blur(16px);
  opacity: 70%;
}
.pl-bolha-cards--1 { left: calc(150% + var(--pl-vao)); }
.pl-bolha-cards--2 { left: 50%; }
.pl-bolha-cards--3 { left: calc(-50% - var(--pl-vao)); }

.pl-cartao__nome { margin: 0; font-size: 14px; font-weight: 500; color: var(--strong); }
.pl-cartao__desc { margin: 6px 0 0; font-size: 12.5px; line-height: 1.6; color: #dadada; }
.pl-cartao__preco { margin-top: 14px; display: flex; align-items: baseline; gap: 2px; flex-wrap: wrap; }
.pl-cartao__preco strong { font-size: 36px; font-weight: 500; letter-spacing: -0.04em; line-height: 1; color: #fff; }
.pl-cartao__preco span { font-size: 14px; color: var(--subtle); }
.pl-cartao__nota { margin: 6px 0 0; font-size: 11.5px; line-height: 1.5; color: var(--placeholder); display: block; }
/* A nota do anual é uma frase; reserva as linhas para as listas dos três
   cartões começarem na mesma altura. */
.pl-cartao__nota--longa { min-height: calc(4 * 1.5em); }
.pl-cartao__economia {
  align-self: flex-start; margin-top: 8px;
  font-size: 10.5px; font-weight: 600; letter-spacing: 0.02em;
  color: var(--accent-soft);
  padding: 3px 8px; border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--accent) 32%, transparent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  white-space: nowrap;
}
/* O interruptor do Flow, no cartão. */
.pl-flow { margin: 16px 0 0; }
.pl-flow .pkg-caixa {
  padding: 11px 12px; border-radius: 10px;
  border-color: transparent;
  background: rgba(255,255,255,0.04);
}
.pl-flow .pkg-caixa.is-on { border-color: color-mix(in srgb, var(--pkg-cor) 30%, transparent); }
.pl-flow .pkg-linha { gap: 10px; }
.pl-flow input.sw { font-size: 12px; }
.pl-flow .pkg-titulo { font-size: 12.5px; gap: 7px; }
.pl-flow .pkg-desc { font-size: 11px; line-height: 1.45; }

/* "Recursos" entre duas linhas. */
.pl-cartao__rotulo {
  display: flex; align-items: center; gap: 12px;
  margin: 24px 0 14px;
  font-size: 11px; color: var(--placeholder);
}
.pl-cartao__rotulo::before, .pl-cartao__rotulo::after {
  content: ""; flex: 1; height: 1px; background: rgba(255,255,255,0.09);
}
/* O painel guarda o respiro e o esticão; a lista, só o desenho das linhas. */
.pl-recursos { display: flex; flex-direction: column; flex: 1; margin: 0 0 26px; }
.pl-lista { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; flex: 1; align-content: start; }
.pl-lista li { display: flex; align-items: flex-start; gap: 9px; font-size: 12px; line-height: 1.5; color: var(--subtle); }
.pl-lista li > span:first-child {
  flex: 0 0 auto; display: inline-grid; place-items: center;
  width: 14px; height: calc(12px * 1.5);
  color: var(--default);
}
.pl-lista__texto { display: inline; }
.pl-lista li.is-off { color: var(--placeholder); }
.pl-lista li.is-off > span:first-child { color: #4a4a52; }
.pl-lista--resumo li.is-heranca { color: var(--strong); font-weight: 600; }
/* A etiqueta "Novo" ao lado do recurso. Só as linhas do Flow a carregam. */
.pl-novo {
  display: inline-block; vertical-align: 1px; margin-left: 6px;
  font-style: normal; font-size: 8.5px; font-weight: 600; letter-spacing: 0.04em; line-height: 1;
  color: var(--accent-soft);
  padding: 3px 5px; border-radius: 4px;
  border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

/* Os botões. Com .dl-root porque o styles.css global pinta todo <button> de
   roxo e o levanta no hover. Os dois são escuros; o do cartão em destaque é o
   mais claro — é só isso que o marca, como na referência. */
.dl-root .pl-btn {
  margin-top: auto; width: 100%;
  padding: 12px 16px; border-radius: 10px;
  font: inherit; font-size: 13.5px; font-weight: 600;
  color: var(--strong);
  cursor: pointer; transform: none;
  transition: background 0.25s ease, border-color 0.25s ease;
}
.dl-root .pl-btn--contorno {
  background: #18181c;
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
}
.dl-root .pl-btn--contorno:hover {
  transform: none;
  background: #1f1f24;
  border-color: rgba(255,255,255,0.18);
}
.dl-root .pl-btn--cheio {
  background: rgba(255,255,255,0.14);
  border: 1px solid rgba(255,255,255,0.2);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.18);
}
.dl-root .pl-btn--cheio:hover { transform: none; background: rgba(255,255,255,0.2); }
.dl-root .pl-btn:active { scale: 0.985; }

/* Os pontos do carrossel — só existem no DOM no celular. */
.pl-pontos { display: flex; justify-content: center; gap: 6px; margin-top: 6px; }
.dl-root .pl-ponto {
  width: 24px; height: 26px; padding: 0; border: 0; border-radius: 0;
  background: none; box-shadow: none; transform: none; cursor: pointer;
  display: grid; place-items: center;
}
.dl-root .pl-ponto:hover { background: none; box-shadow: none; transform: none; }
.pl-ponto::before {
  content: ""; width: 7px; height: 7px; border-radius: 999px;
  background: rgba(255,255,255,0.24);
  transition: width 0.35s var(--ease-out), background 0.35s ease;
}
.pl-ponto.is-on::before { width: 20px; background: var(--accent-soft); }

@media (max-width: 1024px) {
  .pl-secao { padding-left: 18px; padding-right: 18px; }
  .pl-bolha-canto { width: 380px; right: -20%; transform: translateY(-30%); }
}
@media (max-width: 640px) {
  .pl-secao { border-radius: 16px; }
  .pl-titulo { font-size: 30px; }
  /* Menor e mais para fora: na largura do celular ela cobria o subtitulo. */
  .pl-bolha-canto { width: 320px; right: -40%; transform: translateY(-58%); }
}

/* ── Esqueleto de carregamento ──────────────────────────────────────────────
   Uma barra com brilho passando, no lugar do que ainda não chegou. Herda a
   tipografia do elemento que substitui (por isso é aplicada NO próprio <strong>
   do preço, não num div à parte): assim a altura da linha é a mesma antes e
   depois, e a chegada do valor não empurra o cartão.

   A cor transparente esconde o espaço que dá corpo à linha; a largura mínima em
   ch faz a barra crescer junto com a fonte. */
.dl-esqueleto {
  position: relative;
  display: inline-block;
  color: transparent;
  user-select: none;
}
/* A barra visível vive numa pseudo-camada, centrada na linha. O elemento mantém
   a ALTURA do texto que substitui — é o que garante zero salto quando o preço
   chega —, mas o que se vê tem a espessura de uma linha escrita, e não a caixa
   de linha inteira (que num número de 34px é um bloco alto demais). */
.dl-esqueleto::before {
  content: "";
  position: absolute;
  left: 0; right: 0;
  top: 50%; transform: translateY(-50%);
  height: 62%;
  border-radius: 7px;
  background-color: color-mix(in srgb, var(--strong) 9%, transparent);
  background-image: linear-gradient(
    90deg,
    transparent 20%,
    color-mix(in srgb, var(--strong) 12%, transparent) 50%,
    transparent 80%
  );
  background-size: 200% 100%;
  background-repeat: no-repeat;
  animation: dlEsqueleto 1.4s ease-in-out infinite;
}
.dl-esqueleto--preco { min-width: 5.2ch; }
/* Largura explícita, não mínima: a nota é filha direta do cartão, que estica os
   filhos: com min-width a barra iria de ponta a ponta. */
.dl-esqueleto--nota { width: 16ch; }
.dl-esqueleto--nota::before { border-radius: 4px; height: 72%; }
@keyframes dlEsqueleto {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
/* Sem movimento, a barra vira um bloco parado — ainda diz "tem algo vindo aqui",
   que é o essencial. */
@media (prefers-reduced-motion: reduce) {
  .dl-esqueleto::before { animation: none; }
}

/* Texto só para leitor de tela: sai da página sem sair da árvore de
   acessibilidade. Um display none o tiraria das duas. */
.dl-so-leitor {
  position: absolute; width: 1px; height: 1px;
  margin: -1px; padding: 0; border: 0;
  overflow: hidden; clip-path: inset(50%); white-space: nowrap;
}

/* ══════════════════════════════════════════════════════════════════════════
   OS DOIS MODULOS — a secao que apresenta Hub e Flow
   ══════════════════════════════════════════════════════════════════════════

   Duas colunas de MESMA largura, e a simetria e o argumento: ela diz que sao
   dois produtos do mesmo tamanho, e nao um produto e um acessorio. Por isso
   1fr 1fr e nao um destaque maior para o Flow.

   Sem ilustracao e sem animacao de entrada alem do fade: esta secao fica entre
   duas que ja tem (o baralho de canais acima, o fundo em ondas dos planos
   abaixo), e uma terceira no meio cansa a rolagem.
   (SEM CRASES nestes comentarios: eles vivem dentro de um template literal.) */
/* ── A SECAO CLARA DO FLOW ───────────────────────────────────────────────────
   A pagina inteira e preta. Esta secao e branca, e e a unica — o contraste E o
   argumento: um modulo novo precisa ler como interrupcao, e nao como mais um
   bloco na rolagem.

   Os tokens sao redefinidos LOCALMENTE, e nao sobrescritos peca a peca. A folha
   toda desenha com --strong, --default, --subtle e --line; trocando os quatro
   aqui dentro, qualquer componente da pagina que caia nesta secao nasce legivel
   sem precisar de uma regra propria. Foi o contrario disso que fez a primeira
   tentativa virar uma lista de excecoes que envelhecia a cada peca nova.

   (Sem crases neste comentario — este CSS mora dentro de um template literal.) */
.dl-section--claro {
  --strong: #0a0a0b;
  --default: #33333a;
  --subtle: #55555f;
  --placeholder: #8a8a95;
  --line: rgba(10,10,11,0.12);
  background: #ffffff;
  color: var(--default);
  position: relative;
  overflow: hidden;
  /* A borda fina de cima sai: quem faz a fronteira agora e o rasgo. */
  border-top: 0;
}

/* ── O rasgo de papel ────────────────────────────────────────────────────────
   A secao clara entra na pagina escura como uma folha rasgada por cima dela,
   e nao como um retangulo branco. A imagem (public/ripped_paper.png, 4956x738)
   e transparente acima da borda rasgada e branca abaixo. So os 420 primeiros
   pixels dela se desenham: e onde a folha fecha de vez (as fibras do rasgo
   descem ate ~390, e cortar antes disso deixava o rasgo terminar numa reta).
   Dali para baixo a imagem e branco liso, e a propria secao ja e branca — o
   encontro dos dois nao tem emenda.

   Fica FORA da secao, e nao num ::before dela, porque a secao esconde o
   overflow para recortar as formas que giram, e recortaria o rasgo junto. E
   um irmao que sobe um pouco sobre a secao anterior com margem negativa —
   pouco: 3% da largura cabe dentro do respiro de baixo dela, e subir a faixa
   inteira cobria a ultima fila de cartoes das integracoes. A margem em
   porcentagem e relativa a LARGURA do pai, a mesma conta da altura
   (420/4956 e a proporcao da parte que se desenha).

   (Sem crases neste comentario — este CSS mora dentro de um template literal.) */
.dl-rasgo {
  position: relative;
  z-index: 2;
  pointer-events: none;
  width: 100%;
  aspect-ratio: 4956 / 430;
  margin-top: -3%;
  /* A altura e fracionaria (largura x 420/4956), e a ultima linha de pixels
     saia meio coberta: branco pela metade sobre o escuro e uma linha cinza na
     emenda. Com a faixa entrando 4px na secao, a borda fracionaria cai em
     branco sobre branco, onde nao existe. */
  margin-bottom: -4px;
  /* 102%, e nao 100%: as tres primeiras e as seis ultimas colunas da imagem
     sao transparentes, e na largura exata elas viravam uma fresta escura nas
     bordas da tela. Esticada 1% para cada lado, essas colunas caem fora. A
     altura desenhada sobe de 420 para 430 na mesma proporcao. */
  background: url(/ripped_paper.png) top center / 102% auto no-repeat;
}

/* O rasgo de BAIXO da mesma folha (public/ripped_paper_bottom.png, 4921x623):
   opaco em cima, rasgado da linha ~270 para baixo. Mesma mecanica espelhada —
   desenha os 370px de baixo, ancorados no fundo, entra 4px na secao clara
   (branco sobre branco, pela borda fracionaria) e desce 3% sobre a secao
   escura seguinte. As bordas laterais desta imagem sao opacas, entao 100% de
   largura basta. */
.dl-rasgo--baixo {
  aspect-ratio: 4921 / 370;
  margin-top: -4px;
  margin-bottom: -3%;
  background: url(/ripped_paper_bottom.png) bottom center / 100% auto no-repeat;
}
/* A secao logo depois herda a linha fina de cima de .dl-section; atraves da
   parte transparente do rasgo ela apareceria como uma reta. */
.dl-rasgo--baixo + .dl-section { border-top: 0; }

.dl-manifesto {
  position: relative;
  z-index: 1;
  width: min(1120px, calc(100% - clamp(24px, 6vw, 72px) * 2));
  margin: 0 auto;
}

/* ── As formas ───────────────────────────────────────────────────────────────
   Estas duas silhuetas sao a resposta a "falta desenho autoral". Nao sao
   ilustracao: sao geometria da marca, e e por isso que funcionam sem ninguem
   desenhar um boneco. Uma e a flor de doze lobulos, a outra e o par de meias
   luas — vetor puro, uma cor so, giro muito lento.

   O giro e lento de proposito (60s e 80s). Rapido o bastante para se perceber
   que mexe, lento o bastante para nunca disputar com a leitura: quem esta lendo
   a frase nao deve notar a forma, e quem levanta o olho encontra a pagina viva.

   Sangram para fora pelas quinas, e quem as recorta e o overflow escondido do
   pai. Recorte reto num arco le como corte de papel, e nao como falha. */
/* Só posição e tamanho: o giro, o recorte do ponteiro e a parada em
   prefers-reduced-motion vem da classe .omni-forma, no kit. */
.dl-manifesto__forma--a {
  top: clamp(-90px, -6vw, -40px);
  right: clamp(-70px, -4vw, -30px);
  width: clamp(150px, 17vw, 300px);
  height: clamp(150px, 17vw, 300px);
}
.dl-manifesto__forma--b {
  bottom: clamp(-110px, -7vw, -50px);
  left: clamp(-80px, -5vw, -36px);
  width: clamp(130px, 14vw, 240px);
  height: clamp(130px, 14vw, 240px);
}

/* A sobrancelha com o ponto — o mesmo par da Eyebrow da pagina, mas com o ponto
   ANTES do texto e sem o tracinho: aqui ela abre um bloco alinhado a esquerda
   que ja tem uma frase enorme embaixo, e o traco competiria com ela. */
.dl-manifesto__olho {
  display: inline-flex; align-items: center; gap: 9px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--subtle); font-weight: 500;
}
.dl-manifesto__olho i {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--flow);
}

.dl-manifesto__titulo {
  margin: 22px 0 0;
  font-size: clamp(32px, 4.6vw, 62px);
  line-height: 1.06;
  letter-spacing: -0.045em;
  font-weight: 800;
  color: var(--strong);
  max-width: 17ch;
}
/* O trecho em cor. Italico E colorido, como no manifesto que serviu de
   referencia: so a cor faz a palavra saltar sem dizer por que; a inclinacao diz
   que aquilo e a voz mudando, e nao um link. */
.dl-manifesto__titulo em {
  font-style: italic;
  color: var(--flow);
}

/* Duas colunas de leitura, e nao uma. Uma frase de 62px seguida de um paragrafo
   de largura inteira faz a pagina cair de um degrau alto demais; a coluna dupla
   segura o ritmo e ainda deixa a segunda metade — que e onde o Flow e
   explicado — comecar na altura do olho. */
.dl-manifesto__corpo {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: clamp(24px, 4vw, 64px);
  margin-top: clamp(32px, 4vw, 52px);
  max-width: 940px;
}
.dl-manifesto__corpo p {
  margin: 0 0 16px;
  font-size: 15px;
  line-height: 1.75;
  color: var(--default);
}
.dl-manifesto__corpo p:last-child { margin-bottom: 0; }
.dl-manifesto__corpo strong { color: var(--strong); font-weight: 600; }

.dl-manifesto__fecho {
  margin: clamp(34px, 4vw, 54px) 0 0;
  padding-top: clamp(26px, 3vw, 40px);
  border-top: 1px solid var(--line);
  max-width: 940px;
  font-size: clamp(19px, 2vw, 27px);
  line-height: 1.4;
  letter-spacing: -0.025em;
  color: var(--strong);
}
.dl-manifesto__fecho em {
  font-style: normal;
  color: var(--flow);
}

@media (max-width: 760px) {
  .dl-manifesto__corpo { grid-template-columns: 1fr; gap: 0; }
  .dl-manifesto__corpo > div { margin-top: 16px; }
  .dl-manifesto__titulo { max-width: none; }
}

/* ── AS ILUSTRACOES NA PAGINA ────────────────────────────────────────────────
   Onze pecas encomendadas, seis delas na landing. A regra que organiza todas:

     A ILUSTRACAO E COLUNA, NAO RODAPE DE COLUNA.

   A primeira versao punha cada desenho embaixo do texto da secao. Funcionava e
   lia como anexo — "aqui esta o assunto, e aqui um desenho sobre ele". Colocada
   AO LADO, a mesma peca vira a outra metade da frase: o texto explica, a cena
   mostra. Nada mudou de tamanho de arquivo; mudou de posicao na grade.

   Tres regras tecnicas valem para todas:

   1. LARGURA em clamp com teto em px, nunca 100%. Elas foram entregues no
      tamanho exato de exibicao — passar disso borra, porque sao PNG.
   2. object-fit: contain e height: auto, com width/height no HTML. Os dois
      atributos reservam a caixa antes de a imagem chegar; sem eles a secao pula
      quando ela carrega.
   3. Nenhuma sombra e nenhuma caixa atras. Sao desenhos recortados sobre preto;
      qualquer fundo denuncia o retangulo que nao deveria existir.

   E uma regra de composicao: a DIRECAO alterna entre as secoes. Desafio joga a
   arte para a direita, o Flow abre a direita e fecha pela esquerda, o aplicativo
   volta para a direita. E o que da ritmo — tudo do mesmo lado seria uma coluna
   de figurinhas.

   (Sem crases nestes comentarios: este CSS mora num template literal.) */

.dl-desafio__arte img,
.dl-manifesto__desenho,
.dl-manifesto__remate-img,
.dl-editor__desenho,
.dl-app-soon__visual img {
  display: block;
  height: auto;
  object-fit: contain;
}

/* ── 1 · O Desafio: texto explica, cena mostra ───────────────────────────────
   57/43. O texto leva a maior porque tem titulo, paragrafo, card de vidro e
   botao; a arte leva o resto e fica centrada nesse conjunto todo. */
.dl-desafio__grade {
  display: grid;
  /* 53/47. Era 1.32/1 (57/43): a coluna da arte ganhou espaco porque a peca
     precisava crescer, e crescer dentro de uma coluna estreita so aumentaria a
     margem transparente em volta dela. Quem manda no tamanho e a COLUNA; a
     largura da imagem so nao deixa passar do arquivo. */
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: clamp(22px, 3vw, 48px);
  align-items: center;
}
/* O SectionHead e uma grade de duas colunas (titulo | descricao). Dentro de uma
   coluna de 57% as duas ficam estreitas demais e o titulo quebra em quatro
   linhas. Aqui ele volta a ser uma coluna so. */
.dl-desafio__conteudo .dl-head {
  grid-template-columns: 1fr;
  gap: 16px;
  align-items: start;
  margin-bottom: 30px;
}
/* ── POR QUE ELA PARECIA PERDIDA ─────────────────────────────────────────────
   Nao era tamanho. A coluna da esquerda tem titulo de tres linhas, paragrafo,
   card de vidro e botao: uns 560px de altura. A arte tem 290px e estava CENTRADA
   nessa altura, com cerca de 135px de preto sobrando em cima e outros 135
   embaixo. Um objeto centrado num retangulo vazio, sem dividir borda nem linha
   com nada, le como ilha — e aumentar uma ilha so faz uma ilha maior.

   Duas ancoras resolvem, e nenhuma das duas e escala:

   1. ELA POUSA NO CHAO DA SECAO (align-self: end). O pe da arte passa a cair na
      mesma faixa do botao, e essa linha compartilhada e o que amarra as duas
      colunas. O vazio nao sumiu: juntou-se todo em cima, do lado oposto ao
      titulo, onde le como respiro em vez de sobra.

   2. ELA ENCOSTA NA BEIRADA DA TELA. Antes morria dentro da coluna de texto,
      onde nao havia borda nenhuma para segura-la. Passando da margem do
      container, ela ganha uma borda de verdade: a da janela.

   O avanco tem teto em px porque a folga lateral e (100vw - 1120) / 2 — a 1440
   sao 160px de sobra e os 52 cabem com folga; a 1200 a folga cai para 40 e o
   3vw cai junto para 36. Nunca passa da janela, entao nao cria rolagem. */
.dl-desafio__arte {
  align-self: end;
  translate: clamp(0px, 3vw, 52px) 0;
}
.dl-desafio__arte img {
  /* O arquivo tem 640px de largura: ate 560 ele ainda nao estica. */
  width: clamp(320px, 38vw, 560px);
  max-width: none;
  margin-left: auto;
}

/* ── 2 · Editor: apoio que aponta para o produto ─────────────────────────────
   A tela real do editor continua sendo a prova; esta peca e apoio. O que ela
   ganhou foi tamanho e DIRECAO: encostada na borda direita da coluna de texto,
   ela avanca alguns pixels para o vao e a figura, que esta encaixando um bloco,
   aponta para o editor de verdade ao lado. */
/* A peca que ENCOSTA no produto.

   A personagem esta encaixando um bloco numa pagina; o editor de verdade fica na
   coluna ao lado. Empurrando o desenho para dentro do vao e subindo alguns
   pixels, o bloco que ela segura chega perto da tela real e a leitura vira uma
   piada visual: ela esta montando a vitrine da Omnimob.

   O avanco e em translate e tem TETO em px. Assim ele nao participa do layout
   (nao empurra a coluna vizinha, nao cria rolagem) e nao cresce sem limite em
   tela larga — a 3440px um 4vw solto jogaria o desenho por cima da interface.
   O que se quer e tangenciar, nao invadir. */
.dl-editor__desenho {
  /* Mesmo diagnostico do Desafio, causa diferente: aqui a arte nao ficava
     centrada num vazio, ficava PENDURADA. O .dl-editor centra as duas colunas,
     entao o texto sobe para o meio e a arte sobra na quina de baixo, com ar em
     volta e nada por baixo.

     A margem de 22px separava a arte do paragrafo — e separacao e o que
     transforma um elemento de apoio em elemento solto. Encostando nele (10px),
     ela passa a ler como parte da coluna de texto, que e o papel dela: apoio da
     interface, nunca concorrente dela.

     O avanco horizontal continua com teto em px, e o motivo e o mesmo de antes:
     a 3440px um 5vw solto jogaria o desenho POR CIMA da tela do editor. O que
     se quer e tangenciar. */
  width: clamp(240px, 24vw, 340px);
  max-width: 100%;
  margin: 10px 0 0 auto;
  translate: clamp(0px, 5vw, 76px) -6px;
}

/* ── 3 · Flow: a abertura da secao clara ─────────────────────────────────────
   A ilustracao sobe para o lado do TITULO e fica quase do tamanho dele: e a
   imagem de abertura do modulo, nao um adendo. A flor rosa continua atras, como
   decoracao — quem manda aqui e o corretor movendo o negocio. */
.dl-manifesto__wrap { position: relative; z-index: 1; }

.dl-manifesto__cabeca {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: clamp(20px, 4vw, 56px);
}
.dl-manifesto__desenho {
  width: clamp(280px, 30vw, 400px);
  max-width: 100%;
  translate: 0 -8px;
}

/* ── 4 · Flow: o remate, e a direcao INVERTE ─────────────────────────────────
   O bloco de cima joga a arte para a direita; este devolve para a esquerda. E o
   que transforma duas imagens numa sequencia — movemos o negocio pelo funil,
   depois a chave troca de mao — em vez de duas figuras do mesmo lado.

   A ordem no DOM e texto-primeiro por causa do celular, onde ler a frase antes
   da imagem e o natural. No desktop o order inverte a coluna. */
.dl-manifesto__remate {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: clamp(22px, 4vw, 56px);
  max-width: 940px;
  margin: clamp(38px, 5vw, 62px) 0 0;
  padding-top: clamp(26px, 3vw, 40px);
  border-top: 1px solid var(--line);
}
/* O fio de cima pertencia ao paragrafo; dentro de uma grade de duas colunas ele
   parava no meio da linha. Passou para o contorno da grade. */
.dl-manifesto__remate .dl-manifesto__fecho {
  margin: 0;
  padding-top: 0;
  border-top: 0;
  max-width: none;
  order: 2;
}
/* O climax da narrativa do Flow: o negocio concluido, a chave trocando de mao.
   Nenhum filtro, nenhuma mistura de camada, nenhuma opacidade — o arquivo ja
   veio preparado para o fundo branco e qualquer tratamento aqui o sujaria. */
.dl-manifesto__remate-img {
  width: clamp(300px, 29vw, 390px);
  max-width: 100%;
  order: 1;
  translate: 0 10px;
}

/* ── 5 · Aplicativo: a figura entra na pagina ────────────────────────────────
   A coluna da direita ja era a maior da grade (1.18fr contra 0.82fr) — a
   ilustracao aqui nunca foi pequena de largura, ela so estava ancorada no
   centro. Encostada a direita e escapando alguns pixels para fora, ela ganha a
   direcao da caminhada da personagem: ela entra na pagina em vez de posar.

   O escape usa translate e nao margem negativa: margem negativa em coluna de
   grid empurra a vizinha, translate nao mexe em layout nenhum — e e por isso
   que ele nao consegue criar rolagem horizontal aqui. */
/* As regras ficam na declaracao ORIGINAL de .dl-app-soon__visual, mais abaixo:
   ela vem depois desta no arquivo e venceria uma copia daqui. Duas declaracoes
   do mesmo seletor brigando na cascata e o defeito que este bloco existe para
   nao criar. */

/* ── 6 · O predio no rodape: assinatura, nao coluna ──────────────────────────
   Ja estava assim e continua: sangrando pela quina direita, a 30%, atras dos
   links. Ver .dl-footer__predio, junto das formas do rodape. */

/* ── CELULAR ─────────────────────────────────────────────────────────────────
   Uma regra vale para todas: some o desalinho, some a sobreposicao, a coluna
   vira uma so e a arte vem DEPOIS do texto, centrada. Numa tela estreita o
   deslocamento nao le como composicao, le como erro de alinhamento — e nao ha
   vao onde avancar. */
/* 1024 e o breakpoint que o projeto ja usa para colapsar .dl-editor,
   .dl-app-soon__grid e .dl-head. Reusar em vez de inventar um proprio evita
   uma faixa de larguras em que metade da pagina virou coluna unica e a outra
   metade nao. */
@media (max-width: 1024px) {
  .dl-desafio__grade,
  .dl-manifesto__cabeca,
  .dl-manifesto__remate { grid-template-columns: 1fr; }

  .dl-desafio__conteudo .dl-head { margin-bottom: 24px; }

  .dl-desafio__arte,
  .dl-manifesto__desenho,
  .dl-manifesto__remate-img,
  .dl-editor__desenho { translate: none; }

  .dl-desafio__arte img,
  .dl-manifesto__desenho,
  .dl-manifesto__remate-img,
  .dl-editor__desenho {
    width: min(86vw, 340px);
    margin-inline: auto;
    margin-top: 30px;
  }

  /* No remate a ordem volta ao natural: le-se a frase e depois ve-se a cena. */
  .dl-manifesto__remate .dl-manifesto__fecho { order: 1; }
  .dl-manifesto__remate-img { order: 2; }

}

/* Abaixo de 640 a folga lateral ja e pequena; a arte usa quase a largura toda,
   com teto para nao passar do tamanho em que foi entregue. */
@media (max-width: 640px) {
  .dl-desafio__arte img,
  .dl-manifesto__desenho,
  .dl-manifesto__remate-img,
  .dl-editor__desenho { width: min(88vw, 300px); }
}

/* ── OS TRES CARTOES DE TELA ─────────────────────────────────────────────────
   Cada cartao e uma superficie pastel com uma tela falsa dentro e o texto de
   verdade embaixo. O pastel muda por cartao: tres tons vizinhos do rosa do
   Flow, e nao tres cores diferentes — a variacao existe para separar os
   assuntos, nao para criar tres marcas.

   (Sem crases nestes comentarios: este CSS mora num template literal.) */
.dl-flowtelas {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: clamp(14px, 1.6vw, 22px);
  margin-top: clamp(40px, 5vw, 68px);
}
@media (max-width: 980px) { .dl-flowtelas { grid-template-columns: 1fr; } }

.dl-flowtela {
  border-radius: 20px;
  padding: clamp(18px, 1.8vw, 24px);
  display: flex; flex-direction: column;
  background: var(--pastel);
}
.dl-flowtela--funil    { --pastel: #fdf0f5; }
.dl-flowtela--minuta   { --pastel: #f6f1fa; }
.dl-flowtela--comissao { --pastel: #fdf4ec; }

.dl-flowtela__tag {
  display: inline-flex; align-items: center; gap: 7px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase;
  color: #6a5560;
}
.dl-flowtela__tag i {
  width: 5px; height: 5px; border-radius: 999px; background: var(--flow);
}

/* O quadro branco onde a tela mora. Altura fixa nos tres para os cartoes
   alinharem os titulos: sem ela, o do funil puxa e os outros dois ficam com o
   texto flutuando em alturas diferentes. */
.dl-flowtela__quadro {
  margin: 14px 0 18px;
  background: #ffffff;
  border-radius: 14px;
  padding: 13px;
  height: 216px;
  overflow: hidden;
  box-shadow: 0 10px 26px -20px rgba(10,10,11,0.5);
}

.dl-flowtela h3 {
  margin: 0; font-size: 18px; font-weight: 700;
  letter-spacing: -0.03em; color: var(--strong);
}
.dl-flowtela p {
  margin: 9px 0 0; font-size: 13px; line-height: 1.62; color: var(--subtle);
}

/* ── O funil ── */
.dl-fkanban { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.dl-fkanban__topo {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 8px; letter-spacing: 0.08em; text-transform: uppercase;
  color: #8a8a95; margin-bottom: 6px; font-weight: 600;
}
.dl-fkanban__topo b {
  font-size: 8px; color: #55555f;
  background: rgba(10,10,11,0.06); border-radius: 999px; padding: 1px 5px;
}
/* A coluna alvo e a unica com o acento. Uma tela em que tudo se destaca nao
   destaca nada; aqui ela diz "e para este ponto que o funil empurra". */
.dl-fkanban__col.is-alvo .dl-fkanban__topo { color: var(--flow); }
.dl-fkanban__col.is-alvo .dl-fkanban__topo b {
  background: color-mix(in srgb, var(--flow) 14%, transparent); color: var(--flow);
}
.dl-fkanban__card {
  background: #fbfbfc; border: 1px solid rgba(10,10,11,0.08);
  border-radius: 8px; padding: 7px 8px;
  display: flex; flex-direction: column; gap: 2px;
}
.dl-fkanban__col.is-alvo .dl-fkanban__card {
  border-color: color-mix(in srgb, var(--flow) 34%, transparent);
  box-shadow: 0 4px 12px -8px color-mix(in srgb, var(--flow) 70%, transparent);
}
.dl-fkanban__cod {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 8px; color: #a0a0aa;
}
.dl-fkanban__card strong {
  font-size: 10.5px; font-weight: 650; color: #1a1a1f; line-height: 1.25;
}
.dl-fkanban__bairro { font-size: 9px; color: #8a8a95; }
.dl-fkanban__valor { font-size: 10px; font-weight: 700; color: #33333a; margin-top: 2px; }
.dl-fkanban__resto {
  display: block; margin-top: 12px; padding-top: 10px;
  border-top: 1px dashed rgba(10,10,11,0.12);
  font-size: 8.5px; letter-spacing: 0.1em; text-transform: uppercase; color: #b0b0ba;
}

/* ── A minuta ── */
.dl-fminuta { display: flex; flex-direction: column; height: 100%; }
.dl-fminuta__titulo {
  font-size: 10px; font-weight: 700; color: #1a1a1f;
  padding-bottom: 9px; border-bottom: 1px solid rgba(10,10,11,0.08);
}
.dl-fminuta ul { list-style: none; margin: 9px 0 0; padding: 0; display: grid; gap: 7px; flex: 1; }
.dl-fminuta li {
  display: grid; grid-template-columns: 12px 1fr auto; align-items: center; gap: 7px;
  font-size: 10px; color: #55555f;
}
.dl-fminuta li b { font-size: 9.5px; font-weight: 600; color: #33333a; }
.dl-fminuta li i {
  width: 12px; height: 12px; border-radius: 999px; display: block;
  position: relative;
}
.dl-fminuta li.is-ok i { background: #d6f5e4; }
.dl-fminuta li.is-ok i::after {
  content: ""; position: absolute; left: 3.5px; top: 3px;
  width: 3px; height: 5.5px; border: solid #167a4a; border-width: 0 1.4px 1.4px 0;
  transform: rotate(42deg);
}
/* A pendencia usa o rosa do modulo, e nao vermelho de erro: nada quebrou. E uma
   informacao que falta, e o cartao inteiro fala sobre isso. */
.dl-fminuta li.is-falta i { background: color-mix(in srgb, var(--flow) 16%, transparent); }
.dl-fminuta li.is-falta i::after {
  content: ""; position: absolute; left: 5.2px; top: 2.6px;
  width: 1.6px; height: 6.8px; border-radius: 1px; background: var(--flow);
}
.dl-fminuta li.is-falta b { color: var(--flow); font-style: italic; }
.dl-fminuta__pe {
  display: flex; align-items: center; gap: 9px;
  margin-top: 11px; padding-top: 10px; border-top: 1px solid rgba(10,10,11,0.08);
}
/* Botao apagado de proposito: e o estado bloqueado que conta a historia. */
.dl-fminuta__botao {
  font-size: 9.5px; font-weight: 600; color: #a0a0aa;
  background: rgba(10,10,11,0.05); border-radius: 999px; padding: 5px 11px;
}
.dl-fminuta__aviso {
  font-size: 9px; font-weight: 600; color: var(--flow);
}

/* ── O split ── */
.dl-fsplit { display: flex; flex-direction: column; height: 100%; }
.dl-fsplit__topo,
.dl-fsplit__taxa {
  display: flex; align-items: baseline; justify-content: space-between;
  font-size: 10px; color: #8a8a95;
}
.dl-fsplit__topo b { font-size: 15px; font-weight: 700; color: #1a1a1f; letter-spacing: -0.02em; }
.dl-fsplit__taxa {
  margin-top: 7px; padding-bottom: 10px;
  border-bottom: 1px solid rgba(10,10,11,0.08);
}
.dl-fsplit__taxa b { font-size: 12px; font-weight: 700; color: var(--flow); }
.dl-fsplit ul { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 8px; flex: 1; }
.dl-fsplit li {
  display: flex; align-items: baseline; justify-content: space-between;
  font-size: 10px; color: #55555f;
}
.dl-fsplit li b { font-size: 11px; font-weight: 650; color: #33333a; }
/* O resto e a linha que fecha a conta, e por isso ela e a unica com peso. */
.dl-fsplit li.is-resto {
  margin-top: 2px; padding-top: 9px;
  border-top: 1px dashed rgba(10,10,11,0.14);
}
.dl-fsplit li.is-resto span { color: #33333a; font-weight: 600; }
.dl-fsplit li.is-resto b { color: #1a1a1f; font-weight: 750; }
/* A caixa do interruptor do Flow. O componente traz o desenho dele; o que fica
   aqui e so a largura e o respiro nesta pagina — largura de leitura, centrada,
   e nao a coluna inteira de 1200px, onde uma frase de duas linhas ficaria com
   quinze palavras por linha.
   (Sem crases nestes comentarios: template literal.) */
/* ── FAQ ── */
/* ── FAQ: lista à esquerda, resposta à direita ──
   Substituiu o acordeão empilhado. As cores são as mesmas de antes: dourado no
   acento (era a cor do item aberto e do hover), branco na pergunta e o cinza de
   placeholder nos traços.

   O display:grid é o que põe a resposta AO LADO. Sem ele os dois filhos são
   blocos e caem um embaixo do outro — foi o que aconteceu quando este bloco se
   perdeu numa edição. */
.dl-faq2 {
  display: grid;
  grid-template-columns: minmax(280px, 0.9fr) 1.1fr;
  gap: clamp(24px, 4vw, 56px);
  align-items: start;
  border-top: 1px solid var(--line);
  padding-top: clamp(20px, 3vw, 34px);
}
.dl-faq2__lista { min-width: 0; }

.dl-faq2__resposta {
  /* Grudada ao rolar: a resposta é o que se está lendo, e a lista ao lado é
     longa o bastante para levá-la para fora da tela. */
  position: sticky;
  top: 96px;
  min-width: 0;
}
.dl-faq2__caixa {
  display: flex; flex-direction: column; gap: 12px;
  padding: clamp(20px, 2.4vw, 30px);
  border-radius: 18px;
  background: var(--surface);
  border: 1px solid var(--line);
}
.dl-faq2__num { font-size: 9.5px; color: var(--gold); letter-spacing: 0.1em; }
.dl-faq2__q { font-size: 17px; font-weight: 700; color: var(--strong); letter-spacing: -0.02em; line-height: 1.35; }
.dl-faq2__a { font-size: 14px; line-height: 1.75; color: var(--subtle); }

/* Uma coluna só no celular: a resposta vai para baixo da lista, e a fixação por
   rolagem sai — grudar um bloco numa tela estreita rouba a altura toda. */
@media (max-width: 760px) {
  .dl-faq2 { grid-template-columns: 1fr; }
  .dl-faq2__resposta { position: static; }
}

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

/* ── Aplicativo mobile ── */
.dl-app-soon {
  position: relative;
  overflow: hidden;
}
.dl-app-soon::before {
  content: "";
  position: absolute;
  width: min(52vw, 720px);
  aspect-ratio: 1;
  right: -16%;
  top: 50%;
  transform: translateY(-50%);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(212,175,55,0.16), rgba(212,175,55,0.04) 45%, transparent 72%);
  pointer-events: none;
}
.dl-app-soon__grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 0.82fr) minmax(420px, 1.18fr);
  align-items: center;
  /* Vao menor: a personagem esta caminhando PARA o texto, e cem pixels de vazio
     entre os dois desfaziam a relacao. Aproximar aumenta a presenca dela sem
     precisar aumentar a imagem — que ja e a maior da pagina. */
  gap: clamp(32px, 4.5vw, 68px);
}
.dl-app-soon__copy .dl-h2 { margin-top: 14px; }
.dl-app-soon__copy .dl-lead { max-width: 530px; }

/* ── CANAIS E INTEGRACOES: texto de um lado, a arte do outro ──────────────
   Mesma familia da secao do aplicativo, invertida: a arte fica a ESQUERDA
   (60%) e o texto a direita (40%). No celular vira uma coluna, com o texto
   antes da arte — a ordem do DOM ja e essa, e so a grade de duas colunas
   troca os lados, pelo order.
   (Sem crases nestes comentarios: template literal.) */
.dl-canais {
  position: relative;
  z-index: 1;
  display: grid;
  /* Mais larga que o .dl-wrap comum (1120px): a arte e grande e o texto ao
     lado precisa de linha de leitura. Nos 1120 nao cabiam os dois. */
  max-width: 1360px;
  /* A proporcao entre arte e texto e 3 : 1 — mas o texto tem um PISO de
     400px. Sem o piso, em 3 : 1 sobravam ~250px para dois paragrafos, e
     nenhum fr conserta isso: a faixa e que e curta. Com o piso, quem cede
     quando falta espaco e a arte, nao a leitura. */
  grid-template-columns: minmax(0, 3fr) minmax(min(100%, 500px), 1fr);
  align-items: center;
  gap: clamp(24px, 4vw, 56px);
}
.dl-canais__copy { order: 2; display: flex; flex-direction: column; gap: 6px; }
.dl-canais__copy .dl-h2 { margin-top: 14px; }
/* Teto dos paragrafos: acima disto a linha fica longa demais para ler. Se a
   coluna for mais estreita que isto, e ela quem manda. */
.dl-canais__copy .dl-lead { max-width: 580px; }
.dl-canais__copy .dl-body { max-width: 580px; }
.dl-canais__copy .dl-btn-row { margin-top: 22px; }

/* ── A arte: inteira no centro, esvaindo nas bordas ─────────────────────────
   Uma mascara radial na propria <img>: opaca ate 45% do raio, e dali vai a
   transparente na borda. A imagem e uma so, sem camadas — a mascara recorta a
   opacidade, e o fundo da secao atravessa nas beiradas. Os dois numeros do
   gradiente sao os botoes: o primeiro % e ate onde a imagem fica inteira, o
   segundo e onde some de vez. A elipse acompanha o 16:9 da imagem.
   Sem crases nestes comentarios: template literal. */
.dl-canais__arte {
  order: 1; min-width: 0;
  /* Sangra 5% para a esquerda, para dentro do respiro do .dl-wrap. */
  width: 110%; margin-left: -5%;
}
.dl-canais__arte img {
  display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: contain;
  -webkit-mask-image: radial-gradient(ellipse 100% 100% at 50% 50%, #000 35%, transparent 50%);
          mask-image: radial-gradient(ellipse 100% 100% at 50% 50%, #000 35%, transparent 50%);
}
/* No celular a arte vem PRIMEIRO: e a peca que diz "com quem a Omnimob fala"
   de relance, e o texto embaixo explica. E a mesma ordem do DOM, entao basta
   zerar o order das duas. */
@media (max-width: 860px) {
  .dl-canais { grid-template-columns: 1fr; gap: 28px; }
  .dl-canais__copy { order: 2; }
  .dl-canais__arte { order: 1; width: 100%; margin-left: 0; }
}
.dl-app-soon__stores {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 28px;
}
.dl-app-soon__store {
  min-width: 168px;
  display: grid;
  gap: 2px;
  padding: 12px 16px 13px;
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 14px;
  background: rgba(255,255,255,0.045);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
}
.dl-app-soon__store-kicker {
  color: var(--placeholder);
  font-size: 8px;
  letter-spacing: 0.14em;
}
.dl-app-soon__store strong {
  color: var(--strong);
  font-size: 16px;
  line-height: 1.2;
  letter-spacing: -0.015em;
}
.dl-app-soon__note { margin-top: 18px; }
.dl-app-soon__visual {
  display: flex;
  align-items: center;
  /* Encostada a direita, e nao centrada na coluna. A personagem esta ANDANDO;
     ancorada no centro ela posa como icone, encostada na borda ela entra na
     pagina. A coluna ja e a maior da grade (1.18fr contra 0.82fr), entao o que
     mudou aqui e a ancora, nao o tamanho. */
  justify-content: flex-end;
  min-width: 0;
}
.dl-app-soon__visual img {
  display: block;
  width: min(100%, 760px);
  height: auto;
  object-fit: contain;
  filter: drop-shadow(0 28px 52px rgba(0,0,0,0.28));
  /* Escapa alguns pixels para fora da coluna. translate e nao margem negativa:
     margem negativa em coluna de grid empurra a vizinha e pode gerar rolagem
     horizontal; translate nao participa do layout. */
  translate: clamp(0px, 2.4vw, 40px) 12px;
}
/* Em coluna unica a personagem volta ao centro e ao eixo: nao ha vao lateral
   para onde escapar, e o desalinho leria como erro. */
@media (max-width: 1024px) {
  .dl-app-soon__visual { justify-content: center; }
  .dl-app-soon__visual img { translate: none; }
}

/* ── CTA final (claro) ── */
/* ── O FECHO: o fundo comum do CTA e do rodape ──────────────────────────────
   A cor lisa e o shader ficam AQUI, e nao no CTA: o rodape, logo abaixo, e um
   cartao escuro flutuando sobre o mesmo fundo, e o shader precisa continuar
   por tras dele. Sem overflow hidden — o canvas ja tem o tamanho exato da
   caixa, e o CTA e o rodape recortam o que e deles.

   ── A TRANSICAO INVADE A SECAO DE CIMA ──
   O fecho SOBE --fecho-invasao por baixo da secao anterior (margem negativa)
   e o degrade escuro → claro (o ::before) comeca la em cima, opaco na cor do
   fundo da pagina. Assim a transicao tem o comprimento que precisa sem
   empurrar o titulo do CTA para baixo: a parte de cima dela acontece onde a
   secao anterior so tinha respiro. O que a invasao cobre e escondido pelo
   escuro opaco — e por isso ela nao pode passar do respiro de baixo daquela
   secao, senao come a ilustracao.
   (Sem crases nestes comentarios: template literal.) */
.dl-fecho {
  position: relative;
  z-index: 1;
  background: #f4f5f7;
  /* Igual ao respiro de baixo da secao anterior (--pad-sec do .dl-section):
     e ate onde da para subir sem cobrir a ilustracao dela. */
  --fecho-invasao: clamp(64px, 8vw, 112px);
  /* Quanto do degrade fica DENTRO do fecho, acima do titulo do CTA. */
  --degrade-h: clamp(220px, 28vw, 420px);
  margin-top: calc(-1 * var(--fecho-invasao));
}
.dl-fecho::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0;
  height: calc(var(--fecho-invasao) + var(--degrade-h));
  z-index: 1;
  pointer-events: none;
  background: linear-gradient(180deg, #0a0a0b 0%, #0a0a0b 18%, rgba(10,10,11,0.75) 45%, rgba(10,10,11,0) 100%);
}
.dl-cta {
  position: relative;
  z-index: 1;
  overflow: hidden;
  color: #0c121a;
  /* O respiro de cima soma a invasao (o pedaco do fecho que esta por baixo
     da secao anterior) e o degrade: o titulo comeca onde o fundo ja e claro. */
  padding: calc(clamp(56px, 7vw, 96px) + var(--fecho-invasao) + var(--degrade-h)) 0 clamp(72px, 9vw, 128px);
}
/* ── O fundo de iridescencia ────────────────────────────────────────────────

   A nevoa do Vanta se pintava NO PROPRIO elemento da secao; o shader novo mora
   num filho, entao ele precisa ser posicionado a mao — e ficar ATRAS do
   conteudo.

   A linha que mais importa e a de pointer-events: sem ela o div do canvas cobre
   a secao inteira e engole o clique no botao "Testar gratis", que e o unico
   motivo desta secao existir. O movimento do mouse que o efeito le nao depende
   disso — ele escuta no proprio elemento e continua recebendo.

   (Sem crases nestes comentarios: isto vive dentro de um template literal, e
   uma crase aqui encerra a string inteira em silencio.) */
.dl-fecho__fundo {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0.9;
}
.dl-fecho__fundo canvas {
  display: block;
  width: 100%;
  height: 100%;
  /* O shader e vibrante demais em cheio: esta secao e a UNICA clara da pagina,
     e o texto dela e escuro. Em 100% o contraste do titulo caia abaixo do
     legivel sobre as faixas mais saturadas. Meio caminho mantem o movimento e
     devolve o texto. */
  opacity: 1;
}

/* O conteudo sobe acima do fundo. Sem isto ele fica no mesmo plano do canvas e
   a ordem passa a depender de quem vem depois no DOM. */
.dl-cta__inner {
  position: relative; z-index: 2;
  text-align: center; display: flex; flex-direction: column; align-items: center;
}

/* ── As duas placas ─────────────────────────────────────────────────────────
   A da esquerda (.dl-cta__placa) tem 75% e a da direita (.dl-cta__vaga) 38%:
   somam mais que 100% de proposito, e a margem negativa da esquerda e o que
   as sobrepoe — o lado inclinado de uma entra no recorte da outra.

   AS DUAS ENCOLHEM JUNTAS. O flex reduz as duas na proporcao das larguras
   para caber nos 100%, e e essa proporcao (75 : 38) que faz as duas
   inclinacoes terem a mesma largura horizontal e coincidirem. Travar uma
   delas (flex: none) joga todo o encolhimento na outra e os tracos ficam
   paralelos, com um vao entre eles — foi o primeiro defeito desta placa.

   A MARGEM E O ENCOSTO. Medido na tela, e nao calculado: -6.5% (o valor da
   referencia) deixava ~25px de vao entre os dois tracos; -8% enfiava a placa
   da direita ~20px dentro da esquerda. -7.2% e onde as duas se encostam. Se
   a largura das placas ou dos tracos mudar, e este numero que se reacerta,
   olhando.
   (Sem crases nestes comentarios: template literal.) */
.dl-cta__defs { position: absolute; width: 0; height: 0; }
.dl-cta__dupla {
  width: 100%;
  display: flex; align-items: stretch; justify-content: space-between;
  text-align: left;
}
.dl-cta__placa {
  position: relative; box-sizing: border-box;
  width: 80%; margin-right: -6.5%; min-width: 0;
  aspect-ratio: 1 / 0.68;
  display: flex; flex-direction: column; justify-content: center;
  gap: clamp(28px, 4vw, 56px);
  padding: clamp(28px, 5.5vw, 80px);
}
.dl-cta__placa > * { position: relative; z-index: 1; }
/* O contorno. 108% de largura no desktop: o traco inclinado precisa passar
   da caixa para entrar na placa vizinha. Branco, como na referencia — sobre o
   shader o branco e o que se le como linha. */
.dl-cta__contorno {
  position: absolute; inset: 0; z-index: 0; pointer-events: none;
  width: 108%; height: 100%;
}
.dl-cta__contorno path { fill: none; stroke: rgba(255,255,255,0.92); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
.dl-cta__contorno--mobile { display: none; }
.dl-cta__texto { display: flex; flex-direction: column; align-items: flex-start; }
.dl-cta__placa .dl-cta__grad { align-self: flex-start; }
.dl-cta__placa .dl-btn-row { justify-content: flex-start; }
/* A placa da direita: o recorte pelo clipPath, um fundo escuro leve e o
   traco por cima. Vazia por enquanto; a imagem entra aqui com object-fit:
   cover e o clip cuida do formato. */
.dl-cta__vaga {
  position: relative; width: 38%; min-width: 0;
  clip-path: url(#dl-cta-forma-desktop);
  background: rgba(255,255,255,0.12);
}
.dl-cta__vaga-traco { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.dl-cta__vaga-traco path { fill: none; stroke: rgba(255,255,255,0.92); stroke-width: 2; vector-effect: non-scaling-stroke; }
.dl-cta__vaga-traco--mobile { display: none; }
@media (max-width: 860px) {
  .dl-cta__dupla { flex-direction: column; }
  .dl-cta__placa {
    width: 100%; margin-right: -4%;
    aspect-ratio: 1 / 1.3;
    padding: 24px 24px 100px;
    gap: 32px;
  }
  .dl-cta__contorno { width: 100%; }
  .dl-cta__contorno--desktop { display: none; }
  .dl-cta__contorno--mobile { display: block; }
  .dl-cta__vaga {
    width: 100%; margin-top: -16.4%;
    aspect-ratio: 1 / 0.44;
    clip-path: url(#dl-cta-forma-mobile);
  }
  .dl-cta__vaga-traco--desktop { display: none; }
  .dl-cta__vaga-traco--mobile { display: block; }
}

.dl-cta__title {
  display: flex; flex-direction: column; margin: 18px 0 0;
  font-size: clamp(34px, 5vw, 66px); line-height: 1.04;
  letter-spacing: -0.045em; font-weight: 800; color: #d4d4d4;
}

.dl-cta__grad {
  align-self: center;
  position: relative;
  padding: 0.02em 0.3em 0.1em;
  border-radius: 0.24em;

  /* A cor do texto sai de uma variavel para a secao poder virar clara ou
     escura sem mexer aqui. */
  color: var(--cta-vidro-texto, #0b1018);
  -webkit-text-fill-color: currentColor;

  /* O vidro. O saturate acima de 1 existe porque o borrao lava a cor: sem ele
     a lapide fica cinzenta no meio de um fundo vibrante. */
  -webkit-backdrop-filter: blur(16px) saturate(150%) brightness(1.24);
  backdrop-filter: blur(16px) saturate(150%) brightness(1.24);
  background: rgba(255, 255, 255, 0.2);

  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.75),
    0 18px 40px -26px rgba(8, 12, 20, 0.32);

  /* Halo branco curto: nao desenha nada, so separa a letra escura da parte
     mais escura do borrao. */
  text-shadow: 0 1px 10px rgba(255, 255, 255, 0.5);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .dl-cta__grad { background: rgba(255, 255, 255, 0.68); }
}

/* ── A luz correndo dentro das letras ────────────────────────────────────────
   O preto solido era o unico elemento parado de uma secao inteiramente em
   movimento — a iridescencia atras nao para, e a lapide de vidro deixa ela
   atravessar. As letras ficavam por cima como um adesivo.

   O que corre e uma faixa violeta atravessando um texto que continua escuro nas
   duas pontas. Le como luz pegando o relevo das letras, e nao como texto
   colorido: em nenhum momento do ciclo a cor sobe o suficiente para virar
   destaque por conta propria, o que atrapalharia a leitura de uma frase que e a
   chamada final da pagina.

   A tecnica e a MESMA da etiqueta "mais popular" dos planos (dlTagOnda): um
   degrade largo demais para a caixa, deslocado por animacao. Repetir o que a
   pagina ja faz custa menos que introduzir um segundo jeito de mover cor.

   Dois cuidados que nao sao obvios:

   - O bloco supports esta pelo lado POSITIVO. Preenchimento transparente sem o
     recorte funcionando e texto INVISIVEL — o pior fim possivel para a chamada
     principal. Escrito assim, quem nao tem o recurso nunca chega a ficar
     transparente: fica com o preto de antes.

   - A sombra branca saiu do text-shadow e virou drop-shadow. Com o
     preenchimento transparente, o text-shadow e pintado ACIMA do fundo
     recortado — o halo apareceria POR DENTRO das letras, lavando justamente o
     que ele deveria separar. O drop-shadow age sobre o resultado ja composto e
     fica atras, que e o que se queria desde o inicio. */
.dl-cta__grad-texto {
  text-shadow: none;
  filter: drop-shadow(0 1px 7px rgba(255, 255, 255, 0.55));
}

@supports ((-webkit-background-clip: text) or (background-clip: text)) {
  .dl-cta__grad-texto {
    background-image: linear-gradient(
      100deg,
      var(--cta-vidro-texto, #0b1018) 0%,
      var(--cta-vidro-texto, #0b1018) 32%,
      #3d3475 44%,
      #6a54a6 50%,
      #3d3475 56%,
      var(--cta-vidro-texto, #0b1018) 68%,
      var(--cta-vidro-texto, #0b1018) 100%
    );
    background-size: 320% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
    animation: dlVidroVarredura 9s linear infinite;
  }
}

@keyframes dlVidroVarredura {
  from { background-position: 100% 50%; }
  to { background-position: -220% 50%; }
}

/* Quem pediu menos movimento fica com a faixa PARADA, e nao com o preto de
   antes: o degrade e o efeito, a varredura e so como ele se anuncia. */
@media (prefers-reduced-motion: reduce) {
  .dl-cta__grad-texto { animation: none; background-position: 46% 50%; }
}

/* ── POR QUE NAO HA UMA REGRA DE prefers-reduced-transparency AQUI ───────────

   Havia. Ela trocava o vidro por uma placa branca a 86% quando o sistema pedia
   menos transparencia, e SAIU de proposito.

   O motivo e o que esse sinal realmente quer dizer no Windows. Ele nao vem de
   Facilidade de Acesso: vem de Personalizacao > Cores > "Efeitos de
   transparencia", o mesmo interruptor que desliga o vidro da barra de tarefas e
   do menu Iniciar. Muita gente o desliga por gosto ou para aliviar uma maquina
   antiga, anos antes de abrir este site, e nunca mais pensa nele. Chegando aqui
   como "reduza a transparencia", ele apagava a lapide de vidro — a peca central
   da ultima secao — para um publico que nunca pediu isso.

   O que continua valendo logo acima e o supports: aquilo nao e preferencia, e
   CAPACIDADE. Navegador que nao sabe desfocar o fundo recebe a placa solida,
   porque senao seria transparencia sem borrao nenhum e o texto escuro ficaria
   sobre o shader cru.

   Se um dia voltar a ser desejavel, o bloco removido esta no historico:
   git log -S prefers-reduced-transparency

   (Sem crases neste comentario — este CSS mora dentro de um template literal.) */
.dl-cta__sub { margin-top: 20px; font-size: 15.5px; line-height: 1.72; color: #d4d4d4; max-width: 46ch; }
.dl-cta__note { margin-top: 32px; color: #ffffff; font-size: 9px; letter-spacing: 0.16em; }
/* Branco: os cinzas aqui foram escolhidos para o fundo claro que esta secao
   tinha antes do shader. Sobre o Iridescence eles somem. */
.dl-cta .dl-eyebrow { color: #ffffff; }
/* O tracinho acompanha o texto: escuro, ele ficava invisivel do mesmo jeito. */
.dl-cta .dl-eyebrow__line { background: rgba(255,255,255,0.45); }
/* A bolinha vinha do atributo tone em JSX, que e estilo inline e venceria
   daqui. Por isso ela perdeu o tone la em cima: a cor sai deste bloco agora.
   (Sem crase neste comentario — este CSS mora dentro de um template literal.) */
.dl-cta .dl-eyebrow__dot { background: #ffffff; }

/* ── Footer ── */
/* Ver DivisorDeOndas. A altura vive numa variavel porque quem o recebe precisa
   abrir esse espaco a mais no respiro de cima — senao a onda cobre a primeira
   linha do conteudo. Largura de 130%: as ondas nao fecham no ponto de partida,
   e em 100% a emenda aparecia como um degrau na borda direita.
   (Sem crases neste comentario — este CSS mora dentro de um template literal.) */
.dl-root { --ondas-h: clamp(56px, 9vw, 130px); }
.dl-ondas {
  position: absolute;
  top: 0; left: 0;
  width: 100%;
  height: var(--ondas-h);
  overflow: hidden;
  line-height: 0;
  z-index: 1;
  pointer-events: none;
}
.dl-ondas svg {
  position: relative;
  display: block;
  width: calc(130% + 1.3px);
  height: 100%;
}
.dl-ondas--grafite path { fill: #0f0f11; }
.dl-ondas--escuro path { fill: #0a0a0b; }
.dl-ondas--claro path { fill: #ffffff; }

/* ── Ondas VAZADAS ───────────────────────────────────────────────────────────
   A outra forma da mesma onda, para quando a secao de cima tem MOVIMENTO (a
   parede do #porque). Pintar a onda com a cor dela congelaria a animacao numa
   cor chapada; aqui a onda e um recorte: a secao sobe --ondas-h sobre a
   anterior (margem negativa) e a propria pintura dela e recortada em onda por
   uma mascara. O que aparece no recorte e o que a anterior estiver desenhando
   naquele momento — inclusive o que se move.

   A mascara e o MESMO desenho, invertido: retangulo branco (a secao aparece) e
   as tres ondas em preto com a opacidade original (a secao some, ou some em
   parte — as camadas a 25% e 50% deixam a anterior transparecer de leve, que
   e o que faz parecer escorrer). Por isso a primeira camada e luminance. A
   segunda e o resto da secao, opaco, e entra 1px na primeira para a emenda
   fracionaria nao virar uma fresta.

   E uma classe, e nao um filho, porque nao ha nada para desenhar — so
   recortar. Vale em qualquer secao: .dl-section, .gv4-trust e .gv4-section
   ja fazem a conta do respiro abaixo. Nao use as duas (pintada + vazada) na
   mesma secao.
   (Sem crases neste comentario — este CSS mora dentro de um template literal.) */
.dl-ondas-vazadas {
  position: relative;
  z-index: 1;
  margin-top: calc(-1 * var(--ondas-h));
  mask-image: url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1200 120%22 preserveAspectRatio=%22none%22%3E%3Crect width=%221200%22 height=%22120%22 fill=%22%23fff%22/%3E%3Cpath fill=%22%23000%22 opacity=%22.25%22 d=%22M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z%22/%3E%3Cpath fill=%22%23000%22 opacity=%22.5%22 d=%22M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z%22/%3E%3Cpath fill=%22%23000%22 d=%22M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z%22/%3E%3C/svg%3E"), linear-gradient(#000, #000);
  mask-mode: luminance, alpha;
  mask-size: 100% var(--ondas-h), 100% calc(100% - var(--ondas-h) + 1px);
  mask-position: top center, bottom center;
  mask-repeat: no-repeat;
}

/* A secao que recebe a onda (pintada ou vazada) vira o palco dela, abre o
   respiro de cima e perde a linha fina de .dl-section — a borda fica acima do
   filho absoluto, e por cima da onda ela aparecia como uma reta. */
.dl-section:is(:has(> .dl-ondas), .dl-ondas-vazadas) {
  position: relative;
  padding-top: calc(var(--pad-sec) + var(--ondas-h));
  border-top: 0;
}
/* As duas secoes de LandingGrowthV4 tem respiro proprio; mesma conta, com o
   padding que cada uma ja tinha. */
.gv4-trust:is(:has(> .dl-ondas), .dl-ondas-vazadas) {
  padding-top: calc(clamp(62px, 7vw, 88px) + var(--ondas-h));
  border-top: 0;
}
.gv4-section:is(:has(> .dl-ondas), .dl-ondas-vazadas) {
  padding-top: calc(clamp(78px, 9vw, 126px) + var(--ondas-h));
  border-top: 0;
}

/* ── O rodape e um CARTAO sobre o fundo do fecho ────────────────────────────
   O <footer> e transparente e so da o respiro em volta; quem e escuro,
   arredondado e recorta as formas e o predio e o .dl-footer__cartao. A
   largura e a do .dl-wrap (1120px): os dois .dl-wrap de dentro continuam com
   o padding deles, entao o texto fica a 24px da borda do cartao.
   (Sem crases nestes comentarios: template literal.) */
.dl-footer {
  position: relative;
  z-index: 1;
  padding: 0 clamp(14px, 2.5vw, 32px) clamp(14px, 2.5vw, 32px);
}
.dl-footer__cartao {
  position: relative;
  overflow: hidden;
  /* Quase de ponta a ponta: o cartao e o fecho da pagina, e um bloco tímido
     no meio de um fundo claro lia como um rodape de outro site. O conteudo
     continua nos 1120px do .dl-wrap, centrado dentro dele. */
  max-width: 1480px;
  margin: 0 auto;
  background: #050506;
  border-radius: clamp(22px, 3vw, 40px);
  padding: clamp(72px, 8vw, 112px) 0 36px;
}
.dl-footer__cartao::before {
  content: ""; position: absolute; left: -80px; top: -60px; width: 420px; height: 260px;
  background: radial-gradient(closest-side, rgba(99,102,241,0.22), transparent);
  pointer-events: none;
}
/* So posicao e tamanho; o giro vem de .omni-forma, no kit. */
/* O predio da marca, sangrando pela quina direita do rodape. Opacidade baixa:
   ele e assinatura, nao ilustracao em destaque — e o rodape tem links que
   precisam continuar sendo a coisa mais legivel dali. */
.dl-footer__predio {
  position: absolute;
  right: clamp(-40px, -2vw, -10px);
  bottom: -30px;
  width: clamp(120px, 13vw, 200px);
  height: auto;
  opacity: 0.3;
  pointer-events: none;
  z-index: 0;
}
@media (max-width: 760px) { .dl-footer__predio { display: none; } }

/* A forma-arco na quina da secao de numeros. Parada, sangrando, bem apagada:
   textura, e nao figura. */
.dl-numeros { position: relative; overflow: hidden; }
.dl-numeros__forma {
  position: absolute;
  left: clamp(-70px, -4vw, -30px);
  top: clamp(-50px, -3vw, -20px);
  width: clamp(110px, 12vw, 200px);
  height: auto;
  opacity: 0.13;
  pointer-events: none;
  z-index: 0;
}
.dl-numeros > .dl-wrap { position: relative; z-index: 1; }

.dl-footer__forma--a {
  top: -70px; right: -60px;
  width: clamp(180px, 20vw, 330px); height: clamp(180px, 20vw, 330px);
}
.dl-footer__forma--b {
  bottom: -60px; left: 8%;
  width: clamp(120px, 12vw, 200px); height: clamp(120px, 12vw, 200px);
}
.dl-footer__inner { position: relative; z-index: 1; display: grid; grid-template-columns: 1fr 1.35fr; gap: 48px; }
.dl-footer__logo { display: inline-flex; align-items: center; }
.dl-footer__brand p { font-size: 13px; line-height: 1.8; color: var(--placeholder); margin-top: 14px; max-width: 34ch; }
.dl-footer__cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(140px, 100%), 1fr)); gap: 28px; }
.dl-footer__cols > div { display: grid; gap: 11px; align-content: start; }
.dl-footer__cols span { color: #55555f; font-size: 9px; letter-spacing: 0.14em; }
.dl-footer__cols a { font-size: 13px; color: var(--subtle); transition: color 0.18s ease; }
.dl-footer__cols a:hover { color: var(--strong); }
.dl-footer__bottom {
  display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap;
  align-items: center;
  margin-top: 46px; padding-top: 20px; border-top: 1px solid var(--line);
  color: var(--placeholder); font-size: 9px;
}

/* ── Seletor de animações ────────────────────────────────────────────────────
   A página se ajusta sozinha ao aparelho (ver utils/capacidadeDaMaquina.js),
   e a detecção erra dos dois lados. Este controle e a nota abaixo dele existem
   para a pessoa discordar — e para ela entender que a diferença que está vendo
   foi deliberada, e não um defeito.

   Discreto de propósito: fica na mesma linha do aviso de direitos autorais, no
   tom do rodapé. Quem não sentiu a página pesada não precisa reparar nele.
   ────────────────────────────────────────────────────────────────────────── */
.dl-efeitos {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  font-size: 9px; letter-spacing: 0.08em;
}
.dl-efeitos__rotulo { color: var(--placeholder); }
.dl-efeitos__grupo {
  display: flex; gap: 2px; padding: 2px; border-radius: 999px;
  background: rgba(255,255,255,0.04); border: 1px solid var(--line);
}
.dl-root .dl-efeitos__opcao,
.dl-root .dl-efeitos__auto {
  width: auto; padding: 4px 10px; border-radius: 999px;
  font: inherit; letter-spacing: inherit; text-transform: uppercase;
  background: none; border: 0; box-shadow: none; transform: none;
  color: var(--placeholder); cursor: pointer;
  transition: color 0.16s ease, background 0.16s ease;
}
.dl-root .dl-efeitos__opcao:hover,
.dl-root .dl-efeitos__auto:hover {
  color: #f4f5f7; background: rgba(255,255,255,0.06);
  box-shadow: none; transform: none;
}
.dl-root .dl-efeitos__opcao.is-ativo {
  color: #0a0a0b; background: #f4f5f7;
}
.dl-root .dl-efeitos__auto { margin-left: 4px; text-decoration: underline; text-underline-offset: 2px; }
.dl-efeitos__nota { color: var(--placeholder); opacity: 0.72; text-transform: none; letter-spacing: 0.02em; }

@media (max-width: 720px) {
  .dl-efeitos { width: 100%; justify-content: center; }
  .dl-efeitos__nota { width: 100%; text-align: center; }
}

/* ── Responsivo ── */
@media (max-width: 1024px) {
  .dl-hero__grid, .dl-split, .dl-editor, .dl-footer__inner { grid-template-columns: 1fr; }
  .dl-hero__grid { gap: 56px; }
  .dl-app-soon__grid { grid-template-columns: 1fr; gap: 40px; }
  .dl-app-soon__visual { order: -1; }
  .dl-app-soon__visual img { width: min(100%, 680px); }
  .dl-journey { grid-template-columns: repeat(2, 1fr); gap: 0 32px; }
  .dl-head { grid-template-columns: 1fr; align-items: start; gap: 18px; }
  .dl-h2 { max-width: none; }
  .pl-cartoes { grid-template-columns: 1fr; }
  .dl-hud { display: none; }
  /* Mockup quase de frente quando não há espaço lateral para a isometria. */
  .dl-mockup { transform: perspective(1700px) rotateY(-5deg) rotateX(3deg); }
  .dl-chip-float--a { left: 0; }
  .dl-chip-float--b { right: 0; }

  /* O painel lateral do menu desce para baixo dos links. */
}
/* ── Tablet estreito e celular: recursos viram carrossel ──
   As abas já estão empilhadas sobre o painel desde os 1024px, e daqui para
   baixo o arranjo em duas partes deixa de fazer sentido: cada recurso passa a
   ser um cartão fechado, com a tela dele e o texto dele, e o gesto é arrastar
   de lado. Ver o comentário no componente Recursos para o porquê. */
@media (max-width: 860px) {
  .dl-rec-caixa { display: flex; flex-direction: column; }

  /* Os pontos entram POR DENTRO da folga de cima do trilho (margem negativa):
     a folga existe para a sombra dos cartões não ser decepada, e sem a margem
     ela viraria um vão morto entre o cabeçalho e o carrossel. */
  .dl-rec-pontos {
    display: flex; justify-content: center; gap: 6px;
    margin: 4px 0 -22px; position: relative; z-index: 1;
  }
  .dl-root .dl-rec-ponto {
    width: 24px; height: 26px; padding: 0; border: 0; border-radius: 0;
    background: none; box-shadow: none; transform: none; cursor: pointer;
    display: grid; place-items: center;
  }
  .dl-root .dl-rec-ponto:hover { background: none; box-shadow: none; transform: none; }
  .dl-rec-ponto::before {
    content: ""; width: 7px; height: 7px; border-radius: 999px;
    background: rgba(255,255,255,0.24);
    transition: width 0.35s var(--ease-out), background 0.35s ease;
  }
  .dl-rec-ponto.is-on::before { width: 20px; background: var(--accent-soft); }

  /* Mesma mecânica do trilho de planos: o respiro das pontas é metade do que
     sobra depois do cartão, e é MARGEM dos cartões das pontas, não padding do
     trilho — com padding, a largura do cartão passaria a ser porcentagem do que
     sobrou depois dele e o primeiro e o último nunca parariam no centro. */
  .dl-rec-trilho {
    --dl-cartao: 84%;
    --dl-ponta: 8%; /* (100 - 84) / 2 */
    display: flex; gap: 12px; align-items: flex-start;
    overflow-x: auto; overflow-y: hidden;
    scroll-snap-type: x mandatory;
    padding: 28px 0 10px;
    scrollbar-width: none; -ms-overflow-style: none;
  }
  .dl-rec-trilho::-webkit-scrollbar { display: none; }
  .dl-rec-slide {
    flex: 0 0 var(--dl-cartao); scroll-snap-align: center;
    display: flex; flex-direction: column;
    /* Recuado até virar o cartão do meio. Brilho e não opacidade: opacidade
       deixaria passar o fundo da seção por dentro da moldura do navegador. */
    filter: brightness(0.55); transform: scale(0.97);
    transition: filter 0.45s var(--ease-out), transform 0.45s var(--ease-out);
  }
  .dl-rec-slide.is-atual { filter: none; transform: none; }
  .dl-rec-slide:first-child { margin-left: var(--dl-ponta); }
  .dl-rec-slide:last-child { margin-right: var(--dl-ponta); }

  /* Altura FIXA, e não um teto: cada recurso tem uma tela de altura diferente,
     e com teto os seis cartões do trilho teriam alturas diferentes — o encaixe
     lateral passaria por molduras que sobem e descem. */
  .dl-rec-slide .dl-browser { flex: 0 0 auto; height: min(420px, 38vh); max-height: none; }

  .dl-rec-slide__texto { padding: 16px 2px 0; }
  .dl-rec-slide__texto .dl-feature__icon { margin-bottom: 10px; }
  .dl-rec-slide__texto .dl-index { display: block; margin-bottom: 6px; }
}

/* ── O mecanismo do cartão compacto, FORA de qualquer media query ────────────
   (Sem crases neste comentário: ele vive num template literal.)

   Estas regras viviam dentro do media query de 640px de largura, e foi por isso
   que o cartão apareceu quebrado num monitor largo e baixo: o JS passou a ligar
   o modo compacto por ALTURA, mas o CSS que faz ele funcionar só existia abaixo
   de 640px de LARGURA.

   O resultado era visível: as duas listas desenhadas uma embaixo da outra (a
   regra que esconde uma delas não valia), o painel sem altura animada, e o
   botão "Ver todos os recursos" caindo no estilo global de botão — roxo e
   ocupando a linha inteira.

   Aqui não há condição de tela nenhuma, e não precisa haver: o resumo e o botão
   só são RENDERIZADOS quando o modo compacto está ativo. Quem decide é o JS;
   estas regras só descrevem como a coisa se comporta quando existe.

   O que continua no media query é o que é mesmo sobre tela estreita — tamanho
   de fonte, espaçamento, margens.
   ────────────────────────────────────────────────────────────────────────── */
  .pl-lista--resumo li.is-heranca { color: var(--strong); font-weight: 600; }
  .pl-lista--resumo li.is-heranca span { color: var(--accent-soft); }

  /* ── Abrir e fechar a lista ──
     Quem cresce é o painel, com a altura escrita pelo JS (PlanoRecursos) e
     transição na altura. As duas listas moram na MESMA célula da grade e se
     cruzam lá dentro: sem isso, a que sai empurraria a que entra para baixo
     antes de desaparecer, e o painel animaria a altura das duas somadas. */
  .pl-recursos {
    display: grid; flex: none; margin: 16px 0 8px;
    overflow: hidden;
    transition: height 0.42s var(--ease-out);
  }
  .pl-recursos > .pl-lista {
    grid-area: 1 / 1;
    /* No topo da célula, e não esticadas: esticada, cada lista passaria a ter a
       altura do painel — que é exatamente a altura que se quer medir a partir
       delas. A medida viraria a própria resposta. */
    align-self: start; flex: none;
    padding-bottom: 40px;
  }
  /* A lista escondida continua no DOM (é dela que sai a medida da outra ponta
     da animação), mas não pega toque nem seleção. */
  .pl-recursos.is-resumido > .pl-lista:not(.pl-lista--resumo),
  .pl-recursos:not(.is-resumido) > .pl-lista--resumo {
    pointer-events: none;
  }

  /* O resumo entra e sai inteiro: são quatro linhas, e escaloná-las seria mais
     enfeite do que leitura. */
  .pl-lista--resumo {
    transition: opacity 0.24s ease 0.12s, transform 0.34s var(--ease-out) 0.12s;
  }
  .pl-recursos:not(.is-resumido) > .pl-lista--resumo {
    opacity: 0; transform: translateY(-5px);
    transition: opacity 0.12s ease, transform 0.12s ease;
  }

  /* A tabela completa entra linha a linha, de cima para baixo, acompanhando o
     painel que desce.

     A cascata inteira cabe DENTRO dos 0,42s do painel: a última das dez linhas
     fecha em 0,07 + 9×0,016 + 0,24 ≈ 0,45s. Com passo maior ela terminava por
     volta dos 0,58s, e as últimas linhas acendiam num painel que já tinha
     parado de crescer — o movimento acabava duas vezes.

     E os 0,07s de espera na largada são curtos de propósito: eles existem para
     não cruzar com o resumo apagando (0,12s), mas alongá-los abria um vão em
     que o painel crescia vazio.

     Fechar não escalona: o painel sobe em 0,42s, e linhas saindo em cascata
     seriam recortadas pela borda dele no meio do próprio desaparecimento. */
  .pl-recursos > .pl-lista:not(.pl-lista--resumo) li {
    transition:
      opacity 0.24s ease calc(0.07s + var(--i, 0) * 16ms),
      transform 0.32s var(--ease-out) calc(0.07s + var(--i, 0) * 16ms);
  }
  .pl-recursos.is-resumido > .pl-lista:not(.pl-lista--resumo) li {
    opacity: 0; transform: translateY(-6px);
    transition: opacity 0.14s ease, transform 0.14s ease;
  }
  .dl-root .pl-mais {
    width: 100%; margin: 0 0 18px; padding: 9px 0;
    display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    background: none; border: 0; border-radius: 0; box-shadow: none; transform: none;
    font-family: inherit; font-size: 12.5px; font-weight: 600;
    color: var(--accent-soft);
    cursor: pointer;
    transition: color 0.3s ease;
  }
  .dl-root .pl-mais:hover,
  .dl-root .pl-mais:active {
    background: none; box-shadow: none; transform: none; scale: 1; color: var(--strong);
  }
  .pl-mais svg { transition: transform 0.3s var(--ease-out); }
  .pl-mais[aria-expanded="true"] svg { transform: rotate(180deg); }

@media (max-width: 640px) {
  .dl-checks { display: none; }
  /* ── Ações do hero ──
     Empilhados e ancorados na esquerda, o principal mais largo e o secundário
     com metade dele — a diferença de largura é o que diz, sem palavra nenhuma,
     qual dos dois é o caminho.

     A peça que faltava para isso funcionar não está aqui: é o align-items do
     .dl-hero__grid, lá embaixo. Ele nasce "center" para o desktop, onde o
     mockup e o texto se alinham pelo meio; no celular a grade vira uma coluna,
     e center passa a significar "encolha cada bloco até o conteúdo e
     centralize" — era isso que mantinha os botões no meio da tela, com largura
     de texto, por mais 100% que se pedisse a eles.

     A largura do principal vive numa variável, e a do secundário sai dela pela
     metade: mexer em --acao reajusta os dois de uma vez e a proporção entre
     eles não se perde no caminho. */
  .dl-hero__copy .dl-btn-row {
    --acao: 80%;
    flex-direction: column; align-items: stretch; gap: 12px;
  }
  /* Sem o respiro de 30px que o kit dá à linha de ações: acima dela já vem o
     espaço entre blocos do hero, e os dois somados abriam um vão morto entre o
     parágrafo e os botões. */
  .dl-hero__copy .dl-btn-row { margin-top: 0; }
  /* A lista de vantagens está escondida no celular, mas o embrulho dela — a div
     da entrada por rolagem — continuava cobrando o respiro de um bloco inteiro
     ali no meio. Era metade do vão. */
  .dl-hero__copy > *:has(.dl-checks) { display: none; }
  /* Alvo de toque mais generoso: 11px de altura interna é medida de mouse. */
  .dl-root .dl-btn-row .dl-btn { padding-top: 15px; padding-bottom: 15px; }
  .dl-hero__copy .dl-btn-row > :first-child { width: var(--acao); }
  /* max-content como piso: em telas bem estreitas, metade da linha ficaria
     menor que "Ver planos" e o texto vazaria do botão. */
  .dl-hero__copy .dl-btn-row > :last-child { width: calc(var(--acao) / 2); min-width: max-content; }
  .dl-browser__body { padding: 14px; gap: 11px; }
  .dl-browser__chart { height: 74px; }
  .dl-esteira { --vao: 7px; }
  .dl-esteira__card { padding: 6px; gap: 4px; }
  .dl-esteira__foto { min-height: 20px; }
  .dl-esteira__foto svg { max-width: 28px; }
  .dl-tenants { gap: 9px; }
  .dl-tenants__box { padding: 8px; gap: 6px; }
  .dl-tenants__vitrine { min-height: 26px; gap: 4px; }
  .dl-hero__shapes { display: none; }
  .dl-def { padding: 22px 20px; }
  .dl-journey { grid-template-columns: 1fr; }
  .dl-journey__item { padding: 26px 0 30px; }
  .dl-root .dl-faq__q { grid-template-columns: 40px 1fr 24px; gap: 12px; }
  .dl-faq__a { padding: 0 0 20px 52px; }
  /* Sem largura para o CTA nem para o rótulo: sobram o logo e o hambúrguer, e
     o CTA continua alcançável de dentro do menu.

     Com .dl-root porque as variantes de botão do kit (.dl-root .dl-btn) pesam
     mais que uma classe solta: sem o prefixo, este display:none perde e o CTA
     continua na barra — foi ele que espremeu a tipografia do logo até aqui. */
  /* O rótulo "Menu"/"Fechar" também sai no celular: sobra o ícone, que já diz
     o que faz e não disputa largura com o logotipo. */
  .dl-root .dl-header__cta, .sm-botao-caixa { display: none; }
  .dl-header__tipo, .dl-header.is-scrolled .dl-header__tipo { height: 34px; }
  /* Sem cursor não há foco para revelar a palavra — ela só ocuparia memória. */
  .dl-ghost { display: none; }
    .dl-mockup { transform: none; }
  .dl-mockup__body { grid-template-columns: 72px 1fr; }
  .dl-chip-float { display: none; }
  .dl-stage__float { animation: none; }

  /* ── Densidade ──
     Uma coluna só (o padrão do kit no celular) transforma listas curtas em
     rolagem infinita: oito integrações viram oito cartões de tela cheia, e
     quatro números viram quatro. Como esses cartões são só um rótulo e um
     valor, eles cabem em dupla e a seção encolhe pela metade. */
  .dl-grid-hair--4 { grid-template-columns: repeat(2, 1fr); }
  .dl-cell { padding: 18px 16px; }
  .dl-stat__l { font-size: 12px; }

  /* ── Zebra do celular ──
     Sem a seção do desafio, o revezamento de fundos quebra: sobrariam duas
     seções claras coladas e o resto trocado. Daqui para baixo o xadrez é
     refeito à mão — é o preço de esconder uma seção do meio, e é por isso que
     as seções sem âncora de menu ganharam id. */
  .dl-section--ghost { display: none; }
  #editor, #integracoes, #planos { background: var(--bg); }
  #recursos, #porque, #faq { background: var(--bg-alt); }

  /* ── Véu da parede de destaques ──
     A elipse do desktop é medida em porcentagem da seção, e numa tela de 390px
     ela vira uma mancha de ~225px: cobre o título e para ali, com os cartões
     acesos encostando nas duas laterais. Aqui ela abre para além da seção
     (110% × 96%) e o miolo opaco vai mais longe antes de cair — o que sobra de
     parede à mostra passa a ser a franja de cima e de baixo, não o meio.

     E não some no hover: :hover em tela de toque fica grudado depois do
     primeiro toque, então o véu sumiria de vez ao encostar na seção. */
  .dl-porque__fundo::after {
    background: radial-gradient(
      ellipse 110% 96% at 50% 50%,
      rgba(10, 10, 11, 0.94) 0%,
      rgba(10, 10, 11, 0.88) 42%,
      rgba(10, 10, 11, 0.62) 72%,
      rgba(10, 10, 11, 0.26) 100%
    );
  }
  .dl-porque:hover .dl-porque__fundo::after { opacity: 1; }
  /* Mesmo motivo: o recuo do cabeçalho no hover é um gesto de mouse. No celular
     ele apagava o título ao primeiro toque, sem forma de trazer de volta. */
  .dl-porque:hover .dl-porque__frente { opacity: 1; filter: none; }

  /* ── Integrações ──
     O preenchimento pela cor da marca é um hover, e hover não existe no
     celular: sem ele a seção virava oito linhas de texto. A marca sai de
     fundo da célula e vira um selo, sempre visível — mesma informação, mesma
     cor, sem depender de um cursor que não existe. */
  .dl-int { padding-top: 16px; }
  .dl-int__marca {
    position: relative; inset: auto; z-index: 1;
    width: 34px; height: 34px; border-radius: 11px; margin-bottom: 9px;
    flex: 0 0 auto; opacity: 1; transform: none;
    color: #fff; box-shadow: 0 6px 16px -8px rgba(0,0,0,0.9);
  }
  .dl-int--claro .dl-int__marca { color: rgba(10,10,11,0.72); }
  .dl-int__marca svg { width: 18px; height: 18px; }
  /* Uma superfície de leve para a célula deixar de ser um retângulo vazio em
     volta do selo. Cor sólida de propósito: --int-cor é um degradê em duas das
     marcas, e degradê dentro de degradê é declaração inválida — o efeito
     sumiria justamente no Instagram e no Gemini, sem erro nenhum aparecer. */
  .dl-int { background: rgba(255,255,255,0.022); }

  /* O hero é a primeira tela: menos respiro morto entre o texto e o mockup. */
  .dl-hero { padding-top: clamp(104px, 26vw, 132px); }
  /* align-items volta para stretch: em coluna, o "center" que serve ao desktop
     encolhe cada bloco até o tamanho do conteúdo e o centraliza — texto, lista
     e botões saíam todos com largura de texto, boiando no meio da tela. */
  .dl-hero__grid { display: flex; flex-direction: column; align-items: stretch; gap: 0; margin-top: 0; }
  .dl-hero__copy, .dl-hero__side { display: contents; }
  .dl-hero__copy > * { order: 1; margin-bottom: 22px; }
  .dl-stage { order: 2; margin-bottom: 24px; width: 100%; }
  .dl-hero__copy > :last-child { order: 3; margin-bottom: 0; }
  .dl-hero__aside { display: none; }
  /* Mesmo motivo do .dl-hero__grid: "center" serve à grade de duas colunas do
     desktop, mas em coluna ele encolhe cada bloco até o conteúdo e centraliza.
     Quem denunciava era o eyebrow — por ser inline-flex, ele é o mais estreito
     de todos e aparecia sozinho no meio da tela, com o título à esquerda. */
  .dl-editor { display: flex; flex-direction: column; align-items: stretch; }
  .dl-editor > div:first-child { display: contents; }
  .dl-editor .dl-eyebrow { order: 1; }
  .dl-editor .dl-h2 { order: 2; }
  .dl-editor .dl-lead { order: 3; }
  .dl-ed { order: 4; margin: 32px 0 24px; width: 100%; box-sizing: border-box; }
  .dl-editor .dl-body { order: 5; }

  /* Cartões da faixa: mais estreitos, para caber um inteiro na tela em vez de
     um e meio cortado, e a máscara recua para não comer o que aparece. */
  .dl-fcard { width: 224px; min-height: 150px; padding: 18px 20px; }
    /* Na parede a leitura do cartão é o que importa, e num palco estreito o
     texto encolhe junto com a peça. Um degrau a menos de tamanho evita que a
     descrição vire duas linhas de nada. */
  .dl-fcard--parede { padding: 14px 16px; gap: 6px; }
  .dl-fcard--parede .dl-relato__frase { font-size: 12px; line-height: 1.5; }
  .dl-fcard--parede .dl-relato__foto { width: 32px; height: 32px; font-size: 11px; }

  /* A barra do mock do editor não comporta URL e aviso lado a lado; some a
     URL, que é enfeite, e fica o aviso, que é a história da seção. */
  .dl-ed__url { display: none; }
  .dl-ed { padding: 12px; }
  .dl-ed__area { inset: 9px; }

  /* ── Carrossel de planos ──
     Os três cartões viram trilho: um por vez, centrado, com o vizinho
     aparecendo pela ponta como convite para arrastar. O respiro das pontas é
     margem dos cartões das pontas, e não padding do trilho, para as duas
     medidas correrem sobre a MESMA base (ver a versão anterior deste bloco no
     histórico: com padding lateral a conta nunca fechava). */
  .pl-cartoes {
    --pl-cartao: 68%;
    --pl-ponta: 16%; /* (100 - 68) / 2 — o que sobra e o vizinho espiando */
    --pl-vao: 12px;
    display: flex; gap: var(--pl-vao);
    /* Cada cartão com a própria altura: esticados na altura do maior, abrir a
       tabela de um esticaria os três. */
    align-items: flex-start;
    overflow-x: auto; overflow-y: hidden;
    scroll-snap-type: x mandatory;
    padding: 12px 0 18px;
    scrollbar-width: none; -ms-overflow-style: none;
  }
  .pl-cartoes::-webkit-scrollbar { display: none; }
  .pl-cartao { flex: 0 0 var(--pl-cartao); scroll-snap-align: center; padding: 22px 18px; }
  .pl-cartao:first-child { margin-left: var(--pl-ponta); }
  .pl-cartao:last-child { margin-right: var(--pl-ponta); }
  /* Fora de foco o cartão recua por brilho, não por opacidade — opacidade
     deixaria o fundo da moldura atravessar o vidro. */
  .pl-cartoes .pl-cartao {
    filter: brightness(0.6); transform: scale(0.965);
    transition: filter 0.45s var(--ease-out), transform 0.45s var(--ease-out);
  }
  .pl-cartoes .pl-cartao.is-atual { filter: none; transform: none; }
  .pl-cartao__preco strong { font-size: 30px; }
  .dl-head { margin-bottom: 28px; }
  .pl-lista { gap: 9px; }

  .dl-callout { padding: 22px 20px; }

  .dl-app-soon__grid { gap: 30px; }
  .dl-app-soon__copy { text-align: center; }
  .dl-app-soon__copy .dl-eyebrow { justify-content: center; }
  .dl-app-soon__copy .dl-lead { margin-left: auto; margin-right: auto; }
  .dl-app-soon__stores { justify-content: center; }
  .dl-app-soon__visual img {
    width: min(100%, 560px);
    max-height: 460px;
  }
  .dl-app-soon__note { max-width: 46ch; margin-left: auto; margin-right: auto; }

  /* Rodapé em duas colunas: em uma só, três blocos de links viravam meia tela
     de rolagem para fechar a página. */
  .dl-footer__cols { grid-template-columns: repeat(2, 1fr); gap: 24px 18px; }
  .dl-footer__inner { gap: 34px; }
  .dl-footer__bottom { flex-direction: column; gap: 8px; margin-top: 34px; }
}

/* Telas bem estreitas (≤ 360px): o que ainda estava em dupla passa a caber
   melhor sozinho. */
@media (max-width: 380px) {
  .dl-grid-hair--4 { grid-template-columns: 1fr; }
  .dl-app-soon__stores { display: grid; grid-template-columns: 1fr; }
  .dl-app-soon__store { min-width: 0; }
  .dl-footer__cols { grid-template-columns: 1fr; }
  .dl-btn-row .dl-btn { width: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .dl-stage__float, .dl-chip-float, .dl-pulse { animation: none; }
  /* As esteiras de imóveis param na primeira cópia, que já é uma grade cheia; o
     bloco selecionado do editor fica só com o contorno, sem o pulso; e a
     etiqueta do plano fica com o degradê parado, que já é a cor dela. */
  .dl-esteira__linha { animation: none; }
  /* O editor congela no primeiro layout, que já é a posição base dos blocos.
     O aviso de salvo para de piscar e fica só posto. */
  .dl-ed__bloco { animation: none; }
  .dl-ed__ponteiro { display: none; }
  .dl-ed__salvo { animation: none; opacity: 1; }
  .dl-stage:hover .dl-mockup { transform: perspective(1700px) rotateY(-15deg) rotateX(7deg) rotateZ(1.2deg); }

  /* O menu troca de estado sem o círculo crescendo nem os links subindo, e o
     FAQ abre e fecha direto. Ambos continuam funcionando, só sem percurso. */
  .dl-faq__panel, .dl-faq__a, .dl-faq__toggle, .dl-faq__bar { transition: none; }
  /* A lista de recursos troca de estado sem percurso: o painel salta para a
     altura nova e as linhas aparecem postas. Nenhum atraso pode sobrar, senão
     as últimas linhas da tabela ficariam invisíveis por meio segundo depois do
     toque — que é o oposto do que se pede aqui.

     Com o prefixo .dl-root porque as regras da cascata escalonada são mais
     específicas que o nome da classe sozinho, e sem ele este bloco perderia
     para elas mesmo vindo por último. */
  .dl-root .pl-recursos,
  .dl-root .pl-recursos > .pl-lista,
  .dl-root .pl-recursos > .pl-lista li,
  .dl-root .pl-mais svg { transition: none; }
  .pl-periodo__chave::after { transition: none; }
}

/* OMNIMOB_COMPOSICAO_ILUSTRACOES_V2_1_INICIO */
/*
   Composicao editorial das ilustracoes da landing.
   A ideia aqui nao e aumentar desenho: e dar uma ancora visual para cada cena,
   preservar a alternancia direita/esquerda e usar o vao entre colunas como parte
   da composicao. Em tablet e celular tudo volta ao fluxo para nao parecer erro.
*/

@media (min-width: 1025px) {
  /* DESAFIO
     A cena deixa de ficar pousada no rodape e passa a ocupar a coluna inteira.
     O centro visual dela encosta no miolo do texto, enquanto a borda direita
     continua sangrando para fora do container. */
  #desafio .dl-desafio__grade {
    grid-template-columns: minmax(0, 0.98fr) minmax(420px, 1.02fr);
    gap: clamp(18px, 2.2vw, 34px);
  }
  #desafio .dl-desafio__conteudo {
    padding-bottom: clamp(12px, 1.6vw, 24px);
  }
  #desafio .dl-desafio__arte {
    align-self: stretch;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    translate: none;
  }
  #desafio .dl-desafio__arte img {
    width: clamp(430px, 41vw, 610px);
    max-width: none;
    margin: 0;
    transform: translate(clamp(18px, 3.5vw, 58px), clamp(8px, 1.2vw, 18px));
    transform-origin: 56% 68%;
  }

  /* EDITOR — hotfix 2.1
     A versao anterior posicionava a ilustracao de forma absoluta sem reservar
     altura para ela; dependendo da quebra do paragrafo, a personagem subia por
     cima das ultimas linhas. Agora o espaco dela existe no fluxo: o wrapper
     reserva uma faixa inferior e a arte ocupa essa faixa, ainda apontando para
     a demonstracao ao lado. */
  #editor .dl-editor {
    position: relative;
    grid-template-columns: minmax(0, 0.92fr) minmax(470px, 1.08fr);
    gap: clamp(46px, 5vw, 74px);
    align-items: center;
    padding-bottom: 0;
  }
  #editor .dl-editor > div:first-child {
    position: relative;
    z-index: 2;
    /* Esta faixa e a "casa" da ilustracao. Ela impede qualquer colisao com o
       dl-body mesmo quando o texto quebra uma linha a mais. */
    padding-bottom: clamp(128px, 10.5vw, 156px);
  }
  #editor .dl-editor__desenho {
    position: absolute;
    z-index: 3;
    right: clamp(-52px, -3.2vw, -24px);
    bottom: 0;
    width: clamp(205px, 17vw, 255px);
    max-width: none;
    margin: 0;
    translate: none;
    transform: rotate(-0.8deg);
    transform-origin: 70% 80%;
    pointer-events: none;
  }
  #editor .dl-ed {
    position: relative;
    z-index: 1;
  }

  /* FLOW — ABERTURA
     A imagem desce um pouco e vai para a quina externa. O titulo ganha um eixo
     diagonal: texto sobe pela esquerda, personagem fecha pela direita. */
  .dl-manifesto__cabeca {
    grid-template-columns: minmax(0, 1fr) minmax(320px, 0.76fr);
    align-items: end;
    gap: clamp(12px, 2vw, 30px);
  }
  .dl-manifesto__desenho {
    justify-self: end;
    width: clamp(320px, 31vw, 430px);
    max-width: 100%;
    translate: clamp(8px, 1.8vw, 24px) clamp(18px, 2.2vw, 34px);
  }
  .dl-manifesto__corpo {
    margin-top: clamp(44px, 5vw, 64px);
  }

  /* FLOW — FECHAMENTO
     A segunda cena cruza o eixo da primeira: entra pela esquerda e invade de
     leve a linha divisoria, como um desfecho, sem virar uma segunda coluna dura. */
  .dl-manifesto__remate {
    grid-template-columns: minmax(300px, 0.78fr) minmax(0, 1.22fr);
    gap: clamp(12px, 2.6vw, 34px);
    max-width: 1000px;
    align-items: center;
  }
  .dl-manifesto__remate-img {
    justify-self: start;
    width: clamp(320px, 30vw, 420px);
    max-width: 100%;
    translate: clamp(-30px, -2vw, -10px) -14px;
  }

  /* APP
     A personagem passa a ter linha de chao: desce e sangra pela quina direita.
     O texto fica um pouco mais alto, criando uma diagonal oposta ao Flow. */
  #aplicativo .dl-app-soon__grid {
    grid-template-columns: minmax(0, 0.90fr) minmax(470px, 1.10fr);
    gap: clamp(16px, 2.5vw, 38px);
    align-items: center;
  }
  #aplicativo .dl-app-soon__copy {
    padding-bottom: clamp(18px, 3vw, 48px);
  }
  #aplicativo .dl-app-soon__visual {
    align-self: end;
    justify-content: flex-end;
  }
  #aplicativo .dl-app-soon__visual img {
    width: min(100%, 780px);
    translate: clamp(26px, 4vw, 62px) clamp(26px, 3.5vw, 52px);
    transform: rotate(-1deg);
    transform-origin: 60% 80%;
  }

  /* TEXTURAS DE CANTO
     Mantem o arco e o predio como assinatura, mas em lados opostos para nao
     repetir a mesma quina duas vezes perto do fim da pagina. */
  .dl-numeros__forma {
    left: auto;
    right: clamp(-74px, -4vw, -34px);
    top: clamp(-54px, -3vw, -22px);
    transform: rotate(18deg);
  }
  .dl-footer__predio {
    right: clamp(-24px, -1vw, -6px);
    bottom: -38px;
    width: clamp(132px, 14vw, 215px);
  }
}


/* DESKTOP ESTREITO
   Entre 1025 e 1180px o vao e menor; a personagem recua um pouco para nao
   tangenciar demais a moldura do editor. */
@media (min-width: 1025px) and (max-width: 1180px) {
  #editor .dl-editor > div:first-child { padding-bottom: 132px; }
  #editor .dl-editor__desenho { right: -18px; width: 220px; }
}

/* TABLET
   Mantem a alternancia sem sobreposicao. A arte continua deslocada para um lado,
   mas usa margem normal para nunca sair da tela. */
@media (min-width: 761px) and (max-width: 1024px) {
  #desafio .dl-desafio__arte img,
  #editor .dl-editor__desenho,
  .dl-manifesto__desenho {
    margin-left: auto;
    margin-right: 0;
  }
  .dl-manifesto__remate-img {
    margin-left: 0;
    margin-right: auto;
  }
  #desafio .dl-desafio__arte img {
    width: min(70vw, 440px);
  }
  #editor .dl-editor__desenho {
    width: min(54vw, 310px);
  }
  .dl-manifesto__desenho,
  .dl-manifesto__remate-img {
    width: min(60vw, 350px);
  }
}

/* CELULAR
   Corrige tambem a ordem da ilustracao do editor: como o wrapper vira
   display:contents, a imagem sem order podia aparecer antes do titulo. Aqui a
   leitura fica texto -> desenho -> editor. No app, texto vem antes da cena. */
@media (max-width: 760px) {
  #editor .dl-editor .dl-eyebrow { order: 1; }
  #editor .dl-editor .dl-h2 { order: 2; }
  #editor .dl-editor .dl-lead { order: 3; }
  #editor .dl-editor .dl-body { order: 4; }
  #editor .dl-editor__desenho {
    order: 5;
    position: static;
    width: min(76vw, 270px);
    margin: 10px auto 6px;
    translate: none;
    transform: none;
  }
  #editor .dl-ed {
    order: 6;
    margin-top: 18px;
  }

  #aplicativo .dl-app-soon__copy { order: 1; }
  #aplicativo .dl-app-soon__visual {
    order: 2;
    margin-top: 6px;
  }
  #aplicativo .dl-app-soon__visual img {
    width: min(100%, 540px);
    translate: none;
    transform: none;
  }

  .dl-manifesto__desenho,
  .dl-manifesto__remate-img {
    margin-top: 18px;
  }
}

/* OMNIMOB_COMPOSICAO_ILUSTRACOES_V2_1_FIM */

/* OMNIMOB_HIERARQUIA_EDITORIAL_V3_INICIO */
/*
   V3 — hierarquia editorial da landing.

   A pagina ja tem personalidade. Este bloco nao tenta acrescentar mais uma
   linguagem visual; ele faz o contrario: cria dois picos de intensidade
   (Hero e CTA final) e deixa o miolo respirar.

   Objetivos:
   - produto acima da decoracao;
   - menos elementos competindo ao mesmo tempo;
   - interacoes do miolo mais discretas;
   - ilustracoes humanas usadas como pontuacao, nao como padrao;
   - secoes de consulta mais compactas que secoes narrativas.
*/

/* ── CADENCIA DA PAGINA ─────────────────────────────────────────────────── */
#recursos,
#integracoes,
#porque {
  --pad-sec: clamp(54px, 6.4vw, 88px);
}

#planos {
  --pad-sec: clamp(66px, 7.6vw, 106px);
}

/* Integracoes e a secao que o rasgo de papel (.dl-rasgo) invade por baixo. O
   respiro inferior dobra para a ultima fila de cartoes nao ficar encostada
   no rasgo — so embaixo; em cima a cadencia continua a do miolo. */
#integracoes {
  padding-bottom: calc(var(--pad-sec) * 3);
}

/* Os cabecalhos do miolo ficam um pouco mais contidos. O Hero, o Manifesto e
   o CTA final continuam fora desta regra e preservam a escala de campanha. */
#recursos .dl-head,
#integracoes .dl-head,
#porque .dl-head,
#planos .dl-head {
  margin-bottom: clamp(28px, 3.5vw, 46px);
}

/* ── HERO: PRIMEIRO PICO ────────────────────────────────────────────────── */
@media (min-width: 1025px) {
  .dl-hero {
    padding-top: clamp(138px, 13vw, 184px);
    padding-bottom: clamp(82px, 8.5vw, 118px);
  }

  .dl-hero__grid {
    gap: clamp(56px, 5.4vw, 78px);
  }

  /* O mock e a prova da promessa; ganha alguns pontos de escala. */
  .dl-stage {
    transform: scale(1.025);
    transform-origin: 52% 50%;
  }

  .dl-stage__glow {
    inset: 4% -11% -16% -11%;
    filter: blur(16px);
  }

  /* Shapes continuam presentes, mas deixam de disputar com o mock. */
  .dl-hero__shapes { opacity: 0.78; }
  .dl-hud { opacity: 0.76; }
}

.dl-checks {
  opacity: 0.86;
}

/* ── DESAFIO: NARRATIVA, MAS SEM VIRAR OUTRO HERO ───────────────────────── */
#desafio .dl-callout {
  box-shadow: none;
  border-color: rgba(255,255,255,0.075);
  background: rgba(255,255,255,0.025);
}

#desafio .dl-ghost {
  opacity: 0.78;
}

/* ── EDITOR: INTERFACE PRIMEIRO, ILUSTRACAO DE APOIO ────────────────────── */
@media (min-width: 1025px) {
  #editor .dl-editor__desenho {
    width: clamp(184px, 15.5vw, 228px);
    right: clamp(-30px, -2vw, -14px);
    opacity: 0.82;
    filter: saturate(0.92);
  }

  #editor .dl-ed {
    transform: scale(1.018);
    transform-origin: 50% 50%;
    box-shadow: 0 30px 62px -38px rgba(0,0,0,0.92);
  }
}

/* ── RECURSOS: O MOCK PASSA A SER O ASSUNTO ─────────────────────────────── */
@media (min-width: 861px) {
  /* A aba selecionada deixa de virar um cartao branco inteiro. O acento indica
     selecao, mas quem chama o olho e a tela do produto ao lado. */
  .dl-root #recursos .dl-feature--aba.is-ativo {
    background: rgba(129,140,248,0.075);
    color: inherit;
    box-shadow: inset 3px 0 0 rgba(129,140,248,0.68);
  }

  #recursos .dl-feature--aba.is-ativo .dl-feature__title {
    color: var(--strong);
  }
  #recursos .dl-feature--aba.is-ativo .dl-feature__desc {
    color: var(--subtle);
  }
  #recursos .dl-feature--aba.is-ativo .dl-index {
    color: var(--placeholder);
  }
  #recursos .dl-feature--aba.is-ativo .dl-feature__icon {
    color: #fff;
    background: rgba(129,140,248,0.20);
    border-color: rgba(129,140,248,0.34);
  }

  .dl-root #recursos .dl-feature--aba:hover {
    background: rgba(255,255,255,0.018);
  }

  #recursos .dl-browser {
    box-shadow: 0 24px 48px -28px rgba(0,0,0,0.72);
  }

  /* As esteiras continuam vivas, apenas deixam de correr como banner. */
  #recursos .dl-esteira__linha {
    animation-duration: 39s;
  }
  #recursos .dl-esteira__linha--dir {
    animation-duration: 45s;
  }
  #recursos .dl-esteira__linha:last-child {
    animation-duration: 42s;
  }
}

/* ── FLOW: UM GRANDE CAPITULO, NAO UMA SEQUENCIA DE CINCO CLIMAXES ──────── */
.dl-manifesto__forma--a,
.dl-manifesto__forma--b {
  opacity: 0.62;
}

/* O fechamento ganha forca justamente porque perde a segunda ilustracao humana.
   A cena do funil abre o capitulo; as tres telas provam o produto; a frase fecha. */
.dl-manifesto__remate {
  grid-template-columns: 1fr !important;
  max-width: 780px !important;
  margin-left: auto !important;
  margin-right: auto !important;
  text-align: center;
  gap: 0 !important;
}

.dl-manifesto__remate-img {
  display: none !important;
}

.dl-manifesto__remate .dl-manifesto__fecho {
  order: 1 !important;
  max-width: 760px;
  margin-inline: auto;
}

/* Os tres mocks continuam sendo a prova, mas perdem um pouco da cara de card
   promocional para parecer mais demonstracao de produto. */
.dl-flowtela {
  border-radius: 17px;
}

.dl-flowtela__quadro {
  box-shadow: 0 8px 22px -19px rgba(10,10,11,0.42);
}

/* ── POR QUE OMNIMOB: PAREDE COMO ATMOSFERA, NAO COMO SEGUNDA PAGINA ────── */
/* Quase a altura da tela: a parede e o assunto da secao, e com 620px ela
   aparecia pela fresta. E este seletor que vence o min-height de .dl-porque
   (id contra classe), entao a altura se ajusta AQUI. */
#porque {
  min-height: clamp(680px, 92vh, 1040px);
}

#porque .dl-porque__fundo.is-na-vista {
  opacity: 0.68;
  filter: saturate(0.74) brightness(0.82);
}

#porque .dl-porque__fundo::after {
  background: radial-gradient(
    ellipse 66% 70% at 50% 50%,
    rgba(10,10,11,0.96) 0%,
    rgba(10,10,11,0.88) 42%,
    rgba(10,10,11,0.48) 68%,
    rgba(10,10,11,0.08) 88%
  );
}

/* No desktop o hover revela a parede e o titulo sai quase de vez: a parede e
   o conteudo desta secao, e o titulo ja foi lido antes de o mouse chegar. */
@media (hover: hover) and (pointer: fine) {
  #porque:hover .dl-porque__frente {
    opacity: 0.06;
    filter: blur(8px);
  }

  #porque:hover .dl-porque__fundo::after {
    opacity: 0.72;
  }
}

/* ── APP: UMA NOTA DE FUTURO, NAO MAIS UM PICO VISUAL ───────────────────── */
#aplicativo::before {
  opacity: 0.52;
}

@media (min-width: 1025px) {
  #aplicativo .dl-app-soon__visual img {
    width: min(88%, 680px);
    opacity: 0.80;
    filter: drop-shadow(0 24px 44px rgba(0,0,0,0.22));
    translate: clamp(18px, 2.8vw, 44px) clamp(18px, 2.4vw, 34px);
  }
}

/* ── CTA FINAL: SEGUNDO PICO ────────────────────────────────────────────── */
.dl-cta {
  padding: calc(clamp(64px, 8vw, 112px) + var(--fecho-invasao) + var(--degrade-h)) 0 clamp(88px, 11vw, 152px);
}

.dl-fecho__fundo {
  opacity: 1;
}


/* ── TABLET / MOBILE ────────────────────────────────────────────────────── */
@media (max-width: 1024px) {
  /* Em tela estreita nao se tenta criar diferenca de escala pelo deslocamento. */
  #editor .dl-ed { transform: none; }

  .dl-manifesto__remate {
    text-align: left;
    margin-left: 0 !important;
    margin-right: 0 !important;
  }

  .dl-manifesto__remate .dl-manifesto__fecho {
    margin-left: 0;
    margin-right: 0;
  }
}

@media (max-width: 760px) {
  /* No celular a densidade ja e alta por natureza; nao comprimimos ainda mais. */
  #recursos,
  #integracoes,
  #porque,
  #planos {
    --pad-sec: clamp(58px, 16vw, 78px);
  }

  #aplicativo .dl-app-soon__visual img {
    opacity: 0.92;
    width: min(100%, 520px);
  }

  /* Parede continua atmosferica sem depender de hover. */
  #porque .dl-porque__fundo.is-na-vista {
    opacity: 0.58;
    filter: saturate(0.72) brightness(0.80);
  }
}

/* OMNIMOB_HIERARQUIA_EDITORIAL_V3_FIM */
`;
