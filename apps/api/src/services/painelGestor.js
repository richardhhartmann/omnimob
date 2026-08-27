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

/* ────────────────────────────────────────────────────────────────────────────
   AS SÉRIES

   ── POR QUE SQL CRU AQUI ──

   O Prisma não agrupa por dia: `groupBy` agrupa por VALOR de coluna, e
   `createdAt` é um instante — trinta visitas num dia viram trinta grupos. Dava
   para trazer as linhas e agrupar em JavaScript, e é o que se faz quando são
   dezenas; numa imobiliária com movimento a série de 30 dias são milhares de
   eventos atravessando a rede para virar 30 números.

   `date_trunc` resolve no banco e devolve exatamente as 30 linhas.

   ── E POR QUE O ZERO-FILL É OBRIGATÓRIO ──

   O banco só devolve os dias em que ALGO aconteceu. Um gráfico desenhado
   direto desse resultado une sexta a segunda com uma reta e esconde que o fim
   de semana foi vazio — a linha sobe suave onde na verdade houve dois dias
   sem ninguém. É o oposto da regra desta tela: aqui o zero é um fato medido
   (o dia existiu e não teve visita), diferente do `null` de "não há como
   calcular" que o resto do arquivo usa. */
function moldeDeDias(quantos) {
  const dias = [];
  for (let i = quantos - 1; i >= 0; i -= 1) {
    const d = diasAtras(i);
    dias.push({ dia: d.toISOString().slice(0, 10), visitas: 0, leads: 0 });
  }
  return dias;
}

function moldeDeMeses(quantos) {
  const agora = new Date();
  const meses = [];
  for (let i = quantos - 1; i >= 0; i -= 1) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    meses.push({
      mes: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      faturamento: 0,
      vendas: 0,
      leads: 0,
    });
  }
  return meses;
}

/* Os seis estágios SEMPRE saem, mesmo zerados — um funil com três barras
   porque três estágios estão vazios não é um funil, é um recorte. */
const ESTAGIOS_LEAD = ["NOVO", "EM_ATENDIMENTO", "VISITA", "PROPOSTA", "GANHO", "PERDIDO"];

