import test from "node:test";
import assert from "node:assert/strict";
import { normalizarEnquadramento, variaveisDoEnquadramento, ENQUADRAMENTO_NEUTRO } from "../src/puck/ComBanner.jsx";
import { fotosDosImoveis } from "../src/puck/CampoImagemDoBanner.jsx";
import { BANCO_DE_FOTOS } from "../src/puck/bancoDeFotos.js";

/* A imagem do banner: o enquadramento (zoom, giro, posição) e as fontes de
   foto. O que se guarda aqui é o que falharia em silêncio — um enquadramento
   ilegível virando banner deslocado, e a aba "Seus imóveis" mostrando
   placeholder ou foto repetida. */

test("enquadramento: ausente é o neutro, e o neutro não escreve variável nenhuma", () => {
  assert.deepEqual(normalizarEnquadramento(undefined), ENQUADRAMENTO_NEUTRO);
  assert.deepEqual(variaveisDoEnquadramento(undefined), {});
  assert.deepEqual(variaveisDoEnquadramento({ zoom: 100, giro: 0, x: 50, y: 50 }), {});
});

test("enquadramento: fora da faixa é preso nos limites, lixo cai no neutro", () => {
  assert.deepEqual(
    normalizarEnquadramento({ zoom: 900, giro: -400, x: -5, y: 140 }),
    { zoom: 300, giro: -180, x: 0, y: 100 },
  );
  assert.deepEqual(normalizarEnquadramento({ zoom: "abc", giro: null, x: {}, y: "30" }), { zoom: 100, giro: 0, x: 50, y: 30 });
});

test("enquadramento: vira as variáveis que o ::before do banner lê", () => {
  assert.deepEqual(variaveisDoEnquadramento({ zoom: 150, giro: 15, x: 20, y: 80 }), {
    "--banner-x": "20%",
    "--banner-y": "80%",
    "--banner-escala": "1.5",
    "--banner-giro": "15deg",
  });
});

test("fotos dos imóveis: achatadas, sem repetição e sem o placeholder", () => {
  const fotos = fotosDosImoveis([
    { title: "Casa", images: [{ url: "https://x/a.jpg" }, { url: "https://x/b.jpg" }] },
    { title: "Apto", images: [{ url: "https://x/a.jpg" }, { url: "/property-placeholder.svg" }, { url: "  " }] },
    { title: "Sem fotos" },
  ]);
  assert.deepEqual(fotos.map((f) => f.url), ["https://x/a.jpg", "https://x/b.jpg"]);
  assert.equal(fotos[0].titulo, "Casa");
});

test("banco de fotos: só a CDN do Unsplash, com miniatura do mesmo id", () => {
  const todas = BANCO_DE_FOTOS.flatMap((g) => g.fotos);
  assert.ok(todas.length >= 12);
  for (const f of todas) {
    assert.match(f.url, /^https:\/\/images\.unsplash\.com\/photo-[\w-]+\?w=1920/);
    assert.equal(f.miniatura, f.url.replace("w=1920", "w=480"));
  }
  assert.equal(new Set(todas.map((f) => f.id)).size, todas.length, "foto repetida no banco");
});
