-- ── `acessar_painel` estava FALSE em cargos que alcançam o Hub ───────────────
--
-- Ela é a porta do Hub, o par de `acessar_flow`. Nunca foi uma escolha da tela:
-- era CRAVADA `true` em dois lugares independentes (a rota de cargos, a cada
-- gravação, e o login, ao montar a sessão). Com os dois cravando, o valor da
-- coluna nunca era lido — e por isso ninguém notou que ele estava errado.
--
-- Errado onde: no PROVISIONAMENTO. `dadosDoCargo` monta o cargo percorrendo
-- `PERMISSOES`, e `acessar_painel` não está nessa lista; com `@default(false)`
-- no schema, todo cargo de imobiliária nova nascia com a porta do Hub fechada.
-- Metade dos cargos deste banco está assim.
--
-- No momento em que a sessão passou a LER a coluna — para que cargo só-Flow
-- pudesse existir de verdade — o dado torto virou sintoma: entrar e cair na
-- vitrine, ou entrar e ver só o Flow numa conta que tem os dois módulos.
--
-- Esta migração aplica a mesma regra de `alcancaOHub` (services/cargosPadrao.js)
-- sobre o que já está gravado. Ela só LIGA a permissão, nunca desliga: um cargo
-- que hoje entra no Hub continua entrando, aconteça o que acontecer.
UPDATE "tb_cargo"
SET "acessar_painel" = true
WHERE "acessar_painel" = false
  AND (
    -- Não alcança o Flow: só resta o Hub. Inclui o cargo em branco, que não é
    -- "só-Flow" e não pode ficar trancado para fora de tudo.
    NOT (
      "acessar_flow" OR "gerenciar_negocios" OR "gerenciar_contratos"
      OR "validar_juridico" OR "validar_financeiro" OR "ver_comissoes"
      OR "gerenciar_captacao"
    )
    OR
    -- Alcança o Flow, mas também tem trabalho no Hub.
    (
      "editar_pagina" OR "gerenciar_imoveis" OR "gerenciar_usuarios"
      OR "gerenciar_clientes" OR "gerenciar_cargos" OR "ver_configuracoes"
      OR "ver_relatorios" OR "ver_auditoria" OR "publicar_redes"
      OR "ver_painel_gestor"
    )
  );
