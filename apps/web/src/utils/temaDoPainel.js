/* ────────────────────────────────────────────────────────────────────────────
   O tema do PAINEL — e só dele.

   ── AS TRÊS REGRAS ──

   1. O tema do painel não é o tema da vitrine. Uma imobiliária pode trabalhar
      num painel claro e publicar uma vitrine escura; são duas perguntas
      diferentes, feitas por pessoas diferentes, para públicos diferentes.

   2. A preferência da PESSOA ganha da configuração da imobiliária — mas só se
      ela tiver escolhido. `null` significa "nunca opinei", e é essa nulidade
      que faz o administrador conseguir definir um padrão sem passar por cima de
      quem já decidiu.

   3. "auto" é um valor GRAVADO, não um atalho. Quem escolhe automático continua
      espelhando o sistema operacional a cada carga — inclusive quando o sistema
      muda de tema no meio da sessão.

   ── ONDE O TEMA SE APLICA ──

   No `main-content`, não no `ds-side`. A barra lateral é a moldura do produto e
   mantém a identidade escura em qualquer tema; o conteúdo é onde a pessoa
   trabalha. Misturar os dois faria o painel claro perder a âncora visual que o
   identifica como Omnimob.
   ──────────────────────────────────────────────────────────────────────────── */

export const TEMAS = [
  { id: "claro", rotulo: "Claro" },
  { id: "escuro", rotulo: "Escuro" },
  { id: "auto", rotulo: "Automático", nota: "Segue o tema do seu sistema" },
];

const VALIDOS = new Set(TEMAS.map((t) => t.id));

export function temaValido(valor) {
  return VALIDOS.has(String(valor || ""));
}

/**
 * Qual tema vale para esta sessão.
 * @param {string|null} doUsuario  `Usuario.temaPainel` — null = nunca escolheu
 * @param {string|null} daImobiliaria `Tenant.temaImobiliaria`
 * @returns {"claro"|"escuro"|"auto"}
 */
export function temaEscolhido(doUsuario, daImobiliaria) {
  if (temaValido(doUsuario)) return doUsuario;
  if (temaValido(daImobiliaria)) return daImobiliaria;
  // O produto nasceu escuro; na dúvida, não troca a tela de ninguém.
  return "escuro";
}

/** O que a tela DESENHA. Resolve o "auto" contra o sistema operacional. */
export function temaEfetivo(escolhido) {
  if (escolhido !== "auto") return escolhido === "claro" ? "claro" : "escuro";
  if (typeof window === "undefined" || !window.matchMedia) return "escuro";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "claro" : "escuro";
}

/**
 * Observa a troca de tema do sistema operacional.
 *
 * Só faz sentido com "auto": nos outros dois a escolha é explícita e o sistema
 * não manda. Devolve a função de desinscrição.
 */
export function observarSistema(escolhido, aoMudar) {
  if (escolhido !== "auto" || typeof window === "undefined" || !window.matchMedia) return () => {};
  const consulta = window.matchMedia("(prefers-color-scheme: light)");
  const ouvinte = (e) => aoMudar(e.matches ? "claro" : "escuro");
  /* `addEventListener` com fallback para `addListener`: o segundo está
     obsoleto, e é o único que o Safari antigo entende. Uma imobiliária com um
     iPad velho na recepção é um caso real. */
  if (consulta.addEventListener) consulta.addEventListener("change", ouvinte);
  else consulta.addListener(ouvinte);
  return () => {
    if (consulta.removeEventListener) consulta.removeEventListener("change", ouvinte);
    else consulta.removeListener(ouvinte);
  };
}
