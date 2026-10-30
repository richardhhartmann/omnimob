import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { prisma, PREFIXO, criarImobiliariaDeTeste, apagarImobiliaria, subirApi } from "./helpers.js";
import { avaliacaoRouter } from "../src/routes/avaliacaoRoutes.js";
import { adminRouter } from "../src/routes/adminRoutes.js";

/* ────────────────────────────────────────────────────────────────────────────
   A avaliação do painel: uma por pessoa, nunca da equipe da Omnimob dentro
   da conta, nunca de quem está em teste — e só quem tem a aba lê.

   Os dois defeitos que importam são silenciosos: a mesma pessoa contada
   duas vezes puxa a média, e a opinião do suporte ("Entrar") passaria por
   opinião do cliente.
   ──────────────────────────────────────────────────────────────────────────── */

const JWT_SECRET = process.env.JWT_SECRET || "omnimob-dev-secret";
const tokenAdmin = (admin) =>
  jwt.sign({ role: "SUPERADMIN", superAdminId: admin.id, email: admin.email }, JWT_SECRET, { expiresIn: "10m" });

test("avaliações do painel", async (t) => {
  const a = await criarImobiliariaDeTeste();
  const emTeste = await criarImobiliariaDeTeste();
  await prisma.tenant.update({ where: { id: emTeste.tenant.id }, data: { statusPagamento: "TRIAL" } });

  const cargoLe = await prisma.cargoSuperAdmin.create({ data: { nome: `${PREFIXO}Le avaliações`, verAvaliacoes: true } });
  const cargoNao = await prisma.cargoSuperAdmin.create({ data: { nome: `${PREFIXO}Sem avaliações`, verTenants: true } });
  const leitor = await prisma.superAdmin.create({ data: { nome: `${PREFIXO}leitor`, email: `${PREFIXO}leitor@exemplo.test`, senha: "x", cargoId: cargoLe.id } });
  const outro = await prisma.superAdmin.create({ data: { nome: `${PREFIXO}outro`, email: `${PREFIXO}outro@exemplo.test`, senha: "x", cargoId: cargoNao.id } });

  const api = await subirApi({ "/api/avaliacoes": avaliacaoRouter, "/api/admin": adminRouter });
  const comoA = api.comoTenant({ token: a.token, slug: a.slug });
  const admin = (sa) => api.comoTenant({ token: tokenAdmin(sa), slug: "" });

  t.after(async () => {
    await api.fechar();
    await apagarImobiliaria(a.tenant.id);
    await apagarImobiliaria(emTeste.tenant.id);
    await prisma.superAdmin.deleteMany({ where: { email: { startsWith: PREFIXO } } });
    await prisma.cargoSuperAdmin.deleteMany({ where: { nome: { startsWith: PREFIXO } } });
  });

  await t.test("pergunta a quem não respondeu, e só uma vez", async () => {
    const antes = await comoA.get("/api/avaliacoes/minha");
    assert.equal(antes.status, 200);
    assert.equal(antes.json.perguntar, true);

    assert.equal((await comoA.post("/api/avaliacoes", { nota: 9 })).status, 400);
    const r = await comoA.post("/api/avaliacoes", { nota: 4, comentario: "Gostei", tela: "/leads" });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal((await comoA.post("/api/avaliacoes", { nota: 5 })).status, 409);

    const depois = await comoA.get("/api/avaliacoes/minha");
    assert.equal(depois.json.perguntar, false);
    assert.equal(depois.json.jaAvaliou, true);
  });

  await t.test("a equipe da Omnimob dentro da conta não avalia pelo cliente", async () => {
    const token = jwt.sign(
      { userId: emTeste.usuario.id, tenantId: emTeste.tenant.id, suporte: { nome: "Suporte", email: "s@omnimob.app" } },
      JWT_SECRET,
      { expiresIn: "10m" },
    );
    const suporte = api.comoTenant({ token, slug: emTeste.slug });
    assert.equal((await suporte.get("/api/avaliacoes/minha")).json.perguntar, false);
    assert.equal((await suporte.post("/api/avaliacoes", { nota: 5 })).status, 403);
  });

  await t.test("conta em teste não é perguntada (já tem a pesquisa do trial)", async () => {
    const r = await api.comoTenant({ token: emTeste.token, slug: emTeste.slug }).get("/api/avaliacoes/minha");
    assert.equal(r.json.perguntar, false);
    assert.equal(r.json.motivo, "trial");
  });

  await t.test("só quem tem a aba lê, e marcar como lida apaga o contador", async () => {
    assert.equal((await admin(outro).get("/api/admin/avaliacoes")).status, 403);

    const lista = await admin(leitor).get(`/api/admin/avaliacoes?tenantId=${a.tenant.id}`);
    assert.equal(lista.status, 200, JSON.stringify(lista.json));
    assert.equal(lista.json.total, 1);
    assert.equal(lista.json.avaliacoes[0].tenant.slug, a.slug);
    assert.equal(lista.json.distribuicao[4], 1);
    assert.equal(lista.json.media, 4);

    const id = lista.json.avaliacoes[0].id;
    assert.equal((await admin(leitor).post("/api/admin/avaliacoes/lidas", { ids: [id] })).json.marcadas, 1);
    const naoLidas = await admin(leitor).get(`/api/admin/avaliacoes?tenantId=${a.tenant.id}&naoLidas=1`);
    assert.equal(naoLidas.json.total, 0);
  });
});
