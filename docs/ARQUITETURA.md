# Arquitetura Omnimob — Visão × Realidade

Este documento cruza a **visão de arquitetura** (o alvo de longo prazo) com o
**estado atual do código**, registra as decisões tomadas e o que ainda falta.

> Decisão-base (2026-07-13): **manter banco único com `tenant_id` agora** e
> introduzir uma **camada de resolução de tenant** que permita migrar para
> schema/banco-por-tenant no futuro sem reescrever rotas. Ver
> [`tenantRegistry.js`](../apps/api/src/services/tenantRegistry.js).

---

## Mapa: visão × realidade

> Última revisão: **2026-08-29**. Se a tabela abaixo divergir do código, o
> código está certo — e esta linha diz há quanto tempo ninguém confere.

| Tema da visão | Hoje no código | Status |
|---|---|---|
| Multi-tenant | Banco único Postgres/Supabase, isolamento por coluna `tenant_id` | ⚠️ Diverge da visão (banco-por-tenant) — ver "Isolamento" |
| Banco global (metadados) | Mesmo banco; `tb_tenants`, `tb_super_admin` + campos de billing | 🟡 Conceito existe, físico não |
| Provisionamento automático | `provisioningService.provisionTenant()` + subdomínio na Vercel | 🟡 Funciona; "criar banco/estrutura" segue como seam |
| Versionamento de schema | Prisma Migrate; baseline `0_init`, **51 migrações** | 🟢 Em uso |
| Autenticação centralizada | Login global resolve o tenant; **Google OAuth**; sessão relida do banco a cada requisição | 🟢 Implementado |
| Serviços da plataforma | **46 em `src/services/` + 5 em `services/flow/`** | 🟢 Ver tabela abaixo |
| Health Service | `/health`: DB, latência, versão do schema, commit em execução | 🟢 Implementado |
| Notification Service | E-mail real (Resend/SMTP). WhatsApp por **ponte não oficial**; push/SMS stub | 🟡 Ver "Notificações" |
| Cobrança / assinaturas | **Stripe** (mensal e anual) + **Pix via Mercado Pago**, com histórico unificado em `pagamentos.js` | 🟢 Implementado |
| Ciclo de vida do teste | `trialService` + `avisoVencimento` (D-7/D-1) + faxina + pesquisa de pulso | 🟢 Implementado |
| Scheduler | Quatro laços por `setInterval`, cada um atrás da própria variável | 🟡 Simples; sem fila nem cron distribuído |
| Backup | Não existe | ❌ Roadmap |
| Publicação automatizada | Graph API real (Facebook + Instagram) + reconciliação + publicação automática | 🟡 Real, mas o app Meta segue em Development — ver "Meta" |
| Portais imobiliários | **Feed VRSync** (ZAP/VivaReal/OLX vêm buscar) + **Mercado Livre** por API | 🟡 O ML foi escrito contra a documentação, sem conta real |
| Inteligência Artificial | `aiService` (Gemini 2.5 Flash) + **assistente do editor de vitrine** (`vitrineIA`) | 🟢 Implementado |
| API para o cliente | **`/api/v1`** autenticada por chave, JSON e XML, escopos, trilha de auditoria, OpenAPI | 🟢 Implementado |
| Integração de entrada/saída | **Importação por feed** (URL guardada, releitura agendada) e **webhooks de saída** assinados | 🟢 Implementado |
| ERP (módulos) | Imóveis, Clientes, Vendas, Cargos, Leads, Tipos, Chamados, Tutoriais, Perfis de busca, Auditoria | 🟢 Base; faltam Agenda, Financeiro, Vistorias, Proprietários |
| **Omnimob Flow** | Funil, documentos, validações, minutas, contratos, assinatura digital, comissões, captação por webhook | 🟡 Real; assinatura digital escrita contra a documentação |
| Site institucional | `/sobre`, `/contato`, `/termos`, `/privacidade`, `/vitrines` + landing com planos | 🟢 Existe; falta blog |
| Sites das imobiliárias | Vitrine por tenant, editor visual, **domínio próprio** (`dominioService`), SEO, prévia para robôs | 🟢 Implementado |
| Trilha de auditoria | Extensão do Prisma Client + `AsyncLocalStorage`; rota nova entra sozinha | 🟢 Implementado |
| Testes | **34 arquivos na API** (integração, contra o banco de dev) + **18 na web** | 🟢 Cobertura real dos pontos caros |

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

São 46 arquivos, e listá-los um a um aqui só criaria uma segunda lista para
envelhecer. O agrupamento abaixo diz o que cada família resolve; o
[`CLAUDE.md`](../CLAUDE.md) descreve os arquivos individualmente, e é lá que a
descrição de cada um é mantida.

