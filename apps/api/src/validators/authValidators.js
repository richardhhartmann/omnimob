import { z } from "zod";

export const loginSchema = z.object({
  login: z.string().min(3),
  senha: z.string().min(3),
});
