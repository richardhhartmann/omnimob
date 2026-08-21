-- Conta Google vinculada ao usuário.
-- `usu_google_id` é o `sub` do token do Google: imutável e único por conta.
-- É por ele que o login casa — nunca pelo e-mail, que é reatribuível.
ALTER TABLE "tb_usuario" ADD COLUMN "usu_google_id" TEXT;
ALTER TABLE "tb_usuario" ADD COLUMN "usu_google_email" TEXT;
ALTER TABLE "tb_usuario" ADD COLUMN "usu_google_foto" TEXT;
ALTER TABLE "tb_usuario" ADD COLUMN "usu_google_vinculado_em" TIMESTAMP(3);

-- Único para que duas pessoas não apontem para a mesma conta Google e acabem
-- dividindo sessão. NULL não conflita, então quem não vinculou fica de fora.
CREATE UNIQUE INDEX "tb_usuario_usu_google_id_key" ON "tb_usuario"("usu_google_id");
