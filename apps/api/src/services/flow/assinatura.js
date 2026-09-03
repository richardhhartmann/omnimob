import crypto from "node:crypto";
import { decifrar } from "../cofre.js";
import { textoParaPdf } from "./pdf.js";

/* ────────────────────────────────────────────────────────────────────────────
   ASSINATURA DIGITAL — um contrato, três provedores.

   ── POR QUE UM ADAPTADOR, E NÃO A INTEGRAÇÃO DIRETA ──

   Porque a escolha do fornecedor é do CLIENTE, não nossa. Uma imobiliária de
   São Paulo já tem conta na Clicksign; uma que atende estrangeiro já paga
   DocuSign. Cravar um dos dois no motor de contratos transformaria "trocar de
   fornecedor" em "reescrever o módulo", e a conversa comercial que hoje é uma
   variável de ambiente viraria um projeto.

   O resto do sistema NUNCA fala com fornecedor nenhum. Ele fala com quatro
   verbos:

     enviar(contrato, signatarios)  → cria o documento e convoca quem assina
     consultar(contrato)            → o estado agora, direto da fonte
     cancelar(contrato)             → tira o documento de circulação
     lerWebhook(corpo, cabecalhos)  → traduz o aviso do provedor

   Provedor novo é um objeto novo aqui e mais nada.

   ── AUTENTIQUE É O PADRÃO, E O MOTIVO É PREÇO ──

   Ela tem camada gratuita (~10 documentos/mês). Sem isso, "use o Omniflow"
   significava "contrate também a Clicksign", e o módulo que vendemos como
   completo dependia da fatura de outra empresa para fechar um negócio.

   Clicksign continua em pé e é a mais completa das três — assina por WhatsApp e
   por token de SMS, que é como o comprador de imóvel de fato assina no Brasil.
   Quem já tem conta lá não troca. A DocuSign atende quem vende para
   estrangeiro; ela assume e-mail corporativo, que metade dos clientes não usa.

   ── O ESTADO DA VERIFICAÇÃO ──

   A CLICKSIGN foi verificada contra a API de produção, e o caminho completo
   (documento → signatário → lista → notificação → e-mail entregue) roda. Três
   coisas que a documentação não deixava claras e que só a conta real mostrou,
   todas já corrigidas aqui:

     · ela NÃO aceita HTML — pdf, doc/docx, png/jpeg ou txt (daí o `pdf.js`);
     · vincular signatário NÃO avisa ninguém — a notificação é chamada à parte;
     · o sandbox é uma CONTA SEPARADA, com token próprio. Token de produção em
       `sandbox.clicksign.com` volta como "Access Token inválido", que lê como
       token errado quando o errado é o ambiente.

   Some daí a armadilha de operação: o painel da Clicksign exige um "e-mail do
   usuário da API" configurado ANTES de o token valer, e o token gerado antes
   disso continua órfão — é preciso gerar outro depois de salvar o e-mail.

   A DOCUSIGN continua ⚠ ESCRITA CONTRA A DOCUMENTAÇÃO, não verificada: exige
   conta de produção contratada. Os pontos dúbios dela seguem marcados REVISAR.
   ──────────────────────────────────────────────────────────────────────────── */

/* Teto por chamada. Provedor lento não pode segurar a requisição do painel: a
   pessoa clicou em "enviar para assinatura" e precisa de uma resposta, ainda
   que seja "não consegui, tente de novo". Dez segundos é o mesmo teto do envio
   de e-mail (`notificationService`). */
const TEMPO_LIMITE_MS = 10_000;

