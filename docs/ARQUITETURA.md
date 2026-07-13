# Arquitetura Domus — Visão × Realidade

Este documento cruza a **visão de arquitetura** (o alvo de longo prazo) com o
**estado atual do código**, registra as decisões tomadas e o que ainda falta.

> Decisão-base (2026-07-13): **manter banco único com `tenant_id` agora** e
> introduzir uma **camada de resolução de tenant** que permita migrar para
> schema/banco-por-tenant no futuro sem reescrever rotas. Ver
> [`tenantRegistry.js`](../apps/api/src/services/tenantRegistry.js).

---

## Mapa: visão × realidade

| Tema da visão | Hoje no código | Status |
|---|---|---|
| Multi-tenant | Banco único Postgres/Supabase, isolamento por coluna `tenant_id` | ⚠️ Diverge da visão (banco-por-tenant) — ver "Isolamento" |
| Banco global (metadados) | Mesmo banco; `tb_tenants`, `tb_super_admin` + campos de billing | 🟡 Conceito existe, físico não |
| Provisionamento automático | `provisioningService.provisionTenant()` (registro + licença + admin) | 🟡 Funciona; passos de "criar banco/estrutura" ficam como seam |
| Versionamento de schema | Prisma Migrate (baseline `0_init`) + `migrationService` expõe versão | 🟢 Adotado (falta aplicar baseline no banco — ver abaixo) |
| Autenticação centralizada | Login por `usu_login` global resolve o tenant internamente | 🟢 Não depende do nome da empresa |
| Serviços da plataforma | `provisioning`, `migration`, `health`, `notification`, `ai` | 🟡 IA e Health reais; resto é interface desacoplada |
| Health Service | `/health` real: DB `SELECT 1`, latência, versão do schema | 🟢 Implementado |
| Notification Service | Interface única (email/whatsapp/push/sms) — stubs | 🟡 Terreno pronto, provedores pendentes |
| Backup / Scheduler | Não existe | ❌ Roadmap |
| Publicação automatizada | `socialPublisher` + webhook Meta real + `PropertyPublication` | 🟢 Estrutura pronta; canais reais ainda stub |
| Inteligência Artificial | `aiService` (Gemini 2.5 Flash) — descrições, título, hashtags, posts, ads, e-mail | 🟢 Implementado e testado |
| ERP (módulos) | Imóveis, Clientes, Vendas, Cargos, Leads, TipoImóvel/Atributos | 🟢 Base; faltam Contratos, Agenda, Financeiro, Vistorias, Proprietários, Corretores |
| Site institucional | Não existe | ❌ Roadmap |
| Sites das imobiliárias | Vitrine pública por tenant (`/vitrine/:slug`) com editor | 🟢 Existe; falta domínio próprio/SEO/blog |

---

## Isolamento de dados (o ponto sensível)

A visão pede **banco por tenant sem `tenant_id`**. O código faz o oposto (banco
único, `tenant_id` em tudo). Migrar às cegas quebraria tudo, então adotamos um
**seam**: [`tenantRegistry.js`](../apps/api/src/services/tenantRegistry.js).

- Rotas/serviços devem obter o cliente de dados via `getTenantClient(tenant)` e
  os metadados via `getGlobalPrisma()` — **não** importando `db.js` direto.
- Hoje ambos devolvem o mesmo `PrismaClient`.
- Migração futura (schema-por-tenant ou banco-por-tenant): basta trocar a
  implementação dessas funções para resolver servidor/banco a partir do registro
  global. As rotas não mudam.

> Observação técnica: em Postgres/Prisma, o caminho realista antes de
> banco-físico-por-tenant é **schema-por-tenant** (um schema por imobiliária no
> mesmo servidor) ou **RLS**. "Banco físico por tenant" exige infra própria
> (não o Supabase padrão) e um Provisioning/Migration Service que crie e versione
> cada banco — está previsto nos TODOs de `provisioningService.js`.

---

