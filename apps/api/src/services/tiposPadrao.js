/* ────────────────────────────────────────────────────────────────────────────
   O catálogo de tipos de imóvel com que uma imobiliária nasce.

   Saiu do seed pelo mesmo motivo que os cargos saíram: tem dois consumidores —
   o seed e o provisionamento de tenant novo — e enquanto a lista morava só no
   seed, o provisionamento não criava tipo nenhum. Isso passava despercebido
   porque a tabela era global: o cliente novo enxergava o catálogo dos outros.
   Com `TipoImovel` tendo dono, um tenant sem tipos próprios não conseguiria
   cadastrar o primeiro imóvel.

   Depois de criada, cada imobiliária edita, renomeia e apaga o que quiser sem
   tocar em ninguém.
   ──────────────────────────────────────────────────────────────────────────── */

export const TIPOS_IMOVEL = [
  {
    descricao: "Casa",
    areaFields: ["areaTerreno", "areaConstruida"],
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
    areaFields: ["areaPrivativa", "areaTotal"],
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
    areaFields: ["areaPrivativa", "areaTotal"],
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
    areaFields: ["areaPrivativa"],
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
    areaFields: ["areaPrivativa"],
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
    areaFields: ["areaPrivativa"],
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
    areaFields: ["areaTerreno", "areaConstruida"],
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
    areaFields: ["areaPrivativa"],
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
    areaFields: ["areaTerreno", "areaConstruida"],
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
    areaFields: ["areaTerreno", "areaConstruida"],
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
    areaFields: ["areaTerreno", "areaConstruida"],
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
    areaFields: ["areaTerreno", "areaConstruida"],
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
    areaFields: ["areaTerreno"],
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
    areaFields: ["areaTerreno"],
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
    areaFields: ["areaTerreno", "areaConstruida"],
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
    areaFields: ["areaPrivativa", "areaTotal"],
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
    areaFields: ["areaConstruida", "areaTotal"],
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
    areaFields: ["areaPrivativa", "areaTotal"],
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
    areaFields: ["areaTerreno", "areaConstruida", "areaTotal"],
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

/**
 * Cria o catálogo inicial de tipos (com os atributos de cada um) para uma
 * imobiliária recém-criada.
 *
 * Idempotente por descrição: rodar duas vezes não duplica. É o que permite
 * chamá-la tanto do provisionamento quanto do seed sem um caminho separado.
 *
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {string} tenantId
 * @returns {Promise<number>} quantos tipos existem para o tenant ao final
 */
export async function criarTiposPadrao(prisma, tenantId) {
  for (const tipo of TIPOS_IMOVEL) {
    const existente = await prisma.tipoImovel.findFirst({
      where: { tenantId, descricao: tipo.descricao },
      select: { id: true },
    });
    if (existente) continue;

    await prisma.tipoImovel.create({
      data: {
        tenantId,
        descricao: tipo.descricao,
        areaFields: tipo.areaFields ?? [],
        atributos: {
          create: (tipo.atributos || []).map((a) => ({
            descricao: a.descricao,
            grupo: a.grupo || null,
          })),
        },
      },
    });
  }
  return prisma.tipoImovel.count({ where: { tenantId } });
}
