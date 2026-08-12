-- Cargo passa a pertencer a UMA imobiliária, e ganha a permissão ver_configuracoes.
--
-- O problema que esta migration corrige: `tb_cargo` nasceu sem `tenant_id`. Na
-- prática a tabela era global — a linha "Administrador" era a mesma para todas
-- as imobiliárias, e editar as permissões de um cargo numa mudava para todas.
--
-- O backfill NÃO é um simples UPDATE, e é por isso que ele é longo: um cargo
-- usado por três imobiliárias precisa virar TRÊS cargos, um por dona, com os
-- usuários de cada uma repontados para a cópia certa. Fazer o UPDATE direto
-- escolheria uma dona e faria as outras duas perderem o cargo dos seus usuários.

-- ─── 1. Colunas novas, ainda permissivas ────────────────────────────────────
ALTER TABLE "tb_cargo" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "tb_cargo" ADD COLUMN "ver_configuracoes" BOOLEAN NOT NULL DEFAULT false;

-- ─── 2. Dona provisória: a primeira imobiliária que usa o cargo ─────────────
-- MIN() só para o critério ser determinístico. Qual delas fica com a linha
-- original não importa, porque o passo 3 dá cópia própria a todas as outras.
UPDATE "tb_cargo" c
SET "tenant_id" = sub.tenant_id
FROM (
  SELECT "crg_codigo", MIN("tenant_id") AS tenant_id
  FROM "tb_usuario"
  GROUP BY "crg_codigo"
) sub
WHERE c."crg_codigo" = sub."crg_codigo";

-- ─── 3. Cargo compartilhado vira uma cópia por imobiliária ──────────────────
DO $$
DECLARE
  par     RECORD;
  novo_id INTEGER;
BEGIN
  FOR par IN
    SELECT DISTINCT u."crg_codigo" AS cargo_id, u."tenant_id" AS tenant_id
    FROM "tb_usuario" u
    JOIN "tb_cargo" c ON c."crg_codigo" = u."crg_codigo"
    WHERE u."tenant_id" IS DISTINCT FROM c."tenant_id"
  LOOP
    INSERT INTO "tb_cargo" (
      "tenant_id", "crg_descricao", "acessar_painel", "editar_pagina",
      "gerenciar_imoveis", "gerenciar_leads", "gerenciar_usuarios",
      "gerenciar_clientes", "gerenciar_cargos", "ver_configuracoes",
      "ver_relatorios", "publicar_redes"
    )
    SELECT
      par.tenant_id, "crg_descricao", "acessar_painel", "editar_pagina",
      "gerenciar_imoveis", "gerenciar_leads", "gerenciar_usuarios",
      "gerenciar_clientes", "gerenciar_cargos", "ver_configuracoes",
      "ver_relatorios", "publicar_redes"
    FROM "tb_cargo"
    WHERE "crg_codigo" = par.cargo_id
    RETURNING "crg_codigo" INTO novo_id;

    UPDATE "tb_usuario"
    SET "crg_codigo" = novo_id
    WHERE "crg_codigo" = par.cargo_id AND "tenant_id" = par.tenant_id;
  END LOOP;
END $$;

-- ─── 4. Cargos sem nenhum usuário ───────────────────────────────────────────
-- São os modelos que vieram do seed e ninguém usou ainda ("Consulta (Somente
-- Leitura)", por exemplo). Sem usuário não há como deduzir a dona, e apagá-los
-- tiraria de todas as imobiliárias um cargo que elas podem querer usar — então
-- cada uma recebe a sua cópia e a linha órfã sai.
DO $$
DECLARE
  orfao RECORD;
  t     RECORD;
BEGIN
  FOR orfao IN SELECT * FROM "tb_cargo" WHERE "tenant_id" IS NULL LOOP
    FOR t IN SELECT "id" FROM "tb_tenants" LOOP
      INSERT INTO "tb_cargo" (
        "tenant_id", "crg_descricao", "acessar_painel", "editar_pagina",
        "gerenciar_imoveis", "gerenciar_leads", "gerenciar_usuarios",
        "gerenciar_clientes", "gerenciar_cargos", "ver_configuracoes",
        "ver_relatorios", "publicar_redes"
      ) VALUES (
        t."id", orfao."crg_descricao", orfao."acessar_painel", orfao."editar_pagina",
        orfao."gerenciar_imoveis", orfao."gerenciar_leads", orfao."gerenciar_usuarios",
        orfao."gerenciar_clientes", orfao."gerenciar_cargos", orfao."ver_configuracoes",
        orfao."ver_relatorios", orfao."publicar_redes"
      );
    END LOOP;
    DELETE FROM "tb_cargo" WHERE "crg_codigo" = orfao."crg_codigo";
  END LOOP;
END $$;

-- ─── 5. Agora sim, obrigatória ──────────────────────────────────────────────
ALTER TABLE "tb_cargo" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "tb_cargo"
  ADD CONSTRAINT "tb_cargo_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tb_tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "tb_cargo_tenant_id_idx" ON "tb_cargo"("tenant_id");

-- ─── 6. O Administrador já nasce com as duas ────────────────────────────────
-- Configurações e Cargos são as chaves da casa: quem administra precisa delas,
-- e ninguém mais recebe por padrão.
UPDATE "tb_cargo"
SET "ver_configuracoes" = true, "gerenciar_cargos" = true
WHERE "crg_descricao" = 'Administrador';
