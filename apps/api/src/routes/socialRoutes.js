import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermissao } from "../middlewares/permissaoMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { requirePlanoRedes } from "../middlewares/planoMiddleware.js";
import { overlay360 } from "../utils/cloudinaryOverlay.js";

import { cifrar, decifrar } from "../services/cofre.js";
/* Os auxiliares da Graph API moram no serviço desde que a publicação saiu
   daqui. A rota ainda usa alguns (reconciliar, apagar post), e importá-los é
   melhor que manter duas cópias que divergem na primeira mudança da API. */
import {
  publicarNasRedes, tokenDaPagina, META_BASE, isRealMetaRef,
  deleteFacebookPost, checkPostExists, fetchPostInsights,
  reconcilePublications, deleteOnePublication,
} from "../services/publicacaoSocial.js";


const META_APP_ID = process.env.META_APP_ID || "";
const META_APP_SECRET = process.env.META_APP_SECRET || "";
const META_CALLBACK_URL = process.env.META_CALLBACK_URL || "https://api.omnimob.app/api/social/oauth/callback";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://omnimob.app";
const META_API_VERSION = "v19.0";

export const socialRouter = Router();

// ─── Estado OAuth temporário (em memória, TTL 10min) ─────────────────────────

const oauthStates = new Map();

function criarState(tenantId) {
  const state = `${tenantId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  oauthStates.set(state, { tenantId, at: Date.now() });
  // Limpa entradas expiradas
  for (const [key, val] of oauthStates) {
    if (Date.now() - val.at > 10 * 60 * 1000) oauthStates.delete(key);
  }
  return state;
}

function validarState(state) {
  const entry = oauthStates.get(state);
  if (!entry) return null;
  if (Date.now() - entry.at > 10 * 60 * 1000) { oauthStates.delete(state); return null; }
  oauthStates.delete(state);
  return entry.tenantId;
}

// ─── GET /api/social/oauth/url ────────────────────────────────────────────────
// Retorna a URL do Meta OAuth para redirecionar o navegador.

socialRouter.get("/oauth/url", requireTenant, async (req, res) => {
  if (!META_APP_ID) {
    return res.status(501).json({ error: "Integração Meta não configurada. Defina META_APP_ID no .env da API." });
  }
  const state = criarState(req.tenant.id);
  const scope = [
    "pages_show_list",
    "pages_manage_posts",
    "pages_read_engagement",
    "instagram_basic",
    "instagram_content_publish",
    "business_management",
  ].join(",");

  const url = new URL(`https://www.facebook.com/${META_API_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", META_APP_ID);
  url.searchParams.set("redirect_uri", META_CALLBACK_URL);
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");

  return res.json({ url: url.toString() });
});

// ─── GET /api/social/oauth/callback ──────────────────────────────────────────
// Recebe o code do Meta, troca por tokens e salva no tenant.

