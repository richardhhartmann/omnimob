import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import express from "express";

import { apagarImobiliaria, criarImobiliariaDeTeste, limparRestos, prisma } from "./helpers.js";
import { apiPublicaRouter } from "../src/routes/apiPublicaRoutes.js";
import { criarChave } from "../src/services/chavesApi.js";

/* ────────────────────────────────────────────────────────────────────────────
   A API por chave não vaza acervo entre imobiliárias.

   Este arquivo existe pelo mesmo motivo que `isolamento.test.js`: os três
   vazamentos que este projeto teve moravam todos na junção rota + query, e
   nenhum teste de função pura teria pego qualquer um deles. A `/api/v1` é uma
   superfície NOVA de servir dados por imobiliária — e a mais perigosa até hoje,
   porque a credencial dela é um texto que circula fora do produto, colado em
   painéis de terceiros.

   O que está sob teste não é "a rota responde". É:

     · a chave de A não enxerga NADA de B, nem pedindo pelo id real;
     · o escopo é cobrado de verdade, e não só desenhado na tela;
     · revogar tem efeito imediato;
     · senha de usuário não sai por nenhum caminho.
   ──────────────────────────────────────────────────────────────────────────── */

let api;
let A;
let B;
let chaveDeA;
let base;

/** Sobe o router com o mesmo arranjo de corpo que o `server.js` monta. */
async function subir() {
  const app = express();
  app.use("/api/v1", express.text({ type: ["application/xml", "text/xml"], limit: "2mb" }));
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/v1", apiPublicaRouter);
  const servidor = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  return { servidor, base: `http://127.0.0.1:${servidor.address().port}` };
}

/** Requisição com uma chave qualquer — inclusive nenhuma. */
async function comChave(chave, caminho, { metodo = "GET", corpo, tipo = "application/json" } = {}) {
  const r = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers: {
      ...(chave ? { Authorization: `Bearer ${chave}` } : {}),
      ...(corpo === undefined ? {} : { "Content-Type": tipo }),
    },
    body: corpo === undefined ? undefined : (typeof corpo === "string" ? corpo : JSON.stringify(corpo)),
  });
  const texto = await r.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* XML, e o teste que pediu sabe disso */ }
  return { status: r.status, json, texto };
}

before(async () => {
  await limparRestos();
  A = await criarImobiliariaDeTeste();
  B = await criarImobiliariaDeTeste();

  // Um imóvel em cada, para haver o que confundir.
  await prisma.property.create({
    data: {
      tenantId: A.tenant.id, tipoImovelId: A.tipo.id, title: "Casa da A", description: "",
      price: 100000, address: "Rua A", city: "Cidade A", state: "SP", status: "ACTIVE",
      origemExterna: "A-1",
    },
  });
  await prisma.property.create({
    data: {
      tenantId: B.tenant.id, tipoImovelId: B.tipo.id, title: "Casa da B", description: "",
      price: 200000, address: "Rua B", city: "Cidade B", state: "RJ", status: "ACTIVE",
      origemExterna: "B-1",
    },
  });

  const criada = await criarChave({
    tenantId: A.tenant.id,
    nome: "Teste",
    escopos: ["imoveis:ler", "imoveis:escrever", "usuarios:ler"],
    criadaPor: "suite",
  });
  chaveDeA = criada.texto;

  const subida = await subir();
  api = subida.servidor;
  base = subida.base;
});

after(async () => {
  await new Promise((r) => api?.close(r));
  await apagarImobiliaria(A?.tenant?.id);
  await apagarImobiliaria(B?.tenant?.id);
  await prisma.$disconnect();
});

test("sem chave, 401 — e com o cabeçalho que diz o que falta", async () => {
  const r = await comChave(null, "/api/v1/imoveis");
  assert.equal(r.status, 401);
  assert.equal(r.json.code, "SEM_CHAVE");
});

test("chave inventada não passa", async () => {
  const r = await comChave("omni_sk_naoexisteessachaveaqui", "/api/v1/imoveis");
  assert.equal(r.status, 401);
  assert.equal(r.json.code, "CHAVE_INVALIDA");
});

test("a listagem traz SÓ o acervo de quem é dono da chave", async () => {
  const r = await comChave(chaveDeA, "/api/v1/imoveis");
  assert.equal(r.status, 200);
  assert.equal(r.json.total, 1);
  assert.equal(r.json.imoveis[0].title, "Casa da A");
});

