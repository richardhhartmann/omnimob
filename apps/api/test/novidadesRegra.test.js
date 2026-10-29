import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chaveValida, normalizarNovidade, oQueVe } from "../src/services/novidades.js";

/* A regra das Novidades, sem banco. Os dois riscos: um conteúdo torto
   publicado para todos os clientes, e a novidade do Omniflow aparecendo para
   quem só contratou o Omnimob (ou a das Configurações para o corretor). */

const exemplo = JSON.parse(readFileSync(new URL("../../../docs/novidades/exemplo/conteudo.json", import.meta.url), "utf8"));

test("o exemplo da documentação é um conteúdo válido", () => {
  const c = normalizarNovidade(exemplo, "2026-11-03");
  assert.equal(c.mes, "2026-11-03");
  assert.ok(c.secoes.length > 0);
});

test("a chave é uma terça", () => {
  assert.equal(chaveValida("2026-11-03"), true);
  assert.equal(chaveValida("2026-11-04"), false);
  assert.equal(chaveValida("2026-02-31"), false);
  assert.equal(chaveValida("ontem"), false);
});

test("recusa com o motivo: texto longo, tipo, permissão e módulo desconhecidos", () => {
  const base = () => structuredClone(exemplo);
  const c1 = base(); c1.titulo = "x".repeat(61);
  assert.throws(() => normalizarNovidade(c1, "2026-11-03"), /passa de 60/);
  const c2 = base(); c2.secoes[0].itens[0].tipo = "lancamento";
  assert.throws(() => normalizarNovidade(c2, "2026-11-03"), /tipo inválido/);
  const c3 = base(); c3.secoes[0].itens[0].permissao = "apagarTudo";
  assert.throws(() => normalizarNovidade(c3, "2026-11-03"), /permissão desconhecida/);
  const c4 = base(); c4.secoes[0].itens[0].modulo = "OUTRO";
  assert.throws(() => normalizarNovidade(c4, "2026-11-03"), /módulo desconhecido/);
});

test("print só https; o resto é descartado", () => {
  const c = structuredClone(exemplo);
  c.secoes[0].itens[0].print = ["javascript:alert(1)", "https://res.cloudinary.com/x/a.png"];
  assert.equal(normalizarNovidade(c, "2026-11-03").secoes[0].itens[0].print, "https://res.cloudinary.com/x/a.png");
});

test("cada um vê só o que alcança: módulo contratado, porta do cargo e permissão", () => {
  const conteudo = {
    titulo: "t",
    secoes: [
      { id: "hub", itens: [{ id: "a", titulo: "Para todos" }, { id: "b", titulo: "Config", permissao: "verConfiguracoes" }] },
      { id: "flow", itens: [{ id: "c", titulo: "Funil", modulo: "FLOW" }] },
    ],
  };
  const soHub = { modulos: ["HUB"] };
  const comFlow = { modulos: ["HUB", "FLOW"] };
  const titulos = (c) => (c ? c.secoes.flatMap((s) => s.itens.map((i) => i.id)) : []);

  assert.deepEqual(titulos(oQueVe(conteudo, { tenant: soHub, cargo: { verConfiguracoes: true, acessarFlow: true } })), ["a", "b"]);
  assert.deepEqual(titulos(oQueVe(conteudo, { tenant: comFlow, cargo: { acessarFlow: false } })), ["a"]);
  assert.deepEqual(titulos(oQueVe(conteudo, { tenant: comFlow, cargo: { acessarFlow: true } })), ["a", "c"]);
  // Só o item do Flow, para quem não o alcança: nada a mostrar.
  assert.equal(oQueVe({ secoes: [conteudo.secoes[1]] }, { tenant: soHub, cargo: {} }), null);
});
