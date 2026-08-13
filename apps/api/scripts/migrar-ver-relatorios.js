import "dotenv/config";
import prismaPkg from "@prisma/client";

/**
 * Backfill de `verRelatorios` a partir do antigo `gerenciarLeads`.
 *
 *   node scripts/migrar-ver-relatorios.js            → ensaio
 *   node scripts/migrar-ver-relatorios.js --aplicar  → aplica
 *
 * POR QUE ISTO PRECISA EXISTIR: "Gerenciar Leads" deixou de ser uma permissão e
 * "Ver Relatórios" passou a mandar na página inteira. Quem tinha só a primeira
 * — o cargo "Assistente Comercial" padrão é exatamente esse caso — perderia a
 * tela de leads no instante em que a troca subisse, sem ninguém ter mexido em
 * cargo nenhum. Silenciosamente, e no meio do expediente.
 *
 * Idempotente: liga `verRelatorios` onde `gerenciarLeads` estava ligado e não
 * desliga nada. Rodar duas vezes não muda o resultado.
 *
 * A coluna `gerenciarLeads` NÃO é apagada. Ela é o registro do que cada cargo
 * tinha antes — e é o que permite desfazer isto se a decisão mudar.
 */
const { PrismaClient } = prismaPkg;
const prisma = new PrismaClient();
const aplicar = process.argv.includes("--aplicar");

const alvos = await prisma.cargo.findMany({
  where: { gerenciarLeads: true, verRelatorios: false },
  select: { id: true, descricao: true, tenant: { select: { slug: true } } },
});

console.log(
  aplicar
    ? "BACKFILL verRelatorios — APLICANDO"
    : "BACKFILL verRelatorios (ensaio — nada foi alterado)",
);
console.log(`\nCargos que ganhariam "Ver Relatórios" (${alvos.length}):`);
alvos.forEach((c) =>
  console.log(`  ${String(c.tenant?.slug || "?").padEnd(28)} ${c.descricao}`),
);

if (aplicar && alvos.length) {
  const r = await prisma.cargo.updateMany({
    where: { gerenciarLeads: true, verRelatorios: false },
    data: { verRelatorios: true },
  });
  console.log(`\n${r.count} cargo(s) atualizado(s).`);
} else if (!aplicar) {
  console.log("\nRode de novo com --aplicar para gravar.");
}

await prisma.$disconnect();
process.exit(0);
