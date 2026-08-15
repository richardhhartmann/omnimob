# Omnimob — Contexto para Claude

## O que é o projeto

**Omnimob** é uma plataforma SaaS multi-tenant de gestão imobiliária, escrita inteiramente em Português. Cada **tenant** é uma imobiliária; cada imobiliária tem seus próprios usuários, imóveis, leads e uma página pública de vitrine personalizável.

O produto tem duas faces:
- **Painel admin** — gestão de imóveis, leads, métricas, publicações sociais
- **Vitrine pública** — showcase personalizado por tenant, com editor drag-and-drop

---

## Monorepo

```
omnimob/
├── apps/
│   ├── api/    ← Express + Prisma + PostgreSQL (porta 4000)
│   └── web/    ← React + Vite (porta 5173)
├── package.json  ← npm workspaces ("apps/*"), script "dev" roda os dois com concurrently
```

**Rodar tudo:** `npm run dev` (raiz)
**Só API:** `npm run dev:api`
**Só web:** `npm run dev:web`

---

## Backend (`apps/api`)

| Item | Detalhe |
|------|---------|
| Framework | Express 4 + ES modules |
| Banco | PostgreSQL (Supabase) |
| ORM | Prisma 6 |
| Auth | JWT (7 dias), bcryptjs |
| Validação | Zod |
| Rate limit | 20 req/15min (auth), 300 req/min (geral) |
| Porta | 4000 (env `PORT`) |

**Entry point:** `apps/api/src/server.js`

**Rotas:**
- `POST /api/auth/login`
- `/api/tenants/*` — perfil, configuração do tenant
- `/api/properties/*` — CRUD de imóveis, imagens, métricas (inclui `POST /:id/ai/gerar`)
- `/api/leads/*` — leads do tenant
- `/api/clientes/*`, `/api/usuarios/*`, `/api/cargos/*` — ERP
- `/api/admin/*` — painel super-admin (tenants, billing); provisionamento via `provisioningService`
- `/api/social/*` — publicação e OAuth Meta (+ webhook em `/api/social/webhook`)
- `/api/ai/*` — geração de conteúdo com IA (Gemini)
- `/public/*` — showcase público (sem auth); inclui `GET /public/sitemap.xml`, servido em `omnimob.app/sitemap.xml` por reescrita da Vercel
- `/previa/*` — HTML com Open Graph para robôs de prévia (WhatsApp, Facebook, LinkedIn). A Vercel reescreve `/vitrine/*` para cá **só** quando o user-agent é de robô; pessoa continua recebendo o SPA. Ver `previaRoutes.js`
- `/health` — health check real (DB + latência + versão do schema)

**Testes:** `npm test` em `apps/api` (runner nativo do Node, sem dependência
nova). São de **integração, contra o banco de dev** — os três vazamentos entre
imobiliárias que este projeto teve moravam na junção rota + query, e nenhum teste
de função pura os pegaria. Cada arquivo cria imobiliárias descartáveis com slug
`zz-teste-<pid>-` e as apaga no fim; o PID entra no prefixo porque o runner roda
**um processo por arquivo, em paralelo**. E-mail é neutralizado em `test/helpers.js`.

| Arquivo | O que guarda |
|---|---|
| `test/isolamento.test.js` | A pede recurso da B pelo id real → 404 (cargos, tipos, atributos, usuários) |
| `test/recuperacao.test.js` | resposta igual para conta existente/inexistente; link de uso único |
| `test/previa.test.js` | Open Graph com foto e preço; escape de HTML no texto do cliente |

**Isolamento multi-tenant:** `Cargo` e `TipoImovel` já foram tabelas globais —
sem `tenantId`, compartilhadas por todas as imobiliárias, com CRUD aberto na
tela. Hoje as duas têm dono e filtro em toda query. Ao criar modelo novo que o
cliente edita, **comece pelo `tenantId`**: os dois vazamentos passaram meses
invisíveis porque com um cliente só o sintoma não aparece.

