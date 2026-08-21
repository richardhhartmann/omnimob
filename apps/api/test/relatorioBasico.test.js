import test from "node:test";
import assert from "node:assert/strict";

import { tenantRouter } from "../src/routes/tenantRoutes.js";
import {
  prisma, limparRestos, criarImobiliariaDeTeste, apagarImobiliaria, subirApi,
} from "./helpers.js";

/* ────────────────────────────────────────────────────────────────────────────
   O relatório mensal no plano Básico.

   VER é do Básico — a tabela de recursos vende "Relatórios e métricas de
   desempenho" nele. MANDAR POR E-MAIL é que começa no Profissional, e é onde
   está o custo real.

   As duas rotas exigiam Profissional. Esconder o botão na tela não bastava: a
   consulta continuava voltando 403, e o Básico via "Recurso disponível a partir
   do plano Profissional" no lugar do relatório inteiro.
   ──────────────────────────────────────────────────────────────────────────── */

let api;
let basico;
let pro;

test.before(async () => {
  await limparRestos();
  api = await subirApi({ "/api/tenants": tenantRouter });
  basico = await criarImobiliariaDeTeste({ plano: "BASICO" });
  pro = await criarImobiliariaDeTeste({ plano: "PROFISSIONAL" });
});

test.after(async () => {
  await api?.fechar();
  if (basico) await apagarImobiliaria(basico.tenant.id);
  if (pro) await apagarImobiliaria(pro.tenant.id);
  await limparRestos();
  await prisma.$disconnect();
});

test("o Básico CONSULTA o relatório mensal", async () => {
  const r = await api.comoTenant(basico).get("/api/tenants/me/relatorio-mensal");
  assert.equal(r.status, 200, "ver o relatório na tela é do Básico");
  assert.ok(r.json, "e vem relatório de verdade, não um aviso de plano");
});

test("o Básico NÃO manda por e-mail", async () => {
  const r = await api.comoTenant(basico).post("/api/tenants/me/relatorio-mensal/enviar", {});
  assert.equal(r.status, 403, "o envio é o que sobe de plano");
});

test("o Profissional faz as duas coisas", async () => {
  const ver = await api.comoTenant(pro).get("/api/tenants/me/relatorio-mensal");
  assert.equal(ver.status, 200);

  const enviar = await api.comoTenant(pro).post("/api/tenants/me/relatorio-mensal/enviar", {});
  assert.notEqual(enviar.status, 403, "não pode ser barrado por plano");
});
