import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

/* ── O que esta suíte guarda ─────────────────────────────────────────────────

   Duas coisas, e nenhuma delas é "a integração funciona" — isso exige conta de
   vendedor e aplicação aprovada no Mercado Pago, como diz o cabeçalho do
   serviço. Mesma situação de `mercadoLivre.test.js`.

   1. A TRADUÇÃO plano → cobrança. O risco aqui é o de `formatosImportacao.js`:
      não é vazamento, é interpretação. Um campo no lugar errado cobra o valor
      errado, ou cobra certo e ninguém consegue ligar o pagamento ao tenant
      depois — e os dois defeitos são silenciosos.

   2. A ASSINATURA do webhook. É ela que separa um aviso do provedor de uma
      requisição que qualquer pessoa pode mandar para uma URL pública. Um
      defeito aqui vale um ano de plano de graça para quem descobrir o endereço.

   Não toca no banco. O segredo é definido antes do import porque o módulo lê
   as variáveis de ambiente uma vez, ao carregar.
   ────────────────────────────────────────────────────────────────────────── */

const SEGREDO = "segredo-de-teste-do-webhook";
process.env.MERCADOPAGO_WEBHOOK_SECRET = SEGREDO;
process.env.MERCADOPAGO_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || "token-de-teste";
/* Vazia à força, e ANTES do import: o serviço lê a variável uma vez, ao
   carregar, e o `.env` de quem roda o teste pode ter um endereço de produção
   ali. Sem esta linha a suíte passava na máquina de quem ainda não tinha
   configurado o webhook e falhava na de quem tinha — teste que depende do
   ambiente não guarda nada. O `dotenv` não sobrescreve chave já definida, então
   basta existir. */
process.env.MERCADOPAGO_WEBHOOK_URL = "";

const { corpoDaCobrancaPix, lerWebhook, normalizarStatus } = await import(
  "../src/services/pagamentoMercadoPago.js"
);

const TENANT = {
  id: "cmtenant0001",
  slug: "zz-teste-pix",
  name: "Imobiliária do Teste",
  email: "financeiro@exemplo.com.br",
  cnpj: "12.345.678/0001-95",
};

function assinar({ id, requestId, ts, segredo = SEGREDO }) {
  const manifesto =
    (id ? `id:${String(id).toLowerCase()};` : "") + (requestId ? `request-id:${requestId};` : "") + `ts:${ts};`;
  return crypto.createHmac("sha256", segredo).update(manifesto, "utf8").digest("hex");
}

// ─── A tradução ──────────────────────────────────────────────────────────────

test("a cobrança carrega o elo com a imobiliária em DOIS lugares", () => {
  const corpo = corpoDaCobrancaPix({
    tenant: TENANT,
    plano: "PROFISSIONAL",
    periodo: "anual",
    pacote: "HUB",
    valor: 1415.5,
  });

  /* `external_reference` é o que o webhook lê e o que aparece nas telas do
     provedor; a metadata carrega o resto do contexto. Perder qualquer um dos
     dois deixa um pagamento aprovado sem dono. */
  assert.equal(corpo.external_reference, TENANT.id);
  assert.equal(corpo.metadata.tenant_id, TENANT.id);
  assert.equal(corpo.metadata.plano, "PROFISSIONAL");
  assert.equal(corpo.metadata.periodo, "anual");
  assert.equal(corpo.metadata.pacote, "HUB");
});

test("o valor vai como número, e é exatamente o que foi passado", () => {
  const corpo = corpoDaCobrancaPix({
    tenant: TENANT,
    plano: "BASICO",
    periodo: "anual",
    pacote: "HUB",
    valor: 990.4,
  });
  assert.equal(typeof corpo.transaction_amount, "number");
  assert.equal(corpo.transaction_amount, 990.4);
  assert.equal(corpo.payment_method_id, "pix");
});

