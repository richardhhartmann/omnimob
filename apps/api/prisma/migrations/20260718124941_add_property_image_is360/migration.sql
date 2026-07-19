-- Adiciona flag de foto panorâmica 360° em PropertyImage
ALTER TABLE "PropertyImage" ADD COLUMN "is360" BOOLEAN NOT NULL DEFAULT false;
