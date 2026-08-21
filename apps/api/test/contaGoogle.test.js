import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

import {
  prisma, limparRestos, criarImobiliariaDeTeste, apagarImobiliaria, subirApi,
} from "./helpers.js";
import { authRouter } from "../src/routes/authRoutes.js";

/* ────────────────────────────────────────────────────────────────────────────
   Entrar com a conta do Google.

   ── O QUE ESTE ARQUIVO PROTEGE ──

   Três regras, e cada uma é a diferença entre um atalho de conveniência e uma
   porta dos fundos no sistema inteiro:

   1. ENTRAR NÃO CRIA USUÁRIO. Se criasse, qualquer pessoa com uma conta Google
      entraria no painel de qualquer imobiliária.

   2. A BUSCA É POR `googleId`, NUNCA POR E-MAIL. E-mail corporativo é
      reatribuído: quem herdasse o endereço de um corretor que saiu entraria no
      sistema como ele. O `sub` do Google não é reatribuído nunca.

   3. AS TRAVAS DO LOGIN VALEM AQUI. Usuário desativado e imobiliária suspensa
      barram do mesmo jeito — senão o Google vira o caminho curto para o
      vencimento não significar nada.

   ── COMO TESTAR SEM O GOOGLE ──

   Geramos um par de chaves RSA aqui mesmo e assinamos tokens com ele, servindo
   a chave pública no lugar do JWKS do Google. É a única forma de exercitar a
   verificação DE VERDADE — com um token falso e a verificação desligada, o
   teste provaria só que a rota responde.
   ──────────────────────────────────────────────────────────────────────────── */

const CLIENT_ID = "teste.apps.googleusercontent.com";
const KID = "chave-de-teste";

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: KID, alg: "RS256", use: "sig" };

/* Serve o JWKS de um servidor local, no lugar do Google.

   A primeira versão trocava o `fetch` global — e travou o processo de teste
   inteiro. Um servidor de verdade em `GOOGLE_JWKS_URL` é mais honesto: o
   caminho exercitado é o MESMO de produção, com ida à rede, leitura do
   `cache-control` e cache. O que muda é só de onde as chaves vêm. */
let servidorJwks;
async function subirJwks() {
  const { createServer } = await import("node:http");
  return new Promise((resolver) => {
    servidorJwks = createServer((req, res) => {
      res.writeHead(200, { "content-type": "application/json", "cache-control": "max-age=3600" });
      res.end(JSON.stringify({ keys: [jwk] }));
    });
    servidorJwks.listen(0, "127.0.0.1", () => {
      process.env.GOOGLE_JWKS_URL = `http://127.0.0.1:${servidorJwks.address().port}/certs`;
      resolver();
    });
  });
}

function tokenDoGoogle({ sub, email = "pessoa@exemplo.test", verificado = true, aud = CLIENT_ID, nome = "Pessoa", foto = null }) {
  return jwt.sign(
    { sub, email, email_verified: verificado, name: nome, picture: foto },
    privateKey,
    { algorithm: "RS256", keyid: KID, audience: aud, issuer: "https://accounts.google.com", expiresIn: "5m" },
  );
}

let api;
let A;
let B;

test.before(async () => {
  process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
  await subirJwks();
  await limparRestos();
  api = await subirApi({ "/api/auth": authRouter });
  A = await criarImobiliariaDeTeste();
  B = await criarImobiliariaDeTeste();
});

test.after(async () => {
  await api?.fechar();
  if (A) await apagarImobiliaria(A.tenant.id);
  if (B) await apagarImobiliaria(B.tenant.id);
  await limparRestos();
  await new Promise((r) => servidorJwks?.close(r));
  await prisma.$disconnect();
});

test("entrar sem vínculo NÃO cria usuário — recusa e ensina o caminho", async () => {
  const r = await api.comoTenant(A).post("/api/auth/google/entrar", {
    credential: tokenDoGoogle({ sub: "google-desconhecido-1" }),
  });

  assert.equal(r.status, 404);
  assert.equal(r.json.code, "GOOGLE_SEM_VINCULO");
  // A mensagem tem que dizer o que FAZER, não só que deu errado.
  assert.match(r.json.error, /vincule a conta/i);

  const criado = await prisma.usuario.findUnique({ where: { googleId: "google-desconhecido-1" } });
  assert.equal(criado, null, "entrar com Google jamais pode criar usuário");
});

