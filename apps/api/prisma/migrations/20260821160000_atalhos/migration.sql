-- Atalhos de teclado: o padrão da imobiliária e a escolha de cada pessoa.
--
-- Guardam SÓ o que difere do padrão de fábrica, e não a tabela inteira. Gravar
-- tudo congelaria a configuração num instantâneo do catálogo: um atalho novo
-- lançado depois nunca chegaria a quem já tivesse mexido uma vez.
ALTER TABLE "tb_tenants" ADD COLUMN "tnt_atalhos" JSONB;
ALTER TABLE "tb_usuario" ADD COLUMN "usu_atalhos" JSONB;