socialRouter.get("/oauth/callback", async (req, res) => {
  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    return res.redirect(
      `${FRONTEND_URL}/configuracoes?social=error&msg=${encodeURIComponent("Autorização negada pelo usuário.")}`
    );
  }

  const tenantId = validarState(state);
  if (!tenantId) {
    return res.redirect(
      `${FRONTEND_URL}/configuracoes?social=error&msg=${encodeURIComponent("Estado OAuth inválido ou expirado. Tente novamente.")}`
    );
  }

  try {
    // 1. Troca code por token de usuário curto
    const tokenRes = await fetch(
      `${META_BASE}/oauth/access_token?${new URLSearchParams({
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET,
        redirect_uri: META_CALLBACK_URL,
        code,
      })}`
    );
    const tokenData = await tokenRes.json();
    if (tokenData.error) throw new Error(tokenData.error.message);

    // 2. Troca por token de longa duração (60 dias)
    const longTokenRes = await fetch(
      `${META_BASE}/oauth/access_token?${new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET,
        fb_exchange_token: tokenData.access_token,
      })}`
    );
    const longTokenData = await longTokenRes.json();
    if (longTokenData.error) throw new Error(longTokenData.error.message);
    const longToken = longTokenData.access_token;

    // 3. Busca páginas do Facebook do usuário
    const pagesRes = await fetch(`${META_BASE}/me/accounts?access_token=${longToken}`);
    const pagesData = await pagesRes.json();
    if (pagesData.error) throw new Error(pagesData.error.message);

    let pages = pagesData.data || [];

    // Fallback: Página gerenciada via Business Portfolio (Meta Business Suite)
    if (pages.length === 0) {
      const bizRes = await fetch(`${META_BASE}/me/businesses?access_token=${longToken}`);
      const bizData = await bizRes.json();
      if (!bizData.error && bizData.data?.length > 0) {
        for (const biz of bizData.data) {
          const bizPagesRes = await fetch(
            `${META_BASE}/${biz.id}/owned_pages?fields=id,name&access_token=${longToken}`
          );
          const bizPagesData = await bizPagesRes.json();
          if (!bizPagesData.error && bizPagesData.data?.length > 0) {
            for (const p of bizPagesData.data) {
              const ptRes = await fetch(
                `${META_BASE}/${p.id}?fields=access_token,name&access_token=${longToken}`
              );
              const ptData = await ptRes.json();
              if (!ptData.error && ptData.access_token) {
                pages.push({ id: p.id, name: ptData.name || p.name, access_token: ptData.access_token });
              }
            }
            if (pages.length > 0) break;
          }
        }
      }
    }

    if (pages.length === 0) {
      return res.redirect(
        `${FRONTEND_URL}/configuracoes?social=error&msg=${encodeURIComponent("Nenhuma Página do Facebook encontrada. Crie ou gerencie uma Página primeiro.")}`
      );
    }

    // Usa a primeira página encontrada
    const page = pages[0];
    const pageToken = page.access_token;
    const pageId = page.id;
    const pageName = page.name;

    // 4. Busca conta Business do Instagram vinculada à página
    const igRes = await fetch(
      `${META_BASE}/${pageId}?fields=instagram_business_account&access_token=${pageToken}`
    );
    const igData = await igRes.json();
    const instagramBusinessId = igData.instagram_business_account?.id || null;

    // 5. Salva no tenant
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        facebookPageId: pageId,
        // Cifrado em repouso: é credencial da imobiliária, não nossa. Ver `services/cofre.js`.
        facebookPageToken: cifrar(pageToken),
        facebookPageName: pageName,
        instagramBusinessId,
      },
    });

    const igParam = instagramBusinessId ? "&instagram=ok" : "";
    return res.redirect(
      `${FRONTEND_URL}/configuracoes?social=connected&page=${encodeURIComponent(pageName)}${igParam}`
    );
  } catch (err) {
    console.error("[OAuth callback]", err);
    return res.redirect(
      `${FRONTEND_URL}/configuracoes?social=error&msg=${encodeURIComponent(err.message || "Erro ao conectar conta.")}`
    );
  }
});

// ─── GET /api/social/status ───────────────────────────────────────────────────

socialRouter.get("/status", requireTenant, async (req, res) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.tenant.id },
    select: { facebookPageId: true, facebookPageName: true, instagramBusinessId: true },
  });
  return res.json({
    facebook: { connected: Boolean(tenant?.facebookPageId), pageName: tenant?.facebookPageName || null },
    instagram: { connected: Boolean(tenant?.instagramBusinessId) },
  });
});

// ─── DELETE /api/social/disconnect ───────────────────────────────────────────

socialRouter.delete("/disconnect", requireAuth, requireTenant, requirePermissao("editarPagina", "gerenciarUsuarios"), async (req, res) => {
  await prisma.tenant.update({
    where: { id: req.tenant.id },
    data: { facebookPageId: null, facebookPageToken: null, facebookPageName: null, instagramBusinessId: null },
  });
  return res.json({ ok: true });
});

// ─── POST /api/social/publish/:propertyId ────────────────────────────────────

socialRouter.post(
  "/publish/:propertyId",
  requireAuth,
  requireTenant,
  requirePlanoRedes,
  requirePermissao("publicarRedes"),
  async (req, res) => {
    const { propertyId } = req.params;
    const { platforms = [], caption = "", replace = false } = req.body;

    const property = await prisma.property.findFirst({
      where: { id: propertyId, tenantId: req.tenant.id },
      include: { images: { orderBy: { position: "asc" } } },
    });
    if (!property) return res.status(404).json({ error: "Imóvel não encontrado." });

    // Fotos 360° recebem a faixa "IMAGEM 360°" gravada (via Cloudinary) antes de publicar.
    const imageUrls = property.images.map((img) => (img.is360 ? overlay360(img.url) : img.url));

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenant.id },
      select: { facebookPageId: true, facebookPageToken: true, instagramBusinessId: true },
    });

    /* A publicação em si mora em `services/publicacaoSocial.js`.

       Ela saiu daqui quando a publicação automática precisou do mesmo
       comportamento e não havia o que chamar — o código estava preso a `req` e
       `res`. A rota continua sendo quem valida permissão, plano e dono do
       imóvel; o serviço só publica. */
    const results = await publicarNasRedes({
      tenant: { ...tenant, id: req.tenant.id },
      property,
      platforms,
      caption,
      replace,
    });

    return res.json(results);
  }
);

