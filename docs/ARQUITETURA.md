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
| Versionamento de schema | Prisma Migrate; baseline `0_init` **aplicado**, 10 migrações | 🟢 Em uso |
| Autenticação centralizada | Login por `usu_login` global resolve o tenant internamente | 🟢 Não depende do nome da empresa |
| Serviços da plataforma | 11 serviços em `src/services/` — ver tabela abaixo | 🟢 Maioria real; WhatsApp/push/SMS ainda stub |
| Health Service | `/health`: DB, latência, versão do schema, **commit em execução** | 🟢 Implementado |
| Notification Service | **E-mail real** (SMTP/Resend, com diagnóstico). WhatsApp/push/SMS stub | 🟡 Um canal pronto, três pendentes |
| **Cobrança / assinaturas** | **Stripe**: `pagamentoService`, webhook, 3 planos, gate por plano | 🟢 Implementado |
| **Ciclo de vida do teste** | `trialService`: convite, expiração, avisos, faxina, slugs reservados | 🟢 Implementado |
| Scheduler | `faxinaScheduler` (`setInterval`, ligado por `FAXINA_AUTOMATICA`) | 🟡 Simples; sem fila nem cron distribuído |
| Backup | Não existe | ❌ Roadmap |
| Publicação automatizada | **Graph API real** (Facebook + Instagram) em `socialRoutes` + webhook Meta + `PropertyPublication` + reconciliação | 🟢 Implementado |
| Inteligência Artificial | `aiService` (Gemini 2.5 Flash) — descrições, título, hashtags, posts, ads, e-mail | 🟢 Implementado e testado |
| ERP (módulos) | Imóveis, Clientes, Vendas, Cargos, Leads, TipoImóvel/Atributos, **Chamados**, Tutoriais | 🟢 Base; faltam Contratos, Agenda, Financeiro, Vistorias, Proprietários, Corretores |
| Site institucional | Não existe | ❌ Roadmap |
| Sites das imobiliárias | Vitrine pública por tenant (`/vitrine/:slug`) com editor; **SEO técnico feito** | 🟡 Falta domínio próprio e blog |

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
| `healthService.js` | Disponibilidade, latência, versão, commit, diagnóstico do banco | Real |
| `notificationService.js` | E-mail (Resend/SMTP) + WhatsApp/Push/SMS na mesma interface | E-mail real; resto stub |
| `emailLayout.js` / `emailTemplates.js` | Layout e conteúdo dos e-mails transacionais | Real |
| `pagamentoService.js` | Stripe: assinatura, cancelamento, preços por plano | Real |
| `trialService.js` | Teste grátis: convite, expiração, faxina, slugs reservados | Real |
| `faxinaScheduler.js` | Dispara a faxina periodicamente (`FAXINA_AUTOMATICA=true`) | Real (simples) |
| `aiService.js` | Geração de conteúdo com Gemini 2.5 Flash | Real |

> Havia um `socialPublisher.js` com `enqueuePropertyPublication()`, que marcava
> as publicações como `PUBLISHED` após um `setTimeout` de 80 ms, sem publicar
> nada. **Foi removido**: ninguém o importava, e a publicação de verdade sempre
> esteve em `socialRoutes.js`. Ele sobrevivia como armadilha — bastava alguém
> ligá-lo para o sistema passar a mentir sobre publicações. O único rastro são
> refs no formato `facebook-<id>` gravadas antes, e o `isRealMetaRef()` em
> `socialRoutes.js` existe justamente para ignorá-las na reconciliação.

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

## Cobrança e assinaturas (Stripe)

`pagamentoService.js` + `stripeWebhookRoutes.js`. O webhook é montado **antes**
do `express.json()`, com corpo cru (`express.raw`), porque a assinatura do
Stripe é calculada sobre os bytes originais — se o body for parseado antes, a
validação falha sem explicação óbvia.

- Três planos (`BASICO`, `PROFISSIONAL`, `PREMIUM`), com preço vindo do Stripe
  e um mapa de reserva em `planos.js` para a landing não ficar vazia enquanto a
  resposta não chega.
- IDs de preço lidos com alias (`STRIPE_PRICE_BASICO` **ou** `STRIPE_PRICE_BASIC`).
- Gate por plano em `planoLibera*` — redes sociais a partir do Profissional,
  tour 360° e IA conforme o plano.
- Excluir tenant no super-admin cancela a assinatura no Stripe **antes** de
  apagar a linha; falha no Stripe não bloqueia a exclusão (ver `adminRoutes.js`).

