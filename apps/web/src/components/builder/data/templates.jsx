import { DEFAULT_LAYOUT, DEFAULT_MOBILE_LAYOUT } from "../../../utils/showcaseConfig";
import { PreviaDoModelo } from "./PreviaDoModelo.jsx";
import {
  DADOS_BUSCA_PADRAO,
  DADOS_EQUIPE_PADRAO,
  DADOS_FAQ_PADRAO,
  DADOS_FINANCIAMENTO_PADRAO,
  DADOS_PASSOS_PADRAO,
  DADOS_REGIOES_PADRAO,
  serializarDadosWidget,
} from "../../showcase/widgets/widgetData.js";

/* Templates completos. As linhas horizontais usam a mesma gramática da grade
   magnética: 1/1, 1/2, 1/3 e 1/4 são larguras exatas de 100 / 50 / 33,33 / 25%. */

const mkW = (id, type, title, content, pos, extra = {}) => ({
  id, type, title, content,
  ctaLabel: extra.ctaLabel || "", ctaUrl: extra.ctaUrl || "",
  backgroundColor: extra.backgroundColor || "", color: extra.color || "",
  x: pos.x ?? 0, y: pos.y, w: pos.w ?? 100, h: pos.h ?? 230, hidden: false,
});

const slot = (indice, total, y, h) => ({
  x: (indice * 100) / total,
  y,
  w: 100 / total,
  h,
});

const full = (y, h) => slot(0, 1, y, h);

const wStats = (pos) => mkW("tpl-stats", "stats", "Nossos Números", "200+|Imóveis vendidos|15 anos|De experiência|4.9★|Avaliação média", pos);
const wTesti = (pos) => mkW("tpl-testi", "testimonial", "— Maria Silva, Compradora", "\"Encontrei o imóvel dos meus sonhos em menos de uma semana. Atendimento excepcional e sem burocracia!\"", pos);
const wHours = (pos) => mkW("tpl-hours", "hours", "Horário de Atendimento", "Segunda a Sexta: 09h às 18h<br>Sábados: 09h às 13h<br>Domingos e Feriados: Fechado", pos);
const wMap = (pos) => mkW("tpl-map", "map", "Nossa Localização", "Rua das Flores, 123 — Centro — São Paulo, SP", pos);
const wSearch = (pos) => mkW("tpl-search", "property-search", "Encontre seu próximo imóvel", serializarDadosWidget(DADOS_BUSCA_PADRAO), pos, { ctaLabel: "Encontrar imóveis", ctaUrl: "https://wa.me/" });
const wRegions = (pos) => mkW("tpl-regions", "regions", "Onde você quer morar?", serializarDadosWidget(DADOS_REGIOES_PADRAO), pos, { ctaUrl: "https://wa.me/" });
const wFaq = (pos) => mkW("tpl-faq", "faq", "Perguntas frequentes", serializarDadosWidget(DADOS_FAQ_PADRAO), pos);
const wSteps = (pos) => mkW("tpl-steps", "steps", "Como encontrar seu imóvel", serializarDadosWidget(DADOS_PASSOS_PADRAO), pos);
const wTeam = (pos) => mkW("tpl-team", "team", "Conheça nossa equipe", serializarDadosWidget(DADOS_EQUIPE_PADRAO), pos, { ctaUrl: "https://wa.me/" });
const wFinance = (pos) => mkW("tpl-finance", "finance", "Simule seu financiamento", serializarDadosWidget(DADOS_FINANCIAMENTO_PADRAO), pos);
const wCta = (pos) => mkW("tpl-cta", "cta", "Pronto para encontrar seu imóvel?", "Fale com nossa equipe e receba as melhores opções para o seu perfil.", pos, { ctaLabel: "Falar no WhatsApp", ctaUrl: "https://wa.me/" });

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

/* Cada modelo traz também a IDENTIDADE DE LAYOUT — zebra, largura da página,
   largura das peças e espaçamentos —, e não só as peças e as cores. Dois
   modelos com as mesmas peças em ordens diferentes ainda pareciam o mesmo
   site; o respiro e a largura são o que faz o "Luxo" ler como luxo (largo,
   arejado) e o "Compacta" como compacta (justo, sem zebra). São os mesmos
   campos do inspetor da página, então quem escolhe o modelo pode ajustar
   depois, peça a peça. */
