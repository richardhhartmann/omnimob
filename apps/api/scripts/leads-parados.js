import "dotenv/config";
import { avisarLeadsParados } from "../src/services/leadsParados.js";

/**
 * Aviso de leads parados pela linha de comando — feito para um cron do servidor.
 *
 *   node scripts/leads-parados.js             → ensaio: mostra quem receberia
 *   node scripts/leads-parados.js --aplicar   → envia de verdade
 *
 * Ensaio é o padrão: e-mail enviado não volta. Rode de hora em hora: a marca no
 * lead (`avisoParadoEm`) impede o reenvio, então rodar demais não custa nada.
 * O agendador de dentro da API (LEADS_PARADOS_AUTOMATICO) só serve com uma
 * instância — com duas, as duas mandam.
 */
const aplicar = process.argv.includes("--aplicar");

const r = await avisarLeadsParados({ aplicar });

console.log(aplicar ? "LEADS PARADOS — AVISOS ENVIADOS" : "LEADS PARADOS (ensaio — nada foi enviado)");
console.log(`Leads parados encontrados: ${r.avaliados}`);

if (r.enviados.length) {
  console.log(`\nAvisar (${r.enviados.length} imobiliária(s)):`);
  r.enviados.forEach((e) =>
    console.log(`  ${String(e.tenant).slice(0, 28).padEnd(30)} ${e.leads} lead(s) → ${e.destinatarios.join(", ")}`),
  );
} else {
  console.log("\nNinguém a avisar agora.");
}

if (r.falhas.length) {
  console.log(`\nFalhas (${r.falhas.length}):`);
  r.falhas.forEach((f) => console.log(`  ${String(f.tenant).slice(0, 28).padEnd(30)} ${f.erro}`));
}

if (!aplicar) console.log("\nRode de novo com --aplicar para enviar.");

process.exit(0);
