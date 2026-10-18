import test from "node:test";
import assert from "node:assert/strict";
import { nomesDasSecoes } from "../src/puck/NomesDasSecoes.jsx";

/* O nome próprio da seção sai do documento, e é daqui que a Estrutura e o
   título do inspetor o leem. Os casos que importam: seção sem nome não ganha
   nome nenhum (continua "Seção (colunas)"), espaço em branco não conta como
   nome, e seção dentro de seção (slot) também é achada. */
test("nomes das seções: só as que têm nome, inclusive aninhadas", () => {
  const conteudo = [
    { type: "BlocoCabecalho", props: { id: "cab" } },
    { type: "Secao", props: { id: "s1", nome: "  Depoimentos ", conteudo: [
      { type: "Widget_texto", props: { id: "w1" } },
      { type: "Secao", props: { id: "s2", nome: "Dentro", conteudo: [] } },
    ] } },
    { type: "Secao", props: { id: "s3", nome: "   ", conteudo: [] } },
    { type: "Secao", props: { id: "s4", conteudo: [] } },
  ];
  const nomes = nomesDasSecoes(conteudo);
  assert.equal(nomes.get("s1"), "Depoimentos");
  assert.equal(nomes.get("s2"), "Dentro");
  assert.ok(!nomes.has("s3"), "só espaço não é nome");
  assert.ok(!nomes.has("s4"));
  assert.ok(!nomes.has("cab"), "só seção tem nome próprio");
});
