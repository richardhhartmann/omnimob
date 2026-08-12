import "dotenv/config";
import prismaPkg from "@prisma/client";
import { garantirSubdominioDaCasa, dominioConfigurado } from "../src/services/dominioService.js";

/**
 * Cadastra `<slug>.omnimob.app` na Vercel para os tenants que já existem.
 *
 *   node scripts/subdominios.js            → ensaio: só lista o que faria
 *   node scripts/subdominios.js --aplicar  → cadastra de verdade
 *
 * Novos tenants ganham o subdomínio sozinhos, no provisionamento. Este script
 * existe para os que nasceram antes disso — e para reparar, já que a função é
 * idempotente: quem já está lá é reportado como "já existia", sem erro.
 *
 * O ensaio é o padrão porque cada cadastro consome um slot de domínio do
 * projeto na Vercel, e slot tem limite de plano. Ver a lista antes de gastar é
 * mais barato que descobrir o teto no meio da execução.
 */
const { PrismaClient } = prismaPkg;
const prisma = new PrismaClient();

const aplicar = process.argv.includes("--aplicar");

if (!dominioConfigurado()) {
  console.error("VERCEL_TOKEN/VERCEL_PROJECT_ID não configurados — nada a fazer.");
  process.exit(1);
}

const tenants = await prisma.tenant.findMany({
  where: { ativo: true },
  select: { slug: true, name: true },
  orderBy: { createdAt: "asc" },
});

console.log(`banco: ${(process.env.DATABASE_URL || "").replace(/\/\/[^@]*@/, "//<credenciais>@")}`);
console.log(`${tenants.length} tenant(s) ativos\n`);

if (!aplicar) {
  for (const t of tenants) console.log(`  ${t.slug}.omnimob.app   (${t.name})`);
  console.log(`\nEnsaio. Para cadastrar de verdade: node scripts/subdominios.js --aplicar`);
  await prisma.$disconnect();
  process.exit(0);
}

let criados = 0;
let existentes = 0;
let falhas = 0;

for (const t of tenants) {
  // eslint-disable-next-line no-await-in-loop
  const r = await garantirSubdominioDaCasa(t.slug);
  if (!r.ok) {
    falhas += 1;
    console.log(`  ✗ ${t.slug.padEnd(24)} ${r.motivo}`);
  } else if (r.criado) {
    criados += 1;
    console.log(`  ✓ ${t.slug.padEnd(24)} cadastrado`);
  } else {
    existentes += 1;
    console.log(`  · ${t.slug.padEnd(24)} já existia`);
  }
}

console.log(`\n${criados} cadastrado(s), ${existentes} já existia(m), ${falhas} falha(s)`);
await prisma.$disconnect();
