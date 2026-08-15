import { DEFAULT_LAYOUT, DEFAULT_MOBILE_LAYOUT } from "../../../utils/showcaseConfig";

/* ────────────────────────────────────────────────────────────────────────────
   Templates de página.

   Cada um é um "makeover" completo: modo (dark/light), fonte, cores, posições
   dos blocos, estilos e o ARRANJO dos widgets. O conteúdo escrito pelo cliente
   (títulos, destaques, rodapé) é preservado — muda a estrutura e o visual.

   Os widgets saem daqui com `x/y/w/h` soltos de propósito: aplicar um template
   passa por `normalizeShowcaseConfig`, que migra para `layout.desktop/mobile`.
   Repetir a posição duas vezes aqui só criaria dois números para manter.
   ──────────────────────────────────────────────────────────────────────────── */

const mkW = (id, type, title, content, pos, extra = {}) => ({
  id, type, title, content,
  ctaLabel: extra.ctaLabel || "", ctaUrl: extra.ctaUrl || "",
  backgroundColor: extra.backgroundColor || "", color: extra.color || "",
  x: pos.x ?? 0, y: pos.y, w: pos.w ?? 100, h: pos.h ?? 230, hidden: false,
});

const wStats = (y, h = 240) =>
  mkW("tpl-stats", "stats", "Nossos Números", "200+|Imóveis vendidos|15 anos|De experiência|4.9★|Avaliação média", { y, h });
const wTesti = (pos) =>
  mkW("tpl-testi", "testimonial", "— Maria Silva, Compradora", "\"Encontrei o imóvel dos meus sonhos em menos de uma semana. Atendimento excepcional e sem burocracia!\"", pos);
const wHours = (pos) =>
  mkW("tpl-hours", "hours", "Horário de Atendimento", "Segunda a Sexta: 09h às 18h<br>Sábados: 09h às 13h<br>Domingos e Feriados: Fechado", pos);
const wCta = (y, h = 230) =>
  mkW("tpl-cta", "cta", "Pronto para encontrar seu imóvel?", "Fale com nossa equipe e receba as melhores opções para o seu perfil.", { y, h }, { ctaLabel: "Falar no WhatsApp", ctaUrl: "https://wa.me/" });

const EMPTY_HL = [
  { backgroundColor: "", color: "" },
  { backgroundColor: "", color: "" },
  { backgroundColor: "", color: "" },
];

const tplBlock = (bg) => ({ backgroundColor: bg, color: "", backgroundImage: "", backgroundOverlay: 0, backgroundBrightness: 1 });

const tplLayout = (titleH, footerY) => ({
  ...DEFAULT_LAYOUT,
  title: { ...DEFAULT_LAYOUT.title, h: titleH },
  footer: { ...DEFAULT_LAYOUT.footer, y: footerY },
});

