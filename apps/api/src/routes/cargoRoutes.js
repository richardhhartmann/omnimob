import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermissao } from "../middlewares/permissaoMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

export const cargoRouter = Router();
cargoRouter.use(requireAuth);
cargoRouter.use(requireTenant);
cargoRouter.use(requirePermissao("gerenciarCargos"));

const PERMISSOES = ["acessarPainel", "editarPagina", "gerenciarImoveis", "gerenciarLeads",
  "gerenciarUsuarios", "gerenciarClientes", "gerenciarCargos", "verRelatorios", "publicarRedes"];

cargoRouter.get("/", async (_req, res) => {
  try {
    const cargos = await prisma.cargo.findMany({
      orderBy: { id: "asc" },
      include: { _count: { select: { usuarios: true } } },
    });
    return res.json(cargos);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao listar cargos." });
  }
});

cargoRouter.post("/", async (req, res) => {
  try {
    const { descricao, ...perms } = req.body;
    if (!descricao) return res.status(400).json({ error: "Descrição é obrigatória." });
    const data = { descricao };
    for (const p of PERMISSOES) data[p] = Boolean(perms[p]);
    const cargo = await prisma.cargo.create({ data });
    return res.status(201).json(cargo);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao criar cargo." });
  }
});

cargoRouter.put("/:id", async (req, res) => {
  try {
    const cargoId = Number(req.params.id);
    const cargo = await prisma.cargo.findUnique({ where: { id: cargoId } });
    if (!cargo) return res.status(404).json({ error: "Cargo não encontrado." });

    const { descricao, ...perms } = req.body;

    // Impede que o usuário remova acessarPainel do próprio cargo
    if (cargoId === req.authCargoCodigo && perms.acessarPainel === false) {
      return res.status(400).json({ error: "Você não pode remover a permissão 'Acessar Painel' do seu próprio cargo." });
    }

    const data = {};
    if (descricao !== undefined) data.descricao = descricao;
    for (const p of PERMISSOES) if (perms[p] !== undefined) data[p] = Boolean(perms[p]);
    const updated = await prisma.cargo.update({ where: { id: cargoId }, data });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao atualizar cargo." });
  }
});

cargoRouter.delete("/:id", async (req, res) => {
  try {
    const cargo = await prisma.cargo.findUnique({
      where: { id: Number(req.params.id) },
      include: { _count: { select: { usuarios: true } } },
    });
    if (!cargo) return res.status(404).json({ error: "Cargo não encontrado." });
    if (cargo._count.usuarios > 0) {
      return res.status(400).json({ error: `Cargo está vinculado a ${cargo._count.usuarios} usuário(s). Reatribua-os antes de excluir.` });
    }
    await prisma.cargo.delete({ where: { id: Number(req.params.id) } });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao excluir cargo." });
  }
});
