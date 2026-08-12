import "dotenv/config";
import prismaPkg from "@prisma/client";
import {
  garantirSubdominioDaCasa,
  conferirSubdominioDaCasa,
  dominioConfigurado,
} from "../src/services/dominioService.js";

/**
 * Reconcilia `<slug>.omnimob.app` na Vercel com os tenants que existem no banco.
 *
 *   npm run subdominios              → ensaio: CONFERE cada um e diz o que falta
 *   npm run subdominios -- --aplicar → cadastra os que estiverem faltando
 *
 * Novos tenants ganham o subdomínio sozinhos, no provisionamento. Este script
 * existe para dois casos: os que nasceram antes disso, e — o que motivou a
 * reescrita — os que falharam na criação sem ninguém perceber.
 *
 * O ENSAIO AGORA CONSULTA DE VERDADE. Antes ele só listava os slugs do banco,
 * o que respondia "o que eu tentaria cadastrar" e não "o que está quebrado".
 * Um tenant cujo registro falhou aparecia idêntico a um que estava no ar, e o
 * painel seguia anunciando um endereço que não abre.
 *
 * `--aplicar` continua não sendo o padrão: cada cadastro consome um slot de
 * domínio do projeto na Vercel, e slot tem teto de plano. Ver a lista antes de
 * gastar é mais barato que descobrir o limite no meio da execução.
 */
const { PrismaClient } = prismaPkg;
const prisma = new PrismaClient();

const aplicar = process.argv.includes("--aplicar");

if (!dominioConfigurado()) {
  console.error("VERCEL_TOKEN/VERCEL_PROJECT_ID não configurados — nada a fazer.");
  process.exit(1);
}

/* Quem tem domínio próprio ATIVO não usa o endereço da casa: a vitrine dele
   vive no domínio da imobiliária, e cadastrar o subdomínio gastaria um slot
   para um endereço que ninguém divulga. */
const tenants = await prisma.tenant.findMany({
  where: { ativo: true, NOT: { dominioStatus: "ATIVO" } },
  select: { slug: true, name: true },
  orderBy: { createdAt: "asc" },
});

console.log(`banco: ${(process.env.DATABASE_URL || "").replace(/\/\/[^@]*@/, "//<credenciais>@")}`);
console.log(`${tenants.length} tenant(s) usando o endereço da casa\n`);

const faltando = [];
const ok = [];
const pendentes = [];

for (const t of tenants) {
  // eslint-disable-next-line no-await-in-loop
  const r = await conferirSubdominioDaCasa(t.slug);
  if (!r.registrado) {
    faltando.push({ ...t, ...r });
    console.log(`  ✗ ${r.host.padEnd(36)} NÃO CADASTRADO`);
  } else if (!r.verificado) {
    /* Registrado mas não verificado: o DNS ainda não apontou, ou o certificado
       não saiu. O endereço não abre, e é o estado mais enganoso dos três —
       cadastrar de novo não resolve. */
    pendentes.push({ ...t, ...r });
    console.log(`  ! ${r.host.padEnd(36)} cadastrado, aguardando verificação`);
  } else {
    ok.push(t);
    console.log(`  · ${r.host.padEnd(36)} no ar`);
  }
}

console.log(`\n${ok.length} no ar · ${pendentes.length} aguardando · ${faltando.length} faltando`);

if (!faltando.length) {
  console.log("\nNada a cadastrar.");
  await prisma.$disconnect();
  process.exit(pendentes.length ? 2 : 0);
}

if (!aplicar) {
  console.log(`\nEnsaio. Para cadastrar os ${faltando.length} que faltam:`);
  console.log("  npm run subdominios -- --aplicar");
  await prisma.$disconnect();
  // Saída 1 com pendência: dá para usar num cron e ser avisado quando houver algo.
  process.exit(1);
}

console.log(`\nCadastrando ${faltando.length}…`);
let criados = 0;
let falhas = 0;

for (const t of faltando) {
  // eslint-disable-next-line no-await-in-loop
  const r = await garantirSubdominioDaCasa(t.slug);
  if (r.ok) {
    criados += 1;
    console.log(`  ✓ ${r.host.padEnd(36)} ${r.criado ? "cadastrado" : "já existia"}`);
  } else {
    falhas += 1;
    console.log(`  ✗ ${r.host.padEnd(36)} ${r.motivo}`);
  }
}

console.log(`\n${criados} cadastrado(s), ${falhas} falha(s)`);
if (pendentes.length) {
  console.log(
    `\n${pendentes.length} continua(m) aguardando verificação da Vercel — isso não se resolve ` +
      "por aqui, é propagação de DNS/certificado. Rode de novo em alguns minutos.",
  );
}
await prisma.$disconnect();
process.exit(falhas ? 1 : 0);
