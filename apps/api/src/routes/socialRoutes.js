import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermissao } from "../middlewares/permissaoMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { requirePlanoRedes } from "../middlewares/planoMiddleware.js";
import { overlay360 } from "../utils/cloudinaryOverlay.js";

const META_APP_ID = process.env.META_APP_ID || "";
const META_APP_SECRET = process.env.META_APP_SECRET || "";
const META_CALLBACK_URL = process.env.META_CALLBACK_URL || "https://api.omnimob.app/api/social/oauth/callback";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://omnimob.app";
const META_API_VERSION = "v19.0";
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

export const socialRouter = Router();

// ─── Helpers de remoção / verificação na Graph API ───────────────────────────

// Refs gerados pelo publisher placeholder (enqueuePropertyPublication) têm a forma
// "facebook-<id>" / "instagram-<id>" / "whatsapp-<id>" e não correspondem a posts reais.
// A reconciliação e a exclusão na rede só fazem sentido para refs reais da Meta.
function isRealMetaRef(ref) {
  if (!ref) return false;
  return !/^(facebook|instagram|whatsapp)-/i.test(ref);
}

// Apaga um post do Facebook via Graph API. Considera "já inexistente" como sucesso.
async function deleteFacebookPost(pageToken, externalRef) {
  try {
    const res = await fetch(`${META_BASE}/${externalRef}?access_token=${encodeURIComponent(pageToken)}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (data?.error) {
      // Objeto já não existe na rede — tratamos como removido com sucesso.
      if (data.error.code === 100 || /does not exist|Unsupported get request/i.test(data.error.message || "")) {
        return { ok: true };
      }
      return { ok: false, error: data.error.message };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Verifica se um objeto ainda existe na Graph API.
// true = existe, false = não existe mais, null = indeterminado (não mexer no status).
async function checkPostExists(token, externalRef) {
  try {
    const res = await fetch(`${META_BASE}/${externalRef}?fields=id&access_token=${encodeURIComponent(token)}`);
    const data = await res.json().catch(() => ({}));
    if (data?.error) {
      if (data.error.code === 100 || res.status === 404 || /does not exist|Unsupported get request/i.test(data.error.message || "")) {
        return false;
      }
      return null; // token expirado / erro transitório — não untrack
    }
    return Boolean(data?.id);
  } catch {
    return null;
  }
}

// Busca as métricas reais de um post na Graph API.
// Facebook: reactions/comments/shares. Instagram: likes/comments (sem shares).
// Retorna { likes, comments, shares } — shares = null quando a rede não expõe.
// available=false quando o ref não é real (post placeholder) ou a chamada falhou.
async function fetchPostInsights(channel, externalRef, token) {
  const zero = { likes: 0, comments: 0, shares: null, available: false };
  if (!token || !isRealMetaRef(externalRef)) return zero;
  try {
    if (channel === "FACEBOOK") {
      const fields = "reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),shares";
      const res = await fetch(`${META_BASE}/${externalRef}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`);
      const data = await res.json().catch(() => ({}));
      if (data?.error) return zero;
      return {
        likes: data?.reactions?.summary?.total_count ?? 0,
        comments: data?.comments?.summary?.total_count ?? 0,
        shares: data?.shares?.count ?? 0,
        available: true,
      };
    }
    if (channel === "INSTAGRAM") {
      const res = await fetch(`${META_BASE}/${externalRef}?fields=like_count,comments_count&access_token=${encodeURIComponent(token)}`);
      const data = await res.json().catch(() => ({}));
      if (data?.error) return zero;
      return {
        likes: data?.like_count ?? 0,
        comments: data?.comments_count ?? 0,
        shares: null, // Instagram não expõe compartilhamentos por API
        available: true,
      };
    }
  } catch {
    return zero;
  }
  return zero;
}

// Reconcilia as publicações PUBLISHED (FB/IG com ref real) de um conjunto: apaga da
// Omnimob as que não existem mais na rede. Retorna a lista de canais removidos.
async function reconcilePublications(publications, token) {
  const removed = [];
  if (!token) return removed;
  for (const pub of publications) {
    if (pub.status !== "PUBLISHED") continue;
    if (pub.channel !== "FACEBOOK" && pub.channel !== "INSTAGRAM") continue;
    if (!isRealMetaRef(pub.externalRef)) continue;
    const exists = await checkPostExists(token, pub.externalRef);
    if (exists === false) {
      await prisma.propertyPublication.delete({ where: { id: pub.id } }).catch(() => {});
      removed.push(pub.channel);
    }
  }
  return removed;
}

// Remove UMA publicação: apaga o post na rede quando a API permite e some com o
// registro na Omnimob. `tenant` precisa trazer facebookPageToken para posts do FB.
// Retorna { ok, deletedFromNetwork, note?, error? }.
async function deleteOnePublication(publication, tenant) {
  const channel = publication.channel;

  // Facebook: exclusão real via Graph API (para refs reais).
  if (channel === "FACEBOOK" && isRealMetaRef(publication.externalRef)) {
    if (!tenant?.facebookPageToken) {
      return { ok: false, error: "Página do Facebook não conectada." };
    }
    const result = await deleteFacebookPost(tenant.facebookPageToken, publication.externalRef);
    if (!result.ok) {
      return { ok: false, error: result.error || "Falha ao remover o post do Facebook." };
    }
    await prisma.propertyPublication.delete({ where: { id: publication.id } });
    return { ok: true, deletedFromNetwork: true };
  }

  // Instagram: a Meta não oferece API de exclusão — apenas paramos de rastrear.
  if (channel === "INSTAGRAM") {
    await prisma.propertyPublication.delete({ where: { id: publication.id } });
    return {
      ok: true,
      deletedFromNetwork: false,
      note: "O Instagram não permite exclusão por API. Apague o post manualmente no app do Instagram.",
    };
  }

  // WhatsApp ou ref placeholder: só remove o registro.
  await prisma.propertyPublication.delete({ where: { id: publication.id } });
  return { ok: true, deletedFromNetwork: false };
}

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

          // "Substituir": só depois de publicar o novo com sucesso é que
          // apagamos os posts anteriores desta rede (assim uma falha não deixa
          // o imóvel sem nenhum anúncio).
          if (replace) {
            const anteriores = await prisma.propertyPublication.findMany({
              where: { propertyId, channel: "FACEBOOK", tenantId: req.tenant.id },
            });
            for (const pub of anteriores) {
              await deleteOnePublication(pub, tenant).catch(() => {});
            }
          }

          const created = await prisma.propertyPublication.create({
            data: { tenantId: req.tenant.id, propertyId, channel: "FACEBOOK", status: "PUBLISHED", externalRef, caption, lastAttemptAt: new Date() },
          });
          results.facebook = { success: true, ref: externalRef, publicationId: created.id };
        } catch (err) {
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

          // "Substituir": para de rastrear os posts anteriores do IG. Como a
          // Meta não permite exclusão por API, guardamos o aviso de exclusão
          // manual para devolver ao cliente.
          let replaceNote;
          if (replace) {
            const anteriores = await prisma.propertyPublication.findMany({
              where: { propertyId, channel: "INSTAGRAM", tenantId: req.tenant.id },
            });
            for (const pub of anteriores) {
              const r = await deleteOnePublication(pub, tenant).catch(() => null);
              if (r?.note) replaceNote = r.note;
            }
          }

          const created = await prisma.propertyPublication.create({
            data: { tenantId: req.tenant.id, propertyId, channel: "INSTAGRAM", status: "PUBLISHED", externalRef, caption, lastAttemptAt: new Date() },
          });
          results.instagram = { success: true, ref: externalRef, publicationId: created.id, note: replaceNote };
        } catch (err) {
          results.instagram = { success: false, error: err.message };
        }
      }
    }

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

    const metrics = await fetchPostInsights(publication.channel, publication.externalRef, tenant?.facebookPageToken);
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

  const removed = await reconcilePublications(publications, tenant?.facebookPageToken);

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

  const removed = await reconcilePublications(publications, tenant?.facebookPageToken);

  return res.json({ removedCount: removed.length, removed });
});
