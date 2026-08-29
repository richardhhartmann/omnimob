import test, { after } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import {
  prisma, limparRestos, criarImobiliariaDeTeste, apagarImobiliaria, subirApi,
} from "./helpers.js";
import { usuarioRouter } from "../src/routes/usuarioRoutes.js";
import { cargoRouter } from "../src/routes/cargoRoutes.js";
import { CARGO_ADMIN } from "../src/services/cargosPadrao.js";

/* ── A porta que só se descobre trancada do lado de fora ─────────────────────

   `verConfiguracoes` é DERIVADA do nome do cargo (ver `cargoRoutes`): não
   existe caixa para marcá-la, e não há como devolvê-la pela interface. Então
   uma conta que fica sem nenhum Administrador ativo perde Configurações e a
   gestão de cargos para sempre — plano, cobrança, domínio e permissões, todos
   fora de alcance, sem nenhuma tela dizendo por quê.

   A checagem que existia aqui olhava `gerenciarUsuarios`, e ela NÃO fecha esse
   buraco: o cargo Gerente também tem essa permissão. Dava para apagar o último
   Administrador, continuar com "um gestor", e descobrir depois.
   ────────────────────────────────────────────────────────────────────────── */

let api;

test.before(async () => {
  await limparRestos();
  api = await subirApi({ "/api/usuarios": usuarioRouter, "/api/cargos": cargoRouter });
});

after(async () => {
  await api?.fechar?.();
  await prisma.$disconnect();
});

/** Um segundo usuário no cargo Administrador — e a sessão dele.
 *
 *  A sessão importa: o andaime autentica justamente o admin ORIGINAL, e apagar
 *  a si mesmo já era recusado antes. Sem entrar como outra pessoa, o teste
 *  passaria pela recusa errada e não guardaria nada. */
async function criarOutroAdmin(A, sufixo = "2") {
  const usuario = await prisma.usuario.create({
    data: {
      login: `admin-extra-${sufixo}-${A.slug}`,
      nome: "Outro Administrador",
      senha: "x",
      tenantId: A.tenant.id,
      cargoCodigo: A.cargoAdmin.id,
      ativo: true,
    },
  });
  const token = jwt.sign(
    { userId: usuario.id, tenantId: A.tenant.id, cargoCodigo: A.cargoAdmin.id },
    process.env.JWT_SECRET || "omnimob-dev-secret",
    { expiresIn: "10m" },
  );
  return { usuario, token };
}

test("o cargo Administrador não pode ser excluído", async () => {
  const A = await criarImobiliariaDeTeste();
  const como = api.comoTenant({ token: A.token, slug: A.slug });

  const r = await como.del(`/api/cargos/${A.cargoAdmin.id}`);
  assert.equal(r.status, 400);
  assert.match(r.json.error, /Administrador/i);

  await apagarImobiliaria(A.tenant.id);
});

test("a conta de Administrador que nasceu com a imobiliária não é excluída", async () => {
  /* O cenário do pedido: OUTRO administrador tentando apagar o administrador.
     Ter um segundo admin ativo derruba a regra do "último" — o que segura aqui
     é ser a conta original. */
  const A = await criarImobiliariaDeTeste();
  const outro = await criarOutroAdmin(A);
  /* Entrando COMO o segundo administrador — é ele quem tenta apagar o primeiro. */
  const como = api.comoTenant({ token: outro.token, slug: A.slug });

  const alvo = await prisma.usuario.findFirst({
    where: { tenantId: A.tenant.id, cargo: { descricao: CARGO_ADMIN } },
    orderBy: { createdAt: "asc" },
  });
  assert.notEqual(alvo.id, outro.usuario.id, "o alvo tem de ser a conta original");

  const r = await como.del(`/api/usuarios/${alvo.id}/permanente`);
  assert.equal(r.status, 400);
  assert.match(r.json.error, /nasceu com a imobiliária/i);

  /* E continua lá. Uma recusa que responde 400 e apaga assim mesmo seria pior
     do que não ter recusa nenhuma. */
  assert.ok(await prisma.usuario.findUnique({ where: { id: alvo.id } }));

  await apagarImobiliaria(A.tenant.id);
});

test("desativar tranca a mesma porta que excluir, e é recusado igual", async () => {
  const A = await criarImobiliariaDeTeste();
  const outro = await criarOutroAdmin(A, "3");
  const como = api.comoTenant({ token: outro.token, slug: A.slug });

  const primeiro = await prisma.usuario.findFirst({
    where: { tenantId: A.tenant.id, cargo: { descricao: CARGO_ADMIN } },
    orderBy: { createdAt: "asc" },
  });

  const r = await como.del(`/api/usuarios/${primeiro.id}`);
  assert.equal(r.status, 400, "desativado não entra: a conta fica sem admin do mesmo jeito");

  const depois = await prisma.usuario.findUnique({ where: { id: primeiro.id } });
  assert.equal(depois.ativo, true);

  await apagarImobiliaria(A.tenant.id);
});

test("um administrador acrescentado depois PODE ser removido", async () => {
  /* A trava não pode virar uma conta eterna: quem entra na equipe e sai precisa
     poder ser removido, e é por isso que a regra mira a conta ORIGINAL e o
     ÚLTIMO admin — não "qualquer administrador". */
  const A = await criarImobiliariaDeTeste();
  const extra = await criarOutroAdmin(A, "4");
  const como = api.comoTenant({ token: A.token, slug: A.slug });

  const r = await como.del(`/api/usuarios/${extra.usuario.id}/permanente`);
  assert.equal(r.status, 204, JSON.stringify(r.json));
  assert.equal(await prisma.usuario.findUnique({ where: { id: extra.usuario.id } }), null);

  await apagarImobiliaria(A.tenant.id);
});
