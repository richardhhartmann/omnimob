import test from "node:test";
import assert from "node:assert/strict";
import { soltarNoFim } from "../src/puck/ArrastoNaEstrutura.jsx";

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
