import { Router } from "express";
import { prisma } from "../db.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { createTenantSchema, updateTenantProfileSchema } from "../validators/propertyValidators.js";

export const tenantRouter = Router();

tenantRouter.get("/", async (_req, res) => {
  const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: "asc" } });
  return res.json(tenants);
});

tenantRouter.post("/", async (req, res) => {
  const parsed = createTenantSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados invalidos para tenant.", details: parsed.error.flatten() });
  }

  try {
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
  return res.json(req.tenant);
});

tenantRouter.put("/me", requireTenant, async (req, res) => {
  const parsed = updateTenantProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados invalidos para atualizar tenant.", details: parsed.error.flatten() });
  }

  const tenant = await prisma.tenant.update({
    where: { id: req.tenant.id },
    data: parsed.data,
  });

  return res.json(tenant);
});
