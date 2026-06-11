import { Router } from "express";
import prismaPkg from "@prisma/client";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermissao } from "../middlewares/permissaoMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { enqueuePropertyPublication } from "../services/socialPublisher.js";
import { createPropertySchema, updatePropertySchema } from "../validators/propertyValidators.js";

const { PropertyStatus, MetricEventType } = prismaPkg;

const requireImoveis = [requireAuth, requirePermissao("gerenciarImoveis")];

export const propertyRouter = Router();
propertyRouter.use(requireTenant);

const PROPERTY_INCLUDE = {
  publications: { orderBy: { createdAt: "asc" } },
  images: { orderBy: { position: "asc" } },
  tipoImovel: true,
  atributos: { include: { atributo: true } },
};

// ─── Tipos de imóvel com seus atributos ──────────────────────────────────────

propertyRouter.get("/tipos", async (_req, res) => {
  try {
    const tipos = await prisma.tipoImovel.findMany({
      orderBy: { id: "asc" },
      include: { atributos: { orderBy: [{ grupo: "asc" }, { descricao: "asc" }] } },
    });
    return res.json(tipos);
  } catch (err) {
    console.error("[GET /properties/tipos]", err);
    return res.status(500).json({ error: "Erro ao listar tipos de imovel.", detail: err.message });
  }
});

propertyRouter.post("/tipos", requireImoveis, async (req, res) => {
  try {
    const { descricao, areaFields } = req.body;
    if (!descricao) return res.status(400).json({ error: "Descrição é obrigatória." });
    const tipo = await prisma.tipoImovel.create({
      data: { descricao, areaFields: Array.isArray(areaFields) ? areaFields : [] },
      include: { atributos: true },
    });
    return res.status(201).json(tipo);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao criar tipo de imóvel." });
  }
});

propertyRouter.put("/tipos/:id", requireImoveis, async (req, res) => {
  try {
    const { descricao, areaFields } = req.body;
    const data = {};
    if (descricao !== undefined) data.descricao = descricao;
    if (Array.isArray(areaFields)) data.areaFields = areaFields;
    const tipo = await prisma.tipoImovel.update({
      where: { id: Number(req.params.id) },
      data,
      include: { atributos: { orderBy: [{ grupo: "asc" }, { descricao: "asc" }] } },
    });
    return res.json(tipo);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao atualizar tipo de imóvel." });
  }
});

propertyRouter.delete("/tipos/:id", requireImoveis, async (req, res) => {
  try {
    await prisma.tipoImovel.delete({ where: { id: Number(req.params.id) } });
    return res.status(204).send();
  } catch (err) {
    if (err.code === "P2003") return res.status(400).json({ error: "Tipo está em uso por imóveis cadastrados." });
    console.error(err);
    return res.status(500).json({ error: "Erro ao excluir tipo de imóvel." });
  }
});

propertyRouter.post("/tipos/:tipoId/atributos", requireImoveis, async (req, res) => {
  try {
    const { descricao, grupo } = req.body;
    if (!descricao) return res.status(400).json({ error: "Descrição é obrigatória." });
    const atr = await prisma.modeloAtributo.create({
      data: { tipoId: Number(req.params.tipoId), descricao, grupo: grupo || null },
    });
    return res.status(201).json(atr);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao criar atributo." });
  }
});

propertyRouter.put("/atributos/:id", requireImoveis, async (req, res) => {
  try {
    const { descricao, grupo } = req.body;
    const atr = await prisma.modeloAtributo.update({
      where: { id: Number(req.params.id) },
      data: { descricao, grupo: grupo || null },
    });
    return res.json(atr);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao atualizar atributo." });
  }
});

propertyRouter.delete("/atributos/:id", requireImoveis, async (req, res) => {
  try {
    await prisma.modeloAtributo.delete({ where: { id: Number(req.params.id) } });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao excluir atributo." });
  }
});

// ─── Listagem ─────────────────────────────────────────────────────────────────

