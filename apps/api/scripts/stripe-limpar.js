import "dotenv/config";
import { cancelarAssinaturasDoSlug, pagamentoConfigurado } from "../src/services/pagamentoService.js";

/**
 * Cancela assinaturas de teste no Stripe.
 *
 *   npm run stripe:limpar -w apps/api -- --slug=teste-um                 → ensaio
 *   npm run stripe:limpar -w apps/api -- --slug=teste-um --aplicar       → cancela
 *   npm run stripe:limpar -w apps/api -- --slug=um --slug=dois --aplicar
 *
 * O ensaio é o padrão de propósito: cancelar é irreversível, e a mesma conta
 * costuma ter, ao lado das de teste, a assinatura que interessa de verdade.
 *
 * `--slug` PASSOU A SER OBRIGATÓRIO. Antes, sem ele, o script cancelava todas
 * as assinaturas ativas da conta — um comando de faxina a uma tecla de distância
 * de derrubar a receita inteira. Um alvo explícito é barato de digitar.
 *
 * SÓ RODA EM MODO TESTE. Com uma chave `sk_live_` o script se recusa: cancelar
 * assinatura de produção é cancelar a mensalidade de um cliente pagante, e isso
 * não pode acontecer por engano num terminal.
 *
 * O cancelamento em si mora em `pagamentoService.cancelarAssinaturasDoSlug` —
 * o mesmo código que a exclusão de tenant no painel administrativo executa.
 * Duas cópias divergiriam no dia em que uma delas ganhasse um caso novo.
 */

const SECRET = process.env.STRIPE_SECRET_KEY || "";
const aplicar = process.argv.includes("--aplicar");
const slugs = process.argv
  .filter((a) => a.startsWith("--slug="))
  .map((a) => a.slice("--slug=".length))
  .filter(Boolean);

async function principal() {
  if (!pagamentoConfigurado()) {
    console.error("STRIPE_SECRET_KEY não configurada.");
    process.exitCode = 1;
    return;
  }
  if (!SECRET.startsWith("sk_test_")) {
    console.error("Recusando: esta chave não é de teste. Rode só em modo teste.");
    process.exitCode = 1;
    return;
  }
  if (!slugs.length) {
    console.error("Informe ao menos um alvo: --slug=nome-do-tenant");
    process.exitCode = 1;
    return;
  }

  for (const slug of slugs) {
    // eslint-disable-next-line no-await-in-loop
    const r = await cancelarAssinaturasDoSlug(slug, { ensaio: !aplicar });

    if (!r.encontradas) {
      console.log(`${slug.padEnd(26)} nenhuma assinatura ativa`);
      continue;
    }
    if (!aplicar) {
      console.log(`${slug.padEnd(26)} ${r.encontradas} seriam canceladas`);
      continue;
    }
    console.log(`${slug.padEnd(26)} ${r.canceladas.length} canceladas${r.falhas.length ? `, ${r.falhas.length} falharam` : ""}`);
    r.falhas.forEach((f) => console.error(`  falhou: ${f.id || "?"} -> ${f.motivo}`));
  }

  if (!aplicar) console.log("\nEnsaio. Rode de novo com --aplicar para executar.");
}

await principal().catch((e) => {
  console.error("erro:", e.message);
  process.exitCode = 1;
});