test("CNPJ e CPF são reconhecidos pelo tamanho, e lixo simplesmente não vai", () => {
  const comCnpj = corpoDaCobrancaPix({ tenant: TENANT, plano: "BASICO", periodo: "anual", valor: 10 });
  assert.deepEqual(comCnpj.payer.identification, { type: "CNPJ", number: "12345678000195" });

  const comCpf = corpoDaCobrancaPix({
    tenant: { ...TENANT, cnpj: "123.456.789-09" },
    plano: "BASICO",
    periodo: "anual",
    valor: 10,
  });
  assert.deepEqual(comCpf.payer.identification, { type: "CPF", number: "12345678909" });

  /* Documento incompleto não pode derrubar a cobrança: ele é recomendado, não
     obrigatório. A alternativa seria bloquear quem cadastrou o CNPJ pela
     metade — e o cliente perderia a compra por causa de um campo de cadastro. */
  const semDoc = corpoDaCobrancaPix({
    tenant: { ...TENANT, cnpj: "123" },
    plano: "BASICO",
    periodo: "anual",
    valor: 10,
  });
  assert.equal(semDoc.payer.identification, undefined);
  assert.equal(semDoc.payer.email, TENANT.email);
});

test("a descrição diz o prazo e o pacote — é o que a pessoa lê no app do banco", () => {
  const comFlow = corpoDaCobrancaPix({
    tenant: TENANT,
    plano: "PREMIUM",
    periodo: "anual",
    pacote: "HUB_FLOW",
    valor: 100,
  });
  assert.match(comFlow.description, /12 meses/);
  assert.match(comFlow.description, /Hub \+ Flow/);
});

test("o mensal é uma cobrança legítima, e a descrição diz o prazo certo", () => {
  /* O mensal foi bloqueado no começo e liberado por decisão de produto. O que
     não pode acontecer é a cobrança sair com cara de anual: a descrição é o que
     a pessoa lê no app do banco na hora de confirmar, e `periodo` na metadata é
     o que decide quantos meses a conta ganha quando o pagamento cai. */
  const corpo = corpoDaCobrancaPix({
    tenant: TENANT,
    plano: "PROFISSIONAL",
    periodo: "mensal",
    pacote: "HUB",
    valor: 99,
  });
  assert.match(corpo.description, /1 mês/);
  assert.ok(!/12 meses/.test(corpo.description));
  assert.equal(corpo.metadata.periodo, "mensal");
  assert.equal(corpo.transaction_amount, 99);
});

test("período desconhecido cai no mensal, e nunca em silêncio no anual", () => {
  /* O padrão seguro é o mais barato: um corpo malformado não pode virar uma
     cobrança de doze meses. */
  const corpo = corpoDaCobrancaPix({ tenant: TENANT, plano: "BASICO", periodo: "trimestral", valor: 10 });
  assert.equal(corpo.metadata.periodo, "mensal");
});

test("o vencimento vai com fuso EXPLÍCITO, e não com o Z", () => {
  const agora = new Date("2026-08-27T12:00:00.000Z");
  const corpo = corpoDaCobrancaPix({
    tenant: TENANT,
    plano: "BASICO",
    periodo: "anual",
    valor: 10,
    agora,
  });
  // Meia hora à frente, no formato que o provedor documenta.
  assert.equal(corpo.date_of_expiration, "2026-08-27T12:30:00.000+00:00");
  assert.ok(!corpo.date_of_expiration.endsWith("Z"));
});

test("sem endereço público de webhook, a cobrança nasce sem notification_url", () => {
  /* Mandar um `http://localhost` faria o provedor recusar a cobrança INTEIRA
     por causa do aviso — o pagamento morreria por causa da notificação. Em
     desenvolvimento a variável fica vazia de propósito, e é a tela que
     confirma o pagamento. */
  const corpo = corpoDaCobrancaPix({ tenant: TENANT, plano: "BASICO", periodo: "anual", valor: 10 });
  assert.equal(corpo.notification_url, undefined);
});

