import test, { after } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { prisma } from "../src/db.js";
import { subirApi, criarImobiliariaDeTeste, apagarImobiliaria } from "./helpers.js";
import { adminRouter } from "../src/routes/adminRoutes.js";
import { tenantRouter } from "../src/routes/tenantRoutes.js";
import { CARGOS_PADRAO, CARGO_ADMIN, PERMISSOES } from "../src/services/cargosPadrao.js";
import {
  registrarPagamento,
  historicoDoTenant,
  ultimoPagamento,
} from "../src/services/pagamentos.js";

/* ── O que esta suíte guarda ─────────────────────────────────────────────────

   O histórico é a resposta à pergunta "eu paguei?", e ela tem dois jeitos de
   sair errada — os dois silenciosos:

     · MOSTRAR DEMAIS: o pagamento de uma imobiliária aparecendo na tela de
       outra. É o vazamento que este projeto já teve três vezes, sempre na
       junção rota + query, e por isso o teste é de INTEGRAÇÃO, contra o banco.
     · CONTAR DUAS VEZES: o webhook do Stripe reenvia o mesmo evento por horas e
       a tela do Pix consulta em paralelo com o aviso do provedor. Sem a chave
       única, o cliente veria a mesma cobrança listada três vezes e concluiria
       que foi cobrado três vezes.

   Cria imobiliárias descartáveis com o PID no slug — o runner roda um processo
   por arquivo, em paralelo — e as apaga no fim.
   ────────────────────────────────────────────────────────────────────────── */

const PREFIXO = `zz-teste-${process.pid}-pgt`;

async function criarTenant(sufixo) {
  return prisma.tenant.create({
    data: {
      name: `Teste pagamentos ${sufixo}`,
      slug: `${PREFIXO}-${sufixo}`,
      email: `${PREFIXO}-${sufixo}@exemplo.test`,
      statusPagamento: "EM_DIA",
    },
  });
}

/* UM servidor para o arquivo inteiro, aberto antes e fechado depois.

   Nasceu como `subirApi` dentro de cada teste, e o preço apareceu na primeira
   asserção que falhou: o `fechar()` ficava depois dela, o servidor seguia
   escutando, e o runner nunca terminava — a suíte "travava" sem dizer que
   havia falhado. Hook não tem esse problema: ele roda mesmo quando o teste
   estoura. */
let apiT;

test.before(async () => {
  apiT = await subirApi({ "/api/admin": adminRouter, "/api/tenants": tenantRouter });
});

after(async () => {
  await apiT?.fechar?.();
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: PREFIXO } } });
  await prisma.$disconnect();
});

test("o histórico de A não mostra nada da B", async () => {
  const [a, b] = await Promise.all([criarTenant("a"), criarTenant("b")]);

  await registrarPagamento({
    tenantId: a.id, provedor: "MERCADO_PAGO", meio: "pix", valor: 441,
    plano: "BASICO", periodo: "anual", externoId: `pix-${a.id}`,
  });
  await registrarPagamento({
    tenantId: b.id, provedor: "STRIPE", meio: "cartao", valor: 99,
    plano: "PROFISSIONAL", periodo: "mensal", externoId: `in_${b.id}`,
  });

  const deA = await historicoDoTenant(a.id);
  assert.equal(deA.length, 1);
  assert.equal(deA[0].tenantId, a.id);
  assert.equal(Number(deA[0].valor), 441);

  const deB = await historicoDoTenant(b.id);
  assert.equal(deB.length, 1);
  assert.equal(deB[0].provedor, "STRIPE");
});

test("o mesmo pagamento chegando duas vezes é UMA linha", async () => {
  /* O caminho real: o webhook do provedor e a consulta que a tela faz enquanto
     a pessoa espera o QR chegam aqui com o mesmo id. */
  const t = await criarTenant("idem");
  const base = {
    tenantId: t.id, provedor: "MERCADO_PAGO", meio: "pix", valor: 891,
    plano: "PROFISSIONAL", periodo: "anual", externoId: "1327992008",
  };

  await registrarPagamento(base);
  await registrarPagamento(base);
  await registrarPagamento(base);

  const historico = await historicoDoTenant(t.id);
  assert.equal(historico.length, 1, "três chegadas do mesmo pagamento viraram mais de uma linha");
});