**Camada de serviços (`src/services/`):** desacoplada, alinhada à arquitetura-alvo.
- `tenantRegistry.js` — **seam multi-tenant**: resolve onde um tenant vive. Hoje banco único; ponto de troca para schema/banco-por-tenant. Use `getTenantClient()`/`getGlobalPrisma()` em vez de importar `db.js` direto.
- `aiService.js` — Google Gemini 2.5 Flash (via `fetch`), gera descrições/título/hashtags/posts/ads/e-mail.
- `provisioningService.js`, `migrationService.js`, `healthService.js`, `notificationService.js` (stub), `socialPublisher.js`.

**Versionamento de banco:** migrado de `db push` → **Prisma Migrate**. Baseline em `prisma/migrations/0_init`. Ver [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) para o passo de baseline e o roadmap completo.

**Middlewares:**
- `authMiddleware.js` — valida JWT, injeta `req.user`
- `tenantMiddleware.js` — lê header `x-tenant-slug`, injeta `req.tenant`; toda query filtra por `tenantId`

### Env vars

> **A regra que evita a maior parte dos enganos:** metade destas variáveis
> aponta para a **API** (`api.omnimob.app`) e a outra metade para o **FRONT**
> (`omnimob.app`). Trocar as duas coisas é o erro clássico — e o sintoma nunca
> diz o que houve: o app quebra no CORS, ou o link do e-mail cai num 404.

**`apps/api/.env`** — obrigatórias:

| Variável | Aponta p/ | Dev | Produção |
|---|---|---|---|
| `DATABASE_URL` | — | pooler Supabase `:6543` (`pgbouncer=true`) | **outro projeto Supabase** |
| `DIRECT_URL` | — | Supabase `:5432` (migrations) | idem, do projeto de produção |
| `PORT` | — | `4000` | `4000` |
| `JWT_SECRET` | — | qualquer string | segredo forte e distinto do de dev |
| `APP_URL` | **FRONT** | `http://localhost:5173` | `https://omnimob.app` |
| `FRONTEND_URL` | **FRONT** | `http://localhost:5173` | `https://omnimob.app` |
| `ALLOWED_ORIGINS` | **FRONT** | `http://localhost:5173,http://localhost:3000` | `https://omnimob.app,https://www.omnimob.app` |
| `META_CALLBACK_URL` | **API** | `http://localhost:4000/api/social/oauth/callback` | `https://api.omnimob.app/api/social/oauth/callback` |
| `META_APP_ID` / `META_APP_SECRET` / `META_WEBHOOK_VERIFY_TOKEN` | — | do app Meta | idem |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | — | Google AI Studio / `gemini-2.5-flash` | idem |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | — | `sk_test_…` | **`sk_live_…`** |
| `STRIPE_PRICE_BASIC` / `_PRO` / `_PREMIUM` | — | preços de teste | preços live |
| `STRIPE_PRICE_BASICO_ANUAL` / `STRIPE_PRICE_PROFISSIONAL_ANUAL` / `STRIPE_PRICE_PREMIUM_ANUAL` | — | preços **anuais** de teste (opcionais) | preços anuais live |
| `RESEND_API_KEY` | — | vazio (só loga o link) | **obrigatória** — é o único transporte de e-mail que funciona no Render |
| `CONTATO_EMAIL` | — | destino do formulário de contato | idem |

**Sobre o preço anual:** cada plano tem dois preços no Stripe — o mensal
(`interval: month`) e o anual (`interval: year`), objetos separados no painel.
As variáveis do anual são **opcionais**: sem elas o plano segue vendendo só o
mensal e o alternador some da landing, sem erro nenhum. O desconto exibido
(“2,5 meses grátis”, “economize R$ …”) é **calculado** a partir dos dois valores
lidos do Stripe — não existe percentual escrito no código, então mexer no preço
lá corrige o texto da página sem deploy. Aceitam também a grafia em inglês
(`STRIPE_PRICE_BASIC_ANNUAL`, `_PRO_ANNUAL`, `_PREMIUM_ANNUAL`).

