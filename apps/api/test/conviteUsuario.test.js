import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { prisma, limparRestos, criarImobiliariaDeTeste, apagarImobiliaria, subirApi } from "./helpers.js";
import { authRouter } from "../src/routes/authRoutes.js";
import { usuarioRouter } from "../src/routes/usuarioRoutes.js";

/* ────────────────────────────────────────────────────────────────────────────
   O convite por e-mail e o login por e-mail.

   O que está sob teste é a PORTA que fechou: usuário novo nasce sem senha, e
   antes qualquer pessoa que soubesse o login (previsível: nome + slug) definia
   a senha no "primeiro acesso" e entrava. Agora a senha só nasce pelo link do
   e-mail — e o login e o `definir-senha` recusam a conta sem senha.

   E-mail é neutralizado em `helpers.js`, então o link volta na resposta da
   criação — é por ele que o teste ativa a conta, como a pessoa faria.
   ──────────────────────────────────────────────────────────────────────────── */

let api;
let A;
let B;

test.before(async () => {
  await limparRestos();
  api = await subirApi({ "/api/auth": authRouter, "/api/usuarios": usuarioRouter });
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

const entrar = (login, senha) =>
  fetch(`${api.base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login, senha }),
  }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));

const email = (sufixo) => `${A.slug}-${sufixo}@exemplo.test`;

test("criar usuário exige e-mail", async () => {
  const r = await api.comoTenant(A).post("/api/usuarios", { nome: "Sem e-mail", login: "sem-email", cargoCodigo: A.cargoComum.id });
  assert.equal(r.status, 400);
  assert.match(r.json?.error || "", /e-mail/i);
});

test("o convite ativa a conta; sem ele, nem o login nem o definir-senha abrem", async () => {
  const criado = await api.comoTenant(A).post("/api/usuarios", {
    nome: "Convidada", login: "convidada", email: email("convidada"), cargoCodigo: A.cargoComum.id,
  });
  assert.equal(criado.status, 201);
  assert.equal(criado.json.semSenha, true);
  assert.equal(criado.json.convite.enviado, false, "sem transporte de e-mail, o link volta na resposta");
  assert.match(criado.json.convite.link, /\/redefinir-senha\?token=.+&convite=1$/);
  assert.equal(criado.json.senha, undefined, "o hash nunca sai");

  // A porta antiga: login sem senha caía em "defina sua senha". Agora recusa.
  const semSenha = await entrar(criado.json.login, "");
  assert.equal(semSenha.status, 403);
  assert.equal(semSenha.json?.precisaAtivar, true);

  const define = await fetch(`${api.base}/api/auth/definir-senha`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login: criado.json.login, novaSenha: "invasor-123" }),
  });
  assert.equal(define.status, 403, "definir-senha não pode ativar uma conta sem senha");

  // O caminho certo: o link do convite.
  const token = new URL(criado.json.convite.link).searchParams.get("token");
  const ativa = await fetch(`${api.base}/api/auth/redefinir-senha`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, novaSenha: "minha-senha-123" }),
  });
  assert.equal(ativa.status, 200);
  const sessao = await ativa.json();
  assert.ok(sessao.token, "quem criou a senha já entra");
  assert.equal(sessao.tenant.slug, A.slug);

  // E o mesmo link não vale duas vezes.
  const denovo = await fetch(`${api.base}/api/auth/redefinir-senha`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, novaSenha: "outra-senha-123" }),
  });
  assert.equal(denovo.status, 400);
  assert.equal((await denovo.json()).code, "TOKEN_USADO");

  // Daqui em diante, o login funciona — pelo login E pelo e-mail.
  assert.equal((await entrar(criado.json.login, "minha-senha-123")).status, 200);
  assert.equal((await entrar(email("convidada"), "minha-senha-123")).status, 200);
  assert.equal((await entrar(email("CONVIDADA"), "minha-senha-123")).status, 200, "e-mail não diferencia maiúsculas");
  assert.equal((await entrar(email("convidada"), "errada")).status, 401);

  // Reenviar: só para quem ainda não tem senha.
  const reenvio = await api.comoTenant(A).post(`/api/usuarios/${criado.json.id}/convite`);
  assert.equal(reenvio.status, 400, "conta já ativada não recebe convite de novo");
});

test("reenviar convite gera um link novo para quem ainda não ativou", async () => {
  const criado = await api.comoTenant(A).post("/api/usuarios", {
    nome: "Esqueceu", login: "esqueceu", email: email("esqueceu"), cargoCodigo: A.cargoComum.id,
  });
  assert.equal(criado.status, 201);
  const reenvio = await api.comoTenant(A).post(`/api/usuarios/${criado.json.id}/convite`);
  assert.equal(reenvio.status, 200);
  assert.match(reenvio.json.convite.link, /convite=1$/);

  // A lista diz quem ainda não ativou — sem nunca soltar o hash.
  const lista = await api.comoTenant(A).get("/api/usuarios");
  const linha = lista.json.find((u) => u.id === criado.json.id);
  assert.equal(linha.semSenha, true);
  assert.equal(linha.senha, undefined);

  // B não reenvia convite de usuário da A pelo id real.
  const deFora = await api.comoTenant(B).post(`/api/usuarios/${criado.json.id}/convite`);
  assert.equal(deFora.status, 404);
});

test("o mesmo e-mail em duas imobiliárias: a senha decide qual conta é", async () => {
  const comum = `${A.slug}-dono@exemplo.test`;
  const [hashA, hashB] = await Promise.all([bcrypt.hash("senha-da-A", 8), bcrypt.hash("senha-da-B", 8)]);
  await prisma.usuario.create({
    data: { tenantId: A.tenant.id, cargoCodigo: A.cargoAdmin.id, nome: "Dono A", login: `${A.slug}-dono-a`, email: comum, senha: hashA, ativo: true },
  });
  await prisma.usuario.create({
    data: { tenantId: B.tenant.id, cargoCodigo: B.cargoAdmin.id, nome: "Dono B", login: `${B.slug}-dono-b`, email: comum, senha: hashB, ativo: true },
  });

  const naA = await entrar(comum, "senha-da-A");
  assert.equal(naA.status, 200);
  assert.equal(naA.json.tenant.slug, A.slug);

  const naB = await entrar(comum, "senha-da-B");
  assert.equal(naB.status, 200);
  assert.equal(naB.json.tenant.slug, B.slug);

  const nenhuma = await entrar(comum, "senha-de-ninguem");
  assert.equal(nenhuma.status, 401);
});
