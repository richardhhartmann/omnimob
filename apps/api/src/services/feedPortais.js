/* ────────────────────────────────────────────────────────────────────────────
   Feed XML dos portais imobiliários.

   ── COMO A INTEGRAÇÃO REALMENTE FUNCIONA ──

   Não é integração bidirecional, apesar de todo mundo chamar assim. ZAP,
   VivaReal, OLX Imóveis e Imovelweb trabalham por CARGA AGENDADA: a imobiliária
   cadastra uma URL no painel do portal, e o robô do portal vem buscar o arquivo
   de tempos em tempos. Nós não empurramos nada, não guardamos credencial deles
   e não precisamos tratar erro de rede — se o portal não conseguir ler hoje,
   ele lê amanhã com o conteúdo atualizado.

   Isso muda o tamanho do problema: o que parecia um subsistema é um endpoint
   público, sem estado e sem autenticação.

   ── O FORMATO ──

   VRSync, o esquema do Grupo OLX (VivaReal, ZAP e OLX Imóveis leem o mesmo
   arquivo). É o de fato padrão no Brasil e o mais aceito por agregadores
   menores, então um arquivo só atende quase todo mundo.

   ⚠ ESCRITO CONTRA A DOCUMENTAÇÃO DO VRSYNC — não contra uma carga real aceita
   pelo portal, que exige contrato ativo com o Grupo OLX. Mesma situação de
   `mercadoLivre.js` e de `flow/assinatura.js`. Os pontos em que o vocabulário
   do portal é ambíguo estão marcados REVISAR.

   ── PASSAR NO VALIDADOR NÃO É A META ──

   Esta é a lição que custou uma reescrita. O XML anterior passava no validador
   de esquema e mesmo assim produzia anúncio ERRADO no portal, porque o
   validador só confere FORMA:

     • `<Residential><Apartment/></Residential>` — sintaxe válida, elemento
       inexistente no VRSync. O portal lia `PropertyType` vazio e jogava tudo
       no balde genérico. O tipo é TEXTO, no formato "Categoria / Subtipo".
     • `<ListPrice>450000.5</ListPrice>` — número válido, preço recusado. O
       portal quer inteiro em reais.
     • `<LivingArea>120</LivingArea>` sem `unit` — o portal assume a unidade
       padrão da carga, e o imóvel de 120 m² podia entrar como 120 pés².
     • `<State>São Paulo</State>` sem `abbreviation` — o anúncio não entra na
       busca por estado.

   Nada disso quebra o parser. Tudo isso quebra o anúncio. Por isso a validação
   que importa mora em `conferirAnuncio()`, e não no validador de XML.

   ── O QUE ENTRA ──

   Imóvel ATIVO, com `publicarPortais` ligado e que passe em `conferirAnuncio()`.
   O que reprova ali não é capricho nosso: é o que o portal recusa no cadastro,
   e anúncio recusado conta como ERRO no relatório de carga da imobiliária.
   Vale mais ficar de fora do que sujar o relatório — mas ficar de fora em
   SILÊNCIO seria pior ainda, e é por isso que os motivos saem nomeados
   (`GET /api/properties/portais/pendencias` os leva ao painel).
   ──────────────────────────────────────────────────────────────────────────── */

