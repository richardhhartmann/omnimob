-- Contatos elegíveis para divulgação (base para broadcast no WhatsApp).
ALTER TABLE "tb_cliente" ADD COLUMN "clt_aceita_divulgacao" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tb_cliente" ADD COLUMN "clt_divulgacao_optin_at" TIMESTAMP(3);

-- Índice para listar rapidamente quem recebe divulgações por tenant.
CREATE INDEX "tb_cliente_tenant_id_clt_aceita_divulgacao_idx" ON "tb_cliente"("tenant_id", "clt_aceita_divulgacao");
