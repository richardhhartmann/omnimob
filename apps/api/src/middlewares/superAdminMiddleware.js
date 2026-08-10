import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "omnimob-dev-secret";

export function requireSuperAdmin(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "Autenticacao necessaria." });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== "SUPERADMIN") {
      return res.status(403).json({ error: "Acesso restrito ao super-admin." });
    }
    req.superAdmin = { email: payload.email };
    return next();
  } catch {
    return res.status(401).json({ error: "Token invalido ou expirado." });
  }
}
