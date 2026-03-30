# Domus

Plataforma web multi-tenant para gestao de imoveis com `Node.js + React`.

## Stack

- Backend: `Express + Prisma + PostgreSQL`
- Frontend: `React + Vite`

## Fluxo

- Login com usuario associado a um tenant
- Painel de imoveis do tenant logado
- Navegacao por duas secoes: cadastro e listagem
- Na listagem: editar e excluir imovel
- Painel por imovel com metricas (acessos, interessados, vendas)
- Upload de fotos por URL ou Cloudinary gratuito
- Vitrine publica por tenant

## Setup

1. Instale dependencias na raiz:

```bash
npm install
```

2. Configure ambiente da API:

```bash
cd apps/api
copy .env.example .env
```

3. Ajuste `DATABASE_URL` e `DIRECT_URL`.

4. Rode Prisma:

```bash
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
```

5. Suba app:

```bash
cd ../..
npm run dev
```

## Upload de imagens (Cloudinary Free)

No frontend:

```bash
cd apps/web
copy .env.example .env
```

Preencha:

- `VITE_CLOUDINARY_CLOUD_NAME`
- `VITE_CLOUDINARY_UPLOAD_PRESET`

## Usuarios seed

- `admin` / `admin` (tenant `imobiliaria-centro`)
- `admin-casa` / `admin` (tenant `casa-nobre`)
- `editor` / `admin` (edicao da vitrine do tenant `imobiliaria-centro`)

## Regras de acesso

- `ADMIN`: acesso ao painel de controle
- `SHOWCASE_EDITOR`: acesso ao editor da vitrine em `/vitrine/:tenantSlug/editar`

## Apos alteracoes de schema Prisma

Sempre execute:

```bash
cd apps/api
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
```
