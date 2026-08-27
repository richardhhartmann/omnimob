import test from "node:test";
import assert from "node:assert/strict";

import {
  montarFeedVRSync,
  conferirAnuncio,
  anuncioPublicavel,
  tipoVRSync,
  estadoVRSync,
  fotoParaJpg,
  fotosDoAnuncio,
  xmlEscape,
  TITULO_MIN,
  TITULO_MAX,
  FOTOS_MIN,
  FOTOS_MAX,
} from "../src/services/feedPortais.js";

/* ────────────────────────────────────────────────────────────────────────────
   O GERADOR VRSYNC.

   ── POR QUE ESTE ARQUIVO NÃO TOCA NO BANCO ──

   Ao contrário do resto da suíte da API, aqui não há vazamento entre
   imobiliárias a guardar: o gerador recebe objetos prontos e devolve texto. O
   risco é o mesmo de `importacaoFormatos.test.js`, e é o oposto do isolamento —
   é INTERPRETAÇÃO. Um preço com centavo, uma área sem unidade ou um tipo no
   vocabulário errado não derrubam nada: produzem quinhentos anúncios errados,
   em silêncio, num portal que não nos responde.

   ── O DEFEITO QUE ISTO GUARDA ──

   A versão anterior PASSAVA no validador de XML e mesmo assim publicava errado.
   Todo caso abaixo é uma coisa que o validador de esquema aprova e o portal
   entende de outro jeito:

     • `<Residential><Apartment/></Residential>` — XML válido, vocabulário
       inexistente. O portal lia o tipo como vazio.
     • `450000.5` — número válido, preço recusado.
     • `<LivingArea>120</LivingArea>` sem `unit` — metragem interpretada noutra
       unidade.
     • `<State>São Paulo</State>` sem `abbreviation` — some da busca por estado.
     • `<Bedrooms>` ausente por ser zero — some do filtro de dormitórios.

   Nenhum desses um validador pega. Todos estes testes pegam.
   ──────────────────────────────────────────────────────────────────────────── */

const CLOUD = "https://res.cloudinary.com/dpwuxmbli/image/upload/v1700000000/domus";

/** Um imóvel que PASSA na conferência. Cada teste estraga só o que quer testar. */
function imovelDe(extra = {}) {
  return {
    id: "imv_1",
    title: "Apartamento amplo no Centro",
    description: "Três dormitórios, uma vaga, de frente para a praça.",
    price: 450000,
    city: "Campinas",
    state: "SP",
    neighborhood: "Centro",
    address: "Rua das Acácias, 100",
    cep: "13010-000",
    bedrooms: 3,
    banheiros: 2,
    suites: 1,
    parkingSpots: 1,
    areaPrivativa: 92.5,
    areaTotal: 120,
    squareFootage: 92.5,
    tipoImovel: { descricao: "Apartamento" },
    images: Array.from({ length: FOTOS_MIN }, (_, i) => ({
      id: `img_${i}`,
      url: `${CLOUD}/foto${i}.png`,
      is360: false,
    })),
    ...extra,
  };
}

const feedDe = (imovel, url = (i) => `https://omnimob.app/vitrine/x/imovel/${i.id}`) =>
  montarFeedVRSync(
    { name: "Imobiliária X", email: "contato@x.com.br", whatsapp: "19999990000", logoUrl: `${CLOUD}/logo.png` },
    [imovel],
    url,
    { site: "https://omnimob.app/vitrine/x" },
  );

/* ══════════════════════════════════════════════════════════════════════════
   TIPO DO IMÓVEL — texto, não elemento aninhado
   ══════════════════════════════════════════════════════════════════════════ */

test("PropertyType é TEXTO no formato Categoria / Subtipo", () => {
  const xml = feedDe(imovelDe());
  assert.match(xml, /<PropertyType>Residential \/ Apartment<\/PropertyType>/);

  /* O vocabulário aninhado da versão anterior. Se um destes voltar, alguém
     reintroduziu a forma que passa no validador e chega vazia no portal. */
  assert.ok(!xml.includes("<Residential>"), "o tipo voltou a ser elemento aninhado");
  assert.ok(!xml.includes("<Apartment/>"), "o tipo voltou a ser elemento aninhado");
});

