import test from "node:test";
import assert from "node:assert/strict";
import {
  ACOES, mapaDeAtalhos, telaDosAtalhos, conflitosDe, acoesConfiguraveis,
  teclaValida, apenasMudancas,
} from "../src/utils/atalhos.js";

const ADMIN = {
  acessarPainel: true, gerenciarImoveis: true, verRelatorios: true, gerenciarClientes: true,
  gerenciarUsuarios: true, gerenciarCargos: true, editarPagina: true, verConfiguracoes: true,
  verAuditoria: true, publicarRedes: true, verPainelGestor: true,
};

test("o padrão de fábrica não tem conflito", () => {
  assert.deepEqual(conflitosDe({}, ADMIN), [], "duas ações na mesma tecla já de fábrica");
});

test("a mesma tecla pode significar coisas diferentes em telas diferentes", () => {
  const noDash = mapaDeAtalhos({ tela: "dashboard", cargo: ADMIN });
  const nosRel = mapaDeAtalhos({ tela: "relatorios", cargo: ADMIN });
  assert.equal(noDash.get("1").id, "dashboard.imoveis");
  assert.equal(nosRel.get("1").id, "relatorios.leads");
});

test("o cargo filtra: sem a permissão, a tecla não existe", () => {
  const mapa = mapaDeAtalhos({ tela: "dashboard", cargo: { acessarPainel: true } });
  assert.equal(mapa.get("1"), undefined, "atalho para tela proibida é atalho quebrado");
  assert.equal(mapa.size, 1, "só sobra o global de novo registro");
});

test("a escolha da pessoa vence a da imobiliária, que vence o padrão", () => {
  const soPadrao = mapaDeAtalhos({ tela: "dashboard", cargo: ADMIN });
  assert.equal(soPadrao.get("1").id, "dashboard.imoveis");

  const comTenant = mapaDeAtalhos({
    tela: "dashboard", cargo: ADMIN,
    doTenant: { "dashboard.imoveis": "q" },
  });
  assert.equal(comTenant.get("q").id, "dashboard.imoveis");
  assert.equal(comTenant.get("1"), undefined);

  const comUsuario = mapaDeAtalhos({
    tela: "dashboard", cargo: ADMIN,
    doTenant: { "dashboard.imoveis": "q" },
    doUsuario: { "dashboard.imoveis": "j" },
  });
  assert.equal(comUsuario.get("j").id, "dashboard.imoveis");
  assert.equal(comUsuario.get("q"), undefined, "a da imobiliária não pode sobreviver junto");
});

test("string vazia é uma escolha: desligar o atalho", () => {
  const mapa = mapaDeAtalhos({
    tela: "dashboard", cargo: ADMIN, doUsuario: { "dashboard.imoveis": "" },
  });
  assert.equal(mapa.get("1"), undefined, "vazio não pode cair de volta no padrão");
});

test("o atalho global vale em qualquer tela", () => {
  for (const tela of ["dashboard", "inicio", "relatorios", "imoveis"]) {
    const mapa = mapaDeAtalhos({ tela, cargo: ADMIN });
    assert.equal(mapa.get("n")?.id, "global.novo", `sumiu em ${tela}`);
  }
});

test("conflito é detectado antes de gravar", () => {
  /* Duas ações da MESMA tela na mesma tecla. */
  const c = conflitosDe({ "dashboard.portfolio": "1" }, ADMIN);
  assert.equal(c.length, 1);
  assert.equal(c[0].tecla, "1");
  assert.deepEqual(c[0].acoes.sort(), ["dashboard.imoveis", "dashboard.portfolio"]);
});

test("o atalho global colide com TODAS as telas, não só com uma", () => {
  /* `n` global contra um `n` de tela: se a checagem olhasse só a tela da ação,
     este par passaria e a tecla ficaria ambígua no Dashboard. */
  const c = conflitosDe({ "dashboard.imoveis": "n" }, ADMIN);
  assert.ok(c.some((x) => x.tecla === "n" && x.tela === "dashboard"));
});

test("só teclas de letra ou dígito", () => {
  for (const boa of ["a", "Z", "1", "9"]) assert.ok(teclaValida(boa), boa);
  /* F5, Ctrl e companhia têm dono: deixar escolher é deixar quebrar o painel
     sem entender por quê. */
  for (const ruim of ["F5", "Enter", "Escape", "", " ", "ç", "Control", null]) {
    assert.ok(!teclaValida(ruim), String(ruim));
  }
});

test("tecla inválida na configuração é ignorada, não derruba o mapa", () => {
  const mapa = mapaDeAtalhos({ tela: "dashboard", cargo: ADMIN, doUsuario: { "dashboard.imoveis": "F5" } });
  assert.equal(mapa.get("1"), undefined);
  assert.equal(mapa.get("f5"), undefined);
  assert.ok(mapa.size > 0, "o resto continua funcionando");
});

test("a rota vira tela", () => {
  assert.equal(telaDosAtalhos("/"), "dashboard");
  assert.equal(telaDosAtalhos("/inicio"), "inicio");
  assert.equal(telaDosAtalhos("/relatorios"), "relatorios");
  assert.equal(telaDosAtalhos("/imoveis/portfolio"), null, "tela sem atalho não inventa");
});

test("a configuração só oferece o que o cargo alcança", () => {
  const grupos = acoesConfiguraveis({ acessarPainel: true, gerenciarImoveis: true });
  const ids = [...grupos.values()].flat().map((a) => a.id);
  assert.ok(ids.includes("dashboard.imoveis"));
  assert.ok(!ids.includes("dashboard.cargos"), "não oferece atalho para tela que ela não abre");
  assert.ok(ids.includes("global.novo"));
});

test("só o que difere do padrão é gravado", () => {
  const salvo = apenasMudancas({ "dashboard.imoveis": "1", "dashboard.portfolio": "j" });
  assert.deepEqual(salvo, { "dashboard.portfolio": "j" }, "gravar o padrão o congelaria");
});

test("nenhuma ação destrutiva tem atalho", () => {
  /* Atalho é disparado por engano com muito mais facilidade que um clique. */
  const proibidas = /excluir|deletar|remover|apagar|cancelar/i;
  for (const a of ACOES) {
    assert.ok(!proibidas.test(a.id) && !proibidas.test(a.rotulo), `${a.id} é destrutiva`);
  }
});
