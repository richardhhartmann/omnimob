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

/* Exportado para o assistente de vitrine (`services/vitrineIA.js`), que monta o
   próprio contrato e o próprio esquema de resposta e só precisa do transporte.
   Injetar a função em vez de importar o serviço lá dentro mantém o planejador
   testável sem rede. */
export { gerar as gerarTexto };

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
    tipoImovel: { type: "string" },
    atributos: { type: "array", items: { type: "string" } },
    finalidade: { type: "string" },
  },
  required: ["titulo", "descricao", "descricaoResumida"],
};

/**
 * Sugere título + descrição a partir das FOTOS e dos dados do imóvel (multimodal).
 * Uma única chamada ao Gemini (as imagens são enviadas uma vez) → JSON estruturado.
 * @returns {Promise<{ titulo, descricao, descricaoResumida, usouFotos }>}
 */
export async function sugerirTituloDescricao(imovel = {}, imagens = [], tiposDisponiveis = []) {
  const ficha = fichaImovel(imovel);
  const partsImagens = await montarPartsImagens(imagens);

  const temFotos = partsImagens.length > 0;
  const listaTipos = Array.isArray(tiposDisponiveis) ? tiposDisponiveis : [];
  const tiposTexto = listaTipos.length
    ? `\n\nTipos e atributos disponíveis (escolha SOMENTE destes):\n` +
      listaTipos.map((t) => `  • ${t.tipo}${Array.isArray(t.atributos) && t.atributos.length ? ` — atributos: ${t.atributos.join(", ")}` : ""}`).join("\n")
    : "";
  const inferBloco =
    `\nSe — e SOMENTE se — as fotos e os dados permitirem inferir com SEGURANÇA, preencha também (senão deixe vazio: "" ou []):\n` +
    `- "tipoImovel": o tipo do imóvel${listaTipos.length ? ", escolhido EXATAMENTE da lista abaixo" : ""} (ou "" se incerto)\n` +
    `- "atributos": array com os atributos/diferenciais que você tem CERTEZA que aparecem nas fotos${listaTipos.length ? ", escolhidos APENAS da lista do tipo escolhido" : ""} (ou [] se incerto)\n` +
    `- "finalidade": "RESIDENCIAL" ou "COMERCIAL" (ou "" se incerto)\n` +
    `Nunca invente tipo/atributos fora da lista. Na dúvida, deixe vazio.${tiposTexto}\n`;

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
    `- "descricaoResumida": resumo de até 280 caracteres\n` +
    inferBloco +
    `\nDados do imóvel:\n${ficha}`;

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
      tipoImovel: parsed.tipoImovel || "",
      atributos: Array.isArray(parsed.atributos) ? parsed.atributos : [],
      finalidade: parsed.finalidade || "",
      usouFotos: partsImagens.length,
    };
  } catch {
    // Fallback defensivo: se não vier JSON válido, entrega o texto como descrição.
    return { titulo: "", descricao: raw, descricaoResumida: "", tipoImovel: "", atributos: [], finalidade: "", usouFotos: partsImagens.length };
  }
}

/**
 * Infere, a partir do endereço/CEP, quais comodidades da lista MUITO PROVAVELMENTE
 * existem na região (raio ~2 km). Substitui a antiga consulta a Nominatim/Overpass:
 * usa o conhecimento do modelo sobre bairros e infraestrutura das cidades brasileiras.
 * @param {{ cep?, logradouro?, bairro?, cidade?, uf? }} endereco
 * @param {Array<{ key: string, label: string }>} comodidades  lista canônica (do frontend)
 * @returns {Promise<{ presentes: string[] }>}
 */