test("Loft vira Residential / Loft, e não cai no balde de Casa", () => {
  /* O caso nomeado: "loft" não casava com padrão nenhum da lista antiga e saía
     classificado como Home. É o exemplo de erro que o validador aprova. */
  assert.equal(tipoVRSync({ tipoImovel: { descricao: "Loft" } }), "Residential / Loft");
  assert.equal(tipoVRSync({ tipoImovel: { descricao: "Loft Industrial" } }), "Residential / Loft");
});

test("o vocabulário cobre o que o cadastro oferece", () => {
  const esperado = [
    ["Apartamento", null, "Residential / Apartment"],
    ["Cobertura", null, "Residential / Penthouse"],
    ["Kitnet", null, "Residential / Kitnet"],
    ["Flat", null, "Residential / Flat"],
    ["Casa", null, "Residential / Home"],
    ["Sobrado", null, "Residential / Home"],
    ["Casa de Condomínio", null, "Residential / Condo"],
    ["Chácara", null, "Residential / Country House"],
    ["Fazenda", null, "Residential / Farm"],
    ["Terreno", null, "Residential / Land Lot"],
    ["Sala Comercial", "COMERCIAL", "Commercial / Office"],
    ["Loja", "COMERCIAL", "Commercial / Store"],
    ["Galpão", "COMERCIAL", "Commercial / Warehouse"],
    ["Ponto Comercial", "COMERCIAL", "Commercial / Business"],
  ];
  for (const [descricao, finalidade, alvo] of esperado) {
    assert.equal(
      tipoVRSync({ tipoImovel: { descricao }, finalidade }),
      alvo,
      `${descricao} deveria virar ${alvo}`,
    );
  }
});

test("a finalidade manda na categoria — terreno comercial não é residencial", () => {
  /* O mesmo nome nas duas categorias. Sem a finalidade decidindo, um terreno
     marcado como comercial saía "Residential / Land Lot" e ia parar na busca
     errada do portal. */
  const terreno = { tipoImovel: { descricao: "Terreno" } };
  assert.equal(tipoVRSync(terreno), "Residential / Land Lot");
  assert.equal(tipoVRSync({ ...terreno, finalidade: "COMERCIAL" }), "Commercial / Land Lot");
});

test("tipo desconhecido cai no balde da categoria, nunca fora do vocabulário", () => {
  assert.equal(tipoVRSync({ tipoImovel: { descricao: "Coisa Nova" } }), "Residential / Home");
  assert.equal(
    tipoVRSync({ tipoImovel: { descricao: "Coisa Nova" }, finalidade: "COMERCIAL" }),
    "Commercial / Building",
  );
  assert.equal(tipoVRSync({}), "Residential / Home");
});

/* ══════════════════════════════════════════════════════════════════════════
   NÚMEROS
   ══════════════════════════════════════════════════════════════════════════ */

test("preço é INTEIRO — centavo faz o portal recusar o anúncio", () => {
  const xml = feedDe(imovelDe({ price: 450000.5 }));
  assert.match(xml, /<ListPrice currency="BRL">450001<\/ListPrice>/);
  assert.ok(!/<ListPrice[^>]*>[\d]+\.[\d]+</.test(xml), "sobrou casa decimal no preço");
});

test("locação usa RentalPrice, e também inteiro", () => {
  const xml = feedDe(imovelDe({ tipoContrato: "LOCACAO", price: 2500.75 }));
  assert.match(xml, /<RentalPrice currency="BRL">2501<\/RentalPrice>/);
  assert.match(xml, /<TransactionType>For Rent<\/TransactionType>/);
  assert.ok(!xml.includes("ListPrice"));
});

test("permuta e venda são For Sale — o esquema não tem terceira transação", () => {
  assert.match(feedDe(imovelDe({ tipoContrato: "PERMUTA" })), /<TransactionType>For Sale</);
  assert.match(feedDe(imovelDe({ tipoContrato: null })), /<TransactionType>For Sale</);
});

