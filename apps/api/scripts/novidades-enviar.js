/* ────────────────────────────────────────────────────────────────────────────
   Entrega o rascunho das Novidades da semana (ver docs/novidades/README.md).

     node scripts/novidades-enviar.js <pasta> --conferir   valida aqui, sem enviar
     node scripts/novidades-enviar.js <pasta>              envia como rascunho

   Lê <pasta>/conteudo.json. A chave é o campo `mes` (a terça, AAAA-MM-DD).
   Envia para OMNIMOB_API_URL (padrão: https://api.omnimob.app) com
   `Authorization: Bearer $NOVIDADES_TOKEN`. Na rotina da nuvem a chave vem do
   ambiente; não a ponha em arquivo nenhum.

   Sai com 0 também quando a semana já foi publicada (409): não há o que fazer.
   ──────────────────────────────────────────────────────────────────────────── */
import { readFileSync } from "node:fs";
import path from "node:path";
import { chaveValida, normalizarNovidade, contarItens } from "../src/services/novidades.js";

const [, , pasta, opcao] = process.argv;
if (!pasta) {
  console.error("Uso: node scripts/novidades-enviar.js <pasta> [--conferir]");
  process.exit(1);
}

const bruto = JSON.parse(readFileSync(path.resolve(pasta, "conteudo.json"), "utf8"));
const chave = String(bruto.mes || "");
if (!chaveValida(chave)) {
  console.error(`"mes" precisa ser a terça da semana em AAAA-MM-DD (veio "${chave}").`);
  process.exit(1);
}

let conteudo;
try {
  conteudo = normalizarNovidade(bruto, chave);
} catch (erro) {
  console.error(`Conteúdo recusado: ${erro.message}`);
  process.exit(1);
}

if (opcao === "--conferir") {
  console.log(`OK: ${chave}, ${contarItens(conteudo)} novidades em ${conteudo.secoes.length} áreas.`);
  process.exit(0);
}

const token = (process.env.NOVIDADES_TOKEN || "").trim();
if (!token) {
  console.error("Falta NOVIDADES_TOKEN no ambiente.");
  process.exit(1);
}
const base = (process.env.OMNIMOB_API_URL || "https://api.omnimob.app").replace(/\/+$/, "");
const r = await fetch(`${base}/api/novidades/rascunho/${chave}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify(conteudo),
});
const corpo = await r.json().catch(() => ({}));
if (r.status === 409) {
  console.log(`A semana ${chave} já foi publicada; nada a fazer.`);
  process.exit(0);
}
if (!r.ok) {
  console.error(`Recusado (${r.status}): ${corpo.error || r.statusText}`);
  process.exit(1);
}
console.log(`Rascunho entregue: ${chave} (versão ${corpo.versao}), ${contarItens(conteudo)} novidades. Falta a revisão no super-admin.`);
