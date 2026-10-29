import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import jwt from "jsonwebtoken";
import { prisma, PREFIXO, criarImobiliariaDeTeste, apagarImobiliaria, subirApi } from "./helpers.js";
import { novidadeRouter, rascunhoNovidadeRouter } from "../src/routes/novidadeRoutes.js";
import { adminRouter } from "../src/routes/adminRoutes.js";
import { chaveValida } from "../src/services/novidades.js";

/* ────────────────────────────────────────────────────────────────────────────
   As Novidades na junção rota + banco.

   O que não pode acontecer: a rotina publicar sozinha (ou sobrescrever o que
   uma pessoa revisou e publicou), um cargo sem a ação publicar para todos os
   clientes, a novidade do Omniflow aparecer para quem só tem o Omnimob, e o
   registro de quem viu de uma pessoa ser mexido por outra.
   ──────────────────────────────────────────────────────────────────────────── */

const JWT_SECRET = process.env.JWT_SECRET || "omnimob-dev-secret";
const TOKEN = "token-de-teste-das-novidades";
// Uma terça longe de qualquer semana real: o teste não encosta em novidade de verdade.
const CHAVE = "2099-12-29";

const exemplo = JSON.parse(readFileSync(new URL("../../../docs/novidades/exemplo/conteudo.json", import.meta.url), "utf8"));
const conteudo = {
  ...exemplo,
  secoes: [
    ...exemplo.secoes,
    {
      id: "omniflow",
      titulo: "Omniflow",
      icone: "Kanban",
      resumo: "O funil de negócios.",
      itens: [{ id: "funil-novo", tipo: "novo", titulo: "Funil novo", icone: "Kanban", paraQue: "Acompanhar os negócios.", passos: ["Abra o funil."], onde: "Omniflow › Funil", modulo: "FLOW" }],
    },
  ],
};
const idsDe = (c) => c.secoes.flatMap((s) => s.itens.map((i) => i.id));

