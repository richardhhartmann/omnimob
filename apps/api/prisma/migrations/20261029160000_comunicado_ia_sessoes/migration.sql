-- O comunicado avulso (e quem já viu), o consumo de IA por chamada e as
-- sessões do painel registradas no primeiro uso. Só tabelas novas: não travam
-- nada no deploy. Gerada por `prisma migrate diff` contra as anteriores.

-- CreateTable
CREATE TABLE "tb_comunicado" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "tenantId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "expiraEm" TIMESTAMP(3),
    "criadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tb_comunicado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_comunicado_visto" (
    "id" TEXT NOT NULL,
    "comunicadoId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "vistoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tb_comunicado_visto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_consumo_ia" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "rota" TEXT,
    "tokensEntrada" INTEGER NOT NULL DEFAULT 0,
    "tokensSaida" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tb_consumo_ia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tb_sessao_usuario" (
    "jti" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'painel',
    "ip" TEXT,
    "userAgent" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoUsoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_sessao_usuario_pkey" PRIMARY KEY ("jti")
);

-- CreateIndex
CREATE INDEX "tb_comunicado_ativo_createdAt_idx" ON "tb_comunicado"("ativo", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "tb_comunicado_visto_comunicadoId_usuarioId_key" ON "tb_comunicado_visto"("comunicadoId", "usuarioId");

-- CreateIndex
CREATE INDEX "tb_consumo_ia_tenantId_createdAt_idx" ON "tb_consumo_ia"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "tb_sessao_usuario_tenantId_expiraEm_idx" ON "tb_sessao_usuario"("tenantId", "expiraEm");

-- CreateIndex
CREATE INDEX "tb_sessao_usuario_usuarioId_idx" ON "tb_sessao_usuario"("usuarioId");

-- AddForeignKey
ALTER TABLE "tb_comunicado_visto" ADD CONSTRAINT "tb_comunicado_visto_comunicadoId_fkey" FOREIGN KEY ("comunicadoId") REFERENCES "tb_comunicado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_comunicado_visto" ADD CONSTRAINT "tb_comunicado_visto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tb_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_consumo_ia" ADD CONSTRAINT "tb_consumo_ia_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tb_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_sessao_usuario" ADD CONSTRAINT "tb_sessao_usuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "tb_usuario"("usu_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tb_sessao_usuario" ADD CONSTRAINT "tb_sessao_usuario_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tb_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

