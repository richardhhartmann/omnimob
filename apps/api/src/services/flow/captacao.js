import crypto from "node:crypto";

/* ────────────────────────────────────────────────────────────────────────────
   CAPTAÇÃO — a tradução do que os portais e as redes mandam.

   ── O PROBLEMA ──

   Nenhum portal manda lead no mesmo formato. O ZAP manda `{ lead: { name,
   email } }`, o VivaReal manda `{ contact: {...} }`, o Facebook Lead Ads manda
   uma lista de `{ name, values: [] }`, e o formulário do site do cliente manda
   o que o desenvolvedor dele decidiu. Um leitor por canal seria a resposta
   óbvia e está errada pela metade: o cliente vai plugar um integrador que
   ninguém previu, e ele precisa funcionar.

   Então a estratégia é em duas camadas:

     1. Um leitor POR CANAL, quando o formato é conhecido e documentado.
     2. Um leitor GENÉRICO por baixo, que varre o corpo procurando as coisas
        que um lead sempre tem — um e-mail, um telefone, um nome. Ele acerta a
        maioria dos formatos que ninguém escreveu leitor para.

   O genérico não é gambiarra: é o que faz "cole esta URL no seu integrador"
   funcionar no primeiro dia, sem uma reunião técnica com o fornecedor.

   ── O QUE NUNCA ACONTECE AQUI ──

   Este arquivo não toca no banco e não decide nada sobre negócio. Ele recebe um
   objeto e devolve `{ nome, email, telefone, mensagem, referenciaImovel }`.
   Testável sem subir nada, e é onde o risco de verdade mora: ler o telefone do
   campo errado importa quinhentos leads inalcançáveis em silêncio — é o mesmo
   raciocínio de `formatosImportacao.js`, e o mesmo motivo de haver teste.
   ──────────────────────────────────────────────────────────────────────────── */

/* ── Utilitários de leitura tolerante ──────────────────────────────────────── */

/** Busca em profundidade a primeira chave que casa, sem se importar com onde
 *  ela está aninhada. É o que faz o leitor genérico funcionar com
 *  `{ data: { lead: { email } } }` sem saber que existe `data` nem `lead`. */
function achar(objeto, nomes, profundidade = 0) {
  if (!objeto || typeof objeto !== "object" || profundidade > 6) return null;
  const alvos = nomes.map((n) => n.toLowerCase());

  // Nível raso primeiro: o campo certo costuma estar mais perto da raiz que um
  // homônimo enterrado (`contato.email` ganha de `imovel.corretor.email`).
  for (const [k, v] of Object.entries(objeto)) {
    if (v === null || typeof v === "object") continue;
    if (alvos.includes(String(k).toLowerCase())) {
      const t = String(v).trim();
      if (t) return t;
    }
  }
  for (const v of Object.values(objeto)) {
    if (Array.isArray(v)) {
      for (const item of v) {
        const achado = achar(item, nomes, profundidade + 1);
        if (achado) return achado;
      }
    } else if (v && typeof v === "object") {
      const achado = achar(v, nomes, profundidade + 1);
      if (achado) return achado;
    }
  }
  return null;
}

/* Um e-mail em qualquer lugar do corpo. Última linha de defesa do leitor
   genérico: quando nenhuma chave se chama "email", o endereço quase sempre está
   lá dentro de algum campo de texto. */
const RE_EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
/* Telefone brasileiro com ou sem DDI, com ou sem máscara. Exige DDD porque um
   número de 8 dígitos solto casa com CEP, com valor e com data. */
const RE_TELEFONE = /(?:\+?55\s*)?(?:\(?\d{2}\)?[\s.-]?)\d{4,5}[\s.-]?\d{4}/;

function varrerTexto(objeto, regex, profundidade = 0) {
  if (objeto == null || profundidade > 6) return null;
  if (typeof objeto === "string" || typeof objeto === "number") {
    const m = String(objeto).match(regex);
    return m ? m[0] : null;
  }
  if (typeof objeto !== "object") return null;
  for (const v of Object.values(objeto)) {
    const achado = varrerTexto(v, regex, profundidade + 1);
    if (achado) return achado;
  }
  return null;
}

function limpar(t, max = 300) {
  if (t == null) return null;
  const s = String(t).trim().replace(/\s+/g, " ");
  return s ? s.slice(0, max) : null;
}

/** Só dígitos, com o DDI 55 removido quando ele sobra. O que fica é o que o
 *  corretor disca — e é o que precisa bater na hora de reconhecer um lead
 *  repetido. */
