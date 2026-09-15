-- Usuários e cargos no super-admin.
--
-- Até aqui o painel da Omnimob tinha UM tipo de conta: quem entrava via e fazia
-- tudo. Esta migração repete no super-admin o desenho que o Hub já usa por
-- imobiliária — cargo com permissões por aba e por ação — e pendura no cargo
-- Administrador quem já existe, para ninguém acordar sem acesso no deploy.

-- 1. O cargo. Colunas booleanas com padrão `false`: cargo novo nasce sem
--    permissão nenhuma, e quem restringe menos precisa dizer isso, caixa por
--    caixa (mesma regra do `tb_cargo`).
CREATE TABLE "tb_cargo_super_admin" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "verTenants" BOOLEAN NOT NULL DEFAULT false,
    "verChamados" BOOLEAN NOT NULL DEFAULT false,
    "verTutoriais" BOOLEAN NOT NULL DEFAULT false,
    "verSeguranca" BOOLEAN NOT NULL DEFAULT false,
    "verUsuarios" BOOLEAN NOT NULL DEFAULT false,
    "verCargos" BOOLEAN NOT NULL DEFAULT false,
    "entrarNoTenant" BOOLEAN NOT NULL DEFAULT false,
    "editarTenant" BOOLEAN NOT NULL DEFAULT false,
    "excluirTenant" BOOLEAN NOT NULL DEFAULT false,
    "resolverChamado" BOOLEAN NOT NULL DEFAULT false,
    "gerenciarUsuarios" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tb_cargo_super_admin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tb_cargo_super_admin_nome_key" ON "tb_cargo_super_admin"("nome");

-- 2. O vínculo. Anulável de propósito: `NOT NULL` sem padrão numa tabela com
--    linhas trava o deploy, e nulo aqui significa "sem permissão nenhuma", que
--    é o desfecho inofensivo (ver o comentário no schema).
ALTER TABLE "tb_super_admin" ADD COLUMN "cargoId" INTEGER;

CREATE INDEX "tb_super_admin_cargoId_idx" ON "tb_super_admin"("cargoId");

-- `RESTRICT`: apagar um cargo com gente dentro deixaria essas pessoas sem
-- acesso em silêncio. A rota recusa antes; o banco é a segunda trava.
ALTER TABLE "tb_super_admin" ADD CONSTRAINT "tb_super_admin_cargoId_fkey"
    FOREIGN KEY ("cargoId") REFERENCES "tb_cargo_super_admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. O Administrador nasce com tudo ligado, e todo super-admin que já existe
--    passa a ser Administrador. É o que eles eram até aqui — quem entrava via
--    e fazia tudo —, então a migração não muda o acesso de ninguém; só dá nome
--    a ele. A lista de colunas é a mesma de `permissoesSuperAdmin.js`.
INSERT INTO "tb_cargo_super_admin" (
    "nome", "updatedAt",
    "verTenants", "verChamados", "verTutoriais", "verSeguranca", "verUsuarios", "verCargos",
    "entrarNoTenant", "editarTenant", "excluirTenant", "resolverChamado", "gerenciarUsuarios"
) VALUES (
    'Administrador', CURRENT_TIMESTAMP,
    true, true, true, true, true, true,
    true, true, true, true, true
);

UPDATE "tb_super_admin"
   SET "cargoId" = (SELECT "id" FROM "tb_cargo_super_admin" WHERE "nome" = 'Administrador')
 WHERE "cargoId" IS NULL;

-- 4. A trilha de auditoria aceita ator sem imobiliária. Criar um super-admin
--    ou mexer num cargo da plataforma entra na `tb_auditoria` como qualquer
--    outra escrita — mas não pertence a cliente nenhum, e por isso `tenant_id`
--    passa a poder ser nulo. A tela da imobiliária filtra por `tenant_id`, então
--    essas linhas nunca aparecem para ela.
ALTER TABLE "tb_auditoria" ALTER COLUMN "tenant_id" DROP NOT NULL;
