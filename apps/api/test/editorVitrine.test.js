import test, { after } from "node:test";
import assert from "node:assert/strict";
import { prisma, criarImobiliariaDeTeste, apagarImobiliaria, subirApi } from "./helpers.js";
import { editorVitrineRouter, MAXIMO_VERSOES } from "../src/routes/editorVitrineRoutes.js";

/* ── O editor de vitrine: rascunho, publicação e versões ──────────────────────
   Os defeitos que importam, todos silenciosos:
     · o rascunho aparecer na vitrine pública antes do "Publicar";
     · dois editores abertos — o último a salvar apagava o outro;
     · publicar com a cópia do config de quando a tela abriu, apagando o que
       outra tela gravou no meio (o assistente grava `modeloEscolhido`);
     · a versão de A aberta pela B com o id real.
   ────────────────────────────────────────────────────────────────────────── */

let api;
const criadas = [];

test.before(async () => {
  api = await subirApi({ "/api/editor-vitrine": editorVitrineRouter });
});

after(async () => {
  await api?.fechar?.();
  await Promise.all(criadas.map((t) => apagarImobiliaria(t)));
  await prisma.$disconnect();
});

async function nova() {
  const A = await criarImobiliariaDeTeste();
  criadas.push(A.tenant.id);
  return { ...A, como: api.comoTenant({ token: A.token, slug: A.slug }) };
}

const doc = (titulo) => ({ content: [{ type: "Titulo", props: { id: "t1", texto: titulo } }], root: { props: {} } });

test("o rascunho não vai ao ar; publicar leva documento, opções e cadastro", async () => {
  const A = await nova();
  await prisma.tenant.update({ where: { id: A.tenant.id }, data: { showcaseConfig: { widgets: [], modeloEscolhido: true } } });

  const r = await A.como.put("/api/editor-vitrine/rascunho", {
    documento: doc("Novo"), opcoes: { appearanceMode: "light" }, cadastro: { showcaseHeadline: "Manchete nova" }, versao: 0,
  });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.versao, 1);

  let tenant = await prisma.tenant.findUnique({ where: { id: A.tenant.id } });
  assert.equal(tenant.showcaseConfig.puck, undefined, "o rascunho apareceu no ar antes de publicar");
  assert.notEqual(tenant.showcaseHeadline, "Manchete nova");

  const lido = await A.como.get("/api/editor-vitrine");
  assert.equal(lido.json.rascunho.versao, 1);
  assert.equal(lido.json.rascunho.documento.content[0].props.texto, "Novo");

  /* Outra tela grava no showcaseConfig enquanto o rascunho existe. */
  await prisma.tenant.update({ where: { id: A.tenant.id }, data: { showcaseConfig: { widgets: [], modeloEscolhido: true, outraTela: 1 } } });

  const p = await A.como.post("/api/editor-vitrine/publicar", { versao: 1 });
  assert.equal(p.status, 200, JSON.stringify(p.json));
  tenant = await prisma.tenant.findUnique({ where: { id: A.tenant.id } });
  assert.equal(tenant.showcaseConfig.puck.content[0].props.texto, "Novo");
  assert.equal(tenant.showcaseConfig.appearanceMode, "light");
  assert.equal(tenant.showcaseConfig.outraTela, 1, "publicar apagou o que outra tela gravou");
  assert.equal(tenant.showcaseConfig.modeloEscolhido, true);
  assert.equal(tenant.showcaseHeadline, "Manchete nova");
  assert.equal(await prisma.rascunhoVitrine.count({ where: { tenantId: A.tenant.id } }), 0, "o rascunho sobrou depois de publicar");
  assert.equal(await prisma.versaoVitrine.count({ where: { tenantId: A.tenant.id } }), 1);
});

