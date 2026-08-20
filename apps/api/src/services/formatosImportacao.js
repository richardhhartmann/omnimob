import { XMLParser } from "fast-xml-parser";

/* ────────────────────────────────────────────────────────────────────────────
   Os formatos que a importação aceita, e como cada um vira linha nossa.

   A importação era por PLANILHA: o navegador lia o arquivo, mostrava as colunas
   e a pessoa parava para responder "esta coluna é o título?" quarenta vezes.
   Funcionava, e tinha dois problemas que só apareciam depois. O pareamento
   errado só era percebido com quinhentos imóveis já dentro — e a planilha é uma
   FOTO: no dia seguinte ela estava velha, e sincronizar de novo significava
   exportar, parear e conferir tudo outra vez.

   Um feed não tem nenhum dos dois. O formato já diz o que cada campo é, então
   não há o que parear e não há como parear errado; e o mesmo endereço, lido
   amanhã, traz o acervo de amanhã.

   ── OS TRÊS FORMATOS ──

     VRSync   o padrão de fato do mercado brasileiro. É o que ZAP, VivaReal e
              OLX Imóveis consomem, e por isso é o que praticamente todo sistema
              imobiliário sabe EXPORTAR. É o caminho da migração real: a
              imobiliária pede o link do feed ao fornecedor antigo e cola aqui.
              Só imóveis — o esquema não tem clientes nem usuários.

     Omnimob  o nosso XML, simétrico ao que a API devolve. Existe para o que o
              VRSync não cobre: clientes e equipe. Quem exporta daqui consegue
              reimportar em outra conta sem conversão nenhuma.

     JSON     o mesmo formato do corpo dos endpoints de escrita. Para quem tem
              um desenvolvedor do outro lado e não quer montar XML.

   ── O QUE ESTE ARQUIVO NÃO FAZ ──

   Não escreve no banco. Ele converte para as LINHAS que o `importacaoService`
   já sabe importar — as mesmas que a planilha produzia. É o que faz "atualizar
   ou criar por `origemExterna`", a prévia e o relatório de erros continuarem
   valendo sem uma segunda implementação.
   ──────────────────────────────────────────────────────────────────────────── */

/* `isArray` obriga estes nós a virarem lista mesmo quando há um só. Sem isso, o
   parser devolve objeto para "um imóvel" e array para "dois", e todo consumidor
   precisaria testar o tipo — a linha esquecida faria um feed de um imóvel só
   importar zero, calado. */
const LISTAS = new Set(["Listing", "Item", "Feature", "imovel", "cliente", "usuario", "foto"]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // Texto sempre string: o parser converteria "01310-100" para número e
  // "00123" perderia os zeros à esquerda. CEP e código de imóvel vivem disso.
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  /* Namespace fora. Feeds reais chegam com `<vr:Listing>` ou sem prefixo
     dependendo do exportador, e tratar as duas grafias dobraria cada caminho
     abaixo por uma diferença que não muda o significado. */
  removeNSPrefix: true,
  isArray: (nome) => LISTAS.has(nome),
});

/** O texto de um nó, seja ele string, `{ "#text": … }` ou ausente. */
function txt(no) {
  if (no === null || no === undefined) return "";
  if (typeof no === "string") return no.trim();
  if (typeof no === "number") return String(no);
  if (typeof no === "object" && no["#text"] !== undefined) return String(no["#text"]).trim();
  return "";
}

/** Primeiro caminho que existir. Feeds variam onde põem a mesma informação. */
function primeiro(objeto, ...caminhos) {
  for (const caminho of caminhos) {
    let atual = objeto;
    for (const parte of caminho.split(".")) {
      atual = atual?.[parte];
      if (atual === undefined) break;
    }
    const valor = txt(atual);
    if (valor) return valor;
  }
  return "";
}

/* ── VRSync ────────────────────────────────────────────────────────────────
   O `PropertyType` do esquema é um aninhamento de tags vazias — a categoria
   contém o subtipo, e ambos são NOMES DE ELEMENTO, não texto:

       <PropertyType><Residential><Apartment/></Residential></PropertyType>

   Então o tipo do imóvel não se lê com `txt()`; lê-se pela CHAVE do objeto. */
