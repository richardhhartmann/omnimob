import test from "node:test";
import assert from "node:assert/strict";

import { tenantRouter } from "../src/routes/tenantRoutes.js";
import {
  prisma, limparRestos, criarImobiliariaDeTeste, apagarImobiliaria, subirApi,
} from "./helpers.js";

/* ────────────────────────────────────────────────────────────────────────────
   O Painel do Gestor.

   ── O QUE ESTES TESTES GUARDAM ──

   1. A PORTA. É o único lugar do produto que mostra faturamento e a comissão de
      cada corretor pelo nome. `acessarPainel` não basta: um corretor tem essa
      permissão para trabalhar, e não pode ver quanto o colega ganhou. A
      permissão nasce desligada até para cargos que já existiam.

   2. O ISOLAMENTO. Números de faturamento de outra imobiliária apareceriam como
      números plausíveis — não como erro. É a forma de vazamento mais difícil de
      notar depois.

   3. AUSÊNCIA NÃO É ZERO. Ticket médio sem venda é `null`, não `R$ 0,00`.
      Conversão sem visita é `null`, não `0%`. Zero ali é uma afirmação errada
      sobre o negócio da pessoa.
   ──────────────────────────────────────────────────────────────────────────── */

let api;
let A;
let B;

const CAMINHO = "/api/tenants/me/painel-gestor";

test.before(async () => {
  await limparRestos();
  api = await subirApi({ "/api/tenants": tenantRouter });
  A = await criarImobiliariaDeTeste();
  B = await criarImobiliariaDeTeste();
});

test.after(async () => {
  await api?.fechar();
  if (A) await apagarImobiliaria(A.tenant.id);
  if (B) await apagarImobiliaria(B.tenant.id);
  await limparRestos();
  await prisma.$disconnect();
});

// ─── A porta ────────────────────────────────────────────────────────────────

test("sem `verPainelGestor`, o painel responde 403 — mesmo com acessarPainel", async () => {
  await prisma.cargo.update({
    where: { id: A.cargoAdmin.id },
    data: { verPainelGestor: false, acessarPainel: true },
  });

  const r = await api.comoTenant(A).get(CAMINHO);
  assert.equal(r.status, 403, "acessar o painel não dá direito ao faturamento");
});

test("com a permissão, o painel abre", async () => {
  await prisma.cargo.update({ where: { id: A.cargoAdmin.id }, data: { verPainelGestor: true } });

  const r = await api.comoTenant(A).get(CAMINHO);
  assert.equal(r.status, 200);
  assert.ok(r.json.hoje, "traz o bloco de hoje");
  assert.ok(r.json.mes, "traz o bloco do mês");
  assert.ok(r.json.atencao, "traz o que pede ação");
});

test("a permissão nasce DESLIGADA no cargo comum", async () => {
  /* Se ela nascesse ligada junto com `acessarPainel`, o deploy entregaria
     faturamento a todo corretor da base sem ninguém ter decidido nada. */
  const comum = await prisma.cargo.findUnique({
    where: { id: A.cargoComum.id },
    select: { acessarPainel: true, verPainelGestor: true },
  });
  assert.equal(comum.acessarPainel, true);
  assert.equal(comum.verPainelGestor, false);
});

// ─── Ausência não é zero ────────────────────────────────────────────────────

test("imobiliária sem movimento: ticket médio e conversão vêm null, não zero", async () => {
  await prisma.cargo.update({ where: { id: A.cargoAdmin.id }, data: { verPainelGestor: true } });

  const r = await api.comoTenant(A).get(CAMINHO);
  assert.equal(r.status, 200);

  assert.equal(r.json.mes.ticketMedio, null, "sem venda não existe ticket médio");
  assert.equal(r.json.mes.visitaParaLead, null, "sem visita não existe conversão");
  assert.equal(r.json.mes.variacaoFaturamento, null, "sem base não existe variação");

  /* Contagem é diferente: zero interessados hoje É zero, e a tela pode dizer. */
  assert.equal(r.json.hoje.interessados, 0);
  assert.equal(r.json.mes.faturamento, 0);
});

