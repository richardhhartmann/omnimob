-- Campos para imóveis comerciais: nº de salas e de banheiros.
ALTER TABLE "Property" ADD COLUMN "salas" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Property" ADD COLUMN "banheiros" INTEGER NOT NULL DEFAULT 0;
