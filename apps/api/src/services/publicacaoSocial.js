import { prisma } from "../db.js";
import { overlay360 } from "../utils/cloudinaryOverlay.js";
import { decifrar } from "./cofre.js";

/* ────────────────────────────────────────────────────────────────────────────
   Publicar imóvel no Facebook e no Instagram.

   ── POR QUE ISTO SAIU DA ROTA ──

   Estava tudo dentro de `socialRoutes.js`, no corpo do handler. Funcionava — e
   funcionava só para quem clicava no botão. Quando a publicação automática
   precisou do mesmo comportamento, não havia o que chamar: o código estava
   preso a `req` e a `res`.

   Aqui ele não sabe que existe HTTP. A rota continua sendo quem valida
   permissão, plano e dono do imóvel; este arquivo só publica.

   ── O QUE ELE FAZ DE DIFERENTE POR REDE ──

   FACEBOOK aceita post sem foto, com uma foto, ou álbum. São três chamadas
   diferentes à Graph API, e a escolha é pela quantidade de imagens.

   INSTAGRAM exige ao menos uma foto e trabalha em duas etapas: cria o
   contêiner de mídia, depois publica. Com várias fotos, cada uma vira um item
   e o carrossel os agrupa.

   ── "SUBSTITUIR" NÃO APAGA NO INSTAGRAM ──

   A Meta não permite excluir post do Instagram por API. Substituir ali para de
   RASTREAR o post antigo, e a mensagem devolvida diz isso — prometer exclusão
   deixaria dois anúncios no ar com um deles invisível para o produto.
   ──────────────────────────────────────────────────────────────────────────── */

export function tokenDaPagina(tenant) {
  return decifrar(tenant?.facebookPageToken) || null;
}

const META_API_VERSION = "v19.0";
export const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;


// ─── Helpers de remoção / verificação na Graph API ───────────────────────────

// Refs gerados pelo publisher placeholder (enqueuePropertyPublication) têm a forma
// "facebook-<id>" / "instagram-<id>" / "whatsapp-<id>" e não correspondem a posts reais.
// A reconciliação e a exclusão na rede só fazem sentido para refs reais da Meta.
export function isRealMetaRef(ref) {
  if (!ref) return false;
  return !/^(facebook|instagram|whatsapp)-/i.test(ref);
}

