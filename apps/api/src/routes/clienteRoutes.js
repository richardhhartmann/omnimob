import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermissao } from "../middlewares/permissaoMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

export const clienteRouter = Router();
clienteRouter.use(requireAuth);
clienteRouter.use(requireTenant);
clienteRouter.use(requirePermissao("gerenciarClientes"));

const CAMPOS = ["nome", "cpf", "rg", "email", "telefone", "whatsapp", "cep", "endereco", "bairro", "cidade", "estado", "observacoes"];

function parseNascimento(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

clienteRouter.get("/", async (req, res) => {
  try {
    const clientes = await prisma.cliente.findMany({
      where: { tenantId: req.tenant.id },
      orderBy: { nome: "asc" },
    });
    return res.json(clientes);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao listar clientes." });
  }
});

clienteRouter.post("/", async (req, res) => {
  try {
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ error: "Nome é obrigatório." });
    const data = { tenantId: req.tenant.id, ativo: true };
    for (const c of CAMPOS) if (req.body[c] !== undefined) data[c] = req.body[c] || null;
    data.nome = nome;
    data.nascimento = parseNascimento(req.body.nascimento);
    const cliente = await prisma.cliente.create({ data });
    return res.status(201).json(cliente);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao criar cliente." });
  }
});

clienteRouter.put("/:id", async (req, res) => {
  try {
    const current = await prisma.cliente.findFirst({ where: { id: req.params.id, tenantId: req.tenant.id } });
    if (!current) return res.status(404).json({ error: "Cliente não encontrado." });
    const data = {};
    for (const c of CAMPOS) if (req.body[c] !== undefined) data[c] = req.body[c] || null;
    if (req.body.nascimento !== undefined) data.nascimento = parseNascimento(req.body.nascimento);
    if (req.body.ativo !== undefined) data.ativo = Boolean(req.body.ativo);
    const cliente = await prisma.cliente.update({ where: { id: req.params.id }, data });
    return res.json(cliente);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao atualizar cliente." });
  }
});

clienteRouter.delete("/:id", async (req, res) => {
  try {
    const current = await prisma.cliente.findFirst({ where: { id: req.params.id, tenantId: req.tenant.id } });
    if (!current) return res.status(404).json({ error: "Cliente não encontrado." });
    await prisma.cliente.update({ where: { id: req.params.id }, data: { ativo: false } });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao desativar cliente." });
  }
});