propertyRouter.get("/", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const { status } = req.query;

    const where = {
      tenantId: req.tenant.id,
      ...(status ? { status } : {}),
    };

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: PROPERTY_INCLUDE,
        skip,
        take: limit,
      }),
      prisma.property.count({ where }),
    ]);

    return res.json({ properties, total, page, limit });
  } catch (err) {
    console.error("[GET /properties]", err);
    return res.status(500).json({ error: "Erro ao listar imoveis.", detail: err.message });
  }
});

propertyRouter.get("/:id", async (req, res) => {
  try {
    const property = await prisma.property.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      include: PROPERTY_INCLUDE,
    });

    if (!property) {
      return res.status(404).json({ error: "Imovel nao encontrado para este tenant." });
    }

    return res.json(property);
  } catch {
    return res.status(500).json({ error: "Erro ao buscar imovel." });
  }
});

// Valida que os atributosIds existem e (quando há tipo) pertencem ao tipo escolhido.
// Retorna null se tudo OK, ou um objeto de erro pronto para responder com 400.
async function validarAtributos(atributosIds, tipoImovelId) {
  const encontrados = await prisma.modeloAtributo.findMany({
    where: {
      id: { in: atributosIds },
      ...(tipoImovelId ? { tipoId: tipoImovelId } : {}),
    },
    select: { id: true },
  });
  const validos = new Set(encontrados.map((a) => a.id));
  const invalidos = atributosIds.filter((id) => !validos.has(id));
  if (invalidos.length > 0) {
    return { error: "Alguns atributos selecionados não existem ou não pertencem ao tipo de imóvel escolhido.", invalidos };
  }
  return null;
}

// ─── Criar ────────────────────────────────────────────────────────────────────

propertyRouter.post("/", requireImoveis, async (req, res) => {
  try {
    const parsed = createPropertySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados invalidos para imovel.", details: parsed.error.flatten() });
    }

    const { tipoImovelId, atributosIds, ...propertyData } = parsed.data;

    // Deriva propertyType do tipo selecionado para manter compatibilidade
    let propertyType = propertyData.propertyType || "";
    if (tipoImovelId) {
      const tipo = await prisma.tipoImovel.findUnique({ where: { id: tipoImovelId } });
      if (!tipo) return res.status(400).json({ error: "Tipo de imovel nao encontrado." });
      propertyType = tipo.descricao;
    }

    // Garante que os atributos existem (e pertencem ao tipo), evitando erro de FK (P2003).
    if (atributosIds.length > 0) {
      const erroAtributos = await validarAtributos(atributosIds, tipoImovelId);
      if (erroAtributos) return res.status(400).json(erroAtributos);
    }

    const property = await prisma.property.create({
      data: {
        tenantId: req.tenant.id,
        tipoImovelId: tipoImovelId ?? null,
        propertyType,
        ...propertyData,
        ...(atributosIds.length > 0
          ? { atributos: { create: atributosIds.map((id) => ({ atributoId: id })) } }
          : {}),
      },
      include: PROPERTY_INCLUDE,
    });

    enqueuePropertyPublication(req.tenant.id, property.id).catch((err) =>
      console.error("Erro na publicacao do imovel:", err)
    );

    return res.status(201).json(property);
  } catch (err) {
    console.error("[POST /properties]", err);
    return res.status(500).json({ error: "Erro ao criar imovel.", detail: err.message });
  }
});

// ─── Atualizar ────────────────────────────────────────────────────────────────