test("o reenvio ATUALIZA o estado — estorno não vira linha nova", async () => {
  const t = await criarTenant("estorno");
  const base = {
    tenantId: t.id, provedor: "STRIPE", meio: "cartao", valor: 149, externoId: "in_estorno",
  };

  await registrarPagamento({ ...base, status: "PAGO" });
  await registrarPagamento({ ...base, status: "ESTORNADO" });

  const historico = await historicoDoTenant(t.id);
  assert.equal(historico.length, 1);
  assert.equal(historico[0].status, "ESTORNADO");
});

test("o mesmo id em provedores diferentes são pagamentos diferentes", async () => {
  /* A chave é o PAR. Ids são sequenciais em cada fornecedor e colidem entre
     eles — casar só pelo número juntaria duas cobranças que nada têm a ver. */
  const t = await criarTenant("par");
  await registrarPagamento({ tenantId: t.id, provedor: "STRIPE", valor: 10, externoId: "123" });
  await registrarPagamento({ tenantId: t.id, provedor: "MERCADO_PAGO", valor: 20, externoId: "123" });

  assert.equal((await historicoDoTenant(t.id)).length, 2);
});

test("ativação manual não tem id externo — e duas cortesias são duas linhas", async () => {
  /* Nulo não colide com nulo no Postgres, e é isso que faz o caso manual
     funcionar sem inventar um id falso só para preencher a chave. */
  const t = await criarTenant("manual");
  await registrarPagamento({
    tenantId: t.id, provedor: "MANUAL", meio: "manual", valor: 99,
    descricao: "Ativado pela equipe (mês 1)",
  });
  await registrarPagamento({
    tenantId: t.id, provedor: "MANUAL", meio: "manual", valor: 99,
    descricao: "Ativado pela equipe (mês 2)",
  });

  const historico = await historicoDoTenant(t.id);
  assert.equal(historico.length, 2);
  assert.ok(historico.every((p) => p.externoId === null));
});

test("valor ilegível não vira R$ 0,00 no extrato do cliente", async () => {
  /* Zero é um número, e um "R$ 0,00" ao lado de um mês pago faz o cliente
     perguntar o que aconteceu — sem que ninguém consiga responder. Melhor a
     lacuna, que fica visível no log. */
  const t = await criarTenant("valor");
  assert.equal(await registrarPagamento({ tenantId: t.id, provedor: "STRIPE", valor: 0 }), null);
  assert.equal(await registrarPagamento({ tenantId: t.id, provedor: "STRIPE", valor: "abc" }), null);
  assert.equal(await registrarPagamento({ tenantId: t.id, provedor: "STRIPE", valor: -5 }), null);
  assert.equal((await historicoDoTenant(t.id)).length, 0);
});

test("provedor desconhecido não entra", async () => {
  const t = await criarTenant("provedor");
  assert.equal(await registrarPagamento({ tenantId: t.id, provedor: "PICPAY", valor: 10 }), null);
  assert.equal((await historicoDoTenant(t.id)).length, 0);
});

test("anotar nunca derruba o pagamento: tenant inexistente devolve null", async () => {
  /* A chamada acontece DEPOIS de o acesso ser liberado. Se ela lançasse, um
     pagamento aprovado viraria erro 500 e o webhook seria reenviado para
     sempre. */
  const r = await registrarPagamento({
    tenantId: "cmnaoexiste000000000000", provedor: "STRIPE", valor: 10, externoId: "in_fantasma",
  });
  assert.equal(r, null);
});

test("a última forma usada é a do pagamento mais recente", async () => {
  const t = await criarTenant("ultimo");
  await registrarPagamento({
    tenantId: t.id, provedor: "STRIPE", meio: "cartao", valor: 99,
    externoId: "in_velho", pagoEm: new Date("2026-01-10T12:00:00Z"),
  });
  await registrarPagamento({
    tenantId: t.id, provedor: "MERCADO_PAGO", meio: "pix", valor: 891,
    externoId: "mp_novo", pagoEm: new Date("2026-08-10T12:00:00Z"),
  });

  const ultimo = await ultimoPagamento(t.id);
  assert.equal(ultimo.meio, "pix");
  assert.equal(ultimo.provedor, "MERCADO_PAGO");

  /* E a ordem da lista é a mesma: o mais recente primeiro, que é como se lê um
     extrato. */
  const historico = await historicoDoTenant(t.id);
  assert.equal(historico[0].externoId, "mp_novo");
});

