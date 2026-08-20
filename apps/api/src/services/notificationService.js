import nodemailer from "nodemailer";
import net from "node:net";
import dns from "node:dns/promises";

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

/* Leitores, não constantes. Ver a explicação em `emailTransport`: constante
   congela o ambiente no import, e a ordem de import passa a decidir se o
   produto manda e-mail de verdade durante os testes. */
const chaveResend = () => process.env.RESEND_API_KEY || "";
const usuarioSmtp = () => process.env.SMTP_USER || "notifications@omnimob.app";
const senhaSmtp = () => process.env.SMTP_PASS || "";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.hostinger.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE = process.env.SMTP_SECURE !== "false"; // true para 465
const EMAIL_REMETENTE =
  process.env.EMAIL_REMETENTE || "Omnimob <notifications@omnimob.app>";

// Teto para qualquer tentativa de envio. Segura a resposta HTTP por 10 s no pior
// caso, em vez dos ~2 min que o nodemailer usa por padrão.
const TIMEOUT_MS = 10_000;

let transporter = null;

/* ─── Por que resolvemos o IPv4 na mão ──────────────────────────────────────
   `smtp.hostinger.com` publica os dois registros:

     AAAA  2606:4700:90:0:f225:a1af:129b:4ba1   (Cloudflare)
     A     172.65.255.143

   O nodemailer decide a família olhando as interfaces de rede da máquina
   (shared/index.js, `isFamilySupported`). O container do Render TEM interface
   IPv6, mas não tem rota IPv6 para a internet — então o nodemailer escolhe o
   AAAA e o socket morre na hora com `connect ENETUNREACH ...:465`.

   Não é bloqueio de SMTP da hospedagem, como parecia pelo "Connection timeout"
   que aparecia antes dos timeouts explícitos: pelo IPv4 o mesmo servidor
   responde em menos de 1 s, com certificado válido.

   Por isso resolvemos o A nós mesmos e conectamos pelo IP, passando
   `servername` para o TLS continuar validando pelo NOME — sem ele o
   certificado (CN hostinger.com) não bateria com o IP e a conexão cairia. */
async function criarTransporte({ porta = SMTP_PORT, seguro = SMTP_SECURE } = {}) {
  let host = SMTP_HOST;
  let servername;

  if (!net.isIP(SMTP_HOST)) {
    try {
      const [ipv4] = await dns.resolve4(SMTP_HOST);
      if (ipv4) {
        host = ipv4;
        servername = SMTP_HOST;
      }
    } catch {
      // Sem registro A: segue pelo nome. Se o ambiente tiver IPv6 de verdade,
      // funciona; se não tiver, o erro que aparece é o mesmo de antes — e aí a
      // causa está no DNS do provedor, não aqui.
    }
  }

  return nodemailer.createTransport({
    host,
    port: porta,
    secure: seguro,
    auth: { user: usuarioSmtp(), pass: senhaSmtp() },
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
    ...(servername ? { tls: { servername } } : {}),
  });
}

async function getTransporter() {
  if (!transporter) transporter = await criarTransporte();
  return transporter;
}

/* O IP fica preso no transporter, e o da Hostinger é de CDN — pode mudar. Toda
   falha descarta o transporter para a próxima tentativa resolver de novo, em
   vez de repetir para sempre um endereço que saiu do ar. Custa uma consulta
   DNS por falha. */
function esquecerTransporter() {
  transporter = null;
}

/* Qual transporte está de fato utilizável — serve para log e diagnóstico.

   LÊ O AMBIENTE NA HORA DA CHAMADA, e não as constantes capturadas no topo do
   arquivo. A diferença parece cosmética e não é: as constantes congelam o
   ambiente no instante em que ESTE módulo é importado, e quem importa primeiro
   decide o que vale.

   Foi assim que a suíte de testes passou a mandar e-mail de verdade. O
   `test/helpers.js` apaga `RESEND_API_KEY` justamente para neutralizar o envio,
   mas um arquivo de teste que importe uma rota ANTES do helper carrega esta
   cadeia com a chave ainda no ambiente — e a partir daí todo `sendEmail` sai
   para o mundo, com endereços `@exemplo.test` e imobiliárias `zz-teste-…`.

   Lendo aqui, a ordem de import deixa de importar: o que vale é o ambiente no
   momento do envio, que é quando a decisão realmente é tomada. */
