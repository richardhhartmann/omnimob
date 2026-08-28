import "dotenv/config";
import { avisarVencimentos } from "../src/services/avisoVencimento.js";

/**
 * Avisos de vencimento pela linha de comando — feito para um cron do servidor.
 *
 *   node scripts/avisos-vencimento.js             → ensaio: mostra quem receberia
 *   node scripts/avisos-vencimento.js --aplicar   → envia de verdade
 *
 * Ensaio é o padrão: e-mail enviado não volta.
 *
 * Este é o caminho recomendado. O agendador de dentro da API
 * (AVISO_VENCIMENTO_AUTOMATICO) só serve quando há uma instância só — com duas,
 * as duas mandam. Rode de hora em hora ou uma vez por dia: a marca no banco
 * impede o reenvio, então rodar demais não custa nada e rodar de menos custa um
 * aviso perdido.
 */
const aplicar = process.argv.includes("--aplicar");

const r = await avisarVencimentos({ aplicar });

console.log(
  aplicar
    ? "AVISOS DE VENCIMENTO — ENVIADOS"
    : "AVISOS DE VENCIMENTO (ensaio — nada foi enviado)",
);
console.log(`Contas em dia avaliadas: ${r.avaliados}`);

if (r.enviados.length) {
  console.log(`\nAvisar (${r.enviados.length}):`);
  r.enviados.forEach((e) =>
    console.log(
      `  ${String(e.tenant).slice(0, 28).padEnd(30)} ${String(e.email).padEnd(34)} ` +
        `D-${e.dias} (degrau ${e.degrau}) ${e.renovaSozinho ? "cartão" : "PIX — precisa agir"}`,
    ),
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
