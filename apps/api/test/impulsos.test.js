import test, { after } from "node:test";
import assert from "node:assert/strict";
import { subirApi, criarImobiliariaDeTeste, apagarImobiliaria } from "./helpers.js";
import { prisma } from "../src/db.js";
import { tenantRouter } from "../src/routes/tenantRoutes.js";
import { registrarPagamento } from "../src/services/pagamentos.js";
import {
  consumir,
  creditarAvulsos,
  estornar,
  saldoDoTenant,
  limiteDoPlano,
  ErroDeImpulso,
} from "../src/services/impulsos.js";

/* ── O que esta suíte guarda ─────────────────────────────────────────────────

   O saldo de impulsos é dinheiro com outro nome: cada impulso é um anúncio
   pago. Os defeitos que importam são os silenciosos:

     · RECARREGAR ERRADO: somar em vez de voltar ao limite (20 + 50 = 70, e não
       50), ou recarregar três vezes porque o webhook chegou três vezes;
     · GASTAR DA ORIGEM ERRADA: consumir o avulso antes do plano faz a
       imobiliária perder, na virada, o que ela pagou à parte;
     · VAZAR: o saldo de A lido — ou gasto — em nome de B.

   Integração contra o banco, como as outras: a idempotência mora numa chave
   única, e a chave única só existe no banco.
   ────────────────────────────────────────────────────────────────────────── */

const PREFIXO = `zz-teste-${process.pid}-imp`;

async function criarTenant(sufixo, plano = "PROFISSIONAL", saldo = {}) {
  return prisma.tenant.create({
    data: {
      name: `Teste impulsos ${sufixo}`,
      slug: `${PREFIXO}-${sufixo}`,
      email: `${PREFIXO}-${sufixo}@exemplo.test`,
      statusPagamento: "EM_DIA",
      plano,
      ...saldo,
    },
  });
}

async function saldo(tenantId) {
  const s = await saldoDoTenant(tenantId);
  return { doPlano: s.doPlano, avulsos: s.avulsos };
}

let apiT;

test.before(async () => {
  apiT = await subirApi({ "/api/tenants": tenantRouter });
});

after(async () => {
  await apiT?.fechar?.();
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: PREFIXO } } });
  await prisma.$disconnect();
});

test("o exemplo da tarefa: 20 do plano + 100 avulsos, paga → 50 + 100", async () => {
  /* O caso escrito na tarefa, ao pé da letra. O que se testa é que o plano
     VOLTA ao limite (50, e não 20 + 50) e que o avulso não é tocado. */
  const t = await criarTenant("exemplo", "PROFISSIONAL", { impulsosDoPlano: 20, impulsosAvulsos: 100 });

  await registrarPagamento({
    tenantId: t.id, provedor: "STRIPE", meio: "cartao", valor: 149,
    plano: "PROFISSIONAL", periodo: "mensal", externoId: `in_${t.id}`,
  });

  assert.deepEqual(await saldo(t.id), { doPlano: 50, avulsos: 100 });
  assert.equal((await saldoDoTenant(t.id)).total, 150);
});

test("o mesmo pagamento chegando três vezes recarrega UMA", async () => {
  /* Recarregar é um SET, então o saldo nem mudaria — mas consumir no meio do
     caminho mostra o defeito: sem a chave única, a segunda chegada do webhook
     devolveria o impulso que acabou de ser gasto. */
  const t = await criarTenant("idem");
  const base = {
    tenantId: t.id, provedor: "MERCADO_PAGO", meio: "pix", valor: 891,
    plano: "PROFISSIONAL", periodo: "mensal", externoId: `pix-${t.id}`,
  };

  await registrarPagamento(base);
  await consumir(t.id);
  await registrarPagamento(base);
  await registrarPagamento(base);

  assert.deepEqual(await saldo(t.id), { doPlano: 49, avulsos: 0 });
  const creditos = await prisma.impulsoMovimento.count({ where: { tenantId: t.id, tipo: "CREDITO_PLANO" } });
  assert.equal(creditos, 1, "o mesmo pagamento recarregou mais de uma vez");
});

test("pagamento pendente não recarrega; quando vira PAGO, recarrega", async () => {
  const t = await criarTenant("pendente", "PREMIUM");
  const base = {
    tenantId: t.id, provedor: "STRIPE", valor: 299, plano: "PREMIUM", externoId: `in_pend_${t.id}`,
  };

  await registrarPagamento({ ...base, status: "PENDENTE" });
  assert.deepEqual(await saldo(t.id), { doPlano: 0, avulsos: 0 });

  await registrarPagamento({ ...base, status: "PAGO" });
  assert.deepEqual(await saldo(t.id), { doPlano: 100, avulsos: 0 });
});

