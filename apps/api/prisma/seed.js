import bcrypt from "bcryptjs";
import prismaPkg from "@prisma/client";
/* O catálogo de cargos vive no serviço, não aqui: o provisionamento de tenant
   novo usa a MESMA lista, e duas cópias divergiriam na primeira permissão nova
   (foi assim que `verConfiguracoes` quase nasceu só num dos dois lados). */
import { CARGOS_PADRAO as CARGOS, dadosDoCargo } from "../src/services/cargosPadrao.js";
import { TIPOS_IMOVEL, criarTiposPadrao } from "../src/services/tiposPadrao.js";

const {
  PrismaClient,
  PropertyStatus,
  PublicationChannel,
  PublicationStatus,
  MetricEventType,
  TipoVenda,
  AndamentoImovel,
} = prismaPkg;

const prisma = new PrismaClient();

// Os dados de exemplo (tenants, usuários, imóveis, leads, vendas) só são criados
// quando o seed roda com a flag `--dev` (ou SEED_DEV=true). Sem ela, apenas os
// dados base — cargos, tipos de imóvel e atributos — são carregados. É o que todo
// tenant novo precisa em produção; imóveis ficam restritos ao ambiente de dev.
const SEED_DEV = process.argv.includes("--dev") || process.env.SEED_DEV === "true";

async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

// ════════════════════════════════════════════════════════════════════════════
//  DADOS BASE — tipos de imóvel e atributos (esses sim, compartilhados)
// ════════════════════════════════════════════════════════════════════════════



// ════════════════════════════════════════════════════════════════════════════
//  DADOS DEV — somente com --dev (apenas para desenvolvimento)
// ════════════════════════════════════════════════════════════════════════════

const TENANTS_DEV = [
  {
    slug: "imobiliaria-centro",
    name: "Imobiliaria Centro",
    cnpj: "12.345.678/0001-90",
    creci: "CRECI-SP 12345-J",
    whatsapp: "5511999999999",
    telefone: "1133334444",
    email: "contato@imobiliariacentro.com",
    description: "Especialistas em compra e venda de imoveis residenciais e comerciais.",
    slogan: "Seu novo endereco com seguranca e confianca.",
    primaryColor: "#6366f1",
    secondaryColor: "#d4af37",
    showcaseHeadline: "Imoveis selecionados para o seu perfil",
    showcaseSubheadline: "Atendimento consultivo, oportunidades reais e transparencia em cada etapa.",
    cep: "01001000",
    endereco: "Praca da Se, 100 - Centro",
    cidade: "Sao Paulo",
    estado: "SP",
  },
  {
    slug: "casa-nobre",
    name: "Casa Nobre",
    cnpj: "98.765.432/0001-10",
    creci: "CRECI-SP 67890-J",
    whatsapp: "5511988888888",
    telefone: "1144445555",
    email: "contato@casanobre.com",
    description: "Portfolio premium para clientes exigentes.",
    slogan: "Imoveis de alto padrao com atendimento humano.",
    primaryColor: "#0ea5e9",
    secondaryColor: "#d97706",
    showcaseHeadline: "Destaques exclusivos da Casa Nobre",
    showcaseSubheadline: "Conheca oportunidades selecionadas para moradia e investimento.",
    cep: "04543000",
    endereco: "Av. Brigadeiro Faria Lima, 4000 - Itaim Bibi",
    cidade: "Sao Paulo",
    estado: "SP",
  },
];

const USUARIOS_DEV = [
  { login: "admin",         nome: "Administrador Centro",     tenantSlug: "imobiliaria-centro", cargo: "Administrador" },
  { login: "gerente",       nome: "Gerente Centro",           tenantSlug: "imobiliaria-centro", cargo: "Gerente" },
  { login: "corretor1",     nome: "Carlos Andrade",           tenantSlug: "imobiliaria-centro", cargo: "Corretor" },
  { login: "corretor2",     nome: "Beatriz Monteiro",         tenantSlug: "imobiliaria-centro", cargo: "Corretor" },
  { login: "assistente",    nome: "Renata Campos",            tenantSlug: "imobiliaria-centro", cargo: "Assistente Comercial" },
  { login: "marketing",     nome: "Lucas Ferraz",             tenantSlug: "imobiliaria-centro", cargo: "Marketing" },
  { login: "editor",        nome: "Editor Vitrine Centro",    tenantSlug: "imobiliaria-centro", cargo: "Editor de Vitrine" },
  { login: "admin-casa",    nome: "Administrador Casa Nobre", tenantSlug: "casa-nobre",         cargo: "Administrador" },
  { login: "corretor-casa", nome: "Paulo Tavares",            tenantSlug: "casa-nobre",         cargo: "Corretor" },
];

