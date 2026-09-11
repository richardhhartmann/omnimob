import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeShowcaseConfig,
  widgetRect,
  withWidgetRect,
  DEFAULT_LAYOUT,
} from "../src/utils/showcaseConfig.js";

/* ────────────────────────────────────────────────────────────────────────────
   `normalizeShowcaseConfig` é a única migração do projeto.

   Todo config gravado no banco passa por ela antes de qualquer coisa — no
   editor, na vitrine e na página de imóvel. Se ela quebrar com um formato
   antigo, a vitrine de um cliente que não é editada há meses quebra junto.
   ──────────────────────────────────────────────────────────────────────────── */

test("config vazio produz um documento completo", () => {
  const cfg = normalizeShowcaseConfig(null);

  assert.equal(cfg.version, 2);
  assert.ok(cfg.highlights.length >= 1);
  assert.deepEqual(Object.keys(cfg.layout).sort(), Object.keys(DEFAULT_LAYOUT).sort());
  assert.ok(Array.isArray(cfg.widgets));
  assert.equal(cfg.appearanceMode, "dark");
  for (const w of cfg.widgets) {
    assert.ok(w.layout?.desktop && w.layout?.mobile, "todo widget nasce com os dois modos");
  }
});

test("widget antigo (x/y/w/h soltos) migra para layout por modo", () => {
  const cfg = normalizeShowcaseConfig({
    widgets: [{ id: "w1", type: "text", title: "T", content: "C", x: 10, y: 500, w: 40, h: 200 }],
  });
  const w = cfg.widgets[0];

  assert.deepEqual(widgetRect(w, "desktop"), { x: 10, y: 500, w: 40, h: 200 });
  // O mobile herda o desktop: é exatamente o comportamento de antes da migração,
  // quando havia uma posição só. A partir daí cada modo anda sozinho.
  assert.deepEqual(widgetRect(w, "mobile"), { x: 10, y: 500, w: 40, h: 200 });
});

test("o espelho legado continua na saída, para leitores antigos do JSON", () => {
  const cfg = normalizeShowcaseConfig({
    widgets: [{ id: "w1", layout: { desktop: { x: 5, y: 100, w: 50, h: 200 }, mobile: { x: 0, y: 900, w: 100, h: 300 } } }],
  });
  const w = cfg.widgets[0];

  assert.equal(w.x, 5);
  assert.equal(w.y, 100);
  assert.equal(w.w, 50);
  assert.equal(w.h, 200);
});

test("layout por modo tem precedência sobre o espelho quando os dois existem", () => {
  const cfg = normalizeShowcaseConfig({
    widgets: [{
      id: "w1", x: 99, y: 99, w: 99, h: 99,
      layout: { desktop: { x: 5, y: 100, w: 50, h: 200 }, mobile: { x: 0, y: 900, w: 100, h: 300 } },
    }],
  });

  assert.deepEqual(widgetRect(cfg.widgets[0], "desktop"), { x: 5, y: 100, w: 50, h: 200 });
  assert.deepEqual(widgetRect(cfg.widgets[0], "mobile"), { x: 0, y: 900, w: 100, h: 300 });
});

test("mexer no mobile não altera o espelho do desktop", () => {
  const cfg = normalizeShowcaseConfig({ widgets: [{ id: "w1", x: 10, y: 500, w: 40, h: 200 }] });
  const movido = withWidgetRect(cfg.widgets[0], "mobile", { x: 0, y: 3000, w: 100, h: 320 });

  assert.deepEqual(widgetRect(movido, "desktop"), { x: 10, y: 500, w: 40, h: 200 });
  assert.equal(movido.x, 10, "o espelho acompanha o desktop, e só ele");
  assert.equal(movido.y, 500);
});

test("normalizar é idempotente", () => {
  const uma = normalizeShowcaseConfig({ widgets: [{ id: "w1", x: 10, y: 500, w: 40, h: 200 }], footerTitle: "Rodapé" });
  const duas = normalizeShowcaseConfig(uma);
  assert.deepEqual(duas, uma);
});

test("lixo no config não derruba a vitrine", () => {
  const cfg = normalizeShowcaseConfig({
    layout: "isto não é um objeto",
    widgets: [null, { id: 42 }, { id: "ok", x: "abc", y: undefined }],
    highlights: "nem isto",
    hiddenBlocks: ["header", "inexistente"],
    appearanceMode: "arco-íris",
  });

  assert.equal(cfg.appearanceMode, "dark", "modo desconhecido cai no padrão");
  assert.deepEqual(cfg.hiddenBlocks, ["header"], "chave inexistente é descartada");
  assert.equal(cfg.widgets.length, 3);
  for (const w of cfg.widgets) {
    assert.equal(typeof w.id, "string");
    assert.ok(Number.isFinite(widgetRect(w, "desktop").x));
    assert.ok(Number.isFinite(widgetRect(w, "mobile").y));
  }
});

/* ── O interruptor do Puck ─────────────────────────────────────────────────
   `showcaseConfig.puck` é o que decide, por imobiliária, qual renderizador
   desenha a vitrine pública. O que se guarda aqui é a REVERSIBILIDADE: o
   formato antigo tem que sobreviver intacto ao lado do novo, senão a migração
   vira porta de mão única no meio de um beta. */

test("o documento do Puck atravessa a normalização", () => {
  const doc = { content: [{ type: "BlocoImoveis", props: { id: "a" } }], root: {} };
  const cfg = normalizeShowcaseConfig({ puck: doc });
  assert.equal(cfg.puck.content.length, 1);
  assert.deepEqual(cfg.puck.root, {});
});

test("sem documento do Puck, o campo é null — e é isso que mantém a vitrine antiga", () => {
  assert.equal(normalizeShowcaseConfig(null).puck, null);
  assert.equal(normalizeShowcaseConfig({}).puck, null);
  // Lixo no lugar do documento não pode ligar o renderizador novo.
  assert.equal(normalizeShowcaseConfig({ puck: "sim" }).puck, null);
  assert.equal(normalizeShowcaseConfig({ puck: { content: "nao é lista" } }).puck, null);
});

test("ligar o Puck NÃO mexe no formato antigo", () => {
  const antes = normalizeShowcaseConfig({
    widgets: [{ id: "w1", type: "text", title: "Oi", x: 0, y: 100, w: 50, h: 200 }],
    layout: { header: { x: 0, y: 0, w: 100, h: 90 } },
  });
  const depois = normalizeShowcaseConfig({
    widgets: [{ id: "w1", type: "text", title: "Oi", x: 0, y: 100, w: 50, h: 200 }],
    layout: { header: { x: 0, y: 0, w: 100, h: 90 } },
    puck: { content: [], root: {} },
  });
  /* Byte por byte, tirando a chave nova. É o que faz "Voltar ao editor antigo"
     ser apagar uma chave, e não reconstruir uma página. */
  const { puck: _a, ...semPuckAntes } = antes;
  const { puck: _b, ...semPuckDepois } = depois;
  assert.deepEqual(semPuckDepois, semPuckAntes);
});
