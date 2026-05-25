import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { loginSchema } from "../validators/authValidators.js";

const JWT_SECRET = process.env.JWT_SECRET || "domus-dev-secret";

export const authRouter = Router();

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

    const passwordMatch = await bcrypt.compare(parsed.data.senha, usuario.senha);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Usuario ou senha invalidos." });
    }

    if (usuario.forcaAlterarSenha) {
      return res.status(403).json({ error: "Alteracao de senha obrigatoria.", forcaAlterarSenha: true });
    }

    const token = jwt.sign(
      { userId: usuario.id, tenantId: usuario.tenantId, cargoCodigo: usuario.cargoCodigo },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
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
      },
    });
  } catch (err) {
    console.error("[POST /auth/login]", err);
    return res.status(500).json({ error: "Erro interno no servidor.", detail: err.message });
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
        verRelatorios: usuario.cargo.verRelatorios,
        publicarRedes: usuario.cargo.publicarRedes,
      },
    });
  } catch (err) {
    console.error("[GET /auth/me]", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});
