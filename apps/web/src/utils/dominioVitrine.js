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

const NOSSOS = [
  /^localhost$/,
  /^127\.0\.0\.1$/,
  /^omnimob\.app$/,
  /^www\.omnimob\.app$/,
  /\.vercel\.app$/, // pré-visualizações de deploy
];

export function ehDominioDaOmnimob(host = window.location.hostname) {
  return NOSSOS.some((r) => r.test(String(host || "").toLowerCase()));
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
  if (ehDominioDaOmnimob(host)) return null;
  try {
    const r = await api.slugPorDominio(host);
    return r?.slug || null;
  } catch {
    return null;
  }
}
