-- Publicação automática por canal, por imobiliária.
-- JSON e não uma coluna por canal: canal novo entra sem migração.
ALTER TABLE "tb_tenants" ADD COLUMN "tnt_publicacao_automatica" JSONB;
