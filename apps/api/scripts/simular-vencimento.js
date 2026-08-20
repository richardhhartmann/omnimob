import "dotenv/config";
import { prisma } from "../src/db.js";
import { situacaoDeGraca, diasDeGraca } from "../src/services/trialService.js";

/**
 * ─── Relógio de mentira, para testar o vencimento sem esperar um mês ─────────
 *
 *   node scripts/simular-vencimento.js --slug=x                 → mostra o estado
 *   node scripts/simular-vencimento.js --slug=x --venceu        → venceu ontem
 *   node scripts/simular-vencimento.js --slug=x --na-remocao    → prazo de graça esgotado
 *   node scripts/simular-vencimento.js --slug=x --restaurar     → conta boa de novo
 *
 * POR QUE ISTO EXISTE: o fluxo tem duas etapas separadas por 30 (ou 90) dias —
 * a faxina que corta o acesso nunca é a que remove, de propósito. Sem uma forma
 * de adiantar o relógio, conferir a segunda etapa custaria um mês de espera, e
 * ninguém confere o que custa um mês. O que se testa aqui é a FAXINA de
 * verdade; a mentira é só a data.
 *
 * `--na-remocao` mexe em `suspensoEm`, e não em `proximoVencimento`: é de lá
 * que o prazo conta desde que o aviso e a contagem passaram a começar juntos.
 * Mexer na data errada devolveria um "não removeu" que parece bug e não é.
 *
 * Recusa rodar com NODE_ENV=production. Não é paranoia: as duas primeiras
 * opções DESLIGAM a conta, e um slug digitado errado num terminal apontado para
 * produção tira uma imobiliária do ar.
 */

if (process.env.NODE_ENV === "production") {
  console.error("Recusado: este script mexe em datas de cobrança e não roda em produção.");
  process.exit(1);
}

const arg = (nome) => process.argv.find((a) => a.startsWith(`--${nome}=`))?.split("=")[1];
const tem = (nome) => process.argv.includes(`--${nome}`);

const slug = arg("slug");
if (!slug) {
  console.error("Falta --slug=<slug-da-imobiliaria>.");
  process.exit(1);
}

const dias = (n) => new Date(Date.now() - n * 86400000);

const tenant = await prisma.tenant.findUnique({
  where: { slug },
  select: {
    id: true, slug: true, name: true, email: true, ativo: true,
    statusPagamento: true, proximoVencimento: true, suspensoEm: true,
  },
});

if (!tenant) {
  console.error(`Não achei a imobiliária "${slug}".`);
  process.exit(1);
}

let dados = null;

if (tem("venceu")) {
  /* Volta ao ponto de partida do fluxo: vencida, mas ainda de pé. É o estado em
     que a faxina AINDA NÃO passou — o acesso funciona, e é a próxima passada
     que corta. Limpar `suspensoEm` importa: sobrando de um teste anterior, a
     conta entraria na fila de remoção sem nunca ter sido avisada de novo. */
  dados = { proximoVencimento: dias(1), ativo: true, suspensoEm: null };
} else if (tem("na-remocao")) {
  /* Conta já cortada e com o prazo de graça esgotado. Exige `ativo: false`
     porque a faxina só remove quem já está desativado; pôr a data sem desativar
     produziria um estado que a faxina ignora, e o teste diria "não removeu". */
  const prazo = diasDeGraca(tenant.statusPagamento);
  dados = { ativo: false, suspensoEm: dias(prazo + 1), proximoVencimento: dias(prazo + 2) };
} else if (tem("restaurar")) {
  dados = {
    ativo: true,
    suspensoEm: null,
    proximoVencimento: new Date(Date.now() + 7 * 86400000),
  };
}

if (dados) {
  await prisma.tenant.update({ where: { id: tenant.id }, data: dados });
}

const depois = await prisma.tenant.findUnique({
  where: { id: tenant.id },
  select: {
    slug: true, name: true, email: true, ativo: true,
    statusPagamento: true, proximoVencimento: true, suspensoEm: true,
  },
});

const g = situacaoDeGraca(depois);
const data = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "—");

console.log(`\n${depois.name}  (${depois.slug})`);
console.log(`  status        : ${depois.statusPagamento}`);
console.log(`  acesso        : ${depois.ativo ? "LIBERADO" : "CORTADO"}`);
console.log(`  vence em      : ${data(depois.proximoVencimento)}`);
console.log(`  cortado em    : ${data(depois.suspensoEm)}`);
console.log(`  remove em     : ${data(g?.removidoEm)}  (${g?.diasAteRemocao ?? "—"} dia(s))`);

/* O e-mail é o passo mais fácil de esquecer e o mais silencioso ao falhar: a
   faxina pula quem não tem endereço, sem erro nenhum. Quem testa fica olhando
   para uma caixa de entrada vazia procurando bug no envio. */
if (!depois.email) {
  console.log("\n  ⚠  Sem e-mail cadastrado — a faxina desativa mas NÃO avisa ninguém.");
}
if (!process.env.RESEND_API_KEY) {
  console.log("  ⚠  Sem RESEND_API_KEY — o e-mail só vai para o console da API.");
}

console.log(dados ? "\nEstado ajustado. Agora rode: npm run faxina\n" : "");
process.exit(0);