/** Escapa o que a XML não aceita cru. Texto do cliente passa por aqui SEMPRE. */
export function xmlEscape(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    /* Caracteres de controle são inválidos em XML 1.0 e derrubam o parser do
       portal com "malformed" — sem dizer onde. Descrição colada de Word traz
       alguns com frequência. */
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

const tag = (nome, valor) =>
  valor === null || valor === undefined || valor === "" ? "" : `<${nome}>${xmlEscape(valor)}</${nome}>`;

/* ────────────────────────────────────────────────────────────────────────────
   OS LIMITES DO PORTAL

   Números do Grupo OLX, não escolhas nossas. Ficam aqui em cima com nome
   porque a tela do painel precisa dizer "faltam 2 fotos", e um `< 5` solto no
   meio de um filtro não tem como virar frase.
   ──────────────────────────────────────────────────────────────────────────── */
export const TITULO_MIN = 10;
export const TITULO_MAX = 100;

/* Cinco fotos é o mínimo que o portal exige para ACEITAR o anúncio; com menos
   ele recusa na importação. Vinte é o teto — e mandar mais faz a carga inteira
   do lote ser rejeitada, em vez de as extras serem ignoradas. */
export const FOTOS_MIN = 5;
export const FOTOS_MAX = 20;

const DESCRICAO_MAX = 3000;

/* Contrato do Omnimob → transação do VRSync.
   PERMUTA e BUILT_TO_SUIT não têm equivalente no esquema; ambas são operações
   de venda para efeito de anúncio, e é assim que o portal deve entendê-las. */
function transacao(tipoContrato) {
  return tipoContrato === "LOCACAO" ? "For Rent" : "For Sale";
}

/* ────────────────────────────────────────────────────────────────────────────
   TIPO DO IMÓVEL

   `PropertyType` é TEXTO, no formato "Categoria / Subtipo" — e o vocabulário é
   FECHADO. Qualquer coisa fora da lista o portal joga no balde genérico da
   categoria, sem avisar.

   A versão anterior emitia elementos aninhados (`<Residential><Loft/>`), que é
   sintaxe válida de XML e vocabulário inexistente no VRSync. Passava no
   validador e chegava vazio no portal.

   A ordem da lista É a regra de desempate, e por isso o específico vem antes do
   genérico: "casa de condomínio" tem de casar com Condo antes de casar com
   Home, e "apart-hotel" com Flat antes de Apartment.

   REVISAR: os rótulos foram lidos da documentação do VRSync. Os que têm
   equivalente óbvio em português (Apartment, Home, Store) são seguros; os de
   nicho — Kitnet, Land Lot, Business — são os candidatos a estar com outra
   grafia no vocabulário real do portal. Um rótulo errado não derruba a carga:
   cai no balde genérico, que é o mesmo destino de antes. */
const TIPOS = [
  // ── Residencial ────────────────────────────────────────────────────────────
  [/\bloft\b/i, "Residential / Loft"],
  [/kitnet|kitchenette|quitinete|conjugad/i, "Residential / Kitnet"],
  [/\bflat\b|apart.?hotel/i, "Residential / Flat"],
  [/cobertura|penthouse/i, "Residential / Penthouse"],
  [/apartamento|\bapto\b|studio|st[úu]dio/i, "Residential / Apartment"],
  [/casa de condom|casa em condom|condom[íi]nio fechado/i, "Residential / Condo"],
  [/fazenda|haras/i, "Residential / Farm"],
  [/s[íi]tio|ch[áa]cara|rancho|rural/i, "Residential / Country House"],
  [/sobrado|\bcasa\b|resid[êe]ncia|geminad/i, "Residential / Home"],
  [/pr[ée]dio residencial|edif[íi]cio residencial/i, "Residential / Building"],
  [/terreno|lote|gleba/i, "Residential / Land Lot"],

  // ── Comercial ──────────────────────────────────────────────────────────────
  [/galp[ãa]o|barrac[ãa]o|dep[óo]sito|armaz[ée]m|log[íi]stic/i, "Commercial / Warehouse"],
  [/ind[úu]stri|fabril|f[áa]brica/i, "Commercial / Industrial"],
  [/loja|\bbox\b|quiosque/i, "Commercial / Store"],
  [/ponto comercial|fundo de com[ée]rcio|neg[óo]cio/i, "Commercial / Business"],
  [/sala|conjunto|escrit[óo]rio|laje|andar corporativ|coworking/i, "Commercial / Office"],
  [/pr[ée]dio|edif[íi]cio|hotel|motel|pousada/i, "Commercial / Building"],
];

/* Fora da lista, cada categoria tem um destino. "Home" e "Building" são os
   baldes que o próprio portal usa para o desconhecido — melhor um anúncio
   classificado de forma imperfeita do que um anúncio recusado. */
const PADRAO_RESIDENCIAL = "Residential / Home";
const PADRAO_COMERCIAL = "Commercial / Building";

/**
 * @returns {string} "Residential / Loft" — sempre um valor do vocabulário fechado.
 */
export function tipoVRSync(imovel) {
  const nome = [imovel?.tipoImovel?.descricao, imovel?.propertyType].filter(Boolean).join(" ");
  const comercial = imovel?.finalidade === "COMERCIAL";

  /* A finalidade MANDA na categoria, e o nome só escolhe o subtipo dentro
     dela. Sem isso um "Terreno" marcado como comercial saía
     "Residential / Land Lot" — porque a regra do terreno é residencial na
     lista —, e o anúncio ia parar na busca errada do portal. */
  for (const [padrao, rotulo] of TIPOS) {
    if (!padrao.test(nome)) continue;
    if (comercial === rotulo.startsWith("Commercial")) return rotulo;
  }

  /* Terreno é o caso que mais aparece dos dois lados, e o único com par exato
     nas duas categorias. Vale a tradução explícita. */
  if (/terreno|lote|gleba|[áa]rea/i.test(nome)) {
    return comercial ? "Commercial / Land Lot" : "Residential / Land Lot";
  }

  return comercial ? PADRAO_COMERCIAL : PADRAO_RESIDENCIAL;
}

/* ────────────────────────────────────────────────────────────────────────────
   ESTADO

   `<State abbreviation="SP">São Paulo</State>` — o portal indexa a busca pela
   SIGLA, e sem o atributo o anúncio simplesmente não aparece no filtro de
   estado. Não dá erro; o imóvel some da busca, que é pior.

   O campo `state` do imóvel é texto livre e chega das três formas: "SP", "sp",
   "São Paulo" e "Sao Paulo" (importação de sistema antigo, sem acento). Tudo
   desemboca na mesma sigla aqui.
   ──────────────────────────────────────────────────────────────────────────── */
const UFS = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul",
  MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná",
  PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia",
  RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe",
  TO: "Tocantins",
};

