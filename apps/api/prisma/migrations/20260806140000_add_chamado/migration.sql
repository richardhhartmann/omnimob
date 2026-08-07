-- CreateEnum
CREATE TYPE "ChamadoPrioridade" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');

-- CreateTable
CREATE TABLE "tb_chamado" (
    "cha_numero" SERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "usu_id" TEXT,
    "cha_usu_nome" TEXT NOT NULL DEFAULT '',
    "cha_titulo" TEXT NOT NULL,
    "cha_descricao" TEXT NOT NULL,
    "cha_categoria" TEXT NOT NULL DEFAULT 'duvida',
    "cha_prioridade" "ChamadoPrioridade" NOT NULL DEFAULT 'MEDIA',
    "cha_resolvido" BOOLEAN NOT NULL DEFAULT false,
    "cha_resolvido_em" TIMESTAMP(3),
    "cha_prints" TEXT[],
    "cha_rota" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_chamado_pkey" PRIMARY KEY ("cha_numero")
);

-- CreateIndex
CREATE INDEX "tb_chamado_tenant_id_created_at_idx" ON "tb_chamado"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "tb_chamado_cha_resolvido_cha_prioridade_idx" ON "tb_chamado"("cha_resolvido", "cha_prioridade");

-- AddForeignKey
ALTER TABLE "tb_chamado" ADD CONSTRAINT "tb_chamado_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_chamado" ADD CONSTRAINT "tb_chamado_usu_id_fkey" FOREIGN KEY ("usu_id") REFERENCES "tb_usuario"("usu_id") ON DELETE SET NULL ON UPDATE CASCADE;
