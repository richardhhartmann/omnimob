import { prisma } from "../db.js";

/* ────────────────────────────────────────────────────────────────────────────
   O Painel do Gestor — a tela "/".

   ── O QUE ELE RESPONDE ──

   A tela inicial mostrava atalhos e o acervo: útil para quem CADASTRA imóvel,
   inútil para quem DIRIGE a imobiliária. As perguntas de quem dirige são
   outras, e todas já tinham resposta no banco — só não tinham tela:

     · quantos interessados apareceram hoje, e isso é bom ou ruim?
     · qual imóvel está puxando a atenção?
     · quanto entrou este mês, e como se compara com o mês passado?
     · quem da equipe está fechando, e quem está sentado em lead parado?
     · o que está me custando dinheiro agora sem eu ver?

   ── AS TRÊS REGRAS ──

   1. NÚMERO QUE NÃO EXISTE É `null`, NÃO ZERO. Ticket médio sem vendas é
      `null`; variação sem base de comparação é `null`. "R$ 0,00 de ticket
      médio" e "-100%" são afirmações erradas, não ausências. É a mesma regra
      de `dadosDaVitrine`.

   2. COMPARAÇÃO SEMPRE QUE HOUVER COM QUE COMPARAR. "12 interessados hoje" não
      diz nada; "12, contra 4 ontem" é uma informação. Sem ontem, mostra só o
      número.

   3. O QUE PEDE AÇÃO VEM SEPARADO. Lead sem resposta e imóvel sem foto não são
      métricas de vaidade — são coisas que custam dinheiro agora. Eles têm bloco
      próprio, e não uma linha perdida entre indicadores.

   ── PRIVACIDADE ──

   Este é o único lugar do produto que mostra faturamento e o desempenho de cada
   corretor NOMEADO. Por isso a permissão é própria (`verPainelGestor`) e nasce
   desligada até para quem já tem `acessarPainel` — ver `cargosPadrao.js`.
   ──────────────────────────────────────────────────────────────────────────── */

const num = (v) => (v === null || v === undefined ? 0 : Number(v));

