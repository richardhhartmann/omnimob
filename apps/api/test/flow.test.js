import test from "node:test";
import assert from "node:assert/strict";

/* O HELPER VEM PRIMEIRO — ele neutraliza o envio de e-mail antes de qualquer
   rota carregar o notificationService. Ver `pesquisaTrial.test.js`. */
import {
  prisma, limparRestos, criarImobiliariaDeTeste, apagarImobiliaria, subirApi,
} from "./helpers.js";
import { flowRouter } from "../src/routes/flowRoutes.js";
import { calcularSplit } from "../src/services/flow/comissoes.js";
import { podeFechar, podeMover } from "../src/services/flow/funil.js";

/* ────────────────────────────────────────────────────────────────────────────
   OMNIMOB FLOW — a trava do fechamento e o split da comissão.

   ── POR QUE ESTAS DUAS COISAS, E NÃO AS OUTRAS TRINTA ──

   Porque são as que causam dano SILENCIOSO e IRREVERSÍVEL.

   A trava: se ela vazar, um negócio fecha sem o jurídico ter olhado a
   documentação. Não há erro na tela, nada fica vermelho — o contrato sai, o
   cliente assina, e a imobiliária descobre meses depois. É exatamente o tipo de
   regra que um `if` numa rota nova contorna sem ninguém perceber, e por isso ela
   mora num serviço e é cobrada aqui.

   O split: erra por centavos e ninguém nota até o corretor conferir o
   contracheque. `imobiliaria + corretor` TEM que dar o total, sempre.

   O resto do módulo (listar, filtrar, anexar) falha alto: a tela fica vazia ou
   dá erro, e alguém abre chamado no mesmo dia.

   ── AS PARTES PURAS NÃO TOCAM NO BANCO ──

   `podeFechar`, `podeMover` e `calcularSplit` são funções puras de propósito, e
   é o que permite varrer os oito casos da trava sem criar oito negócios. Os
   testes de rota, abaixo, provam que a regra está LIGADA — que é a outra
   metade, e a que os `if` espalhados costumam quebrar.
   ──────────────────────────────────────────────────────────────────────────── */

/* ═══════════════════════════════════════════════════════════════════════════
   A TRAVA, sem banco
   ═══════════════════════════════════════════════════════════════════════════ */

test("nada fecha sem as duas validações e o contrato", () => {
  /* Os oito estados possíveis. Só um passa, e é o ponto: a trava é um E, não
     um OU — foi assim que a primeira versão errou, deixando passar quem tinha
     só o financeiro. */
  for (const juridicoOk of [false, true]) {
    for (const financeiroOk of [false, true]) {
      for (const contratoAssinado of [false, true]) {
        const { pode, motivos } = podeFechar(
          { juridicoOk, financeiroOk },
          { exigeContrato: true, contratoAssinado },
        );
        const esperado = juridicoOk && financeiroOk && contratoAssinado;
        assert.equal(pode, esperado, `${juridicoOk}/${financeiroOk}/${contratoAssinado}`);
        // Cada condição que falta vira UMA frase — a lista é o que a tela mostra.
        const faltando = [juridicoOk, financeiroOk, contratoAssinado].filter((x) => !x).length;
        assert.equal(motivos.length, faltando);
      }
    }
  }
});

test("no plano sem assinatura digital, o contrato não é cobrado", () => {
  /* Cobrar um documento que aquele plano não consegue produzir travaria o
     negócio para sempre — a trava viraria defeito em vez de controle. As duas
     validações HUMANAS continuam valendo, e é isso que este teste fixa: o que
     cai é só a exigência do contrato. */
  const semContrato = podeFechar(
    { juridicoOk: true, financeiroOk: true },
    { exigeContrato: false, contratoAssinado: false },
  );
  assert.equal(semContrato.pode, true);

  const semJuridico = podeFechar(
    { juridicoOk: false, financeiroOk: true },
    { exigeContrato: false, contratoAssinado: false },
  );
  assert.equal(semJuridico.pode, false);
});

test("PERDIDO é alcançável de qualquer lugar, inclusive de GANHO", () => {
  /* Dificultar registrar uma perda é a forma mais barata de não ter nenhuma
     perda registrada. E negócio que fechou e caiu depois (financiamento negado,
     distrato) existe — não poder registrá-lo deixaria o número de vendas
     permanentemente errado para cima. */
  for (const de of ["LEAD", "PROPOSTA", "APROVACAO", "GANHO"]) {
    assert.equal(podeMover({ estagio: de }, "PERDIDO").ok, true, de);
  }
});