function tipoDoVRSync(detalhes) {
  const raiz = detalhes?.PropertyType;
  if (!raiz || typeof raiz !== "object") return "";
  const categoria = Object.keys(raiz).find((k) => !k.startsWith("@_") && k !== "#text");
  if (!categoria) return "";
  const dentro = raiz[categoria];
  if (!dentro || typeof dentro !== "object") return String(categoria);
  const subtipo = Object.keys(dentro).find((k) => !k.startsWith("@_") && k !== "#text");
  return String(subtipo || categoria);
}

/* Tradução do vocabulário do esquema para o que uma imobiliária brasileira
   chama as coisas. O que não estiver aqui entra com o nome original — o tipo
   vira um `TipoImovel` da imobiliária, e um nome em inglês é melhor que nenhum.
   O nome também é o que casa com o catálogo existente, então traduzir é o que
   evita criar "Apartment" ao lado do "Apartamento" que a pessoa já tinha. */
const TIPO_PT = {
  Apartment: "Apartamento", Home: "Casa", Condo: "Casa de condomínio",
  Penthouse: "Cobertura", Land: "Terreno", ResidentialLand: "Terreno",
  Building: "Prédio", Office: "Sala comercial", CommercialBuilding: "Prédio comercial",
  Business: "Ponto comercial", Loft: "Loft", Flat: "Flat", Farm: "Fazenda",
  ResidentialAllotmentLand: "Terreno", CommercialAllotmentLand: "Terreno comercial",
  Residential: "Residencial", Commercial: "Comercial",
};

