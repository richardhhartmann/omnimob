import prismaPkg from "@prisma/client";
import { z } from "zod";

const { PropertyStatus } = prismaPkg;

export const createPropertySchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  price: z.number().positive(),
  cep: z.string().optional(),
  address: z.string().min(5),
  neighborhood: z.string().min(2),
  city: z.string().min(2),
  state: z.string().min(2),
  propertyType: z.string().min(2),
  bedrooms: z.number().int().min(0),
  parkingSpots: z.number().int().min(0),
  suites: z.number().int().min(0),
  squareFootage: z.number().positive(),
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
