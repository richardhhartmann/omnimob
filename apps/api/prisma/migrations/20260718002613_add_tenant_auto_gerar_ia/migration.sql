-- Toggle de auto-preenchimento por IA ao cadastrar imóvel.
ALTER TABLE "tb_tenants" ADD COLUMN "autoGerarIA" BOOLEAN NOT NULL DEFAULT true;