| Família | Arquivos | Papel |
|---|---|---|
| **Multi-tenant** | `tenantRegistry`, `provisioningService`, `migrationService`, `dominioService` | Onde um tenant vive, como nasce, em que versão está, em que endereço responde |
| **Plataforma** | `healthService`, `notificationService`, `emailLayout`, `emailTemplates`, `auditoria`, `cofre` | Saúde, e-mail, trilha e cifragem em repouso |
| **Dinheiro** | `pagamentoService` (Stripe), `pagamentoMercadoPago` (Pix), `pagamentos` (histórico único), `trialService`, `avisoVencimento` | Assinatura, cobrança avulsa, extrato, ciclo do teste |
| **Conteúdo e IA** | `aiService`, `vitrineIA`, `dadosDaVitrine` | Geração de texto e o assistente do editor |
| **Distribuição** | `publicacaoSocial`, `publicacaoAutomatica`, `feedPortais`, `mercadoLivre`, `portais`, `remocaoDeCanais`, `disparoAutomatico`, `pontewhatsapp` | Levar o imóvel para fora |
| **Integração** | `chavesApi`, `documentacaoApi`, `xmlDaApi`, `webhooks`, `importacaoService`, `formatosImportacao`, `fonteRemota`, `sincronizacao`, `copiaDeFotos`, `exportacaoCompleta`, `exportacaoXml` | A API do cliente, o que entra e o que sai |
| **Negócio** | `cruzamento`, `distribuicaoLeads`, `painelGestor`, `relatorioService`, `cargosPadrao`, `tiposPadrao`, `modulos`, `atalhos` | Regras que o produto vende |
| **Flow** (`services/flow/`) | `funil`, `comissoes`, `minutas`, `assinatura`, `captacao` | O módulo de fechamento — ver abaixo |
| **Agendadores** | `faxinaScheduler`, `relatorioScheduler` (+ os laços de aviso e sincronização) | Quatro laços, cada um atrás da própria variável de ambiente |

> Havia um `socialPublisher.js` com `enqueuePropertyPublication()`, que marcava
> as publicações como `PUBLISHED` após um `setTimeout` de 80 ms, sem publicar
> nada. **Foi removido**: ninguém o importava, e a publicação de verdade sempre
> esteve em `socialRoutes.js`. Ele sobrevivia como armadilha — bastava alguém
> ligá-lo para o sistema passar a mentir sobre publicações. O único rastro são
> refs no formato `facebook-<id>` gravadas antes, e o `isRealMetaRef()` em
> `socialRoutes.js` existe justamente para ignorá-las na reconciliação.

---

## Omnimob Flow

O produto deixou de ser um sistema só. **Hub** responde o que a imobiliária TEM
(acervo, vitrine, leads, equipe); **Flow** responde o que ela está FECHANDO
(captação, funil, minuta, assinatura, comissão).

Três perguntas independentes, e as três precisam ser sim — a divisão importa
porque cada "não" pede uma conversa diferente:

| Pergunta | Onde mora | O "não" leva a |
|---|---|---|
| A imobiliária CONTRATOU? | `Tenant.modulos` | "fale com o comercial" |
| Esta pessoa ALCANÇA? | `Cargo.acessarFlow` | "peça ao administrador" |
| O PLANO libera o recurso? | `RECURSOS_FLOW` | "faça upgrade" |

Fonte única em `utils/modulos.js` (tela) e `services/modulos.js` (servidor, que
é quem protege) — mesmo arranjo de `planos.js` com `planoMiddleware.js`.

**A moldura não troca:** `AdminLayout` é UM. O que muda é o conteúdo da `<nav>` e
o acento (índigo → rosa). Um segundo layout seria a armadilha em que o editor de
vitrine já caiu duas vezes.

Pendente: os **6 preços novos do Flow no Stripe** (a matriz é 3 planos × 2
pacotes × 2 períodos = 12; os 6 do Hub existem). Sem eles o pacote Hub+Flow não é
vendável e o alternador some da landing — sem erro nenhum, como o preço anual fez
quando entrou.

---

## Integração Meta (Facebook e Instagram)

A publicação é real e funciona. O que falta não é código: é o **App Review**.

- **Graph API `v26.0`**, declarada em um lugar só (`publicacaoSocial.js`). A
  v19.0 anterior expirou em 21/05/2026 — e chamada a versão expirada **não dá
  erro**: a Meta encaminha em silêncio para a mais antiga disponível. Próxima
  revisão: julho de 2028.
- O app segue em **Development**: só publica para quem tem papel nele. Passar
  para Live sem **Advanced Access** nas seis permissões não libera nada — as
  duas chaves são independentes.
- Advanced Access exige **verificação do negócio** E **App Review**, nesta ordem.
- A seção `#exclusao-de-dados` da política de privacidade é a
  *Data Deletion Instructions URL* exigida no painel. Mudar aquele `id` quebra o
  cadastro lá, em silêncio.

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

## Cobrança e assinaturas

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

### Pix, e por que ele é outro serviço

`pagamentoMercadoPago.js` faz uma **cobrança única** — mensal ou anual —, não uma
assinatura. A divisão é de natureza, não de gosto: conta Stripe brasileira não
faz Pix recorrente nem parcelado.

Consequências que a tela é obrigada a dizer: **nada disso renova sozinho**, e no
mensal isso se repete doze vezes por ano. Daí `avisoVencimento.js` existir — sem
ele, o desfecho normal de um cliente satisfeito era a conta vencer em silêncio.