/* ── A RECUSA PRECISA CHEGAR EM PORTUGUÊS, E COM O CAMPO ────────────────────
 *
 * A extração era `corpo?.message || corpo?.errors?.[0]?.detail`, e a segunda
 * metade nunca casava com a Clicksign: ela devolve `errors` como um OBJETO
 * indexado por CAMPO — `{ "document.path": ["não pode ficar em branco"] }` —,
 * não como um array de `{ detail }`. O `?.[0]` num objeto é `undefined`, então
 * toda recusa dela chegava ao painel como "HTTP 422": o número do problema, sem
 * o problema.
 *
 * É a informação mais cara da integração inteira. Sem ela, "não consigo enviar
 * para assinatura" vira tentativa e erro contra uma API de terceiro; com ela, a
 * tela diz qual campo o provedor recusou e a pessoa resolve sozinha.
 *
 * As quatro formas cobertas são as que os dois provedores usam de fato:
 *   { message }                        DocuSign, e a Clicksign em erro geral
 *   { errors: { campo: [msg, …] } }    Clicksign (validação)
 *   { errors: [{ detail | message }] } formato JSON:API, que a Clicksign usa
 *                                      em algumas rotas
 *   { bruto: "…" }                     corpo que nem JSON era (gateway, proxy)
 */
