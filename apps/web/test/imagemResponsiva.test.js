import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { atributosDaFoto, redimensionavel, urlNaLargura } from "../src/utils/imagemResponsiva.js";

/* ── O que esta suíte guarda ─────────────────────────────────────────────────
   Duas coisas que o PageSpeed mede e ninguém vê na tela: o tamanho das fotos
   que a vitrine pede, e o que o visitante da vitrine baixa de JavaScript. As
   duas regridem em silêncio — a página continua igual, só mais lenta. */

const CLOUDINARY = "https://res.cloudinary.com/dpwuxmbli/image/upload/v1700000000/domus/casa.jpg";
const UNSPLASH = "https://images.unsplash.com/photo-1?w=1600&q=80&auto=format&fit=crop";

test("Cloudinary: tamanho, formato e qualidade pela URL", () => {
  assert.equal(
    urlNaLargura(CLOUDINARY, 640),
    "https://res.cloudinary.com/dpwuxmbli/image/upload/f_auto,q_auto,c_limit,w_640/v1700000000/domus/casa.jpg",
  );
});

test("Cloudinary: transformação que a URL já traz continua valendo, depois da nossa", () => {
  const recortada = "https://res.cloudinary.com/x/image/upload/c_fill,w_1080,h_1080/casa.jpg";
  assert.equal(
    urlNaLargura(recortada, 320),
    "https://res.cloudinary.com/x/image/upload/f_auto,q_auto,c_limit,w_320/c_fill,w_1080,h_1080/casa.jpg",
  );
});

test("Unsplash: só a largura muda; com altura fixa, nada muda", () => {
  const u = new URL(urlNaLargura(UNSPLASH, 480));
  assert.equal(u.searchParams.get("w"), "480");
  assert.equal(u.searchParams.get("fit"), "crop");
  const comAltura = "https://images.unsplash.com/photo-1?w=1600&h=900&fit=crop";
  assert.equal(urlNaLargura(comAltura, 480), comAltura);
});

test("origem desconhecida, vídeo e placeholder passam intocados", () => {
  for (const url of [
    "https://cdn.imobiliaria.com.br/foto.jpg",
    "https://res.cloudinary.com/x/video/upload/tour.mp4",
    "/property-placeholder.svg",
    "",
    undefined,
  ]) {
    assert.equal(urlNaLargura(url, 640), url);
    assert.equal(redimensionavel(url), false);
  }
  assert.deepEqual(atributosDaFoto("/property-placeholder.svg", "100vw"), { src: "/property-placeholder.svg" });
});

test("srcset respeita o teto e o src fica num degrau intermediário", () => {
  const a = atributosDaFoto(CLOUDINARY, "100vw", { maxima: 960 });
  assert.equal(a.sizes, "100vw");
  assert.match(a.src, /w_960\//);
  const larguras = a.srcSet.split(", ").map((c) => Number(c.split(" ")[1].replace("w", "")));
  assert.deepEqual(larguras, [320, 480, 640, 960]);
});

/* O painel saiu do pacote comum para a vitrine baixar só o que é dela (ver
   `pages/painel.js`). Uma tela do painel importada direto no `App.jsx` desfaz
   isso sem nenhum sintoma visível — só a vitrine voltando a pesar 490 kB. */
test("App.jsx: das páginas, só as da vitrine entram por import estático", () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const estaticas = [...app.matchAll(/^import\s.+from\s+"\.\/(pages|components)\/([^"]+)"/gm)]
    .map((m) => `${m[1]}/${m[2]}`)
    .filter((caminho) => /Page|Layout/.test(caminho));
  assert.deepEqual(estaticas.sort(), [
    "pages/RegiaoPage",
    "pages/ShowcasePage",
    "pages/ShowcasePropertyPage",
  ]);
});
