-- Telas centradas ou em largura total, por pessoa (aba "Painel" das
-- Configurações). Nulo = "nunca escolhi": vale o automático, que centra só em
-- monitor largo. Sem DEFAULT de propósito — um padrão gravado apagaria a
-- diferença entre "escolheu largura total" e "nunca escolheu".
ALTER TABLE "tb_usuario" ADD COLUMN "usu_layout_centrado" BOOLEAN;
