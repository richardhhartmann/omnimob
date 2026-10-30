-- A nota que o usuário dá ao painel. Uma por pessoa (índice único), lida pela
-- aba Avaliações do super-admin. Tabela nova: não trava nada no deploy.
CREATE TABLE "tb_avaliacao" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuarioNome" TEXT NOT NULL,
    "nota" INTEGER NOT NULL,
    "comentario" TEXT,
    "tela" TEXT,
    "lidaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tb_avaliacao_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tb_avaliacao_tenantId_usuarioId_key" ON "tb_avaliacao"("tenantId", "usuarioId");
CREATE INDEX "tb_avaliacao_createdAt_idx" ON "tb_avaliacao"("createdAt");
CREATE INDEX "tb_avaliacao_lidaEm_idx" ON "tb_avaliacao"("lidaEm");

ALTER TABLE "tb_avaliacao" ADD CONSTRAINT "tb_avaliacao_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tb_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