test("voltar no funil é livre — só GANHO é travado", () => {
  const negocio = { estagio: "APROVACAO", juridicoOk: false, financeiroOk: false };
  for (const destino of ["LEAD", "CONTATO", "VISITA", "PROPOSTA", "NEGOCIACAO"]) {
    assert.equal(podeMover(negocio, destino).ok, true, destino);
  }
  const paraGanho = podeMover(negocio, "GANHO", { exigeContrato: true, contratoAssinado: false });
  assert.equal(paraGanho.ok, false);
  assert.equal(paraGanho.motivos.length, 3);
});

test("estágio desconhecido não passa", () => {
  assert.equal(podeMover({ estagio: "LEAD" }, "QUALQUER").ok, false);
  assert.equal(podeMover({ estagio: "LEAD" }, "").ok, false);
});

/* ═══════════════════════════════════════════════════════════════════════════
   O SPLIT
   ═══════════════════════════════════════════════════════════════════════════ */

test("as partes somam exatamente o total, sem centavo fantasma", () => {
  /* O caso que motivou o Decimal: 6% de 847.300 em ponto flutuante dá
     50838.000000000007. E o arredondamento das duas parcelas em separado
     estoura o total em um centavo com frequência incômoda — por isso a parte da
     imobiliária é o RESTO, e não um segundo arredondamento. */
  const valores = [847300, 1, 333333.33, 1000000, 749999.99, 12345.67, 0.03];
  const percentuais = [6, 5, 4.5, 3.33, 10];
  const corretores = [50, 30, 33.33, 100, 0];

  for (const valor of valores) {
    for (const percentual of percentuais) {
      for (const percentualCorretor of corretores) {
        const s = calcularSplit({ valor, percentual, percentualCorretor });
        assert.equal(
          s.imobiliaria.add(s.corretor).toString(),
          s.total.toString(),
          `${valor} @ ${percentual}% / ${percentualCorretor}%`,
        );
        // Duas casas, sempre: é dinheiro que vai para um relatório.
        assert.ok(s.total.decimalPlaces() <= 2);
        assert.ok(s.corretor.decimalPlaces() <= 2);
        assert.ok(s.imobiliaria.decimalPlaces() <= 2);
      }
    }
  }
});