// Cada imóvel referencia o tipo e os atributos pela descrição (resolvidos para id
// no momento de criar). Os atributos listados devem existir no respectivo tipo.
const IMOVEIS_DEV = [
  {
    id: "seed-prop-1", tenantSlug: "imobiliaria-centro", tipo: "Apartamento",
    title: "Apartamento 2 quartos no Centro",
    description: "Apartamento de 78m² com 2 quartos, 1 suíte, varanda e 1 vaga de garagem. A poucos metros do metrô.",
    price: 420000, cep: "01001000", address: "Rua Direita, 250 - Centro", neighborhood: "Centro", city: "Sao Paulo", state: "SP",
    bedrooms: 2, suites: 1, parkingSpots: 1, squareFootage: 78,
    andamento: "PRONTO_PARA_MORAR", aceitaPermuta: false, status: "ACTIVE",
    atributos: ["Elevador", "Portaria 24h", "Área de Serviço", "Ar-condicionado"],
    publications: { FACEBOOK: "PUBLISHED", INSTAGRAM: "PUBLISHED" },
    views: 142, leads: 9, sales: 0,
  },
  {
    id: "seed-prop-2", tenantSlug: "imobiliaria-centro", tipo: "Casa",
    title: "Casa térrea com quintal em Pinheiros",
    description: "Casa térrea de 160m² com 3 quartos, quintal espaçoso, churrasqueira e garagem coberta para 2 carros.",
    price: 890000, cep: "05422000", address: "Rua dos Pinheiros, 800 - Pinheiros", neighborhood: "Pinheiros", city: "Sao Paulo", state: "SP",
    bedrooms: 3, suites: 1, parkingSpots: 2, squareFootage: 160,
    andamento: "PRONTO_PARA_MORAR", aceitaPermuta: false, status: "ACTIVE",
    atributos: ["Quintal", "Churrasqueira", "Garagem Coberta", "Portão Eletrônico"],
    publications: { FACEBOOK: "PUBLISHED", WHATSAPP: "PUBLISHED" },
    views: 98, leads: 5, sales: 0,
  },
  {
    id: "seed-prop-3", tenantSlug: "imobiliaria-centro", tipo: "Cobertura",
    title: "Cobertura duplex com vista panorâmica",
    description: "Cobertura duplex de 220m², 4 suítes, piscina privativa, área gourmet e vista panorâmica da cidade.",
    price: 2150000, cep: "01310000", address: "Av. Paulista, 1500 - Bela Vista", neighborhood: "Bela Vista", city: "Sao Paulo", state: "SP",
    bedrooms: 4, suites: 4, parkingSpots: 3, squareFootage: 220,
    andamento: "PRONTO_PARA_MORAR", aceitaPermuta: true, status: "ACTIVE",
    atributos: ["Piscina Privativa", "Área Gourmet", "Vista Panorâmica", "Elevador Privativo"],
    publications: { FACEBOOK: "PUBLISHED", INSTAGRAM: "PUBLISHED", WHATSAPP: "PUBLISHED" },
    views: 210, leads: 14, sales: 0,
  },
  {
    id: "seed-prop-4", tenantSlug: "imobiliaria-centro", tipo: "Studio",
    title: "Studio mobiliado próximo ao metrô",
    description: "Studio de 32m² totalmente mobiliado, ideal para investimento ou primeira moradia. Próximo à estação.",
    price: 295000, cep: "01153000", address: "Rua Barra Funda, 120 - Barra Funda", neighborhood: "Barra Funda", city: "Sao Paulo", state: "SP",
    bedrooms: 1, suites: 0, parkingSpots: 0, squareFootage: 32,
    andamento: "PRONTO_PARA_MORAR", aceitaPermuta: false, status: "ACTIVE",
    atributos: ["Mobiliado", "Ar-condicionado", "Academia", "Portaria 24h"],
    publications: { INSTAGRAM: "PUBLISHED" },
    views: 76, leads: 6, sales: 0,
  },
  {
    id: "seed-prop-5", tenantSlug: "imobiliaria-centro", tipo: "Kitnet",
    title: "Kitnet compacta para estudantes",
    description: "Kitnet de 24m² mobiliada, próxima a universidades, com lavanderia coletiva no prédio.",
    price: 180000, cep: "05508000", address: "Rua do Matão, 50 - Butantã", neighborhood: "Butantã", city: "Sao Paulo", state: "SP",
    bedrooms: 1, suites: 0, parkingSpots: 0, squareFootage: 24,
    andamento: "PRONTO_PARA_MORAR", aceitaPermuta: false, status: "ACTIVE",
    atributos: ["Mobiliado", "Lavanderia Coletiva", "Interfone"],
    publications: { FACEBOOK: "FAILED" },
    views: 54, leads: 3, sales: 0,
  },
  {
    id: "seed-prop-6", tenantSlug: "imobiliaria-centro", tipo: "Sobrado",
    title: "Sobrado 3 suítes em obras",
    description: "Sobrado moderno de 240m² em construção, 3 suítes, closet, churrasqueira e garagem para 3 carros.",
    price: 1180000, cep: "02401000", address: "Rua Voluntários da Pátria, 900 - Santana", neighborhood: "Santana", city: "Sao Paulo", state: "SP",
    bedrooms: 3, suites: 3, parkingSpots: 3, squareFootage: 240,
    andamento: "EM_CONSTRUCAO", aceitaPermuta: false, status: "DRAFT",
    atributos: ["Quintal", "Churrasqueira", "Suíte Master", "Garagem Coberta"],
    publications: {},
    views: 12, leads: 0, sales: 0,
  },
  {
    id: "seed-prop-7", tenantSlug: "imobiliaria-centro", tipo: "Sala Comercial",
    title: "Sala comercial mobiliada na Paulista",
    description: "Sala comercial de 45m² mobiliada, com ar-condicionado, copa e estacionamento. Pronta para uso.",
    price: 560000, cep: "01310100", address: "Av. Paulista, 2200 - Cerqueira César", neighborhood: "Cerqueira César", city: "Sao Paulo", state: "SP",
    bedrooms: 0, suites: 0, parkingSpots: 1, squareFootage: 45,
    andamento: "PRONTO_PARA_MORAR", aceitaPermuta: false, status: "ACTIVE",
    atributos: ["Ar-condicionado", "Copa", "WC Privativo", "Estacionamento"],
    publications: { FACEBOOK: "PUBLISHED", INSTAGRAM: "FAILED" },
    views: 64, leads: 4, sales: 0,
  },
  {
    id: "seed-prop-8", tenantSlug: "imobiliaria-centro", tipo: "Terreno",
    title: "Terreno plano em bairro nobre",
    description: "Terreno de 500m² plano, murado, de esquina e com documentação regular. Ótimo para construção.",
    price: 740000, cep: "05650000", address: "Rua Morumbi, 1200 - Morumbi", neighborhood: "Morumbi", city: "Sao Paulo", state: "SP",
    bedrooms: 0, suites: 0, parkingSpots: 0, squareFootage: 500,
    andamento: null, aceitaPermuta: true, status: "INACTIVE",
    atributos: ["Murado", "Plano", "Documentação Regular", "Esquina"],
    publications: {},
    views: 33, leads: 1, sales: 0,
  },
  {
    id: "seed-prop-9", tenantSlug: "imobiliaria-centro", tipo: "Loft",
    title: "Loft industrial reformado",
    description: "Loft de 90m² com pé-direito alto, mezanino, totalmente reformado e com 1 vaga. Estilo industrial.",
    price: 780000, cep: "05425000", address: "Rua Cardeal Arcoverde, 1500 - Pinheiros", neighborhood: "Pinheiros", city: "Sao Paulo", state: "SP",
    bedrooms: 1, suites: 1, parkingSpots: 1, squareFootage: 90,
    andamento: "PRONTO_PARA_MORAR", aceitaPermuta: false, status: "ACTIVE",
    atributos: ["Pé-direito Alto", "Mezanino", "Ar-condicionado", "Vaga de Garagem"],
    publications: { FACEBOOK: "PUBLISHED", INSTAGRAM: "PUBLISHED" },
    views: 120, leads: 7, sales: 1,
  },
  {
    id: "seed-prop-10", tenantSlug: "imobiliaria-centro", tipo: "Galpão",
    title: "Galpão logístico com doca",
    description: "Galpão de 1200m² com pé-direito alto, doca de carga, elétrica trifásica e amplo pátio de manobra.",
    price: 3400000, cep: "07221000", address: "Rod. Presidente Dutra, km 225 - Guarulhos", neighborhood: "Cumbica", city: "Guarulhos", state: "SP",
    bedrooms: 0, suites: 0, parkingSpots: 10, squareFootage: 1200,
    andamento: "PRONTO_PARA_MORAR", aceitaPermuta: false, status: "ACTIVE",
    atributos: ["Pé-direito Alto", "Doca de Carga", "Elétrica Trifásica", "Estacionamento"],
    publications: { WHATSAPP: "PUBLISHED" },
    views: 41, leads: 2, sales: 0,
  },
  {
    id: "seed-prop-11", tenantSlug: "casa-nobre", tipo: "Casa de Praia",
    title: "Casa de praia frente ao mar",
    description: "Casa de 280m² em frente à praia, com 5 suítes, piscina, varanda gourmet e vista deslumbrante para o mar.",
    price: 3200000, cep: "11250000", address: "Av. Beira Mar, 500 - Praia das Astúrias", neighborhood: "Astúrias", city: "Guarujá", state: "SP",
    bedrooms: 5, suites: 5, parkingSpots: 4, squareFootage: 280,
    andamento: "PRONTO_PARA_MORAR", aceitaPermuta: true, status: "ACTIVE",
    atributos: ["Vista para o Mar", "Piscina", "Churrasqueira", "Varanda Gourmet"],
    publications: { FACEBOOK: "PUBLISHED", INSTAGRAM: "PUBLISHED", WHATSAPP: "PUBLISHED" },
    views: 305, leads: 22, sales: 0,
  },
  {
    id: "seed-prop-12", tenantSlug: "casa-nobre", tipo: "Cobertura",
    title: "Cobertura de alto padrão no Itaim",
    description: "Cobertura de 320m² com acabamento premium, jacuzzi, área gourmet e 4 vagas. Localização privilegiada.",
    price: 4800000, cep: "04534000", address: "Rua Joaquim Floriano, 100 - Itaim Bibi", neighborhood: "Itaim Bibi", city: "Sao Paulo", state: "SP",
    bedrooms: 4, suites: 4, parkingSpots: 4, squareFootage: 320,
    andamento: "PRONTO_PARA_MORAR", aceitaPermuta: false, status: "ACTIVE",
    atributos: ["Piscina Privativa", "Jacuzzi/Spa", "Área Gourmet", "Acabamento Premium"],
    publications: { FACEBOOK: "PUBLISHED", INSTAGRAM: "PUBLISHED" },
    views: 188, leads: 11, sales: 0,
  },
  {
    id: "seed-prop-13", tenantSlug: "casa-nobre", tipo: "Chácara",
    title: "Chácara com lago e pomar",
    description: "Chácara de 5000m² com casa sede, lago, pomar, piscina e casa de caseiro. Ideal para lazer e descanso.",
    price: 1450000, cep: "13212000", address: "Estrada do Campo, s/n - Zona Rural", neighborhood: "Zona Rural", city: "Jundiaí", state: "SP",
    bedrooms: 4, suites: 2, parkingSpots: 6, squareFootage: 5000,
    andamento: "PRONTO_PARA_MORAR", aceitaPermuta: true, status: "ACTIVE",
    atributos: ["Piscina", "Churrasqueira", "Lago/Açude", "Pomar", "Casa de Caseiro"],
    publications: { INSTAGRAM: "PUBLISHED", WHATSAPP: "PUBLISHED" },
    views: 97, leads: 6, sales: 0,
  },
  {
    id: "seed-prop-14", tenantSlug: "casa-nobre", tipo: "Apartamento",
    title: "Apartamento garden com 3 suítes",
    description: "Apartamento garden de 145m² com 3 suítes, quintal privativo, lazer completo e 3 vagas de garagem.",
    price: 1750000, cep: "04077000", address: "Av. Ibirapuera, 2500 - Moema", neighborhood: "Moema", city: "Sao Paulo", state: "SP",
    bedrooms: 3, suites: 3, parkingSpots: 3, squareFootage: 145,
    andamento: "PRONTO_PARA_MORAR", aceitaPermuta: false, status: "DRAFT",
    atributos: ["Piscina", "Academia", "Salão de Festas", "Portaria 24h"],
    publications: {},
    views: 25, leads: 1, sales: 1,
  },
];

