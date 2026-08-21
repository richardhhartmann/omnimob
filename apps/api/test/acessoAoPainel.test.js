import test from "node:test";
import bcrypt from "bcryptjs";
import assert from "node:assert/strict";

import { cargoRouter } from "../src/routes/cargoRoutes.js";
import {
  prisma, limparRestos, criarImobiliariaDeTeste, apagarImobiliaria, subirApi,
} from "./helpers.js";
import { authRouter } from "../src/routes/authRoutes.js";
import { PERMISSOES } from "../src/services/cargosPadrao.js";

/* ────────────────────────────────────────────────────────────────────────────
   `acessarPainel` não é uma escolha.

   Criar um cargo é dizer que aquelas pessoas entram no painel; a pergunta que
   sobra é O QUE elas alcançam lá dentro.

   Como caixa marcável ela produzia um estado sem sentido — um cargo com quatro
   permissões e a porta fechada — e o sintoma não explicava nada: a pessoa era
   mandada para a vitrine ao entrar, sem uma palavra sobre o porquê.
   ──────────────────────────────────────────────────────────────────────────── */

let api;
let A;

test.before(async () => {
  await limparRestos();
  api = await subirApi({ "/api/cargos": cargoRouter, "/api/auth": authRouter });
  A = await criarImobiliariaDeTeste();
});

test.after(async () => {
  await api?.fechar();
  if (A) await apagarImobiliaria(A.tenant.id);
  await limparRestos();
  await prisma.$disconnect();
});

test("não é oferecida como permissão escolhível", () => {
  assert.ok(!PERMISSOES.includes("acessarPainel"), "voltou a ser uma opção");

  /* `verConfiguracoes` CONTINUA na lista, e não é incoerência: ela é escrita
     pelo laço e sobrescrita logo depois por `ehAdministrador`. Quem a esconde
     da pessoa é a lista da TELA (`web/src/utils/permissoesCargo.jsx`).
     `acessarPainel` saiu daqui porque não há nada a derivar — ela é sempre
     true, e mantê-la no laço deixaria um `Boolean(undefined)` gravando false
     por um instante antes da correção. */
  assert.ok(PERMISSOES.includes("verConfiguracoes"));
});

test("cargo novo nasce com acesso ao painel, sem pedir", async () => {
  const r = await api.comoTenant(A).post("/api/cargos", { descricao: "Estagiário zz" });
  assert.equal(r.status, 201);
  assert.equal(r.json.acessarPainel, true, "criar cargo já significa entrar no painel");

  await prisma.cargo.delete({ where: { id: r.json.id } });
});

test("um PUT feito à mão não consegue trancar o cargo para fora", async () => {
  const criado = await api.comoTenant(A).post("/api/cargos", { descricao: "Corretor zz" });

  const r = await api.comoTenant(A).put(`/api/cargos/${criado.json.id}`, { acessarPainel: false });
  assert.equal(r.status, 200);
  assert.equal(r.json.acessarPainel, true, "a porta não pode ser fechada nem por fora da tela");

  const noBanco = await prisma.cargo.findUnique({
    where: { id: criado.json.id },
    select: { acessarPainel: true },
  });
  assert.equal(noBanco.acessarPainel, true);

  await prisma.cargo.delete({ where: { id: criado.json.id } });
});

test("as outras permissões continuam sendo escolha", async () => {
  /* A trava vale para `acessarPainel`, e só. Se ela vazasse para as demais, um
     cargo restrito viraria administrador em silêncio. */
  const r = await api.comoTenant(A).post("/api/cargos", {
    descricao: "Restrito zz",
    verAuditoria: true,
    gerenciarImoveis: false,
  });
  assert.equal(r.json.verAuditoria, true);
  assert.equal(r.json.gerenciarImoveis, false);
  assert.equal(r.json.gerenciarCargos, false);

  await prisma.cargo.delete({ where: { id: r.json.id } });
});

test("a SESSÃO carrega `acessarPainel`, senão a tela despeja a pessoa na vitrine", async () => {
  /* O defeito real: `acessarPainel` saiu de `PERMISSOES` e, com isso, sumiu do
     `cargoDaSessao` — que monta o cargo percorrendo aquela lista. A tela decide
     entre painel e vitrine lendo essa chave.

     O Administrador não sentiu, porque a tela aceita `editarPagina` como
     alternativa. Quem tinha só Relatórios e Auditoria era mandado para a
     vitrine ao entrar, sem explicação. */
  const cargo = await prisma.cargo.create({
    data: {
      tenantId: A.tenant.id,
      descricao: "Restrito de sessao zz",
      verRelatorios: true,
      verAuditoria: true,
      editarPagina: false,
    },
  });
  const senha = "segredo-de-teste-123";
  const usuario = await prisma.usuario.create({
    data: {
      tenantId: A.tenant.id,
      cargoCodigo: cargo.id,
      nome: "Restrito zz",
      login: `zz-restrito-${process.pid}`,
      senha: bcrypt.hashSync(senha, 8),
      ativo: true,
    },
  });

  const r = await fetch(`${api.base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-tenant-slug": A.tenant.slug },
    body: JSON.stringify({ login: usuario.login, senha }),
  });
  assert.equal(r.status, 200);
  const sessao = await r.json();

  assert.equal(sessao.usuario.cargo.acessarPainel, true, "sem isto a tela manda para a vitrine");
  assert.equal(sessao.usuario.cargo.editarPagina, false, "e o cargo continua restrito no resto");
  assert.equal(sessao.usuario.cargo.verAuditoria, true);

  await prisma.usuario.delete({ where: { id: usuario.id } });
  await prisma.cargo.delete({ where: { id: cargo.id } });
});
