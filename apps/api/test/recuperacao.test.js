import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

import { authRouter } from "../src/routes/authRoutes.js";
import {
  prisma, limparRestos, criarImobiliariaDeTeste, apagarImobiliaria, subirApi,
} from "./helpers.js";

/* ────────────────────────────────────────────────────────────────────────────
   Recuperação de senha.

   Duas propriedades valem mais que o caminho feliz, e são as que estes testes
   guardam:

     · a resposta é IDÊNTICA exista a conta ou não. Se um dia alguém "melhorar"
       a mensagem para dizer "usuário não encontrado", a tela vira um
       verificador de logins válidos — e o login aqui é derivado do nome da
       imobiliária, que é público na vitrine.

     · o link é de USO ÚNICO. Não há tabela de tokens: o que garante isso é a
       impressão digital da senha no payload. Trocar a senha muda a impressão e
       queima o link. Um refactor que remova a impressão passaria em todo teste
       de caminho feliz e deixaria o link do e-mail valendo por uma hora.
   ──────────────────────────────────────────────────────────────────────────── */

const JWT_SECRET = process.env.JWT_SECRET || "omnimob-dev-secret";
const impressao = (h) => crypto.createHash("sha256").update(String(h || "")).digest("hex").slice(0, 16);

/** Monta o link como a rota monta, para exercitar o consumo sem depender do e-mail. */
function tokenPara(usuario, { proposito = "recuperar-senha", fp } = {}) {
  return jwt.sign(
    { userId: usuario.id, proposito, fp: fp ?? impressao(usuario.senha) },
    JWT_SECRET,
    { expiresIn: "1h" },
  );
}

let api;
let A;

test.before(async () => {
  await limparRestos();
  api = await subirApi({ "/api/auth": authRouter });
  A = await criarImobiliariaDeTeste();
  // Senha real: o teste confere que a nova senha grava um hash válido.
  await prisma.usuario.update({
    where: { id: A.usuario.id },
    data: { senha: await bcrypt.hash("senhaAntiga1", 10) },
  });
});

test.after(async () => {
  await api?.fechar();
  if (A) await apagarImobiliaria(A.tenant.id);
  await limparRestos();
  await prisma.$disconnect();
});

const cliente = () => api.comoTenant({ token: "", slug: "" });

test("pedido: a resposta não revela se a conta existe", async () => {
  const existente = await cliente().post("/api/auth/recuperar-senha", { identificador: A.usuario.login });
  const inexistente = await cliente().post("/api/auth/recuperar-senha", { identificador: "nao-existe-jamais-xyz" });

  assert.equal(existente.status, 200);
  assert.equal(inexistente.status, 200);
  assert.deepEqual(
    existente.json, inexistente.json,
    "conta existente e inexistente têm de devolver exatamente a mesma coisa",
  );
});

test("pedido: identificador vazio não quebra e responde igual", async () => {
  const r = await cliente().post("/api/auth/recuperar-senha", { identificador: "" });
  assert.equal(r.status, 200);
  assert.ok(r.json.mensagem);
});

test("pedido: aceita e-mail além do login", async () => {
  const r = await cliente().post("/api/auth/recuperar-senha", { identificador: A.usuario.email });
  assert.equal(r.status, 200);
});

test("link: conferência antes de digitar diz o nome de quem vai trocar", async () => {
  const usuario = await prisma.usuario.findUnique({ where: { id: A.usuario.id } });
  const r = await cliente().get(`/api/auth/redefinir-senha/${encodeURIComponent(tokenPara(usuario))}`);
  assert.equal(r.status, 200);
  assert.equal(r.json.valido, true);
  assert.equal(r.json.nome, usuario.nome);
});

test("link: token de outro propósito é recusado", async () => {
  /* Um convite de trial é assinado com o MESMO segredo. Sem a conferência de
     propósito, ele serviria para trocar a senha de alguém. */
  const usuario = await prisma.usuario.findUnique({ where: { id: A.usuario.id } });
  const r = await cliente().post("/api/auth/redefinir-senha", {
    token: tokenPara(usuario, { proposito: "trial" }),
    novaSenha: "qualquerCoisa1",
  });
  assert.equal(r.status, 400);
  assert.equal(r.json.code, "TOKEN_INVALIDO");
});

test("link: token adulterado é recusado", async () => {
  const usuario = await prisma.usuario.findUnique({ where: { id: A.usuario.id } });
  const t = tokenPara(usuario);
  const r = await cliente().post("/api/auth/redefinir-senha", {
    token: `${t.slice(0, -4)}aaaa`,
    novaSenha: "qualquerCoisa1",
  });
  assert.equal(r.status, 400);
  assert.equal(r.json.code, "TOKEN_INVALIDO");
});

test("link: impressão digital de outra senha é recusada", async () => {
  const usuario = await prisma.usuario.findUnique({ where: { id: A.usuario.id } });
  const r = await cliente().post("/api/auth/redefinir-senha", {
    token: tokenPara(usuario, { fp: "0000000000000000" }),
    novaSenha: "qualquerCoisa1",
  });
  assert.equal(r.status, 400);
  assert.equal(r.json.code, "TOKEN_USADO");
});

test("senha nova: menos de 6 caracteres é recusada", async () => {
  const usuario = await prisma.usuario.findUnique({ where: { id: A.usuario.id } });
  const r = await cliente().post("/api/auth/redefinir-senha", {
    token: tokenPara(usuario),
    novaSenha: "123",
  });
  assert.equal(r.status, 400);
});

test("redefinir: grava a senha, devolve sessão e QUEIMA o link", async () => {
  const antes = await prisma.usuario.findUnique({ where: { id: A.usuario.id } });
  const token = tokenPara(antes);

  const r = await cliente().post("/api/auth/redefinir-senha", { token, novaSenha: "senhaNova123" });
  assert.equal(r.status, 200);
  assert.ok(r.json.token, "deveria devolver a sessão pronta");
  assert.equal(r.json.usuario.login, antes.login);

  const depois = await prisma.usuario.findUnique({ where: { id: A.usuario.id } });
  assert.ok(await bcrypt.compare("senhaNova123", depois.senha), "a senha nova precisa valer");
  assert.equal(depois.forcaAlterarSenha, false, "não pode cair na tela de trocar senha logo depois");

  // A segunda tentativa com o MESMO link é o coração do desenho.
  const reuso = await cliente().post("/api/auth/redefinir-senha", { token, novaSenha: "outraAinda1" });
  assert.equal(reuso.status, 400);
  assert.equal(reuso.json.code, "TOKEN_USADO");

  const final = await prisma.usuario.findUnique({ where: { id: A.usuario.id } });
  assert.ok(await bcrypt.compare("senhaNova123", final.senha), "o reuso não pode ter trocado nada");
});

test("redefinir: usuário desativado não redefine", async () => {
  const usuario = await prisma.usuario.findUnique({ where: { id: A.usuario.id } });
  const token = tokenPara(usuario);
  await prisma.usuario.update({ where: { id: A.usuario.id }, data: { ativo: false } });
  try {
    const r = await cliente().post("/api/auth/redefinir-senha", { token, novaSenha: "maisUma123" });
    assert.equal(r.status, 400);
    assert.equal(r.json.code, "TOKEN_INVALIDO");
  } finally {
    await prisma.usuario.update({ where: { id: A.usuario.id }, data: { ativo: true } });
  }
});
