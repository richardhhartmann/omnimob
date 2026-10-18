import test from "node:test";
import assert from "node:assert/strict";
import {
  assinarEstiloCopiado,
  colarEstilo,
  copiarEstilo,
  esquecerEstiloCopiado,
  temEstiloCopiado,
} from "../src/puck/estiloCopiado.js";

/* ── O que esta suíte guarda ─────────────────────────────────────────────────
   Copiar a aparência de uma peça e colar noutra. Os três defeitos da primeira
   versão, todos silenciosos:
     · o colar MISTURAVA estilos — o vazio da origem não viajava, e o fundo
       vermelho do destino sobrevivia à colagem de um estilo "sem fundo";
     · peça nova não recebia nada — a peneira era pelo que o destino já tinha
       PREENCHIDO, e uma peça recém-arrastada não tem nada preenchido;
     · o botão "colar" não aparecia depois de copiar — ninguém avisava a barra.
   ────────────────────────────────────────────────────────────────────────── */

const CAMPOS_DE_WIDGET = ["backgroundColor", "color", "backgroundImage", "backgroundOverlay", "backgroundBrightness", "espacoInterno", "espacoExterno", "arredondamento", "titulo"];

test.beforeEach(() => esquecerEstiloCopiado());

test("copia TUDO que é aparência, inclusive o que está vazio — e nada de conteúdo", () => {
  copiarEstilo({ color: "#fff", espacoInterno: 24, arredondamento: 8, titulo: "Texto da peça" }, CAMPOS_DE_WIDGET);
  const colado = colarEstilo(CAMPOS_DE_WIDGET);

  assert.equal(colado.color, "#fff");
  assert.equal(colado.espacoInterno, 24);
  assert.equal(colado.arredondamento, 8);
  /* O fundo da origem era "nenhum" — e isso também é estilo. */
  assert.ok("backgroundColor" in colado);
  assert.equal(colado.backgroundColor, undefined);
  /* Conteúdo não viaja. */
  assert.ok(!("titulo" in colado));
});

test("a peneira é o que o DESTINO aceita, não o que ele já tinha preenchido", () => {
  copiarEstilo({ backgroundColor: "#123", backgroundImage: "https://x/y.jpg" }, CAMPOS_DE_WIDGET);
  /* O Widget genérico só tem banner: a cor não pode virar prop que ninguém lê. */
  const noGenerico = colarEstilo(["backgroundImage", "backgroundOverlay", "backgroundBrightness"]);
  assert.deepEqual(Object.keys(noGenerico).sort(), ["backgroundBrightness", "backgroundImage", "backgroundOverlay"]);
  assert.equal(noGenerico.backgroundImage, "https://x/y.jpg");
});

test("o copiar avisa quem assinou — é o que faz o botão de colar aparecer na hora", () => {
  let avisos = 0;
  const cancelar = assinarEstiloCopiado(() => { avisos += 1; });
  assert.equal(temEstiloCopiado(), false);
  copiarEstilo({ color: "#000" }, CAMPOS_DE_WIDGET);
  assert.equal(temEstiloCopiado(), true);
  assert.equal(avisos, 1);
  cancelar();
  copiarEstilo({ color: "#111" }, CAMPOS_DE_WIDGET);
  assert.equal(avisos, 1, "depois de cancelar, não avisa mais");
});

test("nada copiado, nada a colar", () => {
  assert.equal(colarEstilo(CAMPOS_DE_WIDGET), null);
});