/** Tira acento e baixa a caixa, para o nome escrito de qualquer jeito casar. */
const chaveDeTexto = (t) =>
  String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

const UF_POR_NOME = new Map(
  Object.entries(UFS).map(([sigla, nome]) => [chaveDeTexto(nome), sigla]),
);

/**
 * @returns {{ sigla: string|null, nome: string }} sigla nula quando o texto não
 *   é um estado brasileiro reconhecível — aí o nome vai cru, sem o atributo,
 *   que é melhor do que carimbar uma sigla inventada.
 */
export function estadoVRSync(state) {
  const cru = String(state ?? "").trim();
  if (!cru) return { sigla: null, nome: "" };

  const k = chaveDeTexto(cru);
  if (k.length === 2 && UFS[k.toUpperCase()]) {
    const sigla = k.toUpperCase();
    return { sigla, nome: UFS[sigla] };
  }
  const sigla = UF_POR_NOME.get(k);
  if (sigla) return { sigla, nome: UFS[sigla] };

  return { sigla: null, nome: cru };
}

/* ────────────────────────────────────────────────────────────────────────────
   NÚMEROS

   Preço é INTEIRO em reais. `Math.round(n * 100) / 100` — o que havia antes —
   deixava passar "450000.5", e o portal recusa o anúncio sem dizer por quê.
   Centavo em preço de imóvel não significa nada de todo modo.

   Área continua com casa decimal, porque 62,5 m² é um valor real de escritura
   e arredondar mudaria o dado do cliente. O que faltava na área não era o
   arredondamento: era a UNIDADE.
   ──────────────────────────────────────────────────────────────────────────── */
const inteiro = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? String(Math.round(n)) : null;
};

