import bcrypt from "bcryptjs";
import prismaPkg from "@prisma/client";

const { PrismaClient, PropertyStatus, PublicationChannel, PublicationStatus } = prismaPkg;

const prisma = new PrismaClient();

async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

const TIPOS_IMOVEL = [
  {
    descricao: "Casa",
    atributos: [
      { descricao: "Piscina", grupo: "Lazer" },
      { descricao: "Quintal", grupo: "Lazer" },
      { descricao: "Churrasqueira", grupo: "Lazer" },
      { descricao: "Varanda", grupo: "Lazer" },
      { descricao: "Jardim", grupo: "Lazer" },
      { descricao: "Garagem Coberta", grupo: "Infraestrutura" },
      { descricao: "Área de Serviço", grupo: "Infraestrutura" },
      { descricao: "Quarto de Empregada", grupo: "Infraestrutura" },
      { descricao: "Energia Solar", grupo: "Infraestrutura" },
      { descricao: "Poço Artesiano", grupo: "Infraestrutura" },
      { descricao: "Muro/Murado", grupo: "Segurança" },
      { descricao: "Portão Eletrônico", grupo: "Segurança" },
      { descricao: "Câmeras de Segurança", grupo: "Segurança" },
      { descricao: "Alarme", grupo: "Segurança" },
    ],
  },
  {
    descricao: "Apartamento",
    atributos: [
      { descricao: "Piscina", grupo: "Lazer" },
      { descricao: "Salão de Festas", grupo: "Lazer" },
      { descricao: "Varanda/Sacada", grupo: "Lazer" },
      { descricao: "Churrasqueira", grupo: "Lazer" },
      { descricao: "Academia", grupo: "Lazer" },
      { descricao: "Playground", grupo: "Lazer" },
      { descricao: "Elevador", grupo: "Infraestrutura" },
      { descricao: "Área de Serviço", grupo: "Infraestrutura" },
      { descricao: "Depósito/Armário", grupo: "Infraestrutura" },
      { descricao: "Água Inclusa", grupo: "Infraestrutura" },
      { descricao: "Gás Encanado", grupo: "Infraestrutura" },
      { descricao: "Ar-condicionado", grupo: "Infraestrutura" },
      { descricao: "Portaria 24h", grupo: "Segurança" },
      { descricao: "Segurança 24h", grupo: "Segurança" },
      { descricao: "Interfone/Videofone", grupo: "Segurança" },
    ],
  },
  {
    descricao: "Cobertura",
    atributos: [
      { descricao: "Piscina Privativa", grupo: "Lazer" },
      { descricao: "Churrasqueira", grupo: "Lazer" },
      { descricao: "Varanda Ampla", grupo: "Lazer" },
      { descricao: "Jacuzzi/Spa", grupo: "Lazer" },
      { descricao: "Área Gourmet", grupo: "Lazer" },
      { descricao: "Vista Panorâmica", grupo: "Lazer" },
      { descricao: "Elevador Privativo", grupo: "Infraestrutura" },
      { descricao: "Ar-condicionado", grupo: "Infraestrutura" },
      { descricao: "Acabamento Premium", grupo: "Infraestrutura" },
      { descricao: "Portaria 24h", grupo: "Segurança" },
    ],
  },
  {
    descricao: "Studio",
    atributos: [
      { descricao: "Mobiliado", grupo: "Infraestrutura" },
      { descricao: "Ar-condicionado", grupo: "Infraestrutura" },
      { descricao: "Lavanderia Coletiva", grupo: "Infraestrutura" },
      { descricao: "Bicicletário", grupo: "Infraestrutura" },
      { descricao: "Coworking", grupo: "Lazer" },
      { descricao: "Academia", grupo: "Lazer" },
      { descricao: "Portaria 24h", grupo: "Segurança" },
      { descricao: "Interfone", grupo: "Segurança" },
    ],
  },
  {
    descricao: "Terreno",
    atributos: [
      { descricao: "Murado", grupo: "Infraestrutura" },
      { descricao: "Área Verde", grupo: "Infraestrutura" },
      { descricao: "Plano", grupo: "Topografia" },
      { descricao: "Em Aclive", grupo: "Topografia" },
      { descricao: "Em Declive", grupo: "Topografia" },
      { descricao: "Esquina", grupo: "Localização" },
      { descricao: "Acesso Pavimentado", grupo: "Localização" },
      { descricao: "Documentação Regular", grupo: "Documentação" },
    ],
  },
  {
    descricao: "Comercial",
    atributos: [
      { descricao: "Estacionamento", grupo: "Infraestrutura" },
      { descricao: "Gerador", grupo: "Infraestrutura" },
      { descricao: "Fibra Ótica", grupo: "Infraestrutura" },
      { descricao: "Pé-direito Alto", grupo: "Infraestrutura" },
      { descricao: "Elétrica Trifásica", grupo: "Infraestrutura" },
      { descricao: "Mezanino", grupo: "Infraestrutura" },
      { descricao: "Depósito/Almoxarifado", grupo: "Infraestrutura" },
      { descricao: "Copa/Cozinha", grupo: "Comodidades" },
      { descricao: "WC Privativo", grupo: "Comodidades" },
      { descricao: "Recepção", grupo: "Comodidades" },
      { descricao: "Ar-condicionado Central", grupo: "Comodidades" },
      { descricao: "Rampa para Deficientes", grupo: "Acessibilidade" },
      { descricao: "Elevador", grupo: "Acessibilidade" },
      { descricao: "Câmeras de Segurança", grupo: "Segurança" },
    ],
  },
  {
    descricao: "Sala Comercial",
    atributos: [
      { descricao: "Ar-condicionado", grupo: "Comodidades" },
      { descricao: "Recepção Compartilhada", grupo: "Comodidades" },
      { descricao: "Copa", grupo: "Comodidades" },
      { descricao: "WC Privativo", grupo: "Comodidades" },
      { descricao: "Internet/Fibra", grupo: "Infraestrutura" },
      { descricao: "Estacionamento", grupo: "Infraestrutura" },
      { descricao: "Elevador", grupo: "Acessibilidade" },
      { descricao: "Portaria 24h", grupo: "Segurança" },
      { descricao: "Câmeras de Segurança", grupo: "Segurança" },
    ],
  },
  {
    descricao: "Casa em Condominio",
    atributos: [
      { descricao: "Piscina", grupo: "Lazer" },
      { descricao: "Churrasqueira", grupo: "Lazer" },
      { descricao: "Playground", grupo: "Lazer" },
      { descricao: "Salão de Festas", grupo: "Lazer" },
      { descricao: "Academia", grupo: "Lazer" },
      { descricao: "Quadra Esportiva", grupo: "Lazer" },
      { descricao: "Área Verde", grupo: "Lazer" },
      { descricao: "Portaria 24h", grupo: "Segurança" },
      { descricao: "Guarita", grupo: "Segurança" },
      { descricao: "Câmeras de Segurança", grupo: "Segurança" },
      { descricao: "Condomínio Fechado", grupo: "Segurança" },
    ],
  },
];

