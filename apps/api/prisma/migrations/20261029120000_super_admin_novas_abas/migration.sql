-- Abas novas no painel da Omnimob (Auditoria, Avaliações, Novidades, Controle
-- de Uso, Interessados, Comunicados, E-mails e Contas e acesso), a ação de
-- publicar as Novidades, que vai a todos os clientes, e a de encerrar sessão.
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
    ADD COLUMN "publicarNovidades" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "verUso" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "verInteressados" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "verComunicados" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "verEmails" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "verAcessos" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "encerrarSessoes" BOOLEAN NOT NULL DEFAULT false;

UPDATE "tb_cargo_super_admin"
   SET "verAuditoria" = true, "verAvaliacoes" = true, "verNovidades" = true, "publicarNovidades" = true,
       "verUso" = true, "verInteressados" = true, "verComunicados" = true, "verEmails" = true,
       "verAcessos" = true, "encerrarSessoes" = true
 WHERE "nome" = 'Administrador';