test("sem visita na semana, não há imóvel em destaque", async () => {
  const r = await api.comoTenant(A).get(CAMINHO);
  assert.equal(r.json.imovelDestaque, null, "melhor nada do que eleger um imóvel sem dado");
});

// ─── Isolamento ─────────────────────────────────────────────────────────────

test("o painel de A não conta nada da B", async () => {
  await prisma.cargo.update({ where: { id: A.cargoAdmin.id }, data: { verPainelGestor: true } });

  const imovelB = await prisma.property.create({
    data: {
      tenantId: B.tenant.id,
      title: "Imóvel da B",
      description: "d",
      address: "r",
      price: 500000,
      status: "ACTIVE",
    },
  });
  await prisma.propertyLead.create({
    data: { tenantId: B.tenant.id, propertyId: imovelB.id, name: "Lead da B", message: "oi" },
  });
  await prisma.propertyMetricEvent.create({
    data: { tenantId: B.tenant.id, propertyId: imovelB.id, type: "VIEW" },
  });

  const r = await api.comoTenant(A).get(CAMINHO);
  assert.equal(r.status, 200);
  assert.equal(r.json.hoje.interessados, 0, "lead da B não pode contar para A");
  assert.equal(r.json.hoje.visitas, 0, "visita da B não pode contar para A");
  assert.equal(r.json.acervo.ativos, 0, "imóvel da B não pode contar para A");
  assert.equal(r.json.imovelDestaque, null);

  await prisma.propertyMetricEvent.deleteMany({ where: { tenantId: B.tenant.id } });
  await prisma.propertyLead.deleteMany({ where: { tenantId: B.tenant.id } });
  await prisma.property.delete({ where: { id: imovelB.id } });
});

// ─── Os números de verdade ──────────────────────────────────────────────────

test("com movimento, os números batem e o destaque aparece", async () => {
  await prisma.cargo.update({ where: { id: A.cargoAdmin.id }, data: { verPainelGestor: true } });

  const imovel = await prisma.property.create({
    data: {
      tenantId: A.tenant.id,
      title: "Cobertura do teste",
      description: "d",
      address: "r",
      price: 900000,
      status: "ACTIVE",
      neighborhood: "Centro",
      city: "São Paulo",
    },
  });

  await prisma.propertyMetricEvent.createMany({
    data: Array.from({ length: 5 }, () => ({ tenantId: A.tenant.id, propertyId: imovel.id, type: "VIEW" })),
  });
  await prisma.propertyLead.createMany({
    data: Array.from({ length: 2 }, (_, i) => ({
      tenantId: A.tenant.id, propertyId: imovel.id, name: `Interessado ${i}`, message: "oi",
    })),
  });

  const r = await api.comoTenant(A).get(CAMINHO);
  assert.equal(r.status, 200);

  assert.equal(r.json.hoje.visitas, 5);
  assert.equal(r.json.hoje.interessados, 2);
  assert.equal(r.json.acervo.ativos, 1);
  assert.equal(r.json.acervo.valorEmCarteira, 900000);

  assert.ok(r.json.imovelDestaque, "com visita na semana o destaque existe");
  assert.equal(r.json.imovelDestaque.title, "Cobertura do teste");
  assert.equal(r.json.imovelDestaque.visitas, 5);
  assert.equal(r.json.imovelDestaque.local, "Centro, São Paulo");

  // 2 leads em 5 visitas = 40%
  assert.equal(r.json.mes.visitaParaLead, 40);

  /* Os dois leads chegaram sem dono e sem primeiro contato — é exatamente o
     que o bloco de atenção existe para mostrar. */
  assert.equal(r.json.atencao.leadsSemResposta, 2);
  assert.equal(r.json.atencao.leadsSemDono, 2);
  assert.equal(r.json.atencao.imoveisSemFoto, 1, "imóvel ativo sem foto não rende no portal");

  await prisma.propertyMetricEvent.deleteMany({ where: { tenantId: A.tenant.id } });
  await prisma.propertyLead.deleteMany({ where: { tenantId: A.tenant.id } });
  await prisma.property.delete({ where: { id: imovel.id } });
});
