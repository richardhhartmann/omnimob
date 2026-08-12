import test from "node:test";
import assert from "node:assert/strict";

import { previaRouter } from "../src/routes/previaRoutes.js";
import {
  prisma, limparRestos, criarImobiliariaDeTeste, apagarImobiliaria, subirApi,
} from "./helpers.js";

/* ────────────────────────────────────────────────────────────────────────────
   Prévia de link para robôs de rede social.

   O que estes testes guardam, além do caminho feliz:

     · ESCAPE. O título da prévia é montado com o nome da imobiliária e o do
       imóvel — texto que o cliente digita. Interpolado cru num atributo HTML,
       uma aspa fecha o `content="…"` e o resto vira marcação. É injeção de HTML
       servida a partir do nosso domínio, e o alvo é o robô do WhatsApp.

     · TOLERÂNCIA A FALHA. Imóvel inexistente responde 200 com um cartão de
       "indisponível", nunca 404 ou 500: o robô guarda a falha e o link fica sem
       prévia por horas, mesmo depois de o imóvel voltar.
   ──────────────────────────────────────────────────────────────────────────── */

let api;
let A;
let imovel;

const pegar = async (caminho) => {
  const r = await fetch(`${api.base}${caminho}`);
  return { status: r.status, tipo: r.headers.get("content-type"), html: await r.text() };
};

/** O valor de um `<meta property|name="…" content="…">`, ou null. */
function conteudoDaTag(html, nome) {
  const re = new RegExp(`<meta (?:property|name)="${nome}" content="([^"]*)"`);
  return html.match(re)?.[1] ?? null;
}

test.before(async () => {
  await limparRestos();
  api = await subirApi({ "/previa": previaRouter });
  A = await criarImobiliariaDeTeste();

  imovel = await prisma.property.create({
    data: {
      tenantId: A.tenant.id,
      title: 'Casa "especial" & <b>ampla</b>',
      description: "Uma casa muito boa.",
      price: 750000,
      address: "Rua X, 1",
      neighborhood: "Centro",
      city: "São Paulo",
      state: "SP",
      bedrooms: 3,
      parkingSpots: 2,
      squareFootage: 120,
      status: "ACTIVE",
      // `PropertyImage` guarda o próprio `tenantId` (não herda do imóvel).
      images: { create: [{ tenantId: A.tenant.id, url: "https://exemplo.test/foto.jpg", position: 0 }] },
    },
  });
});

test.after(async () => {
  await api?.fechar();
  if (A) await apagarImobiliaria(A.tenant.id);
  await limparRestos();
  await prisma.$disconnect();
});

test("imóvel: traz título com preço, ficha e a FOTO do imóvel", async () => {
  const r = await pegar(`/previa/imovel/${A.slug}/${imovel.id}`);
  assert.equal(r.status, 200);
  assert.match(r.tipo, /text\/html/);

  const titulo = conteudoDaTag(r.html, "og:title");
  assert.match(titulo, /750\.000/, "o preço é o que decide se a pessoa abre");

  const descricao = conteudoDaTag(r.html, "og:description");
  assert.match(descricao, /Centro/);
  assert.match(descricao, /3 quartos/);
  assert.match(descricao, /2 vagas/);

  assert.equal(
    conteudoDaTag(r.html, "og:image"), "https://exemplo.test/foto.jpg",
    "sem a foto do imóvel a prévia continua sendo um cartão genérico",
  );
});

test("imóvel: aspas e tags do texto do cliente saem escapadas", async () => {
  const r = await pegar(`/previa/imovel/${A.slug}/${imovel.id}`);

  // O título tem aspas e <b> — nenhum dos dois pode chegar cru ao atributo.
  assert.ok(!/content="[^"]*<b>/.test(r.html), "não pode haver tag crua dentro de content");
  assert.match(r.html, /&quot;especial&quot;/, "as aspas precisam estar escapadas");
  assert.match(r.html, /&lt;b&gt;/, "os sinais de menor/maior precisam estar escapados");
  assert.match(r.html, /&amp;/, "o E comercial precisa estar escapado");
});

test("imóvel: o og:url aponta para a vitrine, não para a API", async () => {
  const r = await pegar(`/previa/imovel/${A.slug}/${imovel.id}`);
  const url = conteudoDaTag(r.html, "og:url");
  assert.ok(!url.includes("api."), "o cartão não pode levar para o host da API");
  assert.match(url, new RegExp(`/vitrine/${A.slug}/imovel/${imovel.id}$`));
});

test("imóvel: rascunho não aparece como disponível", async () => {
  const rascunho = await prisma.property.create({
    data: {
      tenantId: A.tenant.id, title: "Rascunho", description: "-", price: 1000,
      address: "-", city: "-", state: "SP", status: "DRAFT",
    },
  });
  try {
    const r = await pegar(`/previa/imovel/${A.slug}/${rascunho.id}`);
    assert.equal(r.status, 200, "erro viraria falha guardada no robô");
    assert.match(conteudoDaTag(r.html, "og:title"), /indisponível/i);
  } finally {
    await prisma.property.delete({ where: { id: rascunho.id } }).catch(() => {});
  }
});

test("imóvel: id inexistente responde 200 com cartão de indisponível", async () => {
  const r = await pegar(`/previa/imovel/${A.slug}/id-que-nao-existe`);
  assert.equal(r.status, 200);
  assert.match(conteudoDaTag(r.html, "og:title"), /indisponível/i);
});

test("imóvel de uma imobiliária não vaza pela vitrine de outra", async () => {
  const B = await criarImobiliariaDeTeste();
  try {
    const r = await pegar(`/previa/imovel/${B.slug}/${imovel.id}`);
    assert.equal(r.status, 200);
    assert.match(
      conteudoDaTag(r.html, "og:title"), /indisponível/i,
      "o imóvel da A não pode ser exibido sob o slug da B",
    );
  } finally {
    await apagarImobiliaria(B.tenant.id);
  }
});

test("vitrine: usa o nome da imobiliária e aponta para a página dela", async () => {
  const r = await pegar(`/previa/vitrine/${A.slug}`);
  assert.equal(r.status, 200);
  assert.match(conteudoDaTag(r.html, "og:title"), new RegExp(A.tenant.name));
  assert.match(conteudoDaTag(r.html, "og:url"), new RegExp(`/vitrine/${A.slug}$`));
});

test("vitrine: slug inexistente responde 200, não 404", async () => {
  const r = await pegar("/previa/vitrine/nao-existe-jamais-xyz");
  assert.equal(r.status, 200);
  assert.match(conteudoDaTag(r.html, "og:title"), /não encontrada/i);
});
