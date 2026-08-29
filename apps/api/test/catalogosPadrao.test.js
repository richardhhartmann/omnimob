import test, { after } from "node:test";
import assert from "node:assert/strict";
import {
  prisma, limparRestos, criarImobiliariaDeTeste, apagarImobiliaria, subirApi,
} from "./helpers.js";
import { tenantRouter } from "../src/routes/tenantRoutes.js";
import { CARGO_ADMIN } from "../src/services/cargosPadrao.js";
import { TIPOS_IMOVEL } from "../src/services/tiposPadrao.js";

/* ── O catálogo que deixou de vir de fábrica ─────────────────────────────────

   Sete cargos e dezenove tipos de imóvel nasciam com toda conta. Agora nascem a
   pedido, no assistente de primeiro acesso — e a rota que os cria pode ser
   chamada por quem já tem metade deles criados à mão.

   O que este arquivo guarda é a diferença entre "criar o catálogo" e
   "SOBRESCREVER o que a pessoa fez". Chamar duas vezes, ou chamar numa conta
   que já tem "Corretor", não pode produzir um segundo Corretor: `Cargo` não tem
   chave única em `descricao`, então o banco aceitaria a duplicata calado e
   ninguém veria o defeito até a tela de cargos mostrar dois iguais.
   ────────────────────────────────────────────────────────────────────────── */

let api;

test.before(async () => {
  await limparRestos();
  api = await subirApi({ "/api/tenants": tenantRouter });
});

after(async () => {
  await api?.fechar?.();
  await prisma.$disconnect();
});

const cargosDe = (tenantId) =>
  prisma.cargo.findMany({ where: { tenantId }, select: { descricao: true } });

test("o catálogo de cargos só ACRESCENTA o que falta", async () => {
  /* A imobiliária de teste já nasce com Administrador e Corretor — os dois
     estão no catálogo, e é justamente o caso que não pode duplicar. */
  const A = await criarImobiliariaDeTeste();
  const como = api.comoTenant({ token: A.token, slug: A.slug });

  const r = await como.post("/api/tenants/me/catalogos-padrao", { cargos: true });
  assert.equal(r.status, 200, JSON.stringify(r.json));

  const nomes = (await cargosDe(A.tenant.id)).map((c) => c.descricao);
  assert.equal(nomes.length, new Set(nomes).size, `duplicou: ${nomes.join(", ")}`);
  assert.ok(nomes.includes("Gerente"), "o catálogo entrou");
  assert.equal(nomes.filter((n) => n === "Corretor").length, 1, "o Corretor que já existia continua único");
  assert.equal(nomes.filter((n) => n === CARGO_ADMIN).length, 1);

  await apagarImobiliaria(A.tenant.id);
});

test("chamar duas vezes não cria nada na segunda", async () => {
  const A = await criarImobiliariaDeTeste();
  const como = api.comoTenant({ token: A.token, slug: A.slug });

  await como.post("/api/tenants/me/catalogos-padrao", { cargos: true, tipos: true });
  const depoisDaPrimeira = await cargosDe(A.tenant.id);

  const r = await como.post("/api/tenants/me/catalogos-padrao", { cargos: true, tipos: true });
  assert.equal(r.status, 200);
  /* A resposta diz quantos CRIOU, e a segunda chamada não cria nenhum. É por
     ela que a tela sabe o que aconteceu. */
  assert.deepEqual(r.json, { cargos: 0, tipos: 0 });

  const depoisDaSegunda = await cargosDe(A.tenant.id);
  assert.equal(depoisDaSegunda.length, depoisDaPrimeira.length);

  await apagarImobiliaria(A.tenant.id);
});

test("os tipos de imóvel vêm com os atributos, e o que já existia fica de pé", async () => {
  const A = await criarImobiliariaDeTeste();
  const como = api.comoTenant({ token: A.token, slug: A.slug });

  const r = await como.post("/api/tenants/me/catalogos-padrao", { tipos: true });
  assert.equal(r.status, 200, JSON.stringify(r.json));

  const tipos = await prisma.tipoImovel.findMany({
    where: { tenantId: A.tenant.id },
    select: { descricao: true, atributos: { select: { id: true } } },
  });
  const nomes = tipos.map((t) => t.descricao);
  assert.equal(nomes.length, new Set(nomes).size, "tipo duplicado");
  assert.equal(nomes.length, TIPOS_IMOVEL.length, "a Casa que já existia não virou uma segunda Casa");
  /* Tipo sem atributo nenhum seria um catálogo pela metade: o cadastro de
     imóvel abriria a categoria e não teria o que marcar. */
  assert.ok(tipos.some((t) => t.atributos.length > 0), "os atributos vieram junto");

  await apagarImobiliaria(A.tenant.id);
});

test("sem marcar nada, não cria nada", async () => {
  /* Desmarcar as duas chaves no assistente é uma escolha legítima — quem tem o
     próprio arranjo quer a conta limpa. O corpo vazio não pode ser lido como
     "faça tudo". */
  const A = await criarImobiliariaDeTeste();
  const como = api.comoTenant({ token: A.token, slug: A.slug });
  const antes = (await cargosDe(A.tenant.id)).length;

  const r = await como.post("/api/tenants/me/catalogos-padrao", {});
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { cargos: 0, tipos: 0 });
  assert.equal((await cargosDe(A.tenant.id)).length, antes);
  assert.equal(await prisma.tipoImovel.count({ where: { tenantId: A.tenant.id } }), 1);

  await apagarImobiliaria(A.tenant.id);
});

test("o catálogo de uma imobiliária não encosta na outra", async () => {
  const A = await criarImobiliariaDeTeste();
  const B = await criarImobiliariaDeTeste();
  const antesDeB = await cargosDe(B.tenant.id);

  const r = await api.comoTenant({ token: A.token, slug: A.slug })
    .post("/api/tenants/me/catalogos-padrao", { cargos: true, tipos: true });
  assert.equal(r.status, 200);

  assert.equal((await cargosDe(B.tenant.id)).length, antesDeB.length);
  assert.equal(await prisma.tipoImovel.count({ where: { tenantId: B.tenant.id } }), 1);

  await apagarImobiliaria(A.tenant.id);
  await apagarImobiliaria(B.tenant.id);
});