test("ativação manual (sem id externo) também recarrega, e cada uma é uma recarga", async () => {
  const t = await criarTenant("manual", "PROFISSIONAL", { impulsosDoPlano: 3 });
  await registrarPagamento({ tenantId: t.id, provedor: "MANUAL", meio: "manual", valor: 149, plano: "PROFISSIONAL" });
  assert.deepEqual(await saldo(t.id), { doPlano: 50, avulsos: 0 });
});

test("o plano é o do PAGAMENTO; sem ele, o do tenant", async () => {
  /* O pagamento congela o que foi comprado. Quem chama sem dizer o plano cai
     no plano atual da conta. */
  const t = await criarTenant("plano", "PROFISSIONAL");
  await registrarPagamento({ tenantId: t.id, provedor: "STRIPE", valor: 299, plano: "PREMIUM", externoId: `in_a_${t.id}` });
  assert.equal((await saldo(t.id)).doPlano, 100);

  await registrarPagamento({ tenantId: t.id, provedor: "STRIPE", valor: 149, externoId: `in_b_${t.id}` });
  assert.equal((await saldo(t.id)).doPlano, 50);
});

test("plano Básico recarrega para zero — e ainda assim deixa rastro", async () => {
  assert.equal(limiteDoPlano(null), 0);
  assert.equal(limiteDoPlano("BASICO"), 0);

  /* Quem desceu de plano com saldo sobrando perde o do plano na virada — é a
     mesma regra de "não acumula". O avulso, que foi pago à parte, fica. */
  const t = await criarTenant("basico", "BASICO", { impulsosDoPlano: 30, impulsosAvulsos: 5 });
  await registrarPagamento({ tenantId: t.id, provedor: "STRIPE", valor: 49, plano: "BASICO", externoId: `in_${t.id}` });

  assert.deepEqual(await saldo(t.id), { doPlano: 0, avulsos: 5 });
  const [mov] = (await saldoDoTenant(t.id)).movimentos;
  assert.equal(mov.tipo, "CREDITO_PLANO");
  assert.equal(mov.deltaPlano, -30);
});

test("consumir gasta primeiro o do plano, depois o avulso, e para no zero", async () => {
  const t = await criarTenant("consumo", "PROFISSIONAL", { impulsosDoPlano: 1, impulsosAvulsos: 1 });

  const primeiro = await consumir(t.id, { referencia: "imovel-1" });
  assert.equal(primeiro.deltaPlano, -1);
  assert.deepEqual(await saldo(t.id), { doPlano: 0, avulsos: 1 });

  const segundo = await consumir(t.id, { referencia: "imovel-2" });
  assert.equal(segundo.deltaAvulsos, -1);
  assert.deepEqual(await saldo(t.id), { doPlano: 0, avulsos: 0 });

  await assert.rejects(
    () => consumir(t.id),
    (e) => e instanceof ErroDeImpulso && e.codigo === "SEM_SALDO",
  );
  /* E o saldo não ficou negativo, nem o extrato ganhou linha da tentativa. */
  assert.deepEqual(await saldo(t.id), { doPlano: 0, avulsos: 0 });
  assert.equal(await prisma.impulsoMovimento.count({ where: { tenantId: t.id, tipo: "CONSUMO" } }), 2);
});

test("dois consumos ao mesmo tempo com UM impulso sobrando: só um passa", async () => {
  const t = await criarTenant("corrida", "PROFISSIONAL", { impulsosDoPlano: 1 });
  const resultados = await Promise.allSettled([consumir(t.id), consumir(t.id), consumir(t.id)]);

  assert.equal(resultados.filter((r) => r.status === "fulfilled").length, 1);
  assert.deepEqual(await saldo(t.id), { doPlano: 0, avulsos: 0 });
});

test("compra avulsa soma, e o mesmo pagamento não compra duas vezes", async () => {
  const t = await criarTenant("compra", "PROFISSIONAL", { impulsosAvulsos: 10 });
  const pagamento = await prisma.pagamento.create({
    data: { tenantId: t.id, provedor: "STRIPE", status: "PAGO", valor: 50, externoId: `cs_${t.id}` },
  });

  await creditarAvulsos(t.id, 100, { pagamentoId: pagamento.id });
  assert.equal(await creditarAvulsos(t.id, 100, { pagamentoId: pagamento.id }), null);

  assert.deepEqual(await saldo(t.id), { doPlano: 0, avulsos: 110 });
  await assert.rejects(() => creditarAvulsos(t.id, 0), ErroDeImpulso);
  await assert.rejects(() => creditarAvulsos(t.id, 2.5), ErroDeImpulso);
});

