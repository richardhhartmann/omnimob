import bcrypt from "bcryptjs";
import prismaPkg from "@prisma/client";

const { PrismaClient, PropertyStatus, PublicationChannel, PublicationStatus } = prismaPkg;

const prisma = new PrismaClient();

async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

async function main() {
  const tenantA = await prisma.tenant.upsert({
    where: { slug: "imobiliaria-centro" },
    update: {
      whatsapp: "5511999999999",
      email: "contato@imobiliariacentro.com",
      description: "Especialistas em compra e venda de imoveis residenciais e comerciais.",
      slogan: "Seu novo endereco com seguranca e confianca.",
      logoUrl: "",
      primaryColor: "#6366f1",
      secondaryColor: "#d4af37",
      showcaseHeadline: "Imoveis selecionados para o seu perfil",
      showcaseSubheadline: "Atendimento consultivo, oportunidades reais e transparencia em cada etapa.",
    },
    create: {
      name: "Imobiliaria Centro",
      slug: "imobiliaria-centro",
      whatsapp: "5511999999999",
      email: "contato@imobiliariacentro.com",
      description: "Especialistas em compra e venda de imoveis residenciais e comerciais.",
      slogan: "Seu novo endereco com seguranca e confianca.",
      logoUrl: "",
      primaryColor: "#6366f1",
      secondaryColor: "#d4af37",
      showcaseHeadline: "Imoveis selecionados para o seu perfil",
      showcaseSubheadline: "Atendimento consultivo, oportunidades reais e transparencia em cada etapa.",
    },
  });

  const tenantB = await prisma.tenant.upsert({
    where: { slug: "casa-nobre" },
    update: {
      whatsapp: "5511988888888",
      email: "contato@casanobre.com",
      description: "Portfolio premium para clientes exigentes.",
      slogan: "Imoveis de alto padrao com atendimento humano.",
      logoUrl: "",
      primaryColor: "#0ea5e9",
      secondaryColor: "#d97706",
      showcaseHeadline: "Destaques exclusivos da Casa Nobre",
      showcaseSubheadline: "Conheca oportunidades selecionadas para moradia e investimento.",
    },
    create: {
      name: "Casa Nobre",
      slug: "casa-nobre",
      whatsapp: "5511988888888",
      email: "contato@casanobre.com",
      description: "Portfolio premium para clientes exigentes.",
      slogan: "Imoveis de alto padrao com atendimento humano.",
      logoUrl: "",
      primaryColor: "#0ea5e9",
      secondaryColor: "#d97706",
      showcaseHeadline: "Destaques exclusivos da Casa Nobre",
      showcaseSubheadline: "Conheca oportunidades selecionadas para moradia e investimento.",
    },
  });

  const adminPassword = await hashPassword("admin");

  await prisma.user.upsert({
    where: { username: "admin" },
    update: { tenantId: tenantA.id, name: "Administrador Centro", password: adminPassword, role: "ADMIN", isActive: true },
    create: { tenantId: tenantA.id, name: "Administrador Centro", username: "admin", password: adminPassword, role: "ADMIN", isActive: true },
  });

  await prisma.user.upsert({
    where: { username: "editor" },
    update: { tenantId: tenantA.id, name: "Editor Vitrine Centro", password: adminPassword, role: "SHOWCASE_EDITOR", isActive: true },
    create: { tenantId: tenantA.id, name: "Editor Vitrine Centro", username: "editor", password: adminPassword, role: "SHOWCASE_EDITOR", isActive: true },
  });

  await prisma.user.upsert({
    where: { username: "admin-casa" },
    update: { tenantId: tenantB.id, name: "Administrador Casa Nobre", password: adminPassword, role: "ADMIN", isActive: true },
    create: { tenantId: tenantB.id, name: "Administrador Casa Nobre", username: "admin-casa", password: adminPassword, role: "ADMIN", isActive: true },
  });

  const property = await prisma.property.upsert({
    where: { id: "seed-property-1" },
    update: {},
    create: {
      id: "seed-property-1",
      tenantId: tenantA.id,
      title: "Apartamento 2 quartos no centro",
      description: "Apartamento com 78m2, garagem e area de lazer.",
      price: 420000,
      cep: "01001000",
      address: "Rua Principal, 100 - Centro",
      neighborhood: "Centro",
      city: "Sao Paulo",
      state: "SP",
      propertyType: "Apartamento",
      bedrooms: 2,
      parkingSpots: 1,
      suites: 1,
      squareFootage: 78,
      status: PropertyStatus.ACTIVE,
    },
  });

  for (const channel of [PublicationChannel.FACEBOOK, PublicationChannel.INSTAGRAM, PublicationChannel.WHATSAPP]) {
    await prisma.propertyPublication.upsert({
      where: { propertyId_channel: { propertyId: property.id, channel } },
      update: {},
      create: {
        tenantId: tenantA.id,
        propertyId: property.id,
        channel,
        status: PublicationStatus.PUBLISHED,
        externalRef: `seed-${channel.toLowerCase()}`,
        lastAttemptAt: new Date(),
      },
    });
  }
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
