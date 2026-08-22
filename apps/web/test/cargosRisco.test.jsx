import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

/* ────────────────────────────────────────────────────────────────────────────
   O aviso antes de conceder uma permissão perigosa.

   Duas coisas que já saíram erradas: o texto dizia `"este cargo"` entre aspas,
   como se esse fosse o nome do cargo; e só `gerenciarCargos` avisava, embora
   `gerenciarUsuarios` permita desativar e excluir qualquer pessoa da equipe —
   inclusive quem está concedendo.
   ──────────────────────────────────────────────────────────────────────────── */

/* O catálogo saiu da tela de Cargos quando o `+` do cadastro de usuário passou
   a precisar do mesmo aviso — ele era um caminho para conceder `gerenciarCargos`
   por fora do modal. Duas telas leem, então mora em `utils`. */
const bruto = fs.readFileSync("src/utils/permissoesCargo.jsx", "utf8");
const telas = ["src/pages/CargosPage.jsx", "src/components/CargoEmLinha.jsx"]
  .map((f) => [f, fs.readFileSync(f, "utf8")]);

/* Sem comentários. Este arquivo EXPLICA o defeito em prosa — inclusive citando
   o texto errado — e um verificador que lê comentário acusa a documentação. Já
   aconteceu duas vezes nesta base. */
const fonte = bruto
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\/\/[^\n]*/g, " ");

/* Cinco, e cada uma por um motivo diferente:
     · gerenciarCargos    — a chave de todas as outras portas
     · gerenciarUsuarios  — desativa, exclui e troca a senha de qualquer conta
     · verPainelGestor    — faturamento da casa e o resultado de cada corretor
     · validarJuridico    — destrava o fechamento de um negócio
     · validarFinanceiro  — idem, e é no fechamento que a comissão é congelada

   As duas últimas entraram com o Omnimob Flow e são as mais silenciosas do
   produto: quem as tem não ganha tela nenhuma, só um botão. É justamente por
   isso que elas pedem aviso — a permissão que não muda nada na interface é a
   mais fácil de conceder por engano ao montar um cargo às pressas. */
const DE_RISCO = [
  "gerenciarCargos", "gerenciarUsuarios", "verPainelGestor",
  "validarJuridico", "validarFinanceiro",
];

test("as permissões de alto risco pedem ciência", () => {
  assert.ok(fonte.includes("PERMISSOES_DE_RISCO = {"));
  for (const chave of DE_RISCO) {
    assert.ok(fonte.includes(`${chave}: {`), `${chave} deveria estar no catálogo`);
  }
});

test("cada permissão tem o próprio texto, e não um aviso genérico", () => {
  const bloco = fonte.slice(fonte.indexOf("PERMISSOES_DE_RISCO = {"));

  const titulos = [...bloco.matchAll(/titulo:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.equal(titulos.length, DE_RISCO.length);
  /* Aviso repetido ensina a confirmar sem ler — e aí o modal deixa de proteger
     e vira só um passo a mais. */
  assert.equal(new Set(titulos).size, titulos.length, "há títulos repetidos");

  const ciencias = [...bloco.matchAll(/textoCiencia:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ciencias.length, DE_RISCO.length);
  assert.equal(new Set(ciencias).size, ciencias.length, "há textos de ciência repetidos");

  /* O aviso do painel precisa nomear o que ele expõe: é a parte que a pessoa lê
     antes de decidir. */
  const doPainel = bloco.slice(bloco.indexOf("verPainelGestor: {"));
  for (const palavra of ["faturou", "comissão", "corretor"]) {
    assert.ok(doPainel.includes(palavra), `o aviso do painel deveria mencionar "${palavra}"`);
  }

  /* O texto de gerenciarUsuarios precisa nomear o que ela permite fazer: é a
     parte que a pessoa lê antes de marcar a caixa de ciência. */
  const deUsuarios = bloco.slice(bloco.indexOf("gerenciarUsuarios: {"));
  for (const palavra of ["DESATIVAR", "EXCLUIR", "senha"]) {
    assert.ok(deUsuarios.includes(palavra), `o aviso deveria mencionar "${palavra}"`);
  }

  /* As duas do Flow precisam dizer que travam o FECHAMENTO. É a consequência
     que a pessoa não deduz sozinha: nada na tela de Cargos indica que estas
     caixas param um negócio de virar Ganho. */
  for (const chave of ["validarJuridico", "validarFinanceiro"]) {
    const trecho = bloco.slice(bloco.indexOf(`${chave}: {`));
    assert.ok(
      trecho.includes("GANHO") || trecho.includes("fechamento"),
      `o aviso de ${chave} deveria dizer que ela destrava o fechamento`,
    );
  }
});

test("o aviso usa o NOME do cargo, e nunca um marcador entre aspas", () => {
  const marcador = '"' + "este cargo" + '"';
  for (const [arquivo, bruta] of telas) {
    const texto = bruta.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
    assert.ok(!texto.includes(marcador), `${arquivo}: mostra o marcador como se fosse o nome`);
    assert.ok(texto.includes("ao cargo"), `${arquivo}: deveria montar o alvo a partir do nome`);
    assert.ok(texto.includes('"a este cargo"'), `${arquivo}: falta a forma sem nome`);
  }
});

test("as duas telas que criam cargo passam pelo aviso", () => {
  /* Se só uma consultasse o catálogo, bastaria usar a outra para conceder
     `gerenciarCargos` sem ver aviso nenhum. Foi o que aconteceu: o `+` do
     cadastro de usuário criava cargo com qualquer permissão, em silêncio. */
  for (const [arquivo, texto] of telas) {
    assert.ok(texto.includes("PERMISSOES_DE_RISCO"), `${arquivo} não consulta o catálogo`);
    assert.ok(texto.includes("ModalCiencia"), `${arquivo} não mostra o aviso`);
    assert.ok(!texto.includes("PERMISSAO_DE_RISCO)"), `${arquivo}: sobrou a constante única antiga`);
  }
});
