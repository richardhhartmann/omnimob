import * as THREE from "three";
import FOG from "vanta/dist/vanta.fog.min";
import WAVES from "vanta/dist/vanta.waves.min";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
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
} from "@phosphor-icons/react";
import { api } from "../api";
import { DomusSplash } from "../components/DomusSplash";
import { TrialModal } from "../components/TrialModal";
import { PLANOS, RECURSOS_PLANOS, planoInfo } from "../utils/planos";
import { IconeCheck, IconeX } from "../components/Icones.jsx";
import {
  ACCENT,
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
// `tela`, `url` e `legenda` alimentam o mock ao lado: cada recurso mostra a
// parte do produto de que está falando.
const RECURSOS = [
  { Icon: Buildings, title: "Gestão de imóveis", desc: "Cadastre imóveis com fotos, atributos, tipos e status. Tudo organizado e pronto para divulgar.", tela: "imoveis", url: "domus.app / imóveis", legenda: "PAINEL WEB · IMÓVEIS" },
  { Icon: PaintBrushBroad, title: "Vitrine personalizável", desc: "Um editor visual de arrastar e soltar para montar a página pública da sua imobiliária, do seu jeito.", tela: "vitrine", url: "suaimobiliaria.domus.app", legenda: "VITRINE PÚBLICA · AO VIVO" },
  { Icon: ChartLineUp, title: "Leads e métricas", desc: "Capture interessados pela vitrine e acompanhe visualizações, leads e vendas por imóvel.", tela: "metricas", url: "domus.app / métricas", legenda: "PAINEL WEB · MÉTRICAS" },
  { Icon: Megaphone, title: "Publicação em redes", desc: "Divulgue imóveis no Facebook, Instagram e WhatsApp com legenda pronta em poucos cliques.", tela: "redes", url: "domus.app / publicações", legenda: "PAINEL WEB · PUBLICAÇÕES" },
  { Icon: UsersThree, title: "Usuários e permissões", desc: "Crie cargos com permissões granulares para corretores, marketing, gerência e mais.", tela: "usuarios", url: "domus.app / usuários", legenda: "PAINEL WEB · EQUIPE" },
  { Icon: ShieldCheck, title: "Multi-tenant seguro", desc: "Cada imobiliária com seus próprios dados, usuários e vitrine — isolados e seguros.", tela: "tenants", url: "domus.app / admin", legenda: "SUPER-ADMIN · TENANTS" },
];

// De quantos em quantos milissegundos o carrossel avança sozinho.
const RECURSO_INTERVALO = 3000;

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

/* Quantas silhuetas cada bloco tem por dentro. O arranjo delas (grade, coluna,
   fila) fica no CSS de cada modificador — aqui só a contagem, porque é o que
   muda de bloco para bloco:
     header    marca + três itens de menu
     titulo    uma chamada e uma linha de apoio
     destaques três cartões lado a lado
     imoveis   grade de seis cartões de imóvel
     widgets   dois painéis
     rodape    três links */
const EDITOR_MIOLO = { header: 4, titulo: 2, destaques: 3, imoveis: 6, widgets: 2, rodape: 3 };

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
  { label: "Contato", href: "#contato" },
];

/* `cor` é qualquer fundo CSS (as marcas com degradê usam o mesmo do painel, em
   PropertyForm) e `texto` só aparece quando o fundo é claro demais para branco
   — caso do dourado das métricas. */
const INTEGRACOES = [
  { type: "REDES", name: "Facebook", Icon: FacebookLogo, cor: "#1877f2" },
  {
    type: "REDES",
    name: "Instagram",
    Icon: InstagramLogo,
    cor: "linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)",
  },
  { type: "MENSAGENS", name: "WhatsApp", Icon: WhatsappMarca, cor: "#25d366" },
  { type: "MÍDIA", name: "Cloudinary", Icon: CloudArrowUp, cor: "#3448c5" },
  { type: "IA", name: "Google Gemini", Icon: Sparkle, cor: "linear-gradient(135deg,#4285f4,#9b72cb,#d96570)" },
  { type: "VITRINE", name: "Página pública", Icon: Globe, cor: ACCENT },
  { type: "LEADS", name: "Formulário de contato", Icon: ChatCircleText, cor: MINT },
  { type: "MÉTRICAS", name: "Painel de desempenho", Icon: ChartLineUp, cor: GOLD, texto: "#0a0a0b" },
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
  /* A pergunta que trava quem já opera. Ela existe na página porque agora
     existe um caminho para ela: o teste pergunta o perfil logo na abertura e,
     para quem já tem imobiliária, coleta o que precisa ser trazido. A resposta
     promete acompanhamento humano — que é o que a Domus faz hoje —, e não uma
     importação automática, que ainda não existe. */
  {
    q: "Já uso outro sistema. Dá para trazer meus imóveis e clientes?",
    a: "Dá, e você não vai redigitar nada sozinho. Ao começar o teste, diga que já tem uma imobiliária: perguntamos qual sistema você usa hoje, o que precisa vir junto (imóveis e fotos, clientes, leads, equipe) e como os dados podem sair de lá. Um especialista responde no seu e-mail para conduzir a importação dentro do próprio período de teste — se você não souber como exportar, essa parte também é com a gente.",
  },
];