test("estorno devolve para a MESMA origem, uma vez só", async () => {
  const t = await criarTenant("estorno", "PROFISSIONAL", { impulsosDoPlano: 1, impulsosAvulsos: 1 });
  const doPlano = await consumir(t.id);
  const doAvulso = await consumir(t.id);

  await estornar(t.id, doAvulso.id);
  assert.deepEqual(await saldo(t.id), { doPlano: 0, avulsos: 1 }, "o avulso voltou para o lugar errado");

  await estornar(t.id, doPlano.id);
  assert.deepEqual(await saldo(t.id), { doPlano: 1, avulsos: 1 });

  /* Devolver duas vezes o mesmo consumo daria um impulso de graça. */
  assert.equal(await estornar(t.id, doPlano.id), null);
  assert.deepEqual(await saldo(t.id), { doPlano: 1, avulsos: 1 });
});

test("estorno de um impulso do plano depois da recarga não passa do limite", async () => {
  const t = await criarTenant("estorno-virada", "PROFISSIONAL", { impulsosDoPlano: 5 });
  const consumo = await consumir(t.id);
  /* O `createdAt` do extrato tem milissegundo; a recarga precisa vir DEPOIS. */
  await new Promise((r) => setTimeout(r, 15));
  await registrarPagamento({ tenantId: t.id, provedor: "STRIPE", valor: 149, plano: "PROFISSIONAL", externoId: `in_${t.id}` });

  const devolucao = await estornar(t.id, consumo.id);
  assert.equal(devolucao.deltaPlano, 0);
  assert.deepEqual(await saldo(t.id), { doPlano: 50, avulsos: 0 });
});

test("A não gasta nem devolve o saldo da B, nem pelo id real", async () => {
  const a = await criarTenant("iso-a", "PROFISSIONAL", { impulsosDoPlano: 5 });
  const b = await criarTenant("iso-b", "PROFISSIONAL", { impulsosDoPlano: 5 });

  const consumoDeB = await consumir(b.id);
  await assert.rejects(
    () => estornar(a.id, consumoDeB.id),
    (e) => e.codigo === "CONSUMO_INEXISTENTE",
  );
  assert.deepEqual(await saldo(a.id), { doPlano: 5, avulsos: 0 });
  assert.deepEqual(await saldo(b.id), { doPlano: 4, avulsos: 0 });
});

test("apagar a imobiliária leva o extrato junto", async () => {
  const t = await criarTenant("cascata", "PROFISSIONAL", { impulsosDoPlano: 2 });
  await consumir(t.id);
  await prisma.tenant.delete({ where: { id: t.id } });
  assert.equal(await prisma.impulsoMovimento.count({ where: { tenantId: t.id } }), 0);
});

/* ── A rota que a tela vai ler ─────────────────────────────────────────────── */
test("a rota do saldo: A não vê nada da B, e sem permissão não abre", async () => {
  const A = await criarImobiliariaDeTeste({ plano: "PROFISSIONAL" });
  const B = await criarImobiliariaDeTeste({ plano: "PREMIUM" });

  await prisma.tenant.update({ where: { id: A.tenant.id }, data: { impulsosDoPlano: 7, impulsosAvulsos: 3 } });
  await prisma.tenant.update({ where: { id: B.tenant.id }, data: { impulsosDoPlano: 91, impulsosAvulsos: 0 } });
  await consumir(B.tenant.id, { referencia: `ref-da-b-${B.tenant.id}` });

  const comoA = apiT.comoTenant({ token: A.token, slug: A.slug });
  const r = await comoA.get("/api/tenants/me/impulsos");
  assert.equal(r.status, 200);
  assert.equal(r.json.doPlano, 7);
  assert.equal(r.json.avulsos, 3);
  assert.equal(r.json.total, 10);
  assert.equal(r.json.limiteDoPlano, 50);
  assert.equal(r.json.movimentos.length, 0);
  assert.ok(!JSON.stringify(r.json).includes(`ref-da-b-${B.tenant.id}`), "o extrato da outra imobiliária vazou");

  /* O cargo comum não publica nas redes nem vê a cobrança: 403, mesmo
     chamando o endereço direto. */
  await prisma.usuario.update({ where: { id: A.usuario.id }, data: { cargoCodigo: A.cargoComum.id } });
  const r2 = await comoA.get("/api/tenants/me/impulsos");
  assert.equal(r2.status, 403);

  await Promise.all([apagarImobiliaria(A.tenant.id), apagarImobiliaria(B.tenant.id)]);
});
