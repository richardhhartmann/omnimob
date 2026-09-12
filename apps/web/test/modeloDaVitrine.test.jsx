import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ModeloDaVitrinePasso, MODELO_EM_BRANCO, configDoModelo } from "../src/components/ModeloDaVitrinePasso.jsx";
import { BUILDER_TEMPLATES } from "../src/components/builder/data/templates.jsx";

/* O passo obrigatório do modelo, no assistente de boas-vindas. O que importa:
   os modelos são OS DO EDITOR (nada de lista própria), "em branco" existe, e
   sem escolha o botão não deixa seguir. */

test("lista os modelos do editor mais o 'em branco', e começa sem saída", () => {
  const html = renderToStaticMarkup(<ModeloDaVitrinePasso tenantSlug="x" configAtual={{}} />);
  for (const m of BUILDER_TEMPLATES) assert.match(html, new RegExp(`<strong>${m.name}</strong>`));
  assert.match(html, /<strong>Em branco<\/strong>/);
  assert.match(html, /Escolha um modelo para continuar/);
  assert.match(html, /disabled=""/, "o botão nasce desabilitado");
  assert.match(html, /Editar página/, "diz o caminho para mudar depois");
});

test("o config gravado é o do modelo por cima do atual, sem o documento do editor novo", () => {
  const atual = { appearanceMode: "light", puck: { content: [] }, footerTitle: "Fale conosco", widgets: [{ id: "w1", type: "cta" }] };
  const c = configDoModelo(atual, BUILDER_TEMPLATES[0]);
  assert.equal("puck" in c, false);
  assert.equal(c.appearanceMode, BUILDER_TEMPLATES[0].config.appearanceMode);
  assert.equal(c.footerTitle, "Fale conosco", "o que o modelo não define, fica");
  assert.ok(c.widgets.length > 1);
  const b = configDoModelo(atual, MODELO_EM_BRANCO);
  assert.deepEqual(b.widgets, []);
  assert.deepEqual(b.hiddenBlocks, ["title", "highlights"]);
});
