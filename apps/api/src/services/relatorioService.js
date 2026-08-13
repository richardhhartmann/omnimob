import { prisma } from "../db.js";

/**
 * ─── Relatório mensal da imobiliária ─────────────────────────────────────────
 * Junta o que aconteceu num mês: visitas à vitrine, leads, vendas e quais
 * imóveis puxaram o movimento.
 *
 * Os números saem de `PropertyMetricEvent` (VIEW/LEAD/SALE) e de `PropertyLead`.
 * Nada aqui é calculado na hora do e-mail: quem monta é este serviço, e quem
 * manda é o notificationService — separados de propósito, porque o mesmo
 * relatório é lido na tela (pré-visualização) antes de virar mensagem.
 *
 * Disponível a partir do Profissional. A porta fica na rota, não aqui: este
 * serviço também roda para o agendador, que já filtrou os tenants pelo plano.
 */

/** Primeiro e último instante do mês pedido, em horário local do servidor. */
export function janelaDoMes(ano, mes) {
  const inicio = new Date(ano, mes - 1, 1, 0, 0, 0, 0);
  // Dia 0 do mês seguinte é o último dia deste — evita a tabela de 28/30/31.
  const fim = new Date(ano, mes, 0, 23, 59, 59, 999);
  return { inicio, fim };
}

/** O mês anterior ao de hoje. É o único mês que já está fechado. */
export function mesFechadoAnterior(hoje = new Date()) {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}

const NOME_MES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function rotuloDoMes(ano, mes) {
  return `${NOME_MES[mes - 1]} de ${ano}`;
}

/**
 * Monta o relatório de um tenant num mês.
 *
 * @param {string} tenantId
 * @param {{ano:number, mes:number}} periodo
 * @returns {Promise<object>} números do mês, variação sobre o anterior e destaques
 */
export async function montarRelatorioMensal(tenantId, { ano, mes }) {
  const { inicio, fim } = janelaDoMes(ano, mes);
  const anterior = mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
  const janelaAnterior = janelaDoMes(anterior.ano, anterior.mes);

  /* Uma consulta agrupada por tipo em vez de três counts. O índice
     [tenantId, propertyId, type, createdAt] atende as duas janelas. */
  const [eventos, eventosAntes, leads, imoveisAtivos] = await Promise.all([
    prisma.propertyMetricEvent.groupBy({
      by: ["type"],
      where: { tenantId, createdAt: { gte: inicio, lte: fim } },
      _count: { _all: true },
    }),
    prisma.propertyMetricEvent.groupBy({
      by: ["type"],
      where: { tenantId, createdAt: { gte: janelaAnterior.inicio, lte: janelaAnterior.fim } },
      _count: { _all: true },
    }),
    prisma.propertyLead.count({ where: { tenantId, createdAt: { gte: inicio, lte: fim } } }),
    prisma.property.count({ where: { tenantId, status: "ACTIVE" } }),
  ]);

  const somar = (lista, tipo) =>
    lista.find((e) => e.type === tipo)?._count?._all ?? 0;

  const visitas = somar(eventos, "VIEW");
  const visitasAntes = somar(eventosAntes, "VIEW");
  const vendas = somar(eventos, "SALE");

  /* Os cinco imóveis mais vistos no mês. groupBy devolve só o id e a contagem;
     o título vem numa segunda consulta, também filtrada por tenant — o id sai
     de um agrupamento que já era do tenant, mas repetir o filtro custa nada e
     é o hábito que impede a próxima consulta de esquecer. */
  const topIds = await prisma.propertyMetricEvent.groupBy({
    by: ["propertyId"],
    where: { tenantId, type: "VIEW", createdAt: { gte: inicio, lte: fim } },
    _count: { _all: true },
    orderBy: { _count: { propertyId: "desc" } },
    take: 5,
  });

  const titulos = topIds.length
    ? await prisma.property.findMany({
        where: { id: { in: topIds.map((t) => t.propertyId) }, tenantId },
        select: { id: true, title: true, city: true, neighborhood: true },
      })
    : [];
  const porId = new Map(titulos.map((p) => [p.id, p]));

  const destaques = topIds
    .map((t) => {
      const p = porId.get(t.propertyId);
      if (!p) return null; // imóvel apagado depois do evento
      return {
        id: p.id,
        title: p.title,
        local: [p.neighborhood, p.city].filter(Boolean).join(", "),
        visitas: t._count._all,
      };
    })
    .filter(Boolean);

  /* Variação percentual sobre o mês anterior. Null quando não havia base: "+∞%"
     ou "+100%" a partir de zero não informa nada, e a tela/e-mail preferem
     omitir a comparação a inventar uma. */
  const variacaoVisitas =
    visitasAntes > 0 ? Math.round(((visitas - visitasAntes) / visitasAntes) * 100) : null;

  return {
    periodo: { ano, mes, rotulo: rotuloDoMes(ano, mes) },
    visitas,
    leads,
    vendas,
    imoveisAtivos,
    variacaoVisitas,
    // Conversão de visita em lead, o número que diz se a vitrine está fazendo o
    // trabalho dela. Uma casa decimal: 2 casas dão falsa precisão em amostras
    // pequenas, e inteiro esconde a diferença entre 0,4% e 1,4%.
    conversao: visitas > 0 ? Math.round((leads / visitas) * 1000) / 10 : null,
    destaques,
    // Mês sem nenhum movimento: quem chama decide se vale mandar e-mail.
    vazio: visitas === 0 && leads === 0 && vendas === 0,
  };
}
