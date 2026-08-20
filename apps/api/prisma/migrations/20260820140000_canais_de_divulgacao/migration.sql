-- Canais de divulgação: Mercado Livre, ponte de WhatsApp e rastreio do feed.
--
-- O Mercado Livre é o primeiro canal EMPURRADO de portal: ZAP, VivaReal e OLX
-- vêm buscar o feed, ele exige publicação anúncio a anúncio em nome do
-- vendedor. Por isso token por imobiliária, cifrado como o do Facebook.
--
-- A ponte de WhatsApp guarda o endereço de um serviço que a IMOBILIÁRIA
-- contrata — não hospedamos sessão nenhuma.

ALTER TYPE "PublicationChannel" ADD VALUE IF NOT EXISTS 'MERCADO_LIVRE';

ALTER TABLE "tb_tenants" ADD COLUMN "ml_user_id"      TEXT;
ALTER TABLE "tb_tenants" ADD COLUMN "ml_token"        TEXT;
ALTER TABLE "tb_tenants" ADD COLUMN "ml_refresh"      TEXT;
ALTER TABLE "tb_tenants" ADD COLUMN "ml_expira_em"    TIMESTAMP(3);
ALTER TABLE "tb_tenants" ADD COLUMN "ml_nick"         TEXT;
ALTER TABLE "tb_tenants" ADD COLUMN "wa_ponte_url"    TEXT;
ALTER TABLE "tb_tenants" ADD COLUMN "wa_ponte_token"  TEXT;
ALTER TABLE "tb_tenants" ADD COLUMN "feed_lido_em"    TIMESTAMP(3);
