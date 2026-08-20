import test from "node:test";
import assert from "node:assert/strict";
import {
  prisma,
  limparRestos,
  criarImobiliariaDeTeste,
  apagarImobiliaria,
} from "./helpers.js";
import { limparTrials } from "../src/services/trialService.js";

/* ────────────────────────────────────────────────────────────────────────────
   A faxina de contas vencidas — a única rotina do produto que APAGA cliente.

   ── POR QUE ELA PRECISAVA DE TESTE ──

   Duas falhas reais, e nenhuma delas aparecia no ensaio:

   1. `enderecoDaVitrine` nunca foi importado no `trialService`. O caminho que a
      usa só executa com `aplicar: true`, e o ensaio (o padrão do script) retorna
      antes. A rotina rodou por semanas parecendo saudável e quebrava no primeiro
      uso de verdade — DEPOIS de desativar as contas: acesso cortado, nenhum
      aviso enviado, e a remoção nunca alcançada.

   2. Uma conta muito vencida entrava nas DUAS listas da mesma rodada. Recebia
      "seus dados ficam guardados por mais 30 dias" e era apagada no instante
      seguinte.

   ── POR QUE `somenteIds` ──

   Esta função varre o banco inteiro, e a suíte roda contra o banco de
   desenvolvimento. Sem o recorte, um `aplicar: true` aqui levaria junto
   qualquer conta vencida de verdade que estivesse lá.
   ──────────────────────────────────────────────────────────────────────────── */

const DIA = 86400000;

async function comoTrialVencido(tenantId, diasAtras) {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      statusPagamento: "TRIAL",
      ativo: true,
      suspensoEm: null,
      proximoVencimento: new Date(Date.now() - diasAtras * DIA),
    },
  });
}

test.before(limparRestos);

test("desativa a conta vencida, carimba o corte e NÃO remove na mesma rodada", async (t) => {
  const a = await criarImobiliariaDeTeste();
  t.after(() => apagarImobiliaria(a.tenant.id));

  // 400 dias: muito além dos 30 de graça. Antes da correção, este é exatamente
  // o caso que era avisado e apagado de uma vez.
  await comoTrialVencido(a.tenant.id, 400);

  const r = await limparTrials({ aplicar: true, somenteIds: [a.tenant.id] });

  assert.equal(r.desativados.length, 1, "a conta vencida tem que ser desativada");
  assert.equal(r.removidos.length, 0, "a rodada que desativa nunca pode remover");

  const depois = await prisma.tenant.findUnique({ where: { id: a.tenant.id } });
  assert.ok(depois, "a conta continua existindo");
  assert.equal(depois.ativo, false);
  assert.ok(depois.suspensoEm, "o corte precisa ficar carimbado — é dele que o prazo conta");
});

test("remove só depois de o prazo de graça correr A PARTIR do corte", async (t) => {
  const a = await criarImobiliariaDeTeste();
  let existe = true;
  t.after(() => (existe ? apagarImobiliaria(a.tenant.id) : null));

  await comoTrialVencido(a.tenant.id, 400);
  await limparTrials({ aplicar: true, somenteIds: [a.tenant.id] });

  // Recém-cortada: o prazo mal começou, mesmo com o vencimento lá atrás.
  const cedo = await limparTrials({ aplicar: true, somenteIds: [a.tenant.id] });
  assert.equal(cedo.removidos.length, 0, "não pode remover no dia seguinte ao corte");

  // Agora sim: o corte envelheceu além dos 30 dias do trial.
  await prisma.tenant.update({
    where: { id: a.tenant.id },
    data: { suspensoEm: new Date(Date.now() - 31 * DIA) },
  });

  const tarde = await limparTrials({ aplicar: true, somenteIds: [a.tenant.id] });
  assert.equal(tarde.removidos.length, 1, "passado o prazo, remove");

  const sumiu = await prisma.tenant.findUnique({ where: { id: a.tenant.id } });
  assert.equal(sumiu, null, "a conta tem que ter ido embora de verdade");
  existe = false;
});