export const BUILDER_TEMPLATES = [
  {
    id: "classico", name: "Clássico", desc: "Busca 1/1, dupla 1/2 e trio 1/3",
    primaryColor: "#6366f1", secondaryColor: "#d4af37",
    config: {
      appearanceMode: "dark",
      // A identidade de layout do modelo (zebra, largura, espaçamento) — ver `campoZebrado` & cia.
      zebrado: true,  larguraLivre: false, larguraDasPecas: 100, espacamento: { interno: 0,  externo: 8 }, globalFont: "Inter",
      layout: tplLayout(260, 3190), mobileLayout: { ...DEFAULT_MOBILE_LAYOUT },
      blockStyles: {}, highlightStyles: EMPTY_HL,
      widgets: [
        wSearch(full(1470, 300)),
        wStats(full(1830, 260)),
        wTesti(slot(0, 2, 2150, 260)), wHours(slot(1, 2, 2150, 260)),
        wRegions(slot(0, 3, 2470, 360)), wMap(slot(1, 3, 2470, 360)), wFinance(slot(2, 3, 2470, 360)),
        wCta(full(2890, 240)),
      ],
    },
  },
  {
    id: "editorial", name: "Editorial", desc: "Narrativa 1/1 com dupla de decisão 1/2",
    primaryColor: "#2563eb", secondaryColor: "#0ea5e9",
    config: {
      appearanceMode: "light",
      // A identidade de layout do modelo (zebra, largura, espaçamento) — ver `campoZebrado` & cia.
      zebrado: false, larguraLivre: false, larguraDasPecas: 100, espacamento: { interno: 12, externo: 16 }, globalFont: "Playfair Display",
      layout: tplLayout(300, 3020), mobileLayout: { ...DEFAULT_MOBILE_LAYOUT },
      blockStyles: {}, highlightStyles: EMPTY_HL,
      widgets: [
        wSteps(full(1470, 320)),
        wFaq(slot(0, 2, 1850, 380)), wFinance(slot(1, 2, 1850, 380)),
        wTeam(full(2290, 360)),
        wCta(full(2710, 250)),
      ],
    },
  },
  {
    id: "luxo", name: "Luxo", desc: "Busca ampla e faixa premium em 1/3",
    primaryColor: "#7c3aed", secondaryColor: "#d4af37",
    config: {
      appearanceMode: "dark",
      // A identidade de layout do modelo (zebra, largura, espaçamento) — ver `campoZebrado` & cia.
      zebrado: true,  larguraLivre: true,  larguraDasPecas: 90,  espacamento: { interno: 16, externo: 24 }, globalFont: "Playfair Display",
      layout: tplLayout(280, 3020), mobileLayout: { ...DEFAULT_MOBILE_LAYOUT },
      blockStyles: { title: tplBlock("rgba(124,58,237,0.08)") },
      highlightStyles: [
        { backgroundColor: "rgba(212,175,55,0.08)", color: "" },
        { backgroundColor: "rgba(212,175,55,0.08)", color: "" },
        { backgroundColor: "rgba(212,175,55,0.08)", color: "" },
      ],
      widgets: [
        wSearch(full(1470, 300)),
        wRegions(slot(0, 3, 1830, 390)), wTesti(slot(1, 3, 1830, 390)), wFinance(slot(2, 3, 1830, 390)),
        wTeam(full(2280, 380)),
        wCta(full(2720, 240)),
      ],
    },
  },
  {
    id: "minimal", name: "Minimalista", desc: "Poucas linhas, com trio funcional em 1/3",
    primaryColor: "#334155", secondaryColor: "#64748b",
    config: {
      appearanceMode: "light",
      // A identidade de layout do modelo (zebra, largura, espaçamento) — ver `campoZebrado` & cia.
      zebrado: false, larguraLivre: false, larguraDasPecas: 100, espacamento: { interno: 0,  externo: 32 }, globalFont: "Montserrat",
      layout: tplLayout(300, 2940), mobileLayout: { ...DEFAULT_MOBILE_LAYOUT },
      blockStyles: {}, highlightStyles: EMPTY_HL,
      widgets: [
        wSearch(full(1470, 300)),
        wSteps(full(1830, 300)),
        wRegions(slot(0, 3, 2190, 390)), wFaq(slot(1, 3, 2190, 390)), wFinance(slot(2, 3, 2190, 390)),
        wCta(full(2640, 240)),
      ],
    },
  },
  {
    id: "natureza", name: "Natureza", desc: "Região 1/2 e serviços organizados em 1/3",
    primaryColor: "#16a34a", secondaryColor: "#ca8a04",
    config: {
      appearanceMode: "dark",
      // A identidade de layout do modelo (zebra, largura, espaçamento) — ver `campoZebrado` & cia.
      zebrado: true,  larguraLivre: false, larguraDasPecas: 100, espacamento: { interno: 8,  externo: 12 }, globalFont: "Merriweather",
      layout: tplLayout(260, 2960), mobileLayout: { ...DEFAULT_MOBILE_LAYOUT },
      blockStyles: { highlights: tplBlock("rgba(22,163,74,0.08)") }, highlightStyles: EMPTY_HL,
      widgets: [
        wRegions(slot(0, 2, 1470, 320)), wMap(slot(1, 2, 1470, 320)),
        wHours(slot(0, 3, 1850, 390)), wTesti(slot(1, 3, 1850, 390)), wFinance(slot(2, 3, 1850, 390)),
        wSteps(full(2300, 300)),
        wCta(full(2660, 240)),
      ],
    },
  },
  {
    id: "vibrante", name: "Vibrante", desc: "Faixa compacta em 1/4 para mostrar densidade",
    primaryColor: "#0d9488", secondaryColor: "#06b6d4",
    config: {
      appearanceMode: "dark",
      // A identidade de layout do modelo (zebra, largura, espaçamento) — ver `campoZebrado` & cia.
      zebrado: true,  larguraLivre: true,  larguraDasPecas: 100, espacamento: { interno: 8,  externo: 8 }, globalFont: "Raleway",
      layout: tplLayout(280, 2930), mobileLayout: { ...DEFAULT_MOBILE_LAYOUT },
      blockStyles: {},
      highlightStyles: [
        { backgroundColor: "rgba(13,148,136,0.14)", color: "" },
        { backgroundColor: "rgba(6,182,212,0.14)", color: "" },
        { backgroundColor: "rgba(13,148,136,0.14)", color: "" },
      ],
      widgets: [
        wStats(full(1470, 260)),
        wSearch(full(1790, 300)),
        wFaq(slot(0, 4, 2150, 420)), wHours(slot(1, 4, 2150, 420)), wTesti(slot(2, 4, 2150, 420)), wFinance(slot(3, 4, 2150, 420)),
        wCta(full(2630, 240)),
      ],
    },
  },
  {
    id: "conversao", name: "Conversão", desc: "Busca forte, 1/2 de contexto e 1/3 de prova",
    primaryColor: "#4f46e5", secondaryColor: "#22c55e",
    config: {
      appearanceMode: "light",
      // A identidade de layout do modelo (zebra, largura, espaçamento) — ver `campoZebrado` & cia.
      zebrado: false, larguraLivre: false, larguraDasPecas: 100, espacamento: { interno: 12, externo: 20 }, globalFont: "Inter",
      layout: tplLayout(270, 3010), mobileLayout: { ...DEFAULT_MOBILE_LAYOUT },
      blockStyles: { title: tplBlock("rgba(79,70,229,0.06)") }, highlightStyles: EMPTY_HL,
      widgets: [
        wSearch(full(1470, 300)),
        wRegions(slot(0, 2, 1830, 340)), wSteps(slot(1, 2, 1830, 340)),
        wTeam(slot(0, 3, 2230, 420)), wFaq(slot(1, 3, 2230, 420)), wFinance(slot(2, 3, 2230, 420)),
        wCta(full(2710, 240)),
      ],
    },
  },
  {
    id: "completa", name: "Completa", desc: "Mostra a biblioteca inteira e uma linha 1/4",
    primaryColor: "#1d4ed8", secondaryColor: "#f59e0b",
    config: {
      appearanceMode: "dark",
      // A identidade de layout do modelo (zebra, largura, espaçamento) — ver `campoZebrado` & cia.
      zebrado: true,  larguraLivre: false, larguraDasPecas: 100, espacamento: { interno: 4,  externo: 8 }, globalFont: "Montserrat",
      layout: tplLayout(280, 3770), mobileLayout: { ...DEFAULT_MOBILE_LAYOUT },
      blockStyles: {}, highlightStyles: EMPTY_HL,
      widgets: [
        wStats(full(1470, 260)),
        wSearch(full(1790, 300)),
        wRegions(slot(0, 2, 2150, 340)), wMap(slot(1, 2, 2150, 340)),
        wTeam(full(2550, 380)),
        wFaq(slot(0, 4, 2990, 420)), wSteps(slot(1, 4, 2990, 420)), wHours(slot(2, 4, 2990, 420)), wTesti(slot(3, 4, 2990, 420)),
        wCta(full(3470, 240)),
      ],
    },
  },
  {
    id: "compacta", name: "Compacta", desc: "Pouco scroll: 1/1 + 1/3 + CTA",
    primaryColor: "#be123c", secondaryColor: "#f97316",
    config: {
      appearanceMode: "light",
      // A identidade de layout do modelo (zebra, largura, espaçamento) — ver `campoZebrado` & cia.
      zebrado: false, larguraLivre: false, larguraDasPecas: 100, espacamento: { interno: 0,  externo: 4 }, globalFont: "Raleway",
      layout: tplLayout(260, 2610), mobileLayout: { ...DEFAULT_MOBILE_LAYOUT },
      blockStyles: {}, highlightStyles: EMPTY_HL,
      widgets: [
        wSearch(full(1470, 300)),
        wRegions(slot(0, 3, 1830, 420)), wFaq(slot(1, 3, 1830, 420)), wFinance(slot(2, 3, 1830, 420)),
        wCta(full(2310, 240)),
      ],
    },
  },
];


/* A miniatura de um modelo. Delegada a `PreviaDoModelo`, que desenha a página
   a partir do config (e alterna desktop/celular com o mouse em cima) — é a
   mesma prévia do assistente de boas-vindas e da gaveta do editor novo. */
export function TemplateThumb({ tpl }) {
  return <PreviaDoModelo tpl={tpl} altura={120} />;
}
