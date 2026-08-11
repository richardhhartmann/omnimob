import { prisma } from "../db.js";
import { getSchemaVersion } from "./migrationService.js";

/**
 * ─── Health Service ──────────────────────────────────────────────────────────
 * Verifica disponibilidade e integridade básica da plataforma. Base do "Health
 * Service" previsto na arquitetura (disponibilidade, tempo de resposta,
 * monitoramento). Espaço em disco e integridade profunda ficam como evolução.
 */

const bootedAt = Date.now();

/* Qual commit está de fato rodando.

   Existe porque "o meu código já subiu?" era uma pergunta sem resposta de fora,
   e a confusão custou caro: uma correção ficou horas parecendo quebrada porque
   o Render republicava o MESMO commit a cada mudança de variável de ambiente —
   os logs mostravam deploy, o código continuava velho, e o erro no log era
   idêntico ao de antes.

   O Render injeta RENDER_GIT_COMMIT sozinho; as outras variáveis cobrem Vercel
   e execução local. Sete caracteres bastam para comparar com `git log`. */
const COMMIT = (
  process.env.RENDER_GIT_COMMIT ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GIT_COMMIT ||
  ""
).slice(0, 7) || null;

/** Testa a conexão com o banco medindo latência. */
export async function checkDatabase() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - started };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - started, error: err.message };
  }
}

/**
 * Onde exatamente o tempo do banco é gasto.
 *
 * Uma consulta trivial estava levando ~900 ms em produção, e daqui de fora não
 * dava para saber a causa: o mesmo número aparece se o servidor está longe do
 * banco (cada ida custa um Atlântico) ou se o pgbouncer em modo transação
 * obriga a refazer preparo a cada consulta. São diagnósticos opostos — um pede
 * mudar de região, o outro pede mudar a string de conexão — e chutar errado
 * custa uma migração inteira.
 *
 * A separação vem de medir as três camadas isoladamente:
 *
 *   dns    — resolver o hostname do banco
 *   tcp    — abrir o socket até ele (é ISTO que revela distância: o número é
 *            praticamente o RTT da rede, sem nada do Postgres por cima)
 *   query  — `SELECT 1` repetido, já com a conexão de pé
 *
 * Se `tcp` for alto, é distância. Se `tcp` for baixo e `query` alto, o custo
 * está no protocolo/pooler e trocar de região não resolveria nada.
 */
export async function diagnosticarBanco({ amostras = 5 } = {}) {
  const dns = await import("node:dns/promises");
  const net = await import("node:net");

  const bruta = process.env.DATABASE_URL || "";
  const alvo = bruta.match(/@([^/:]+):?(\d+)?/);
  const host = alvo?.[1] || null;
  const porta = Number(alvo?.[2] || 5432);
  if (!host) return { erro: "DATABASE_URL ausente ou ilegível." };

  const medir = async (fn) => {
    const t0 = Date.now();
    try {
      await fn();
      return Date.now() - t0;
    } catch (e) {
      return { erro: e.message, ms: Date.now() - t0 };
    }
  };

  const dnsMs = await medir(() => dns.lookup(host));

  const tcpMs = await medir(
    () =>
      new Promise((ok, falha) => {
        const s = net.connect({ host, port: porta });
        s.setTimeout(8000, () => { s.destroy(); falha(new Error("timeout")); });
        s.on("connect", () => { s.end(); ok(); });
        s.on("error", falha);
      }),
  );

  // A primeira costuma pagar o aquecimento da conexão; as seguintes mostram o
  // custo real de repetição, que é o que o usuário sente navegando.
  const consultas = [];
  for (let i = 0; i < amostras; i++) {
    consultas.push(await medir(() => prisma.$queryRaw`SELECT 1`));
  }
  const numeros = consultas.filter((n) => typeof n === "number");
  const ordenado = [...numeros].sort((a, b) => a - b);

  return {
    host,
    porta,
    dnsMs,
    tcpMs,
    consultas,
    resumo: numeros.length
      ? {
          primeira: consultas[0],
          menor: ordenado[0],
          mediana: ordenado[Math.floor(ordenado.length / 2)],
          maior: ordenado[ordenado.length - 1],
        }
      : null,
    leitura:
      typeof tcpMs === "number" && typeof ordenado[0] === "number"
        ? tcpMs > 80
          ? `TCP de ${tcpMs}ms indica DISTÂNCIA entre a API e o banco — trocar de região resolve.`
          : ordenado[0] > 150
            ? `TCP baixo (${tcpMs}ms) mas consulta lenta (${ordenado[0]}ms): o custo está no protocolo/pooler, não na distância.`
            : `Tudo dentro do esperado (tcp ${tcpMs}ms, consulta ${ordenado[0]}ms).`
        : null,
  };
}

/** Snapshot de saúde consolidado. */
export async function getHealth() {
  const database = await checkDatabase();
  let schema = null;
  try {
    schema = await getSchemaVersion();
  } catch {
    schema = null;
  }

  const status = database.ok ? "ok" : "degraded";

  return {
    status,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - bootedAt) / 1000),
    commit: COMMIT,
    database,
    schema,
  };
}
