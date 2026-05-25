import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermissao } from "../middlewares/permissaoMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

export const leadRouter = Router();
leadRouter.use(requireTenant);
leadRouter.use(requireAuth);
leadRouter.use(requirePermissao("gerenciarLeads"));

leadRouter.get("/", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const { propertyId } = req.query;

    const where = {
      tenantId: req.tenant.id,
      ...(propertyId ? { propertyId } : {}),
    };

    const [leads, total] = await Promise.all([
      prisma.propertyLead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { property: { select: { id: true, title: true } } },
        skip,
        take: limit,
      }),
      prisma.propertyLead.count({ where }),
    ]);

    return res.json({ leads, total, page, limit });
  } catch {
    return res.status(500).json({ error: "Erro ao buscar leads." });
  }
});

leadRouter.get("/:id", async (req, res) => {
  try {
    const lead = await prisma.propertyLead.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      include: { property: { select: { id: true, title: true } } },
    });
    if (!lead) {
      return res.status(404).json({ error: "Lead nao encontrado." });
    }
    return res.json(lead);
  } catch {
    return res.status(500).json({ error: "Erro ao buscar lead." });
  }
});

leadRouter.delete("/:id", async (req, res) => {
  try {
    const lead = await prisma.propertyLead.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
    });
    if (!lead) {
      return res.status(404).json({ error: "Lead nao encontrado." });
    }
    await prisma.propertyLead.delete({ where: { id: lead.id } });
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "Erro ao deletar lead." });
  }
});
