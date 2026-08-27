import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  GraficoDeMovimento, GraficoDeFaturamento, GraficoDeFunil, GraficoDeOrigens,
} from "../src/components/Graficos.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   OS GRÁFICOS DO PAINEL.

   ── O QUE ESTES TESTES GUARDAM ──

   Gráfico não quebra: ele MENTE. Um `NaN` numa coordenada some do desenho sem
   erro no console, uma escala trocada faz o mês fraco parecer o mais forte, e
   série vazia vira uma linha rasteira que parece dado medido. Nada disso
   aparece num teste de "renderizou sem lançar".

   Por isso o que se afirma aqui é o CONTEÚDO do SVG — as coordenadas, a ordem
   das barras, a presença da frase de vazio — e não que o componente montou.

   O caso mais caro está no fim: `serie` toda zerada NÃO pode virar desenho.
   É a mesma regra do `null` no servidor (`painelGestor.js`), e a única que, se
   quebrar, faz a tela afirmar algo falso sobre o negócio de alguém.
   ──────────────────────────────────────────────────────────────────────────── */

const serieDe = (visitas, leads) =>
  visitas.map((v, i) => ({
    dia: `2026-08-${String(i + 1).padStart(2, "0")}`,
    visitas: v,
    leads: leads[i] ?? 0,
  }));

/* Nenhuma coordenada pode sair como NaN, Infinity ou undefined. O SVG aceita
   tudo isso calado — o traço simplesmente não aparece. */
function semCoordenadaPodre(html, oque) {
  assert.ok(!/NaN/.test(html), `${oque}: saiu NaN no SVG`);
  assert.ok(!/Infinity/.test(html), `${oque}: saiu Infinity no SVG`);
  assert.ok(!/undefined/.test(html), `${oque}: saiu undefined no SVG`);
}

/* ── Movimento ─────────────────────────────────────────────────────────────── */

test("movimento: desenha a área das visitas e barras para os interessados", () => {
  const html = renderToStaticMarkup(
    <GraficoDeMovimento serie={serieDe([10, 40, 25, 60], [1, 3, 2, 5])} />,
  );
  assert.match(html, /<path/, "faltou o caminho da área");
  assert.match(html, /<rect/, "os interessados precisam sair como barras");
  semCoordenadaPodre(html, "movimento");
});

