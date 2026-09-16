import test from "node:test";
import assert from "node:assert/strict";
import { prisma, limparRestos, criarImobiliariaDeTeste, apagarImobiliaria, subirApi } from "./helpers.js";
import { authRouter } from "../src/routes/authRoutes.js";
import { propertyRouter } from "../src/routes/propertyRoutes.js";
import { cargoRouter } from "../src/routes/cargoRoutes.js";
import { tutorialRouter } from "../src/routes/tutorialRoutes.js";

/* ────────────────────────────────────────────────────────────────────────────
   A sessão de demonstração: entra em tudo e não escreve em nada.

   A conta de demonstração é COMPARTILHADA por todo visitante da landing. O que
   está sob teste é a trava do servidor, não a da tela: com o token da demo,
   qualquer escrita — imóvel, cargo, o próprio progresso do tour — recebe 403
   com `code: SOMENTE_DEMO`, e a leitura continua passando. Sem isso, um
   visitante alteraria (ou apagaria) o que o próximo visitante veria.

   O segundo lado também está aqui: o token NORMAL da mesma pessoa continua
   escrevendo. A trava é do escopo do token, não do usuário.

   `DEMO_TENANT_SLUG` é lido a cada chamada, então o teste aponta para uma
   imobiliária descartável e a apaga no fim.
   ──────────────────────────────────────────────────────────────────────────── */

let api;
let A;
let demo; // { token, slug }
let slugAnterior;

test.before(async () => {
  await limparRestos();
  api = await subirApi({
    "/api/auth": authRouter,
    "/api/properties": propertyRouter,
    "/api/cargos": cargoRouter,
    "/api/tutorial": tutorialRouter,
  });
  A = await criarImobiliariaDeTeste();
  slugAnterior = process.env.DEMO_TENANT_SLUG;
  process.env.DEMO_TENANT_SLUG = A.tenant.slug;
});

test.after(async () => {
  if (slugAnterior === undefined) delete process.env.DEMO_TENANT_SLUG;
  else process.env.DEMO_TENANT_SLUG = slugAnterior;
  await api?.fechar();
  if (A) await apagarImobiliaria(A.tenant.id);
  await limparRestos();
  await prisma.$disconnect();
});

test("demo: entra sem senha, com a marca `demo` e o Administrador da casa", async () => {
  const r = await fetch(`${api.base}/api/auth/demo`, { method: "POST" });
  assert.equal(r.status, 200);
  const sessao = await r.json();
  assert.equal(sessao.demo, true);
  assert.equal(sessao.tenant.slug, A.tenant.slug);
  assert.equal(sessao.usuario.cargo.descricao, "Administrador");
  assert.ok(sessao.token);
  demo = { token: sessao.token, slug: A.tenant.slug };
});

test("demo: lê, mas não escreve — e diz por quê", async () => {
  const cliente = api.comoTenant(demo);

  const leitura = await cliente.get("/api/properties");
  assert.equal(leitura.status, 200, "GET com o token da demo tem que passar");

  const escrita = await cliente.post("/api/properties", { title: "Não pode", price: 1 });
  assert.equal(escrita.status, 403);
  assert.equal(escrita.json?.code, "SOMENTE_DEMO");

  const cargo = await cliente.post("/api/cargos", { descricao: "Invasor" });
  assert.equal(cargo.status, 403);
  assert.equal(cargo.json?.code, "SOMENTE_DEMO");

  /* O progresso do tour também não: gravar "FINALIZADO" na conta compartilhada
     faria o tour sumir para o próximo visitante. */
  const tour = await cliente.post("/api/tutorial/marcar", { etapa: "boas-vindas", status: "FINALIZADO" });
  assert.equal(tour.status, 403);
  assert.equal(tour.json?.code, "SOMENTE_DEMO");

  const nadaCriado = await prisma.cargo.count({ where: { tenantId: A.tenant.id, descricao: "Invasor" } });
  assert.equal(nadaCriado, 0, "a escrita bloqueada não pode ter deixado rastro");
});

test("demo: a trava é do token, não da pessoa — a sessão normal continua escrevendo", async () => {
  const normal = api.comoTenant(A);
  const r = await normal.post("/api/cargos", { descricao: "Sessão normal" });
  assert.equal(r.status, 201);
});

test("demo: sem imobiliária configurada, não há demonstração", async () => {
  process.env.DEMO_TENANT_SLUG = "";
  try {
    const r = await fetch(`${api.base}/api/auth/demo`, { method: "POST" });
    assert.equal(r.status, 404);
  } finally {
    process.env.DEMO_TENANT_SLUG = A.tenant.slug;
  }
});
