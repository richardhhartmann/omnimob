import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { loginSchema } from "../validators/authValidators.js";

const JWT_SECRET = process.env.JWT_SECRET || "domus-dev-secret";

export const authRouter = Router();

// Monta o payload de sessão (token + usuario + tenant) devolvido no login e ao
// definir a senha. `usuario` deve vir com include { tenant, cargo }.
function montarSessao(usuario) {
  const token = jwt.sign(
    { userId: usuario.id, tenantId: usuario.tenantId, cargoCodigo: usuario.cargoCodigo },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  return {
    token,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      login: usuario.login,
      cargo: {
        id: usuario.cargo.id,
        descricao: usuario.cargo.descricao,
        acessarPainel: usuario.cargo.acessarPainel,
        editarPagina: usuario.cargo.editarPagina,
        gerenciarImoveis: usuario.cargo.gerenciarImoveis,
        gerenciarLeads: usuario.cargo.gerenciarLeads,
        gerenciarUsuarios: usuario.cargo.gerenciarUsuarios,
        gerenciarClientes: usuario.cargo.gerenciarClientes,
        gerenciarCargos: usuario.cargo.gerenciarCargos,
        verRelatorios: usuario.cargo.verRelatorios,
        publicarRedes: usuario.cargo.publicarRedes,
      },
    },
    tenant: {
      id: usuario.tenant.id,
      name: usuario.tenant.name,
      slug: usuario.tenant.slug,
      whatsapp: usuario.tenant.whatsapp,
      email: usuario.tenant.email,
      description: usuario.tenant.description,
      slogan: usuario.tenant.slogan,
      logoUrl: usuario.tenant.logoUrl,
      primaryColor: usuario.tenant.primaryColor,
      secondaryColor: usuario.tenant.secondaryColor,
      showcaseHeadline: usuario.tenant.showcaseHeadline,
      showcaseSubheadline: usuario.tenant.showcaseSubheadline,
      showcaseConfig: usuario.tenant.showcaseConfig,
      plano: (usuario.tenant.plano || "BASICO").toUpperCase(),
      autoGerarIA: usuario.tenant.autoGerarIA,
    },
  };
}

authRouter.post("/login", async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados invalidos para login.", details: parsed.error.flatten() });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { login: parsed.data.login },
      include: { tenant: true, cargo: true },
    });

    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ error: "Usuario ou senha invalidos." });
    }

    // Usuário recém-criado ainda pode não ter senha definida. Nesse caso o
    // primeiro acesso não valida senha: cai direto na tela de definir senha.
    const temSenha = Boolean(usuario.senha);
    if (temSenha) {
      const passwordMatch = await bcrypt.compare(parsed.data.senha, usuario.senha);
      if (!passwordMatch) {
        return res.status(401).json({ error: "Usuario ou senha invalidos." });
      }
    }

    // Sem senha (ativação) OU marcado para trocar → exige definir nova senha.
    if (!temSenha || usuario.forcaAlterarSenha) {
      return res.status(403).json({
        error: "Defina sua senha para continuar.",
        forcaAlterarSenha: true,
        login: usuario.login,
      });
    }

    return res.json(montarSessao(usuario));
  } catch (err) {
    console.error("[POST /auth/login]", err);
    return res.status(500).json({ error: "Erro interno no servidor.", detail: err.message });
  }
});

// Define uma nova senha (primeiro acesso ou troca obrigatória) e já autentica.
// Se o usuário já tiver senha, exige a senha atual; se não tiver (ativação), não.
authRouter.post("/definir-senha", async (req, res) => {
  try {
    const { login, senhaAtual, novaSenha } = req.body || {};
    if (!login || !novaSenha) {
      return res.status(400).json({ error: "Login e nova senha são obrigatórios." });
    }
    if (String(novaSenha).length < 6) {
      return res.status(400).json({ error: "A nova senha deve ter ao menos 6 caracteres." });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { login: String(login) },
      include: { tenant: true, cargo: true },
    });
    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ error: "Usuário inválido." });
    }

    // Se já existe senha, a senha atual precisa conferir (evita troca por terceiros).
    if (usuario.senha) {
      const ok = await bcrypt.compare(String(senhaAtual || ""), usuario.senha);
      if (!ok) return res.status(401).json({ error: "Senha atual incorreta." });
    }

    const senhaHash = await bcrypt.hash(String(novaSenha), 10);
    const atualizado = await prisma.usuario.update({
      where: { id: usuario.id },
      data: { senha: senhaHash, forcaAlterarSenha: false },
      include: { tenant: true, cargo: true },
    });

    return res.json(montarSessao(atualizado));
  } catch (err) {
    console.error("[POST /auth/definir-senha]", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});

authRouter.get("/me", requireAuth, requireTenant, async (req, res) => {
  try {
    const usuario = await prisma.usuario.findFirst({
      where: { id: req.authUserId, tenantId: req.tenant.id },
      include: { cargo: true },
    });
    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ error: "Sessão inválida." });
    }
    return res.json({
      id: usuario.id,
      nome: usuario.nome,
      login: usuario.login,
      cargo: {
        id: usuario.cargo.id,
        descricao: usuario.cargo.descricao,
        acessarPainel: usuario.cargo.acessarPainel,
        editarPagina: usuario.cargo.editarPagina,
        gerenciarImoveis: usuario.cargo.gerenciarImoveis,
        gerenciarLeads: usuario.cargo.gerenciarLeads,
        gerenciarUsuarios: usuario.cargo.gerenciarUsuarios,
        gerenciarClientes: usuario.cargo.gerenciarClientes,
        gerenciarCargos: usuario.cargo.gerenciarCargos,
        verRelatorios: usuario.cargo.verRelatorios,
        publicarRedes: usuario.cargo.publicarRedes,
      },
    });
  } catch (err) {
    console.error("[GET /auth/me]", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});
