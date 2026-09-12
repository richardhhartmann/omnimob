import test, { after } from "node:test";
import assert from "node:assert/strict";
import { prisma, limparRestos, criarImobiliariaDeTeste, apagarImobiliaria, subirApi } from "./helpers.js";
import { leadRouter } from "../src/routes/leadRoutes.js";
import { publicRouter } from "../src/routes/publicRoutes.js";

/* ── O que esta suíte guarda ─────────────────────────────────────────────────

   Três coisas novas na junção rota + query, que é onde os vazamentos moram:

     · LEAD PARADO: o contador e o filtro da imobiliária A não enxergam os
       leads esquecidos da B — e o lead recém-chegado não é "parado".
     · MOTIVO DE PERDA: perder sem motivo é recusado; o motivo gravado some
       quando o lead volta ao funil, senão o relatório somaria perdas que não
       são mais perdas.
     · FUNIL DE ATENDIMENTO: "chegou até" conta o estágio mais alto que o lead
       alcançou, inclusive o perdido; e o relatório de A não soma leads da B.
     · ORDEM DA VITRINE: destacado antes de tudo; posição manual antes de
       automática; e o resto do mais novo ao mais antigo, como sempre foi.
   ────────────────────────────────────────────────────────────────────────── */

let A, B, api, imovelA, imovelB;
const DIAS = (n) => new Date(Date.now() - n * 86_400_000);

test.before(async () => {
  await limparRestos();
  A = await criarImobiliariaDeTeste();
  B = await criarImobiliariaDeTeste();
  api = await subirApi({ "/api/leads": leadRouter, "/public": publicRouter });

  imovelA = await prisma.property.create({
    data: { tenantId: A.tenant.id, tipoImovelId: A.tipo.id, title: "Casa da A", description: "", price: 100000, address: "Rua A", status: "ACTIVE" },
  });
  imovelB = await prisma.property.create({
    data: { tenantId: B.tenant.id, tipoImovelId: B.tipo.id, title: "Casa da B", description: "", price: 200000, address: "Rua B", status: "ACTIVE" },
  });
});

after(async () => {
  await api?.fechar?.();
  await apagarImobiliaria(A?.tenant.id);
  await apagarImobiliaria(B?.tenant.id);
  await prisma.$disconnect();
});

function lead(tenant, imovel, { nome, estagio = "NOVO", criadoHa = 0, eventos = [] } = {}) {
  return prisma.propertyLead.create({
    data: {
      tenantId: tenant.id, propertyId: imovel.id, name: nome, estagio, createdAt: DIAS(criadoHa),
      eventos: { create: eventos.map((e) => ({ tenantId: tenant.id, ...e })) },
    },
  });
}

test("parado: só lead aberto e sem evento há mais que o prazo; por imobiliária", async () => {
  const recente = await lead(A.tenant, imovelA, { nome: "Recente", criadoHa: 0 });
  const esquecido = await lead(A.tenant, imovelA, { nome: "Esquecido", criadoHa: 5 });
  const tocado = await lead(A.tenant, imovelA, {
    nome: "Tocado", criadoHa: 5,
    eventos: [{ tipo: "NOTA", texto: "liguei", createdAt: DIAS(0) }],
  });
  await lead(A.tenant, imovelA, { nome: "Ganho velho", estagio: "GANHO", criadoHa: 30 });
  await lead(B.tenant, imovelB, { nome: "Esquecido da B", criadoHa: 9 });

  const comoA = api.comoTenant({ token: A.token, slug: A.slug });
  const tudo = await comoA.get("/api/leads?limit=50");
  assert.equal(tudo.status, 200);
  assert.equal(tudo.json.parados, 1, "só o esquecido da A conta; o da B não");
  assert.equal(tudo.json.horasParaParado, 48);

  const porNome = Object.fromEntries(tudo.json.leads.map((l) => [l.name, l]));
  assert.equal(porNome.Esquecido.parado, true);
  assert.equal(porNome.Recente.parado, false);
  assert.equal(porNome.Tocado.parado, false);
  assert.equal(porNome["Ganho velho"].parado, false);
  assert.equal("eventos" in porNome.Esquecido, false, "o evento usado para medir não vaza na resposta");

  const so = await comoA.get("/api/leads?parados=1");
  assert.deepEqual(so.json.leads.map((l) => l.id), [esquecido.id]);

  await prisma.propertyLead.deleteMany({ where: { id: { in: [recente.id, esquecido.id, tocado.id] } } });
});

