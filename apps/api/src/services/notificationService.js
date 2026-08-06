/**
 * ─── Notification Service ────────────────────────────────────────────────────
 * Interface única de notificações (e-mail, WhatsApp, Push, SMS) prevista na
 * arquitetura. WhatsApp, Push e SMS continuam stubs: registram a intenção e
 * devolvem um envelope "enfileirado".
 *
 * E-mail já tem provedor real (Resend, pela API HTTP com `fetch` — mesmo padrão
 * do aiService, sem SDK). Sem RESEND_API_KEY configurada o envio cai no modo
 * antigo: registra em log e devolve status "queued". Quem chama DEVE olhar o
 * status — "queued" não é entrega.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const EMAIL_REMETENTE = process.env.EMAIL_REMETENTE || "Domus <onboarding@resend.dev>";

export function isEmailEnabled() {
  return Boolean(RESEND_API_KEY);
}

function envelope(channel, to, payload, status = "queued") {
  return {
    channel,
    to,
    status, // "queued" (sem provedor) | "sent" | "failed"
    queuedAt: new Date().toISOString(),
    payload,
  };
}

export async function sendEmail({ to, subject, body, html, replyTo }) {
  if (!RESEND_API_KEY) {
    console.warn(
      `[notification:email] SEM PROVEDOR — nada foi enviado para ${to} :: ${subject}\n` +
        `Configure RESEND_API_KEY para o envio sair de verdade. Conteúdo:\n${body}`,
    );
    return envelope("email", to, { subject, body });
  }

  try {
    const resposta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_REMETENTE,
        to: Array.isArray(to) ? to : [to],
        subject,
        text: body,
        ...(html ? { html } : {}),
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text().catch(() => "");
      console.error(`[notification:email] falhou (${resposta.status}) → ${to}: ${detalhe}`);
      return envelope("email", to, { subject, body, erro: detalhe }, "failed");
    }

    const dados = await resposta.json().catch(() => ({}));
    console.log(`[notification:email] enviado → ${to} :: ${subject}`);
    return envelope("email", to, { subject, id: dados?.id }, "sent");
  } catch (erro) {
    console.error(`[notification:email] erro de rede → ${to}: ${erro.message}`);
    return envelope("email", to, { subject, body, erro: erro.message }, "failed");
  }
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