**Sobre o e-mail:** o `notificationService` prefere o Resend (HTTPS) e só cai no
SMTP se não houver `RESEND_API_KEY`. Isso não é preferência — **SMTP de saída não
completa no Render**: a conexão com `smtp.hostinger.com:465` estoura por timeout
e, como o convite de teste é aguardado antes da resposta HTTP, a requisição
inteira fica presa (era o motivo de criar tenant levar minutos). O remetente
precisa de domínio verificado no painel do Resend, senão só chega no e-mail dono
da conta. Há teto de 10 s por tentativa nos dois caminhos.

Com padrão no código, defina só para sobrescrever: `EMAIL_REMETENTE`,
`DATABASE_HOST`, e o fallback SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
`SMTP_USER`, `SMTP_PASS`).

Opcionais: `FAXINA_AUTOMATICA=true` (agendador de limpeza — só com uma
instância), `SEED_DEV=true`, `SUPER_ADMIN_EMAIL` / `_NOME` / `_PASSWORD` (só o
seed lê; **sem `SUPER_ADMIN_PASSWORD` a senha vira `superadmin`**).

Em produção defina também `NODE_ENV=production`: é ele que fecha o atalho de
CORS que libera qualquer `localhost`.

**`apps/web/.env`** (tudo com prefixo `VITE_`, e tudo vai para o bundle — nada
de segredo aqui):

| Variável | Aponta p/ | Dev | Produção |
|---|---|---|---|
| `VITE_API_URL` | **API** | `http://localhost:4000` | `https://api.omnimob.app` — **sem barra no fim** |
| `VITE_CLOUDINARY_CLOUD_NAME` | — | `dpwuxmbli` | idem |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | — | `domus-app` (nome do preset no Cloudinary) | idem |
| `VITE_STRIPE_PUBLISHABLE_KEY` | — | `pk_test_…` | **`pk_live_…`** |

**Ambientes:**
- **Front (produção):** `https://omnimob.app` (Vercel) — o **apex é o canônico**: `www.omnimob.app` redireciona 308 para ele, e não o contrário. É para o apex que apontam o `og:url`, o `sitemap.xml` e o `Sitemap:` do `robots.txt`. Os dois seguem no CORS: o `www` só aparece como origem se algo chamar a API antes de seguir o redirecionamento
- **API (produção):** `https://api.omnimob.app` (Render — CNAME `api` apontando para o serviço)
- **Dev local:** web em `5173`, API em `4000`

---

## Banco de dados (Prisma schema)

**Arquivo:** `apps/api/prisma/schema.prisma`

Modelos principais:

| Modelo | Propósito |
|--------|-----------|
| `Tenant` | Imobiliária (slug único, branding, `showcaseConfig` JSON) |
| `User` | Admin/Agent/ShowcaseEditor por tenant |
| `Property` | Imóvel (título, preço, endereço, tipo, fotos, status) |
| `PropertyImage` | Fotos no Cloudinary, ordenadas por `position` |
| `PropertyLead` | Leads capturados na vitrine pública |
| `PropertyPublication` | Fila de publicação social (Facebook/Instagram/WhatsApp) |
| `PropertyMetricEvent` | Eventos de VIEW/LEAD/SALE para analytics |

**Roles:** `ADMIN` | `AGENT` | `SHOWCASE_EDITOR`
**Status de imóvel:** `DRAFT` | `ACTIVE` | `INACTIVE`

**Seed:** `apps/api/prisma/seed.js`
- Tenant `imobiliaria-centro` e `casa-nobre`
- Usuários de teste (senha `admin`): `admin`, `editor`, `admin-casa`

---

## Frontend (`apps/web`)

| Item | Detalhe |
|------|---------|
| Framework | React 18 + Vite 6 |
| Router | React Router 6 (BrowserRouter) |
| Estilo | CSS puro (`src/styles.css`, 28KB) — sem Tailwind |
| Imagens | Cloudinary (upload direto pelo browser) |
| Estado | `useState` local + `localStorage` para sessão |

