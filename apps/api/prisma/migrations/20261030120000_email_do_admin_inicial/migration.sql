-- O administrador inicial passa a ter o e-mail de quem pediu a conta.
--
-- O provisionamento criava `admin-<slug>` SEM e-mail: o endereço ficava só no
-- tenant. Resultado: o "esqueci a senha" desse usuário respondia "enviamos" e
-- não mandava nada, porque não havia para onde. O código novo grava o e-mail
-- ao criar; isto conserta as contas que já existem.
--
-- Só toca quem está sem e-mail e tem o login que o provisionamento gera
-- (`admin-<slug>`, cortado em 60). Um e-mail já preenchido nunca é trocado.
UPDATE "tb_usuario" AS u
SET "usu_email" = lower(trim(t."email"))
FROM "tb_tenants" AS t
WHERE u."tenant_id" = t."id"
  AND coalesce(u."usu_email", '') = ''
  AND u."usu_login" = left('admin-' || t."slug", 60)
  AND trim(t."email") <> '';