/** Início do dia no fuso do servidor. Basta para "hoje" numa imobiliária. */
function inicioDoDia(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function diasAtras(n) {
  return inicioDoDia(new Date(Date.now() - n * 86400000));
}

/* Variação percentual. `null` quando não havia base: "+100%" a partir de zero
   parece crescimento e é só a primeira venda. */
function variacao(agora, antes) {
  if (!antes) return null;
  return Math.round(((agora - antes) / antes) * 100);
}

export async function montarPainelGestor(tenantId) {
  const hoje = inicioDoDia();
  const ontem = diasAtras(1);
  const seteDias = diasAtras(7);

  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const inicioMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);

  const [
    leadsHoje, leadsOntem,
    eventosHoje, eventosOntem,
    vendasMes, vendasMesAnterior,
    eventosMes,
    leadsMes,
    topImovel,
    acervo,
    semFoto,
    leadsSemResposta,
    leadsSemDono,
    vendasPorUsuario,
    leadsPorUsuario,
  ] = await Promise.all([
    prisma.propertyLead.count({ where: { tenantId, createdAt: { gte: hoje } } }),
    prisma.propertyLead.count({ where: { tenantId, createdAt: { gte: ontem, lt: hoje } } }),

    prisma.propertyMetricEvent.count({ where: { tenantId, type: "VIEW", createdAt: { gte: hoje } } }),
    prisma.propertyMetricEvent.count({ where: { tenantId, type: "VIEW", createdAt: { gte: ontem, lt: hoje } } }),

    prisma.venda.aggregate({
      where: { tenantId, data: { gte: inicioMes } },
      _sum: { valor: true, comissao: true },
      _count: { _all: true },
    }),
    prisma.venda.aggregate({
      where: { tenantId, data: { gte: inicioMesAnterior, lt: inicioMes } },
      _sum: { valor: true },
    }),

    prisma.propertyMetricEvent.count({ where: { tenantId, type: "VIEW", createdAt: { gte: inicioMes } } }),
    prisma.propertyLead.count({ where: { tenantId, createdAt: { gte: inicioMes } } }),

    /* O imóvel mais visto da SEMANA, e não do dia: numa imobiliária pequena o
       dia costuma ter duas ou três visitas, e "o mais visto" viraria sorteio. */
    prisma.propertyMetricEvent.groupBy({
      by: ["propertyId"],
      where: { tenantId, type: "VIEW", createdAt: { gte: seteDias } },
      _count: { _all: true },
      orderBy: { _count: { propertyId: "desc" } },
      take: 1,
    }),

    prisma.property.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: { _all: true },
      _sum: { price: true },
    }),

    prisma.property.count({ where: { tenantId, status: "ACTIVE", images: { none: {} } } }),

    /* Lead que chegou e ninguém encostou. É o número mais caro desta tela: o
       interessado já demonstrou intenção e está esperando. */
    prisma.propertyLead.count({ where: { tenantId, primeiroContatoEm: null } }),
    prisma.propertyLead.count({ where: { tenantId, responsavelId: null } }),

    prisma.venda.groupBy({
      by: ["usuarioId"],
      where: { tenantId, data: { gte: inicioMes } },
      _sum: { valor: true, comissao: true },
      _count: { _all: true },
    }),
    prisma.propertyLead.groupBy({
      by: ["responsavelId"],
      where: { tenantId, createdAt: { gte: inicioMes }, responsavelId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  // ── O imóvel em destaque ──────────────────────────────────────────────────
  let imovelDestaque = null;
  if (topImovel.length) {
    const p = await prisma.property.findFirst({
      where: { id: topImovel[0].propertyId, tenantId },
      select: {
        id: true, title: true, city: true, neighborhood: true, price: true,
        images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
      },
    });
    /* `p` pode ser null: o imóvel foi apagado depois de gerar os eventos. */
    if (p) {
      imovelDestaque = {
        id: p.id,
        title: p.title,
        local: [p.neighborhood, p.city].filter(Boolean).join(", ") || null,
        preco: num(p.price),
        foto: p.images[0]?.url || null,
        visitas: topImovel[0]._count._all,
      };
    }
  }

  // ── A equipe ──────────────────────────────────────────────────────────────
  const idsEquipe = [
    ...new Set([
      ...vendasPorUsuario.map((v) => v.usuarioId),
      ...leadsPorUsuario.map((l) => l.responsavelId),
    ].filter(Boolean)),
  ];

  /* Filtra por `tenantId` mesmo com os ids saindo de agrupamentos que já eram
     do tenant. Custa nada, e é o hábito que impede a próxima consulta de
     esquecer — os três vazamentos que este projeto teve nasceram assim. */
  const pessoas = idsEquipe.length
    ? await prisma.usuario.findMany({
        where: { id: { in: idsEquipe }, tenantId },
        select: { id: true, nome: true, foto: true, googleFoto: true },
      })
    : [];
  const porPessoa = new Map(pessoas.map((u) => [u.id, u]));

  const equipe = idsEquipe
    .map((id) => {
      const pessoa = porPessoa.get(id);
      if (!pessoa) return null; // usuário removido
      const v = vendasPorUsuario.find((x) => x.usuarioId === id);
      const l = leadsPorUsuario.find((x) => x.responsavelId === id);
      return {
        id,
        nome: pessoa.nome,
        foto: pessoa.foto || pessoa.googleFoto || null,
        vendas: v?._count?._all || 0,
        valor: num(v?._sum?.valor),
        comissao: num(v?._sum?.comissao),
        leads: l?._count?._all || 0,
      };
    })
    .filter(Boolean)
    /* Ordena por VALOR fechado, e o desempate é por leads atendidos: quem ainda
       não fechou mas está atendendo aparece acima de quem não fez nada. */
    .sort((a, b) => b.valor - a.valor || b.leads - a.leads)
    .slice(0, 5);

  // ── Acervo ────────────────────────────────────────────────────────────────
  const doStatus = (s) => acervo.find((a) => a.status === s);
  const ativos = doStatus("ACTIVE")?._count?._all || 0;
  const valorEmCarteira = num(doStatus("ACTIVE")?._sum?.price);

  const faturamento = num(vendasMes._sum.valor);
  const faturamentoAnterior = num(vendasMesAnterior._sum.valor);
  const qtdVendas = vendasMes._count._all;

  return {
    hoje: {
      interessados: leadsHoje,
      interessadosOntem: leadsOntem,
      visitas: eventosHoje,
      visitasOntem: eventosOntem,
    },
    mes: {
      faturamento,
      comissoes: num(vendasMes._sum.comissao),
      vendas: qtdVendas,
      // Ausência, não zero: sem venda no mês não existe ticket médio.
      ticketMedio: qtdVendas ? Math.round(faturamento / qtdVendas) : null,
      variacaoFaturamento: variacao(faturamento, faturamentoAnterior),
      visitas: eventosMes,
      leads: leadsMes,
      /* Conversão só quando há denominador. Uma imobiliária sem visita no mês
         não tem "0% de conversão" — ela não tem conversão. */
      visitaParaLead: eventosMes ? Math.round((leadsMes / eventosMes) * 1000) / 10 : null,
      leadParaVenda: leadsMes ? Math.round((qtdVendas / leadsMes) * 1000) / 10 : null,
    },
    imovelDestaque,
    equipe,
    atencao: {
      leadsSemResposta,
      leadsSemDono,
      imoveisSemFoto: semFoto,
      rascunhos: doStatus("DRAFT")?._count?._all || 0,
    },
    acervo: {
      ativos,
      inativos: doStatus("INACTIVE")?._count?._all || 0,
      valorEmCarteira,
    },
  };
}
