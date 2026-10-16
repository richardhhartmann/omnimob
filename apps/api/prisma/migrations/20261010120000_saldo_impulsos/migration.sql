-- O saldo de impulsos (Meta Ads) e o extrato dele.
--
-- 1. Dois saldos no tenant, porque viram de jeitos opostos: o DO PLANO volta ao
--    limite quando o pagamento cai; o AVULSO (comprado à parte) não zera.
--    Começam em zero: a recarga acontece no próximo pagamento, e nenhuma conta
--    ganha impulso que não pagou.
ALTER TABLE "tb_tenants" ADD COLUMN     "tnt_impulsos_avulsos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tnt_impulsos_plano" INTEGER NOT NULL DEFAULT 0;

-- 2. O extrato: uma linha por mudança de saldo, com o delta e o saldo depois.
CREATE TABLE "tb_impulso_movimento" (
    "imv_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "imv_tipo" TEXT NOT NULL,
    "imv_delta_plano" INTEGER NOT NULL DEFAULT 0,
    "imv_delta_avulsos" INTEGER NOT NULL DEFAULT 0,
    "imv_saldo_plano" INTEGER NOT NULL,
    "imv_saldo_avulsos" INTEGER NOT NULL,
    "pgt_id" TEXT,
    "imv_estorno_de_id" TEXT,
    "imv_referencia" TEXT,
    "usuario_id" TEXT,
    "imv_descricao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tb_impulso_movimento_pkey" PRIMARY KEY ("imv_id")
);

-- As duas chaves que tornam o extrato idempotente: o mesmo pagamento recarrega
-- uma vez só (o webhook reenvia, a tela do Pix consulta em paralelo), e o mesmo
-- consumo é devolvido uma vez só. Nulo não colide com nulo no Postgres.
CREATE UNIQUE INDEX "tb_impulso_movimento_pgt_id_key" ON "tb_impulso_movimento"("pgt_id");
CREATE UNIQUE INDEX "tb_impulso_movimento_imv_estorno_de_id_key" ON "tb_impulso_movimento"("imv_estorno_de_id");
CREATE INDEX "tb_impulso_movimento_tenant_id_created_at_idx" ON "tb_impulso_movimento"("tenant_id", "created_at");

ALTER TABLE "tb_impulso_movimento" ADD CONSTRAINT "tb_impulso_movimento_pgt_id_fkey" FOREIGN KEY ("pgt_id") REFERENCES "tb_pagamento"("pgt_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tb_impulso_movimento" ADD CONSTRAINT "tb_impulso_movimento_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
