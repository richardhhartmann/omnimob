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
    /* O `id` entra porque as rotas do segundo fator precisam ler e escrever a
       PRÓPRIA linha; até aqui o e-mail bastava porque nada era por conta. */
    req.superAdmin = { id: payload.superAdminId, email: payload.email };
    return next();
  } catch {
    return res.status(401).json({ error: "Token invalido ou expirado." });
  }
}