test("vincular exige estar logado, e depois disso entrar funciona", async () => {
  const credencial = tokenDoGoogle({ sub: "google-do-admin-A", email: "admin@exemplo.test", foto: "https://x/foto.jpg" });

  const vinculo = await api.comoTenant(A).post("/api/auth/google/vincular", { credential: credencial });
  assert.equal(vinculo.status, 200);
  assert.equal(vinculo.json.vinculado, true);

  const entrada = await api.comoTenant(A).post("/api/auth/google/entrar", { credential: credencial });
  assert.equal(entrada.status, 200);
  assert.ok(entrada.json.token, "a entrada tem que devolver uma sessão");
  assert.equal(entrada.json.usuario.id, A.usuario.id);
});

test("o casamento é por googleId, e NÃO por e-mail", async () => {
  /* O cenário real: alguém herda o endereço corporativo de quem saiu. Mesmo
     e-mail, conta Google diferente — e não pode entrar como o antecessor. */
  const outraConta = tokenDoGoogle({ sub: "google-de-outra-pessoa", email: "admin@exemplo.test" });

  const r = await api.comoTenant(A).post("/api/auth/google/entrar", { credential: outraConta });
  assert.equal(r.status, 404, "e-mail igual não pode abrir a sessão de outra conta");
  assert.equal(r.json.code, "GOOGLE_SEM_VINCULO");
});

test("uma conta Google não serve a dois usuários", async () => {
  const mesma = tokenDoGoogle({ sub: "google-do-admin-A" });
  const r = await api.comoTenant(B).post("/api/auth/google/vincular", { credential: mesma });
  assert.equal(r.status, 409);
  assert.equal(r.json.code, "GOOGLE_JA_VINCULADO");
  // E não revela QUEM é o dono: isso não é assunto de quem tentou.
  assert.ok(!r.json.error.includes(A.usuario.nome));
});

test("token de OUTRO aplicativo é recusado", async () => {
  /* Sem a conferência de `aud`, qualquer ID token do Google — e há milhões,
     emitidos por milhões de aplicativos — serviria para entrar aqui. */
  const deOutroApp = tokenDoGoogle({ sub: "google-do-admin-A", aud: "outro-app.apps.googleusercontent.com" });
  const r = await api.comoTenant(A).post("/api/auth/google/entrar", { credential: deOutroApp });
  assert.equal(r.status, 400);
  assert.equal(r.json.code, "TOKEN_INVALIDO");
});

test("token assinado por outra chave é recusado", async () => {
  const intruso = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const forjado = jwt.sign(
    { sub: "google-do-admin-A", email: "admin@exemplo.test", email_verified: true },
    intruso.privateKey,
    { algorithm: "RS256", keyid: KID, audience: CLIENT_ID, issuer: "https://accounts.google.com", expiresIn: "5m" },
  );

  const r = await api.comoTenant(A).post("/api/auth/google/entrar", { credential: forjado });
  assert.equal(r.status, 400, "assinatura de outra chave não pode passar");
  assert.equal(r.json.code, "TOKEN_INVALIDO");
});

test("e-mail não verificado no Google é recusado", async () => {
  const semConfirmar = tokenDoGoogle({ sub: "google-do-admin-A", verificado: false });
  const r = await api.comoTenant(A).post("/api/auth/google/entrar", { credential: semConfirmar });
  assert.equal(r.status, 400);
  assert.equal(r.json.code, "EMAIL_NAO_VERIFICADO");
});

test("usuário desativado não entra pelo Google", async () => {
  await prisma.usuario.update({ where: { id: A.usuario.id }, data: { ativo: false } });
  const r = await api.comoTenant(A).post("/api/auth/google/entrar", {
    credential: tokenDoGoogle({ sub: "google-do-admin-A" }),
  });
  await prisma.usuario.update({ where: { id: A.usuario.id }, data: { ativo: true } });

  assert.equal(r.status, 401, "o Google não pode ser a porta que ignora usuário desativado");
});
