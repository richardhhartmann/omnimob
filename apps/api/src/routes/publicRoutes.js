import { Router } from "express";
import prismaPkg from "@prisma/client";
import { prisma } from "../db.js";
import { planoPermiteTour360 } from "../middlewares/planoMiddleware.js";

const { PropertyStatus, MetricEventType } = prismaPkg;

// Tour 360° é recurso do Profissional+. Se o plano do tenant não libera, zeramos
// o flag `is360` das imagens para que a vitrine pública exiba a foto normalmente,
// sem o viewer panorâmico. O valor real permanece no banco.
function gate360(properties, plano) {
  if (planoPermiteTour360(plano)) return properties;
  const zerar = (imgs) => (imgs || []).map((img) => (img.is360 ? { ...img, is360: false } : img));
  return Array.isArray(properties)
    ? properties.map((p) => ({ ...p, images: zerar(p.images) }))
    : { ...properties, images: zerar(properties.images) };
}

function publicTenantShape(tenant) {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    whatsapp: tenant.whatsapp,
    email: tenant.email,
    description: tenant.description,
    slogan: tenant.slogan,
    logoUrl: tenant.logoUrl,
    primaryColor: tenant.primaryColor,
    secondaryColor: tenant.secondaryColor,
    showcaseHeadline: tenant.showcaseHeadline,
    showcaseSubheadline: tenant.showcaseSubheadline,
    showcaseConfig: tenant.showcaseConfig,
  };
}

export const publicRouter = Router();

publicRouter.get("/:tenantSlug/properties", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.tenantSlug },
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant nao encontrado." });
    }

    const properties = await prisma.property.findMany({
      where: { tenantId: tenant.id, status: PropertyStatus.ACTIVE },
      orderBy: { createdAt: "desc" },
      include: { images: { orderBy: { position: "asc" } } },
    });

    if (properties.length > 0) {
      const now = new Date();
      await prisma.$transaction([
        ...properties.map((property) =>
          prisma.property.update({
            where: { id: property.id },
            data: { viewCount: { increment: 1 } },
          })
        ),
        prisma.propertyMetricEvent.createMany({
          data: properties.map((property) => ({
            tenantId: tenant.id,
            propertyId: property.id,
            type: MetricEventType.VIEW,
            createdAt: now,
          })),
        }),
      ]);
    }

    return res.json({ tenant: publicTenantShape(tenant), properties: gate360(properties, tenant.plano) });
  } catch {
    return res.status(500).json({ error: "Erro ao carregar vitrine." });
  }
});

publicRouter.get("/:tenantSlug/properties/:propertyId", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.tenantSlug },
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant nao encontrado." });
    }

    const property = await prisma.property.findFirst({
      where: {
        id: req.params.propertyId,
        tenantId: tenant.id,
        status: PropertyStatus.ACTIVE,
      },
      include: { images: { orderBy: { position: "asc" } } },
    });

    if (!property) {
      return res.status(404).json({ error: "Imovel nao encontrado na vitrine." });
    }

    await prisma.$transaction([
      prisma.property.update({
        where: { id: property.id },
        data: { viewCount: { increment: 1 } },
      }),
      prisma.propertyMetricEvent.create({
        data: { tenantId: tenant.id, propertyId: property.id, type: MetricEventType.VIEW },
      }),
    ]);

    return res.json({
      tenant: publicTenantShape(tenant),
      property: gate360({ ...property, viewCount: property.viewCount + 1 }, tenant.plano),
    });
  } catch {
    return res.status(500).json({ error: "Erro ao carregar imovel." });
  }
});

publicRouter.post("/:tenantSlug/properties/:propertyId/interest", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.tenantSlug },
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant nao encontrado." });
    }

    const { name, email, phone, message } = req.body || {};

    const property = await prisma.property.findFirst({
      where: { id: req.params.propertyId, tenantId: tenant.id, status: PropertyStatus.ACTIVE },
    });

    if (!property) {
      return res.status(404).json({ error: "Imovel nao encontrado na vitrine." });
    }

    const updated = await prisma.property.update({
      where: { id: property.id },
      data: { leadCount: { increment: 1 } },
      select: { id: true, leadCount: true },
    });

    await prisma.propertyMetricEvent.create({
      data: { tenantId: tenant.id, propertyId: property.id, type: MetricEventType.LEAD },
    });

    await prisma.propertyLead.create({
      data: {
        tenantId: tenant.id,
        propertyId: property.id,
        name: typeof name === "string" ? name : null,
        email: typeof email === "string" ? email : null,
        phone: typeof phone === "string" ? phone : null,
        message: typeof message === "string" ? message : null,
        source: "showcase",
      },
    });

    return res.json({ message: "Interesse registrado com sucesso.", property: updated });
  } catch {
    return res.status(500).json({ error: "Erro ao registrar interesse." });
  }
});
