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

   ── O QUE ENTRA ──

   Imóvel ATIVO, com `publicarPortais` ligado e pelo menos uma foto. A foto não
   é capricho: anúncio sem imagem é recusado no cadastro do portal e conta como
   erro na importação — vale mais ficar de fora do que sujar o relatório de
   carga da imobiliária.
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

/* Contrato do Omnimob → transação do VRSync.
   PERMUTA e BUILT_TO_SUIT não têm equivalente no esquema; ambas são operações
   de venda para efeito de anúncio, e é assim que o portal deve entendê-las. */
function transacao(tipoContrato) {
  return tipoContrato === "LOCACAO" ? "For Rent" : "For Sale";
}

/* Tipo do imóvel → vocabulário do VRSync.
 *
 * O portal aceita uma lista fechada; qualquer outra coisa cai como "Residential
 * / Home", que é o balde certo para o desconhecido — melhor um anúncio
 * classificado de forma imperfeita do que um anúncio recusado. */
const TIPOS = [
  [/apartamento|apto|flat|kitnet|studio|stúdio/i, ["Residential", "Apartment"]],
  [/cobertura/i, ["Residential", "Penthouse"]],
  [/casa de condom|sobrado|casa/i, ["Residential", "Home"]],
  [/terreno|lote|área|area/i, ["Residential", "Residential Land"]],
  [/sítio|sitio|chácara|chacara|fazenda|rural/i, ["Residential", "Country House"]],
  [/sala|conjunto|escritório|escritorio|laje/i, ["Commercial", "Building"]],
  [/loja|ponto|galpão|galpao|barracão|barracao/i, ["Commercial", "Store"]],
];

function tipoVRSync(imovel) {
  const nome = imovel.tipoImovel?.descricao || imovel.propertyType || "";
  if (imovel.finalidade === "COMERCIAL") {
    for (const [padrao, par] of TIPOS) if (padrao.test(nome) && par[0] === "Commercial") return par;
    return ["Commercial", "Building"];
  }
  for (const [padrao, par] of TIPOS) if (padrao.test(nome)) return par;
  return ["Residential", "Home"];
}

const numero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? String(Math.round(n * 100) / 100) : null;
};

/* Área do anúncio, na ordem em que o portal espera encontrá-la.
   `squareFootage` é o campo antigo e continua sendo o fallback dos imóveis
   cadastrados antes de as áreas detalhadas existirem. */
const areaUtil = (p) => numero(p.areaPrivativa) || numero(p.areaConstruida) || numero(p.squareFootage);
const areaTotal = (p) => numero(p.areaTotal) || numero(p.areaTerreno) || areaUtil(p);

/* `displayAddress` diz ao PORTAL o quanto do endereço ele pode mostrar. O
   `<Address>` continua indo — o portal precisa dele para geolocalizar o anúncio
   no mapa e para o corretor achar o imóvel —, mas com "Neighborhood" o anúncio
   público exibe só o bairro.

   Segue a mesma marcação da vitrine, e é isso que importa: se o cliente decidiu
   não publicar a rua, essa decisão não pode valer na página dele e ser ignorada
   no ZAP. Antes o valor era fixo, e a política era acidental. */
function anuncio(imovel, urlDoImovel) {
  const [categoria, subtipo] = tipoVRSync(imovel);
  const aluguel = imovel.tipoContrato === "LOCACAO";
  const preco = numero(imovel.price);

  /* Máximo de 20 fotos: é o teto que os portais do grupo aceitam por anúncio, e
     mandar mais faz a carga inteira do lote ser rejeitada em vez de as extras
     serem ignoradas. */
  const fotos = (imovel.images || []).slice(0, 20);

  const caracteristicas = [
    imovel.suites > 0 ? "Suíte" : null,
    imovel.aceitaPermuta ? "Aceita permuta" : null,
    imovel.andamento === "EM_CONSTRUCAO" ? "Em construção" : null,
  ].filter(Boolean);

  return `    <Listing>
      <ListingID>${xmlEscape(imovel.id)}</ListingID>
      ${tag("Title", (imovel.title || "").slice(0, 100))}
      <TransactionType>${transacao(imovel.tipoContrato)}</TransactionType>
      ${urlDoImovel ? tag("DetailViewUrl", urlDoImovel) : ""}
      <Details>
        <PropertyType>
          <${categoria}>
            <${subtipo}/>
          </${categoria}>
        </PropertyType>
        ${tag("Description", (imovel.description || "").slice(0, 3000))}
        ${preco ? `<${aluguel ? "RentalPrice" : "ListPrice"} currency="BRL">${preco}</${aluguel ? "RentalPrice" : "ListPrice"}>` : ""}
        ${tag("LivingArea", areaUtil(imovel))}
        ${tag("LotArea", areaTotal(imovel))}
        ${tag("Bedrooms", imovel.bedrooms || null)}
        ${tag("Bathrooms", imovel.banheiros || imovel.suites || null)}
        ${tag("Suites", imovel.suites || null)}
        ${tag("Garage", imovel.parkingSpots || null)}
        ${caracteristicas.length ? `<Features>\n${caracteristicas.map((f) => `          <Feature>${xmlEscape(f)}</Feature>`).join("\n")}\n        </Features>` : ""}
      </Details>
      <Location displayAddress="${imovel.exibirEnderecoCompleto ? "Street" : "Neighborhood"}">
        <Country abbreviation="BR">Brasil</Country>
        ${tag("State", imovel.state)}
        ${tag("City", imovel.city)}
        ${tag("Neighborhood", imovel.neighborhood)}
        ${tag("Address", imovel.address)}
        ${tag("PostalCode", (imovel.cep || "").replace(/\D/g, "") || null)}
      </Location>
      ${fotos.length ? `<Media>\n${fotos
        .map(
          (f, i) =>
            `        <Item medium="image"${i === 0 ? ' primary="true"' : ""} caption="${xmlEscape((imovel.title || "").slice(0, 60))}">${xmlEscape(f.url)}</Item>`
        )
        .join("\n")}\n      </Media>` : ""}
    </Listing>`;
}

/**
 * Monta o XML completo do acervo de uma imobiliária.
 *
 * @param {object} tenant   imobiliária (name, email, creci)
 * @param {Array}  imoveis  já filtrados e com `images` carregadas
 * @param {(imovel) => string} urlDoImovel  endereço público de cada anúncio
 */
export function montarFeedVRSync(tenant, imoveis, urlDoImovel) {
  const anuncios = imoveis.map((i) => anuncio(i, urlDoImovel?.(i))).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<ListingDataFeed xmlns="http://www.vivareal.com/schemas/1.0/VRSync"
                 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xsi:schemaLocation="http://www.vivareal.com/schemas/1.0/VRSync http://xml.vivareal.com/vrsync.xsd">
  <Header>
    <Provider>${xmlEscape(tenant.name || "Omnimob")}</Provider>
    ${tag("Email", tenant.email)}
    <ContactName>${xmlEscape(tenant.name || "")}</ContactName>
    <PublishDate>${new Date().toISOString()}</PublishDate>
  </Header>
  <Listings>
${anuncios}
  </Listings>
</ListingDataFeed>
`;
}
