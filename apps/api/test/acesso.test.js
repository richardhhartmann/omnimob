import test from "node:test";
import assert from "node:assert/strict";

import { auditoriaRouter } from "../src/routes/auditoriaRoutes.js";
import { perfilBuscaRouter } from "../src/routes/perfilBuscaRoutes.js";
import { cargoRouter } from "../src/routes/cargoRoutes.js";
import { cifrar, decifrar, estaCifrado } from "../src/services/cofre.js";
import {
  prisma, limparRestos, criarImobiliariaDeTeste, apagarImobiliaria, subirApi,
} from "./helpers.js";

/* ────────────────────────────────────────────────────────────────────────────
   Acesso: o que o token NÃO decide, e o isolamento dos modelos novos.

   O primeiro bloco guarda um bug que existiu de verdade e era invisível:
   `requireAuth` lia o cargo de dentro do JWT e nunca conferia se o usuário
   ainda estava ativo. Como o token dura sete dias, desativar alguém ou rebaixar
   o cargo dele não surtia efeito nenhum durante uma semana.

   O sintoma era enganoso: mexer nas CAIXINHAS de um cargo funcionava na hora
   (`permissaoMiddleware` sempre releu o cargo do banco), mas mover a PESSOA de
   um cargo para outro, não. Quem testasse a permissão pelo caminho errado
   concluiria que estava tudo certo.

   O segundo e o terceiro bloco são o gesto de sempre: A pede recurso da B pelo
   id real e leva 404. `PerfilBusca` e `Auditoria` nasceram com `tenantId`, e é
   isso que estes testes seguram — os dois vazamentos que este projeto teve
   passaram meses invisíveis porque com um cliente só o sintoma não aparece.
   ──────────────────────────────────────────────────────────────────────────── */

let api;
let A;
let B;

