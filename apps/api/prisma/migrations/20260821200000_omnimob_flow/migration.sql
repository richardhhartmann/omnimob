-- ===========================================================================
-- OMNIMOB FLOW - o segundo modulo do produto
-- ===========================================================================
--
-- Tudo que existia ate aqui passa a se chamar HUB (acervo, vitrine, leads,
-- equipe, relatorios). O FLOW e a operacao comercial: captacao por webhook,
-- funil de negocios, minuta contratual, assinatura digital e comissao.
--
-- -- ESTA MIGRACAO E ADITIVA, INTEIRA --
--
-- Nenhuma coluna sai, nenhum default muda, nenhuma linha existente e reescrita.
-- Uma imobiliaria que nunca contratar o Flow nao percebe que ela rodou: ela
-- nasce com tnt_modulos = {HUB}, e as sete permissoes novas do cargo nascem
-- todas em false.
--
-- As permissoes nascerem false INCLUSIVE PARA O ADMINISTRADOR e deliberado, e
-- vale principalmente para validar_juridico e validar_financeiro: elas sao as
-- duas travas que seguram o fechamento de um negocio, e uma trava que a
-- migracao ja entrega destravada nao e trava nenhuma. Quem quiser que o
-- administrador valide precisa dizer isso, cargo por cargo, na tela.
--
-- tnt_comissao_percentual (6%) e tnt_comissao_corretor_perc (50%) sao o padrao
-- do mercado brasileiro. Sao ponto de partida do calculo, nao regra: cada
-- negocio congela os seus no momento em que fecha.
-- ===========================================================================

-- CreateEnum
CREATE TYPE "ModuloOmnimob" AS ENUM ('HUB', 'FLOW');