const CLIENTES_DEV = [
  { id: "seed-cli-1", tenantSlug: "imobiliaria-centro", nome: "Marcos Ribeiro",  cpf: "111.222.333-44", email: "marcos.ribeiro@email.com",  telefone: "(11) 98877-1122", cidade: "Sao Paulo", estado: "SP" },
  { id: "seed-cli-2", tenantSlug: "imobiliaria-centro", nome: "Juliana Castro",  cpf: "222.333.444-55", email: "juliana.castro@email.com",  telefone: "(11) 97766-2233", cidade: "Sao Paulo", estado: "SP" },
  { id: "seed-cli-3", tenantSlug: "casa-nobre",         nome: "Fernanda Alves",  cpf: "333.444.555-66", email: "fernanda.alves@email.com",  telefone: "(11) 96655-3344", cidade: "Sao Paulo", estado: "SP" },
];

const VENDAS_DEV = [
  { id: "seed-venda-1", tenantSlug: "imobiliaria-centro", propertyId: "seed-prop-9",  clienteId: "seed-cli-1", usuarioLogin: "corretor1",  tipo: "VENDA", valor: 765000,  data: "2026-04-18", comissao: 38250 },
  { id: "seed-venda-2", tenantSlug: "casa-nobre",         propertyId: "seed-prop-14", clienteId: "seed-cli-3", usuarioLogin: "admin-casa", tipo: "VENDA", valor: 1720000, data: "2026-05-05", comissao: 86000 },
];

