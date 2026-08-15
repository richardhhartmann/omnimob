import test from "node:test";
import assert from "node:assert/strict";

import { normalizeShowcaseConfig, widgetRect } from "../src/utils/showcaseConfig.js";
import { toPieces, applyPieces, blockPieceId, widgetPieceId } from "../src/components/showcase/engine/pieces.js";
import { resolverColisoes, sobrepoe } from "../src/components/showcase/engine/collision.js";
import {
  ajustarAlturasMedidas,
  assentarLayout,
  copiarDesktopParaMobile,
  mobileFoiPersonalizado,
  moverPeca,
  redimensionarPeca,
  LARGURA_MINIMA_MOBILE,
} from "../src/components/showcase/engine/layoutEngine.js";

/* ────────────────────────────────────────────────────────────────────────────
   A engine de layout — a mesma que resolve o editor e a vitrine publicada.

   É aqui que a paridade começa: se as duas telas chamam estas funções e elas
   são puras, o mesmo config produz o mesmo layout dos dois lados por
   construção. O que estes testes protegem é o comportamento delas.
   ──────────────────────────────────────────────────────────────────────────── */

test("nada termina sobreposto — cascata sem âncora", () => {
  const { pecas } = resolverColisoes([
    { id: "a", x: 0, y: 0, w: 100, h: 200 },
    { id: "b", x: 0, y: 50, w: 100, h: 200 },
    { id: "c", x: 0, y: 60, w: 50, h: 200 },
  ], null);

  for (let i = 0; i < pecas.length; i++) {
    for (let j = i + 1; j < pecas.length; j++) {
      assert.equal(sobrepoe(pecas[i], pecas[j]), false, `${pecas[i].id} × ${pecas[j].id}`);
    }
  }
});

test("a peça arrastada encosta pela borda mais próxima, sem invadir", () => {
  const { pecas, encostadas } = resolverColisoes([
    { id: "ancora", x: 0, y: 300, w: 100, h: 200 },
    { id: "outra", x: 0, y: 320, w: 100, h: 200 },
  ], "ancora");

  const a = pecas.find((p) => p.id === "ancora");
  const o = pecas.find((p) => p.id === "outra");
  assert.equal(sobrepoe(a, o), false);
  const colada = Math.abs(a.y + a.h - o.y) < 2 || Math.abs(o.y + o.h - a.y) < 2;
  assert.equal(colada, true, "parou na borda que encontrou");
  assert.ok(encostadas.has("ancora") && encostadas.has("outra"), "o contato acende dos dois lados");
});

test("largada entre duas peças coladas, o resto abre caminho", () => {
  // Este arranjo fazia a expulsão da âncora oscilar entre as duas vizinhas e
  // terminar por esgotar as tentativas, deixando sobreposição.
  const { pecas } = resolverColisoes([
    { id: "cima", x: 0, y: 0, w: 100, h: 300 },
    { id: "baixo", x: 0, y: 300, w: 100, h: 300 },
    { id: "ancora", x: 0, y: 220, w: 100, h: 200 },
  ], "ancora");

  for (let i = 0; i < pecas.length; i++) {
    for (let j = i + 1; j < pecas.length; j++) {
      assert.equal(sobrepoe(pecas[i], pecas[j]), false, `${pecas[i].id} × ${pecas[j].id}`);
    }
  }
});

test("mil tabuleiros aleatórios não produzem sobreposição", () => {
  for (let n = 0; n < 1000; n++) {
    const qtd = 2 + (n % 8);
    const entrada = [];
    for (let i = 0; i < qtd; i++) {
      const w = 20 + Math.floor(Math.random() * 80);
      entrada.push({
        id: `p${i}`,
        x: Math.floor(Math.random() * (100 - w)),
        y: Math.floor(Math.random() * 1200),
        w,
        h: 60 + Math.floor(Math.random() * 400),
      });
    }
    const ancora = Math.random() < 0.8 ? entrada[Math.floor(Math.random() * qtd)].id : null;
    const { pecas } = resolverColisoes(entrada, ancora);
    for (let i = 0; i < pecas.length; i++) {
      for (let j = i + 1; j < pecas.length; j++) {
        assert.equal(sobrepoe(pecas[i], pecas[j]), false, `tabuleiro ${n}: ${pecas[i].id} × ${pecas[j].id}`);
      }
      assert.ok(pecas[i].y >= 0, "nenhuma peça sai pelo topo");
    }
  }
});

test("o layout padrão abre assentado — nenhum widget dentro de bloco", () => {
  const cfg = assentarLayout(normalizeShowcaseConfig(null));
  for (const modo of ["desktop", "mobile"]) {
    const pecas = toPieces(cfg, modo);
    assert.ok(pecas.some((p) => p.kind === "widget"), `${modo}: sem widgets`);
    assert.ok(pecas.some((p) => p.kind === "block"), `${modo}: sem blocos`);
    for (let i = 0; i < pecas.length; i++) {
      for (let j = i + 1; j < pecas.length; j++) {
        assert.equal(sobrepoe(pecas[i], pecas[j]), false, `${modo}: ${pecas[i].id} × ${pecas[j].id}`);
      }
    }
  }
});

