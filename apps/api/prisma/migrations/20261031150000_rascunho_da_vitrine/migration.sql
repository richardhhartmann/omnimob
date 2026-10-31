-- O rascunho do editor de vitrine (um por imobiliária) e as versões publicadas.
-- Duas tabelas novas: nada existente é reescrito.
-- CreateTable
CREATE TABLE "tb_vitrine_rascunho" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documento" JSONB NOT NULL,
    "opcoes" JSONB NOT NULL,
    "cadastro" JSONB NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "atualizadoPorId" TEXT,
    "atualizadoPorNome" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tb_vitrine_rascunho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_vitrine_versao" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documento" JSONB NOT NULL,
    "opcoes" JSONB NOT NULL,
    "cadastro" JSONB NOT NULL,
    "publicadoPorId" TEXT,
    "publicadoPorNome" TEXT,
    "publicadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tb_vitrine_versao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tb_vitrine_rascunho_tenantId_key" ON "tb_vitrine_rascunho"("tenantId");

-- CreateIndex
CREATE INDEX "tb_vitrine_versao_tenantId_publicadoEm_idx" ON "tb_vitrine_versao"("tenantId", "publicadoEm");

-- AddForeignKey
ALTER TABLE "tb_vitrine_rascunho" ADD CONSTRAINT "tb_vitrine_rascunho_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tb_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_vitrine_versao" ADD CONSTRAINT "tb_vitrine_versao_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tb_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

