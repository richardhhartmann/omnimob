import test from "node:test";
import assert from "node:assert/strict";
import { INICIO, daApresentacao, montarHistorico, semanaDe } from "../src/services/versao.js";

/* A régua da versão. Não toca no banco nem no git: o risco é a CONTA — um
   número errado faz o suporte dizer "já está corrigido" a quem não tem a
   correção. */

const DIA = 24 * 3600;

test("a semana vira na terça às 15h01 de Brasília", () => {
  assert.equal(semanaDe(INICIO - 1), 0);
  assert.equal(semanaDe(INICIO), 1);
  assert.equal(semanaDe(INICIO + 7 * DIA - 1), 1);
  assert.equal(semanaDe(INICIO + 7 * DIA), 2);
});

test("a apresentação de cada terça conta a semana que acabou de fechar", () => {
  assert.equal(daApresentacao("2026-11-03"), "1.1");
  assert.equal(daApresentacao("2026-11-10"), "1.2");
  // A terça do próprio INICIO fecha a semana anterior a ele.
  assert.equal(daApresentacao("2026-10-27"), "1.0");
});

test("a entrega recomeça em 1 a cada semana e o mais novo vem primeiro", () => {
  const c = (n, ts) => ({ commit: `c${n}`, ts, autor: "R", titulo: `PR ${n}`, arquivos: [`a${n}.js`] });
  const h = montarHistorico(
    [c(1, INICIO + 10), c(2, INICIO + DIA), c(3, INICIO + 7 * DIA + 5)],
    [INICIO - 100, INICIO - 50],
  );
  assert.deepEqual(h.versoes.map((v) => v.versao), ["1.2.1", "1.1.2", "1.1.1"]);
  assert.equal(h.versoes[0].semana, "1.2");
  assert.equal(h.versoes[0].titulo, "PR 3");
  assert.equal(h.antes.commits, 2);
  assert.equal(h.antes.versao, "1.0");
});
