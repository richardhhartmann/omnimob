-- Qual aviso de vencimento a conta já recebeu, como "<vencimento>:<degrau>"
-- (ex.: "2026-09-27:1"). A data entra na chave porque é ela que fecha o ciclo:
-- pago o plano, `proximoVencimento` muda, a chave deixa de casar e a próxima
-- rodada de avisos começa sozinha — sem limpeza e sem backfill.
ALTER TABLE "tb_tenants" ADD COLUMN "tnt_aviso_vencimento" TEXT;