test("A pede o imóvel de B pelo id real e recebe 404", async () => {
  /* O coração do arquivo. Um `findUnique` pelo id — sem `tenantId` no where —
     devolveria o registro de B com status 200, e o vazamento seria invisível em
     qualquer teste que só verificasse "a rota responde". */
  const daB = await prisma.property.findFirst({ where: { tenantId: B.tenant.id } });
  const r = await comChave(chaveDeA, `/api/v1/imoveis/${daB.id}`);
  assert.equal(r.status, 404);
});

test("A não consegue desativar imóvel de B", async () => {
  const daB = await prisma.property.findFirst({ where: { tenantId: B.tenant.id } });
  const r = await comChave(chaveDeA, `/api/v1/imoveis/${daB.id}`, { metodo: "DELETE" });
  assert.equal(r.status, 404);

  const conferido = await prisma.property.findUnique({ where: { id: daB.id } });
  assert.equal(conferido.status, "ACTIVE", "o imóvel de B foi mexido por uma chave de A");
});

test("A não consegue atualizar imóvel de B", async () => {
  const daB = await prisma.property.findFirst({ where: { tenantId: B.tenant.id } });
  const r = await comChave(chaveDeA, `/api/v1/imoveis/${daB.id}`, {
    metodo: "PUT",
    corpo: { title: "Invadido", price: 1 },
  });
  assert.equal(r.status, 404);

  const conferido = await prisma.property.findUnique({ where: { id: daB.id } });
  assert.equal(conferido.title, "Casa da B");
});

test("escopo que a chave não tem responde 403, dizendo qual falta", async () => {
  /* A chave de A tem imóveis e usuários, não clientes. Sem esta cobrança, os
     escopos seriam enfeite: a tela desenharia a escolha e a API entregaria
     tudo. */
  const r = await comChave(chaveDeA, "/api/v1/clientes");
  assert.equal(r.status, 403);
  assert.equal(r.json.code, "ESCOPO_INSUFICIENTE");
  assert.deepEqual(r.json.escoposFaltando, ["clientes:ler"]);
});

test("a listagem de usuários não devolve senha por caminho nenhum", async () => {
  /* O `select` explícito é o que impede isso, e ele é fácil de trocar por um
     `include` numa refatoração distraída. O teste é a rede embaixo. */
  const r = await comChave(chaveDeA, "/api/v1/usuarios");
  assert.equal(r.status, 200);
  assert.ok(r.json.usuarios.length > 0);
  for (const u of r.json.usuarios) {
    assert.equal(u.senha, undefined, "senha vazou na API");
    assert.equal(u.forcaAlterarSenha, undefined);
  }
  assert.doesNotMatch(r.texto, /sem-senha/, "o hash da senha apareceu no corpo");
});

