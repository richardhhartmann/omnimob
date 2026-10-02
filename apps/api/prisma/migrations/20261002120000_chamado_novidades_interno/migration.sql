-- Chamados: o que o cliente ainda não viu, e o chamado interno.
--
-- 1. `cha_visto_cliente_em` — quando o dono abriu o chamado pela última vez.
--    Alteração depois disso é novidade (selo no avatar, lista no menu de
--    Ajuda). Nulo conta a partir da criação: chamado antigo não nasce com
--    novidade nenhuma, porque ninguém mexeu nele depois de aberto.
ALTER TABLE "tb_chamado" ADD COLUMN "cha_visto_cliente_em" TIMESTAMP(3);

-- Chamado já existente fica como VISTO: sem isto, todo chamado respondido
-- antes desta migration acenderia o selo de uma vez no primeiro acesso.
UPDATE "tb_chamado" SET "cha_visto_cliente_em" = "updated_at";

-- 2. O chamado INTERNO: a equipe da Omnimob, dentro da conta do cliente,
--    pedindo algo ao desenvolvimento. `cha_aberto_por` diz quem da equipe.
ALTER TABLE "tb_chamado" ADD COLUMN "cha_interno" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tb_chamado" ADD COLUMN "cha_aberto_por" TEXT;
