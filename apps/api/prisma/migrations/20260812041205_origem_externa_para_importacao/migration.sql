-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "origem_externa" TEXT;

-- AlterTable
ALTER TABLE "tb_cliente" ADD COLUMN     "origem_externa" TEXT;

-- AlterTable
ALTER TABLE "tb_usuario" ADD COLUMN     "origem_externa" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Property_tenantId_origem_externa_key" ON "Property"("tenantId", "origem_externa");

-- CreateIndex
CREATE UNIQUE INDEX "tb_cliente_tenant_id_origem_externa_key" ON "tb_cliente"("tenant_id", "origem_externa");

-- CreateIndex
CREATE UNIQUE INDEX "tb_usuario_tenant_id_origem_externa_key" ON "tb_usuario"("tenant_id", "origem_externa");

