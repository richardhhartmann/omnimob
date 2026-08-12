-- E-mail do usuário, para a recuperação de senha.
--
-- Anulável: o cadastro nunca pediu e-mail, então ninguém que já existe tem um.
-- Tornar obrigatório agora exigiria inventar um valor para cada usuário — e
-- e-mail inventado no cadastro de acesso é pior que campo vazio.

ALTER TABLE "tb_usuario" ADD COLUMN "usu_email" TEXT;

-- Backfill do administrador de cada imobiliária.
--
-- Só dele, e por um critério estreito de propósito: o usuário cujo login é
-- exatamente `admin-<slug>` é o que o provisionamento cria, e o `tnt_email` do
-- tenant é o e-mail que aquela mesma pessoa informou ao pedir o teste. São a
-- mesma pessoa, e é a única correspondência que dá para afirmar sem adivinhar.
--
-- Os demais usuários ficam sem e-mail até alguém preencher na tela de Usuários.
-- Chutar aqui — herdar o e-mail da imobiliária para todo mundo, por exemplo —
-- mandaria o link de redefinir a senha do corretor para a caixa do dono.
UPDATE "tb_usuario" u
SET "usu_email" = t."email"
FROM "tb_tenants" t
WHERE u."tenant_id" = t."id"
  AND u."usu_login" = 'admin-' || t."slug"
  AND t."email" IS NOT NULL
  AND btrim(t."email") <> '';

-- Busca por e-mail na recuperação. Não é UNIQUE: a mesma pessoa pode ter acesso
-- a duas imobiliárias, com um login em cada.
CREATE INDEX "tb_usuario_usu_email_idx" ON "tb_usuario"("usu_email");
