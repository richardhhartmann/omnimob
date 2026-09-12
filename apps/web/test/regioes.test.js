import test from "node:test";
import assert from "node:assert/strict";
import {
  slugDeTexto, regiaoDoImovel, paginasDeRegiao, filtrarPorRegiao, caminhoDaRegiao, textosDaRegiao, pluralDoTipo,
} from "../src/utils/regioes.js";

/* ── O que esta suíte guarda ─────────────────────────────────────────────────
   A regra que transforma bairro + cidade em endereço de página. Ela existe
   em dois lugares (aqui e em `apps/api/src/services/paginasDeRegiao.js`); o
   teste da API confere que os dois arquivos são o mesmo código, e este cobra
   o comportamento. Um slug diferente entre sitemap e rota é uma página que o
   Google visita e recebe "região não encontrada". */

const acervo = [
  { id: 1, neighborhood: "Jardins", city: "São Paulo", propertyType: "Apartamento" },
  { id: 2, neighborhood: "Jardins", city: "São Paulo", propertyType: "Cobertura" },
  { id: 3, neighborhood: "Jardins", city: "São Paulo", propertyType: "Apartamento" },
  { id: 4, neighborhood: "Centro", city: "Campinas", propertyType: "Sala comercial" },
  { id: 5, neighborhood: "Centro", city: "São Paulo", propertyType: "Apartamento" },
  { id: 6, neighborhood: "", city: "Sorocaba", propertyType: "Casa" },
  { id: 7, neighborhood: "", city: "", propertyType: "Casa" },
];

test("slug: sem acento, minúsculo, hífens, e o mesmo Centro em duas cidades vira dois slugs", () => {
  assert.equal(slugDeTexto("São João do Meriti"), "sao-joao-do-meriti");
  assert.equal(regiaoDoImovel(acervo[3]).slug, "centro-campinas");
  assert.equal(regiaoDoImovel(acervo[4]).slug, "centro-sao-paulo");
  assert.equal(regiaoDoImovel(acervo[5]).slug, "sorocaba", "sem bairro, a região é a cidade");
  assert.equal(regiaoDoImovel(acervo[6]), null);
});

test("páginas: uma por região, por volume, com os tipos de cada uma", () => {
  const p = paginasDeRegiao(acervo);
  assert.deepEqual(p.map((r) => [r.slug, r.total]), [
    ["jardins-sao-paulo", 3], ["centro-campinas", 1], ["centro-sao-paulo", 1], ["sorocaba", 1],
  ]);
  assert.deepEqual(p[0].tipos.map((t) => [t.slug, t.nome, t.total]), [["apartamento", "Apartamento", 2], ["cobertura", "Cobertura", 1]]);
});

test("filtro: por região e, opcionalmente, por tipo", () => {
  assert.deepEqual(filtrarPorRegiao(acervo, "jardins-sao-paulo").map((p) => p.id), [1, 2, 3]);
  assert.deepEqual(filtrarPorRegiao(acervo, "jardins-sao-paulo", "cobertura").map((p) => p.id), [2]);
  assert.deepEqual(filtrarPorRegiao(acervo, "nao-existe"), []);
});

test("caminho: nos dois hosts", () => {
  assert.equal(caminhoDaRegiao({ tenantSlug: "casa", regiao: "jardins-sao-paulo" }), "/vitrine/casa/imoveis/jardins-sao-paulo");
  assert.equal(caminhoDaRegiao({ tenantSlug: "casa", slugFixo: "casa", regiao: "jardins-sao-paulo", tipo: "casa" }), "/imoveis/jardins-sao-paulo/casa");
});

test("textos: título com o lugar e o tipo no plural; cidade sem bairro não repete", () => {
  const [jardins, , , sorocaba] = paginasDeRegiao(acervo);
  const t = textosDaRegiao({ regiao: jardins, tipo: jardins.tipos[0], total: 2, imobiliaria: "Casa Nobre" });
  assert.equal(t.titulo, "Apartamentos em Jardins, São Paulo — Casa Nobre");
  assert.equal(t.h1, "Apartamentos em Jardins, São Paulo");
  assert.match(t.descricao, /2 imóveis disponíveis/);
  const s = textosDaRegiao({ regiao: sorocaba, tipo: null, total: 1 });
  assert.equal(s.titulo, "Imóveis em Sorocaba");
  assert.match(s.descricao, /1 imóvel disponível/);
  assert.equal(pluralDoTipo("Galpão"), "Galpões");
  assert.equal(pluralDoTipo("Casa"), "Casas");
});
