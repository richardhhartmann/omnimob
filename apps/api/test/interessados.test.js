import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { prisma, PREFIXO, subirApi } from "./helpers.js";
import { publicRouter } from "../src/routes/publicRoutes.js";
import { adminRouter } from "../src/routes/adminRoutes.js";
import { situacaoDeUso } from "../src/services/controleDeUso.js";

/* ────────────────────────────────────────────────────────────────────────────
   Interessados da landing: o pedido de contato é GUARDADO antes do e-mail.
   Antes, um envio que falhava (ou a falta de CONTATO_EMAIL) perdia o
   interesse para sempre; agora ele fica na aba, com o resultado do envio.
   ──────────────────────────────────────────────────────────────────────────── */

const JWT_SECRET = process.env.JWT_SECRET || "omnimob-dev-secret";

test("a régua do Controle de Uso", () => {
  const agora = Date.UTC(2026, 9, 29);
  const dias = (n) => new Date(agora - n * 864e5);
  assert.equal(situacaoDeUso(null, agora), "nunca");
  assert.equal(situacaoDeUso(dias(2), agora), "ativa");
  assert.equal(situacaoDeUso(dias(15), agora), "esfriando");
  assert.equal(situacaoDeUso(dias(45), agora), "parada");
});

test("interessados da landing", async (t) => {
  const email = `${PREFIXO}interessado@exemplo.test`;
  const destinoAntes = process.env.CONTATO_EMAIL;
  delete process.env.CONTATO_EMAIL;

  const cargo = await prisma.cargoSuperAdmin.create({ data: { nome: `${PREFIXO}Comercial`, verInteressados: true } });
  const comercial = await prisma.superAdmin.create({
    data: { nome: `${PREFIXO}comercial`, email: `${PREFIXO}comercial@exemplo.test`, senha: "x", cargoId: cargo.id },
  });
  const api = await subirApi({ "/public": publicRouter, "/api/admin": adminRouter });
  const admin = api.comoTenant({ token: jwt.sign({ role: "SUPERADMIN", superAdminId: comercial.id, email: comercial.email }, JWT_SECRET, { expiresIn: "10m" }), slug: "" });

  t.after(async () => {
    if (destinoAntes !== undefined) process.env.CONTATO_EMAIL = destinoAntes;
    await api.fechar();
    await prisma.interesseComercial.deleteMany({ where: { email } });
    await prisma.superAdmin.deleteMany({ where: { email: { startsWith: PREFIXO } } });
    await prisma.cargoSuperAdmin.deleteMany({ where: { nome: { startsWith: PREFIXO } } });
  });

  await t.test("sem destino de e-mail, o interesse não se perde", async () => {
    const r = await fetch(`${api.base}/public/interesse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imobiliaria: "Imobiliária de Teste", email, telefone: "11999990000", plano: "PROFISSIONAL" }),
    });
    assert.equal(r.status, 200, await r.text());
    const linha = await prisma.interesseComercial.findFirst({ where: { email } });
    assert.ok(linha);
    assert.equal(linha.envio, "sem-destino");
  });

  await t.test("a aba lista e marca como atendido", async () => {
    const lista = await admin.get("/api/admin/interessados?pendentes=1");
    assert.equal(lista.status, 200, JSON.stringify(lista.json));
    const meu = lista.json.interessados.find((i) => i.email === email);
    assert.ok(meu);
    const marcado = await admin.post(`/api/admin/interessados/${meu.id}/atendido`, {});
    assert.equal(marcado.status, 200);
    assert.ok(marcado.json.atendidoEm);
    const depois = await admin.get("/api/admin/interessados?pendentes=1");
    assert.ok(!depois.json.interessados.some((i) => i.email === email));
  });
});
