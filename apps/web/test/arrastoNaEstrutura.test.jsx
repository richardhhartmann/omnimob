import test from "node:test";
import assert from "node:assert/strict";
import { noMeioDaLinha, rotuloDeAgrupar, soltarNoFim } from "../src/puck/ArrastoNaEstrutura.jsx";

/* Quando o espaço abaixo da Estrutura quer dizer "no fim da página": só com a
   última linha DENTRO de uma seção (senão o Puck já oferece o fim), só abaixo
   dela (na linha, "dentro da seção" continua valendo) e só sobre a lista. */
const lista = { esquerda: 100, direita: 400 };

test("soltarNoFim: abaixo da última linha, quando ela é de dentro de uma seção", () => {
  const ultima = { base: 300, aninhada: true };
  assert.equal(soltarNoFim({ x: 200, y: 320 }, ultima, lista), true);
  assert.equal(soltarNoFim({ x: 200, y: 290 }, ultima, lista), false, "em cima da linha é dentro da seção");
  assert.equal(soltarNoFim({ x: 50, y: 320 }, ultima, lista), false, "fora da lista");
});

test("soltarNoFim: última linha na raiz não precisa de ajuda", () => {
  assert.equal(soltarNoFim({ x: 200, y: 320 }, { base: 300, aninhada: false }, lista), false);
  assert.equal(soltarNoFim({ x: 200, y: 320 }, null, lista), false);
});

/* Em cima de outra linha vira seção — mas só no MEIO: perto das bordas
   continua sendo o "antes/depois" do Puck, para levar para cima ou para baixo
   no mesmo gesto. */
test("noMeioDaLinha: o meio junta, as bordas reordenam", () => {
  const linha = { topo: 100, base: 128, esquerda: 10, direita: 300 };
  assert.equal(noMeioDaLinha({ x: 50, y: 114 }, linha), true);
  assert.equal(noMeioDaLinha({ x: 50, y: 102 }, linha), false, "borda de cima é antes");
  assert.equal(noMeioDaLinha({ x: 50, y: 126 }, linha), false, "borda de baixo é depois");
  assert.equal(noMeioDaLinha({ x: 400, y: 114 }, linha), false, "fora da linha");
});

test("rotuloDeAgrupar: o selo diz o que vai acontecer, e a recusa vence", () => {
  const p = (id, type = "Widget_text") => ({ type, props: { id } });
  const secao = (id, filhos) => ({ type: "Secao", props: { id, colunas: filhos.length, conteudo: filhos } });
  const doc = [p("a"), p("b"), secao("s", [p("c"), p("d")]), secao("cheia", [p("e"), p("f"), p("g"), p("h")])];
  assert.equal(rotuloDeAgrupar(doc, "a", "b").texto, "Criar seção");
  assert.equal(rotuloDeAgrupar(doc, "a", "s").texto, "Entrar na seção");
  assert.equal(rotuloDeAgrupar(doc, "a", "c").texto, "Pôr ao lado");
  const recusa = rotuloDeAgrupar(doc, "a", "cheia");
  assert.ok(recusa.motivo, "seção cheia recusa");
  assert.equal(recusa.texto, recusa.motivo);
});
