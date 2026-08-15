-- AlterTable
ALTER TABLE "tb_tenants" ADD COLUMN     "tnt_trial_estendido_em" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "tb_pesquisa_trial" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "psq_autor" TEXT NOT NULL DEFAULT '',
    "psq_sentimento" TEXT,
    "psq_escolha" TEXT NOT NULL,
    "psq_comentario" TEXT NOT NULL DEFAULT '',
    "psq_origem" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tb_pesquisa_trial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tb_pesquisa_trial_tenant_id_created_at_idx" ON "tb_pesquisa_trial"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "tb_pesquisa_trial" ADD CONSTRAINT "tb_pesquisa_trial_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
