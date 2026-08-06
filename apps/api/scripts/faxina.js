import "dotenv/config";
import { limparTrials } from "../src/services/trialService.js";

/**
 * Faxina de trials pela linha de comando — feito para um cron do servidor.
 *
 *   node scripts/faxina.js            → ensaio: só mostra o que faria
 *   node scripts/faxina.js --aplicar  → executa de verdade
 *
 * O ensaio é o padrão de propósito: a remoção é irreversível e cascateia para
 * imóveis, fotos, leads e usuários.
 */
const aplicar = process.argv.includes("--aplicar");

const r = await limparTrials({ aplicar });

const linha = (t) =>
  `  ${t.slug.padEnd(28)} ${t.name?.slice(0, 26).padEnd(26) || ""} ${
    t.proximoVencimento ? new Date(t.proximoVencimento).toISOString().slice(0, 10) : "-"
  }`;

console.log(aplicar ? "FAXINA APLICADA" : "FAXINA (ensaio — nada foi alterado)");
console.log(`\nDesativar (${r.desativados.length}):`);
r.desativados.forEach((t) => console.log(linha(t)));
console.log(`\nRemover (${r.removidos.length}):`);
r.removidos.forEach((t) => console.log(linha(t)));

if (!aplicar && (r.desativados.length || r.removidos.length)) {
  console.log("\nRode de novo com --aplicar para executar.");
}

process.exit(0);