// Pools para gerar leads realistas
const LEAD_NOMES = [
  "Ana Souza", "Bruno Lima", "Carla Mendes", "Diego Rocha", "Eduarda Pinto",
  "Felipe Gomes", "Gabriela Dias", "Henrique Alves", "Isabela Costa", "João Pereira",
  "Larissa Ramos", "Marcelo Nunes", "Natália Freitas", "Otávio Barros", "Patrícia Lopes",
  "Rafael Teixeira", "Sofia Carvalho", "Thiago Moraes", "Vanessa Lima", "William Santos",
];
const LEAD_MENSAGENS = [
  "Tenho interesse neste imóvel, podem me ligar?",
  "Aceita financiamento bancário?",
  "Gostaria de agendar uma visita.",
  "Qual o valor do condomínio e do IPTU?",
  "Esse imóvel ainda está disponível?",
  "Aceita permuta por outro imóvel?",
  "Pode me enviar mais fotos?",
  "Qual o valor de entrada?",
];
const LEAD_SOURCES = ["showcase", "whatsapp", "facebook", "instagram"];

// ─── Helpers de geração ──────────────────────────────────────────────────────

// Distribui n datas dentro dos últimos `dias` dias (mais recentes ao final).
function spreadDates(n, dias) {
  const out = [];
  const agora = Date.now();
  const span = dias * 24 * 60 * 60 * 1000;
  for (let i = 0; i < n; i++) {
    const base = agora - Math.floor(((i + 0.5) / Math.max(n, 1)) * span);
    const jitter = Math.floor(Math.random() * 12 * 60 * 60 * 1000);
    out.push(new Date(base - jitter));
  }
  return out;
}

