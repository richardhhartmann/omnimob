import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { requirePermissao } from "../middlewares/permissaoMiddleware.js";
import { requirePlano } from "../middlewares/planoMiddleware.js";

/* ────────────────────────────────────────────────────────────────────────────
   Funil de vendas e comissões — Profissional e Premium.

   O model `Venda` existia no schema desde o começo e não tinha uma única rota:
   aparecia só nas guardas de exclusão de cliente e de usuário ("este cliente
   tem venda registrada e não pode ser excluído"). Ou seja, o banco já sabia
   proteger um histórico que ninguém tinha como escrever.

   TRÊS chaves estrangeiras, e as três precisam ser DESTA imobiliária: imóvel,
   cliente e corretor. Uma venda que aponte para o cliente de outra empresa não
   é um vazamento de leitura — é um registro financeiro cruzado, que depois
   aparece na comissão de quem não vendeu. Por isso a validação abaixo confere
   os três antes de gravar, e não confia em nenhum id vindo do corpo.
   ──────────────────────────────────────────────────────────────────────────── */

export const vendaRouter = Router();
vendaRouter.use(requireAuth);
vendaRouter.use(requireTenant);
vendaRouter.use(requirePlano(1, "Profissional"));

const vendaSchema = z.object({
  propertyId: z.string().min(1, "Escolha o imóvel."),
  clienteId: z.string().min(1, "Escolha o cliente."),
  usuarioId: z.string().min(1, "Escolha o corretor."),
  tipo: z.enum(["VENDA", "ALUGUEL"]),
  valor: z.coerce.number().positive("O valor precisa ser maior que zero."),
  // Data sem hora: o que importa é o dia do fechamento, e hora local vira
  // fonte de erro de fuso na hora de somar o mês.
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  comissao: z.coerce.number().min(0).optional().nullable(),
  observacoes: z.string().trim().max(2000).optional().nullable(),
});

function serializar(v) {
  return {
    id: v.id,
    tipo: v.tipo,
    valor: Number(v.valor),
    comissao: v.comissao === null ? null : Number(v.comissao),
    data: v.data,
    observacoes: v.observacoes,
    property: v.property ? { id: v.property.id, title: v.property.title } : null,
    cliente: v.cliente ? { id: v.cliente.id, nome: v.cliente.nome } : null,
    usuario: v.usuario ? { id: v.usuario.id, nome: v.usuario.nome } : null,
    createdAt: v.createdAt,
  };
}

const INCLUDE = {
  property: { select: { id: true, title: true } },
  cliente: { select: { id: true, nome: true } },
  usuario: { select: { id: true, nome: true } },
};

/** Confere que imóvel, cliente e corretor são todos desta imobiliária. */
async function validarVinculos(tenantId, { propertyId, clienteId, usuarioId }) {
  const [imovel, cliente, usuario] = await Promise.all([
    prisma.property.findFirst({ where: { id: propertyId, tenantId }, select: { id: true } }),
    prisma.cliente.findFirst({ where: { id: clienteId, tenantId }, select: { id: true } }),
    prisma.usuario.findFirst({ where: { id: usuarioId, tenantId }, select: { id: true } }),
  ]);
  if (!imovel) return "Imóvel não encontrado.";
  if (!cliente) return "Cliente não encontrado.";
  if (!usuario) return "Corretor não encontrado.";
  return null;
}

// ─── Lista ───────────────────────────────────────────────────────────────────
vendaRouter.get("/", requirePermissao("verRelatorios"), async (req, res) => {
  try {
    const { de, ate, usuarioId, tipo } = req.query;
    const where = { tenantId: req.tenant.id };
    if (usuarioId) where.usuarioId = String(usuarioId);
    if (tipo === "VENDA" || tipo === "ALUGUEL") where.tipo = tipo;
    if (de || ate) {
      where.data = {};
      if (de) where.data.gte = new Date(`${de}T00:00:00`);
      if (ate) where.data.lte = new Date(`${ate}T23:59:59`);
    }

    const vendas = await prisma.venda.findMany({
      where,
      orderBy: { data: "desc" },
      take: 300,
      include: INCLUDE,
    });
    return res.json({ vendas: vendas.map(serializar) });
  } catch (err) {
    console.error("[GET /vendas]", err);
    return res.status(500).json({ error: "Erro ao listar vendas." });
  }
});

/* ── Resumo: o funil e as comissões ──────────────────────────────────────────
   Duas telas comem deste mesmo endpoint. O funil é a passagem de VISITA →
   LEAD → VENDA, que só faz sentido lida em conjunto: número de venda solto não
   diz se o problema está em atrair ou em fechar.

   As duas primeiras etapas saem de PropertyMetricEvent (o mesmo lugar de onde
   o relatório mensal tira os números — de propósito: dois cálculos diferentes
   para "quantas visitas" seria a garantia de duas respostas diferentes). */
