import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { prisma, PREFIXO, criarImobiliariaDeTeste, apagarImobiliaria, subirApi } from "./helpers.js";
import { comunicadoRouter } from "../src/routes/comunicadoRoutes.js";
import { authRouter } from "../src/routes/authRoutes.js";
import { adminRouter } from "../src/routes/adminRoutes.js";
import { rotaDoRecurso } from "../src/services/aiService.js";
import { deveRegistrarUso, dispositivoDe } from "../src/services/sessoes.js";

/* ────────────────────────────────────────────────────────────────────────────
   O resto do painel do VYA: comunicado avulso, pedido de e-mail, contas e
   acesso (as sessões) e o consumo de IA por imobiliária.

   Os riscos: o aviso de um cliente aparecendo para outro; a pessoa TROCAR o
   e-mail de recuperação pelo pedido (só preencher é permitido); e a sessão
   encerrada pelo suporte continuar valendo.
   ──────────────────────────────────────────────────────────────────────────── */

const JWT_SECRET = process.env.JWT_SECRET || "omnimob-dev-secret";
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

test("regras puras: recurso da IA, cadência da sessão, aparelho", () => {
  assert.equal(rotaDoRecurso("POST /api/properties/cmvu1f1ml0005u230yr3105hu/ai/gerar"), "POST /api/properties/:id/ai/gerar");
  assert.equal(rotaDoRecurso("POST /api/leads/42/ia"), "POST /api/leads/:id/ia");
  assert.equal(deveRegistrarUso("jti-x", 1000), true);
  assert.equal(deveRegistrarUso("jti-x", 1000 + 60_000), false, "de 5 em 5 minutos");
  assert.equal(deveRegistrarUso("jti-x", 1000 + 6 * 60_000), true);
  assert.equal(deveRegistrarUso(undefined), false, "token antigo, sem jti, não vira sessão");
  assert.equal(dispositivoDe("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit Version/17.0 Mobile Safari/604.1"), "Safari no iPhone");
});

