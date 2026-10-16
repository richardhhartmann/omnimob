import { prisma } from "../db.js";

/**
 * ─── O saldo de impulsos (Meta Ads) ──────────────────────────────────────────
 *
 * "Impulso" é uma vez que a imobiliária pode impulsionar um imóvel. Este
 * arquivo é o ÚNICO que escreve em `Tenant.impulsosDoPlano`,
 * `Tenant.impulsosAvulsos` e `ImpulsoMovimento` — quatro verbos, um lugar:
 *
 *   · `creditarPlanoDoPagamento` — o pagamento caiu: o saldo do plano VOLTA ao
 *     limite (não soma). Chamado de dentro de `registrarPagamento`;
 *   · `creditarAvulsos` — a imobiliária comprou um pacote à parte: SOMA, e não
 *     zera na virada;
 *   · `consumir` — alguém impulsionou: gasta primeiro o do plano, que vai
 *     zerar na virada de qualquer jeito, e só então o avulso, que não zera;
 *   · `estornar` — o impulsionamento não aconteceu (a Meta recusou): devolve
 *     para a MESMA origem de onde saiu.
 *
 * ── QUANDO RECARREGA ──
 * Quando o pagamento CAI, e só então — decisão de produto. Consequência que
 * vale saber: no plano anual o pagamento cai uma vez por ano, então a
 * recarga também.
 *
 * ── O QUE ESTE ARQUIVO NÃO FAZ ──
 * Não fala com a Meta e não decide QUEM pode impulsionar (plano, permissão).
 * Isso é de quem chama. Aqui só se conta.
 */

/** Quantos impulsos cada plano recebe a cada pagamento. Plano nulo é Básico. */
export const IMPULSOS_POR_PLANO = { BASICO: 0, PROFISSIONAL: 50, PREMIUM: 100 };

export const TIPOS = ["CREDITO_PLANO", "COMPRA", "CONSUMO", "ESTORNO"];

export function limiteDoPlano(plano) {
  const chave = String(plano || "BASICO").toUpperCase();
  return IMPULSOS_POR_PLANO[chave] ?? 0;
}

/** Erro de regra (saldo, consumo inexistente), distinto de erro de banco. */
export class ErroDeImpulso extends Error {
  constructor(codigo, mensagem) {
    super(mensagem);
    this.codigo = codigo;
  }
}

/** Violação de chave única: é o sinal de "isto já foi feito". */
function jaFeito(erro) {
  return erro?.code === "P2002";
}

/**
 * O pagamento caiu: o saldo do plano volta ao limite.
 *
 * Idempotente por `pagamento.id` (chave única no extrato). O webhook do Stripe
 * reenvia por horas e a tela do Pix consulta em paralelo — e mesmo sem a
 * chave a recarga seria um SET, não um incremento, mas o extrato ganharia uma
 * linha por chegada. Com ela, a segunda chegada não faz nada.
 *
 * Só pagamento `PAGO` recarrega. Um `PENDENTE` que depois vira `PAGO` passa
 * aqui duas vezes — a primeira não credita, então a segunda ainda pode.
 *
 * O plano é o do PAGAMENTO, congelado no momento da cobrança; o do tenant é o
 * resgate, para quem chama sem dizer qual foi.
 *
 * Nunca lança, como `registrarPagamento`: roda depois de o acesso ser
 * liberado, e uma exceção aqui viraria um pagamento aprovado que responde 500.
 *
 * @returns {Promise<object|null>} o movimento criado, ou `null` se não houve.
 */