vendaRouter.get("/resumo", requirePermissao("verRelatorios"), async (req, res) => {
  try {
    const { de, ate } = req.query;
    const janela = {};
    if (de) janela.gte = new Date(`${de}T00:00:00`);
    if (ate) janela.lte = new Date(`${ate}T23:59:59`);
    const temJanela = Boolean(de || ate);

    const whereVenda = { tenantId: req.tenant.id, ...(temJanela ? { data: janela } : {}) };
    const whereEvento = { tenantId: req.tenant.id, ...(temJanela ? { createdAt: janela } : {}) };

    const [porTipo, porCorretor, eventos] = await Promise.all([
      prisma.venda.groupBy({
        by: ["tipo"],
        where: whereVenda,
        _count: { _all: true },
        _sum: { valor: true, comissao: true },
      }),
      prisma.venda.groupBy({
        by: ["usuarioId"],
        where: whereVenda,
        _count: { _all: true },
        _sum: { valor: true, comissao: true },
      }),
      prisma.propertyMetricEvent.groupBy({
        by: ["type"],
        where: whereEvento,
        _count: { _all: true },
      }),
    ]);

    // O nome do corretor numa segunda consulta, também filtrada por tenant.
    const nomes = porCorretor.length
      ? await prisma.usuario.findMany({
          where: { id: { in: porCorretor.map((c) => c.usuarioId) }, tenantId: req.tenant.id },
          select: { id: true, nome: true },
        })
      : [];
    const porId = new Map(nomes.map((u) => [u.id, u.nome]));

    const totalDe = (chave) =>
      porTipo.reduce((acc, t) => acc + Number(t._sum?.[chave] ?? 0), 0);
    const contar = (lista, tipo) => lista.find((e) => e.type === tipo)?._count?._all ?? 0;

    const visitas = contar(eventos, "VIEW");
    const leads = contar(eventos, "LEAD");
    const fechamentos = porTipo.reduce((acc, t) => acc + t._count._all, 0);

    return res.json({
      funil: {
        visitas,
        leads,
        vendas: fechamentos,
        // Cada taxa sobre a etapa ANTERIOR, e não sobre o topo: é assim que se
        // enxerga ONDE o funil aperta. Null sem base, para não inventar 0%.
        visitaParaLead: visitas > 0 ? Math.round((leads / visitas) * 1000) / 10 : null,
        leadParaVenda: leads > 0 ? Math.round((fechamentos / leads) * 1000) / 10 : null,
      },
      totais: {
        quantidade: fechamentos,
        valor: totalDe("valor"),
        comissao: totalDe("comissao"),
      },
      porTipo: porTipo.map((t) => ({
        tipo: t.tipo,
        quantidade: t._count._all,
        valor: Number(t._sum.valor ?? 0),
        comissao: Number(t._sum.comissao ?? 0),
      })),
      porCorretor: porCorretor
        .map((c) => ({
          usuarioId: c.usuarioId,
          nome: porId.get(c.usuarioId) || "—",
          quantidade: c._count._all,
          valor: Number(c._sum.valor ?? 0),
          comissao: Number(c._sum.comissao ?? 0),
        }))
        .sort((a, b) => b.comissao - a.comissao || b.valor - a.valor),
    });
  } catch (err) {
    console.error("[GET /vendas/resumo]", err);
    return res.status(500).json({ error: "Erro ao montar o resumo." });
  }
});

// ─── Registrar ───────────────────────────────────────────────────────────────
vendaRouter.post("/", requirePermissao("gerenciarClientes"), async (req, res) => {
  const parsed = vendaSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
  }

  try {
    const erro = await validarVinculos(req.tenant.id, parsed.data);
    if (erro) return res.status(404).json({ error: erro });

    const { data, valor, comissao, ...resto } = parsed.data;
    const venda = await prisma.venda.create({
      data: {
        ...resto,
        tenantId: req.tenant.id,
        valor,
        comissao: comissao ?? null,
        data: new Date(`${data}T12:00:00`), // meio-dia: imune a fuso na virada
      },
      include: INCLUDE,
    });

    /* `saleCount` do imóvel e o evento de métrica andam juntos com a venda: o
       relatório mensal lê SALE de PropertyMetricEvent, e sem este registro uma
       venda existiria no funil e não no relatório — dois números para o mesmo
       fato. */
    await Promise.all([
      prisma.property.update({
        where: { id: venda.propertyId },
        data: { saleCount: { increment: 1 } },
      }),
      prisma.propertyMetricEvent.create({
        data: { tenantId: req.tenant.id, propertyId: venda.propertyId, type: "SALE" },
      }),
    ]);

    return res.status(201).json(serializar(venda));
  } catch (err) {
    console.error("[POST /vendas]", err);
    return res.status(500).json({ error: "Erro ao registrar a venda." });
  }
});

// ─── Remover ─────────────────────────────────────────────────────────────────
vendaRouter.delete("/:id", requirePermissao("gerenciarClientes"), async (req, res) => {
  try {
    // findFirst com tenantId, e delete pelo id encontrado: `delete` direto pelo
    // id do parâmetro apagaria a venda de qualquer imobiliária.
    const venda = await prisma.venda.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
    });
    if (!venda) return res.status(404).json({ error: "Venda não encontrada." });

    await prisma.venda.delete({ where: { id: venda.id } });
    // Desfaz o contador junto. Sem isto, apagar uma venda deixaria o imóvel
    // marcado como vendido para sempre.
    await prisma.property.update({
      where: { id: venda.propertyId },
      data: { saleCount: { decrement: 1 } },
    }).catch(() => {});

    return res.status(204).send();
  } catch (err) {
    console.error("[DELETE /vendas/:id]", err);
    return res.status(500).json({ error: "Erro ao remover a venda." });
  }
});
