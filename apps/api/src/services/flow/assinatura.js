import crypto from "node:crypto";
import { decifrar } from "../cofre.js";

/* ────────────────────────────────────────────────────────────────────────────
   ASSINATURA DIGITAL — um contrato, dois provedores.

   ── POR QUE UM ADAPTADOR, E NÃO A INTEGRAÇÃO DIRETA ──

   Porque a escolha do fornecedor é do CLIENTE, não nossa. Uma imobiliária de
   São Paulo já tem conta na Clicksign; uma que atende estrangeiro já paga
   DocuSign. Cravar um dos dois no motor de contratos transformaria "trocar de
   fornecedor" em "reescrever o módulo", e a conversa comercial que hoje é uma
   variável de ambiente viraria um projeto.

   O resto do sistema NUNCA fala com Clicksign nem com DocuSign. Ele fala com
   quatro verbos:

     enviar(contrato, signatarios)  → cria o documento e convoca quem assina
     consultar(contrato)            → o estado agora, direto da fonte
     cancelar(contrato)             → tira o documento de circulação
     lerWebhook(corpo, cabecalhos)  → traduz o aviso do provedor

   Provedor novo é um objeto novo aqui e mais nada.

   ── CLICKSIGN É O PADRÃO ──

   O produto é inteiro em português, cobra em real e atende imobiliária
   brasileira. A Clicksign também aceita assinatura por WhatsApp e por token de
   SMS, que é como o comprador de imóvel de fato assina no Brasil — a DocuSign
   assume e-mail corporativo, que metade dos clientes não usa.

   ── ⚠ ESCRITO CONTRA A DOCUMENTAÇÃO, NÃO VERIFICADO CONTRA A API REAL ──

   Mesma situação de `mercadoLivre.js`, e pelo mesmo motivo: verificar exige
   conta de produção contratada nos dois fornecedores. Os pontos em que a
   documentação é ambígua estão marcados REVISAR. O que ESTÁ verificado é o que
   não depende deles: a tradução de estado, a assinatura do webhook, a
   idempotência e o comportamento quando a API responde qualquer coisa.
   ──────────────────────────────────────────────────────────────────────────── */

/* Teto por chamada. Provedor lento não pode segurar a requisição do painel: a
   pessoa clicou em "enviar para assinatura" e precisa de uma resposta, ainda
   que seja "não consegui, tente de novo". Dez segundos é o mesmo teto do envio
   de e-mail (`notificationService`). */
const TEMPO_LIMITE_MS = 10_000;

async function pedir(url, opcoes = {}) {
  const controle = new AbortController();
  const t = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
  try {
    const r = await fetch(url, { ...opcoes, signal: controle.signal });
    const texto = await r.text();
    /* Corpo que não é JSON é o caso comum quando algo dá errado: gateway
       devolvendo HTML, proxy devolvendo texto puro. `JSON.parse` cru
       transformaria isso numa exceção sem mensagem útil, e o painel mostraria
       "Unexpected token < in JSON". */
    let corpo = null;
    try { corpo = texto ? JSON.parse(texto) : null; } catch { corpo = { bruto: texto }; }
    if (!r.ok) {
      const erro = new Error(corpo?.message || corpo?.errors?.[0]?.detail || `HTTP ${r.status}`);
      erro.status = r.status;
      erro.corpo = corpo;
      throw erro;
    }
    return corpo;
  } finally {
    clearTimeout(t);
  }
}

/* ── Tradução de estado ───────────────────────────────────────────────────────

   Cada provedor tem o vocabulário dele. O nosso é o enum `ContratoStatus`, e a
   tradução mora aqui — se cada rota traduzisse, a tela do contrato e o webhook
   discordariam sobre o que "running" significa.

   Estado desconhecido devolve `null` e o chamador MANTÉM o que tinha. É
   deliberado: provedor acrescenta estado sem avisar, e o pior desfecho seria um
   contrato assinado voltar para RASCUNHO porque chegou uma palavra nova. */
const ESTADO_CLICKSIGN = {
  running: "ENVIADO",
  closed: "ASSINADO",
  canceled: "CANCELADO",
  cancelled: "CANCELADO",
};

const ESTADO_DOCUSIGN = {
  sent: "ENVIADO",
  delivered: "ENVIADO",
  completed: "ASSINADO",
  declined: "RECUSADO",
  voided: "CANCELADO",
};

/* ═══════════════════════════════════════════════════════════════════════════
   CLICKSIGN
   ═══════════════════════════════════════════════════════════════════════════ */