export async function creditarPlanoDoPagamento(pagamento) {
  try {
    if (!pagamento?.id || !pagamento?.tenantId || pagamento.status !== "PAGO") return null;

    return await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: pagamento.tenantId },
        select: { plano: true, impulsosDoPlano: true, impulsosAvulsos: true },
      });
      if (!tenant) return null;

      const plano = String(pagamento.plano || "").toUpperCase() in IMPULSOS_POR_PLANO
        ? pagamento.plano
        : tenant.plano;
      const limite = limiteDoPlano(plano);

      /* O extrato PRIMEIRO: é a chave única dele que barra a segunda chegada
         do mesmo pagamento, e ela precisa barrar antes de o saldo mudar. */
      const movimento = await tx.impulsoMovimento.create({
        data: {
          tenantId: pagamento.tenantId,
          tipo: "CREDITO_PLANO",
          deltaPlano: limite - tenant.impulsosDoPlano,
          saldoPlano: limite,
          saldoAvulsos: tenant.impulsosAvulsos,
          pagamentoId: pagamento.id,
          descricao: `Recarga do plano ${String(plano || "BASICO").toUpperCase()}: ${limite} impulsos.`,
        },
      });
      await tx.tenant.update({
        where: { id: pagamento.tenantId },
        data: { impulsosDoPlano: limite },
      });
      return movimento;
    });
  } catch (erro) {
    if (jaFeito(erro)) return null;
    console.error(
      `[impulsos] não consegui recarregar o plano do tenant ${pagamento?.tenantId}:`,
      erro.message,
    );
    return null;
  }
}

/**
 * A imobiliária comprou impulsos à parte. Soma ao avulso, que não zera.
 *
 * Com `pagamentoId`, idempotente como a recarga: o mesmo pagamento compra uma
 * vez só. Ao contrário dela, LANÇA — quem chama é o fluxo de compra, que
 * precisa saber se o crédito entrou.
 */
export async function creditarAvulsos(tenantId, quantidade, { pagamentoId = null, usuarioId = null, descricao = null } = {}) {
  const n = Number(quantidade);
  if (!tenantId || !Number.isInteger(n) || n <= 0) {
    throw new ErroDeImpulso("QUANTIDADE_INVALIDA", "Quantidade de impulsos inválida.");
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.update({
        where: { id: tenantId },
        data: { impulsosAvulsos: { increment: n } },
        select: { impulsosDoPlano: true, impulsosAvulsos: true },
      });
      return tx.impulsoMovimento.create({
        data: {
          tenantId,
          tipo: "COMPRA",
          deltaAvulsos: n,
          saldoPlano: tenant.impulsosDoPlano,
          saldoAvulsos: tenant.impulsosAvulsos,
          pagamentoId,
          usuarioId,
          descricao: descricao || `Compra de ${n} impulsos.`,
        },
      });
    });
  } catch (erro) {
    /* A transação desfez o incremento; sobra só dizer que já estava feito. */
    if (jaFeito(erro)) return null;
    throw erro;
  }
}

/**
 * Gasta UM impulso. Primeiro o do plano, que zera na virada de qualquer jeito;
 * só então o avulso, que a imobiliária pagou à parte e não perde.
 *
 * Sem `SELECT … FOR UPDATE`: o desconto é um `updateMany` com a condição de
 * saldo no próprio `WHERE`, então duas pessoas impulsionando ao mesmo tempo
 * com um impulso sobrando não conseguem as duas — o banco decide qual
 * `UPDATE` encontra a linha ainda com saldo. Um de cada vez é o que o produto
 * faz (um clique, um imóvel), e é o que torna isso possível sem trava.
 *
 * @throws {ErroDeImpulso} `SEM_SALDO` quando os dois saldos estão zerados.
 */
export async function consumir(tenantId, { referencia = null, usuarioId = null, descricao = null } = {}) {
  if (!tenantId) throw new ErroDeImpulso("SEM_TENANT", "Imobiliária não informada.");

  return prisma.$transaction(async (tx) => {
    let origem = "plano";
    let r = await tx.tenant.updateMany({
      where: { id: tenantId, impulsosDoPlano: { gt: 0 } },
      data: { impulsosDoPlano: { decrement: 1 } },
    });
    if (r.count === 0) {
      origem = "avulsos";
      r = await tx.tenant.updateMany({
        where: { id: tenantId, impulsosAvulsos: { gt: 0 } },
        data: { impulsosAvulsos: { decrement: 1 } },
      });
    }
    if (r.count === 0) {
      throw new ErroDeImpulso("SEM_SALDO", "Os impulsos desta imobiliária acabaram.");
    }

    const saldo = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { impulsosDoPlano: true, impulsosAvulsos: true },
    });
    return tx.impulsoMovimento.create({
      data: {
        tenantId,
        tipo: "CONSUMO",
        deltaPlano: origem === "plano" ? -1 : 0,
        deltaAvulsos: origem === "avulsos" ? -1 : 0,
        saldoPlano: saldo.impulsosDoPlano,
        saldoAvulsos: saldo.impulsosAvulsos,
        referencia,
        usuarioId,
        descricao,
      },
    });
  });
}