const numero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? String(Math.round(n * 100) / 100) : null;
};

/* `unit` é obrigatório nos elementos de área. Sem ele o portal assume a unidade
   padrão da carga, e o imóvel sai com a metragem de outro sistema de medida.
   Passa em qualquer validador de esquema e chega errado no anúncio. */
const UNIDADE_AREA = "square metres";

const tagArea = (nome, valor) =>
  valor ? `<${nome} unit="${UNIDADE_AREA}">${xmlEscape(valor)}</${nome}>` : "";

/* Área do anúncio, na ordem em que o portal espera encontrá-la.
   `squareFootage` é o campo antigo e continua sendo o fallback dos imóveis
   cadastrados antes de as áreas detalhadas existirem. */
const areaUtil = (p) => numero(p.areaPrivativa) || numero(p.areaConstruida) || numero(p.squareFootage);
const areaTotal = (p) => numero(p.areaTotal) || numero(p.areaTerreno) || areaUtil(p);

/* Contagem de cômodos SEMPRE sai, inclusive zerada.
   `tag()` omite o vazio, e omitir aqui é diferente de dizer zero: o portal lê a
   ausência de `<Bedrooms>` como "não informado" e tira o imóvel do filtro de
   dormitórios — inclusive do "1 ou mais", que é a busca da maioria. Terreno com
   zero quarto é informação; terreno sem o elemento é lacuna. */
const contagem = (nome, valor) =>
  `<${nome}>${Math.max(0, Math.round(Number(valor) || 0))}</${nome}>`;

/* ────────────────────────────────────────────────────────────────────────────
   FOTOS

   O portal aceita JPEG na especificação e, na prática, recusa o que não termine
   numa extensão que ele reconheça — WEBP sobretudo, que é o que o Cloudinary
   entrega por padrão quando a URL não pede formato e o robô aceita qualquer um.

   Como as fotos moram no NOSSO Cloudinary (inclusive as importadas — ver
   `copiaDeFotos.js`), a conversão é uma reescrita de URL: `f_jpg` força o
   formato na entrega, `q_auto:good` segura o peso e `c_limit,w_1920` corta o
   gigantismo sem esticar foto pequena. Nada é reprocessado aqui; quem converte
   é o CDN, no primeiro acesso do robô.

   Foto que não seja do Cloudinary vai como está — não temos como converter URL
   de terceiro, e mandar cru é melhor do que descartar.
   ──────────────────────────────────────────────────────────────────────────── */
const TRANSFORMACAO_JPG = "f_jpg,q_auto:good,c_limit,w_1920";

