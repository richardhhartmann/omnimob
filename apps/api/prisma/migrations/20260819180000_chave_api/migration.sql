-- Chave de API por imobiliária.
--
-- Guardamos o HASH, nunca o texto: um vazamento do banco não pode virar acesso
-- ao acervo de ninguém. `cha_prefixo` são os primeiros caracteres, o bastante
-- para a pessoa reconhecer qual chave revogar e insuficiente para usar.

CREATE TABLE "tb_chave_api" (
  "cha_id"          TEXT NOT NULL,
  "tenant_id"       TEXT NOT NULL,
  "cha_nome"        TEXT NOT NULL,
  "cha_prefixo"     TEXT NOT NULL,
  "cha_hash"        TEXT NOT NULL,
  "cha_escopos"     TEXT[] NOT NULL,
  "cha_ultimo_uso"  TIMESTAMP(3),
  "cha_revogada_em" TIMESTAMP(3),
  "cha_criada_por"  TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tb_chave_api_pkey" PRIMARY KEY ("cha_id")
);

-- Único no sistema inteiro: é por ele que a autenticação encontra a chave, sem
-- saber de antemão de qual imobiliária ela é.
CREATE UNIQUE INDEX "tb_chave_api_cha_hash_key" ON "tb_chave_api"("cha_hash");
CREATE INDEX "tb_chave_api_tenant_id_cha_revogada_em_idx" ON "tb_chave_api"("tenant_id", "cha_revogada_em");

ALTER TABLE "tb_chave_api"
  ADD CONSTRAINT "tb_chave_api_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tb_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
