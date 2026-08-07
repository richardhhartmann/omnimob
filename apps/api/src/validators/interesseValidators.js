import { z } from "zod";

// Chaves de plano aceitas. Espelham PLANOS em apps/web/src/utils/planos.js —
// o campo é opcional porque o formulário também abre sem plano escolhido.
export const PLANOS_VALIDOS = ["BASICO", "PROFISSIONAL", "PREMIUM"];

export const interesseSchema = z.object({
  imobiliaria: z.string().trim().min(2, "Informe o nome da imobiliária.").max(120),
  email: z.string().trim().email("E-mail inválido.").max(160),
  // Guardamos como veio (o formulário manda formatado), mas exigimos dígitos
  // suficientes para ser um telefone brasileiro com DDD.
  telefone: z
    .string()
    .trim()
    .min(8)
    .max(30)
    .refine((v) => v.replace(/\D/g, "").length >= 10, "Telefone incompleto."),
  plano: z.enum(PLANOS_VALIDOS).optional(),
  temWhatsapp: z.boolean().optional().default(false),
  /* Campo-armadilha: fica escondido no formulário, então robô preenche e gente
     não. Aceita qualquer texto de propósito — barrar aqui devolveria um 400
     apontando o campo "website", que é justamente ensinar o robô a deixá-lo
     vazio. Quem descarta é a rota, respondendo como se tivesse dado certo. */
  website: z.string().max(200).optional(),
});

/* O que a imobiliária quer trazer de onde ela está hoje.

   Tudo opcional de propósito: o formulário deixa pular a etapa inteira, e um
   campo obrigatório aqui custaria testes de gente que só não sabe responder
   ainda. Os limites de tamanho existem porque isto viaja dentro do JWT do
   convite — texto solto sem teto viraria um link de e-mail quilométrico. */
const migracaoSchema = z.object({
  sistemaAtual: z.string().trim().max(120).optional().default(""),
  itens: z.array(z.enum(["imoveis", "clientes", "leads", "usuarios"])).max(8).optional().default([]),
  volume: z.string().trim().max(40).optional().default(""),
  formato: z.enum(["planilha", "exportacao", "api", "nao_sei"]).optional(),
  observacao: z.string().trim().max(500).optional().default(""),
});

// Teste grátis: só o essencial para criar o tenant e mandar o acesso. Telefone
// é opcional aqui — pedir menos aumenta quem chega até o fim.
export const trialSchema = z.object({
  imobiliaria: z.string().trim().min(2, "Informe o nome da imobiliária.").max(120),
  email: z.string().trim().email("E-mail inválido.").max(160),
  telefone: z.string().trim().max(30).optional().default(""),
  website: z.string().max(200).optional(),
  /* "nova" = está abrindo a imobiliária agora; "existente" = já opera e quer
     migrar. Só isso muda o roteiro do time do outro lado. O default cobre
     chamadas antigas, que não mandavam o campo. */
  perfil: z.enum(["nova", "existente"]).optional().default("nova"),
  // Com qual plano a pessoa se identificou nos cartões. Não muda o teste, que
  // libera tudo — é intenção de compra, não contrato.
  planoDesejado: z.enum(PLANOS_VALIDOS).optional(),
  migracao: migracaoSchema.optional(),
});