export function fotoParaJpg(url) {
  const cru = String(url ?? "").trim();
  if (!cru) return "";
  if (!/res\.cloudinary\.com/i.test(cru)) return cru;
  if (cru.includes("f_jpg")) return cru; // já convertida

  /* Entra logo depois de `/upload/`. Se já houver transformação ali, a nossa
     vira o primeiro componente da cadeia — o Cloudinary aceita e aplica as duas
     na ordem. */
  return cru.replace(/\/upload\//, `/upload/${TRANSFORMACAO_JPG}/`);
}

/**
 * As fotos que vão para o anúncio: sem as 360°, já em JPG e dentro do teto.
 *
 * Uma função só porque `conferirAnuncio` e o gerador precisam contar o MESMO
 * conjunto — contar de um jeito na validação e de outro no XML produziria o
 * pior dos defeitos: o painel dizendo "pronto para publicar" e o portal
 * recusando o anúncio.
 */
export function fotosDoAnuncio(imovel) {
  return (imovel?.images || [])
    .filter((f) => !f.is360 && f.url)
    .slice(0, FOTOS_MAX)
    .map((f) => ({ ...f, url: fotoParaJpg(f.url) }));
}

/* ────────────────────────────────────────────────────────────────────────────
   A CONFERÊNCIA

   Devolve os MOTIVOS, nunca um booleano solto — mesma escolha de
   `flow/funil.js`, e pela mesma razão: "não pode publicar" sem o porquê é uma
   parede, e a pessoa não tem como sair dela.

   Cada motivo traz `campo`, para a tela levar o corretor direto ao lugar que
   falta preencher.
   ──────────────────────────────────────────────────────────────────────────── */
export function conferirAnuncio(imovel) {
  const problemas = [];
  const anotar = (campo, texto) => problemas.push({ campo, texto });

  const titulo = String(imovel?.title || "").trim();
  if (titulo.length < TITULO_MIN) {
    anotar("title", `O título precisa de pelo menos ${TITULO_MIN} caracteres (tem ${titulo.length}).`);
  } else if (titulo.length > TITULO_MAX) {
    anotar("title", `O título passa de ${TITULO_MAX} caracteres (tem ${titulo.length}).`);
  }

  const fotos = fotosDoAnuncio(imovel);
  if (fotos.length < FOTOS_MIN) {
    const faltam = FOTOS_MIN - fotos.length;
    anotar(
      "images",
      `Faltam ${faltam} foto${faltam > 1 ? "s" : ""}: o portal exige ${FOTOS_MIN} e o imóvel tem ${fotos.length}.`,
    );
  }

  if (!inteiro(imovel?.price)) anotar("price", "O imóvel precisa de preço para ir ao portal.");
  if (!String(imovel?.city || "").trim()) anotar("city", "Falta a cidade.");
  if (!estadoVRSync(imovel?.state).sigla) {
    anotar("state", "O estado precisa ser uma UF reconhecível (ex.: SP ou São Paulo).");
  }
  if (!String(imovel?.description || "").trim()) anotar("description", "Falta a descrição.");

  return { pode: problemas.length === 0, problemas };
}

/** Atalho para os filtros. Existe só para o `.filter()` ficar legível. */
export const anuncioPublicavel = (imovel) => conferirAnuncio(imovel).pode;

/* ────────────────────────────────────────────────────────────────────────────
   O ANÚNCIO
   ──────────────────────────────────────────────────────────────────────────── */

/* `displayAddress` diz ao PORTAL o quanto do endereço ele pode mostrar. O
   `<Address>` continua indo — o portal precisa dele para geolocalizar o anúncio
   no mapa e para o corretor achar o imóvel —, mas com "Neighborhood" o anúncio
   público exibe só o bairro.

   Segue a mesma marcação da vitrine, e é isso que importa: se o cliente decidiu
   não publicar a rua, essa decisão não pode valer na página dele e ser ignorada
   no ZAP. Antes o valor era fixo, e a política era acidental. */
function anuncio(imovel, urlDoImovel) {
  const aluguel = imovel.tipoContrato === "LOCACAO";
  const preco = inteiro(imovel.price);
  const precoTag = aluguel ? "RentalPrice" : "ListPrice";
  const estado = estadoVRSync(imovel.state);
  const fotos = fotosDoAnuncio(imovel);
  const legenda = String(imovel.title || "").slice(0, 60);

  const caracteristicas = [
    imovel.suites > 0 ? "Suíte" : null,
    imovel.aceitaPermuta ? "Aceita permuta" : null,
    imovel.andamento === "EM_CONSTRUCAO" ? "Em construção" : null,
  ].filter(Boolean);

  return `    <Listing>
      <ListingID>${xmlEscape(imovel.id)}</ListingID>
      ${tag("Title", String(imovel.title || "").slice(0, TITULO_MAX))}
      <TransactionType>${transacao(imovel.tipoContrato)}</TransactionType>
      ${tag("DetailViewUrl", urlDoImovel || null)}
      <Details>
        <PropertyType>${xmlEscape(tipoVRSync(imovel))}</PropertyType>
        ${tag("Description", String(imovel.description || "").slice(0, DESCRICAO_MAX))}
        ${preco ? `<${precoTag} currency="BRL">${preco}</${precoTag}>` : ""}
        ${tagArea("LivingArea", areaUtil(imovel))}
        ${tagArea("LotArea", areaTotal(imovel))}
        ${contagem("Bedrooms", imovel.bedrooms)}
        ${contagem("Bathrooms", imovel.banheiros || imovel.suites)}
        ${tag("Suites", imovel.suites || null)}
        ${contagem("Garage", imovel.parkingSpots)}
        ${caracteristicas.length ? `<Features>\n${caracteristicas.map((f) => `          <Feature>${xmlEscape(f)}</Feature>`).join("\n")}\n        </Features>` : ""}
      </Details>
      <Location displayAddress="${imovel.exibirEnderecoCompleto ? "Street" : "Neighborhood"}">
        <Country abbreviation="BR">Brasil</Country>
        ${estado.sigla ? `<State abbreviation="${estado.sigla}">${xmlEscape(estado.nome)}</State>` : tag("State", estado.nome)}
        ${tag("City", imovel.city)}
        ${tag("Neighborhood", imovel.neighborhood)}
        ${tag("Address", imovel.address)}
        ${tag("PostalCode", String(imovel.cep || "").replace(/\D/g, "") || null)}
      </Location>
      ${fotos.length ? `<Media>\n${fotos
        .map(
          (f, i) =>
            `        <Item medium="image"${i === 0 ? ' primary="true"' : ""} caption="${xmlEscape(legenda)}">${xmlEscape(f.url)}</Item>`
        )
        .join("\n")}\n      </Media>` : ""}
    </Listing>`;
}

/* ────────────────────────────────────────────────────────────────────────────
   O CABEÇALHO

   `<ContactInfo>` é o bloco que o portal usa para montar o "quem anuncia" —
   nome, telefone e e-mail que aparecem para quem clica em "falar com o
   anunciante". Antes o e-mail e o nome iam SOLTOS no `<Header>`, fora do bloco,
   e o portal os ignorava: o resultado era anúncio sem telefone, e a imobiliária
   recebendo zero contato de uma carga que "funcionou".

   O telefone segue a preferência da própria imobiliária: WhatsApp primeiro,
   porque é onde ela de fato responde.
   ──────────────────────────────────────────────────────────────────────────── */
function contatoDoTenant(tenant, site) {
  const telefone = String(tenant?.whatsapp || tenant?.telefone || "").trim();
  return `    <ContactInfo>
      ${tag("Name", tenant?.name || "Omnimob")}
      ${tag("Email", tenant?.email)}
      ${tag("Website", site)}
      ${tag("Logo", tenant?.logoUrl)}
      ${tag("Telephone", telefone || null)}
    </ContactInfo>`;
}

/**
 * Monta o XML completo do acervo de uma imobiliária.
 *
 * @param {object} tenant   imobiliária (name, email, telefone/whatsapp, logoUrl)
 * @param {Array}  imoveis  já filtrados e com `images` carregadas
 * @param {(imovel) => string} urlDoImovel  endereço público de cada anúncio
 * @param {{ site?: string }} [extra]  endereço público da imobiliária
 */
export function montarFeedVRSync(tenant, imoveis, urlDoImovel, extra = {}) {
  const anuncios = (imoveis || []).map((i) => anuncio(i, urlDoImovel?.(i))).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<ListingDataFeed xmlns="http://www.vivareal.com/schemas/1.0/VRSync"
                 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xsi:schemaLocation="http://www.vivareal.com/schemas/1.0/VRSync http://xml.vivareal.com/vrsync.xsd">
  <Header>
    <Provider>${xmlEscape(tenant?.name || "Omnimob")}</Provider>
    <Email>${xmlEscape(tenant?.email || "")}</Email>
${contatoDoTenant(tenant, extra.site)}
    <PublishDate>${new Date().toISOString()}</PublishDate>
  </Header>
  <Listings>
${anuncios}
  </Listings>
</ListingDataFeed>
`;
}
