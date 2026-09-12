import test from "node:test";
import assert from "node:assert/strict";
import { corteDeParado, filtroDeParados, ultimoToque, marcarParados, HORAS_PADRAO } from "../src/services/leadsParados.js";
import { emailLeadsParados } from "../src/services/emailTemplates.js";

/* ── O que esta suíte guarda ─────────────────────────────────────────────────

   A régua de "lead parado" — e os dois jeitos de ela errar são opostos e os
   dois silenciosos: apontar de menos deixa o lead esquecido em silêncio;
   apontar de mais (um lead recém-chegado, um lead já ganho) ensina a equipe a
   ignorar o selo, e aí o esquecido de verdade passa junto.

   Não toca no banco: a regra é função pura de propósito, para a lista, o
   contador, o filtro e o e-mail fazerem a mesma pergunta ao mesmo lugar.
   ────────────────────────────────────────────────────────────────────────── */

const AGORA = new Date("2026-09-11T12:00:00Z");
const h = (n) => new Date(AGORA.getTime() - n * 3_600_000);

test("corte: X horas antes de agora; prazo inválido cai no padrão", () => {
  assert.equal(corteDeParado(48, AGORA).toISOString(), h(48).toISOString());
  assert.equal(corteDeParado(0, AGORA).toISOString(), h(HORAS_PADRAO).toISOString());
  assert.equal(corteDeParado("abc", AGORA).toISOString(), h(HORAS_PADRAO).toISOString());
});

test("filtro: só aberto, criado antes do corte, sem evento depois do corte", () => {
  const f = filtroDeParados({ horas: 24, agora: AGORA });
  assert.deepEqual(f.estagio, { notIn: ["GANHO", "PERDIDO"] });
  assert.equal(f.createdAt.lt.toISOString(), h(24).toISOString());
  assert.equal(f.eventos.none.createdAt.gte.toISOString(), h(24).toISOString());
});

test("último toque: o evento mais recente, ou a chegada quando não há evento", () => {
  assert.deepEqual(ultimoToque({ createdAt: h(10), eventos: [] }), h(10));
  assert.deepEqual(ultimoToque({ createdAt: h(10), eventos: [{ createdAt: h(2) }] }), h(2));
  // Evento anterior à criação não existe na prática, mas o maior dos dois ganha.
  assert.deepEqual(ultimoToque({ createdAt: h(1), eventos: [{ createdAt: h(5) }] }), h(1));
});

test("marcar: parado é aberto E sem toque há mais que o prazo; encerrado nunca", () => {
  const leads = [
    { id: "novo-recente", estagio: "NOVO", createdAt: h(3), eventos: [] },
    { id: "novo-velho", estagio: "NOVO", createdAt: h(80), eventos: [] },
    { id: "tocado-ontem", estagio: "VISITA", createdAt: h(200), eventos: [{ createdAt: h(20) }] },
    { id: "tocado-ha-muito", estagio: "PROPOSTA", createdAt: h(200), eventos: [{ createdAt: h(100) }] },
    { id: "ganho-velho", estagio: "GANHO", createdAt: h(500), eventos: [] },
    { id: "perdido-velho", estagio: "PERDIDO", createdAt: h(500), eventos: [] },
  ];
  const marcados = marcarParados(leads, { horas: 48, agora: AGORA });
  const parado = Object.fromEntries(marcados.map((l) => [l.id, l.parado]));

  assert.equal(parado["novo-recente"], false);
  assert.equal(parado["novo-velho"], true);
  assert.equal(parado["tocado-ontem"], false);
  assert.equal(parado["tocado-ha-muito"], true);
  assert.equal(parado["ganho-velho"], false, "ganho fica parado para sempre por definição — não conta");
  assert.equal(parado["perdido-velho"], false);

  /* O array de eventos sai da resposta: a tela decide se busca o histórico
     completo pela AUSÊNCIA dele, e um array de um elemento a enganaria. */
  for (const l of marcados) assert.equal("eventos" in l, false);
  assert.deepEqual(marcados[3].ultimoToqueEm, h(100));
});

test("marcar: no limite exato do prazo ainda não é parado", () => {
  const [l] = marcarParados([{ id: "x", estagio: "NOVO", createdAt: h(48), eventos: [] }], { horas: 48, agora: AGORA });
  assert.equal(l.parado, false);
});

test("e-mail: assunto diz quantos e o prazo em dias quando for múltiplo de 24h", () => {
  const um = emailLeadsParados({ imobiliaria: "Casa Nobre", horas: 48, leads: [{ nome: "Ana", contato: "11 9", imovel: "Casa", responsavel: "", horas: 70 }], base: "https://omnimob.app" });
  assert.match(um.subject, /^1 lead sem atendimento há mais de 2 dias/);
  assert.match(um.body, /sem responsável/);
  assert.match(um.body, /relatorios\?ver=leads&parados=1/);
  assert.match(um.html, /Ver os leads parados/);

  const varios = emailLeadsParados({ imobiliaria: "Casa Nobre", horas: 36, leads: [{ nome: "A", horas: 40 }, { nome: "B", horas: 50 }], base: "" });
  assert.match(varios.subject, /^2 leads sem atendimento há mais de 36 horas/);
});
