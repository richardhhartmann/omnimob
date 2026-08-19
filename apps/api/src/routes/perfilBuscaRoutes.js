import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermissao } from "../middlewares/permissaoMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { imoveisParaPerfil, perfisParaImovel } from "../services/cruzamento.js";

/* Perfis de busca: o que cada cliente procura.
 *
 * Mora junto de Clientes na permissão (`gerenciarClientes`) porque é ficha de
 * cliente, e não de imóvel — quem cadastra a pessoa é quem sabe o que ela quer.
 * O cruzamento na direção do imóvel ("quem estava esperando por isto") também
 * exige `gerenciarClientes`, apesar de ser aberto a partir da tela de um imóvel:
 * o que ele devolve é telefone e e-mail de cliente, e é o dado que manda na
 * permissão, não a tela de onde a pergunta partiu. */
export const perfilBuscaRouter = Router();
perfilBuscaRouter.use(requireTenant);
perfilBuscaRouter.use(requireAuth);

const listaDeBairros = z
  .union([z.array(z.string()), z.string()])
  .optional()
  .transform((v) => {
    if (!v) return [];
    const bruto = Array.isArray(v) ? v : String(v).split(",");
    /* Deduplicado e sem vazios: a tela deixa digitar separado por vírgula, e
       "Centro, , centro" viraria três critérios para o mesmo bairro.

       A PRIMEIRA grafia é a que fica. Um `Map` construído de uma vez guardaria
       a última — e "Centro, centro" sairia como "centro", devolvendo ao cliente
       o texto errado dos dois que ele digitou. */
    const vistos = new Map();
    for (const bruto1 of bruto) {
      const limpo = String(bruto1).trim();
      if (!limpo) continue;
      const chave = limpo.toLowerCase();
      if (!vistos.has(chave)) vistos.set(chave, limpo);
    }
    return [...vistos.values()].slice(0, 30);
  });

const numeroOpcional = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
  z.number().nonnegative().optional()
);

const perfilSchema = z.object({
  clienteId: z.string().min(1),
  titulo: z.string().trim().min(2).max(120),
  finalidade: z.enum(["RESIDENCIAL", "COMERCIAL"]).nullish(),
  tipoContrato: z.enum(["VENDA", "LOCACAO", "PERMUTA", "BUILT_TO_SUIT"]).nullish(),
  tipoImovelId: z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : Number(v)), z.number().int().optional()),
  precoMin: numeroOpcional,
  precoMax: numeroOpcional,
  quartosMin: numeroOpcional,
  vagasMin: numeroOpcional,
  areaMin: numeroOpcional,
  cidade: z.string().trim().max(120).nullish(),
  bairros: listaDeBairros,
  ativo: z.boolean().optional(),
});

perfilBuscaRouter.get("/", requirePermissao("gerenciarClientes"), async (req, res) => {
  try {
    const { clienteId } = req.query;
    const perfis = await prisma.perfilBusca.findMany({
      where: {
        tenantId: req.tenant.id,
        ...(clienteId ? { clienteId: String(clienteId) } : {}),
      },
      include: {
        cliente: { select: { id: true, nome: true } },
        tipoImovel: { select: { id: true, descricao: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ perfis });
  } catch (erro) {
    console.error("[GET /perfis-busca]", erro);
    return res.status(500).json({ error: "Erro ao buscar os perfis." });
  }
});

perfilBuscaRouter.post("/", requirePermissao("gerenciarClientes"), async (req, res) => {
  try {
    const parsed = perfilSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
    }
    const { clienteId, ...dados } = parsed.data;

    // O cliente é desta imobiliária? Sem a checagem, um id de outra passaria.
    const cliente = await prisma.cliente.findFirst({
      where: { id: clienteId, tenantId: req.tenant.id },
      select: { id: true },
    });
    if (!cliente) return res.status(404).json({ error: "Cliente não encontrado." });

    const perfil = await prisma.perfilBusca.create({
      data: { ...dados, clienteId, tenantId: req.tenant.id },
      include: { tipoImovel: { select: { id: true, descricao: true } } },
    });
    return res.status(201).json(perfil);
  } catch (erro) {
    console.error("[POST /perfis-busca]", erro);
    return res.status(500).json({ error: "Erro ao criar o perfil." });
  }
});

perfilBuscaRouter.put("/:id", requirePermissao("gerenciarClientes"), async (req, res) => {
  try {
    const existente = await prisma.perfilBusca.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      select: { id: true },
    });
    if (!existente) return res.status(404).json({ error: "Perfil não encontrado." });

    const parsed = perfilSchema.partial({ clienteId: true }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
    }
    // Trocar o perfil de cliente não é edição, é outro perfil.
    const { clienteId: _ignorado, ...dados } = parsed.data;

    const perfil = await prisma.perfilBusca.update({
      where: { id: existente.id },
      data: dados,
      include: { tipoImovel: { select: { id: true, descricao: true } } },
    });
    return res.json(perfil);
  } catch (erro) {
    console.error("[PUT /perfis-busca/:id]", erro);
    return res.status(500).json({ error: "Erro ao salvar o perfil." });
  }
});

perfilBuscaRouter.delete("/:id", requirePermissao("gerenciarClientes"), async (req, res) => {
  try {
    const existente = await prisma.perfilBusca.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      select: { id: true },
    });
    if (!existente) return res.status(404).json({ error: "Perfil não encontrado." });
    await prisma.perfilBusca.delete({ where: { id: existente.id } });
    return res.status(204).send();
  } catch (erro) {
    console.error("[DELETE /perfis-busca/:id]", erro);
    return res.status(500).json({ error: "Erro ao remover o perfil." });
  }
});

/** O que o acervo tem para este cliente. */
perfilBuscaRouter.get("/:id/imoveis", requirePermissao("gerenciarClientes"), async (req, res) => {
  try {
    const perfil = await prisma.perfilBusca.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
    });
    if (!perfil) return res.status(404).json({ error: "Perfil não encontrado." });

    const imoveis = await imoveisParaPerfil(perfil);
    return res.json({ imoveis, total: imoveis.length });
  } catch (erro) {
    console.error("[GET /perfis-busca/:id/imoveis]", erro);
    return res.status(500).json({ error: "Erro ao cruzar o perfil com o acervo." });
  }
});

/* A direção inversa: quem estava esperando por este imóvel.
 *
 * `/imovel/:propertyId` neste router, e não em `propertyRoutes`, porque a regra
 * de cruzamento é a mesma e ela mora aqui — separar por tela faria a mesma
 * pergunta ser respondida por dois códigos diferentes. */
perfilBuscaRouter.get("/imovel/:propertyId", requirePermissao("gerenciarClientes"), async (req, res) => {
  try {
    const imovel = await prisma.property.findFirst({
      where: { id: req.params.propertyId, tenantId: req.tenant.id },
    });
    if (!imovel) return res.status(404).json({ error: "Imóvel não encontrado." });

    const interessados = await perfisParaImovel(imovel);
    return res.json({ interessados, total: interessados.length });
  } catch (erro) {
    console.error("[GET /perfis-busca/imovel/:id]", erro);
    return res.status(500).json({ error: "Erro ao cruzar o imóvel com a carteira." });
  }
});
