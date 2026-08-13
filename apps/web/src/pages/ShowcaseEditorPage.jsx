import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { baseDaVitrine } from "../utils/enderecoVitrine";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { api } from "../api";
import { saveSession } from "../session";
import {
  DEFAULT_LAYOUT,
  DEFAULT_MOBILE_LAYOUT,
  blockHasBackgroundImage,
  mergeBlockWrapperStyle,
  normalizeShowcaseConfig,
  sectionSurfaceStyle,
} from "../utils/showcaseConfig";
import { DragDropProvider } from "@dnd-kit/react";
import { lerDoTenant, gravarNoTenant, CHAVES } from "../utils/chaveDoTenant";
import { AlcaDeArrasto } from "../components/builder/AlcaDeArrasto";
import { SENSORES_EDITOR, idDoBloco, lerId, deltaParaLayout } from "../components/builder/dndEditor";
import { BuilderSidePanel } from "../components/builder/BuilderSidePanel";
import { OnboardingOverlay } from "../components/builder/OnboardingOverlay";
import { useConfirm } from "../components/ConfirmModal";
import { SelectCustom } from "../components/SelectCustom";
import { comodidadesAtivas } from "../utils/comodidades";
import { IconeCheck, IconeLink } from "../components/Icones.jsx";

const PRESET_THEMES = {
  CLASSICO:    { primaryColor: "#6366f1", secondaryColor: "#d4af37" },
  PALETA_AZUL: { primaryColor: "#2563eb", secondaryColor: "#f8fafc" },
  ESMERALDA:   { primaryColor: "#10b981", secondaryColor: "#14b8a6" },
  OCEANO:      { primaryColor: "#0ea5e9", secondaryColor: "#38bdf8" },
  LUXO:        { primaryColor: "#7c3aed", secondaryColor: "#d4af37" },
  CORAL:       { primaryColor: "#f97316", secondaryColor: "#0ea5e9" },
  NOITE:       { primaryColor: "#1e3a5f", secondaryColor: "#94a3b8" },
  NATUREZA:    { primaryColor: "#16a34a", secondaryColor: "#ca8a04" },
  ROSE:        { primaryColor: "#e11d48", secondaryColor: "#fda4af" },
  CARVAO:      { primaryColor: "#334155", secondaryColor: "#f59e0b" },
};

// ─── Templates de página ─────────────────────────────────────────────────────
// Cada template é um "makeover" completo: modo (dark/light), fonte, cores,
// posições dos blocos, estilos e o ARRANJO dos widgets. O conteúdo escrito do
// usuário (títulos, destaques, rodapé) é preservado — muda a estrutura e o visual.
const mkW = (id, type, title, content, pos, extra = {}) => ({
  id, type, title, content,
  ctaLabel: extra.ctaLabel || "", ctaUrl: extra.ctaUrl || "",
  backgroundColor: extra.backgroundColor || "", color: extra.color || "",
  x: pos.x ?? 0, y: pos.y, w: pos.w ?? 100, h: pos.h ?? 230, hidden: false,
});
const wStats = (y, h = 240) => mkW("tpl-stats", "stats", "Nossos Números", "200+|Imóveis vendidos|15 anos|De experiência|4.9★|Avaliação média", { y, h });
const wTesti = (pos) => mkW("tpl-testi", "testimonial", "— Maria Silva, Compradora", "\"Encontrei o imóvel dos meus sonhos em menos de uma semana. Atendimento excepcional e sem burocracia!\"", pos);
const wHours = (pos) => mkW("tpl-hours", "hours", "Horário de Atendimento", "Segunda a Sexta: 09h às 18h<br>Sábados: 09h às 13h<br>Domingos e Feriados: Fechado", pos);
const wCta = (y, h = 230) => mkW("tpl-cta", "cta", "Pronto para encontrar seu imóvel?", "Fale com nossa equipe e receba as melhores opções para o seu perfil.", { y, h }, { ctaLabel: "Falar no WhatsApp", ctaUrl: "https://wa.me/" });
const EMPTY_HL = [{ backgroundColor: "", color: "" }, { backgroundColor: "", color: "" }, { backgroundColor: "", color: "" }];
const tplBlock = (bg) => ({ backgroundColor: bg, color: "", backgroundImage: "", backgroundOverlay: 0, backgroundBrightness: 1 });
const tplLayout = (titleH, footerY) => ({
  ...DEFAULT_LAYOUT,
  title: { ...DEFAULT_LAYOUT.title, h: titleH },
  footer: { ...DEFAULT_LAYOUT.footer, y: footerY },
});

const BUILDER_TEMPLATES = [
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
      highlightStyles: [{ backgroundColor: "rgba(212,175,55,0.08)", color: "" }, { backgroundColor: "rgba(212,175,55,0.08)", color: "" }, { backgroundColor: "rgba(212,175,55,0.08)", color: "" }],
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
      highlightStyles: [{ backgroundColor: "rgba(13,148,136,0.14)", color: "" }, { backgroundColor: "rgba(6,182,212,0.14)", color: "" }, { backgroundColor: "rgba(13,148,136,0.14)", color: "" }],
      widgets: [wStats(1470, 260), wTesti({ x: 0, y: 1790, w: 100, h: 240 }), wCta(2110, 240)],
    },
  },
];

// Preview esquemático de um template: mini-página refletindo modo/cores/estrutura.
function TemplateThumb({ tpl }) {
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
      <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "center", margin: "3px 0" }}>{bar("62%", 4, line)}{bar("44%", 3, line, 0.6)}</div>
      <div style={{ display: "flex", gap: 3 }}>{[0, 1, 2].map((i) => <div key={i} style={{ flex: 1, height: 7, borderRadius: 3, background: surface }} />)}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3 }}>{[0, 1, 2].map((i) => <div key={i} style={{ height: 13, borderRadius: 3, background: `linear-gradient(135deg, ${tpl.primaryColor}66, ${surface})` }} />)}</div>
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

const FONT_OPTIONS = [
  { label: "Padrão (Inter)",                value: "Inter" },
  { label: "Playfair Display — Elegante",   value: "Playfair Display" },
  { label: "Montserrat — Moderno",          value: "Montserrat" },
  { label: "Raleway — Sofisticado",         value: "Raleway" },
  { label: "Lato — Limpo",                  value: "Lato" },
  { label: "Merriweather — Clássico",       value: "Merriweather" },
  { label: "Poppins — Contemporâneo",       value: "Poppins" },
];

function isNodeUnderFormatToolbar(node, toolbarEl) {
  if (!toolbarEl || !node) return false;
  let n = node.nodeType === 1 ? node : node.parentElement;
  if (!n || n.nodeType !== 1) return false;
  // A lista do SelectCustom é renderizada num portal no <body>, então não é
  // descendente da toolbar — mas clicar nela ainda é interagir com a toolbar.
  if (typeof n.closest === "function" && n.closest("[data-selectcustom-list]")) return true;
  while (n) {
    if (n === toolbarEl) return true;
    if (typeof toolbarEl.contains === "function" && toolbarEl.contains(n)) return true;
    const root = n.getRootNode && n.getRootNode();
    if (root instanceof ShadowRoot) n = root.host;
    else n = n.parentElement;
  }
  return false;
}

const WIDGET_LIBRARY = [
  {
    type: "text",
    title: "Bloco de Texto",
    content: "Use este bloco para descrever diferenciais, condições especiais ou informações adicionais importantes.",
    preview: <div style={{width: '100%', height: '4px', background: 'var(--text-muted)', borderRadius: '2px', opacity: 0.5, marginBottom: '4px'}} />,
  },
  {
    type: "cta",
    title: "Chamada para Ação (CTA)",
    content: "Fale com nossa equipe e receba as melhores opções para seu perfil.",
    ctaLabel: "Falar no WhatsApp",
    ctaUrl: "https://wa.me/",
    preview: <div style={{width: '60%', height: '12px', background: 'var(--accent)', borderRadius: '4px', marginTop: '4px'}} />,
  },
  {
    type: "note",
    title: "Aviso Importante",
    content: "Documentação e simulação de financiamento sob análise da imobiliária. Valores sujeitos a alteração.",
    preview: <div style={{width: '100%', border: '1px solid rgba(255,255,255,0.2)', height: '12px', borderRadius: '4px', marginTop: '4px'}} />,
  },
  {
    type: "faq",
    title: "Dúvida Frequente (FAQ)",
    content: "Como funciona o processo de locação sem fiador?",
    preview: <div style={{display: 'flex', gap: '4px', alignItems: 'center'}}><div style={{width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)'}}/><div style={{flex: 1, height: '4px', background: 'var(--text-muted)', borderRadius: '2px', opacity: 0.5}} /></div>,
  },
  {
    type: "hours",
    title: "Horário de Atendimento",
    content: "Segunda a Sexta: 09h às 18h<br>Sábados: 09h às 13h<br>Domingos e Feriados: Fechado",
    preview: <div style={{display: 'grid', gap: '2px'}}><div style={{width: '80%', height: '4px', background: 'var(--text-muted)', opacity: 0.5}}/><div style={{width: '60%', height: '4px', background: 'var(--text-muted)', opacity: 0.5}}/></div>,
  },
  {
    type: "testimonial",
    title: "— Maria Silva, Compradora",
    content: "\"Encontrei o imóvel dos meus sonhos em menos de uma semana. Atendimento excepcional e sem burocracia!\"",
    preview: <div style={{display:'flex',gap:'4px',flexDirection:'column'}}><div style={{color:'#f59e0b',fontSize:'10px'}}>★★★★★</div><div style={{width:'100%',height:'4px',background:'var(--text-muted)',opacity:0.5,borderRadius:'2px'}}/></div>,
  },
  {
    type: "stats",
    title: "Nossos Números",
    content: "200+|Imóveis vendidos|15 anos|De experiência|4.9★|Avaliação média",
    preview: <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'4px'}}>{[0,1,2].map(i=><div key={i} style={{height:'20px',background:'rgba(99,102,241,0.2)',borderRadius:'4px'}}/>)}</div>,
  },
  {
    type: "social",
    title: "Siga nas Redes Sociais",
    content: "https://wa.me/|https://instagram.com/|https://facebook.com/",
    preview: <div style={{display:'flex',gap:'4px',marginTop:'4px'}}><div style={{width:'24px',height:'12px',background:'#25D366',borderRadius:'3px'}}/><div style={{width:'24px',height:'12px',background:'#E1306C',borderRadius:'3px'}}/><div style={{width:'24px',height:'12px',background:'#1877F2',borderRadius:'3px'}}/></div>,
  },
  {
    type: "divider",
    title: "✦  Seção  ✦",
    content: "",
    preview: <div style={{display:'flex',alignItems:'center',gap:'6px',marginTop:'4px'}}><div style={{flex:1,height:'1px',background:'var(--text-muted)',opacity:0.4}}/><div style={{width:'6px',height:'6px',borderRadius:'50%',background:'var(--accent)'}}/><div style={{flex:1,height:'1px',background:'var(--text-muted)',opacity:0.4}}/></div>,
  },
  {
    type: "map",
    title: "Nossa Localização",
    content: "Rua das Flores, 123 — Centro — São Paulo, SP",
    preview: <div style={{width:'100%',height:'24px',background:'rgba(99,102,241,0.15)',borderRadius:'4px',marginTop:'4px',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:'8px',height:'8px',background:'var(--accent)',borderRadius:'50%'}}/></div>,
  },
];

const DEFAULT_BLOCK_LABELS = {
  header:     "Cabeçalho",
  title:      "Título",
  highlights: "Highlights",
  properties: "Lista de Imóveis",
  footer:     "Rodapé",
};

const RANDOM_COLOR_PAIRS = [
  ["#6366f1", "#d4af37"], ["#2563eb", "#f8fafc"], ["#10b981", "#14b8a6"],
  ["#0ea5e9", "#38bdf8"], ["#7c3aed", "#d4af37"], ["#f97316", "#0ea5e9"],
  ["#1e3a5f", "#94a3b8"], ["#16a34a", "#ca8a04"], ["#e11d48", "#fda4af"],
  ["#334155", "#f59e0b"], ["#8b5cf6", "#06b6d4"], ["#ec4899", "#f59e0b"],
  ["#0d9488", "#e11d48"], ["#84cc16", "#7c3aed"], ["#dc2626", "#fbbf24"],
  ["#1d4ed8", "#a78bfa"], ["#059669", "#f59e0b"], ["#9333ea", "#22d3ee"],
];

function normalizeHex(value, fallback) {
  if (typeof value !== "string") return fallback;
  const v = value.trim();
  return /^#([0-9a-fA-F]{6})$/.test(v) ? v : fallback;
}

function cascadePushLayout(layoutObj, allBlockKeys) {
  const blocks = {};
  for (const k of allBlockKeys) {
    const src = layoutObj[k] || {};
    blocks[k] = { x: src.x ?? 0, y: src.y ?? 0, w: src.w ?? 100, h: src.h ?? 200 };
  }
  const maxPasses = allBlockKeys.length + 2;
  for (let pass = 0; pass < maxPasses; pass++) {
    const sorted = [...allBlockKeys].sort((a, b) => blocks[a].y - blocks[b].y);
    let changed = false;
    for (let i = 0; i < sorted.length; i++) {
      const a = blocks[sorted[i]];
      for (let j = i + 1; j < sorted.length; j++) {
        const bKey = sorted[j];
        const b = blocks[bKey];
        if (a.x + a.w <= b.x + 0.5 || b.x + b.w <= a.x + 0.5) continue;
        const aBottom = a.y + a.h;
        if (aBottom > b.y + 0.5) { blocks[bKey] = { ...b, y: aBottom }; changed = true; }
      }
    }
    if (!changed) break;
  }
  return Object.fromEntries(allBlockKeys.map(k => [k, { ...layoutObj[k], ...blocks[k] }]));
}

/* ── Física entre TODAS as peças, blocos e widgets juntos ────────────────────
   `cascadePushLayout` só conhece os seis blocos fixos. Widgets viviam num array
   à parte, sem colisão nenhuma — nem contra bloco, nem entre si. Era daí que
   saía o "uma peça dentro da outra": não havia nada impedindo.

   Esta função põe os dois no MESMO espaço. A regra é a mesma de sempre — quem
   está mais acima empurra quem está abaixo, e só quando eles se cruzam na
   horizontal — mas agora vale para o tabuleiro inteiro.

   `ancora` é a peça que a pessoa está segurando: ela não é empurrada por
   ninguém. Sem isso, arrastar um bloco para cima de outro faria o próprio bloco
   arrastado saltar para baixo, fugindo do ponteiro. */
