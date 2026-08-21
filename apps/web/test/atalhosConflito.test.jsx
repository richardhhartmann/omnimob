import test from "node:test";
import assert from "node:assert/strict";
import { atribuirTecla, mapaDeAtalhos, ACOES_POR_ID } from "../src/utils/atalhos.js";

const ADMIN = {
  acessarPainel: true, gerenciarImoveis: true, verRelatorios: true, gerenciarClientes: true,
  gerenciarUsuarios: true, gerenciarCargos: true, editarPagina: true, verConfiguracoes: true,
  verAuditoria: true, publicarRedes: true, verPainelGestor: true,
};

/* ────────────────────────────────────────────────────────────────────────────
   Sem botão de salvar, uma configuração ambígua não pode existir nem por um
   instante — ela seria gravada. Por isso escolher uma tecla ocupada TIRA dela o
   dono anterior, em vez de recusar.
   ──────────────────────────────────────────────────────────────────────────── */

test("a tecla é tomada de quem a tinha, e a tela sabe de quem", () => {
  const r = atribuirTecla({}, {}, ADMIN, "dashboard.portfolio", "1");
  assert.equal(r.proximo["dashboard.portfolio"], "1");
  /* Vazio explícito, e não `delete`: apagar a chave faria a ação cair de volta
     no padrão — que é exatamente a tecla que acabou de ser tomada. */
  assert.equal(r.proximo["dashboard.imoveis"], "", "quem tinha o 1 fica sem tecla");
  assert.equal(r.roubadaDe, "Gerenciar imóveis");
});

test("o resultado nunca fica ambíguo", () => {
  const r = atribuirTecla({}, {}, ADMIN, "dashboard.portfolio", "1");
  const mapa = mapaDeAtalhos({ tela: "dashboard", cargo: ADMIN, doUsuario: r.proximo });
  assert.equal(mapa.get("1").id, "dashboard.portfolio", "uma tecla, um dono");
});

test("telas diferentes não disputam entre si", () => {
  /* `1` em Relatórios não pode tirar o `1` do Dashboard: são telas distintas. */
  const r = atribuirTecla({}, {}, ADMIN, "relatorios.mensal", "1");
  assert.equal(r.roubadaDe, "Leads", "só disputa dentro da própria tela");
  assert.equal(r.proximo["dashboard.imoveis"], undefined, "o Dashboard fica intacto");
});

test("a ação global disputa com TODAS as telas", () => {
  const r = atribuirTecla({}, {}, ADMIN, "global.novo", "1");
  assert.ok(r.roubadaDe, "a tecla global tomada de alguém precisa avisar");
});

test("desligar não rouba de ninguém", () => {
  const r = atribuirTecla({}, {}, ADMIN, "dashboard.imoveis", "");
  assert.equal(r.roubadaDe, null);
  assert.equal(r.proximo["dashboard.imoveis"], "");
});

test("o roubo respeita o cargo: não mexe em ação que a pessoa não tem", () => {
  const soImoveis = { acessarPainel: true, gerenciarImoveis: true };
  const r = atribuirTecla({}, {}, soImoveis, "dashboard.imoveis", "3");
  /* `3` é de Relatórios, que este cargo não alcança — não há de quem roubar. */
  assert.equal(r.roubadaDe, null);
  assert.equal(r.proximo["dashboard.relatorios"], undefined);
});

test("herdado também perde a tecla", () => {
  /* A imobiliária pôs `q` em Gerenciar imóveis; a pessoa escolhe `q` para
     Portfólio. O herdado precisa ser explicitamente desligado, senão as duas
     ficam com `q`. */
  const herdados = { "dashboard.imoveis": "q" };
  const r = atribuirTecla({}, herdados, ADMIN, "dashboard.portfolio", "q");
  assert.equal(r.proximo["dashboard.imoveis"], "");
  assert.equal(r.roubadaDe, "Gerenciar imóveis");

  const mapa = mapaDeAtalhos({ tela: "dashboard", cargo: ADMIN, doTenant: herdados, doUsuario: r.proximo });
  assert.equal(mapa.get("q").id, "dashboard.portfolio");
});

test("todo id do catálogo é conhecido", () => {
  /* `atribuirTecla` com id inventado não pode inventar configuração. */
  const r = atribuirTecla({}, {}, ADMIN, "nao.existe", "1");
  assert.deepEqual(r.proximo, {});
  assert.equal(r.roubadaDe, null);
  assert.ok(ACOES_POR_ID["dashboard.imoveis"]);
});
