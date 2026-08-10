import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "omnimob-dev-secret";

export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "Autenticacao necessaria." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.authUserId = payload.userId;
    req.authTenantId = payload.tenantId;
    req.authCargoCodigo = payload.cargoCodigo;
    return next();
  } catch {
    return res.status(401).json({ error: "Token invalido ou expirado." });
  }
}
