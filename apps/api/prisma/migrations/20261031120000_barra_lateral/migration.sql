-- A barra lateral personalizada de cada pessoa: as seções ("Favoritos") com as
-- telas que ela mais usa, e qual está ligada. Nulo = nunca personalizou (a
-- barra inteira). Coluna nulável, sem DEFAULT: não reescreve a tabela.
ALTER TABLE "tb_usuario" ADD COLUMN "usu_barra_lateral" JSONB;