function empurrarTudo({ blocos, chavesDeBloco, widgets, ancora }) {
  const pecas = [];
  for (const k of chavesDeBloco) {
    const b = blocos[k] || {};
    pecas.push({ id: `b:${k}`, chave: k, tipo: "bloco", x: b.x ?? 0, y: b.y ?? 0, w: b.w ?? 100, h: b.h ?? 200 });
  }
  for (const w of widgets) {
    if (w.hidden) continue;
    pecas.push({ id: `w:${w.id}`, chave: w.id, tipo: "widget", x: w.x ?? 0, y: w.y ?? 1080, w: w.w ?? 50, h: w.h ?? 200 });
  }

  /* Peças que terminaram encostadas em alguém — a borda de baixo de uma na
     borda de cima da outra. É o que a interface acende para mostrar que o
     empurrão aconteceu ali, e não num lugar arbitrário. */
  const encostadas = new Set();
  const TOLERANCIA_CONTATO = 1.5;

  /* ── A âncora também é sólida ──────────────────────────────────────────────
     A peça que a pessoa segura não é empurrada — senão ela fugiria do ponteiro.
     Só que o empurrão da cascata age numa direção só, para BAIXO: arrastando
     para CIMA contra outra peça, não havia nada para deslocar, e a âncora
     atravessava. "Forçando um pouco, entram uma na outra" era exatamente isso.

     Aqui ela é expulsa de qualquer sobreposição antes da cascata, indo para o
     lado MAIS PRÓXIMO — desce se estiver quase embaixo, sobe se estiver quase
     em cima. Escolher pela menor distância é o que faz o contato parecer
     encosto e não teleporte: a peça para na borda que ela encontrou. */
  const alvo = pecas.find((p) => p.id === ancora);
  if (alvo) {
    for (let passe = 0; passe < pecas.length + 2; passe++) {
      let corrigiu = false;
      for (const outra of pecas) {
        if (outra.id === alvo.id) continue;
        if (alvo.x + alvo.w <= outra.x + 0.5 || outra.x + outra.w <= alvo.x + 0.5) continue;
        const cruzaY = alvo.y < outra.y + outra.h - 0.5 && outra.y < alvo.y + alvo.h - 0.5;
        if (!cruzaY) continue;
        const paraBaixo = outra.y + outra.h - alvo.y;        // quanto falta para passar por baixo
        const paraCima = alvo.y + alvo.h - outra.y;          // quanto falta para passar por cima
        alvo.y = paraBaixo <= paraCima ? outra.y + outra.h : Math.max(0, outra.y - alvo.h);
        encostadas.add(alvo.id);
        encostadas.add(outra.id);
        corrigiu = true;
      }
      if (!corrigiu) break;
    }
  }

  const maxPasses = pecas.length + 2;
  for (let passe = 0; passe < maxPasses; passe++) {
    const ordenadas = [...pecas].sort((a, b) => a.y - b.y);
    let mudou = false;
    for (let i = 0; i < ordenadas.length; i++) {
      const a = ordenadas[i];
      for (let j = i + 1; j < ordenadas.length; j++) {
        const b = ordenadas[j];
        // Sem cruzamento horizontal não há o que empurrar: são colunas vizinhas.
        if (a.x + a.w <= b.x + 0.5 || b.x + b.w <= a.x + 0.5) continue;
        const baseDeA = a.y + a.h;
        // Quem a pessoa segura não cede lugar — mas ENCOSTAR ela encosta, e o
        // indicador precisa saber disso para acender dos dois lados.
        if (b.id === ancora) {
          if (Math.abs(baseDeA - b.y) <= TOLERANCIA_CONTATO || baseDeA > b.y + 0.5) {
            encostadas.add(a.id); encostadas.add(b.id);
          }
          continue;
        }
        if (baseDeA > b.y + 0.5) {
          b.y = baseDeA;
          mudou = true;
          encostadas.add(a.id);
          encostadas.add(b.id);
        } else if (Math.abs(baseDeA - b.y) <= TOLERANCIA_CONTATO) {
          // Já estavam coladas: contato sem empurrão, e vale acender igual.
          encostadas.add(a.id);
          encostadas.add(b.id);
        }
      }
    }
    if (!mudou) break;
  }

  const novosBlocos = { ...blocos };
  const novosWidgets = widgets.map((w) => ({ ...w }));
  for (const p of pecas) {
    if (p.tipo === "bloco") {
      novosBlocos[p.chave] = { ...(blocos[p.chave] || {}), x: p.x, y: p.y, w: p.w, h: p.h };
    } else {
      const alvo = novosWidgets.find((w) => w.id === p.chave);
      if (alvo) { alvo.x = p.x; alvo.y = p.y; alvo.w = p.w; alvo.h = p.h; }
    }
  }
  return { blocos: novosBlocos, widgets: novosWidgets, encostadas };
}

/* ── Assentar o layout na abertura ───────────────────────────────────────────
   A física só rodava DURANTE um gesto. Layout que já chegava sobreposto —
   povoamento do seed, configuração salva por uma versão antiga do editor,
   qualquer coisa gravada antes de existir colisão — abria sobreposto e
   continuava assim até alguém arrastar cada peça na mão.

   Aqui ele é assentado uma vez, na carga: as peças descem até parar de se
   cruzar, na mesma regra do arrasto. Sem âncora, porque não há peça sendo
   segurada — o que estiver mais acima manda, que é a leitura natural de quem
   olha a página de cima para baixo.

   Assenta os DOIS layouts. O mobile tem posições próprias e sofre do mesmo mal;
   deixá-lo de fora significaria consertar o desktop e a pessoa descobrir a
   bagunça ao trocar para o celular. */
function assentarLayout(cfg) {
  const arrumar = (chaveLayout, widgets) => {
    const blocos = cfg[chaveLayout] || {};
    const chaves = Object.keys(blocos).filter((k) => !(cfg.hiddenBlocks || []).includes(k));
    if (!chaves.length) return { blocos, widgets };
    return empurrarTudo({ blocos, chavesDeBloco: chaves, widgets, ancora: null });
  };

  /* Os widgets são um array só, compartilhado pelos dois layouts. O desktop
     manda na posição final deles: é onde a vitrine é montada, e resolver duas
     vezes deixaria o resultado dependendo da ordem em que rodou. */
  const desktop = arrumar("layout", cfg.widgets || []);
  const mobile = arrumar("mobileLayout", desktop.widgets);

  return {
    ...cfg,
    layout: desktop.blocos,
    mobileLayout: mobile.blocos,
    widgets: desktop.widgets,
  };
}