-- CreateEnum
CREATE TYPE "NegocioEstagio" AS ENUM ('LEAD', 'CONTATO', 'VISITA', 'PROPOSTA', 'NEGOCIACAO', 'APROVACAO', 'GANHO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "NegocioEventoTipo" AS ENUM ('CRIADO', 'ESTAGIO', 'RESPONSAVEL', 'NOTA', 'DOCUMENTO', 'CONTRATO', 'VALIDACAO', 'COMISSAO');

-- CreateEnum
CREATE TYPE "CanalCaptacao" AS ENUM ('ZAP', 'VIVAREAL', 'OLX', 'MERCADOLIVRE', 'FACEBOOK', 'INSTAGRAM', 'WHATSAPP', 'SITE', 'INDICACAO', 'OUTRO');

-- CreateEnum
CREATE TYPE "ContratoStatus" AS ENUM ('RASCUNHO', 'ENVIADO', 'PARCIAL', 'ASSINADO', 'RECUSADO', 'CANCELADO', 'EXPIRADO');

-- CreateEnum
CREATE TYPE "SignatarioStatus" AS ENUM ('PENDENTE', 'ASSINADO', 'RECUSADO');

-- CreateEnum
CREATE TYPE "SignatarioPapel" AS ENUM ('COMPRADOR', 'VENDEDOR', 'IMOBILIARIA', 'TESTEMUNHA', 'FIADOR', 'PROCURADOR');

-- CreateEnum
CREATE TYPE "DocumentoTipo" AS ENUM ('RG', 'CPF', 'CNPJ', 'COMPROVANTE_RENDA', 'COMPROVANTE_RESIDENCIA', 'CERTIDAO_ESTADO_CIVIL', 'MATRICULA_IMOVEL', 'IPTU', 'CONTRATO_SOCIAL', 'PROCURACAO', 'OUTRO');

-- AlterTable
ALTER TABLE "tb_cargo" ADD COLUMN     "acessar_flow" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gerenciar_captacao" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gerenciar_contratos" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gerenciar_negocios" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "validar_financeiro" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "validar_juridico" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ver_comissoes" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tb_tenants" ADD COLUMN     "tnt_assinatura_conta" TEXT,
ADD COLUMN     "tnt_assinatura_provedor" TEXT,
ADD COLUMN     "tnt_assinatura_sandbox" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tnt_assinatura_token" TEXT,
ADD COLUMN     "tnt_comissao_corretor_perc" DECIMAL(5,2) NOT NULL DEFAULT 50,
ADD COLUMN     "tnt_comissao_percentual" DECIMAL(5,2) NOT NULL DEFAULT 6,
ADD COLUMN     "tnt_modulos" "ModuloOmnimob"[] DEFAULT ARRAY['HUB']::"ModuloOmnimob"[];

-- CreateTable
CREATE TABLE "tb_negocio" (
    "neg_id" TEXT NOT NULL,
    "neg_codigo" SERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "neg_titulo" TEXT NOT NULL,
    "neg_estagio" "NegocioEstagio" NOT NULL DEFAULT 'LEAD',
    "property_id" TEXT,
    "lea_id" TEXT,
    "neg_comprador_id" TEXT,
    "neg_vendedor_id" TEXT,
    "neg_responsavel_id" TEXT,
    "neg_canal" "CanalCaptacao" NOT NULL DEFAULT 'SITE',
    "neg_origem" TEXT NOT NULL DEFAULT '',
    "neg_valor_proposta" DECIMAL(12,2),
    "neg_valor_fechado" DECIMAL(12,2),
    "neg_juridico_ok" BOOLEAN NOT NULL DEFAULT false,
    "neg_juridico_por" TEXT,
    "neg_juridico_em" TIMESTAMP(3),
    "neg_juridico_nota" TEXT,
    "neg_financeiro_ok" BOOLEAN NOT NULL DEFAULT false,
    "neg_financeiro_por" TEXT,
    "neg_financeiro_em" TIMESTAMP(3),
    "neg_financeiro_nota" TEXT,
    "neg_comissao_percentual" DECIMAL(5,2),
    "neg_comissao_corretor_perc" DECIMAL(5,2),
    "neg_comissao_total" DECIMAL(12,2),
    "neg_comissao_imobiliaria" DECIMAL(12,2),
    "neg_comissao_corretor" DECIMAL(12,2),
    "neg_comissao_calculada_em" TIMESTAMP(3),
    "neg_perdido_motivo" TEXT,
    "neg_fechado_em" TIMESTAMP(3),
    "neg_ultimo_contato_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_negocio_pkey" PRIMARY KEY ("neg_id")
);

-- CreateTable
CREATE TABLE "tb_negocio_evento" (
    "nev_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "neg_id" TEXT NOT NULL,
    "usu_id" TEXT,
    "nev_usuario_nome" TEXT,
    "nev_tipo" "NegocioEventoTipo" NOT NULL,
    "nev_de" TEXT,
    "nev_para" TEXT,
    "nev_texto" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tb_negocio_evento_pkey" PRIMARY KEY ("nev_id")
);

-- CreateTable
CREATE TABLE "tb_negocio_documento" (
    "ndo_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "neg_id" TEXT NOT NULL,
    "ndo_tipo" "DocumentoTipo" NOT NULL DEFAULT 'OUTRO',
    "ndo_refere_a" TEXT NOT NULL DEFAULT 'comprador',
    "ndo_nome" TEXT NOT NULL,
    "ndo_url" TEXT NOT NULL,
    "ndo_mime" TEXT NOT NULL DEFAULT '',
    "ndo_tamanho" INTEGER,
    "ndo_verificado" BOOLEAN NOT NULL DEFAULT false,
    "ndo_verificado_em" TIMESTAMP(3),
    "ndo_observacao" TEXT,
    "ndo_enviado_por" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tb_negocio_documento_pkey" PRIMARY KEY ("ndo_id")
);

-- CreateTable
CREATE TABLE "tb_modelo_contrato" (
    "mct_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "mct_nome" TEXT NOT NULL,
    "mct_tipo" TEXT NOT NULL DEFAULT 'VENDA',
    "mct_corpo" TEXT NOT NULL,
    "mct_ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_modelo_contrato_pkey" PRIMARY KEY ("mct_id")
);

-- CreateTable
CREATE TABLE "tb_contrato" (
    "ctr_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "neg_id" TEXT NOT NULL,
    "mct_id" TEXT,
    "ctr_titulo" TEXT NOT NULL,
    "ctr_corpo" TEXT NOT NULL,
    "ctr_status" "ContratoStatus" NOT NULL DEFAULT 'RASCUNHO',
    "ctr_provedor" TEXT,
    "ctr_documento_externo" TEXT,
    "ctr_url_documento" TEXT,
    "ctr_url_assinado" TEXT,
    "ctr_enviado_em" TIMESTAMP(3),
    "ctr_assinado_em" TIMESTAMP(3),
    "ctr_cancelado_em" TIMESTAMP(3),
    "ctr_sincronizado_em" TIMESTAMP(3),
    "ctr_ultimo_erro" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_contrato_pkey" PRIMARY KEY ("ctr_id")
);

-- CreateTable
CREATE TABLE "tb_contrato_signatario" (
    "csg_id" TEXT NOT NULL,
    "ctr_id" TEXT NOT NULL,
    "csg_nome" TEXT NOT NULL,
    "csg_email" TEXT NOT NULL,
    "csg_documento" TEXT,
    "csg_papel" "SignatarioPapel" NOT NULL DEFAULT 'COMPRADOR',
    "csg_ordem" INTEGER NOT NULL DEFAULT 0,
    "csg_status" "SignatarioStatus" NOT NULL DEFAULT 'PENDENTE',
    "csg_assinado_em" TIMESTAMP(3),
    "csg_chave_externa" TEXT,
    "csg_url_assinatura" TEXT,

    CONSTRAINT "tb_contrato_signatario_pkey" PRIMARY KEY ("csg_id")
);

-- CreateTable
CREATE TABLE "tb_fonte_captacao" (
    "fca_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "fca_nome" TEXT NOT NULL,
    "fca_canal" "CanalCaptacao" NOT NULL,
    "fca_chave" TEXT NOT NULL,
    "fca_segredo" TEXT NOT NULL,
    "fca_ativa" BOOLEAN NOT NULL DEFAULT true,
    "fca_abrir_negocio" BOOLEAN NOT NULL DEFAULT true,
    "fca_ultimo_evento_em" TIMESTAMP(3),
    "fca_total_recebido" INTEGER NOT NULL DEFAULT 0,
    "fca_total_recusado" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_fonte_captacao_pkey" PRIMARY KEY ("fca_id")
);

-- CreateTable
CREATE TABLE "tb_captacao_evento" (
    "cev_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "fca_id" TEXT NOT NULL,
    "cev_payload" JSONB NOT NULL,
    "cev_status" TEXT NOT NULL DEFAULT 'ACEITO',
    "cev_erro" TEXT,
    "lea_id" TEXT,
    "neg_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tb_captacao_evento_pkey" PRIMARY KEY ("cev_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tb_negocio_neg_codigo_key" ON "tb_negocio"("neg_codigo");

-- CreateIndex
CREATE INDEX "tb_negocio_tenant_id_neg_estagio_idx" ON "tb_negocio"("tenant_id", "neg_estagio");

-- CreateIndex
CREATE INDEX "tb_negocio_tenant_id_neg_responsavel_id_idx" ON "tb_negocio"("tenant_id", "neg_responsavel_id");

-- CreateIndex
CREATE INDEX "tb_negocio_tenant_id_created_at_idx" ON "tb_negocio"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "tb_negocio_tenant_id_property_id_idx" ON "tb_negocio"("tenant_id", "property_id");

-- CreateIndex
CREATE INDEX "tb_negocio_evento_tenant_id_neg_id_created_at_idx" ON "tb_negocio_evento"("tenant_id", "neg_id", "created_at");

-- CreateIndex
CREATE INDEX "tb_negocio_documento_tenant_id_neg_id_idx" ON "tb_negocio_documento"("tenant_id", "neg_id");

-- CreateIndex
CREATE INDEX "tb_modelo_contrato_tenant_id_mct_ativo_idx" ON "tb_modelo_contrato"("tenant_id", "mct_ativo");

-- CreateIndex
CREATE INDEX "tb_contrato_tenant_id_neg_id_idx" ON "tb_contrato"("tenant_id", "neg_id");

-- CreateIndex
CREATE INDEX "tb_contrato_tenant_id_ctr_status_idx" ON "tb_contrato"("tenant_id", "ctr_status");

-- CreateIndex
CREATE INDEX "tb_contrato_signatario_ctr_id_idx" ON "tb_contrato_signatario"("ctr_id");

-- CreateIndex
CREATE UNIQUE INDEX "tb_fonte_captacao_fca_chave_key" ON "tb_fonte_captacao"("fca_chave");

-- CreateIndex
CREATE INDEX "tb_fonte_captacao_tenant_id_fca_ativa_idx" ON "tb_fonte_captacao"("tenant_id", "fca_ativa");

-- CreateIndex
CREATE INDEX "tb_captacao_evento_tenant_id_created_at_idx" ON "tb_captacao_evento"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "tb_captacao_evento_fca_id_created_at_idx" ON "tb_captacao_evento"("fca_id", "created_at");

-- AddForeignKey
ALTER TABLE "tb_negocio" ADD CONSTRAINT "tb_negocio_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_negocio" ADD CONSTRAINT "tb_negocio_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_negocio" ADD CONSTRAINT "tb_negocio_lea_id_fkey" FOREIGN KEY ("lea_id") REFERENCES "PropertyLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_negocio" ADD CONSTRAINT "tb_negocio_neg_comprador_id_fkey" FOREIGN KEY ("neg_comprador_id") REFERENCES "tb_cliente"("clt_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_negocio" ADD CONSTRAINT "tb_negocio_neg_vendedor_id_fkey" FOREIGN KEY ("neg_vendedor_id") REFERENCES "tb_cliente"("clt_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_negocio" ADD CONSTRAINT "tb_negocio_neg_responsavel_id_fkey" FOREIGN KEY ("neg_responsavel_id") REFERENCES "tb_usuario"("usu_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_negocio" ADD CONSTRAINT "tb_negocio_neg_juridico_por_fkey" FOREIGN KEY ("neg_juridico_por") REFERENCES "tb_usuario"("usu_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_negocio" ADD CONSTRAINT "tb_negocio_neg_financeiro_por_fkey" FOREIGN KEY ("neg_financeiro_por") REFERENCES "tb_usuario"("usu_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_negocio_evento" ADD CONSTRAINT "tb_negocio_evento_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_negocio_evento" ADD CONSTRAINT "tb_negocio_evento_neg_id_fkey" FOREIGN KEY ("neg_id") REFERENCES "tb_negocio"("neg_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_negocio_documento" ADD CONSTRAINT "tb_negocio_documento_neg_id_fkey" FOREIGN KEY ("neg_id") REFERENCES "tb_negocio"("neg_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_negocio_documento" ADD CONSTRAINT "tb_negocio_documento_ndo_enviado_por_fkey" FOREIGN KEY ("ndo_enviado_por") REFERENCES "tb_usuario"("usu_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_modelo_contrato" ADD CONSTRAINT "tb_modelo_contrato_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_contrato" ADD CONSTRAINT "tb_contrato_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_contrato" ADD CONSTRAINT "tb_contrato_neg_id_fkey" FOREIGN KEY ("neg_id") REFERENCES "tb_negocio"("neg_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_contrato" ADD CONSTRAINT "tb_contrato_mct_id_fkey" FOREIGN KEY ("mct_id") REFERENCES "tb_modelo_contrato"("mct_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_contrato_signatario" ADD CONSTRAINT "tb_contrato_signatario_ctr_id_fkey" FOREIGN KEY ("ctr_id") REFERENCES "tb_contrato"("ctr_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_fonte_captacao" ADD CONSTRAINT "tb_fonte_captacao_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_captacao_evento" ADD CONSTRAINT "tb_captacao_evento_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_captacao_evento" ADD CONSTRAINT "tb_captacao_evento_fca_id_fkey" FOREIGN KEY ("fca_id") REFERENCES "tb_fonte_captacao"("fca_id") ON DELETE CASCADE ON UPDATE CASCADE;
