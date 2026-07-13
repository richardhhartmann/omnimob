/**
 * ─── AI Service (Google Gemini 2.5 Flash) ────────────────────────────────────
 * A IA é um pilar da plataforma. Este serviço gera conteúdo comercial a partir
 * dos dados de um imóvel: descrições, título, hashtags, posts para redes,
 * mensagem de WhatsApp, anúncios, e-mail marketing etc.
 *
 * Usa a REST API do Gemini via `fetch` nativo (Node 18+), sem SDK adicional.
 * Configuração via ambiente: GEMINI_API_KEY e GEMINI_MODEL (default 2.5-flash).
 */

const API_KEY = process.env.GEMINI_API_KEY || "";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export function isAiEnabled() {
  return Boolean(API_KEY);
}

/**
 * Chamada de baixo nível ao Gemini. Recebe o prompt do usuário e uma instrução
 * de sistema, devolve o texto gerado. Lança erro com mensagem clara em falhas.
 */
const MAX_IMAGENS_IA = 4; // teto de fotos enviadas à IA (controla custo/latência)

/**
 * Chamada de baixo nível ao Gemini com "parts" arbitrárias (texto e/ou imagens).
 * Se `responseSchema` for informado, pede resposta estruturada em JSON.
 */
async function callGemini(parts, { system, temperature = 0.7, responseSchema } = {}) {
  if (!API_KEY) {
    const err = new Error("IA indisponível: GEMINI_API_KEY não configurada.");
    err.code = "AI_DISABLED";
    throw err;
  }

  const generationConfig = {
    temperature,
    // Desliga o "thinking" do 2.5-flash: são tarefas de copywriting curtas,
    // priorizamos latência e custo.
    thinkingConfig: { thinkingBudget: 0 },
  };
  if (responseSchema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = responseSchema;
  }

  const url = `${BASE_URL}/${MODEL}:generateContent?key=${API_KEY}`;
  const body = { contents: [{ role: "user", parts }], generationConfig };
  if (system) {
    body.systemInstruction = { parts: [{ text: system }] };
  }

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (netErr) {
    const err = new Error(`Falha de rede ao contatar a IA: ${netErr.message}`);
    err.code = "AI_NETWORK";
    throw err;
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const err = new Error(`IA retornou erro ${response.status}: ${detail.slice(0, 300)}`);
    err.code = "AI_UPSTREAM";
    throw err;
  }

  const data = await response.json();

  if (data?.promptFeedback?.blockReason) {
    const err = new Error(`Conteúdo bloqueado pela IA: ${data.promptFeedback.blockReason}`);
    err.code = "AI_BLOCKED";
    throw err;
  }

  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("").trim();
  if (!text) {
    const err = new Error("IA não retornou conteúdo.");
    err.code = "AI_EMPTY";
    throw err;
  }
  return text;
}

/** Geração a partir de um prompt só-texto. */
async function gerar(prompt, opts = {}) {
  return callGemini([{ text: prompt }], opts);
}

// ─── Ficha do imóvel → texto para o prompt ────────────────────────────────────

