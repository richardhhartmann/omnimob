import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import express from "express";

import { apagarImobiliaria, criarImobiliariaDeTeste, limparRestos, prisma } from "./helpers.js";
import { publicRouter } from "../src/routes/publicRoutes.js";
import { montarFeedVRSync } from "../src/services/feedPortais.js";

/* ────────────────────────────────────────────────────────────────────────────
   O endereço oculto some do PAYLOAD, não só da tela.

   Este é o teste de um defeito que quase aconteceu. A pedido era "um checkbox
   que decide se a página do imóvel mostra o endereço completo", e a
   implementação óbvia é um `&&` no JSX. Ela funciona: o endereço some da tela.

   E não esconde nada. A página recebe o registro inteiro em JSON, e a rua fica
   a um clique de distância na aba de rede do navegador — visível justamente
   para quem tem interesse em procurá-la. Esconder na interface e mandar no
   corpo é esconder de quem olha e entregar a quem procura.

   Por isso o corte é no servidor, e por isso ele é verificado aqui: o `&&` do
   JSX é consequência, não a trava.

   O CEP entra junto no teste porque ele parece inofensivo e não é — um CEP de
   rua identifica o logradouro inteiro, e alguns identificam um prédio só.
   Devolver o CEP escondendo a rua publicaria a mesma informação em outro
   formato.
   ──────────────────────────────────────────────────────────────────────────── */

let servidor;
let base;
let T;
let oculto;
let visivel;

const RUA_OCULTA = "Rua Muito Secreta, 42";
const RUA_VISIVEL = "Avenida Bem Publica, 100";

before(async () => {
  await limparRestos();
  T = await criarImobiliariaDeTeste();

  oculto = await prisma.property.create({
    data: {
      tenantId: T.tenant.id, tipoImovelId: T.tipo.id,
      title: "Casa com endereço reservado", description: "", price: 500000,
      address: RUA_OCULTA, cep: "01310100",
      neighborhood: "Centro", city: "São Paulo", state: "SP",
      status: "ACTIVE", exibirEnderecoCompleto: false,
    },
  });
  visivel = await prisma.property.create({
    data: {
      tenantId: T.tenant.id, tipoImovelId: T.tipo.id,
      title: "Casa com endereço aberto", description: "", price: 600000,
      address: RUA_VISIVEL, cep: "04567000",
      neighborhood: "Centro", city: "São Paulo", state: "SP",
      status: "ACTIVE", exibirEnderecoCompleto: true,
    },
  });

  const app = express();
  app.use(express.json());
  app.use("/public", publicRouter);
  servidor = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(async () => {
  await new Promise((r) => servidor?.close(r));
  await apagarImobiliaria(T?.tenant?.id);
  await prisma.$disconnect();
});

async function pegar(caminho) {
  const r = await fetch(`${base}${caminho}`);
  const texto = await r.text();
  return { status: r.status, texto, json: JSON.parse(texto) };
}

test("a rua oculta não aparece no corpo da vitrine", async () => {
  const r = await pegar(`/public/${T.slug}/properties`);
  assert.equal(r.status, 200);
  /* Contra o TEXTO CRU da resposta, e não contra o campo. Procurar em
     `property.address` acharia o campo vazio e passaria mesmo se a rua tivesse
     vazado noutro lugar do payload — numa descrição, num objeto aninhado. */
  assert.doesNotMatch(r.texto, new RegExp(RUA_OCULTA), "a rua oculta saiu na listagem da vitrine");
  assert.match(r.texto, new RegExp(RUA_VISIVEL), "a rua liberada não saiu");
});

test("a rua oculta não aparece na página do imóvel", async () => {
  const r = await pegar(`/public/${T.slug}/properties/${oculto.id}`);
  assert.equal(r.status, 200);
  assert.doesNotMatch(r.texto, new RegExp(RUA_OCULTA));
  assert.equal(r.json.property.address, "");
});

test("o CEP sai junto com a rua", async () => {
  // Sozinho ele identifica o logradouro — devolvê-lo seria publicar a mesma
  // informação em outro formato.
  const r = await pegar(`/public/${T.slug}/properties/${oculto.id}`);
  assert.equal(r.json.property.cep, null);
  assert.doesNotMatch(r.texto, /01310100/);
});

test("bairro, cidade e estado continuam saindo", async () => {
  /* O oposto do erro é esconder demais: sem bairro, o anúncio deixa de dizer
     onde fica, e a página perde a informação que o visitante mais procura. */
  const r = await pegar(`/public/${T.slug}/properties/${oculto.id}`);
  assert.equal(r.json.property.neighborhood, "Centro");
  assert.equal(r.json.property.city, "São Paulo");
  assert.equal(r.json.property.state, "SP");
});

test("a página do imóvel liberado traz o endereço inteiro", async () => {
  const r = await pegar(`/public/${T.slug}/properties/${visivel.id}`);
  assert.equal(r.json.property.address, RUA_VISIVEL);
  assert.equal(r.json.property.cep, "04567000");
});

test("o feed dos portais segue a MESMA marcação", async () => {
  /* Se a decisão valesse na vitrine e fosse ignorada no ZAP, ela não seria uma
     decisão — seria um detalhe de uma tela. O `<Address>` continua indo (o
     portal precisa dele para o mapa), mas `displayAddress` diz o que exibir. */
  const doOculto = montarFeedVRSync(T.tenant, [{ ...oculto, images: [] }], null);
  assert.match(doOculto, /displayAddress="Neighborhood"/);

  const doVisivel = montarFeedVRSync(T.tenant, [{ ...visivel, images: [] }], null);
  assert.match(doVisivel, /displayAddress="Street"/);
});

test("o padrão de um imóvel novo é NÃO publicar o endereço", async () => {
  /* O padrão é a parte que importa: quem não pensou no assunto não deve
     publicar a rua sem saber. */
  const novo = await prisma.property.create({
    data: {
      tenantId: T.tenant.id, tipoImovelId: T.tipo.id,
      title: "Sem opinião", description: "", price: 1000,
      address: "Rua Qualquer, 1", city: "São Paulo", state: "SP", status: "ACTIVE",
    },
  });
  assert.equal(novo.exibirEnderecoCompleto, false);
});
