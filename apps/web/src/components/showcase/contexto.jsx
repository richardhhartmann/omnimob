import { createContext, useContext } from "react";
import { Link } from "react-router-dom";

/* ────────────────────────────────────────────────────────────────────────────
   O contrato entre a vitrine e quem a está desenhando.

   Existe UMA implementação visual da vitrine. O editor e a página pública
   renderizam exatamente os mesmos componentes; o que muda entre os dois não é
   aparência, é COMPORTAMENTO:

     · público — o texto é texto, o link navega, o carrossel anda;
     · editor  — o mesmo texto é `contentEditable`, e o link não leva a lugar
       nenhum (sair do construtor no meio de uma edição seria perder o trabalho).

   Esse contexto é o único lugar onde essa diferença mora. Componente de vitrine
   nunca pergunta "estou no editor?" para escolher marcação — ele usa
   `ShowcaseTexto` e `ShowcaseLink`, e essas duas resolvem a diferença sozinhas.

   Por que contexto e não props: os textos editáveis estão a cinco ou seis
   níveis de profundidade (rodapé → coluna → parágrafo → span), e passar
   `aoEditar` por toda essa corrente seria exatamente o tipo de acoplamento que
   faz alguém, um dia, achar mais fácil escrever uma segunda versão do
   componente. É essa segunda versão que este arquivo existe para impedir.
   ──────────────────────────────────────────────────────────────────────────── */

const ContextoDaVitrine = createContext(null);

/**
 * @param modo       "public" | "editor"
 * @param aoEditar   (campo, html) => void — só no editor
 * @param tenantSlug para montar as rotas internas da vitrine
 */
export function VitrineProvider({ modo = "public", aoEditar, tenantSlug, children }) {
  return (
    <ContextoDaVitrine.Provider value={{ modo, aoEditar, tenantSlug }}>
      {children}
    </ContextoDaVitrine.Provider>
  );
}

export function useVitrine() {
  return useContext(ContextoDaVitrine) || { modo: "public", tenantSlug: "" };
}

/**
 * Texto da vitrine.
 *
 * No público sai como HTML estático; no editor, o MESMO elemento, com as mesmas
 * classes e o mesmo estilo, ganha `contentEditable`. Nenhuma tag a mais, nenhum
 * invólucro extra — se o editor precisasse de um `<div>` de apoio, a caixa
 * mudaria de tamanho e o WYSIWYG morreria aí.
 *
 * `campo` é a chave que a barra de formatação flutuante usa para saber onde
 * gravar o HTML depois de um `execCommand` (ver `BarraDeFormatacao`).
 */
export function ShowcaseTexto({
  as: Tag = "p",
  campo,
  html,
  umaLinha = false,
  className = "",
  style,
  /* Endereço que este texto vira no público — e-mail do rodapé, WhatsApp. No
     editor ele é omitido: o elemento continua sendo o mesmo `<a>`, com o mesmo
     estilo, mas sem destino. Um `<a>` sem `href` não navega e não é focável
     como link, que é exatamente o que se quer de um texto em edição. */
  hrefPublico,
  alvoExterno = false,
  ...resto
}) {
  const { modo, aoEditar } = useVitrine();
  const conteudo = { __html: html ?? "" };

  if (modo !== "editor" || !aoEditar) {
    return (
      <Tag
        className={className || undefined}
        style={style}
        href={hrefPublico}
        target={hrefPublico && alvoExterno ? "_blank" : undefined}
        rel={hrefPublico && alvoExterno ? "noreferrer" : undefined}
        dangerouslySetInnerHTML={conteudo}
        {...resto}
      />
    );
  }

  return (
    <Tag
      className={`${className} editable-inline`.trim()}
      data-rich-sync={campo}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      style={{ cursor: "text", ...style }}
      onBlur={(e) => aoEditar(campo, e.currentTarget.innerHTML)}
      onKeyDown={(e) => { if (umaLinha && e.key === "Enter") e.preventDefault(); }}
      dangerouslySetInnerHTML={conteudo}
      {...resto}
    />
  );
}

/**
 * Link interno da vitrine (rotas `/vitrine/...`).
 *
 * No editor vira um `<span>` com as mesmas classes e o mesmo estilo. Um `<a>`
 * desativado não serve: ele ainda arrasta consigo o `text-decoration` e o
 * `color` do navegador, e a diferença apareceria na tela.
 */
export function ShowcaseLink({ para, className, style, children, ...resto }) {
  const { modo } = useVitrine();
  if (modo === "editor") {
    return (
      <span className={className} style={style} {...resto}>
        {children}
      </span>
    );
  }
  return (
    <Link to={para} className={className} style={style} {...resto}>
      {children}
    </Link>
  );
}

/**
 * Link externo (WhatsApp, redes sociais, CTA do cliente). Mesma regra: no
 * editor o elemento continua sendo um `<a>` para herdar a estilização, mas sem
 * `href` — assim ele não navega e não abre aba nenhuma se alguém clicar.
 */
export function ShowcaseLinkExterno({ href, className, style, children, ...resto }) {
  const { modo } = useVitrine();
  const navegavel = modo !== "editor" && href;
  return (
    <a
      href={navegavel ? href : undefined}
      target={navegavel ? "_blank" : undefined}
      rel={navegavel ? "noreferrer" : undefined}
      className={className}
      style={style}
      onClick={navegavel ? undefined : (e) => e.preventDefault()}
      {...resto}
    >
      {children}
    </a>
  );
}
