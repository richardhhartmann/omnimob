import jwt from "jsonwebtoken";
import { prisma } from "../db.js";
import { preencherContexto } from "../services/auditoria.js";

const JWT_SECRET = process.env.JWT_SECRET || "omnimob-dev-secret";

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

    /* Imobiliária desativada perde o painel — e isso já era a intenção escrita
       em `trialService` ("avisa quem acabou de perder o acesso"), só que nada
       verificava. Sem esta linha, o e-mail dizia que o teste acabou e a pessoa
       continuava usando o sistema normalmente até a remoção definitiva.

       A mensagem é específica porque o motivo é específico: um 403 genérico
       aqui faria a conta parecer quebrada em vez de vencida. */
    if (!tenant.ativo) {
      return res.status(403).json({
        error: "Esta conta está desativada. Assine um plano para voltar a usar o painel.",
        contaInativa: true,
      });
    }

    req.tenant = tenant;

    req.authUserId = payload.userId;
    req.authRole = payload.role;

    /* A imobiliária da trilha. Vem daqui e não do token porque é este o valor
       já conferido contra o cabeçalho `x-tenant-slug` — o mesmo que governa
       todo o filtro multi-tenant do sistema.

       `preencherContexto` abre o contexto se ainda não houver um, e chama o
       `next` por dentro dele. Ver `services/auditoria.js`. */
    return preencherContexto(req, { tenantId: tenant.id, usuarioId: payload.userId }, next);
  } catch {
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
}
