import test, { after } from "node:test";
import assert from "node:assert/strict";
import { prisma, criarImobiliariaDeTeste, apagarImobiliaria, subirApi } from "./helpers.js";
import { authRouter } from "../src/routes/authRoutes.js";
import { normalizarBarra, MAXIMO_SECOES } from "../src/services/barraLateral.js";

/* ── A barra lateral personalizada (seções da pessoa) ─────────────────────────
   Os defeitos que importam:
     · a escolha de um vazar para outro — é preferência da PESSOA;
     · lixo gravado derrubar a barra de quem abre o painel — o servidor só
       aceita o formato, e a sessão devolve nulo para o que não presta;
     · apagar a última seção deixar um objeto vazio no lugar de "nunca
       personalizou".
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

const FAVORITOS = { secoes: [{ id: "s-fav1", nome: "Favoritos", itens: ["imoveis-lista", "rel-mensal", "flow-funil"] }], ativa: "s-fav1" };

test("o formato: nome limpo, itens sem repetição, ativa inexistente vira a barra inteira", () => {
  const r = normalizarBarra({ secoes: [{ id: "s-a", nome: "  Meus   favoritos ", itens: ["a", "a", "b"] }], ativa: "s-zzz" });
  assert.deepEqual(r, { secoes: [{ id: "s-a", nome: "Meus favoritos", itens: ["a", "b"] }], ativa: null });
  assert.deepEqual(normalizarBarra(null), { secoes: [], ativa: null });
  for (const lixo of ["x", [], { secoes: "x" }, { secoes: [{ id: "S A", nome: "x", itens: [] }] }, { secoes: [{ id: "s-a", nome: "  ", itens: [] }] },
    { secoes: [{ id: "s-a", nome: "x", itens: ["<script>"] }] }, { secoes: [{ id: "s-a", nome: "a", itens: [] }, { id: "s-a", nome: "b", itens: [] }] },
    { secoes: Array.from({ length: MAXIMO_SECOES + 1 }, (_, i) => ({ id: `s-${i}`, nome: `S${i}`, itens: [] })) }]) {
    assert.equal(normalizarBarra(lixo), null, `aceitou ${JSON.stringify(lixo).slice(0, 80)}`);
  }
});

test("quem nunca personalizou chega com nulo", async () => {
  const A = await criarImobiliariaDeTeste();
  criadas.push(A.tenant.id);
  const r = await api.comoTenant({ token: A.token, slug: A.slug }).get("/api/auth/me");
  assert.equal(r.status, 200);
  assert.equal(r.json.usuario?.barraLateral ?? r.json.barraLateral, null);
});

test("gravar a seção, ler de volta na sessão e apagar tudo volta a nulo", async () => {
  const A = await criarImobiliariaDeTeste();
  criadas.push(A.tenant.id);
  const como = api.comoTenant({ token: A.token, slug: A.slug });

  const r = await como.put("/api/auth/minha-barra", { barra: FAVORITOS });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual(r.json.barraLateral, FAVORITOS);
  const me = await como.get("/api/auth/me");
  assert.deepEqual(me.json.usuario?.barraLateral ?? me.json.barraLateral, FAVORITOS);

  const vazio = await como.put("/api/auth/minha-barra", { barra: { secoes: [], ativa: null } });
  assert.equal(vazio.status, 200);
  const gravado = await prisma.usuario.findUnique({ where: { id: A.usuario.id }, select: { barraLateral: true } });
  assert.equal(gravado.barraLateral, null, "apagar a última seção deve voltar a 'nunca personalizou'");
});

test("lixo é recusado e não apaga a barra que já estava", async () => {
  const A = await criarImobiliariaDeTeste();
  criadas.push(A.tenant.id);
  const como = api.comoTenant({ token: A.token, slug: A.slug });
  await como.put("/api/auth/minha-barra", { barra: FAVORITOS });

  for (const lixo of ["sim", [1], { secoes: [{ id: "x y", nome: "a", itens: [] }] }]) {
    const r = await como.put("/api/auth/minha-barra", { barra: lixo });
    assert.equal(r.status, 400, `aceitou ${JSON.stringify(lixo)}`);
  }
  const gravado = await prisma.usuario.findUnique({ where: { id: A.usuario.id }, select: { barraLateral: true } });
  assert.deepEqual(gravado.barraLateral, FAVORITOS);
});

test("a barra é da pessoa: gravar na conta de A não mexe na de B", async () => {
  const A = await criarImobiliariaDeTeste();
  const B = await criarImobiliariaDeTeste();
  criadas.push(A.tenant.id, B.tenant.id);

  await api.comoTenant({ token: A.token, slug: A.slug }).put("/api/auth/minha-barra", { barra: FAVORITOS });
  const deB = await prisma.usuario.findUnique({ where: { id: B.usuario.id }, select: { barraLateral: true } });
  assert.equal(deB.barraLateral, null);
});

test("sem sessão, não grava", async () => {
  const r = await fetch(`${api.base}/api/auth/minha-barra`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ barra: FAVORITOS }),
  });
  assert.equal(r.status, 401);
});
