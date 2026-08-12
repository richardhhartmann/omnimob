-- AlterTable
ALTER TABLE "tb_tenants" ADD COLUMN     "tnt_migracao_intencao" JSONB,
ADD COLUMN     "tnt_migracao_resolvida_em" TIMESTAMP(3);

