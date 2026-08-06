import "dotenv/config";

/**
 * Cancela assinaturas de teste no Stripe.
 *
 *   npm run stripe:limpar -w apps/api                 → só lista (ensaio)
 *   npm run stripe:limpar -w apps/api -- --aplicar    → cancela TODAS as ativas
 *   npm run stripe:limpar -w apps/api -- --aplicar --slug=teste-um --slug=teste-dois
 *
 * O ensaio é o padrão de propósito: cancelar é irreversível, e a mesma conta
 * costuma ter, ao lado das de teste, a assinatura que interessa de verdade.
 * Com `--slug` a limpeza fica restrita aos ambientes citados — é assim que
 * recomendo usar, para não levar junto o que você quer manter.
 *
 * SÓ RODA EM MODO TESTE. Com uma chave `sk_live_` o script se recusa: cancelar
 * assinatura de produção é cancelar a mensalidade de um cliente pagante, e isso
 * não pode acontecer por engano num terminal.
 */

const SECRET = process.env.STRIPE_SECRET_KEY || "";
const aplicar = process.argv.includes("--aplicar");
const slugs = process.argv
  .filter((a) => a.startsWith("--slug="))
  .map((a) => a.slice("--slug=".length));

async function stripe(caminho, method = "GET") {
  const r = await fetch(`https://api.stripe.com/v1${caminho}`, {
    method,
    headers: { Authorization: `Bearer ${SECRET}` },
  });
  const corpo = await r.json();
  if (!r.ok) throw new Error(corpo?.error?.message || `Stripe respondeu ${r.status}`);
  return corpo;
}

async function principal() {
  if (!SECRET) {
    console.error("STRIPE_SECRET_KEY não configurada.");
    process.exitCode = 1;
    return;
  }
  if (!SECRET.startsWith("sk_test_")) {
    console.error("Recusando: esta chave não é de teste. Rode só em modo teste.");
    process.exitCode = 1;
    return;
  }

  const lista = await stripe("/subscriptions?limit=100&status=active");
  const alvos = slugs.length
    ? lista.data.filter((s) => slugs.includes(s.metadata?.slug))
    : lista.data;

  console.log(`Assinaturas ativas: ${lista.data.length}`);
  lista.data.forEach((s) => {
    const marcada = alvos.some((a) => a.id === s.id);
    const valor = ((s.items?.data?.[0]?.price?.unit_amount ?? 0) / 100).toFixed(2);
    console.log(
      `  ${marcada ? "x" : " "} ${s.id}  ${(s.metadata?.slug || "(sem slug)").padEnd(26)} R$ ${valor}`,
    );
  });

  if (!alvos.length) {
    console.log("\nNada a cancelar.");
    return;
  }

  if (!aplicar) {
    console.log(`\n${alvos.length} seriam canceladas. Rode de novo com --aplicar para executar.`);
    return;
  }

  console.log("");
  for (const s of alvos) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const r = await stripe(`/subscriptions/${s.id}`, "DELETE");
      console.log(`cancelada: ${s.id} (${s.metadata?.slug || "-"}) -> ${r.status}`);
    } catch (e) {
      console.error(`falhou:    ${s.id} -> ${e.message}`);
    }
  }
}

await principal().catch((e) => {
  console.error("erro:", e.message);
  process.exitCode = 1;
});
