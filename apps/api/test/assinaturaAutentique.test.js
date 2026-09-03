import test from "node:test";
import assert from "node:assert/strict";

import { estadoAutentique, _internos } from "../src/services/flow/assinatura.js";

/* ────────────────────────────────────────────────────────────────────────────
   AUTENTIQUE — a derivação de estado.

   ── POR QUE ESTA COISA, E NÃO O RESTO DO ADAPTADOR ──

   Porque a Autentique é o único dos três provedores que NÃO tem campo
   `status`. Clicksign devolve "closed", DocuSign devolve "completed"; aqui o
   estado é uma conta nossa sobre `signatures_count`, `signed_count`,
   `rejected_count` e `deleted_at`. Uma conta errada aqui é a diferença entre
   um negócio que fecha e um que não fecha, e ela falha CALADA nos dois
   sentidos:

     · para menos → o contrato foi assinado, o painel diz pendente, e o negócio
       fica preso em APROVACAO para sempre;
     · para mais → o contrato NÃO foi assinado, o sistema acha que sim, e a
       trava do funil deixa passar um GANHO sem documento firmado. É exatamente
       o que `flow.test.js` existe para impedir, contornado por baixo.

   ── A ARMADILHA QUE MOTIVOU O ARQUIVO ──

   A Autentique põe o AUTOR do documento dentro do array `signatures`, com
   `action: null` e `name: null`. Não é signatário: é quem enviou. Um documento
   com um comprador volta com DOIS itens.

   Isso foi descoberto contra a API real, não na documentação. Quem contar
   `signatures.length` terá sempre uma parte a mais, que nunca assina, e
   NENHUM contrato do sistema inteiro chegará a ASSINADO. O sintoma seria
   "a assinatura digital não funciona", sem erro nenhum em lugar nenhum.

   Não toca na rede — mesma razão de `mercadoLivre.js` ter teste de tradução e
   não de integração: o risco aqui é INTERPRETAÇÃO.
   ──────────────────────────────────────────────────────────────────────────── */

/** O autor, como a Autentique o devolve: sem `action` e sem `name`. */
const AUTOR = {
  public_id: "autor-1",
  name: null,
  email: "dono@imobiliaria.test",
  action: null,
  signed: null,
  rejected: null,
};

const assinante = (id, { assinado = false, recusado = false } = {}) => ({
  public_id: id,
  name: "Fulano",
  email: `${id}@cliente.test`,
  action: { name: "SIGN" },
  signed: assinado ? { created_at: "2026-09-03T04:13:30.000000Z" } : null,
  rejected: recusado ? { created_at: "2026-09-03T04:20:00.000000Z" } : null,
});

test("o AUTOR não conta como parte — é ele que faria nenhum contrato fechar", () => {
  /* O caso exato observado na API: um signatário enviado, dois itens de volta,
     e `signatures_count` dizendo 1. Se a contagem viesse de `signatures.length`
     este documento seria eternamente 1-de-2. */
  const doc = {
    signatures_count: 1,
    signed_count: 1,
    rejected_count: 0,
    deleted_at: null,
    signatures: [AUTOR, assinante("comprador", { assinado: true })],
  };

  const { status, assinados } = estadoAutentique(doc);
  assert.equal(status, "ASSINADO");
  assert.equal(assinados.length, 1, "o autor não pode entrar na lista de quem assinou");
  assert.equal(assinados[0].chaveExterna, "comprador");
});

test("com o autor presente e ninguém tendo assinado, fica ENVIADO", () => {
  const doc = {
    signatures_count: 1,
    signed_count: 0,
    rejected_count: 0,
    deleted_at: null,
    signatures: [AUTOR, assinante("comprador")],
  };
  assert.equal(estadoAutentique(doc).status, "ENVIADO");
  assert.equal(estadoAutentique(doc).assinados.length, 0);
});

