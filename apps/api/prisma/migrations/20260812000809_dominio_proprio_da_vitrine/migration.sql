-- AlterTable
ALTER TABLE "tb_tenants" ADD COLUMN     "tnt_dominio_alvo" JSONB,
ADD COLUMN     "tnt_dominio_proprio" TEXT,
ADD COLUMN     "tnt_dominio_status" TEXT NOT NULL DEFAULT 'OMNIMOB',
ADD COLUMN     "tnt_dominio_verificado_em" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "tb_tenants_tnt_dominio_proprio_key" ON "tb_tenants"("tnt_dominio_proprio");

