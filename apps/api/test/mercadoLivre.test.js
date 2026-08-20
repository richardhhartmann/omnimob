import test from "node:test";
import assert from "node:assert/strict";
import { anuncioDoImovel } from "../src/services/mercadoLivre.js";

/* ────────────────────────────────────────────────────────────────────────────
   O que dá para verificar do Mercado Livre sem uma conta de vendedor.

   ── O QUE ESTA SUÍTE NÃO PROVA ──

   Que a integração funciona. Publicar de verdade exige uma aplicação registrada
   no Mercado Livre, uma conta de vendedor e um pacote de anúncios contratado —
   três coisas que não se simulam, e nenhuma delas existe aqui.

   ── O QUE ELA PROVA ──

   Que a TRADUÇÃO de imóvel para anúncio está correta e estável. É a metade do
   problema que é nossa: o mapeamento de campos, os limites de tamanho, o que
   entra e o que fica de fora. Se o `title` passar de 60 caracteres ou o preço
   virar string, o anúncio é recusado — e o erro do Mercado Livre para isso é
   genérico o bastante para custar uma tarde.

   Não toca no banco nem na rede.
   ──────────────────────────────────────────────────────────────────────────── */

const IMOVEL = {
  title: "Apartamento no Centro",
  description: "Um bom apartamento.",
  price: 350000,
  tipoContrato: "VENDA",
  address: "Rua A, 100",
  cep: "01310-100",
  neighborhood: "Centro",
  city: "São Paulo",
  state: "SP",
  bedrooms: 3,
  suites: 1,
  banheiros: 2,
  parkingSpots: 2,
  areaPrivativa: 78,
  images: [{ url: "https://exemplo.test/1.jpg" }, { url: "https://exemplo.test/2.jpg" }],
};

test("o anúncio sai com o essencial que o Mercado Livre exige", () => {
  const a = anuncioDoImovel(IMOVEL, {});
  assert.equal(a.title, "Apartamento no Centro");
  assert.equal(a.price, 350000);
  assert.equal(a.currency_id, "BRL");
  assert.equal(a.buying_mode, "classified");
  assert.equal(a.available_quantity, 1);
  assert.equal(typeof a.category_id, "string");
  assert.ok(a.category_id.startsWith("MLB"), "categoria fora do catálogo brasileiro");
});

test("o título é cortado em 60 caracteres", () => {
  /* O limite é do Mercado Livre. Um título maior é recusado, e a mensagem não
     diz qual campo estourou — o corte aqui é o que evita a caça. */
  const longo = { ...IMOVEL, title: "A".repeat(200) };
  assert.equal(anuncioDoImovel(longo, {}).title.length, 60);
});

test("preço em texto vira número", () => {
  /* O Prisma devolve `Decimal`, e um preço em string faz o Mercado Livre
     recusar o anúncio inteiro por tipo inválido. */
  const a = anuncioDoImovel({ ...IMOVEL, price: "350000" }, {});
  assert.equal(typeof a.price, "number");
  assert.equal(a.price, 350000);
});

test("aluguel e venda caem em categorias diferentes", () => {
  const venda = anuncioDoImovel({ ...IMOVEL, tipoContrato: "VENDA" }, {});
  const aluguel = anuncioDoImovel({ ...IMOVEL, tipoContrato: "LOCACAO" }, {});
  assert.notEqual(venda.category_id, aluguel.category_id);
});

test("a categoria e o tipo de anúncio podem ser sobrescritos", () => {
  /* Eles dependem do país e do PACOTE contratado, e a documentação lista várias
     combinações. Cravá-los daqui seria decidir por uma conta que não é nossa. */
  const a = anuncioDoImovel(IMOVEL, { categoria: "MLB0000", tipoDeAnuncio: "gold_premium" });
  assert.equal(a.category_id, "MLB0000");
  assert.equal(a.listing_type_id, "gold_premium");
});

test("as fotos entram como fonte, no máximo 12", () => {
  const muitas = { ...IMOVEL, images: Array.from({ length: 30 }, (_, i) => ({ url: `https://exemplo.test/${i}.jpg` })) };
  const a = anuncioDoImovel(muitas, {});
  assert.equal(a.pictures.length, 12);
  assert.deepEqual(a.pictures[0], { source: "https://exemplo.test/0.jpg" });
});

test("atributo com valor zero fica de fora", () => {
  /* "0 quartos" não é informação — é ruído num anúncio, e o Mercado Livre
     recusa alguns atributos com valor vazio. Terreno não tem quarto nenhum. */
  const terreno = { ...IMOVEL, bedrooms: 0, parkingSpots: 0, suites: 0, banheiros: 0 };
  const ids = anuncioDoImovel(terreno, {}).attributes.map((x) => x.id);
  assert.ok(!ids.includes("BEDROOMS"));
  assert.ok(!ids.includes("PARKING_LOTS"));
  assert.ok(ids.includes("TOTAL_AREA"), "a área deveria continuar entrando");
});

test("o CEP vai só com dígitos", () => {
  // O Mercado Livre recusa `zip_code` com máscara.
  assert.equal(anuncioDoImovel(IMOVEL, {}).location.zip_code, "01310100");
});

test("a localização leva bairro, cidade e estado", () => {
  const l = anuncioDoImovel(IMOVEL, {}).location;
  assert.equal(l.neighborhood.name, "Centro");
  assert.equal(l.city.name, "São Paulo");
  assert.equal(l.state.name, "SP");
});

test("imóvel sem nada preenchido não quebra a montagem", () => {
  /* Um cadastro incompleto tem de virar um anúncio recusado com motivo, não uma
     exceção no meio da rota. */
  const a = anuncioDoImovel({}, {});
  assert.equal(a.title, "");
  assert.equal(a.price, 0);
  assert.deepEqual(a.pictures, []);
  assert.deepEqual(a.attributes, []);
});