test("assinatura PARCIAL não é assinatura — dois de três não fecha", () => {
  /* O erro mais caro possível neste arquivo: deixar passar como ASSINADO um
     contrato em que só uma parte firmou. A trava do funil confia neste valor. */
  const doc = {
    signatures_count: 3,
    signed_count: 2,
    rejected_count: 0,
    deleted_at: null,
    signatures: [
      AUTOR,
      assinante("vendedor", { assinado: true }),
      assinante("comprador", { assinado: true }),
      assinante("testemunha"),
    ],
  };
  assert.equal(estadoAutentique(doc).status, "ENVIADO");
  assert.equal(estadoAutentique(doc).assinados.length, 2);
});

test("recusa vence assinatura — uma parte que recusou impede o fechamento", () => {
  /* Ordem importa: se a checagem de assinatura viesse primeiro, um documento
     em que todos menos um assinaram e esse um RECUSOU poderia ser lido como
     concluído assim que as contagens coincidissem. */
  const doc = {
    signatures_count: 2,
    signed_count: 2,
    rejected_count: 1,
    deleted_at: null,
    signatures: [AUTOR, assinante("vendedor", { assinado: true }), assinante("comprador", { recusado: true })],
  };
  assert.equal(estadoAutentique(doc).status, "RECUSADO");
});

test("documento apagado é CANCELADO, mesmo com tudo assinado", () => {
  /* `deleteDocument` é como cancelamos na Autentique, e ele APAGA. Um
     documento apagado não pode voltar a ser lido como assinado. */
  const doc = {
    signatures_count: 1,
    signed_count: 1,
    rejected_count: 0,
    deleted_at: "2026-09-03T05:00:00.000000Z",
    signatures: [AUTOR, assinante("comprador", { assinado: true })],
  };
  assert.equal(estadoAutentique(doc).status, "CANCELADO");
});

test("documento sem signatário nenhum não vira ASSINADO por vacuidade", () => {
  /* `0 >= 0` é verdadeiro, e sem a guarda de `total > 0` um documento vazio
     — ou um cujo payload veio incompleto — seria lido como concluído. */
  for (const doc of [
    { signatures_count: 0, signed_count: 0, rejected_count: 0, signatures: [] },
    { signatures_count: 0, signed_count: 0, rejected_count: 0, signatures: [AUTOR] },
    {},
    null,
  ]) {
    assert.equal(estadoAutentique(doc).status, "ENVIADO", JSON.stringify(doc));
  }
});

test("sem as contagens do provedor, cai nos itens reais e ainda ignora o autor", () => {
  /* Rede para um payload de webhook, que não traz `signatures_count`. Sem o
     recuo, `Number(undefined) || 0` daria zero e o documento assinado seria
     lido como pendente. */
  const doc = {
    deleted_at: null,
    signatures: [AUTOR, assinante("comprador", { assinado: true })],
  };
  assert.equal(estadoAutentique(doc).status, "ASSINADO");
});

test("o vocabulário de papéis não inventa valor fora do enum da Autentique", () => {
  /* `ActionEnum` é fechado: mandar um valor que não está nele derruba o envio
     inteiro com erro de validação. Testemunha é o único papel nosso com
     equivalente próprio; o resto assina como parte. */
  const { papelAutentique } = _internos;
  const permitidos = new Set([
    "SIGN", "APPROVE", "RECOGNIZE", "SIGN_AS_A_WITNESS",
    "ACKNOWLEDGE_RECEIPT", "ENDORSE_IN_BLACK", "ENDORSE_IN_WHITE",
  ]);
  assert.equal(papelAutentique("TESTEMUNHA"), "SIGN_AS_A_WITNESS");
  for (const papel of ["COMPRADOR", "VENDEDOR", "PROCURADOR", "IMOBILIARIA", null, undefined, "QUALQUER"]) {
    assert.ok(permitidos.has(papelAutentique(papel)), `${papel} produziu valor fora do enum`);
  }
});