function slugifyEmail(nome) {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, ".");
}

function fakePhone(i) {
  const n = String(900000000 + ((i * 73) % 99999999)).slice(0, 9);
  return `(11) ${n.slice(0, 5)}-${n.slice(5)}`;
}

// ─── Seeders ───────────────────────────────────────────────────────────────

/* Cargos são POR IMOBILIÁRIA, então este seeder roda depois dos tenants e
   devolve um mapa de dois níveis: `map[slug][descricao]`.

   Antes ele rodava antes de existir tenant e criava um conjunto único, global.
   Era esse conjunto que todas as imobiliárias dividiam — inclusive as criadas
   em produção pelo provisionamento, que ia buscar o "Administrador" do seed. */
async function seedCargos(tenants) {
  console.log("→ Cargos (um conjunto por imobiliária)...");
  const map = {};
  for (const [slug, tenant] of Object.entries(tenants)) {
    map[slug] = {};
    for (const modelo of CARGOS) {
      const data = dadosDoCargo(modelo, tenant.id);
      let cargo = await prisma.cargo.findFirst({
        where: { tenantId: tenant.id, descricao: modelo.descricao },
      });
      if (cargo) {
        cargo = await prisma.cargo.update({ where: { id: cargo.id }, data });
      } else {
        cargo = await prisma.cargo.create({ data });
      }
      map[slug][modelo.descricao] = cargo;
    }
    console.log(`  ✓ ${slug} — ${CARGOS.length} cargos`);
  }
  return map;
}

