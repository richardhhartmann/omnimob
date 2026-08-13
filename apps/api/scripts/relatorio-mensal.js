import "dotenv/config";
import { enviarRelatoriosDoMes } from "../src/services/relatorioScheduler.js";

/**
 * Relatório mensal pela linha de comando — feito para um cron do servidor.
 *
 *   node scripts/relatorio-mensal.js                       → ensaio do mês fechado
 *   node scripts/relatorio-mensal.js --aplicar             → manda de verdade
 *   node scripts/relatorio-mensal.js --mes=7 --ano=2026    → outro período
 *
 * Ensaio é o padrão: e-mail enviado não volta, e este vai para TODOS os clientes
 * do Profissional e do Premium de uma vez.
 *
 * Este script é o caminho recomendado. O agendador de dentro da API
 * (RELATORIO_MENSAL_AUTOMATICO) só serve quando há uma instância só — com duas,
 * as duas mandam.
 */
const aplicar = process.argv.includes("--aplicar");

const arg = (nome) => {
  const achado = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return achado ? Number(achado.split("=")[1]) : null;
};

const mes = arg("mes");
const ano = arg("ano");
const periodo = mes && ano ? { mes, ano } : undefined;

const r = await enviarRelatoriosDoMes({ aplicar, periodo });

console.log(
  aplicar
    ? `RELATÓRIO DE ${r.periodo.rotulo.toUpperCase()} — ENVIADO`
    : `RELATÓRIO DE ${r.periodo.rotulo.toUpperCase()} (ensaio — nada foi enviado)`,
);

console.log(`\nEnviar (${r.enviados.length}):`);
r.enviados.forEach((e) => console.log(`  ${String(e.tenant).slice(0, 30).padEnd(32)} ${e.email}`));

if (r.pulados.length) {
  console.log(`\nPulados (${r.pulados.length}):`);
  r.pulados.forEach((p) => console.log(`  ${String(p.tenant).slice(0, 30).padEnd(32)} ${p.motivo}`));
}

if (r.falhas.length) {
  console.log(`\nFalhas (${r.falhas.length}):`);
  r.falhas.forEach((f) => console.log(`  ${String(f.tenant).slice(0, 30).padEnd(32)} ${f.erro}`));
}

if (!aplicar) console.log("\nRode de novo com --aplicar para enviar.");

process.exit(0);
