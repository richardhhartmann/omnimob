import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermissao } from "../middlewares/permissaoMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { requirePlanoIA } from "../middlewares/planoMiddleware.js";
import { analisarLead, isAiEnabled } from "../services/aiService.js";

/* Ordem do funil. A lista é a fonte para validar o que chega e para o
   relatório empilhar os estágios — uma só, para os dois não desencontrarem. */
const ESTAGIOS = ["NOVO", "EM_ATENDIMENTO", "VISITA", "PROPOSTA", "GANHO", "PERDIDO"];

/* Quem escreveu o evento. `usuarioNome` vai gravado junto de propósito: o
   histórico precisa continuar legível depois que a pessoa sai da empresa. */
const autor = (req) => ({ usuarioId: req.authUserId || null, usuarioNome: req.authUserNome || null });

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
    const { propertyId, estagio, responsavelId } = req.query;

    const where = {
      tenantId: req.tenant.id,
      ...(propertyId ? { propertyId } : {}),
      ...(ESTAGIOS.includes(String(estagio)) ? { estagio: String(estagio) } : {}),
      /* "sem" é filtro de verdade e não ausência de filtro: a caixa comum — os
         leads que a distribuição não conseguiu atribuir — é justamente a lista
         que alguém precisa abrir todo dia. */
      ...(responsavelId === "sem" ? { responsavelId: null } : responsavelId ? { responsavelId: String(responsavelId) } : {}),
    };

    const [leads, total, equipe] = await Promise.all([
      prisma.propertyLead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          property: { select: { id: true, title: true } },
          responsavel: { select: { id: true, nome: true } },
          _count: { select: { eventos: true } },
        },
        skip,
        take: limit,
      }),
      prisma.propertyLead.count({ where }),
      /* A equipe vem junto com a lista, e não numa chamada separada: o seletor
         de responsável existe em toda linha da tela, e uma segunda requisição
         só para preenchê-lo faria a lista aparecer antes dos nomes. */
      prisma.usuario.findMany({
        where: { tenantId: req.tenant.id, ativo: true, cargo: { OR: [{ gerenciarLeads: true }, { verRelatorios: true }] } },
        select: { id: true, nome: true },
        orderBy: { nome: "asc" },
      }),
    ]);

    return res.json({ leads, total, page, limit, equipe, estagios: ESTAGIOS });
  } catch {
    return res.status(500).json({ error: "Erro ao buscar leads." });
  }
});

leadRouter.get("/:id", async (req, res) => {
  try {
    const lead = await prisma.propertyLead.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      include: {
        property: { select: { id: true, title: true } },
        responsavel: { select: { id: true, nome: true } },
        eventos: { orderBy: { createdAt: "desc" } },
      },
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

/* ── Trabalhar o lead ────────────────────────────────────────────────────────
   Mover de estágio, trocar o responsável e escrever uma nota. As três coisas
   que uma pessoa faz com um contato, e as três geram histórico.

   Uma rota só para estágio e responsável porque na tela eles são o mesmo gesto:
   "assumi e comecei a atender". Duas rotas obrigariam a interface a fazer duas
   chamadas para uma ação que a pessoa entende como uma.
   ────────────────────────────────────────────────────────────────────────── */
leadRouter.patch("/:id", async (req, res) => {
  try {
    const lead = await prisma.propertyLead.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      include: { responsavel: { select: { id: true, nome: true } } },
    });
    if (!lead) return res.status(404).json({ error: "Lead nao encontrado." });

    const { estagio, responsavelId } = req.body || {};
    const data = {};
    const eventos = [];

    if (estagio !== undefined && estagio !== lead.estagio) {
      if (!ESTAGIOS.includes(estagio)) {
        return res.status(400).json({ error: "Estágio inválido." });
      }
      data.estagio = estagio;
      eventos.push({ tenantId: req.tenant.id, tipo: "ESTAGIO", de: lead.estagio, para: estagio, ...autor(req) });

      /* Sair de NOVO é o primeiro contato, e o carimbo é o que permite medir
         tempo de resposta depois. Só a primeira vez: voltar para NOVO e sair de
         novo não reescreve a história. */
      if (lead.estagio === "NOVO" && !lead.primeiroContatoEm) {
        data.primeiroContatoEm = new Date();
      }
    }

    if (responsavelId !== undefined && responsavelId !== lead.responsavelId) {
      let nomeNovo = null;
      if (responsavelId) {
        /* Confere que o corretor é DESTA imobiliária. Sem isto, um id válido de
           outro tenant passaria pela chave estrangeira e o lead ficaria com um
           dono que nunca vai vê-lo. */
        const alvo = await prisma.usuario.findFirst({
          where: { id: String(responsavelId), tenantId: req.tenant.id, ativo: true },
          select: { id: true, nome: true },
        });
        if (!alvo) return res.status(400).json({ error: "Responsável inválido." });
        nomeNovo = alvo.nome;
      }
      data.responsavelId = responsavelId || null;
      eventos.push({
        tenantId: req.tenant.id,
        tipo: "RESPONSAVEL",
        de: lead.responsavel?.nome || null,
        para: nomeNovo,
        ...autor(req),
      });
    }

    if (!Object.keys(data).length) {
      return res.status(400).json({ error: "Nada para alterar." });
    }

    const atualizado = await prisma.propertyLead.update({
      where: { id: lead.id },
      data: { ...data, eventos: { create: eventos } },
      include: {
        property: { select: { id: true, title: true } },
        responsavel: { select: { id: true, nome: true } },
        eventos: { orderBy: { createdAt: "desc" } },
      },
    });

    return res.json(atualizado);
  } catch (erro) {
    console.error("[PATCH /leads/:id]", erro);
    return res.status(500).json({ error: "Erro ao atualizar o lead." });
  }
});

/** Nota livre no histórico — "liguei, pediu para retornar sábado". */
leadRouter.post("/:id/nota", async (req, res) => {
  try {
    const texto = String(req.body?.texto || "").trim();
    if (!texto) return res.status(400).json({ error: "Escreva a nota antes de salvar." });
    if (texto.length > 2000) return res.status(400).json({ error: "Nota longa demais (máx. 2000 caracteres)." });

    const lead = await prisma.propertyLead.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      select: { id: true, estagio: true, primeiroContatoEm: true },
    });
    if (!lead) return res.status(404).json({ error: "Lead nao encontrado." });

    /* Escrever uma nota TAMBÉM é encostar no lead. Sem esta linha, quem
       registrasse o telefonema sem mexer no estágio deixaria o lead marcado
       como nunca contatado — e o relatório de tempo de resposta mentiria. */
    const data = { eventos: { create: [{ tenantId: req.tenant.id, tipo: "NOTA", texto, ...autor(req) }] } };
    if (!lead.primeiroContatoEm) data.primeiroContatoEm = new Date();

    const atualizado = await prisma.propertyLead.update({
      where: { id: lead.id },
      data,
      include: { eventos: { orderBy: { createdAt: "desc" } } },
    });

    return res.status(201).json(atualizado);
  } catch (erro) {
    console.error("[POST /leads/:id/nota]", erro);
    return res.status(500).json({ error: "Erro ao salvar a nota." });
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
