import test from "node:test";
import assert from "node:assert/strict";
import { alternarPecaArmada, assinarPecaArmada, desarmarPeca, pecaArmada } from "../src/puck/pecaArmada.js";

/* O clique no cartão da gaveta arma; o mesmo cartão de novo desarma; outro
   cartão troca. Quem assinou é avisado a cada mudança — é o que acende o
   cartão no mesmo clique. */
test("pecaArmada: alterna, troca e avisa", () => {
  let avisos = 0;
  const cancelar = assinarPecaArmada(() => { avisos += 1; });
  alternarPecaArmada("Widget_text", "Texto");
  assert.deepEqual(pecaArmada(), { tipo: "Widget_text", rotulo: "Texto" });
  alternarPecaArmada("Widget_faq", "Perguntas");
  assert.equal(pecaArmada().tipo, "Widget_faq", "outro cartão troca a peça");
  alternarPecaArmada("Widget_faq", "Perguntas");
  assert.equal(pecaArmada(), null, "o mesmo cartão desarma");
  alternarPecaArmada("Widget_text");
  desarmarPeca();
  assert.equal(pecaArmada(), null);
  assert.equal(avisos, 5);
  desarmarPeca();
  assert.equal(avisos, 5, "desarmar o que já está desarmado não avisa");
  cancelar();
});
