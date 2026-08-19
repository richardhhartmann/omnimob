-- CreateEnum
CREATE TYPE "LeadEstagio" AS ENUM ('NOVO', 'EM_ATENDIMENTO', 'VISITA', 'PROPOSTA', 'GANHO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "LeadEventoTipo" AS ENUM ('CRIADO', 'ESTAGIO', 'RESPONSAVEL', 'NOTA', 'CONTATO');

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "prp_publicar_portais" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "PropertyLead" ADD COLUMN     "estagio" "LeadEstagio" NOT NULL DEFAULT 'NOVO',
ADD COLUMN     "primeiroContatoEm" TIMESTAMP(3),
ADD COLUMN     "responsavelId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "tb_lead_evento" (
    "lev_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "lea_id" TEXT NOT NULL,
    "usu_id" TEXT,
    "lev_usuario_nome" TEXT,
    "lev_tipo" "LeadEventoTipo" NOT NULL,
    "lev_de" TEXT,
    "lev_para" TEXT,
    "lev_texto" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tb_lead_evento_pkey" PRIMARY KEY ("lev_id")
);

-- CreateTable
CREATE TABLE "tb_auditoria" (
    "aud_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "usu_id" TEXT,
    "aud_usuario_nome" TEXT,
    "aud_acao" TEXT NOT NULL,
    "aud_entidade" TEXT NOT NULL,
    "aud_entidade_id" TEXT,
    "aud_resumo" TEXT,
    "aud_dados" JSONB,
    "aud_ip" TEXT,
    "aud_rota" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tb_auditoria_pkey" PRIMARY KEY ("aud_id")
);

-- CreateTable
CREATE TABLE "tb_perfil_busca" (
    "pfb_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "clt_id" TEXT NOT NULL,
    "pfb_titulo" TEXT NOT NULL,
    "pfb_finalidade" TEXT,
    "pfb_tipo_contrato" "TipoContrato",
    "tip_id" INTEGER,
    "pfb_preco_min" DECIMAL(12,2),
    "pfb_preco_max" DECIMAL(12,2),
    "pfb_quartos_min" INTEGER,
    "pfb_vagas_min" INTEGER,
    "pfb_area_min" DOUBLE PRECISION,
    "pfb_cidade" TEXT,
    "pfb_bairros" TEXT[],
    "pfb_ativo" BOOLEAN NOT NULL DEFAULT true,
    "pfb_ultimo_aviso_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_perfil_busca_pkey" PRIMARY KEY ("pfb_id")
);

-- CreateIndex
CREATE INDEX "tb_lead_evento_tenant_id_lea_id_created_at_idx" ON "tb_lead_evento"("tenant_id", "lea_id", "created_at");

-- CreateIndex
CREATE INDEX "tb_auditoria_tenant_id_created_at_idx" ON "tb_auditoria"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "tb_auditoria_tenant_id_aud_entidade_aud_entidade_id_idx" ON "tb_auditoria"("tenant_id", "aud_entidade", "aud_entidade_id");

-- CreateIndex
CREATE INDEX "tb_auditoria_tenant_id_usu_id_created_at_idx" ON "tb_auditoria"("tenant_id", "usu_id", "created_at");

-- CreateIndex
CREATE INDEX "tb_perfil_busca_tenant_id_pfb_ativo_idx" ON "tb_perfil_busca"("tenant_id", "pfb_ativo");

-- CreateIndex
CREATE INDEX "tb_perfil_busca_tenant_id_clt_id_idx" ON "tb_perfil_busca"("tenant_id", "clt_id");

-- CreateIndex
CREATE INDEX "PropertyLead_tenantId_estagio_idx" ON "PropertyLead"("tenantId", "estagio");

-- CreateIndex
CREATE INDEX "PropertyLead_tenantId_responsavelId_idx" ON "PropertyLead"("tenantId", "responsavelId");

-- AddForeignKey
ALTER TABLE "PropertyLead" ADD CONSTRAINT "PropertyLead_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "tb_usuario"("usu_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_lead_evento" ADD CONSTRAINT "tb_lead_evento_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_lead_evento" ADD CONSTRAINT "tb_lead_evento_lea_id_fkey" FOREIGN KEY ("lea_id") REFERENCES "PropertyLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_auditoria" ADD CONSTRAINT "tb_auditoria_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_perfil_busca" ADD CONSTRAINT "tb_perfil_busca_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_perfil_busca" ADD CONSTRAINT "tb_perfil_busca_clt_id_fkey" FOREIGN KEY ("clt_id") REFERENCES "tb_cliente"("clt_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_perfil_busca" ADD CONSTRAINT "tb_perfil_busca_tip_id_fkey" FOREIGN KEY ("tip_id") REFERENCES "tb_tipo_imovel"("tip_id") ON DELETE SET NULL ON UPDATE CASCADE;