test("conta pagante em atraso ganha 90 dias, e não os 30 do trial", async (t) => {
  const a = await criarImobiliariaDeTeste();
  t.after(() => apagarImobiliaria(a.tenant.id));

  await prisma.tenant.update({
    where: { id: a.tenant.id },
    data: {
      statusPagamento: "ATRASADO",
      ativo: false,
      // 60 dias: já passou dos 30 do trial, longe dos 90 de quem pagava.
      suspensoEm: new Date(Date.now() - 60 * DIA),
      proximoVencimento: new Date(Date.now() - 400 * DIA),
    },
  });

  const r = await limparTrials({ aplicar: true, somenteIds: [a.tenant.id] });
  assert.equal(r.removidos.length, 0, "quem pagava tem 90 dias, não 30");

  const viva = await prisma.tenant.findUnique({ where: { id: a.tenant.id } });
  assert.ok(viva, "a conta pagante continua guardada");
});

test("conta CANCELADA não é varrida por aqui", async (t) => {
  const a = await criarImobiliariaDeTeste();
  t.after(() => apagarImobiliaria(a.tenant.id));

  /* Quem cancelou já foi tratado pelo fluxo de cancelamento, que respeita o
     período pago. Varrer por aqui encurtaria o que a pessoa comprou. */
  await prisma.tenant.update({
    where: { id: a.tenant.id },
    data: {
      statusPagamento: "CANCELADO",
      ativo: true,
      proximoVencimento: new Date(Date.now() - 400 * DIA),
    },
  });

  const r = await limparTrials({ aplicar: true, somenteIds: [a.tenant.id] });
  assert.equal(r.desativados.length, 0);
  assert.equal(r.removidos.length, 0);
});

test("o aviso por e-mail é montado sem quebrar — e não derruba a faxina se quebrar", async (t) => {
  const a = await criarImobiliariaDeTeste();
  t.after(() => apagarImobiliaria(a.tenant.id));

  /* Este é o teste do bug nº 1. A imobiliária de teste já nasce com e-mail, e é
     TER e-mail que faz a rotina entrar no trecho que montava o modelo — o
     mesmo onde faltava o import. Sem endereço, o laço pula e o defeito volta a
     ser invisível.

     O envio em si não acontece: `test/helpers.js` desliga o transporte. O que
     está sob teste é a MONTAGEM, que era o que lançava. */
  assert.ok(a.tenant.email, "a imobiliária de teste precisa ter e-mail");
  await comoTrialVencido(a.tenant.id, 5);

  /* ── Por que escutar o console em vez de só conferir o desfecho ───────────
     A primeira versão deste teste afirmava apenas que a faxina terminava — e
     passava mesmo com o import removido. O motivo é a própria proteção que
     nasceu com o bug: montar o aviso agora vive num `try/catch`, então a
     falha vira uma linha de log e a limpeza segue.

     A proteção está certa (a limpeza não pode depender do aviso) e é
     justamente por isso que o desfecho não serve de prova: ele é o mesmo com o
     aviso funcionando e com ele quebrado. O que distingue os dois é o registro
     da falha — então é ele que o teste observa. */
  const reclamacoes = [];
  const erroOriginal = console.error;
  console.error = (...args) => { reclamacoes.push(args.join(" ")); };

  let r;
  try {
    r = await limparTrials({ aplicar: true, somenteIds: [a.tenant.id] });
  } finally {
    console.error = erroOriginal;
  }

  const falhouAoMontar = reclamacoes.find((l) => l.includes("não consegui montar o aviso"));
  assert.equal(falhouAoMontar, undefined, `o aviso não pôde ser montado: ${falhouAoMontar}`);

  assert.equal(r.desativados.length, 1);
  const depois = await prisma.tenant.findUnique({ where: { id: a.tenant.id } });
  assert.equal(depois.ativo, false, "a desativação tem que ter chegado ao fim");
});