**Entry:** `apps/web/src/main.jsx` → `App.jsx`

**Testes:** `npm test` em `apps/web` (runner nativo do Node). Ao contrário dos da
API, estes são de **função pura e de renderização isolada** — não encostam no
banco. `test/loader.mjs` resolve import sem extensão e transpila JSX com o
esbuild que já vem dentro do Vite, então nenhuma dependência nova entrou.

| Arquivo | O que guarda |
|---|---|
| `test/paridade.test.jsx` | cada peça da vitrine renderizada nos dois modos → HTML idêntico |
| `test/layout.test.js` | colisão, cascata, independência desktop/mobile, reflow idempotente |
| `test/normalizacao.test.js` | migração de config antigo, espelho legado, tolerância a lixo |

### Rotas principais (App.jsx)
```
/login                          → LoginPage
/vitrine/:tenantSlug            → ShowcasePage (público)
/vitrine/:tenantSlug/imovel/:id → ShowcasePropertyPage (público)
/vitrine/:tenantSlug/editar     → ShowcaseEditorPage (editor)
/                               → DashboardPage (admin)
/leads                          → LeadsPage
/imoveis/:propertyId            → PropertyInsightsPage
```

### Arquivos-chave
```
src/
├── App.jsx                  — roteamento, proteção de rotas, sessão
├── api.js                   — cliente HTTP (fetch), token JWT via header
├── session.js               — localStorage: salva/carrega user+tenant+token
├── styles.css               — todo o CSS global
├── utils/
│   ├── showcaseConfig.js    — normaliza/valida o JSON de config da vitrine
│   └── uploadToCloudinary.js
├── components/
│   ├── AdminLayout.jsx
│   ├── PropertyForm.jsx
│   ├── PropertyList.jsx
│   ├── showcase/           ← A VITRINE. Fonte de verdade visual das duas telas
│   │   ├── ShowcaseRenderer.jsx  — ordena, posiciona e desenha as peças
│   │   ├── ShowcaseHeader/Hero/Highlights/PropertyGrid/PropertyCard/Footer
│   │   ├── ShowcaseWidget.jsx    — despachante único de tipos de widget
│   │   ├── widgets/              — um componente por tipo
│   │   ├── contexto.jsx          — público × editor (texto, links)
│   │   ├── tema.js               — cores, fonte, breakpoint, link do WhatsApp
│   │   ├── engine/               — física de layout, sem DOM e sem React
│   │   ├── useAlturasReais.js    — medição por ResizeObserver
│   │   └── useLayoutResolvido.js — medir → engine → layout (uso da vitrine)
│   └── builder/            ← só os CONTROLES de edição (ver seção abaixo)
│       ├── hooks/          — gesto, histórico, zoom, autosave
│       ├── canvas/         — moldura da peça, guias, barra de formatação
│       ├── panels/         — biblioteca/camadas (esquerda) e inspetor (direita)
│       ├── toolbar/        — barra superior
│       ├── data/           — biblioteca de peças, templates, paletas
│       ├── AlcaDeArrasto.jsx     — a alça do dnd-kit
│       ├── dndEditor.js         — sensores (ponteiro, toque, teclado)
│       └── OnboardingOverlay.jsx — modal de boas-vindas (1ª visita)
└── pages/
    ├── LoginPage.jsx
    ├── DashboardPage.jsx
    ├── LeadsPage.jsx
    ├── PropertyInsightsPage.jsx
    ├── ShowcasePage.jsx
    ├── ShowcasePropertyPage.jsx
    └── ShowcaseEditorPage.jsx    ← só compõe o editor; a lógica mora em components/builder
```

**Env vars do web (`.env` em `apps/web`):**
```
VITE_CLOUDINARY_CLOUD_NAME=dpwuxmbli
VITE_CLOUDINARY_UPLOAD_PRESET=domus-app
```

---

