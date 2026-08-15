/* ────────────────────────────────────────────────────────────────────────────
   Biblioteca de componentes do editor.

   Duas famílias, porque quem monta a página pensa assim: peças genéricas de
   qualquer site e peças que só fazem sentido numa imobiliária. A separação é o
   que permite ao painel esquerdo ter cabeçalhos com significado em vez de uma
   lista de dez itens em ordem de implementação.

   `preview` é a miniatura esquemática mostrada no cartão — sem texto, só a
   forma: é ela que diz "isto é um bloco de estatísticas" antes de a pessoa ler
   o nome.
   ──────────────────────────────────────────────────────────────────────────── */

const linha = (largura, opacidade = 0.5) => (
  <div style={{ width: largura, height: 4, borderRadius: 2, background: "currentColor", opacity: opacidade }} />
);

export const WIDGET_LIBRARY = [
  {
    type: "text",
    categoria: "basicos",
    nome: "Texto",
    title: "Bloco de Texto",
    content: "Use este bloco para descrever diferenciais, condições especiais ou informações adicionais importantes.",
    tamanho: { w: 50, h: 220 },
    preview: (
      <div style={{ display: "grid", gap: 4 }}>
        {linha("100%")}{linha("85%", 0.35)}{linha("60%", 0.35)}
      </div>
    ),
  },
  {
    type: "cta",
    categoria: "basicos",
    nome: "CTA",
    title: "Pronto para encontrar seu imóvel?",
    content: "Fale com nossa equipe e receba as melhores opções para seu perfil.",
    ctaLabel: "Falar no WhatsApp",
    ctaUrl: "https://wa.me/",
    tamanho: { w: 100, h: 240 },
    preview: (
      <div style={{ display: "grid", gap: 5, justifyItems: "center" }}>
        {linha("70%")}
        <div style={{ width: "50%", height: 10, borderRadius: 5, background: "var(--accent)" }} />
      </div>
    ),
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
    type: "faq",
    categoria: "basicos",
    nome: "FAQ",
    title: "Como funciona o processo de locação sem fiador?",
    content: "Explique aqui a resposta de forma direta, em duas ou três linhas.",
    tamanho: { w: 50, h: 200 },
    preview: (
      <div style={{ display: "grid", gap: 5 }}>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)" }} />
          {linha("70%")}
        </div>
        {linha("90%", 0.3)}
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
    preview: (
      <div style={{ border: "1px dashed currentColor", opacity: 0.5, borderRadius: 5, padding: 5, display: "grid", gap: 4 }}>
        {linha("80%")}{linha("55%", 0.35)}
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
    preview: (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ height: 20, borderRadius: 4, background: "var(--accent)", opacity: 0.25 }} />
        ))}
      </div>
    ),
  },
  {
    type: "testimonial",
    categoria: "imobiliaria",
    nome: "Depoimento",
    title: "— Maria Silva, Compradora",
    content: "\"Encontrei o imóvel dos meus sonhos em menos de uma semana. Atendimento excepcional e sem burocracia!\"",
    tamanho: { w: 50, h: 260 },
    preview: (
      <div style={{ display: "grid", gap: 5, justifyItems: "center" }}>
        <div style={{ color: "#f59e0b", fontSize: 10, letterSpacing: 1 }}>★★★★★</div>
        {linha("85%", 0.35)}
      </div>
    ),
  },
  {
    type: "hours",
    categoria: "imobiliaria",
    nome: "Horários",
    title: "Horário de Atendimento",
    content: "Segunda a Sexta: 09h às 18h<br>Sábados: 09h às 13h<br>Domingos e Feriados: Fechado",
    tamanho: { w: 50, h: 220 },
    preview: (
      <div style={{ display: "grid", gap: 4 }}>
        {linha("80%")}{linha("65%", 0.35)}{linha("45%", 0.35)}
      </div>
    ),
  },
  {
    type: "map",
    categoria: "imobiliaria",
    nome: "Localização",
    title: "Nossa Localização",
    content: "Rua das Flores, 123 — Centro — São Paulo, SP",
    tamanho: { w: 50, h: 280 },
    preview: (
      <div style={{ height: 26, borderRadius: 5, background: "var(--accent)", opacity: 0.18, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", opacity: 1 }} />
      </div>
    ),
  },
  {
    type: "social",
    categoria: "imobiliaria",
    nome: "Redes sociais",
    title: "Siga nas Redes Sociais",
    content: "https://wa.me/|https://instagram.com/|https://facebook.com/",
    tamanho: { w: 100, h: 230 },
    preview: (
      <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
        <div style={{ width: 22, height: 12, borderRadius: 3, background: "#25D366" }} />
        <div style={{ width: 22, height: 12, borderRadius: 3, background: "#E1306C" }} />
        <div style={{ width: 22, height: 12, borderRadius: 3, background: "#1877F2" }} />
      </div>
    ),
  },
];

export const CATEGORIAS = [
  { id: "basicos", titulo: "Básicos" },
  { id: "imobiliaria", titulo: "Imobiliária" },
];

export function widgetsDaCategoria(id) {
  return WIDGET_LIBRARY.filter((w) => w.categoria === id);
}
