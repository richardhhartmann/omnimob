import { Router } from "express";
import prismaPkg from "@prisma/client";
import { prisma } from "../db.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { enqueuePropertyPublication } from "../services/socialPublisher.js";
import { createPropertySchema, updatePropertySchema } from "../validators/propertyValidators.js";

const { PropertyStatus, MetricEventType } = prismaPkg;

export const propertyRouter = Router();
propertyRouter.use(requireTenant);

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
        include: {
          publications: { orderBy: { createdAt: "asc" } },
          images: { orderBy: { position: "asc" } },
        },
        skip,
        take: limit,
      }),
      prisma.property.count({ where }),
    ]);

    return res.json({ properties, total, page, limit });
  } catch {
    return res.status(500).json({ error: "Erro ao listar imoveis." });
  }
});

propertyRouter.get("/:id", async (req, res) => {
  try {
    const property = await prisma.property.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      include: {
        publications: { orderBy: { createdAt: "asc" } },
        images: { orderBy: { position: "asc" } },
      },
    });

    if (!property) {
      return res.status(404).json({ error: "Imovel nao encontrado para este tenant." });
    }

    return res.json(property);
  } catch {
    return res.status(500).json({ error: "Erro ao buscar imovel." });
  }
});

propertyRouter.post("/", async (req, res) => {
  try {
    const parsed = createPropertySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados invalidos para imovel.", details: parsed.error.flatten() });
    }

    const property = await prisma.property.create({
      data: { tenantId: req.tenant.id, ...parsed.data },
    });

    enqueuePropertyPublication(req.tenant.id, property.id).catch((err) =>
      console.error("Erro na publicacao do imovel:", err)
    );

    const withPublications = await prisma.property.findUnique({
      where: { id: property.id },
      include: { publications: true },
    });
    return res.status(201).json(withPublications);
  } catch {
    return res.status(500).json({ error: "Erro ao criar imovel." });
  }
});

propertyRouter.put("/:id", async (req, res) => {
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

    const property = await prisma.property.update({
      where: { id: req.params.id },
      data: parsed.data,
    });

    if (property.status === PropertyStatus.ACTIVE) {
      enqueuePropertyPublication(req.tenant.id, property.id).catch((err) =>
        console.error("Erro na republicacao do imovel:", err)
      );
    }

    const withPublications = await prisma.property.findUnique({
      where: { id: property.id },
      include: { publications: true },
    });
    return res.json(withPublications);
  } catch {
    return res.status(500).json({ error: "Erro ao atualizar imovel." });
  }
});

propertyRouter.delete("/:id", async (req, res) => {
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
