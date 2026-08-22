import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { montarFluxoTour, totalDePassos } from "../src/utils/tourFluxo.js";
import { montarTourDeTela, chavesDasTelas } from "../src/utils/tourTelas.js";

/* ────────────────────────────────────────────────────────────────────────────
   O tour só aponta para o que aquela pessoa consegue ver.

   ── O DEFEITO ──

   O tour global filtrava por ETAPA: quem não gerencia imóveis não vê a etapa de
   imóveis. Isso resolve o caso óbvio e deixa passar o outro — o passo SOLTO,
   dentro de uma etapa que a pessoa vê, cujo alvo depende de outra coisa.

   E o sintoma não é um erro: o tour fica 3,5 segundos parado procurando um
   elemento que nunca vai aparecer, e só então desiste. Com dois ou três passos
   assim ele passa meio minuto apontando para o nada e chega ao fim com cara de
   perdido. Ninguém abre um chamado dizendo "o tour está lento"; a pessoa só
   fecha e não volta.

   ── AS DUAS COISAS QUE ESTE ARQUIVO GUARDA ──

   1. Todo alvo do tour EXISTE no código. Renomear um `data-tour` sem atualizar
      o roteiro é a forma mais fácil de criar um passo morto, e nada mais pega.

   2. Nenhum passo aponta para um elemento que a permissão do cargo esconde.
   ──────────────────────────────────────────────────────────────────────────── */

function arquivosJs(dir, saida = []) {
  for (const nome of fs.readdirSync(dir)) {
    const p = path.join(dir, nome);
    if (fs.statSync(p).isDirectory()) arquivosJs(p, saida);
    else if (/\.jsx?$/.test(nome)) saida.push(p);
  }
  return saida;
}

const FONTE = arquivosJs("src").map((f) => fs.readFileSync(f, "utf8")).join("\n");

const ADMIN = {
  acessarPainel: true, gerenciarImoveis: true, verRelatorios: true, gerenciarClientes: true,
  gerenciarUsuarios: true, gerenciarCargos: true, editarPagina: true, verConfiguracoes: true,
  verAuditoria: true, publicarRedes: true, verPainelGestor: true,
};

/* Os alvos que só existem na tela quando o cargo tem a permissão. São os itens
   do menu lateral e o cabeçalho clicável — todos condicionais em `AdminLayout`.
   Um alvo fora desta lista é incondicional e vale para qualquer cargo. */
const EXIGE = {
  "nav-imoveis-novo": "gerenciarImoveis",
  "nav-imoveis-portfolio": "gerenciarImoveis",
  "nav-rel-leads": "verRelatorios",
  "nav-config-perfil": "verConfiguracoes",
  "nav-editar-pagina": "editarPagina",
  "gestor-saudacao": "verPainelGestor",
  "gestor-indicadores": "verPainelGestor",
  "gestor-pendencias": "verPainelGestor",
  "gestor-equipe": "verPainelGestor",
};

function seletoresDe(passo) {
  return [passo.alvo, passo.aguardarAlvo, passo.pularSe].filter(Boolean);
}

function alvosDoFluxo(cargo) {
  const fora = [];
  for (const etapa of montarFluxoTour({ cargo, tenantSlug: "x" })) {
    for (const passo of etapa.passos) {
      for (const sel of seletoresDe(passo)) fora.push({ etapa: etapa.chave, sel });
    }
  }
  return fora;
}

test("todo alvo do tour existe no código", () => {
  const alvos = new Set(alvosDoFluxo(ADMIN).map((a) => a.sel));
  for (const plano of ["BASICO", "PROFISSIONAL", "PREMIUM"]) {
    for (const chave of chavesDasTelas()) {
      const tela = montarTourDeTela(chave.replace("tela:", ""), { plano });
      for (const passo of tela?.passos || []) seletoresDe(passo).forEach((s) => alvos.add(s));
    }
  }

  const orfaos = [];
  for (const sel of alvos) {
    const m = sel.match(/data-tour="([^"]+)"/);
    if (!m) continue; // seletor de classe/atributo comum, não é âncora de tour
    if (!FONTE.includes(`data-tour="${m[1]}"`)) orfaos.push(sel);
  }
  assert.deepEqual(orfaos, [], "o tour procura âncoras que não existem mais");
});

test("nenhum passo aponta para o que a permissão esconde", () => {
  const CARGOS = {
    "só imóveis": { acessarPainel: true, gerenciarImoveis: true },
    "só relatórios": { acessarPainel: true, verRelatorios: true },
    "só a vitrine": { acessarPainel: true, editarPagina: true },
    "sem nada além do painel": { acessarPainel: true },
    administrador: ADMIN,
  };

  for (const [nome, cargo] of Object.entries(CARGOS)) {
    for (const { etapa, sel } of alvosDoFluxo(cargo)) {
      const m = sel.match(/data-tour="([^"]+)"/);
      const exigida = m && EXIGE[m[1]];
      if (!exigida) continue;
      assert.ok(
        cargo[exigida],
        `cargo "${nome}": a etapa "${etapa}" aponta para ${sel}, que exige ${exigida}`,
      );
    }
  }
});

