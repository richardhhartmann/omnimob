import test from "node:test";
import assert from "node:assert/strict";
import {
  prisma, limparRestos, criarImobiliariaDeTeste, apagarImobiliaria, subirApi, travarAdminDaPlataforma,
} from "./helpers.js";
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

/* ── A imobiliária de demonstração não se apaga ─────────────────────────────
   Nem pelo super-admin com a permissão certa (a URL chamada direto recebe
   403 e o Stripe nem é consultado), nem pela faxina de trials — mesmo que
   alguém a tenha posto em TRIAL vencido à mão. A tela esconde o botão; isto é
   o que vale quando o botão não está lá. */
test("demo: a imobiliária de demonstração não pode ser excluída", async (t) => {
  const { adminRouter } = await import("../src/routes/adminRoutes.js");
  const { CARGO_ADMIN_PLATAFORMA, permissoesCompletas } = await import("../src/services/permissoesSuperAdmin.js");
  const { limparTrials } = await import("../src/services/trialService.js");
  const jwt = (await import("jsonwebtoken")).default;

  /* Compartilhada até o fim do teste: o teste do "último Administrador" não
     desativa o `chefe` daqui no meio (ver `travarAdminDaPlataforma`). */
  const soltarTrava = await travarAdminDaPlataforma();
  t.after(soltarTrava);
  const cargoAdmin = await prisma.cargoSuperAdmin.upsert({
    where: { nome: CARGO_ADMIN_PLATAFORMA },
    update: {},
    create: { nome: CARGO_ADMIN_PLATAFORMA, ...permissoesCompletas() },
  });
  const chefe = await prisma.superAdmin.create({
    data: { nome: `${A.slug}-chefe`, email: `${A.slug}-chefe@exemplo.test`, senha: "hash", ativo: true, cargoId: cargoAdmin.id },
  });
  const admin = await subirApi({ "/api/admin": adminRouter });
  const token = jwt.sign(
    { role: "SUPERADMIN", superAdminId: chefe.id, email: chefe.email },
    process.env.JWT_SECRET || "omnimob-dev-secret",
    { expiresIn: "10m" },
  );
  t.after(async () => {
    await admin.fechar();
    await prisma.superAdmin.delete({ where: { id: chefe.id } }).catch(() => {});
  });

  // A é a demonstração deste teste (DEMO_TENANT_SLUG aponta para ela).
  const r = await admin.comoTenant({ token, slug: "" }).del(`/api/admin/tenants/${A.tenant.id}`);
  assert.equal(r.status, 403);
  assert.equal(r.json?.code, "TENANT_PROTEGIDO");
  assert.ok(await prisma.tenant.findUnique({ where: { id: A.tenant.id } }), "a imobiliária tem que continuar lá");

  // A lista diz à tela que ela é protegida.
  const lista = await admin.comoTenant({ token, slug: "" }).get("/api/admin/tenants");
  assert.equal(lista.status, 200);
  assert.equal(lista.json.find((x) => x.id === A.tenant.id)?.protegido, true);

  // A faxina: posta em TRIAL vencido e desativada há muito, ainda assim fica.
  await prisma.tenant.update({
    where: { id: A.tenant.id },
    data: { statusPagamento: "TRIAL", ativo: false, suspensoEm: new Date(Date.now() - 400 * 86400000), proximoVencimento: new Date(Date.now() - 401 * 86400000) },
  });
  const faxina = await limparTrials({ aplicar: true, somenteIds: [A.tenant.id] }).catch((e) => ({ erro: e.message }));
  assert.ok(await prisma.tenant.findUnique({ where: { id: A.tenant.id } }), `a faxina não pode removê-la (${JSON.stringify(faxina)})`);
  await prisma.tenant.update({ where: { id: A.tenant.id }, data: { statusPagamento: "EM_DIA", ativo: true, suspensoEm: null, proximoVencimento: null } });
});
