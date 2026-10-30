import test from "node:test";
import assert from "node:assert/strict";
import { LIMITE_DA_PAREDE, RELATOS_DEMO, montarParede } from "../src/utils/relatosDaParede.js";

/* A parede "Por que Omnimob": reais primeiro, exemplos completando as vagas.
   É a mesma função na landing e na aba do super-admin, então o "sem vaga" de
   lá é o de cá. */

const real = (i) => ({ chave: `real-${i}`, nome: `Real ${i}` });

test("os exemplos têm chave única e cabem na parede", () => {
  assert.equal(RELATOS_DEMO.length, LIMITE_DA_PAREDE);
  assert.equal(new Set(RELATOS_DEMO.map((d) => d.chave)).size, RELATOS_DEMO.length);
  assert.ok(RELATOS_DEMO.every((d) => /^[a-z0-9-]+$/.test(d.chave)));
});

test("sem nada do servidor, a parede é a dos exemplos", () => {
  assert.deepEqual(montarParede().relatos.map((r) => r.chave), RELATOS_DEMO.map((d) => d.chave));
});

test("a real entra na frente e empurra o último exemplo", () => {
  const { relatos, estadoDosExemplos } = montarParede({ reais: [real(1), real(2)] });
  assert.equal(relatos.length, LIMITE_DA_PAREDE);
  assert.deepEqual(relatos.slice(0, 2).map((r) => r.chave), ["real-1", "real-2"]);
  const ultimos = estadoDosExemplos.slice(-2);
  assert.ok(ultimos.every((d) => d.ligado && !d.noAr), "os dois últimos exemplos deviam ficar sem vaga");
});

test("o exemplo desligado não aparece e devolve a vaga ao seguinte", () => {
  const primeiro = RELATOS_DEMO[0].chave;
  const { relatos, estadoDosExemplos } = montarParede({ reais: [real(1)], ocultos: [primeiro] });
  assert.ok(!relatos.some((r) => r.chave === primeiro));
  assert.equal(relatos.length, LIMITE_DA_PAREDE);
  assert.equal(estadoDosExemplos[0].ligado, false);
  assert.ok(estadoDosExemplos.slice(1).every((d) => d.noAr), "com um desligado e uma real, todos os outros cabem");
});

test("reais demais não passam do limite", () => {
  const reais = Array.from({ length: LIMITE_DA_PAREDE + 3 }, (_, i) => real(i));
  const { relatos } = montarParede({ reais });
  assert.equal(relatos.length, LIMITE_DA_PAREDE);
  assert.ok(relatos.every((r) => !r.demo));
});
