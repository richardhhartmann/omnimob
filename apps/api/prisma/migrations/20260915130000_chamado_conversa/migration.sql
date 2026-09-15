-- Central de suporte para o cliente: a conversa dentro do chamado.
--
-- O cliente abria o chamado e o super-admin o resolvia, e entre os dois não
-- havia nada — `resolvido` era um booleano, sem mensagem nenhuma. Entra o fio
-- de mensagens e um status com quatro paradas.

-- 1. O status. `resolvido` continua na tabela como coluna DERIVADA (regravada
--    a cada mudança); quem já estava resolvido nasce RESOLVIDO, o resto ABERTO.
CREATE TYPE "ChamadoStatus" AS ENUM ('ABERTO', 'EM_ATENDIMENTO', 'AGUARDANDO_CLIENTE', 'RESOLVIDO');

ALTER TABLE "tb_chamado" ADD COLUMN "cha_status" "ChamadoStatus" NOT NULL DEFAULT 'ABERTO';

UPDATE "tb_chamado" SET "cha_status" = 'RESOLVIDO' WHERE "cha_resolvido" = true;

-- 2. A conversa. Cliente e suporte no mesmo fio; SISTEMA é o que o sistema
--    anota sozinho ("Resolvido por …") e não gera e-mail.
CREATE TYPE "ChamadoAutor" AS ENUM ('CLIENTE', 'SUPORTE', 'SISTEMA');

CREATE TABLE "tb_chamado_mensagem" (
    "chm_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "cha_numero" INTEGER NOT NULL,
    "chm_autor_tipo" "ChamadoAutor" NOT NULL,
    "chm_autor_nome" TEXT NOT NULL,
    "chm_texto" TEXT NOT NULL,
    "chm_prints" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tb_chamado_mensagem_pkey" PRIMARY KEY ("chm_id")
);

CREATE INDEX "tb_chamado_mensagem_tenant_id_cha_numero_created_at_idx"
    ON "tb_chamado_mensagem"("tenant_id", "cha_numero", "created_at");

-- Sai o chamado, sai a conversa.
ALTER TABLE "tb_chamado_mensagem" ADD CONSTRAINT "tb_chamado_mensagem_cha_numero_fkey"
    FOREIGN KEY ("cha_numero") REFERENCES "tb_chamado"("cha_numero") ON DELETE CASCADE ON UPDATE CASCADE;
