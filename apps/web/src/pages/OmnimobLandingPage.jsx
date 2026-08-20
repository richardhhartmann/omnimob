import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSeo } from "../utils/seo";
import { EfeitosProvider, SeletorDeEfeitos, useEfeitos } from "../components/Efeitos.jsx";
import { StaggeredMenu } from "../components/StaggeredMenu.jsx";
import {
  Buildings,
  Crown,
  PaintBrushBroad,
  ChartLineUp,
  Megaphone,
  UsersThree,
  ShieldCheck,
  FacebookLogo,
  InstagramLogo,
  CloudArrowUp,
  Sparkle,
  Globe,
  ChatCircleText,
  CreditCard,
  EnvelopeSimple,
  FileArrowUp,
  LinkSimple,
} from "@phosphor-icons/react";
import { api } from "../api";
import { OmnimobSplash } from "../components/OmnimobSplash";
import DriftWall from "../components/DriftWall";
import ElectricBorder from "../components/ElectricBorder";
import BounceCards from "../components/BounceCards";
import LineSidebar from "../components/LineSidebar";
import Counter from "../components/Counter";
import SpecularButton from "../components/SpecularButton";
import { TrialModal } from "../components/TrialModal";
import { PLANOS, RECURSOS_PLANOS, planoInfo } from "../utils/planos";
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
  LogoLockup,
  Reveal,
  Scallop,
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
/* ────────────────────────────────────────────────────────────────────────────
   O three.js e o Vanta entram por `import()`, e não pelo topo do arquivo.

   Estáticos, eles somavam 253 kB ao pacote principal — baixados por TODA
   visita, inclusive a de quem abre o painel e nunca vê a landing, e inclusive a
   de quem vai rodar sem shader nenhum. Sob demanda, quem está no nível leve ou
   mínimo simplesmente não os baixa.

   A promessa é guardada porque as duas seções pedem o mesmo pacote: sem o
   cache, entrar na página com as duas visíveis dispararia dois downloads da
   mesma coisa. */
/* O cursor fantasma também é WebGL — e importava o three e quatro passes de
   pós-processamento no topo do módulo, o que sozinho segurava o three inteiro
   dentro do pacote principal. Carregado assim, ele só desce para quem vai vê-lo
   de fato. Sem `Suspense` visível: o que aparece é fumaça sobre um fundo que já
   está lá, e um "carregando…" no lugar dela seria pior que a espera. */
const GhostCursor = lazy(() => import("../components/GhostCursor"));

let promessaDoVanta = null;

function carregarVanta() {
  if (!promessaDoVanta) {
    promessaDoVanta = Promise.all([
      import("three"),
      import("vanta/dist/vanta.fog.min"),
      import("vanta/dist/vanta.waves.min"),
    ])
      .then(([three, fog, waves]) => ({
        THREE: three,
        FOG: fog.default || fog,
        WAVES: waves.default || waves,
      }))
      /* Falha de rede não pode derrubar a seção: o fundo estático já está
         desenhado por baixo, e sem shader a página continua inteira. Zerar a
         promessa deixa a próxima tentativa acontecer. */
      .catch(() => { promessaDoVanta = null; return null; });
  }
  return promessaDoVanta;
}

/* Interpolação de cor em hexadecimal.
 *
 * Era `THREE.Color.lerp`, e usá-lo obrigava o three a existir no escopo do
 * módulo — justamente o que este arquivo deixou de fazer. São doze linhas de
 * aritmética contra 253 kB de dependência carregada à toa. */
function misturarHex(de, para, fator) {
  const canal = (c, deslocamento) => (c >> deslocamento) & 0xff;
  let saida = 0;
  for (const deslocamento of [16, 8, 0]) {
    const a = canal(de, deslocamento);
    const b = canal(para, deslocamento);
    saida |= Math.round(a + (b - a) * fator) << deslocamento;
  }
  return saida;
}

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
const RECURSOS = [
  { Icon: Buildings, title: "Gestão de imóveis", desc: "Cadastre imóveis com fotos, atributos, tipos e status. Tudo organizado e pronto para divulgar.", tela: "imoveis", url: "omnimob.app / imóveis", legenda: "PAINEL WEB · IMÓVEIS" },
  { Icon: PaintBrushBroad, title: "Vitrine personalizável", desc: "Um editor visual intuitivo de arrastar e soltar para montar a página pública da sua imobiliária, do seu jeito.", tela: "vitrine", url: "omnimob.app / vitrine / editar", legenda: "PAINEL WEB · EDITOR DE VITRINE" },
  { Icon: ChartLineUp, title: "Leads e métricas", desc: "Capture interessados pela vitrine e acompanhe visualizações, leads e vendas por imóvel.", tela: "metricas", url: "omnimob.app / métricas", legenda: "PAINEL WEB · MÉTRICAS" },
  { Icon: Megaphone, title: "Publicação em redes", desc: "Divulgue imóveis no Facebook, Instagram e WhatsApp com legenda pronta em poucos cliques.", tela: "redes", url: "omnimob.app / publicações", legenda: "PAINEL WEB · PUBLICAÇÕES" },
  { Icon: UsersThree, title: "Usuários e permissões", desc: "Crie cargos com permissões granulares para corretores, marketing, gerência e mais.", tela: "usuarios", url: "omnimob.app / usuários", legenda: "PAINEL WEB · EQUIPE" },
  { Icon: ShieldCheck, title: "Multi-tenant seguro", desc: "Cada imobiliária com seus próprios dados, usuários e vitrine — isolados e seguros.", tela: "tenants", url: "omnimob.app / admin", legenda: "SUPER-ADMIN · TENANTS" },
];

// De quantos em quantos milissegundos o carrossel avança sozinho.
const RECURSO_INTERVALO = 3000;
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

/* Marca do WhatsApp, o glifo oficial — o mesmo caminho já usado nos previews de
   publicação do cadastro (WA_ICON em PropertyForm). O do Phosphor é desenho
   próprio da família: um telefone em traço grosso dentro de um balão. Ao lado
   do "f" do Facebook e da câmera do Instagram, que são as marcas de verdade,
   só ele destoa.

   A assinatura imita a dos ícones do Phosphor (`size`) para o componente entrar
   nas mesmas listas sem caso especial. `weight` é aceito e descartado: quem
   chama passa "fill" para os outros ícones, e aqui o preenchimento já é o
   próprio desenho. A cor sai de currentColor, então o glifo acompanha o
   contexto — branco sobre a cor da marca, escuro sobre fundo claro. */
function WhatsappMarca({ size = 24, weight, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...rest}>
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" />
    </svg>
  );
}

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

/* `cor` é qualquer fundo CSS (as marcas com degradê usam o mesmo do painel, em
   PropertyForm) e `texto` só aparece quando o fundo é claro demais para branco
   — caso do dourado das métricas. */
/* `curto` é o rótulo que aparece no baralho. O leque deixa ~77px de cada peça à
   mostra, e nomes como "Formulário de contato" saíam cortados no meio — numa
   seção cujo trabalho é justamente nomear os canais. O nome inteiro continua em
   `name`, que é o que vai para a lista lida por leitor de tela. */
const INTEGRACOES = [
  { type: "REDES", name: "Facebook", Icon: FacebookLogo, cor: "#1877f2" },
  {
    type: "REDES",
    name: "Instagram",
    Icon: InstagramLogo,
    cor: "linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)",
  },
  { type: "MENSAGENS", name: "WhatsApp", Icon: WhatsappMarca, cor: "#25d366" },
  { type: "IA", name: "Google Gemini", curto: "Gemini", Icon: Sparkle, cor: "linear-gradient(135deg,#4285f4,#9b72cb,#d96570)" },
  { type: "VITRINE", name: "Página pública", curto: "Vitrine", Icon: Globe, cor: ACCENT },
  { type: "LEADS", name: "Formulário de contato", curto: "Contato", Icon: ChatCircleText, cor: MINT },
  { type: "MÉTRICAS", name: "Painel de desempenho", curto: "Painel", Icon: ChartLineUp, cor: GOLD, texto: "#0a0a0b" },
  { type: "MIGRAÇÃO", name: "Importação de planilha", curto: "Planilhas", Icon: FileArrowUp, cor: "#0f766e" },
  { type: "DOMÍNIO", name: "Domínio próprio", curto: "Domínio", Icon: LinkSimple, cor: "#111827" },
];

// Faixa horizontal de destaques. Cards claros funcionam como "marca-texto"
// no meio dos escuros — mesma ideia da faixa de depoimentos da referência.
/* `detalhe` é o que aparece ao clicar na peça, na parede de destaques. Texto
   novo — confira a redação antes de publicar; o resto dos campos é o que já
   existia na faixa. */
