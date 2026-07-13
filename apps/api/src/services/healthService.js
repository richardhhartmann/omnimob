import { prisma } from "../db.js";
import { getSchemaVersion } from "./migrationService.js";

/**
 * ─── Health Service ──────────────────────────────────────────────────────────
 * Verifica disponibilidade e integridade básica da plataforma. Base do "Health
 * Service" previsto na arquitetura (disponibilidade, tempo de resposta,
 * monitoramento). Espaço em disco e integridade profunda ficam como evolução.
 */

const bootedAt = Date.now();

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
    database,
    schema,
  };
}
