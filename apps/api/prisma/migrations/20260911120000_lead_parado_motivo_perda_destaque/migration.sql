-- Três coisas que o dono da imobiliária pede e que o lead e o imóvel não
-- tinham onde guardar. Nenhuma coluna é exigida: tudo nasce com padrão ou nulo,
-- e nada muda para quem não mexer.

-- 1. Lead parado. Horas de silêncio a partir das quais um lead aberto é
--    considerado esquecido (regra em `services/leadsParados.js`), e a marca do
--    último aviso enviado — um por silêncio, não um por rodada.
ALTER TABLE "tb_tenants" ADD COLUMN "tnt_lead_parado_horas" INTEGER NOT NULL DEFAULT 48;
ALTER TABLE "PropertyLead" ADD COLUMN "lea_aviso_parado_em" TIMESTAMP(3);

-- 2. Motivo de perda. Sem ele o funil diz QUANTOS se perderam e nunca POR QUÊ.
ALTER TABLE "PropertyLead" ADD COLUMN "lea_motivo_perda" TEXT;

-- 3. Ordem na vitrine. A grade saía na ordem do banco (mais novo primeiro), e
--    a imobiliária não tinha como pôr o lançamento na frente. Posição nula é
--    "automático": zero seria uma posição, e todo imóvel nasceria em primeiro.
ALTER TABLE "Property" ADD COLUMN "prp_destaque" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Property" ADD COLUMN "prp_ordem_vitrine" INTEGER;
