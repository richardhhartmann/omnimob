import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.hostinger.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE = process.env.SMTP_SECURE !== "false"; // true para 465
const SMTP_USER = process.env.SMTP_USER || "notifications@omnimob.app";
const SMTP_PASS = process.env.SMTP_PASS || "";
const EMAIL_REMETENTE =
  process.env.EMAIL_REMETENTE || "Omnimob <notifications@omnimob.app>";

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }

  return transporter;
}

export function isEmailEnabled() {
  return Boolean(SMTP_USER && SMTP_PASS);
}

function envelope(channel, to, payload, status = "queued") {
  return {
    channel,
    to,
    status,
    queuedAt: new Date().toISOString(),
    payload,
  };
}

export async function sendEmail({ to, subject, body, html, replyTo }) {
  if (!isEmailEnabled()) {
    console.warn(
      `[notification:email] SMTP não configurado para ${to} :: ${subject}`,
    );
    return envelope("email", to, { subject, body });
  }

  try {
    const info = await getTransporter().sendMail({
      from: EMAIL_REMETENTE,
      to: Array.isArray(to) ? to.join(", ") : to,
      subject,
      text: body,
      ...(html ? { html } : {}),
      ...(replyTo ? { replyTo } : {}),
    });

    console.log(`[notification:email] enviado → ${to} :: ${subject}`);
    return envelope(
      "email",
      to,
      { subject, id: info.messageId },
      "sent",
    );
  } catch (erro) {
    console.error(
      `[notification:email] falhou → ${to}: ${erro.message}`,
    );
    return envelope(
      "email",
      to,
      { subject, body, erro: erro.message },
      "failed",
    );
  }
}

// mantém os outros métodos iguais
export async function sendWhatsApp({ to, message }) {
  console.log(`[notification:whatsapp] → ${to}`);
  return envelope("whatsapp", to, { message });
}

export async function sendPush({ to, title, body }) {
  console.log(`[notification:push] → ${to} :: ${title}`);
  return envelope("push", to, { title, body });
}

export async function sendSms({ to, message }) {
  console.log(`[notification:sms] → ${to}`);
  return envelope("sms", to, { message });
}