import { prisma } from "../db.js";

/**
 * ─── Migration Service ───────────────────────────────────────────────────────
 * A arquitetura pede versionamento de schema com uma tabela "SchemaVersion".
 * Com Prisma Migrate esse papel é cumprido pela tabela nativa
 * `_prisma_migrations`, que é a fonte oficial da versão do schema. Este serviço
 * expõe essa informação para a aplicação (health, painel admin) e centraliza a
 * lógica de versão para quando houver migração multi-banco.
 *
 * OBS.: enquanto todos os tenants compartilham o mesmo banco, existe UMA versão
 * de schema para toda a plataforma. Ao migrar para banco-por-tenant, este
 * serviço passará a consultar/aplicar versões por tenant.
 */

/**
 * Lê a última migração aplicada no banco. Retorna null se o Prisma Migrate
 * ainda não foi inicializado (projeto ainda em `db push`).
 */
export async function getSchemaVersion() {
  try {
    const rows = await prisma.$queryRaw`
      SELECT migration_name, finished_at
      FROM _prisma_migrations
      WHERE finished_at IS NOT NULL
      ORDER BY finished_at DESC
      LIMIT 1
    `;
    if (!rows || rows.length === 0) {
      return { initialized: true, version: null, appliedAt: null };
    }
    return {
      initialized: true,
      version: rows[0].migration_name,
      appliedAt: rows[0].finished_at,
    };
  } catch {
    // Tabela ainda não existe → migrations não adotadas neste banco.
    return { initialized: false, version: null, appliedAt: null };
  }
}

/** Conta quantas migrations já foram aplicadas. */
export async function countAppliedMigrations() {
  try {
    const rows = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS total FROM _prisma_migrations WHERE finished_at IS NOT NULL
    `;
    return rows?.[0]?.total ?? 0;
  } catch {
    return 0;
  }
}
