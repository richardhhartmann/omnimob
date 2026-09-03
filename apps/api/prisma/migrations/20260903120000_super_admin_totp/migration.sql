-- Segundo fator do super-admin (TOTP, aplicativo autenticador).
--
-- A senha desta conta já era hash; o que hash não resolve é a senha certa nas
-- mãos erradas. E o alvo justifica: quem entra neste painel vê todas as
-- imobiliárias, entra na conta de qualquer cliente e mexe em cobrança.
--
-- Todas as colunas nascem nulas e nada passa a ser exigido por esta migração:
-- quem não ativar o segundo fator continua entrando só com a senha. É de
-- propósito — uma migração que ligasse a exigência trancaria o dono da
-- plataforma para fora no deploy.

-- A chave do TOTP, cifrada pelo cofre (AES-256-GCM). Em texto puro ela vale o
-- mesmo que a senha: quem a lê gera códigos válidos para sempre.
ALTER TABLE "tb_super_admin" ADD COLUMN "totpSegredo" TEXT;

-- Separado do segredo: entre gerar a chave e provar que o aplicativo a leu há
-- um intervalo, e nele o login não pode exigir um código que ainda não existe.
ALTER TABLE "tb_super_admin" ADD COLUMN "totpAtivadoEm" TIMESTAMP(3);

-- Anti-reuso. O código vale 30 segundos e, sem guardar o último passo aceito,
-- ele entra quantas vezes for apresentado dentro deles.
ALTER TABLE "tb_super_admin" ADD COLUMN "totpUltimoPasso" INTEGER;

-- Os códigos de uso único, em HASH (SHA-256) — mesma regra das chaves de API.
ALTER TABLE "tb_super_admin" ADD COLUMN "totpRecuperacao" TEXT;
