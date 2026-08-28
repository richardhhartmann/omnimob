-- A chave do feed VRSync, que os portais usam para buscar o XML da imobiliária.
--
-- ── POR QUE ELA CHEGA ATRASADA ──
-- A coluna existia no `schema.prisma` desde a entrega dos portais, mas NENHUMA
-- migração a criava: ela nasceu no banco de desenvolvimento por `db push`, e o
-- histórico nunca soube dela. O dev funcionava, `migrate status` dizia "up to
-- date" (todas as migrações estavam mesmo aplicadas — nenhuma a mencionava), e
-- a produção subiu sem a coluna. O sintoma foi o pior possível: toda leitura de
-- `Tenant` quebrando com P2022, o painel do super-admin inteiro fora do ar.
--
-- `IF NOT EXISTS` porque no banco de desenvolvimento ela JÁ existe, criada pelo
-- push. Sem isso, esta migração passaria na produção e falharia em toda máquina
-- de quem já desenvolve — que é como a correção viraria um segundo problema.
ALTER TABLE "tb_tenants" ADD COLUMN IF NOT EXISTS "feed_chave" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "tb_tenants_feed_chave_key" ON "tb_tenants"("feed_chave");
