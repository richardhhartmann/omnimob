-- A última cobrança AVULSA que deixou a conta em dia, e quem a processou.
-- Pagamento único (Pix do Mercado Pago hoje) não renova sozinho: empurra
-- `proximoVencimento` uma vez e acaba. O id fica guardado porque é ele que
-- torna a ativação idempotente — o provedor reenvia o mesmo aviso por horas.
ALTER TABLE "tb_tenants" ADD COLUMN "tnt_cobranca_id" TEXT;
ALTER TABLE "tb_tenants" ADD COLUMN "tnt_cobranca_provedor" TEXT;
