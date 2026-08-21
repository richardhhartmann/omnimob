import test from "node:test";
import assert from "node:assert/strict";

import { tenantRouter } from "../src/routes/tenantRoutes.js";
import {
  prisma, limparRestos, criarImobiliariaDeTeste, apagarImobiliaria, subirApi,
} from "./helpers.js";
import { normalizarAtalhos } from "../src/services/atalhos.js";

/* ────────────────────────────────────────────────────────────────────────────
   Atalhos: o que o servidor aceita gravar.

   Ele cobra FORMATO, e não a lista de ações — o catálogo mora no cliente, junto
   das telas. Uma cópia dele aqui divergiria na primeira ação nova e passaria a
   recusar, em silêncio, um atalho que a tela oferece.
   ──────────────────────────────────────────────────────────────────────────── */

test("aceita o que tem forma de atalho", () => {
  assert.deepEqual(normalizarAtalhos({ "dashboard.imoveis": "j" }), { "dashboard.imoveis": "j" });
  assert.deepEqual(normalizarAtalhos({}), {});
  assert.deepEqual(normalizarAtalhos(null), {}, "ausência é 'sem personalização'");
});

test("vazio é uma ESCOLHA, não um erro", () => {
  /* É a única forma de desligar um atalho que atrapalha. */
  assert.deepEqual(normalizarAtalhos({ "dashboard.imoveis": "" }), { "dashboard.imoveis": "" });
});

test("recusa o que não é tecla", () => {
  for (const ruim of [{ "dashboard.imoveis": "F5" }, { "dashboard.imoveis": "ab" }, { "dashboard.imoveis": 1 }]) {
    assert.equal(normalizarAtalhos(ruim), null, JSON.stringify(ruim));
  }
});

test("recusa id que não parece id de ação", () => {
  assert.equal(normalizarAtalhos({ "; DROP TABLE": "a" }), null);
  assert.equal(normalizarAtalhos({ semponto: "a" }), null);
});

test("recusa corpo que não é objeto", () => {
  assert.equal(normalizarAtalhos([1, 2]), null);
  assert.equal(normalizarAtalhos("a"), null);
});

// ─── A rota ─────────────────────────────────────────────────────────────────

let api;
let A;

test.before(async () => {
  await limparRestos();
  api = await subirApi({ "/api/tenants": tenantRouter });
  A = await criarImobiliariaDeTeste();
});

test.after(async () => {
  await api?.fechar();
  if (A) await apagarImobiliaria(A.tenant.id);
  await limparRestos();
  await prisma.$disconnect();
});

test("o administrador grava os atalhos da casa", async () => {
  const r = await api.comoTenant(A).put("/api/tenants/me/atalhos", {
    atalhos: { "dashboard.imoveis": "q" },
  });
  assert.equal(r.status, 200);

  const t = await prisma.tenant.findUnique({ where: { id: A.tenant.id }, select: { atalhos: true } });
  assert.deepEqual(t.atalhos, { "dashboard.imoveis": "q" });
});

test("sem `verConfiguracoes`, não grava", async () => {
  await prisma.cargo.update({ where: { id: A.cargoAdmin.id }, data: { verConfiguracoes: false } });
  const r = await api.comoTenant(A).put("/api/tenants/me/atalhos", { atalhos: {} });
  assert.equal(r.status, 403, "a convenção da casa é decisão de quem administra");
  await prisma.cargo.update({ where: { id: A.cargoAdmin.id }, data: { verConfiguracoes: true } });
});

test("o interruptor mestre grava sozinho, sem apagar as teclas", async () => {
  /* As duas telas gravam coisas diferentes na mesma rota: a caixa manda só
     `ativos`, o editor manda só `atalhos`. Um PUT que exigisse os dois faria
     cada tela apagar o que a outra acabou de salvar. */
  const r = await api.comoTenant(A).put("/api/tenants/me/atalhos", { ativos: false });
  assert.equal(r.status, 200);
  assert.equal(r.json.ativos, false);

  const t = await prisma.tenant.findUnique({
    where: { id: A.tenant.id },
    select: { atalhos: true, atalhosAtivos: true },
  });
  assert.equal(t.atalhosAtivos, false);
  assert.deepEqual(t.atalhos, { "dashboard.imoveis": "q" }, "as teclas continuam gravadas");

  await api.comoTenant(A).put("/api/tenants/me/atalhos", { ativos: true });
});

test("corpo vazio não é gravação silenciosa", async () => {
  const r = await api.comoTenant(A).put("/api/tenants/me/atalhos", {});
  assert.equal(r.status, 400, "PUT sem nada é engano, não uma ordem");
});

test("corpo inválido responde 400, e não grava lixo", async () => {
  const r = await api.comoTenant(A).put("/api/tenants/me/atalhos", { atalhos: { "x.y": "Enter" } });
  assert.equal(r.status, 400);

  const t = await prisma.tenant.findUnique({ where: { id: A.tenant.id }, select: { atalhos: true } });
  assert.deepEqual(t.atalhos, { "dashboard.imoveis": "q" }, "o que já estava lá continua intacto");
});
