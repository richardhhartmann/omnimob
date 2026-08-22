import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PERMISSOES_FLOW_LISTA } from "../src/services/cargosPadrao.js";

/* ────────────────────────────────────────────────────────────────────────────
   LIGAR (ou desligar) o Omnimob Flow numa imobiliária.

   ── POR QUE ISTO EXISTE ──

   Contratar um módulo é ato COMERCIAL: em produção quem liga é a assinatura
   (o pacote escolhido vira `Tenant.modulos`, ver `fidelizarTrial`) ou o
   super-admin. Mas em desenvolvimento não há Stripe configurado, e sem uma
   porta o módulo fica inalcançável — a conta nasce com `modulos = [HUB]`, o
   cargo nasce sem `acessarFlow`, e o seletor da barra lateral nem aparece
   porque não há um segundo módulo para onde ir.

   Este script é essa porta. Ele faz as DUAS coisas que precisam ser verdade:

     1. a imobiliária passa a ter o módulo  (`Tenant.modulos`)
     2. um cargo passa a alcançá-lo         (`Cargo.acessarFlow` e as demais)

   Uma sem a outra não adianta, e é o engano mais comum: ligar só o tenant deixa
   a conta com o Flow contratado e ninguém capaz de abrir.

   ── ENSAIO POR PADRÃO ──

   Como `faxina`, `relatorio` e `subdominios`: sem `--aplicar` ele só diz o que
   faria. Mexer em permissão sem ver antes o que vai mudar é como se concede
   acesso por engano.

   ── USO ──

     npm run modulos                              lista o que cada conta tem
     npm run modulos -- --slug=minha --flow       ensaio
     npm run modulos -- --slug=minha --flow --aplicar
     npm run modulos -- --slug=minha --flow --cargo="Administrador" --aplicar
     npm run modulos -- --slug=minha --sem-flow --aplicar    tira o módulo

   `--cargo` escolhe QUEM alcança. Sem ele, vale para o Administrador — que é o
   único cargo que existe com certeza em toda conta.

   ── AS DUAS VALIDAÇÕES NÃO VÊM JUNTAS ──

   `validarJuridico` e `validarFinanceiro` ficam de fora mesmo com `--flow`, e é
   a mesma regra do catálogo de cargos: elas travam o fechamento do negócio, e
   uma trava que o script já entrega destravada não é trava. Use `--validacoes`
   se você quer explicitamente que aquele cargo também valide — o que faz
   sentido para testar o fluxo inteiro sozinho.
   ──────────────────────────────────────────────────────────────────────────── */

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const flag = (nome) => args.includes(`--${nome}`);
const valor = (nome) => {
  const achado = args.find((a) => a.startsWith(`--${nome}=`));
  return achado ? achado.slice(nome.length + 3) : null;
};

const slug = valor("slug");
const nomeCargo = valor("cargo") || "Administrador";
const aplicar = flag("aplicar");
const ligar = flag("flow");
const desligar = flag("sem-flow");
const comValidacoes = flag("validacoes");

/* As permissões que `--flow` concede. As duas travas ficam fora por padrão —
   ver o cabeçalho. */
const SEM_VALIDACAO = PERMISSOES_FLOW_LISTA.filter(
  (p) => p !== "validarJuridico" && p !== "validarFinanceiro",
);

async function listar() {
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      slug: true, name: true, modulos: true, plano: true,
      cargos: { select: { descricao: true, acessarFlow: true } },
    },
  });

  console.log(`\n${tenants.length} imobiliária(s):\n`);
  for (const t of tenants) {
    const mods = (t.modulos?.length ? t.modulos : ["HUB"]).join(" + ");
    const comFlow = t.cargos.filter((c) => c.acessarFlow).map((c) => c.descricao);
    console.log(`  ${t.slug.padEnd(24)} ${String(t.plano || "BASICO").padEnd(13)} ${mods}`);
    if (comFlow.length) console.log(`  ${" ".repeat(24)} cargos com Flow: ${comFlow.join(", ")}`);
  }
  console.log("\nPara ligar o Flow numa conta:");
  console.log('  npm run modulos -- --slug=SEU-SLUG --flow --aplicar\n');
}

async function main() {
  if (!slug) return listar();
  if (!ligar && !desligar) {
    console.error("Diga o que fazer: --flow para ligar, --sem-flow para desligar.");
    process.exitCode = 1;
    return;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, modulos: true },
  });
  if (!tenant) {
    console.error(`Imobiliária "${slug}" não encontrada.`);
    process.exitCode = 1;
    return;
  }

  const atuais = tenant.modulos?.length ? tenant.modulos : ["HUB"];
  const novos = ligar
    ? [...new Set([...atuais, "FLOW"])]
    : atuais.filter((m) => m !== "FLOW");

  const cargo = await prisma.cargo.findFirst({
    where: { tenantId: tenant.id, descricao: nomeCargo },
    select: { id: true, descricao: true, acessarFlow: true },
  });
  if (!cargo) {
    const existentes = await prisma.cargo.findMany({
      where: { tenantId: tenant.id }, select: { descricao: true },
    });
    console.error(`Cargo "${nomeCargo}" não existe nesta imobiliária.`);
    console.error(`Cargos: ${existentes.map((c) => c.descricao).join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const chaves = ligar
    ? (comValidacoes ? PERMISSOES_FLOW_LISTA : SEM_VALIDACAO)
    : PERMISSOES_FLOW_LISTA;
  const permissoes = Object.fromEntries(chaves.map((k) => [k, ligar]));

  console.log(`\n${tenant.name} (${tenant.slug})`);
  console.log(`  módulos:  ${atuais.join(" + ")}  →  ${novos.join(" + ")}`);
  console.log(`  cargo:    ${cargo.descricao}`);
  console.log(`  permite:  ${chaves.join(", ")} = ${ligar}`);
  if (ligar && !comValidacoes) {
    console.log("  (validarJuridico e validarFinanceiro ficam de fora — use --validacoes)");
  }

  if (!aplicar) {
    console.log("\nEnsaio. Nada foi gravado. Rode de novo com --aplicar.\n");
    return;
  }

  await prisma.tenant.update({ where: { id: tenant.id }, data: { modulos: novos } });
  await prisma.cargo.update({ where: { id: cargo.id }, data: permissoes });

  console.log("\nPronto.");
  /* O aviso importa: a sessão do painel guarda os módulos e as permissões, e
     `/auth/me` só as relê na montagem e a cada foco da janela. Sem sair e
     entrar (ou trocar de aba e voltar), a barra continua exatamente como
     estava — e a conclusão natural é que o script não funcionou. */
  console.log("Saia e entre no painel (ou troque de aba e volte) para a sessão reler os módulos.\n");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