test("quem não tem o Painel do Gestor não recebe a etapa dele", () => {
  const sem = montarFluxoTour({ cargo: { acessarPainel: true }, tenantSlug: "x" });
  assert.ok(!sem.some((e) => e.chave === "gestor"));

  const com = montarFluxoTour({ cargo: ADMIN, tenantSlug: "x" });
  assert.equal(com[0].chave, "gestor", "para quem tem, é a PRIMEIRA etapa — é onde ele aterrissa");
});

test("etapa sem passo nenhum não vira uma parada vazia", () => {
  for (const cargo of [{ acessarPainel: true }, ADMIN]) {
    for (const etapa of montarFluxoTour({ cargo, tenantSlug: "x" })) {
      assert.ok(etapa.passos.length > 0, `a etapa "${etapa.chave}" ficou sem passos`);
    }
  }
});

test("o tour fecha para qualquer cargo", () => {
  /* Os dois passos finais (Ajuda e encerramento) vão na última etapa que
     sobrou. Um cargo mínimo não pode terminar o tour sem eles. */
  for (const cargo of [{ acessarPainel: true }, { acessarPainel: true, gerenciarImoveis: true }, ADMIN]) {
    const fluxo = montarFluxoTour({ cargo, tenantSlug: "x" });
    const ultima = fluxo[fluxo.length - 1];
    const alvos = ultima.passos.map((p) => p.alvo);
    assert.ok(alvos.includes('[data-tour="ajuda"]'), "falta o passo da Ajuda");
    assert.ok(alvos.includes('[data-tour="perfil"]'), "falta o encerramento");
  }
});

/* ────────────────────────────────────────────────────────────────────────────
   O NÚMERO ANUNCIADO É O NÚMERO ENTREGUE.

   O convite do primeiro acesso promete "N paradas curtas" e o contador do tour
   caminha até N/N. São dois textos, e o que os une é `totalDePassos` — antes
   cada um fazia o próprio `reduce`, igual por coincidência e livre para
   divergir.

   O que estes testes guardam não é o valor de N (ele muda toda vez que uma
   parada nova entra no roteiro, e travá-lo só faria o teste pedir manutenção),
   e sim a RELAÇÃO: N sai do que aquele cargo abre, e cresce junto com isso.
   ──────────────────────────────────────────────────────────────────────────── */

const PERMISSOES_QUE_ABREM_ETAPA = [
  "verPainelGestor", "gerenciarImoveis", "verRelatorios", "gerenciarClientes",
  "gerenciarUsuarios", "gerenciarCargos", "verAuditoria", "verConfiguracoes",
  "editarPagina",
];

test("o número de paradas sai do cargo, não de uma constante", () => {
  const minimo = totalDePassos(montarFluxoTour({ cargo: { acessarPainel: true }, tenantSlug: "x" }));
  const cheio = totalDePassos(montarFluxoTour({ cargo: ADMIN, tenantSlug: "x" }));

  assert.ok(minimo > 0, "um cargo mínimo não pode receber um tour de zero paradas");
  assert.ok(
    cheio > minimo,
    `o Administrador abre mais telas e tem que ter mais paradas (${cheio} vs ${minimo})`,
  );
});

test("cada permissão que abre uma tela acrescenta paradas", () => {
  const base = { acessarPainel: true };
  const semNada = totalDePassos(montarFluxoTour({ cargo: base, tenantSlug: "x" }));

  for (const chave of PERMISSOES_QUE_ABREM_ETAPA) {
    const com = totalDePassos(montarFluxoTour({ cargo: { ...base, [chave]: true }, tenantSlug: "x" }));
    assert.ok(
      com > semNada,
      `liberar ${chave} tem que aumentar o tour (${com} não é maior que ${semNada})`,
    );
  }
});

test("o total é a soma das etapas — a mesma conta que o contador do tour faz", () => {
  /* `tg-contador` mostra `passoGlobal/totalGlobal`, e o último passo tem que
     cair exatamente no total. Somar por fora aqui é o que prova que a função
     não está descontando nada pelas costas. */
  for (const cargo of [{ acessarPainel: true }, { acessarPainel: true, gerenciarImoveis: true }, ADMIN]) {
    const fluxo = montarFluxoTour({ cargo, tenantSlug: "x" });
    const naoMao = fluxo.reduce((n, e) => n + e.passos.length, 0);
    assert.equal(totalDePassos(fluxo), naoMao);

    // O último passo da última etapa é o N-ésimo, e não o (N-1)-ésimo.
    const ultimaEtapa = fluxo.length - 1;
    const anteriores = fluxo.slice(0, ultimaEtapa).reduce((n, e) => n + e.passos.length, 0);
    const ultimoPasso = anteriores + fluxo[ultimaEtapa].passos.length;
    assert.equal(ultimoPasso, totalDePassos(fluxo));
  }
});

test("fluxo vazio ou torto não derruba a conta", () => {
  // O convite monta antes de o fluxo existir em alguns quadros; `0` é a
  // resposta certa, e o modal cai no "Algumas paradas curtas".
  assert.equal(totalDePassos([]), 0);
  assert.equal(totalDePassos(undefined), 0);
  assert.equal(totalDePassos([{ chave: "x" }]), 0);
});
