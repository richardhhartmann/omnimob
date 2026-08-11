import { useEffect } from "react";

/* ────────────────────────────────────────────────────────────────────────────
   SEO por rota, num SPA.

   Todo o site é servido pelo mesmo `index.html`. Isso significa que título,
   descrição e canonical escritos lá valem para QUALQUER rota — a home, o login
   e a vitrine de cada imobiliária compartilham as mesmas tags. Duas
   consequências, e a segunda é séria:

     · toda vitrine apareceria na busca com o título da Omnimob, em vez do nome
       da imobiliária;
     · um `<link rel="canonical" href="https://omnimob.app/">` estático diria ao
       Google que /vitrine/qualquer-uma É a home — ou seja, pediria para
       desindexar as vitrines. É por isso que o canonical não está no HTML: ele
       precisa ser escrito por rota, e é o que este módulo faz.

   Funciona porque o Googlebot executa JavaScript e lê o DOM depois da
   renderização. Não substitui renderização no servidor: se um dia as vitrines
   precisarem aparecer para robôs que não executam JS (WhatsApp, LinkedIn e boa
   parte dos scrapers de preview), o caminho é pré-renderizar o HTML.
   ──────────────────────────────────────────────────────────────────────────── */

const SITE = "https://omnimob.app";
const IMAGEM_PADRAO = `${SITE}/og-image.png`;

/** Cria a tag se não existir e devolve, para depois só mexer no conteúdo. */
function tag(seletor, criar) {
  let el = document.head.querySelector(seletor);
  if (!el) {
    el = criar();
    document.head.appendChild(el);
  }
  return el;
}

function meta(nome, valor, propriedade = false) {
  if (!valor) return;
  const attr = propriedade ? "property" : "name";
  tag(`meta[${attr}="${nome}"]`, () => {
    const el = document.createElement("meta");
    el.setAttribute(attr, nome);
    return el;
  }).setAttribute("content", valor);
}

/**
 * Aplica as tags de SEO da rota atual.
 *
 * @param {object}  o
 * @param {string}  o.titulo     — vira <title> e og:title
 * @param {string}  o.descricao  — meta description e og:description
 * @param {string}  o.caminho    — caminho absoluto da rota ("/", "/vitrine/x")
 * @param {string} [o.imagem]    — URL absoluta; cai na arte padrão da marca
 * @param {string} [o.tipo]      — og:type ("website" na home, "article" etc.)
 * @param {boolean}[o.indexavel] — false marca noindex (telas privadas)
 */
export function useSeo({ titulo, descricao, caminho, imagem, tipo = "website", indexavel = true }) {
  useEffect(() => {
    // Enquanto os dados da página não chegaram, não sobrescreve o que já está
    // no HTML: um título vazio piscando é pior que o genérico.
    if (!titulo) return;

    const url = `${SITE}${caminho || "/"}`;
    const arte = imagem || IMAGEM_PADRAO;

    document.title = titulo;
    meta("description", descricao);
    meta("robots", indexavel ? "index,follow" : "noindex,nofollow");

    tag('link[rel="canonical"]', () => {
      const el = document.createElement("link");
      el.setAttribute("rel", "canonical");
      return el;
    }).setAttribute("href", url);

    meta("og:title", titulo, true);
    meta("og:description", descricao, true);
    meta("og:url", url, true);
    meta("og:image", arte, true);
    meta("og:type", tipo, true);
    meta("og:site_name", "Omnimob", true);
    meta("og:locale", "pt_BR", true);

    meta("twitter:card", "summary_large_image");
    meta("twitter:title", titulo);
    meta("twitter:description", descricao);
    meta("twitter:image", arte);
  }, [titulo, descricao, caminho, imagem, tipo, indexavel]);
}

export { SITE, IMAGEM_PADRAO };
