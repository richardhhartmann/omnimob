-- Dados reais para os widgets da vitrine.
--
-- Os widgets "Equipe" e "Horários" mostravam conteúdo digitado à mão porque não
-- havia nada no banco para eles lerem. Estas colunas são essa fonte.
--
-- Tudo anulável ou com padrão: nenhuma linha existente precisa ser tocada, e
-- `usu_exibir_na_vitrine` nasce FALSE de propósito — ninguém aparece numa página
-- pública por efeito colateral de uma migração.

ALTER TABLE "tb_usuario" ADD COLUMN "usu_foto" TEXT;
ALTER TABLE "tb_usuario" ADD COLUMN "usu_creci" TEXT;
ALTER TABLE "tb_usuario" ADD COLUMN "usu_whatsapp" TEXT NOT NULL DEFAULT '';
ALTER TABLE "tb_usuario" ADD COLUMN "usu_exibir_na_vitrine" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tb_usuario" ADD COLUMN "usu_cargo_vitrine" TEXT;

ALTER TABLE "tb_tenants" ADD COLUMN "horario_atendimento" JSONB;
ALTER TABLE "tb_tenants" ADD COLUMN "fundada_em" INTEGER;
