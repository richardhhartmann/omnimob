import test, { after } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import {
  prisma, limparRestos, criarImobiliariaDeTeste, apagarImobiliaria, subirApi,
} from "./helpers.js";
import { usuarioRouter } from "../src/routes/usuarioRoutes.js";
import { cargoRouter } from "../src/routes/cargoRoutes.js";
import { CARGO_ADMIN, CHAVES_DA_CASA } from "../src/services/cargosPadrao.js";

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

/* ── AS CHAVES DA CASA NÃO SAEM DO ADMINISTRADOR ─────────────────────────────

   A tela trava as caixas, mas trava é cortesia — quem garante é o servidor, e
   um PUT feito à mão passa por fora da tela inteira.

   O teste afirma a GARANTIA, e não o mecanismo, e a diferença apareceu ao
   escrevê-lo: existem DOIS guardas sobrepostos e eles respondem coisas
   diferentes. Quem edita o PRÓPRIO cargo esbarra em `NAO_REMOVIVEIS_DO_PROPRIO`
   e leva 400; quem edita o Administrador de fora esbarra na derivação e leva
   200 com os valores de volta. Um teste preso a um dos dois passaria a falhar
   no dia em que a ordem mudasse, sem nada de errado ter acontecido.

   O que não pode variar é o desfecho: depois da tentativa, as quatro continuam
   ligadas no BANCO. */
test("as chaves da casa nao saem do Administrador, nem por PUT direto", async () => {
  const A = await criarImobiliariaDeTeste();
  const como = api.comoTenant({ token: A.token, slug: A.slug });

  /* PRIMEIRO a auto-cura, que e metade da razao de derivar em vez de recusar.
     O andaime cria um "Administrador" ao qual falta `verPainelGestor` — uma
     linha torta, como as que existem em bancos antigos. Uma gravacao qualquer
     tem de devolver as QUATRO, e nao so a que foi enviada. */
  const cura = await como.put(`/api/cargos/${A.cargoAdmin.id}`, { verCobranca: true });
  assert.equal(cura.status, 200);
  for (const chave of CHAVES_DA_CASA) {
    assert.equal(cura.json[chave], true, `${chave} nao foi curada na gravacao`);
  }

  // E agora a tentativa de tirar as quatro.
  const desligarTudo = {};
  for (const chave of CHAVES_DA_CASA) desligarTudo[chave] = false;

  const r = await como.put(`/api/cargos/${A.cargoAdmin.id}`, desligarTudo);
  assert.ok([200, 400].includes(r.status), `status inesperado: ${r.status}`);
  if (r.status === 200) {
    for (const chave of CHAVES_DA_CASA) {
      assert.equal(r.json[chave], true, `a resposta devolveu ${chave} desligada`);
    }
  }

  const noBanco = await prisma.cargo.findUnique({ where: { id: A.cargoAdmin.id } });
  for (const chave of CHAVES_DA_CASA) {
    assert.equal(noBanco[chave], true, `o banco ficou com ${chave} desligada`);
  }

  await apagarImobiliaria(A.tenant.id);
});

/* O caminho que passa por FORA do guarda do proprio cargo: renomear. Renomear o
   Administrador o rebaixa (a regra e pelo NOME — ver `cargoRoutes`), e renomea-lo
   de volta tem de devolver as chaves sem ninguem marcar caixa nenhuma. E este
   ida-e-volta que prova a DERIVACAO, e nao a recusa. */
test("renomear de volta para Administrador devolve as chaves da casa", async () => {
  const A = await criarImobiliariaDeTeste();
  const como = api.comoTenant({ token: A.token, slug: A.slug });

  const fora = await como.put(`/api/cargos/${A.cargoAdmin.id}`, {
    descricao: "Coordenador de teste",
    verCobranca: false,
    verPainelGestor: false,
  });
  assert.equal(fora.status, 200);
  assert.equal(fora.json.verCobranca, false);
  assert.equal(fora.json.verPainelGestor, false);

  const volta = await como.put(`/api/cargos/${A.cargoAdmin.id}`, { descricao: CARGO_ADMIN });
  assert.equal(volta.status, 200);
  for (const chave of CHAVES_DA_CASA) {
    assert.equal(volta.json[chave], true, `${chave} nao voltou ao promover`);
  }

  await apagarImobiliaria(A.tenant.id);
});

/* O outro lado da regra: fora do Administrador as mesmas permissões são
   escolha normal. Sem isto, a trava poderia virar "ninguém desliga isso nunca"
   sem ninguém notar — e aí o Gerente perderia `gerenciarUsuarios` de vez. */
test("as mesmas permiss\u00f5es continuam desmarc\u00e1veis em qualquer outro cargo", async () => {
  const A = await criarImobiliariaDeTeste();
  const como = api.comoTenant({ token: A.token, slug: A.slug });

  const criado = await como.post("/api/cargos", {
    descricao: "Supervisor de teste",
    ...Object.fromEntries(CHAVES_DA_CASA.map((c) => [c, true])),
  });
  assert.equal(criado.status, 201);

  const r = await como.put(`/api/cargos/${criado.json.id}`,
    Object.fromEntries(CHAVES_DA_CASA.map((c) => [c, false])));
  assert.equal(r.status, 200);

  for (const chave of CHAVES_DA_CASA) {
    assert.equal(r.json[chave], false, `${chave} deveria ter sido desligada`);
  }

  await apagarImobiliaria(A.tenant.id);
});

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