test("novidades da semana", async (t) => {
  assert.ok(chaveValida(CHAVE));
  process.env.NOVIDADES_TOKEN = TOKEN;
  await prisma.novidade.deleteMany({ where: { chave: CHAVE } });

  const soHub = await criarImobiliariaDeTeste();
  const comFlow = await criarImobiliariaDeTeste();
  await prisma.tenant.update({ where: { id: comFlow.tenant.id }, data: { modulos: ["HUB", "FLOW"] } });
  await prisma.cargo.update({ where: { id: comFlow.cargoAdmin.id }, data: { acessarFlow: true } });

  const cargoRevisa = await prisma.cargoSuperAdmin.create({ data: { nome: `${PREFIXO}Revisa`, verNovidades: true } });
  const cargoPublica = await prisma.cargoSuperAdmin.create({ data: { nome: `${PREFIXO}Publica`, verNovidades: true, publicarNovidades: true } });
  const revisor = await prisma.superAdmin.create({ data: { nome: `${PREFIXO}revisor`, email: `${PREFIXO}revisor@exemplo.test`, senha: "x", cargoId: cargoRevisa.id } });
  const editor = await prisma.superAdmin.create({ data: { nome: `${PREFIXO}editor`, email: `${PREFIXO}editor@exemplo.test`, senha: "x", cargoId: cargoPublica.id } });

  const api = await subirApi({ "/api/novidades/rascunho": rascunhoNovidadeRouter, "/api/novidades": novidadeRouter, "/api/admin": adminRouter });
  const admin = (sa) =>
    api.comoTenant({ token: jwt.sign({ role: "SUPERADMIN", superAdminId: sa.id, email: sa.email }, JWT_SECRET, { expiresIn: "10m" }), slug: "" });
  const hub = api.comoTenant({ token: soHub.token, slug: soHub.slug });
  const flow = api.comoTenant({ token: comFlow.token, slug: comFlow.slug });
  const rotina = (token, corpo) =>
    fetch(`${api.base}/api/novidades/rascunho/${CHAVE}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(corpo),
    }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));

  t.after(async () => {
    await api.fechar();
    await prisma.novidade.deleteMany({ where: { chave: CHAVE } });
    await apagarImobiliaria(soHub.tenant.id);
    await apagarImobiliaria(comFlow.tenant.id);
    await prisma.superAdmin.deleteMany({ where: { email: { startsWith: PREFIXO } } });
    await prisma.cargoSuperAdmin.deleteMany({ where: { nome: { startsWith: PREFIXO } } });
  });

  await t.test("a rotina entra só com a chave, e o conteúdo é validado", async () => {
    assert.equal((await rotina(null, conteudo)).status, 401);
    assert.equal((await rotina("outro-token-de-mesmo-tamanho-xxxxxx", conteudo)).status, 401);
    const torto = await rotina(TOKEN, { ...conteudo, titulo: "" });
    assert.equal(torto.status, 400);
    assert.match(torto.json.error, /título/);
    const ok = await rotina(TOKEN, conteudo);
    assert.equal(ok.status, 200, JSON.stringify(ok.json));
    assert.equal(ok.json.status, "RASCUNHO");
  });

  await t.test("rascunho não chega ao cliente", async () => {
    assert.equal((await hub.get(`/api/novidades/${CHAVE}`)).status, 404);
    assert.equal((await hub.get("/api/novidades/pendente")).json.novidade, null);
  });

  await t.test("revisar não é publicar", async () => {
    assert.equal((await admin(revisor).get(`/api/admin/novidades/${CHAVE}`)).status, 200);
    const revisado = { ...conteudo, chamada: "Chamada reescrita na revisão." };
    const put = await admin(revisor).put(`/api/admin/novidades/${CHAVE}`, { conteudo: revisado });
    assert.equal(put.status, 200, JSON.stringify(put.json));
    assert.equal((await admin(revisor).post(`/api/admin/novidades/${CHAVE}/publicar`, {})).status, 403);
    const pub = await admin(editor).post(`/api/admin/novidades/${CHAVE}/publicar`, { email: false });
    assert.equal(pub.status, 200, JSON.stringify(pub.json));
    assert.equal(pub.json.status, "PUBLICADO");
  });

  await t.test("a rotina não sobrescreve o que foi publicado", async () => {
    assert.equal((await rotina(TOKEN, conteudo)).status, 409);
    const n = await prisma.novidade.findUnique({ where: { chave: CHAVE } });
    assert.equal(n.conteudo.chamada, "Chamada reescrita na revisão.");
  });

  await t.test("cada conta vê só o que contratou e alcança", async () => {
    const deHub = await hub.get(`/api/novidades/${CHAVE}`);
    const deFlow = await flow.get(`/api/novidades/${CHAVE}`);
    assert.ok(!idsDe(deHub.json.conteudo).includes("funil-novo"), "só-Hub não vê o Omniflow");
    assert.ok(idsDe(deFlow.json.conteudo).includes("funil-novo"));
    // O e-mail de convite exige gerenciarUsuarios, que o Administrador tem.
    assert.ok(idsDe(deHub.json.conteudo).includes("convite-por-email"));
  });

  await t.test("o comunicado abre uma vez; o registro de quem viu é de quem viu", async () => {
    const pendente = await hub.get("/api/novidades/pendente");
    assert.equal(pendente.json.novidade?.chave, CHAVE);

    const aberto = await hub.post(`/api/novidades/${CHAVE}/visto`, { origem: "comunicado", total: 6, dispositivo: "computador" });
    assert.equal(aberto.status, 201);
    const { id } = aberto.json;
    // Outra imobiliária, com o id real: não mexe.
    assert.equal((await flow.post(`/api/novidades/${CHAVE}/visto`, { id, slide: 6 })).status, 404);
    assert.equal((await hub.post(`/api/novidades/${CHAVE}/visto`, { id, slide: 6, fechou: true })).status, 204);

    assert.equal((await hub.get("/api/novidades/pendente")).json.novidade, null, "não abre de novo");
    assert.equal((await flow.get("/api/novidades/pendente")).json.novidade?.chave, CHAVE, "para a outra conta, ainda abre");

    const vistos = await admin(revisor).get(`/api/admin/novidades/${CHAVE}/vistos`);
    assert.equal(vistos.status, 200);
    const linha = vistos.json.pessoas.find((p) => p.usuarioId === soHub.usuario.id);
    assert.equal(linha.chegouAoFim, true);
    assert.equal(linha.tenant.slug, soHub.slug);
  });

  await t.test("Notas de versão lista a publicada", async () => {
    const r = await hub.get("/api/novidades");
    assert.ok(r.json.novidades.some((n) => n.chave === CHAVE));
  });
});
