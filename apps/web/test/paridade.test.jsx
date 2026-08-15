import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

import { VitrineProvider } from "../src/components/showcase/contexto.jsx";
import { ShowcaseWidget, TIPOS_DE_WIDGET } from "../src/components/showcase/ShowcaseWidget.jsx";
import { ShowcaseHero } from "../src/components/showcase/ShowcaseHero.jsx";
import { ShowcaseHighlights } from "../src/components/showcase/ShowcaseHighlights.jsx";
import { ShowcaseFooter } from "../src/components/showcase/ShowcaseFooter.jsx";
import { ShowcasePropertyCard } from "../src/components/showcase/ShowcasePropertyCard.jsx";
import { normalizeShowcaseConfig } from "../src/utils/showcaseConfig.js";

/* ────────────────────────────────────────────────────────────────────────────
   O teste de paridade: WYSIWYG virando regra verificável.

   A garantia principal contra divergência é arquitetural — existe UM componente
   por elemento da vitrine, então editor e público não têm como discordar. Este
   teste protege a outra metade: que o modo de edição não altere a MARCAÇÃO.

   Renderiza cada peça duas vezes, uma em cada modo, e exige HTML idêntico
   depois de remover as afordâncias de edição — `contenteditable`, a classe de
   realce, a chave da barra de formatação e o `cursor: text`. Se alguém
   acrescentar no editor um invólucro, um padding ou um rótulo que a página
   publicada não tem, o diff aparece aqui.
   ──────────────────────────────────────────────────────────────────────────── */

