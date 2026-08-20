import test from "node:test";
import assert from "node:assert/strict";

import { cargoRouter } from "../src/routes/cargoRoutes.js";
import { PERMISSOES } from "../src/services/cargosPadrao.js";
import {
  prisma, limparRestos, criarImobiliariaDeTeste, apagarImobiliaria, subirApi,
} from "./helpers.js";

/* ────────────────────────────────────────────────────────────────────────────
   Toda permissão da lista canônica precisa ir e voltar pela rota de cargos.

   ── O BUG QUE ORIGINOU ESTE ARQUIVO ──

   `cargoRoutes.js` mantinha uma CÓPIA da lista de permissões, escrita à mão. A
   canônica (`services/cargosPadrao.js`) ganhou `verAuditoria`; a cópia não. E o
   laço que grava é `for (const p de PERMISSOES)` — um nome fora da lista
   simplesmente não é copiado do corpo da requisição.

   O defeito era do pior tipo: silencioso e convincente. A tela desenhava a
   caixa (ela lê a lista certa), o clique ia para o servidor, o servidor
   respondia 200 com o cargo — e nada tinha mudado. Reabrindo a tela, a
   permissão estava marcada de novo, "magicamente". Nenhum erro, em lugar
   nenhum.

   Na CRIAÇÃO era pior: lá o laço é `data[p] = Boolean(perms[p])` sem checar se
   veio, então o cargo novo nascia sem a permissão qualquer que fosse a caixa.

   ── POR QUE O TESTE É GENÉRICO ──

   Verificar `verAuditoria` resolveria o caso de ontem e nada do de amanhã. O
   que quebra é sempre a permissão RECÉM-ADICIONADA, e um teste que a nomeia só
   é escrito depois do estrago. Percorrendo a lista canônica, a permissão nova
   entra sob teste no mesmo commit em que nasce.
   ──────────────────────────────────────────────────────────────────────────── */

let api;
let A;

test.before(async () => {
  await limparRestos();
  api = await subirApi({ "/api/cargos": cargoRouter });
  A = await criarImobiliariaDeTeste();
});

test.after(async () => {
  await api?.fechar();
  if (A) await apagarImobiliaria(A.tenant.id);
  await limparRestos();
  await prisma.$disconnect();
});

/* `verConfiguracoes` fica de fora, e não por conveniência: a rota a RECALCULA a
   cada gravação a partir do nome do cargo, ignorando o corpo de propósito — é a
   chave da casa, e quem a concede é ser o Administrador, não um PUT. Incluí-la
   aqui testaria o oposto da regra que ela tem. */
const GOVERNADAS_PELO_CORPO = PERMISSOES.filter((p) => p !== "verConfiguracoes");

test("cada permissão da lista canônica é gravada quando ligada", async () => {
  const cargo = await prisma.cargo.create({
    data: { tenantId: A.tenant.id, descricao: "Cargo de prova (ligar)" },
  });

  const corpo = {};
  for (const p of GOVERNADAS_PELO_CORPO) corpo[p] = true;

  const r = await api.comoTenant(A).put(`/api/cargos/${cargo.id}`, corpo);
  assert.equal(r.status, 200);

  const salvo = await prisma.cargo.findUnique({ where: { id: cargo.id } });
  const naoGravadas = GOVERNADAS_PELO_CORPO.filter((p) => salvo[p] !== true);
  assert.deepEqual(
    naoGravadas, [],
    `estas permissões foram enviadas como true e não chegaram ao banco: ${naoGravadas.join(", ")}`,
  );
});

test("cada permissão da lista canônica é REMOVIDA quando desligada", async () => {
  /* O sentido que o bug tinha na prática. Quem desmarca uma caixa e a vê
     voltar marcada não desconfia do servidor — desconfia de si mesmo, e tenta
     de novo. */
  const ligadas = {};
  for (const p of GOVERNADAS_PELO_CORPO) ligadas[p] = true;

  const cargo = await prisma.cargo.create({
    data: { tenantId: A.tenant.id, descricao: "Cargo de prova (desligar)", ...ligadas },
  });

  const corpo = {};
  for (const p of GOVERNADAS_PELO_CORPO) corpo[p] = false;

  const r = await api.comoTenant(A).put(`/api/cargos/${cargo.id}`, corpo);
  assert.equal(r.status, 200);

  const salvo = await prisma.cargo.findUnique({ where: { id: cargo.id } });
  const teimosas = GOVERNADAS_PELO_CORPO.filter((p) => salvo[p] !== false);
  assert.deepEqual(
    teimosas, [],
    `estas permissões foram desmarcadas e continuaram ligadas: ${teimosas.join(", ")}`,
  );
});

test("o cargo NASCE com as permissões que a tela marcou", async () => {
  const corpo = { descricao: "Cargo de prova (criar)" };
  for (const p of GOVERNADAS_PELO_CORPO) corpo[p] = true;

  const r = await api.comoTenant(A).post("/api/cargos", corpo);
  assert.equal(r.status, 201, `esperava 201, veio ${r.status}`);

  const salvo = await prisma.cargo.findUnique({ where: { id: r.json.id } });
  const perdidas = GOVERNADAS_PELO_CORPO.filter((p) => salvo[p] !== true);
  assert.deepEqual(
    perdidas, [],
    `o cargo nasceu sem estas permissões, que foram marcadas: ${perdidas.join(", ")}`,
  );
});

test("a resposta da rota devolve o cargo com todas as permissões da lista", async () => {
  /* A tela grava e usa a RESPOSTA para atualizar a sessão de quem editou o
     próprio cargo (ver `atualizarSessaoSeProprioCargoFoi`). Uma resposta
     incompleta apagaria da barra lateral um item que continua valendo no
     banco. */
  const r = await api.comoTenant(A).get("/api/cargos");
  assert.equal(r.status, 200);

  const admin = r.json.find((c) => c.id === A.cargoAdmin.id);
  assert.ok(admin, "o cargo de administrador tem que estar na listagem");

  const ausentes = PERMISSOES.filter((p) => admin[p] === undefined);
  assert.deepEqual(ausentes, [], `a resposta não trouxe: ${ausentes.join(", ")}`);
});
