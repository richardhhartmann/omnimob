import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermissao } from "../middlewares/permissaoMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

/* Leitura da trilha de auditoria.
 *
 * Só leitura, e é o ponto: não existe rota para criar, editar ou apagar
 * registro. Trilha que o usuário pode reescrever não é trilha. A escrita
 * acontece sozinha, na camada de banco (`services/auditoria.js`), e a limpeza
 * por idade — se um dia fizer falta — é serviço de manutenção, não endpoint. */
export const auditoriaRouter = Router();
auditoriaRouter.use(requireTenant);
auditoriaRouter.use(requireAuth);
auditoriaRouter.use(requirePermissao("verAuditoria"));

const LIMITE_MAXIMO = 100;

auditoriaRouter.get("/", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(LIMITE_MAXIMO, Math.max(1, Number(req.query.limit) || 40));

    const { acao, entidade, usuarioId, busca, desde, ate } = req.query;

    const where = {
      tenantId: req.tenant.id,
      ...(acao ? { acao: String(acao) } : {}),
      ...(entidade ? { entidade: String(entidade) } : {}),
      ...(usuarioId ? { usuarioId: String(usuarioId) } : {}),
      ...(desde || ate
        ? {
            createdAt: {
              ...(desde ? { gte: new Date(String(desde)) } : {}),
              /* `ate` chega como data (2026-08-18) e significa o dia INTEIRO.
                 Sem o empurrão para o fim do dia, filtrar "até hoje" esconderia
                 tudo que aconteceu hoje — que é justamente o que se procura. */
              ...(ate ? { lte: new Date(`${String(ate).slice(0, 10)}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
      ...(busca
        ? {
            OR: [
              { resumo: { contains: String(busca), mode: "insensitive" } },
              { usuarioNome: { contains: String(busca), mode: "insensitive" } },
              { entidadeId: String(busca) },
            ],
          }
        : {}),
    };

    const [registros, total] = await Promise.all([
      prisma.auditoria.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditoria.count({ where }),
    ]);

    return res.json({ registros, total, page, limit });
  } catch (erro) {
    console.error("[GET /auditoria]", erro);
    return res.status(500).json({ error: "Erro ao buscar a trilha de auditoria." });
  }
});

/* As opções dos filtros, tiradas do que existe de fato na trilha desta
 * imobiliária — e não de uma lista fixa no front. Uma lista fixa ofereceria
 * "Venda" a quem nunca registrou uma, e esconderia um modelo novo até alguém
 * lembrar de atualizar os dois lados. */
auditoriaRouter.get("/filtros", async (req, res) => {
  try {
    const [entidades, pessoas] = await Promise.all([
      prisma.auditoria.groupBy({
        by: ["entidade"],
        where: { tenantId: req.tenant.id },
        _count: { entidade: true },
        orderBy: { _count: { entidade: "desc" } },
      }),
      prisma.auditoria.groupBy({
        by: ["usuarioId", "usuarioNome"],
        where: { tenantId: req.tenant.id, usuarioId: { not: null } },
        _count: { usuarioId: true },
      }),
    ]);

    return res.json({
      entidades: entidades.map((e) => ({ valor: e.entidade, total: e._count.entidade })),
      usuarios: pessoas
        .map((p) => ({ id: p.usuarioId, nome: p.usuarioNome || "(sem nome)", total: p._count.usuarioId }))
        .sort((a, b) => b.total - a.total),
    });
  } catch (erro) {
    console.error("[GET /auditoria/filtros]", erro);
    return res.status(500).json({ error: "Erro ao carregar os filtros." });
  }
});