test.before(async () => {
  await limparRestos();
  api = await subirApi({
    "/api/auditoria": auditoriaRouter,
    "/api/perfis-busca": perfilBuscaRouter,
    "/api/cargos": cargoRouter,
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

// ─── O token não decide mais nada além de "quem" ────────────────────────────

test("acesso: usuário desativado perde o acesso com o token ainda válido", async () => {
  const antes = await api.comoTenant(A).get("/api/cargos");
  assert.equal(antes.status, 200, "com o usuário ativo, deveria passar");

  await prisma.usuario.update({ where: { id: A.usuario.id }, data: { ativo: false } });
  try {
    const r = await api.comoTenant(A).get("/api/cargos");
    assert.equal(r.status, 401, "token válido não pode valer para usuário desativado");
    assert.equal(r.json.sessaoEncerrada, true, "o front precisa da marca para dizer o motivo");
  } finally {
    await prisma.usuario.update({ where: { id: A.usuario.id }, data: { ativo: true } });
  }
});

test("acesso: rebaixar o cargo vale na requisição seguinte", async () => {
  /* O cargo comum não tem `gerenciarCargos`. Antes, o `cargoCodigo` vinha do
     token e a pessoa continuava administrando cargos até o token vencer. */
  await prisma.usuario.update({ where: { id: A.usuario.id }, data: { cargoCodigo: A.cargoComum.id } });
  try {
    const r = await api.comoTenant(A).get("/api/cargos");
    assert.equal(r.status, 403, "o cargo tem de sair do banco, não do token");
  } finally {
    await prisma.usuario.update({ where: { id: A.usuario.id }, data: { cargoCodigo: A.cargoAdmin.id } });
  }
});

test("acesso: imobiliária desativada não abre o painel", async () => {
  await prisma.tenant.update({ where: { id: A.tenant.id }, data: { ativo: false } });
  try {
    const r = await api.comoTenant(A).get("/api/cargos");
    assert.equal(r.status, 403);
    assert.equal(r.json.contaInativa, true);
  } finally {
    await prisma.tenant.update({ where: { id: A.tenant.id }, data: { ativo: true } });
  }
});

// ─── Perfis de busca ────────────────────────────────────────────────────────

async function criarPerfil(imobiliaria, titulo) {
  const cliente = await prisma.cliente.create({
    data: { tenantId: imobiliaria.tenant.id, nome: `Cliente ${titulo}` },
  });
  const r = await api.comoTenant(imobiliaria).post("/api/perfis-busca", {
    clienteId: cliente.id, titulo, precoMax: 600000, quartosMin: 3, bairros: "Centro, Bela Vista",
  });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return { cliente, perfil: r.json };
}

test("perfis: a listagem devolve só os da própria imobiliária", async () => {
  const meu = await criarPerfil(A, "Perfil da A");
  const dela = await criarPerfil(B, "Perfil da B");

  const r = await api.comoTenant(A).get("/api/perfis-busca");
  assert.equal(r.status, 200);
  const ids = r.json.perfis.map((p) => p.id);
  assert.ok(ids.includes(meu.perfil.id));
  assert.ok(!ids.includes(dela.perfil.id), "NÃO pode trazer perfil de outra imobiliária");
});

test("perfis: editar e apagar perfil de outra imobiliária responde 404", async () => {
  const dela = await criarPerfil(B, "Alvo");

  const put = await api.comoTenant(A).put(`/api/perfis-busca/${dela.perfil.id}`, { titulo: "Invadido" });
  assert.equal(put.status, 404);

  const del = await api.comoTenant(A).del(`/api/perfis-busca/${dela.perfil.id}`);
  assert.equal(del.status, 404);

  const intacto = await prisma.perfilBusca.findUnique({ where: { id: dela.perfil.id } });
  assert.equal(intacto.titulo, "Alvo", "o perfil da outra não pode ter mudado");
});

test("perfis: cruzar perfil de outra imobiliária responde 404", async () => {
  const dela = await criarPerfil(B, "Cruzamento alheio");
  const r = await api.comoTenant(A).get(`/api/perfis-busca/${dela.perfil.id}/imoveis`);
  assert.equal(r.status, 404);
});

test("perfis: bairros repetidos e vazios viram uma lista limpa", async () => {
  const cliente = await prisma.cliente.create({ data: { tenantId: A.tenant.id, nome: "Bairros" } });
  const r = await api.comoTenant(A).post("/api/perfis-busca", {
    clienteId: cliente.id, titulo: "Lista suja", bairros: "Centro, , centro ,Pinheiros",
  });
  assert.equal(r.status, 201);
  assert.deepEqual(r.json.bairros, ["Centro", "Pinheiros"]);
});

// ─── Trilha de auditoria ────────────────────────────────────────────────────

test("auditoria: a escrita deixa rastro sozinha, sem a rota pedir", async () => {
  const cliente = await prisma.cliente.create({ data: { tenantId: A.tenant.id, nome: "Rastro" } });
  const r = await api.comoTenant(A).post("/api/perfis-busca", {
    clienteId: cliente.id, titulo: "Gera rastro",
  });
  assert.equal(r.status, 201);

  const trilha = await api.comoTenant(A).get("/api/auditoria?entidade=PerfilBusca");
  assert.equal(trilha.status, 200);
  const linha = trilha.json.registros.find((x) => x.entidadeId === r.json.id);
  assert.ok(linha, "criar um perfil tem de aparecer na trilha");
  assert.equal(linha.acao, "CRIOU");
  assert.equal(linha.usuarioNome, "Admin de Teste", "o autor sai do contexto da requisição");
  assert.equal(linha.resumo, "Gera rastro");
});

test("auditoria: a trilha de uma imobiliária não mostra a da outra", async () => {
  const clienteB = await prisma.cliente.create({ data: { tenantId: B.tenant.id, nome: "Só da B" } });
  await api.comoTenant(B).post("/api/perfis-busca", { clienteId: clienteB.id, titulo: "Segredo da B" });

  const r = await api.comoTenant(A).get("/api/auditoria");
  assert.equal(r.status, 200);
  assert.ok(
    r.json.registros.every((x) => x.tenantId === A.tenant.id),
    "a trilha da A não pode conter linha de outra imobiliária",
  );
  assert.ok(
    !r.json.registros.some((x) => x.resumo === "Segredo da B"),
    "nem pelo resumo",
  );
});

test("auditoria: quem não tem a permissão não lê a trilha", async () => {
  await prisma.usuario.update({ where: { id: A.usuario.id }, data: { cargoCodigo: A.cargoComum.id } });
  try {
    const r = await api.comoTenant(A).get("/api/auditoria");
    assert.equal(r.status, 403);
  } finally {
    await prisma.usuario.update({ where: { id: A.usuario.id }, data: { cargoCodigo: A.cargoAdmin.id } });
  }
});

// ─── Cofre ──────────────────────────────────────────────────────────────────

test("cofre: ida e volta preserva o segredo e o texto cifrado não o revela", () => {
  const segredo = "EAAG1234tokenDaPaginaDoFacebook";
  const cofre = cifrar(segredo);
  assert.ok(estaCifrado(cofre));
  assert.ok(!cofre.includes(segredo), "o texto cifrado não pode conter o original");
  assert.equal(decifrar(cofre), segredo);
});

test("cofre: valor gravado ANTES da cifragem continua funcionando", () => {
  /* Os tokens que já estavam no banco estão em texto puro. Sem esta tolerância,
     toda imobiliária conectada precisaria refazer o OAuth no dia do deploy. */
  assert.equal(decifrar("token-antigo-em-texto-puro"), "token-antigo-em-texto-puro");
  assert.equal(decifrar(""), "");
  assert.equal(decifrar(null), null);
});

test("cofre: envelope adulterado devolve nulo em vez de lixo", () => {
  const cofre = cifrar("valor");
  const partes = cofre.split(":");
  // Troca o texto cifrado — a etiqueta de autenticação do GCM tem de recusar.
  partes[3] = Buffer.from("outracoisa").toString("base64");
  assert.equal(decifrar(partes.join(":")), null);
});