/* Tipos são POR IMOBILIÁRIA, então este seeder roda depois dos tenants e
   devolve mapas de dois níveis: `tiposMap[slug][descricao]`.

   A criação em si mora em `criarTiposPadrao` — o mesmo caminho que o
   provisionamento usa. Aqui fica só a releitura, porque o seed de imóveis de
   exemplo precisa dos ids para amarrar imóvel a tipo e a atributo. */
async function seedTipos(tenants) {
  console.log("→ Tipos de imóvel e atributos (um catálogo por imobiliária)...");
  const tiposMap = {};
  const atributosMap = {};

  for (const [slug, tenant] of Object.entries(tenants)) {
    await criarTiposPadrao(prisma, tenant.id);

    tiposMap[slug] = {};
    atributosMap[slug] = {};
    const tipos = await prisma.tipoImovel.findMany({
      where: { tenantId: tenant.id },
      include: { atributos: true },
    });
    for (const t of tipos) {
      tiposMap[slug][t.descricao] = t;
      atributosMap[slug][t.descricao] = Object.fromEntries(
        t.atributos.map((a) => [a.descricao, a]),
      );
    }
    console.log(`  ✓ ${slug} — ${tipos.length} tipos`);
  }
  return { tiposMap, atributosMap };
}

async function seedTenants() {
  console.log("→ [dev] Tenants...");
  const map = {};
  for (const t of TENANTS_DEV) {
    const tenant = await prisma.tenant.upsert({
      where: { slug: t.slug },
      update: {},
      create: { ...t, logoUrl: "" },
    });
    map[t.slug] = tenant;
    console.log(`  ✓ ${t.slug} (id: ${tenant.id})`);
  }
  return map;
}

async function seedUsuarios(tenants, cargos) {
  console.log("→ [dev] Usuários (senha: admin)...");
  const senha = await hashPassword("admin");
  for (const u of USUARIOS_DEV) {
    const tenantId = tenants[u.tenantSlug].id;
    // O cargo agora vem do conjunto DA imobiliária do usuário.
    const cargoCodigo = cargos[u.tenantSlug][u.cargo].id;
    await prisma.usuario.upsert({
      where: { login: u.login },
      update: { nome: u.nome, tenantId, cargoCodigo, senha, ativo: true },
      create: { login: u.login, nome: u.nome, tenantId, cargoCodigo, senha, ativo: true },
    });
    console.log(`  ✓ ${u.login} — ${u.cargo}`);
  }
}

async function seedClientes(tenants) {
  console.log("→ [dev] Clientes...");
  for (const c of CLIENTES_DEV) {
    const { id, tenantSlug, ...rest } = c;
    const tenantId = tenants[tenantSlug].id;
    await prisma.cliente.upsert({
      where: { id },
      update: { ...rest, tenantId },
      create: { id, tenantId, ...rest },
    });
    console.log(`  ✓ ${c.nome}`);
  }
}

