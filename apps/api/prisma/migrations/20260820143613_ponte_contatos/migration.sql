-- AlterTable
ALTER TABLE "tb_tenants" ADD COLUMN     "wa_ponte_contatos" TEXT[] DEFAULT ARRAY[]::TEXT[];
