-- ─── O role restrito da PLATAFORMA ────────────────────────────────────────────
--
-- Rode UMA vez no SQL Editor do Supabase de PRODUÇÃO.
--
-- Por quê: com `PLATAFORMA_DATABASE_URL`, o .env de cada dev passa a apontar
-- para o banco de produção (ver "Sobre o banco da PLATAFORMA" no CLAUDE.md).
-- Com a credencial principal, esse .env alcançaria todos os imóveis, leads e
-- clientes de todas as imobiliárias. Este role só enxerga as três tabelas de
-- que o super-admin precisa — vazou, o estrago fica nelas.
--
-- O que a API faz com cada tabela (é exatamente o que se concede aqui):
--   tb_super_admin        lê no login e em cada requisição; grava TOTP, senha,
--                         cargo, ativo; cria e apaga usuários da Omnimob
--   tb_cargo_super_admin  idem, para os cargos (id é SERIAL → a sequência)
--   tb_auditoria          só INSERE: a trilha de quem mexeu em super-admin.
--                         A extensão lê a linha antes de um delete, mas isso é
--                         nas duas tabelas acima, não aqui
--
-- Migração que crie coluna nova nessas tabelas é aplicada pelo deploy, com a
-- credencial principal; o role restrito não precisa de DDL nenhum.

-- 1. Troque a senha antes de rodar. Longa e gerada, não reaproveitada.
CREATE ROLE omnimob_plataforma LOGIN PASSWORD 'TROQUE-ESTA-SENHA';

-- 2. Chegar até as tabelas.
GRANT CONNECT ON DATABASE postgres TO omnimob_plataforma;
GRANT USAGE ON SCHEMA public TO omnimob_plataforma;

-- 3. As três tabelas, e só o que cada uma pede.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tb_super_admin       TO omnimob_plataforma;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tb_cargo_super_admin TO omnimob_plataforma;
GRANT SELECT, INSERT                 ON public.tb_auditoria         TO omnimob_plataforma;

-- 4. O id do cargo é SERIAL; sem a sequência, criar cargo falha em silêncio
--    de permissão. As outras duas usam cuid (gerado pelo Prisma, sem sequência).
GRANT USAGE, SELECT ON SEQUENCE public."tb_cargo_super_admin_id_seq" TO omnimob_plataforma;

-- 5. Conferência: tudo que NÃO está acima tem que recusar.
--    Esperado: "permission denied for table tb_property" (ou equivalente).
--    SET ROLE omnimob_plataforma; SELECT count(*) FROM public.tb_property; RESET ROLE;

-- ─── A URL que vai no .env dos devs ───────────────────────────────────────────
--
-- Pelo pooler do Supabase o usuário leva o ref do projeto no nome:
--
--   PLATAFORMA_DATABASE_URL=postgresql://omnimob_plataforma.<PROJECT_REF>:<SENHA>@<HOST-DO-POOLER>:6543/postgres?pgbouncer=true
--
-- (o host e o ref são os mesmos da DATABASE_URL de produção; só usuário e senha
-- mudam). Para revogar o acesso de alguém que saiu da equipe, troque a senha:
--   ALTER ROLE omnimob_plataforma PASSWORD '...';
-- — e é para isso que a senha deveria viver num cofre (Infisical/Doppler), e
-- não num arquivo passado de mão em mão.
