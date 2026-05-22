import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { createTenantSchema, updateTenantProfileSchema } from "../validators/propertyValidators.js";

export const tenantRouter = Router();

tenantRouter.get("/", requireAuth, async (req, res) => {
  try {
    const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: "asc" } });
    return res.json(tenants);
  } catch {
    return res.status(500).json({ error: "Erro ao listar tenants." });
  }
});

tenantRouter.post("/", requireAuth, async (req, res) => {
  try {
    if (req.authRole !== "ADMIN") {
      return res.status(403).json({ error: "Apenas administradores podem criar tenants." });
    }

    const parsed = createTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados invalidos para tenant.", details: parsed.error.flatten() });
    }

    const tenant = await prisma.tenant.create({ data: parsed.data });
    return res.status(201).json(tenant);
  } catch (error) {
    return res.status(409).json({
      error: "Nao foi possivel criar tenant. Verifique slug unico.",
      details: error instanceof Error ? error.message : "Conflito",
    });
  }
});

tenantRouter.get("/me", requireTenant, async (req, res) => {
  try {
    return res.json(req.tenant);
  } catch {
    return res.status(500).json({ error: "Erro ao buscar perfil do tenant." });
  }
});

tenantRouter.put("/me", requireTenant, async (req, res) => {
  try {
    const parsed = updateTenantProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados invalidos para atualizar tenant.", details: parsed.error.flatten() });
    }

    const tenant = await prisma.tenant.update({
      where: { id: req.tenant.id },
      data: parsed.data,
    });

    return res.json(tenant);
  } catch {
    return res.status(500).json({ error: "Erro ao atualizar perfil do tenant." });
  }
});
