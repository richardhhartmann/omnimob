import { prisma } from "../db.js";

/* ────────────────────────────────────────────────────────────────────────────
   Distribuição automática de leads — a "roleta de corretores".

   Lead sem dono é lead que ninguém atende: em equipe, "de todo mundo" e "de
   ninguém" são a mesma coisa na prática, e o contato esfria enquanto cada um
   supõe que o outro ligou. Por isso o lead nasce com responsável.

   ── O CRITÉRIO ──

   Rodízio por CARGA, não por ordem alfabética nem por sorteio. Ganha quem tem
   menos leads em aberto (fora de GANHO e PERDIDO); em empate, quem recebeu o
   último há mais tempo. É o mesmo raciocínio de fila de banco: distribui o
   trabalho de fato, em vez de distribuir o número de atendimentos.

   Sorteio puro parece justo e não é — com poucos leads por dia, a aleatoriedade
   entrega três seguidos para a mesma pessoa com frequência incômoda.

   ── QUEM ENTRA NO RODÍZIO ──

   Usuário ativo cujo cargo tenha `gerenciarLeads` OU `verRelatorios` — as duas
   permissões que dão acesso à tela onde o lead é trabalhado. Atribuir a quem
   não consegue abrir a tela seria pior do que não atribuir: o lead ficaria com
   dono e invisível.

   Sem ninguém elegível, o lead fica sem responsável e aparece na caixa comum.
   Isso é o certo para a imobiliária de uma pessoa só, que é a maioria dos
   clientes novos.
   ──────────────────────────────────────────────────────────────────────────── */

/* Escolhe o próximo corretor da fila. Devolve `null` quando não há candidato.
 *
 * Devolve o OBJETO e não só o id: quem chama grava um evento de histórico, e
 * histórico com id dentro ("atribuído a cmsp44…") não responde nada a quem lê.
 * O nome vai gravado junto porque o registro precisa sobreviver à saída da
 * pessoa da empresa. */
export async function proximoResponsavel(tenantId) {
  try {
    const candidatos = await prisma.usuario.findMany({
      where: {
        tenantId,
        ativo: true,
        cargo: { OR: [{ gerenciarLeads: true }, { verRelatorios: true }] },
      },
      select: { id: true, nome: true },
    });

    if (candidatos.length === 0) return null;
    if (candidatos.length === 1) return candidatos[0];

    /* Uma consulta agrupada em vez de uma por corretor. Com dez pessoas na
       equipe, o laço ingênuo faria dez idas ao banco a cada lead recebido —
       numa rota pública, que é onde menos se quer trabalho por requisição. */
    const abertos = await prisma.propertyLead.groupBy({
      by: ["responsavelId"],
      where: {
        tenantId,
        responsavelId: { in: candidatos.map((c) => c.id) },
        estagio: { notIn: ["GANHO", "PERDIDO"] },
      },
      _count: { responsavelId: true },
    });

    const ultimos = await prisma.propertyLead.groupBy({
      by: ["responsavelId"],
      where: { tenantId, responsavelId: { in: candidatos.map((c) => c.id) } },
      _max: { createdAt: true },
    });

    const carga = new Map(abertos.map((a) => [a.responsavelId, a._count.responsavelId]));
    const ultimo = new Map(ultimos.map((u) => [u.responsavelId, u._max.createdAt?.getTime() ?? 0]));

    return candidatos
      .map((c) => ({ ...c, carga: carga.get(c.id) ?? 0, ultimo: ultimo.get(c.id) ?? 0 }))
      .sort((a, b) => a.carga - b.carga || a.ultimo - b.ultimo)[0];
  } catch (erro) {
    /* Nunca derruba a captação. Um lead sem dono é um problema de organização;
       um formulário que falha na vitrine é um cliente perdido. */
    console.error("[distribuicaoLeads]", erro.message);
    return null;
  }
}
