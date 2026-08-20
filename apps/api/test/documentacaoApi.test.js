import test from "node:test";
import assert from "node:assert/strict";
import { apiPublicaRouter } from "../src/routes/apiPublicaRoutes.js";
import { ESPECIFICACAO } from "../src/services/documentacaoApi.js";
import { ESCOPOS } from "../src/services/chavesApi.js";
import { EVENTOS } from "../src/services/webhooks.js";

/* ────────────────────────────────────────────────────────────────────────────
   A documentação descreve a API que EXISTE.

   Especificação escrita à mão envelhece — é o preço de escrevê-la à mão, e a
   escolha foi deliberada (gerar a partir das rotas daria os caminhos certos e
   silêncio sobre o que importa: que `DELETE` desativa, que `?cursor=` é o certo
   para varrer, que reenviar corrige em vez de duplicar).

   Este arquivo é o que impede o envelhecimento de passar despercebido. Ele
   compara a especificação com a tabela de rotas do próprio Express: uma rota
   nova sem documentação, ou uma linha de documentação apontando para uma rota
   que não existe mais, falha aqui.

   Não toca no banco.
   ──────────────────────────────────────────────────────────────────────────── */

/** As rotas realmente registradas no router, no formato do OpenAPI. */
function rotasDoRouter() {
  const encontradas = new Set();
  for (const camada of apiPublicaRouter.stack) {
    if (!camada.route) continue;
    // `/imoveis/:id` no Express → `/api/v1/imoveis/{id}` no OpenAPI.
    const caminho = `/api/v1${camada.route.path}`.replace(/:(\w+)/g, "{$1}");
    for (const metodo of Object.keys(camada.route.methods)) {
      if (camada.route.methods[metodo]) encontradas.add(`${metodo.toUpperCase()} ${caminho}`);
    }
  }
  return encontradas;
}

/** O que a especificação promete, no mesmo formato. */
function rotasDaEspecificacao() {
  const prometidas = new Set();
  for (const [caminho, metodos] of Object.entries(ESPECIFICACAO.paths)) {
    for (const metodo of Object.keys(metodos)) prometidas.add(`${metodo.toUpperCase()} ${caminho}`);
  }
  return prometidas;
}

/* Rotas que existem de propósito e não entram na especificação. Duas, e as duas
   têm motivo — não é uma lista de exceções para crescer sem critério:

     openapi.json  documentar a própria documentação seria recursivo e inútil;
     feed.xml      está lá, mas como `get` de um caminho literal que o Express
                   registra igual — este conjunto existe para o caso de alguém
                   acrescentar uma rota de diagnóstico interna. */
const FORA_DA_DOCUMENTACAO = new Set(["GET /api/v1/openapi.json"]);

test("toda rota da API está documentada", () => {
  const reais = rotasDoRouter();
  const documentadas = rotasDaEspecificacao();
  const semDocumentacao = [...reais].filter((r) => !documentadas.has(r) && !FORA_DA_DOCUMENTACAO.has(r));
  assert.deepEqual(
    semDocumentacao,
    [],
    `Estas rotas existem e não estão em documentacaoApi.js: ${semDocumentacao.join(", ")}`,
  );
});

test("a documentação não promete rota que não existe", () => {
  /* O erro mais caro dos dois: o integrador monta a chamada, recebe 404 e
     conclui que a chave está errada. */
  const reais = rotasDoRouter();
  const documentadas = rotasDaEspecificacao();
  const inventadas = [...documentadas].filter((r) => !reais.has(r));
  assert.deepEqual(
    inventadas,
    [],
    `A documentação promete rotas que o router não tem: ${inventadas.join(", ")}`,
  );
});

test("todo escopo citado na documentação existe de verdade", () => {
  const validos = new Set(ESCOPOS.map((e) => e.id));
  const texto = JSON.stringify(ESPECIFICACAO);
  const citados = [...texto.matchAll(/\b(imoveis|clientes|usuarios|leads):(ler|escrever)\b/g)]
    .map((m) => m[0]);
  const desconhecidos = [...new Set(citados)].filter((e) => !validos.has(e));
  assert.deepEqual(desconhecidos, [], `Escopos citados que não existem: ${desconhecidos.join(", ")}`);
});

test("a especificação é serializável e tem o mínimo que uma ferramenta lê", () => {
  /* Ela é servida como JSON. Uma referência circular introduzida por descuido
     derrubaria a rota com um erro que não diz onde. */
  const texto = JSON.stringify(ESPECIFICACAO);
  assert.ok(texto.length > 1000);

  assert.equal(ESPECIFICACAO.openapi, "3.1.0");
  assert.ok(ESPECIFICACAO.info?.title);
  assert.ok(ESPECIFICACAO.servers?.[0]?.url, "sem servidor, o Postman não monta as chamadas");
  assert.ok(
    ESPECIFICACAO.components?.securitySchemes?.chaveDaImobiliaria,
    "sem esquema de segurança, a ferramenta não sabe onde pôr a chave",
  );
});

test("a documentação avisa que DELETE não apaga", () => {
  /* A frase que evita o chamado de suporte — e a razão de a especificação ser
     escrita à mão. Se alguém a remover numa limpeza de texto, o teste reclama. */
  const doDelete = JSON.stringify(ESPECIFICACAO.paths["/api/v1/imoveis/{id}"].delete);
  assert.match(doDelete, /DESATIVA|desativa/, "a documentação do DELETE não diz que ele só desativa");
});

test("os eventos de webhook têm rótulo e descrição", () => {
  // A tela desenha a partir desta lista; um evento sem texto vira uma caixa de
  // seleção anônima.
  for (const evento of EVENTOS) {
    assert.ok(evento.id && evento.rotulo && evento.desc, `evento incompleto: ${evento.id}`);
  }
});
