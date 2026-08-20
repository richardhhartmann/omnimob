import { createContext, useContext, useMemo, useState } from "react";
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
 * @param dados      o bloco de dados REAIS da imobiliária (ver abaixo)
 */
export function VitrineProvider({ modo = "public", aoEditar, tenantSlug, dados, children }) {
  /* ── O filtro que os widgets aplicam à grade ──────────────────────────────
     Mora aqui, e não em cada página, porque quem ESCREVE nele (a busca, os
     chips de região) e quem LÊ (a grade de imóveis) são peças irmãs, a vários
     níveis de distância uma da outra dentro do renderizador compartilhado.

     No editor ele nasce e morre sem efeito: o `aplicar` é um no-op. Filtrar a
     grade da prancheta enquanto alguém desenha a página esconderia imóveis do
     canvas e a pessoa acharia que perdeu o acervo — e sair do modo de edição
     para desfazer isso é exatamente o tipo de armadilha que o construtor não
     pode ter. Diferença de COMPORTAMENTO, no único arquivo que tem o direito
     de ter uma. */
  const [filtro, setFiltro] = useState(null);
  const ehEditor = modo === "editor";

  /* Memo porque este valor desce para dezenas de peças: um objeto novo a cada
     quadro do arrasto rerenderizaria a página inteira junto com a peça que se
     move — que é exatamente o que o gesto sem tremer existe para evitar. */
  const valor = useMemo(
    () => ({
      modo,
      aoEditar,
      tenantSlug,
      dados: dados || null,
      filtro: ehEditor ? null : filtro,
      aplicarFiltro: ehEditor ? () => {} : setFiltro,
    }),
    [modo, aoEditar, tenantSlug, dados, filtro, ehEditor],
  );
  return <ContextoDaVitrine.Provider value={valor}>{children}</ContextoDaVitrine.Provider>;
}

/* ── O filtro da vitrine ─────────────────────────────────────────────────────
   `{ regiao?, tipo?, contrato? }` — ou `null` para "mostrando tudo".

   Filtrar acontece NA PÁGINA, sem ida ao servidor: a vitrine já carregou o
   acervo inteiro para desenhar a grade, e uma requisição por clique de chip
   seria uma espera para reordenar dados que já estão na memória do navegador.
   ────────────────────────────────────────────────────────────────────────── */
export function useFiltroDaVitrine() {
  const { filtro, aplicarFiltro } = useVitrine();
  return { filtro: filtro || null, aplicarFiltro: aplicarFiltro || (() => {}) };
}

/** Um imóvel passa pelo filtro em vigor? Regra única, lida pela grade. */
export function imovelPassaNoFiltro(imovel, filtro) {
  if (!filtro) return true;
  const igual = (a, b) =>
    String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
  /* Região casa com BAIRRO ou CIDADE, porque foi assim que ela entrou na lista:
     o serviço usa o bairro quando existe e cai na cidade quando não existe.
     Comparar só com o bairro faria o chip de uma cidade inteira não achar nada. */
  if (filtro.regiao && !igual(imovel.neighborhood, filtro.regiao) && !igual(imovel.city, filtro.regiao)) return false;
  if (filtro.tipo && !igual(imovel.tipoImovel?.descricao || imovel.propertyType, filtro.tipo)) return false;
  if (filtro.contrato && !igual(imovel.tipoContrato, filtro.contrato)) return false;
  return true;
}

export function useVitrine() {
  return useContext(ContextoDaVitrine) || { modo: "public", tenantSlug: "", dados: null };
}

/* ────────────────────────────────────────────────────────────────────────────
   Os dados REAIS da imobiliária, e a regra de quem manda.

   Os widgets nasceram com o conteúdo digitado à mão: a equipe era "Ana Souza,
   João Lima, Marina Alves" para toda imobiliária que arrastasse a peça, e o
   endereço do mapa era "Rua das Flores, 123". Agora o servidor manda o que é
   verdade (`GET /public/:slug` → `vitrine`), e cada peça lê daqui.

   ── A REGRA: dado real é o PADRÃO; o texto digitado é uma SOBRESCRITA. ──

   Não o contrário. Se o manual tivesse prioridade, toda imobiliária que
   arrastasse a peça herdaria os nomes de exemplo — que é o defeito de hoje — e
   só sairia dele apagando campo por campo. Com esta ordem, arrastar a peça já
   traz a equipe de verdade, e quem quiser escrever à mão desliga a fonte real
   no inspetor.

   `usarDadosReais` mora no próprio widget e começa indefinido, que conta como
   ligado. Widget gravado antes desta mudança continua com o texto que tinha
   até alguém abrir o inspetor — e é o que se quer: ninguém teve a página
   trocada embaixo do pé por causa de um deploy.
   ──────────────────────────────────────────────────────────────────────────── */

/** O bloco de dados reais, ou `null` quando o servidor não mandou. */
export function useDadosDaVitrine() {
  return useVitrine().dados;
}

/**
 * A peça deve usar a fonte real?
 * Falso quando o cliente desligou no inspetor, ou quando não há dado real.
 * @param {object} widget
 * @param {*} valorReal o que a fonte real ofereceu para esta peça
 */
export function usaFonteReal(widget, valorReal) {
  if (widget?.usarDadosReais === false) return false;
  if (Array.isArray(valorReal)) return valorReal.length > 0;
  return Boolean(valorReal);
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
