-- Tipo de imóvel passa a pertencer a UMA imobiliária.
--
-- Mesmo problema que `tb_cargo` tinha: a tabela era global, e a tela de Tipos de
-- Imóvel expõe CRUD completo. Renomear "Apartamento" renomeava para todas as
-- imobiliárias; excluir excluía de todas.
--
-- É mais delicada que a do cargo por causa dos filhos. Um tipo carrega
-- `tb_modelo_atributo` (os campos daquele tipo), e cada imóvel guarda em
-- `tb_imovel_atributo` QUAIS desses atributos ele tem. Ao duplicar um tipo para
-- outra imobiliária é preciso duplicar os atributos E reapontar os valores já
-- preenchidos dos imóveis dela para as cópias — senão os imóveis continuariam
-- referenciando atributos de um tipo que agora é de outra empresa.
--
-- O PRINCÍPIO DO BACKFILL: ninguém pode sair desta migration com menos catálogo
-- do que tinha. Antes, todo tipo era visível para todo mundo; depois, cada
-- imobiliária precisa continuar enxergando os mesmos tipos — só que na cópia
-- dela. Um tipo já usado fica com quem o usa, e as demais recebem cópia.

-- ─── 1. Coluna nova, ainda permissiva ───────────────────────────────────────
ALTER TABLE "tb_tipo_imovel" ADD COLUMN "tenant_id" TEXT;

/* Quais linhas existiam ANTES de a migration começar a inserir. Sem essa foto,
   os laços abaixo passariam a enxergar as próprias cópias como material de
   origem e se multiplicariam a cada volta. */
CREATE TEMPORARY TABLE "_tipos_originais" ON COMMIT DROP AS
SELECT "tip_id", "tip_descricao" FROM "tb_tipo_imovel";

-- ─── 2. Dona provisória: a primeira imobiliária com imóvel daquele tipo ─────
UPDATE "tb_tipo_imovel" t
SET "tenant_id" = sub.tenant_id
FROM (
  SELECT "tip_id", MIN("tenantId") AS tenant_id
  FROM "Property"
  WHERE "tip_id" IS NOT NULL
  GROUP BY "tip_id"
) sub
WHERE t."tip_id" = sub."tip_id";

-- ─── 3. Tipo usado por MAIS DE UMA imobiliária vira uma cópia para cada ─────
DO $$
DECLARE
  par      RECORD;
  novo_tip INTEGER;
BEGIN
  FOR par IN
    SELECT DISTINCT p."tip_id" AS tipo_id, p."tenantId" AS tenant_id
    FROM "Property" p
    JOIN "tb_tipo_imovel" t ON t."tip_id" = p."tip_id"
    WHERE p."tip_id" IS NOT NULL
      AND p."tenantId" IS DISTINCT FROM t."tenant_id"
  LOOP
    INSERT INTO "tb_tipo_imovel" ("tenant_id", "tip_descricao", "tip_area_fields")
    SELECT par.tenant_id, "tip_descricao", "tip_area_fields"
    FROM "tb_tipo_imovel" WHERE "tip_id" = par.tipo_id
    RETURNING "tip_id" INTO novo_tip;

    INSERT INTO "tb_modelo_atributo" ("tip_id", "atr_descricao", "atr_grupo")
    SELECT novo_tip, "atr_descricao", "atr_grupo"
    FROM "tb_modelo_atributo" WHERE "tip_id" = par.tipo_id;

    UPDATE "Property"
    SET "tip_id" = novo_tip
    WHERE "tip_id" = par.tipo_id AND "tenantId" = par.tenant_id;

    /* Os valores já preenchidos acompanham. O casamento é por descrição +
       grupo, que é o que identifica um atributo dentro de um tipo;
       `IS NOT DISTINCT FROM` porque `atr_grupo` é anulável e `= NULL` nunca
       casa. Sem este passo os imóveis migrados manteriam atributos do tipo
       antigo — que a partir daqui é de outra imobiliária. */
    UPDATE "tb_imovel_atributo" ia
    SET "atr_id" = novo_atr."atr_id"
    FROM "tb_modelo_atributo" antigo, "tb_modelo_atributo" novo_atr, "Property" p
    WHERE ia."atr_id" = antigo."atr_id"
      AND antigo."tip_id" = par.tipo_id
      AND novo_atr."tip_id" = novo_tip
      AND novo_atr."atr_descricao" = antigo."atr_descricao"
      AND novo_atr."atr_grupo" IS NOT DISTINCT FROM antigo."atr_grupo"
      AND ia."property_id" = p."id"
      AND p."tip_id" = novo_tip;
  END LOOP;
END $$;

-- ─── 4. Todo mundo continua com o catálogo inteiro ──────────────────────────
-- O passo 2 deu dona a "Casa" e "Apartamento" (os únicos com imóvel). Sem este
-- passo, as OUTRAS imobiliárias sairiam sem os dois tipos mais comuns do
-- sistema — enxergavam ontem, não enxergariam amanhã. Aqui cada imobiliária
-- recebe cópia de todo tipo original que ainda não tenha, com os atributos.
DO $$
DECLARE
  orig     RECORD;
  t        RECORD;
  novo_tip INTEGER;
BEGIN
  FOR orig IN SELECT * FROM "_tipos_originais" LOOP
    FOR t IN SELECT "id" FROM "tb_tenants" LOOP
      CONTINUE WHEN EXISTS (
        SELECT 1 FROM "tb_tipo_imovel"
        WHERE "tenant_id" = t."id" AND "tip_descricao" = orig."tip_descricao"
      );

      INSERT INTO "tb_tipo_imovel" ("tenant_id", "tip_descricao", "tip_area_fields")
      SELECT t."id", "tip_descricao", "tip_area_fields"
      FROM "tb_tipo_imovel" WHERE "tip_id" = orig."tip_id"
      RETURNING "tip_id" INTO novo_tip;

      INSERT INTO "tb_modelo_atributo" ("tip_id", "atr_descricao", "atr_grupo")
      SELECT novo_tip, "atr_descricao", "atr_grupo"
      FROM "tb_modelo_atributo" WHERE "tip_id" = orig."tip_id";
    END LOOP;
  END LOOP;
END $$;

-- ─── 5. Sobrou o que ninguém usava ──────────────────────────────────────────
-- As linhas originais sem dona: todas as imobiliárias já receberam cópia no
-- passo 4, então estas não representam mais nada. Os atributos delas caem por
-- cascata (ModeloAtributo.onDelete).
DELETE FROM "tb_tipo_imovel" WHERE "tenant_id" IS NULL;

-- ─── 6. Agora sim, obrigatória ──────────────────────────────────────────────
ALTER TABLE "tb_tipo_imovel" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "tb_tipo_imovel"
  ADD CONSTRAINT "tb_tipo_imovel_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tb_tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "tb_tipo_imovel_tenant_id_idx" ON "tb_tipo_imovel"("tenant_id");
