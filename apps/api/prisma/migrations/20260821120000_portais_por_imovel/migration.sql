-- Quais portais recebem cada imóvel. Antes era um interruptor só
-- (`prp_publicar_portais`), e os três — ZAP, VivaReal e OLX — andavam juntos.
--
-- O padrão é a lista VAZIA, e não os três nomes: vazio com o mestre ligado
-- significa "todos" na leitura (ver `services/portais.js`). Gravar os três em
-- cada linha existente diria que a imobiliária ESCOLHEU os três, quando ela
-- nunca teve a escolha — e a diferença aparece no dia em que um portal novo
-- entrar na lista.
ALTER TABLE "Property" ADD COLUMN "prp_portais" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
