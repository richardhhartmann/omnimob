import prismaPkg from "@prisma/client";
import { prisma } from "../db.js";

const { PublicationChannel, PublicationStatus } = prismaPkg;

const CHANNELS = [
  PublicationChannel.FACEBOOK,
  PublicationChannel.INSTAGRAM,
  PublicationChannel.WHATSAPP,
];

async function publishToChannel(channel, property) {
  // TODO: integrar com APIs reais de cada canal (Meta Graph API, WhatsApp Business API)
  await new Promise((resolve) => setTimeout(resolve, 80));
  return { externalRef: `${channel.toLowerCase()}-${property.id}` };
}

export async function enqueuePropertyPublication(tenantId, propertyId) {
  const property = await prisma.property.findFirst({ where: { id: propertyId, tenantId } });
  if (!property) return;

  for (const channel of CHANNELS) {
    await prisma.propertyPublication.upsert({
      where: { propertyId_channel: { propertyId, channel } },
      update: { status: PublicationStatus.PENDING, errorMessage: null },
      create: { tenantId, propertyId, channel, status: PublicationStatus.PENDING },
    });
  }

  for (const channel of CHANNELS) {
    try {
      const result = await publishToChannel(channel, property);
      await prisma.propertyPublication.update({
        where: { propertyId_channel: { propertyId, channel } },
        data: {
          status: PublicationStatus.PUBLISHED,
          externalRef: result.externalRef,
          errorMessage: null,
          lastAttemptAt: new Date(),
        },
      });
    } catch (error) {
      await prisma.propertyPublication.update({
        where: { propertyId_channel: { propertyId, channel } },
        data: {
          status: PublicationStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : "Falha desconhecida",
          lastAttemptAt: new Date(),
        },
      });
    }
  }
}
