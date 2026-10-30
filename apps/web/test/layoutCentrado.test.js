import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHAVE_LAYOUT, LARGURA_DE_MONITOR_LARGO, centradoNoAutomatico } from "../src/utils/layoutCentrado.js";

/* Telas centradas ou em largura total (aba "Painel"). A decisão existe em DOIS
   lugares — no módulo e no script do index.html, que roda antes de o React
   existir —, e é aí que mora o risco: mexer no limite ou na chave de um lado só
   faria a tela nascer de um jeito e o modal mostrar outro. */

test("automático: centrado a partir de 1800px, como no VYA", () => {
  assert.equal(LARGURA_DE_MONITOR_LARGO, 1800);
  assert.equal(centradoNoAutomatico(1799), false);
  assert.equal(centradoNoAutomatico(1800), true);
  assert.equal(centradoNoAutomatico(2560), true);
});

test("o script do index.html usa a mesma chave e o mesmo limite do módulo", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(html.includes(`localStorage.getItem("${CHAVE_LAYOUT}")`), "chave do navegador divergente");
  assert.ok(html.includes(`>= ${LARGURA_DE_MONITOR_LARGO}`), "limite do automático divergente");
  assert.ok(html.includes(`setAttribute("data-layout", "centrado")`), "atributo divergente");
});
