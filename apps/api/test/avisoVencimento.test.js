import test from "node:test";
import assert from "node:assert/strict";
import { aQuemAvisar, diasAte, chaveDoAviso, DEGRAUS } from "../src/services/avisoVencimento.js";
import { emailVencimentoProximo } from "../src/services/emailTemplates.js";

/* ── O que esta suíte guarda ─────────────────────────────────────────────────

   A REGRA DE SELEÇÃO, e nada mais. É função pura sobre uma lista de tenants,
   então não toca no banco nem manda e-mail — como `formatosImportacao.test.js`
   e `mercadoPago.test.js`.

   O risco aqui não é vazamento, é o mesmo dos dois lados do silêncio:
     · avisar de menos → a conta vence calada e o cliente perde o painel;
     · avisar demais → "sua conta vence amanhã" chegando quatro vezes por dia,
       que parece defeito de cobrança e gasta a paciência do próximo aviso.

   O agendador roda de seis em seis horas de propósito, então a idempotência não
   é detalhe: é o que torna a frequência segura.
   ────────────────────────────────────────────────────────────────────────── */

const HOJE = new Date("2026-08-28T15:00:00.000Z");

function tenant(extra = {}) {
  return {
    id: "t1",
    name: "Imobiliária do Teste",
    email: "contato@exemplo.test",
    plano: "PROFISSIONAL",
    proximoVencimento: new Date("2026-09-04T09:00:00.000Z"), // D-7
    avisoVencimento: null,
    assinaturaId: null,
    cobrancaProvedor: "MERCADO_PAGO",
    ...extra,
  };
}

test("dias são contados por DATA, não por horas", () => {
  /* `proximoVencimento` carrega a hora em que a assinatura foi criada. Contando
     por horas, um vencimento às 23h de daqui a sete dias daria 6,9 — e cairia
     no degrau errado, ou em nenhum. Quem lê o e-mail pensa em calendário. */
  assert.equal(diasAte(new Date("2026-09-04T23:59:00Z"), HOJE), 7);
  /* 00:01 UTC do dia 4 é 21h01 do dia 3 em São Paulo — então faltam SEIS dias,
     não sete. Parece contraintuitivo lendo o instante em UTC, e é exatamente
     por isso que está aqui: a conta precisa bater com a data que o cliente lê
     no e-mail, e é ela que o cliente usa para saber quando pagar. */
  assert.equal(diasAte(new Date("2026-09-04T00:01:00Z"), HOJE), 6);
  /* 02:00 UTC do dia 29 ainda é a noite do dia 28 em São Paulo — é ESTE o
     caso que o fuso do servidor errava, e por isso ele fica no teste. */
  assert.equal(diasAte(new Date("2026-08-29T02:00:00Z"), HOJE), 0);
  assert.equal(diasAte(new Date("2026-08-29T12:00:00Z"), HOJE), 1);
  assert.equal(diasAte(new Date("2026-08-28T23:00:00Z"), HOJE), 0);
  assert.equal(diasAte(new Date("2026-08-27T23:00:00Z"), HOJE), -1);
});

test("D-7 entra, e no degrau 7", () => {
  const [alvo] = aQuemAvisar([tenant()], HOJE);
  assert.ok(alvo);
  assert.equal(alvo.dias, 7);
  assert.equal(alvo.degrau, 7);
  assert.equal(alvo.chave, "2026-09-04:7");
});

test("quem vence longe não recebe nada", () => {
  const longe = tenant({ proximoVencimento: new Date("2026-10-30T09:00:00Z") });
  assert.equal(aQuemAvisar([longe], HOJE).length, 0);
});

test("o degrau é o MENOR que ainda cabe", () => {
  /* Se a API ficou parada no fim de semana, a conta pula de 7 para 5 dias. Sem
     esta regra, quem estava em D-5 não receberia nada até a véspera. */
  const cinco = tenant({ proximoVencimento: new Date("2026-09-02T09:00:00Z") });
  const [alvo] = aQuemAvisar([cinco], HOJE);
  assert.equal(alvo.dias, 5);
  assert.equal(alvo.degrau, 7);
});

test("o mesmo aviso não sai duas vezes", () => {
  /* A trava que torna seguro rodar quatro vezes por dia. */
  const jaAvisado = tenant({ avisoVencimento: "2026-09-04:7" });
  assert.equal(aQuemAvisar([jaAvisado], HOJE).length, 0);
});

test("depois do D-7, o D-1 ainda sai", () => {
  const vespera = tenant({
    proximoVencimento: new Date("2026-08-29T09:00:00Z"),
    avisoVencimento: "2026-08-29:7",
  });
  const [alvo] = aQuemAvisar([vespera], HOJE);
  assert.equal(alvo.degrau, 1);
  assert.equal(alvo.chave, "2026-08-29:1");
});

