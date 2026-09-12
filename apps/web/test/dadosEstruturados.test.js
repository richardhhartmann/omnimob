import test from "node:test";
import assert from "node:assert/strict";
import {
  esquemaDoImovel, esquemaDaImobiliaria, esquemaDaTrilha, tipoSchema, diasSchema, serializar,
} from "../src/utils/dadosEstruturados.js";

/* ── O que esta suíte guarda ─────────────────────────────────────────────────
   O JSON-LD é lido por robô, não por gente: um campo errado não aparece na
   tela e ninguém reclama — o Google só deixa de mostrar o preço, ou pior,
   publica a rua de um imóvel cujo dono pediu para escondê-la. Os dois casos
   são silenciosos, e é por isso que estão aqui. */

const imovel = {
  title: "Apartamento com varanda", description: "Dois quartos, sol da manhã.",
  price: "450000.00", propertyType: "Apartamento", tipoContrato: "VENDA",
  bedrooms: 2, banheiros: 0, parkingSpots: 1, squareFootage: 68,
  address: "Rua das Flores, 123", cep: "01310-100", neighborhood: "Jardins", city: "São Paulo", state: "SP",
  exibirEnderecoCompleto: false, createdAt: "2026-09-01T12:00:00.000Z",
  images: [{ url: "https://cdn/a.jpg" }, { url: "https://cdn/b.jpg" }],
};

test("imóvel: anúncio com oferta de venda, quartos, metragem e fotos", () => {
  const s = esquemaDoImovel({ property: imovel, tenant: { name: "Casa Nobre" }, url: "https://x/imovel/1" });
  assert.equal(s["@type"], "RealEstateListing");
  assert.equal(s.offers.price, 450000);
  assert.equal(s.offers.priceCurrency, "BRL");
  assert.match(s.offers.businessFunction, /Sell$/);
  assert.equal(s.offers.priceSpecification, undefined, "venda não tem preço por mês");
  assert.equal(s.about["@type"], "Apartment");
  assert.equal(s.about.numberOfRooms, 2);
  assert.deepEqual(s.about.floorSize, { "@type": "QuantitativeValue", value: 68, unitCode: "MTK" });
  assert.deepEqual(s.image, ["https://cdn/a.jpg", "https://cdn/b.jpg"]);
  assert.equal(s.datePosted, "2026-09-01");
  assert.equal(s.about.containedInPlace.name, "Jardins");
});

test("imóvel: endereço oculto NÃO vaza — nem rua, nem CEP", () => {
  const s = esquemaDoImovel({ property: imovel, url: "https://x/1" });
  const texto = JSON.stringify(s);
  assert.doesNotMatch(texto, /Rua das Flores/);
  assert.doesNotMatch(texto, /01310/);
  assert.equal(s.about.address.addressLocality, "São Paulo");
  assert.equal(s.about.address.addressRegion, "SP");
});

test("imóvel: com autorização, a rua e o CEP entram", () => {
  const s = esquemaDoImovel({ property: { ...imovel, exibirEnderecoCompleto: true }, url: "https://x/1" });
  assert.equal(s.about.address.streetAddress, "Rua das Flores, 123");
  assert.equal(s.about.address.postalCode, "01310-100");
});

test("imóvel: número que não existe não vira zero", () => {
  const s = esquemaDoImovel({ property: { ...imovel, bedrooms: 0, banheiros: 0, parkingSpots: 0, squareFootage: 0 }, url: "https://x/1" });
  assert.equal("numberOfRooms" in s.about, false);
  assert.equal("numberOfBathroomsTotal" in s.about, false);
  assert.equal("floorSize" in s.about, false);
  assert.equal("amenityFeature" in s.about, false);
});

test("imóvel: locação é oferta por mês; sem preço, sem oferta", () => {
  const loc = esquemaDoImovel({ property: { ...imovel, tipoContrato: "LOCACAO", price: 3000 }, url: "https://x/1" });
  assert.match(loc.offers.businessFunction, /LeaseOut$/);
  assert.equal(loc.offers.priceSpecification.unitCode, "MON");
  const sem = esquemaDoImovel({ property: { ...imovel, price: 0 }, url: "https://x/1" });
  assert.equal("offers" in sem, false);
});

test("tipo: texto do cadastro vira tipo do Schema.org, com fallback", () => {
  assert.equal(tipoSchema("Cobertura duplex"), "Apartment");
  assert.equal(tipoSchema("Sobrado"), "House");
  assert.equal(tipoSchema("Sala comercial"), "Place");
  assert.equal(tipoSchema("Kitnet"), "Apartment");
  assert.equal(tipoSchema(""), "Accommodation");
});

test("imobiliária: empresa local com telefone E.164, endereço e horários traduzidos", () => {
  const s = esquemaDaImobiliaria({
    tenant: { name: "Casa Nobre", logoUrl: "https://cdn/logo.png", whatsapp: "(11) 99999-0000", description: "Imóveis em SP." },
    vitrine: {
      endereco: { logradouro: "Av. Paulista, 1000", cidade: "São Paulo", estado: "SP", cep: "01310-100" },
      contato: { telefone: "", whatsapp: "(11) 99999-0000", email: "oi@casanobre.com" },
      horarios: [
        { dias: "Segunda a sexta", abre: "09:00", fecha: "18:00", fechado: false },
        { dias: "Sábado", abre: "09:00", fecha: "13:00", fechado: false },
        { dias: "Domingo", abre: "", fecha: "", fechado: true },
        { dias: "Feriados", abre: "10:00", fecha: "12:00", fechado: false },
      ],
      redes: { facebook: "https://facebook.com/casanobre", instagram: "" },
    },
    url: "https://casanobre.com/",
  });
  assert.equal(s["@type"], "RealEstateAgent");
  assert.equal(s.telephone, "+5511999990000");
  assert.equal(s.address.streetAddress, "Av. Paulista, 1000");
  assert.deepEqual(s.openingHoursSpecification.map((h) => h.dayOfWeek), [
    ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    ["Saturday"],
  ], "domingo fechado e 'feriados' (intraduzível) ficam de fora");
  assert.deepEqual(s.sameAs, ["https://facebook.com/casanobre"]);
});

test("dias: faixa, lista solta e texto sem dia", () => {
  assert.deepEqual(diasSchema("Segunda a sexta"), ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
  assert.deepEqual(diasSchema("Terça, quinta e sábado"), ["Tuesday", "Thursday", "Saturday"]);
  assert.deepEqual(diasSchema("Plantão"), []);
});

test("trilha e serialização: '</' não fecha o <script>", () => {
  const t = esquemaDaTrilha([{ nome: "Vitrine", url: "https://x/" }, { nome: "Casa </script><b>", url: "https://x/1" }]);
  assert.equal(t.itemListElement[1].position, 2);
  const json = serializar([t]);
  assert.doesNotMatch(json, /<\/script>/);
  assert.match(json, /<\\\/script>/);
  assert.equal(esquemaDaTrilha([]), null);
});