test("área leva unit=square metres — sem ele a metragem chega noutra unidade", () => {
  const xml = feedDe(imovelDe());
  assert.match(xml, /<LivingArea unit="square metres">92\.5<\/LivingArea>/);
  assert.match(xml, /<LotArea unit="square metres">120<\/LotArea>/);

  // Nenhum elemento de área pode sair sem a unidade.
  assert.ok(!/<LivingArea>/.test(xml), "LivingArea saiu sem unidade");
  assert.ok(!/<LotArea>/.test(xml), "LotArea saiu sem unidade");
});

test("a área mantém a casa decimal — 62,5 m² é valor de escritura", () => {
  const xml = feedDe(imovelDe({ areaPrivativa: 62.5, areaTotal: null, areaTerreno: null }));
  assert.match(xml, /<LivingArea unit="square metres">62\.5</);
});

test("Bedrooms e Bathrooms saem SEMPRE, inclusive zerados", () => {
  /* Zero é informação; ausente é lacuna. O portal lê a ausência como "não
     informado" e tira o imóvel do filtro de dormitórios — inclusive do
     "1 ou mais", que é a busca da maioria. */
  const terreno = imovelDe({ bedrooms: 0, banheiros: 0, suites: 0, parkingSpots: 0 });
  const xml = feedDe(terreno);
  assert.match(xml, /<Bedrooms>0<\/Bedrooms>/);
  assert.match(xml, /<Bathrooms>0<\/Bathrooms>/);
  assert.match(xml, /<Garage>0<\/Garage>/);
});

test("sem banheiros cadastrados, as suítes servem de estimativa", () => {
  // O acervo antigo não tinha o campo `banheiros`; toda suíte tem banheiro.
  const xml = feedDe(imovelDe({ banheiros: 0, suites: 2 }));
  assert.match(xml, /<Bathrooms>2<\/Bathrooms>/);
  assert.match(xml, /<Suites>2<\/Suites>/);
});

/* ══════════════════════════════════════════════════════════════════════════
   LOCALIZAÇÃO
   ══════════════════════════════════════════════════════════════════════════ */

test("State leva a SIGLA no atributo — sem ela o anúncio some da busca", () => {
  assert.match(feedDe(imovelDe()), /<State abbreviation="SP">São Paulo<\/State>/);
});

test("o estado escrito de qualquer jeito chega na mesma sigla", () => {
  for (const escrito of ["SP", "sp", "São Paulo", "Sao Paulo", "  são paulo  "]) {
    assert.equal(estadoVRSync(escrito).sigla, "SP", `"${escrito}" deveria virar SP`);
  }
  assert.equal(estadoVRSync("Espirito Santo").sigla, "ES");
  assert.equal(estadoVRSync("rio grande do sul").sigla, "RS");
});

test("estado irreconhecível vai sem atributo, e não com sigla inventada", () => {
  const xml = feedDe(imovelDe({ state: "Sarcelas" }));
  assert.match(xml, /<State>Sarcelas<\/State>/);
  assert.ok(!/abbreviation="SA"/.test(xml));
});

test("displayAddress segue a escolha da vitrine, não um valor fixo", () => {
  assert.match(feedDe(imovelDe({ exibirEnderecoCompleto: true })), /displayAddress="Street"/);
  assert.match(feedDe(imovelDe({ exibirEnderecoCompleto: false })), /displayAddress="Neighborhood"/);
});

test("o CEP vai só com dígitos", () => {
  assert.match(feedDe(imovelDe({ cep: "13010-000" })), /<PostalCode>13010000<\/PostalCode>/);
});

/* ══════════════════════════════════════════════════════════════════════════
   CONTATO E LINK
   ══════════════════════════════════════════════════════════════════════════ */

test("ContactInfo é um BLOCO — solto no Header o portal ignora", () => {
  /* Era o defeito mais caro dos oito: anúncio publicado sem telefone. A carga
     "funcionava" e a imobiliária recebia zero contato. */
  const xml = feedDe(imovelDe());
  assert.match(xml, /<ContactInfo>[\s\S]*<\/ContactInfo>/);
  assert.match(xml, /<ContactInfo>[\s\S]*<Telephone>19999990000<\/Telephone>[\s\S]*<\/ContactInfo>/);
  assert.match(xml, /<ContactInfo>[\s\S]*<Name>Imobiliária X<\/Name>/);
  assert.match(xml, /<Website>https:\/\/omnimob\.app\/vitrine\/x<\/Website>/);
});