async function seedImoveis(tenants, tiposMap, atributosMap) {
  console.log("→ [dev] Imóveis, atributos, imagens, publicações, leads e métricas...");
  const ids = IMOVEIS_DEV.map((i) => i.id);

  // Limpa filhos sem chave natural para evitar duplicação ao re-rodar.
  await prisma.propertyLead.deleteMany({ where: { propertyId: { in: ids } } });
  await prisma.propertyMetricEvent.deleteMany({ where: { propertyId: { in: ids } } });

  for (const im of IMOVEIS_DEV) {
    const tenant = tenants[im.tenantSlug];
    // O tipo agora vem do catálogo DA imobiliária do imóvel.
    const tipo = tiposMap[im.tenantSlug]?.[im.tipo];

    const data = {
      tenantId: tenant.id,
      tipoImovelId: tipo?.id ?? null,
      propertyType: im.tipo,
      title: im.title,
      description: im.description,
      price: im.price,
      cep: im.cep,
      address: im.address,
      neighborhood: im.neighborhood,
      city: im.city,
      state: im.state,
      bedrooms: im.bedrooms,
      suites: im.suites,
      parkingSpots: im.parkingSpots,
      squareFootage: im.squareFootage,
      andamento: im.andamento ? AndamentoImovel[im.andamento] : null,
      aceitaPermuta: !!im.aceitaPermuta,
      status: PropertyStatus[im.status],
      viewCount: im.views ?? 0,
      leadCount: im.leads ?? 0,
      saleCount: im.sales ?? 0,
    };

    const property = await prisma.property.upsert({
      where: { id: im.id },
      update: data,
      create: { id: im.id, ...data },
    });

    // Atributos
    for (const atrDesc of im.atributos ?? []) {
      const atr = atributosMap[im.tenantSlug]?.[im.tipo]?.[atrDesc];
      if (!atr) {
        console.warn(`    ! atributo "${atrDesc}" não existe no tipo "${im.tipo}" — ignorado`);
        continue;
      }
      await prisma.imovelAtributo.upsert({
        where: { propertyId_atributoId: { propertyId: property.id, atributoId: atr.id } },
        update: {},
        create: { propertyId: property.id, atributoId: atr.id },
      });
    }

    // Imagens (placeholders estáveis)
    const numFotos = im.status === "ACTIVE" ? 4 : 2;
    for (let k = 0; k < numFotos; k++) {
      const imgId = `seed-img-${property.id}-${k}`;
      const url = `https://picsum.photos/seed/${property.id}-${k}/1024/768`;
      await prisma.propertyImage.upsert({
        where: { id: imgId },
        update: { url, position: k, tenantId: tenant.id },
        create: { id: imgId, tenantId: tenant.id, propertyId: property.id, url, position: k },
      });
    }

    // Publicações sociais
    for (const [channel, status] of Object.entries(im.publications ?? {})) {
      await prisma.propertyPublication.upsert({
        where: { propertyId_channel: { propertyId: property.id, channel: PublicationChannel[channel] } },
        update: { status: PublicationStatus[status], lastAttemptAt: new Date() },
        create: {
          tenantId: tenant.id,
          propertyId: property.id,
          channel: PublicationChannel[channel],
          status: PublicationStatus[status],
          externalRef: status === "PUBLISHED" ? `seed-${channel.toLowerCase()}-${property.id}` : null,
          errorMessage: status === "FAILED" ? "Token de acesso expirado (exemplo de seed)" : null,
          lastAttemptAt: new Date(),
        },
      });
    }

    // Leads reais (quantidade = leadCount) + eventos de métrica correspondentes
    const leadDates = spreadDates(im.leads ?? 0, 45);
    if (leadDates.length) {
      await prisma.propertyLead.createMany({
        data: leadDates.map((createdAt, i) => {
          const nome = LEAD_NOMES[(i + property.id.length) % LEAD_NOMES.length];
          return {
            tenantId: tenant.id,
            propertyId: property.id,
            name: nome,
            email: `${slugifyEmail(nome)}@email.com`,
            phone: fakePhone(i + property.id.length),
            message: LEAD_MENSAGENS[i % LEAD_MENSAGENS.length],
            source: LEAD_SOURCES[i % LEAD_SOURCES.length],
            createdAt,
          };
        }),
      });
    }

    // Eventos de métrica (VIEW / LEAD / SALE) espalhados no tempo
    const eventos = [];
    for (const d of spreadDates(im.views ?? 0, 45)) eventos.push({ tenantId: tenant.id, propertyId: property.id, type: MetricEventType.VIEW, createdAt: d });
    for (const d of leadDates) eventos.push({ tenantId: tenant.id, propertyId: property.id, type: MetricEventType.LEAD, createdAt: d });
    for (const d of spreadDates(im.sales ?? 0, 45)) eventos.push({ tenantId: tenant.id, propertyId: property.id, type: MetricEventType.SALE, createdAt: d });
    if (eventos.length) await prisma.propertyMetricEvent.createMany({ data: eventos });

    console.log(`  ✓ ${im.title} [${im.status}]`);
  }
}

