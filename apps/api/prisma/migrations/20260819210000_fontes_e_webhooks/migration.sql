-- Fonte de importação guardada e webhooks de saída.
--
-- A fonte transforma a importação de um evento ("colei a URL uma vez") numa
-- integração ("o mesmo endereço, relido"). O webhook fecha a mão dupla: o feed
-- é o dado do outro lado que nós buscamos; o webhook é o nosso evento, que nós
-- entregamos.

CREATE TABLE "tb_fonte_importacao" (
  "fon_id"                 TEXT NOT NULL,
  "tenant_id"              TEXT NOT NULL,
  "fon_nome"               TEXT NOT NULL,
  "fon_entidade"           TEXT NOT NULL,
  "fon_url"                TEXT NOT NULL,
  "fon_ativa"              BOOLEAN NOT NULL DEFAULT true,
  "fon_desativar_ausentes" BOOLEAN NOT NULL DEFAULT false,
  "fon_ultima_sync"        TIMESTAMP(3),
  "fon_ultimo_resultado"   JSONB,
  "fon_criada_por"         TEXT,
  "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"             TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tb_fonte_importacao_pkey" PRIMARY KEY ("fon_id")
);

CREATE INDEX "tb_fonte_importacao_tenant_id_fon_ativa_idx" ON "tb_fonte_importacao"("tenant_id", "fon_ativa");

ALTER TABLE "tb_fonte_importacao"
  ADD CONSTRAINT "tb_fonte_importacao_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tb_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "tb_webhook" (
  "whk_id"              TEXT NOT NULL,
  "tenant_id"           TEXT NOT NULL,
  "whk_url"             TEXT NOT NULL,
  "whk_eventos"         TEXT[] NOT NULL,
  "whk_segredo"         TEXT NOT NULL,
  "whk_ativo"           BOOLEAN NOT NULL DEFAULT true,
  "whk_falhas_seguidas" INTEGER NOT NULL DEFAULT 0,
  "whk_ultimo_envio"    TIMESTAMP(3),
  "whk_ultima_falha"    TEXT,
  "whk_criado_por"      TEXT,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tb_webhook_pkey" PRIMARY KEY ("whk_id")
);

CREATE INDEX "tb_webhook_tenant_id_whk_ativo_idx" ON "tb_webhook"("tenant_id", "whk_ativo");

ALTER TABLE "tb_webhook"
  ADD CONSTRAINT "tb_webhook_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tb_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