test("escrever pela chave de A cria na A, e não em outro lugar", async () => {
  const r = await comChave(chaveDeA, "/api/v1/imoveis", {
    metodo: "POST",
    corpo: { imoveis: [{ origemExterna: "A-2", title: "Nova da A", price: 300000, city: "Cidade A" }] },
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.criados, 1);

  const naA = await prisma.property.findFirst({ where: { tenantId: A.tenant.id, origemExterna: "A-2" } });
  assert.ok(naA, "o imóvel não foi criado na imobiliária da chave");
  const vazou = await prisma.property.findFirst({ where: { tenantId: B.tenant.id, origemExterna: "A-2" } });
  assert.equal(vazou, null, "o imóvel foi parar na imobiliária errada");
});

test("reenviar o mesmo registro ATUALIZA, não duplica", async () => {
  /* É a promessa que permite a integração rodar de hora em hora. Se ela falhar,
     o acervo do cliente dobra de tamanho por dia. */
  const antes = await prisma.property.count({ where: { tenantId: A.tenant.id, origemExterna: "A-2" } });
  const r = await comChave(chaveDeA, "/api/v1/imoveis", {
    metodo: "POST",
    corpo: { imoveis: [{ origemExterna: "A-2", title: "Nova da A (corrigida)", price: 310000, city: "Cidade A" }] },
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.atualizados, 1);
  assert.equal(r.json.criados, 0);

  const depois = await prisma.property.count({ where: { tenantId: A.tenant.id, origemExterna: "A-2" } });
  assert.equal(depois, antes, "reenviar duplicou o registro");
});

test("a escrita por chave DEIXA RASTRO na trilha de auditoria", async () => {
  /* O furo que este teste guarda: a trilha lê o tenant do contexto da
     requisição, preenchido por `requireAuth`/`requireTenant` — e o caminho da
     chave não passa por nenhum dos dois. Sem o `preencherContexto` no
     middleware, uma integração mexia em quinhentos imóveis e o Registro de
     atividade ficava em branco. */
  const registros = await prisma.auditoria.findMany({
    where: { tenantId: A.tenant.id, entidade: "Property" },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  assert.ok(registros.length > 0, "a escrita por chave não entrou na trilha");
  const porApi = registros.find((r) => String(r.usuarioNome || "").startsWith("API ·"));
  assert.ok(porApi, "a trilha não identificou que a origem foi a API");
  assert.equal(porApi.usuarioId, null, "a trilha atribuiu a escrita da API a uma pessoa");
});

test("XML sai com o acervo, e só o de quem pediu", async () => {
  const r = await comChave(chaveDeA, "/api/v1/imoveis?formato=xml");
  assert.equal(r.status, 200);
  assert.match(r.texto, /<omnimob>/);
  assert.match(r.texto, /Casa da A/);
  assert.doesNotMatch(r.texto, /Casa da B/, "o XML trouxe imóvel de outra imobiliária");
});

test("`?desde=` no futuro devolve lista vazia", async () => {
  const amanha = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const r = await comChave(chaveDeA, `/api/v1/imoveis?desde=${encodeURIComponent(amanha)}`);
  assert.equal(r.status, 200);
  assert.equal(r.json.total, 0);
  assert.equal(r.json.desde, amanha);
});

test("`?desde=` inválido é ignorado em vez de parar a integração", async () => {
  const r = await comChave(chaveDeA, "/api/v1/imoveis?desde=ontem-de-manha");
  assert.equal(r.status, 200);
  assert.ok(r.json.total > 0);
  assert.equal(r.json.desde, null, "a resposta não avisou que o filtro foi ignorado");
});

test("`/eu` conta o que a chave alcança", async () => {
  const r = await comChave(chaveDeA, "/api/v1/eu");
  assert.equal(r.status, 200);
  assert.equal(r.json.imobiliaria.slug, A.slug);
  assert.deepEqual(r.json.chave.escopos.sort(), ["imoveis:escrever", "imoveis:ler", "usuarios:ler"]);
});

test("a documentação abre SEM chave", async () => {
  // Exigir credencial para ler a especificação é o atrito que faz o integrador
  // desistir antes de começar.
  const r = await comChave(null, "/api/v1/openapi.json");
  assert.equal(r.status, 200);
  assert.equal(r.json.openapi, "3.1.0");
  assert.ok(r.json.paths["/api/v1/imoveis"]);
});

test("chave revogada para de valer na hora", async () => {
  const { texto } = await criarChave({
    tenantId: A.tenant.id, nome: "Descartável", escopos: ["imoveis:ler"], criadaPor: "suite",
  });
  const antes = await comChave(texto, "/api/v1/imoveis");
  assert.equal(antes.status, 200);

  const registro = await prisma.chaveApi.findFirst({
    where: { tenantId: A.tenant.id, nome: "Descartável" },
  });
  await prisma.chaveApi.update({ where: { id: registro.id }, data: { revogadaEm: new Date() } });

  const depois = await comChave(texto, "/api/v1/imoveis");
  assert.equal(depois.status, 401, "chave revogada continuou funcionando");
});

test("plano abaixo de Profissional não abre a API", async () => {
  /* Defesa em profundidade, igual a redes sociais e domínio próprio: a tela
     esconde, e a API também recusa. */
  const basica = await criarImobiliariaDeTeste({ plano: "BASICO" });
  try {
    const { texto } = await criarChave({
      tenantId: basica.tenant.id, nome: "Da básica", escopos: ["imoveis:ler"], criadaPor: "suite",
    });
    const r = await comChave(texto, "/api/v1/imoveis");
    assert.equal(r.status, 403);
    assert.match(r.json.error, /Profissional/);
  } finally {
    await apagarImobiliaria(basica.tenant.id);
  }
});
