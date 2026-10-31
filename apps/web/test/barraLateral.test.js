/* A barra lateral personalizada (utils/barraLateral.js): o que a seção mostra,
   e as operações do editor. Porte dos testes do VYA, com a diferença daqui: o
   pai também é uma tela (Gerenciar Imóveis abre a lista). */
import test from "node:test";
import assert from "node:assert/strict";
import {
  MAXIMO_SECOES, adicionarSecao, barraDe, contarNaSecao, filtrarPorSecao, folhasDe, marcar, moverSecao,
  nomeLimpo, removerSecao, renomearSecao, secaoAtiva,
} from "../src/utils/barraLateral.js";

const item = (key, subitens) => ({ key, label: key, ...(subitens ? { subitens: subitens.map((k) => ({ key: k, label: k })) } : {}) });
const GRUPOS = [
  { itens: [item("dashboard")] },
  { label: "IMÓVEIS", itens: [item("imoveis-novo", ["imovel-form", "imovel-tipos"]), item("imoveis-lista")] },
  { label: "RELACIONAMENTO", itens: [item("leads", ["rel-mensal", "rel-funil"]), item("clientes")] },
];
const secao = (itens) => ({ id: "s-1", nome: "Favoritos", itens });

test("sem seção, a barra inteira", () => {
  assert.equal(filtrarPorSecao(GRUPOS, null), GRUPOS);
});

test("a seção mostra só o que foi escolhido, com o pai em volta do subitem", () => {
  const r = filtrarPorSecao(GRUPOS, secao(["rel-mensal", "imoveis-lista"]));
  assert.deepEqual(r.map((g) => g.label), ["IMÓVEIS", "RELACIONAMENTO"]);
  assert.deepEqual(r[0].itens.map((i) => i.key), ["imoveis-lista"]);
  assert.deepEqual(r[1].itens[0].subitens.map((s) => s.key), ["rel-mensal"]);
});

test("escolher só o pai traz a tela dele, sem os subitens", () => {
  const r = filtrarPorSecao(GRUPOS, secao(["imoveis-novo"]));
  assert.equal(r.length, 1);
  assert.equal(r[0].itens[0].key, "imoveis-novo");
  assert.deepEqual(r[0].itens[0].subitens, []);
});

test("chave que o cargo não alcança (fora da navegação) não reabre nada", () => {
  assert.deepEqual(filtrarPorSecao(GRUPOS, secao(["usuarios", "flow-funil"])), []);
});

test("folhas: o pai e os filhos; marcar o pai marca todos, desmarcar tira todos", () => {
  const pai = GRUPOS[1].itens[0];
  assert.deepEqual(folhasDe(pai), ["imoveis-novo", "imovel-form", "imovel-tipos"]);
  let b = { secoes: [secao([])], ativa: "s-1" };
  b = marcar(b, "s-1", folhasDe(pai), true);
  assert.deepEqual(b.secoes[0].itens, ["imoveis-novo", "imovel-form", "imovel-tipos"]);
  b = marcar(b, "s-1", ["imovel-form"], false);
  assert.deepEqual(b.secoes[0].itens, ["imoveis-novo", "imovel-tipos"]);
  assert.equal(contarNaSecao(GRUPOS, b.secoes[0]), 2);
});

test("criar, renomear, mover e apagar seções", () => {
  let b = { secoes: [], ativa: null };
  const um = adicionarSecao(b, "Nova seção", () => 0.1); b = um.barra;
  const dois = adicionarSecao(b, "Nova seção", () => 0.2); b = dois.barra;
  assert.deepEqual(b.secoes.map((s) => s.nome), ["Nova seção", "Nova seção 2"]);
  b = renomearSecao(b, um.id, "   Meus   favoritos  ");
  assert.equal(b.secoes[0].nome, "Meus favoritos");
  assert.equal(renomearSecao(b, um.id, "   "), b, "nome vazio não troca");
  b = moverSecao(b, dois.id, -1);
  assert.equal(b.secoes[0].id, dois.id);
  b = { ...b, ativa: dois.id };
  b = removerSecao(b, dois.id);
  assert.equal(b.ativa, null, "apagar a ativa volta à barra inteira");
  assert.equal(b.secoes.length, 1);
});

test("teto de seções", () => {
  let b = { secoes: [], ativa: null };
  for (let i = 0; i < MAXIMO_SECOES; i++) b = adicionarSecao(b).barra;
  assert.equal(adicionarSecao(b), null);
});

test("o que vem da sessão: lixo vira a barra vazia; ativa órfã vira a barra inteira", () => {
  assert.deepEqual(barraDe(null), { secoes: [], ativa: null });
  assert.deepEqual(barraDe("x"), { secoes: [], ativa: null });
  const b = barraDe({ secoes: [secao(["a"]), { id: 1 }], ativa: "s-zz" });
  assert.equal(b.secoes.length, 1);
  assert.equal(b.ativa, null);
  assert.equal(secaoAtiva(barraDe({ secoes: [secao([])], ativa: "s-1" }))?.nome, "Favoritos");
  assert.equal(nomeLimpo("a".repeat(60)).length, 40);
});
