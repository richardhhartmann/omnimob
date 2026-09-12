import test from "node:test";
import assert from "node:assert/strict";
import { lerPedidoDeVisita } from "../src/services/pedidoDeVisita.js";

/* ── O que esta suíte guarda ─────────────────────────────────────────────────
   O pedido de visita é validado no servidor, e a data é comparada no
   calendário de SÃO PAULO — em UTC, às 22h de Brasília o servidor já está no
   dia seguinte e recusaria "hoje" como passado. Não toca no banco. */

// 22h30 de Brasília, dia 11 — em UTC já é dia 12 à 1h30.
const AGORA = new Date("2026-09-12T01:30:00Z");

test("sem pedido, nada: o formulário comum continua igual", () => {
  assert.equal(lerPedidoDeVisita(undefined), null);
  assert.equal(lerPedidoDeVisita(null), null);
  assert.equal(lerPedidoDeVisita("x"), null);
});

test("pedido válido vira texto legível em português", () => {
  const r = lerPedidoDeVisita({ data: "2026-09-15", periodo: "tarde" }, AGORA);
  assert.equal(r.ok, true);
  assert.equal(r.texto, "Visita: 15/09/2026, à tarde");
  assert.equal(lerPedidoDeVisita({ data: "2026-09-15", periodo: "manha" }, AGORA).texto, "Visita: 15/09/2026, de manhã");
});

test("hoje em Brasília ainda é hoje, mesmo com o servidor em UTC no dia seguinte", () => {
  assert.equal(lerPedidoDeVisita({ data: "2026-09-11", periodo: "noite" }, AGORA).ok, true);
  assert.equal(lerPedidoDeVisita({ data: "2026-09-10", periodo: "noite" }, AGORA).ok, false);
});

test("recusa: data inválida, período inválido, passado e longe demais", () => {
  assert.match(lerPedidoDeVisita({ data: "15/09/2026", periodo: "tarde" }, AGORA).erro, /data/);
  assert.match(lerPedidoDeVisita({ data: "2026-09-15", periodo: "madrugada" }, AGORA).erro, /período/);
  assert.match(lerPedidoDeVisita({ data: "2026-01-01", periodo: "tarde" }, AGORA).erro, /já passou/);
  assert.match(lerPedidoDeVisita({ data: "2027-06-01", periodo: "tarde" }, AGORA).erro, /90 dias/);
});