test("perder exige motivo; voltar ao funil limpa o motivo", async () => {
  const comoA = api.comoTenant({ token: A.token, slug: A.slug });
  const l = await lead(A.tenant, imovelA, { nome: "Indeciso", estagio: "VISITA" });

  const semMotivo = await comoA.patch(`/api/leads/${l.id}`, { estagio: "PERDIDO" });
  assert.equal(semMotivo.status, 400);

  const perdido = await comoA.patch(`/api/leads/${l.id}`, { estagio: "PERDIDO", motivoPerda: "Preço acima do orçamento" });
  assert.equal(perdido.status, 200);
  assert.equal(perdido.json.motivoPerda, "Preço acima do orçamento");
  const evento = perdido.json.eventos.find((e) => e.tipo === "ESTAGIO" && e.para === "PERDIDO");
  assert.equal(evento?.texto, "Preço acima do orçamento", "o motivo fica no histórico também");

  const voltou = await comoA.patch(`/api/leads/${l.id}`, { estagio: "EM_ATENDIMENTO" });
  assert.equal(voltou.status, 200);
  assert.equal(voltou.json.motivoPerda, null);

  // O lead da B não é alcançável pela A nem pelo id real.
  const daB = await lead(B.tenant, imovelB, { nome: "Da B" });
  const cruzado = await comoA.patch(`/api/leads/${daB.id}`, { estagio: "PERDIDO", motivoPerda: "x" });
  assert.equal(cruzado.status, 404);
});

test("funil: conta até onde cada lead chegou, os motivos, e só da própria imobiliária", async () => {
  await prisma.propertyLead.deleteMany({ where: { tenantId: A.tenant.id } });
  const ev = (para, de = "NOVO") => ({ tipo: "ESTAGIO", de, para });

  await lead(A.tenant, imovelA, { nome: "Novo" });
  await lead(A.tenant, imovelA, { nome: "Atendido", estagio: "EM_ATENDIMENTO", eventos: [ev("EM_ATENDIMENTO")] });
  await lead(A.tenant, imovelA, { nome: "Visitou", estagio: "VISITA", eventos: [ev("EM_ATENDIMENTO"), ev("VISITA", "EM_ATENDIMENTO")] });
  /* Perdido depois da proposta: conta como tendo chegado até PROPOSTA, e a
     perda é atribuída a esse degrau. */
  await prisma.propertyLead.create({
    data: {
      tenantId: A.tenant.id, propertyId: imovelA.id, name: "Perdido na proposta", estagio: "PERDIDO",
      motivoPerda: "Não aprovou financiamento",
      eventos: { create: [ev("PROPOSTA"), ev("PERDIDO", "PROPOSTA")].map((e) => ({ tenantId: A.tenant.id, ...e })) },
    },
  });
  await lead(A.tenant, imovelA, { nome: "Ganhou", estagio: "GANHO", eventos: [ev("GANHO")] });
  // Ruído da B, que não pode aparecer.
  await lead(B.tenant, imovelB, { nome: "B ganhou", estagio: "GANHO" });

  const comoA = api.comoTenant({ token: A.token, slug: A.slug });
  const r = await comoA.get("/api/leads/funil?de=2020-01-01");
  assert.equal(r.status, 200);
  assert.equal(r.json.total, 5);
  assert.deepEqual(r.json.alcancaram, { NOVO: 5, EM_ATENDIMENTO: 4, VISITA: 3, PROPOSTA: 2, GANHO: 1 });
  assert.equal(r.json.perdidosPorDegrau.PROPOSTA, 1);
  assert.deepEqual(r.json.motivosPerda, [{ motivo: "Não aprovou financiamento", quantidade: 1 }]);
  assert.equal(r.json.atuais.GANHO, 1, "o ganho da B não entra");
  assert.equal(r.json.taxas.EM_ATENDIMENTO, 80);
  assert.equal(r.json.conversao, null, "abaixo de 5 encerrados não há conversão com significado");
  assert.equal(r.json.porResponsavel[0].nome, "Sem responsável");
  assert.equal(r.json.porResponsavel[0].total, 5);
});

test("vitrine: destacado primeiro, depois posição manual, depois o mais novo", async () => {
  await prisma.property.deleteMany({ where: { tenantId: A.tenant.id } });
  const criar = (title, extra, criadoHa) => prisma.property.create({
    data: { tenantId: A.tenant.id, tipoImovelId: A.tipo.id, title, description: "", price: 1, address: "x", status: "ACTIVE", createdAt: DIAS(criadoHa), ...extra },
  });
  await criar("Velho sem posição", {}, 10);
  await criar("Novo sem posição", {}, 1);
  await criar("Posição 2", { ordemVitrine: 2 }, 20);
  await criar("Posição 1", { ordemVitrine: 1 }, 30);
  await criar("Destaque velho", { destaque: true }, 40);
  await criar("Destaque na posição 1", { destaque: true, ordemVitrine: 1 }, 50);

  const r = await fetch(`${api.base}/public/${A.slug}/properties`).then((x) => x.json());
  const lista = Array.isArray(r) ? r : r.properties;
  assert.deepEqual(lista.map((p) => p.title), [
    "Destaque na posição 1",
    "Destaque velho",
    "Posição 1",
    "Posição 2",
    "Novo sem posição",
    "Velho sem posição",
  ]);
  assert.equal(lista[0].destaque, true, "a vitrine recebe o campo para desenhar o selo");
});
