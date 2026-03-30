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
  const properties = await prisma.property.findMany({
    where: { tenantId: req.tenant.id },
    orderBy: { createdAt: "desc" },
    include: {
      publications: { orderBy: { createdAt: "asc" } },
      images: { orderBy: { position: "asc" } },
    },
  });
  return res.json(properties);
});

propertyRouter.get("/:id", async (req, res) => {
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
});

propertyRouter.post("/", async (req, res) => {
  const parsed = createPropertySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados invalidos para imovel.", details: parsed.error.flatten() });
  }

  const property = await prisma.property.create({
    data: { tenantId: req.tenant.id, ...parsed.data },
  });

  await enqueuePropertyPublication(req.tenant.id, property.id);

  const withPublications = await prisma.property.findUnique({
    where: { id: property.id },
    include: { publications: true },
  });
  return res.status(201).json(withPublications);
});

propertyRouter.put("/:id", async (req, res) => {
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
    await enqueuePropertyPublication(req.tenant.id, property.id);
  }

  const withPublications = await prisma.property.findUnique({
    where: { id: property.id },
    include: { publications: true },
  });
  return res.json(withPublications);
});

propertyRouter.delete("/:id", async (req, res) => {
  const current = await prisma.property.findFirst({
    where: { id: req.params.id, tenantId: req.tenant.id },
  });
  if (!current) {
    return res.status(404).json({ error: "Imovel nao encontrado para este tenant." });
  }

  await prisma.property.delete({ where: { id: req.params.id } });
  return res.status(204).send();
});

propertyRouter.get("/:id/publications", async (req, res) => {
  const publications = await prisma.propertyPublication.findMany({
    where: { propertyId: req.params.id, tenantId: req.tenant.id },
    orderBy: { createdAt: "asc" },
  });
  return res.json(publications);
});

propertyRouter.get("/:id/metrics", async (req, res) => {
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

  const leadConversionRate = property.viewCount > 0 ? Number(((property.leadCount / property.viewCount) * 100).toFixed(2)) : 0;
  const saleConversionRate = property.leadCount > 0 ? Number(((property.saleCount / property.leadCount) * 100).toFixed(2)) : 0;

  const timeline = await prisma.propertyMetricEvent.groupBy({
    by: ["type"],
    where: { tenantId: req.tenant.id, propertyId: req.params.id },
    _count: { _all: true },
  });

  return res.json({
    property,
    summary: {
      leadConversionRate,
      saleConversionRate,
    },
    eventsByType: timeline.map((entry) => ({ type: entry.type, count: entry._count._all })),
  });
});

async function incrementMetric(req, res, type) {
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

  const updated = await prisma.property.update({
    where: { id: req.params.id },
    data,
  });

  await prisma.propertyMetricEvent.create({
    data: {
      tenantId: req.tenant.id,
      propertyId: req.params.id,
      type,
    },
  });

  return res.json({
    id: updated.id,
    viewCount: updated.viewCount,
    leadCount: updated.leadCount,
    saleCount: updated.saleCount,
  });
}

propertyRouter.post("/:id/metrics/view", async (req, res) => {
  return incrementMetric(req, res, MetricEventType.VIEW);
});

propertyRouter.post("/:id/metrics/lead", async (req, res) => {
  return incrementMetric(req, res, MetricEventType.LEAD);
});

propertyRouter.post("/:id/metrics/sale", async (req, res) => {
  return incrementMetric(req, res, MetricEventType.SALE);
});

propertyRouter.get("/:id/images", async (req, res) => {
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
});

propertyRouter.post("/:id/images", async (req, res) => {
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
});

propertyRouter.delete("/:id/images/:imageId", async (req, res) => {
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
});
