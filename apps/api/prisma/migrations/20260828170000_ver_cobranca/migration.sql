-- Ver a cobrança da imobiliária deixou de ser consequência de administrar a
-- casa e virou uma escolha própria: extrato, vencimento e o botão de adiantar
-- um pagamento (que gera cobrança de verdade).
ALTER TABLE "tb_cargo" ADD COLUMN "ver_cobranca" BOOLEAN NOT NULL DEFAULT false;

-- Ninguém PERDE acesso na migração. Quem já enxergava a cobrança — porque ela
-- morava dentro de Configurações — continua enxergando; o resto nasce sem, que
-- é o certo para dado de dinheiro.
UPDATE "tb_cargo" SET "ver_cobranca" = true WHERE "ver_configuracoes" = true;
