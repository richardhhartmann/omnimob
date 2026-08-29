import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

/* ────────────────────────────────────────────────────────────────────────────
   A tela de Cargos gravava a cada caixa marcada.

   O botão dizia "Salvar nome" e era honesto: só o nome esperava por ele. As
   permissões iam ao banco no clique, uma por uma — então "Cancelar" voltava
   para a lista com tudo já gravado, e quem abria um cargo para CONFERIR as
   permissões o alterava ao esbarrar numa caixa, sem nada para desfazer.

   As outras quatro telas de cadastro do painel — Clientes, Usuários, Tipos de
   Imóvel e Imóveis — sempre esperaram por um botão. Esta era a única fora do
   padrão, e o custo aparecia justamente onde é mais caro: permissão.

   Sem comentários na leitura: este arquivo descreve o defeito em prosa, e um
   verificador que lê comentário acusa a documentação em vez do código.
   ──────────────────────────────────────────────────────────────────────────── */

const semComentarios = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\/\/[^\n]*/g, " ");

const fonte = semComentarios(fs.readFileSync("src/pages/CargosPage.jsx", "utf8"));

/** O corpo de uma função declarada com `function nome(`, por contagem de chaves. */
function corpoDaFuncao(texto, nome) {
  const i = texto.indexOf(`function ${nome}(`);
  assert.notEqual(i, -1, `função ${nome} não existe mais — o teste precisa ser reescrito`);
  const inicio = texto.indexOf("{", i);
  let profundidade = 0;
  for (let j = inicio; j < texto.length; j++) {
    if (texto[j] === "{") profundidade++;
    else if (texto[j] === "}" && --profundidade === 0) return texto.slice(inicio, j + 1);
  }
  throw new Error(`chaves desbalanceadas em ${nome}`);
}

test("marcar uma permissão não grava nada", () => {
  const corpo = corpoDaFuncao(fonte, "alternarPermissao");
  assert.doesNotMatch(
    corpo, /api\./,
    "o clique na caixa voltou a falar com o servidor — ele só pode mexer no form",
  );
});

test("o 'estou ciente' do modal também só marca a caixa", () => {
  /* Esta era a segunda porta para o mesmo defeito: a confirmação da permissão
     de risco tinha um modo que gravava direto, desviando do botão. */
  const corpo = corpoDaFuncao(fonte, "confirmarConcessao");
  assert.doesNotMatch(corpo, /api\./);
});

test("quem grava é o submit, e manda o cargo INTEIRO", () => {
  const corpo = corpoDaFuncao(fonte, "handleSubmit");
  assert.match(corpo, /api\.updateCargo\(tenantSlug, editando\.id, form\)/,
    "editar precisa mandar o form todo: as permissões não vão mais sozinhas");
  assert.match(corpo, /api\.createCargo\(/);

  /* E é o ÚNICO lugar da tela que escreve cargo. */
  const escritas = (fonte.match(/api\.(updateCargo|createCargo)\(/g) || []).length;
  const escritasNoSubmit = (corpo.match(/api\.(updateCargo|createCargo)\(/g) || []).length;
  assert.equal(escritas, escritasNoSubmit, "há escrita de cargo fora do salvamento");
});

test("o botão promete o que faz, e some o 'Salvo automaticamente'", () => {
  assert.match(fonte, /"Salvar Alterações"/);
  assert.doesNotMatch(fonte, /Salvar nome/, "o botão prometia menos do que agora entrega");
  assert.doesNotMatch(fonte, /Salvo automaticamente/);
});

test("sair com alteração pendente pergunta antes de descartar", () => {
  /* A contrapartida de parar de gravar na hora: passou a existir trabalho que
     se perde, e perdê-lo por um clique em "Cancelar" seria trocar um defeito
     por outro. */
  const corpo = corpoDaFuncao(fonte, "sair");
  assert.match(corpo, /sujo/);
  assert.match(corpo, /confirm\(/);
  assert.match(fonte, /onClick=\{sair\}/, "o Cancelar precisa passar por ele");
});
