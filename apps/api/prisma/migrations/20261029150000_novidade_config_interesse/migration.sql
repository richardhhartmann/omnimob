-- A publicação automática das Novidades (uma linha só) e os interessados da
-- landing, que antes só viravam e-mail. Tabelas novas: não travam nada.
CREATE TABLE "tb_novidade_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "automatica" BOOLEAN NOT NULL DEFAULT false,
    "comEmail" BOOLEAN NOT NULL DEFAULT true,
    "atualizadoPor" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_novidade_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tb_interesse_comercial" (
    "id" TEXT NOT NULL,
    "imobiliaria" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT,
    "plano" TEXT,
    "temWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "envio" TEXT,
    "atendidoEm" TIMESTAMP(3),
    "atendidoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tb_interesse_comercial_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tb_interesse_comercial_createdAt_idx" ON "tb_interesse_comercial"("createdAt");