async function main() {
  // ─── Tipos de imóvel ──────────────────────────────────────────────────────

  console.log("→ Criando tipos de imóvel...");
  const tiposMap = {};
  for (const tipo of TIPOS_IMOVEL) {
    let tipoRecord = await prisma.tipoImovel.findFirst({ where: { descricao: tipo.descricao } });
    if (!tipoRecord) {
      tipoRecord = await prisma.tipoImovel.create({ data: { descricao: tipo.descricao } });
    }
    tiposMap[tipo.descricao] = tipoRecord;

    for (const atr of tipo.atributos) {
      const existing = await prisma.modeloAtributo.findFirst({
        where: { tipoId: tipoRecord.id, descricao: atr.descricao },
      });
      if (!existing) {
        await prisma.modeloAtributo.create({
          data: { tipoId: tipoRecord.id, descricao: atr.descricao, grupo: atr.grupo },
        });
      }
    }
    console.log(`  ✓ ${tipo.descricao} (${tipo.atributos.length} atributos)`);
  }

  // ─── Tenants ──────────────────────────────────────────────────────────────

  console.log("→ Criando tenants...");
  const tenantA = await prisma.tenant.upsert({
    where: { slug: "imobiliaria-centro" },
    update: {},
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
  console.log(`  ✓ Tenant A: ${tenantA.slug} (id: ${tenantA.id})`);

  const tenantB = await prisma.tenant.upsert({
    where: { slug: "casa-nobre" },
    update: {},
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
  console.log(`  ✓ Tenant B: ${tenantB.slug} (id: ${tenantB.id})`);

  // ─── Cargos ───────────────────────────────────────────────────────────────

  console.log("→ Criando cargos...");

  let cargoAdmin = await prisma.cargo.findFirst({ where: { descricao: "Administrador" } });
  if (!cargoAdmin) {
    cargoAdmin = await prisma.cargo.create({
      data: {
        descricao: "Administrador",
        acessarPainel: true,
        editarPagina: true,
        gerenciarImoveis: true,
        gerenciarLeads: true,
        gerenciarUsuarios: true,
        gerenciarClientes: true,
        verRelatorios: true,
        publicarRedes: true,
      },
    });
  }
  console.log(`  ✓ Cargo Administrador (id: ${cargoAdmin.id})`);

  let cargoCorretor = await prisma.cargo.findFirst({ where: { descricao: "Corretor" } });
  if (!cargoCorretor) {
    cargoCorretor = await prisma.cargo.create({
      data: {
        descricao: "Corretor",
        acessarPainel: true,
        editarPagina: false,
        gerenciarImoveis: true,
        gerenciarLeads: true,
        gerenciarUsuarios: false,
        gerenciarClientes: true,
        verRelatorios: true,
        publicarRedes: true,
      },
    });
  }
  console.log(`  ✓ Cargo Corretor (id: ${cargoCorretor.id})`);

  let cargoEditor = await prisma.cargo.findFirst({ where: { descricao: "Editor de Vitrine" } });
  if (!cargoEditor) {
    cargoEditor = await prisma.cargo.create({
      data: {
        descricao: "Editor de Vitrine",
        acessarPainel: false,
        editarPagina: true,
        gerenciarImoveis: false,
        gerenciarLeads: false,
        gerenciarUsuarios: false,
        gerenciarClientes: false,
        verRelatorios: false,
        publicarRedes: false,
      },
    });
  }
  console.log(`  ✓ Cargo Editor de Vitrine (id: ${cargoEditor.id})`);

  // ─── Usuários ─────────────────────────────────────────────────────────────

  console.log("→ Criando usuários...");
  const adminPassword = await hashPassword("admin");

  for (const { login, nome, tenantId, cargoCodigo } of [
    { login: "admin",      nome: "Administrador Centro",    tenantId: tenantA.id, cargoCodigo: cargoAdmin.id },
    { login: "editor",     nome: "Editor Vitrine Centro",   tenantId: tenantA.id, cargoCodigo: cargoEditor.id },
    { login: "admin-casa", nome: "Administrador Casa Nobre", tenantId: tenantB.id, cargoCodigo: cargoAdmin.id },
  ]) {
    const existing = await prisma.usuario.findUnique({ where: { login } });
    if (existing) {
      await prisma.usuario.update({
        where: { login },
        data: { nome, tenantId, cargoCodigo, senha: adminPassword, ativo: true },
      });
      console.log(`  ✓ Usuário atualizado: ${login}`);
    } else {
      await prisma.usuario.create({
        data: { login, nome, tenantId, cargoCodigo, senha: adminPassword, ativo: true },
      });
      console.log(`  ✓ Usuário criado: ${login}`);
    }
  }

  // ─── Imóvel de exemplo ────────────────────────────────────────────────────

  console.log("→ Criando imóvel de exemplo...");
  const tipoApartamento = tiposMap["Apartamento"];
  const property = await prisma.property.upsert({
    where: { id: "seed-property-1" },
    update: {},
    create: {
      id: "seed-property-1",
      tenantId: tenantA.id,
      tipoImovelId: tipoApartamento?.id ?? null,
      propertyType: "Apartamento",
      title: "Apartamento 2 quartos no centro",
      description: "Apartamento com 78m2, garagem e area de lazer.",
      price: 420000,
      cep: "01001000",
      address: "Rua Principal, 100 - Centro",
      neighborhood: "Centro",
      city: "Sao Paulo",
      state: "SP",
      bedrooms: 2,
      parkingSpots: 1,
      suites: 1,
      squareFootage: 78,
      status: PropertyStatus.ACTIVE,
    },
  });
  console.log(`  ✓ Imóvel: ${property.title}`);

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

  console.log("\n✅ Seed concluído com sucesso!");
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (error) => {
    console.error("\n❌ Seed falhou:", error.message);
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