export async function montarPainelGestor(tenantId) {
  const hoje = inicioDoDia();
  const ontem = diasAtras(1);
  const seteDias = diasAtras(7);

  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const inicioMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);

  // Janelas das séries. 30 dias desenha um mês de movimento; 6 meses mostra
  // sazonalidade sem virar uma linha ilegível de doze pontos espremidos.
  const trintaDias = diasAtras(29);
  const noventaDias = diasAtras(90);
  const seisMeses = new Date(agora.getFullYear(), agora.getMonth() - 5, 1);

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

  /* ── SEGUNDO LOTE, e a razão é o POOL ───────────────────────────────────────

     Estas seis consultas nasceram dentro do `Promise.all` de cima. Com elas o
     painel disparava 21 consultas simultâneas, e o pooler do Supabase em modo
     sessão aceita 15: a resposta virava
     `FATAL: (EMAXCONNSESSION) max clients reached`, e não só nesta rota — as
     conexões estouradas derrubavam tudo que estivesse rodando junto, o que fez
     doze testes de arquivos diferentes falharem de uma vez.

     Um `await` a mais custa uma ida ao banco (~40 ms). Vale: o painel é a
     primeira tela depois do login, e não pode ser a que consome o pool inteiro
     da instalação. E o teto do pool é do AMBIENTE — mesmo com o pooler de
     transação bem configurado, uma rota que precisa de 21 conexões ao mesmo
     tempo é uma rota que vai estourar em algum lugar.

     ── As séries ──────────────────────────────────────────────────────────
       `$queryRaw` com template tag: os valores viajam como PARÂMETRO, não
       concatenados no texto do SQL. `tenantId` vem do middleware e não da URL,
       mas a regra não abre exceção — foi assim que os três vazamentos deste
       projeto começaram, cada um por um caminho que parecia seguro.

     `::date` no lugar de `date_trunc('day', …)`: o resultado é o mesmo e sai
     como data pura, sem fuso pendurado para o JavaScript reinterpretar. */
  const [
    visitasPorDia,
    leadsPorDia,
    vendasPorMes,
    leadsPorMes,
    leadsPorEstagio,
    leadsPorOrigem,
  ] = await Promise.all([
    prisma.$queryRaw`
      SELECT "createdAt"::date AS dia, COUNT(*)::int AS total
      FROM "PropertyMetricEvent"
      WHERE "tenantId" = ${tenantId} AND "type" = 'VIEW' AND "createdAt" >= ${trintaDias}
      GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw`
      SELECT "createdAt"::date AS dia, COUNT(*)::int AS total
      FROM "PropertyLead"
      WHERE "tenantId" = ${tenantId} AND "createdAt" >= ${trintaDias}
      GROUP BY 1 ORDER BY 1`,

    /* ── A venda NÃO passa por SQL cru, e a razão é uma cicatriz ───────────
       `Venda` mora em `tb_venda` e o campo `data` na coluna `ven_data`
       (`@@map`/`@map` no schema). Escrito como as outras — `FROM "Venda"` —,
       o Postgres respondeu `relation "Venda" does not exist` e o painel
       inteiro virou "Erro ao montar o painel". A tabela de mapeamento não
       aparece em lugar nenhum de quem escreve a query; ela é invisível até
       quebrar.

       Aqui não custa nada evitar: venda é o registro de MENOR volume do
       sistema — seis meses são dezenas de linhas, não milhares —, então
       buscar e agrupar em JavaScript vale o seguro. O SQL cru fica só onde o
       volume justifica (visitas), e nas tabelas cujo nome não é mapeado. */
    prisma.venda.findMany({
      where: { tenantId, data: { gte: seisMeses } },
      select: { data: true, valor: true },
    }),
    prisma.$queryRaw`
      SELECT to_char("createdAt", 'YYYY-MM') AS mes, COUNT(*)::int AS total
      FROM "PropertyLead"
      WHERE "tenantId" = ${tenantId} AND "createdAt" >= ${seisMeses}
      GROUP BY 1 ORDER BY 1`,

    prisma.propertyLead.groupBy({
      by: ["estagio"],
      where: { tenantId },
      _count: { _all: true },
    }),

    /* De onde o interessado veio. `source` é texto livre com padrão
       "showcase", e hoje recebe também o nome do portal na captação do Flow —
       por isso a leitura é tolerante e o desconhecido não é descartado. */
    prisma.propertyLead.groupBy({
      by: ["source"],
      where: { tenantId, createdAt: { gte: noventaDias } },
      _count: { _all: true },
      orderBy: { _count: { source: "desc" } },
      take: 6,
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

  /* ── As séries, do resultado cru ao molde zero-filled ────────────────────
     O banco devolve só os dias com movimento; o molde tem todos. Casar os dois
     por chave preenche o resto com zero — ver `moldeDeDias`. */
  const porDia = new Map(moldeDeDias(30).map((d) => [d.dia, d]));
  const chaveDeDia = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
  for (const linha of visitasPorDia) {
    const alvo = porDia.get(chaveDeDia(linha.dia));
    if (alvo) alvo.visitas = Number(linha.total) || 0;
  }
  for (const linha of leadsPorDia) {
    const alvo = porDia.get(chaveDeDia(linha.dia));
    if (alvo) alvo.leads = Number(linha.total) || 0;
  }

  const porMes = new Map(moldeDeMeses(6).map((m) => [m.mes, m]));
  for (const venda of vendasPorMes) {
    const d = new Date(venda.data);
    const alvo = porMes.get(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    if (!alvo) continue;
    alvo.faturamento += num(venda.valor);
    alvo.vendas += 1;
  }
  for (const linha of leadsPorMes) {
    const alvo = porMes.get(linha.mes);
    if (alvo) alvo.leads = Number(linha.total) || 0;
  }

  const contagemPorEstagio = new Map(
    leadsPorEstagio.map((l) => [l.estagio, l._count._all]),
  );

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

    /* ── O que os gráficos leem ─────────────────────────────────────────────
       Sempre completos e sempre na mesma forma, com ou sem movimento: um
       gráfico que às vezes vem com 30 pontos e às vezes com 4 obrigaria a tela
       a adivinhar a escala do eixo, e o desenho mudaria de significado sem
       avisar. */
    serie: [...porDia.values()],
    meses: [...porMes.values()],
    funil: ESTAGIOS_LEAD.map((estagio) => ({
      estagio,
      total: contagemPorEstagio.get(estagio) || 0,
    })),
    origens: leadsPorOrigem.map((o) => ({
      origem: o.source || "desconhecida",
      total: o._count._all,
    })),
  };
}