---

## Notificações

Interface única para e-mail, WhatsApp, push e SMS. **Só o e-mail é real**; os
outros três registram no log e devolvem o envelope.

O e-mail tem dois transportes, nesta ordem: **Resend** (HTTPS) quando
`RESEND_API_KEY` existe, e **SMTP** (nodemailer) caso contrário. Teto de 10 s
por tentativa nos dois.

> **Lição que custou caro:** o SMTP falhava em produção com `Connection timeout`
> e a conclusão natural — "a hospedagem bloqueia SMTP" — estava errada. O
> `smtp.hostinger.com` publica registro AAAA (IPv6) além do A, o nodemailer
> escolhe a família olhando as interfaces de rede da máquina, e o container
> tinha interface IPv6 **sem rota**. O socket morria em `ENETUNREACH`. Por isso
> `getTransporter()` resolve o registro A na mão e passa `servername` para o TLS
> continuar validando pelo nome. Sem os timeouts explícitos, esse erro ficava
> escondido atrás de dois minutos de espera.

Como o fluxo do teste grátis engole a falha de propósito (registra o link no log
e devolve 202), o envio quebrado é invisível. Daí existir
`GET /api/admin/diagnostico/email`: conecta e autentica **sem enviar nada**.

---

## Diagnóstico

Dois endpoints atrás do super-admin, criados porque as falhas mais caras do
projeto foram as silenciosas:

| Endpoint | Responde |
|---|---|
| `GET /api/admin/diagnostico/email` | O servidor consegue enviar e-mail? Qual transporte? |
| `GET /api/admin/diagnostico/banco` | Onde o tempo do banco é gasto: DNS, TCP e consulta, separados |

O `/health` expõe o **commit em execução** (`RENDER_GIT_COMMIT`). Isso existe
porque "meu código já subiu?" não tinha resposta de fora: o Render republica o
mesmo commit a cada mudança de variável de ambiente, então o log dizia "deploy
concluído" enquanto o código seguia velho.

O diagnóstico do banco separa **distância** de **overhead do pooler** — dois
diagnósticos opostos que produzem o mesmo sintoma (consulta lenta) e pedem
soluções opostas (mudar de região × mudar a conexão).

---

## Versionamento de schema (Prisma Migrate)

O projeto usava `prisma db push`. Adotamos **Prisma Migrate**; a tabela nativa
`_prisma_migrations` é a "SchemaVersion" oficial, exposta via `migrationService`
e no `/health`.

O baseline `prisma/migrations/0_init` **já foi aplicado**. Hoje são 10 migrações
e o schema está em dia nos dois ambientes.

```bash
cd apps/api
npm run prisma:migrate            # dev  → cria e aplica nova migração
npm run prisma:migrate:deploy     # produção → aplica o que foi commitado
npm run prisma:migrate:status     # confere
```

> **Ambientes separados.** Desenvolvimento e produção usavam o **mesmo** banco,
> o que fazia `migrate dev`, `seed --dev` e `faxina --aplicar` locais atingirem
> produção — a faxina, em particular, apaga tenants em cascata. Hoje são dois
> projetos Supabase distintos; o `.env` local aponta para o de desenvolvimento e
> o Render para o de produção. O `migrate deploy` em produção segue manual.

---

## Roadmap (o que ainda não existe)

- **Backup Service** (retenção, restauração). O scheduler existe em versão
  simples (`faxinaScheduler`); falta fila e cron distribuído.
- **Notification Service**: plugar WhatsApp, push e SMS (o e-mail já é real).
- **WhatsApp Business (Cloud API)** — broadcast por template e chatbot próprio
  (Premium). Plano detalhado na seção [WhatsApp Business](#whatsapp-business-cloud-api--roadmap).
- **Módulos ERP** faltantes: Contratos, Agenda, Financeiro, Vistorias,
  Proprietários, Corretores, Documentos.
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

**Fase 1 — Contatos elegíveis** ✅ **concluída** (sem Meta ainda)
- Reaproveita `Cliente` (já tem `whatsapp` e `ativo`). Campos `aceitaDivulgacao`
  e `divulgacaoOptInAt` no schema, com índice `[tenantId, aceitaDivulgacao]`.
- UI em [`ClientesPage.jsx`](../apps/web/src/pages/ClientesPage.jsx): toggle
  "Recebe divulgações", chip na lista, aba de filtro e stat.
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