const clicksign = {
  nome: "clicksign",
  rotulo: "Clicksign",

  base(cfg) {
    return cfg.sandbox ? "https://sandbox.clicksign.com" : "https://app.clicksign.com";
  },

  async enviar({ cfg, contrato, signatarios }) {
    const base = this.base(cfg);
    const q = `?access_token=${encodeURIComponent(cfg.token)}`;

    /* O corpo vai como data URI em base64. A Clicksign aceita HTML e nós
       mandamos HTML, e não PDF: gerar PDF no servidor pediria headless Chrome
       ou uma biblioteca de layout, e o que temos é texto corrido com quebras de
       linha. HTML preserva a formatação e o provedor converte. */
    const html = corpoEmHtml(contrato.titulo, contrato.corpo);
    const conteudo = `data:text/html;base64,${Buffer.from(html, "utf8").toString("base64")}`;

    const doc = await pedir(`${base}/api/v1/documents${q}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        document: {
          /* REVISAR: a documentação pede um caminho começando por "/" e
             terminando na extensão. O nome inclui o id do contrato para dois
             envios do mesmo negócio não colidirem na pasta do cliente. */
          path: `/Omnimob/${contrato.id}.html`,
          content_base64: conteudo,
          deadline_at: null,
          auto_close: true,
          locale: "pt-BR",
        },
      }),
    });

    const chaveDoc = doc?.document?.key;
    if (!chaveDoc) throw new Error("A Clicksign não devolveu a chave do documento.");

    const criados = [];
    for (const s of signatarios) {
      const signer = await pedir(`${base}/api/v1/signers${q}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          signer: {
            email: s.email,
            name: s.nome,
            documentation: s.documento || null,
            /* REVISAR: `auths` aceita "email", "sms", "whatsapp". E-mail é o
               denominador comum e não exige telefone cadastrado — subir para
               SMS sem ter o número resultaria em erro por signatário. */
            auths: ["email"],
            delivery: "email",
          },
        }),
      });
      const chaveSigner = signer?.signer?.key;

      await pedir(`${base}/api/v1/lists${q}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          list: {
            document_key: chaveDoc,
            signer_key: chaveSigner,
            sign_as: papelClicksign(s.papel),
            message: `Contrato ${contrato.titulo} — assinatura solicitada.`,
          },
        }),
      });

      criados.push({ id: s.id, chaveExterna: chaveSigner, urlAssinatura: null });
    }

    return {
      documentoExterno: chaveDoc,
      urlDocumento: `${base}/documents/${chaveDoc}`,
      signatarios: criados,
    };
  },

  async consultar({ cfg, contrato }) {
    const base = this.base(cfg);
    const q = `?access_token=${encodeURIComponent(cfg.token)}`;
    const r = await pedir(`${base}/api/v1/documents/${contrato.documentoExterno}${q}`, {
      headers: { Accept: "application/json" },
    });

    const doc = r?.document || {};
    const assinados = (doc.signatures || [])
      .filter((s) => s.signed_at)
      .map((s) => ({ chaveExterna: s.signer?.key || s.key, assinadoEm: s.signed_at }));

    return {
      status: ESTADO_CLICKSIGN[doc.status] ?? null,
      urlAssinado: doc.downloads?.signed_file_url || null,
      assinados,
    };
  },

  async cancelar({ cfg, contrato }) {
    const base = this.base(cfg);
    const q = `?access_token=${encodeURIComponent(cfg.token)}`;
    await pedir(`${base}/api/v1/documents/${contrato.documentoExterno}/cancel${q}`, {
      method: "PATCH",
      headers: { Accept: "application/json" },
    });
    return { status: "CANCELADO" };
  },

  /* O webhook da Clicksign assina o corpo com HMAC-SHA256 usando o segredo
     configurado no painel DELES. Conferimos sempre: sem isso, qualquer um que
     descubra a URL marca contrato como assinado — que é a falha mais grave que
     este módulo poderia ter. */
  lerWebhook({ corpoBruto, cabecalhos, segredoWebhook }) {
    const assinatura = cabecalhos["content-hmac"] || cabecalhos["Content-Hmac"];
    if (segredoWebhook) {
      const esperado = "sha256=" + crypto.createHmac("sha256", segredoWebhook).update(corpoBruto).digest("hex");
      if (!assinaturaConfere(assinatura, esperado)) {
        return { valido: false, motivo: "Assinatura do webhook não confere." };
      }
    }

    let corpo;
    try { corpo = JSON.parse(corpoBruto); } catch { return { valido: false, motivo: "Corpo inválido." }; }

    const doc = corpo?.document || {};
    return {
      valido: true,
      documentoExterno: doc.key || null,
      status: ESTADO_CLICKSIGN[doc.status] ?? null,
      urlAssinado: doc.downloads?.signed_file_url || null,
      /* `signer.key` no evento de assinatura individual — é ele que casa com
         `ContratoSignatario.chaveExterna`. */
      signatarioAssinou: corpo?.event?.name === "sign" ? corpo?.signer?.key || null : null,
    };
  },
};

function papelClicksign(papel) {
  /* REVISAR: a lista de `sign_as` da Clicksign é fechada e não bate um-a-um com
     a nossa. "party" (parte) é o guarda-chuva certo para comprador e vendedor;
     testemunha e procurador têm valor próprio. */
  switch (papel) {
    case "TESTEMUNHA": return "witness";
    case "PROCURADOR": return "attorney";
    case "IMOBILIARIA": return "intervening";
    default: return "party";
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   DOCUSIGN
   ═══════════════════════════════════════════════════════════════════════════ */

const docusign = {
  nome: "docusign",
  rotulo: "DocuSign",

  base(cfg) {
    return cfg.sandbox ? "https://demo.docusign.net" : "https://www.docusign.net";
  },

  cabecalhos(cfg) {
    return {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  },

  async enviar({ cfg, contrato, signatarios }) {
    if (!cfg.conta) throw new Error("Falta o Account ID da DocuSign.");
    const url = `${this.base(cfg)}/restapi/v2.1/accounts/${cfg.conta}/envelopes`;

    const html = corpoEmHtml(contrato.titulo, contrato.corpo);

    const r = await pedir(url, {
      method: "POST",
      headers: this.cabecalhos(cfg),
      body: JSON.stringify({
        emailSubject: `Assinatura: ${contrato.titulo}`,
        status: "sent",
        documents: [{
          documentBase64: Buffer.from(html, "utf8").toString("base64"),
          name: contrato.titulo,
          fileExtension: "html",
          documentId: "1",
        }],
        recipients: {
          signers: signatarios.map((s, i) => ({
            email: s.email,
            name: s.nome,
            /* `recipientId` é o que volta no webhook. Usamos o índice+1 e
               guardamos como `chaveExterna` — é o único identificador que a
               DocuSign devolve de forma estável no envelope. */
            recipientId: String(i + 1),
            routingOrder: String(s.ordem ?? i + 1),
            tabs: {
              signHereTabs: [{
                /* REVISAR: âncora textual. O modelo inicial termina com linhas
                   de assinatura, e a DocuSign posiciona o campo sobre a
                   primeira ocorrência do texto. Se a minuta do cliente não
                   tiver a âncora, o envelope vai sem campo posicionado e o
                   signatário posiciona sozinho — degrada, não quebra. */
                anchorString: "_______________________________",
                anchorUnits: "pixels",
                anchorYOffset: "-6",
                anchorIgnoreIfNotPresent: "true",
              }],
            },
          })),
        },
      }),
    });

    return {
      documentoExterno: r?.envelopeId || null,
      urlDocumento: r?.uri ? `${this.base(cfg)}${r.uri}` : null,
      signatarios: signatarios.map((s, i) => ({
        id: s.id, chaveExterna: String(i + 1), urlAssinatura: null,
      })),
    };
  },

  async consultar({ cfg, contrato }) {
    const base = `${this.base(cfg)}/restapi/v2.1/accounts/${cfg.conta}/envelopes/${contrato.documentoExterno}`;
    const env = await pedir(base, { headers: this.cabecalhos(cfg) });
    const dest = await pedir(`${base}/recipients`, { headers: this.cabecalhos(cfg) }).catch(() => null);

    const assinados = (dest?.signers || [])
      .filter((s) => s.status === "completed")
      .map((s) => ({ chaveExterna: String(s.recipientId), assinadoEm: s.signedDateTime || null }));

    return {
      status: ESTADO_DOCUSIGN[env?.status] ?? null,
      urlAssinado: null, // baixado à parte via /documents/combined
      assinados,
    };
  },

  async cancelar({ cfg, contrato }) {
    const url = `${this.base(cfg)}/restapi/v2.1/accounts/${cfg.conta}/envelopes/${contrato.documentoExterno}`;
    await pedir(url, {
      method: "PUT",
      headers: this.cabecalhos(cfg),
      body: JSON.stringify({ status: "voided", voidedReason: "Cancelado pela imobiliária no Omnimob Flow." }),
    });
    return { status: "CANCELADO" };
  },

  lerWebhook({ corpoBruto, cabecalhos, segredoWebhook }) {
    /* DocuSign Connect assina em `x-docusign-signature-1`, HMAC-SHA256 em
       base64 (a Clicksign usa hex — daí as duas implementações não
       compartilharem a conferência). */
    if (segredoWebhook) {
      const assinatura = cabecalhos["x-docusign-signature-1"];
      const esperado = crypto.createHmac("sha256", segredoWebhook).update(corpoBruto).digest("base64");
      if (!assinaturaConfere(assinatura, esperado)) {
        return { valido: false, motivo: "Assinatura do webhook não confere." };
      }
    }

    let corpo;
    try { corpo = JSON.parse(corpoBruto); } catch { return { valido: false, motivo: "Corpo inválido." }; }

    const dados = corpo?.data || {};
    return {
      valido: true,
      documentoExterno: dados.envelopeId || null,
      status: ESTADO_DOCUSIGN[dados.envelopeSummary?.status || corpo?.event?.replace("envelope-", "")] ?? null,
      urlAssinado: null,
      signatarioAssinou: corpo?.event === "recipient-completed"
        ? String(dados.recipientId ?? "") || null
        : null,
    };
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   O DESPACHANTE
   ═══════════════════════════════════════════════════════════════════════════ */

const PROVEDORES = { clicksign, docusign };

export const PROVEDORES_DISPONIVEIS = [
  { chave: "clicksign", rotulo: "Clicksign", pais: "Brasil", padrao: true },
  { chave: "docusign", rotulo: "DocuSign", pais: "Internacional", padrao: false },
];

export function provedorDe(nome) {
  return PROVEDORES[String(nome || "clicksign").toLowerCase()] || null;
}

/**
 * A configuração DESTA imobiliária, com o token já decifrado.
 *
 * O token vive cifrado em repouso (`services/cofre.js`, AES-256-GCM) como o
 * token da página do Facebook, e nunca sai nas respostas da API — quem filtra é
 * `SEGREDOS_DO_TENANT` em `tenantRoutes`. Aqui é o único lugar que o abre, e
 * ele não é devolvido para fora deste módulo.
 */
export function configDoTenant(tenant) {
  const nome = tenant?.assinaturaProvedor || null;
  if (!nome) return null;
  const token = tenant.assinaturaToken ? decifrar(tenant.assinaturaToken) : null;
  if (!token) return null;
  return {
    provedor: nome,
    token,
    conta: tenant.assinaturaConta || null,
    sandbox: tenant.assinaturaSandbox !== false,
  };
}

/** A imobiliária tem assinatura digital configurada e utilizável? */
export function assinaturaConfigurada(tenant) {
  const cfg = configDoTenant(tenant);
  return Boolean(cfg && provedorDe(cfg.provedor));
}

/* ── Comparação de assinatura em tempo constante ─────────────────────────────
   `===` em string vaza o número de bytes iguais pelo tempo de execução, e é o
   caminho clássico para forjar um HMAC byte a byte. `timingSafeEqual` exige
   buffers do MESMO tamanho — daí a conferência de comprimento antes, que é
   informação pública (o tamanho de um SHA-256 é sempre o mesmo). */
function assinaturaConfere(recebida, esperada) {
  if (!recebida || !esperada) return false;
  const a = Buffer.from(String(recebida));
  const b = Buffer.from(String(esperada));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/* O contrato é texto corrido com quebras de linha; os provedores querem um
   documento. HTML mínimo, com fonte serifada e margem de papel — é o que faz o
   PDF que o cliente recebe parecer um contrato e não um e-mail.

   Escapa o conteúdo: o corpo veio de um campo de texto do painel, e uma minuta
   com `<script>` dentro não pode virar HTML executável no visualizador do
   provedor. Mesma regra de `previaRoutes.js`. */
function corpoEmHtml(titulo, corpo) {
  const esc = (t) => String(t || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${esc(titulo)}</title>
<style>
  @page { margin: 2.5cm 2cm; }
  body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.6; color: #000; }
  pre { font-family: inherit; font-size: inherit; white-space: pre-wrap; word-wrap: break-word; margin: 0; }
</style></head><body><pre>${esc(corpo)}</pre></body></html>`;
}

export const _internos = { corpoEmHtml, assinaturaConfere, ESTADO_CLICKSIGN, ESTADO_DOCUSIGN };
