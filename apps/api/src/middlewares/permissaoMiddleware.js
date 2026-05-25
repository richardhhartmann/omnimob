import { prisma } from "../db.js";

// Aceita uma ou mais chaves — passa se o cargo tiver QUALQUER UMA delas
export function requirePermissao(...keys) {
  return async (req, res, next) => {
    if (!req.authCargoCodigo) {
      return res.status(403).json({ error: "Permissão negada." });
    }
    try {
      const select = Object.fromEntries(keys.map((k) => [k, true]));
      const cargo = await prisma.cargo.findUnique({
        where: { id: req.authCargoCodigo },
        select,
      });
      if (!cargo || !keys.some((k) => cargo[k])) {
        return res.status(403).json({ error: "Permissão negada." });
      }
      return next();
    } catch {
      return res.status(500).json({ error: "Erro ao verificar permissão." });
    }
  };
}