test("o telefone prefere o WhatsApp — é onde a imobiliária responde", () => {
  const so = (t) => montarFeedVRSync(t, [], null);
  assert.match(so({ name: "A", whatsapp: "11911112222", telefone: "1133334444" }), /<Telephone>11911112222</);
  assert.match(so({ name: "A", whatsapp: "", telefone: "1133334444" }), /<Telephone>1133334444</);
  // Sem nenhum dos dois o elemento não sai vazio — some.
  assert.ok(!so({ name: "A", whatsapp: "", telefone: "" }).includes("<Telephone>"));
});

test("DetailViewUrl leva o endereço público do imóvel", () => {
  const xml = feedDe(imovelDe());
  assert.match(xml, /<DetailViewUrl>https:\/\/omnimob\.app\/vitrine\/x\/imovel\/imv_1<\/DetailViewUrl>/);
});

test("sem função de URL o elemento some, e não sai vazio", () => {
  const xml = montarFeedVRSync({ name: "A" }, [imovelDe()], null);
  assert.ok(!xml.includes("<DetailViewUrl>"));
});

/* ══════════════════════════════════════════════════════════════════════════
   FOTOS
   ══════════════════════════════════════════════════════════════════════════ */

test("a foto do Cloudinary sai convertida para JPG", () => {
  const convertida = fotoParaJpg(`${CLOUD}/casa.png`);
  assert.match(convertida, /\/upload\/f_jpg,q_auto:good,c_limit,w_1920\//);
  assert.ok(convertida.endsWith("/domus/casa.png"), "o caminho do arquivo não pode mudar");
});

test("converter duas vezes não empilha transformação", () => {
  const uma = fotoParaJpg(`${CLOUD}/casa.png`);
  assert.equal(fotoParaJpg(uma), uma);
});

test("foto de terceiro vai como está — não temos como converter", () => {
  const externa = "https://cdn.outrosistema.com.br/fotos/9911.jpg";
  assert.equal(fotoParaJpg(externa), externa);
});

test("as 360° ficam de fora do feed", () => {
  const imovel = imovelDe();
  imovel.images.push({ id: "t", url: `${CLOUD}/tour.jpg`, is360: true });
  assert.equal(fotosDoAnuncio(imovel).length, FOTOS_MIN);
  assert.ok(!feedDe(imovel).includes("tour.jpg"));
});

test("o teto de 20 fotos é respeitado — passar dele rejeita a carga inteira", () => {
  const imovel = imovelDe({
    images: Array.from({ length: 30 }, (_, i) => ({ id: `i${i}`, url: `${CLOUD}/f${i}.jpg`, is360: false })),
  });
  assert.equal(fotosDoAnuncio(imovel).length, FOTOS_MAX);
  const itens = feedDe(imovel).match(/<Item /g) || [];
  assert.equal(itens.length, FOTOS_MAX);
});

test("a primeira foto é a principal, e só ela", () => {
  const xml = feedDe(imovelDe());
  assert.equal((xml.match(/primary="true"/g) || []).length, 1);
  assert.match(xml, /<Item medium="image" primary="true"/);
});

/* ══════════════════════════════════════════════════════════════════════════
   A CONFERÊNCIA
   ══════════════════════════════════════════════════════════════════════════ */

test("o imóvel completo passa", () => {
  const { pode, problemas } = conferirAnuncio(imovelDe());
  assert.equal(pode, true, `não deveria ter problema: ${JSON.stringify(problemas)}`);
  assert.equal(problemas.length, 0);
});

test("o título é cobrado nos dois extremos, 10 e 100", () => {
  const curto = conferirAnuncio(imovelDe({ title: "Casa" }));
  assert.equal(curto.pode, false);
  assert.ok(curto.problemas.some((p) => p.campo === "title"));

  // Exatamente no mínimo passa.
  assert.equal(conferirAnuncio(imovelDe({ title: "A".repeat(TITULO_MIN) })).pode, true);
  assert.equal(conferirAnuncio(imovelDe({ title: "A".repeat(TITULO_MAX) })).pode, true);

  const longo = conferirAnuncio(imovelDe({ title: "A".repeat(TITULO_MAX + 1) }));
  assert.equal(longo.pode, false);
  assert.ok(longo.problemas.some((p) => p.campo === "title"));
});

test("menos de cinco fotos reprova, e o motivo diz quantas faltam", () => {
  const imovel = imovelDe({
    images: [{ id: "a", url: `${CLOUD}/a.jpg`, is360: false }, { id: "b", url: `${CLOUD}/b.jpg`, is360: false }],
  });
  const { pode, problemas } = conferirAnuncio(imovel);
  assert.equal(pode, false);
  const foto = problemas.find((p) => p.campo === "images");
  assert.ok(foto, "faltou o motivo das fotos");
  assert.match(foto.texto, /Faltam 3 fotos/);
});

test("uma 360° não conta como foto do anúncio", () => {
  /* Contar diferente aqui e no gerador produziria o pior defeito possível: o
     painel dizendo "pronto para publicar" e o portal recusando. */
  const imovel = imovelDe();
  imovel.images = [...imovel.images.slice(0, 4), { id: "t", url: `${CLOUD}/t.jpg`, is360: true }];
  assert.equal(conferirAnuncio(imovel).pode, false);
});

test("os motivos vêm NOMEADOS, nunca um booleano solto", () => {
  const { problemas } = conferirAnuncio({ title: "", images: [] });
  assert.ok(problemas.length >= 4);
  for (const p of problemas) {
    assert.ok(p.campo, "todo motivo precisa apontar um campo");
    assert.ok(p.texto && /[a-záéíóúâêôãõç]/i.test(p.texto), "o motivo precisa ser frase em português");
  }
  const campos = problemas.map((p) => p.campo);
  for (const esperado of ["title", "images", "price", "city", "state"]) {
    assert.ok(campos.includes(esperado), `faltou o motivo de ${esperado}`);
  }
});

test("estado irreconhecível reprova a publicação", () => {
  assert.equal(anuncioPublicavel(imovelDe({ state: "Sarcelas" })), false);
  assert.equal(anuncioPublicavel(imovelDe({ state: "MG" })), true);
});

test("preço zerado reprova", () => {
  assert.equal(anuncioPublicavel(imovelDe({ price: 0 })), false);
});

/* ══════════════════════════════════════════════════════════════════════════
   O QUE JÁ FUNCIONAVA E NÃO PODE REGREDIR
   ══════════════════════════════════════════════════════════════════════════ */

test("texto do cliente é escapado, inclusive no atributo caption", () => {
  const xml = feedDe(imovelDe({ title: 'Casa "grande" & <boa> no Centro' }));
  assert.ok(!xml.includes("<boa>"), "escapou de dentro do XML");
  assert.match(xml, /&quot;grande&quot; &amp; &lt;boa&gt;/);
});

test("caractere de controle é removido — derruba o parser do portal", () => {
  assert.equal(xmlEscape("Casa boa"), "Casa boa");
});

test("acervo vazio ainda produz XML válido, não erro", () => {
  const xml = montarFeedVRSync({ name: "A" }, [], null);
  assert.match(xml, /<Listings>/);
  assert.match(xml, /<\/ListingDataFeed>/);
  assert.ok(!xml.includes("<Listing>"));
});

test("o envelope declara o esquema VRSync", () => {
  const xml = feedDe(imovelDe());
  assert.match(xml, /xmlns="http:\/\/www\.vivareal\.com\/schemas\/1\.0\/VRSync"/);
  assert.match(xml, /<PublishDate>\d{4}-\d{2}-\d{2}T/);
});

test("as tags abrem e fecham em pares", () => {
  /* Um parser de verdade seria melhor, mas traria dependência nova para uma
     checagem que a contagem já resolve: o gerador monta o XML com template
     literal, e o defeito real desse jeito de montar é a tag que não fecha. */
  const xml = feedDe(imovelDe());
  for (const nome of ["Listing", "Details", "Location", "Media", "ContactInfo", "Header", "Listings"]) {
    const abre = (xml.match(new RegExp(`<${nome}[ >]`, "g")) || []).length;
    const fecha = (xml.match(new RegExp(`</${nome}>`, "g")) || []).length;
    assert.equal(abre, fecha, `${nome}: ${abre} aberturas para ${fecha} fechamentos`);
  }
});