function brl(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Monta um resumo textual dos dados do imóvel para alimentar os prompts. */
function fichaImovel(imovel = {}) {
  const linhas = [];
  const add = (label, val) => {
    if (val !== undefined && val !== null && val !== "" && val !== 0) linhas.push(`- ${label}: ${val}`);
  };
  add("Tipo", imovel.propertyType || imovel.tipo);
  add("Finalidade", imovel.finalidade);
  add("Título atual", imovel.title);
  add("Preço", brl(imovel.price));
  add("Cidade", imovel.city);
  add("Bairro", imovel.neighborhood);
  add("Estado", imovel.state);
  add("Endereço", imovel.address);
  add("Dormitórios", imovel.bedrooms);
  add("Suítes", imovel.suites);
  add("Vagas de garagem", imovel.parkingSpots);
  add("Área privativa (m²)", imovel.areaPrivativa || imovel.squareFootage);
  add("Área construída (m²)", imovel.areaConstruida);
  add("Área do terreno (m²)", imovel.areaTerreno);
  add("Andamento", imovel.andamento);
  if (imovel.aceitaPermuta) add("Aceita permuta", "sim");
  if (Array.isArray(imovel.atributos) && imovel.atributos.length) {
    add("Atributos e diferenciais", imovel.atributos.join(", "));
  }
  add("Descrição existente", imovel.description);
  return linhas.length ? linhas.join("\n") : "- (poucos dados fornecidos)";
}

const SYSTEM_BASE =
  "Você é um copywriter especialista do mercado imobiliário brasileiro. Escreve em português do Brasil, " +
  "com tom profissional, persuasivo e honesto. Nunca inventa características que não foram informadas. " +
  "Responde APENAS com o texto pedido, sem preâmbulos, sem aspas e sem marcações de código.";

// ─── Geradores por tipo de conteúdo ───────────────────────────────────────────

const GERADORES = {
  descricao: {
    label: "Descrição completa",
    run: (f) =>
      gerar(
        `Escreva uma descrição completa e atraente para anúncio deste imóvel (2 a 3 parágrafos):\n\n${f}`,
        { system: SYSTEM_BASE }
      ),
  },
  descricaoResumida: {
    label: "Descrição resumida",
    run: (f) =>
      gerar(`Escreva uma descrição curta (máx. 280 caracteres) para este imóvel:\n\n${f}`, {
        system: SYSTEM_BASE,
        temperature: 0.6,
      }),
  },
  descricaoSeo: {
    label: "Descrição otimizada para SEO",
    run: (f) =>
      gerar(
        `Escreva uma meta description otimizada para SEO (150 a 160 caracteres), com palavras-chave de busca imobiliária, para este imóvel:\n\n${f}`,
        { system: SYSTEM_BASE, temperature: 0.5 }
      ),
  },
  titulo: {
    label: "Título comercial",
    run: (f) =>
      gerar(`Crie um título comercial curto e chamativo (máx. 70 caracteres) para este imóvel:\n\n${f}`, {
        system: SYSTEM_BASE,
        temperature: 0.8,
      }),
  },
  hashtags: {
    label: "Hashtags",
    run: (f) =>
      gerar(
        `Gere de 10 a 15 hashtags relevantes (em uma única linha, separadas por espaço, cada uma começando com #) para divulgar este imóvel nas redes sociais:\n\n${f}`,
        { system: SYSTEM_BASE, temperature: 0.7 }
      ),
  },
  instagram: {
    label: "Post para Instagram",
    run: (f) =>
      gerar(
        `Escreva uma legenda envolvente para post de Instagram deste imóvel, com emojis moderados e uma chamada para ação, terminando com 5 a 8 hashtags:\n\n${f}`,
        { system: SYSTEM_BASE, temperature: 0.85 }
      ),
  },
  facebook: {
    label: "Post para Facebook",
    run: (f) =>
      gerar(`Escreva um post para Facebook divulgando este imóvel, com chamada para ação:\n\n${f}`, {
        system: SYSTEM_BASE,
        temperature: 0.8,
      }),
  },
  whatsapp: {
    label: "Mensagem para WhatsApp",
    run: (f) =>
      gerar(
        `Escreva uma mensagem curta e cordial para enviar a um cliente por WhatsApp apresentando este imóvel, com emojis moderados:\n\n${f}`,
        { system: SYSTEM_BASE, temperature: 0.75 }
      ),
  },
  linkedin: {
    label: "Texto para LinkedIn",
    run: (f) =>
      gerar(`Escreva um texto profissional para LinkedIn divulgando este imóvel:\n\n${f}`, {
        system: SYSTEM_BASE,
        temperature: 0.7,
      }),
  },
  googleAds: {
    label: "Anúncio para Google Ads",
    run: (f) =>
      gerar(
        `Crie um anúncio de Google Ads para este imóvel no formato:\nTítulo 1 (máx 30 caracteres)\nTítulo 2 (máx 30 caracteres)\nTítulo 3 (máx 30 caracteres)\nDescrição 1 (máx 90 caracteres)\nDescrição 2 (máx 90 caracteres)\n\nDados do imóvel:\n${f}`,
        { system: SYSTEM_BASE, temperature: 0.6 }
      ),
  },
  emailMarketing: {
    label: "E-mail marketing",
    run: (f) =>
      gerar(
        `Escreva um e-mail marketing (assunto + corpo) divulgando este imóvel para a base de clientes. Comece com "Assunto:" na primeira linha:\n\n${f}`,
        { system: SYSTEM_BASE, temperature: 0.75 }
      ),
  },
};

/** Tipos de conteúdo disponíveis (para o frontend montar a UI). */
export function tiposDisponiveis() {
  return Object.entries(GERADORES).map(([key, g]) => ({ key, label: g.label }));
}

/**
 * Gera um ou vários conteúdos para um imóvel.
 * @param {object} imovel  Campos do imóvel (salvos ou de rascunho).
 * @param {string[]} tipos Chaves de GERADORES. Vazio/ausente = todas.
 * @returns {Promise<{ resultados: Record<string,string>, erros: Record<string,string> }>}
 */
export async function gerarConteudoImovel(imovel, tipos) {
  const ficha = fichaImovel(imovel);
  const chaves = Array.isArray(tipos) && tipos.length ? tipos : Object.keys(GERADORES);

  const resultados = {};
  const erros = {};

  await Promise.all(
    chaves.map(async (key) => {
      const gerador = GERADORES[key];
      if (!gerador) {
        erros[key] = "Tipo de conteúdo desconhecido.";
        return;
      }
      try {
        resultados[key] = await gerador.run(ficha);
      } catch (err) {
        erros[key] = err.message;
      }
    })
  );

  return { resultados, erros };
}

/** Melhora/reescreve uma descrição existente. */
export async function melhorarDescricao(texto, imovel = {}) {
  return gerar(
    `Melhore a descrição abaixo tornando-a mais persuasiva e corrigindo a ortografia, sem inventar informações. ` +
      `Dados do imóvel para referência:\n${fichaImovel(imovel)}\n\nDescrição a melhorar:\n${texto}`,
    { system: SYSTEM_BASE }
  );
}

// ─── Multimodal: sugestão a partir das FOTOS + dados ──────────────────────────

// Reduz imagens do Cloudinary antes de enviar à IA (menos custo/latência), sem
// alterar a foto original. Só age quando a URL ainda não tem transformação.
function otimizarUrlCloudinary(url) {
  if (typeof url === "string" && url.includes("/upload/") && !/\/upload\/[a-z]_/.test(url)) {
    return url.replace("/upload/", "/upload/w_1024,q_auto,f_jpg/");
  }
  return url;
}

async function urlParaInlineData(url) {
  const res = await fetch(otimizarUrlCloudinary(url));
  if (!res.ok) throw new Error(`Falha ao baixar imagem (${res.status}).`);
  const mime = res.headers.get("content-type") || "image/jpeg";
  const buf = Buffer.from(await res.arrayBuffer());
  return { inline_data: { mime_type: mime, data: buf.toString("base64") } };
}

/**
 * Converte itens de imagem em "parts" do Gemini. Aceita:
 *  - { base64, mimeType }  (base64 puro ou data URL "data:...;base64,XXXX")
 *  - { url }               (baixado no servidor)
 * Imagens que falharem são ignoradas — a sugestão segue com as demais.
 */
async function montarPartsImagens(imagens = []) {
  const selecionadas = imagens.slice(0, MAX_IMAGENS_IA);
  const parts = [];
  for (const img of selecionadas) {
    try {
      if (img?.base64) {
        const data = img.base64.includes(",") ? img.base64.split(",").pop() : img.base64;
        parts.push({ inline_data: { mime_type: img.mimeType || "image/jpeg", data } });
      } else if (img?.url) {
        parts.push(await urlParaInlineData(img.url));
      }
    } catch (e) {
      console.warn("[ai] imagem ignorada:", e.message);
    }
  }
  return parts;
}

const SCHEMA_SUGESTAO = {
  type: "object",
  properties: {
    titulo: { type: "string" },
    descricao: { type: "string" },
    descricaoResumida: { type: "string" },
  },
  required: ["titulo", "descricao", "descricaoResumida"],
};

/**
 * Sugere título + descrição a partir das FOTOS e dos dados do imóvel (multimodal).
 * Uma única chamada ao Gemini (as imagens são enviadas uma vez) → JSON estruturado.
 * @returns {Promise<{ titulo, descricao, descricaoResumida, usouFotos }>}
 */
export async function sugerirTituloDescricao(imovel = {}, imagens = []) {
  const ficha = fichaImovel(imovel);
  const partsImagens = await montarPartsImagens(imagens);

  const temFotos = partsImagens.length > 0;
  const instrucao =
    (temFotos
      ? `Analise as FOTOS e os dados abaixo e crie o anúncio deste imóvel. Baseie-se no que REALMENTE ` +
        `aparece nas fotos (acabamentos, ambientes, iluminação, vista, estado de conservação) combinado com os ` +
        `dados informados. `
      : `Crie o anúncio deste imóvel a partir dos dados abaixo. `) +
    `NUNCA invente características que não estejam visíveis nas fotos nem nos dados.\n\n` +
    `Responda em JSON com:\n` +
    `- "titulo": título comercial curto e chamativo (máx. 70 caracteres)\n` +
    `- "descricao": descrição completa e persuasiva (2 a 3 parágrafos)\n` +
    `- "descricaoResumida": resumo de até 280 caracteres\n\n` +
    `Dados do imóvel:\n${ficha}`;

  const raw = await callGemini([{ text: instrucao }, ...partsImagens], {
    system: SYSTEM_BASE,
    responseSchema: SCHEMA_SUGESTAO,
    temperature: 0.7,
  });

  try {
    const parsed = JSON.parse(raw);
    return {
      titulo: parsed.titulo || "",
      descricao: parsed.descricao || "",
      descricaoResumida: parsed.descricaoResumida || "",
      usouFotos: partsImagens.length,
    };
  } catch {
    // Fallback defensivo: se não vier JSON válido, entrega o texto como descrição.
    return { titulo: "", descricao: raw, descricaoResumida: "", usouFotos: partsImagens.length };
  }
}
