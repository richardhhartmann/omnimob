import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { prisma, criarImobiliariaDeTeste, apagarImobiliaria, subirApi } from "./helpers.js";
import { chamadoRouter } from "../src/routes/chamadoRoutes.js";
import { adminRouter } from "../src/routes/adminRoutes.js";

/* ────────────────────────────────────────────────────────────────────────────
   A conversa do chamado, na junção rota + query.

   Dois riscos, e os dois são silenciosos:

   1. VAZAMENTO. O número do chamado é sequencial e GLOBAL — o #12 de uma
      imobiliária é vizinho do #13 de outra. Se a rota do cliente buscar pelo
      número sem o tenant, A lê e escreve na conversa da B. O teste pede o
      chamado da B pelo número real, na leitura e na escrita, e espera 404.

   2. RÉGUA DE STATUS DIVERGENTE. Cliente e suporte mexem no mesmo status por
      rotas diferentes; se cada uma tivesse a sua regra, o chamado ficaria
      "aguardando você" de um lado e "em atendimento" do outro. O teste
      percorre o ciclo inteiro pelos dois lados.
   ──────────────────────────────────────────────────────────────────────────── */

const JWT_SECRET = process.env.JWT_SECRET || "omnimob-dev-secret";

test("conversa do chamado", async (t) => {
  const a = await criarImobiliariaDeTeste();
  const b = await criarImobiliariaDeTeste();
  const api = await subirApi({ "/api/chamados": chamadoRouter, "/api/admin": adminRouter });
  const comoA = api.comoTenant(a);
  const comoB = api.comoTenant(b);
  /* O super-admin: o que a `main` de hoje aceita é um token com `role`.
     Quando o cargo do super-admin entrar (#4), este trecho passa a criar a
     conta no banco, como `pagamentos.test.js` faz. */
  const tokenSuporte = jwt.sign({ role: "SUPERADMIN", email: "suporte@omnimob.app" }, JWT_SECRET, { expiresIn: "10m" });
  const suporte = api.comoTenant({ token: tokenSuporte, slug: "" });

  t.after(async () => {
    await api.fechar();
    await apagarImobiliaria(a.tenant.id);
    await apagarImobiliaria(b.tenant.id);
  });

  const aberto = await comoA.post("/api/chamados", {
    titulo: "Foto não sobe",
    descricao: "Ao enviar a terceira foto do imóvel, a barra trava em 80%.",
    categoria: "problema",
  });
  assert.equal(aberto.status, 201, JSON.stringify(aberto.json));
  const numero = aberto.json.numero;
  assert.equal(aberto.json.status, "ABERTO");

  await t.test("a imobiliária B não lê nem escreve no chamado da A — pelo número real", async () => {
    assert.equal((await comoB.get(`/api/chamados/${numero}`)).status, 404);
    assert.equal((await comoB.post(`/api/chamados/${numero}/mensagens`, { texto: "oi" })).status, 404);
    assert.equal((await comoB.post(`/api/chamados/${numero}/reabrir`)).status, 404);
    // E não deixou rastro: a conversa da A continua vazia.
    const daA = await comoA.get(`/api/chamados/${numero}`);
    assert.equal(daA.status, 200);
    assert.deepEqual(daA.json.conversa, []);
    // Nem na lista da B.
    const listaB = await comoB.get("/api/chamados");
    assert.ok(!listaB.json.some((c) => c.numero === numero));
  });

  await t.test("o suporte responde: mensagem no fio e a bola vai para o cliente", async () => {
    const r = await suporte.post(`/api/admin/chamados/${numero}/mensagens`, { texto: "Qual o tamanho da foto?" });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(r.json.mensagem.autorTipo, "SUPORTE");
    assert.equal(r.json.status, "AGUARDANDO_CLIENTE");

    const visto = await comoA.get(`/api/chamados/${numero}`);
    assert.equal(visto.json.status, "AGUARDANDO_CLIENTE");
    assert.equal(visto.json.conversa.length, 1);
    assert.equal(visto.json.conversa[0].texto, "Qual o tamanho da foto?");
  });

  await t.test("o cliente responde pela tela: a bola volta ao suporte", async () => {
    const r = await comoA.post(`/api/chamados/${numero}/mensagens`, { texto: "Uns 9 MB." });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(r.json.mensagem.autorTipo, "CLIENTE");
    assert.match(r.json.mensagem.autorNome, /Admin de Teste/);
    assert.equal(r.json.status, "EM_ATENDIMENTO");

    const doSuporte = await suporte.get(`/api/admin/chamados/${numero}`);
    assert.equal(doSuporte.status, 200);
    assert.equal(doSuporte.json.conversa.length, 2);
    assert.equal(doSuporte.json.tenantSlug, a.slug);
  });

  await t.test("resolver vira anotação de sistema; o cliente vê e reabre", async () => {
    const r = await suporte.patch(`/api/admin/chamados/${numero}`, { resolvido: true });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.status, "RESOLVIDO");
    assert.equal(r.json.resolvido, true);
    assert.ok(r.json.resolvidoEm);

    const visto = await comoA.get(`/api/chamados/${numero}`);
    assert.equal(visto.json.status, "RESOLVIDO");
    const ultima = visto.json.conversa.at(-1);
    assert.equal(ultima.autorTipo, "SISTEMA");
    assert.match(ultima.texto, /^Resolvido por /);

    const reaberto = await comoA.post(`/api/chamados/${numero}/reabrir`);
    assert.equal(reaberto.status, 200, JSON.stringify(reaberto.json));
    assert.equal(reaberto.json.status, "ABERTO");

    const depois = await comoA.get(`/api/chamados/${numero}`);
    assert.equal(depois.json.resolvido, false);
    assert.equal(depois.json.resolvidoEm, null);
    assert.match(depois.json.conversa.at(-1).texto, /^Reaberto por /);

    // Reabrir o que já está aberto é erro do cliente, não do servidor.
    assert.equal((await comoA.post(`/api/chamados/${numero}/reabrir`)).status, 400);
  });

  await t.test("responder um chamado resolvido também o reabre", async () => {
    await suporte.patch(`/api/admin/chamados/${numero}`, { status: "RESOLVIDO" });
    const r = await comoA.post(`/api/chamados/${numero}/mensagens`, { texto: "Voltou a travar." });
    assert.equal(r.status, 201);
    assert.equal(r.json.status, "ABERTO");
  });

  await t.test("a lista traz a contagem de mensagens e o status", async () => {
    const lista = await comoA.get("/api/chamados");
    const c = lista.json.find((x) => x.numero === numero);
    assert.ok(c);
    assert.equal(c.status, "ABERTO");
    /* 2 do suporte/cliente + 1 do cliente + resolvido + reaberto + resolvido + reaberto = 7 */
    assert.equal(c.mensagens, 7);
    assert.equal(c.conversa, undefined, "a lista não carrega a conversa");
  });

  await t.test("status fora da régua é recusado", async () => {
    assert.equal((await suporte.patch(`/api/admin/chamados/${numero}`, { status: "FECHADO" })).status, 400);
    assert.equal((await comoA.post(`/api/chamados/${numero}/mensagens`, { texto: "" })).status, 400);
  });

  await t.test("apagar a imobiliária leva a conversa junto", async () => {
    const antes = await prisma.chamadoMensagem.count({ where: { chamadoNumero: numero } });
    assert.ok(antes > 0);
    await apagarImobiliaria(a.tenant.id);
    assert.equal(await prisma.chamadoMensagem.count({ where: { chamadoNumero: numero } }), 0);
  });
});
