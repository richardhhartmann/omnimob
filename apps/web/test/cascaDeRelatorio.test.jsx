import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { CascaDeRelatorio } from "../src/components/CascaDeRelatorio.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   Os quatro relatórios têm a mesma moldura.

   Gestão de Leads abria com título, subtítulo, quatro indicadores e uma barra
   de filtros. Os outros três começavam direto num painel de vidro, sem título
   nem contexto — trocar de cartão dentro de /relatorios parecia trocar de
   produto.

   Agora a moldura é `CascaDeRelatorio`, e inclusive Leads passa por ela. É o
   ponto: enquanto a referência for "igual ao de Leads" em vez de "o mesmo
   componente de Leads", as duas divergem na primeira mudança.
   ──────────────────────────────────────────────────────────────────────────── */

const RELATORIOS = [
  "src/pages/LeadsPage.jsx",
  "src/components/RelatorioMensal.jsx",
  "src/components/FunilVendas.jsx",
];

for (const arquivo of RELATORIOS) {
  test(`${arquivo} usa a casca compartilhada`, () => {
    const s = fs.readFileSync(arquivo, "utf8");
    assert.match(s, /<CascaDeRelatorio/, "deveria montar a moldura pelo componente");
    /* O sinal da moldura própria: um `<h1>` de título de página escrito aqui
       dentro. O conteúdo continua livre para ter os títulos que quiser. */
    assert.ok(
      !/<h1 style=\{\{ fontSize: "28px"/.test(s),
      "voltou a desenhar o próprio cabeçalho de página",
    );
  });
}

test("o cabeçalho sai com título e subtítulo", () => {
  const html = renderToStaticMarkup(
    <CascaDeRelatorio titulo="Funil de vendas" subtitulo="De visita a lead.">
      <p>conteúdo</p>
    </CascaDeRelatorio>,
  );
  assert.match(html, /Funil de vendas/);
  assert.match(html, /De visita a lead\./);
  assert.match(html, /conteúdo/);
});

test("sem métricas, faixa nenhuma — e não quatro zeros", () => {
  /* Mês sem movimento entrega lista vazia. Mostrar quatro caixas com 0 é a
     forma mais rápida de a tela mentir sobre não ter dado; a mesma regra de
     `dadosDaVitrine`: ausência não é zero. */
  const html = renderToStaticMarkup(
    <CascaDeRelatorio titulo="Relatório mensal" metricas={[]}><p>vazio</p></CascaDeRelatorio>,
  );
  assert.ok(!/skeleton-block/.test(html), "sem métricas não deve nem esqueletar a faixa");
});

test("carregando, o esqueleto ocupa a faixa que os números vão ocupar", () => {
  const metricas = [
    { label: "Visitas", value: 10, accent: "#6366f1", icon: null },
    { label: "Leads", value: 3, accent: "#0ea5e9", icon: null },
  ];
  const carregando = renderToStaticMarkup(
    <CascaDeRelatorio titulo="X" metricas={metricas} carregando><p>c</p></CascaDeRelatorio>,
  );
  assert.match(carregando, /skeleton-block/, "a faixa é reservada antes do dado chegar");
  assert.ok(!/Visitas/.test(carregando), "e o rótulo real só aparece com o dado");

  const pronto = renderToStaticMarkup(
    <CascaDeRelatorio titulo="X" metricas={metricas}><p>c</p></CascaDeRelatorio>,
  );
  assert.match(pronto, /Visitas/);
  assert.match(pronto, /Leads/);
});

test("a barra de filtros só existe quando há filtros", () => {
  const sem = renderToStaticMarkup(<CascaDeRelatorio titulo="X"><p>c</p></CascaDeRelatorio>);
  const com = renderToStaticMarkup(
    <CascaDeRelatorio titulo="X" filtros={<button type="button">Período</button>}><p>c</p></CascaDeRelatorio>,
  );
  assert.ok(!/Período/.test(sem));
  assert.match(com, /Período/);
  /* Um painel a mais que o outro: a barra é um `glass-panel` próprio. */
  assert.ok((com.match(/glass-panel/g) || []).length > (sem.match(/glass-panel/g) || []).length);
});

test("o erro aparece acima do conteúdo, sem escondê-lo", () => {
  const html = renderToStaticMarkup(
    <CascaDeRelatorio titulo="X" erro="Falha ao carregar"><p>conteúdo</p></CascaDeRelatorio>,
  );
  assert.match(html, /Falha ao carregar/);
  assert.match(html, /conteúdo/, "erro não substitui a tela");
  assert.ok(html.indexOf("Falha ao carregar") < html.indexOf("conteúdo"));
});