test("negócio sem valor não gera comissão negativa nem NaN", () => {
  /* Valor ausente não é erro de digitação a corrigir aqui — é negócio sem valor
     fechado. A resposta certa é zero, e não um número negativo entrando no
     relatório da equipe. */
  for (const valor of [0, null, undefined, -1000, ""]) {
    const s = calcularSplit({ valor, percentual: 6, percentualCorretor: 50 });
    assert.equal(s.total.toString(), "0", String(valor));
    assert.equal(s.corretor.toString(), "0");
    assert.equal(s.imobiliaria.toString(), "0");
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   A TRAVA, LIGADA — pelas rotas
   ═══════════════════════════════════════════════════════════════════════════

   A metade que os `if` espalhados quebram: a regra existe, mas alguma rota não
   passa por ela. Aqui o negócio é movido de verdade, pela API, e o `PUT` é
   testado à parte porque ele foi a tentação óbvia de contorno — se ele aceitasse
   `estagio`, mandar `{ estagio: "GANHO" }` pularia a trava inteira. */

let api;
let A;
let B;

test.before(async () => {
  await limparRestos();
  api = await subirApi({ "/api/flow": flowRouter });
  A = await criarImobiliariaDeTeste();
  B = await criarImobiliariaDeTeste();
  // As duas contratam o Flow e o cargo Administrador o alcança inteiro.
  for (const t of [A, B]) {
    await prisma.tenant.update({
      where: { id: t.tenant.id },
      data: { modulos: ["HUB", "FLOW"] },
    });
    await prisma.cargo.update({
      where: { id: t.cargoAdmin.id },
      data: {
        acessarFlow: true, gerenciarNegocios: true, gerenciarContratos: true,
        validarJuridico: true, validarFinanceiro: true, verComissoes: true,
        gerenciarCaptacao: true,
      },
    });
  }
});

test.after(async () => {
  await api?.fechar();
  if (A) await apagarImobiliaria(A.tenant.id);
  if (B) await apagarImobiliaria(B.tenant.id);
  await limparRestos();
  await prisma.$disconnect();
});

async function negocioNovo(imobiliaria, valor = 500000) {
  const r = await api.comoTenant(imobiliaria).post("/api/flow/negocios", {
    titulo: "Negócio de teste", valorProposta: valor,
  });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return r.json;
}

test("a conta SEM o módulo não alcança rota nenhuma do Flow", async () => {
  /* A porta do módulo vem antes da permissão, e é a ordem certa: um corretor
     sem permissão numa conta sem Flow deve ouvir "não contratado", senão quem
     administra sai mexendo em cargos em vez de falar com o comercial. */
  await prisma.tenant.update({ where: { id: B.tenant.id }, data: { modulos: ["HUB"] } });
  const r = await api.comoTenant(B).get("/api/flow/painel");
  assert.equal(r.status, 403);
  assert.equal(r.json.moduloNaoContratado, "FLOW");
  await prisma.tenant.update({ where: { id: B.tenant.id }, data: { modulos: ["HUB", "FLOW"] } });
});

test("mover para GANHO é recusado com a lista do que falta", async () => {
  const negocio = await negocioNovo(A);
  const r = await api.comoTenant(A).post(`/api/flow/negocios/${negocio.id}/estagio`, {
    estagio: "GANHO",
  });
  assert.equal(r.status, 422);
  assert.ok(Array.isArray(r.json.motivos));
  /* O plano é PREMIUM, então o contrato é exigido: jurídico + financeiro +
     contrato = três pendências. */
  assert.equal(r.json.motivos.length, 3);

  const conferido = await prisma.negocio.findUnique({ where: { id: negocio.id } });
  assert.equal(conferido.estagio, "LEAD", "o negócio não pode ter se movido");
});

test("o PUT não é uma porta dos fundos para o estágio", async () => {
  /* Se ele aceitasse `estagio`, a trava do funil viraria enfeite: bastaria
     mandar { estagio: "GANHO" } por aqui. É a razão de a mudança de estágio ter
     rota própria. */
  const negocio = await negocioNovo(A);
  const r = await api.comoTenant(A).put(`/api/flow/negocios/${negocio.id}`, {
    titulo: "Renomeado", estagio: "GANHO",
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.titulo, "Renomeado");
  assert.equal(r.json.estagio, "LEAD", "o PUT não pode mexer no estágio");
});

test("com as duas validações e sem contrato, ainda não fecha", async () => {
  const negocio = await negocioNovo(A);
  for (const setor of ["juridico", "financeiro"]) {
    const v = await api.comoTenant(A).post(`/api/flow/negocios/${negocio.id}/validar/${setor}`, {
      aprovado: true, nota: "conferido",
    });
    assert.equal(v.status, 200, JSON.stringify(v.json));
  }
  const r = await api.comoTenant(A).post(`/api/flow/negocios/${negocio.id}/estagio`, {
    estagio: "GANHO",
  });
  assert.equal(r.status, 422);
  assert.equal(r.json.motivos.length, 1, "só o contrato deveria faltar");
});

test("com tudo em ordem fecha, e a comissão é congelada na hora", async () => {
  const negocio = await negocioNovo(A, 500000);
  for (const setor of ["juridico", "financeiro"]) {
    await api.comoTenant(A).post(`/api/flow/negocios/${negocio.id}/validar/${setor}`, { aprovado: true });
  }
  /* O contrato entra direto no banco com status ASSINADO: mandá-lo para
     assinatura de verdade exigiria conta na Clicksign, e o que está sob teste
     aqui é a TRAVA — não a integração. */
  await prisma.contrato.create({
    data: {
      tenantId: A.tenant.id, negocioId: negocio.id,
      titulo: "Contrato de teste", corpo: "texto", status: "ASSINADO",
    },
  });

  const r = await api.comoTenant(A).post(`/api/flow/negocios/${negocio.id}/estagio`, {
    estagio: "GANHO",
  });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.negocio.estagio, "GANHO");

  const fechado = await prisma.negocio.findUnique({ where: { id: negocio.id } });
  // 6% de 500.000 = 30.000, metade para cada lado (os padrões do schema).
  assert.equal(Number(fechado.valorFechado), 500000);
  assert.equal(Number(fechado.comissaoTotal), 30000);
  assert.equal(Number(fechado.comissaoImobiliaria), 15000);
  assert.equal(Number(fechado.comissaoCorretor), 15000);
  assert.ok(fechado.comissaoCalculadaEm, "a data do cálculo tem que ficar gravada");
  assert.ok(fechado.fechadoEm);
});

test("reabrir um negócio ganho limpa a comissão", async () => {
  /* Sem isto, um negócio que voltou de GANHO continuaria contando no
     faturamento do mês com a comissão calculada — a conta da imobiliária
     ficaria errada para cima, sem nenhum sintoma. */
  const negocio = await negocioNovo(A, 400000);
  for (const setor of ["juridico", "financeiro"]) {
    await api.comoTenant(A).post(`/api/flow/negocios/${negocio.id}/validar/${setor}`, { aprovado: true });
  }
  await prisma.contrato.create({
    data: { tenantId: A.tenant.id, negocioId: negocio.id, titulo: "C", corpo: "t", status: "ASSINADO" },
  });
  await api.comoTenant(A).post(`/api/flow/negocios/${negocio.id}/estagio`, { estagio: "GANHO" });

  const r = await api.comoTenant(A).post(`/api/flow/negocios/${negocio.id}/estagio`, {
    estagio: "NEGOCIACAO",
  });
  assert.equal(r.status, 200);

  const reaberto = await prisma.negocio.findUnique({ where: { id: negocio.id } });
  assert.equal(reaberto.comissaoTotal, null);
  assert.equal(reaberto.comissaoCorretor, null);
  assert.equal(reaberto.fechadoEm, null);
});

test("A não alcança o negócio de B nem pelo id real", async () => {
  /* O vazamento que este projeto já teve três vezes, na junção rota + query.
     404 e não 403: fora do tenant, o registro não existe para quem pergunta. */
  const deB = await negocioNovo(B);

  const ler = await api.comoTenant(A).get(`/api/flow/negocios/${deB.id}`);
  assert.equal(ler.status, 404);

  const mover = await api.comoTenant(A).post(`/api/flow/negocios/${deB.id}/estagio`, { estagio: "CONTATO" });
  assert.equal(mover.status, 404);

  const editar = await api.comoTenant(A).put(`/api/flow/negocios/${deB.id}`, { titulo: "invadido" });
  assert.equal(editar.status, 404);

  const validar = await api.comoTenant(A).post(`/api/flow/negocios/${deB.id}/validar/juridico`, { aprovado: true });
  assert.equal(validar.status, 404);

  const intacto = await prisma.negocio.findUnique({ where: { id: deB.id } });
  assert.equal(intacto.titulo, "Negócio de teste");
  assert.equal(intacto.juridicoOk, false);
});

test("o negócio de A não aceita imóvel nem cliente de B", async () => {
  /* Era exatamente assim que o `cargoCodigo` de outra empresa entrava num
     usuário daqui: o id vem do cliente e ninguém confere de quem ele é. */
  const cliente = await prisma.cliente.create({
    data: { tenantId: B.tenant.id, nome: "Cliente da B" },
  });
  const r = await api.comoTenant(A).post("/api/flow/negocios", {
    titulo: "Tentativa", compradorId: cliente.id,
  });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /não encontrado/i);
});

test("sem a permissão do setor, a validação é recusada", async () => {
  /* A trava só vale se quem a destrava for quem deveria. Um cargo sem
     `validarJuridico` recebendo 200 aqui esvaziaria o controle inteiro. */
  const negocio = await negocioNovo(A);
  await prisma.cargo.update({
    where: { id: A.cargoAdmin.id }, data: { validarJuridico: false },
  });

  const r = await api.comoTenant(A).post(`/api/flow/negocios/${negocio.id}/validar/juridico`, {
    aprovado: true,
  });
  assert.equal(r.status, 403);

  const intacto = await prisma.negocio.findUnique({ where: { id: negocio.id } });
  assert.equal(intacto.juridicoOk, false);

  await prisma.cargo.update({ where: { id: A.cargoAdmin.id }, data: { validarJuridico: true } });
});
