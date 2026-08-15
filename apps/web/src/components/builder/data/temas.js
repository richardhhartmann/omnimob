/* Paletas, fontes e rótulos — dados puros, longe da tela. */

export const PRESET_THEMES = {
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

export const THEME_LABELS = {
  CLASSICO: "Clássico",
  PALETA_AZUL: "Azul",
  ESMERALDA: "Esmeralda",
  OCEANO: "Oceano",
  LUXO: "Luxo",
  CORAL: "Coral",
  NOITE: "Noite",
  NATUREZA: "Natureza",
  ROSE: "Rosé",
  CARVAO: "Carvão",
};

export const FONT_OPTIONS = [
  { label: "Padrão (Inter)",              value: "Inter" },
  { label: "Playfair Display — Elegante", value: "Playfair Display" },
  { label: "Montserrat — Moderno",        value: "Montserrat" },
  { label: "Raleway — Sofisticado",       value: "Raleway" },
  { label: "Lato — Limpo",                value: "Lato" },
  { label: "Merriweather — Clássico",     value: "Merriweather" },
  { label: "Poppins — Contemporâneo",     value: "Poppins" },
];

export const RANDOM_COLOR_PAIRS = [
  ["#6366f1", "#d4af37"], ["#2563eb", "#f8fafc"], ["#10b981", "#14b8a6"],
  ["#0ea5e9", "#38bdf8"], ["#7c3aed", "#d4af37"], ["#f97316", "#0ea5e9"],
  ["#1e3a5f", "#94a3b8"], ["#16a34a", "#ca8a04"], ["#e11d48", "#fda4af"],
  ["#334155", "#f59e0b"], ["#8b5cf6", "#06b6d4"], ["#ec4899", "#f59e0b"],
  ["#0d9488", "#e11d48"], ["#84cc16", "#7c3aed"], ["#dc2626", "#fbbf24"],
  ["#1d4ed8", "#a78bfa"], ["#059669", "#f59e0b"], ["#9333ea", "#22d3ee"],
];

export function normalizeHex(value, fallback) {
  if (typeof value !== "string") return fallback;
  const v = value.trim();
  return /^#([0-9a-fA-F]{6})$/.test(v) ? v : fallback;
}

/** Qual preset corresponde ao par de cores atual — ou "PERSONALIZADO". */
export function detectTheme(primaryColor, secondaryColor) {
  const primary = normalizeHex(primaryColor, PRESET_THEMES.CLASSICO.primaryColor).toLowerCase();
  const secondary = normalizeHex(secondaryColor, PRESET_THEMES.CLASSICO.secondaryColor).toLowerCase();
  for (const [key, value] of Object.entries(PRESET_THEMES)) {
    if (
      value.primaryColor.toLowerCase() === primary &&
      value.secondaryColor.toLowerCase() === secondary
    ) {
      return key;
    }
  }
  return "PERSONALIZADO";
}

/** Luminância aproximada de um hex, para decidir texto claro ou escuro. */
export function brilhoDaCor(cor) {
  if (!cor) return 255;
  let hex = String(cor).replace("#", "").trim();
  if (hex.length === 3) hex = hex.split("").map((x) => x + x).join("");
  if (hex.length !== 6) return 255;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
