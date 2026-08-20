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

function desenhar(no, modo, dados) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <VitrineProvider modo={modo} aoEditar={() => {}} tenantSlug="imobiliaria-teste" dados={dados}>
        {no}
      </VitrineProvider>
    </MemoryRouter>
  );
}

function exigirParidade(no, nome, dados) {
  const publico = semAfordanciasDeEdicao(desenhar(no, "public", dados));
  const editor = semAfordanciasDeEdicao(desenhar(no, "editor", dados));
  assert.equal(editor, publico, `${nome}: o editor desenha algo diferente da vitrine publicada`);
}

/* ── Os dados REAIS da imobiliária ───────────────────────────────────────────
   O segundo caminho de cada widget, e o que a maioria das vitrines vai usar:
   com este bloco presente, Localização desenha um mapa, Equipe lista os
   corretores do banco, Números conta imóveis e Regiões vira uma fila de chips
   que filtram a grade.

   Sem um teste aqui, a paridade estaria verificada só no caminho de fallback —
   justamente o que o cliente NÃO vê. E a divergência tem onde nascer: o modo
   real troca `ShowcaseTexto` por texto simples no bloco de Números, e chip de
   região por `<button>` em vez de `<a>`. Se um desses passar a depender do
   modo, é aqui que aparece.
   ────────────────────────────────────────────────────────────────────────── */
const DADOS_REAIS = {
  endereco: {
    logradouro: "Avenida Paulista, 1000",
    cidade: "São Paulo",
    estado: "SP",
    cep: "01310-100",
    completo: "Avenida Paulista, 1000, São Paulo, SP — 01310100",
  },
  contato: { whatsapp: "5511999999999", telefone: "1133334444", email: "contato@centro.com", creci: "12345" },
  horarios: [
    { dias: "Segunda a sexta", abre: "09:00", fecha: "18:00", fechado: false },
    { dias: "Sábado", abre: "09:00", fecha: "13:00", fechado: false },
    { dias: "Domingo", abre: "", fecha: "", fechado: true },
  ],
  /* Os nomes NÃO podem coincidir com os de `DADOS_EQUIPE_PADRAO` (Ana Souza,
     João Lima, Marina Alves). A primeira versão deste bloco usava "Marina
     Alves" e a asserção de fallback passava por acidente nos dois caminhos —
     um teste que não distinguia o que existe para distinguir. */
  equipe: [
    { id: "u1", nome: "Beatriz Nogueira", cargo: "Corretora", creci: "CRECI 12345", whatsapp: "5511988887777", foto: "" },
    { id: "u2", nome: "Otávio Ribeiro", cargo: "Especialista em locação", creci: "", whatsapp: "", foto: "" },
  ],
  numeros: { imoveisAtivos: 24, vendas: 8, anosDeMercado: 12, cidadesAtendidas: 3 },
  regioes: [
    { nome: "Centro", cidade: "São Paulo", total: 9 },
    { nome: "Pinheiros", cidade: "São Paulo", total: 5 },
  ],
  filtros: {
    tipos: ["Apartamento", "Casa"],
    cidades: ["São Paulo", "Campinas"],
    bairros: [{ nome: "Centro", cidade: "São Paulo" }],
    contratos: ["VENDA", "LOCACAO"],
    precoMin: 250000,
    precoMax: 1800000,
  },
  redes: { whatsapp: "https://wa.me/5511999999999", facebook: "https://facebook.com/123", facebookNome: "Centro", instagram: "" },
};

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

  test(`widget "${tipo}" desenha igual nos dois modos com dados reais`, () => {
    exigirParidade(
      <ShowcaseWidget widget={widgetDeTeste(tipo)} />,
      `widget ${tipo} (dados reais)`,
      DADOS_REAIS,
    );
  });
}

/* Os dados reais precisam CHEGAR na peça — um widget que ignorasse o bloco
   passaria nos dois testes de paridade acima sem desenhar nada de novo, porque
   paridade só compara os dois modos entre si. */
test("com dados reais, os widgets mostram o que veio do banco", () => {
  const html = desenhar(<ShowcaseWidget widget={widgetDeTeste("team")} />, "public", DADOS_REAIS);
  assert.match(html, /Beatriz Nogueira/, "equipe: o corretor do banco não apareceu");
  assert.doesNotMatch(html, /Ana Souza/, "equipe: o nome de exemplo sobreviveu aos dados reais");

  const mapa = desenhar(<ShowcaseWidget widget={widgetDeTeste("map")} />, "public", DADOS_REAIS);
  assert.match(mapa, /maps\.google\.com/, "localização: o mapa não foi embutido");
  assert.match(mapa, /Avenida Paulista/, "localização: o endereço do cadastro não apareceu");

  const numeros = desenhar(<ShowcaseWidget widget={widgetDeTeste("stats")} />, "public", DADOS_REAIS);
  assert.match(numeros, /24/, "números: a contagem de imóveis não apareceu");
  assert.doesNotMatch(numeros, /200\+/, "números: o valor inventado sobreviveu aos dados reais");

  const horas = desenhar(<ShowcaseWidget widget={widgetDeTeste("hours")} />, "public", DADOS_REAIS);
  assert.match(horas, /Segunda a sexta/, "horários: a faixa do cadastro não apareceu");
});

/* A sobrescrita manual: quem desliga a fonte real no inspetor recupera o
   conteúdo que digitou, e o dado do banco para de mandar. */
test("com `usarDadosReais: false`, a peça volta ao conteúdo digitado", () => {
  const widget = { ...widgetDeTeste("team"), usarDadosReais: false };
  const html = desenhar(<ShowcaseWidget widget={widget} />, "public", DADOS_REAIS);
  assert.doesNotMatch(html, /Beatriz Nogueira/, "a fonte real continuou mandando mesmo desligada");
  assert.match(html, /Ana Souza/, "o conteúdo digitado não voltou");
});

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
