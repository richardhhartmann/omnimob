import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const users = await prisma.user.findMany({
  include: { cargo: true, tenant: { select: { slug: true } } }
});

console.log(users.map(u => ({
  login: u.login,
  tenant: u.tenant?.slug,
  cargo: u.cargo?.descricao,
  gerenciarCargos: u.cargo?.gerenciarCargos,
  gerenciarUsuarios: u.cargo?.gerenciarUsuarios,
})));

await prisma.$disconnect();
