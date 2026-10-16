import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import {
  prisma, PREFIXO, criarImobiliariaDeTeste, apagarImobiliaria, subirApi, travarAdminDaPlataforma,
} from "./helpers.js";
import { adminRouter } from "../src/routes/adminRoutes.js";
import { CARGO_ADMIN_PLATAFORMA, permissoesCompletas } from "../src/services/permissoesSuperAdmin.js";

/* ────────────────────────────────────────────────────────────────────────────
   Cargos do super-admin: o servidor é quem protege.

   O que está sob teste é a junção rota + cargo: um "Suporte" que vê Tenants e
   Chamados precisa receber 403 ao chamar `entrar` direto, mesmo sabendo a
   URL — a tela esconder o botão não é proteção. E o rebaixamento precisa
   valer na requisição SEGUINTE, não daqui a sete dias: o middleware relê o
   cargo do banco a cada chamada.

   Os super-admins e cargos criados aqui levam o prefixo dos testes e são
   apagados no fim. O cargo Administrador é o da migração — o teste não o cria
   nem o apaga, só garante que ele existe.
   ──────────────────────────────────────────────────────────────────────────── */

const JWT_SECRET = process.env.JWT_SECRET || "omnimob-dev-secret";

const tokenDe = (admin) =>
  jwt.sign({ role: "SUPERADMIN", superAdminId: admin.id, email: admin.email }, JWT_SECRET, { expiresIn: "10m" });

async function criarSuperAdmin({ nome, cargoId, senha = "hash-qualquer" }) {
  return prisma.superAdmin.create({
    data: { nome: `${PREFIXO}${nome}`, email: `${PREFIXO}${nome}@exemplo.test`, senha, ativo: true, cargoId },
  });
}

async function limpar() {
  await prisma.superAdmin.deleteMany({ where: { email: { startsWith: PREFIXO } } });
  await prisma.cargoSuperAdmin.deleteMany({ where: { nome: { startsWith: PREFIXO } } });
  await prisma.auditoria.deleteMany({ where: { tenantId: null, usuarioNome: { contains: PREFIXO } } });
}