test("contas e comunicados", async (t) => {
  const A = await criarImobiliariaDeTeste();
  const B = await criarImobiliariaDeTeste();
  const cargo = await prisma.cargoSuperAdmin.create({
    data: { nome: `${PREFIXO}Suporte`, verComunicados: true, verEmails: true, verAcessos: true, verUso: true },
  });
  const cargoChefe = await prisma.cargoSuperAdmin.create({ data: { nome: `${PREFIXO}Chefe`, verAcessos: true, encerrarSessoes: true } });
  const suporte = await prisma.superAdmin.create({ data: { nome: `${PREFIXO}sup`, email: `${PREFIXO}sup@exemplo.test`, senha: "x", cargoId: cargo.id } });
  const chefe = await prisma.superAdmin.create({ data: { nome: `${PREFIXO}chefe`, email: `${PREFIXO}chefe@exemplo.test`, senha: "x", cargoId: cargoChefe.id } });

  const api = await subirApi({ "/api/comunicados": comunicadoRouter, "/api/auth": authRouter, "/api/admin": adminRouter });
  const admin = (sa) => api.comoTenant({ token: jwt.sign({ role: "SUPERADMIN", superAdminId: sa.id, email: sa.email }, JWT_SECRET, { expiresIn: "10m" }), slug: "" });
  const deA = api.comoTenant({ token: A.token, slug: A.slug });
  const deB = api.comoTenant({ token: B.token, slug: B.slug });

  t.after(async () => {
    await api.fechar();
    await prisma.comunicado.deleteMany({ where: { criadoPor: { startsWith: PREFIXO } } });
    await apagarImobiliaria(A.tenant.id);
    await apagarImobiliaria(B.tenant.id);
    await prisma.superAdmin.deleteMany({ where: { email: { startsWith: PREFIXO } } });
    await prisma.cargoSuperAdmin.deleteMany({ where: { nome: { startsWith: PREFIXO } } });
  });

  await t.test("o comunicado de um cliente não aparece para outro, e abre uma vez", async () => {
    assert.equal((await admin(chefe).post("/api/admin/comunicados", { titulo: "x", texto: "y" })).status, 403);
    const soDeA = await admin(suporte).post("/api/admin/comunicados", { titulo: "Manutenção", texto: "Sábado às 22h.", tenantId: A.tenant.id });
    assert.equal(soDeA.status, 201, JSON.stringify(soDeA.json));
    const pendA = await deA.get("/api/comunicados/pendente");
    assert.equal(pendA.json.comunicado?.id, soDeA.json.id);
    assert.equal((await deB.get("/api/comunicados/pendente")).json.comunicado, null);
    // B não marca o de A nem com o id real.
    assert.equal((await deB.post(`/api/comunicados/${soDeA.json.id}/visto`)).status, 404);
    assert.equal((await deA.post(`/api/comunicados/${soDeA.json.id}/visto`)).status, 204);
    assert.equal((await deA.get("/api/comunicados/pendente")).json.comunicado, null, "não volta");

    const lista = await admin(suporte).get("/api/admin/comunicados");
    assert.equal(lista.json.comunicados.find((c) => c.id === soDeA.json.id).vistos, 1);
  });

  await t.test("encerrado não abre mais", async () => {
    const todos = await admin(suporte).post("/api/admin/comunicados", { titulo: "Para todos", texto: "Aviso geral." });
    assert.equal((await deB.get("/api/comunicados/pendente")).json.comunicado?.id, todos.json.id);
    assert.equal((await admin(suporte).post(`/api/admin/comunicados/${todos.json.id}/encerrar`)).status, 200);
    assert.equal((await deB.get("/api/comunicados/pendente")).json.comunicado, null);
  });

  await t.test("o pedido de e-mail só preenche, nunca troca", async () => {
    await prisma.usuario.update({ where: { id: A.usuario.id }, data: { email: null } });
    const emails = await admin(suporte).get(`/api/admin/emails?tenantId=${A.tenant.id}`);
    assert.equal(emails.status, 200, JSON.stringify(emails.json));
    assert.ok(emails.json.semEmail.some((u) => u.id === A.usuario.id));

    assert.equal((await deA.put("/api/auth/meu-email", { email: "nao-e-email" })).status, 400);
    const ok = await deA.put("/api/auth/meu-email", { email: `${PREFIXO}novo@exemplo.test` });
    assert.equal(ok.status, 200, JSON.stringify(ok.json));
    assert.equal((await deA.put("/api/auth/meu-email", { email: `${PREFIXO}outro@exemplo.test` })).status, 409, "trocar é do administrador");
  });

  await t.test("a sessão aparece no primeiro uso, e encerrar derruba na hora", async () => {
    const jti = randomUUID();
    const token = jwt.sign({ userId: B.usuario.id, tenantId: B.tenant.id, cargoCodigo: B.cargoAdmin.id, jti }, JWT_SECRET, { expiresIn: "1h" });
    const comSessao = api.comoTenant({ token, slug: B.slug });
    assert.equal((await comSessao.get("/api/comunicados/pendente")).status, 200);
    let sessao = null;
    for (let i = 0; i < 20 && !sessao; i++) { await esperar(100); sessao = await prisma.sessaoUsuario.findUnique({ where: { jti } }); }
    assert.ok(sessao, "a sessão foi registrada no primeiro uso");
    assert.equal(sessao.tenantId, B.tenant.id);

    const acessos = await admin(suporte).get(`/api/admin/acessos?tenantId=${B.tenant.id}`);
    assert.ok(acessos.json.sessoes.some((s) => s.jti === jti));
    assert.equal((await admin(suporte).post(`/api/admin/acessos/${jti}/encerrar`)).status, 403, "ver não é encerrar");
    assert.equal((await admin(chefe).post(`/api/admin/acessos/${jti}/encerrar`)).status, 200);

    const depois = await comSessao.get("/api/comunicados/pendente");
    assert.equal(depois.status, 401);
    assert.equal(depois.json.sessaoEncerrada, true);
    const deNovo = await admin(suporte).get(`/api/admin/acessos?tenantId=${B.tenant.id}`);
    assert.ok(!deNovo.json.sessoes.some((s) => s.jti === jti), "a encerrada sai da lista");
  });

  await t.test("o consumo de IA entra no Controle de Uso", async () => {
    await prisma.consumoIA.createMany({
      data: [
        { tenantId: A.tenant.id, rota: "POST /api/leads/:id/ia", tokensEntrada: 1000, tokensSaida: 200 },
        { tenantId: A.tenant.id, rota: "POST /api/properties/:id/ai/gerar", tokensEntrada: 500, tokensSaida: 300 },
      ],
    });
    const uso = await admin(suporte).get("/api/admin/uso");
    const linha = uso.json.tenants.find((x) => x.id === A.tenant.id);
    assert.deepEqual(linha.ia30, { chamadas: 2, tokensEntrada: 1500, tokensSaida: 500 });
    assert.equal(uso.json.tenants.find((x) => x.id === B.tenant.id).ia30.chamadas, 0);
  });
});
