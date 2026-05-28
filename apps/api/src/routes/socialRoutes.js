import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermissao } from "../middlewares/permissaoMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

const META_APP_ID = process.env.META_APP_ID || "";
const META_APP_SECRET = process.env.META_APP_SECRET || "";
const META_CALLBACK_URL = process.env.META_CALLBACK_URL || "http://localhost:4000/api/social/oauth/callback";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const META_API_VERSION = "v19.0";
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

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
      data: { facebookPageId: pageId, facebookPageToken: pageToken, facebookPageName: pageName, instagramBusinessId },
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
  requirePermissao("publicarRedes"),
  async (req, res) => {
    const { propertyId } = req.params;
    const { platforms = [], caption = "" } = req.body;

    const property = await prisma.property.findFirst({
      where: { id: propertyId, tenantId: req.tenant.id },
      include: { images: { orderBy: { position: "asc" } } },
    });
    if (!property) return res.status(404).json({ error: "Imóvel não encontrado." });

    const imageUrls = property.images.map((img) => img.url);

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenant.id },
      select: { facebookPageId: true, facebookPageToken: true, instagramBusinessId: true },
    });

    const results = {};

    // ── Facebook ──
    if (platforms.includes("facebook")) {
      if (!tenant?.facebookPageId) {
        results.facebook = { success: false, error: "Página do Facebook não conectada." };
      } else {
        try {
          let externalRef;

          if (imageUrls.length === 0) {
            // Sem fotos — post de texto
            const fbRes = await fetch(`${META_BASE}/${tenant.facebookPageId}/feed`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ message: caption, access_token: tenant.facebookPageToken }),
            });
            const fbData = await fbRes.json();
            if (fbData.error) throw new Error(fbData.error.message);
            externalRef = String(fbData.id || "");

          } else if (imageUrls.length === 1) {
            // Uma foto
            const fbRes = await fetch(`${META_BASE}/${tenant.facebookPageId}/photos`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url: imageUrls[0], caption, access_token: tenant.facebookPageToken }),
            });
            const fbData = await fbRes.json();
            if (fbData.error) throw new Error(fbData.error.message);
            externalRef = String(fbData.id || fbData.post_id || "");

          } else {
            // Múltiplas fotos — upload individual não-publicado + feed post
            const attachedMedia = [];
            for (const url of imageUrls) {
              const photoRes = await fetch(`${META_BASE}/${tenant.facebookPageId}/photos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url, published: false, access_token: tenant.facebookPageToken }),
              });
              const photoData = await photoRes.json();
              if (photoData.error) throw new Error(photoData.error.message);
              attachedMedia.push({ media_fbid: String(photoData.id) });
            }
            const fbRes = await fetch(`${META_BASE}/${tenant.facebookPageId}/feed`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ message: caption, attached_media: attachedMedia, access_token: tenant.facebookPageToken }),
            });
            const fbData = await fbRes.json();
            if (fbData.error) throw new Error(fbData.error.message);
            externalRef = String(fbData.id || "");
          }

          await prisma.propertyPublication.upsert({
            where: { propertyId_channel: { propertyId, channel: "FACEBOOK" } },
            create: { tenantId: req.tenant.id, propertyId, channel: "FACEBOOK", status: "PUBLISHED", externalRef, lastAttemptAt: new Date() },
            update: { status: "PUBLISHED", externalRef, errorMessage: null, lastAttemptAt: new Date() },
          });
          results.facebook = { success: true, ref: externalRef };
        } catch (err) {
          await prisma.propertyPublication.upsert({
            where: { propertyId_channel: { propertyId, channel: "FACEBOOK" } },
            create: { tenantId: req.tenant.id, propertyId, channel: "FACEBOOK", status: "FAILED", errorMessage: err.message, lastAttemptAt: new Date() },
            update: { status: "FAILED", errorMessage: err.message, lastAttemptAt: new Date() },
          });
          results.facebook = { success: false, error: err.message };
        }
      }
    }

    // ── Instagram ──
    if (platforms.includes("instagram")) {
      if (!tenant?.instagramBusinessId) {
        results.instagram = { success: false, error: "Conta Business do Instagram não conectada." };
      } else if (imageUrls.length === 0) {
        results.instagram = { success: false, error: "Imóvel sem foto. O Instagram exige ao menos uma imagem." };
      } else {
        try {
          let containerId;

          if (imageUrls.length === 1) {
            // Imagem única
            const createRes = await fetch(`${META_BASE}/${tenant.instagramBusinessId}/media`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ image_url: imageUrls[0], caption, access_token: tenant.facebookPageToken }),
            });
            const createData = await createRes.json();
            if (createData.error) throw new Error(createData.error.message);
            containerId = createData.id;

          } else {
            // Carrossel (máx 10 itens)
            const carouselUrls = imageUrls.slice(0, 10);
            const childIds = [];
            for (const url of carouselUrls) {
              const itemRes = await fetch(`${META_BASE}/${tenant.instagramBusinessId}/media`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image_url: url, is_carousel_item: true, access_token: tenant.facebookPageToken }),
              });
              const itemData = await itemRes.json();
              if (itemData.error) throw new Error(itemData.error.message);
              childIds.push(itemData.id);
            }
            const carouselRes = await fetch(`${META_BASE}/${tenant.instagramBusinessId}/media`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                media_type: "CAROUSEL",
                children: childIds.join(","),
                caption,
                access_token: tenant.facebookPageToken,
              }),
            });
            const carouselData = await carouselRes.json();
            if (carouselData.error) throw new Error(carouselData.error.message);
            containerId = carouselData.id;
          }

          // Publica o container
          const publishRes = await fetch(`${META_BASE}/${tenant.instagramBusinessId}/media_publish`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ creation_id: containerId, access_token: tenant.facebookPageToken }),
          });
          const publishData = await publishRes.json();
          if (publishData.error) throw new Error(publishData.error.message);

          const externalRef = String(publishData.id || "");
          await prisma.propertyPublication.upsert({
            where: { propertyId_channel: { propertyId, channel: "INSTAGRAM" } },
            create: { tenantId: req.tenant.id, propertyId, channel: "INSTAGRAM", status: "PUBLISHED", externalRef, lastAttemptAt: new Date() },
            update: { status: "PUBLISHED", externalRef, errorMessage: null, lastAttemptAt: new Date() },
          });
          results.instagram = { success: true, ref: externalRef };
        } catch (err) {
          await prisma.propertyPublication.upsert({
            where: { propertyId_channel: { propertyId, channel: "INSTAGRAM" } },
            create: { tenantId: req.tenant.id, propertyId, channel: "INSTAGRAM", status: "FAILED", errorMessage: err.message, lastAttemptAt: new Date() },
            update: { status: "FAILED", errorMessage: err.message, lastAttemptAt: new Date() },
          });
          results.instagram = { success: false, error: err.message };
        }
      }
    }

    return res.json(results);
  }
);
