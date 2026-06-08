import crypto from "crypto";
import { Router } from "express";
import { prisma } from "../db.js";

const META_APP_SECRET = process.env.META_APP_SECRET || "";
const META_WEBHOOK_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || "";

// Router do webhook do Meta. É montado ANTES do express.json() no server.js e usa
// express.raw para preservar o corpo cru exigido pela validação de assinatura.
export const socialWebhookRouter = Router();

// ─── GET /api/social/webhook ─────────────────────────────────────────────────
// Handshake de verificação do Meta (App Dashboard → Webhooks).

socialWebhookRouter.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && META_WEBHOOK_VERIFY_TOKEN && token === META_WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(String(challenge ?? ""));
  }
  return res.sendStatus(403);
});

// Confere a assinatura X-Hub-Signature-256 (HMAC-SHA256 do corpo cru com o app secret).
function assinaturaValida(req) {
  const signature = req.get("x-hub-signature-256");
  if (!signature || !META_APP_SECRET) return false;
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || "");
  const expected = "sha256=" + crypto.createHmac("sha256", META_APP_SECRET).update(raw).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// Acha a publicação FACEBOOK cujo externalRef corresponde ao post_id do evento.
// Posts de foto única guardam o id da foto (diferente do post_id "<pageId>_<postId>"),
// por isso o match é best-effort. A reconciliação sob demanda cobre o que escapar daqui.
function refCombina(externalRef, postId) {
  if (!externalRef || !postId) return false;
  return (
    externalRef === postId ||
    postId.endsWith(`_${externalRef}`) ||
    externalRef.endsWith(`_${postId.split("_").pop()}`)
  );
}

// ─── POST /api/social/webhook ────────────────────────────────────────────────
// Recebe eventos do Meta. Trata remoção de post de Página (feed / verb "remove").

socialWebhookRouter.post("/", async (req, res) => {
  if (!assinaturaValida(req)) return res.sendStatus(401);

  let payload;
  try {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body || "");
    payload = JSON.parse(raw);
  } catch {
    return res.sendStatus(400);
  }

  // Responde rápido; processa em seguida.
  res.sendStatus(200);

  if (payload?.object !== "page" || !Array.isArray(payload.entry)) return;

  for (const entry of payload.entry) {
    for (const change of entry.changes || []) {
      if (change.field !== "feed") continue;
      const value = change.value || {};
      if (value.verb !== "remove" || !value.post_id) continue;

      try {
        const candidatas = await prisma.propertyPublication.findMany({
          where: { channel: "FACEBOOK", status: "PUBLISHED" },
          select: { id: true, externalRef: true },
        });
        const alvo = candidatas.find((p) => refCombina(p.externalRef, value.post_id));
        if (alvo) {
          await prisma.propertyPublication.delete({ where: { id: alvo.id } }).catch(() => {});
        }
      } catch (err) {
        console.error("[webhook feed remove]", err);
      }
    }
  }
});
