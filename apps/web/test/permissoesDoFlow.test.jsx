import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PERMISSOES, PERMISSOES_FLOW, TODAS_AS_PERMISSOES, PORTA_DO_FLOW,
  gruposDePermissao, cargoVazio,
} from "../src/utils/permissoesCargo.jsx";
import { GradeDePermissoes } from "../src/components/GradeDePermissoes.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   AS SETE PERMISSÕES DO FLOW NÃO PODEM SUMIR DE NENHUMA LISTA.

   ── A FAMÍLIA DE DEFEITO QUE ISTO GUARDA ──

   `PERMISSOES` é a lista do HUB. As do Flow moram em `PERMISSOES_FLOW`. Quem
   precisa de "tudo que um cargo guarda" tem de percorrer as duas — e a
   distração de percorrer só a primeira aconteceu TRÊS vezes, em três arquivos,
   com sintomas diferentes e a mesma causa:

     1. Os selos da lista de cargos. O Administrador aparecia com 8 permissões
        em vez de 14, e um cargo só-Flow saía rotulado "Sem permissões". Lido de
        fora, parecia que marcar "Validar (Financeiro)" não estava salvando.

     2. O FORMULÁRIO de edição. Reabrir um cargo mostrava as caixas do Flow
        desmarcadas, com os valores gravados no banco. Este é o pior dos três,
        porque não só mostra errado: o auto-save manda o form inteiro a cada
        clique, então a caixa seguinte APAGAVA de verdade o que a tela tinha
        mentido não existir.

     3. "O que o seu cargo permite", em Meus dados. Uma quarta cópia da lista,
        escrita à mão, que simplesmente não mencionava o módulo.

   Três vezes é padrão, não descuido. `TODAS_AS_PERMISSOES` existe para ser o
   nome difícil de esquecer, e estes testes existem para a quarta vez falhar
   aqui em vez de na conta de um cliente.
   ──────────────────────────────────────────────────────────────────────────── */

const CHAVES_DO_FLOW = [
  "acessarFlow", "gerenciarNegocios", "gerenciarContratos",
  "validarJuridico", "validarFinanceiro", "verComissoes", "gerenciarCaptacao",
];

test("as sete permissões do Flow existem e estão fora da lista do Hub", () => {
  assert.deepEqual(PERMISSOES_FLOW.map((p) => p.key).sort(), [...CHAVES_DO_FLOW].sort());
  for (const chave of CHAVES_DO_FLOW) {
    assert.ok(
      !PERMISSOES.some((p) => p.key === chave),
      `${chave} não pode estar na lista do Hub — a separação é o que permite escondê-las de quem não contratou`,
    );
  }
});

test("TODAS_AS_PERMISSOES é a soma das duas, sem faltar nem repetir", () => {
  const chaves = TODAS_AS_PERMISSOES.map((p) => p.key);
  assert.equal(chaves.length, PERMISSOES.length + PERMISSOES_FLOW.length);
  assert.equal(new Set(chaves).size, chaves.length, "chave repetida");
  for (const chave of CHAVES_DO_FLOW) assert.ok(chaves.includes(chave), `faltou ${chave}`);
});

test("um cargo em branco zera as do Flow também", () => {
  /* Caixa controlada que começa `undefined` vira não-controlada, e o React
     reclama a cada clique. Pior: o servidor grava `undefined` como false, então
     o descuido some sem deixar rastro. */
  const vazio = cargoVazio();
  for (const p of TODAS_AS_PERMISSOES) {
    assert.equal(vazio[p.key], false, `${p.key} deveria nascer false, veio ${vazio[p.key]}`);
  }
});

test("o form de edição carrega TODAS as permissões do cargo", () => {
  /* O defeito nº 2, no formato em que ele acontece: montar o form percorrendo
     uma lista incompleta. Aqui o teste é sobre o CÓDIGO, e não sobre o render,
     porque o estrago não se vê na tela — ele aparece no clique seguinte.

     `TODAS_AS_PERMISSOES` no arquivo é a prova de que o laço não voltou a
     percorrer só o Hub. */
  const tela = fs.readFileSync("src/pages/CargosPage.jsx", "utf8");
  assert.match(
    tela,
    /for \(const p of TODAS_AS_PERMISSOES\) f\[p\.key\] = Boolean/,
    "abrirEditar precisa percorrer a lista COMPLETA, senão o auto-save apaga as do Flow",
  );
  assert.ok(
    !/for \(const p of PERMISSOES\)/.test(tela),
    "voltou a percorrer só a lista do Hub",
  );
});

test('"O que o seu cargo permite" não tem lista própria', () => {
  /* O defeito nº 3. Uma lista escrita à mão ali dentro é indistinguível de
     código correto ao ler — só o Flow revelou que ela existia. */
  const modal = fs.readFileSync("src/components/ModaisDoPerfil.jsx", "utf8");
  assert.match(modal, /TODAS_AS_PERMISSOES/, "precisa ler do catálogo");
  assert.ok(
    !/\["gerenciarImoveis", "Gerenciar imóveis"\]/.test(modal),
    "a lista escrita à mão voltou",
  );
});