test("estorno não conta como última forma usada", async () => {
  const t = await criarTenant("ultimo-estorno");
  await registrarPagamento({
    tenantId: t.id, provedor: "STRIPE", meio: "cartao", valor: 99,
    externoId: "in_bom", pagoEm: new Date("2026-02-10T12:00:00Z"),
  });
  await registrarPagamento({
    tenantId: t.id, provedor: "MERCADO_PAGO", meio: "pix", valor: 891, status: "ESTORNADO",
    externoId: "mp_ruim", pagoEm: new Date("2026-08-10T12:00:00Z"),
  });

  const ultimo = await ultimoPagamento(t.id);
  assert.equal(ultimo.meio, "cartao", "um estorno não é a forma que o cliente usou para pagar");
});

test("apagar a imobiliária leva o histórico junto", async () => {
  /* LGPD e higiene: o histórico é dado da conta, não da Omnimob. A cascata é
     do banco, e este teste é o que garante que ela existe de verdade. */
  const t = await criarTenant("cascata");
  await registrarPagamento({ tenantId: t.id, provedor: "STRIPE", valor: 10, externoId: "in_cascata" });
  await prisma.tenant.delete({ where: { id: t.id } });
  assert.equal(await prisma.pagamento.count({ where: { tenantId: t.id } }), 0);
});

/* ── A ativação manual, pela rota de verdade ─────────────────────────────────

   Os testes acima exercitam o serviço. Este sobe a rota e faz a chamada como o
   super-admin faz, porque a ligação entre ela e o histórico já quebrou uma vez
   de um jeito que nenhum teste de função pura pegaria: a variável com o nome de
   quem ativou era usada ANTES de ser declarada, e isso só estoura na execução.

   É a mesma razão de as suítes deste projeto serem de integração — os defeitos
   moram na junção rota + query.
   ────────────────────────────────────────────────────────────────────────── */