// ── Planos ──────────────────────────────────────────────────────────────────

// Preço é informação de marketing e não existe em planos.js, então fica mapeado
// aqui — ajuste à vontade.
const PRECOS = {
  BASICO: { price: "R$ 99", per: "/mês", nota: "cobrado mensalmente" },
  PROFISSIONAL: { price: "R$ 199", per: "/mês", nota: "cobrado mensalmente" },
  PREMIUM: { price: "Sob consulta", per: "", nota: "cobrado mensalmente" },
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

/* Preços de reserva: valem só até a resposta do provedor chegar (ou se ele não
   estiver configurado). O valor exibido de verdade vem de /public/planos, para a
   página nunca anunciar um preço diferente do que será cobrado. */
const PLANS_BASE = PLANOS.map((p) => ({
  key: p.key,
  name: p.nome,
  desc: p.descricao,
  price: PRECOS[p.key]?.price ?? "",
  per: PRECOS[p.key]?.per ?? "",
  nota: PRECOS[p.key]?.nota ?? "",
  linhas: LINHAS_PLANO.map((r) => ({ label: r.label, incluso: incluiRecurso(p.key, r) })),
  resumo: resumoDoPlano(p.key),
  highlight: p.key === "PROFISSIONAL",
}));

/* Busca os preços vigentes uma vez por carga da página. Falha de rede não
   quebra nada: fica com os valores de reserva. */
function usePrecosVigentes() {
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

  return useMemo(
    () =>
      PLANS_BASE.map((p) => {
        const vivo = precos?.[p.key];
        if (!vivo) return p;
        // O rótulo do Stripe já vem inteiro ("R$ 199,00/mês"), então o sufixo
        // separado (`per`) sai de cena para não duplicar o "/mês".
        return { ...p, price: vivo.rotulo, per: "", valor: vivo.valor };
      }),
    [precos],
  );
}

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
  if (tipo === "vitrine") {
    return (
      <>
        <div className="dl-browser__banner" />
        <div className="dl-skel" style={{ width: "38%", height: "11px" }} />
        <div className="dl-browser__mini">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="dl-browser__minicard">
              <div className="dl-browser__minithumb" />
              <div className="dl-skel" style={{ width: "80%" }} />
            </div>
          ))}
        </div>
      </>
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

  if (tipo === "tenants") {
    return (
      <div className="dl-browser__rows">
        {["Imobiliária Centro", "Casa Nobre", "Alto Padrão", "Vista Mar", "Recanto Sul", "Novo Lar"].map(
          (nome, i) => (
            <div key={nome} className="dl-browser__linha">
              <span className="dl-browser__av" />
              <span className="dl-browser__lin">
                <span className="dl-skel" style={{ width: `${76 - (i % 4) * 11}%` }} />
                <span className="dl-skel" style={{ width: "34%", opacity: 0.55 }} />
              </span>
              <span className="dl-mono dl-browser__chip dl-browser__chip--ok">● ISOLADO</span>
            </div>
          ),
        )}
      </div>
    );
  }

  // imoveis (padrão)
  return (
    <>
      <div className="dl-skel" style={{ width: "42%", height: "13px" }} />
      <div className="dl-browser__grid">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="dl-browser__card">
            <div className="dl-browser__thumb" />
            <div className="dl-skel" style={{ width: "72%" }} />
            <div className="dl-skel" style={{ width: "40%", opacity: 0.6 }} />
          </div>
        ))}
      </div>
    </>
  );
}

// Mock do painel dentro de uma moldura de navegador (seção de recursos).
function BrowserMock({ recurso, indice }) {
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
          <div className="dl-browser__tela" key={indice} id="dl-tela-recurso" role="tabpanel">
            <Tela tipo={recurso.tela} />
          </div>
        </div>
      </div>
    </figure>
  );
}

