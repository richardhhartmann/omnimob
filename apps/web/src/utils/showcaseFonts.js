// Helpers de runtime compartilhados entre as páginas públicas da vitrine, pra que
// o header/estilo fiquem consistentes ao navegar entre elas.

// Fontes do Google usadas nas vitrines. Carregadas UMA vez e mantidas no <head>
// (sem remover no unmount), pra qualquer página da vitrine renderizar igual.
const SHOWCASE_FONT_FAMILIES = [
  "Inter", "Playfair+Display", "Montserrat", "Raleway", "Lato", "Merriweather", "Poppins",
];
const FONTS_LINK_ID = "showcase-google-fonts";

export function loadShowcaseFonts() {
  if (typeof document === "undefined") return;
  if (document.getElementById(FONTS_LINK_ID)) return; // já carregado
  const link = document.createElement("link");
  link.id = FONTS_LINK_ID;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${SHOWCASE_FONT_FAMILIES.join("&family=")}&display=swap`;
  document.head.appendChild(link);
}

// Cache do último tenant carregado (por slug). Evita o "flash" da marca (nome,
// logo, cores) ao navegar entre páginas da mesma vitrine: o header já monta com
// os dados certos e o fetch só confirma/atualiza em seguida.
let _tenantCache = { slug: null, tenant: null };

export function getCachedTenant(slug) {
  return slug && _tenantCache.slug === slug ? _tenantCache.tenant : null;
}

export function setCachedTenant(slug, tenant) {
  if (slug && tenant) _tenantCache = { slug, tenant };
}