function coerceLayoutNumber(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function detectTheme(primaryColor, secondaryColor) {
  const primary = normalizeHex(primaryColor, PRESET_THEMES.CLASSICO.primaryColor).toLowerCase();
  const secondary = normalizeHex(secondaryColor, PRESET_THEMES.CLASSICO.secondaryColor).toLowerCase();
  for (const [key, value] of Object.entries(PRESET_THEMES)) {
    if (value.primaryColor.toLowerCase() === primary && value.secondaryColor.toLowerCase() === secondary) {
      return key;
    }
  }
  return "PERSONALIZADO";
}

export function ShowcaseEditorPage({ session, onLogout, onSessionUpdate }) {
  const { confirm, modal: confirmModal } = useConfirm();
  const tenantSlug = session?.tenant?.slug || "";
  /* Identidade da imobiliária para o armazenamento local. O slug muda de dono
     ao longo do tempo; o id, não. Ver `utils/chaveDoTenant.js`. */
  const tenantId = session?.tenant?.id || "";
  const initializedRef = useRef(false);

  // Carrega Google Fonts ao montar
  useEffect(() => {
    const families = FONT_OPTIONS.map(f => f.value.replace(/ /g, "+")).join("&family=");
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${families}&display=swap`;
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch {} };
  }, []);

  const saveTimerRef = useRef(null);
  const canvasRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const actionRef = useRef(null);
  const dragStateRef = useRef(null);
  /* O conjunto de contatos é calculado DENTRO do updater do estado, que precisa
     ser puro. Ele fica numa ref e só vira estado no fim do quadro — escrever
     estado de dentro de um updater é o caminho curto para render em laço. */
  const contatosRef = useRef(null);
  const formRef = useRef(null);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const undoFnRef = useRef(null);
  const redoFnRef = useRef(null);
  const canvasZoomRef = useRef(1.0);
  const multiSelectionRef = useRef(new Set());
  // Modos de preview que ainda precisam de reflow (preenchido ao resetar).
  const reflowPendingRef = useRef(new Set());

  const [activeBlock, setActiveBlock] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [snapCenterActive, setSnapCenterActive] = useState(false);
  const [snapTopActive, setSnapTopActive] = useState(false);
  const [widgetMenuOpen, setWidgetMenuOpen] = useState(false);
  const [textSelection, setTextSelection] = useState(null);
  const [activeRange, setActiveRange] = useState(null);
  const activeRangeRef = useRef(null);
  const formatToolbarRef = useRef(null);
  const isFormattingRef = useRef(false);
  const [previewMode, setPreviewMode] = useState("desktop");
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem("domus-builder-onboarded"));
  // Feature: Canvas Zoom
  const [canvasZoom, setCanvasZoom] = useState(1.0);
  // Feature: Multi-selection
  const [multiSelection, setMultiSelection] = useState(new Set());
  // Feature: Templates
  const [showTemplates, setShowTemplates] = useState(false);
  // Feature: Copiar/colar estilo de bloco
  const [copiedBlockStyle, setCopiedBlockStyle] = useState(null);
  // Feature: Prévia compartilhável
  const [linkCopied, setLinkCopied] = useState(false);
  // Feature: Histórico visual
  const [historySnapshots, setHistorySnapshots] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  // Snap magnético aprimorado
  const [snapLines, setSnapLines] = useState({ x: null, y: null });
  // Widget drag-to-canvas
  const [isDraggingWidget, setIsDraggingWidget] = useState(false);
  const [newWidgetId, setNewWidgetId] = useState(null);
  /* Peças cujas bordas estão se tocando AGORA. Vira uma classe no bloco, que
     acende a borda pontilhada no ponto do encontro — ver `.is-encostado`. */
  const [encostados, setEncostados] = useState([]);

  // Ao trocar de preview (desktop/mobile), reempilha aquele modo se ainda estiver
  // pendente de um reset — assim o mobile também fica sem sobreposição.
  // O canvas remonta e roda a animação de entrada (builderModeIn, 0.35s) que aplica
  // transform: scale(); medir durante ela distorce as alturas, então esperamos terminar.
  useEffect(() => {
    if (!reflowPendingRef.current.has(previewMode)) return;
    const t = setTimeout(() => reflowToContentHeights(), 420);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewMode]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const [form, setForm] = useState({
    whatsapp: "",
    email: "",
    description: "",
    slogan: "",
    logoUrl: "",
    primaryColor: "#6366f1",
    secondaryColor: "#d4af37",
    showcaseHeadline: "",
    showcaseSubheadline: "",
    showcaseConfig: normalizeShowcaseConfig(null),
  });
  const [previewProperties, setPreviewProperties] = useState([]);
  const [carouselIndexes, setCarouselIndexes] = useState({});
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => { formRef.current = form; }, [form]);
  useEffect(() => { canvasZoomRef.current = canvasZoom; }, [canvasZoom]);
  useEffect(() => { multiSelectionRef.current = multiSelection; }, [multiSelection]);

  function pushHistory() {
    const snapshot = JSON.stringify(formRef.current);
    undoStackRef.current.push(snapshot);
    if (undoStackRef.current.length > 50) undoStackRef.current.shift();
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }

  function undo() {
    if (undoStackRef.current.length === 0) return;
    redoStackRef.current.unshift(JSON.stringify(formRef.current));
    if (redoStackRef.current.length > 50) redoStackRef.current.pop();
    const prev = undoStackRef.current.pop();
    setForm(JSON.parse(prev));
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(true);
  }

  function redo() {
    if (redoStackRef.current.length === 0) return;
    undoStackRef.current.push(JSON.stringify(formRef.current));
    if (undoStackRef.current.length > 50) undoStackRef.current.shift();
    const next = redoStackRef.current.shift();
    setForm(JSON.parse(next));
    setCanUndo(true);
    setCanRedo(redoStackRef.current.length > 0);
  }

  undoFnRef.current = undo;
  redoFnRef.current = redo;

  useEffect(() => {
    function handleKeyDown(e) {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl) return;
      if (e.key === "z" && !e.shiftKey) { e.preventDefault(); undoFnRef.current?.(); }
      if (e.key === "y" || (e.key === "z" && e.shiftKey)) { e.preventDefault(); redoFnRef.current?.(); }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Canvas wheel zoom (desktop only, passive:false to allow preventDefault)
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;
    const handler = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setCanvasZoom((prev) => Math.min(1.6, Math.max(0.4, prev - e.deltaY * 0.001)));
      }
    };
    container.addEventListener("wheel", handler, { passive: false });
    return () => container.removeEventListener("wheel", handler);
  });

  /* Carregar snapshots do histórico ao montar.

     Chaveado pelo ID da imobiliária, e nunca pelo slug. Este era o pior dos
     quatro casos do mesmo defeito: com slug, a empresa que assinasse um
     endereço liberado por outra abria o editor e encontrava os LAYOUTS SALVOS
     da anterior — com botão de restaurar. Configuração de uma imobiliária
     dentro da tela de outra. Ver `utils/chaveDoTenant.js`. */
  useEffect(() => {
    const raw = lerDoTenant(CHAVES.historicoEditor, tenantId);
    if (!raw) return;
    try {
      setHistorySnapshots(JSON.parse(raw));
    } catch {
      /* JSON corrompido: começa vazio em vez de derrubar o editor */
    }
  }, [tenantId]);

  useEffect(() => {
    async function loadEditorData() {
      if (!tenantSlug) return;
      setLoadingInitial(true);
      setError("");
      try {
        const [data, showcase] = await Promise.all([api.getTenantProfile(tenantSlug), api.getPublicShowcase(tenantSlug)]);
        setForm({
          whatsapp: data.whatsapp || "",
          email: data.email || "",
          description: data.description || "",
          slogan: data.slogan || "",
          logoUrl: data.logoUrl || "",
          primaryColor: data.primaryColor || "#6366f1",
          secondaryColor: data.secondaryColor || "#d4af37",
          showcaseHeadline: data.showcaseHeadline || "",
          showcaseSubheadline: data.showcaseSubheadline || "",
          showcaseConfig: assentarLayout(normalizeShowcaseConfig(data.showcaseConfig)),
        });
        setPreviewProperties(showcase.properties || []);
        const indexes = {};
        (showcase.properties || []).forEach((property) => { indexes[property.id] = 0; });
        setCarouselIndexes(indexes);
        initializedRef.current = true;
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingInitial(false);
      }
    }
    loadEditorData();
  }, [tenantSlug]);

  function syncRichHtmlFromEditable(editable) {
    const key = editable.getAttribute("data-rich-sync");
    if (!key) return;
    const html = editable.innerHTML;
    if (key === "footerTitle") {
      updateShowcaseConfig((prev) => ({ ...prev, footerTitle: html }));
      return;
    }
    const parts = key.split("|");
    const kind = parts[0];
    if (kind === "form") { updateField(parts[1], html); return; }
    if (kind === "topHeader") {
      const field = parts[1];
      updateShowcaseConfig((prev) => ({ ...prev, topHeader: { ...prev.topHeader, [field]: html } }));
      return;
    }
    if (kind === "highlight") {
      updateHighlight(parseInt(parts[1], 10), parts[2], html);
      return;
    }
    if (kind === "widget") {
      updateWidgetById(parts[1], parts[2], html);
      return;
    }
  }

  useEffect(() => {
    const dismissFormatToolbar = (e) => {
      const toolbarEl = formatToolbarRef.current;
      const path = typeof e.composedPath === "function" ? e.composedPath() : [e.target];
      const inside = path.some((node) => isNodeUnderFormatToolbar(node, toolbarEl));
      if (inside) return;
      if (activeRangeRef.current) {
        const node = activeRangeRef.current.commonAncestorContainer;
        const editable =
          node.nodeType === 3 ? node.parentElement?.closest(".editable-inline") : node.closest(".editable-inline");
        if (editable) syncRichHtmlFromEditable(editable);
      }
      setTextSelection(null);
      setActiveRange(null);
      activeRangeRef.current = null;
      isFormattingRef.current = false;
    };
    document.addEventListener("pointerdown", dismissFormatToolbar, true);
    return () => document.removeEventListener("pointerdown", dismissFormatToolbar, true);
  }, []);

  useEffect(() => {
    const handleSelection = () => {
      const sel = window.getSelection();
      if (!sel.isCollapsed && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const node = range.commonAncestorContainer;
        const parent = node.nodeType === 3 ? node.parentElement : node;
        if (parent && parent.closest(".editable-inline")) {
          const rect = range.getBoundingClientRect();
          const cloned = range.cloneRange();
          setTextSelection({ x: rect.left + rect.width / 2, y: rect.top - 8 });
          setActiveRange(cloned);
          activeRangeRef.current = cloned;
        }
      }
    };
    document.addEventListener("selectionchange", handleSelection);
    return () => document.removeEventListener("selectionchange", handleSelection);
  }, []);

  const applyFormat = (command, value) => {
    const range = activeRangeRef.current;
    if (!range) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    try {
      document.execCommand("styleWithCSS", false, true);
      document.execCommand(command, false, value);
    } catch {}
    if (sel.rangeCount > 0) activeRangeRef.current = sel.getRangeAt(0).cloneRange();
    isFormattingRef.current = false;
  };

  function applyPreset(themeKey) {
    const preset = PRESET_THEMES[themeKey];
    if (!preset) return;
    pushHistory();
    setForm((prev) => ({ ...prev, primaryColor: preset.primaryColor, secondaryColor: preset.secondaryColor }));
  }

  function setAppearanceMode(mode) {
    const getBrightness = (c) => {
      if (!c) return 255;
      let hex = c.replace('#', '').trim();
      if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
      if (hex.length !== 6) return 255;
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      return (0.299 * r + 0.587 * g + 0.114 * b);
    };
    pushHistory();
    updateShowcaseConfig((prev) => {
      const flipColor = (color) => {
        const c = color || (prev.appearanceMode === 'light' ? '#1e293b' : '#f8fafc');
        const brightness = getBrightness(c);
        if (mode === "dark" && brightness < 128) return "#f8fafc";
        if (mode === "light" && brightness >= 128) return "#1e293b";
        return color;
      };
      const newBlockStyles = { ...prev.blockStyles };
      Object.keys(newBlockStyles).forEach(k => {
        if (newBlockStyles[k].color) newBlockStyles[k].color = flipColor(newBlockStyles[k].color);
      });
      return {
        ...prev,
        appearanceMode: mode,
        blockStyles: newBlockStyles,
        highlightStyles: prev.highlightStyles.map(hs => ({ ...hs, color: hs.color ? flipColor(hs.color) : hs.color })),
        widgets: prev.widgets.map(w => ({ ...w, color: w.color ? flipColor(w.color) : w.color })),
      };
    });
  }

  function resetLayoutOnly() {
    const layoutKey = previewMode === "mobile" ? "mobileLayout" : "layout";
    updateShowcaseConfig((prev) => ({
      ...prev,
      [layoutKey]: Object.fromEntries(Object.entries(DEFAULT_LAYOUT).map(([k, v]) => [k, { ...v }])),
    }));
    reflowPendingRef.current = new Set([previewMode]);
    scheduleReflow();
  }

  async function resetAllBuilder() {
    if (await confirm("Tem certeza que deseja resetar todo o layout e textos para o padrão?", "Resetar tudo")) {
      pushHistory();
      setForm((prev) => ({
        ...prev,
        showcaseHeadline: "",
        showcaseSubheadline: "",
        showcaseConfig: normalizeShowcaseConfig(null),
      }));
      // Ambos os modos precisam ser reempilhados; o ativo agora, o outro ao ser exibido.
      reflowPendingRef.current = new Set(["desktop", "mobile"]);
      scheduleReflow();
    }
  }

  // Aguarda o DOM repintar com o conteúdo resetado antes de medir/reposicionar.
  function scheduleReflow() {
    requestAnimationFrame(() => requestAnimationFrame(() => reflowToContentHeights()));
  }

  // Mede a altura REAL renderizada de cada bloco/widget no canvas e reempilha tudo
  // sem sobreposição. Necessário porque o bloco de imóveis cresce conforme a
  // quantidade de anúncios, enquanto o layout guarda apenas uma altura fixa.
  function reflowToContentHeights() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const GAP = 56; // respiro vertical entre seções empilhadas
    const layoutKey = previewMode === "mobile" ? "mobileLayout" : "layout";

    const measured = {};
    canvas.querySelectorAll("[data-reflow-key]").forEach((el) => {
      const key = el.getAttribute("data-reflow-key");
      if (key) measured[key] = Math.ceil(el.getBoundingClientRect().height);
    });
    if (Object.keys(measured).length === 0) return;
    reflowPendingRef.current.delete(previewMode);

    updateShowcaseConfig((prev) => {
      const baseLayout = prev[layoutKey] || {};
      const widgets = prev.widgets || [];
      const map = {};
      const keys = [];

      // Blocos fixos (header/title/highlights/properties/footer)
      for (const k of Object.keys(DEFAULT_BLOCK_LABELS)) {
        if (prev.hiddenBlocks?.includes(k)) continue;
        if (measured[k] == null) continue;
        const src = baseLayout[k] || DEFAULT_LAYOUT[k] || { x: 0, y: 0, w: 100, h: 200 };
        // Infla a altura com o GAP só para o cálculo de empilhamento.
        map[k] = { x: src.x ?? 0, y: src.y ?? 0, w: src.w ?? 100, h: measured[k] + GAP };
        keys.push(k);
      }
      // Widgets
      widgets.forEach((w) => {
        if (w.hidden) return;
        const wk = `widget-${w.id}`;
        if (measured[wk] == null) return;
        map[wk] = { x: w.x ?? 0, y: w.y ?? 0, w: w.w ?? 50, h: measured[wk] + GAP };
        keys.push(wk);
      });
      if (keys.length === 0) return prev;

      const placed = cascadePushLayout(map, keys);

      const newLayout = { ...baseLayout };
      for (const k of Object.keys(DEFAULT_BLOCK_LABELS)) {
        if (!placed[k]) continue;
        // Guarda a posição empilhada, mas a altura REAL (sem o GAP inflado).
        newLayout[k] = { ...newLayout[k], x: placed[k].x, y: placed[k].y, w: placed[k].w, h: measured[k] };
      }
      const newWidgets = widgets.map((w) => {
        const wk = `widget-${w.id}`;
        if (!placed[wk]) return w;
        return { ...w, x: placed[wk].x, y: placed[wk].y, h: measured[wk] };
      });

      return { ...prev, [layoutKey]: newLayout, widgets: newWidgets };
    });
  }

  function isBlockVisible(blockKey) {
    return !showcaseConfig.hiddenBlocks.includes(blockKey);
  }

  function hideBlock(blockKey) {
    pushHistory();
    updateShowcaseConfig((prev) => ({
      ...prev,
      hiddenBlocks: Array.from(new Set([...prev.hiddenBlocks, blockKey])),
    }));
    setActiveBlock(null);
  }

  function restoreBlock(blockKey) {
    pushHistory();
    updateShowcaseConfig((prev) => ({
      ...prev,
      hiddenBlocks: prev.hiddenBlocks.filter((k) => k !== blockKey),
    }));
    setWidgetMenuOpen(false);
  }

  function updateBlockStyle(blockKey, field, value) {
    updateShowcaseConfig((prev) => ({
      ...prev,
      blockStyles: { ...prev.blockStyles, [blockKey]: { ...prev.blockStyles[blockKey], [field]: value } },
    }));
  }

  function clearBlockStyle(blockKey) {
    pushHistory();
    updateShowcaseConfig((prev) => ({
      ...prev,
      blockStyles: {
        ...prev.blockStyles,
        [blockKey]: { backgroundColor: "", color: "", backgroundImage: "", backgroundOverlay: 0, backgroundBrightness: 1 },
      },
    }));
  }

  function updateHighlightStyle(index, field, value) {
    updateShowcaseConfig((prev) => ({
      ...prev,
      highlightStyles: prev.highlightStyles.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    }));
  }

  function clearHighlightStyle(index) {
    updateShowcaseConfig((prev) => ({
      ...prev,
      highlightStyles: prev.highlightStyles.map((row, i) => (i === index ? { backgroundColor: "", color: "" } : row)),
    }));
  }

  function addHighlight() {
    pushHistory();
    updateShowcaseConfig((prev) => ({
      ...prev,
      highlights: [...prev.highlights, { title: "Novo destaque", description: "Descreva o beneficio aqui." }],
      highlightStyles: [...prev.highlightStyles, { backgroundColor: "", color: "" }],
    }));
  }

  function addWidget(template) {
    pushHistory();
    const currentWidgets = normalizeShowcaseConfig(formRef.current?.showcaseConfig).widgets;
    const maxY = currentWidgets.length > 0
      ? Math.max(...currentWidgets.map(w => (w.y ?? 0) + (w.h ?? 200)))
      : 1080;
    updateShowcaseConfig((prev) => ({
      ...prev,
      widgets: [
        ...prev.widgets,
        {
          id: `widget-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: template.type,
          title: template.title,
          content: template.content,
          ctaLabel: template.ctaLabel || "",
          ctaUrl: template.ctaUrl || "",
          backgroundColor: "", color: "",
          x: 0, y: maxY + 20, w: 50, h: 200, hidden: false,
        },
      ],
    }));
    setWidgetMenuOpen(false);
  }

  function updateWidgetById(id, field, value) {
    updateShowcaseConfig((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) => w.id === id ? { ...w, [field]: value } : w),
    }));
  }

  function removeWidgetById(id) {
    pushHistory();
    updateShowcaseConfig((prev) => ({
      ...prev,
      widgets: prev.widgets.filter((w) => w.id !== id),
    }));
    setActiveBlock((prev) => prev === `widget-${id}` ? null : prev);
  }

  function startWidgetAction(widgetId, mode, event) {
    if (!canvasRef.current) return;
    // Feature 2: widget travado — não permite arrastar/redimensionar
    const currentWidget = normalizeShowcaseConfig(formRef.current?.showcaseConfig).widgets.find(w => w.id === widgetId);
    if (currentWidget?.locked) return;
    event.preventDefault();
    event.stopPropagation();
    pushHistory();
    const widget = currentWidget;
    if (!widget) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const startBlock = { x: widget.x ?? 0, y: widget.y ?? 1080, w: widget.w ?? 50, h: widget.h ?? 200 };
    const startX = event.clientX;
    const startY = event.clientY;
    const zoom = previewMode === "mobile" ? 1 : canvasZoomRef.current;

    const onMove = (e) => {
      const dxPct = ((e.clientX - startX) / Math.max(rect.width, 1)) * 100;
      const dyPx = (e.clientY - startY) / zoom;
      if (mode === "resize") {
        const nextW = Math.min(Math.max(startBlock.w + dxPct, 10), 100 - startBlock.x);
        const nextH = Math.max(80, startBlock.h + dyPx);
        updateShowcaseConfig((prev) => ({
          ...prev,
          widgets: prev.widgets.map((w) => w.id === widgetId ? { ...w, w: nextW, h: nextH } : w),
        }));
      } else {
        let nextX = Math.min(Math.max(startBlock.x + dxPct, 0), 100 - startBlock.w);
        const nextY = Math.max(0, startBlock.y + dyPx);
        const snapThreshPct = (10 / Math.max(rect.width, 1)) * 100;
        let snapLineX = null;
        for (const cx of [0, 25, 50 - startBlock.w / 2, 75, 100 - startBlock.w]) {
          if (Math.abs(nextX - cx) <= snapThreshPct) { nextX = clamp(cx, 0, 100 - startBlock.w); snapLineX = cx; break; }
        }
        setSnapLines({ x: snapLineX, y: null });
        updateShowcaseConfig((prev) => {
          const movidos = prev.widgets.map((w) => w.id === widgetId ? { ...w, x: nextX, y: nextY } : w);
          /* Mesma física dos blocos: o widget arrastado é a âncora e empurra
             quem estiver embaixo — inclusive os blocos fixos. */
          const chaves = Object.keys(prev[layoutKeyAtual()] || {});
          const fisica = empurrarTudo({
            blocos: prev[layoutKeyAtual()] || {},
            chavesDeBloco: chaves,
            widgets: movidos,
            ancora: `w:${widgetId}`,
          });
          contatosRef.current = fisica.encostadas;
          return { ...prev, [layoutKeyAtual()]: fisica.blocos, widgets: fisica.widgets };
        });
      }
    };

    const onUp = () => {
      setSnapLines({ x: null, y: null });
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function randomizeColors() {
    pushHistory();
    const current = (formRef.current?.primaryColor || "").toLowerCase();
    let pair;
    let attempts = 0;
    do {
      pair = RANDOM_COLOR_PAIRS[Math.floor(Math.random() * RANDOM_COLOR_PAIRS.length)];
      attempts++;
    } while (pair[0].toLowerCase() === current && attempts < 10);
    setForm((prev) => ({ ...prev, primaryColor: pair[0], secondaryColor: pair[1] }));
  }

  function removeHighlight(index) {
    pushHistory();
    updateShowcaseConfig((prev) => {
      if (prev.highlights.length <= 1) return prev;
      return {
        ...prev,
        highlights: prev.highlights.filter((_, i) => i !== index),
        highlightStyles: prev.highlightStyles.filter((_, i) => i !== index),
      };
    });
  }

  function nextImage(propertyId, total) {
    setCarouselIndexes((prev) => ({ ...prev, [propertyId]: ((prev[propertyId] || 0) + 1) % total }));
  }

  function prevImage(propertyId, total) {
    setCarouselIndexes((prev) => ({ ...prev, [propertyId]: ((prev[propertyId] || 0) - 1 + total) % total }));
  }

  const previewTenant = useMemo(
    () => ({ name: session?.tenant?.name || "Imobiliaria", slug: tenantSlug, ...form }),
    [form, session?.tenant?.name, tenantSlug]
  );
  const showcaseConfig = useMemo(() => normalizeShowcaseConfig(form.showcaseConfig), [form.showcaseConfig]);
  const layout = showcaseConfig.layout;
  const activeLayout = previewMode === "mobile" ? showcaseConfig.mobileLayout : layout;
  const blockStyles = showcaseConfig.blockStyles;

  const globalFont = showcaseConfig.globalFont || "Inter";

  const previewStyle = useMemo(
    () => ({
      "--accent": previewTenant.primaryColor || "#818cf8",
      "--accent-hover": previewTenant.primaryColor || "#6366f1",
      "--tenant-secondary": previewTenant.secondaryColor || "#d4af37",
      "--showcase-font": `'${globalFont}', system-ui, sans-serif`,
    }),
    [previewTenant.primaryColor, previewTenant.secondaryColor, globalFont]
  );

  const previewHeadline = previewTenant.showcaseHeadline || "Encontre o imóvel ideal para seu próximo passo";
  const previewSubheadline = previewTenant.showcaseSubheadline || "Compare opções, visualize fotos detalhadas e converse com a imobiliária em poucos cliques.";
  const currentTheme = useMemo(
    () => detectTheme(previewTenant.primaryColor, previewTenant.secondaryColor),
    [previewTenant.primaryColor, previewTenant.secondaryColor]
  );
  const isLightMode = showcaseConfig.appearanceMode === "light";

  useEffect(() => {
    if (!initializedRef.current || !tenantSlug) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      setError("");
      setSuccess("");
      try {
        const updated = await api.updateTenantProfile(tenantSlug, form);
        const nextSession = { ...session, tenant: { ...session.tenant, ...updated } };
        saveSession(nextSession);
        onSessionUpdate(nextSession);
        setSuccess("Alterações salvas.");
        // Histórico visual: salvar snapshot após sucesso
        const snapLabel = "Auto-salvo";
        const newSnap = { id: Date.now(), label: snapLabel, timestamp: new Date().toLocaleString("pt-BR"), data: JSON.stringify(formRef.current) };
        setHistorySnapshots((prev) => {
          const next = [newSnap, ...prev].slice(0, 10);
          gravarNoTenant(CHAVES.historicoEditor, tenantId, JSON.stringify(next));
          return next;
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setSaving(false);
        setTimeout(() => setSuccess(""), 3000);
      }
    }, 1000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [form, tenantSlug]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateShowcaseConfig(updater) {
    setForm((prev) => ({
      ...prev,
      showcaseConfig: updater(normalizeShowcaseConfig(prev.showcaseConfig)),
    }));
  }

  function updateHighlight(index, key, value) {
    updateShowcaseConfig((prev) => ({
      ...prev,
      highlights: prev.highlights.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    }));
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  // Feature 1: Duplicar widget
  function duplicateWidget(widgetId) {
    pushHistory();
    updateShowcaseConfig((prev) => {
      const w = prev.widgets.find((w) => w.id === widgetId);
      if (!w) return prev;
      const newWidget = {
        ...w,
        id: `widget-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        x: Math.min(w.x + 5, 100 - (w.w ?? 50)),
        y: (w.y ?? 0) + 20,
        locked: false,
      };
      return { ...prev, widgets: [...prev.widgets, newWidget] };
    });
  }

  // Feature 2: Travar blocos e widgets
  function toggleLockBlock(blockKey) {
    updateShowcaseConfig((prev) => {
      const isLocked = (prev.lockedBlocks || []).includes(blockKey);
      return {
        ...prev,
        lockedBlocks: isLocked
          ? (prev.lockedBlocks || []).filter((k) => k !== blockKey)
          : [...(prev.lockedBlocks || []), blockKey],
      };
    });
  }

  function toggleLockWidget(widgetId) {
    updateShowcaseConfig((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) => w.id === widgetId ? { ...w, locked: !w.locked } : w),
    }));
  }

  // Feature 4: Templates — aplica o makeover completo (modo, fonte, cores, layout,
  // estilos e widgets). Preserva o conteúdo escrito (títulos/destaques/rodapé).
  function applyTemplate(template) {
    pushHistory();
    setForm((prev) => {
      const cfg = normalizeShowcaseConfig(prev.showcaseConfig);
      return {
        ...prev,
        primaryColor: template.primaryColor,
        secondaryColor: template.secondaryColor,
        showcaseConfig: normalizeShowcaseConfig({ ...cfg, ...template.config }),
      };
    });
    setShowTemplates(false);
  }

  // Feature 5: Copiar/colar estilo de bloco
  function copyBlockStyle(blockKey) {
    const style = showcaseConfig.blockStyles[blockKey];
    setCopiedBlockStyle({ blockKey, style: { ...style } });
  }

  function pasteBlockStyle(targetBlockKey) {
    if (!copiedBlockStyle) return;
    pushHistory();
    updateShowcaseConfig((prev) => ({
      ...prev,
      blockStyles: { ...prev.blockStyles, [targetBlockKey]: { ...copiedBlockStyle.style } },
    }));
  }

  // Feature 6: Seleção múltipla
  function handleBlockClick(blockKey, e) {
    if (e.shiftKey) {
      setMultiSelection((prev) => {
        const n = new Set(prev);
        n.has(blockKey) ? n.delete(blockKey) : n.add(blockKey);
        return n;
      });
    } else {
      setActiveBlock(blockKey);
      setMultiSelection(new Set([blockKey]));
    }
  }

  // Feature 8: Histórico — salvar snapshot manualmente
  function saveHistorySnapshotNow() {
    const newSnap = { id: Date.now(), label: "Versão manual", timestamp: new Date().toLocaleString("pt-BR"), data: JSON.stringify(formRef.current) };
    setHistorySnapshots((prev) => {
      const next = [newSnap, ...prev].slice(0, 10);
      gravarNoTenant(CHAVES.historicoEditor, tenantId, JSON.stringify(next));
      return next;
    });
  }

  function restoreHistorySnapshot(snapshot) {
    pushHistory();
    try { setForm(JSON.parse(snapshot.data)); } catch {}
    setShowHistory(false);
  }

  /* ── Instantâneo do gesto ─────────────────────────────────────────────────
     Tudo que o arrasto precisa saber e que NÃO muda durante ele: onde o bloco
     estava, onde estão os outros, a largura do canvas e o zoom.

     Isolado do `startBuilderAction` porque agora tem dois donos: o resize, que
     continua nosso e nasce no pointerdown, e o arrasto, que passou a nascer no
     `onDragStart` do dnd-kit. A conta é a mesma nos dois — o que muda é só
     quem avisa que o gesto começou. */
  function prepararGesto(blockKey, mode) {
    if (!canvasRef.current) return null;
    // Feature 2: bloco travado — não permite arrastar/redimensionar
    if ((normalizeShowcaseConfig(formRef.current?.showcaseConfig).lockedBlocks || []).includes(blockKey)) return null;
    const isMobile = previewMode === "mobile";
    const curLayout = isMobile ? showcaseConfig.mobileLayout : layout;
    const layoutKey = isMobile ? "mobileLayout" : "layout";
    const rect = canvasRef.current.getBoundingClientRect();
    const currentBlock = curLayout?.[blockKey] || DEFAULT_LAYOUT?.[blockKey] || {};
    const startBlock = {
      x: currentBlock.x ?? 0,
      y: currentBlock.y ?? 0,
      w: currentBlock.w ?? 100,
      h: currentBlock.h ?? 200,
    };
    const activeKeys = Object.keys(DEFAULT_BLOCK_LABELS).filter(k => k !== blockKey && !showcaseConfig.hiddenBlocks.includes(k));
    const staticBlocks = activeKeys.map(key => {
      const defaults = DEFAULT_LAYOUT[key] || { x: 0, y: 0, w: 100, h: 200 };
      const block = curLayout?.[key] || {};
      return {
        key,
        x: coerceLayoutNumber(block.x, defaults.x),
        y: coerceLayoutNumber(block.y, defaults.y),
        w: coerceLayoutNumber(block.w, defaults.w),
        h: coerceLayoutNumber(block.h, defaults.h),
      };
    });
    return {
      blockKey, mode, startBlock, canvasWidth: rect.width, staticBlocks,
      lastValidX: startBlock.x, lastValidY: startBlock.y,
      lastValidW: startBlock.w, lastValidH: startBlock.h,
      isMobile, layoutKey,
      zoom: isMobile ? 1 : canvasZoomRef.current,
    };
  }

  /* ── O movimento ──────────────────────────────────────────────────────────
     Recebe o deslocamento JÁ convertido para as unidades do layout e aplica
     colisão, encaixe e cascata. Não sabe de onde veio o gesto — do ponteiro
     pelo dnd-kit, do teclado pelo dnd-kit, ou do resize nosso. */
  function aplicarGesto(action, dxPercent, dyPx) {
    if (!action || !canvasRef.current) return;

    const checkCollision = (testRect) => {
      for (const other of action.staticBlocks) {
        if (
          testRect.left < other.x + other.w - 0.1 &&
          testRect.right > other.x + 0.1 &&
          testRect.top < other.y + other.h - 0.1 &&
          testRect.bottom > other.y + 0.1
        ) return true;
      }
      return false;
    };

    if (action.mode === "resize") {
      const nextW = clamp(action.startBlock.w + dxPercent, 20, 100 - action.startBlock.x);
      const nextH = Math.max(120, action.startBlock.h + dyPx);
      let finalW = action.lastValidW;
      let finalH = action.lastValidH;
      const rectTestW = { left: action.startBlock.x, right: action.startBlock.x + nextW, top: action.startBlock.y, bottom: action.startBlock.y + finalH };
      if (!checkCollision(rectTestW)) finalW = nextW;
      const rectTestH = { left: action.startBlock.x, right: action.startBlock.x + finalW, top: action.startBlock.y, bottom: action.startBlock.y + nextH };
      if (!checkCollision(rectTestH)) finalH = nextH;
      action.lastValidW = finalW;
      action.lastValidH = finalH;
      setSnapCenterActive(false);
      setSnapTopActive(false);
      updateShowcaseConfig((prev) => ({
        ...prev,
        [action.layoutKey]: { ...prev[action.layoutKey], [action.blockKey]: { ...prev[action.layoutKey]?.[action.blockKey], w: finalW, h: finalH } },
      }));
      return;
    }

    let nextX = clamp(action.startBlock.x + dxPercent, 0, 100 - action.startBlock.w);
    const center = nextX + action.startBlock.w / 2;
    const thresholdPct = (10 / Math.max(action.canvasWidth, 1)) * 100;
    let snapped = false;
    let snapLineX = null;
    if (Math.abs(center - 50) <= thresholdPct) {
      nextX = clamp(50 - action.startBlock.w / 2, 0, 100 - action.startBlock.w);
      snapped = true; snapLineX = 50;
    } else {
      for (const cx of [0, 25, 75, 100 - action.startBlock.w]) {
        if (Math.abs(nextX - cx) <= thresholdPct * 1.4) { nextX = clamp(cx, 0, 100 - action.startBlock.w); snapLineX = cx; break; }
      }
    }
    let nextY = action.startBlock.y + dyPx;
    let snappedTop = false;
    let snapLineY = null;
    if (nextY <= 15) {
      nextY = 0; snappedTop = true;
    } else {
      for (const other of action.staticBlocks) {
        if (Math.abs(nextY - other.y) <= 14) { nextY = other.y; snapLineY = other.y; break; }
        if (Math.abs(nextY - (other.y + other.h)) <= 14) { nextY = other.y + other.h; snapLineY = other.y + other.h; break; }
      }
    }

    const finalX = nextX;
    const finalY = Math.max(0, nextY);
    action.lastValidX = finalX;
    action.lastValidY = finalY;
    setSnapCenterActive(snapped);
    setSnapTopActive(snappedTop);
    setSnapLines({ x: snapLineX, y: snapLineY });
    updateShowcaseConfig((prev) => {
      const prevLayout = prev[action.layoutKey] || {};
      const allKeys = [...action.staticBlocks.map(b => b.key), action.blockKey];
      const withMoved = { ...prevLayout, [action.blockKey]: { ...prevLayout[action.blockKey], x: finalX, y: finalY } };
      /* Blocos E widgets no mesmo empurrão: sem isso, arrastar um bloco por
         cima de um widget encaixava um dentro do outro, porque widget não
         participava de colisão nenhuma. O bloco arrastado é a âncora. */
      const fisica = empurrarTudo({
        blocos: withMoved,
        chavesDeBloco: allKeys,
        widgets: prev.widgets || [],
        ancora: `b:${action.blockKey}`,
      });
      contatosRef.current = fisica.encostadas;
      return { ...prev, [action.layoutKey]: fisica.blocos, widgets: fisica.widgets };
    });
  }

  /* Qual mapa de layout está em edição. Widgets não têm layout mobile próprio,
     mas a física precisa saber contra QUAIS posições de bloco comparar — e no
     modo mobile elas são outras. */
  function layoutKeyAtual() {
    return previewMode === "mobile" ? "mobileLayout" : "layout";
  }

  /* Leva o resultado da física (quem encostou em quem) para o estado que a
     interface lê. Só escreve quando a lista MUDA: durante um arrasto isto é
     chamado a cada quadro, e escrever o mesmo array toda vez seria um render
     por movimento do mouse sem nada novo na tela. */
  /* Classe do realce de contato, por peça. */
  function classeContato(id) {
    return encostados.includes(id) ? " is-encostado" : "";
  }

  function publicarContatos() {
    const conj = contatosRef.current;
    const lista = conj ? Array.from(conj) : [];
    setEncostados((antes) => {
      if (antes.length === lista.length && antes.every((x, i) => x === lista[i])) return antes;
      return lista;
    });
  }

  /* ── Alinhar o `h` guardado com a altura que a peça REALMENTE ocupa ────────
     O `h` do layout entra no CSS como `min-height`: o conteúdo pode passar
     disso, e passa — medido no editor, um bloco de imóveis declarava 640px e
     desenhava 1051. A física trabalhava sobre a caixa declarada, então duas
     peças "separadas" nos números apareciam encaixadas na tela. Era isso, e não
     o povoamento, que deixava a vitrine conflitada já na abertura.

     Aqui as alturas reais são medidas no DOM e devolvidas ao layout, e só então
     o empurrão vale — porque agora a caixa guardada é a caixa que se vê, que é
     também a borda tracejada onde o contato acende.

     `useLayoutEffect` e não `useEffect`: a correção precisa entrar antes de o
     navegador pintar, senão a pessoa vê o layout torto por um quadro e as peças
     saltando em seguida. */
  const alturasAjustadasRef = useRef(false);
  useLayoutEffect(() => {
    if (!initializedRef.current || alturasAjustadasRef.current) return;
    if (!canvasRef.current) return;

    const medidas = {};
    canvasRef.current.querySelectorAll("[data-reflow-key]").forEach((el) => {
      const chave = el.getAttribute("data-reflow-key");
      const altura = Math.ceil(el.getBoundingClientRect().height / (canvasZoomRef.current || 1));
      if (chave && altura > 0) medidas[chave] = altura;
    });
    if (!Object.keys(medidas).length) return;

    alturasAjustadasRef.current = true;
    updateShowcaseConfig((prev) => {
      const chaveLayout = previewMode === "mobile" ? "mobileLayout" : "layout";
      const blocos = { ...(prev[chaveLayout] || {}) };
      const widgets = (prev.widgets || []).map((w) => ({ ...w }));
      let mudou = false;
      for (const [chave, alturaReal] of Object.entries(medidas)) {
        /* Widgets vêm marcados com "w:<id>" e moram noutro lugar do config.
           Eles precisam da mesma correção — e eram justamente os que sobravam
           desencontrados quando só os blocos eram medidos: a borda tracejada
           ficava num lugar e a caixa da física noutro, então o miolo do widget
           é que parecia empurrar. */
        /* Widgets já vinham marcados como "widget-<id>" (o mesmo `widgetKey`
           que identifica o bloco ativo) — eu tinha acrescentado um segundo
           `data-reflow-key`, e JSX com atributo repetido fica com o último,
           calado. Agora usa o que já existe, e há um só. */
        if (chave.startsWith("widget-")) {
          const alvo = widgets.find((w) => w.id === chave.slice("widget-".length));
          if (alvo && alturaReal > (alvo.h ?? 0) + 2) { alvo.h = alturaReal; mudou = true; }
          continue;
        }
        const atual = blocos[chave];
        if (!atual) continue;
        // Só CRESCE. Encolher aqui brigaria com quem definiu uma altura maior
        // de propósito para deixar respiro no bloco.
        if (alturaReal > (atual.h ?? 0) + 2) {
          blocos[chave] = { ...atual, h: alturaReal };
          mudou = true;
        }
      }
      if (!mudou) return prev;
      const fisica = empurrarTudo({
        blocos,
        chavesDeBloco: Object.keys(blocos).filter((k) => !(prev.hiddenBlocks || []).includes(k)),
        widgets,
        ancora: null,
      });
      return { ...prev, [chaveLayout]: fisica.blocos, widgets: fisica.widgets };
    });
  });

  function limparGuias() {
    setSnapCenterActive(false);
    setSnapTopActive(false);
    setSnapLines({ x: null, y: null });
  }

  /* ── Handlers do dnd-kit ──────────────────────────────────────────────────
     O ciclo start → move → end substitui os `addEventListener` de pointermove
     que existiam aqui. O delta vem de `operation.transform`, em pixels, e
     `deltaParaLayout` faz a única tradução que importa: para % no eixo X e
     para px sem zoom no eixo Y. */
  function aoIniciarArrasto(event) {
    const alvo = lerId(event.operation.source?.id);
    if (!alvo || alvo.tipo !== "bloco") return;
    const action = prepararGesto(alvo.chave, "drag");
    if (!action) return;
    pushHistory();
    actionRef.current = action;
  }

  function aoMoverArrasto(event) {
    const action = actionRef.current;
    if (!action) return;
    const { dxPercent, dyPx } = deltaParaLayout(
      event.operation.transform,
      action.canvasWidth,
      action.zoom,
    );
    aplicarGesto(action, dxPercent, dyPx);
    publicarContatos();
  }

  function aoTerminarArrasto() {
    limparGuias();
    actionRef.current = null;
    // O realce some ao soltar: ele conta o que está acontecendo agora, não o
    // que aconteceu. Deixá-lo aceso viraria decoração permanente.
    contatosRef.current = null;
    setEncostados([]);
  }

  /* Redimensionar continua nosso: o dnd-kit não faz resize, e não finge que
     faz. O gesto nasce no pointerdown da alça do canto, usa o MESMO
     `prepararGesto`/`aplicarGesto` do arrasto, e a única diferença é a fonte do
     delta — aqui os pixels vêm do próprio ponteiro. */
  function startBuilderAction(blockKey, mode, event) {
    const action = prepararGesto(blockKey, mode);
    if (!action) return;
    event.preventDefault();
    pushHistory();
    actionRef.current = action;

    const startX = event.clientX;
    const startY = event.clientY;

    const onMove = (moveEvent) => {
      const atual = actionRef.current;
      if (!atual) return;
      const { dxPercent, dyPx } = deltaParaLayout(
        { x: moveEvent.clientX - startX, y: moveEvent.clientY - startY },
        atual.canvasWidth,
        atual.zoom,
      );
      aplicarGesto(atual, dxPercent, dyPx);
    };

    const onUp = () => {
      limparGuias();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      actionRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function copyDesktopToMobile() {
    pushHistory();
    updateShowcaseConfig((prev) => ({ ...prev, mobileLayout: { ...prev.layout } }));
  }

  function startWidgetDrag(template, event) {
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    setDragState({ template, x: startX, y: startY });
    setIsDraggingWidget(true);

    const onMove = (e) => setDragState({ template, x: e.clientX, y: e.clientY });

    const onUp = (e) => {
      const canvas = canvasRef.current;
      const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
      if (canvas && dist >= 12) {
        const rect = canvas.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom) {
          const xPct = ((e.clientX - rect.left) / rect.width) * 100;
          const yPx = (e.clientY - rect.top) / canvasZoomRef.current;
          const newId = `widget-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          pushHistory();
          updateShowcaseConfig((prev) => {
            const novo = {
              id: newId,
              type: template.type, title: template.title, content: template.content,
              ctaLabel: template.ctaLabel || "", ctaUrl: template.ctaUrl || "",
              backgroundColor: "", color: "",
              x: Math.max(0, Math.min(xPct, 60)), y: Math.max(0, yPx), w: 40, h: 200, hidden: false, locked: false,
            };
            /* O widget recém-solto é a âncora: ele fica ONDE a pessoa soltou, e
               quem estava ali desce. O contrário — empurrar o novo para um vão
               livre — faria a peça aparecer longe de onde foi mirada. */
            const chaves = Object.keys(prev[layoutKeyAtual()] || {});
            const fisica = empurrarTudo({
              blocos: prev[layoutKeyAtual()] || {},
              chavesDeBloco: chaves,
              widgets: [...prev.widgets, novo],
              ancora: `w:${newId}`,
            });
            return { ...prev, [layoutKeyAtual()]: fisica.blocos, widgets: fisica.widgets };
          });
          setNewWidgetId(newId);
          setTimeout(() => setNewWidgetId(null), 700);
          setWidgetMenuOpen(false);
        }
      }
      setIsDraggingWidget(false);
      dragStateRef.current = null;
      setDragState(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function renderEditableText(field, fallback, className, tag = "p", textColorOverride) {
    const value = form[field] || "";
    const content = value || fallback;
    const textColor = textColorOverride ?? (field === "showcaseHeadline" || field === "showcaseSubheadline" ? blockStyles.title?.color : undefined);
    let colorStyle = {};
    if (textColor) {
      colorStyle = tag === "h2"
        ? { color: textColor, background: "none", backgroundImage: "none", WebkitBackgroundClip: "unset", backgroundClip: "unset" }
        : { color: textColor };
    }
    const Component = tag;
    return (
      <Component
        className={`${className} editable-inline`}
        data-rich-sync={`form|${field}`}
        style={{ ...colorStyle, cursor: "text", transition: "all 0.2s" }}
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => updateField(field, e.currentTarget.innerHTML)}
        onKeyDown={(e) => { if (tag === "h2" && e.key === "Enter") e.preventDefault(); }}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  function renderEditableSingleLine(field, fallback, className, color) {
    return (
      <span
        className={`${className} editable-inline`}
        data-rich-sync={`form|${field}`}
        style={{ ...(color ? { color } : {}), cursor: "text" }}
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => updateField(field, e.currentTarget.innerHTML)}
        onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
        dangerouslySetInnerHTML={{ __html: form[field] || fallback }}
      />
    );
  }

  function getBlockStyle(blockKey) {
    const defaults = DEFAULT_LAYOUT[blockKey] || { x: 0, y: 0, w: 100, h: 200 };
    const block = activeLayout?.[blockKey] || {};
    const x = coerceLayoutNumber(block.x, defaults.x);
    const y = coerceLayoutNumber(block.y, defaults.y);
    const wRaw = coerceLayoutNumber(block.w, defaults.w);
    const hRaw = coerceLayoutNumber(block.h, defaults.h);
    const w = Math.min(100, Math.max(15, wRaw));
    const h = Math.max(48, hRaw);
    const xClamped = Math.min(100 - w, Math.max(0, x));
    return { position: "absolute", left: `${xClamped}%`, top: `${y}px`, width: `${w}%`, minHeight: `${h}px`, boxSizing: "border-box" };
  }

  function mergedBlockWrapper(blockKey) {
    const base = { ...getBlockStyle(blockKey) };
    const bs = blockStyles[blockKey];
    const hasBanner = blockHasBackgroundImage(bs);
    const z = activeBlock === blockKey ? 50 : (hasBanner ? 0 : 10);
    if (hasBanner) {
      return { ...base, ...sectionSurfaceStyle(bs), left: 0, width: "100%", boxSizing: "border-box", zIndex: z, backgroundPosition: "top center" };
    }
    return { ...base, ...mergeBlockWrapperStyle(bs), zIndex: z };
  }

  function sectionBgClass(blockKey) {
    return blockHasBackgroundImage(blockStyles[blockKey]) ? " showcase-section-has-bg" : "";
  }

  function headerInnerStyle() {
    const bs = blockStyles.header || {};
    const primary = previewTenant.primaryColor || "#6366f1";
    if (blockHasBackgroundImage(bs)) return { background: "transparent", ...(bs.color ? { color: bs.color } : {}) };
    if (bs.backgroundColor) return { background: bs.backgroundColor, ...(bs.color ? { color: bs.color } : {}) };
    return { background: `linear-gradient(135deg, ${primary}55, rgba(255,255,255,0.03))`, ...(bs.color ? { color: bs.color } : {}) };
  }

  const canvasHeight = useMemo(() => {
    const blocks = Object.keys(DEFAULT_BLOCK_LABELS).map(k => activeLayout?.[k] || DEFAULT_LAYOUT?.[k] || {});
    const maxBottom = blocks.reduce((acc, block) => Math.max(acc, (block.y ?? 0) + (block.h ?? 200)), 0);
    const widgetMax = showcaseConfig.widgets.reduce((acc, w) => Math.max(acc, (w.y ?? 0) + (w.h ?? 200)), 0);
    return Math.max(1800, maxBottom + 40, widgetMax + 40);
  }, [activeLayout, showcaseConfig.widgets]);

  const isMobilePreview = previewMode === "mobile";

  const canvasContent = (
    <>
      {snapCenterActive ? <div className="builder-snap-guide" aria-hidden /> : null}
      {snapTopActive ? (
        <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: "#4ade80", zIndex: 9999, boxShadow: "0 0 10px 2px rgba(74,222,128,0.7)" }} />
      ) : null}
      {snapLines.x !== null && !snapCenterActive ? (
        <div aria-hidden className="snap-guide-v" style={{ left: `${snapLines.x}%` }} />
      ) : null}
      {snapLines.y !== null ? (
        <div aria-hidden className="snap-guide-h" style={{ top: `${snapLines.y}px` }} />
      ) : null}
      {isDraggingWidget ? (
        <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 9990, pointerEvents: "none", border: "2px dashed var(--accent)", borderRadius: "inherit", background: "rgba(99,102,241,0.04)", animation: "canvasDropPulse 1s ease-in-out infinite" }} />
      ) : null}

      {isBlockVisible("header") ? (
        <section
          data-reflow-key="header"
          className={`builder-block${sectionBgClass("header")} ${activeBlock === "header" ? "is-active" : ""}${multiSelection.has("header") && activeBlock !== "header" ? " multi-selected" : ""}${classeContato("b:header")}`}
          style={{ ...mergedBlockWrapper("header"), zIndex: 9999, ...(showcaseConfig.lockedBlocks?.includes("header") ? { cursor: "not-allowed" } : {}) }}
          onClick={(e) => handleBlockClick("header", e)}
        >
          <AlcaDeArrasto
            id={idDoBloco("header")}
            travado={showcaseConfig.lockedBlocks?.includes("header")}
            className="builder-block-handle"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px" }}><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
            Cabeçalho
          </AlcaDeArrasto>
          <button type="button" className="builder-delete-icon" onClick={(e) => { e.stopPropagation(); toggleLockBlock("header"); }} title={showcaseConfig.lockedBlocks?.includes("header") ? "Destravar bloco" : "Travar bloco"} style={{ right: "36px" }}>
            {showcaseConfig.lockedBlocks?.includes("header") ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>}
          </button>
          <button type="button" className="builder-delete-icon" onClick={(e) => { e.stopPropagation(); hideBlock("header"); }} title="Remover bloco">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
          {showcaseConfig.lockedBlocks?.includes("header") && <div style={{ position: "absolute", inset: 0, background: "rgba(99,102,241,0.06)", pointerEvents: "none", borderRadius: "inherit", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ opacity: 0.15 }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>}
          
          <div style={{ padding: isMobilePreview ? "20px 24px" : "28px 48px", maxWidth: "1400px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", boxSizing: "border-box" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div className="brand-logo-exclusive" style={{ width: isMobilePreview ? "44px" : "60px", height: isMobilePreview ? "44px" : "60px", background: previewTenant.logoUrl ? "transparent" : `linear-gradient(135deg, ${previewTenant.secondaryColor || previewTenant.primaryColor || "#6366f1"}, ${previewTenant.primaryColor || "#6366f1"})`, boxShadow: previewTenant.logoUrl ? "none" : undefined }}>
                {previewTenant.logoUrl ? <img src={previewTenant.logoUrl} alt={previewTenant.name} className="brand-logo-image" style={{ width: "54px" }} /> : <span style={{ fontSize: "24px", fontWeight: "700" }}>{(previewTenant.name || "D").charAt(0).toUpperCase()}</span>}
              </div>
              <div className="brand-title-group" style={{ color: blockStyles.header?.color || "inherit" }}>
                <h1 style={{ fontSize: isMobilePreview ? "16px" : "22px", letterSpacing: "-0.5px" }}>{previewTenant.name}</h1>
                <p style={{ fontSize: "11px", letterSpacing: "1.5px", textTransform: "uppercase", opacity: 0.7, marginTop: "2px" }}>
                  {previewTenant.slogan || [previewTenant.creci ? `CRECI ${previewTenant.creci}` : null, previewTenant.cidade || null].filter(Boolean).join(" · ") || "Alto Padrão"}
                </p>
              </div>
            </div>

            {!isMobilePreview && (
              <nav style={{ display: "flex", alignItems: "center", gap: "36px" }}>
                <span style={{ color: blockStyles.header?.color || "inherit", fontSize: "14px", fontWeight: "500" }}>Imóveis</span>
                <span style={{ color: blockStyles.header?.color || "inherit", fontSize: "14px", fontWeight: "500" }}>Destaques</span>
                <span style={{ color: blockStyles.header?.color || "inherit", fontSize: "14px", fontWeight: "500" }}>Sobre nós</span>
              </nav>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "transparent", border: `1px solid ${blockStyles.header?.color || "inherit"}`, color: blockStyles.header?.color || "inherit", padding: isMobilePreview ? "10px 16px" : "12px 28px", borderRadius: "100px", fontWeight: "600", fontSize: isMobilePreview ? "13px" : "14px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              {renderEditableSingleLine("whatsapp", "5511999999999", "editable-inline")}
            </div>
          </div>
          <div className="builder-resize-handle" onPointerDown={(event) => startBuilderAction("header", "resize", event)} />
        </section>
      ) : null}

      {isBlockVisible("title") ? (
        <section data-reflow-key="title" className={`builder-block${sectionBgClass("title")} ${activeBlock === "title" ? "is-active" : ""}${multiSelection.has("title") && activeBlock !== "title" ? " multi-selected" : ""}${classeContato("b:title")}`} style={mergedBlockWrapper("title")} onClick={(e) => handleBlockClick("title", e)}>
          <AlcaDeArrasto
            id={idDoBloco("title")}
            travado={showcaseConfig.lockedBlocks?.includes("title")}
            className="builder-block-handle"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px" }}><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
            Hero / Título
          </AlcaDeArrasto>
          <button type="button" className="builder-delete-icon" onClick={(e) => { e.stopPropagation(); toggleLockBlock("title"); }} title={showcaseConfig.lockedBlocks?.includes("title") ? "Destravar bloco" : "Travar bloco"} style={{ right: "36px" }}>
            {showcaseConfig.lockedBlocks?.includes("title") ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>}
          </button>
          <button type="button" className="builder-delete-icon" onClick={(e) => { e.stopPropagation(); hideBlock("title"); }} title="Remover bloco">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
          <section
            className={`showcase-title-section${blockStyles.title?.color ? " showcase-title-section--custom-text" : ""}`}
            style={{ ...mergeBlockWrapperStyle(blockStyles.title), padding: 0 }}
          >
            {renderEditableText("showcaseHeadline", previewHeadline, "editor-headline", "h2")}
            {renderEditableText("showcaseSubheadline", previewSubheadline, "", "p")}
          </section>
          <div className="builder-resize-handle" onPointerDown={(event) => startBuilderAction("title", "resize", event)} />
        </section>
      ) : null}

      {isBlockVisible("highlights") ? (
        <section data-reflow-key="highlights" className={`builder-block${sectionBgClass("highlights")} ${activeBlock === "highlights" ? "is-active" : ""}${multiSelection.has("highlights") && activeBlock !== "highlights" ? " multi-selected" : ""}${classeContato("b:highlights")}`} style={mergedBlockWrapper("highlights")} onClick={(e) => handleBlockClick("highlights", e)}>
          <AlcaDeArrasto
            id={idDoBloco("highlights")}
            travado={showcaseConfig.lockedBlocks?.includes("highlights")}
            className="builder-block-handle"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px" }}><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
            Destaques
          </AlcaDeArrasto>
          <button type="button" className="builder-delete-icon" onClick={(e) => { e.stopPropagation(); toggleLockBlock("highlights"); }} title={showcaseConfig.lockedBlocks?.includes("highlights") ? "Destravar bloco" : "Travar bloco"} style={{ right: "36px" }}>
            {showcaseConfig.lockedBlocks?.includes("highlights") ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>}
          </button>
          <button type="button" className="builder-delete-icon" onClick={(e) => { e.stopPropagation(); hideBlock("highlights"); }} title="Remover bloco">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
          <section className="showcase-highlights" style={mergeBlockWrapperStyle(blockStyles.highlights)}>
            {showcaseConfig.highlights.map((item, index) => {
              const hs = showcaseConfig.highlightStyles[index] || { backgroundColor: "", color: "" };
              return (
                <div className="highlight-box highlight-box-editable" key={`highlight-${index}`} style={{ ...mergeBlockWrapperStyle(hs), transition: "all 0.3s" }}>
                  <div className="highlight-mini-toolbar" onPointerDown={(e) => e.stopPropagation()}>
                    <label className="builder-color-mini">
                      Fundo
                      <input type="color" value={hs.backgroundColor || "#1e293b"} onChange={(e) => updateHighlightStyle(index, "backgroundColor", e.target.value)} style={{ width: "20px", height: "20px" }} />
                    </label>
                    <label className="builder-color-mini">
                      Texto
                      <input type="color" value={hs.color || "#f8fafc"} onChange={(e) => updateHighlightStyle(index, "color", e.target.value)} style={{ width: "20px", height: "20px" }} />
                    </label>
                    <button type="button" className="builder-toolbar-clear" onClick={() => clearHighlightStyle(index)} style={{ padding: "2px 6px" }}>Limpar</button>
                    <button type="button" className="builder-remove-highlight" onClick={() => removeHighlight(index)} disabled={showcaseConfig.highlights.length <= 1} style={{ padding: "2px 6px", borderRadius: "4px" }}>X</button>
                  </div>
                  <h3
                    className="editable-inline"
                    data-rich-sync={`highlight|${index}|title`}
                    style={{ ...(hs.color ? { color: hs.color } : {}), cursor: "text", display: "inline-block", width: "100%" }}
                    contentEditable suppressContentEditableWarning
                    onBlur={(e) => updateHighlight(index, "title", e.currentTarget.innerHTML)}
                    onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                    dangerouslySetInnerHTML={{ __html: item.title }}
                  />
                  <p
                    className="editable-inline"
                    data-rich-sync={`highlight|${index}|description`}
                    style={{ ...(hs.color ? { color: hs.color } : {}), cursor: "text", display: "inline-block", width: "100%" }}
                    contentEditable suppressContentEditableWarning
                    onBlur={(e) => updateHighlight(index, "description", e.currentTarget.innerHTML)}
                    dangerouslySetInnerHTML={{ __html: item.description }}
                  />
                </div>
              );
            })}
          </section>
          <div className="builder-resize-handle" onPointerDown={(event) => startBuilderAction("highlights", "resize", event)} />
        </section>
      ) : null}

      {isBlockVisible("properties") ? (
        <section data-reflow-key="properties" className={`builder-block${sectionBgClass("properties")} ${activeBlock === "properties" ? "is-active" : ""}${multiSelection.has("properties") && activeBlock !== "properties" ? " multi-selected" : ""}${classeContato("b:properties")}`} style={mergedBlockWrapper("properties")} onClick={(e) => handleBlockClick("properties", e)}>
          <AlcaDeArrasto
            id={idDoBloco("properties")}
            travado={showcaseConfig.lockedBlocks?.includes("properties")}
            className="builder-block-handle"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px" }}><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
            Lista de Imóveis
          </AlcaDeArrasto>
          <button type="button" className="builder-delete-icon" onClick={(e) => { e.stopPropagation(); toggleLockBlock("properties"); }} title={showcaseConfig.lockedBlocks?.includes("properties") ? "Destravar bloco" : "Travar bloco"} style={{ right: "36px" }}>
            {showcaseConfig.lockedBlocks?.includes("properties") ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>}
          </button>
          <button type="button" className="builder-delete-icon" onClick={(e) => { e.stopPropagation(); hideBlock("properties"); }} title="Remover bloco">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
          <div id="preview-destaques" className="property-grid" style={mergeBlockWrapperStyle(blockStyles.properties)}>
            {previewProperties.map((p) => {
              const images = p.images?.length ? p.images : [{ url: "/property-placeholder.svg" }];
              const currentIndex = carouselIndexes[p.id] || 0;
              const mainImage = images[currentIndex]?.url;
              return (
                <article key={p.id} className="property-card-luxury">
                  <div className="card-image-wrapper">
                    <img src={mainImage} alt={p.title} />
                    {images.length > 1 ? (
                      <>
                        <button type="button" className="carousel-btn prev" onClick={() => prevImage(p.id, images.length)}>‹</button>
                        <button type="button" className="carousel-btn next" onClick={() => nextImage(p.id, images.length)}>›</button>
                        <span className="carousel-counter">{currentIndex + 1}/{images.length}</span>
                      </>
                    ) : null}
                    <span className="featured-badge">Disponível</span>
                  </div>
                  <div className="card-info-wrapper">
                    <h3>{p.title}</h3>
                    <div className="card-location"><span>{p.neighborhood}, {p.city} - {p.state}</span></div>
                    <p className="hint" style={{ textAlign: "left", marginTop: 0 }}>{p.description}</p>
                    {(() => {
                      const ativas = comodidadesAtivas(p.comodidades);
                      if (ativas.length === 0) return null;
                      const visiveis = ativas.slice(0, 6);
                      const restantes = ativas.length - visiveis.length;
                      return (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", margin: "0 0 14px" }}>
                          {visiveis.map((c) => (
                            <span key={c.key} title={c.label} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "var(--text-muted)", background: "rgba(255,255,255,0.04)", padding: "5px 10px", borderRadius: "999px" }}>
                              <c.Icone size={13} />{c.label}
                            </span>
                          ))}
                          {restantes > 0 && (
                            <span style={{ display: "flex", alignItems: "center", fontSize: "12px", color: "var(--text-muted)", background: "rgba(255,255,255,0.04)", padding: "5px 10px", borderRadius: "999px" }}>+{restantes}</span>
                          )}
                        </div>
                      );
                    })()}
                    <div className="card-price-wrapper">
                      <div>
                        <span className="price-label">Valor</span>
                        <p className="card-price">R$ {Number(p.price).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                      </div>
                    </div>
                    <span className="btn-view-details" style={{ pointerEvents: "none", opacity: 0.85 }}>Ver detalhes do imóvel</span>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="builder-resize-handle" onPointerDown={(event) => startBuilderAction("properties", "resize", event)} />
        </section>
      ) : null}

      {showcaseConfig.widgets.filter(w => !w.hidden).map((widget) => {
          const widgetKey = `widget-${widget.id}`;
          const isActiveWidget = activeBlock === widgetKey;
          return (
            <section
              key={widget.id}
              data-reflow-key={widgetKey}
              className={`builder-block ${isActiveWidget ? "is-active" : ""} ${widget.id === newWidgetId ? "widget-entering" : ""}${classeContato(`w:${widget.id}`)}`}
              style={{
                position: "absolute",
                left: `${widget.x ?? 0}%`,
                top: `${widget.y ?? 1080}px`,
                width: `${widget.w ?? 50}%`,
                minHeight: `${widget.h ?? 200}px`,
                zIndex: isActiveWidget ? 50 : 10,
                boxSizing: "border-box",
                borderRadius: "16px",
                padding: "18px",
                ...(widget.backgroundColor ? { backgroundColor: widget.backgroundColor } : {}),
                ...(widget.color ? { color: widget.color } : {}),
                ...(widget.locked ? { outline: "2px dashed rgba(99,102,241,0.4)" } : {}),
              }}
              onClick={(e) => { e.stopPropagation(); setActiveBlock(widgetKey); }}
            >
              <div className="builder-block-handle" onPointerDown={(e) => startWidgetAction(widget.id, "drag", e)} style={{ cursor: widget.locked ? "not-allowed" : undefined }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px" }}><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
                {(widget.title || "Widget").replace(/<[^>]*>/g, "").slice(0, 28)}
              </div>
              {/* Ações da peça, numa fileira só: o espaçamento é do flex, e não
                  de um `right` calculado à mão para cada botão — que era o que
                  fazia os três se empilharem. */}
              <div className="builder-block-acoes">
              {/* Botão travar widget */}
              <button type="button" className="builder-delete-icon" onClick={(e) => { e.stopPropagation(); toggleLockWidget(widget.id); }} title={widget.locked ? "Destravar widget" : "Travar widget"}>
                {widget.locked ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>}
              </button>
              {/* Botão duplicar widget */}
              <button type="button" className="builder-delete-icon" onClick={(e) => { e.stopPropagation(); duplicateWidget(widget.id); }} title="Duplicar widget">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
              <button type="button" className="builder-delete-icon" onClick={(e) => { e.stopPropagation(); removeWidgetById(widget.id); }} title="Remover widget">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
              </div>
              {widget.locked && <div style={{ position: "absolute", inset: 0, background: "rgba(99,102,241,0.06)", pointerEvents: "none", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ opacity: 0.15 }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>}
              <div className="highlight-mini-toolbar" onPointerDown={(e) => e.stopPropagation()}>
                <label className="builder-color-mini">Fundo<input type="color" value={widget.backgroundColor || "#1e293b"} onChange={(e) => updateWidgetById(widget.id, "backgroundColor", e.target.value)} style={{ width: "20px", height: "20px" }} /></label>
                <label className="builder-color-mini">Texto<input type="color" value={widget.color || "#f8fafc"} onChange={(e) => updateWidgetById(widget.id, "color", e.target.value)} style={{ width: "20px", height: "20px" }} /></label>
              </div>

              {widget.type === "testimonial" ? (
                <div style={{ textAlign: "center", padding: "16px" }}>
                  <div className="widget-testimonial-stars">★★★★★</div>
                  <div className="widget-testimonial-content editable-inline" data-rich-sync={`widget|${widget.id}|content`} style={{ cursor: "text", display: "inline-block", width: "100%", ...(widget.color ? { color: widget.color } : {}) }} contentEditable suppressContentEditableWarning onBlur={(e) => updateWidgetById(widget.id, "content", e.currentTarget.innerHTML)} dangerouslySetInnerHTML={{ __html: widget.content }} />
                  <h3 className="editable-inline" data-rich-sync={`widget|${widget.id}|title`} style={{ fontSize: "16px", fontWeight: "600", cursor: "text", display: "inline-block", width: "100%", ...(widget.color ? { color: widget.color } : {}) }} contentEditable suppressContentEditableWarning onBlur={(e) => updateWidgetById(widget.id, "title", e.currentTarget.innerHTML)} dangerouslySetInnerHTML={{ __html: widget.title }} />
                </div>
              ) : widget.type === "stats" ? (
                <div style={{ padding: "8px" }}>
                  <h3 className="editable-inline" data-rich-sync={`widget|${widget.id}|title`} style={{ textAlign: "center", marginBottom: "24px", cursor: "text", display: "inline-block", width: "100%", ...(widget.color ? { color: widget.color } : {}) }} contentEditable suppressContentEditableWarning onBlur={(e) => updateWidgetById(widget.id, "title", e.currentTarget.innerHTML)} dangerouslySetInnerHTML={{ __html: widget.title }} />
                  <div className="editable-inline" data-rich-sync={`widget|${widget.id}|content`} style={{ cursor: "text", width: "100%", ...(widget.color ? { color: widget.color } : {}) }} contentEditable suppressContentEditableWarning onBlur={(e) => updateWidgetById(widget.id, "content", e.currentTarget.innerHTML)} dangerouslySetInnerHTML={{ __html: widget.content }} />
                </div>
              ) : widget.type === "cta" ? (
                <div className="widget-cta-box">
                  <h3 className="editable-inline" data-rich-sync={`widget|${widget.id}|title`} style={{ cursor: "text", display: "inline-block", width: "100%", ...(widget.color ? { color: widget.color } : {}) }} contentEditable suppressContentEditableWarning onBlur={(e) => updateWidgetById(widget.id, "title", e.currentTarget.innerHTML)} dangerouslySetInnerHTML={{ __html: widget.title }} />
                  <p className="editable-inline" data-rich-sync={`widget|${widget.id}|content`} style={{ fontSize: "16px", margin: "16px 0", cursor: "text", display: "inline-block", width: "100%", ...(widget.color ? { color: widget.color } : {}) }} contentEditable suppressContentEditableWarning onBlur={(e) => updateWidgetById(widget.id, "content", e.currentTarget.innerHTML)} dangerouslySetInnerHTML={{ __html: widget.content }} />
                  <div style={{ marginTop: "16px", padding: "12px", background: "rgba(0,0,0,0.2)", borderRadius: "8px" }}>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: "600", textTransform: "uppercase" }}>Configuração do Botão</p>
                    {(() => {
                      const isWhats = /wa\.me|whatsapp|api\.whatsapp/i.test(widget.ctaUrl || "");
                      return (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: isWhats ? "#25d366" : "var(--accent)", color: "#fff", padding: "11px 14px", borderRadius: "8px", fontWeight: "700", marginBottom: "8px", boxShadow: isWhats ? "0 4px 14px rgba(37,211,102,0.35)" : "0 4px 14px rgba(99,102,241,0.3)" }}>
                          {isWhats ? (
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="#fff" style={{ flexShrink: 0 }}><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" /></svg>
                          ) : null}
                          <span className="editable-inline" data-rich-sync={`widget|${widget.id}|ctaLabel`} style={{ cursor: "text", outline: "none" }} contentEditable suppressContentEditableWarning onBlur={(e) => updateWidgetById(widget.id, "ctaLabel", e.currentTarget.innerHTML)} dangerouslySetInnerHTML={{ __html: widget.ctaLabel || "Texto do Botão" }} />
                        </div>
                      );
                    })()}
                    <span className="editable-inline" data-rich-sync={`widget|${widget.id}|ctaUrl`} style={{ cursor: "text", display: "inline-block", width: "100%", fontSize: "12px", color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.1)", padding: "4px 8px", borderRadius: "4px" }} contentEditable suppressContentEditableWarning onBlur={(e) => updateWidgetById(widget.id, "ctaUrl", e.currentTarget.innerHTML)} dangerouslySetInnerHTML={{ __html: widget.ctaUrl || "https://link.com" }} />
                  </div>
                </div>
              ) : widget.type === "social" ? (
                <div style={{ textAlign: "center", padding: "8px" }}>
                  <h3 className="editable-inline" data-rich-sync={`widget|${widget.id}|title`} style={{ cursor: "text", display: "inline-block", width: "100%", ...(widget.color ? { color: widget.color } : {}) }} contentEditable suppressContentEditableWarning onBlur={(e) => updateWidgetById(widget.id, "title", e.currentTarget.innerHTML)} dangerouslySetInnerHTML={{ __html: widget.title }} />
                  <p className="editable-inline" data-rich-sync={`widget|${widget.id}|content`} style={{ fontSize: "12px", margin: "16px 0", cursor: "text", display: "inline-block", width: "100%", ...(widget.color ? { color: widget.color } : {}) }} contentEditable suppressContentEditableWarning onBlur={(e) => updateWidgetById(widget.id, "content", e.currentTarget.innerHTML)} dangerouslySetInnerHTML={{ __html: widget.content }} />
                </div>
              ) : widget.type === "divider" ? (
                <div style={{ textAlign: "center", padding: "32px 0", height: "100%", display: "flex", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "24px", width: "100%" }}>
                    <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15))" }} />
                    <span className="editable-inline" data-rich-sync={`widget|${widget.id}|title`} style={{ fontSize: "15px", opacity: 0.7, letterSpacing: "0.2em", textTransform: "uppercase", cursor: "text" }} contentEditable suppressContentEditableWarning onBlur={(e) => updateWidgetById(widget.id, "title", e.currentTarget.innerHTML)} dangerouslySetInnerHTML={{ __html: widget.title }} />
                    <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg, rgba(255,255,255,0.15), transparent)" }} />
                  </div>
                </div>
              ) : widget.type === "map" ? (
                <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                  <h3 className="editable-inline" data-rich-sync={`widget|${widget.id}|title`} style={{ cursor: "text", display: "inline-block", width: "100%", ...(widget.color ? { color: widget.color } : {}) }} contentEditable suppressContentEditableWarning onBlur={(e) => updateWidgetById(widget.id, "title", e.currentTarget.innerHTML)} dangerouslySetInnerHTML={{ __html: widget.title }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", marginTop: "20px", background: "rgba(0,0,0,0.15)", borderRadius: "20px", padding: "32px", textAlign: "center", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "16px" }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    <p className="editable-inline" data-rich-sync={`widget|${widget.id}|content`} style={{ fontSize: "16px", color: "var(--text-main)", margin: 0, fontWeight: "500", cursor: "text", display: "inline-block", width: "100%" }} contentEditable suppressContentEditableWarning onBlur={(e) => updateWidgetById(widget.id, "content", e.currentTarget.innerHTML)} dangerouslySetInnerHTML={{ __html: widget.content }} />
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="editable-inline" data-rich-sync={`widget|${widget.id}|title`} style={{ cursor: "text", display: "inline-block", width: "100%", ...(widget.color ? { color: widget.color } : {}) }} contentEditable suppressContentEditableWarning onBlur={(e) => updateWidgetById(widget.id, "title", e.currentTarget.innerHTML)} dangerouslySetInnerHTML={{ __html: widget.title }} />
                  <p className="editable-inline" data-rich-sync={`widget|${widget.id}|content`} style={{ cursor: "text", display: "inline-block", width: "100%", ...(widget.color ? { color: widget.color } : {}) }} contentEditable suppressContentEditableWarning onBlur={(e) => updateWidgetById(widget.id, "content", e.currentTarget.innerHTML)} dangerouslySetInnerHTML={{ __html: widget.content }} />
                </div>
              )}
              <div className="builder-resize-handle" onPointerDown={(e) => startWidgetAction(widget.id, "resize", e)} />
            </section>
          );
        })}

        {isBlockVisible("footer") ? (
        <section
          id="footer"
          data-reflow-key="footer"
          className={`builder-block${sectionBgClass("footer")} ${activeBlock === "footer" ? "is-active" : ""}${multiSelection.has("footer") && activeBlock !== "footer" ? " multi-selected" : ""}${classeContato("b:footer")}`}
          style={mergedBlockWrapper("footer")}
          onClick={(e) => handleBlockClick("footer", e)}
        >
          <AlcaDeArrasto
            id={idDoBloco("footer")}
            travado={showcaseConfig.lockedBlocks?.includes("footer")}
            className="builder-block-handle"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px" }}><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
            Rodapé
          </AlcaDeArrasto>
          <button type="button" className="builder-delete-icon" onClick={(e) => { e.stopPropagation(); toggleLockBlock("footer"); }} title={showcaseConfig.lockedBlocks?.includes("footer") ? "Destravar bloco" : "Travar bloco"} style={{ right: "36px" }}>
            {showcaseConfig.lockedBlocks?.includes("footer") ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>}
          </button>
          <button type="button" className="builder-delete-icon" onClick={(e) => { e.stopPropagation(); hideBlock("footer"); }} title="Remover bloco">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
          
          <footer className="showcase-footer" style={mergeBlockWrapperStyle(blockStyles.footer)}>
            <div className="showcase-footer-grid">
              <div className="footer-col">
                <h4
                  className="editable-inline"
                  data-rich-sync="footerTitle"
                  style={{ color: blockStyles.footer?.color || "inherit", cursor: "text" }}
                  contentEditable suppressContentEditableWarning
                  onBlur={(e) => updateShowcaseConfig((prev) => ({ ...prev, footerTitle: e.currentTarget.innerHTML }))}
                  onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                  dangerouslySetInnerHTML={{ __html: showcaseConfig.footerTitle }}
                />
                {renderEditableText("description", "Encontre seu próximo imóvel com segurança e transparência.", "editable-footer", "p", blockStyles.footer?.color)}
              </div>
              
              <div className="footer-col">
                <h4 style={{ color: blockStyles.footer?.color || "inherit" }}>Imobiliária</h4>
                <p style={{ color: blockStyles.footer?.color || "var(--text-muted)", margin: "0 0 8px 0" }}>{previewTenant.name}</p>
                {previewTenant.creci ? <p style={{ color: blockStyles.footer?.color || "var(--text-muted)", margin: "0 0 8px 0" }}>CRECI {previewTenant.creci}</p> : null}
                {previewTenant.cidade ? <p style={{ color: blockStyles.footer?.color || "var(--text-muted)", margin: "0 0 8px 0" }}>{previewTenant.cidade}</p> : null}
              </div>

              <div className="footer-col">
                <h4 style={{ color: blockStyles.footer?.color || "inherit" }}>Contato</h4>
                <p style={{ color: blockStyles.footer?.color || "var(--text-muted)" }}>
                  Email: {renderEditableSingleLine("email", "contato@imobiliaria.com", "editable-inline small-inline", blockStyles.footer?.color)}
                </p>
                <p style={{ color: blockStyles.footer?.color || "var(--text-muted)" }}>
                  WhatsApp: {renderEditableSingleLine("whatsapp", "5511999999999", "editable-inline small-inline", blockStyles.footer?.color)}
                </p>
              </div>
            </div>
            
            <div className="footer-bottom" style={{ color: blockStyles.footer?.color || "var(--text-muted)" }}>
              &copy; {new Date().getFullYear()} {previewTenant.name}. Todos os direitos reservados.
            </div>
          </footer>

          <div className="builder-resize-handle" onPointerDown={(event) => startBuilderAction("footer", "resize", event)} />
        </section>
        ) : null}
    </>
  );

  const iconBtn = (disabled, onClick, title, children) => (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      style={{
        width: "32px", height: "32px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)",
        background: disabled ? "transparent" : "rgba(255,255,255,0.06)",
        color: disabled ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.7)",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: disabled ? "not-allowed" : "pointer", padding: 0,
      }}
    >
      {children}
    </button>
  );

  return (
    /* O provedor envolve o editor inteiro, e não só o canvas: as alças vivem
       dentro dos blocos, mas o sensor de TECLADO precisa alcançar o foco onde
       quer que ele esteja — inclusive quando a pessoa chega no bloco pelo Tab
       vindo do painel lateral. */
    <DragDropProvider
      sensors={SENSORES_EDITOR}
      onDragStart={aoIniciarArrasto}
      onDragMove={aoMoverArrasto}
      onDragEnd={aoTerminarArrasto}
    >
    <div
      className={`showcase-body showcase-editor-full ${isLightMode ? "showcase-theme-light" : ""} page-transition`}
      style={{ ...previewStyle, display: "flex", flexDirection: "column", minHeight: "100vh" }}
    >
      {confirmModal}
      <style>{`
        .builder-block { border-color: transparent !important; transition: border-color 0.2s ease-in-out; }
        .builder-block:hover { border-color: rgba(255, 255, 255, 0.3) !important; }
        .showcase-theme-light .builder-block:hover { border-color: rgba(15, 23, 42, 0.3) !important; }
        .builder-block.is-active { border-color: rgba(255, 255, 255, 0.5) !important; z-index: 50; }
        .showcase-theme-light .builder-block.is-active { border-color: rgba(15, 23, 42, 0.5) !important; }
        .builder-block.multi-selected { border-color: rgba(99,102,241,0.6) !important; }
        .builder-block .builder-block-handle,
        .builder-block .builder-delete-icon,
        .builder-block .builder-resize-handle { opacity: 0; visibility: hidden; transition: all 0.2s ease-in-out; }
        .builder-block:hover .builder-block-handle,
        .builder-block:hover .builder-delete-icon,
        .builder-block:hover .builder-resize-handle,
        .builder-block.is-active .builder-block-handle,
        .builder-block.is-active .builder-delete-icon,
        .builder-block.is-active .builder-resize-handle { opacity: 1; visibility: visible; }
        .highlight-box-editable .highlight-mini-toolbar { opacity: 0; visibility: hidden; transition: all 0.2s ease; }
        .highlight-box-editable:hover .highlight-mini-toolbar { opacity: 1; visibility: visible; }
        .widget-card .widget-delete, .widget-card .highlight-mini-toolbar { opacity: 0; visibility: hidden; transition: all 0.2s ease; }
        .widget-card:hover .widget-delete, .widget-card:hover .highlight-mini-toolbar { opacity: 1; visibility: visible; }
        .editable-inline span[style*="color"], .editable-inline font[color] { -webkit-text-fill-color: currentcolor !important; -webkit-background-clip: initial !important; background: none !important; }
        @keyframes builderModeIn { from { opacity: 0; transform: scale(0.975) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .builder-canvas-anim { animation: builderModeIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) both; }
        @keyframes snapPulse { from { opacity: 1; } 50% { opacity: 0.45; } to { opacity: 1; } }
        .snap-guide-v { position: absolute; top: 0; bottom: 0; width: 2px; background: #4ade80; box-shadow: 0 0 8px 3px rgba(74,222,128,0.55); z-index: 9998; pointer-events: none; animation: snapPulse 0.4s ease-in-out; }
        .snap-guide-h { position: absolute; left: 0; right: 0; height: 2px; background: #4ade80; box-shadow: 0 0 8px 3px rgba(74,222,128,0.55); z-index: 9998; pointer-events: none; animation: snapPulse 0.4s ease-in-out; }
        @keyframes canvasDropPulse { 0%,100% { border-color: var(--accent); opacity: 1; } 50% { border-color: rgba(99,102,241,0.35); opacity: 0.7; } }
        @keyframes widgetDrop { 0% { opacity: 0; transform: scale(0.82) translateY(-14px); } 65% { transform: scale(1.04) translateY(3px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        .widget-entering { animation: widgetDrop 0.52s cubic-bezier(0.34, 1.56, 0.64, 1) both; }

        /* ── Bordas em contato ──
           A peça já tem borda tracejada; o contato ACENDE a que existe, em vez
           de desenhar uma segunda linha por cima. É a diferença entre "algo
           apareceu aqui" e "esta borda encostou".

           O brilho externo é curto de propósito: ele marca a linha do encontro,
           e um halo largo faria duas peças coladas virarem uma mancha só. */
        .builder-block.is-encostado {
          border-style: dashed !important;
          border-color: var(--accent, #6366f1) !important;
          box-shadow: 0 0 0 1px rgba(99,102,241,0.35), 0 0 12px -2px rgba(99,102,241,0.55);
          transition: border-color 0.12s ease, box-shadow 0.12s ease;
        }
      `}</style>

      {textSelection
        ? createPortal(
            <div
              ref={formatToolbarRef}
              className="text-format-toolbar"
              role="presentation"
              contentEditable={false}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                position: "fixed", top: textSelection.y - 10, left: textSelection.x,
                transform: "translate(-50%, -100%)", background: "#1e293b", padding: "8px",
                borderRadius: "8px", zIndex: 2147483647, display: "flex", gap: "8px",
                alignItems: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                border: "1px solid rgba(255,255,255,0.1)", userSelect: "none", pointerEvents: "auto",
              }}
            >
              <input type="color" title="Cor da fonte" defaultValue="#6366f1"
                onChange={(e) => applyFormat("foreColor", e.currentTarget.value)}
                style={{ width: "28px", height: "28px", padding: 0, border: "none", borderRadius: "4px", cursor: "pointer" }}
              />
              {/* Menus de ação: não guardam estado, só aplicam o formato na seleção. */}
              <SelectCustom
                size="sm"
                zIndex={2147483647}
                title="Família da Fonte"
                ariaLabel="Família da fonte"
                value=""
                placeholder="Fonte"
                style={{ minWidth: "120px" }}
                options={[
                  { value: "", label: "Fonte Padrão" },
                  { value: "Arial", label: "Arial" },
                  { value: "Georgia", label: "Georgia" },
                  { value: "Courier New", label: "Courier New" },
                  { value: "Times New Roman", label: "Times New Roman" },
                  { value: "Verdana", label: "Verdana" },
                ]}
                onChange={(v) => applyFormat("fontName", v)}
              />
              <SelectCustom
                size="sm"
                zIndex={2147483647}
                title="Tamanho da Fonte"
                ariaLabel="Tamanho da fonte"
                value=""
                placeholder="Tamanho"
                style={{ minWidth: "120px" }}
                options={[
                  { value: "1", label: "Muito Pequeno" },
                  { value: "2", label: "Pequeno" },
                  { value: "3", label: "Normal" },
                  { value: "4", label: "Médio" },
                  { value: "5", label: "Grande" },
                  { value: "6", label: "Muito Grande" },
                  { value: "7", label: "Gigante" },
                ]}
                onChange={(v) => applyFormat("fontSize", v)}
              />
            </div>,
            document.body
          )
        : null}

      {/* ── Top Bar ── */}
      <div data-tour="vitrine-topbar" className="showcase-editor-topbar" style={{ padding: "10px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div>
            <strong style={{ fontSize: "15px", display: "block", color: "#fff" }}>Editor de Vitrine</strong>
            <span className="editor-status" style={{ color: success ? "#4ade80" : "var(--text-muted)", transition: "color 0.3s" }}>
              {loadingInitial ? "Carregando..." : saving ? "Salvando..." : success ? "Salvo" : "Pronto"}
            </span>
          </div>
        </div>

        <div className="showcase-editor-actions">
          {/* Undo / Redo */}
          <div style={{ display: "flex", gap: "4px" }}>
            {iconBtn(!canUndo, undo, "Desfazer (Ctrl+Z)",
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M3 13A9 9 0 1 0 5.6 5.6"/></svg>
            )}
            {iconBtn(!canRedo, redo, "Refazer (Ctrl+Y)",
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M21 13A9 9 0 1 1 18.4 5.6"/></svg>
            )}
          </div>

          <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.1)" }} />

          {/* Desktop / Mobile toggle */}
          <span data-tour="vitrine-modo" className="editor-mode-group" style={{ border: "none", padding: 0 }}>
            <button type="button" className={previewMode === "desktop" ? "active" : ""} onClick={() => setPreviewMode("desktop")}
              style={{ borderRadius: "8px 0 0 8px", opacity: previewMode === "mobile" ? 0.45 : 1, transition: "opacity 0.2s" }}
              title="Edição Desktop">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "5px" }}><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>
              Desktop
            </button>
            <button type="button" className={previewMode === "mobile" ? "active" : ""} onClick={() => setPreviewMode("mobile")}
              style={{ borderRadius: "0 8px 8px 0", opacity: previewMode === "desktop" ? 0.45 : 1, transition: "opacity 0.2s" }}
              title="Edição Mobile">
              <svg width="11" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "5px" }}><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
              Mobile
            </button>
          </span>

          {previewMode === "mobile" ? (
            <button type="button" className="button-secondary" onClick={copyDesktopToMobile} title="Copia as posições do layout desktop para o mobile">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "5px" }}><rect x="8" y="2" width="14" height="20" rx="2"/><path d="M3 7v14a2 2 0 0 0 2 2h12"/></svg>
              Copiar Desktop
            </button>
          ) : null}

          <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.1)" }} />

          {/* Seletor de fonte global */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, flexShrink: 0 }}>
              <polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>
            </svg>
            <SelectCustom
              size="sm"
              value={globalFont}
              title="Fonte da vitrine"
              ariaLabel="Fonte da vitrine"
              style={{ width: "160px" }}
              options={FONT_OPTIONS.map((f) => ({ value: f.value, label: f.label }))}
              onChange={(v) => updateShowcaseConfig((prev) => ({ ...prev, globalFont: v }))}
            />
          </div>

          <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.1)" }} />

          {/* Zoom do canvas (desktop apenas) */}
          {!isMobilePreview && (
            <div style={{ display: "flex", alignItems: "center", gap: "2px", background: "rgba(255,255,255,0.05)", borderRadius: "8px", padding: "2px 4px", border: "1px solid rgba(255,255,255,0.08)" }}>
              {iconBtn(canvasZoom <= 0.4, () => setCanvasZoom(z => Math.max(0.4, z - 0.1)), "Diminuir zoom",
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14"/></svg>
              )}
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", minWidth: "32px", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
                {Math.round(canvasZoom * 100)}%
              </span>
              {iconBtn(canvasZoom >= 1.6, () => setCanvasZoom(z => Math.min(1.6, z + 0.1)), "Aumentar zoom",
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
              )}
              {iconBtn(canvasZoom === 1.0, () => setCanvasZoom(1.0), "Resetar zoom",
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/></svg>
              )}
            </div>
          )}

          <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.1)" }} />

          {/* Templates */}
          <button type="button" className="button-secondary" onClick={() => setShowTemplates(true)} title="Aplicar template de aparência">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "5px" }}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            Templates
          </button>

          <button type="button" className="button-secondary" onClick={randomizeColors} title="Gerar combinação de cores aleatória" style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            Cores
          </button>
          <button data-tour="vitrine-posicoes" type="button" className="button-secondary" onClick={resetLayoutOnly} title="Restaura posições e tamanhos para o padrão">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "5px" }}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            Posições
          </button>
          <button type="button" className="button-secondary btn-danger" onClick={resetAllBuilder} style={{ color: "#fca5a5", borderColor: "rgba(239, 68, 68, 0.3)" }}>
            Resetar Tudo
          </button>

          <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.1)" }} />

          {/* Histórico */}
          <button data-tour="vitrine-historico" type="button" className="button-secondary" onClick={() => setShowHistory(true)} title="Histórico de versões salvas">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "5px" }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Histórico
          </button>

          {/* Copiar link */}
          <button type="button" className="button-secondary" onClick={() => { navigator.clipboard.writeText(baseDaVitrine()); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }} title="Copiar link da vitrine" style={{ color: linkCopied ? "#4ade80" : undefined, transition: "color 0.3s" }}>
            {linkCopied
                  ? <><IconeCheck size={13} /> Link copiado!</>
                  : <><IconeLink size={13} /> Copiar Link</>}
          </button>

          {/* Âncora, não <Link>: em domínio próprio o endereço é absoluto e sai
              do app — o Link tentaria resolver como rota interna. */}
          <a className="link-button" href={baseDaVitrine()} target="_blank" rel="noreferrer" style={{ padding: "8px 14px" }}>
            Ver Página
          </a>
        </div>
      </div>

      {error ? <div className="error" style={{ margin: "0 20px", flexShrink: 0 }}>{error}</div> : null}

      {/* ── Main body: canvas area + side panel ── */}
      <div style={{ flex: 1, display: "flex", alignItems: "flex-start" }}>

        {/* Canvas area */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {isMobilePreview ? (
            <div key="mobile" className="builder-canvas-anim" style={{ display: "flex", justifyContent: "center", padding: "32px 24px", background: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
              <div style={{ width: "480px", flexShrink: 0, border: "10px solid #0f172a", borderRadius: "44px", overflow: "hidden", boxShadow: "0 30px 60px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.08)", position: "relative" }}>
                <div style={{ width: "60px", height: "6px", background: "#0f172a", borderRadius: "0 0 8px 8px", position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", zIndex: 100 }} />
                <div
                  className={`showcase-container showcase-builder-canvas ${isLightMode ? "showcase-theme-light" : ""}`}
                  ref={canvasRef}
                  onClick={(e) => { if (e.target === canvasRef.current) setActiveBlock(null); }}
                  style={{ position: "relative", width: "100%", overflow: "hidden", minHeight: `${canvasHeight}px`, backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "24px 24px", fontFamily: `'${globalFont}', system-ui, sans-serif` }}
                >
                  {canvasContent}
                </div>
              </div>
            </div>
          ) : (
            <div
              ref={canvasContainerRef}
              key="desktop"
              style={{ margin: "20px", transformOrigin: "top center" }}
            >
              <div
                style={{ transform: `scale(${canvasZoom})`, transformOrigin: "top center", transition: "transform 0.15s" }}
              >
                <div
                  className="showcase-container showcase-builder-canvas builder-canvas-anim"
                  data-tour="vitrine-canvas"
                  ref={canvasRef}
                  onClick={(e) => { if (e.target === canvasRef.current) setActiveBlock(null); }}
                  style={{
                    position: "relative", overflow: "hidden",
                    width: "100%", borderRadius: "20px",
                    minHeight: `${canvasHeight}px`,
                    backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)",
                    backgroundSize: "24px 24px",
                    border: "1px solid rgba(255,255,255,0.05)",
                    fontFamily: `'${globalFont}', system-ui, sans-serif`,
                  }}
                >
                  {canvasContent}
                </div>
              </div>
            </div>
          )}

          {/* Widget FAB — fixo na viewport via portal (escapa de ancestrais com transform) */}
          {createPortal(
            <div className="widget-fab-shell" style={{ right: panelCollapsed ? "calc(40px + 24px)" : "calc(272px + 48px)", transition: "right 0.25s ease" }}>
              {widgetMenuOpen ? (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: -1, animation: "fadeIn 0.2s" }} onClick={() => setWidgetMenuOpen(false)} />
              ) : null}
              {widgetMenuOpen ? (
                <div className="widget-fab-menu" style={{ padding: "20px", boxShadow: "0 20px 40px rgba(0,0,0,0.5)", width: "300px", animation: "chicEntrance 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards", transformOrigin: "bottom right" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#fff", margin: 0 }}>Widgets</h3>
                    <button onClick={() => setWidgetMenuOpen(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: "8px", padding: "8px 12px", marginBottom: "14px" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 9l-3 3 3 3M19 9l3 3-3 3M2 12h20"/></svg>
                    <span style={{ fontSize: "11px", color: "var(--accent)", fontWeight: "600" }}>Segure e arraste para o canvas</span>
                  </div>
                  <div style={{ display: "grid", gap: "8px", maxHeight: "56vh", overflowY: "auto", paddingRight: "4px" }}>
                    {WIDGET_LIBRARY.map((template) => (
                      <button key={template.type} type="button" onPointerDown={(e) => startWidgetDrag(template, e)}
                        className="button-secondary"
                        style={{ padding: "12px 14px", borderRadius: "12px", display: "flex", alignItems: "center", gap: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", textAlign: "left", cursor: "grab" }}
                      >
                        <div style={{ flexShrink: 0, width: "36px", height: "36px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                        </div>
                        <div style={{ flex: 1, minWidth: 0, pointerEvents: "none" }}>
                          <div style={{ fontWeight: "600", fontSize: "13px", color: "#fff", marginBottom: "2px" }} dangerouslySetInnerHTML={{ __html: template.title }} />
                          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)" }}>arraste para adicionar</div>
                        </div>
                        <div style={{ flexShrink: 0, width: "48px", height: "32px", padding: "6px", background: "rgba(0,0,0,0.25)", borderRadius: "6px", border: "1px dashed rgba(255,255,255,0.08)", pointerEvents: "none", overflow: "hidden" }}>
                          {template.preview}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <button type="button" className="widget-fab-button" onClick={() => setWidgetMenuOpen((v) => !v)}
                style={{ background: widgetMenuOpen ? "var(--bg-gradient-2)" : "var(--accent)", color: "#fff", border: "none", transform: widgetMenuOpen ? "rotate(45deg)" : "rotate(0deg)", transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.3s" }}
                title={widgetMenuOpen ? "Fechar Menu" : "Adicionar Widgets"}
              >
                +
              </button>
            </div>,
            document.body
          )}
        </div>

        {/* Side panel */}
        <BuilderSidePanel
          collapsed={panelCollapsed}
          onToggleCollapse={() => setPanelCollapsed((v) => !v)}
          activeBlock={activeBlock}
          form={form}
          tenantName={session?.tenant?.name || ""}
          showcaseConfig={showcaseConfig}
          blockStyles={blockStyles}
          currentTheme={currentTheme}
          isLightMode={isLightMode}
          PRESET_THEMES={PRESET_THEMES}
          DEFAULT_BLOCK_LABELS={DEFAULT_BLOCK_LABELS}
          WIDGET_LIBRARY={WIDGET_LIBRARY}
          updateField={updateField}
          setAppearanceMode={setAppearanceMode}
          applyPreset={applyPreset}
          hideBlock={hideBlock}
          restoreBlock={restoreBlock}
          updateBlockStyle={updateBlockStyle}
          clearBlockStyle={clearBlockStyle}
          addHighlight={addHighlight}
          removeHighlight={removeHighlight}
          updateHighlightStyle={updateHighlightStyle}
          addWidget={addWidget}
          activeWidgetData={activeBlock?.startsWith("widget-") ? showcaseConfig.widgets.find(w => w.id === activeBlock.replace("widget-", "")) : null}
          updateActiveWidget={(field, value) => { if (activeBlock?.startsWith("widget-")) updateWidgetById(activeBlock.replace("widget-", ""), field, value); }}
          removeActiveWidget={() => { if (activeBlock?.startsWith("widget-")) removeWidgetById(activeBlock.replace("widget-", "")); }}
          duplicateActiveWidget={() => { if (activeBlock?.startsWith("widget-")) duplicateWidget(activeBlock.replace("widget-", "")); }}
          copiedBlockStyle={copiedBlockStyle}
          onCopyStyle={copyBlockStyle}
          onPasteStyle={pasteBlockStyle}
        />
      </div>

      {/* Drag ghost */}
      {dragState ? (
        <div style={{
          position: "fixed", left: dragState.x, top: dragState.y,
          /* O ponteiro é a QUINA SUPERIOR ESQUERDA do widget que vai nascer —
             é isso que `startWidgetDrag` grava ao soltar (x/y saem direto da
             posição do ponteiro no canvas). O fantasma agora mostra a mesma
             coisa.

             Antes era `translate(-50%, -65%)`: o cartão flutuava 65% da própria
             altura ACIMA do cursor, então a pessoa mirava num lugar e o widget
             nascia bem abaixo. O leve deslocamento e a inclinação ficam só para
             o cursor não sumir sob o cartão. */
          transform: "translate(10px, 10px) rotate(-2.5deg)",
          pointerEvents: "none", zIndex: 99999, background: "#0d1829",
          padding: "16px", borderRadius: "16px",
          border: "1.5px solid var(--accent)",
          boxShadow: "0 24px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06), 0 0 24px rgba(99,102,241,0.2)",
          width: "210px", opacity: 0.96,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
            <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            </div>
            <span style={{ fontWeight: "700", fontSize: "13px", color: "#fff", lineHeight: 1.3 }} dangerouslySetInnerHTML={{ __html: dragState.template.title }} />
          </div>
          <div style={{ padding: "10px", background: "rgba(255,255,255,0.04)", borderRadius: "10px", border: "1px dashed rgba(255,255,255,0.12)" }}>
            <div style={{ width: "45%", height: "5px", background: "rgba(255,255,255,0.25)", borderRadius: "3px", marginBottom: "8px" }} />
            {dragState.template.preview}
          </div>
          <div style={{ fontSize: "10px", color: "var(--accent)", marginTop: "10px", fontWeight: "700", textAlign: "center", letterSpacing: "0.05em", textTransform: "uppercase", opacity: 0.85 }}>
            Solte no canvas
          </div>
        </div>
      ) : null}

      {/* Onboarding overlay */}
      {showOnboarding ? (
        <OnboardingOverlay onDismiss={() => {
          localStorage.setItem("domus-builder-onboarded", "1");
          setShowOnboarding(false);
        }} />
      ) : null}

      {/* Modal de Templates */}
      {showTemplates ? createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowTemplates(false)}>
          <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px", padding: "28px", width: "540px", maxWidth: "94vw", maxHeight: "88vh", overflowY: "auto", boxShadow: "0 24px 48px rgba(0,0,0,0.6)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#fff", margin: 0 }}>Escolher Template</h3>
              <button type="button" onClick={() => setShowTemplates(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "20px", marginTop: 0 }}>Aplica um layout completo — estrutura dos blocos, estilos, fonte e cores. Seu texto (títulos, destaques e rodapé) é preservado.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {BUILDER_TEMPLATES.map((tpl) => (
                <button key={tpl.id} type="button" onClick={() => applyTemplate(tpl)}
                  style={{ padding: "16px", borderRadius: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", textAlign: "left", transition: "border-color 0.2s, background 0.2s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)"; e.currentTarget.style.background = "rgba(99,102,241,0.08)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                >
                  <div style={{ marginBottom: "10px" }}><TemplateThumb tpl={tpl} /></div>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: "#fff", marginBottom: "3px" }}>{tpl.name}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{tpl.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      ) : null}

      {/* Modal de Histórico */}
      {showHistory ? createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowHistory(false)}>
          <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px", padding: "28px", width: "420px", maxWidth: "90vw", boxShadow: "0 24px 48px rgba(0,0,0,0.6)", maxHeight: "80vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexShrink: 0 }}>
              <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#fff", margin: 0 }}>Histórico de Versões</h3>
              <button type="button" onClick={() => setShowHistory(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            <button type="button" onClick={saveHistorySnapshotNow}
              style={{ padding: "10px 16px", borderRadius: "10px", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "var(--accent,#818cf8)", fontWeight: "600", fontSize: "13px", cursor: "pointer", marginBottom: "16px", flexShrink: 0 }}
            >
              + Salvar versão agora
            </button>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
              {historySnapshots.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "24px 0" }}>Nenhuma versão salva ainda. O histórico é preenchido automaticamente ao salvar.</p>
              ) : historySnapshots.map((snap) => (
                <div key={snap.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "600", color: "#fff" }}>{snap.label}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{snap.timestamp}</div>
                  </div>
                  <button type="button" onClick={() => restoreHistorySnapshot(snap)}
                    style={{ padding: "6px 12px", borderRadius: "7px", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)", color: "var(--accent,#818cf8)", fontSize: "11px", fontWeight: "600", cursor: "pointer", flexShrink: 0 }}
                  >
                    Restaurar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </div>
    </DragDropProvider>
  );
}
