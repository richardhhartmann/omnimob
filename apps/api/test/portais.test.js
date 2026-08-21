import test from "node:test";
import assert from "node:assert/strict";

import { publicRouter } from "../src/routes/publicRoutes.js";
import {
  prisma, limparRestos, criarImobiliariaDeTeste, apagarImobiliaria, subirApi,
} from "./helpers.js";
import { portaisDoImovel, normalizarPortais, nomesDosPortais } from "../src/services/portais.js";

/* ────────────────────────────────────────────────────────────────────────────
   ZAP, VivaReal e OLX deixaram de ser um interruptor só.

   ── O QUE ESTES TESTES GUARDAM ──

   O risco maior não é o imóvel novo sair no portal errado — é o acervo ANTIGO
   sumir. Todo imóvel cadastrado antes desta separação tem `portais` vazio, e
   uma leitura ingênua ("vazio = nenhum") esvaziaria os três feeds de todas as
   imobiliárias, em silêncio, sem erro em lugar nenhum. Ninguém perceberia até
   um cliente ligar perguntando por que os anúncios sumiram do ZAP.

   O segundo risco é o oposto: o endereço NOVO de um portal levar imóvel que a
   imobiliária não marcou para ele. Aí ela publicou onde disse que não queria.
   ──────────────────────────────────────────────────────────────────────────── */

let api;
let A;

test.before(async () => {
  await limparRestos();
  api = await subirApi({ "/public": publicRouter });
  A = await criarImobiliariaDeTeste();
});

test.after(async () => {
  await api?.fechar();
  if (A) await apagarImobiliaria(A.tenant.id);
  await limparRestos();
  await prisma.$disconnect();
});

function imovelDe(extra = {}) {
  return prisma.property.create({
    data: {
      tenantId: A.tenant.id,
      title: "Imóvel de teste",
      description: "Descrição de teste.",
      address: "Rua de Teste, 1",
      price: 100000,
      status: "ACTIVE",
      /* A foto é obrigatória para entrar no feed — imóvel sem imagem é recusado
         na carga do portal, então `feedPortais` o deixa de fora. Sem ela estes
         testes passariam por motivo errado. `PropertyImage` tem `tenantId`
         próprio. */
      images: { create: [{ tenantId: A.tenant.id, url: "https://exemplo.test/foto.jpg", position: 0 }] },
      ...extra,
    },
  });
}

const feed = (caminho) => fetch(`${api.base}/public/${A.tenant.slug}/${caminho}`).then((r) => r.text());

// ─── A leitura tolerante ao acervo antigo ───────────────────────────────────

test("imóvel antigo (lista vazia) conta como TODOS os portais", () => {
  assert.deepEqual(
    portaisDoImovel({ publicarPortais: true, portais: [] }),
    ["ZAP", "VIVAREAL", "OLX"],
    "vazio com o mestre ligado é o estado de todo imóvel anterior à separação",
  );
});

test("mestre desligado não vai a portal nenhum, mesmo com lista preenchida", () => {
  assert.deepEqual(portaisDoImovel({ publicarPortais: false, portais: ["ZAP"] }), []);
});

test("a lista escolhida é respeitada tal e qual", () => {
  assert.deepEqual(portaisDoImovel({ publicarPortais: true, portais: ["OLX", "ZAP"] }), ["ZAP", "OLX"]);
});

test("portal desconhecido é descartado, não derruba o pedido", () => {
  assert.deepEqual(normalizarPortais(["ZAP", "IMOVELWEB", "olx"]), ["ZAP", "OLX"]);
});

test("os nomes viram frase legível", () => {
  assert.equal(nomesDosPortais(["ZAP"]), "ZAP Imóveis");
  assert.equal(nomesDosPortais(["ZAP", "OLX"]), "ZAP Imóveis e OLX Imóveis");
});

// ─── Os feeds ───────────────────────────────────────────────────────────────

test("cada endereço leva só os imóveis marcados para aquele portal", async () => {
  const soZap = await imovelDe({ title: "So no ZAP", publicarPortais: true, portais: ["ZAP"] });
  const soOlx = await imovelDe({ title: "So na OLX", publicarPortais: true, portais: ["OLX"] });

  const zap = await feed("feed/zap.xml");
  assert.ok(zap.includes("So no ZAP"), "o marcado para ZAP entra no feed do ZAP");
  assert.ok(!zap.includes("So na OLX"), "e o da OLX NÃO — foi o que a imobiliária pediu");

  const olx = await feed("feed/olx.xml");
  assert.ok(olx.includes("So na OLX"));
  assert.ok(!olx.includes("So no ZAP"));

  const viva = await feed("feed/vivareal.xml");
  assert.ok(!viva.includes("So no ZAP") && !viva.includes("So na OLX"), "nenhum dos dois marcou VivaReal");

  await prisma.property.deleteMany({ where: { id: { in: [soZap.id, soOlx.id] } } });
});

test("imóvel antigo aparece nos TRÊS feeds — o acervo não pode sumir", async () => {
  const antigo = await imovelDe({ title: "Cadastrado antes da separacao", publicarPortais: true, portais: [] });

  for (const caminho of ["feed/zap.xml", "feed/vivareal.xml", "feed/olx.xml"]) {
    const xml = await feed(caminho);
    assert.ok(xml.includes("Cadastrado antes da separacao"), `sumiu de ${caminho}`);
  }

  await prisma.property.delete({ where: { id: antigo.id } });
});

test("o endereço antigo continua levando tudo — a carga já cadastrada não pode quebrar", async () => {
  const soZap = await imovelDe({ title: "Marcado apenas ZAP", publicarPortais: true, portais: ["ZAP"] });

  const legado = await feed("feed.xml");
  assert.ok(legado.includes("Marcado apenas ZAP"), "o endereço antigo não distingue portal");

  await prisma.property.delete({ where: { id: soZap.id } });
});

test("mestre desligado fica fora de todos os feeds", async () => {
  const fora = await imovelDe({ title: "Fora dos portais", publicarPortais: false, portais: ["ZAP"] });

  for (const caminho of ["feed.xml", "feed/zap.xml", "feed/vivareal.xml", "feed/olx.xml"]) {
    assert.ok(!(await feed(caminho)).includes("Fora dos portais"), `vazou em ${caminho}`);
  }

  await prisma.property.delete({ where: { id: fora.id } });
});

test("endereço de portal inexistente devolve feed vazio, não erro", async () => {
  const r = await fetch(`${api.base}/public/${A.tenant.slug}/feed/imovelweb.xml`);
  /* Sem 500: portal que recebe erro marca a carga como falha e, em alguns
     provedores, DESATIVA os anúncios já publicados. */
  assert.equal(r.status, 200);
  const xml = await r.text();
  assert.ok(!xml.includes("<Listing>"), "não pode devolver anúncio nenhum");
});