/* Recursos: as células da esquerda são abas e o mock da direita é o painel.
   Enquanto ninguém clicar, avança sozinho de 3 em 3 segundos, em ciclo. O
   primeiro clique entrega o controle ao usuário e a rotação para de vez. */
function Recursos() {
  const [ref, visivel] = useReveal();
  const [ativo, setAtivo] = useState(0);
  const [manual, setManual] = useState(false);
  const botoes = useRef([]);

  const [emMobile, setEmMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 860px)").matches
  );

  useEffect(() => {
    const consulta = window.matchMedia("(max-width: 860px)");
    const aoMudar = (e) => setEmMobile(e.matches);
    consulta.addEventListener("change", aoMudar);
    return () => consulta.removeEventListener("change", aoMudar);
  }, []);

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

  useEffect(() => {
    if (emMobile || manual || !visivel) return undefined;
    const id = setInterval(
      () => setAtivo((i) => (i + 1) % RECURSOS.length),
      RECURSO_INTERVALO,
    );
    return () => clearInterval(id);
  }, [emMobile, manual, visivel]);

  useEffect(() => {
    if (!emMobile || !visivel) return undefined;
    
    let quadro = 0;
    
    const aoRolar = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        const linhaGatilho = window.innerHeight * 0.65;
        let menorDist = Infinity;
        let melhorIndice = -1;

        botoes.current.forEach((btn, i) => {
          if (!btn) return;
          const rect = btn.getBoundingClientRect();
          
          if (rect.bottom > 0 && rect.top < window.innerHeight) {
            const centroBotao = rect.top + (rect.height / 2);
            const dist = Math.abs(centroBotao - linhaGatilho);
            
            if (dist < menorDist) {
              menorDist = dist;
              melhorIndice = i;
            }
          }
        });

        if (melhorIndice !== -1) {
          setAtivo((prev) => prev !== melhorIndice ? melhorIndice : prev);
        }
      });
    };

    window.addEventListener("scroll", aoRolar, { passive: true });
    aoRolar();

    return () => {
      window.removeEventListener("scroll", aoRolar);
      cancelAnimationFrame(quadro);
    };
  }, [emMobile, visivel]);

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

  // Apaga o texto e, só quando ele tiver sumido, devolve o bloco ao laço.
  function fechar() {
    clearTimeout(relogio.current);
    setSaindo(true);
    relogio.current = setTimeout(() => {
      setAberto(null);
      setSaindo(false);
    }, EDITOR_SAIDA);
  }

  function adiarVolta() {
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
        <span className="dl-ed__url dl-mono">domus.app / vitrine / editar</span>
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
              {Array.from({ length: EDITOR_MIOLO[id] }, (_, k) => (
                <i key={k} aria-hidden="true" />
              ))}
              {/* Fora do fluxo de propósito: cada bloco arruma as silhuetas com
                  o próprio flex/grid, e um filho a mais viraria mais uma
                  silhueta torta no meio delas. */}
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
const INTERVALO_PLANO = 5000;

/* Cor de cada plano no carrossel. Uma escala que sobe junto com os planos: azul
   é o tom de entrada, roxo é a cor da marca e dourado é o que a Domus já usa
   para o que é topo de linha.

     cor    contorno neon do cartão em foco
     onda   cor das ondas do fundo (Vanta WAVES) — o Básico não tem, e é isso
            que faz a escada existir: o fundo neutro dele é a referência de onde
            a progressão começa
     tinta  reserva estática para quem pede movimento reduzido, onde as ondas
            não rodam */
const FLARE = {
  BASICO: { cor: "#3882f8b4", onda: null, tinta: null },
  PROFISSIONAL: { cor: "#a855f7", onda: 0x5331b6, tinta: "rgba(83,49,182,0.22)" },
  PREMIUM: { cor: "#f0c24b", onda: 0xa0732e, tinta: "rgba(160,115,46,0.22)" },
};

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

  const [emCarrossel, setEmCarrossel] = useState(
    () => typeof window !== "undefined" && window.matchMedia(CARROSSEL).matches,
  );

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
  const corOnda = useRef(null);
  const alvoOnda = useRef(null);
  if (!corOnda.current) {
    corOnda.current = new THREE.Color(ONDA_INICIAL);
    alvoOnda.current = new THREE.Color(ONDA_INICIAL);
  }

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
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    const efeito = WAVES({
      el,
      THREE,
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      minHeight: 200.0,
      minWidth: 200.0,
      scale: 1.0,
      scaleMobile: 1.0,
      color: corOnda.current.getHex(),
    });

    /* O WAVES mede o elemento uma vez e só remede no resize da janela. Como a
       camada acompanha a altura da seção — que muda quando alguém abre a
       tabela de um plano —, sem isto o canvas ficaria com a altura antiga e as
       ondas terminariam no meio do fundo. */
    const observador = new ResizeObserver(() => efeito.resize());
    observador.observe(el);

    let quadro = requestAnimationFrame(function passo() {
      // Perto o bastante do alvo: para de escrever e só mantém o laço vivo
      // para a próxima troca de plano.
      if (corOnda.current.getHex() !== alvoOnda.current.getHex()) {
        corOnda.current.lerp(alvoOnda.current, 0.05);
        efeito.options.color = corOnda.current.getHex();
      }
      quadro = requestAnimationFrame(passo);
    });

    return () => {
      cancelAnimationFrame(quadro);
      observador.disconnect();
      efeito.destroy();
    };
  }, [ondaPedida, visivel]);

  // O alvo muda com o plano escolhido; o laço acima leva a cor até ele. Quando
  // não há plano (Básico, ou mouse fora), o alvo fica onde estava: o que some é
  // a camada inteira, e guardar a última cor evita a volta atravessando o
  // espectro na próxima vez que ela acender.
  useEffect(() => {
    if (ondaAtual) alvoOnda.current.setHex(ondaAtual);
  }, [ondaAtual]);

  // Quais cartões estão com a tabela inteira aberta. Por plano, e não um só
  // aberto por vez: quem abre um está comparando, e fechar o anterior sozinho
  // desfaria justamente a comparação.
  const [abertos, setAbertos] = useState({});

  useEffect(() => {
    const consulta = window.matchMedia(CARROSSEL);
    const aoMudar = (e) => setEmCarrossel(e.matches);
    consulta.addEventListener("change", aoMudar);
    return () => consulta.removeEventListener("change", aoMudar);
  }, []);

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
    <div className="dl-plans-caixa" ref={caixaRef}>
      {/* Camada do fundo: fica atrás do conteúdo da seção inteira (z-index -1
          dentro do .dl-wrap, que é quem cria o contexto de empilhamento) e
          extravasa o respiro lateral para o clarão não terminar numa quina.
          A tinta estática só aparece quando as ondas não podem rodar. */}
      <div
        className={`dl-plans-onda${ondaAtual ? " is-on" : ""}`}
        ref={ondaRef}
        aria-hidden="true"
        style={{ "--tinta": FLARE[planos[atual]?.key]?.tinta || "transparent" }}
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
          const resumido = emCarrossel && !abertos[p.key];
          return (
          <Reveal
            key={p.key}
            className={`dl-plan${p.highlight ? " is-highlight" : ""}${i === atual ? " is-atual" : ""}`}
            delay={i * 110}
            style={{ "--flare": FLARE[p.key]?.cor || "var(--accent-soft)" }}
            // Só o desktop usa: é daqui que sai a cor do fundo da seção quando
            // não há carrossel. A saída só limpa se o índice ainda for o dele,
            // senão o mouse passando de um cartão para o vizinho apagaria o
            // que o vizinho acabou de acender.
            onMouseEnter={() => setSobHover(i)}
            onMouseLeave={() => setSobHover((h) => (h === i ? null : h))}
          >
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
            <div className="dl-plan__price">
              <strong>{p.price}</strong>
              {p.per ? <span>{p.per}</span> : null}
            </div>
            <span className="dl-mono dl-plan__nota">{p.nota}</span>

            {resumido ? (
              <ul className="dl-plan__list dl-plan__list--resumo" id={`plano-lista-${p.key}`}>
                {p.resumo.map((l) => (
                  <li key={l.label} className={l.heranca ? "is-heranca" : ""}>
                    <span aria-hidden="true"><IconeCheck size={12} /></span>
                    {l.label}
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="dl-plan__list" id={`plano-lista-${p.key}`}>
                {p.linhas.map((l) => (
                  <li key={l.label} className={l.incluso ? "" : "is-off"}>
                    <span aria-hidden="true">{l.incluso ? <IconeCheck size={12} /> : <IconeX size={11} />}</span>
                    {l.label}
                  </li>
                ))}
              </ul>
            )}

            {emCarrossel ? (
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
  // -1 = todas fechadas. A lista abre inteira à vista, e quem escolhe o que
  // ler é o visitante — com uma já aberta, a primeira pergunta ganhava um
  // destaque que ela não tem sobre as outras.
  const [faqAberto, setFaqAberto] = useState(-1);
  const ano = new Date().getFullYear();

  /* Uma porta só para a página inteira: o teste. `planoDesejado` guarda com
     qual plano a pessoa se identificou quando ela chega pelos cartões — o teste
     libera tudo de qualquer jeito, mas essa intenção é o que o time usa para
     puxar a conversa depois. */
  const [trialAberto, setTrialAberto] = useState(false);
  const [planoDesejado, setPlanoDesejado] = useState("");
  const abrirTeste = (plano = "") => { setPlanoDesejado(plano); setTrialAberto(true); };

  // Valores vigentes no provedor; enquanto não chegam, valem os de reserva.
  const PLANS = usePrecosVigentes();

  const vantaRef = useRef(null);

  /* A instância fica em variável local, não em estado. Guardada em estado, a
     limpeza fechava sobre o valor ANTERIOR (ainda null) e não destruía o efeito
     que aquela mesma execução tinha acabado de criar — no StrictMode, que roda
     efeito/limpeza/efeito, sobrava um canvas órfão e a névoa ficava dobrada.
     Rodando uma vez só, cada execução destrói exatamente o que criou. */
  useEffect(() => {
    if (!vantaRef.current) return undefined;
    const efeito = FOG({
      el: vantaRef.current,
      THREE: THREE,
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
    return () => efeito.destroy();
  }, []);

  return (
    <div className="dl-root">
      <DomusStyles extra={CSS} />

      <DomusSplash />

      <TrialModal
        aberto={trialAberto}
        planos={PLANS}
        planoDesejado={planoDesejado}
        aoFechar={() => setTrialAberto(false)}
      />

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
          <SectionHead eyebrow="NÚMEROS DA DOMUS" strong="A plataforma completa" soft="para quem vive de vender imóveis.">
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
            A Domus liga o cadastro do imóvel aos canais que realmente trazem cliente, com a IA cuidando do
            conteúdo dentro da própria plataforma.
          </SectionHead>

          <div className="dl-grid-hair dl-grid-hair--4">
            {INTEGRACOES.map((it, i) => (
              <Reveal
                key={it.name}
                className={`dl-cell dl-int${it.texto ? " dl-int--claro" : ""}`}
                delay={i * 60}
                style={{ "--int-cor": it.cor, "--int-texto": it.texto || "#fff" }}
              >
                <span className="dl-int__marca" aria-hidden="true">
                  <it.Icon size={92} weight="fill" />
                </span>
                <span className="dl-mono dl-int__type">{it.type}</span>
                <span className="dl-int__name">{it.name}</span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Faixa de destaques ── */}
      <section className="dl-section dl-section--tight" id="porque">
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
      <section id="planos" className="dl-section dl-section--alt">
        <div className="dl-wrap">
          <SectionHead eyebrow="PLANOS" eyebrowTone={GOLD} strong="Escolha o plano ideal" soft="para sua imobiliária.">
            Sem fidelidade, cancele quando quiser. Todo o núcleo do produto já está no Básico.
          </SectionHead>

          <Planos planos={PLANS} aoTestar={abrirTeste} />
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="dl-section">
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

      {/* ── CTA final (seção clara) ── */}
      <section id="contato" className="dl-cta" ref={vantaRef}>
        {/* Sem escalopes aqui: a névoa em WebGL já é o movimento desta seção, e
            as flores disputavam com ela em cima do mesmo fundo claro. */}
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
            Crie um ambiente de teste em segundos. Já tem uma imobiliária rodando? A gente traz a
            sua base junto.
          </p>
          {/* Um botão só. A dupla "Testar grátis / Assinar a Domus" oferecia
              uma escolha que não existe mais — e ainda dividia a atenção no
              exato ponto em que a página pede uma decisão. */}
          <div className="dl-btn-row dl-btn-row--center">
            <Button as="button" type="button" variant="dark" onClick={() => abrirTeste()}>
              Testar grátis
            </Button>
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
.dl-browser__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.dl-browser__card {
  border-radius: 11px; border: 1px solid var(--line); background: var(--surface);
  padding: 11px; display: grid; gap: 7px;
}
.dl-browser__thumb {
  height: 56px; border-radius: 8px;
  background: linear-gradient(135deg, rgba(99,102,241,0.38), rgba(212,175,55,0.24));
}

/* ── Telas do mock (uma por recurso) ── */
.dl-browser__body { flex: 1; align-content: start; }
.dl-browser__tela { display: grid; gap: 14px; align-content: start; animation: dlTela 0.42s var(--ease-out) both; }
@keyframes dlTela {
  from { opacity: 0; transform: translateY(9px); }
  to { opacity: 1; transform: none; }
}

.dl-browser__banner {
  height: 76px; border-radius: 10px;
  background: linear-gradient(135deg, rgba(99,102,241,0.42), rgba(212,175,55,0.30));
}
.dl-browser__mini { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; }
.dl-browser__minicard {
  border-radius: 9px; border: 1px solid var(--line); background: var(--surface);
  padding: 8px; display: grid; gap: 6px;
}
.dl-browser__minithumb {
  height: 32px; border-radius: 6px;
  background: linear-gradient(135deg, rgba(99,102,241,0.34), rgba(212,175,55,0.20));
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
/* As silhuetas somem para o texto ocupar o lugar delas. */
.dl-ed__bloco.is-aberto > i { opacity: 0; transition: opacity 0.2s ease; }

.dl-ed__info {
  position: absolute; inset: 0; z-index: 1;
  display: flex; flex-direction: column; justify-content: center; gap: 8px;
  padding: clamp(14px, 4%, 26px); text-align: left;
  opacity: 0; pointer-events: none;
  /* Sumir é rápido e sem espera: o texto tem de ter ido embora ANTES de o bloco
     começar a encolher (a espera correspondente está no .dl-ed__bloco). */
  transition: opacity 0.18s ease;
}
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

/* Miolo: silhuetas de uma cor só, sem texto, insinuando o que cada bloco é —
   mesma ideia das linhas do mockup do hero. Como os blocos mudam de tamanho o
   tempo todo (linha inteira ou meia linha), o arranjo é sempre proporcional. */
.dl-ed__bloco i { display: block; border-radius: 3px; background: rgba(255,255,255,0.125); }

/* Marca à esquerda, itens de menu empurrados para a direita pelo margin auto. */
.dl-ed__bloco--header { display: flex; align-items: center; gap: 5px; padding: 0 9px; }
.dl-ed__bloco--header i { width: 15px; height: 4px; border-radius: 999px; }
.dl-ed__bloco--header i:first-child {
  width: 13px; height: 13px; border-radius: 4px; margin-right: auto;
}

.dl-ed__bloco--titulo {
  display: flex; flex-direction: column; justify-content: center; gap: 5px; padding: 0 11px;
}
.dl-ed__bloco--titulo i { width: 52%; height: 5px; border-radius: 999px; }
.dl-ed__bloco--titulo i:last-child { width: 30%; height: 4px; opacity: 0.72; }

.dl-ed__bloco--destaques {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; padding: 7px;
}
.dl-ed__bloco--destaques i { border-radius: 4px; }

.dl-ed__bloco--imoveis {
  display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, 1fr);
  gap: 5px; padding: 6px;
}

.dl-ed__bloco--widgets {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 7px; padding: 7px;
}
.dl-ed__bloco--widgets i { border-radius: 4px; }

.dl-ed__bloco--rodape {
  display: flex; align-items: center; justify-content: center; gap: 7px; padding: 0 9px;
}
.dl-ed__bloco--rodape i { width: 20px; height: 4px; border-radius: 999px; }

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

/* Pontos do carrossel. Só existem no DOM quando a tela é de celular, então não
   há nada a esconder aqui — o alvo de toque é o botão inteiro (24 × 26), e o
   ponto visível é o ::before, bem menor que ele. */
/* ── Plano sob o mouse (desktop) ────────────────────────────────────────────
   O mesmo par do carrossel — o flare do plano e o botão aceso —, agora regido
   pelo mouse em vez do foco. Vale para o cartão inteiro: quem está lendo a
   lista de recursos já está considerando aquele plano, e o botão acender antes
   de o cursor chegar nele é o que transforma a leitura em clique.

   O flare aqui é PARA DENTRO, e não em volta como no celular. No desktop os
   três planos dividem uma moldura só, com overflow escondido para os cantos
   arredondados valerem: qualquer brilho externo seria decepado na borda do
   quadro e nas divisórias entre os cartões. Para dentro, o cartão acende
   inteiro e a moldura continua intacta.

   Só onde existe mouse de verdade: em tela de toque o :hover fica grudado
   depois do primeiro toque, e o carrossel já tem o dono do destaque, que é o
   cartão em foco. */
@media (hover: hover) and (pointer: fine) and (min-width: 641px) {
  .dl-plan { transition: box-shadow 0.4s var(--ease-out); }
  .dl-plan:hover {
    box-shadow:
      inset 0 0 0 1px color-mix(in srgb, var(--flare) 45%, transparent),
      inset 0 0 30px -14px var(--flare),
      inset 0 -40px 60px -50px var(--flare);
  }
  /* O botão de contorno assume o mesmo preenchimento do botão do plano em
     destaque. A regra precisa de três classes para vencer .dl-root .dl-btn--
     outline, que já pesa duas. */
  .dl-root .dl-plan:hover .dl-btn--outline {
    background: #fff; color: #0a0a0b; border-color: #fff;
  }
  .dl-plan:hover .dl-btn--outline .dl-btn__arrow { background: rgba(0,0,0,0.10); }
}

/* ── Fundo em ondas da seção de planos ──
   A camada vale nos dois formatos: no celular ela segue o cartão em foco, no
   desktop segue o cartão sob o mouse. Vaza para os lados até a largura da
   janela (o .dl-wrap tem no máximo 1120px e é centrado, então tirar metade da
   diferença de cada lado chega na borda da tela) — tingir só a coluna de
   conteúdo deixaria um retângulo colorido boiando no meio da seção.

   Fica atrás de tudo pelo z-index negativo, que aqui não escapa da seção
   porque o .dl-wrap tem z-index 1 e portanto cria o próprio contexto. */
.dl-plans-onda {
  position: absolute; z-index: -1; pointer-events: none;
  top: -70px; bottom: -70px;
  left: calc(50% - 50vw); right: calc(50% - 50vw);
  opacity: 0; transition: opacity 0.9s ease;
  background: radial-gradient(70% 62% at 50% 48%, var(--tinta, transparent), transparent 72%);
  -webkit-mask-image: radial-gradient(72% 68% at 50% 50%, #000 34%, transparent 100%);
  mask-image: radial-gradient(72% 68% at 50% 50%, #000 34%, transparent 100%);
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
.dl-plans__ponto.is-on::before { width: 20px; background: var(--accent-soft); }

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
/* ── Tablet estreito ──
   As abas de recursos já estão empilhadas sobre o painel desde os 1024px, e é
   aqui que a distância entre um e outro começa a incomodar. */
@media (max-width: 860px) {
  /* Coluna de flex, e não mais grade: item de grade fica preso à própria
     célula, que aqui tem a altura do painel — ele descolaria do topo no
     primeiro rolar. Em flex, quem contém o sticky é a coluna inteira, então o
     painel acompanha as seis abas até a última. */
  .dl-split { display: flex; flex-direction: column; gap: 16px; }
  /* O painel vem primeiro e fica preso no alto enquanto as abas passam por
     baixo. É o que devolve sentido ao toque: a tela muda à vista de quem
     tocou. O fundo é obrigatório — sem ele o conteúdo rolaria por trás da
     legenda, que não tem superfície própria. */
  .dl-split__tela {
    order: -1; position: sticky; top: 58px; z-index: 2;
    padding: 10px 0; background: var(--bg);
  }
  /* Preso no topo, o painel não pode comer a tela inteira: o que sobra é para
     as abas, que são o conteúdo desta seção. */
  .dl-browser { max-height: min(468px, 42vh); }
}

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
  .dl-hero__copy .dl-btn-row > :first-child { width: var(--acao); heigh }
  /* max-content como piso: em telas bem estreitas, metade da linha ficaria
     menor que "Ver planos" e o texto vazaria do botão. */
  .dl-hero__copy .dl-btn-row > :last-child { width: calc(var(--acao) / 2); min-width: max-content; }
  .dl-browser__body { padding: 14px; gap: 11px; }
  .dl-browser__thumb { height: 44px; }
  .dl-browser__banner { height: 60px; }
  .dl-browser__chart { height: 74px; }
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
  .dl-root .dl-header__cta, .dl-burger__label { display: none; }
  .dl-header__tipo, .dl-header.is-scrolled .dl-header__tipo { height: 34px; }
  .dl-menu__socials { flex-direction: column; gap: 8px; }
  .dl-menu__ghost { font-size: 7.5rem; }
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
  /* A seção de recursos deixa de ser a base: o painel grudado no topo tem de
     acompanhar o fundo dela, senão aparece um retângulo escuro sobre o claro. */
  .dl-split__tela { background: var(--bg-alt); }

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
  .dl-editor { display: flex; flex-direction: column; }
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
  .dl-marquee {
    -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
    mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
  }

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
       terminava numa linha reta — e reta é justamente o que denuncia que ele é
       um efeito, e não luz. A conta da folga: a camada mais larga do flare
       (blur 58, spread -12) sai uns 17px do cartão, mais a coroa, que sobe 14
       e ainda tem sombra própria. */
    padding: 38px 0 30px;
    scrollbar-width: none; -ms-overflow-style: none;
    -webkit-mask-image: linear-gradient(90deg, transparent, #000 9%, #000 91%, transparent);
    mask-image: linear-gradient(90deg, transparent, #000 9%, #000 91%, transparent);
  }
  .dl-plans::-webkit-scrollbar { display: none; }

  /* Os pontos sobem para cima do trilho. Um plano é mais alto que a tela, então
     embaixo eles só apareceriam depois de rolar o cartão inteiro — tarde
     demais para o que eles servem, que é avisar na chegada que existem três. */
  .dl-plans-caixa { display: flex; flex-direction: column; }
  .dl-plans__pontos { order: -1; margin: 0 0 -4px; }

  /* Na tela estreita a seção é mais alta e a marca de cor precisa subir junto,
     senão ela morre antes do título. A máscara também abre, porque aqui a
     camada é quase quadrada e a elipse padrão deixaria os cantos vazios. */
  .dl-plans-onda {
    top: -48px; bottom: -30px;
    background: radial-gradient(115% 70% at 50% 45%, var(--tinta, transparent), transparent 72%);
    -webkit-mask-image: radial-gradient(112% 74% at 50% 46%, #000 40%, transparent 100%);
    mask-image: radial-gradient(112% 74% at 50% 46%, #000 40%, transparent 100%);
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
  /* ── Flare do cartão em foco ──
     A cor vem de --flare, escrito no cartão pelo JS, então cada plano acende na
     sua. Quatro camadas de sombra: o fio da borda, a luz curta e duas de
     estouro, que é o que dá a leitura de neon.

     Tudo em box-shadow, e nenhuma camada por baixo do cartão. Sombra externa é
     desenhada FORA da caixa de borda, então ela não tem como pintar o miolo em
     nenhum estado — nem quando o cartão vira contexto de empilhamento. Foi a
     tentativa anterior, com um pseudo-elemento borrado atrás, que fazia o
     cartão piscar de cor no meio da troca.

     Nada de sombra interna, pelo mesmo motivo: ela pintaria a beirada do miolo
     com a cor do plano. */
  .dl-plans .dl-plan.is-atual {
    filter: none; transform: none;
    border-color: color-mix(in srgb, var(--flare) 65%, transparent);
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--flare) 42%, transparent),
      0 0 11px -2px color-mix(in srgb, var(--flare) 55%, transparent),
      0 0 26px -4px color-mix(in srgb, var(--flare) 42%, transparent),
      0 0 58px -12px color-mix(in srgb, var(--flare) 72%, transparent);
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
  .dl-plan__list { margin: 16px 0 8px; gap: 9px; }
  .dl-plan__list--resumo li.is-heranca { color: var(--strong); font-weight: 600; }
  .dl-plan__list--resumo li.is-heranca span { color: var(--accent-soft); }
  .dl-root .dl-plan__mais {
    width: 100%; margin: 0 0 18px; padding: 9px 0;
    display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    background: none; border: 0; border-radius: 0; box-shadow: none; transform: none;
    font-family: inherit; font-size: 12.5px; font-weight: 600; color: var(--accent-soft);
    cursor: pointer;
  }
  .dl-root .dl-plan__mais:hover,
  .dl-root .dl-plan__mais:active {
    background: none; box-shadow: none; transform: none; scale: 1; color: var(--strong);
  }
  .dl-plan__mais svg { transition: transform 0.3s var(--ease-out); }
  .dl-plan__mais[aria-expanded="true"] svg { transform: rotate(180deg); }

  .dl-callout { padding: 22px 20px; }

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
  .dl-footer__cols { grid-template-columns: 1fr; }
  .dl-btn-row .dl-btn { width: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .dl-marquee__track, .dl-stage__float, .dl-chip-float, .dl-pulse { animation: none; }
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
  .dl-menu, .dl-menu__side { transition: none; }
  .dl-menu__links a { transform: none; transition: color 0.3s ease; transition-delay: 0s; }
  .dl-faq__panel, .dl-faq__a, .dl-faq__toggle, .dl-faq__bar { transition: none; }
}
`;
