import test from "node:test";
import assert from "node:assert/strict";

import { cargoRouter } from "../src/routes/cargoRoutes.js";
import { propertyRouter } from "../src/routes/propertyRoutes.js";
import { usuarioRouter } from "../src/routes/usuarioRoutes.js";
import {
  prisma, limparRestos, criarImobiliariaDeTeste, apagarImobiliaria, subirApi,
} from "./helpers.js";

/* ────────────────────────────────────────────────────────────────────────────
   Isolamento entre imobiliárias.

   O teste é sempre o mesmo gesto: a imobiliária A pede um recurso da B, usando
   o id real da B. A resposta certa é 404 — "não existe", para quem pergunta.
   Não 403, que já confirmaria a existência do recurso e de quem é.

   Três bugs reais deram origem a cada bloco daqui:
     · `tb_cargo` sem `tenantId` — uma imobiliária editava os cargos das outras
     · `tb_tipo_imovel` idem, com CRUD aberto na tela
     · `cargoCodigo` aceito sem conferir a dona — usuário governado por
       permissões de outra empresa
   ──────────────────────────────────────────────────────────────────────────── */

let api;
let A;
let B;

test.before(async () => {
  await limparRestos();
  api = await subirApi({
    "/api/cargos": cargoRouter,
    "/api/properties": propertyRouter,
    "/api/usuarios": usuarioRouter,
  });
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

// ─── Cargos ─────────────────────────────────────────────────────────────────

test("cargos: a listagem devolve só os da própria imobiliária", async () => {
  const r = await api.comoTenant(A).get("/api/cargos");
  assert.equal(r.status, 200);
  const ids = r.json.map((c) => c.id);
  assert.ok(ids.includes(A.cargoAdmin.id), "deveria trazer o cargo da própria");
  assert.ok(!ids.includes(B.cargoAdmin.id), "NÃO pode trazer cargo de outra imobiliária");
  assert.ok(!ids.includes(B.cargoComum.id));
});

test("cargos: editar cargo de outra imobiliária responde 404", async () => {
  const r = await api.comoTenant(A).put(`/api/cargos/${B.cargoComum.id}`, { descricao: "Invadido" });
  assert.equal(r.status, 404);

  // E o alvo continua intacto — 404 sem efeito colateral.
  const alvo = await prisma.cargo.findUnique({ where: { id: B.cargoComum.id } });
  assert.equal(alvo.descricao, "Corretor");
});

test("cargos: conceder permissão a cargo de outra imobiliária responde 404", async () => {
  const r = await api.comoTenant(A).put(`/api/cargos/${B.cargoComum.id}`, { gerenciarCargos: true });
  assert.equal(r.status, 404);
  const alvo = await prisma.cargo.findUnique({ where: { id: B.cargoComum.id } });
  assert.equal(alvo.gerenciarCargos, false, "a permissão não pode ter sido concedida");
});

test("cargos: excluir cargo de outra imobiliária responde 404", async () => {
  const r = await api.comoTenant(A).del(`/api/cargos/${B.cargoComum.id}`);
  assert.equal(r.status, 404);
  assert.ok(await prisma.cargo.findUnique({ where: { id: B.cargoComum.id } }), "o cargo não pode ter sido apagado");
});

test("cargos: verConfiguracoes é derivada do nome, não do que o cliente manda", async () => {
  // Cargo comum tentando receber a permissão explicitamente.
  const r = await api.comoTenant(A).put(`/api/cargos/${A.cargoComum.id}`, { verConfiguracoes: true });
  assert.equal(r.status, 200);
  assert.equal(r.json.verConfiguracoes, false, "só o Administrador pode ter");

  // E o Administrador a mantém mesmo pedindo para tirar.
  const r2 = await api.comoTenant(A).put(`/api/cargos/${A.cargoAdmin.id}`, { verConfiguracoes: false });
  assert.equal(r2.status, 200);
  assert.equal(r2.json.verConfiguracoes, true, "o Administrador não pode perder o acesso");
});

test("cargos: o Administrador não pode ser excluído", async () => {
  const r = await api.comoTenant(A).del(`/api/cargos/${A.cargoAdmin.id}`);
  assert.equal(r.status, 400);
  assert.match(r.json.error, /Administrador/);
});

// ─── Tipos de imóvel ────────────────────────────────────────────────────────

test("tipos: a listagem devolve só os da própria imobiliária", async () => {
  const r = await api.comoTenant(A).get("/api/properties/tipos");
  assert.equal(r.status, 200);
  const ids = r.json.map((t) => t.id);
  assert.ok(ids.includes(A.tipo.id));
  assert.ok(!ids.includes(B.tipo.id), "NÃO pode trazer tipo de outra imobiliária");
});

test("tipos: renomear tipo de outra imobiliária responde 404", async () => {
  const r = await api.comoTenant(A).put(`/api/properties/tipos/${B.tipo.id}`, { descricao: "Renomeado" });
  assert.equal(r.status, 404);
  const alvo = await prisma.tipoImovel.findUnique({ where: { id: B.tipo.id } });
  assert.equal(alvo.descricao, "Casa");
});

test("tipos: excluir tipo de outra imobiliária responde 404", async () => {
  const r = await api.comoTenant(A).del(`/api/properties/tipos/${B.tipo.id}`);
  assert.equal(r.status, 404);
  assert.ok(await prisma.tipoImovel.findUnique({ where: { id: B.tipo.id } }));
});

test("tipos: criar atributo em tipo de outra imobiliária responde 404", async () => {
  const r = await api.comoTenant(A).post(`/api/properties/tipos/${B.tipo.id}/atributos`, { descricao: "Invadido" });
  assert.equal(r.status, 404);
  const atrs = await prisma.modeloAtributo.findMany({ where: { tipoId: B.tipo.id } });
  assert.equal(atrs.length, 1, "o tipo da outra imobiliária continua com um atributo só");
});

test("tipos: editar atributo de outra imobiliária responde 404", async () => {
  const r = await api.comoTenant(A).put(`/api/properties/atributos/${B.atributo.id}`, { descricao: "Invadido" });
  assert.equal(r.status, 404);
  const alvo = await prisma.modeloAtributo.findUnique({ where: { id: B.atributo.id } });
  assert.equal(alvo.descricao, "Piscina");
});

test("tipos: o tipo criado nasce com a dona certa", async () => {
  const r = await api.comoTenant(A).post("/api/properties/tipos", { descricao: "Galpão Teste" });
  assert.equal(r.status, 201);
  assert.equal(r.json.tenantId, A.tenant.id);
  await prisma.tipoImovel.delete({ where: { id: r.json.id } }).catch(() => {});
});

// ─── Usuários ───────────────────────────────────────────────────────────────

test("usuários: a listagem devolve só os da própria imobiliária", async () => {
  const r = await api.comoTenant(A).get("/api/usuarios");
  assert.equal(r.status, 200);
  const ids = r.json.map((u) => u.id);
  assert.ok(ids.includes(A.usuario.id));
  assert.ok(!ids.includes(B.usuario.id), "NÃO pode trazer usuário de outra imobiliária");
});

test("usuários: criar com cargo de outra imobiliária é recusado", async () => {
  const r = await api.comoTenant(A).post("/api/usuarios", {
    nome: "Intruso",
    login: "intruso",
    cargoCodigo: B.cargoAdmin.id,
  });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /Cargo não encontrado/i);
});

test("usuários: mover usuário para cargo de outra imobiliária é recusado", async () => {
  const r = await api.comoTenant(A).put(`/api/usuarios/${A.usuario.id}`, { cargoCodigo: B.cargoAdmin.id });
  assert.equal(r.status, 400);
  const alvo = await prisma.usuario.findUnique({ where: { id: A.usuario.id } });
  assert.equal(alvo.cargoCodigo, A.cargoAdmin.id, "o cargo não pode ter mudado");
});

test("usuários: editar usuário de outra imobiliária responde 404", async () => {
  const r = await api.comoTenant(A).put(`/api/usuarios/${B.usuario.id}`, { nome: "Invadido" });
  assert.equal(r.status, 404);
  const alvo = await prisma.usuario.findUnique({ where: { id: B.usuario.id } });
  assert.equal(alvo.nome, "Admin de Teste");
});

// ─── O token não vale para outra imobiliária ────────────────────────────────

test("sessão: token da A com o slug da B é recusado", async () => {
  /* O `x-tenant-slug` é cabeçalho, e cabeçalho se forja. A trava real é o
     `requireTenant` conferir que o slug pedido bate com o tenant do token. */
  const r = await api.comoTenant({ token: A.token, slug: B.slug }).get("/api/cargos");
  assert.equal(r.status, 403);
});
