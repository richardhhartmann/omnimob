import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermissao } from "../middlewares/permissaoMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { requirePlanoIA } from "../middlewares/planoMiddleware.js";
import { analisarLead, isAiEnabled } from "../services/aiService.js";

export const leadRouter = Router();
leadRouter.use(requireTenant);
leadRouter.use(requireAuth);
/* `verRelatorios`, e não mais `gerenciarLeads`: leads viraram um item dentro
   de Relatórios, e quem alcança a página alcança tudo que está nela. */
leadRouter.use(requirePermissao("verRelatorios"));

leadRouter.get("/", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const { propertyId } = req.query;

    const where = {
      tenantId: req.tenant.id,
      ...(propertyId ? { propertyId } : {}),
    };

    const [leads, total] = await Promise.all([
      prisma.propertyLead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { property: { select: { id: true, title: true } } },
        skip,
        take: limit,
      }),
      prisma.propertyLead.count({ where }),
    ]);

    return res.json({ leads, total, page, limit });
  } catch {
    return res.status(500).json({ error: "Erro ao buscar leads." });
  }
});

leadRouter.get("/:id", async (req, res) => {
  try {
    const lead = await prisma.propertyLead.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      include: { property: { select: { id: true, title: true } } },
    });
    if (!lead) {
      return res.status(404).json({ error: "Lead nao encontrado." });
    }
    return res.json(lead);
  } catch {
    return res.status(500).json({ error: "Erro ao buscar lead." });
  }
});

/* ── IA sobre o lead (Premium) ────────────────────────────────────────────────
   Resumo do que a pessoa quer, temperatura, resposta pronta e imóveis do acervo
   que servem para ela.

   `requirePlanoIA` fica NA ROTA e não no router inteiro: as outras três rotas de
   lead são de todos os planos, e subir o middleware trancaria a lista de leads
   para quem está no Básico.

   Teto de 40 imóveis no acervo enviado à IA: o prompt é cobrado por token, e uma
   imobiliária com 600 imóveis mandaria 600 linhas para escolher três. Os 40 mais
   recentes ativos são uma amostra boa do que está sendo oferecido hoje. */
const TETO_ACERVO_IA = 40;

leadRouter.post("/:id/ia", requirePlanoIA, async (req, res) => {
  try {
    if (!isAiEnabled()) {
      return res.status(503).json({ error: "IA indisponível: GEMINI_API_KEY não configurada." });
    }

    // findFirst com tenantId no where, e não findUnique pelo id: é o que faz o
    // lead de outra imobiliária responder 404 em vez de vazar.
    const lead = await prisma.propertyLead.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      include: { property: { include: { images: { orderBy: { position: "asc" }, take: 1 } } } },
    });
    if (!lead) return res.status(404).json({ error: "Lead nao encontrado." });

    const acervo = await prisma.property.findMany({
      where: {
        tenantId: req.tenant.id,
        status: "ACTIVE",
        // O imóvel que ela já abriu não entra: sugerir de volta o que a pessoa
        // estava olhando é a única sugestão garantidamente inútil.
        id: { not: lead.propertyId },
      },
      orderBy: { createdAt: "desc" },
      take: TETO_ACERVO_IA,
      select: {
        id: true, title: true, price: true, city: true, neighborhood: true,
        bedrooms: true, parkingSpots: true, squareFootage: true,
        areaPrivativa: true, propertyType: true,
      },
    });

    const analise = await analisarLead(lead, lead.property, acervo);

    /* Os ids voltam com título e preço junto. A IA devolve só o id, e a tela
       precisaria de uma segunda requisição por sugestão para ter o que mostrar. */
    const porId = new Map(acervo.map((p) => [p.id, p]));
    return res.json({
      ...analise,
      sugestoes: analise.sugestoes.map((id) => {
        const p = porId.get(id);
        return { id, title: p?.title || "", price: p?.price ?? null, city: p?.city || "", neighborhood: p?.neighborhood || "" };
      }),
    });
  } catch (err) {
    console.error("[POST /leads/:id/ia]", err);
    return res.status(500).json({ error: "Erro ao analisar o lead.", detail: err.message });
  }
});

leadRouter.delete("/:id", async (req, res) => {
  try {
    const lead = await prisma.propertyLead.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
    });
    if (!lead) {
      return res.status(404).json({ error: "Lead nao encontrado." });
    }
    await prisma.propertyLead.delete({ where: { id: lead.id } });
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "Erro ao deletar lead." });
  }
});