test("gravado o D-1, nada mais sai para aquele vencimento", () => {
  const pronto = tenant({
    proximoVencimento: new Date("2026-08-29T09:00:00Z"),
    avisoVencimento: "2026-08-29:1",
  });
  assert.equal(aQuemAvisar([pronto], HOJE).length, 0);
});

test("pagar reabre o ciclo sozinho — a data está na chave", () => {
  /* Este é o motivo de a data entrar na marca. O cliente pagou, o vencimento
     andou um ano, e a marca velha não pode calar o aviso do ciclo novo. Sem
     isso seria preciso limpar a coluna a cada pagamento — mais um lugar para
     esquecer. */
  const renovado = tenant({
    proximoVencimento: new Date("2027-09-04T09:00:00Z"),
    avisoVencimento: "2026-09-04:1",
  });
  assert.equal(aQuemAvisar([renovado], HOJE).length, 0, "ainda falta um ano: nada a mandar");

  const perto = tenant({
    proximoVencimento: new Date("2026-09-03T09:00:00Z"),
    avisoVencimento: "2026-08-04:1", // marca de um vencimento ANTERIOR
  });
  const [alvo] = aQuemAvisar([perto], HOJE);
  assert.equal(alvo.chave, "2026-09-03:7");
});

test("conta já vencida não recebe 'vence em breve'", () => {
  /* Aí o assunto é outro, e quem fala é o `emailTrialExpirado`. Dizer "vence em
     breve" para quem já venceu faz o cliente desconfiar de tudo que vem
     depois. */
  const vencida = tenant({ proximoVencimento: new Date("2026-08-20T09:00:00Z") });
  assert.equal(aQuemAvisar([vencida], HOJE).length, 0);
});

test("vence HOJE ainda é avisado", () => {
  const hoje = tenant({ proximoVencimento: new Date("2026-08-28T23:00:00Z") });
  const [alvo] = aQuemAvisar([hoje], HOJE);
  assert.equal(alvo.dias, 0);
  assert.equal(alvo.degrau, 1);
});

test("sem e-mail e sem vencimento, ninguém entra", () => {
  const semEmail = tenant({ email: "" });
  const semData = tenant({ proximoVencimento: null });
  assert.equal(aQuemAvisar([semEmail, semData], HOJE).length, 0);
});

test("os degraus vão do mais distante para o mais próximo", () => {
  /* É essa ordem que permite guardar UM campo só: gravado o menor, não há mais
     nada a mandar para aquele vencimento. Inverter quebraria a trava. */
  assert.deepEqual(DEGRAUS, [...DEGRAUS].sort((a, b) => b - a));
});

test("a chave é a data do vencimento mais o degrau", () => {
  assert.equal(chaveDoAviso(new Date("2026-09-04T23:59:00Z"), 7), "2026-09-04:7");
});

/* ── O que o e-mail PROMETE ──────────────────────────────────────────────────
   O botão diz "gerar meu Pix agora". Se ele levar ao login e de lá ao painel, a
   pessoa entra e tem de procurar onde era — o oposto do que foi prometido. O
   destino é a seção de Cobrança, e o `App.jsx` guarda esse endereço enquanto
   ela faz login.
   ────────────────────────────────────────────────────────────────────────── */
test("o aviso leva para a seção de cobrança, não para o login genérico", () => {
  const { html, body, subject } = emailVencimentoProximo({
    imobiliaria: "Imobiliária do Teste",
    dias: 7,
    vence: new Date("2026-09-04T12:00:00Z"),
    plano: "PROFISSIONAL",
    renovaSozinho: false,
    base: "https://omnimob.app",
  });

  assert.match(subject, /vence/i);
  assert.ok(html.includes("/configuracoes?ver=cobranca"), "o botão não aponta para a cobrança");
  assert.ok(body.includes("/configuracoes?ver=cobranca"), "a versão em texto ficou sem o endereço");
  /* A versão em texto puro é obrigatória: cliente que bloqueia HTML, leitor de
     tela e filtro de spam olham para ela. */
  assert.ok(!body.includes("undefined"));
});

test("quem paga no cartão recebe outra mensagem — e não um pedido de ação", () => {
  const cartao = emailVencimentoProximo({
    imobiliaria: "Teste", dias: 7, vence: new Date("2026-09-04T12:00:00Z"),
    renovaSozinho: true, base: "https://omnimob.app",
  });
  assert.match(cartao.body, /automática/i);
  assert.ok(!/gere um novo código/i.test(cartao.body), "texto de Pix indo para quem tem cartão");
});
