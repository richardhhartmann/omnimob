-- CreateEnum
CREATE TYPE "TutorialStatus" AS ENUM ('EM_ANDAMENTO', 'FINALIZADO', 'PULADO');

-- CreateTable
CREATE TABLE "tb_usuario_tutorial" (
    "tut_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "usu_id" TEXT NOT NULL,
    "tut_etapa" TEXT NOT NULL,
    "tut_status" "TutorialStatus" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "tut_passo_parou" INTEGER,
    "tut_total_passos" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_usuario_tutorial_pkey" PRIMARY KEY ("tut_id")
);

-- CreateIndex
CREATE INDEX "tb_usuario_tutorial_tenant_id_usu_id_idx" ON "tb_usuario_tutorial"("tenant_id", "usu_id");

-- CreateIndex
CREATE UNIQUE INDEX "tb_usuario_tutorial_usu_id_tut_etapa_key" ON "tb_usuario_tutorial"("usu_id", "tut_etapa");

-- AddForeignKey
ALTER TABLE "tb_usuario_tutorial" ADD CONSTRAINT "tb_usuario_tutorial_usu_id_fkey" FOREIGN KEY ("usu_id") REFERENCES "tb_usuario"("usu_id") ON DELETE CASCADE ON UPDATE CASCADE;
