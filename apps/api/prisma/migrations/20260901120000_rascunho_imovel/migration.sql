-- O cadastro de imóvel interrompido.
--
-- O formulário tem quatro etapas e quarenta campos, e sair dele sem salvar
-- apagava tudo. Sair não é exceção: falta a metragem, falta o CEP, o cliente
-- ligou. Uma linha por rascunho, por PESSOA — e não por navegador, senão quem
-- começa na loja e termina em casa perde o trabalho de qualquer jeito.
CREATE TABLE "tb_rascunho_imovel" (
    "rsc_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "usu_id" TEXT NOT NULL,
    "rsc_chave" TEXT NOT NULL,
    "rsc_titulo" TEXT,
    "rsc_etapa" INTEGER NOT NULL DEFAULT 0,
    "rsc_fotos" INTEGER NOT NULL DEFAULT 0,
    "rsc_dados" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tb_rascunho_imovel_pkey" PRIMARY KEY ("rsc_id")
);

-- A chave que torna o autosave idempotente: o navegador a gera ao abrir o
-- formulário, e o primeiro salvamento e os cinquenta seguintes escrevem na
-- mesma linha, sem esperar um id de volta para não duplicar.
CREATE UNIQUE INDEX "tb_rascunho_imovel_usu_id_rsc_chave_key" ON "tb_rascunho_imovel"("usu_id", "rsc_chave");

-- A leitura da lista: os rascunhos DESTA pessoa, do mais recente para o mais
-- antigo. O tenant entra na chave porque a mesma pessoa pode ter conta em duas
-- imobiliárias, e o rascunho de uma não pode aparecer na outra.
CREATE INDEX "tb_rascunho_imovel_tenant_id_usu_id_updated_at_idx" ON "tb_rascunho_imovel"("tenant_id", "usu_id", "updated_at");

ALTER TABLE "tb_rascunho_imovel" ADD CONSTRAINT "tb_rascunho_imovel_usu_id_fkey" FOREIGN KEY ("usu_id") REFERENCES "tb_usuario"("usu_id") ON DELETE CASCADE ON UPDATE CASCADE;