O preço não é inventado aqui: sai de `valorDoPlano`, que lê o catálogo do
Stripe. Uma segunda tabela de preços envelheceria sem ninguém notar.

### O histórico é um só

Três lugares gravam dinheiro — webhook do Stripe, aprovação do Pix e ativação
manual — e todos passam por `registrarPagamento`. Três gravações diferentes
divergiriam no primeiro campo novo. Idempotente por `(provedor, externoId)`,
porque o webhook reenvia e a tela consulta em paralelo. **Anotar nunca derruba o
pagamento**: a função engole o próprio erro e devolve `null`, já que roda DEPOIS
de o acesso ser liberado.

### Preço anual

Cada plano tem dois preços no Stripe, objetos separados. As variáveis do anual
são **opcionais**: sem elas o plano segue vendendo só o mensal e o alternador
some da landing, sem erro. O desconto exibido é **calculado** a partir dos dois
valores lidos do Stripe — não há percentual escrito no código, então mexer no
preço lá corrige o texto da página sem deploy.

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

Em ordem de quem está bloqueando quem.

### Bloqueia receita

1. **App Review da Meta.** Sem ele, publicação em Facebook/Instagram só funciona
   para quem tem papel no app — o recurso está vendido e não entrega. Começa
   pela verificação do negócio, que leva semanas.
2. **Os 6 preços do Flow no Stripe.** O código já lê
   `STRIPE_PRICE_{BASICO,PROFISSIONAL,PREMIUM}_FLOW[_ANUAL]`; enquanto não
   existirem, o módulo não é vendável.
3. **Mercado Livre verificado contra a API real.** Escrito contra a
   documentação, com os pontos duvidosos marcados `REVISAR`. Exige app
   registrado, conta de vendedor e pacote de anúncios contratado.
4. **Assinatura digital verificada** (Clicksign/DocuSign). Mesma situação: o
   adaptador existe, ninguém rodou contra a API de verdade.

### Bloqueia operação

5. **Backup Service** (retenção, restauração). Não existe. É o único item da
   visão original que segue em zero.
6. **Fila e cron distribuído.** Hoje são quatro `setInterval`, cada um exigindo
   instância única. Duas instâncias no Render duplicam faxina, avisos,
   relatórios e sincronização.
7. **A troca de módulo pelo super-admin.** Hoje é `npm run modulos` ou a
   assinatura; falta a tela.
8. **Exclusão lógica (`deletedAt`) e retenção/anonimização.** A política de
   privacidade promete prazos que o código não sabe cumprir sozinho.

### Produto

9. **Módulos ERP** faltantes: Agenda, Financeiro, Vistorias, Proprietários.
10. **Coordenadas (lat/lng) e busca por raio** — endereço ainda é texto.
11. **Blog** para SEO (o resto do site institucional já existe).
12. **Ponte de WhatsApp por USUÁRIO**, não por tenant. Três decisões antes de
    codar: custo por canal, sessão que morre a cada 14 dias, e de quem passa a
    ser o risco — hoje quem contrata a ponte é a imobiliária, de propósito.
13. **Notification Service**: push e SMS seguem stub.

### Estrutural, quando a escala pedir

14. **Migração de isolamento** (schema-por-tenant) — trocar a implementação do
    `tenantRegistry`. Nada mais muda.
15. **CI/CD.** Os testes existem e são bons; ninguém os roda automaticamente.

---

## Testes

| | Onde | Natureza |
|---|---|---|
| **34 arquivos** | `apps/api/test` | **Integração, contra o banco de dev.** Os três vazamentos entre imobiliárias que este projeto teve moravam na junção rota + query, e nenhum teste de função pura os pegaria |
| **18 arquivos** | `apps/web/test` | Função pura e renderização isolada. `test/loader.mjs` resolve import sem extensão e transpila JSX com o esbuild que já vem no Vite — nenhuma dependência nova entrou |

Cada arquivo da API cria imobiliárias descartáveis com slug `zz-teste-<pid>-` e
as apaga no fim; o PID entra no prefixo porque o runner roda **um processo por
arquivo, em paralelo**. E-mail é neutralizado em `test/helpers.js`.

> A suíte da API leva minutos. Para uma mudança pontual, rodar só o arquivo
> relevante (`node --test test/<arquivo>.test.js`) devolve resposta em segundos.

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

> **O que mudou desde que este plano foi escrito.** O produto não esperou: hoje
> gera a arte 1080×1920 (`utils/arteParaStatus.js`) para a pessoa publicar com um
> toque, e quem quiser automação liga uma **ponte não oficial** que a própria
> imobiliária contrata (`services/pontewhatsapp.js`). A distinção não é técnica,
> é de responsabilidade: hospedar a sessão faria a Omnimob operar a violação dos
> termos da Meta em nome de centenas de clientes.
>
> As fases abaixo continuam válidas como plano para o canal OFICIAL (Cloud API),
> que é outra coisa — envio de template com opt-in, não status.

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