const FAIXA_EXTRA = [
  {
    kind: "text",
    title: "Leads direto no painel",
    desc: "O interesse começa na vitrine e chega até sua equipe sem planilha no caminho.",
    detalhe: "Quando um visitante entra em contato por um imóvel, o lead fica associado à imobiliária e pode ser acompanhado pelo painel. Você centraliza imóvel, interessado e origem da oportunidade no mesmo lugar.",
  },
  {
    kind: "stat",
    value: "1",
    label: "Painel para toda a operação",
    tone: "mint",
    detalhe: "Imóveis, leads, usuários, clientes, divulgação e desempenho convivem dentro da mesma plataforma. Menos abas abertas, menos informação espalhada e mais contexto para sua equipe trabalhar.",
  },
  {
    kind: "text",
    title: "Sua marca, não a nossa",
    desc: "Cores, identidade e conteúdo da vitrine ficam com a cara da sua imobiliária.",
    detalhe: "A Omnimob permite personalizar cores, textos, destaques, banners e a organização dos blocos. A tecnologia fica por trás — quem aparece para o cliente é a sua marca.",
  },
  {
    kind: "text",
    title: "Salvo enquanto você cria",
    desc: "A vitrine acompanha suas alterações sem depender de um botão Salvar a cada passo.",
    detalhe: "As mudanças realizadas no editor são salvas automaticamente. Você pode ajustar textos, posições, cores e blocos com mais fluidez sem interromper o processo a cada alteração.",
  },
  {
    kind: "stat",
    value: "50",
    label: "Alterações que você pode retroceder.",
    tone: "accent",
    detalhe: "O editor mantém até cinquenta etapas no histórico de desfazer e refazer. Isso deixa você experimentar layouts, posições e estilos sem medo de perder uma versão que estava funcionando melhor.",
  },
  {
    kind: "text",
    title: "Desempenho por imóvel",
    desc: "Entenda quais imóveis recebem atenção e quais realmente geram oportunidades.",
    detalhe: "A plataforma registra eventos de visualização, leads e vendas ligados aos imóveis. Assim, o cadastro deixa de ser apenas uma ficha e passa a carregar também o histórico de desempenho daquele anúncio.",
  },
  {
    kind: "text",
    title: "Uma ficha, vários usos",
    desc: "Cadastre a informação uma vez e reaproveite em toda a jornada do imóvel.",
    detalhe: "Título, preço, endereço, atributos, imagens e demais informações partem do mesmo cadastro. A vitrine, os insights e os recursos de divulgação trabalham sobre essa única fonte de dados.",
  },
  {
    kind: "text",
    title: "Equipe com acessos diferentes",
    desc: "Administração, operação e edição da vitrine não precisam ter as mesmas permissões.",
    detalhe: "A plataforma diferencia funções como administrador, agente e editor de vitrine. Isso permite organizar a equipe de acordo com o papel de cada pessoa sem entregar o mesmo nível de acesso para todo mundo.",
  },
  {
    kind: "text",
    title: "Imagens prontas para a vitrine",
    desc: "Fotos dos imóveis organizadas e disponíveis para uso direto na experiência pública.",
    detalhe: "As imagens ficam associadas ao cadastro do imóvel, com ordenação própria e armazenamento em nuvem. Assim, a galeria exibida para o visitante parte diretamente do conteúdo administrado pela imobiliária.",
  },
  {
    kind: "text",
    title: "Do painel para a vitrine",
    desc: "Ativou o imóvel? Ele já pode fazer parte da experiência pública da imobiliária.",
    detalhe: "O mesmo catálogo administrado internamente alimenta a vitrine pública. Isso reduz retrabalho e evita manter uma relação de imóveis no sistema e outra completamente separada no site.",
  },
  {
    kind: "stat",
    value: "2",
    label: "Experiências de layout por vitrine",
    tone: "gold",
    detalhe: "Desktop e mobile possuem layouts independentes. Você pode tratar cada tela como uma experiência própria ou começar pelo desktop e copiar a estrutura para o celular antes dos ajustes finais.",
  },
  {
    kind: "text",
    title: "Sua operação cresce junto",
    desc: "A Omnimob foi construída para atender várias imobiliárias sem misturar nenhuma delas.",
    detalhe: "Cada imobiliária possui seu próprio contexto de usuários, imóveis, leads, configurações e vitrine. A arquitetura multi-tenant permite que a plataforma cresça mantendo cada operação logicamente isolada.",
  },
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

/* Rodapé do preço, por período. O anual é cobrado de uma vez — dizer isso na
   própria etiqueta evita a leitura de que "R$ 1.415,50/ano" seja parcelado. */
const NOTA_DO_PERIODO = {
  mensal: "cobrado mensalmente",
  anual: "cobrado uma vez por ano",
};

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
const PLANS_BASE = PLANOS.map((p) => ({
  key: p.key,
  name: p.nome,
  desc: p.descricao,
  price: "",
  per: "",
  nota: "",
  carregando: true,
  linhas: LINHAS_PLANO.map((r) => ({ label: r.label, incluso: incluiRecurso(p.key, r) })),
  resumo: resumoDoPlano(p.key),
  highlight: p.key === "PROFISSIONAL",
}));

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
function usePrecosVigentes(periodo) {
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
  const temAnual = carregando || Object.values(precos).some((p) => p?.anual);

  const planos = useMemo(
    () =>
      PLANS_BASE.map((p) => {
        if (carregando) return p; // p.carregando = true; o cartão desenha o esqueleto
        const vivo = precos?.[p.key];
        // Plano sem preço anual cadastrado continua mostrando o mensal: some a
        // vantagem, não o plano.
        const doPeriodo = vivo?.[periodo] || vivo?.mensal;
        if (!doPeriodo) {
          return { ...p, carregando: false, price: "Sob consulta", per: "", nota: "fale com o time" };
        }
        const ehAnual = periodo === "anual" && Boolean(vivo?.anual);
        return {
          ...p,
          carregando: false,
          /* Número e sufixo separados: o valor vai grande, o "/mês" pequeno ao
             lado. Vêm partidos do servidor — ver o comentário em
             `precosDosPlanos`. O `rotulo` inteiro fica de reserva para o caso de
             uma resposta antiga, ainda sem os campos novos. */
          price: doPeriodo.numero || doPeriodo.rotulo,
          per: doPeriodo.numero ? doPeriodo.sufixo || "" : "",
          valor: doPeriodo.valor,
          nota: NOTA_DO_PERIODO[ehAnual ? "anual" : "mensal"],
          economia: ehAnual ? vivo.economia || null : null,
        };
      }),
    [precos, periodo, carregando],
  );

  return { planos, temAnual, carregando };
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

/* Alternador mensal / anual.
   Um grupo de rádio de verdade (não dois botões): são opções mutuamente
   exclusivas de um mesmo campo, e é o que faz as setas do teclado andarem entre
   elas sem nenhum código nosso. */
function PeriodoToggle({ valor, aoTrocar, selo }) {
  return (
    <div className="dl-periodo" role="radiogroup" aria-label="Forma de cobrança">
      <span className="dl-periodo__pilula" data-em={valor} aria-hidden="true" />
      {[
        { chave: "mensal", rotulo: "Mensal" },
        { chave: "anual", rotulo: "Anual" },
      ].map((op) => (
        <button
          key={op.chave}
          type="button"
          role="radio"
          aria-checked={valor === op.chave}
          tabIndex={valor === op.chave ? 0 : -1}
          className={`dl-periodo__opt${valor === op.chave ? " is-on" : ""}`}
          onClick={() => aoTrocar(op.chave)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              e.preventDefault();
              aoTrocar(valor === "mensal" ? "anual" : "mensal");
            }
          }}
        >
          {op.rotulo}
          {op.chave === "anual" && selo ? (
            <span className="dl-periodo__selo dl-mono">{selo}</span>
          ) : null}
        </button>
      ))}
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
  /* A célula fala do EDITOR de vitrine, e o que estava aqui era uma vitrine
     pronta — banner e cartões, a página publicada, não a ferramenta que a monta.
     Este é um recorte do editor de verdade: barra com desfazer/refazer e o par
     desktop/mobile, painel lateral com abas e tema de cores, e a tela com os
     blocos, um deles selecionado. Continua tudo em silhueta, como os outros
     mocks — o que interessa é reconhecer a ferramenta, não ler o conteúdo. */
  if (tipo === "vitrine") {
    return (
      <div className="dl-builder">
        <div className="dl-builder__barra">
          <span className="dl-builder__acoes">
            <i /><i />
          </span>
          <span className="dl-builder__modos">
            <i className="is-on" /><i />
          </span>
          <span className="dl-mono dl-builder__salvo">● SALVO</span>
        </div>

        <div className="dl-builder__corpo">
          <aside className="dl-builder__painel">
            <span className="dl-builder__abas">
              <i className="is-on" /><i />
            </span>
            <span className="dl-skel dl-builder__rot" />
            <span className="dl-builder__cores">
              {/* Quatro amostras, não cinco: a quinta não cabia na largura do
                  painel e escapava por fora dele. */}
              {[ACCENT, GOLD, MINT, "#0ea5e9"].map((cor, i) => (
                <i key={cor} className={i === 0 ? "is-on" : ""} style={{ background: cor }} />
              ))}
            </span>
            <span className="dl-skel dl-builder__rot" style={{ width: "46%" }} />
            {[68, 40].map((v) => (
              <span key={v} className="dl-builder__slider">
                <i style={{ width: `${v}%` }} />
              </span>
            ))}
            {/* Os campos de dados da imobiliária fecham o painel por baixo — é o
                que ele tem no editor de verdade, e é o que impede a coluna de
                terminar no meio quando a moldura estica. */}
            <span className="dl-builder__campos">
              <i /><i />
            </span>
          </aside>

          <div className="dl-builder__tela">
            {BUILDER_BLOCOS.map((b) => (
              <span
                key={b.id}
                className={`dl-builder__bloco${b.sel ? " is-sel" : ""}`}
                style={{ gridArea: b.id }}
              >
                <em className="dl-mono">{b.nome}</em>
                {b.sel
                  ? ["no", "ne", "so", "se"].map((quina) => (
                      <i key={quina} className={`dl-builder__alca dl-builder__alca--${quina}`} />
                    ))
                  : null}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
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
const TELAS_CHEIAS = new Set(["imoveis", "vitrine", "tenants"]);

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
                recurso={f}
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
        <BrowserMock recurso={RECURSOS[ativo]} indice={ativo} />
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
/* Onde o leque de canais deixa de caber na tela — ver BaralhoDeCanais. Bate com
   o ponto em que o próprio BounceCards.css já encolhe a peça, que era o sinal
   de que ali o arranjo já estava no limite. */
const LEQUE_APERTADO = "(max-width: 900px)";
const INTERVALO_PLANO = 5000;

/* Cor de cada plano no carrossel. Uma escala que sobe junto com os planos: azul
   é o tom de entrada, roxo é a cor da marca e dourado é o que a Omnimob já usa
   para o que é topo de linha.

     cor    contorno neon do cartão em foco
     onda   cor das ondas do fundo (Vanta WAVES) — o Básico não tem, e é isso
            que faz a escada existir: o fundo neutro dele é a referência de onde
            a progressão começa
     tinta  reserva estática para quem pede movimento reduzido, onde as ondas
            não rodam
     realce cor das peças de interface que acompanham o plano (etiqueta, ponto do
            carrossel, botão "ver todos os recursos"). Nulo no Básico, e não por
            falta: ele é o degrau neutro da escada, então fica com o lilás do
            tema — a cor de destaque começa a existir a partir do Profissional.
            É separada de `cor` porque aquela é a do NEON, que pode ser mais
            saturada do que se lê bem em texto de 8 px */
const FLARE = {
  BASICO: { cor: "#3882f8b4", onda: null, tinta: null, realce: null },
  PROFISSIONAL: { cor: "#a855f7", onda: 0x5331b6, tinta: "rgba(83,49,182,0.22)", realce: "#a855f7" },
  PREMIUM: { cor: "#f0c24b", onda: 0xa0732e, tinta: "rgba(160,115,46,0.22)", realce: "#f0c24b" },
};

/* Cor do contorno elétrico de cada plano — e quem NÃO tem contorno.

   O Básico fica de fora de propósito: o brilho é o destaque dos planos pagos, e
   acender os três iguala justamente o que a seção precisa diferenciar. `null`
   aqui não é "ainda não escolhi", é "este não acende".

   O contorno substituiu o antigo flare de sombra interna no hover — ver o bloco
   `.dl-plan:hover` no CSS, que só guarda o realce do botão agora. */
const BORDA_ELETRICA = {
  BASICO: null,
  PROFISSIONAL: "#a855f7",
  PREMIUM: "#ffb323",
};

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
      className={`dl-plan__recursos${resumido ? " is-resumido" : ""}`}
      id={id}
      style={altura ? { height: `${altura}px` } : undefined}
    >
      <ul className="dl-plan__list" ref={completaRef} aria-hidden={resumido || undefined}>
        {plano.linhas.map((l, i) => (
          <li key={l.label} className={l.incluso ? "" : "is-off"} style={{ "--i": i }}>
            <span aria-hidden="true">{l.incluso ? <IconeCheck size={12} /> : <IconeX size={11} />}</span>
            {l.label}
          </li>
        ))}
      </ul>

      {/* O resumo só existe no modo compacto. Numa tela alta os três planos
          cabem inteiros lado a lado, e é a tabela completa que permite comparar
          de relance — resumir ali tiraria a única vantagem do desktop. */}
      {compacto ? (
        <ul className="dl-plan__list dl-plan__list--resumo" ref={resumoRef} aria-hidden={!resumido || undefined}>
          {plano.resumo.map((l) => (
            <li key={l.label} className={l.heranca ? "is-heranca" : ""}>
              <span aria-hidden="true"><IconeCheck size={12} /></span>
              {l.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// A cor de realce de um plano, com o lilás do tema como piso (Básico).
function realceDoPlano(chave) {
  return FLARE[chave]?.realce || "var(--accent-soft)";
}

// Primeira cor de onda da escala: o efeito nasce nela, então a primeira
// aparição já entra na cor certa em vez de atravessar meio espectro até ela.
const ONDA_INICIAL = FLARE.PROFISSIONAL.onda;


function Planos({ planos, aoTestar }) {
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

  /* Cartão sob o mouse. É o que rege o fundo no desktop, onde não existe
     "cartão em foco": lá os três estão à vista ao mesmo tempo, e quem escolhe
     um é o cursor. No celular ele fica sempre nulo — toque não tem hover. */
  const [sobHover, setSobHover] = useState(null);
  /* ── Fundo em ondas ────────────────────────────────────────────────────
     O plano escolhido tinge o fundo da seção, e a troca é gradual porque a cor
     das ondas é interpolada quadro a quadro — não trocada de uma vez. Quem é
     "o escolhido" muda com o formato da tela: no celular é o cartão em foco no
     carrossel; no desktop, o que está sob o mouse (e, sem mouse em cima, o
     fundo volta ao neutro).

     Dá para mexer na cor sem recriar nada: o onUpdate do WAVES lê
     `options.color` a cada quadro, então basta escrever ali. Uma instância
     nova por plano significaria destruir e criar um contexto WebGL a cada
     cinco segundos.

     A instância fica em variável local do efeito (não em estado nem em ref):
     é a mesma armadilha do FOG lá embaixo — guardada fora, a limpeza fecha
     sobre o valor anterior e sobra um canvas órfão no StrictMode. */
  const ondaRef = useRef(null);
  // Números hexadecimais crus, não objetos de cor: ver `misturarHex` lá em cima.
  const corOnda = useRef(ONDA_INICIAL);
  const alvoOnda = useRef(ONDA_INICIAL);
  const { podeWebGL } = useEfeitos();

  /* O plano que manda na cor do fundo, e a cor dele. No desktop o hover; no
     carrossel, o foco. Nulo (Básico, ou nenhum cartão sob o mouse) apaga a
     camada — é o estado neutro de onde a escala de cores parte. */
  const planoDaOnda = emCarrossel ? planos[atual] : (sobHover != null ? planos[sobHover] : null);
  const ondaAtual = FLARE[planoDaOnda?.key]?.onda || null;

  /* O contexto WebGL só nasce quando alguém pede cor pela primeira vez. Criar
     junto com a seção custaria uma tela 3D rodando atrás de um fundo neutro em
     toda visita que nunca passa o mouse por um plano. */
  const [ondaPedida, setOndaPedida] = useState(false);
  useEffect(() => {
    if (ondaAtual) setOndaPedida(true);
  }, [ondaAtual]);

  useEffect(() => {
    const el = ondaRef.current;
    if (!el || !ondaPedida || !visivel) return undefined;
    /* Máquina que não aguenta shader fica com a tinta estática de baixo — que
       já está desenhada e acompanha o mesmo plano. Não é degrau de qualidade:
       é o clarão colorido sem a malha animada por cima. */
    if (!podeWebGL) return undefined;

    let efeito = null;
    let quadro = null;
    let observador = null;
    let cancelado = false;

    carregarVanta().then((vanta) => {
      if (cancelado || !vanta) return;
      efeito = vanta.WAVES({
        el,
        THREE: vanta.THREE,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200.0,
        minWidth: 200.0,
        scale: 1.0,
        scaleMobile: 1.0,
        color: corOnda.current,
      });
      montarLaco();
    });

    function montarLaco() {

    /* O WAVES mede o elemento uma vez e só remede no resize da janela. Como a
       camada acompanha a altura da seção — que muda quando alguém abre a
       tabela de um plano —, sem isto o canvas ficaria com a altura antiga e as
       ondas terminariam no meio do fundo.

       Remedir sozinho, porém, faz o fundo piscar. O resize() do Vanta chama
       setSize no renderer, que realoca o buffer do WebGL — e buffer realocado
       nasce transparente. O retorno do ResizeObserver é entregue DEPOIS dos
       requestAnimationFrame do quadro e ANTES da pintura, então quem vai para
       a tela naquele quadro é o buffer vazio. Uma remedida = um quadro em
       branco; e como a tabela dos planos abre em 0,42s mudando de altura a
       cada quadro, viravam dezenas deles seguidos.

       Redesenhar aqui mesmo, ainda dentro do retorno de chamada, devolve a
       imagem ao buffer antes da pintura e o quadro em branco deixa de existir.
       Tem de ser o render direto: animationLoop() agenda o próprio rAF, e o
       laço passaria a rodar duas vezes por quadro. */
    observador = new ResizeObserver(() => {
      efeito.resize();
      if (efeito.renderer && efeito.scene && efeito.camera) {
        efeito.renderer.render(efeito.scene, efeito.camera);
      }
    });
    observador.observe(el);

    quadro = requestAnimationFrame(function passo() {
      // Perto o bastante do alvo: para de escrever e só mantém o laço vivo
      // para a próxima troca de plano.
      if (corOnda.current !== alvoOnda.current) {
        corOnda.current = misturarHex(corOnda.current, alvoOnda.current, 0.05);
        // A mistura converge sem nunca chegar: a 1/255 do alvo, encosta.
        if (Math.abs(corOnda.current - alvoOnda.current) <= 0x010101) corOnda.current = alvoOnda.current;
        efeito.options.color = corOnda.current;
      }
      quadro = requestAnimationFrame(passo);
    });
    }

    return () => {
      cancelado = true;
      if (quadro) cancelAnimationFrame(quadro);
      observador?.disconnect();
      efeito?.destroy();
    };
  }, [ondaPedida, visivel, podeWebGL]);

  // O alvo muda com o plano escolhido; o laço acima leva a cor até ele. Quando
  // não há plano (Básico, ou mouse fora), o alvo fica onde estava: o que some é
  // a camada inteira, e guardar a última cor evita a volta atravessando o
  // espectro na próxima vez que ela acender.
  useEffect(() => {
    if (ondaAtual) alvoOnda.current = ondaAtual;
  }, [ondaAtual]);

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
    <div
      className="dl-plans-caixa"
      ref={caixaRef}
      /* Os pontos do carrossel vivem FORA dos cartões, então a cor do plano em
         foco precisa descer por aqui — de dentro do cartão ela não alcançaria. */
      style={{ "--realce": realceDoPlano(planos[atual]?.key) }}
    >
      {/* Camada do fundo: fica atrás do conteúdo da seção inteira (z-index -1
          dentro do .dl-wrap, que é quem cria o contexto de empilhamento) e
          extravasa o respiro lateral para o clarão não terminar numa quina.
          A tinta estática só aparece quando as ondas não podem rodar. */}
      <div
        className={`dl-plans-onda${ondaAtual ? " is-on" : ""}`}
        ref={ondaRef}
        aria-hidden="true"
        // A reserva estática segue o MESMO plano que rege as ondas, e não o
        // cartão em foco: no desktop quem manda é o mouse, e amarrada ao índice
        // do carrossel ela ficava presa no primeiro plano — ou seja, em nada,
        // já que o Básico é o degrau neutro da escala.
        style={{ "--tinta": FLARE[planoDaOnda?.key]?.tinta || "transparent" }}
      />

      <div
        className="dl-plans"
        ref={trilhoRef}
        // Pointerdown e não scroll: rolagem também é disparada pelo passo
        // automático, e aí ele se desligaria sozinho no primeiro movimento.
        onPointerDown={() => setManual(true)}
      >
        {planos.map((p, i) => {
          // Resumido só no carrossel: no desktop os três aparecem juntos e a
          // tabela inteira é o que permite comparar de relance.
          const resumido = compacto && !abertos[p.key];
          return (
          <Reveal
            key={p.key}
            className={`dl-plan${p.highlight ? " is-highlight" : ""}${i === atual ? " is-atual" : ""}`}
            delay={i * 110}
            style={{
              "--flare": FLARE[p.key]?.cor || "var(--accent-soft)",
              "--realce": realceDoPlano(p.key),
            }}
            // Só o desktop usa: é daqui que sai a cor do fundo da seção quando
            // não há carrossel. A saída só limpa se o índice ainda for o dele,
            // senão o mouse passando de um cartão para o vizinho apagaria o
            // que o vizinho acabou de acender.
            onMouseEnter={() => setSobHover(i)}
            onMouseLeave={() => setSobHover((h) => (h === i ? null : h))}
          >
            {/* Contorno elétrico — só no cartão sob o mouse, e só nos planos que
                acendem. Montado sob demanda porque cada instância roda o próprio
                laço de canvas: três ligados o tempo todo seriam três desenhos
                por quadro para mostrar, no máximo, um. */}
            {BORDA_ELETRICA[p.key] && (emCarrossel ? i === atual : sobHover === i) ? (
              <ElectricBorder
                className="electric-border--moldura electric-border--so-raios"
                color={BORDA_ELETRICA[p.key]}
                speed={1}
                chaos={0.06}
                /* Acompanha o canto do cartão. No desktop os três dividem UMA
                   moldura e a célula não tem canto próprio — daí o zero. No
                   carrossel cada cartão é fechado em si, com 18px de raio, e um
                   traçado reto contornando canto arredondado sobra nas quatro
                   quinas. */
                borderRadius={emCarrossel ? 18 : 0}
              />
            ) : null}
            {/* A coroa fica pendurada na borda de cima do topo de linha, metade
                dentro e metade fora: é um selo pregado no cartão, não mais uma
                linha dentro dele. Ela sai na cor do próprio plano (dourada, no
                Premium), e o Profissional continua marcado pela etiqueta
                "MAIS POPULAR" — cada um com um sinal, sem os dois disputarem o
                mesmo. */}
            {p.key === "PREMIUM" ? (
              <span className="dl-plan__coroa" aria-hidden="true">
                <Crown size={13} weight="fill" />
              </span>
            ) : null}
            {p.highlight ? <span className="dl-plan__tag dl-mono">● MAIS POPULAR</span> : null}
            <h3 className="dl-plan__name">{p.name}</h3>
            <p className="dl-plan__desc">{p.desc}</p>
            {/* Enquanto o preço não chega, um esqueleto no lugar dele. O bloco
                mantém a altura nos dois estados, então a chegada do valor não
                empurra a lista de recursos para baixo.

                `aria-busy` + o texto para leitor de tela: visualmente o brilho
                do esqueleto já diz "está vindo", mas quem ouve a página não vê
                brilho nenhum — sem isso, o cartão simplesmente não teria preço. */}
            <div className="dl-plan__price" aria-busy={p.carregando || undefined}>
              {p.carregando ? (
                <>
                  {/* Um <strong> de verdade, com um espaço dentro: ele herda o
                      tamanho do preço e portanto ocupa EXATAMENTE a mesma linha
                      que o valor vai ocupar. Casar altura na mão (34px? 41px?)
                      erraria no primeiro ajuste de tipografia. */}
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
            {/* A economia fica logo abaixo do preço — é aqui que o olho para
                para comparar, e o valor em reais só existe por plano (no
                alternador caberia, no máximo, a média).

                Em LINHA PRÓPRIA, e não ao lado do valor: colada ao preço ela
                cabia no Básico e quebrava no Premium, cujo número é maior. Com
                um cartão quebrado e dois não, as listas de recursos dos três
                deixavam de começar na mesma altura. */}
            {!p.carregando && p.economia?.valor > 0 ? (
              <span className="dl-plan__economia dl-mono">
                economize {formatarBRL(p.economia.valor)}
              </span>
            ) : null}
            {/* Mesma ideia na etiqueta de baixo: a própria classe da nota, para
                a margem e a altura de linha serem as mesmas. */}
            <span
              className={`dl-mono dl-plan__nota${p.carregando ? " dl-esqueleto dl-esqueleto--nota" : ""}`}
              aria-hidden={p.carregando || undefined}
            >
              {p.carregando ? " " : p.nota}
            </span>

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
                className="dl-plan__mais"
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
            {/* Todo caminho da página leva ao teste — não existe mais "assinar
                sem testar". O plano escolhido aqui não muda o que o teste
                libera (ele libera tudo); vai junto como intenção, para o time
                saber com o que a pessoa se identificou. */}
            {/* O botão cheio marca "é este aqui". No desktop isso é fixo, e é o
                Profissional — ele está no meio de três, e o destaque diz qual
                deles recomendamos. No carrossel só existe um plano por vez: o
                destaque passa a seguir o cartão em foco, senão o botão cheio
                apareceria num cartão recuado enquanto o que está no centro fica
                com o contorno vazio. */}
            <Button
              as="button"
              type="button"
              variant={emCarrossel && i === atual ? "primary" : "outline"}
              className="dl-btn--block"
              onClick={() => aoTestar(p.key)}
            >
              Testar com este plano
            </Button>
          </Reveal>
          );
        })}
      </div>

      {emCarrossel ? (
        <div className="dl-plans__pontos">
          {planos.map((p, i) => (
            <button
              key={p.key}
              type="button"
              className={`dl-plans__ponto${i === atual ? " is-on" : ""}`}
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
function cartaoDaFaixa(c) {
  return (
    <div className={`dl-fcard dl-fcard--parede ${c.kind === "stat" ? `dl-fcard--${c.tone}` : ""}`}>
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
/* A fumaça só é montada perto da seção dela.

   Sem porteiro ela é um contexto WebGL com bloom e grão desenhando o tempo
   todo, mesmo com a seção a três telas de distância. O componente para o
   próprio laço quando o rastro apaga, mas o contexto continua ocupando memória
   de vídeo — e a página tem outros dois (as duas cenas do Vanta).

   Nada de invólucro posicionado em volta: o GhostCursor escreve
   `position: relative` no pai via style inline, e isso venceria a folha,
   zerando a altura da caixa. Ele é filho direto da seção, e só o `if` decide se
   existe. */
function FumacaQuandoVisivel() {
  const marcaRef = useRef(null);
  const [perto, setPerto] = useState(false);
  /* Cursor fantasma: canvas com laço próprio a cada quadro. É o primeiro a cair
     quando a máquina não dá conta — some sem deixar buraco, porque é enfeite
     sobre um fundo que já existe. */
  const { podeQuadroAQuadro } = useEfeitos();

  useEffect(() => {
    const el = marcaRef.current?.parentElement;
    if (!el || typeof IntersectionObserver === "undefined") { setPerto(true); return undefined; }
    const io = new IntersectionObserver(([e]) => setPerto(e.isIntersecting), { rootMargin: "300px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      {/* Âncora de zero altura: serve só para achar a seção pai sem envolver o
          canvas em nada — é o pai dele que precisa ser a seção. */}
      <span ref={marcaRef} aria-hidden="true" style={{ display: "none" }} />
      {perto && podeQuadroAQuadro ? (
        <Suspense fallback={null}>
        <GhostCursor
          color="#a99109"
          brightness={1}
          edgeIntensity={0}
          trailLength={50}
          inertia={0.5}
          grainIntensity={0.05}
          bloomStrength={0.1}
          bloomRadius={1.0}
          bloomThreshold={0.025}
          fadeDelayMs={1000}
          fadeDurationMs={1500}
        />
        </Suspense>
      ) : null}
    </>
  );
}

/* Baralho dos canais — substitui a grade de quatro colunas que havia aqui.

   O leque tem 12 peças, e a quantidade não está travada em lugar nenhum: as
   posições são calculadas pelo BounceCards a partir do número de itens e da
   largura medida. Acrescentar um canal em INTEGRACOES basta — no componente
   original isso exigiria editar um array paralelo de transformações, e esquecer
   dele empilharia o cartão novo em cima do último, sem erro.

   O contêiner acompanha a largura da tela porque o leque é horizontal: fixado
   em pixels, ele estouraria no celular e sobraria no monitor grande. */
function BaralhoDeCanais() {
  const caixaRef = useRef(null);
  const [largura, setLargura] = useState(1000);
  /* O leque abre os nove canais lado a lado, girados: ele precisa de largura, e
     abaixo de ~900px os das duas pontas ficam cortados pela borda da tela.
     Medido: sobram -2px a 900, -22 a 860, -68 a 768 e -102 a 700 — ou seja, não
     é um problema só de celular, é de tudo que não é desktop. Daí o corte em
     900 e não no ponto do carrossel (640).

     Abaixo dele a mesma lista vira esteira: um laço que corre sozinho e cabe em
     qualquer largura, porque não tenta mostrar tudo de uma vez. */
  const semEspacoParaLeque = useMedia(LEQUE_APERTADO);

  useEffect(() => {
    const el = caixaRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setLargura(e.contentRect.width || 1000));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cartao = (it) => (
    <span
      className={`bc-canal${it.texto ? " bc-canal--claro" : ""}`}
      style={{ "--canal-cor": it.cor, "--canal-tinta": it.texto || "#fff" }}
    >
      <span className="bc-canal__marca" aria-hidden="true">
        <it.Icon size={86} weight="fill" />
      </span>
      <span className="bc-canal__texto">
        <span className="bc-canal__tipo">{it.type}</span>
        <span className="bc-canal__nome">{it.curto || it.name}</span>
      </span>
    </span>
  );

  const pecas = useMemo(
    () => INTEGRACOES.map((it) => ({ key: it.name, content: cartao(it) })),
    [],
  );

  return (
    <div className="dl-baralho" ref={caixaRef}>
      {semEspacoParaLeque ? (
        /* A lista sai DUAS vezes e o percurso da animação é exatamente uma
           cópia: na virada, o cartão n assume o lugar do cartão n+8 e o laço
           fecha sem emenda visível. É a mesma mecânica da esteira do acervo.

           aria-hidden porque logo abaixo vem a mesma lista em texto — e aqui
           cada canal aparece duas vezes, que é o preço de fechar o laço. */
        <div className="dl-canais-esteira" aria-hidden="true">
          <div className="dl-canais-esteira__fila">
            {[...INTEGRACOES, ...INTEGRACOES].map((it, i) => (
              <span className="dl-canais-esteira__item" key={`${it.name}-${i}`}>
                {cartao(it)}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <BounceCards
          items={pecas}
          containerWidth={Math.max(320, largura)}
          containerHeight={largura < 700 ? 220 : 280}
          animationDelay={0.15}
          animationStagger={0.05}
          easeType="elastic.out(1, 0.62)"
          inclinacao={largura < 700 ? 6 : 9}
        />
      )}

      {/* A mesma lista, em texto, para leitor de tela e para busca: o baralho é
          um monte de peças giradas e sobrepostas, e a ordem visual dele não
          corresponde a ordem nenhuma que faça sentido ler em voz alta. */}
      <ul className="dl-baralho__lista">
        {INTEGRACOES.map((it) => (
          <li key={it.name}>{it.type}: {it.name}</li>
        ))}
      </ul>
    </div>
  );
}

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
    () => FAIXA_EXTRA.map((c) => ({ title: c.label || c.title, content: cartaoDaFaixa(c), dados: c })),
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
          speed={emMobile ? 26 : 32}
          variance={0.45}
          parallax={0}
          lift={emMobile ? 0 : 26}
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
        {FAIXA_EXTRA.map((c) => (
          <li key={c.title || c.label}>
            <button type="button" onClick={() => setAberto(c)}>
              {c.title || `${c.value} — ${c.label}`}
            </button>
          </li>
        ))}
      </ul>

      {aberto ? (
        <div className="dl-porque__painel" role="dialog" aria-modal="true" aria-label={aberto.title || aberto.label}>
          {/* Fundo clicável para fechar: com a parede andando atrás, um clique
              fora do painel é o gesto que a pessoa tenta primeiro. */}
          <div className="dl-porque__saida" onClick={() => setAberto(null)} aria-hidden="true" />
          <Reveal className="dl-porque__caixa">
            <span className="dl-porque__tag">
              {aberto.kind === "stat" ? aberto.value : "DESTAQUE"}
            </span>
            <h3>{aberto.title || aberto.label}</h3>
            <p>{aberto.detalhe || aberto.desc}</p>
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
  useSeo({
    titulo: "Omnimob — CRM e gestão imobiliária com vitrine digital",
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
  const abrirTeste = (plano = "") => { setPlanoDesejado(plano); setTrialAberto(true); };

  /* Mensal ou anual. Começa no mensal de propósito: é o menor número da tela,
     e abrir no anual faria o cartão anunciar quatro dígitos para quem só quer
     saber quanto custa. */
  const [periodo, setPeriodo] = useState("mensal");

  // Valores vigentes no provedor; enquanto não chegam, valem os de reserva.
  const { planos: PLANS, temAnual } = usePrecosVigentes(periodo);

  /* O selo do alternador é o melhor desconto entre os planos — um número só
     para uma escolha só. Por plano, a economia em reais aparece no cartão. */
  const seloPeriodo = useMemo(() => {
    const melhor = PLANS.map((p) => p.economia)
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
     desenhar por trás de tudo enquanto a pessoa lê o topo. Com o GhostCursor
     eram DOIS contextos permanentes, e navegador guarda poucos: o custo aparece
     como queda de quadros na rolagem, longe da seção que causa. */
  const [nevoaPerto, setNevoaPerto] = useState(false);
  useEffect(() => {
    const el = vantaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") { setNevoaPerto(true); return undefined; }
    const io = new IntersectionObserver(([e]) => setNevoaPerto(e.isIntersecting), { rootMargin: "400px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!vantaRef.current || !nevoaPerto || !podeWebGL) return undefined;
    let efeito = null;
    let cancelado = false;

    carregarVanta().then((vanta) => {
      if (cancelado || !vanta || !vantaRef.current) return;
      efeito = vanta.FOG({
        el: vantaRef.current,
        THREE: vanta.THREE,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200.00,
        minWidth: 200.00,
        highlightColor: "#6b70f3",
        midtoneColor: "#ffb221",
        lowlightColor: "#f4f5f7",
        baseColor: "#ffffff",
        blurFactor: 0.50,
        zoom: 2.00,
      });
    });

    return () => { cancelado = true; efeito?.destroy(); };
  }, [nevoaPerto, podeWebGL]);

  return (
    <div className="dl-root">
      <OmnimobStyles extra={CSS} />

      <OmnimobSplash />

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
      <section className="dl-section dl-section--alt" id="numeros">
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
      <section className="dl-section dl-section--ghost" id="desafio">
        <GhostWord>+ visibilidade.</GhostWord>

        {/* Filho DIRETO da seção, e não dentro de um invólucro.

            O componente escreve `position: relative` no PAI via style inline, e
            isso vencia o `position: absolute` da folha no invólucro que havia
            aqui: ele saía do posicionamento absoluto, virava elemento de fluxo
            sem conteúdo e ficava com altura 0. Caixa zerada, o resize nunca
            valida e o canvas fica nos 300×150 padrão — o efeito existia no DOM
            e não desenhava nada.

            A seção já é `position: relative` e tem altura própria, que é
            exatamente o que ele espera. */}
        <FumacaQuandoVisivel />
        <div className="dl-wrap">
          <SectionHead eyebrow="O DESAFIO" eyebrowTone={GOLD} strong="Pare de perder cliente" soft="por falta de presença digital.">
            Anúncio espalhado em grupo de WhatsApp, foto solta no Instagram, planilha desatualizada. O
            interessado aparece, não encontra nada organizado e vai para a concorrência.
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
      </section>

      {/* ── Editor de vitrine ── */}
      <section className="dl-section dl-section--alt" id="editor">
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
          </Reveal>

          <EditorAoVivo />
        </div>
      </section>

      {/* ── Recursos + mock ── */}
      <section id="recursos" className="dl-section">
        <div className="dl-wrap">
          <SectionHead eyebrow="RECURSOS" strong="Tudo que sua imobiliária" soft="precisa. Em um só lugar.">
            Um sistema, do cadastro à conversão — sem juntar cinco ferramentas para dar conta da operação.
          </SectionHead>

          <Recursos />
        </div>
      </section>

      

      {/* ── Integrações ── */}
      <section className="dl-section dl-section--alt" id="integracoes">
        <div className="dl-wrap">
          <SectionHead eyebrow="CANAIS E INTEGRAÇÕES" strong="Conectada aos canais" soft="onde seu cliente já está.">
            A Omnimob liga o cadastro do imóvel aos canais que realmente trazem cliente, com a IA cuidando do
            conteúdo dentro da própria plataforma.
          </SectionHead>

          <BaralhoDeCanais />
        </div>
      </section>

      {/* ── Destaques: parede à deriva no fundo da seção inteira ──
          O conteúdo fica por cima da parede, não ao lado dela — por isso a
          seção é o palco (`position: relative`) e a parede é uma camada
          absoluta atrás. */}
      <section className="dl-section dl-section--tight dl-porque" id="porque">
        <ParedeDeDestaques />

        <div className="dl-wrap dl-porque__frente">
          <SectionHead eyebrow="POR QUE OMNIMOB" strong="O que muda no dia a dia" soft="de quem usa.">
            Detalhes pequenos que aparecem toda semana na rotina da imobiliária.
          </SectionHead>
        </div>
      </section>

      {/* ── Planos ── */}
      <section id="planos" className="dl-section dl-section--alt">
        <div className="dl-wrap">
          <SectionHead eyebrow="PLANOS" eyebrowTone={GOLD} strong="Escolha o plano ideal" soft="para sua imobiliária.">
            Sem fidelidade, cancele quando quiser.
          </SectionHead>

          {temAnual ? (
            <PeriodoToggle valor={periodo} aoTrocar={setPeriodo} selo={seloPeriodo} />
          ) : null}

          <Planos planos={PLANS} aoTestar={abrirTeste} />
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="dl-section">
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
      <section className="dl-section dl-section--alt dl-app-soon" id="aplicativo">
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
            <img
              src="/em_breve.png"
              alt="Ilustração da Omnimob chegando em breve ao Google Play e à App Store"
              loading="lazy"
            />
          </Reveal>
        </div>
      </section>

      {/* ── CTA final (seção clara) ── */}
      <section id="contato" className="dl-cta" ref={vantaRef}>
        {/* Sem escalopes aqui: a névoa em WebGL já é o movimento desta seção, e
            as flores disputavam com ela em cima do mesmo fundo claro. */}
        <Reveal className="dl-wrap dl-cta__inner">
          {/* A marca fecha a página aqui, e não por acaso: esta é a única
              seção clara, a única em que os vazados do PNG (as janelas e o
              miolo do "D") têm fundo para aparecer. */}
          <span className="dl-cta__brand">
            <img src={LOGO_SRC} alt="Omnimob" />
          </span>
          <Eyebrow tone={ACCENT_SOFT}>PRÓXIMO PASSO</Eyebrow>
          <h2 className="dl-cta__title">
            <span>Pronto para vender</span>
            <span>mais imóveis</span>
            <span className="dl-cta__grad">com processo?</span>
          </h2>
          <p className="dl-cta__sub">
            Crie um ambiente de teste em segundos. Já tem uma imobiliária rodando? A gente traz a
            sua base junto.
          </p>
          {/* Um botão só. A dupla "Testar grátis / Assinar a Omnimob" oferecia
              uma escolha que não existe mais — e ainda dividia a atenção no
              exato ponto em que a página pede uma decisão. */}
          <div className="dl-btn-row dl-btn-row--center">
            <Button as="button" type="button" variant="dark" onClick={() => abrirTeste()}>
              Testar grátis
            </Button>
          </div>
          <p className="dl-mono dl-cta__note">OMNIMOB · IMÓVEIS · VITRINE · LEADS · IA · GESTÃO DE IMOBILIÁRIAS</p>
        </Reveal>
      </section>

      {/* ── Footer ── */}
      <footer className="dl-footer">
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
              <Link to="/admin/login">Área administrativa</Link>
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

/* ── Palavra-fantasma ──
   A seção precisa conter e recortar a palavra, que é bem mais larga que ela.
   O conteúdo não precisa de z-index: .dl-wrap já é relative com z-index 1, e
   a palavra fica no 0. */
.dl-section--ghost { position: relative; overflow: hidden; }
/* O canvas do GhostCursor cobre a seção (o componente o posiciona sozinho) e
   não recebe ponteiro. O conteúdo sobe acima dele: o z-index padrão do
   componente é 10, então o texto precisa de um valor maior para continuar
   selecionável e clicável. */
.dl-section--ghost > .dl-wrap { position: relative; z-index: 12; }
.dl-ghost {
  /* Acima do canvas do GhostCursor (z-index 10). As letras são pretas como o
     fundo, então por cima da fumaça elas a ocultam: a palavra lê como um
     recorte vazado no rastro, e não como texto iluminado sobre ele. */
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
  /* Sem sombra: o relevo dourado existia para dar volume à palavra quando ela
     era o único efeito da seção. Com a fumaça atrás, ele virava um segundo
     brilho competindo com o rastro — e é o rastro que ilumina agora. */
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
  background: rgba(20,20,22,0.72);
  backdrop-filter: blur(9px) saturate(140%);
  -webkit-backdrop-filter: blur(9px) saturate(140%);
  border-color: rgba(255,255,255,0.10);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
}

/* Legibilidade por cima do rastro.

   Fora do callout o texto da seção não tem fundo nenhum: é letra transparente
   direto sobre o canvas. E o miolo da palavra — o "bili" de "+ visibilidade." —
   é justamente onde a coluna de leitura cruza a faixa da fumaça: o halo chega
   ali no auge do brilho e o cinza do lead perde o contraste.

   O remédio é um halo escuro em volta de cada glifo, na cor do próprio fundo.
   Sobre o preto ele é invisível (é a mesma cor) e só se manifesta quando há
   brilho atrás — que é exatamente onde precisa aparecer. Escurecer a fumaça
   resolveria também, mas a fumaça é o efeito; quem tem de ceder é o fundo
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
@keyframes dlTela {
  from { opacity: 0; transform: translateY(9px); }
  to { opacity: 1; transform: none; }
}

/* ── Editor de vitrine (tela "vitrine") ──
   Barra de ferramentas, painel lateral e tela com os blocos: as três partes do
   editor de verdade, na ordem em que elas aparecem lá. O que estava aqui antes
   era uma vitrine publicada — o resultado, não a ferramenta —, e a célula fala
   justamente da ferramenta. */
.dl-builder { display: flex; flex-direction: column; gap: 10px; }
.dl-builder__barra {
  display: flex; align-items: center; gap: 8px;
  padding-bottom: 9px; border-bottom: 1px solid var(--line);
}
.dl-builder__acoes { display: flex; gap: 4px; }
.dl-builder__acoes i { width: 18px; height: 14px; border-radius: 4px; background: rgba(255,255,255,0.10); }
/* Par desktop/mobile: um segmentado, com o lado ativo aceso. */
.dl-builder__modos { display: flex; gap: 3px; padding: 2px; border-radius: 6px; background: rgba(255,255,255,0.05); }
.dl-builder__modos i { width: 22px; height: 10px; border-radius: 4px; background: rgba(255,255,255,0.10); }
.dl-builder__modos i.is-on { background: rgba(255,255,255,0.34); }
.dl-builder__salvo { margin-left: auto; font-size: 8px; color: var(--mint); }

.dl-builder__corpo { display: grid; grid-template-columns: 86px 1fr; gap: 10px; flex: 1; min-height: 0; }
.dl-builder__painel {
  display: flex; flex-direction: column; gap: 8px;
  padding: 9px; border-radius: 10px;
  background: var(--surface); border: 1px solid var(--line);
}
.dl-builder__abas { display: flex; gap: 4px; }
.dl-builder__abas i { flex: 1; height: 11px; border-radius: 4px; background: rgba(255,255,255,0.08); }
.dl-builder__abas i.is-on { background: rgba(129,140,248,0.45); }
.dl-builder__rot { width: 62%; height: 4px; }
.dl-builder__cores { display: flex; gap: 4px; }
/* Podem encolher, mas não crescer, e continuam redondas ao encolher (aspect-
   ratio no lugar de uma altura fixa). O painel é estreito e fica mais estreito
   ainda no celular: com largura fixa, a última amostra escapava por fora dele em
   vez de a fila se ajustar. */
.dl-builder__cores i {
  flex: 0 1 11px; aspect-ratio: 1 / 1; min-width: 0;
  border-radius: 999px; box-shadow: 0 0 0 1px rgba(255,255,255,0.16);
}
.dl-builder__cores i.is-on { box-shadow: 0 0 0 1.5px #fff; }
.dl-builder__slider { display: block; height: 4px; border-radius: 999px; background: rgba(255,255,255,0.10); }
.dl-builder__slider i { display: block; height: 100%; border-radius: 999px; background: var(--accent-soft); }
.dl-builder__campos { display: flex; flex-direction: column; gap: 5px; margin-top: auto; }
.dl-builder__campos i { height: 16px; border-radius: 5px; background: rgba(255,255,255,0.06); }

/* A tela repete o arranjo padrão do editor: linha cheia em cima e embaixo,
   destaques dividindo a do meio com os imóveis.

   As linhas são proporcionais, e não fixas em pixels: a moldura estica com a
   altura disponível, e com alturas fixas a linha do meio comia toda a sobra
   enquanto cabeçalho, widgets e rodapé continuavam três lascas no topo e no pé.
   Em fração elas crescem juntas e o desenho continua sendo uma página. */
.dl-builder__tela {
  display: grid; gap: 5px; padding: 6px;
  grid-template-columns: 1fr 1fr;
  grid-template-areas: "cab cab" "tit tit" "des imo" "wid wid" "rod rod";
  grid-template-rows: 0.45fr 0.55fr 2.4fr 0.85fr 0.4fr;
  min-height: 170px;
  border-radius: 10px; background: rgba(0,0,0,0.32); border: 1px solid var(--line);
}
.dl-builder__bloco {
  position: relative; display: flex; align-items: center; justify-content: center;
  border-radius: 5px; overflow: hidden;
  background: linear-gradient(135deg, rgba(99,102,241,0.32), rgba(212,175,55,0.20));
}
.dl-builder__bloco em {
  font-style: normal; font-size: 7px; letter-spacing: 0.14em;
  color: rgba(255,255,255,0.66); white-space: nowrap; overflow: hidden;
}
/* O selecionado é o que conta a história — sem ele isto seria um wireframe
   qualquer. Contorno tracejado, alças nas quinas e um pulso lento, como o bloco
   em foco no editor. O overflow volta a visível porque as alças ficam metade
   para fora da caixa. */
.dl-builder__bloco.is-sel {
  overflow: visible;
  background: linear-gradient(135deg, rgba(99,102,241,0.50), rgba(212,175,55,0.30));
  outline: 1px dashed rgba(129,140,248,0.9); outline-offset: 1px;
  animation: dlBuilderSel 3.2s ease-in-out infinite;
}
@keyframes dlBuilderSel {
  0%, 100% { box-shadow: 0 0 0 0 rgba(129,140,248,0.45); }
  55%, 99% { box-shadow: 0 0 0 6px rgba(129,140,248,0); }
}
.dl-builder__alca {
  position: absolute; width: 5px; height: 5px; border-radius: 999px;
  background: #fff; box-shadow: 0 0 0 1px rgba(99,102,241,0.9);
}
.dl-builder__alca--no { top: -2.5px; left: -2.5px; }
.dl-builder__alca--ne { top: -2.5px; right: -2.5px; }
.dl-builder__alca--so { bottom: -2.5px; left: -2.5px; }
.dl-builder__alca--se { bottom: -2.5px; right: -2.5px; }

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
.dl-editor { display: grid; grid-template-columns: 1fr 0.85fr; gap: 48px; align-items: center; }
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

/* ── Baralho dos canais ──
   O leque é posicionado por transform, então ele não ocupa altura própria: a
   caixa é que reserva o espaço, e o overflow precisa ficar visível para as
   pontas do baralho e o giro dos cartões não serem decepados. */
.dl-baralho {
  width: 100%;
  display: flex;
  justify-content: center;
  overflow: visible;
  margin-top: clamp(8px, 2vw, 20px);
}
/* ── Esteira dos canais (celular) ──
   O leque vira um laço que corre sozinho. A lista é renderizada duas vezes e o
   percurso é exatamente uma cópia: -50% da fila inteira, que é o comprimento de
   uma cópia — daí a emenda cair sempre no mesmo pixel e não se ver.

   translateX em porcentagem da PRÓPRIA fila (e não em px), para o laço fechar
   igual em qualquer largura de tela e sem ninguém medir nada em JS. */
.dl-canais-esteira {
  --canal-vao: 12px;
  width: 100%;
  overflow: hidden;
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent);
  mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent);
}
.dl-canais-esteira__fila {
  display: flex;
  gap: var(--canal-vao);
  width: max-content;
  animation: dlCanaisEsteira 34s linear infinite;
}
@keyframes dlCanaisEsteira {
  from { transform: translateX(0); }
  /* Metade da fila é uma cópia inteira da lista; o vão a mais é o que separa a
     última peça da cópia da primeira peça da seguinte, e sem ele a emenda
     andaria 12px a cada volta. */
  to { transform: translateX(calc(-50% - var(--canal-vao) / 2)); }
}
.dl-canais-esteira__item {
  flex: 0 0 132px;
  height: 168px;
  border-radius: 18px;
  display: block;
  box-shadow: 0 14px 30px -18px rgba(0,0,0,0.85);
}
/* Parada com "reduzir movimento": a esteira é movimento constante e não há
   versão estática dela — o que fica é a faixa parada, legível do mesmo jeito. */
@media (prefers-reduced-motion: reduce) {
  .dl-canais-esteira__fila { animation: none; }
}

/* Lista de acesso: existe para leitor de tela e busca, não para os olhos. */
.dl-baralho__lista {
  position: absolute;
  width: 1px; height: 1px;
  margin: -1px; padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
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
  border: 1px solid var(--line); border-radius: 20px;
  /* O hidden vem primeiro como reserva: navegador que não conheça o clip ignora
     as duas linhas seguintes e fica com o recorte antigo, em vez de perder o
     arredondamento dos cantos.

     O overflow-clip-margin é o que permite os raios do contorno elétrico saírem
     do quadro: o recorte continua existindo (os cantos arredondados dependem
     dele), mas a pintura pode passar 70px além da borda — que é o alcance do
     traçado deslocado por ruído do ElectricBorder. */
  overflow: hidden;
  overflow: clip;
  overflow-clip-margin: 70px;
}
.dl-plan {
  position: relative; padding: 32px 26px; display: flex; flex-direction: column;
  border-right: 1px solid var(--line);
}
.dl-plan:last-child { border-right: 0; }
.dl-plan.is-highlight { background: var(--surface); }
/* ── Etiqueta "mais popular" ──
   Virou uma pastilha na cor do plano (--realce, o mesmo roxo do neon do cartão),
   com o fundo em movimento em vez de chapado.

   O movimento é um degradê largo atravessando a pastilha, e NÃO as ondas do
   Vanta, que era a ideia original. Elas não servem aqui, e a razão é do próprio
   efeito: o WAVES monta a malha da onda em função do tamanho do elemento, então
   numa caixa pequena a fase quase não varia de um vértice para o outro e a
   superfície sai plana — um contexto WebGL a mais para entregar exatamente uma
   cor sólida. Medido: liso a 104 × 17, liso a 320 × 190 e ainda liso a 900 × 520.
   As ondas da seção só têm relevo porque a camada delas é a seção inteira. */
.dl-plan__tag {
  position: absolute; top: 12px; right: 14px; z-index: 3;
  display: inline-flex; align-items: center;
  padding: 4px 9px; border-radius: 999px;
  font-size: 8.5px; letter-spacing: 0.13em; line-height: 1;
  color: #fff;
  background-image: linear-gradient(
    100deg,
    color-mix(in srgb, var(--realce) 74%, #000) 0%,
    var(--realce) 24%,
    color-mix(in srgb, var(--realce) 62%, #fff) 46%,
    var(--realce) 68%,
    color-mix(in srgb, var(--realce) 74%, #000) 100%
  );
  background-size: 320% 100%;
  box-shadow: 0 5px 16px -7px color-mix(in srgb, var(--realce) 85%, transparent);
  animation: dlTagOnda 7s linear infinite;
}
@keyframes dlTagOnda {
  from { background-position: 0% 50%; }
  to { background-position: -320% 50%; }
}
.dl-plan__name { font-size: 26px; font-weight: 700; letter-spacing: -0.035em; color: var(--strong); }
.dl-plan__desc { font-size: 13px; line-height: 1.7; color: var(--subtle); margin-top: 8px; min-height: 66px; }
.dl-plan__price { margin-top: 18px; display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
.dl-plan__price strong { font-size: 34px; font-weight: 700; letter-spacing: -0.045em; color: var(--strong); }
.dl-plan__price span { font-size: 13px; color: var(--subtle); }
.dl-plan__nota { color: var(--placeholder); font-size: 9px; margin-top: 6px; display: block; }
/* Economia do anual, ao lado do preço. Em verde-menta, a mesma cor dos ✓ da
   lista: nesta página o menta já quer dizer "isto está incluído". */
.dl-plan__economia {
  /* O align-self existe porque o cartão é uma coluna flex: sem ele a etiqueta
     esticaria de ponta a ponta em vez de acompanhar o próprio texto. */
  align-self: flex-start;
  margin-top: 8px;
  font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--mint);
  padding: 3px 8px; border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--mint) 32%, transparent);
  background: color-mix(in srgb, var(--mint) 12%, transparent);
  white-space: nowrap;
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

/* ── Alternador mensal / anual ──────────────────────────────────────────────
   A pílula que marca a opção é UM elemento que desliza, não um fundo aceso em
   cada botão: assim a troca é um movimento (o olho segue a peça) em vez de um
   pisca-apaga em dois lugares. Ela vive atrás do texto e não recebe clique. */
.dl-periodo {
  position: relative;
  /* Grade de duas colunas IGUAIS, não flex: o botão "Anual" carrega o selo de
     desconto e é bem mais largo que "Mensal". Em flex, cada um ficaria do
     tamanho do próprio conteúdo e a pílula de 50% pararia no meio do texto.
     O minmax de zero a 1fr força a metade exata: sem esse zero o piso da
     coluna é o conteúdo, e a desigualdade volta.

     fit-content + margin auto centraliza sem depender do pai: a seção não
     define alinhamento para os filhos dela. */
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch; width: fit-content;
  margin: 26px auto 0;
  padding: 4px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--surface);
  isolation: isolate;
  margin-bottom: 20px;
}
.dl-periodo__pilula {
  position: absolute; z-index: -1;
  top: 4px; bottom: 4px; left: 4px;
  width: calc(50% - 4px);
  border-radius: 999px;
  background: var(--strong);
  transition: transform 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}
.dl-periodo__pilula[data-em="anual"] { transform: translateX(100%); }
.dl-periodo__opt {
  position: relative;
  display: inline-flex; align-items: center; gap: 8px;
  padding: 9px 22px;
  border: 0; background: transparent;
  font: inherit; font-size: 13px; font-weight: 600;
  color: var(--subtle);
  border-radius: 999px;
  cursor: pointer;
  transition: color 0.28s ease;
  justify-content: center; white-space: nowrap;
}
.dl-periodo__opt.is-on { color: var(--bg); }
.dl-periodo__opt:not(.is-on):hover { color: var(--strong); }
.dl-periodo__selo {
  font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase;
  padding: 3px 7px; border-radius: 999px;
  background: color-mix(in srgb, var(--mint) 18%, transparent);
  color: var(--mint);
  transition: background 0.28s ease, color 0.28s ease;
}
/* Selecionado, o botão fica claro e o menta some no fundo — o selo troca para
   o negativo do próprio botão. */
.dl-periodo__opt.is-on .dl-periodo__selo {
  background: color-mix(in srgb, var(--bg) 16%, transparent);
  color: var(--bg);
}
@media (prefers-reduced-motion: reduce) {
  .dl-periodo__pilula { transition: none; }
}
@media (max-width: 520px) {
  .dl-periodo { width: 100%; }
  .dl-periodo__opt { padding: 9px 12px; font-size: 12px; }
  .dl-periodo__selo { font-size: 8px; padding: 2px 5px; }
}
/* Respiro maior antes do botão: separa a lista do CTA sem precisar de régua. */
/* O painel guarda o respiro e o esticão; a lista, só o desenho das linhas.
   Trocado de lugar porque no celular são DUAS listas dentro do mesmo painel, e
   margem em cada uma delas entraria duas vezes na conta da altura. */
.dl-plan__recursos { display: flex; flex-direction: column; flex: 1; margin: 22px 0 38px; }
.dl-plan__list { display: grid; gap: 11px; flex: 1; }
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

/* Pontos do carrossel. Só existem no DOM quando a tela é de celular, então não
   há nada a esconder aqui — o alvo de toque é o botão inteiro (24 × 26), e o
   ponto visível é o ::before, bem menor que ele. */
/* ── Plano sob o mouse (desktop) ────────────────────────────────────────────
   O mesmo par do carrossel — o flare do plano e o botão aceso —, agora regido
   pelo mouse em vez do foco. Vale para o cartão inteiro: quem está lendo a
   lista de recursos já está considerando aquele plano, e o botão acender antes
   de o cursor chegar nele é o que transforma a leitura em clique.

   O BRILHO DO CARTÃO saiu daqui. Era uma sombra interna em var(--flare), e foi
   substituído pelo contorno elétrico (ElectricBorder), montado no JSX só para o
   cartão sob o mouse e só nos planos que acendem — o Básico não acende mais, em
   desktop nem em celular. O que restou nesta regra é o botão.

   Só onde existe mouse de verdade: em tela de toque o :hover fica grudado
   depois do primeiro toque, e o carrossel já tem o dono do destaque, que é o
   cartão em foco. */
@media (hover: hover) and (pointer: fine) and (min-width: 641px) {
  /* Ler a lista de um plano já é considerá-lo, e o botão acender antes de o
     cursor chegar nele é o que transforma a leitura em clique.

     Antes isso era preenchimento: o botão de contorno virava branco sólido ao
     passar o mouse pelo cartão. Com o vidro especular, o branco chapado ficava
     POR CIMA do efeito — o botão do plano em destaque era o único dos três sem
     brilho nenhum, justamente o que mais deveria ter.

     Agora quem acende é a mesma coisa que o resto da página usa para acender:
     o véu sobe e a beirada clareia. Os três continuam distinguíveis, e o do
     cartão sob o mouse é o mais claro dos três.

     Três classes porque é o peso de .dl-root .dl-btn--especular:hover, que esta
     regra precisa vencer. */
  .dl-root .dl-plan:hover .dl-btn--especular {
    background: color-mix(in srgb, var(--sb-tint) 22%, transparent);
    border-color: color-mix(in srgb, var(--sb-base-color) 95%, transparent);
    color: #ffffff;
  }
  .dl-plan:hover .dl-btn--especular .dl-btn__arrow { background: rgba(255,255,255,0.18); }
}

/* ── Fundo em ondas da seção de planos ──
   A camada vale nos dois formatos: no celular ela segue o cartão em foco, no
   desktop segue o cartão sob o mouse. Vaza para os lados até a largura da
   janela (o .dl-wrap tem no máximo 1120px e é centrado, então tirar metade da
   diferença de cada lado chega na borda da tela) — tingir só a coluna de
   conteúdo deixaria um retângulo colorido boiando no meio da seção.

   Fica atrás de tudo pelo z-index negativo, que aqui não escapa da seção
   porque o .dl-wrap tem z-index 1 e portanto cria o próprio contexto. */
/* O deslocamento vertical é o respiro da seção, e não um número redondo: a
   camada é filha do .dl-wrap, que começa no fim do respiro de cima e termina no
   começo do de baixo. Com os -70px que estavam aqui, tudo que passasse disso
   ficava de fora — e, num respiro de 112px, sobravam duas faixas de --bg-alt sem
   cor nenhuma exatamente onde a seção encosta nas vizinhas, que é onde a emenda
   se vê.

   A máscara também abriu. Os raios agora passam da metade da caixa (128% e 104%
   contra os 72% e 68% anteriores), então o miolo opaco alcança as quatro bordas
   e a queda para transparente sobra só para as quinas — antes ela terminava bem
   dentro da seção, e era ela, não o tamanho da camada, que apagava a cor antes
   da hora. */
.dl-plans-onda {
  position: absolute; z-index: -1; pointer-events: none;
  top: calc(-1 * var(--pad-sec)); bottom: calc(-1 * var(--pad-sec));
  left: calc(50% - 50vw); right: calc(50% - 50vw);
  opacity: 0; transition: opacity 0.9s ease;
  background: radial-gradient(78% 74% at 50% 48%, var(--tinta, transparent), transparent 74%);
  -webkit-mask-image: radial-gradient(128% 104% at 50% 50%, #000 44%, transparent 100%);
  mask-image: radial-gradient(128% 104% at 50% 50%, #000 44%, transparent 100%);
}
.dl-plans-onda.is-on { opacity: 0.5; }

/* Fundo opaco nos cartões, e é isto que impede as ondas de tingirem os planos
   que não foram escolhidos: sem ele, Básico e Premium são transparentes e
   deixariam a cor passar por dentro. Os valores repetem o que já se via antes
   (a superfície da seção, e a mais clara no destaque), então nada muda de
   aparência — muda só o que está por baixo. */
.dl-plan { background: var(--bg-alt); }

/* A coroa é peça do carrossel e só aparece lá (ver o bloco do celular). Fica
   escondida aqui, e não removida do JSX, para virar a orientação do aparelho
   não depender de um re-render. */
.dl-plan__coroa { display: none; }

.dl-plans__pontos { display: flex; justify-content: center; gap: 6px; margin-top: 2px; }
.dl-root .dl-plans__ponto {
  width: 24px; height: 26px; padding: 0; border: 0; border-radius: 0;
  background: none; box-shadow: none; transform: none; cursor: pointer;
  display: grid; place-items: center;
}
.dl-root .dl-plans__ponto:hover { background: none; box-shadow: none; transform: none; }
.dl-plans__ponto::before {
  content: ""; width: 7px; height: 7px; border-radius: 999px;
  background: rgba(255,255,255,0.24);
  transition: width 0.35s var(--ease-out), background 0.35s ease;
}
/* O ponto aceso sai na cor do plano em foco — o --realce desce do
   .dl-plans-caixa, porque aqui já se está fora dos cartões. A transição de
   background que o ::before já tinha faz a cor deslizar de um plano para o
   outro em vez de trocar de estalo. */
.dl-plans__ponto.is-on::before { width: 20px; background: var(--realce, var(--accent-soft)); }

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
  gap: clamp(42px, 7vw, 104px);
}
.dl-app-soon__copy .dl-h2 { margin-top: 14px; }
.dl-app-soon__copy .dl-lead { max-width: 530px; }
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
  justify-content: center;
  min-width: 0;
}
.dl-app-soon__visual img {
  display: block;
  width: min(100%, 760px);
  height: auto;
  object-fit: contain;
  filter: drop-shadow(0 28px 52px rgba(0,0,0,0.28));
}

/* ── CTA final (claro) ── */
.dl-cta {
  position: relative;
  overflow: hidden;
  background: #f4f5f7;
  color: #0c121a;
  padding: clamp(72px, 9vw, 128px) 0;
}
.dl-cta canvas {
  opacity: 0.5;
}

.dl-cta__inner { text-align: center; display: flex; flex-direction: column; align-items: center; }

/* Marca de fechamento. O halo é ::before e a imagem é relative de propósito:
   as duas são caixas posicionadas, então quem vem depois no DOM pinta por
   cima — sem isso o brilho cobriria a logo. */
.dl-cta__brand {
  position: relative;
  display: inline-flex;
  margin-bottom: 24px;
}

.dl-cta__brand::before {
  content: "";
  position: absolute;
  inset: -60%;
  pointer-events: none;
  background: radial-gradient(closest-side, rgba(212,175,55,0.30), transparent 75%);
  opacity: 0;
  transition: opacity 0.3s ease-in-out;
}

.dl-cta__brand:hover::before {
  opacity: 1;
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
  background: linear-gradient(
    100deg, 
    color-mix(in srgb, var(--accent) 75%, transparent), 
    color-mix(in srgb, var(--accent-soft) 75%, transparent) 45%, 
    color-mix(in srgb, var(--gold) 75%, transparent)
  );
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
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
  .dl-plan__list--resumo li.is-heranca { color: var(--strong); font-weight: 600; }
  .dl-plan__list--resumo li.is-heranca span { color: var(--accent-soft); }

  /* ── Abrir e fechar a lista ──
     Quem cresce é o painel, com a altura escrita pelo JS (PlanoRecursos) e
     transição na altura. As duas listas moram na MESMA célula da grade e se
     cruzam lá dentro: sem isso, a que sai empurraria a que entra para baixo
     antes de desaparecer, e o painel animaria a altura das duas somadas. */
  .dl-plan__recursos {
    display: grid; flex: none; margin: 16px 0 8px;
    overflow: hidden;
    transition: height 0.42s var(--ease-out);
  }
  .dl-plan__recursos > .dl-plan__list {
    grid-area: 1 / 1;
    /* No topo da célula, e não esticadas: esticada, cada lista passaria a ter a
       altura do painel — que é exatamente a altura que se quer medir a partir
       delas. A medida viraria a própria resposta. */
    align-self: start; flex: none;
  }
  /* A lista escondida continua no DOM (é dela que sai a medida da outra ponta
     da animação), mas não pega toque nem seleção. */
  .dl-plan__recursos.is-resumido > .dl-plan__list:not(.dl-plan__list--resumo),
  .dl-plan__recursos:not(.is-resumido) > .dl-plan__list--resumo {
    pointer-events: none;
  }

  /* O resumo entra e sai inteiro: são quatro linhas, e escaloná-las seria mais
     enfeite do que leitura. */
  .dl-plan__list--resumo {
    transition: opacity 0.24s ease 0.12s, transform 0.34s var(--ease-out) 0.12s;
  }
  .dl-plan__recursos:not(.is-resumido) > .dl-plan__list--resumo {
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
  .dl-plan__recursos > .dl-plan__list:not(.dl-plan__list--resumo) li {
    transition:
      opacity 0.24s ease calc(0.07s + var(--i, 0) * 16ms),
      transform 0.32s var(--ease-out) calc(0.07s + var(--i, 0) * 16ms);
  }
  .dl-plan__recursos.is-resumido > .dl-plan__list:not(.dl-plan__list--resumo) li {
    opacity: 0; transform: translateY(-6px);
    transition: opacity 0.14s ease, transform 0.14s ease;
  }
  .dl-root .dl-plan__mais {
    width: 100%; margin: 0 0 18px; padding: 9px 0;
    display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    background: none; border: 0; border-radius: 0; box-shadow: none; transform: none;
    font-family: inherit; font-size: 12.5px; font-weight: 600;
    /* Cada cartão pinta o seu, então o botão acompanha o plano que está sendo
       lido — e no Básico o --realce é o próprio lilás do tema, que é a cor que
       ele já tinha. */
    color: var(--realce, var(--accent-soft));
    cursor: pointer;
    transition: color 0.3s ease;
  }
  .dl-root .dl-plan__mais:hover,
  .dl-root .dl-plan__mais:active {
    background: none; box-shadow: none; transform: none; scale: 1; color: var(--strong);
  }
  .dl-plan__mais svg { transition: transform 0.3s var(--ease-out); }
  .dl-plan__mais[aria-expanded="true"] svg { transform: rotate(180deg); }

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
  .dl-builder__corpo { grid-template-columns: 70px 1fr; gap: 8px; }
  .dl-builder__tela { min-height: 132px; }
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
  .dl-cta__brand img { width: 66px; height: 66px; }
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
  .dl-fcard__value { font-size: 32px; }
    /* Na parede a leitura do cartão é o que importa, e num palco estreito o
     texto encolhe junto com a peça. Um degrau a menos de tamanho evita que a
     descrição vire duas linhas de nada. */
  .dl-fcard--parede { padding: 14px 16px; gap: 6px; }
  .dl-fcard--parede .dl-fcard__value { font-size: 30px; }
  .dl-fcard--parede .dl-fcard__desc { font-size: 12px; line-height: 1.55; }

  /* A barra do mock do editor não comporta URL e aviso lado a lado; some a
     URL, que é enfeite, e fica o aviso, que é a história da seção. */
  .dl-ed__url { display: none; }
  .dl-ed { padding: 12px; }
  .dl-ed__area { inset: 9px; }

  /* ── Carrossel de planos ──
     A moldura única vira trilho: cada plano é um cartão inteiro, com borda e
     canto próprios. A máscara apaga as pontas, e o que sobra do vizinho ali é
     o convite para arrastar.

     O respiro das pontas é metade do que sobra do trilho depois do cartão — é
     ele que deixa o PRIMEIRO e o ÚLTIMO pararem no centro, e não encostados na
     borda. Ele é margem dos cartões das pontas, e não padding do trilho, para
     as duas medidas correrem sobre a MESMA base: com padding lateral, a
     largura do cartão passaria a ser uma porcentagem do que sobrou depois dele
     e a conta nunca fecharia (o cartão do meio centraliza, os das pontas
     ficam alguns pixels fora). Margem de item flex também conta na área
     rolável, então a última ponta tem para onde rolar. */
  .dl-plans {
    --dl-cartao: 70%;
    --dl-ponta: 15%; /* (100 - 70) / 2 */
    display: flex; gap: 12px;
    /* Cada cartão com a própria altura: esticados todos na altura do maior,
       abrir a tabela de um deles esticaria os três, e os dois fechados
       ficariam com um vão morto entre a lista e o botão. */
    align-items: flex-start;
    border: 0; border-radius: 0;
    overflow-x: auto; overflow-y: hidden;
    scroll-snap-type: x mandatory;
    /* O respiro de cima e de baixo é onde cabem a coroa pendurada e o estouro
       do flare: rolagem horizontal obriga a recortar o eixo vertical, e o corte
       acontece na borda da caixa de padding. Sem folga suficiente o neon
       termina numa linha reta — e reta é justamente o que denuncia que ele é um
       efeito, e não luz.

       A conta: a camada mais larga do flare tem blur 58 e spread -12. O miolo
       forte dela some por volta dos 17px, mas a cauda fraca vai até uns 46 —
       era ela que estava sendo decepada com 38px de folga. Daí os 60. */
    padding: 60px 0 46px;
    scrollbar-width: none; -ms-overflow-style: none;
    -webkit-mask-image: linear-gradient(90deg, transparent, #000 9%, #000 91%, transparent);
    mask-image: linear-gradient(90deg, transparent, #000 9%, #000 91%, transparent);
  }
  .dl-plans::-webkit-scrollbar { display: none; }

  /* Os pontos sobem para cima do trilho. Um plano é mais alto que a tela, então
     embaixo eles só apareceriam depois de rolar o cartão inteiro — tarde
     demais para o que eles servem, que é avisar na chegada que existem três. */
  .dl-plans-caixa { display: flex; flex-direction: column; }
  /* Os pontos entram POR DENTRO da folga do trilho (margem negativa) e sobem
     uma camada. As duas coisas juntas são o que faz o flare passar por trás
     deles: a folga guarda a cauda do neon, e o z-index deixa os pontos por
     cima dela em vez de o brilho ser cortado ao chegar perto. */
  .dl-plans__pontos {
    order: -1; margin: 0 0 -34px;
    position: relative; z-index: 1;
  }

  /* Na tela estreita a seção é bem mais alta que larga, então a mancha de cor
     precisa esticar na vertical — a elipse do desktop morreria antes do título.
     O alcance até as bordas da seção continua vindo do --pad-sec herdado. */
  .dl-plans-onda {
    background: radial-gradient(125% 62% at 50% 46%, var(--tinta, transparent), transparent 74%);
    -webkit-mask-image: radial-gradient(150% 96% at 50% 48%, #000 46%, transparent 100%);
    mask-image: radial-gradient(150% 96% at 50% 48%, #000 46%, transparent 100%);
  }
  .dl-plan {
    flex: 0 0 var(--dl-cartao); scroll-snap-align: center;
    padding: 22px 18px; border: 1px solid var(--line); border-radius: 18px;
    transform-origin: 50% 40%;
    /* O fundo não entra na transição porque não muda: só a luz em volta muda. */
    transition:
      filter 0.45s var(--ease-out), transform 0.45s var(--ease-out),
      border-color 0.45s ease, box-shadow 0.45s ease;
  }
  /* Repetido com o mesmo peso da regra de ≤1024 (que zera a borda de baixo do
     último) só para vencer no empate: aqui todo cartão é fechado dos quatro
     lados. */
  .dl-plan:last-child { border-bottom: 1px solid var(--line); }
  .dl-plan:first-child { margin-left: var(--dl-ponta); }
  .dl-plan:last-child { margin-right: var(--dl-ponta); }
  /* ── Cartão fora de foco ──
     Superfície SEMPRE a mesma, e sempre opaca; o recuo é feito por brilho, não
     por opacidade. As duas decisões vêm do mesmo bug: o cartão piscava com a
     cor do plano ao trocar de foco.

     Opacidade menor que 1 faz duas coisas ao mesmo tempo. Deixa passar o que
     está atrás — e atrás está o fundo em ondas, colorido. E cria contexto de
     empilhamento: o halo do flare, que morava em z-index -1 (atrás de todos os
     cartões), passava a valer DENTRO do cartão, e ali o negativo fica acima do
     fundo, não atrás. Daí o miolo pegar a cor durante a animação e voltar ao
     normal quando a opacidade fechava em 1.

     brightness escurece sem tirar a opacidade: o cartão continua sólido do
     começo ao fim. E o halo virou sombra externa, que não tem como pintar
     miolo nenhum.

     Sem .is-visible no seletor, de propósito: essa classe é da entrada por
     rolagem, e o terceiro cartão vive fora da tela — ele chegava à ponta do
     trilho sem escurecer, porque a regra ainda não valia para ele. */
  .dl-plans .dl-plan {
    background: var(--surface);
    filter: brightness(0.55); transform: scale(0.965);
  }
  /* ── Cartão em foco ──
     Sai do escurecimento e volta ao tamanho cheio. Só isso: o neon que morava
     aqui — quatro camadas de box-shadow na cor do plano — foi substituído pelo
     contorno elétrico, montado no JSX para o cartão em foco.

     Manter os dois somava um brilho por baixo do outro no mesmo cartão, com
     duas cores e dois formatos de borda disputando a mesma beirada. E não
     bastava tirar do Básico: nos planos que acendem é justamente onde os dois
     apareciam juntos. */
  .dl-plans .dl-plan.is-atual {
    filter: none; transform: none;
  }
  /* ── Coroa ──
     Pendurada na borda de cima, metade para dentro e metade para fora. A cor
     sai do --flare do próprio cartão em vez de um dourado fixo: assim a coroa
     do Profissional é roxa e a do Premium é dourada, e cada uma pertence ao
     seu plano em vez de as duas parecerem o mesmo selo repetido. */
  .dl-plan__coroa {
    position: absolute; top: -14px; left: 50%; transform: translateX(-50%); z-index: 2;
    width: 34px; height: 27px; border-radius: 10px;
    display: grid; place-items: center; color: #17071f;
    background: linear-gradient(165deg, color-mix(in srgb, var(--flare) 65%, #fff), var(--flare));
    box-shadow:
      0 6px 15px -6px color-mix(in srgb, var(--flare) 80%, transparent),
      0 0 0 3px var(--bg);
  }

  .dl-plan__name { font-size: 23px; }
  .dl-plan__price strong { font-size: 30px; }
  .dl-plan__price { margin-top: 14px; }
  .dl-plan__desc { font-size: 12.5px; line-height: 1.6; }
  /* Cada linha economizada aqui aparece três vezes na altura do cartão. */
  .dl-plan__list li { font-size: 12.5px; }
  .dl-head { margin-bottom: 28px; }

  /* ── Resumo do cartão ──
     A tabela de dez linhas era quase toda a altura do plano, e ela nem compara
     nada aqui: um cartão por vez, com sete linhas iguais em todos. Fica o que
     este plano acrescenta ao anterior; a tabela inteira continua a um toque. */
  .dl-plan__list { gap: 9px; }

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
  .dl-esteira__linha, .dl-builder__bloco.is-sel, .dl-plan__tag { animation: none; }
  /* As ondas do fundo nem chegam a ser criadas (ver o efeito em Planos); no
     lugar delas fica a mancha de cor estática da própria camada. O flare do
     cartão já é sombra parada, então não há o que desligar nele. */
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
  .dl-root .dl-plan__recursos,
  .dl-root .dl-plan__recursos > .dl-plan__list,
  .dl-root .dl-plan__recursos > .dl-plan__list li,
  .dl-root .dl-plan__mais svg { transition: none; }
}
`;
