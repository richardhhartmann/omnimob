import test from "node:test";
import assert from "node:assert/strict";

import { tenantRouter } from "../src/routes/tenantRoutes.js";
import {
  prisma, limparRestos, criarImobiliariaDeTeste, apagarImobiliaria, subirApi,
} from "./helpers.js";

/* ────────────────────────────────────────────────────────────────────────────
   Pesquisa espontânea do teste e o prazo extra.

   O que está sob teste é UM número que sai de graça: sete dias de produto. A
   trava de "uma vez por imobiliária" é a única coisa entre esse botão e um
   teste eterno — e ela mora num UPDATE condicional, não num `if` em memória,
   justamente porque duplo clique existe.

   Os dois casos que valem cobertura são os que ninguém vê acontecendo:
     · a segunda tentativa de esticar não pode empurrar a data de novo;
     · a resposta de uma imobiliária não pode contar na pesquisa da outra — o
       mesmo tipo de vazamento que já apareceu três vezes neste projeto.
   ──────────────────────────────────────────────────────────────────────────── */

let api;
let A;
let B;

/* Coloca a imobiliária em teste, vencendo daqui a `dias`.

   `limparExtensao` é explícito, e não o padrão, porque zerar a marca de "já
   esticou" é justamente apagar o que a maior parte destes testes verifica. */
async function porEmTeste(tenantId, dias = 5, { limparExtensao = false } = {}) {
  const vencimento = new Date(Date.now() + dias * 86400000);
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      statusPagamento: "TRIAL",
      proximoVencimento: vencimento,
      ...(limparExtensao ? { trialEstendidoEm: null } : {}),
    },
  });
  return vencimento;
}

test.before(async () => {
  await limparRestos();
  api = await subirApi({ "/api/tenants": tenantRouter });
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

test("prazo extra: sai uma vez, e a segunda tentativa não empurra a data", async () => {
  const vencimento = await porEmTeste(A.tenant.id, 5, { limparExtensao: true });

  const primeira = await api.comoTenant(A).post("/api/tenants/me/trial/pesquisa", {
    sentimento: "NEUTRO",
    escolha: "ESTENDER",
    origem: "imovel",
  });
  assert.equal(primeira.status, 200);
  assert.equal(primeira.json.estendido, true, "o primeiro pedido tem que valer");
  assert.ok(primeira.json.diasGanhos > 0);

  const depoisDaPrimeira = new Date(primeira.json.expiraEm);
  assert.ok(
    depoisDaPrimeira > vencimento,
    "o vencimento tem que andar para frente",
  );

  const segunda = await api.comoTenant(A).post("/api/tenants/me/trial/pesquisa", {
    sentimento: "AMANDO",
    escolha: "ESTENDER",
  });
  assert.equal(segunda.status, 200, "recusar o prazo não é erro: é resposta");
  assert.equal(segunda.json.estendido, false);
  assert.equal(segunda.json.motivo, "JA_ESTENDIDO");

  const tenant = await prisma.tenant.findUnique({
    where: { id: A.tenant.id },
    select: { proximoVencimento: true },
  });
  assert.equal(
    tenant.proximoVencimento.getTime(),
    depoisDaPrimeira.getTime(),
    "a segunda tentativa não pode ter mexido na data",
  );
});

test("prazo extra: quem já assinou não ganha dias, mas a resposta é guardada", async () => {
  await prisma.tenant.update({
    where: { id: B.tenant.id },
    data: { statusPagamento: "EM_DIA", trialEstendidoEm: null },
  });

  const r = await api.comoTenant(B).post("/api/tenants/me/trial/pesquisa", {
    sentimento: "AMANDO",
    escolha: "ESTENDER",
    comentario: "já assinei e continuo achando bom",
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.estendido, false);
  assert.equal(r.json.motivo, "NAO_ESTA_EM_TESTE");

  const guardadas = await prisma.pesquisaTrial.count({ where: { tenantId: B.tenant.id } });
  assert.ok(guardadas > 0, "a opinião de quem converteu é justamente a que não se joga fora");
});

test("pesquisa: a situação do teste conta só as respostas da própria imobiliária", async () => {
  await porEmTeste(A.tenant.id, 5);

  const a = await api.comoTenant(A).get("/api/tenants/me/trial");
  const b = await api.comoTenant(B).get("/api/tenants/me/trial");
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);

  const daA = await prisma.pesquisaTrial.count({ where: { tenantId: A.tenant.id } });
  const daB = await prisma.pesquisaTrial.count({ where: { tenantId: B.tenant.id } });

  assert.equal(a.json.pesquisa.respostas, daA);
  assert.equal(b.json.pesquisa.respostas, daB);
  assert.notEqual(daA, 0);
  assert.equal(
    a.json.pesquisa.podeEstender,
    false,
    "a A já esticou; o botão não pode voltar a aparecer para ela",
  );
});

test("pesquisa: escolha desconhecida é recusada", async () => {
  const r = await api.comoTenant(A).post("/api/tenants/me/trial/pesquisa", {
    sentimento: "AMANDO",
    escolha: "GANHAR_UM_ANO",
  });
  assert.equal(r.status, 400);
});

test("pesquisa: fechar sem responder também vira registro, sem sentimento", async () => {
  const antes = await prisma.pesquisaTrial.count({ where: { tenantId: A.tenant.id } });

  const r = await api.comoTenant(A).post("/api/tenants/me/trial/pesquisa", {
    escolha: "FECHOU",
    origem: "vitrine",
  });
  assert.equal(r.status, 200);

  const ultima = await prisma.pesquisaTrial.findFirst({
    where: { tenantId: A.tenant.id },
    orderBy: { criadoEm: "desc" },
  });
  assert.equal(ultima.escolha, "FECHOU");
  assert.equal(ultima.sentimento, null);
  assert.equal(ultima.origem, "vitrine");
  assert.equal(await prisma.pesquisaTrial.count({ where: { tenantId: A.tenant.id } }), antes + 1);
});
