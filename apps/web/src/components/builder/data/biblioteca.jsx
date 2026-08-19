import {
  DADOS_BUSCA_PADRAO,
  DADOS_EQUIPE_PADRAO,
  DADOS_FAQ_PADRAO,
  DADOS_FINANCIAMENTO_PADRAO,
  DADOS_PASSOS_PADRAO,
  DADOS_REGIOES_PADRAO,
  serializarDadosWidget,
} from "../../showcase/widgets/widgetData.js";

/* ────────────────────────────────────────────────────────────────────────────
   Biblioteca de componentes do editor.

   As peças estão organizadas pelo papel que cumprem na página: elementos
   genéricos, conteúdo imobiliário e conversão. `preview` é só a miniatura da
   biblioteca; ao entrar no canvas, quem aparece é o componente real da vitrine.
   ──────────────────────────────────────────────────────────────────────────── */

const linha = (largura, opacidade = 0.5) => (
  <div style={{ width: largura, height: 4, borderRadius: 2, background: "currentColor", opacity: opacidade }} />
);

const miniCard = (largura = "100%") => (
  <div style={{ width: largura, height: 12, borderRadius: 4, background: "var(--accent)", opacity: 0.2 }} />
);

export const WIDGET_LIBRARY = [
  {
    type: "text",
    categoria: "basicos",
    nome: "Texto",
    title: "Bloco de Texto",
    content: "Use este bloco para descrever diferenciais, condições especiais ou informações adicionais importantes.",
    tamanho: { w: 50, h: 220 },
    preview: <div style={{ display: "grid", gap: 4 }}>{linha("100%")} {linha("85%", 0.35)} {linha("60%", 0.35)}</div>,
  },
  {
    type: "divider",
    categoria: "basicos",
    nome: "Divisor",
    title: "✦  Seção  ✦",
    content: "",
    tamanho: { w: 100, h: 120 },
    preview: (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ flex: 1, height: 1, background: "currentColor", opacity: 0.4 }} />
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
        <div style={{ flex: 1, height: 1, background: "currentColor", opacity: 0.4 }} />
      </div>
    ),
  },
  {
    type: "note",
    categoria: "basicos",
    nome: "Aviso",
    title: "Aviso Importante",
    content: "Documentação e simulação de financiamento sob análise da imobiliária. Valores sujeitos a alteração.",
    tamanho: { w: 50, h: 190 },
    preview: <div style={{ border: "1px dashed currentColor", opacity: 0.5, borderRadius: 5, padding: 5, display: "grid", gap: 4 }}>{linha("80%")} {linha("55%", 0.35)}</div>,
  },
  {
    type: "steps",
    categoria: "basicos",
    nome: "Como funciona",
    title: "Como encontrar seu imóvel",
    content: serializarDadosWidget(DADOS_PASSOS_PADRAO),
    tamanho: { w: 100, h: 300 },
    preview: (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 3 }}>
        {[0, 1, 2, 3].map((i) => <div key={i} style={{ height: 22, borderRadius: 4, border: "1px solid currentColor", opacity: 0.28 }} />)}
      </div>
    ),
  },

  {
    type: "stats",
    categoria: "imobiliaria",
    nome: "Números",
    title: "Nossos Números",
    content: "200+|Imóveis vendidos|15 anos|De experiência|4.9★|Avaliação média",
    tamanho: { w: 100, h: 260 },
    preview: <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>{[0, 1, 2].map((i) => <div key={i} style={{ height: 20, borderRadius: 4, background: "var(--accent)", opacity: 0.25 }} />)}</div>,
  },
  {
    type: "testimonial",
    categoria: "imobiliaria",
    nome: "Depoimento",
    title: "— Maria Silva, Compradora",
    content: "\"Encontrei o imóvel dos meus sonhos em menos de uma semana. Atendimento excepcional e sem burocracia!\"",
    tamanho: { w: 50, h: 260 },
    preview: <div style={{ display: "grid", gap: 5, justifyItems: "center" }}><div style={{ color: "#f59e0b", fontSize: 10, letterSpacing: 1 }}>★★★★★</div>{linha("85%", 0.35)}</div>,
  },
  {
    type: "hours",
    categoria: "imobiliaria",
    nome: "Horários",
    title: "Horário de Atendimento",
    content: "Segunda a Sexta: 09h às 18h<br>Sábados: 09h às 13h<br>Domingos e Feriados: Fechado",
    tamanho: { w: 50, h: 220 },
    preview: <div style={{ display: "grid", gap: 4 }}>{linha("80%")} {linha("65%", 0.35)} {linha("45%", 0.35)}</div>,
  },
  {
    type: "map",
    categoria: "imobiliaria",
    nome: "Localização",
    title: "Nossa Localização",
    content: "Rua das Flores, 123 — Centro — São Paulo, SP",
    tamanho: { w: 50, h: 280 },
    preview: <div style={{ height: 26, borderRadius: 5, background: "var(--accent)", opacity: 0.18, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", opacity: 1 }} /></div>,
  },
  {
    type: "social",
    categoria: "imobiliaria",
    nome: "Redes sociais",
    title: "Acompanhe nas Redes Sociais",
    content: "https://wa.me/|https://instagram.com/|https://facebook.com/",
    tamanho: { w: 100, h: 230 },
    preview: <div style={{ display: "flex", gap: 4, justifyContent: "center" }}><div style={{ width: 22, height: 12, borderRadius: 3, background: "#25D366" }} /><div style={{ width: 22, height: 12, borderRadius: 3, background: "#E1306C" }} /><div style={{ width: 22, height: 12, borderRadius: 3, background: "#1877F2" }} /></div>,
  },
  {
    type: "regions",
    categoria: "imobiliaria",
    nome: "Regiões",
    title: "Onde você quer morar?",
    content: serializarDadosWidget(DADOS_REGIOES_PADRAO),
    ctaUrl: "https://wa.me/",
    tamanho: { w: 50, h: 270 },
    preview: <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>{["35%", "28%", "31%", "24%", "38%"].map((w, i) => <div key={i} style={{ width: w, height: 9, borderRadius: 9, background: "var(--accent)", opacity: 0.23 }} />)}</div>,
  },
  {
    type: "team",
    categoria: "imobiliaria",
    nome: "Equipe",
    title: "Conheça nossa equipe",
    content: serializarDadosWidget(DADOS_EQUIPE_PADRAO),
    ctaUrl: "https://wa.me/",
    tamanho: { w: 100, h: 360 },
    preview: <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4 }}>{[0, 1, 2].map((i) => <div key={i} style={{ display: "grid", placeItems: "center", gap: 3 }}>{<div style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--accent)", opacity: 0.28 }} />}{miniCard("80%")}</div>)}</div>,
  },

  {
    type: "property-search",
    categoria: "conversao",
    nome: "Busca de imóveis",
    title: "Encontre seu próximo imóvel",
    content: serializarDadosWidget(DADOS_BUSCA_PADRAO),
    ctaLabel: "Encontrar imóveis",
    ctaUrl: "https://wa.me/",
    tamanho: { w: 100, h: 300 },
    preview: <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 3, alignItems: "center" }}>{miniCard()}{miniCard()}{miniCard()}<div style={{ width: 16, height: 12, borderRadius: 4, background: "var(--accent)", opacity: 0.65 }} /></div>,
  },
  {
    type: "faq",
    categoria: "conversao",
    nome: "FAQ",
    title: "Perguntas frequentes",
    content: serializarDadosWidget(DADOS_FAQ_PADRAO),
    tamanho: { w: 50, h: 320 },
    preview: <div style={{ display: "grid", gap: 4 }}>{[0, 1, 2].map((i) => <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 8, borderBottom: "1px solid currentColor", opacity: 0.32 }}><span style={{ width: "65%", height: 3, background: "currentColor" }} /><span>+</span></div>)}</div>,
  },
  {
    type: "finance",
    categoria: "conversao",
    nome: "Financiamento",
    title: "Simule seu financiamento",
    content: serializarDadosWidget(DADOS_FINANCIAMENTO_PADRAO),
    tamanho: { w: 50, h: 390 },
    preview: <div style={{ display: "grid", gap: 4 }}>{miniCard("100%")} {miniCard("100%")}<div style={{ height: 12, borderRadius: 4, background: "var(--accent)", opacity: 0.28 }} /></div>,
  },
  {
    type: "cta",
    categoria: "conversao",
    nome: "CTA",
    title: "Pronto para encontrar seu imóvel?",
    content: "Fale com nossa equipe e receba as melhores opções para seu perfil.",
    ctaLabel: "Falar no WhatsApp",
    ctaUrl: "https://wa.me/",
    tamanho: { w: 100, h: 240 },
    preview: <div style={{ display: "grid", gap: 5, justifyItems: "center" }}>{linha("70%")}<div style={{ width: "50%", height: 10, borderRadius: 5, background: "var(--accent)" }} /></div>,
  },
];

export const CATEGORIAS = [
  { id: "basicos", titulo: "Básicos" },
  { id: "imobiliaria", titulo: "Imobiliária" },
  { id: "conversao", titulo: "Conversão" },
];

export function widgetsDaCategoria(id) {
  return WIDGET_LIBRARY.filter((w) => w.categoria === id);
}
