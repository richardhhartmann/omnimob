import bcrypt from "bcryptjs";
import prismaPkg from "@prisma/client";

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
//  DADOS BASE — sempre carregados (globais, compartilhados por todos os tenants)
// ════════════════════════════════════════════════════════════════════════════

// Toda permissão existente em Cargo. Cada cargo abaixo lista só as que concede;
// as demais ficam false automaticamente.
const PERMISSOES = [
  "acessarPainel",
  "editarPagina",
  "gerenciarImoveis",
  "gerenciarLeads",
  "gerenciarUsuarios",
  "gerenciarClientes",
  "gerenciarCargos",
  "verRelatorios",
  "publicarRedes",
];

const CARGOS = [
  { descricao: "Administrador", permite: PERMISSOES },
  {
    descricao: "Gerente",
    permite: ["acessarPainel", "editarPagina", "gerenciarImoveis", "gerenciarLeads", "gerenciarUsuarios", "gerenciarClientes", "verRelatorios", "publicarRedes"],
  },
  {
    descricao: "Corretor",
    permite: ["acessarPainel", "gerenciarImoveis", "gerenciarLeads", "gerenciarClientes", "verRelatorios", "publicarRedes"],
  },
  {
    descricao: "Assistente Comercial",
    permite: ["acessarPainel", "gerenciarLeads", "gerenciarClientes"],
  },
  {
    descricao: "Marketing",
    permite: ["acessarPainel", "editarPagina", "verRelatorios", "publicarRedes"],
  },
  {
    descricao: "Editor de Vitrine",
    permite: ["editarPagina"],
  },
  {
    descricao: "Consulta (Somente Leitura)",
    permite: ["acessarPainel", "verRelatorios"],
  },
];

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
    descricao: "Kitnet",
    atributos: [
      { descricao: "Mobiliado", grupo: "Infraestrutura" },
      { descricao: "Ar-condicionado", grupo: "Infraestrutura" },
      { descricao: "Cozinha Americana", grupo: "Infraestrutura" },
      { descricao: "Lavanderia Coletiva", grupo: "Infraestrutura" },
      { descricao: "Portaria 24h", grupo: "Segurança" },
      { descricao: "Interfone", grupo: "Segurança" },
    ],
  },
  {
    descricao: "Loft",
    atributos: [
      { descricao: "Pé-direito Alto", grupo: "Infraestrutura" },
      { descricao: "Mezanino", grupo: "Infraestrutura" },
      { descricao: "Ar-condicionado", grupo: "Infraestrutura" },
      { descricao: "Mobiliado", grupo: "Infraestrutura" },
      { descricao: "Vaga de Garagem", grupo: "Infraestrutura" },
      { descricao: "Varanda", grupo: "Lazer" },
      { descricao: "Portaria 24h", grupo: "Segurança" },
    ],
  },
  {
    descricao: "Sobrado",
    atributos: [
      { descricao: "Quintal", grupo: "Lazer" },
      { descricao: "Churrasqueira", grupo: "Lazer" },
      { descricao: "Varanda", grupo: "Lazer" },
      { descricao: "Suíte Master", grupo: "Infraestrutura" },
      { descricao: "Closet", grupo: "Infraestrutura" },
      { descricao: "Área de Serviço", grupo: "Infraestrutura" },
      { descricao: "Garagem Coberta", grupo: "Infraestrutura" },
      { descricao: "Portão Eletrônico", grupo: "Segurança" },
    ],
  },
  {
    descricao: "Flat",
    atributos: [
      { descricao: "Mobiliado", grupo: "Infraestrutura" },
      { descricao: "Ar-condicionado", grupo: "Infraestrutura" },
      { descricao: "Estacionamento", grupo: "Infraestrutura" },
      { descricao: "Serviço de Quarto", grupo: "Comodidades" },
      { descricao: "Recepção 24h", grupo: "Comodidades" },
      { descricao: "Restaurante", grupo: "Comodidades" },
      { descricao: "Academia", grupo: "Lazer" },
      { descricao: "Piscina", grupo: "Lazer" },
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
  {
    descricao: "Casa de Praia",
    atributos: [
      { descricao: "Vista para o Mar", grupo: "Lazer" },
      { descricao: "Piscina", grupo: "Lazer" },
      { descricao: "Churrasqueira", grupo: "Lazer" },
      { descricao: "Varanda Gourmet", grupo: "Lazer" },
      { descricao: "Quintal", grupo: "Lazer" },
      { descricao: "Ducha Externa", grupo: "Comodidades" },
      { descricao: "Mobiliado", grupo: "Infraestrutura" },
      { descricao: "Garagem Coberta", grupo: "Infraestrutura" },
    ],
  },
  {
    descricao: "Chácara",
    atributos: [
      { descricao: "Piscina", grupo: "Lazer" },
      { descricao: "Churrasqueira", grupo: "Lazer" },
      { descricao: "Pomar", grupo: "Lazer" },
      { descricao: "Campo de Futebol", grupo: "Lazer" },
      { descricao: "Lago/Açude", grupo: "Lazer" },
      { descricao: "Área Verde", grupo: "Lazer" },
      { descricao: "Casa de Caseiro", grupo: "Infraestrutura" },
      { descricao: "Poço Artesiano", grupo: "Infraestrutura" },
      { descricao: "Energia Elétrica", grupo: "Infraestrutura" },
    ],
  },
  {
    descricao: "Sítio",
    atributos: [
      { descricao: "Nascente/Água", grupo: "Infraestrutura" },
      { descricao: "Casa Sede", grupo: "Infraestrutura" },
      { descricao: "Poço Artesiano", grupo: "Infraestrutura" },
      { descricao: "Energia Elétrica", grupo: "Infraestrutura" },
      { descricao: "Curral", grupo: "Infraestrutura" },
      { descricao: "Pasto", grupo: "Infraestrutura" },
      { descricao: "Pomar", grupo: "Lazer" },
      { descricao: "Plantação", grupo: "Infraestrutura" },
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
    descricao: "Lote em Condominio",
    atributos: [
      { descricao: "Plano", grupo: "Topografia" },
      { descricao: "Área Verde Próxima", grupo: "Localização" },
      { descricao: "Infraestrutura Completa", grupo: "Infraestrutura" },
      { descricao: "Portaria 24h", grupo: "Segurança" },
      { descricao: "Câmeras de Segurança", grupo: "Segurança" },
      { descricao: "Condomínio Fechado", grupo: "Segurança" },
      { descricao: "Documentação Regular", grupo: "Documentação" },
    ],
  },
  {
    descricao: "Galpão",
    atributos: [
      { descricao: "Pé-direito Alto", grupo: "Infraestrutura" },
      { descricao: "Doca de Carga", grupo: "Infraestrutura" },
      { descricao: "Elétrica Trifásica", grupo: "Infraestrutura" },
      { descricao: "Pátio de Manobra", grupo: "Infraestrutura" },
      { descricao: "Mezanino", grupo: "Infraestrutura" },
      { descricao: "Estacionamento", grupo: "Infraestrutura" },
      { descricao: "Escritório", grupo: "Comodidades" },
      { descricao: "Câmeras de Segurança", grupo: "Segurança" },
    ],
  },
  {
    descricao: "Loja",
    atributos: [
      { descricao: "Vitrine", grupo: "Infraestrutura" },
      { descricao: "Depósito", grupo: "Infraestrutura" },
      { descricao: "Mezanino", grupo: "Infraestrutura" },
      { descricao: "Estacionamento", grupo: "Infraestrutura" },
      { descricao: "Ar-condicionado", grupo: "Comodidades" },
      { descricao: "WC Privativo", grupo: "Comodidades" },
      { descricao: "Boa Localização/Fluxo", grupo: "Localização" },
      { descricao: "Câmeras de Segurança", grupo: "Segurança" },
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
    descricao: "Prédio Comercial",
    atributos: [
      { descricao: "Elevador", grupo: "Acessibilidade" },
      { descricao: "Estacionamento", grupo: "Infraestrutura" },
      { descricao: "Subsolo/Garagem", grupo: "Infraestrutura" },
      { descricao: "Gerador", grupo: "Infraestrutura" },
      { descricao: "Recepção", grupo: "Comodidades" },
      { descricao: "Ar-condicionado Central", grupo: "Comodidades" },
      { descricao: "Portaria 24h", grupo: "Segurança" },
      { descricao: "Câmeras de Segurança", grupo: "Segurança" },
    ],
  },
];

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

async function seedCargos() {
  console.log("→ Cargos (base)...");
  const map = {};
  for (const { descricao, permite } of CARGOS) {
    const data = Object.fromEntries(PERMISSOES.map((p) => [p, permite.includes(p)]));
    let cargo = await prisma.cargo.findFirst({ where: { descricao } });
    if (cargo) {
      cargo = await prisma.cargo.update({ where: { id: cargo.id }, data });
    } else {
      cargo = await prisma.cargo.create({ data: { descricao, ...data } });
    }
    map[descricao] = cargo;
    console.log(`  ✓ ${descricao}`);
  }
  return map;
}

async function seedTipos() {
  console.log("→ Tipos de imóvel e atributos (base)...");
  const tiposMap = {};
  const atributosMap = {}; // atributosMap[tipoDescricao][atributoDescricao] = record
  for (const tipo of TIPOS_IMOVEL) {
    let tipoRecord = await prisma.tipoImovel.findFirst({ where: { descricao: tipo.descricao } });
    if (!tipoRecord) {
      tipoRecord = await prisma.tipoImovel.create({ data: { descricao: tipo.descricao } });
    }
    tiposMap[tipo.descricao] = tipoRecord;
    atributosMap[tipo.descricao] = {};

    for (const atr of tipo.atributos) {
      let rec = await prisma.modeloAtributo.findFirst({
        where: { tipoId: tipoRecord.id, descricao: atr.descricao },
      });
      if (!rec) {
        rec = await prisma.modeloAtributo.create({
          data: { tipoId: tipoRecord.id, descricao: atr.descricao, grupo: atr.grupo },
        });
      }
      atributosMap[tipo.descricao][atr.descricao] = rec;
    }
    console.log(`  ✓ ${tipo.descricao} (${tipo.atributos.length} atributos)`);
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
    const cargoCodigo = cargos[u.cargo].id;
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
    const tipo = tiposMap[im.tipo];

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
      const atr = atributosMap[im.tipo]?.[atrDesc];
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

async function main() {
  console.log(`\n🌱 Seed Domus — modo: ${SEED_DEV ? "DEV (base + exemplos)" : "BASE (apenas cargos/tipos/atributos)"}\n`);

  // Dados base — sempre
  const cargos = await seedCargos();
  const { tiposMap, atributosMap } = await seedTipos();

  if (!SEED_DEV) {
    console.log("\n✅ Dados base carregados. Imóveis de exemplo ignorados (rode com --dev para popular).");
    return;
  }

  // Dados de desenvolvimento — somente com --dev
  const tenants = await seedTenants();
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
