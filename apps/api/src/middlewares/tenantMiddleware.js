import { prisma } from "../db.js";

export async function requireTenant(req, res, next) {
  const tenantSlug = req.header("x-tenant-slug");

  if (!tenantSlug) {
    return res.status(400).json({ error: "Header x-tenant-slug e obrigatorio." });
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) {
    return res.status(404).json({ error: "Tenant nao encontrado." });
  }

  req.tenant = tenant;
  return next();
}
