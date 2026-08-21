-- O interruptor mestre dos atalhos de teclado.
--
-- DEFAULT true: o recurso existe para ser usado, e quem não gostar desliga numa
-- caixa em Configurações. Nascer desligado o esconderia de quem nunca vai
-- procurá-lo — e um recurso que ninguém encontra é um recurso que não existe.
ALTER TABLE "tb_tenants" ADD COLUMN "tnt_atalhos_ativos" BOOLEAN NOT NULL DEFAULT true;
