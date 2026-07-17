-- Um imóvel pode ter vários posts na mesma rede social.
-- Troca o índice ÚNICO (propertyId, channel) por um índice comum.
DROP INDEX "PropertyPublication_propertyId_channel_key";

CREATE INDEX "PropertyPublication_propertyId_channel_idx" ON "PropertyPublication"("propertyId", "channel");