## Vitrine e Editor (`components/showcase/` + `components/builder/`)

A feature mais complexa do produto. Construtor visual onde a imobiliária monta a
própria vitrine; o resultado é gravado como JSON em `tenant.showcaseConfig`.

### A REGRA MAIS IMPORTANTE: o editor não desenha a vitrine

> **What You See Is What You Get.** O mesmo `showcaseConfig`, no mesmo modo,
> produz a mesma página no editor e no ar.

```
                showcaseConfig
                      │
              ShowcaseRenderer          ← componentes ÚNICOS
                 │        │
          ┌──────┘        └──────┐
       EDITOR                  VITRINE
    + BuilderPiece            (nada em volta)
      contorno, alça,
      seleção, guias
```

`components/showcase/` é a vitrine. `components/builder/` são os **controles**
que ficam em volta dela. O construtor põe aparato de edição EM VOLTA do
conteúdo, **nunca no lugar dele** — não existe uma segunda versão de cabeçalho,
cartão de imóvel ou widget para o editor, e criar uma é o defeito, não a
solução.

Já houve duas de tudo, e elas divergiram: o bloco de números aparecia como uma
linha de texto com barras no editor e como uma grade de cartões na página; o CTA
tinha uma "Configuração do Botão" de um lado e um botão redondo do outro; o
cartão de imóvel do editor não mostrava selos nem metragem; o cabeçalho tinha
paddings diferentes; e o celular publicava widgets a 100% de largura mesmo com o
editor mostrando 49%.

**A diferença entre os dois modos é só COMPORTAMENTO**, e mora num lugar só,
`showcase/contexto.jsx`:

| Público | Editor |
|---|---|
| texto é texto | o mesmo elemento com `contentEditable` |
| link navega | link sem destino |

Nunca: padding, fonte, estrutura, largura, posição, cores, componentes internos.

Campo que **não aparece como texto** na página publicada (URL de CTA, endereços
das redes) é editado no **inspetor**, não na prancheta — desenhá-lo no canvas
significaria mostrar algo que a vitrine não tem.

`npm test` em `apps/web` renderiza cada peça nos dois modos e exige HTML
idêntico depois de remover as afordâncias de edição. Se alguém acrescentar um
invólucro ou um padding só de um lado, o teste aponta.

### A regra que organiza tudo

**Uma peça é uma peça.** Os seis blocos fixos (`header`, `title`, `highlights`,
`properties`, `footer`) e os widgets viram a mesma coisa para a engine:

```js
{ id: "b:header" | "w:<widgetId>", kind, key, x, y, w, h, locked, hidden }
```

`x`/`w` em % da largura do canvas, `y`/`h` em pixels. Os adaptadores em
`engine/pieces.js` (`toPieces` / `applyPieces`) são o único lugar que sabe que
bloco mora num mapa e widget num array. Antes eram duas físicas separadas — e
era daí que saía o "widget dentro do bloco": o array não participava de colisão
nenhuma.

### Camadas

| Pasta | O que é | Não pode |
|---|---|---|
| `showcase/engine/` | colisão, cascata, encaixe, reflow, adaptadores | tocar DOM ou React |
| `showcase/*.jsx` | o desenho da vitrine — as duas telas | saber que existe editor (só o contexto sabe) |
| `builder/hooks/` | gesto, histórico, zoom, autosave | conter regra de layout |
| `builder/canvas/` | moldura, guias, barra de formatação | desenhar conteúdo de vitrine |
| `builder/panels/`, `toolbar/` | biblioteca, camadas, inspetor, barra | conhecer física |

A engine mora em `showcase/` e não em `builder/` por uma razão prática: a
página pública a usa. Vitrine dependendo de `components/builder/` seria a porta
para o editor voltar a vazar para dentro dela.

`ShowcaseEditorPage.jsx` só compõe e traduz intenção de interface em chamada de
engine.

