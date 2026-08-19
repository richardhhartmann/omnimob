-- AlterTable
ALTER TABLE "tb_cargo" ADD COLUMN     "ver_auditoria" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: quem já é Administrador (a permissão que abre Configurações) passa
-- a enxergar a trilha. Sem isto, ninguém veria a tela nova até editar o cargo à
-- mão — e a primeira impressão do recurso seria a de que ele não funciona.
UPDATE "tb_cargo" SET "ver_auditoria" = true WHERE "ver_configuracoes" = true;
