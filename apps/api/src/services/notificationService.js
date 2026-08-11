import nodemailer from "nodemailer";

/* ─── Transporte de e-mail ───────────────────────────────────────────────────
   Dois caminhos, nesta ordem de preferência:

     1. Resend (HTTPS)  — usado sempre que RESEND_API_KEY existir
     2. SMTP (nodemailer) — só se não houver chave do Resend

   A ordem não é gosto: no Render a conexão SMTP de saída não completa, e o
   sintoma é cruel — `Connection timeout` depois de ~2 min (o padrão do
   nodemailer), com a requisição HTTP inteira presa esperando, porque o envio do
   convite de teste é aguardado antes da resposta. O Resend fala HTTPS, que é a
   única porta de saída com a qual dá para contar em PaaS.

   Para o Resend entregar a terceiros, o domínio do remetente precisa estar
   verificado no painel deles (registros DNS). Sem verificar, só chega no e-mail
   dono da conta — e o resto sai como "failed", que o fluxo do trial já trata
   registrando o link no log em vez de quebrar.

   Os timeouts explícitos do SMTP ficam de qualquer jeito: se um dia alguém
   voltar para esse caminho, é melhor falhar em 10 s do que segurar a resposta
   por dois minutos. */

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.hostinger.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE = process.env.SMTP_SECURE !== "false"; // true para 465
const SMTP_USER = process.env.SMTP_USER || "notifications@omnimob.app";
const SMTP_PASS = process.env.SMTP_PASS || "";
const EMAIL_REMETENTE =
  process.env.EMAIL_REMETENTE || "Omnimob <notifications@omnimob.app>";

// Teto para qualquer tentativa de envio. Segura a resposta HTTP por 10 s no pior
// caso, em vez dos ~2 min que o nodemailer usa por padrão.
const TIMEOUT_MS = 10_000;

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      connectionTimeout: TIMEOUT_MS,
      greetingTimeout: TIMEOUT_MS,
      socketTimeout: TIMEOUT_MS,
    });
  }

  return transporter;
}

/** Qual transporte está de fato utilizável — serve para log e diagnóstico. */
export function emailTransport() {
  if (RESEND_API_KEY) return "resend";
  if (SMTP_USER && SMTP_PASS) return "smtp";
  return null;
}

export function isEmailEnabled() {
  return emailTransport() !== null;
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

async function viaResend({ to, subject, body, html, replyTo }) {
  const controlador = new AbortController();
  const relogio = setTimeout(() => controlador.abort(), TIMEOUT_MS);
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
      signal: controlador.signal,
    });

    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      // A mensagem do Resend costuma dizer exatamente o que falta (domínio não
      // verificado, remetente inválido); repassar inteira poupa adivinhação.
      throw new Error(dados.message || `Resend respondeu ${resposta.status}`);
    }
    return dados.id;
  } finally {
    clearTimeout(relogio);
  }
}

async function viaSmtp({ to, subject, body, html, replyTo }) {
  const info = await getTransporter().sendMail({
    from: EMAIL_REMETENTE,
    to: Array.isArray(to) ? to.join(", ") : to,
    subject,
    text: body,
    ...(html ? { html } : {}),
    ...(replyTo ? { replyTo } : {}),
  });
  return info.messageId;
}

export async function sendEmail({ to, subject, body, html, replyTo }) {
  const transporte = emailTransport();

  if (!transporte) {
    console.warn(
      `[notification:email] sem transporte configurado para ${to} :: ${subject}` +
        " — defina RESEND_API_KEY (recomendado) ou SMTP_USER + SMTP_PASS",
    );
    return envelope("email", to, { subject, body });
  }

  try {
    const id =
      transporte === "resend"
        ? await viaResend({ to, subject, body, html, replyTo })
        : await viaSmtp({ to, subject, body, html, replyTo });

    console.log(`[notification:email] enviado por ${transporte} → ${to} :: ${subject}`);
    return envelope("email", to, { subject, id }, "sent");
  } catch (erro) {
    const motivo = erro.name === "AbortError" ? `sem resposta em ${TIMEOUT_MS / 1000}s` : erro.message;
    console.error(`[notification:email] falhou por ${transporte} → ${to}: ${motivo}`);
    return envelope("email", to, { subject, body, erro: motivo }, "failed");
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
