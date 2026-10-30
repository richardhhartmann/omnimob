-- As Novidades da semana e o registro de quem as viu. Tabelas novas: não
-- travam nada no deploy. Ver docs/novidades/README.md.
CREATE TABLE "tb_novidade" (
    "chave" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "conteudo" JSONB NOT NULL,
    "versao" TEXT,
    "origem" TEXT,
    "atualizadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publicadoEm" TIMESTAMP(3),
    "publicadoPor" TEXT,

    CONSTRAINT "tb_novidade_pkey" PRIMARY KEY ("chave")
);

CREATE TABLE "tb_novidade_visto" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuarioNome" TEXT NOT NULL,
    "origem" TEXT,
    "dispositivo" TEXT,
    "totalSlides" INTEGER NOT NULL DEFAULT 0,
    "slideMax" INTEGER NOT NULL DEFAULT 1,
    "chegouAoFim" BOOLEAN NOT NULL DEFAULT false,
    "abertoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechadoEm" TIMESTAMP(3),

    CONSTRAINT "tb_novidade_visto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tb_novidade_visto_chave_tenantId_idx" ON "tb_novidade_visto"("chave", "tenantId");
CREATE INDEX "tb_novidade_visto_usuarioId_chave_idx" ON "tb_novidade_visto"("usuarioId", "chave");

ALTER TABLE "tb_novidade_visto" ADD CONSTRAINT "tb_novidade_visto_chave_fkey"
    FOREIGN KEY ("chave") REFERENCES "tb_novidade"("chave") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tb_novidade_visto" ADD CONSTRAINT "tb_novidade_visto_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tb_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
