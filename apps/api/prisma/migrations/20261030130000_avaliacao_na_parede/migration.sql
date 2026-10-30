-- A avaliação que vira depoimento na parede "Por que Omnimob" da landing:
-- consentimento de quem avaliou, conferência da IA e a publicação pela
-- Omnimob. Colunas anuláveis ou com padrão: não reescreve a tabela.
ALTER TABLE "tb_avaliacao" ADD COLUMN "usuarioCargo" TEXT,
ADD COLUMN "permitePublicar" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "coerencia" TEXT,
ADD COLUMN "publicadaEm" TIMESTAMP(3);

CREATE INDEX "tb_avaliacao_publicadaEm_idx" ON "tb_avaliacao"("publicadaEm");

-- Os exemplos da parede que a Omnimob tirou do ar. Tabela nova.
CREATE TABLE "tb_relato_demo_oculto" (
    "chave" TEXT NOT NULL,
    "ocultoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tb_relato_demo_oculto_pkey" PRIMARY KEY ("chave")
);