export async function inferirComodidadesRegiao(endereco = {}, comodidades = []) {
  const lista = (Array.isArray(comodidades) ? comodidades : []).filter((c) => c && c.key && c.label);
  if (lista.length === 0) return { presentes: [] };

  const keys = lista.map((c) => c.key);
  const enderecoStr = [
    endereco.logradouro && `Logradouro: ${endereco.logradouro}`,
    endereco.bairro && `Bairro: ${endereco.bairro}`,
    endereco.cidade && `Cidade: ${endereco.cidade}`,
    endereco.uf && `Estado (UF): ${endereco.uf}`,
    endereco.cep && `CEP: ${endereco.cep}`,
  ].filter(Boolean).join("\n");

  const opcoes = lista.map((c) => `- ${c.key}: ${c.label}`).join("\n");

  const schema = {
    type: "object",
    properties: {
      presentes: { type: "array", items: { type: "string", enum: keys } },
    },
    required: ["presentes"],
  };

  const prompt =
    `Considere um imóvel localizado no endereço abaixo. Avalie quais dos tipos de comodidade/serviço ` +
    `listados MUITO PROVAVELMENTE existem a uma curta distância (raio de aproximadamente 1 km) da região.\n\n` +
    `Endereço:\n${enderecoStr || "(endereço incompleto)"}\n\n` +
    `Tipos possíveis (use EXATAMENTE estas chaves):\n${opcoes}\n\n` +
    `Regras:\n` +
    `- Baseie-se no perfil real do bairro e da cidade (densidade, grau de urbanização, comércio típico da área).\n` +
    `- Inclua uma chave em "presentes" apenas quando houver BOA probabilidade de existir por perto. ` +
    `Na dúvida forte, NÃO inclua — é melhor deixar de marcar do que marcar algo que não existe.\n` +
    `- Em regiões centrais/urbanas densas a maioria costuma existir; em zonas rurais ou afastadas, poucas.\n` +
    `- Nunca invente chaves fora da lista.\n\n` +
    `Responda em JSON: { "presentes": ["chave", ...] }`;

  const raw = await callGemini([{ text: prompt }], {
    system:
      "Você é um especialista em geografia urbana e infraestrutura das cidades brasileiras. " +
      "Responde de forma factual e conservadora, sem inventar, sempre em português do Brasil.",
    responseSchema: schema,
    temperature: 0.2,
  });

  try {
    const parsed = JSON.parse(raw);
    const validas = new Set(keys);
    const presentes = Array.isArray(parsed.presentes)
      ? [...new Set(parsed.presentes.filter((k) => validas.has(k)))]
      : [];
    return { presentes };
  } catch {
    return { presentes: [] };
  }
}

/* ─── IA sobre o LEAD ─────────────────────────────────────────────────────────
   Todo o resto deste serviço trabalha sobre o IMÓVEL: escreve o anúncio, o
   título, a legenda. Isso economiza o tempo de cadastrar. Esta função é a
   primeira que trabalha sobre o INTERESSADO — e é a que ajuda a vender.

   Ela responde as quatro perguntas que alguém do time faz ao abrir um lead:
   o que essa pessoa quer, quão perto ela está de comprar, o que eu respondo, e
   o que mais do acervo serve para ela.

   As quatro juntas numa chamada só, e não quatro chamadas: o modelo precisa do
   MESMO contexto para todas (a mensagem, o imóvel procurado e o acervo), e
   dividir em quatro pagaria esse contexto quatro vezes — em custo e em espera
   de quem está com a tela aberta. */

const TEMPERATURAS = ["QUENTE", "MORNO", "FRIO"];

/** Uma linha por imóvel do acervo, curta — são dezenas delas no mesmo prompt. */
function linhaDoAcervo(p) {
  const partes = [
    p.propertyType || p.tipo,
    p.neighborhood && `${p.neighborhood}`,
    p.city,
    p.bedrooms ? `${p.bedrooms} dorm` : null,
    p.parkingSpots ? `${p.parkingSpots} vaga(s)` : null,
    (p.areaPrivativa || p.squareFootage) ? `${p.areaPrivativa || p.squareFootage} m²` : null,
    brl(p.price),
  ].filter(Boolean);
  return `- ${p.id} | ${p.title || "(sem título)"} — ${partes.join(", ")}`;
}

/**
 * Lê um lead e devolve resumo, temperatura, resposta pronta e imóveis do acervo
 * que servem para aquele interessado.
 *
 * @param {object} lead    { name, email, phone, message, createdAt }
 * @param {object} imovel  O imóvel pelo qual a pessoa entrou em contato
 * @param {object[]} acervo Outros imóveis ativos do MESMO tenant (já filtrados)
 * @returns {Promise<{resumo,temperatura,porqueTemperatura,resposta,sugestoes:string[]}>}
 */