test("desktop e mobile são layouts independentes, widgets inclusos", () => {
  let cfg = normalizeShowcaseConfig({ widgets: [{ id: "w1", x: 0, y: 1000, w: 50, h: 200 }] });
  const antes = widgetRect(cfg.widgets[0], "desktop");

  cfg = moverPeca(cfg, "mobile", widgetPieceId("w1"), { x: 0, y: 4600 }, { encaixar: false }).config;

  assert.deepEqual(widgetRect(cfg.widgets[0], "desktop"), antes, "o desktop não pode ter se mexido");
  assert.equal(widgetRect(cfg.widgets[0], "mobile").y, 4600);
});

test("redimensionar trava na peça vizinha em vez de empurrá-la", () => {
  let cfg = normalizeShowcaseConfig({
    layout: { header: { x: 0, y: 0, w: 100, h: 100 }, title: { x: 0, y: 100, w: 100, h: 200 } },
    hiddenBlocks: ["highlights", "properties", "footer"],
    widgets: [],
  });
  const antes = cfg.layout.title.y;
  cfg = redimensionarPeca(cfg, "desktop", blockPieceId("header"), { w: 100, h: 900 }).config;

  assert.equal(cfg.layout.title.y, antes, "o vizinho ficou parado");
  assert.ok(cfg.layout.header.h < 900, "a altura parou antes de invadir");
});

test("no mobile a largura não desce abaixo do mínimo publicável", () => {
  /* A vitrine passou a respeitar o `w` do mobile. Se o editor deixasse chegar a
     12%, o visitante receberia uma coluna de 47px — e a resposta certa é
     impedir na edição, não a página redesenhar escondido. */
  let cfg = normalizeShowcaseConfig({ widgets: [{ id: "w1", x: 0, y: 4000, w: 100, h: 200 }] });
  cfg = redimensionarPeca(cfg, "mobile", widgetPieceId("w1"), { w: 12, h: 200 }).config;

  assert.ok(
    widgetRect(cfg.widgets[0], "mobile").w >= LARGURA_MINIMA_MOBILE,
    "o gesto não pode produzir uma peça mais estreita que o mínimo"
  );
});

test("copiar do desktop leva blocos E widgets para o mobile", () => {
  let cfg = normalizeShowcaseConfig({
    widgets: [{
      id: "w1",
      layout: { desktop: { x: 25, y: 700, w: 50, h: 240 }, mobile: { x: 0, y: 5000, w: 100, h: 400 } },
    }],
  });

  assert.equal(mobileFoiPersonalizado(cfg), true, "detecta o mobile já ajustado");
  cfg = copiarDesktopParaMobile(cfg);
  assert.deepEqual(widgetRect(cfg.widgets[0], "mobile"), { x: 25, y: 700, w: 50, h: 240 });
  assert.equal(mobileFoiPersonalizado(cfg), false, "depois da cópia os dois são iguais");
});

test("as alturas medidas crescem a caixa e reempilham — a mesma função nas duas telas", () => {
  const cfg = assentarLayout(normalizeShowcaseConfig(null));
  const alturas = { [blockPieceId("properties")]: 2400 };
  const resolvido = ajustarAlturasMedidas(cfg, "desktop", alturas);

  assert.ok(resolvido, "altura maior que a declarada precisa produzir um layout novo");
  assert.equal(resolvido.layout.properties.h, 2400);

  const pecas = toPieces(resolvido, "desktop");
  for (let i = 0; i < pecas.length; i++) {
    for (let j = i + 1; j < pecas.length; j++) {
      assert.equal(sobrepoe(pecas[i], pecas[j]), false, `${pecas[i].id} × ${pecas[j].id} após o reflow`);
    }
  }

  // Idempotente: medir de novo a mesma altura não pode mexer em nada, senão o
  // ResizeObserver e o reflow entrariam em laço na tela.
  assert.equal(ajustarAlturasMedidas(resolvido, "desktop", alturas), null);
});

test("os adaptadores não perdem nem recriam o resto do documento", () => {
  const cfg = normalizeShowcaseConfig({ footerTitle: "Meu rodapé", globalFont: "Lato" });
  const volta = applyPieces(cfg, "desktop", toPieces(cfg, "desktop"));

  assert.equal(volta.footerTitle, "Meu rodapé");
  assert.equal(volta.globalFont, "Lato");
  // A identidade importa: a grade de imóveis é memoizada por ela.
  assert.equal(volta.blockStyles, cfg.blockStyles);
});
