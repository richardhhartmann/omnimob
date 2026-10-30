import test from "node:test";
import assert from "node:assert/strict";
import { deveAvisar, esquecerErros, impressaoDoErro } from "../src/services/avisoDeErro.js";

/* A régua do aviso de erro. Não toca no banco: o risco é avisar de menos (o
   erro some) ou demais (cem e-mails num deploy quebrado, e a caixa vira ruído). */

const H = 60 * 60 * 1000;

test("o mesmo defeito com outro id tem a mesma impressão", () => {
  const a = impressaoDoErro({ origem: "navegador", mensagem: "Imóvel 123 sem foto", pilha: "x\n    at abrir (app.js:10:5)" });
  const b = impressaoDoErro({ origem: "navegador", mensagem: "Imóvel 987 sem foto", pilha: "x\n    at abrir (app.js:10:5)" });
  const c = impressaoDoErro({ origem: "servidor", mensagem: "Imóvel 123 sem foto", pilha: "x\n    at abrir (app.js:10:5)" });
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("avisa uma vez por hora e conta o que aconteceu no meio", () => {
  esquecerErros();
  assert.deepEqual(deveAvisar("x", 0), { vezes: 1 });
  assert.equal(deveAvisar("x", 10), null);
  assert.equal(deveAvisar("x", 20), null);
  assert.deepEqual(deveAvisar("x", H + 1), { vezes: 3 });
});

test("tem teto por hora no total", () => {
  esquecerErros();
  for (let i = 0; i < 20; i++) assert.ok(deveAvisar(`e${i}`, 0));
  assert.equal(deveAvisar("e-novo", 1), null);
  assert.ok(deveAvisar("e-novo", H + 1));
});
