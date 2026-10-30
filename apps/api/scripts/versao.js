/* ────────────────────────────────────────────────────────────────────────────
   A versão pela linha de comando (ver `src/services/versao.js`).

     node scripts/versao.js                     → a versão do HEAD (ex.: 1.4.3)
     node scripts/versao.js --semana 2026-11-03 → a MAIOR.SEMANA da apresentação
                                                  daquela terça (ex.: 1.1)
     node scripts/versao.js --gravar            → grava versoes.json para o
                                                  servidor, que não tem git

   O `--gravar` roda no `npm run build` e NUNCA derruba o deploy: sem histórico,
   avisa e sai com 0, e o painel mostra só o commit.
   ──────────────────────────────────────────────────────────────────────────── */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { ARQUIVO_DO_HISTORICO, daApresentacao, historicoDoGit } from "../src/services/versao.js";

const [, , opcao, valor] = process.argv;

if (opcao === "--semana") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor || "")) {
    console.error("Uso: node scripts/versao.js --semana AAAA-MM-DD");
    process.exit(1);
  }
  console.log(daApresentacao(valor));
} else if (opcao === "--gravar") {
  let h = historicoDoGit();
  if (!h) {
    /* Clone raso (o provedor de build costuma baixar só os últimos commits):
       tenta trazer o resto. Se não der, segue sem histórico. */
    try {
      execFileSync("git", ["fetch", "--unshallow", "--quiet"], { stdio: "ignore", timeout: 60000 });
    } catch { /* sem rede ou sem permissão: fica sem */ }
    h = historicoDoGit();
  }
  if (!h) {
    console.warn("[versao] sem histórico do git neste build; o painel mostrará só o commit.");
  } else {
    writeFileSync(ARQUIVO_DO_HISTORICO, JSON.stringify(h));
    console.log(`[versao] ${h.versoes[0]?.versao || h.antes.versao} — ${h.versoes.length} versões gravadas em versoes.json`);
  }
} else {
  const h = historicoDoGit();
  if (!h) {
    console.error("sem git ou clone raso");
    process.exit(1);
  }
  console.log(h.versoes[0]?.versao || h.antes.versao);
}
