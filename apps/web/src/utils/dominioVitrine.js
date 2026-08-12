import { api } from "../api";

/* ────────────────────────────────────────────────────────────────────────────
   Descobre se esta aba está sendo servida no domínio de alguma imobiliária.

   Quando a vitrine vive em `imobiliaria.com.br`, a URL não carrega slug nenhum:
   o caminho é só "/". O host é a única pista de quem é aquela página, e é isso
   que esta função resolve — uma vez, na abertura.

   Os endereços da própria Omnimob são descartados sem ida à rede. Sem esse
   filtro, toda abertura do painel e da landing pagaria uma consulta para
   descobrir o óbvio, e em produção cada ida à API custa caro.
   ──────────────────────────────────────────────────────────────────────────── */

const DOMINIO_RAIZ = import.meta.env?.VITE_DOMINIO_RAIZ || "omnimob.app";

/* Subdomínios reservados: são endereços do produto, não de vitrine. A lista
   espelha `SLUGS_RESERVADOS` do backend, que impede um tenant de nascer com
   qualquer um destes slugs — sem essa simetria, `app.omnimob.app` procuraria
   uma imobiliária chamada "app". */
const RESERVADOS = new Set(["www", "api", "app", "admin", "painel", "static", "cdn", "mail"]);

const NOSSOS = [
  /^localhost$/,
  /^127\.0\.0\.1$/,
  /\.vercel\.app$/, // pré-visualizações de deploy
];

/**
 * O slug embutido no host, quando ele é um subdomínio de vitrine.
 * `imobiliaria.omnimob.app` → "imobiliaria" · `omnimob.app` → null
 *
 * Vale mais que a consulta por domínio próprio: o slug já está no endereço,
 * então não há ida à rede nenhuma para descobrir de quem é a página.
 */
export function slugDoSubdominio(host = window.location.hostname) {
  const h = String(host || "").toLowerCase();
  if (!h.endsWith(`.${DOMINIO_RAIZ}`)) return null;
  const rotulo = h.slice(0, -(DOMINIO_RAIZ.length + 1));
  // Só um nível: `a.b.omnimob.app` não é vitrine de ninguém.
  if (!rotulo || rotulo.includes(".") || RESERVADOS.has(rotulo)) return null;
  return rotulo;
}

export function ehDominioDaOmnimob(host = window.location.hostname) {
  const h = String(host || "").toLowerCase();
  if (h === DOMINIO_RAIZ) return true;
  if (NOSSOS.some((r) => r.test(h))) return true;
  // Subdomínio reservado (www, api…) também é endereço nosso, não vitrine.
  return h.endsWith(`.${DOMINIO_RAIZ}`) && slugDoSubdominio(h) === null;
}

/**
 * Devolve o slug do tenant dono deste endereço, ou null.
 *
 * Falha de rede devolve null de propósito: sem resposta, o app segue como
 * Omnimob (landing/login). É melhor mostrar a porta de entrada errada por um
 * instante do que travar a página numa tela de erro que o visitante — que só
 * queria ver imóveis — não tem como resolver.
 */
export async function slugDoDominioAtual() {
  const host = window.location.hostname;

  /* Subdomínio nosso responde na hora: o slug É o rótulo. Perguntar ao servidor
     algo que está escrito no endereço só adicionaria latência — e latência aqui
     atrasa a primeira pintura da vitrine. */
  const doSubdominio = slugDoSubdominio(host);
  if (doSubdominio) return doSubdominio;

  if (ehDominioDaOmnimob(host)) return null;
  try {
    const r = await api.slugPorDominio(host);
    return r?.slug || null;
  } catch {
    return null;
  }
}
