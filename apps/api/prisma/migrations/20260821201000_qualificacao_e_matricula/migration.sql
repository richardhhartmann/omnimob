-- A qualificacao das partes e a matricula do imovel.
--
-- Nacionalidade, estado civil e profissao sao o que a lei chama de qualificacao
-- das partes; matricula e o identificador legal do imovel no cartorio. Nenhuma
-- minuta de compra e venda existe sem as quatro.
--
-- Elas entram com o Omnimob Flow porque e ele que gera contrato. O Hub nao
-- precisava delas: quem so anuncia cadastra cliente com nome e telefone. Sem
-- estas colunas o motor de minutas teria quatro marcadores permanentemente em
-- pendencia, e a imobiliaria completaria a mao justamente o documento que menos
-- admite preenchimento a mao.
--
-- Todas anulaveis: o cadastro que ja existe continua valido, e a tela do Flow
-- aponta o que falta negocio a negocio, em vez de uma migracao exigir que
-- alguem preencha profissao de dez mil clientes antes de o sistema voltar.
ALTER TABLE "Property" ADD COLUMN "prp_matricula" TEXT;

ALTER TABLE "tb_cliente" ADD COLUMN "clt_numero" TEXT,
                         ADD COLUMN "clt_nacionalidade" TEXT,
                         ADD COLUMN "clt_estado_civil" TEXT,
                         ADD COLUMN "clt_profissao" TEXT;
