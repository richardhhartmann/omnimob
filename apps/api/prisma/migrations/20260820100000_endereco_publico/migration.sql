-- Exibir ou não a rua e o número na página pública do imóvel.
--
-- FALSE por padrão, e para os imóveis que já existem também: o endereço exato
-- estava sendo publicado sem ninguém ter escolhido isso. A migração fecha essa
-- porta para o acervo inteiro, e quem quiser abrir marca imóvel a imóvel.

ALTER TABLE "Property" ADD COLUMN "prp_exibir_endereco_completo" BOOLEAN NOT NULL DEFAULT false;