test("cargos do super-admin", async (t) => {
  await limpar();

  /* O Administrador da plataforma, como a migração o deixa. Idempotente, para
     o teste não depender de o seed ter rodado neste banco. */
  const cargoAdmin = await prisma.cargoSuperAdmin.upsert({
    where: { nome: CARGO_ADMIN_PLATAFORMA },
    update: {},
    create: { nome: CARGO_ADMIN_PLATAFORMA, ...permissoesCompletas() },
  });

  const suporte = await prisma.cargoSuperAdmin.create({
    data: { nome: `${PREFIXO}Suporte`, verTenants: true, verChamados: true },
  });

  const chefe = await criarSuperAdmin({ nome: "chefe", cargoId: cargoAdmin.id });
  const atendente = await criarSuperAdmin({ nome: "atendente", cargoId: suporte.id });
  const imobiliaria = await criarImobiliariaDeTeste();

  const api = await subirApi({ "/api/admin": adminRouter });
  const como = (admin) => api.comoTenant({ token: tokenDe(admin), slug: "" });

  t.after(async () => {
    await api.fechar();
    await apagarImobiliaria(imobiliaria.tenant.id);
    await limpar();
  });

  await t.test("Suporte vê Tenants e Chamados, e mais nada", async () => {
    const eu = await como(atendente).get("/api/admin/eu");
    assert.equal(eu.status, 200);
    assert.equal(eu.json.permissoes.verTenants, true);
    assert.equal(eu.json.permissoes.entrarNoTenant, false);

    assert.equal((await como(atendente).get("/api/admin/tenants")).status, 200);
    assert.equal((await como(atendente).get("/api/admin/chamados")).status, 200);
    assert.equal((await como(atendente).get("/api/admin/tutoriais")).status, 403);
    assert.equal((await como(atendente).get("/api/admin/usuarios")).status, 403);
    assert.equal((await como(atendente).get("/api/admin/totp")).status, 403);
  });

  await t.test("Suporte não entra, não edita nem exclui — nem chamando a URL direto", async () => {
    const id = imobiliaria.tenant.id;
    const entrar = await como(atendente).post(`/api/admin/tenants/${id}/entrar`);
    assert.equal(entrar.status, 403);
    assert.equal(entrar.json.code, "SEM_PERMISSAO");
    assert.equal((await como(atendente).put(`/api/admin/tenants/${id}`, { name: "x" })).status, 403);
    assert.equal((await como(atendente).del(`/api/admin/tenants/${id}`)).status, 403);
    assert.equal((await como(atendente).patch("/api/admin/chamados/1", { resolvido: true })).status, 403);

    // E a imobiliária continua lá: o 403 chegou antes de qualquer escrita.
    assert.ok(await prisma.tenant.findUnique({ where: { id } }));
  });

  await t.test("rebaixar surte efeito na requisição seguinte", async () => {
    const outro = await criarSuperAdmin({ nome: "rebaixado", cargoId: cargoAdmin.id });
    assert.equal((await como(outro).get("/api/admin/usuarios")).status, 200);

    const r = await como(chefe).put(`/api/admin/usuarios/${outro.id}`, { cargoId: suporte.id });
    assert.equal(r.status, 200, JSON.stringify(r.json));

    // Mesmo token de antes — o que mudou foi o banco.
    assert.equal((await como(outro).get("/api/admin/usuarios")).status, 403);
  });

  await t.test("o Administrador não é excluído nem perde as chaves da casa", async () => {
    const del = await como(chefe).del(`/api/admin/cargos/${cargoAdmin.id}`);
    assert.equal(del.status, 400);

    const put = await como(chefe).put(`/api/admin/cargos/${cargoAdmin.id}`, {
      verCargos: false, verUsuarios: false, gerenciarUsuarios: false, verTutoriais: false,
    });
    assert.equal(put.status, 200, JSON.stringify(put.json));
    // As três chaves voltam ligadas; a que não é chave obedece.
    assert.equal(put.json.verCargos, true);
    assert.equal(put.json.verUsuarios, true);
    assert.equal(put.json.gerenciarUsuarios, true);
    assert.equal(put.json.verTutoriais, false);

    // Devolve o que o teste mexeu, para não deixar o cargo real torto.
    await prisma.cargoSuperAdmin.update({ where: { id: cargoAdmin.id }, data: { verTutoriais: true } });
  });

  await t.test("ação sem a aba é desligada na gravação", async () => {
    const r = await como(chefe).post("/api/admin/cargos", {
      nome: `${PREFIXO}Torto`, excluirTenant: true, resolverChamado: true, verChamados: true,
    });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(r.json.excluirTenant, false, "excluir sem ver Tenants não existe");
    assert.equal(r.json.resolverChamado, true);
  });

  await t.test("criar usuário manda convite; o link define a senha uma vez só", async () => {
    const r = await como(chefe).post("/api/admin/usuarios", {
      nome: `${PREFIXO}novata`, email: `${PREFIXO}novata@exemplo.test`, cargoId: suporte.id,
    });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(r.json.aguardandoConvite, true);
    /* Sem transporte de e-mail (o andaime o desliga), o link volta na
       resposta — é como o cadastro se conclui em dev. */
    assert.equal(r.json.convite.enviado, false);
    const token = new URL(r.json.convite.link).searchParams.get("token");
    assert.ok(token);

    // Conta sem senha não entra pelo login.
    const login = await como(chefe).post("/api/admin/login", { email: r.json.email, senha: "qualquer-coisa" });
    assert.equal(login.status, 401);

    const previa = await como(chefe).get(`/api/admin/convite/${encodeURIComponent(token)}`);
    assert.equal(previa.status, 200);
    assert.equal(previa.json.valido, true);

    const curta = await como(chefe).post("/api/admin/convite", { token, novaSenha: "1234567" });
    assert.equal(curta.status, 400);

    const definiu = await como(chefe).post("/api/admin/convite", { token, novaSenha: "senha-forte-1" });
    assert.equal(definiu.status, 200, JSON.stringify(definiu.json));
    assert.ok(definiu.json.token, "já devolve a sessão");
    assert.equal(definiu.json.permissoes.verTenants, true);

    // O mesmo link, de novo: a impressão digital mudou junto com a senha.
    const repetiu = await como(chefe).post("/api/admin/convite", { token, novaSenha: "outra-senha-2" });
    assert.equal(repetiu.status, 400);
    assert.equal(repetiu.json.code, "TOKEN_USADO");

    // Quem já definiu a senha não recebe convite de novo.
    const reenvio = await como(chefe).post(`/api/admin/usuarios/${r.json.id}/convite`);
    assert.equal(reenvio.status, 400);
  });

  await t.test("o último Administrador ativo não é rebaixado nem desativado", async () => {
    /* Só o `chefe` é Administrador ativo COM SENHA entre os do teste — mas o
       banco pode ter outros (o seed). Para a trava valer, o teste desativa os
       demais temporariamente e os devolve no fim.

       Com a trava EXCLUSIVA: os outros arquivos que usam um Administrador
       descartável seguram a compartilhada, e desativá-los no meio do teste
       deles era o que fazia a suíte de chamados receber 401 (ver
       `travarAdminDaPlataforma`, em `helpers.js`). A lista dos "outros" é lida
       DEPOIS de tomar a trava, senão um Administrador criado no intervalo
       ficaria de fora e a contagem da rota mentiria. */
    const soltar = await travarAdminDaPlataforma({ exclusiva: true });
    const outros = await prisma.superAdmin.findMany({
      where: { id: { not: chefe.id }, ativo: true, cargoId: cargoAdmin.id },
      select: { id: true },
    });
    await prisma.superAdmin.updateMany({ where: { id: { in: outros.map((o) => o.id) } }, data: { ativo: false } });
    try {
      const gerente = await criarSuperAdmin({ nome: "gerente", cargoId: suporte.id });
      const r = await como(gerente).put(`/api/admin/usuarios/${chefe.id}`, { cargoId: suporte.id });
      assert.equal(r.status, 403, "Suporte não gere usuários");

      await prisma.superAdmin.update({ where: { id: gerente.id }, data: { cargoId: cargoAdmin.id } });
      // Agora o gerente é Administrador também — então o chefe pode ser rebaixado…
      const ok = await como(gerente).put(`/api/admin/usuarios/${chefe.id}`, { cargoId: suporte.id });
      assert.equal(ok.status, 200, JSON.stringify(ok.json));
      // …e o gerente, que ficou sendo o último, não.
      const ultimo = await como(gerente).put(`/api/admin/usuarios/${gerente.id}`, { cargoId: suporte.id });
      assert.equal(ultimo.status, 400);
      const proprio = await como(gerente).put(`/api/admin/usuarios/${gerente.id}`, { ativo: false });
      assert.equal(proprio.status, 400);

      await prisma.superAdmin.update({ where: { id: chefe.id }, data: { cargoId: cargoAdmin.id } });
    } finally {
      await prisma.superAdmin.updateMany({ where: { id: { in: outros.map((o) => o.id) } }, data: { ativo: true } });
      await soltar();
    }
  });

  await t.test("criar cargo e usuário deixa rastro na trilha, sem imobiliária", async () => {
    const linhas = await prisma.auditoria.findMany({
      where: { tenantId: null, usuarioId: chefe.id },
      select: { entidade: true, acao: true, dados: true, usuarioNome: true },
    });
    const entidades = new Set(linhas.map((l) => `${l.acao} ${l.entidade}`));
    assert.ok(entidades.has("CRIOU CargoSuperAdmin"), [...entidades].join(", "));
    assert.ok(entidades.has("CRIOU SuperAdmin"));
    assert.ok(entidades.has("ALTEROU SuperAdmin"));
    assert.ok(linhas.every((l) => l.usuarioNome.startsWith("Omnimob (")));
    // Senha nunca entra, nem vazia.
    const criacao = linhas.find((l) => l.acao === "CRIOU" && l.entidade === "SuperAdmin");
    assert.equal(criacao.dados.senha, "‹oculto›");
  });
});
