import { prisma } from "../db.js";

/**
 * ─── Tenant Registry (camada de resolução de tenant) ─────────────────────────
 *
 * ESTADO ATUAL: todos os tenants vivem no MESMO banco PostgreSQL, isolados pela
 * coluna `tenant_id` em cada tabela.
 *
 * POR QUE ESTE ARQUIVO EXISTE: a documentação de arquitetura prevê evoluir para
 * schema-por-tenant ou banco-por-tenant. Para que essa migração NÃO exija
 * reescrever rotas e serviços, toda a aplicação deve pedir a conexão de dados
 * de um tenant a esta camada — nunca importar `db.js` diretamente para operações
 * de tenant. Assim, no futuro, basta trocar a implementação de
 * `getTenantClient()` para devolver um PrismaClient apontando para o schema/
 * banco correto, sem tocar em nenhuma rota.
 *
 * "Banco global" (metadados: tenants, planos, auth, licenças) hoje é o mesmo
 * banco; `getGlobalPrisma()` marca conceitualmente esse acesso.
 */

/** Cliente do banco global (metadados compartilhados da plataforma). */
export function getGlobalPrisma() {
  return prisma;
}

/**
 * Resolve um tenant a partir do slug consultando o registro global.
 * Devolve o registro do tenant ou null.
 */
export async function resolveTenantBySlug(slug) {
  if (!slug) return null;
  return prisma.tenant.findUnique({ where: { slug } });
}

/** Resolve um tenant pelo id. */
export async function resolveTenantById(id) {
  if (!id) return null;
  return prisma.tenant.findUnique({ where: { id } });
}

/**
 * Devolve o PrismaClient que atende aos DADOS de um tenant.
 *
 * SEAM DE MIGRAÇÃO: hoje devolve o cliente compartilhado (mesmo banco). Quando
 * migrarmos para schema/banco-por-tenant, esta função passará a devolver um
 * cliente dedicado — resolvendo servidor/porta/engine a partir do registro
 * global — e o restante da aplicação continua igual.
 */
export function getTenantClient(_tenant) {
  return prisma;
}

/**
 * Descreve onde um tenant está fisicamente hospedado. Hoje é sempre o banco
 * único; a estrutura já reflete o que o registro global armazenará no futuro
 * (servidor, banco, porta, engine, versão, status).
 */
export function describeTenantLocation(tenant) {
  return {
    tenantId: tenant?.id ?? null,
    slug: tenant?.slug ?? null,
    isolation: "shared-db", // futuro: "schema-per-tenant" | "database-per-tenant"
    server: process.env.DATABASE_HOST || "supabase",
    engine: "postgresql",
    status: tenant?.ativo ? "active" : "inactive",
    plano: tenant?.plano ?? null,
  };
}