function mensagemDoProvedor(corpo) {
  if (!corpo || typeof corpo !== "object") return null;
  if (typeof corpo.message === "string" && corpo.message.trim()) return corpo.message.trim();

  const e = corpo.errors;
  if (Array.isArray(e) && e.length) {
    const partes = e.map((x) => (typeof x === "string" ? x : x?.detail || x?.message)).filter(Boolean);
    if (partes.length) return partes.join(" · ");
  }
  if (e && typeof e === "object") {
    /* Campo e mensagem juntos: "document.path não pode ficar em branco" diz
       onde mexer; "não pode ficar em branco" sozinho não diz nada. */
    const partes = Object.entries(e)
      .map(([campo, msgs]) => `${campo} ${[].concat(msgs).filter(Boolean).join(", ")}`.trim())
      .filter(Boolean);
    if (partes.length) return partes.join(" · ");
  }

  if (typeof corpo.error === "string" && corpo.error.trim()) return corpo.error.trim();
  /* Corpo que não era JSON. Cortado, porque costuma ser uma página HTML inteira
     de gateway e ela não cabe num toast. */
  if (typeof corpo.bruto === "string" && corpo.bruto.trim()) {
    return corpo.bruto.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180) || null;
  }
  return null;
}

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
      const erro = new Error(mensagemDoProvedor(corpo) || `HTTP ${r.status}`);
      erro.status = r.status;
      erro.corpo = corpo;
      /* ── 429 NÃO É RECUSA, É "AGORA NÃO" ──────────────────────────────────
         A Clicksign devolve um "Too many requests" seco, e ele chegava ao
         painel assim: uma frase em inglês que não diz o que fazer. Quem lê
         conclui que o contrato foi rejeitado e vai mexer no documento — quando
         a ação certa é esperar e clicar de novo.

         O teto dela é de 50 chamadas por janela, e um envio gasta 1 + 2 por
         signatário (documento, signatário, lista). Ninguém esbarra nisso
         mandando contrato; esbarra quem está DEPURANDO uma integração, que é
         exatamente quando a mensagem precisa ser clara.

         `x-rate-limit-reset` vem em época Unix (segundos). Quando ele não vem,
         a frase sai sem o prazo em vez de sair com um número inventado. */
      if (r.status === 429) {
        const reset = Number(r.headers.get("x-rate-limit-reset"));
        const faltam = Number.isFinite(reset) ? Math.ceil(reset - Date.now() / 1000) : NaN;
        const prazo = Number.isFinite(faltam) && faltam > 0 && faltam < 3600
          ? ` Tente de novo em ${faltam < 60 ? `${faltam} segundo(s)` : `${Math.ceil(faltam / 60)} minuto(s)`}.`
          : " Tente de novo em alguns minutos.";
        erro.message = `O provedor recebeu chamadas demais e pediu uma pausa.${prazo} Nada foi enviado — o contrato continua como rascunho.`;
        erro.limiteDeTaxa = true;
      }
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

    /* ── O CORPO VAI COMO PDF ──────────────────────────────────────────────
       Aqui havia HTML, com um comentário afirmando que "a Clicksign aceita
       HTML". Ela não aceita, e disse isso com todas as letras na primeira
       chamada real:

         "Documento deve ser em formato pdf, Word (doc e docx),
          Imagens (png ou jpeg) ou Texto (txt)"

       É o primeiro dos pontos REVISAR deste arquivo a encostar na API de
       verdade, e caiu. `services/flow/pdf.js` monta o PDF sem dependência
       nova — e, de brinde, conserta o alinhamento do bloco de assinaturas,
       que o `<pre>` em Times New Roman quebrava de qualquer jeito. */
    const pdf = textoParaPdf(contrato.titulo, contrato.corpo);
    const conteudo = `data:application/pdf;base64,${pdf.toString("base64")}`;

    const doc = await pedir(`${base}/api/v1/documents${q}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        document: {
          /* O caminho começa por "/" e termina na extensão, que precisa BATER
             com o mime do `content_base64` — a Clicksign decide o formato pela
             extensão. O nome inclui o id do contrato para dois envios do mesmo
             negócio não colidirem na pasta do cliente. */
          path: `/Omnimob/${contrato.id}.pdf`,
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
    const semAviso = [];
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

      const lista = await pedir(`${base}/api/v1/lists${q}`, {
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

      /* ── A CHAVE DO PEDIDO É O QUE VALE, E NÃO A DO SIGNATÁRIO ────────────
         `signer.key` identifica a PESSOA no cadastro da imobiliária; ela pode
         assinar dez contratos e a chave é a mesma. `request_signature_key`
         identifica ESTE pedido de assinatura DESTE documento — é ela que vira
         a URL onde se assina, e era ela que estava sendo descartada com um
         `urlAssinatura: null` cravado no código. */
      const chavePedido = lista?.list?.request_signature_key || null;

      /* ── VINCULAR NÃO AVISA NINGUÉM ───────────────────────────────────────
         Este foi o defeito mais silencioso da integração inteira: os três
         passos acima devolviam 200, o contrato virava ENVIADO, o painel dizia
         "aguardando assinatura" — e o signatário nunca soube que existia um
         contrato. Os eventos do documento na Clicksign mostravam só `upload` e
         `add_signer`, nunca um envio.

         Na v1 a notificação é uma chamada à parte. Ela responde 202 (aceito
         para envio), e não 200, porque o e-mail sai numa fila do lado deles.

         A DocuSign não precisa do equivalente: lá o envelope nasce com
         `status: "sent"` e ela mesma dispara os e-mails.

         Falhar aqui NÃO derruba o envio. O documento existe, os signatários
         estão vinculados e — agora que a guardamos — a URL de assinatura está
         no painel para ser mandada por WhatsApp. Derrubar deixaria um
         documento órfão do lado da Clicksign e um contrato em RASCUNHO do
         nosso, que é o pior dos dois mundos. O que não pode é o silêncio: quem
         não foi avisado sobe na resposta. */
      if (chavePedido) {
        try {
          await pedir(`${base}/api/v1/notifications${q}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
              request_signature_key: chavePedido,
              message: `Contrato ${contrato.titulo} — assinatura solicitada.`,
            }),
          });
        } catch (erro) {
          semAviso.push(`${s.nome || s.email} (${erro?.message || erro})`);
        }
      } else {
        semAviso.push(`${s.nome || s.email} (a Clicksign não devolveu a chave do pedido)`);
      }

      criados.push({
        id: s.id,
        chaveExterna: chaveSigner,
        urlAssinatura: chavePedido ? `${base}/sign/${chavePedido}` : null,
      });
    }

    return {
      documentoExterno: chaveDoc,
      urlDocumento: `${base}/documents/${chaveDoc}`,
      signatarios: criados,
      semAviso,
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
   AUTENTIQUE
   ═══════════════════════════════════════════════════════════════════════════

   A opção com camada GRATUITA — ~10 documentos por mês, e é ela que responde
   "para usar o Omniflow eu preciso pagar outra empresa?". Para uma imobiliária
   pequena, dez contratos por mês é o mês inteiro.

   ── TUDO ABAIXO FOI VERIFICADO CONTRA A API REAL ──

   Por introspecção do schema e por documentos criados de verdade, e não contra
   a documentação. Quatro coisas que só o teste mostrou, e as quatro mudariam o
   código se tivessem sido supostas:

     1. O AUTOR ENTRA NO ARRAY DE ASSINATURAS. Um documento com um signatário
        volta com DOIS itens em `signatures`: o autor (dono da conta, com
        `action: null` e `name: null`) e o signatário de verdade. Contar
        `signatures.length` daria uma parte fantasma que nunca assina, e
        NENHUM contrato jamais chegaria a ASSINADO — logo nenhum negócio
        chegaria a GANHO. Quem conta certo é `signatures_count`, que já exclui
        o autor; quem separa é `action != null`.

     2. NÃO EXISTE CAMPO `status`. O estado é derivado de `signed_count`,
        `rejected_count` e `deleted_at`. Clicksign e DocuSign entregam uma
        palavra; aqui a palavra é nossa.

     3. `deleteDocument` APAGA, não cancela. Depois dele o documento some e a
        consulta responde `document_not_found` — que aqui é traduzido para
        CANCELADO em vez de virar erro de integração num contrato que só foi
        cancelado.

     4. O E-MAIL SAI SOZINHO no `createDocument`, ao contrário da Clicksign.
        A exceção é o próprio dono da conta: para ele a Autentique não manda
        pedido de assinatura, porque o painel dele já é a tela de assinar.
        Isso custou uma hora de investigação e não está escrito em lugar
        nenhum — o sintoma é "não chega e-mail", idêntico a integração
        quebrada.

   ── O SANDBOX É UMA FLAG, E NÃO OUTRA CONTA ──

   `sandbox: true` no próprio `createDocument`, com o mesmo token. É melhor que
   a Clicksign, onde sandbox é conta separada com token próprio — e onde um
   token de produção apontado para o sandbox volta como "Access Token
   inválido", que lê como token errado quando o errado é o ambiente.

   Documento de sandbox não consome cota, é apagado depois de alguns dias e
   NÃO dispara e-mail. */

const URL_AUTENTIQUE = "https://api.autentique.com.br/v2/graphql";

/* ── O erro do GraphQL não vem no código HTTP ────────────────────────────────
   Ele responde 200 com `errors` no corpo, então `pedir()` — que decide pelo
   `r.ok` — deixaria passar como sucesso. Daí este caminho próprio.

   O formato de validação deles é um terceiro, diferente das quatro formas que
   `mensagemDoProvedor` já cobre: `extensions.validation` indexado por CAMPO,
   com o caminho dentro da variável (`signers.0.email`). Sem traduzir isso, a
   recusa chega ao painel como a palavra "validation", sozinha. */
function mensagemAutentique(json) {
  const erros = Array.isArray(json?.errors) ? json.errors : [];
  const partes = [];
  for (const e of erros) {
    const val = e?.extensions?.validation;
    if (val && typeof val === "object") {
      for (const [campo, msgs] of Object.entries(val)) {
        partes.push(`${campo}: ${[].concat(msgs).filter(Boolean).join(", ")}`);
      }
    } else if (e?.message) {
      partes.push(e.message);
    }
  }
  return partes.length ? partes.join(" · ") : null;
}

async function gqlAutentique(cfg, query, variables = {}, arquivo = null) {
  const controle = new AbortController();
  const t = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
  try {
    let corpoDaRequisicao;
    const cabecalhos = { Authorization: `Bearer ${cfg.token}` };

    if (arquivo) {
      /* Upload em GraphQL segue a graphql-multipart-request-spec: uma parte
         `operations` com a consulta (o arquivo entra como null), uma parte
         `map` dizendo qual parte binária preenche qual variável, e a parte
         binária. O `Content-Type` NÃO é definido à mão — o `FormData` nativo
         precisa gerar o boundary, e cravá-lo quebra o parse do outro lado. */
      const form = new FormData();
      form.append("operations", JSON.stringify({ query, variables }));
      form.append("map", JSON.stringify({ 0: ["variables.file"] }));
      form.append("0", new Blob([arquivo.conteudo], { type: "application/pdf" }), arquivo.nome);
      corpoDaRequisicao = form;
    } else {
      cabecalhos["Content-Type"] = "application/json";
      corpoDaRequisicao = JSON.stringify({ query, variables });
    }

    const r = await fetch(URL_AUTENTIQUE, {
      method: "POST",
      headers: cabecalhos,
      body: corpoDaRequisicao,
      signal: controle.signal,
    });

    const texto = await r.text();
    let json = null;
    try { json = texto ? JSON.parse(texto) : null; } catch { json = null; }

    if (!json) {
      const erro = new Error(`A Autentique respondeu algo que não era JSON (HTTP ${r.status}).`);
      erro.status = r.status;
      throw erro;
    }
    if (json.errors?.length) {
      const erro = new Error(mensagemAutentique(json) || `HTTP ${r.status}`);
      erro.status = r.status;
      erro.corpo = json;
      /* `document_not_found` é esperado depois de um cancelamento — quem chama
         precisa distingui-lo de uma falha de verdade. */
      erro.naoEncontrado = json.errors.some((e) => e?.message === "document_not_found");
      throw erro;
    }
    return json.data;
  } finally {
    clearTimeout(t);
  }
}

/* A lista fechada de `ActionEnum` não tem equivalente para procurador nem para
   interveniente; os dois assinam como parte, que é o que de fato fazem no
   documento. Testemunha tem valor próprio e é a única que se distingue. */
function papelAutentique(papel) {
  return papel === "TESTEMUNHA" ? "SIGN_AS_A_WITNESS" : "SIGN";
}

/** Só os signatários DE VERDADE — o autor entra na lista com `action: null`. */
function assinaturasReais(doc) {
  return (doc?.signatures || []).filter((s) => s?.action?.name);
}

/* ── A DERIVAÇÃO DE ESTADO, SEPARADA E PURA ──────────────────────────────────
   Fora da chamada de rede de propósito, porque é aqui que mora o risco do
   provedor inteiro: a Autentique não tem campo `status`, então esta função é a
   única fonte da verdade sobre "este contrato está assinado?". Errar para menos
   trava um negócio que já fechou; errar para mais deixa fechar um negócio cujo
   contrato ninguém assinou — e é a segunda que a trava do funil existe para
   impedir.

   Pura para ser varrida por `test/assinaturaAutentique.test.js` sem tocar na
   API, do mesmo jeito que `podeFechar` é varrida sem tocar no banco. */
export function estadoAutentique(doc) {
  const reais = assinaturasReais(doc);
  const assinados = reais
    .filter((s) => s.signed?.created_at)
    .map((s) => ({ chaveExterna: s.public_id, assinadoEm: s.signed.created_at }));

  /* `signatures_count` é a contagem DELES e já exclui o autor — conferido num
     documento real com autor + um signatário, onde ele veio 1. É a fonte
     preferida; `reais.length` fica como rede para quando o campo não vier.

     Recusa vem ANTES de assinatura: um documento com uma parte que recusou não
     fecha, mesmo que as outras já tenham assinado. */
  const total = Number(doc?.signatures_count ?? reais.length) || 0;
  const assinadas = Number(doc?.signed_count ?? assinados.length) || 0;

  let status = "ENVIADO";
  if (doc?.deleted_at) status = "CANCELADO";
  else if (Number(doc?.rejected_count) > 0) status = "RECUSADO";
  else if (total > 0 && assinadas >= total) status = "ASSINADO";

  return { status, assinados };
}

const CAMPOS_ASSINATURA = `
  public_id
  name
  email
  action { name }
  link { short_link }
  viewed { created_at }
  signed { created_at }
  rejected { created_at }
`;

const autentique = {
  nome: "autentique",
  rotulo: "Autentique",

  async enviar({ cfg, contrato, signatarios }) {
    const pdf = textoParaPdf(contrato.titulo, contrato.corpo);

    const query = `
      mutation ($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
        createDocument(sandbox: ${cfg.sandbox ? "true" : "false"}, document: $document, signers: $signers, file: $file) {
          id
          signatures { ${CAMPOS_ASSINATURA} }
        }
      }`;

    const dados = await gqlAutentique(cfg, query, {
      document: {
        name: contrato.titulo,
        message: `Contrato ${contrato.titulo} — assinatura solicitada.`,
        /* A página de auditoria é o que dá valor probatório ao documento: IP,
           carimbo de tempo e o histórico de cada assinatura. Sem ela sobra um
           PDF com um nome digitado. */
        show_audit_page: true,
      },
      signers: signatarios.map((s) => ({
        name: s.nome,
        email: s.email,
        action: papelAutentique(s.papel),
        /* Entrega por E-MAIL, e não por link: é ela que faz a Autentique
           avisar sozinha. O link de reserva vem logo abaixo, por
           `createLinkToSignature` — que funciona mesmo com entrega por e-mail,
           e é o que permite ter as duas coisas. */
        delivery_method: "DELIVERY_METHOD_EMAIL",
      })),
      file: null,
    }, { conteudo: pdf, nome: `${contrato.id}.pdf` });

    const doc = dados?.createDocument;
    if (!doc?.id) throw new Error("A Autentique não devolveu o id do documento.");

    /* O casamento é por E-MAIL, e não por posição: o autor é inserido no meio
       da lista pela própria Autentique e desalinharia qualquer índice. */
    const porEmail = new Map(
      assinaturasReais(doc).map((s) => [String(s.email || "").toLowerCase(), s]),
    );

    const criados = [];
    for (const s of signatarios) {
      const achado = porEmail.get(String(s.email || "").toLowerCase());
      let link = achado?.link?.short_link || null;

      /* Com entrega por e-mail o `link` volta nulo na criação. Ele é pedido à
         parte para a imobiliária ter como mandar por WhatsApp quando o e-mail
         não chega — que é o desfecho mais comum de "o cliente sumiu". Falhar
         aqui não derruba nada: o e-mail já foi. */
      if (!link && achado?.public_id) {
        try {
          const r = await gqlAutentique(
            cfg,
            "mutation ($p: UUID!) { createLinkToSignature(public_id: $p) { short_link } }",
            { p: achado.public_id },
          );
          link = r?.createLinkToSignature?.short_link || null;
        } catch { link = null; }
      }

      criados.push({ id: s.id, chaveExterna: achado?.public_id || null, urlAssinatura: link });
    }

    return {
      documentoExterno: doc.id,
      urlDocumento: `https://painel.autentique.com.br/documentos/${doc.id}`,
      signatarios: criados,
      /* A Autentique notifica no próprio `createDocument` — verificado com um
         documento real. Não há passo de aviso que possa falhar em separado,
         como o da Clicksign. */
      semAviso: [],
    };
  },

  async consultar({ cfg, contrato }) {
    const query = `
      query ($id: UUID!) {
        document(id: $id) {
          signatures_count
          signed_count
          rejected_count
          deleted_at
          files { signed pades }
          signatures { ${CAMPOS_ASSINATURA} }
        }
      }`;

    let doc;
    try {
      const dados = await gqlAutentique(cfg, query, { id: contrato.documentoExterno });
      doc = dados?.document;
    } catch (erro) {
      /* Cancelar, aqui, é apagar. Um contrato que já cancelamos volta como
         `document_not_found`, e tratar isso como falha encheria a tela de erro
         de integração num documento que está exatamente como deveria. */
      if (erro?.naoEncontrado) return { status: "CANCELADO", urlAssinado: null, assinados: [] };
      throw erro;
    }
    if (!doc) return { status: null, urlAssinado: null, assinados: [] };

    const { status, assinados } = estadoAutentique(doc);

    return {
      status,
      /* ── SÓ QUANDO ESTÁ ASSINADO DE VERDADE ────────────────────────────────
         `files.signed` é um permalink e existe desde a criação, mesmo sem
         ninguém ter assinado — ao contrário da Clicksign, onde o link só
         aparece com o documento fechado. Devolvê-lo cru faria o painel oferecer
         "baixar contrato assinado" num contrato pendente, e quem clicasse
         baixaria a minuta em branco achando que era o documento firmado.

         `pades` é o PDF com a assinatura digital embutida no padrão PAdES;
         `signed` é o visual, com a página de auditoria — é esse que a
         imobiliária manda para o cliente, e o que as outras integrações
         devolvem neste campo. */
      urlAssinado: status === "ASSINADO" ? (doc.files?.signed || doc.files?.pades || null) : null,
      assinados,
    };
  },

  async cancelar({ cfg, contrato }) {
    /* ⚠ Isto APAGA o documento — não existe "cancelado" na Autentique. É
       irreversível do lado deles, e é por isso que a consulta acima traduz
       `document_not_found` em CANCELADO: depois daqui, é a única resposta que
       o documento sabe dar. */
    await gqlAutentique(
      cfg,
      "mutation ($id: UUID!) { deleteDocument(id: $id) }",
      { id: contrato.documentoExterno },
    );
    return { status: "CANCELADO" };
  },

  lerWebhook({ corpoBruto, cabecalhos, segredoWebhook }) {
    /* HMAC-SHA256 em hex, sem prefixo — a Clicksign usa "sha256=" na frente e a
       DocuSign usa base64. Três formatos, três conferências; é o motivo de elas
       não compartilharem código. */
    if (segredoWebhook) {
      const assinatura = cabecalhos["x-autentique-signature"] || cabecalhos["X-Autentique-Signature"];
      const esperado = crypto.createHmac("sha256", segredoWebhook).update(corpoBruto).digest("hex");
      if (!assinaturaConfere(assinatura, esperado)) {
        return { valido: false, motivo: "Assinatura do webhook não confere." };
      }
    }

    let corpo;
    try { corpo = JSON.parse(corpoBruto); } catch { return { valido: false, motivo: "Corpo inválido." }; }

    const evento = corpo?.event?.type || null;
    const objeto = corpo?.event?.data?.object || {};

    /* Só os eventos que MUDAM o estado do contrato. `signature.viewed` e os de
       biometria são ruído para nós: eles não movem o documento, e reagir a eles
       gravaria no banco a cada abertura de e-mail do cliente. */
    let status = null;
    if (evento === "document.finished") status = "ASSINADO";
    else if (evento === "signature.rejected") status = "RECUSADO";
    else if (evento === "document.deleted") status = "CANCELADO";

    return {
      valido: true,
      documentoExterno: objeto?.id || null,
      status,
      urlAssinado: objeto?.files?.signed || null,
      signatarioAssinou: evento === "signature.accepted"
        ? corpo?.event?.data?.object?.public_id || objeto?.public_id || null
        : null,
    };
  },
};

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
      /* Vazio e não ausente: o envelope nasce com `status: "sent"` e a própria
         DocuSign manda os e-mails, então não há passo de notificação que possa
         falhar em separado — ao contrário da Clicksign. */
      semAviso: [],
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
      body: JSON.stringify({ status: "voided", voidedReason: "Cancelado pela imobiliária no Omniflow." }),
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

const PROVEDORES = { clicksign, autentique, docusign };

export const PROVEDORES_DISPONIVEIS = [
  { chave: "autentique", rotulo: "Autentique", pais: "Brasil", padrao: true },
  { chave: "clicksign", rotulo: "Clicksign", pais: "Brasil", padrao: false },
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

export const _internos = {
  corpoEmHtml, assinaturaConfere, ESTADO_CLICKSIGN, ESTADO_DOCUSIGN,
  papelAutentique, papelClicksign, assinaturasReais, mensagemAutentique,
};
