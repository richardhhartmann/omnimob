/* O autosave do editor de vitrine (puck/autosave.js). A regra que mais custou:
   abrir o editor e não mexer em nada NÃO grava — numa versão anterior isso
   migrava em silêncio toda imobiliária que só abria a tela. */
import test from "node:test";
import assert from "node:assert/strict";
import { criarAutosave } from "../src/puck/autosave.js";

/* Um relógio que só anda quando o teste manda. */
function relogioFalso() {
  let id = 0;
  const fila = new Map();
  return {
    setTimeout(fn) { id += 1; fila.set(id, fn); return id; },
    clearTimeout(i) { fila.delete(i); },
    passar() { const fns = [...fila.values()]; fila.clear(); fns.forEach((f) => f()); },
    get agendados() { return fila.size; },
  };
}
const esperar = () => new Promise((r) => setImmediate(r));

test("a abertura não grava: onChange antes de uma ação de verdade é ignorado", async () => {
  const relogio = relogioFalso();
  const gravados = [];
  const a = criarAutosave({ gravar: async (d) => { gravados.push(d); }, relogio });
  a.aoMudar({ v: "normalizado pelo Puck" });
  a.aoMudar({ v: "resolveData" });
  relogio.passar();
  await esperar();
  assert.deepEqual(gravados, []);
  assert.equal(relogio.agendados, 0);
  assert.equal(a.temPendencia(), false);
});

test("depois de armar, grava só o último de uma rajada", async () => {
  const relogio = relogioFalso();
  const gravados = [];
  const a = criarAutosave({ gravar: async (d) => { gravados.push(d.v); }, relogio });
  a.armar();
  a.aoMudar({ v: 1 }); a.aoMudar({ v: 2 }); a.aoMudar({ v: 3 });
  assert.equal(a.situacao, "pendente");
  relogio.passar();
  await esperar();
  assert.deepEqual(gravados, [3]);
  assert.equal(a.situacao, "em-dia");
});

test("uma gravação de cada vez: a mudança que chega em voo espera e vai depois", async () => {
  const relogio = relogioFalso();
  const ordem = [];
  let soltar;
  const a = criarAutosave({
    gravar: (d) => new Promise((r) => { ordem.push(`começa ${d.v}`); soltar = () => { ordem.push(`termina ${d.v}`); r(); }; }),
    relogio,
  });
  a.armar();
  a.aoMudar({ v: 1 });
  relogio.passar();
  await esperar();
  a.aoMudar({ v: 2 });
  a.aoMudar({ v: 3 });
  assert.equal(relogio.agendados, 0, "não pode agendar uma segunda gravação em paralelo");
  soltar();
  await esperar(); await esperar();
  soltar();
  await esperar();
  assert.deepEqual(ordem, ["começa 1", "termina 1", "começa 3", "termina 3"]);
});

test("a falha não se perde: o documento volta a ser o pendente e agora() tenta de novo", async () => {
  const relogio = relogioFalso();
  let falhar = true;
  const gravados = [];
  const a = criarAutosave({ gravar: async (d) => { if (falhar) throw new Error("rede"); gravados.push(d.v); }, relogio });
  a.armar();
  a.aoMudar({ v: "importante" });
  relogio.passar();
  await esperar(); await esperar();
  assert.equal(a.situacao, "falhou");
  assert.equal(a.temPendencia(), true);
  assert.deepEqual(a.pendente, { v: "importante" });
  falhar = false;
  assert.equal(await a.agora(), true);
  assert.deepEqual(gravados, ["importante"]);
  assert.equal(a.temPendencia(), false);
});

test("agora() espera a gravação em voo e a que estava na fila", async () => {
  const relogio = relogioFalso();
  const gravados = [];
  const a = criarAutosave({ gravar: (d) => new Promise((r) => setImmediate(() => { gravados.push(d.v); r(); })), relogio });
  a.armar();
  a.aoMudar({ v: 1 });
  relogio.passar();
  a.aoMudar({ v: 2 });
  assert.equal(await a.agora(), true);
  assert.deepEqual(gravados, [1, 2]);
});

test("pausado (conflito de versão) não grava mais nada até retomar", async () => {
  const relogio = relogioFalso();
  const gravados = [];
  const a = criarAutosave({ gravar: async (d) => { gravados.push(d.v); }, relogio });
  a.armar();
  a.pausar();
  a.aoMudar({ v: 1 });
  relogio.passar();
  await esperar();
  assert.equal(await a.agora(), false);
  assert.deepEqual(gravados, []);
  assert.equal(a.situacao, "pausado");
});

test("descartar esquece o pendente", async () => {
  const relogio = relogioFalso();
  const gravados = [];
  const a = criarAutosave({ gravar: async (d) => { gravados.push(d.v); }, relogio });
  a.armar();
  a.aoMudar({ v: 1 });
  a.descartar();
  relogio.passar();
  await esperar();
  assert.deepEqual(gravados, []);
  assert.equal(a.temPendencia(), false);
});

test("reiniciar (recarregar a tela) desarma: a normalização do Puck volta a não gravar", async () => {
  const relogio = relogioFalso();
  const gravados = [];
  const a = criarAutosave({ gravar: async (d) => { gravados.push(d.v); }, relogio });
  a.armar();
  a.pausar();
  a.reiniciar();
  a.aoMudar({ v: "normalizado de novo" });
  relogio.passar();
  await esperar();
  assert.deepEqual(gravados, []);
  assert.equal(a.situacao, "em-dia");
});