// ─── DELETE /api/social/publish/publication/:publicationId ───────────────────
// Remove UM post específico (por id). Com vários posts por rede, este é o caminho
// usado pela UI para apagar exatamente o post escolhido.

socialRouter.delete(
  "/publish/publication/:publicationId",
  requireAuth,
  requireTenant,
  requirePermissao("publicarRedes"),
  async (req, res) => {
    const { publicationId } = req.params;

    const publication = await prisma.propertyPublication.findFirst({
      where: { id: publicationId, tenantId: req.tenant.id },
    });
    if (!publication) {
      return res.status(404).json({ error: "Publicação não encontrada." });
    }

    let tenant = null;
    if (publication.channel === "FACEBOOK") {
      tenant = await prisma.tenant.findUnique({
        where: { id: req.tenant.id },
        select: { facebookPageToken: true },
      });
    }

    const result = await deleteOnePublication(publication, tenant);
    if (!result.ok) {
      return res.status(502).json({ error: result.error });
    }
    return res.json({ removed: true, deletedFromNetwork: result.deletedFromNetwork, note: result.note });
  }
);

// ─── GET /api/social/publish/publication/:publicationId/insights ─────────────
// Métricas reais (curtidas/comentários/compartilhamentos) do post na rede.

socialRouter.get(
  "/publish/publication/:publicationId/insights",
  requireAuth,
  requireTenant,
  async (req, res) => {
    const { publicationId } = req.params;

    const publication = await prisma.propertyPublication.findFirst({
      where: { id: publicationId, tenantId: req.tenant.id },
    });
    if (!publication) {
      return res.status(404).json({ error: "Publicação não encontrada." });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenant.id },
      select: { facebookPageToken: true },
    });

    const metrics = await fetchPostInsights(publication.channel, publication.externalRef, tokenDaPagina(tenant));
    return res.json(metrics);
  }
);

// ─── DELETE /api/social/publish/:propertyId/:channel ─────────────────────────
// Compat: remove TODOS os posts de um imóvel numa rede (usado como "limpar canal").

socialRouter.delete(
  "/publish/:propertyId/:channel",
  requireAuth,
  requireTenant,
  requirePermissao("publicarRedes"),
  async (req, res) => {
    const { propertyId } = req.params;
    const channel = String(req.params.channel || "").toUpperCase();

    if (!["FACEBOOK", "INSTAGRAM", "WHATSAPP"].includes(channel)) {
      return res.status(400).json({ error: "Canal inválido." });
    }

    const publications = await prisma.propertyPublication.findMany({
      where: { propertyId, channel, tenantId: req.tenant.id },
    });
    if (publications.length === 0) {
      return res.status(404).json({ error: "Publicação não encontrada." });
    }

    let tenant = null;
    if (channel === "FACEBOOK") {
      tenant = await prisma.tenant.findUnique({
        where: { id: req.tenant.id },
        select: { facebookPageToken: true },
      });
    }

    let deletedFromNetwork = false;
    let note;
    for (const pub of publications) {
      const result = await deleteOnePublication(pub, tenant);
      if (!result.ok) {
        return res.status(502).json({ error: result.error });
      }
      if (result.deletedFromNetwork) deletedFromNetwork = true;
      if (result.note) note = result.note;
    }
    return res.json({ removed: true, deletedFromNetwork, note });
  }
);

// ─── POST /api/social/reconcile/:propertyId ──────────────────────────────────
// Confere na Graph API se os posts de um imóvel ainda existem; remove os que sumiram.

socialRouter.post("/reconcile/:propertyId", requireAuth, requireTenant, async (req, res) => {
  const { propertyId } = req.params;

  const tenant = await prisma.tenant.findUnique({
    where: { id: req.tenant.id },
    select: { facebookPageToken: true },
  });

  const publications = await prisma.propertyPublication.findMany({
    where: { propertyId, tenantId: req.tenant.id },
  });

  const removed = await reconcilePublications(publications, tokenDaPagina(tenant));

  const current = await prisma.propertyPublication.findMany({
    where: { propertyId, tenantId: req.tenant.id },
    orderBy: { createdAt: "asc" },
  });

  return res.json({ publications: current, removed });
});

// ─── POST /api/social/reconcile ──────────────────────────────────────────────
// Reconcilia todas as publicações do tenant (acionado pelo botão "Sincronizar redes").

socialRouter.post("/reconcile", requireAuth, requireTenant, async (req, res) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.tenant.id },
    select: { facebookPageToken: true },
  });

  const publications = await prisma.propertyPublication.findMany({
    where: { tenantId: req.tenant.id, status: "PUBLISHED" },
  });

  const removed = await reconcilePublications(publications, tokenDaPagina(tenant));

  return res.json({ removedCount: removed.length, removed });
});
