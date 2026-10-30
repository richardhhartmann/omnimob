import test, { after } from "node:test";
import assert from "node:assert/strict";
import { prisma, criarImobiliariaDeTeste, apagarImobiliaria, subirApi } from "./helpers.js";
import { authRouter } from "../src/routes/authRoutes.js";

/* ── Telas centradas ou em largura total (aba "Painel") ────────────────────────
   A escolha é da PESSOA e vale nas outras máquinas, então mora no servidor.
   Os dois defeitos que importam são silenciosos:
     · perder o "nunca escolhi": gravar falso no lugar de nulo tira a pessoa do
       automático para sempre — e ela nunca mais ganha o centrado no monitor
       largo sem saber por quê;
     · a escolha de um vazar para outro: é preferência de USUÁRIO, e a mesma
       imobiliária tem gente com monitor de 13 e de 34 polegadas.
   ────────────────────────────────────────────────────────────────────────── */

let api;
const criadas = [];

test.before(async () => {
  api = await subirApi({ "/api/auth": authRouter });
});

after(async () => {
  await api?.fechar?.();
  await Promise.all(criadas.map((t) => apagarImobiliaria(t)));
  await prisma.$disconnect();
});

test("quem nunca escolheu chega com nulo — o automático", async () => {
  const A = await criarImobiliariaDeTeste();
  criadas.push(A.tenant.id);
  const r = await api.comoTenant({ token: A.token, slug: A.slug }).get("/api/auth/me");
  assert.equal(r.status, 200);
  assert.equal(r.json.usuario?.layoutCentrado ?? r.json.layoutCentrado, null);
});

test("gravar centrado, largura total e voltar ao automático", async () => {
  const A = await criarImobiliariaDeTeste();
  criadas.push(A.tenant.id);
  const como = api.comoTenant({ token: A.token, slug: A.slug });

  for (const valor of [true, false, null]) {
    const r = await como.put("/api/auth/meu-layout", { centrado: valor });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.json.layoutCentrado, valor);
    const gravado = await prisma.usuario.findUnique({ where: { id: A.usuario.id }, select: { layoutCentrado: true } });
    assert.equal(gravado.layoutCentrado, valor, `o banco não guardou ${valor}`);
  }
});

test("valor que não é booleano nem nulo é recusado — e não apaga a escolha", async () => {
  const A = await criarImobiliariaDeTeste();
  criadas.push(A.tenant.id);
  const como = api.comoTenant({ token: A.token, slug: A.slug });
  await como.put("/api/auth/meu-layout", { centrado: true });

  for (const lixo of ["sim", 1, "true", {}, undefined]) {
    const r = await como.put("/api/auth/meu-layout", lixo === undefined ? {} : { centrado: lixo });
    assert.equal(r.status, 400, `aceitou ${JSON.stringify(lixo)}`);
  }
  const gravado = await prisma.usuario.findUnique({ where: { id: A.usuario.id }, select: { layoutCentrado: true } });
  assert.equal(gravado.layoutCentrado, true);
});

test("a escolha é da pessoa: gravar na conta de A não mexe na de B", async () => {
  const A = await criarImobiliariaDeTeste();
  const B = await criarImobiliariaDeTeste();
  criadas.push(A.tenant.id, B.tenant.id);

  await api.comoTenant({ token: A.token, slug: A.slug }).put("/api/auth/meu-layout", { centrado: true });
  const deB = await prisma.usuario.findUnique({ where: { id: B.usuario.id }, select: { layoutCentrado: true } });
  assert.equal(deB.layoutCentrado, null);
});

test("sem sessão, não grava", async () => {
  const r = await fetch(`${api.base}/api/auth/meu-layout`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ centrado: true }),
  });
  assert.equal(r.status, 401);
});