export function normalizarTelefone(t) {
  if (!t) return null;
  let d = String(t).replace(/\D+/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d.length >= 10 ? d : d.length ? d : null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   OS LEITORES
   ═══════════════════════════════════════════════════════════════════════════

   Cada um devolve `null` quando o corpo claramente não é dele — e aí o
   genérico assume. Nenhum lança exceção: um portal mudar o formato tem que
   virar "não entendi este corpo" no diagnóstico, e não 500 na cara deles (que é
   o que faz o portal desativar a integração por conta própria). */

const leitores = {
  /* ── Facebook / Instagram Lead Ads ────────────────────────────────────────
     O formato é uma lista de `{ name, values: [...] }`, e os nomes dos campos
     são definidos por quem montou o formulário no Gerenciador de Anúncios. Por
     isso a busca é por sinônimos e não por posição. */
  FACEBOOK: (corpo) => {
    const campos = corpo?.field_data || corpo?.entry?.[0]?.changes?.[0]?.value?.field_data;
    if (!Array.isArray(campos)) return null;
    const mapa = {};
    for (const c of campos) {
      const chave = String(c?.name || "").toLowerCase();
      const valor = Array.isArray(c?.values) ? c.values[0] : c?.value;
      if (chave) mapa[chave] = valor;
    }
    return {
      nome: limpar(mapa.full_name || mapa.nome || mapa.name || mapa.first_name),
      email: limpar(mapa.email),
      telefone: limpar(mapa.phone_number || mapa.telefone || mapa.phone),
      mensagem: limpar(mapa.mensagem || mapa.message || mapa.comentario, 2000),
      referenciaImovel: limpar(mapa.imovel || mapa.codigo || mapa.property_id, 80),
    };
  },

  /* ── ZAP Imóveis / VivaReal ───────────────────────────────────────────────
     São o mesmo grupo (OLX Brasil) e mandam o mesmo envelope, com o interessado
     em `lead` e o imóvel em `listing`. */
  ZAP: lerGrupoOlx,
  VIVAREAL: lerGrupoOlx,
  OLX: lerGrupoOlx,
};

function lerGrupoOlx(corpo) {
  const lead = corpo?.lead || corpo?.contact || corpo?.client;
  if (!lead || typeof lead !== "object") return null;
  const listing = corpo?.listing || corpo?.property || {};
  return {
    nome: limpar(lead.name || lead.nome),
    email: limpar(lead.email),
    telefone: limpar(lead.phone || lead.telefone || lead.ddd_phone || lead.mobile),
    mensagem: limpar(lead.message || lead.mensagem || corpo?.message, 2000),
    referenciaImovel: limpar(
      listing.externalId || listing.external_id || listing.id || listing.code || corpo?.listingId,
      80,
    ),
  };
}

/* ── O leitor genérico ─────────────────────────────────────────────────────── */

function lerGenerico(corpo) {
  const email = achar(corpo, ["email", "e-mail", "mail", "emailaddress", "email_address"])
    || varrerTexto(corpo, RE_EMAIL);
  const telefone = achar(corpo, ["telefone", "phone", "celular", "whatsapp", "mobile", "tel", "phone_number", "fone"])
    || varrerTexto(corpo, RE_TELEFONE);
  const nome = achar(corpo, ["nome", "name", "fullname", "full_name", "nome_completo", "contato", "cliente"]);
  const mensagem = achar(corpo, ["mensagem", "message", "comentario", "comment", "observacao", "obs", "texto", "body"]);
  const referenciaImovel = achar(corpo, [
    "imovel", "imovelid", "imovel_id", "codigo", "codigoimovel", "referencia", "ref",
    "listingid", "listing_id", "propertyid", "property_id", "externalid", "external_id",
  ]);

  return {
    nome: limpar(nome),
    email: limpar(email),
    telefone: limpar(telefone),
    mensagem: limpar(mensagem, 2000),
    referenciaImovel: limpar(referenciaImovel, 80),
  };
}

/**
 * Traduz o corpo do webhook para o formato que o resto do módulo entende.
 *
 * @param {string} canal  o canal da fonte (`CanalCaptacao`)
 * @param {object} corpo  o JSON recebido, cru
 * @returns {{ nome, email, telefone, mensagem, referenciaImovel, leitor }}
 */
export function lerPayload(canal, corpo) {
  if (!corpo || typeof corpo !== "object") {
    return { nome: null, email: null, telefone: null, mensagem: null, referenciaImovel: null, leitor: "nenhum" };
  }

  const especifico = leitores[canal];
  if (especifico) {
    const lido = especifico(corpo);
    /* Só aceita o leitor específico se ele achou ALGUMA forma de contato. Um
       leitor que reconhece o envelope mas devolve tudo vazio é pior que o
       genérico — ele impede o genérico de tentar. */
    if (lido && (lido.email || lido.telefone)) return { ...lido, leitor: canal.toLowerCase() };
  }

  return { ...lerGenerico(corpo), leitor: "generico" };
}

/** O lead tem como ser respondido? Sem e-mail nem telefone não há lead: há um
 *  registro de que alguém clicou, e o corretor não pode fazer nada com isso. */
export function temContato(lido) {
  return Boolean(lido?.email || normalizarTelefone(lido?.telefone));
}

/* ── Segurança da porta ───────────────────────────────────────────────────────

   Duas camadas, e a segunda é opcional porque nem todo portal assina:

     · A CHAVE, no caminho. É o que identifica a fonte, e é secreta o bastante
       (32 bytes) para não ser adivinhada.
     · A ASSINATURA HMAC, no cabeçalho. Confirma que o corpo veio de quem tem o
       segredo e não foi alterado no caminho.

   Quando a fonte não tem assinatura configurada do lado de lá, a chave sozinha
   é a autenticação — e é por isso que ela é longa e revogável por fonte. */

export function gerarChave() {
  return crypto.randomBytes(24).toString("base64url");
}

export function gerarSegredo() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Confere o HMAC do corpo. Devolve `true` quando não há assinatura no pedido —
 * a decisão de EXIGIR é de quem chama, porque ela depende de a fonte estar
 * configurada para assinar.
 *
 * Aceita os dois formatos que aparecem no mundo real: `sha256=<hex>` e o hex
 * puro. Recusar por causa do prefixo produziria um "não funciona" sem sintoma.
 */
export function assinaturaConfere(corpoBruto, segredo, assinaturaRecebida) {
  if (!assinaturaRecebida) return { conferida: false, valida: true };
  if (!segredo) return { conferida: false, valida: true };

  const recebida = String(assinaturaRecebida).replace(/^sha256=/i, "").trim();
  const esperada = crypto.createHmac("sha256", segredo).update(corpoBruto).digest("hex");

  const a = Buffer.from(recebida, "utf8");
  const b = Buffer.from(esperada, "utf8");
  /* Tamanho diferente já é recusa, e a comparação em si é em tempo constante:
     `===` vazaria quantos bytes iniciais batem, que é como se forja um HMAC por
     tentativa. Mesma regra de `services/webhooks.js`, na direção contrária. */
  if (a.length !== b.length) return { conferida: true, valida: false };
  return { conferida: true, valida: crypto.timingSafeEqual(a, b) };
}

/* ── Reconhecer o mesmo interessado ───────────────────────────────────────────

   Portais reenviam. O ZAP manda o mesmo lead de novo quando a primeira entrega
   dá timeout, o Facebook reenvia por até 36 horas, e o integrador do cliente
   reenvia por conta própria quando alguém aperta F5.

   A janela é curta (6 horas) de propósito. Uma pessoa que volta ao portal DOIS
   DIAS depois e manda mensagem de novo é um lead novo — ela demonstrou interesse
   outra vez, e engolir isso como duplicata esconderia do corretor o sinal mais
   forte que existe. O que a janela evita é a rajada técnica, não o reencontro.

   Casa por telefone OU e-mail, no MESMO imóvel. Sem o imóvel, a mesma pessoa
   perguntando sobre dois apartamentos viraria um lead só — e o segundo imóvel
   nunca receberia atendimento. */
export const JANELA_DUPLICATA_MS = 6 * 60 * 60 * 1000;

export function filtroDeDuplicata({ tenantId, propertyId, email, telefone, agora = new Date() }) {
  const contatos = [];
  if (email) contatos.push({ email });
  const tel = normalizarTelefone(telefone);
  if (tel) contatos.push({ phone: { contains: tel.slice(-8) } });
  if (!contatos.length) return null;

  return {
    tenantId,
    ...(propertyId ? { propertyId } : {}),
    createdAt: { gte: new Date(agora.getTime() - JANELA_DUPLICATA_MS) },
    OR: contatos,
  };
}

/** O nome que aparece no funil quando o lead chega sem nome — e ele chega sem
 *  nome com frequência. "Interessado sem nome" é honesto; "null" ou uma linha
 *  em branco no cartão do funil parece defeito. */
export function tituloDoNegocio({ nome, imovelTitulo }) {
  const quem = limpar(nome) || "Interessado sem nome";
  return imovelTitulo ? `${quem} — ${limpar(imovelTitulo, 80)}` : quem;
}

export const _internos = { achar, varrerTexto, lerGenerico, limpar };
