-- Tipos de contrato do imóvel (venda, locação, permuta, built to suit).

-- CreateEnum
CREATE TYPE "TipoContrato" AS ENUM ('VENDA', 'LOCACAO', 'PERMUTA', 'BUILT_TO_SUIT');

-- AlterTable: natureza do negócio de cada imóvel.
-- Fica NULL nos imóveis já cadastrados — nenhum negócio é assumido para eles;
-- a UI mostra "—" até que o imóvel seja editado.
ALTER TABLE "Property" ADD COLUMN "tipo_contrato" "TipoContrato";

-- AlterTable: quais tipos cada imobiliária libera no cadastro.
-- Tenants existentes passam a ter os quatro habilitados, igual ao default.
ALTER TABLE "tb_tenants" ADD COLUMN "tipos_contrato" "TipoContrato"[] DEFAULT ARRAY['VENDA', 'LOCACAO', 'PERMUTA', 'BUILT_TO_SUIT']::"TipoContrato"[];