function imovelDoVRSync(listing, indice) {
  const d = listing.Details || {};
  const l = listing.Location || {};
  const aluguel = /rent/i.test(primeiro(listing, "TransactionType"));

  /* `Media.Item` traz fotos e também vídeos e tours; o atributo `medium` diz
     qual é qual. Sem o filtro, a URL de um vídeo do YouTube entraria na
     galeria como se fosse foto — e o Cloudinary devolveria erro no meio da
     importação, para uma linha que nem deveria ter sido tentada. */
  const fotos = (listing.Media?.Item || l.Media?.Item || [])
    .filter((item) => {
      const meio = String(item?.["@_medium"] || "image").toLowerCase();
      return meio === "image" || meio === "photo";
    })
    .map((item) => txt(item))
    .filter((url) => /^https?:\/\//i.test(url));

  const tipoBruto = tipoDoVRSync(d);

  return {
    __linha: indice + 1,
    origemExterna: primeiro(listing, "ListingID", "@_id"),
    title: primeiro(listing, "Title") || primeiro(d, "Description").slice(0, 80),
    description: primeiro(d, "Description"),
    // Aluguel e venda moram em tags diferentes; um feed de locação não tem
    // `ListPrice` nenhum, e ler só ele importaria tudo com preço zero.
    price: primeiro(d, "ListPrice", "RentalPrice", "SalePrice"),
    tipoImovel: TIPO_PT[tipoBruto] || tipoBruto,
    tipoContrato: aluguel ? "LOCACAO" : "VENDA",
    address: primeiro(l, "Address"),
    neighborhood: primeiro(l, "Neighborhood"),
    city: primeiro(l, "City"),
    state: primeiro(l, "State"),
    cep: primeiro(l, "PostalCode"),
    bedrooms: primeiro(d, "Bedrooms"),
    suites: primeiro(d, "Suites"),
    banheiros: primeiro(d, "Bathrooms"),
    parkingSpots: primeiro(d, "Garage"),
    areaPrivativa: primeiro(d, "LivingArea"),
    areaTotal: primeiro(d, "LotArea"),
    fotos,
  };
}

/* ── XML Omnimob ───────────────────────────────────────────────────────────
   Simétrico ao que a nossa API devolve: `<omnimob><imoveis><imovel>…`. Os
   nomes das tags são os nomes dos nossos campos, então a conversão é uma cópia
   com as fotos tratadas à parte. */
function doXmlOmnimob(no, indice) {
  const linha = { __linha: indice + 1 };
  for (const [chave, valor] of Object.entries(no)) {
    if (chave.startsWith("@_") || chave === "#text") continue;
    if (chave === "fotos") {
      linha.fotos = (valor?.foto || [])
        .map((f) => txt(f))
        .filter((url) => /^https?:\/\//i.test(url));
      continue;
    }
    linha[chave] = txt(valor);
  }
  return linha;
}

const RAIZ_POR_ENTIDADE = { imoveis: "imovel", clientes: "cliente", usuarios: "usuario" };

/**
 * Converte o corpo bruto de uma fonte em linhas prontas para o
 * `importacaoService`.
 *
 * @param {string} corpo     o que veio da URL ou do corpo da requisição
 * @param {string} entidade  "imoveis" | "clientes" | "usuarios"
 * @param {string} tipoConteudo  o `content-type` da resposta, quando houver
 * @returns {{formato: string, linhas: Array}}
 */
export function lerFonte(corpo, entidade, tipoConteudo = "") {
  const bruto = String(corpo || "").trim();
  if (!bruto) throw new ErroDeFormato("A fonte respondeu vazio.");

  const pareceJson = bruto.startsWith("{") || bruto.startsWith("[")
    || /json/i.test(tipoConteudo);

  if (pareceJson) return { formato: "json", linhas: lerJson(bruto, entidade) };
  return lerXml(bruto, entidade);
}

/** Erro que a tela mostra ao cliente. Separado do 500 genérico de propósito:
    "a fonte respondeu HTML em vez de XML" é acionável; "erro interno" não. */
export class ErroDeFormato extends Error {}

function lerJson(bruto, entidade) {
  let dados;
  try {
    dados = JSON.parse(bruto);
  } catch {
    throw new ErroDeFormato("O conteúdo não é um JSON válido.");
  }
  /* Três formas aceitas, porque as três aparecem: a lista crua, `{ imoveis: […] }`
     (o que a nossa API devolve) e `{ dados: […] }` (comum em APIs de terceiros). */
  const lista = Array.isArray(dados) ? dados : dados?.[entidade] || dados?.dados || dados?.data;
  if (!Array.isArray(lista)) {
    throw new ErroDeFormato(`Não encontrei uma lista de ${entidade} no JSON.`);
  }
  return lista.map((item, i) => ({ __linha: i + 1, ...item }));
}

function lerXml(bruto, entidade) {
  let arvore;
  try {
    arvore = parser.parse(bruto);
  } catch (erro) {
    throw new ErroDeFormato(`O conteúdo não é um XML válido: ${erro.message}`);
  }

  // VRSync — o formato que praticamente todo sistema imobiliário exporta.
  const listings = arvore?.ListingDataFeed?.Listings?.Listing;
  if (Array.isArray(listings)) {
    if (entidade !== "imoveis") {
      throw new ErroDeFormato(
        "Este é um feed VRSync, que só descreve imóveis. Para clientes e equipe, use o XML da Omnimob ou JSON.",
      );
    }
    return { formato: "vrsync", linhas: listings.map(imovelDoVRSync) };
  }

  // XML da Omnimob.
  const raiz = RAIZ_POR_ENTIDADE[entidade];
  const nos = arvore?.omnimob?.[entidade]?.[raiz];
  if (Array.isArray(nos)) {
    return { formato: "omnimob", linhas: nos.map(doXmlOmnimob) };
  }

  /* Sem `<ListingDataFeed>` e sem `<omnimob>`. A causa esmagadoramente mais
     comum não é um formato exótico: é a URL devolver uma página de login ou um
     404 em HTML, com status 200. Dizer isso poupa a pessoa de procurar defeito
     no lugar errado. */
  const raizes = Object.keys(arvore || {}).filter((k) => k !== "?xml").join(", ");
  throw new ErroDeFormato(
    raizes
      ? `Não reconheci o formato. A raiz do documento é "${raizes}"; esperava ListingDataFeed (VRSync) ou omnimob. Confira se o endereço aponta para o arquivo e não para uma página.`
      : "Não reconheci o formato do documento.",
  );
}
