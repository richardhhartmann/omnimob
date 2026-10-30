import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { prisma, PREFIXO, criarImobiliariaDeTeste, apagarImobiliaria, subirApi } from "./helpers.js";
import { avaliacaoRouter } from "../src/routes/avaliacaoRoutes.js";
import { adminRouter } from "../src/routes/adminRoutes.js";
import { publicRouter } from "../src/routes/publicRoutes.js";
import { fraseDoCartao, podeConsentir } from "../src/services/relatosDaParede.js";

/* ────────────────────────────────────────────────────────────────────────────
   A avaliação que vira depoimento na landing. Os defeitos que importam:
     · publicar sem consentimento (ou com consentimento que a tela não podia
       ter oferecido: nota baixa, sem texto, conta em teste);
     · publicar o "5 estrelas, muito ruim" que a IA marcou;
     · a landing mostrar mais do que o cartão precisa.
   ──────────────────────────────────────────────────────────────────────────── */

const JWT_SECRET = process.env.JWT_SECRET || "omnimob-dev-secret";
const tokenAdmin = (admin) =>
  jwt.sign({ role: "SUPERADMIN", superAdminId: admin.id, email: admin.email }, JWT_SECRET, { expiresIn: "10m" });

test("regras do consentimento e do cartão", () => {
  assert.equal(podeConsentir({ nota: 4, comentario: "bom" }), true);
  assert.equal(podeConsentir({ nota: 3, comentario: "bom" }), false);
  assert.equal(podeConsentir({ nota: 5, comentario: "   " }), false);
  assert.equal(podeConsentir({ nota: 5, comentario: "bom", trial: true }), false);
  assert.equal(fraseDoCartao("Mudou a rotina. O resto é detalhe."), "Mudou a rotina.");
  const longa = fraseDoCartao("palavra ".repeat(60));
  assert.ok(longa.length <= 141 && longa.endsWith("…"), longa);
});

test("da avaliação à parede da landing", async (t) => {
  const a = await criarImobiliariaDeTeste();
  const emTeste = await criarImobiliariaDeTeste();
  await prisma.tenant.update({ where: { id: emTeste.tenant.id }, data: { statusPagamento: "TRIAL" } });

  /* Uma avaliação por pessoa: cada caso precisa de alguém novo na imobiliária. */
  let n = 0;
  async function pessoa(base = a) {
    const u = await prisma.usuario.create({
      data: { tenantId: base.tenant.id, cargoCodigo: base.usuario.cargoCodigo, nome: `Pessoa ${(n += 1)}`, login: `${PREFIXO}p${n}`, senha: "x" },
    });
    return api.comoTenant({ token: jwt.sign({ userId: u.id, tenantId: base.tenant.id }, JWT_SECRET, { expiresIn: "10m" }), slug: base.slug });
  }

  const cargo = await prisma.cargoSuperAdmin.create({ data: { nome: `${PREFIXO}Avaliações`, verAvaliacoes: true } });
  const sa = await prisma.superAdmin.create({ data: { nome: `${PREFIXO}sa`, email: `${PREFIXO}sa@exemplo.test`, senha: "x", cargoId: cargo.id } });

  const api = await subirApi({ "/api/avaliacoes": avaliacaoRouter, "/api/admin": adminRouter, "/public": publicRouter });
  const admin = api.comoTenant({ token: tokenAdmin(sa), slug: "" });
  const publico = api.comoTenant({ token: "", slug: "" });
  const gravada = (id) => prisma.avaliacao.findUnique({ where: { id } });

  t.after(async () => {
    await api.fechar();
    await apagarImobiliaria(a.tenant.id);
    await apagarImobiliaria(emTeste.tenant.id);
    await prisma.relatoDemoOculto.deleteMany({ where: { chave: { startsWith: PREFIXO } } });
    await prisma.superAdmin.deleteMany({ where: { email: { startsWith: PREFIXO } } });
    await prisma.cargoSuperAdmin.deleteMany({ where: { nome: { startsWith: PREFIXO } } });
  });

  await t.test("o servidor só aceita o consentimento que a tela podia oferecer", async () => {
    const baixa = await (await pessoa()).post("/api/avaliacoes", { nota: 3, comentario: "ok", permitePublicar: true });
    assert.equal(baixa.json.permitePublicar, false);
    const semTexto = await (await pessoa()).post("/api/avaliacoes", { nota: 5, permitePublicar: true });
    assert.equal(semTexto.json.permitePublicar, false);
    const trial = await (await pessoa(emTeste)).post("/api/avaliacoes", { nota: 5, comentario: "ótimo", permitePublicar: true });
    assert.equal(trial.json.permitePublicar, false);
    // E consentir de fora não publica: precisa do super-admin.
    assert.equal((await admin.post(`/api/admin/avaliacoes/${baixa.json.id}/parede`, { publicar: true })).status, 409);
  });

  await t.test("o texto que a IA marcou como incoerente não vai para a landing", async () => {
    const r = await (await pessoa()).post("/api/avaliacoes", { nota: 5, comentario: "muito ruim", permitePublicar: true });
    assert.equal(r.json.permitePublicar, true);
    await prisma.avaliacao.update({ where: { id: r.json.id }, data: { coerencia: "NAO_CONDIZ" } });
    assert.equal((await admin.post(`/api/admin/avaliacoes/${r.json.id}/parede`, { publicar: true })).status, 409);
    assert.equal((await gravada(r.json.id)).publicadaEm, null);
  });

  await t.test("publicada, aparece na landing só com o que o cartão mostra; tirada, some", async () => {
    const r = await (await pessoa()).post("/api/avaliacoes", {
      nota: 5, comentario: "O lead chega com o imóvel certo. Acabou a planilha.", permitePublicar: true,
    });
    const pub = await admin.post(`/api/admin/avaliacoes/${r.json.id}/parede`, { publicar: true });
    assert.equal(pub.status, 200, JSON.stringify(pub.json));

    const parede = await publico.get("/public/relatos");
    assert.equal(parede.status, 200);
    const cartao = parede.json.reais.find((x) => x.chave === r.json.id);
    assert.ok(cartao, "a avaliação publicada não apareceu");
    assert.equal(cartao.frase, "O lead chega com o imóvel certo.");
    assert.equal(cartao.imobiliaria, a.tenant.name);
    assert.deepEqual(Object.keys(cartao).sort(), ["cargo", "chave", "cidade", "frase", "imobiliaria", "nome", "relato", "uf"]);

    await admin.post(`/api/admin/avaliacoes/${r.json.id}/parede`, { publicar: false });
    assert.ok(!(await publico.get("/public/relatos")).json.reais.some((x) => x.chave === r.json.id));
  });

  await t.test("o exemplo desligado sai da lista dos ocultos ao religar", async () => {
    const chave = `${PREFIXO}exemplo`;
    await admin.post(`/api/admin/avaliacoes/demo/${chave}`, { noAr: false });
    assert.ok((await publico.get("/public/relatos")).json.ocultos.includes(chave));
    await admin.post(`/api/admin/avaliacoes/demo/${chave}`, { noAr: true });
    assert.ok(!(await publico.get("/public/relatos")).json.ocultos.includes(chave));
  });
});
