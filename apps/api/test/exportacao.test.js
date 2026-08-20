import test from "node:test";
import assert from "node:assert/strict";

import { exportarTudo } from "../src/services/exportacaoCompleta.js";
import {
  prisma, limparRestos, criarImobiliariaDeTeste, apagarImobiliaria,
} from "./helpers.js";

/* ────────────────────────────────────────────────────────────────────────────
   "Baixar meus dados" — a exportação inteira da imobiliária.

   ── POR QUE ESTE ARQUIVO EXISTE ──

   A rota devolvia 500 desde sempre. A consulta dos imóveis pedia um campo
   `valor` e uma relação `modelo` em `ImovelAtributo`, e nenhum dos dois existe
   no schema — a tabela é ligação pura, sem colunas próprias além das duas
   chaves. Como essa é a primeira consulta do lote, a exportação inteira caía.

   Nada disso aparecia antes de alguém clicar: o erro é do banco, em tempo de
   execução, e um `select` inválido não quebra build, lint nem tipo — o projeto
   não usa TypeScript. Só um teste que EXPORTA DE VERDADE alcança isso.

   Por isso o cenário tem imóvel com atributo, cliente, usuário e lead. Uma
   imobiliária vazia exportaria listas vazias sem tocar nas partes que quebram —
   passaria verde e não provaria nada.

   ── E O QUE NÃO PODE SAIR ──

   O cabeçalho do serviço promete: sem senha (nem hash), sem token de rede
   social, sem segredo de webhook. Um arquivo baixado circula por e-mail e pen
   drive, e o destino dele é desconhecido. A promessa está escrita em prosa lá;
   aqui ela é conferida no TEXTO CRU do JSON, que é o que de fato viaja.
   ──────────────────────────────────────────────────────────────────────────── */

let A;
let B;

test.before(async () => {
  await limparRestos();
  A = await criarImobiliariaDeTeste();
  B = await criarImobiliariaDeTeste();

  await prisma.property.create({
    data: {
      tenantId: A.tenant.id,
      tipoImovelId: A.tipo.id,
      title: "Casa com piscina",
      description: "Descrição de teste",
      price: 750000,
      address: "Rua de Teste, 100",
      // O atributo é o ponto do teste: é ele que exercita a consulta quebrada.
      atributos: { create: [{ atributoId: A.atributo.id }] },
      // `PropertyImage` carrega o próprio `tenantId` — ela não o herda do imóvel.
      images: { create: [{ tenantId: A.tenant.id, url: "https://exemplo.test/foto.jpg", position: 0 }] },
    },
  });

  await prisma.cliente.create({
    data: { tenantId: A.tenant.id, nome: "Cliente de Teste", email: "cliente@exemplo.test" },
  });

  // O imóvel da B, para conferir que ele não aparece no arquivo da A.
  await prisma.property.create({
    data: {
      tenantId: B.tenant.id,
      title: "Imóvel da outra imobiliária",
      description: "Não pode vazar",
      price: 1,
      address: "Rua da Outra, 1",
    },
  });
});

test.after(async () => {
  if (A) await apagarImobiliaria(A.tenant.id);
  if (B) await apagarImobiliaria(B.tenant.id);
  await limparRestos();
  await prisma.$disconnect();
});

test("a exportação roda até o fim e traz todas as seções", async () => {
  const dados = await exportarTudo(A.tenant.id);

  for (const secao of ["imobiliaria", "imoveis", "clientes", "usuarios", "leads", "catalogos", "contagem"]) {
    assert.ok(dados[secao] !== undefined, `faltou a seção "${secao}"`);
  }
  assert.equal(dados.imoveis.length, 1);
  assert.equal(dados.clientes.length, 1);
});

test("o imóvel sai com os atributos que ele tem", async () => {
  /* O caso exato do defeito. `ImovelAtributo` não guarda valor — a linha
     existir já diz que o atributo se aplica —, então o que sai é o NOME. */
  const dados = await exportarTudo(A.tenant.id);
  const imovel = dados.imoveis[0];

  assert.deepEqual(imovel.atributos, [A.atributo.descricao]);
  assert.deepEqual(imovel.fotos, ["https://exemplo.test/foto.jpg"]);
  assert.equal(typeof imovel.price, "number", "o preço tem que sair como número, não Decimal");
});

test("nada de outra imobiliária entra no arquivo", async () => {
  const cru = JSON.stringify(await exportarTudo(A.tenant.id));
  assert.ok(!cru.includes("Imóvel da outra imobiliária"), "vazou imóvel da outra imobiliária");
  assert.ok(!cru.includes(B.tenant.slug), "vazou o slug da outra imobiliária");
});

test("senha e segredo não saem no arquivo", async () => {
  /* No TEXTO CRU, e não campo a campo: o risco aqui não é um campo conhecido
     escapar, é um campo NOVO entrar num `include` sem `select` e viajar junto
     sem ninguém perceber. Procurar no texto pega os dois casos. */
  /* Os quatro segredos que o tenant guarda — a mesma lista que `tenantRoutes`
     filtra das respostas (`SEGREDOS_DO_TENANT`). Marcar cada um com um valor
     distinto faz a falha dizer QUAL vazou, e não só que algo vazou. */
  const SEGREDOS = {
    facebookPageToken: "SEGREDO-FACEBOOK-DE-TESTE",
    mercadoLivreToken: "SEGREDO-ML-DE-TESTE",
    mercadoLivreRefresh: "SEGREDO-ML-REFRESH-DE-TESTE",
    whatsappPonteToken: "SEGREDO-WHATSAPP-DE-TESTE",
  };
  await prisma.tenant.update({ where: { id: A.tenant.id }, data: SEGREDOS });

  const cru = JSON.stringify(await exportarTudo(A.tenant.id));

  for (const [campo, marca] of Object.entries(SEGREDOS)) {
    assert.ok(!cru.includes(marca), `o segredo "${campo}" vazou no arquivo`);
  }
  assert.ok(!cru.includes("sem-senha"), "o hash de senha do usuário vazou");
  assert.ok(!/"senha"\s*:/.test(cru), "existe um campo `senha` no arquivo");
});