**Biblioteca:** `dnd-kit` — e SÓ como camada de entrada (ponteiro, toque,
teclado, limiar de ativação), com `feedback: "none"` para ele não mover o
elemento por conta própria. A geometria é nossa. Ver o cabeçalho de
`dndEditor.js` para por que não `react-grid-layout`.

**Física (`engine/collision.js`):** a peça arrastada é a **âncora** — ela encosta
na borda mais próxima da peça que mais invadiu, e quem estiver no caminho desce.
As duas fases (cascata e afastamento) só **aumentam** `y`; é isso que garante
convergência e que nada termine sobreposto. Mover para cima nessa etapa parece
mais gentil e faz o par oscilar — está comentado no arquivo.

**Alturas dinâmicas:** o `h` guardado é `min-height`, e o conteúdo passa disso (o
bloco de imóveis declara 640px e desenha 1051). `showcase/useAlturasReais.js` mede
por `ResizeObserver` — que ignora o `transform: scale()` do zoom, ao contrário do
`getBoundingClientRect()` que havia antes — e o reflow só roda quando a altura
cresce de verdade. **As duas telas usam a mesma medição e a mesma função de
resolução** (`ajustarAlturasMedidas`); o que muda é o destino: o editor grava o
resultado no documento, a vitrine guarda só para renderizar
(`useLayoutResolvido`). A `ShowcasePage` tinha um algoritmo próprio para isso —
com deslocamento especial do bloco de imóveis e empilhamento em coluna única no
celular — e era uma segunda engine, com resultados diferentes.

**Gesto sem tremer:** o arrasto NÃO escreve no `form`. Cada quadro recalcula a
partir do config congelado no início e entrega o resultado num estado
transitório; ao soltar, grava uma vez. É o que impede
`pointermove → setForm → render de dezenas de cartões de imóvel`.

**Undo/redo:** `hooks/useBuilderHistory.js`, duas pilhas, máximo 50. Um gesto =
uma entrada (registrada no início, não a cada quadro). Ctrl+Z / Ctrl+Y /
Ctrl+Shift+Z. Os instantâneos do "Histórico de versões" são outra coisa: ficam no
`localStorage` chaveado pelo **id** do tenant (ver `utils/chaveDoTenant.js`).

**Autosave:** `hooks/useShowcaseAutosave.js`, debounce de 1s sobre o `form`,
pausado durante o gesto.

### `showcaseConfig` (formato gravado)

```js
{
  version: 2,
  layout:       { header, title, highlights, properties, footer }, // desktop
  mobileLayout: { ... },                                            // independente
  blockStyles:  { header: { backgroundColor, color, backgroundImage, backgroundOverlay, backgroundBrightness }, ... },
  highlights: [{ title, description }],
  highlightStyles: [{ backgroundColor, color }],
  widgets: [{
    id, type, title, content, ctaLabel, ctaUrl, backgroundColor, color,
    layout: { desktop: { x, y, w, h }, mobile: { x, y, w, h } },
    x, y, w, h,          // espelho do desktop, para leitores antigos do JSON
    hidden, locked,
  }],
  appearanceMode: "dark" | "light",
  globalFont, footerTitle, topHeader, hiddenBlocks, lockedBlocks,
}
```

**Compatibilidade:** `normalizeShowcaseConfig()` é a única migração. Widget antigo
chega com `x/y/w/h` soltos e sai com `layout.desktop`/`layout.mobile`
preenchidos (mobile começa como cópia do desktop, que é o comportamento de
antes). Os campos soltos continuam na saída espelhando o desktop — a vitrine
pública lê por ali. Ao mexer no formato, a migração é dela e de mais ninguém.

### Interface

```
┌──────────────────────────────────────────────────────────────┐
│ contexto + status        Desktop|Mobile        undo zoom •••  │
├────────┬──────────────────────────────────┬──────────────────┤
│ rail   │            prancheta             │    inspetor      │
│ + peça │  (folha centrada, dots, zoom)    │  página OU peça  │
│ camadas│                                  │                  │
└────────┴──────────────────────────────────┴──────────────────┘
```

