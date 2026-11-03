import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/* ────────────────────────────────────────────────────────────────────────────
   AS VITRINES NO FORMATO ANTIGO — quantas são, e a porta de saída da migração.

   O editor clássico (coordenadas) foi removido em 31/10/2026. A vitrine
   PÚBLICA continua sabendo desenhar o formato antigo, e é por isso que as
   imobiliárias que nunca abriram o editor novo seguem no ar como sempre: o
   documento do Puck (`showcaseConfig.puck`) só passa a valer quando a
   imobiliária PUBLICA pelo editor novo.

   Este script responde as duas perguntas que sobraram para o suporte:

     · quantas ainda estão no formato antigo (e quais), para saber quando ele
       pode sair também da vitrine pública;
     · devolver UMA imobiliária ao formato antigo — o que antes era "apagar a
       chave puck e abrir o editor clássico". O formato antigo nunca foi
       apagado pelo editor novo (ele grava ao lado), então a página de antes
       volta inteira. O rascunho em aberto vai junto; as versões publicadas
       ficam, para dar meia-volta pelo histórico.

   ── ENSAIO POR PADRÃO ──

     npm run vitrines-classicas                                  conta e lista
     npm run vitrines-classicas -- --slug=minha --voltar          ensaio
     npm run vitrines-classicas -- --slug=minha --voltar --aplicar
   ──────────────────────────────────────────────────────────────────────────── */

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const opcao = (nome) => args.find((a) => a.startsWith(`--${nome}=`))?.split("=").slice(1).join("=");
const tem = (nome) => args.includes(`--${nome}`);

const temPuck = (cfg) => Boolean(cfg && typeof cfg === "object" && cfg.puck && Array.isArray(cfg.puck.content));
const temAntigo = (cfg) => Boolean(cfg && typeof cfg === "object" && (cfg.layout || cfg.widgets || cfg.mobileLayout));

async function listar() {
  const tenants = await prisma.tenant.findMany({
    select: { slug: true, name: true, ativo: true, showcaseConfig: true },
    orderBy: { slug: "asc" },
  });
  const grupos = { novo: [], antigo: [], padrao: [] };
  for (const t of tenants) {
    if (temPuck(t.showcaseConfig)) grupos.novo.push(t);
    else if (temAntigo(t.showcaseConfig)) grupos.antigo.push(t);
    else grupos.padrao.push(t);
  }
  console.log(`Editor novo (Puck) ............ ${grupos.novo.length}`);
  console.log(`Formato antigo (coordenadas) .. ${grupos.antigo.length}`);
  console.log(`Nunca personalizou ............ ${grupos.padrao.length}`);
  if (grupos.antigo.length) {
    console.log("\nNo formato antigo:");
    for (const t of grupos.antigo) console.log(`  ${t.slug}${t.ativo === false ? " (desativada)" : ""} — ${t.name}`);
  }
}

async function voltar(slug, aplicar) {
  const t = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, slug: true, showcaseConfig: true } });
  if (!t) { console.error(`Imobiliária "${slug}" não encontrada.`); process.exitCode = 1; return; }
  if (!temPuck(t.showcaseConfig)) { console.log(`"${slug}" já está no formato antigo. Nada a fazer.`); return; }
  if (!temAntigo(t.showcaseConfig)) {
    console.log(`Atenção: "${slug}" não tem formato antigo gravado. Sem o documento do Puck, a vitrine cai no padrão de fábrica.`);
  }
  const { puck: _documento, ...semPuck } = t.showcaseConfig;
  console.log(`${aplicar ? "Aplicando" : "Ensaio"}: tirar o documento do Puck de "${slug}" e apagar o rascunho em aberto.`);
  if (!aplicar) { console.log("Nada foi gravado. Repita com --aplicar."); return; }
  await prisma.$transaction([
    prisma.tenant.update({ where: { id: t.id }, data: { showcaseConfig: semPuck } }),
    prisma.rascunhoVitrine.deleteMany({ where: { tenantId: t.id } }),
  ]);
  console.log(temAntigo(t.showcaseConfig)
    ? "Pronto. A vitrine pública voltou a desenhar o formato antigo."
    : "Pronto. Sem formato antigo gravado, a vitrine pública desenha o padrão de fábrica.");
}

try {
  const slug = opcao("slug");
  if (slug && tem("voltar")) await voltar(slug, tem("aplicar"));
  else await listar();
} finally {
  await prisma.$disconnect();
}
