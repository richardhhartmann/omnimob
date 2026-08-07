import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermissao } from "../middlewares/permissaoMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

export const clienteRouter = Router();
clienteRouter.use(requireAuth);
clienteRouter.use(requireTenant);
clienteRouter.use(requirePermissao("gerenciarClientes"));

const CAMPOS_TEXTO = ["nome", "cpf", "rg", "email", "telefone", "whatsapp",
  "cep", "endereco", "bairro", "cidade", "estado", "observacoes"];

function parseNascimento(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Normaliza o opt-in de divulgação: ao ativar, carimba a data do consentimento;
// ao desativar, limpa. `jaTinha` evita reescrever a data num update que só
// reconfirma um opt-in que já existia.
function aplicarOptInDivulgacao(data, aceita, jaTinha = false) {
  const ativo = Boolean(aceita);
  data.aceitaDivulgacao = ativo;
  if (ativo && !jaTinha) data.divulgacaoOptInAt = new Date();
  if (!ativo) data.divulgacaoOptInAt = null;
}

clienteRouter.get("/", async (req, res) => {
  try {
    const { search = "", ativo } = req.query;
    const where = { tenantId: req.tenant.id };
    if (ativo !== undefined) where.ativo = ativo === "true";
    if (search) {
      where.OR = [
        { nome: { contains: search, mode: "insensitive" } },
        { cpf: { contains: search } },
        { email: { contains: search, mode: "insensitive" } },
        { telefone: { contains: search } },
      ];
    }
    const clientes = await prisma.cliente.findMany({
      where,
      orderBy: { nome: "asc" },
    });
    return res.json(clientes);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao listar clientes." });
  }
});

clienteRouter.get("/:id", async (req, res) => {
  try {
    const cliente = await prisma.cliente.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
    });
    if (!cliente) return res.status(404).json({ error: "Cliente não encontrado." });
    return res.json(cliente);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao buscar cliente." });
  }
});

clienteRouter.post("/", async (req, res) => {
  try {
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ error: "Nome é obrigatório." });
    const data = { tenantId: req.tenant.id, ativo: true };
    for (const c of CAMPOS_TEXTO) data[c] = req.body[c] || null;
    data.nome = nome;
    data.nascimento = parseNascimento(req.body.nascimento);
    aplicarOptInDivulgacao(data, req.body.aceitaDivulgacao);
    const cliente = await prisma.cliente.create({ data });
    return res.status(201).json(cliente);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao criar cliente." });
  }
});

clienteRouter.put("/:id", async (req, res) => {
  try {
    const current = await prisma.cliente.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
    });
    if (!current) return res.status(404).json({ error: "Cliente não encontrado." });
    const data = {};
    for (const c of CAMPOS_TEXTO) if (req.body[c] !== undefined) data[c] = req.body[c] || null;
    if (req.body.nascimento !== undefined) data.nascimento = parseNascimento(req.body.nascimento);
    if (req.body.ativo !== undefined) data.ativo = Boolean(req.body.ativo);
    if (req.body.aceitaDivulgacao !== undefined) {
      aplicarOptInDivulgacao(data, req.body.aceitaDivulgacao, current.aceitaDivulgacao);
    }
    const cliente = await prisma.cliente.update({ where: { id: req.params.id }, data });
    return res.json(cliente);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao atualizar cliente." });
  }
});

/* DESATIVAR — o caminho reversível, e o que o painel oferece primeiro. */
clienteRouter.delete("/:id", async (req, res) => {
  try {
    const current = await prisma.cliente.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
    });
    if (!current) return res.status(404).json({ error: "Cliente não encontrado." });
    await prisma.cliente.update({ where: { id: req.params.id }, data: { ativo: false } });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao desativar cliente." });
  }
});

/* EXCLUIR de vez — apaga a linha. Rota própria pelo mesmo motivo da de
   usuários: as duas ações têm consequências diferentes demais para dependerem
   de alguém lembrar de mandar uma flag.

   A recusa por histórico é a que importa aqui. `Venda.cliente` é
   onDelete: Restrict de propósito: venda registrada guarda QUEM comprou, e
   apagar o cliente deixaria o negócio fechado sem contraparte. O banco já
   recusaria (P2003) — checar antes é só para devolver uma frase que explica
   em vez de um 500.

   Não existe aqui o equivalente ao "último gestor": cliente não dá acesso a
   nada, então ficar sem nenhum não tranca ninguém do lado de fora. */
clienteRouter.delete("/:id/permanente", async (req, res) => {
  try {
    const alvo = await prisma.cliente.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      select: { id: true },
    });
    if (!alvo) return res.status(404).json({ error: "Cliente não encontrado." });

    const vendas = await prisma.venda.count({ where: { clienteId: alvo.id } });
    if (vendas > 0) {
      return res.status(409).json({
        error: `Este cliente tem ${vendas} ${vendas === 1 ? "venda registrada" : "vendas registradas"} no histórico e não pode ser excluído. Deixe-o inativo: some das listagens e o histórico continua de pé.`,
        code: "TEM_HISTORICO",
      });
    }

    await prisma.cliente.delete({ where: { id: alvo.id } });
    return res.status(204).send();
  } catch (err) {
    // Rede para qualquer vínculo criado depois desta rota ter sido escrita.
    if (err.code === "P2003") {
      return res.status(409).json({
        error: "Este cliente tem registros vinculados e não pode ser excluído. Deixe-o inativo em vez disso.",
        code: "TEM_HISTORICO",
      });
    }
    console.error(err);
    return res.status(500).json({ error: "Erro ao excluir cliente." });
  }
});