- **Esquerda:** Adicionar (biblioteca, clicar ou arrastar), Camadas (👁/🔒,
  clique seleciona), Templates. Vira tira de ícones abaixo de 1180px.
- **Prancheta:** folha centrada sobre fundo neutro, zoom (`Ctrl+roda`, `Ctrl+0`,
  encaixar na largura), mobile num frame de 430px sem zoom.
- **Direita:** sem seleção edita a PÁGINA (aparência, fonte, cores, empresa,
  peças ocultas); com seleção edita a PEÇA (layout X/Y/L/A, aparência, conteúdo,
  ações). Seções recolhíveis.
- **Seleção:** contorno fino, etiqueta flutuante com o nome (é ela a alça de
  arrasto — o miolo fica livre para editar texto), alças pequenas nos cantos,
  barra contextual com duplicar/travar/ocultar.

O CSS do editor é escopado em `.editor-shell` no `styles.css` (`editor-*`,
`builder-piece*`), e não em template literal.

---

## Convenções e padrões

- **Sem Tailwind** — todo CSS é classes customizadas em `styles.css` ou inline styles em JSX
- **Sem Context/Redux** — estado via props drilling ou `useState` local
- **Sem TypeScript** — JS puro
- **Português** — toda UX, mensagens de erro, labels, comentários de código
- **Inline styles JSX** — telas antigas usam bastante; no editor de vitrine a
  regra virou o contrário: classe em `styles.css` para tudo que se repete, inline
  só para o que é genuinamente dinâmico (`left`, `top`, `width`, `height`,
  `backgroundImage`, cores do cliente, zoom)
- **`formRef` pattern** — `useRef` espelhando o `form` state para closures estáveis em event handlers
- **Multi-tenant por header** — frontend envia `x-tenant-slug` em toda requisição autenticada
- **Cloudinary** — upload direto do browser (sem passar pelo backend)

---

## O que NÃO existe ainda (oportunidades futuras)

- Envio automático de mensagem por WhatsApp (a publicação em Facebook/Instagram **já é real** — ver `socialRoutes.js`, que chama a Graph API; falta só o app Meta sair do modo de desenvolvimento)
- UI de IA no frontend (backend `/api/ai/*` pronto)
- Notification Service com provedores reais (interface pronta, envio é stub)
- Backup Service e Scheduler
- Isolamento por schema/banco-por-tenant (seam pronto em `tenantRegistry.js`)
- Módulos ERP: Contratos, Agenda, Financeiro, Vistorias, Proprietários, Corretores
- Site institucional; domínio próprio + SEO + blog para as vitrines
- Testes automatizados e deploy CI/CD (recuperação de senha **já existe** — `POST /api/auth/recuperar-senha`)

> Panorama completo visão × realidade + roadmap: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md)

---

## Scripts operacionais (`apps/api`)

| Comando | O que faz |
|---|---|
| `npm test` | Suíte de integração (ver acima) |
| `npm run subdominios` | **Confere** `<slug>.omnimob.app` de cada imobiliária na Vercel e diz o que está faltando ou pendente de verificação. Ensaio por padrão; `-- --aplicar` cadastra os que faltam |
| `npm run faxina` | Trials vencidos: desativa e remove. Ensaio por padrão; `--aplicar` executa |
| `npm run relatorio` | Relatório mensal por e-mail aos clientes Profissional/Premium. Ensaio por padrão; `--aplicar` envia. `--mes=7 --ano=2026` escolhe o período |
| `npm run stripe:limpar -- --slug=…` | Cancela assinaturas do slug no Stripe |
| `npm run prisma:seed:dev` | Imobiliárias de exemplo + catálogos |

> O subdomínio de cada imobiliária é cadastrado **individualmente** na Vercel no
> provisionamento — não existe wildcard `*.omnimob.app`. Se aquela chamada
> falhar, o tenant nasce e o painel anuncia um endereço que não abre; hoje isso
> vira `warning` na criação, e o `npm run subdominios` repara depois.
