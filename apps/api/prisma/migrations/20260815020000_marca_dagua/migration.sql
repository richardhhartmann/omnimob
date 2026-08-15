-- AlterTable
ALTER TABLE "tb_tenants" ADD COLUMN     "tnt_marca_dagua_ativa" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tnt_marca_dagua_opacidade" INTEGER NOT NULL DEFAULT 55;
