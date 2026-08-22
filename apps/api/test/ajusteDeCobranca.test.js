import test from "node:test";
import assert from "node:assert/strict";

import {
  prisma, limparRestos, criarImobiliariaDeTeste, apagarImobiliaria, subirApi,
} from "./helpers.js";
import { tenantRouter } from "../src/routes/tenantRoutes.js";
import { ajustarAssinatura, previaDoAjuste, pagamentoConfigurado } from "../src/services/pagamentoService.js";

/* ────────────────────────────────────────────────────────────────────────────
   O AJUSTE DA FATURA NUMA ASSINATURA VIVA.

   Contratar o Flow ou trocar de plano no meio do ciclo passou a mexer na
   cobrança de verdade: a assinatura é apontada para o preço novo e o Stripe
   calcula o proporcional.

   ── O QUE ESTE ARQUIVO PODE PROVAR, E O QUE NÃO PODE ──

   NÃO pode provar que o Stripe cobra certo. Isso exige conta de produção,
   cartão e um ciclo rodando — e o proporcional é conta DELES de propósito (ver
   o cabeçalho de `ajustarAssinatura`: duplicar a aritmética aqui produziria um
   número que discorda da fatura).

   PODE provar — e é o que quebra na prática — que a operação DEGRADA BEM. O
   ajuste acontece depois de o acesso já ter sido concedido, então toda falha
   dele é uma falha silenciosa: o cliente fica com o módulo, a fatura não muda,
   e ninguém percebe até o fim do mês.

   As garantias:

     1. Sem provedor configurado, nada explode e o motivo é dito.
     2. Sem assinatura no provedor, idem — e é o caso de TODA conta de teste,
        que é como este arquivo consegue rodar sem Stripe nenhum.
     3. A mudança de módulo/plano acontece MESMO quando a cobrança não é
        ajustada. Esta é a mais importante: uma ordem invertida deixaria quem
        clicou em "contratar" sem o módulo e sem explicação.
     4. A resposta sempre diz em português o que aconteceu com a fatura.
   ──────────────────────────────────────────────────────────────────────────── */

let api;
let A;

test.before(async () => {
  await limparRestos();
  api = await subirApi({ "/api/tenants": tenantRouter });
  A = await criarImobiliariaDeTeste();
  /* Conta PAGANTE: em teste as duas rotas recusam antes de chegar na cobrança
     (o caminho ali é assinar), e não é isso que está sob teste. */
  await prisma.tenant.update({
    where: { id: A.tenant.id },
    data: { statusPagamento: "EM_DIA", plano: "PROFISSIONAL", modulos: ["HUB"] },
  });
});

test.after(async () => {
  await api?.fechar();
  if (A) await apagarImobiliaria(A.tenant.id);
  await limparRestos();
  await prisma.$disconnect();
});

/* ═══════════════════════════════════════════════════════════════════════════
   A FUNÇÃO, isolada
   ═══════════════════════════════════════════════════════════════════════════ */

test("nunca lança — a falha vira motivo em português", async () => {
  /* É a propriedade que sustenta tudo: `ajustarAssinatura` roda DEPOIS de o
     acesso ter sido gravado. Uma exceção aqui viraria 500 numa operação que já
     teve efeito, e o cliente veria erro numa coisa que funcionou. */
  const entradas = [
    { tenant: { id: A.tenant.id, assinaturaId: null }, plano: "PREMIUM", pacote: "HUB_FLOW" },
    { tenant: { id: A.tenant.id, assinaturaId: "sub_nao_existe" }, plano: "BASICO", pacote: "HUB" },
    { tenant: { id: "nao-existe" }, plano: "PREMIUM", pacote: "HUB" },
    { tenant: {}, plano: "QUALQUER", pacote: "INVENTADO" },
  ];
  for (const entrada of entradas) {
    const r = await ajustarAssinatura(entrada);
    assert.equal(typeof r, "object");
    assert.equal(typeof r.ajustada, "boolean");
    if (!r.ajustada) {
      assert.equal(typeof r.motivo, "string");
      assert.ok(r.motivo.length > 12, `motivo curto demais: ${r.motivo}`);
      /* Em português e dizendo o que fazer. "Error" ou "failed" vazando para a
         tela é o sintoma de um `catch` que devolveu a mensagem do provedor. */
      assert.ok(!/error|failed|undefined/i.test(r.motivo), r.motivo);
    }
  }
});

