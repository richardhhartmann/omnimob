import { prisma } from "../db.js";

/* Aceita uma ou mais chaves — passa se o cargo tiver QUALQUER UMA delas.
 *
 * O cargo normalmente já veio no `requireAuth`, que o carrega junto com o
 * usuário. A consulta abaixo é a rede de segurança para uma rota que use este
 * middleware sem aquele — nesse caso ela também não teria `authCargoCodigo`, e
 * a resposta correta continua sendo 403. */
export function requirePermissao(...keys) {
  return async (req, res, next) => {
    try {
      let cargo = req.authCargo;
      if (!cargo) {
        if (!req.authCargoCodigo) {
          return res.status(403).json({ error: "Permissão negada." });
        }
        const select = Object.fromEntries(keys.map((k) => [k, true]));
        cargo = await prisma.cargo.findUnique({ where: { id: req.authCargoCodigo }, select });
      }
      if (!cargo || !keys.some((k) => cargo[k])) {
        return res.status(403).json({ error: "Permissão negada." });
      }
      return next();
    } catch {
      return res.status(500).json({ error: "Erro ao verificar permissão." });
    }
  };
}
