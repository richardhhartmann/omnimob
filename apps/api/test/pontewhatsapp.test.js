import test from "node:test";
import assert from "node:assert/strict";
import { corpoDaPonte } from "../src/services/pontewhatsapp.js";

/* ────────────────────────────────────────────────────────────────────────────
   O público do status publicado pela ponte.

   ── O ESTRAGO QUE ORIGINOU ESTE ARQUIVO ──

   Um anúncio de teste foi para a agenda de contatos INTEIRA de quem estava só
   experimentando o produto — com o aparelho configurado para mostrar status a
   uma pessoa só.

   A causa está na documentação do Whapi e não é ambígua: sem o campo
   `contacts`, ele busca a lista de contatos completa e envia para todos. A
   privacidade configurada no aparelho não alcança nada disso, porque a ponte é
   outra sessão e publica com a lista dela. No corpo da Evolution era pior: havia
   um `allContacts: true` cravado à mão.

   E não há conserto depois: o Whapi não suporta apagar status pela API
   ("not currently supported due to technical limitations"), e ele só some
   sozinho em 24 horas. Ou o público sai certo, ou não sai mais.

   Estas são funções puras — nenhuma toca no banco. É o único lugar do produto
   onde um teste de unidade é o teste certo: o defeito estava na MONTAGEM do
   corpo, não em consulta nenhuma.
   ──────────────────────────────────────────────────────────────────────────── */

const WHAPI = "https://gate.whapi.cloud";
const EVOLUTION = "https://evo.exemplo.test/message/sendStatus/instancia";

test("whapi: com público escolhido, manda a lista e só para ela", () => {
  const corpo = corpoDaPonte(WHAPI, {
    imagemUrl: "https://exemplo.test/a.jpg",
    legenda: "Casa nova",
    contatos: ["5511947362817", "+55 (11) 98888-8888"],
  });

  assert.deepEqual(corpo.contacts, [
    "5511947362817@s.whatsapp.net",
    "5511988888888@s.whatsapp.net",
  ], "o número tem que sair só com dígitos e com o sufixo que a API exige");
});

test("whapi: reencaminhar vem DESLIGADO", () => {
  /* O padrão da API é `true`. Para um anúncio isso multiplica o alcance de algo
     que a imobiliária escolheu mostrar a um público — e o dono do alcance deixa
     de ser ela. Quem quiser espalhar compartilha o link da vitrine. */
  const corpo = corpoDaPonte(WHAPI, { imagemUrl: "x", contatos: ["5511947362817"] });
  assert.equal(corpo.allow_reshare, false);
});

test("whapi: sem público, NÃO inventa um padrão silencioso", () => {
  /* Lista vazia continua significando "todos", porque é o que a API faz.
     Fingir outro padrão aqui esconderia o fato de quem configurou — quem avisa
     é a tela, com todas as letras. O teste existe para que a decisão seja
     deliberada, e não um acidente que volta sozinho. */
  const corpo = corpoDaPonte(WHAPI, { imagemUrl: "x", contatos: [] });
  assert.equal("contacts" in corpo, false);
});

test("evolution: com público, allContacts vai FALSO", () => {
  // Era `allContacts: true` cravado — mandava para a agenda inteira mesmo com
  // público escolhido, que é a falha na sua forma mais direta.
  const corpo = corpoDaPonte(EVOLUTION, { imagemUrl: "x", contatos: ["5511947362817"] });
  assert.equal(corpo.allContacts, false);
  assert.deepEqual(corpo.statusJidList, ["5511947362817@s.whatsapp.net"]);
});

test("evolution: sem público, assume todos explicitamente", () => {
  const corpo = corpoDaPonte(EVOLUTION, { imagemUrl: "x", contatos: [] });
  assert.equal(corpo.allContacts, true);
});

test("número inválido é descartado, não vira destinatário torto", () => {
  const corpo = corpoDaPonte(WHAPI, { imagemUrl: "x", contatos: ["", "abc", null, "5511947362817"] });
  assert.deepEqual(corpo.contacts, ["5511947362817@s.whatsapp.net"]);
});
