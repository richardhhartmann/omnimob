import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { GradeDePermissoes } from "../src/components/GradeDePermissoes.jsx";
import { EditorEsqueleto } from "../src/components/builder/EditorEsqueleto.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   As caixas de permissão são as MESMAS nas duas telas.

   O que este arquivo guarda não é o desenho — é a ausência de um segundo
   desenho. A tela de Cargos e o `+` do cadastro de usuário já tiveram cada uma
   a sua grade, e elas divergiram: a do cadastro não mostrava o ícone de cada
   permissão, e mexer numa não chegava na outra.

   Comparar a saída do componente com ela mesma não provaria nada. O que prova é
   que nenhuma das duas telas desenha permissão por conta própria.
   ──────────────────────────────────────────────────────────────────────────── */

const TELAS = [
  "src/pages/CargosPage.jsx",
  "src/components/CargoEmLinha.jsx",
];

for (const tela of TELAS) {
  test(`${tela} usa a grade compartilhada e não desenha a sua`, () => {
    const s = fs.readFileSync(tela, "utf8");

    assert.match(s, /GradeDePermissoes/, "deveria usar o componente compartilhado");

    /* O sinal de uma grade própria: percorrer a lista de permissões montando
       caixas de seleção ali mesmo. É exatamente o que as duas faziam antes. */
    const grade = /permissoes(Visiveis)?\.map\([^)]*\)\s*=>[\s\S]{0,400}type="checkbox"/;
    assert.ok(!grade.test(s), "esta tela voltou a desenhar as próprias caixas de permissão");
  });
}

test("permissão travada aparece marcada e sem poder ser mexida", () => {
  const html = renderToStaticMarkup(
    <GradeDePermissoes
      plano="PREMIUM"
      valores={{}}
      travadas={["gerenciarCargos"]}
      motivoTravada="Você não pode remover esta permissão do seu próprio cargo"
      aoAlternar={() => {}}
    />,
  );
  /* Travada é marcada de propósito: comunica "você tem isto e não pode abrir
     mão", e não "isto está desligado". */
  assert.match(html, /is-on is-travada/);
  assert.match(html, /disabled/);
  assert.match(html, /não pode remover esta permissão/);
});

test("o plano filtra a lista — Publicar em Redes some no plano básico", () => {
  const premium = renderToStaticMarkup(
    <GradeDePermissoes plano="PREMIUM" valores={{}} aoAlternar={() => {}} />,
  );
  const basico = renderToStaticMarkup(
    <GradeDePermissoes plano="BASICO" valores={{}} aoAlternar={() => {}} />,
  );
  assert.match(premium, /Publicar em Redes/);
  assert.ok(!/Publicar em Redes/.test(basico), "plano sem redes não pode oferecer a caixa");
});

test("o esqueleto do editor tem as três colunas e nada clicável", () => {
  const html = renderToStaticMarkup(<EditorEsqueleto />);
  assert.match(html, /ed-esq__rail/);
  assert.match(html, /ed-esq__palco/);
  assert.match(html, /ed-esq__inspetor/);
  assert.match(html, /skeleton-block/);
  /* Se algum controle de verdade vazar para o esqueleto, a tela volta a ser
     operável antes de existir documento. */
  assert.ok(!/<button|<input|<a /.test(html), "o esqueleto não pode conter controle nenhum");
});
