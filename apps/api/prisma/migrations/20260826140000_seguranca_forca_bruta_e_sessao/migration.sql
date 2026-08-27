-- ── Força bruta: trava por CONTA, não só por IP ─────────────────────────────
-- O limite por IP não alcança o ataque que importa: mil máquinas tentando a
-- MESMA conta passam por ele, porque cada uma faz poucas tentativas.
ALTER TABLE "tb_usuario" ADD COLUMN "usu_tentativas_falhas" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "tb_usuario" ADD COLUMN "usu_bloqueado_ate" TIMESTAMP(3);

-- ── Sessão encerrada à mão ──────────────────────────────────────────────────
-- JWT é sem estado: o "sair" do painel só apagava o token do localStorage, e
-- quem tivesse copiado aquele texto continuava dentro por até sete dias.
-- Esta é a lista do que não vale mais, por SESSÃO (`jti`) e não por usuário —
-- sair no celular não pode derrubar o painel aberto no computador.
CREATE TABLE "tb_sessao_revogada" (
    "ses_id" TEXT NOT NULL,
    "usu_id" TEXT NOT NULL,
    "ses_jti" TEXT NOT NULL,
    "ses_expira_em" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tb_sessao_revogada_pkey" PRIMARY KEY ("ses_id")
);

CREATE UNIQUE INDEX "tb_sessao_revogada_usu_id_ses_jti_key"
    ON "tb_sessao_revogada"("usu_id", "ses_jti");

-- A faxina apaga o que já venceu: a tabela não cresce para sempre.
CREATE INDEX "tb_sessao_revogada_ses_expira_em_idx"
    ON "tb_sessao_revogada"("ses_expira_em");

ALTER TABLE "tb_sessao_revogada" ADD CONSTRAINT "tb_sessao_revogada_usu_id_fkey"
    FOREIGN KEY ("usu_id") REFERENCES "tb_usuario"("usu_id") ON DELETE CASCADE ON UPDATE CASCADE;
