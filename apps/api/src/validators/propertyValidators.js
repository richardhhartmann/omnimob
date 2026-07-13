import prismaPkg from "@prisma/client";
import { z } from "zod";

const { PropertyStatus, AndamentoImovel } = prismaPkg;

// Limite do campo price (Decimal(12,2) no banco): máx. 9.999.999.999,99.
const PRICE_MAX = 9_999_999_999.99;

export const createPropertySchema = z.object({
  tipoImovelId: z.number().int().positive().optional(),
  atributosIds: z.array(z.number().int().positive()).optional().default([]),
  title: z.string().min(3),
  description: z.string().min(10),
  price: z.number().positive().max(PRICE_MAX, { message: "Preço acima do máximo permitido (R$ 9.999.999.999,99)." }),
  cep: z.string().optional(),
  address: z.string().min(5),
  neighborhood: z.string().min(2),
  city: z.string().min(2),
  state: z.string().min(2),
  bedrooms: z.number().int().min(0),
  parkingSpots: z.number().int().min(0),
  suites: z.number().int().min(0),
  squareFootage: z.number().positive(),
  finalidade: z.enum(["RESIDENCIAL", "COMERCIAL"]).nullable().optional(),
  areaTerreno: z.number().nonnegative().nullable().optional(),
  areaConstruida: z.number().nonnegative().nullable().optional(),
  areaPrivativa: z.number().nonnegative().nullable().optional(),
  areaTotal: z.number().nonnegative().nullable().optional(),
  andamento: z.nativeEnum(AndamentoImovel).nullable().optional(),
  aceitaPermuta: z.boolean().optional().default(false),
  comodidades: z.record(z.boolean()).nullable().optional(),
  status: z.nativeEnum(PropertyStatus).optional().default(PropertyStatus.DRAFT),
});

export const updatePropertySchema = createPropertySchema.partial();

export const createTenantSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
});

export const updateTenantProfileSchema = z.object({
  whatsapp: z.string().optional(),
  email: z.string().email().or(z.literal("")).optional(),
  description: z.string().optional(),
  slogan: z.string().optional(),
  logoUrl: z.string().url().or(z.literal("")).optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  showcaseHeadline: z.string().optional(),
  showcaseSubheadline: z.string().optional(),
  showcaseConfig: z.any().optional(),
});

export const updateTenantConfiguracaoSchema = z.object({
  name: z.string().min(2).optional(),
  cnpj: z.string().optional(),
  creci: z.string().optional(),
  whatsapp: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().email().or(z.literal("")).optional(),
  cep: z.string().optional(),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  logoUrl: z.string().url().or(z.literal("")).optional(),
  slogan: z.string().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
});
