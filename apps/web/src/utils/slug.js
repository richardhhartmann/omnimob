/* ────────────────────────────────────────────────────────────────────────────
   Endereço da vitrine a partir do nome da imobiliária.

   Espelho de `apps/api/src/services/trialService.js` — a mesma função existe
   dos dois lados de propósito: aqui ela serve para MOSTRAR o endereço enquanto
   a pessoa digita (sem ida ao servidor a cada tecla), lá ela é a regra que
   grava. Se as duas divergirem, o visitante vê um endereço e recebe outro, por
   isso qualquer mexida em uma pede a mesma mexida na outra.
   ──────────────────────────────────────────────────────────────────────────── */

// Nomes que a Domus guarda para si (rotas do produto e da marca).
export const SLUGS_RESERVADOS = new Set([
  "admin", "api", "app", "www", "domus", "painel", "public", "static",
  "login", "vitrine", "suporte", "contato", "blog", "teste", "demo",
]);

export const SLUG_MIN = 2;

export function slugify(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // tira acentos separados pelo NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export const MOTIVO_SLUG = {
  curto: "Nome curto demais. Use pelo menos duas letras.",
  invalido: "Use letras ou números no nome da imobiliária.",
  reservado: "Este nome é reservado pela Domus. Escolha outro.",
  ocupado: "Este nome já está em uso por outra imobiliária. Escolha outro.",
};

/* O que dá para recusar sem perguntar ao servidor: tamanho, caracteres e nomes
   reservados. Devolve null quando só o banco pode responder — aí sim vale a
   ida à rede. */
export function motivoLocal(nome) {
  const bruto = String(nome || "").trim();
  const slug = slugify(bruto);
  if (!slug) return bruto ? "invalido" : "curto";
  if (slug.length < SLUG_MIN) return "curto";
  if (SLUGS_RESERVADOS.has(slug)) return "reservado";
  return null;
}