export function emailTransport() {
  /* Trava dura para a suíte de testes. NÃO é redundante com o `delete` das
     variáveis que o `test/helpers.js` faz — apagar não funciona aqui.

     O `new PrismaClient()` RECARREGA o `.env` ao ser construído (ele precisa
     do DATABASE_URL), e o helper o constrói depois de apagar. Resultado:
     `RESEND_API_KEY`, que não existe no `.env` de desenvolvimento, some de
     verdade; `SMTP_USER` e `SMTP_PASS`, que existem, VOLTAM. A suíte passou a
     mandar e-mail real, por SMTP, sobre imobiliárias `zz-teste-…` para a caixa
     de quem estava rodando os testes.

     Um sinalizador resolve porque nada o repõe: ele não está em arquivo
     nenhum, só na memória do processo que o ligou. */
  if (process.env.EMAIL_DESLIGADO === "1") return null;
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.SMTP_USER && process.env.SMTP_PASS) return "smtp";
  return null;
}

/**
 * Abre a conexão com o provedor e autentica, SEM enviar nada.
 *
 * Existe porque a falha de e-mail é invisível: o fluxo do teste grátis engole o
 * erro de propósito (registra o link no log e devolve 202), então a única forma
 * de descobrir que nada é entregue era cadastrar alguém de verdade e conferir a
 * caixa. Com isto dá para responder "o servidor consegue enviar?" em um clique,
 * inclusive depois de trocar porta ou plano de hospedagem.
 */
export async function verificarEmail({ porta, seguro } = {}) {
  const transporte = emailTransport();
  if (!transporte) {
    return { transporte: null, ok: false, detalhe: "Nenhum transporte configurado." };
  }

  /* Porta e modo podem ser sobrescritos só para este teste. Serve para
     descobrir qual porta a hospedagem deixa sair sem precisar mudar variável e
     esperar redeploy a cada tentativa — o ciclo passa de minutos para segundos.

     O HOST continua fixo, de propósito: aceitar host arbitrário transformaria
     este endpoint num scanner de portas operado de dentro do servidor. */
  const avulso = porta !== undefined || seguro !== undefined;
  const inicio = Date.now();
  try {
    if (transporte === "resend") {
      // Endpoint que só lê: confirma que a chave é válida sem gastar envio.
      const controlador = new AbortController();
      const relogio = setTimeout(() => controlador.abort(), TIMEOUT_MS);
      try {
        const r = await fetch("https://api.resend.com/domains", {
          headers: { Authorization: `Bearer ${chaveResend()}` },
          signal: controlador.signal,
        });
        if (!r.ok) throw new Error(`Resend respondeu ${r.status}`);
      } finally {
        clearTimeout(relogio);
      }
    } else {
      const t = avulso ? await criarTransporte({ porta, seguro }) : await getTransporter();
      await t.verify();
      if (avulso) t.close();
    }
    return {
      transporte,
      ok: true,
      ms: Date.now() - inicio,
      ...(avulso ? { testado: `${SMTP_HOST}:${porta ?? SMTP_PORT} (seguro=${seguro ?? SMTP_SECURE})` } : {}),
    };
  } catch (erro) {
    if (transporte === "smtp" && !avulso) esquecerTransporter();
    const detalhe = erro.name === "AbortError" ? `sem resposta em ${TIMEOUT_MS / 1000}s` : erro.message;
    return {
      transporte,
      ok: false,
      ms: Date.now() - inicio,
      detalhe,
      host: transporte === "smtp" ? `${SMTP_HOST}:${porta ?? SMTP_PORT}` : "api.resend.com",
    };
  }
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
        Authorization: `Bearer ${chaveResend()}`,
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
  const transporte = await getTransporter();
  const info = await transporte.sendMail({
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
    if (transporte === "smtp") esquecerTransporter();
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