// Apaga um post do Facebook via Graph API. Considera "já inexistente" como sucesso.
export async function deleteFacebookPost(pageToken, externalRef) {
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
export async function checkPostExists(token, externalRef) {
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
export async function fetchPostInsights(channel, externalRef, token) {
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
export async function reconcilePublications(publications, token) {
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
export async function deleteOnePublication(publication, tenant) {
  const channel = publication.channel;

  // Facebook: exclusão real via Graph API (para refs reais).
  if (channel === "FACEBOOK" && isRealMetaRef(publication.externalRef)) {
    if (!tokenDaPagina(tenant)) {
      return { ok: false, error: "Página do Facebook não conectada." };
    }
    const result = await deleteFacebookPost(tokenDaPagina(tenant), publication.externalRef);
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

/* ── Esperar o contêiner do Instagram ficar pronto ───────────────────────────

   O Instagram não recebe a imagem quando criamos o contêiner: ele vai BUSCAR a
   URL, baixar e preparar. Publicar antes disso devolve
   "Media ID is not available" — que foi exatamente o erro do primeiro teste.

   A documentação da Meta manda consultar `status_code` até `FINISHED`. Sem
   isso, o fluxo funciona por sorte (imagem pequena, rede boa) e falha em
   produção.

   Intervalo de 2s e teto de 60s. A Meta sugere uma consulta por minuto por até
   cinco, mas isso é para vídeo; foto costuma ficar pronta em segundos, e aqui
   há alguém esperando do outro lado — um minuto parado seria a tela travada.

   `ERROR` e `EXPIRED` lançam em vez de seguir: publicar um contêiner que a Meta
   já recusou devolve um erro genérico, e a mensagem que chega ao painel deixa
   de dizer o que houve. */
const INTERVALO_CONTAINER_MS = 2000;
const TETO_CONTAINER_MS = 60000;

async function esperarContainer(containerId, token) {
  const limite = Date.now() + TETO_CONTAINER_MS;

  while (Date.now() < limite) {
    const url = `${META_BASE}/${containerId}?fields=status_code&access_token=${encodeURIComponent(token)}`;
    const r = await fetch(url);
    const d = await r.json().catch(() => ({}));
    if (d.error) throw new Error(d.error.message);

    const situacao = d.status_code || "IN_PROGRESS";
    if (situacao === "FINISHED" || situacao === "PUBLISHED") return;
    if (situacao === "ERROR") {
      throw new Error(
        "O Instagram não conseguiu processar a imagem. Ela precisa ser JPEG, com proporção entre 4:5 e 1.91:1.",
      );
    }
    if (situacao === "EXPIRED") {
      throw new Error("O prazo para publicar esta mídia expirou. Tente de novo.");
    }

    await new Promise((resolver) => setTimeout(resolver, INTERVALO_CONTAINER_MS));
  }

  throw new Error(
    "O Instagram ainda estava preparando a imagem depois de um minuto. Tente publicar de novo em instantes.",
  );
}

/**
 * Publica um imóvel nas redes escolhidas.
 *
 * @param {object} p
 * @param {object} p.tenant   precisa de facebookPageId, facebookPageToken, instagramBusinessId
 * @param {object} p.property com `images` incluídas
 * @param {string[]} p.platforms  "facebook" e/ou "instagram"
 * @param {string} p.caption
 * @param {boolean} p.replace  substituir posts anteriores deste imóvel
 * @returns {Promise<object>} resultado por rede
 */
export async function publicarNasRedes({ tenant, property, platforms = [], caption = "", replace = false }) {
  const propertyId = property.id;
  const imageUrls = (property.images || []).map((img) => (img.is360 ? overlay360(img.url) : img.url));

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
                body: JSON.stringify({ message: caption, access_token: tokenDaPagina(tenant) }),
              });
              const fbData = await fbRes.json();
              if (fbData.error) throw new Error(fbData.error.message);
              externalRef = String(fbData.id || "");

            } else if (imageUrls.length === 1) {
              // Uma foto
              const fbRes = await fetch(`${META_BASE}/${tenant.facebookPageId}/photos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: imageUrls[0], caption, access_token: tokenDaPagina(tenant) }),
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
                  body: JSON.stringify({ url, published: false, access_token: tokenDaPagina(tenant) }),
                });
                const photoData = await photoRes.json();
                if (photoData.error) throw new Error(photoData.error.message);
                attachedMedia.push({ media_fbid: String(photoData.id) });
              }
              const fbRes = await fetch(`${META_BASE}/${tenant.facebookPageId}/feed`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: caption, attached_media: attachedMedia, access_token: tokenDaPagina(tenant) }),
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
                where: { propertyId, channel: "FACEBOOK", tenantId: tenant.id },
              });
              for (const pub of anteriores) {
                await deleteOnePublication(pub, tenant).catch(() => {});
              }
            }

            const created = await prisma.propertyPublication.create({
              data: { tenantId: tenant.id, propertyId, channel: "FACEBOOK", status: "PUBLISHED", externalRef, caption, lastAttemptAt: new Date() },
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
                body: JSON.stringify({ image_url: imageUrls[0], caption, access_token: tokenDaPagina(tenant) }),
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
                  body: JSON.stringify({ image_url: url, is_carousel_item: true, access_token: tokenDaPagina(tenant) }),
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
                  access_token: tokenDaPagina(tenant),
                }),
              });
              const carouselData = await carouselRes.json();
              if (carouselData.error) throw new Error(carouselData.error.message);
              containerId = carouselData.id;
            }

            // Espera o contêiner ficar pronto — ver a função esperarContainer.
            await esperarContainer(containerId, tokenDaPagina(tenant));

            // Publica o container
            const publishRes = await fetch(`${META_BASE}/${tenant.instagramBusinessId}/media_publish`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ creation_id: containerId, access_token: tokenDaPagina(tenant) }),
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
                where: { propertyId, channel: "INSTAGRAM", tenantId: tenant.id },
              });
              for (const pub of anteriores) {
                const r = await deleteOnePublication(pub, tenant).catch(() => null);
                if (r?.note) replaceNote = r.note;
              }
            }

            const created = await prisma.propertyPublication.create({
              data: { tenantId: tenant.id, propertyId, channel: "INSTAGRAM", status: "PUBLISHED", externalRef, caption, lastAttemptAt: new Date() },
            });
            results.instagram = { success: true, ref: externalRef, publicationId: created.id, note: replaceNote };
          } catch (err) {
            results.instagram = { success: false, error: err.message };
          }
        }
      }
  return results;
}
