import { z } from "zod";

export const loginSchema = z.object({
  login: z.string().min(3),
  // Senha pode vir vazia: usuários recém-criados ainda não têm senha e definem
  // uma no primeiro acesso (fluxo de forçar alteração).
  senha: z.string().max(200).optional().default(""),
});