/** Tira do HTML tudo que é afordância de edição — e só isso. */
function semAfordanciasDeEdicao(html) {
  return html
    .replace(/ contenteditable="true"/g, "")
    .replace(/ spellcheck="false"/g, "")
    .replace(/ data-rich-sync="[^"]*"/g, "")
    .replace(/ class="editable-inline"/g, "")
    .replace(/(class="[^"]*?) ?editable-inline ?([^"]*")/g, "$1$2")
    .replace(/ class=""/g, "")
    .replace(/style="cursor:text"/g, "")
    .replace(/style="cursor:text;/g, 'style="')
    .replace(/ style=""/g, "")
    /* Destinos de link. A diferença é de COMPORTAMENTO, não de aparência: no
       editor nada navega, para ninguém sair do construtor no meio de uma
       edição. Que o público realmente tenha destino é verificado à parte, no
       teste "links navegam na vitrine e não navegam no editor". */
    .replace(/ href="[^"]*"/g, "")
    .replace(/ target="[^"]*"/g, "")
    .replace(/ rel="[^"]*"/g, "")
    // Sobra de espaço deixada pelos atributos removidos: `<h2 >` vira `<h2>`.
    // Aplicado dos dois lados, então não mascara diferença nenhuma.
    .replace(/\s+>/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function desenhar(no, modo) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <VitrineProvider modo={modo} aoEditar={() => {}} tenantSlug="imobiliaria-teste">
        {no}
      </VitrineProvider>
    </MemoryRouter>
  );
}

function exigirParidade(no, nome) {
  const publico = semAfordanciasDeEdicao(desenhar(no, "public"));
  const editor = semAfordanciasDeEdicao(desenhar(no, "editor"));
  assert.equal(editor, publico, `${nome}: o editor desenha algo diferente da vitrine publicada`);
}

const TENANT = {
  name: "Imobiliária Centro",
  slug: "imobiliaria-centro",
  primaryColor: "#6366f1",
  secondaryColor: "#d4af37",
  email: "contato@centro.com",
  whatsapp: "5511999999999",
  creci: "12345",
  cidade: "São Paulo",
  description: "Descrição da imobiliária.",
  showcaseHeadline: "Título da vitrine",
  showcaseSubheadline: "Subtítulo da vitrine",
};

function widgetDeTeste(tipo) {
  return normalizeShowcaseConfig({
    widgets: [{
      id: "w-teste",
      type: tipo,
      title: "Título do widget",
      content: "200+|Imóveis vendidos|15 anos|De experiência|4.9|Avaliação",
      ctaLabel: "Falar no WhatsApp",
      ctaUrl: "https://wa.me/5511999999999",
      backgroundColor: "#111827",
      color: "#f8fafc",
    }],
  }).widgets[0];
}

test("todo tipo da biblioteca tem renderizador compartilhado", () => {
  // Se um tipo entrar na biblioteca sem renderizador, ele cairia no desenho
  // genérico sem ninguém notar — que é como `faq` e `hours` ficaram anos
  // parecendo um bloco de texto solto.
  const esperados = ["text", "cta", "divider", "faq", "note", "stats", "testimonial", "hours", "map", "social"];
  for (const tipo of esperados) {
    assert.ok(TIPOS_DE_WIDGET.includes(tipo), `tipo "${tipo}" sem renderizador próprio`);
  }
});

for (const tipo of TIPOS_DE_WIDGET) {
  test(`widget "${tipo}" desenha igual no editor e na vitrine`, () => {
    exigirParidade(<ShowcaseWidget widget={widgetDeTeste(tipo)} />, `widget ${tipo}`);
  });
}

test("hero desenha igual nos dois modos", () => {
  const cfg = normalizeShowcaseConfig(null);
  exigirParidade(<ShowcaseHero tenant={TENANT} blockStyles={cfg.blockStyles} />, "hero");
});

test("destaques desenham igual nos dois modos", () => {
  const cfg = normalizeShowcaseConfig(null);
  exigirParidade(<ShowcaseHighlights config={cfg} blockStyles={cfg.blockStyles} />, "destaques");
});

test("rodapé desenha igual nos dois modos", () => {
  const cfg = normalizeShowcaseConfig(null);
  exigirParidade(
    <ShowcaseFooter tenant={TENANT} config={cfg} blockStyles={cfg.blockStyles} whatsappHref="https://wa.me/55" />,
    "rodapé"
  );
});

test("links navegam na vitrine e não navegam no editor", () => {
  const cta = <ShowcaseWidget widget={widgetDeTeste("cta")} />;
  assert.match(desenhar(cta, "public"), /href="https:\/\/wa\.me\/5511999999999"/, "a vitrine precisa levar ao destino");
  assert.doesNotMatch(desenhar(cta, "editor"), /href=/, "no editor nenhum link pode navegar");

  const cartao = <ShowcasePropertyCard property={{ id: "p1", title: "T", price: 1, images: [] }} tenantSlug="x" />;
  assert.match(desenhar(cartao, "public"), /<a[^>]*href="\/vitrine\/x\/imovel\/p1"/, "o cartão precisa abrir o imóvel");
  assert.doesNotMatch(desenhar(cartao, "editor"), /href=/, "no editor o cartão não sai do construtor");
});

test("cartão de imóvel desenha igual; só a navegação muda", () => {
  const imovel = {
    id: "p1",
    title: "Apartamento no Centro",
    price: 750000,
    neighborhood: "Centro",
    city: "São Paulo",
    state: "SP",
    description: "Ótima localização.",
    squareFootage: 90,
    bedrooms: 3,
    suites: 1,
    parkingSpots: 2,
    tipoContrato: "VENDA",
    aceitaPermuta: true,
    images: [{ url: "/a.jpg" }, { url: "/b.jpg" }],
  };
  const no = <ShowcasePropertyCard property={imovel} tenantSlug="imobiliaria-centro" carouselIndex={0} />;

  /* O invólucro do cartão é um `<a>` na vitrine e um `<span>` no editor — não é
     estilo, é navegação: clicar num imóvel no meio de uma edição levaria a
     pessoa para fora do construtor. Tudo DENTRO do invólucro tem de bater. */
  const miolo = (html) => {
    const limpo = semAfordanciasDeEdicao(html);
    const i = limpo.indexOf("<article");
    const f = limpo.lastIndexOf("</article>");
    return limpo.slice(i, f);
  };
  assert.equal(miolo(desenhar(no, "editor")), miolo(desenhar(no, "public")), "cartão de imóvel divergiu");
});
