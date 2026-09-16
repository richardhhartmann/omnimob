#!/usr/bin/env node
/* ────────────────────────────────────────────────────────────────────────────
   Roda um comando com as variáveis de ambiente do COFRE (Infisical) quando ele
   está configurado nesta máquina — e, quando não está, roda o comando igual, e
   o `.env` de cada app continua valendo.

     node scripts/com-env.mjs -- <comando...>

   ── POR QUE UM INVÓLUCRO, E NÃO `infisical run` DIRETO NO package.json ──

   Porque nem todo mundo vai ter o cofre no primeiro dia, e o CI e o Render não
   têm nunca (eles injetam as variáveis do jeito deles). Escrito direto no
   script, `npm run dev` quebraria para quem ainda usa `.env` — e "instale o
   Infisical" não é uma mensagem de erro que o `vite` sabe dar. Aqui a decisão
   é uma só e mora num lugar: tem `.infisical.json` na raiz E o CLI está no
   PATH → o cofre injeta; senão → segue como sempre.

   ── O QUE DECIDE ──

   `.infisical.json` é o arquivo que o `infisical init` cria na raiz do repo
   (id do projeto e ambiente padrão). Ele entra no repositório: não é segredo,
   é endereço. O `--projectId` é lido dele e passado explicitamente porque o
   CLI procura o arquivo no diretório ATUAL, e os scripts dos apps rodam de
   `apps/api` e `apps/web`.

   `COFRE=0` desliga na hora (`COFRE=0 npm run dev`), para testar um `.env`
   local sem sair do cofre. `INFISICAL_ENV` troca o ambiente (`dev` é o
   padrão).

   ── UMA PASTA POR APP ──

   Um ambiente do Infisical é um saco só, e aqui são dois apps com `.env`
   próprios. Cada ambiente tem as pastas `/api` e `/web`, e a pasta é
   escolhida pelo diretório de onde o comando roda: `apps/api` → `/api`,
   `apps/web` → `/web`. É por isso que os scripts da RAIZ não são envolvidos:
   `npm run dev` lá chama o `dev` de cada app, e é o de cada app que sabe
   qual pasta é a dele. `INFISICAL_PATH` sobrescreve.
   ──────────────────────────────────────────────────────────────────────────── */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = path.join(RAIZ, ".infisical.json");

const argv = process.argv.slice(2);
const separador = argv.indexOf("--");
const comando = separador >= 0 ? argv.slice(separador + 1) : argv;
if (comando.length === 0) {
  console.error("uso: node scripts/com-env.mjs -- <comando...>");
  process.exit(2);
}

/* Aspas só onde precisa: o comando passa por um shell (é o único jeito de
   `npm`, `vite` e `concurrently` resolverem em Windows e Unix do mesmo modo),
   e um argumento com espaço voltaria a ser dois. */
const citar = (a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);

/* A pasta do cofre, pelo app de onde o comando roda. */
function pastaDoApp() {
  if (process.env.INFISICAL_PATH) return process.env.INFISICAL_PATH;
  const rel = path.relative(RAIZ, process.cwd()).split(path.sep);
  if (rel[0] === "apps" && rel[1]) return `/${rel[1]}`;
  return "/";
}

function cofreDisponivel() {
  if (process.env.COFRE === "0") return null;
  if (!existsSync(CONFIG)) return null;
  let cfg;
  try {
    cfg = JSON.parse(readFileSync(CONFIG, "utf8"));
  } catch {
    console.warn("[com-env] .infisical.json ilegível; seguindo com o .env local.");
    return null;
  }
  const versao = spawnSync("infisical", ["--version"], { shell: true, stdio: "ignore" });
  if (versao.status !== 0) {
    console.warn("[com-env] .infisical.json existe mas o CLI `infisical` não está no PATH; seguindo com o .env local.");
    return null;
  }
  return {
    projectId: cfg.workspaceId || cfg.projectId || "",
    ambiente: process.env.INFISICAL_ENV || cfg.defaultEnvironment || "dev",
    pasta: pastaDoApp(),
  };
}

const cofre = cofreDisponivel();
const linha = cofre
  ? [
      "infisical", "run",
      cofre.projectId ? `--projectId=${cofre.projectId}` : "",
      `--env=${cofre.ambiente}`,
      `--path=${cofre.pasta}`,
      "--", ...comando.map(citar),
    ].filter(Boolean).join(" ")
  : comando.map(citar).join(" ");

if (cofre) console.log(`[com-env] variáveis do cofre (Infisical, ambiente "${cofre.ambiente}", pasta ${cofre.pasta})`);

const r = spawnSync(linha, {
  shell: true,
  stdio: "inherit",
  cwd: process.cwd(),
  env: process.env,
});
process.exit(r.status ?? 1);
