import test from "node:test";
import assert from "node:assert/strict";
import { diasDoTexto, diasDasFaixas, faixasDosDias, textoDosDias } from "../src/components/HorarioAtendimento.jsx";

/* O componente de horário CONVERTE entre os dias marcados e as faixas de
   texto que a vitrine lê. Um erro aqui não dá erro: dá "aberto agora" no
   domingo, ou uma faixa "Segunda a sexta" que virou "Segunda, terça…". */

test("texto → dias: faixa, lista, dias úteis, texto à mão", () => {
  assert.deepEqual(diasDoTexto("Segunda a sexta"), [1, 2, 3, 4, 5]);
  assert.deepEqual(diasDoTexto("Seg-Sex"), [1, 2, 3, 4, 5]);
  assert.deepEqual(diasDoTexto("Terça e quinta"), [2, 4]);
  assert.deepEqual(diasDoTexto("Sábado"), [6]);
  assert.deepEqual(diasDoTexto("Dias úteis"), [1, 2, 3, 4, 5]);
  assert.deepEqual(diasDoTexto("Todos os dias"), [1, 2, 3, 4, 5, 6, 0]);
  assert.deepEqual(diasDoTexto("Plantão"), []);
});

test("dias → texto: consecutivos viram faixa; soltos viram lista", () => {
  assert.equal(textoDosDias([1, 2, 3, 4, 5]), "Segunda a sexta");
  assert.equal(textoDosDias([6]), "Sábado");
  assert.equal(textoDosDias([2, 4]), "Terça e quinta");
  assert.equal(textoDosDias([1, 3, 5]), "Segunda, quarta e sexta");
  assert.equal(textoDosDias([1, 2, 3, 4, 5, 6, 0]), "Todos os dias");
  assert.equal(textoDosDias([1, 2]), "Segunda e terça", "dois dias consecutivos leem melhor como lista");
});

test("ida e volta: o que a tela grava, a vitrine lê igual", () => {
  const faixas = faixasDosDias({ 1: { abre: "09:00", fecha: "18:00" }, 2: { abre: "09:00", fecha: "18:00" }, 3: { abre: "09:00", fecha: "18:00" }, 4: { abre: "09:00", fecha: "18:00" }, 5: { abre: "09:00", fecha: "18:00" }, 6: { abre: "09:00", fecha: "13:00" } });
  assert.deepEqual(faixas, [
    { dias: "Segunda a sexta", abre: "09:00", fecha: "18:00", fechado: false },
    { dias: "Sábado", abre: "09:00", fecha: "13:00", fechado: false },
  ]);
  const porDia = diasDasFaixas(faixas);
  assert.deepEqual(Object.keys(porDia).map(Number).sort(), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(porDia[6], { abre: "09:00", fecha: "13:00" });
});

test("faixa 'fechado' e dia desmarcado não entram; formato antigo à mão é lido", () => {
  const porDia = diasDasFaixas([
    { dias: "Segunda a sexta", abre: "08:00", fecha: "17:00", fechado: false },
    { dias: "Domingo", abre: "", fecha: "", fechado: true },
  ]);
  assert.equal(porDia[0], undefined);
  assert.equal(porDia[3].abre, "08:00");
  assert.deepEqual(faixasDosDias({}), []);
});
