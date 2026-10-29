-- Três abas novas no painel da Omnimob (Auditoria, Avaliações, Novidades) e a
-- ação de publicar as Novidades, que vai a todos os clientes.
--
-- Padrão `false`, como as outras: cargo existente não ganha aba sem alguém
-- marcar. O Administrador é a exceção, como na migração que o criou — ele é
-- "tudo ligado", e uma aba nova que ele não visse seria uma aba que ninguém
-- consegue conceder a si mesmo.
--
-- ATENÇÃO: esta tabela vive no banco da PLATAFORMA. Quem roda o dev com
-- PLATAFORMA_DATABASE_URL apontando para a produção precisa desta migração
-- aplicada lá antes (ou esvaziar a variável localmente) — ver CLAUDE.md.
ALTER TABLE "tb_cargo_super_admin"
    ADD COLUMN "verAuditoria" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "verAvaliacoes" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "verNovidades" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "publicarNovidades" BOOLEAN NOT NULL DEFAULT false;

UPDATE "tb_cargo_super_admin"
   SET "verAuditoria" = true, "verAvaliacoes" = true, "verNovidades" = true, "publicarNovidades" = true
 WHERE "nome" = 'Administrador';
