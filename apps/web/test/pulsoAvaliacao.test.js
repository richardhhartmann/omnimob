import test from "node:test";
import assert from "node:assert/strict";

/* A cadência do pedido de avaliação: a cada 5 operações, cobrada só ao SAIR
   da tela, e nunca mais para quem respondeu. */

const memoria = new Map();
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
};
globalThis.window = { location: { pathname: "/imoveis" } };

const {
  OPERACOES_POR_PERGUNTA,
  consumirPendenciaDeAvaliacao,
  contarParaAvaliacao,
  definirDonoDoPulsoDeAvaliacao,
  encerrarPulsoDeAvaliacao,
} = await import("../src/utils/pulsoAvaliacao.js");

test("pendente depois de 5 operações, cobrada só fora da tela onde aconteceram", () => {
  memoria.clear();
  definirDonoDoPulsoDeAvaliacao("t1", "u1");
  for (let i = 0; i < OPERACOES_POR_PERGUNTA - 1; i++) contarParaAvaliacao("imovel");
  assert.equal(consumirPendenciaDeAvaliacao("/leads"), false);
  contarParaAvaliacao("imovel");
  assert.equal(consumirPendenciaDeAvaliacao("/imoveis"), false, "F5 na mesma tela não é sair");
  assert.equal(consumirPendenciaDeAvaliacao("/leads"), true);
  assert.equal(consumirPendenciaDeAvaliacao("/clientes"), false, "o mesmo trabalho não rende duas perguntas");
});

test("o auto-save da vitrine conta uma vez a cada 5 minutos", () => {
  memoria.clear();
  definirDonoDoPulsoDeAvaliacao("t1", "u1");
  for (let i = 0; i < 50; i++) contarParaAvaliacao("vitrine", 1000 + i);
  assert.equal(JSON.parse(memoria.get("omnimob_pulso_avaliacao:t1:u1")).operacoes, 1);
});

test("quem respondeu não volta a contar, e cada pessoa tem o seu contador", () => {
  memoria.clear();
  definirDonoDoPulsoDeAvaliacao("t1", "u1");
  encerrarPulsoDeAvaliacao();
  for (let i = 0; i < 10; i++) contarParaAvaliacao("cliente");
  assert.equal(consumirPendenciaDeAvaliacao("/leads"), false);

  definirDonoDoPulsoDeAvaliacao("t1", "u2");
  for (let i = 0; i < OPERACOES_POR_PERGUNTA; i++) contarParaAvaliacao("cliente");
  assert.equal(consumirPendenciaDeAvaliacao("/leads"), true);
});
