/**
 * ─── Notification Service ────────────────────────────────────────────────────
 * Interface única de notificações (e-mail, WhatsApp, Push, SMS) prevista na
 * arquitetura. Hoje são stubs desacoplados: registram a intenção e devolvem um
 * envelope "enfileirado". Cada canal será plugado a um provedor real (ex.:
 * Resend/SES para e-mail, WhatsApp Business API, FCM para push) sem alterar
 * quem chama este serviço.
 */

function envelope(channel, to, payload) {
  return {
    channel,
    to,
    status: "queued", // no futuro: integração real → "sent" | "failed"
    queuedAt: new Date().toISOString(),
    payload,
  };
}

export async function sendEmail({ to, subject, body }) {
  console.log(`[notification:email] → ${to} :: ${subject}`);
  // TODO: integrar provedor de e-mail (Resend / Amazon SES).
  return envelope("email", to, { subject, body });
}

export async function sendWhatsApp({ to, message }) {
  console.log(`[notification:whatsapp] → ${to}`);
  // TODO: integrar WhatsApp Business API (Meta).
  return envelope("whatsapp", to, { message });
}

export async function sendPush({ to, title, body }) {
  console.log(`[notification:push] → ${to} :: ${title}`);
  // TODO: integrar FCM / Web Push.
  return envelope("push", to, { title, body });
}

export async function sendSms({ to, message }) {
  console.log(`[notification:sms] → ${to}`);
  // TODO: integrar provedor de SMS (caso necessário).
  return envelope("sms", to, { message });
}