/* ── O grupo do Flow na grade ─────────────────────────────────────────────── */

test("sem Flow contratado, a conta não vê nenhuma caixa do módulo", () => {
  /* Oferecer o que a conta não tem produz a pior conversa possível com o
     suporte: "marquei e não funciona". */
  const html = renderToStaticMarkup(
    <GradeDePermissoes plano="PREMIUM" valores={cargoVazio()} aoAlternar={() => {}} temFlow={false} />,
  );
  assert.ok(!html.includes("Omnimob Flow"), "o grupo do Flow apareceu sem o módulo");
  assert.ok(!html.includes("Validar (Financeiro)"));
});

test("com Flow, a porta é um interruptor e as outras seis são caixas", () => {
  const grupos = gruposDePermissao("PREMIUM", { temFlow: true });
  const doFlow = grupos.find((g) => g.porta);
  assert.ok(doFlow, "o grupo do Flow precisa declarar a porta");
  assert.equal(doFlow.porta.key, PORTA_DO_FLOW.key);

  /* `acessarFlow` NÃO pode aparecer duas vezes — como interruptor e como caixa.
     Dois controles para o mesmo campo é o defeito, não a redundância. */
  assert.ok(
    !doFlow.itens.some((p) => p.key === "acessarFlow"),
    "a porta não pode continuar entre as caixas do grupo",
  );
  assert.equal(doFlow.itens.length, 6);
});

test("porta fechada desabilita as seis de dentro, sem apagar os valores", () => {
  /* Um cargo com "Gerenciar Negócios" ligado e o acesso ao módulo desligado é
     poder sobre uma coisa que a pessoa não alcança — o estado incoerente que a
     grade oferecia quando `acessarFlow` era uma caixa entre as outras.

     Desabilitar e NÃO apagar: religar tem de devolver o arranjo anterior em vez
     de obrigar a remarcar tudo. */
  const valores = { ...cargoVazio(), gerenciarNegocios: true, acessarFlow: false };
  const html = renderToStaticMarkup(
    <GradeDePermissoes plano="PREMIUM" valores={valores} aoAlternar={() => {}} temFlow />,
  );

  /* O corte é no título do GRUPO ("No Omniflow"), que é o que separa as seis
     caixas do módulo das do Hub. Ele é texto de tela e já mudou uma vez, com o
     rebrand de "Omnimob Flow" para "Omniflow" — se mudar de novo, este teste
     falha aqui, achando zero caixas, e não em silêncio. */
  const marcador = "No Omniflow";
  const inicio = html.indexOf(marcador);
  assert.ok(inicio >= 0, `não achei o grupo "${marcador}" na grade`);
  const grade = html.slice(inicio);
  const caixas = [...grade.matchAll(/<input type="checkbox"[^>]*>/g)].map((m) => m[0]);
  const daGrade = caixas.filter((c) => !c.includes('class="sw"'));
  assert.ok(daGrade.length >= 6, `esperava as seis caixas, achei ${daGrade.length}`);
  for (const c of daGrade) {
    assert.match(c, /disabled/, "com a porta fechada, nenhuma das seis pode ser clicável");
  }
  // O valor continua lá: a caixa está marcada, só não é editável.
  assert.ok(daGrade.some((c) => c.includes("checked")), "os valores não podem ser apagados");
});

test("porta aberta libera as seis", () => {
  const valores = { ...cargoVazio(), acessarFlow: true };
  const html = renderToStaticMarkup(
    <GradeDePermissoes plano="PREMIUM" valores={valores} aoAlternar={() => {}} temFlow />,
  );
  /* O corte é no título do GRUPO ("No Omniflow"), que é o que separa as seis
     caixas do módulo das do Hub. Ele é texto de tela e já mudou uma vez, com o
     rebrand de "Omnimob Flow" para "Omniflow" — se mudar de novo, este teste
     falha aqui, achando zero caixas, e não em silêncio. */
  const marcador = "No Omniflow";
  const inicio = html.indexOf(marcador);
  assert.ok(inicio >= 0, `não achei o grupo "${marcador}" na grade`);
  const grade = html.slice(inicio);
  const daGrade = [...grade.matchAll(/<input type="checkbox"[^>]*>/g)]
    .map((m) => m[0]).filter((c) => !c.includes('class="sw"'));
  assert.ok(daGrade.every((c) => !c.includes("disabled")), "com a porta aberta, todas respondem");
});

test("a prévia do cargo mostra a porta com ✓ ou ✕, e nada para clicar", () => {
  /* No cadastro de usuário a mesma grade vira leitura. Rótulo sem controle é
     rótulo apontando para nada, e o leitor de tela anuncia um campo que não
     existe. */
  const html = renderToStaticMarkup(
    <GradeDePermissoes plano="PREMIUM" valores={{ ...cargoVazio(), acessarFlow: true }}
      aoAlternar={() => {}} temFlow somenteLeitura />,
  );
  assert.ok(!html.includes("<input"), "a prévia não pode ter controle nenhum");
  assert.match(html, /perm-porta is-previa/);
  assert.match(html, /✓/);
});
