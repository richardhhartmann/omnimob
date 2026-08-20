import prismaPkg from "@prisma/client";
import { z } from "zod";

const { PropertyStatus, AndamentoImovel, TipoContrato } = prismaPkg;

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
  salas: z.number().int().min(0).optional(),
  banheiros: z.number().int().min(0).optional(),
  squareFootage: z.number().positive(),
  finalidade: z.enum(["RESIDENCIAL", "COMERCIAL"]).nullable().optional(),
  areaTerreno: z.number().nonnegative().nullable().optional(),
  areaConstruida: z.number().nonnegative().nullable().optional(),
  areaPrivativa: z.number().nonnegative().nullable().optional(),
  areaTotal: z.number().nonnegative().nullable().optional(),
  andamento: z.nativeEnum(AndamentoImovel).nullable().optional(),
  // Natureza do negócio. Se o tenant liberou tipos, a rota ainda checa se o
  // valor escolhido está entre eles — o enum sozinho não sabe disso.
  tipoContrato: z.nativeEnum(TipoContrato).nullable().optional(),
  aceitaPermuta: z.boolean().optional().default(false),
  // Entra no XML dos portais. Padrão ligado — ver `services/feedPortais.js`.
  publicarPortais: z.boolean().optional().default(true),
  /* Rua e número na página pública. `false` por padrão aqui também, e não só no
     banco: um cadastro feito pela API sem o campo não deve publicar o endereço
     por omissão — a escolha tem de ser dita. */
  exibirEnderecoCompleto: z.boolean().optional().default(false),
  comodidades: z.record(z.boolean()).nullable().optional(),
  status: z.nativeEnum(PropertyStatus).optional().default(PropertyStatus.DRAFT),
});

export const updatePropertySchema = createPropertySchema.partial();

// Parametrização por imobiliária: quais tipos de contrato aparecem no cadastro.
export const updateTiposContratoSchema = z.object({
  tiposContrato: z.array(z.nativeEnum(TipoContrato)),
});

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
  autoGerarIA: z.boolean().optional(),
  marcaDaguaAtiva: z.boolean().optional(),
  /* Faixa fechada de propósito. Abaixo de 20% a marca some na foto e a pessoa
     acha que o recurso quebrou; acima de 80% ela deixa de ser marca d'água e
     vira um adesivo por cima do imóvel. O controle da tela já se move dentro
     desses limites — isto é a trava de quem chama a API direto. */
  marcaDaguaOpacidade: z.number().int().min(20).max(80).optional(),
  /* Horário de atendimento, como a vitrine mostra.

     `dias` é texto livre porque a realidade é: "Segunda a sexta", "Sábado",
     "Feriados", "Plantão de domingo". Uma lista fechada de sete dias não
     descreve nenhuma imobiliária de verdade — e obrigaria sete linhas para
     dizer o que uma linha diz.

     `fechado` existe para a faixa que anuncia AUSÊNCIA de atendimento; nela
     `abre`/`fecha` vêm vazios, e é por isso que os dois são opcionais aqui em
     vez de obrigatórios. Quem peneira a combinação inválida é o
     `dadosDaVitrine`, que é quem monta a resposta pública. */
  /* Ano de fundação da imobiliária. O teto é o ano corrente calculado na hora
     da validação, e não um número cravado: um literal envelheceria em silêncio
     e recusaria cadastros legítimos na virada do ano. */
  /* Tema do painel para toda a imobiliária. Lista fechada: um valor fora dela
     faria a tela cair no padrão sem ninguém saber por quê. */
  temaImobiliaria: z.enum(["claro", "escuro", "auto"]).optional(),
  fundadaEm: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear())
    .nullable()
    .optional(),
  horarioAtendimento: z
    .array(
      z.object({
        dias: z.string().trim().min(1).max(60),
        abre: z.string().trim().max(5).optional().default(""),
        fecha: z.string().trim().max(5).optional().default(""),
        fechado: z.boolean().optional().default(false),
      }),
    )
    .max(8)
    .optional(),
});