## Camada de serviços (`apps/api/src/services/`)

| Arquivo | Papel | Estado |
|---|---|---|
| `tenantRegistry.js` | Resolve onde um tenant vive (seam multi-DB) | Real (shared-db) |
| `provisioningService.js` | Cria/configura tenant + admin + licença | Real |
| `migrationService.js` | Lê versão do schema (`_prisma_migrations`) | Real |
| `healthService.js` | Disponibilidade, latência, versão | Real |
| `notificationService.js` | Email/WhatsApp/Push/SMS (interface única) | Stub |
| `aiService.js` | Geração de conteúdo com Gemini 2.5 Flash | Real |
| `socialPublisher.js` | Fila de publicação social | Parcial (canais stub) |

---

## Inteligência Artificial

`aiService.js` usa a REST API do **Google Gemini 2.5 Flash** (via `fetch` nativo,
sem SDK). Configuração em `.env`: `GEMINI_API_KEY`, `GEMINI_MODEL`.

Tipos de conteúdo gerados a partir dos dados de um imóvel: `descricao`,
`descricaoResumida`, `descricaoSeo`, `titulo`, `hashtags`, `instagram`,
`facebook`, `whatsapp`, `linkedin`, `googleAds`, `emailMarketing`. Também há
`melhorarDescricao`.

**Endpoints:**
- `GET  /api/ai/tipos` — lista os tipos disponíveis (e se a IA está habilitada).
- `POST /api/ai/imovel/conteudo` — gera a partir de um imóvel (salvo **ou**
  rascunho no formulário). Body: `{ imovel, tipos? }`.
- `POST /api/ai/imovel/melhorar-descricao` — Body: `{ texto, imovel? }`.
- `POST /api/properties/:id/ai/gerar` — gera para um imóvel já salvo. Body: `{ tipos? }`.

Todos exigem `requireAuth` + `requireTenant` + permissão `gerenciarImoveis`.
Sem chave configurada, respondem `503`.

---

## Versionamento de schema (Prisma Migrate)

O projeto usava `prisma db push`. Adotamos **Prisma Migrate**; a tabela nativa
`_prisma_migrations` é a "SchemaVersion" oficial, exposta via `migrationService`
e no `/health`.

Foi gerada a migração baseline **`prisma/migrations/0_init`** (offline, a partir
do schema atual — não tocou no banco).

### Como aplicar o baseline (uma vez, por quem tem acesso ao banco)

O banco já existe (criado via `db push`). Para adotar migrations sem recriar
nada, **marque o baseline como já aplicado**:

```bash
cd apps/api
npm run prisma:migrate:status     # deve listar 0_init como "not applied"
npm run prisma:baseline           # prisma migrate resolve --applied 0_init
npm run prisma:migrate:status     # agora 0_init aparece como aplicado
```

Depois disso, novas alterações de schema seguem o fluxo normal:

```bash
npm run prisma:migrate            # prisma migrate dev  → cria nova migração
npm run prisma:migrate:deploy     # em produção
```

> ⚠️ **Não** rode `prisma migrate dev` antes do baseline: sem o `resolve`, o
> Prisma pode querer resetar o banco por achar que ele está fora de sincronia.

---

## Roadmap (o que ainda não existe)

- **Backup Service** e **Scheduler** (filas, tarefas agendadas, retenção).
- **Notification Service**: plugar provedores reais (e-mail, WhatsApp Business, push).
- **Publicação real** nos canais (hoje `publishToChannel` é stub).
- **Módulos ERP** faltantes: Contratos, Agenda, Financeiro, Vistorias,
  Proprietários, Corretores, Documentos, Chamados.
- **Site institucional** (planos, docs, blog, login central).
- **Domínio próprio + SEO + blog** para as vitrines dos tenants.
- **Migração de isolamento** (schema/banco-por-tenant) quando a escala pedir —
  trocar a implementação do `tenantRegistry`.
- **IA assistente** (pesquisa, atendimento, contratos, análise de documentos).
