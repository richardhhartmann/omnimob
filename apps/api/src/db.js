import prismaPkg from "@prisma/client";
import { extensaoDeAuditoria } from "./services/auditoria.js";

const { PrismaClient } = prismaPkg;

/* O cliente exportado já vem com a trilha de auditoria plantada.
 *
 * Aqui, e não em cada rota: é o único ponto por onde toda escrita do sistema
 * passa. Ver `services/auditoria.js` para o que é registrado e por quê. */
export const prisma = extensaoDeAuditoria(new PrismaClient());