/**
 * Devolve um consumo — o impulsionamento não chegou a existir.
 *
 * Volta para a MESMA origem: um impulso do plano devolvido como avulso
 * sobreviveria à virada, e a imobiliária ganharia um de graça a cada recusa
 * da Meta.
 *
 * Exceção deliberada: se, entre o consumo e o estorno, o plano recarregou, o
 * impulso do plano NÃO volta — a recarga já devolveu o saldo cheio, e somar
 * por cima passaria do limite. O extrato anota a devolução com delta zero,
 * para ninguém procurar o impulso que "sumiu".
 *
 * Idempotente por `estornoDeId`. O `tenantId` entra no filtro: o id do consumo
 * de outra imobiliária responde como inexistente, nunca é devolvido aqui.
 *
 * @throws {ErroDeImpulso} `CONSUMO_INEXISTENTE` se o consumo não é deste tenant.
 */
export async function estornar(tenantId, consumoId, { usuarioId = null, descricao = null } = {}) {
  const consumo = await prisma.impulsoMovimento.findFirst({
    where: { id: String(consumoId || ""), tenantId, tipo: "CONSUMO" },
  });
  if (!consumo) {
    throw new ErroDeImpulso("CONSUMO_INEXISTENTE", "Consumo de impulso não encontrado.");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const doPlano = consumo.deltaPlano < 0;
      const recarregouDepois = doPlano && (await tx.impulsoMovimento.count({
        where: { tenantId, tipo: "CREDITO_PLANO", createdAt: { gt: consumo.createdAt } },
      })) > 0;

      const data = doPlano
        ? (recarregouDepois ? {} : { impulsosDoPlano: { increment: 1 } })
        : { impulsosAvulsos: { increment: 1 } };
      const saldo = await tx.tenant.update({
        where: { id: tenantId },
        data,
        select: { impulsosDoPlano: true, impulsosAvulsos: true },
      });

      return tx.impulsoMovimento.create({
        data: {
          tenantId,
          tipo: "ESTORNO",
          deltaPlano: doPlano && !recarregouDepois ? 1 : 0,
          deltaAvulsos: doPlano ? 0 : 1,
          saldoPlano: saldo.impulsosDoPlano,
          saldoAvulsos: saldo.impulsosAvulsos,
          estornoDeId: consumo.id,
          referencia: consumo.referencia,
          usuarioId,
          descricao: descricao
            || (recarregouDepois
              ? "Devolvido depois da recarga do plano: o saldo do plano já estava cheio."
              : "Impulso devolvido."),
        },
      });
    });
  } catch (erro) {
    if (jaFeito(erro)) return null;
    throw erro;
  }
}

/**
 * O saldo e o extrato de UMA imobiliária, numa chamada.
 *
 * `tenantId` é sempre o do contexto autenticado, nunca do cliente — a junção
 * rota + query é onde moraram os três vazamentos deste projeto.
 */
export async function saldoDoTenant(tenantId, { limite = 50 } = {}) {
  const [tenant, movimentos] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plano: true, impulsosDoPlano: true, impulsosAvulsos: true },
    }),
    prisma.impulsoMovimento.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(Number(limite) || 50, 1), 200),
      select: {
        id: true, tipo: true, deltaPlano: true, deltaAvulsos: true,
        saldoPlano: true, saldoAvulsos: true, referencia: true, descricao: true, createdAt: true,
      },
    }),
  ]);
  if (!tenant) return null;
  return {
    doPlano: tenant.impulsosDoPlano,
    avulsos: tenant.impulsosAvulsos,
    total: tenant.impulsosDoPlano + tenant.impulsosAvulsos,
    limiteDoPlano: limiteDoPlano(tenant.plano),
    movimentos,
  };
}
