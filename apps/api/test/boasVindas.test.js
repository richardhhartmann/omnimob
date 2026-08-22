import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

/* O HELPER VEM PRIMEIRO — ele é quem neutraliza o envio de e-mail antes de
   qualquer rota carregar o notificationService. Ver `pesquisaTrial.test.js`. */
import {
  prisma, limparRestos, criarImobiliariaDeTeste, apagarImobiliaria, subirApi,
} from "./helpers.js";
import { tenantRouter } from "../src/routes/tenantRoutes.js";

/* ────────────────────────────────────────────────────────────────────────────
   "Esta imobiliária já foi recebida?" — a pergunta que saiu do navegador.

   ── O DEFEITO ──

   A resposta morava no `localStorage`. Numa máquina só, funcionava. Em guia
   anônima, em outro navegador ou em outro computador, o assistente de primeiro
   acesso recomeçava do zero: a ficha da imobiliária, o endereço da vitrine e a
   importação da base eram pedidos DE NOVO a quem já tinha respondido tudo, e
   não havia como convencê-lo do contrário — cada janela nova era, para ele, um
   cliente novo.

   ── O QUE ESTE ARQUIVO GUARDA ──

   1. O que foi marcado SOBREVIVE ao navegador: quem lê é `/me/trial`, e é de lá
      que a próxima janela — anônima ou não — tira a decisão.
   2. Marcar duas vezes não muda nada, e uma recepção nunca apaga a outra: quem
      viu a do teste e depois assina continua tendo a de assinante pela frente.
   3. A marca de uma imobiliária não alcança a outra. É o quarto lugar deste
      projeto onde um id sem `tenantId` ao lado já vazou entre empresas.
   4. Só quem administra a conta marca — é exatamente quem VÊ o modal.
   ──────────────────────────────────────────────────────────────────────────── */

let api;
let A;
let B;

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

/** O estado como o painel o lê: pelo `/me/trial`, e não pela tabela. */
async function vistasSegundoOPainel(imobiliaria) {
  const r = await api.comoTenant(imobiliaria).get("/api/tenants/me/trial");
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return r.json.boasVindasVistas;
}

test("nasce sem nenhuma recepção — e é isso que faz o modal abrir a primeira vez", async () => {
  assert.deepEqual(await vistasSegundoOPainel(A), []);
});

test("marcar grava no banco, e o painel lê de lá na janela seguinte", async () => {
  const r = await api.comoTenant(A).post("/api/tenants/me/boas-vindas", { modo: "teste" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.boasVindasVistas, ["teste"]);

  /* A releitura é o teste de verdade. Uma guia anônima não tem localStorage
     nenhum, e mesmo assim precisa chegar a "já foi recebida" — a resposta tem
     que estar no payload que ela busca ao montar o painel. */
  assert.deepEqual(await vistasSegundoOPainel(A), ["teste"]);
});

test("marcar de novo não duplica nem quebra", async () => {
  const r = await api.comoTenant(A).post("/api/tenants/me/boas-vindas", { modo: "teste" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.boasVindasVistas, ["teste"]);
});

test("a recepção do teste não consome a de assinante", async () => {
  /* São duas mensagens, em dois momentos: quem testou por três semanas e então
     assina merece ser recebido como assinante. Um booleano só teria engolido
     esse segundo momento. */
  const r = await api.comoTenant(A).post("/api/tenants/me/boas-vindas", { modo: "assinante" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.boasVindasVistas.sort(), ["assinante", "teste"]);
});

test("modo desconhecido é recusado", async () => {
  for (const modo of ["", "qualquer", "TESTE", null]) {
    const r = await api.comoTenant(A).post("/api/tenants/me/boas-vindas", { modo });
    assert.equal(r.status, 400, `aceitou o modo ${JSON.stringify(modo)}`);
  }
});

test("o que A marcou não alcança B", async () => {
  assert.deepEqual(await vistasSegundoOPainel(B), []);
});

test("quem não administra a conta não marca — é quem nem vê o modal", async () => {
  /* `verConfiguracoes` é a marca de quem administra neste schema, e é ela que o
     painel usa para decidir quem recebe o assistente. Um corretor não escolhe o
     domínio da imobiliária nem importa a base — e também não carimba que isso
     já foi feito. */
  const corretor = await prisma.usuario.create({
    data: {
      tenantId: B.tenant.id,
      cargoCodigo: B.cargoComum.id,
      nome: "Corretor de Teste",
      login: `corretor-${B.slug}`,
      email: `corretor-${B.slug}@exemplo.test`,
      senha: "sem-senha",
    },
  });
  const token = jwt.sign(
    { userId: corretor.id, tenantId: B.tenant.id, cargoCodigo: B.cargoComum.id },
    process.env.JWT_SECRET || "omnimob-dev-secret",
    { expiresIn: "10m" },
  );

  const r = await api.comoTenant({ token, slug: B.slug })
    .post("/api/tenants/me/boas-vindas", { modo: "teste" });
  assert.equal(r.status, 403);
  assert.deepEqual(await vistasSegundoOPainel(B), []);
});
