import prismaPkg from "@prisma/client";
import { extensaoDeAuditoria } from "./services/auditoria.js";

const { PrismaClient } = prismaPkg;

/* O cliente exportado já vem com a trilha de auditoria plantada.
 *
 * Aqui, e não em cada rota: é o único ponto por onde toda escrita do sistema
 * passa. Ver `services/auditoria.js` para o que é registrado e por quê. */
export const prisma = extensaoDeAuditoria(new PrismaClient());

/* ────────────────────────────────────────────────────────────────────────────
   O banco da PLATAFORMA: quem opera a Omnimob.

   `SuperAdmin` e `CargoSuperAdmin` são as duas tabelas que não pertencem a
   imobiliária nenhuma — pertencem à Omnimob. E as pessoas da Omnimob são as
   MESMAS em dev e em produção: manter uma cópia delas em cada banco fazia um
   convite mandado do localhost criar a conta no lugar errado, e toda senha
   trocada valer num ambiente só.

   Por isso elas têm um cliente próprio. Com `PLATAFORMA_DATABASE_URL` definida,
   ele aponta para OUTRO banco (em dev: o de produção, ou um projeto só da
   plataforma); sem ela, é o mesmo `prisma` de sempre — produção não precisa
   saber que a variável existe. As duas tabelas não têm chave estrangeira para
   nada fora delas, o que é o que permite movê-las sem quebrar `include` nenhum.

   O cliente leva a MESMA extensão de auditoria: a trilha do que se faz com um
   super-admin (`tenantId` nulo) vai junto para o banco da plataforma, pela
   mesma razão — é uma trilha só, de pessoas que são as mesmas.

   A regra de uso é simples: `superAdmin` e `cargoSuperAdmin` SÓ pelo
   `plataforma`; todo o resto, pelo `prisma`. Misturar os dois numa
   `$transaction` não funciona — são conexões diferentes.
   ──────────────────────────────────────────────────────────────────────────── */
const urlDaPlataforma = (process.env.PLATAFORMA_DATABASE_URL || "").trim();

/* Debaixo do `node --test`, NUNCA. A suíte cria super-admins descartáveis e
   chega a desativar todos os outros por alguns segundos; contra o banco
   compartilhado — o de produção — isso derrubaria o acesso da equipe no meio
   de um `npm test`. O `test/helpers.js` já iguala a variável à `DATABASE_URL`,
   mas isso depende de ele ser o primeiro import de cada arquivo, e um teste
   que importe `db.js` antes dele furaria a trava sem ninguém perceber. O
   runner do Node marca os processos filhos com `NODE_TEST_CONTEXT`; é uma
   segunda tranca, e a que não depende de ordem. */
const sobTeste = Boolean(process.env.NODE_TEST_CONTEXT);

/** `true` quando o super-admin vive em outro banco que não o desta instância. */
export const plataformaExterna =
  !sobTeste && Boolean(urlDaPlataforma) && urlDaPlataforma !== (process.env.DATABASE_URL || "").trim();

export const plataforma = plataformaExterna
  ? extensaoDeAuditoria(new PrismaClient({ datasourceUrl: urlDaPlataforma }))
  : prisma;