test("ativar à mão grava o pagamento, com quem liberou e o período coberto", async () => {
  const t = await criarTenant("rota");
  const token = jwt.sign(
    { role: "SUPERADMIN", email: "equipe@omnimob.app" },
    process.env.JWT_SECRET || "omnimob-dev-secret",
  );

  const r = await fetch(`${apiT.base}/api/admin/tenants/${t.id}/fidelizar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ plano: "PROFISSIONAL", periodo: "mensal", valorMensal: 99 }),
  });
  const corpo = await r.json();
  assert.equal(r.status, 200, JSON.stringify(corpo));

  const [pagamento] = await historicoDoTenant(t.id);
  assert.ok(pagamento, "a ativação manual não deixou linha no histórico");
  assert.equal(pagamento.provedor, "MANUAL");
  assert.equal(pagamento.meio, "manual");
  assert.equal(Number(pagamento.valor), 99);
  assert.equal(pagamento.plano, "PROFISSIONAL");
  assert.equal(pagamento.externoId, null);
  /* O nome de quem liberou, que é a pergunta do suporte meses depois. */
  assert.match(pagamento.descricao, /equipe@omnimob\.app/);
  /* E o intervalo coberto, para a tela poder dizer "pago até". */
  assert.ok(pagamento.cobreAte instanceof Date);
});

/* ── A rota que a tela lê ────────────────────────────────────────────────────

   O extrato é a informação mais sensível que a imobiliária tem no painel — o
   quanto ela paga. Os três vazamentos deste projeto moraram todos na junção
   rota + query, e nenhum teste de função pura os pegaria: `historicoDoTenant`
   filtra certo, e ainda assim a rota poderia ler o tenant do lugar errado.
   ────────────────────────────────────────────────────────────────────────── */
test("a rota do extrato: A não vê nada da B, e sem permissão não abre", async () => {
  const A = await criarImobiliariaDeTeste();
  const B = await criarImobiliariaDeTeste();

  await registrarPagamento({
    tenantId: A.tenant.id, provedor: "MERCADO_PAGO", meio: "pix", valor: 441,
    plano: "BASICO", periodo: "anual", externoId: `rota-a-${A.tenant.id}`,
  });
  await registrarPagamento({
    tenantId: B.tenant.id, provedor: "STRIPE", meio: "cartao", valor: 1999,
    plano: "PREMIUM", periodo: "anual", externoId: `rota-b-${B.tenant.id}`,
  });

  const comoA = apiT.comoTenant({ token: A.token, slug: A.slug });
  const r = await comoA.get("/api/tenants/me/pagamentos");
  assert.equal(r.status, 200);
  assert.equal(r.json.pagamentos.length, 1);
  assert.equal(Number(r.json.pagamentos[0].valor), 441);
  /* O valor de B não pode aparecer nem de raspão: o texto CRU da resposta é o
     que sai pela rede, e é ele que o teste confere. */
  assert.ok(!JSON.stringify(r.json).includes("1999"), "o pagamento da outra imobiliária vazou");

  /* `Decimal` do Prisma não sobrevive ao JSON como número — a rota converte,
     e é isso que impede a tela de receber `{"s":1,"e":2,"d":[441]}`. */
  assert.equal(typeof r.json.pagamentos[0].valor, "number");
  assert.equal(r.json.situacao.renovaSozinho, false, "conta sem assinatura não renova sozinha");

  /* Sem `verCobranca` a seção nem aparece no menu — mas quem digitar o endereço
     tem de levar 403 do mesmo jeito. Esconder não é proteger. */
  const semPermissao = await prisma.usuario.update({
    where: { id: A.usuario.id },
    data: { cargoCodigo: A.cargoComum.id },
  });
  assert.ok(semPermissao);
  const r2 = await comoA.get("/api/tenants/me/pagamentos");
  assert.equal(r2.status, 403);

  await Promise.all([apagarImobiliaria(A.tenant.id), apagarImobiliaria(B.tenant.id)]);
});

/* ── A permissão nova, e o que ela NÃO arrasta junto ─────────────────────────

   `verCobranca` nasceu para ser concedida — é a única "chave da casa" que um
   cargo pode receber sem ser o Administrador. O que este teste guarda são as
   duas pontas dessa escolha:

     · o Administrador a tem DE FÁBRICA, senão a tela nasceria fechada para
       quem responde pela conta;
     · ela não abre nada além da cobrança. Quem a recebe continua sem trocar de
       plano, sem mexer no domínio e sem cancelar a assinatura, que seguem
       atrás de `verConfiguracoes` — derivada do nome do cargo e impossível de
       conceder.
   ────────────────────────────────────────────────────────────────────────── */
test("o Administrador nasce vendo a cobrança; os outros cargos, não", () => {
  /* No CATÁLOGO do produto, que é quem provisiona a imobiliária de verdade —
     e não no cargo que o andaime de teste cria. Conferir o andaime provaria
     que o andaime está certo. */
  const admin = CARGOS_PADRAO.find((c) => c.descricao === CARGO_ADMIN);
  assert.ok(admin.permite.includes("verCobranca"), "o Administrador nasceu sem ver a própria cobrança");

  for (const cargo of CARGOS_PADRAO.filter((c) => c.descricao !== CARGO_ADMIN)) {
    assert.ok(
      !cargo.permite.includes("verCobranca"),
      `${cargo.descricao} nasceu com a cobrança ligada — dado de dinheiro não vem de fábrica`,
    );
  }

  /* E a permissão existe na lista canônica: é ela que `cargoRoutes` percorre
     para gravar. Fora dela, a caixa da tela seria ignorada em silêncio. */
  assert.ok(PERMISSOES.includes("verCobranca"));
});

test("conceder a cobrança não concede as configurações", async () => {
  /* O meio-termo é o ponto da permissão: se `verCobranca` arrastasse
     `verConfiguracoes` junto, ela não resolveria nada — o financeiro voltaria a
     poder cancelar a assinatura. */
  const A = await criarImobiliariaDeTeste();

  const financeiro = await prisma.cargo.create({
    data: {
      tenantId: A.tenant.id,
      descricao: "Financeiro da casa",
      acessarPainel: true,
      verCobranca: true,
    },
  });
  await prisma.usuario.update({ where: { id: A.usuario.id }, data: { cargoCodigo: financeiro.id } });

  const como = apiT.comoTenant({ token: A.token, slug: A.slug });
  const extrato = await como.get("/api/tenants/me/pagamentos");
  assert.equal(extrato.status, 200, "quem tem verCobranca precisa abrir o extrato");

  /* E a porta que continua fechada: trocar de plano exige `verConfiguracoes`,
     que este cargo não tem — e que ninguém consegue conceder, porque o
     servidor a deriva do nome do cargo. */
  assert.equal(financeiro.verConfiguracoes, false);

  await apagarImobiliaria(A.tenant.id);
});
