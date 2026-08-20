-- Tema do painel, por imobiliária e por pessoa.
--
-- O da IMOBILIÁRIA tem padrão "escuro" — é o que o produto sempre foi, então
-- ninguém acorda com a tela trocada.
--
-- O da PESSOA nasce NULO, e é essa nulidade que carrega a regra: nulo significa
-- "nunca escolhi", e aí vale o da imobiliária. Quem já escolheu tem o seu
-- preservado quando o administrador troca o padrão da casa.

ALTER TABLE "tb_tenants" ADD COLUMN "tema_imobiliaria" TEXT NOT NULL DEFAULT 'escuro';
ALTER TABLE "tb_usuario" ADD COLUMN "usu_tema_painel" TEXT;