test("movimento: as duas séries têm ESCALAS SEPARADAS", () => {
  /* O defeito que isto guarda: com escala compartilhada, 2500 visitas contra
     100 interessados achatavam a segunda série num traço colado no chão. Ela
     não mentia — não dizia nada, e ocupava lugar como se dissesse.

     A prova: com os interessados constantes em 1 e as visitas variando muito,
     a barra do dia de menos visita tem de ter a MESMA altura da barra do dia
     de mais visita. Só isso demonstra que a escala dos interessados não é
     derivada das visitas. */
  const html = renderToStaticMarkup(
    <GraficoDeMovimento serie={serieDe([5, 5000, 5, 5000], [1, 1, 1, 1])} />,
  );
  const alturas = [...html.matchAll(/<rect[^>]*height="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.equal(alturas.length, 4, "esperava uma barra por dia");
  assert.ok(
    alturas.every((h) => Math.abs(h - alturas[0]) < 0.01),
    `interessados iguais deveriam dar barras iguais; vieram ${JSON.stringify(alturas)}`,
  );
  assert.ok(alturas[0] > 0, "barra de valor 1 não pode ter altura zero");
});

test("movimento: série toda zerada vira FRASE, não gráfico", () => {
  const html = renderToStaticMarkup(
    <GraficoDeMovimento serie={serieDe([0, 0, 0], [0, 0, 0])} />,
  );
  assert.ok(!html.includes("<svg"), "zero não pode virar desenho — ausência não é zero");
  assert.match(html, /Nenhuma visita ou interessado/i);
});

test("movimento: série vazia não quebra", () => {
  const html = renderToStaticMarkup(<GraficoDeMovimento serie={[]} />);
  assert.match(html, /gr-vazio/);
  assert.ok(!html.includes("<svg"));
});

test("movimento: um dia só não produz divisão por zero", () => {
  // `i / (dados.length - 1)` com um ponto seria 0/0.
  const html = renderToStaticMarkup(<GraficoDeMovimento serie={serieDe([7], [2])} />);
  semCoordenadaPodre(html, "movimento de um dia");
});

/* ── Faturamento ───────────────────────────────────────────────────────────── */

test("faturamento: uma barra por mês, e o mês corrente é o destacado", () => {
  const meses = [
    { mes: "2026-06", faturamento: 900000, vendas: 1 },
    { mes: "2026-07", faturamento: 2260000, vendas: 3 },
    { mes: "2026-08", faturamento: 1850000, vendas: 2 },
  ];
  const html = renderToStaticMarkup(<GraficoDeFaturamento meses={meses} />);

  assert.equal((html.match(/gr-barra__trilho/g) || []).length, 3);
  /* O mês corrente ainda está em curso: pintá-lo igual aos fechados sugere que
     a comparação é justa, e ela não é. */
  assert.equal((html.match(/is-atual/g) || []).length, 1, "só o último mês é o atual");

  // A escala é compartilhada e o maior valor ocupa 100%.
  const alturas = [...html.matchAll(/height:\s*([\d.]+)%/g)].map((m) => Number(m[1]));
  assert.equal(Math.max(...alturas), 100);
  assert.ok(alturas[0] < alturas[1], "900 mil tem de sair menor que 2,26 milhões");
});

test("faturamento: valores em escala curta e legível", () => {
  const html = renderToStaticMarkup(
    <GraficoDeFaturamento meses={[{ mes: "2026-08", faturamento: 3100000, vendas: 4 }]} />,
  );
  assert.match(html, /3,1M/, "milhão sai abreviado com vírgula decimal");
  assert.match(html, /ago\/26/);
  assert.match(html, /4 vendas/);
});

test("faturamento: seis meses sem venda nenhuma viram frase", () => {
  const meses = ["03", "04", "05", "06", "07", "08"].map((m) => ({
    mes: `2026-${m}`, faturamento: 0, vendas: 0,
  }));
  const html = renderToStaticMarkup(<GraficoDeFaturamento meses={meses} />);
  assert.match(html, /Nenhuma venda registrada/i);
  assert.ok(!html.includes("gr-barra__trilho"));
});

/* ── Funil ─────────────────────────────────────────────────────────────────── */

test("funil: todos os estágios saem, INCLUSIVE os zerados", () => {
  /* Um funil que esconde as etapas vazias não é um funil, é um recorte — e o
     vazio é justamente a informação ("ninguém chega em Proposta"). */
  const funil = [
    { estagio: "NOVO", total: 22 },
    { estagio: "EM_ATENDIMENTO", total: 14 },
    { estagio: "VISITA", total: 0 },
    { estagio: "PROPOSTA", total: 0 },
    { estagio: "GANHO", total: 2 },
    { estagio: "PERDIDO", total: 16 },
  ];
  const html = renderToStaticMarkup(<GraficoDeFunil funil={funil} />);
  for (const rotulo of ["Novo", "Em atendimento", "Visita", "Proposta", "Ganho", "Perdido"]) {
    assert.ok(html.includes(rotulo), `faltou o estágio ${rotulo}`);
  }
});

test("funil: a porcentagem é sobre o TOTAL, e a barra sobre o maior", () => {
  const html = renderToStaticMarkup(
    <GraficoDeFunil funil={[{ estagio: "NOVO", total: 50 }, { estagio: "GANHO", total: 50 }]} />,
  );
  // Metade cada: 50% do total, e as duas barras cheias (ambas são o maior).
  assert.equal((html.match(/50%/g) || []).length >= 2, true);
});

test("funil: com `aoClicar` cada faixa vira botão; sem, não", () => {
  const dados = [{ estagio: "NOVO", total: 3 }];
  const comAcao = renderToStaticMarkup(<GraficoDeFunil funil={dados} aoClicar={() => {}} />);
  const semAcao = renderToStaticMarkup(<GraficoDeFunil funil={dados} />);
  assert.match(comAcao, /<button[^>]*gr-funil__linha/);
  assert.ok(!/<button/.test(semAcao), "sem destino não pode virar botão — clique que não faz nada");
});

test("funil sem nenhum interessado vira frase", () => {
  const zerado = ["NOVO", "GANHO"].map((estagio) => ({ estagio, total: 0 }));
  assert.match(renderToStaticMarkup(<GraficoDeFunil funil={zerado} />), /Nenhum interessado/i);
});

/* ── Origens ───────────────────────────────────────────────────────────────── */

test("origens: as fatias somam 100% da largura", () => {
  const html = renderToStaticMarkup(
    <GraficoDeOrigens origens={[
      { origem: "showcase", total: 40 },
      { origem: "ZAP", total: 40 },
      { origem: "OLX", total: 20 },
    ]} />,
  );
  const larguras = [...html.matchAll(/width:\s*([\d.]+)%/g)].map((m) => Number(m[1]));
  const soma = larguras.reduce((s, x) => s + x, 0);
  assert.ok(Math.abs(soma - 100) < 0.01, `as fatias somam ${soma}%, deveriam somar 100%`);
});

test("origens: o código do portal vira nome que a pessoa reconhece", () => {
  const html = renderToStaticMarkup(
    <GraficoDeOrigens origens={[{ origem: "showcase", total: 5 }, { origem: "ZAP", total: 2 }]} />,
  );
  assert.match(html, /Vitrine/);
  assert.match(html, /ZAP Imóveis/);
  assert.ok(!html.includes(">showcase<"), "o código cru não pode aparecer para o cliente");
});

test("origens: origem desconhecida é nomeada, não descartada", () => {
  /* `source` é texto livre e recebe o nome do portal na captação do Flow.
     Descartar o que não está no dicionário faria as fatias não somarem 100%. */
  const html = renderToStaticMarkup(
    <GraficoDeOrigens origens={[{ origem: "desconhecida", total: 3 }]} />,
  );
  assert.match(html, /Origem não informada/i);
});

test("origens vazias viram frase", () => {
  assert.match(renderToStaticMarkup(<GraficoDeOrigens origens={[]} />), /gr-vazio/);
  assert.match(
    renderToStaticMarkup(<GraficoDeOrigens origens={[{ origem: "x", total: 0 }]} />),
    /gr-vazio/,
  );
});

/* ── O que não pode acontecer em nenhum deles ──────────────────────────────── */

test("nenhum gráfico quebra com dado torto vindo do servidor", () => {
  /* `null`, `undefined` e string onde deveria haver número. O servidor não
     manda isso hoje — e um campo renomeado numa migração manda. */
  const tortos = [
    <GraficoDeMovimento key="a" serie={null} />,
    <GraficoDeMovimento key="b" serie={[{ dia: "2026-08-01" }, { dia: "2026-08-02" }]} />,
    <GraficoDeFaturamento key="c" meses={undefined} />,
    <GraficoDeFaturamento key="d" meses={[{ mes: "2026-08", faturamento: "1200", vendas: null }]} />,
    <GraficoDeFunil key="e" funil={null} />,
    <GraficoDeOrigens key="f" origens={null} />,
  ];
  for (const elemento of tortos) {
    const html = renderToStaticMarkup(elemento);
    semCoordenadaPodre(html, "dado torto");
  }
});