// ─── A assinatura do webhook ─────────────────────────────────────────────────

test("aviso legítimo passa", () => {
  const ts = Math.floor(Date.now() / 1000);
  const aviso = lerWebhook({
    corpo: { type: "payment", action: "payment.updated", data: { id: "112233" } },
    assinatura: `ts=${ts},v1=${assinar({ id: "112233", requestId: "req-1", ts })}`,
    requestId: "req-1",
    idDaQuery: "112233",
  });
  assert.equal(aviso.tipo, "payment");
  assert.equal(aviso.id, "112233");
});

test("assinatura de outro segredo é recusada", () => {
  const ts = Math.floor(Date.now() / 1000);
  assert.throws(
    () =>
      lerWebhook({
        corpo: { type: "payment", data: { id: "112233" } },
        assinatura: `ts=${ts},v1=${assinar({ id: "112233", requestId: "req-1", ts, segredo: "outro" })}`,
        requestId: "req-1",
        idDaQuery: "112233",
      }),
    /não confere/i,
  );
});

test("id trocado no corpo não passa — a assinatura cobre o id", () => {
  /* Este é o ataque óbvio: pegar um aviso legítimo e trocar o número do
     pagamento pelo de outra pessoa. */
  const ts = Math.floor(Date.now() / 1000);
  assert.throws(
    () =>
      lerWebhook({
        corpo: { type: "payment", data: { id: "999999" } },
        assinatura: `ts=${ts},v1=${assinar({ id: "112233", requestId: "req-1", ts })}`,
        requestId: "req-1",
        idDaQuery: "999999",
      }),
    /não confere/i,
  );
});

test("aviso velho é recusado (reenvio capturado)", () => {
  const ts = Math.floor(Date.now() / 1000) - 3600;
  assert.throws(
    () =>
      lerWebhook({
        corpo: { type: "payment", data: { id: "112233" } },
        assinatura: `ts=${ts},v1=${assinar({ id: "112233", requestId: "req-1", ts })}`,
        requestId: "req-1",
        idDaQuery: "112233",
      }),
    /tolerância/i,
  );
});

test("assinatura ausente ou malformada é recusada", () => {
  const corpo = { type: "payment", data: { id: "1" } };
  assert.throws(() => lerWebhook({ corpo, assinatura: "" }), /ausente|malformada/i);
  assert.throws(() => lerWebhook({ corpo, assinatura: "v1=abc" }), /ausente|malformada/i);
});

test("id alfanumérico entra em minúsculo no manifesto", () => {
  /* Está na documentação deles, e é o tipo de detalhe que faz a assinatura
     nunca bater sem que nada no erro diga por quê. */
  const ts = Math.floor(Date.now() / 1000);
  const aviso = lerWebhook({
    corpo: { type: "payment", data: { id: "ABC-123" } },
    assinatura: `ts=${ts},v1=${assinar({ id: "ABC-123", requestId: "r", ts })}`,
    requestId: "r",
    idDaQuery: "ABC-123",
  });
  assert.equal(aviso.id, "ABC-123");
});

// ─── Os estados ──────────────────────────────────────────────────────────────

test("estado desconhecido é tratado como RECUSADO, não como pendente", () => {
  assert.equal(normalizarStatus("approved"), "aprovado");
  assert.equal(normalizarStatus("pending"), "pendente");
  assert.equal(normalizarStatus("in_process"), "pendente");
  assert.equal(normalizarStatus("rejected"), "recusado");
  assert.equal(normalizarStatus("cancelled"), "recusado");
  assert.equal(normalizarStatus("refunded"), "recusado");
  /* Pendente deixaria a tela girando para sempre num pagamento que morreu;
     recusado ao menos oferece gerar outro código. */
  assert.equal(normalizarStatus("estado_que_eles_inventarem"), "recusado");
});
