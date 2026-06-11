import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Mostra todos os cargos com gerenciarCargos = false
const cargos = await prisma.cargo.findMany({
  where: { gerenciarCargos: false },
  include: { _count: { select: { usuarios: true } } }
});

console.log("Cargos sem acesso a Cargos:", cargos.map(c => ({
  id: c.id, descricao: c.descricao, usuarios: c._count.usuarios,
  gerenciarUsuarios: c.gerenciarUsuarios
})));

// Re-habilita gerenciarCargos em todos os cargos que têm gerenciarUsuarios
const result = await prisma.cargo.updateMany({
  where: { gerenciarUsuarios: true },
  data: { gerenciarCargos: true }
});
console.log(`\nAtualizado: ${result.count} cargo(s) com gerenciarUsuarios=true agora têm gerenciarCargos=true`);

await prisma.$disconnect();
