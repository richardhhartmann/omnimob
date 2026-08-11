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
- `/public/*` — showcase público (sem auth)
- `/health` — health check real (DB + latência + versão do schema)

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
| `DATABASE_URL` | — | pooler Supabase `:6543` (`pgbouncer=true`) | idem |
| `DIRECT_URL` | — | Supabase `:5432` (migrations) | idem |
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
| `SMTP_PASS` | — | vazio (só loga) | **obrigatória** — sem ela nenhum e-mail sai, em silêncio |
| `CONTATO_EMAIL` | — | destino do formulário de contato | idem |

Com padrão no código, defina só para sobrescrever: `SMTP_HOST`
(`smtp.hostinger.com`), `SMTP_PORT` (`465`), `SMTP_SECURE` (`true`),
`SMTP_USER` (`notifications@omnimob.app`), `EMAIL_REMETENTE`, `DATABASE_HOST`.

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
- **Front (produção):** `https://omnimob.app` (Vercel) — hoje o apex redireciona 308 para `www.omnimob.app`; ambos estão no CORS
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
│   └── builder/
│       ├── BuilderSidePanel.jsx   — painel lateral do editor (aba Página / aba Bloco)
│       └── OnboardingOverlay.jsx  — modal de boas-vindas (1ª visita)
└── pages/
    ├── LoginPage.jsx
    ├── DashboardPage.jsx
    ├── LeadsPage.jsx
    ├── PropertyInsightsPage.jsx
    ├── ShowcasePage.jsx
    ├── ShowcasePropertyPage.jsx
    └── ShowcaseEditorPage.jsx    ← arquivo mais complexo (~1400 linhas)
```

**Env vars do web (`.env` em `apps/web`):**
```
VITE_CLOUDINARY_CLOUD_NAME=dpwuxmbli
VITE_CLOUDINARY_UPLOAD_PRESET=domus-app
```

---

## Editor de Vitrine (ShowcaseEditorPage)

Esta é a feature mais complexa do produto. Entender ela é entender 70% do frontend.

### Conceito
Editor visual drag-and-drop onde o tenant personaliza sua vitrine pública. A configuração final é salva como JSON no campo `tenant.showcaseConfig` no banco.

### Arquitetura interna

**Blocos (sections):** `header | title | highlights | properties | widgets | footer`
Cada bloco tem:
- Posição absoluta (`x%`, `y px`, `w%`, `h px`) — layout independente para desktop e mobile
- Estilo visual (cor de fundo, imagem de banner, overlay, brilho, cor de texto)
- Conteúdo editável inline (contentEditable)

**Estado central:** `form` (useState) contendo todos os campos do tenant + `showcaseConfig` (objeto JSON aninhado)

**`showcaseConfig` (dentro de `form.showcaseConfig`):**
```js
{
  layout: { header, title, highlights, properties, widgets, footer }, // posições desktop
  mobileLayout: { ... },  // posições mobile independentes
  blockStyles: { header: { backgroundColor, color, backgroundImage, backgroundOverlay, backgroundBrightness }, ... },
  highlights: [{ title, description }],
  highlightStyles: [{ backgroundColor, color }],
  widgets: [{ id, type, title, content, ctaLabel, ctaUrl, backgroundColor, color }],
  appearanceMode: "dark" | "light",
  footerTitle: string,
  topHeader: { title, subtitle },
  hiddenBlocks: string[],
}
```

**Utilitário:** `apps/web/src/utils/showcaseConfig.js`
- `normalizeShowcaseConfig(raw)` — valida e preenche defaults; sempre retorna objeto completo
- `DEFAULT_LAYOUT` — posições padrão de cada bloco
- `mergeBlockWrapperStyle`, `sectionSurfaceStyle` — geram inline styles para blocos com/sem banner

**Undo/Redo:** two-stack (undoStackRef / redoStackRef, max 50). `pushHistory()` chamado antes de toda ação discreta. Atalhos Ctrl+Z / Ctrl+Y via `undoFnRef` (evita stale closure).

**Drag & resize:** `startBuilderAction(blockKey, "drag"|"resize", event)` — captura pointerdown, rastreia movimento com `pointermove`. Usa `cascadePushLayout()` ao arrastar (blocos empurram outros em cascata). Resize mantém verificação de colisão.

**Layout mobile independente:** `activeLayout = previewMode === "mobile" ? showcaseConfig.mobileLayout : layout`. Drag/resize em modo mobile atualiza `mobileLayout`; em desktop atualiza `layout`.

**Auto-save:** `useEffect` com debounce de 1000ms no estado `form` → `api.updateTenantProfile()`.

**Temas de cor predefinidos:**
```js
CLASSICO:    { primaryColor: "#6366f1", secondaryColor: "#d4af37" }
PALETA_AZUL: { primaryColor: "#2563eb", secondaryColor: "#f8fafc" }
ESMERALDA:   { primaryColor: "#10b981", secondaryColor: "#14b8a6" }
OCEANO:      { primaryColor: "#0ea5e9", secondaryColor: "#38bdf8" }
```
Se as cores não baterem com nenhum preset → `currentTheme === "PERSONALIZADO"`.

### BuilderSidePanel
Painel lateral sticky (272px, `top: 56px`, `height: calc(100vh - 56px)`).
- **Aba "Página":** modo dark/light, temas de cor (com card Personalizado), pickers primária/secundária, dados da empresa, restaurar blocos ocultos
- **Aba "Bloco":** auto-ativa ao clicar num bloco; mostra nome do bloco, botão Ocultar, `BlockStyleSection` (banner URL, cor de fundo bloqueada se tiver banner, sliders overlay/brilho, cor de texto), extras por bloco (highlights: add/remove/cor; widgets: add/remove; properties: info)

### Topbar do editor
- Status de save (Carregando / Salvando / Salvo)
- Undo / Redo (icon buttons)
- Toggle Desktop / Mobile (botão inativo fica 45% opacity)
- "Copiar Desktop" (visível só em mobile) — copia `layout` → `mobileLayout`
- "Posições" — reseta layout ativo para DEFAULT_LAYOUT
- "Resetar Tudo" — confirm dialog, reseta tudo
- "Ver Página" — link para a vitrine pública em nova aba

---

## Convenções e padrões

- **Sem Tailwind** — todo CSS é classes customizadas em `styles.css` ou inline styles em JSX
- **Sem Context/Redux** — estado via props drilling ou `useState` local
- **Sem TypeScript** — JS puro
- **Português** — toda UX, mensagens de erro, labels, comentários de código
- **Inline styles JSX** — componentes do editor usam 100% inline styles (sem classes CSS)
- **`formRef` pattern** — `useRef` espelhando o `form` state para closures estáveis em event handlers
- **Multi-tenant por header** — frontend envia `x-tenant-slug` em toda requisição autenticada
- **Cloudinary** — upload direto do browser (sem passar pelo backend)

---

## O que NÃO existe ainda (oportunidades futuras)

- Publicação real nos canais sociais (`publishToChannel` ainda é stub; OAuth/webhook Meta já existem)
- UI de IA no frontend (backend `/api/ai/*` pronto)
- Notification Service com provedores reais (interface pronta, envio é stub)
- Backup Service e Scheduler
- Isolamento por schema/banco-por-tenant (seam pronto em `tenantRegistry.js`)
- Módulos ERP: Contratos, Agenda, Financeiro, Vistorias, Proprietários, Corretores
- Site institucional; domínio próprio + SEO + blog para as vitrines
- Recuperação de senha, testes automatizados, deploy CI/CD

> Panorama completo visão × realidade + roadmap: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md)