propertyRouter.put("/:id", requireImoveis, async (req, res) => {
  try {
    const parsed = updatePropertySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados invalidos para atualizacao.", details: parsed.error.flatten() });
    }

    const current = await prisma.property.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
    });
    if (!current) {
      return res.status(404).json({ error: "Imovel nao encontrado para este tenant." });
    }

    const { tipoImovelId, atributosIds, ...propertyData } = parsed.data;

    let propertyType = propertyData.propertyType;
    if (tipoImovelId !== undefined) {
      if (tipoImovelId === null) {
        propertyType = "";
      } else {
        const tipo = await prisma.tipoImovel.findUnique({ where: { id: tipoImovelId } });
        if (!tipo) return res.status(400).json({ error: "Tipo de imovel nao encontrado." });
        propertyType = tipo.descricao;
      }
    }

    // Garante que os atributos existem (e pertencem ao tipo), evitando erro de FK (P2003).
    if (atributosIds !== undefined && atributosIds.length > 0) {
      const tipoAlvo = tipoImovelId !== undefined ? tipoImovelId : current.tipoImovelId;
      const erroAtributos = await validarAtributos(atributosIds, tipoAlvo ?? undefined);
      if (erroAtributos) return res.status(400).json(erroAtributos);
    }

    // Atualiza atributos apenas se veio no payload
    const atributosUpdate =
      atributosIds !== undefined
        ? {
            atributos: {
              deleteMany: {},
              ...(atributosIds.length > 0
                ? { create: atributosIds.map((id) => ({ atributoId: id })) }
                : {}),
            },
          }
        : {};

    const property = await prisma.property.update({
      where: { id: req.params.id },
      data: {
        ...(tipoImovelId !== undefined ? { tipoImovelId } : {}),
        ...(propertyType !== undefined ? { propertyType } : {}),
        ...propertyData,
        ...atributosUpdate,
      },
      include: PROPERTY_INCLUDE,
    });

    if (property.status === PropertyStatus.ACTIVE) {
      enqueuePropertyPublication(req.tenant.id, property.id).catch((err) =>
        console.error("Erro na republicacao do imovel:", err)
      );
    }

    return res.json(property);
  } catch (err) {
    console.error("[PUT /properties/:id]", err);
    return res.status(500).json({ error: "Erro ao atualizar imovel.", detail: err.message });
  }
});

// ─── Deletar ──────────────────────────────────────────────────────────────────

propertyRouter.delete("/:id", requireImoveis, async (req, res) => {
  try {
    const current = await prisma.property.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
    });
    if (!current) {
      return res.status(404).json({ error: "Imovel nao encontrado para este tenant." });
    }

    await prisma.property.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "Erro ao deletar imovel." });
  }
});

// ─── Publicações ──────────────────────────────────────────────────────────────

propertyRouter.get("/:id/publications", async (req, res) => {
  try {
    const publications = await prisma.propertyPublication.findMany({
      where: { propertyId: req.params.id, tenantId: req.tenant.id },
      orderBy: { createdAt: "asc" },
    });
    return res.json(publications);
  } catch {
    return res.status(500).json({ error: "Erro ao buscar publicacoes." });
  }
});

// ─── Métricas ─────────────────────────────────────────────────────────────────

propertyRouter.get("/:id/metrics", async (req, res) => {
  try {
    const { from, to } = req.query;

    const property = await prisma.property.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      select: {
        id: true,
        title: true,
        viewCount: true,
        leadCount: true,
        saleCount: true,
        createdAt: true,
      },
    });

    if (!property) {
      return res.status(404).json({ error: "Imovel nao encontrado para este tenant." });
    }

    const hasDateFilter = from || to;
    const dateFilter = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      dateFilter.lte = toDate;
    }

    const timelineWhere = {
      tenantId: req.tenant.id,
      propertyId: req.params.id,
      ...(hasDateFilter ? { createdAt: dateFilter } : {}),
    };

    const timeline = await prisma.propertyMetricEvent.groupBy({
      by: ["type"],
      where: timelineWhere,
      _count: { _all: true },
    });

    const filteredCounts = { VIEW: 0, LEAD: 0, SALE: 0 };
    timeline.forEach((e) => { filteredCounts[e.type] = e._count._all; });

    const views = hasDateFilter ? filteredCounts.VIEW : property.viewCount;
    const leads = hasDateFilter ? filteredCounts.LEAD : property.leadCount;
    const sales = hasDateFilter ? filteredCounts.SALE : property.saleCount;

    const leadConversionRate = views > 0 ? Number(((leads / views) * 100).toFixed(2)) : 0;
    const saleConversionRate = leads > 0 ? Number(((sales / leads) * 100).toFixed(2)) : 0;

    return res.json({
      property: { ...property, viewCount: views, leadCount: leads, saleCount: sales },
      summary: { leadConversionRate, saleConversionRate },
      eventsByType: timeline.map((e) => ({ type: e.type, count: e._count._all })),
      filter: hasDateFilter ? { from: from || null, to: to || null } : null,
    });
  } catch {
    return res.status(500).json({ error: "Erro ao buscar metricas." });
  }
});