export const BUILDER_TEMPLATES = [
  {
    id: "classico", name: "Clássico", desc: "Grade equilibrada, escuro sóbrio",
    primaryColor: "#6366f1", secondaryColor: "#d4af37",
    config: {
      appearanceMode: "dark", globalFont: "Inter",
      layout: tplLayout(260, 2360), mobileLayout: { ...DEFAULT_MOBILE_LAYOUT },
      blockStyles: {}, highlightStyles: EMPTY_HL,
      widgets: [wStats(1470), wTesti({ x: 0, y: 1770, w: 49, h: 240 }), wHours({ x: 51, y: 1770, w: 49, h: 240 }), wCta(2070)],
    },
  },
  {
    id: "editorial", name: "Editorial", desc: "Título alto e clean, modo claro",
    primaryColor: "#2563eb", secondaryColor: "#0ea5e9",
    config: {
      appearanceMode: "light", globalFont: "Playfair Display",
      layout: tplLayout(300, 2100), mobileLayout: { ...DEFAULT_MOBILE_LAYOUT },
      blockStyles: {}, highlightStyles: EMPTY_HL,
      widgets: [wCta(1470, 260), wTesti({ x: 0, y: 1790, w: 100, h: 240 })],
    },
  },
  {
    id: "luxo", name: "Luxo", desc: "Premium, dourado, serifada",
    primaryColor: "#7c3aed", secondaryColor: "#d4af37",
    config: {
      appearanceMode: "dark", globalFont: "Playfair Display",
      layout: tplLayout(280, 2070), mobileLayout: { ...DEFAULT_MOBILE_LAYOUT },
      blockStyles: { title: tplBlock("rgba(124,58,237,0.08)") },
      highlightStyles: [
        { backgroundColor: "rgba(212,175,55,0.08)", color: "" },
        { backgroundColor: "rgba(212,175,55,0.08)", color: "" },
        { backgroundColor: "rgba(212,175,55,0.08)", color: "" },
      ],
      widgets: [wTesti({ x: 0, y: 1470, w: 100, h: 240 }), wStats(1790)],
    },
  },
  {
    id: "minimal", name: "Minimalista", desc: "Muito respiro, claro e neutro",
    primaryColor: "#334155", secondaryColor: "#64748b",
    config: {
      appearanceMode: "light", globalFont: "Montserrat",
      layout: tplLayout(300, 1860), mobileLayout: { ...DEFAULT_MOBILE_LAYOUT },
      blockStyles: {}, highlightStyles: EMPTY_HL,
      widgets: [wCta(1500, 240)],
    },
  },
  {
    id: "natureza", name: "Natureza", desc: "Tons verdes e terrosos, escuro",
    primaryColor: "#16a34a", secondaryColor: "#ca8a04",
    config: {
      appearanceMode: "dark", globalFont: "Merriweather",
      layout: tplLayout(260, 2360), mobileLayout: { ...DEFAULT_MOBILE_LAYOUT },
      blockStyles: { highlights: tplBlock("rgba(22,163,74,0.08)") }, highlightStyles: EMPTY_HL,
      widgets: [wStats(1470), wHours({ x: 0, y: 1770, w: 49, h: 240 }), wTesti({ x: 51, y: 1770, w: 49, h: 240 }), wCta(2070)],
    },
  },
  {
    id: "vibrante", name: "Vibrante", desc: "Cards coloridos, teal ousado",
    primaryColor: "#0d9488", secondaryColor: "#06b6d4",
    config: {
      appearanceMode: "dark", globalFont: "Raleway",
      layout: tplLayout(280, 2410), mobileLayout: { ...DEFAULT_MOBILE_LAYOUT },
      blockStyles: {},
      highlightStyles: [
        { backgroundColor: "rgba(13,148,136,0.14)", color: "" },
        { backgroundColor: "rgba(6,182,212,0.14)", color: "" },
        { backgroundColor: "rgba(13,148,136,0.14)", color: "" },
      ],
      widgets: [wStats(1470, 260), wTesti({ x: 0, y: 1790, w: 100, h: 240 }), wCta(2110, 240)],
    },
  },
];

/** Miniatura esquemática do template: mini-página refletindo modo/cores/estrutura. */
export function TemplateThumb({ tpl }) {
  const dark = tpl.config.appearanceMode !== "light";
  const bg = dark ? "#0f172a" : "#eef2f7";
  const surface = dark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.06)";
  const line = dark ? "rgba(255,255,255,0.18)" : "rgba(15,23,42,0.18)";
  const nW = (tpl.config.widgets || []).length;
  const bar = (w, h, c, o = 1) => <div style={{ width: w, height: h, borderRadius: 2, background: c, opacity: o }} />;

  return (
    <div style={{ borderRadius: 8, overflow: "hidden", background: bg, border: `1px solid ${line}`, padding: 7, display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 3, alignItems: "center" }}>{bar(7, 7, tpl.secondaryColor)}{bar(20, 3, line)}</div>
        {bar(15, 5, tpl.primaryColor)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "center", margin: "3px 0" }}>
        {bar("62%", 4, line)}{bar("44%", 3, line, 0.6)}
      </div>
      <div style={{ display: "flex", gap: 3 }}>
        {[0, 1, 2].map((i) => <div key={i} style={{ flex: 1, height: 7, borderRadius: 3, background: surface }} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ height: 13, borderRadius: 3, background: `linear-gradient(135deg, ${tpl.primaryColor}66, ${surface})` }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 3 }}>
        {nW >= 3
          ? [0, 1, 2].map((i) => <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: surface }} />)
          : nW === 2
            ? [0, 1].map((i) => <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: surface }} />)
            : <div style={{ flex: 1, height: 6, borderRadius: 3, background: tpl.primaryColor, opacity: 0.55 }} />}
      </div>
    </div>
  );
}