test("dois editores: quem grava sobre versão velha recebe 409 e não apaga o outro", async () => {
  const A = await nova();
  const um = await A.como.put("/api/editor-vitrine/rascunho", { documento: doc("aba 1"), versao: 0 });
  assert.equal(um.status, 200);
  // A segunda aba abriu antes de existir rascunho: também acha que é 0.
  const dois = await A.como.put("/api/editor-vitrine/rascunho", { documento: doc("aba 2"), versao: 0 });
  assert.equal(dois.status, 409);
  assert.equal(dois.json.codigo, "CONFLITO_DE_VERSAO");
  assert.equal(dois.json.versao, 1);

  const tres = await A.como.put("/api/editor-vitrine/rascunho", { documento: doc("aba 1, de novo"), versao: 1 });
  assert.equal(tres.status, 200);
  const velha = await A.como.put("/api/editor-vitrine/rascunho", { documento: doc("aba 2 insiste"), versao: 1 });
  assert.equal(velha.status, 409);

  const gravado = await prisma.rascunhoVitrine.findUnique({ where: { tenantId: A.tenant.id } });
  assert.equal(gravado.documento.content[0].props.texto, "aba 1, de novo");

  // Publicar sobre versão velha também é recusado.
  const pub = await A.como.post("/api/editor-vitrine/publicar", { versao: 1 });
  assert.equal(pub.status, 409);
});

test("corpo forjado não grava chave fora da lista no showcaseConfig", async () => {
  const A = await nova();
  for (const corpo of [
    { documento: doc("x"), opcoes: { puck: { content: [] } }, versao: 0 },
    { documento: doc("x"), opcoes: { widgets: [] }, versao: 0 },
    { documento: doc("x"), cadastro: { plano: "PREMIUM" }, versao: 0 },
    { documento: doc("x"), cadastro: { email: "não é e-mail" }, versao: 0 },
    { documento: { content: "x" }, versao: 0 },
    { documento: doc("x"), versao: -1 },
  ]) {
    const r = await A.como.put("/api/editor-vitrine/rascunho", corpo);
    assert.equal(r.status, 400, `aceitou ${JSON.stringify(corpo).slice(0, 90)}`);
  }
});

test("descartar volta ao que está no ar", async () => {
  const A = await nova();
  await A.como.put("/api/editor-vitrine/rascunho", { documento: doc("x"), versao: 0 });
  const r = await A.como.del("/api/editor-vitrine/rascunho");
  assert.equal(r.status, 200);
  const lido = await A.como.get("/api/editor-vitrine");
  assert.equal(lido.json.rascunho, null);
});

test("versões: listar, abrir, teto por imobiliária, e B não abre a de A", async () => {
  const A = await nova();
  const B = await nova();
  let versao = 0;
  for (let i = 0; i < MAXIMO_VERSOES + 2; i++) {
    const r = await A.como.put("/api/editor-vitrine/rascunho", { documento: doc(`v${i}`), versao: 0 });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    versao = r.json.versao;
    const p = await A.como.post("/api/editor-vitrine/publicar", { versao });
    assert.equal(p.status, 200, JSON.stringify(p.json));
  }
  const lista = await A.como.get("/api/editor-vitrine/versoes");
  assert.equal(lista.json.versoes.length, MAXIMO_VERSOES);
  assert.equal(await prisma.versaoVitrine.count({ where: { tenantId: A.tenant.id } }), MAXIMO_VERSOES);

  const maisNova = lista.json.versoes[0];
  const aberta = await A.como.get(`/api/editor-vitrine/versoes/${maisNova.id}`);
  assert.equal(aberta.json.versao.documento.content[0].props.texto, `v${MAXIMO_VERSOES + 1}`);

  const deFora = await B.como.get(`/api/editor-vitrine/versoes/${maisNova.id}`);
  assert.equal(deFora.status, 404);
  assert.equal((await B.como.get("/api/editor-vitrine/versoes")).json.versoes.length, 0);
});

test("sem sessão, nada", async () => {
  const r = await fetch(`${api.base}/api/editor-vitrine`);
  assert.equal(r.status, 401);
});