export async function analisarLead(lead = {}, imovel = null, acervo = []) {
  /* Só ids que existem entram no enum do schema. É o que impede a IA de
     "sugerir" um imóvel inventado — e, mais importante aqui, de devolver o id
     de um imóvel de OUTRA imobiliária caso ele apareça no prompt por engano.
     Quem monta o acervo é a rota, que já filtra por tenant; este enum é a
     segunda tranca. */
  const ids = acervo.map((p) => p.id);

  const schema = {
    type: "object",
    properties: {
      resumo: { type: "string" },
      temperatura: { type: "string", enum: TEMPERATURAS },
      porqueTemperatura: { type: "string" },
      resposta: { type: "string" },
      // Sem `enum` quando o acervo está vazio: enum vazio é schema inválido.
      sugestoes: ids.length
        ? { type: "array", items: { type: "string", enum: ids } }
        : { type: "array", items: { type: "string" } },
    },
    required: ["resumo", "temperatura", "porqueTemperatura", "resposta", "sugestoes"],
  };

  const quando = lead.createdAt ? new Date(lead.createdAt).toLocaleString("pt-BR") : "(sem data)";
  const prompt =
    `Um interessado entrou em contato pela vitrine de uma imobiliária. Analise o contato.\n\n` +
    `INTERESSADO\n` +
    `- Nome: ${lead.name || "(não informado)"}\n` +
    `- E-mail: ${lead.email || "(não informado)"}\n` +
    `- Telefone: ${lead.phone || "(não informado)"}\n` +
    `- Quando: ${quando}\n` +
    `- Mensagem: ${lead.message || "(não escreveu mensagem)"}\n\n` +
    `IMÓVEL PELO QUAL ELE SE INTERESSOU\n${imovel ? fichaImovel(imovel) : "- (imóvel não encontrado)"}\n\n` +
    `OUTROS IMÓVEIS DISPONÍVEIS NESTA IMOBILIÁRIA\n` +
    `${ids.length ? acervo.map(linhaDoAcervo).join("\n") : "- (nenhum outro imóvel ativo)"}\n\n` +
    `Devolva:\n` +
    `1. "resumo": em 1 ou 2 frases, o que essa pessoa quer. Se ela não escreveu mensagem, ` +
    `diga o que dá para deduzir do imóvel que ela abriu — e deixe claro que é dedução.\n` +
    `2. "temperatura": QUENTE (demonstrou intenção clara, urgência, falou em visita, ` +
    `financiamento ou proposta), MORNO (perguntou algo específico do imóvel) ou ` +
    `FRIO (contato genérico, sem mensagem, ou só curiosidade).\n` +
    `3. "porqueTemperatura": uma frase curta justificando, citando o que na mensagem levou a isso. ` +
    `Sem mensagem, a temperatura é no máximo MORNO.\n` +
    `4. "resposta": a mensagem que o corretor deve MANDAR para essa pessoa, pronta para copiar. ` +
    `Em português do Brasil, tratamento por "você", cordial e direta, no máximo 4 linhas. ` +
    `Responda o que foi perguntado, e termine propondo um próximo passo concreto (visita, ligação). ` +
    `Não invente informação que não esteja na ficha do imóvel — se ela perguntou algo que a ficha ` +
    `não responde, diga que vai confirmar. Nunca prometa preço, desconto ou condição de pagamento.\n` +
    `5. "sugestoes": até 3 ids de OUTROS imóveis da lista que sirvam para essa pessoa, do mais ` +
    `aderente para o menos. Use somente ids da lista, e nunca o do imóvel que ela já abriu. ` +
    `Se nenhum for parecido de verdade em faixa de preço, região e tamanho, devolva lista vazia — ` +
    `sugerir qualquer coisa é pior do que não sugerir.`;

  const raw = await callGemini([{ text: prompt }], {
    system:
      "Você é um corretor de imóveis brasileiro experiente, que lê um contato e sabe " +
      "exatamente o que responder. É honesto: não inventa característica de imóvel nem " +
      "promete o que não pode cumprir. Escreve sempre em português do Brasil.",
    responseSchema: schema,
    temperature: 0.4,
  });

  const parsed = JSON.parse(raw);
  const validos = new Set(ids);
  return {
    resumo: String(parsed.resumo || "").trim(),
    temperatura: TEMPERATURAS.includes(parsed.temperatura) ? parsed.temperatura : "FRIO",
    porqueTemperatura: String(parsed.porqueTemperatura || "").trim(),
    resposta: String(parsed.resposta || "").trim(),
    // Filtra de novo na saída: o enum do schema é um pedido, não uma garantia.
    sugestoes: Array.isArray(parsed.sugestoes)
      ? [...new Set(parsed.sugestoes.filter((id) => validos.has(id)))].slice(0, 3)
      : [],
  };
}
