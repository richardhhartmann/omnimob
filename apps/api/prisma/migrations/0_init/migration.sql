-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PublicationChannel" AS ENUM ('FACEBOOK', 'INSTAGRAM', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "MetricEventType" AS ENUM ('VIEW', 'LEAD', 'SALE');

-- CreateEnum
CREATE TYPE "TipoVenda" AS ENUM ('VENDA', 'ALUGUEL');

-- CreateEnum
CREATE TYPE "AndamentoImovel" AS ENUM ('PRONTO_PARA_MORAR', 'EM_CONSTRUCAO');

-- CreateEnum
CREATE TYPE "StatusPagamento" AS ENUM ('TRIAL', 'EM_DIA', 'ATRASADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "tb_tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "cnpj" TEXT,
    "creci" TEXT,
    "whatsapp" TEXT NOT NULL DEFAULT '',
    "telefone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "slogan" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT NOT NULL DEFAULT '',
    "primaryColor" TEXT NOT NULL DEFAULT '#6366f1',
    "secondaryColor" TEXT NOT NULL DEFAULT '#d4af37',
    "showcaseHeadline" TEXT NOT NULL DEFAULT '',
    "showcaseSubheadline" TEXT NOT NULL DEFAULT '',
    "cep" TEXT,
    "endereco" TEXT NOT NULL DEFAULT '',
    "cidade" TEXT NOT NULL DEFAULT '',
    "estado" TEXT NOT NULL DEFAULT '',
    "showcaseConfig" JSONB,
    "facebookPageId" TEXT,
    "facebookPageToken" TEXT,
    "facebookPageName" TEXT,
    "instagramBusinessId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "plano" TEXT,
    "statusPagamento" "StatusPagamento" NOT NULL DEFAULT 'TRIAL',
    "proximoVencimento" TIMESTAMP(3),
    "valorMensal" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_super_admin" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_super_admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_cargo" (
    "crg_codigo" SERIAL NOT NULL,
    "crg_descricao" TEXT NOT NULL,
    "acessar_painel" BOOLEAN NOT NULL DEFAULT false,
    "editar_pagina" BOOLEAN NOT NULL DEFAULT false,
    "gerenciar_imoveis" BOOLEAN NOT NULL DEFAULT false,
    "gerenciar_leads" BOOLEAN NOT NULL DEFAULT false,
    "gerenciar_usuarios" BOOLEAN NOT NULL DEFAULT false,
    "gerenciar_clientes" BOOLEAN NOT NULL DEFAULT false,
    "gerenciar_cargos" BOOLEAN NOT NULL DEFAULT false,
    "ver_relatorios" BOOLEAN NOT NULL DEFAULT false,
    "publicar_redes" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tb_cargo_pkey" PRIMARY KEY ("crg_codigo")
);

-- CreateTable
CREATE TABLE "tb_usuario" (
    "usu_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "crg_codigo" INTEGER NOT NULL,
    "usu_nome" TEXT NOT NULL,
    "usu_login" TEXT NOT NULL,
    "usu_senha" TEXT NOT NULL,
    "usu_forca_alterar_senha" BOOLEAN NOT NULL DEFAULT false,
    "usu_ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_usuario_pkey" PRIMARY KEY ("usu_id")
);

-- CreateTable
CREATE TABLE "tb_cliente" (
    "clt_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "clt_nome" TEXT NOT NULL,
    "clt_cpf" TEXT,
    "clt_rg" TEXT,
    "clt_nascimento" DATE,
    "clt_email" TEXT,
    "clt_telefone" TEXT,
    "clt_whatsapp" TEXT,
    "clt_cep" TEXT,
    "clt_endereco" TEXT,
    "clt_bairro" TEXT,
    "clt_cidade" TEXT,
    "clt_estado" TEXT,
    "clt_observacoes" TEXT,
    "clt_ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_cliente_pkey" PRIMARY KEY ("clt_id")
);

-- CreateTable
CREATE TABLE "tb_venda" (
    "ven_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "clt_id" TEXT NOT NULL,
    "usu_id" TEXT NOT NULL,
    "ven_tipo" "TipoVenda" NOT NULL,
    "ven_valor" DECIMAL(12,2) NOT NULL,
    "ven_data" DATE NOT NULL,
    "ven_comissao" DECIMAL(12,2),
    "ven_observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_venda_pkey" PRIMARY KEY ("ven_id")
);

-- CreateTable
CREATE TABLE "tb_tipo_imovel" (
    "tip_id" SERIAL NOT NULL,
    "tip_descricao" TEXT NOT NULL,
    "tip_area_fields" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "tb_tipo_imovel_pkey" PRIMARY KEY ("tip_id")
);

-- CreateTable
CREATE TABLE "tb_modelo_atributo" (
    "atr_id" SERIAL NOT NULL,
    "tip_id" INTEGER NOT NULL,
    "atr_descricao" TEXT NOT NULL,
    "atr_grupo" TEXT,

    CONSTRAINT "tb_modelo_atributo_pkey" PRIMARY KEY ("atr_id")
);

-- CreateTable
CREATE TABLE "tb_imovel_atributo" (
    "property_id" TEXT NOT NULL,
    "atr_id" INTEGER NOT NULL,

    CONSTRAINT "tb_imovel_atributo_pkey" PRIMARY KEY ("property_id","atr_id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tip_id" INTEGER,
    "propertyType" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "cep" TEXT,
    "address" TEXT NOT NULL,
    "neighborhood" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "bedrooms" INTEGER NOT NULL DEFAULT 0,
    "parkingSpots" INTEGER NOT NULL DEFAULT 0,
    "suites" INTEGER NOT NULL DEFAULT 0,
    "squareFootage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "finalidade" TEXT,
    "area_terreno" DOUBLE PRECISION,
    "area_construida" DOUBLE PRECISION,
    "area_privativa" DOUBLE PRECISION,
    "area_total" DOUBLE PRECISION,
    "andamento" "AndamentoImovel",
    "aceita_permuta" BOOLEAN NOT NULL DEFAULT false,
    "comodidades" JSONB,
    "status" "PropertyStatus" NOT NULL DEFAULT 'DRAFT',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "leadCount" INTEGER NOT NULL DEFAULT 0,
    "saleCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyPublication" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "channel" "PublicationChannel" NOT NULL,
    "status" "PublicationStatus" NOT NULL DEFAULT 'PENDING',
    "externalRef" TEXT,
    "errorMessage" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyPublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyMetricEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "type" "MetricEventType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyMetricEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyImage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyLead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "message" TEXT,
    "source" TEXT NOT NULL DEFAULT 'showcase',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tb_tenants_slug_key" ON "tb_tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tb_super_admin_email_key" ON "tb_super_admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tb_usuario_usu_login_key" ON "tb_usuario"("usu_login");

-- CreateIndex
CREATE INDEX "tb_usuario_tenant_id_usu_ativo_idx" ON "tb_usuario"("tenant_id", "usu_ativo");

-- CreateIndex
CREATE INDEX "tb_cliente_tenant_id_clt_ativo_idx" ON "tb_cliente"("tenant_id", "clt_ativo");

-- CreateIndex
CREATE INDEX "tb_cliente_tenant_id_clt_cpf_idx" ON "tb_cliente"("tenant_id", "clt_cpf");

-- CreateIndex
CREATE INDEX "tb_venda_tenant_id_ven_data_idx" ON "tb_venda"("tenant_id", "ven_data");

-- CreateIndex
CREATE INDEX "tb_venda_tenant_id_property_id_idx" ON "tb_venda"("tenant_id", "property_id");

-- CreateIndex
CREATE INDEX "tb_venda_tenant_id_clt_id_idx" ON "tb_venda"("tenant_id", "clt_id");

-- CreateIndex
CREATE INDEX "Property_tenantId_status_idx" ON "Property"("tenantId", "status");

-- CreateIndex
CREATE INDEX "PropertyPublication_tenantId_status_idx" ON "PropertyPublication"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyPublication_propertyId_channel_key" ON "PropertyPublication"("propertyId", "channel");

-- CreateIndex
CREATE INDEX "PropertyMetricEvent_tenantId_propertyId_type_createdAt_idx" ON "PropertyMetricEvent"("tenantId", "propertyId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "PropertyImage_tenantId_propertyId_position_idx" ON "PropertyImage"("tenantId", "propertyId", "position");

-- CreateIndex
CREATE INDEX "PropertyLead_tenantId_propertyId_createdAt_idx" ON "PropertyLead"("tenantId", "propertyId", "createdAt");

-- AddForeignKey
ALTER TABLE "tb_usuario" ADD CONSTRAINT "tb_usuario_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_usuario" ADD CONSTRAINT "tb_usuario_crg_codigo_fkey" FOREIGN KEY ("crg_codigo") REFERENCES "tb_cargo"("crg_codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_cliente" ADD CONSTRAINT "tb_cliente_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_venda" ADD CONSTRAINT "tb_venda_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_venda" ADD CONSTRAINT "tb_venda_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_venda" ADD CONSTRAINT "tb_venda_clt_id_fkey" FOREIGN KEY ("clt_id") REFERENCES "tb_cliente"("clt_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_venda" ADD CONSTRAINT "tb_venda_usu_id_fkey" FOREIGN KEY ("usu_id") REFERENCES "tb_usuario"("usu_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_modelo_atributo" ADD CONSTRAINT "tb_modelo_atributo_tip_id_fkey" FOREIGN KEY ("tip_id") REFERENCES "tb_tipo_imovel"("tip_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_imovel_atributo" ADD CONSTRAINT "tb_imovel_atributo_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_imovel_atributo" ADD CONSTRAINT "tb_imovel_atributo_atr_id_fkey" FOREIGN KEY ("atr_id") REFERENCES "tb_modelo_atributo"("atr_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tb_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_tip_id_fkey" FOREIGN KEY ("tip_id") REFERENCES "tb_tipo_imovel"("tip_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyPublication" ADD CONSTRAINT "PropertyPublication_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tb_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyPublication" ADD CONSTRAINT "PropertyPublication_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMetricEvent" ADD CONSTRAINT "PropertyMetricEvent_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyImage" ADD CONSTRAINT "PropertyImage_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyLead" ADD CONSTRAINT "PropertyLead_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyLead" ADD CONSTRAINT "PropertyLead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tb_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

