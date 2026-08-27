-- O padrao de `acessar_painel` passa de false para true.
--
-- Ela e a porta do Hub e nao e escolha de ninguem: `alcancaOHub`
-- (services/cargosPadrao.js) a deriva a cada gravacao. Linha criada FORA desses
-- caminhos — um seed, um script, um teste — pegava o padrao da coluna, e com
-- `false` isso significava um cargo trancado para fora do painel.
--
-- O padrao de uma coluna tem de ser o desfecho inofensivo. Quem restringe e a
-- regra, explicitamente, para o caso que a merece: o cargo so-Flow.
ALTER TABLE "tb_cargo" ALTER COLUMN "acessar_painel" SET DEFAULT true;
