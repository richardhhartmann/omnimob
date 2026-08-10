# Arquitetura Omnimob — Visão × Realidade

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
- **WhatsApp Business (Cloud API)** — contatos elegíveis (opt-in), broadcast por
  template ao publicar/compartilhar imóvel e chatbot próprio da imobiliária
  (Premium). Plano detalhado na seção [WhatsApp Business](#whatsapp-business-cloud-api--roadmap).
- **Publicação real** nos canais (hoje `publishToChannel` é stub).
- **Módulos ERP** faltantes: Contratos, Agenda, Financeiro, Vistorias,
  Proprietários, Corretores, Documentos, Chamados.
- **Site institucional** (planos, docs, blog, login central).
- **Domínio próprio + SEO + blog** para as vitrines dos tenants.
- **Migração de isolamento** (schema/banco-por-tenant) quando a escala pedir —
  trocar a implementação do `tenantRegistry`.
- **IA assistente** (pesquisa, atendimento, contratos, análise de documentos).

---

## WhatsApp Business (Cloud API) — roadmap

Evolução do compartilhamento atual (deep-link `wa.me`/Web Share, que só abre o
WhatsApp do próprio usuário) para **envio programático** via **WhatsApp Business
Platform (Cloud API)** da Meta. Cobre três ideias: **contatos elegíveis**,
**broadcast por template** e **chatbot próprio** da imobiliária.

### Restrições que moldam o desenho

- **Não** dá para enviar automaticamente pelo `wa.me`; só a **Cloud API** envia.
- Exige **número dedicado** à API, **WABA** + Meta Business verificado.
- Mensagem iniciada pela empresa exige **template aprovado** + **opt-in** do
  contato. Enviar sem opt-in derruba o número (qualidade/ban).
- **Custo por conversa/mensagem** (templates de marketing são pagos).
- Resposta livre (sem template) só na **janela de 24h** após o cliente escrever.
- **Status/Stories não têm API oficial** → auto-post no Status está **fora**.

### Fases

**Fase 0 — Registrar compartilhamentos** (barata, sem Meta)
- Modelo `PropertyShare` (tenantId, propertyId, usuarioId?, canal, createdAt).
- O `handleWhatsApp` (PropertyForm/DivulgarModal) grava o evento ao compartilhar.
- Habilita métricas ("imóveis mais compartilhados") e integrações futuras.

**Fase 1 — Contatos elegíveis** ✅ *em implementação* (sem Meta ainda)
- Reaproveita `Cliente` (já tem `whatsapp` e `ativo`). Novos campos:
  `aceitaDivulgacao Boolean @default(false)` e `divulgacaoOptInAt DateTime?`.
- UI dentro de [`ClientesPage.jsx`](../apps/web/src/pages/ClientesPage.jsx):
  toggle "Recebe divulgações", chip indicador na lista, aba de filtro e stat.
- É só a **base da lista** (quem opta por receber). O envio real vem na Fase 3.

**Fase 2 — Infra Cloud API** (por tenant)
- Onboarding da WABA e credenciais por tenant (`phoneNumberId`, `wabaId`,
  `accessToken` cifrado, `verifyToken`), num modelo `WhatsappAccount`.
- Templates aprovados na Meta; envio encapsulado no `notificationService`
  (canal `whatsapp`, hoje stub) reusando o seam já existente.
- Gate por plano (Profissional+/Premium, via `planoLibera*`).

**Fase 3 — Broadcast por template**
- Ao publicar/compartilhar um imóvel, dispara o template para os contatos
  **elegíveis** (Fase 1, com opt-in válido).
- Log em `WhatsappBroadcast` + `WhatsappBroadcastRecipient` (status
  QUEUED/SENT/DELIVERED/READ/FAILED, messageId, erro). Respeitar rate limits e
  custo; usar fila/Scheduler.

**Fase 4 — Chatbot da imobiliária (Premium)**
- Inbound pelo webhook que já existe (`/api/social/webhook`), roteando por
  `phone_number_id` → tenant.
- Resposta gerada pelo `aiService` (Gemini) consultando os imóveis `ACTIVE` do
  tenant: busca por filtros, envia fotos/link da vitrine, captura `PropertyLead`
  automaticamente. Opera na janela de 24h (inbound iniciado pelo cliente).
- Estado de conversa em `WhatsappConversation`/`WhatsappMessage`. Gate Premium.

### Esboço de modelo de dados (Prisma, planejado)

```
Cliente            + aceitaDivulgacao Boolean @default(false)
                   + divulgacaoOptInAt DateTime?
PropertyShare      { id, tenantId, propertyId, usuarioId?, canal, createdAt }
WhatsappAccount    { id, tenantId @unique, phoneNumberId, wabaId,
                     accessToken (cifrado), verifyToken, ativo }
WhatsappBroadcast  { id, tenantId, propertyId?, templateName, criadoPor, createdAt }
WhatsappBroadcastRecipient { id, broadcastId, clienteId, status, messageId?, erro? }
WhatsappConversation { id, tenantId, waId, clienteId?, ultimaMsgAt }
WhatsappMessage    { id, conversationId, direcao, corpo, waMessageId?, createdAt }
```

### Dependências e ordem sugerida

Fases 0 e 1 são baratas e independentes da Meta (0 = métricas; 1 = base da
lista). Fases 3 e 4 dependem da Fase 2 (credenciais + templates). Transversais:
**gate por plano**, **segredos por tenant cifrados** e **conformidade LGPD/opt-in**.