async function seedVendas(tenants) {
  console.log("→ [dev] Vendas...");
  for (const v of VENDAS_DEV) {
    const tenantId = tenants[v.tenantSlug].id;
    const usuario = await prisma.usuario.findUnique({ where: { login: v.usuarioLogin } });
    if (!usuario) {
      console.warn(`    ! usuário "${v.usuarioLogin}" não encontrado — venda ignorada`);
      continue;
    }
    const venda = {
      tenantId,
      propertyId: v.propertyId,
      clienteId: v.clienteId,
      usuarioId: usuario.id,
      tipo: TipoVenda[v.tipo],
      valor: v.valor,
      data: new Date(v.data),
      comissao: v.comissao ?? null,
    };
    await prisma.venda.upsert({
      where: { id: v.id },
      update: venda,
      create: { id: v.id, ...venda },
    });
    console.log(`  ✓ ${v.tipo} R$ ${v.valor.toLocaleString("pt-BR")}`);
  }
}

// ─── Orquestração ────────────────────────────────────────────────────────────

async function seedSuperAdmin() {
  console.log("→ Super-admin (base)...");
  const email = process.env.SUPER_ADMIN_EMAIL || "super@omnimob.app";
  const nome = process.env.SUPER_ADMIN_NOME || "Super Admin";
  const senhaPlain = process.env.SUPER_ADMIN_PASSWORD || "superadmin";

  const existing = await prisma.superAdmin.findUnique({ where: { email } });
  if (existing) {
    // Não sobrescreve a senha de um super-admin já existente.
    await prisma.superAdmin.update({ where: { email }, data: { nome, ativo: true } });
    console.log(`  ✓ Super-admin já existe: ${email}`);
  } else {
    await prisma.superAdmin.create({ data: { email, nome, senha: await hashPassword(senhaPlain), ativo: true } });
    console.log(`  ✓ Super-admin criado: ${email}`);
  }
  if (!process.env.SUPER_ADMIN_PASSWORD) {
    console.log("  ⚠ Sem SUPER_ADMIN_PASSWORD definido — senha padrão 'superadmin'. Defina em produção.");
  }
}

async function main() {
  console.log(`\n🌱 Seed Omnimob — modo: ${SEED_DEV ? "DEV (base + exemplos)" : "BASE (apenas cargos/tipos/atributos)"}\n`);

  // Dados base — sempre. Cargos e tipos de imóvel saíram daqui: sem imobiliária
  // não há a quem pertencerem, e criá-los soltos era o que os tornava globais.
  await seedSuperAdmin();

  if (!SEED_DEV) {
    /* Cargos e tipos deixaram de ser dados "base": pertencem a uma imobiliária
       e nascem junto com ela, no provisionamento. Sem --dev não há imobiliária
       nenhuma para povoar. */
    console.log("\n✅ Super-admin pronto. Cargos e tipos nascem com cada imobiliária (rode com --dev para criar as de exemplo).");
    return;
  }

  // Dados de desenvolvimento — somente com --dev
  const tenants = await seedTenants();
  const cargos = await seedCargos(tenants);
  const { tiposMap, atributosMap } = await seedTipos(tenants);
  await seedUsuarios(tenants, cargos);
  await seedClientes(tenants);
  await seedImoveis(tenants, tiposMap, atributosMap);
  await seedVendas(tenants);

  console.log("\n✅ Seed (dev) concluído com sucesso!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("\n❌ Seed falhou:", error.message);
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
