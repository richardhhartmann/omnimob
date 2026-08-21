-- O nome da conta Google.
-- Campo PRÓPRIO, e não sobrescrevendo `usu_nome`: o nome do cadastro é decisão
-- da imobiliária e é o que aparece na vitrine e nas listas. Este aqui serve à
-- moldura do painel — o retrato que a pessoa vê de si mesma.
ALTER TABLE "tb_usuario" ADD COLUMN "usu_google_nome" TEXT;