async function incrementMetric(req, res, type) {
  try {
    const property = await prisma.property.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
    });

    if (!property) {
      return res.status(404).json({ error: "Imovel nao encontrado para este tenant." });
    }

    const data = {};
    if (type === MetricEventType.VIEW) data.viewCount = { increment: 1 };
    if (type === MetricEventType.LEAD) data.leadCount = { increment: 1 };
    if (type === MetricEventType.SALE) data.saleCount = { increment: 1 };

    const updated = await prisma.property.update({ where: { id: req.params.id }, data });

    await prisma.propertyMetricEvent.create({
      data: { tenantId: req.tenant.id, propertyId: req.params.id, type },
    });

    return res.json({
      id: updated.id,
      viewCount: updated.viewCount,
      leadCount: updated.leadCount,
      saleCount: updated.saleCount,
    });
  } catch {
    return res.status(500).json({ error: "Erro ao registrar metrica." });
  }
}

propertyRouter.post("/:id/metrics/view", (req, res) => incrementMetric(req, res, MetricEventType.VIEW));
propertyRouter.post("/:id/metrics/lead", (req, res) => incrementMetric(req, res, MetricEventType.LEAD));
propertyRouter.post("/:id/metrics/sale", (req, res) => incrementMetric(req, res, MetricEventType.SALE));

// ─── Imagens ──────────────────────────────────────────────────────────────────

propertyRouter.get("/:id/images", async (req, res) => {
  try {
    const property = await prisma.property.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
    });

    if (!property) {
      return res.status(404).json({ error: "Imovel nao encontrado para este tenant." });
    }

    const images = await prisma.propertyImage.findMany({
      where: { tenantId: req.tenant.id, propertyId: req.params.id },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });

    return res.json(images);
  } catch {
    return res.status(500).json({ error: "Erro ao buscar imagens." });
  }
});

propertyRouter.post("/:id/images", async (req, res) => {
  try {
    const { url, publicId } = req.body || {};
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Campo url e obrigatorio para imagem." });
    }

    const property = await prisma.property.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
    });

    if (!property) {
      return res.status(404).json({ error: "Imovel nao encontrado para este tenant." });
    }

    const last = await prisma.propertyImage.findFirst({
      where: { tenantId: req.tenant.id, propertyId: req.params.id },
      orderBy: { position: "desc" },
    });

    const image = await prisma.propertyImage.create({
      data: {
        tenantId: req.tenant.id,
        propertyId: req.params.id,
        url,
        publicId: typeof publicId === "string" ? publicId : null,
        position: (last?.position || 0) + 1,
      },
    });

    return res.status(201).json(image);
  } catch {
    return res.status(500).json({ error: "Erro ao adicionar imagem." });
  }
});

propertyRouter.put("/:id/images/reorder", async (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ error: "order deve ser um array de IDs." });
    await Promise.all(
      order.map((imageId, i) =>
        prisma.propertyImage.updateMany({
          where: { id: imageId, propertyId: req.params.id, tenantId: req.tenant.id },
          data: { position: i + 1 },
        })
      )
    );
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Erro ao reordenar imagens." });
  }
});

propertyRouter.delete("/:id/images/:imageId", async (req, res) => {
  try {
    const image = await prisma.propertyImage.findFirst({
      where: {
        id: req.params.imageId,
        propertyId: req.params.id,
        tenantId: req.tenant.id,
      },
    });

    if (!image) {
      return res.status(404).json({ error: "Imagem nao encontrada para este imovel." });
    }

    await prisma.propertyImage.delete({ where: { id: image.id } });
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "Erro ao deletar imagem." });
  }
});
