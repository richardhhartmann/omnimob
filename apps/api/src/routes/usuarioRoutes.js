import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermissao } from "../middlewares/permissaoMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

export const usuarioRouter = Router();
usuarioRouter.use(requireAuth);
usuarioRouter.use(requireTenant);
usuarioRouter.use(requirePermissao("gerenciarUsuarios"));

usuarioRouter.get("/", async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      where: { tenantId: req.tenant.id },
      include: { cargo: true },
      orderBy: { nome: "asc" },
    });
    return res.json(usuarios);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao listar usuários." });
  }
});

usuarioRouter.post("/", async (req, res) => {
  try {
    const { nome, login, senha, cargoCodigo, forcaAlterarSenha = false } = req.body;
    if (!nome || !login || !senha || !cargoCodigo) {
      return res.status(400).json({ error: "Nome, login, senha e cargo são obrigatórios." });
    }
    const senhaHash = await bcrypt.hash(senha, 10);
    const usuario = await prisma.usuario.create({
      data: {
        tenantId: req.tenant.id,
        nome,
        login,
        senha: senhaHash,
        cargoCodigo: Number(cargoCodigo),
        forcaAlterarSenha: Boolean(forcaAlterarSenha),
        ativo: true,
      },
      include: { cargo: true },
    });
    return res.status(201).json(usuario);
  } catch (err) {
    if (err.code === "P2002") return res.status(400).json({ error: "Login já está em uso." });
    console.error(err);
    return res.status(500).json({ error: "Erro ao criar usuário." });
  }
});

usuarioRouter.put("/:id", async (req, res) => {
  try {
    const current = await prisma.usuario.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
    });
    if (!current) return res.status(404).json({ error: "Usuário não encontrado." });

    const { nome, login, senha, cargoCodigo, ativo, forcaAlterarSenha } = req.body;
    const data = {};
    if (nome !== undefined) data.nome = nome;
    if (login !== undefined) data.login = login;
    if (senha) data.senha = await bcrypt.hash(senha, 10);
    if (cargoCodigo !== undefined) data.cargoCodigo = Number(cargoCodigo);
    if (ativo !== undefined) data.ativo = Boolean(ativo);
    if (forcaAlterarSenha !== undefined) data.forcaAlterarSenha = Boolean(forcaAlterarSenha);

    const usuario = await prisma.usuario.update({
      where: { id: req.params.id },
      data,
      include: { cargo: true },
    });
    return res.json(usuario);
  } catch (err) {
    if (err.code === "P2002") return res.status(400).json({ error: "Login já está em uso." });
    console.error(err);
    return res.status(500).json({ error: "Erro ao atualizar usuário." });
  }
});

usuarioRouter.delete("/:id", async (req, res) => {
  try {
    const current = await prisma.usuario.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
    });
    if (!current) return res.status(404).json({ error: "Usuário não encontrado." });
    await prisma.usuario.update({ where: { id: req.params.id }, data: { ativo: false } });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao desativar usuário." });
  }
});
