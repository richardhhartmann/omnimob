import jwt from "jsonwebtoken";
import { prisma } from "../db.js";
import { preencherContexto } from "../services/auditoria.js";
import { permissoesVazias, PERMISSOES_SUPER_ADMIN } from "../services/permissoesSuperAdmin.js";

const JWT_SECRET = process.env.JWT_SECRET || "omnimob-dev-secret";

/* ────────────────────────────────────────────────────────────────────────────
   O token diz QUEM; o banco diz SE AINDA VALE e O QUE ALCANÇA.

   É a mesma regra do `requireAuth` do Hub, pelo mesmo motivo: o token dura
   sete dias, e enquanto o cargo vinha só dele, rebaixar ou desativar alguém
   não surtia efeito nenhum até o token vencer. Uma consulta por requisição,
   pela chave primária, com o cargo no mesmo `include`.

   O cargo vira `req.superAdmin.permissoes` já normalizado: sem cargo, tudo
   `false`. Nulo é "sem permissão", nunca "tudo".
   ──────────────────────────────────────────────────────────────────────────── */
export async function requireSuperAdmin(req, res, next) {
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
  if (payload.role !== "SUPERADMIN") {
    return res.status(403).json({ error: "Acesso restrito ao super-admin." });
  }

  try {
    const admin = await prisma.superAdmin.findUnique({
      where: { id: String(payload.superAdminId || "") },
      select: { id: true, nome: true, email: true, ativo: true, cargoId: true, cargo: true },
    });
    /* `sessaoEncerrada` como no painel: a tela distingue "sua sessão acabou"
       de "seu acesso foi retirado" — e desloga avisando. */
    if (!admin || !admin.ativo) {
      return res.status(401).json({ error: "Seu acesso à plataforma foi encerrado.", sessaoEncerrada: true });
    }

    req.superAdmin = {
      id: admin.id,
      email: admin.email,
      nome: admin.nome,
      cargoId: admin.cargoId,
      cargoNome: admin.cargo?.nome || null,
      permissoes: permissoesDoCargo(admin.cargo),
    };

    /* O "quem" da trilha. `plataforma: true` é o que faz a extensão do Prisma
       registrar as escritas em `SuperAdmin` e `CargoSuperAdmin` sem
       imobiliária nenhuma — ver `services/auditoria.js`. */
    return preencherContexto(
      req,
      { usuarioId: admin.id, usuarioNome: `Omnimob (${admin.email})`, plataforma: true },
      next,
    );
  } catch (erro) {
    console.error("[requireSuperAdmin]", erro);
    return res.status(500).json({ error: "Erro ao validar a sessao." });
  }
}

/** As permissões de um cargo, só as colunas conhecidas; sem cargo, nada. */
export function permissoesDoCargo(cargo) {
  const base = permissoesVazias();
  if (!cargo) return base;
  for (const p of PERMISSOES_SUPER_ADMIN) base[p] = Boolean(cargo[p]);
  return base;
}

/* Aceita uma ou mais chaves — passa se o cargo tiver QUALQUER UMA delas, como o
   `requirePermissao` do Hub. Pressupõe `requireSuperAdmin` antes; sem ele não há
   `req.superAdmin`, e a resposta certa continua sendo 403. */
export function requirePermissaoAdmin(...chaves) {
  return (req, res, next) => {
    const permissoes = req.superAdmin?.permissoes;
    if (!permissoes || !chaves.some((c) => permissoes[c])) {
      return res.status(403).json({ error: "Seu cargo não permite esta ação.", code: "SEM_PERMISSAO" });
    }
    return next();
  };
}
