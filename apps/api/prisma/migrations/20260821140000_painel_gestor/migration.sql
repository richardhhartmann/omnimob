-- Acesso ao Painel do Gestor (a tela "/"), separado de `acessar_painel`.
--
-- O DEFAULT false vale inclusive para os cargos que já existem, e é o ponto:
-- a tela mostra faturamento, comissão e desempenho individual da equipe. Ligar
-- para quem já tinha "acessar painel" entregaria isso a todo corretor da base
-- no instante do deploy, sem ninguém ter decidido nada.
ALTER TABLE "tb_cargo" ADD COLUMN "ver_painel_gestor" BOOLEAN NOT NULL DEFAULT false;
