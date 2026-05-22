import jwt from "jsonwebtoken";
import { prisma } from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET || "domus-dev-secret";

export async function requireTenant(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "Autenticacao necessaria." });
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Token invalido ou expirado." });
  }

  const tenantSlug = req.header("x-tenant-slug");
  if (!tenantSlug) {
    return res.status(400).json({ error: "Header x-tenant-slug e obrigatorio." });
  }

  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant || tenant.id !== payload.tenantId) {
      return res.status(403).json({ error: "Acesso nao autorizado para este tenant." });
    }

    req.tenant = tenant;
    req.authUserId = payload.userId;
    req.authRole = payload.role;
    return next();
  } catch {
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
}
