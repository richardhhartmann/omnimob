import test from "node:test";
import assert from "node:assert/strict";

import { propertyRouter } from "../src/routes/propertyRoutes.js";
import {
  prisma, limparRestos, criarImobiliariaDeTeste, apagarImobiliaria, subirApi,
} from "./helpers.js";

/* ────────────────────────────────────────────────────────────────────────────
   Excluir imóvel que está anunciado fora da Omnimob.

   O que estes testes guardam não é a exclusão — é a HONESTIDADE da tela sobre
   ela. O modal marca as caixas sozinho a partir do `podeRemover` que vem daqui;
   se ele vier `true` para o Instagram, a pessoa clica achando que apagou e o
   post continua no perfil, sem nenhum aviso.

   O outro risco é a ORDEM: a remoção lá fora tem que acontecer antes do
   `delete`, porque o `externalRef` mora nas linhas de publicação e elas caem
   junto com o imóvel. Depois do delete não há mais como alcançar o anúncio.
   ──────────────────────────────────────────────────────────────────────────── */

/** Um imóvel mínimo. Os obrigatórios ficam num lugar só: campo novo no schema
    quebraria os quatro testes de uma vez, e o motivo não apareceria em nenhum. */
function imovelDe(tenant, extra = {}) {
  return prisma.property.create({
    data: {
      tenantId: tenant.id,
      title: "Imóvel de teste",
      description: "Descrição de teste.",
      address: "Rua de Teste, 1",
      price: 100000,
      ...extra,
    },
  });
}

let api;
let A;
let B;

test.before(async () => {
  await limparRestos();
  api = await subirApi({ "/api/properties": propertyRouter });
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

test("cada canal declara corretamente se dá para remover", async () => {
  const imovel = await imovelDe(A.tenant, { title: "Casa anunciada", publicarPortais: true });
  await prisma.propertyPublication.createMany({
    data: [
      { tenantId: A.tenant.id, propertyId: imovel.id, channel: "FACEBOOK",  status: "PUBLISHED", externalRef: "123_456" },
      { tenantId: A.tenant.id, propertyId: imovel.id, channel: "INSTAGRAM", status: "PUBLISHED", externalRef: "789" },
    ],
  });

  const r = await api.comoTenant(A).get(`/api/properties/${imovel.id}/canais-para-remover`);
  assert.equal(r.status, 200);

  const porCanal = Object.fromEntries(r.json.opcoes.map((o) => [o.canal, o]));

  assert.equal(porCanal.FACEBOOK?.podeRemover, true, "o Facebook apaga o post por API");

  /* O Instagram TEM que aparecer mesmo sem poder remover: é a linha que avisa
     que o post continua no ar. Sumir com ela é o defeito, não a limpeza. */
  assert.ok(porCanal.INSTAGRAM, "o canal que não remove ainda assim é listado");
  assert.equal(porCanal.INSTAGRAM.podeRemover, false, "a Meta não expõe exclusão de post do Instagram");
  assert.match(porCanal.INSTAGRAM.nota, /aplicativo/i, "e a nota diz o que fazer no lugar");

  assert.ok(porCanal.PORTAIS, "portais entram pelo flag do imóvel, sem publicação registrada");
  assert.equal(porCanal.PORTAIS.automatico, true);
  assert.equal(porCanal.PORTAIS.podeRemover, false, "não há o que escolher: sai sozinho do feed");

  await prisma.property.delete({ where: { id: imovel.id } });
});

test("a imobiliária A não enxerga os canais de um imóvel da B", async () => {
  const daB = await imovelDe(B.tenant, { title: "Imóvel da B" });

  const r = await api.comoTenant(A).get(`/api/properties/${daB.id}/canais-para-remover`);
  assert.equal(r.status, 404, "pelo id real da outra, ainda assim 404");

  await prisma.property.delete({ where: { id: daB.id } });
});

test("excluir sem escolher canal não toca em canal nenhum", async () => {
  const imovel = await imovelDe(A.tenant, { title: "Some sem alarde" });
  await prisma.propertyPublication.create({
    data: { tenantId: A.tenant.id, propertyId: imovel.id, channel: "FACEBOOK", status: "PUBLISHED", externalRef: "1_2" },
  });

  const r = await api.comoTenant(A).del(`/api/properties/${imovel.id}`);
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.canais, [], "nenhum canal escolhido, nenhuma chamada externa");

  const sobrou = await prisma.property.findUnique({ where: { id: imovel.id } });
  assert.equal(sobrou, null, "e o imóvel foi apagado de qualquer forma");
});

test("imóvel fora do feed não oferece a linha dos portais", async () => {
  const imovel = await imovelDe(A.tenant, { title: "Só na vitrine", publicarPortais: false });

  const r = await api.comoTenant(A).get(`/api/properties/${imovel.id}/canais-para-remover`);
  assert.equal(r.status, 200);
  assert.ok(!r.json.opcoes.some((o) => o.canal === "PORTAIS"), "sem exclusividade, sem aviso de portal");

  await prisma.property.delete({ where: { id: imovel.id } });
});