test("sem provedor configurado, diz isso e não tenta nada", async (t) => {
  if (pagamentoConfigurado()) {
    t.skip("Stripe está configurado neste ambiente — este caso não se reproduz");
    return;
  }
  const r = await ajustarAssinatura({
    tenant: { id: A.tenant.id, assinaturaId: null }, plano: "PREMIUM", pacote: "HUB_FLOW",
  });
  assert.equal(r.ajustada, false);
  assert.match(r.motivo, /cobrança automática/i);
});

test("a prévia é informativa e devolve null em vez de quebrar", async () => {
  /* Ela existe para a tela mostrar "R$ X na próxima fatura". Se falhar, a tela
     apenas não mostra o número — a operação não depende dela, e por isso ela
     nunca pode derrubar nada. */
  for (const entrada of [
    { tenant: { id: A.tenant.id }, plano: "PREMIUM", pacote: "HUB_FLOW" },
    { tenant: { id: "nao-existe" }, plano: "BASICO", pacote: "HUB" },
    { tenant: {}, plano: null, pacote: null },
  ]) {
    const r = await previaDoAjuste(entrada);
    assert.ok(r === null || typeof r.valor === "number", JSON.stringify(r));
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   AS ROTAS — o acesso vem primeiro, a cobrança depois
   ═══════════════════════════════════════════════════════════════════════════ */

test("contratar o Flow libera o módulo mesmo sem conseguir ajustar a fatura", async () => {
  /* A garantia central. Sem assinatura no provedor (o caso de toda conta de
     teste), o ajuste falha — e o módulo TEM que ser entregue assim mesmo.
     A ordem inversa deixaria o cliente pagando a mesma coisa e sem o produto. */
  const r = await api.comoTenant(A).post("/api/tenants/me/modulos", { flow: true });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual(r.json.modulos.sort(), ["FLOW", "HUB"]);

  const gravado = await prisma.tenant.findUnique({
    where: { id: A.tenant.id }, select: { modulos: true },
  });
  assert.ok(gravado.modulos.includes("FLOW"), "o módulo precisa estar no banco");

  // E a resposta conta a verdade sobre a fatura, sem prometer o que não houve.
  assert.equal(typeof r.json.cobrancaAjustada, "boolean");
  assert.ok(r.json.aviso.includes("Omnimob Flow"), r.json.aviso);
  if (!r.json.cobrancaAjustada) {
    assert.ok(r.json.aviso.length > 40, "o aviso precisa dizer o motivo");
  }
});

test("dispensar o Flow também não depende do provedor", async () => {
  const r = await api.comoTenant(A).post("/api/tenants/me/modulos", { flow: false });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual(r.json.modulos, ["HUB"]);
  /* Prender alguém pagando por um módulo até o Stripe responder seria o pior
     atrito possível — pior que a cobrança ficar um mês desalinhada. */
  assert.ok(r.json.aviso.includes("desativado"), r.json.aviso);
  assert.ok(r.json.aviso.includes("guardados"), "precisa dizer que nada foi apagado");
});

test("trocar de plano responde o que houve com a cobrança", async () => {
  const r = await api.comoTenant(A).post("/api/tenants/me/plano", {
    plano: "BASICO", confirmar: true,
  });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.tenant.plano, "BASICO");
  assert.equal(typeof r.json.cobrancaAjustada, "boolean");
  /* `motivoCobranca` só existe quando NÃO ajustou — é o que a tela mostra no
     lugar da promessa de proporcional. */
  if (r.json.cobrancaAjustada) assert.equal(r.json.motivoCobranca, null);
  else assert.ok(r.json.motivoCobranca?.length > 12, JSON.stringify(r.json));
});

test("trocar de plano preserva o pacote — quem tem o Flow continua com ele", async () => {
  /* O preço-alvo de uma troca de plano é o do MESMO pacote no plano novo.
     Tratar toda troca como "HUB" tiraria o Flow da fatura de quem o tem, em
     silêncio, e o cliente descobriria pelo extrato. */
  await prisma.tenant.update({
    where: { id: A.tenant.id },
    data: { plano: "BASICO", modulos: ["HUB", "FLOW"] },
  });

  const r = await api.comoTenant(A).post("/api/tenants/me/plano", {
    plano: "PREMIUM", confirmar: true,
  });
  assert.equal(r.status, 200, JSON.stringify(r.json));

  const depois = await prisma.tenant.findUnique({
    where: { id: A.tenant.id }, select: { plano: true, modulos: true },
  });
  assert.equal(depois.plano, "PREMIUM");
  assert.ok(depois.modulos.includes("FLOW"), "a troca de plano não pode tirar o módulo");
});

test("conta em teste não ajusta cobrança nenhuma — o caminho é assinar", async () => {
  await prisma.tenant.update({
    where: { id: A.tenant.id }, data: { statusPagamento: "TRIAL" },
  });
  const r = await api.comoTenant(A).post("/api/tenants/me/modulos", { flow: false });
  assert.equal(r.status, 409);
  assert.equal(r.json.code, "EM_TRIAL");
  await prisma.tenant.update({
    where: { id: A.tenant.id }, data: { statusPagamento: "EM_DIA" },
  });
});

test("o id da assinatura nunca é apagado por engano", async () => {
  /* A coluna existe para poder mexer na cobrança depois. Uma operação que a
     zere corta esse caminho de volta em silêncio — e o sintoma só aparece no
     próximo ajuste, que passa a depender da busca. */
  await prisma.tenant.update({
    where: { id: A.tenant.id },
    data: { assinaturaId: "sub_marcador_de_teste", modulos: ["HUB"] },
  });

  await api.comoTenant(A).post("/api/tenants/me/modulos", { flow: true });
  const depoisDoModulo = await prisma.tenant.findUnique({
    where: { id: A.tenant.id }, select: { assinaturaId: true },
  });
  assert.equal(depoisDoModulo.assinaturaId, "sub_marcador_de_teste");

  await api.comoTenant(A).post("/api/tenants/me/plano", { plano: "PROFISSIONAL", confirmar: true });
  const depoisDoPlano = await prisma.tenant.findUnique({
    where: { id: A.tenant.id }, select: { assinaturaId: true },
  });
  assert.equal(depoisDoPlano.assinaturaId, "sub_marcador_de_teste");
});

test("o id da assinatura nunca sai numa resposta", async () => {
  /* Ele identifica a assinatura na conta Stripe da Omnimob. Não é segredo de
     autenticação, mas é referência interna de cobrança e não tem nada a fazer
     no navegador do cliente — `SEGREDOS_DO_TENANT` cobre os tokens, e este
     campo precisa da mesma disciplina. */
  const perfil = await api.comoTenant(A).get("/api/tenants/me");
  assert.equal(perfil.status, 200);
  const cru = JSON.stringify(perfil.json);
  assert.ok(!cru.includes("assinaturaId"), "o id vazou no perfil");
  assert.ok(!cru.includes("sub_marcador_de_teste"), "o valor vazou no perfil");

  const trial = await api.comoTenant(A).get("/api/tenants/me/trial");
  assert.equal(trial.status, 200);
  assert.ok(!JSON.stringify(trial.json).includes("sub_marcador_de_teste"), "o valor vazou no trial");
});
