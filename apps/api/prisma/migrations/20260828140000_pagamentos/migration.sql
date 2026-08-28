-- O histórico de pagamento, que não existia em lugar nenhum: o tenant guardava
-- só o estado atual e o passado morava em dois fornecedores — sem contar a
-- ativação manual, que não existe em fornecedor nenhum.
CREATE TABLE "tb_pagamento" (
    "pgt_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "pgt_provedor" TEXT NOT NULL,
    "pgt_meio" TEXT,
    "pgt_status" TEXT NOT NULL,
    "pgt_valor" DECIMAL(10,2) NOT NULL,
    "pgt_plano" TEXT,
    "pgt_periodo" TEXT,
    "pgt_cobre_de" TIMESTAMP(3),
    "pgt_cobre_ate" TIMESTAMP(3),
    "pgt_externo_id" TEXT,
    "pgt_recibo_url" TEXT,
    "pgt_descricao" TEXT,
    "pgt_pago_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tb_pagamento_pkey" PRIMARY KEY ("pgt_id")
);

-- A chave que torna o registro idempotente: o webhook reenvia o mesmo evento
-- por horas, e a tela do Pix consulta em paralelo com o aviso do provedor.
-- Nulo (ativação manual) não colide com nulo no Postgres, então duas cortesias
-- para o mesmo tenant continuam sendo duas linhas.
CREATE UNIQUE INDEX "tb_pagamento_pgt_provedor_pgt_externo_id_key" ON "tb_pagamento"("pgt_provedor", "pgt_externo_id");
CREATE INDEX "tb_pagamento_tenant_id_pgt_pago_em_idx" ON "tb_pagamento"("tenant_id", "pgt_pago_em");

ALTER TABLE "tb_pagamento" ADD CONSTRAINT "tb_pagamento_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tb_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
