/* ────────────────────────────────────────────────────────────────────────────
   A especificação da API, em OpenAPI 3.1.

   ── POR QUE UM ARQUIVO E NÃO UMA PÁGINA ──

   Documentação em HTML é lida por gente; especificação é lida por FERRAMENTA. O
   integrador cola esta URL no Postman, no Insomnia ou num gerador de cliente e
   recebe as chamadas prontas, com os parâmetros e os cabeçalhos certos. É a
   diferença entre "leia e digite" e "importe e rode".

   Servida sem chave de propósito: exigir credencial para ler a documentação é o
   atrito que faz o integrador desistir na primeira tarde, e não há segredo
   nenhum aqui — são nomes de campo e formatos, os mesmos que a tela do painel
   já mostra.

   ── ESCRITA À MÃO, E ISSO É UMA ESCOLHA ──

   Gerar a partir das rotas exigiria decorar cada handler com metadados, e o
   resultado ficaria correto sobre os CAMINHOS e mudo sobre o que importa: que
   `DELETE` desativa em vez de apagar, que `?cursor=` é o certo para varrer o
   acervo, que reenviar o mesmo lote corrige em vez de duplicar. Essas são as
   frases que evitam um chamado de suporte, e nenhuma delas está no código de
   uma rota.

   O preço é este arquivo poder envelhecer. Ele fica ao lado do router de
   propósito, e o teste de contrato (`test/documentacaoApi.test.js`) recusa uma
   rota que exista no código e não aqui.
   ──────────────────────────────────────────────────────────────────────────── */

const BASE = process.env.APP_URL?.includes("localhost")
  ? "http://localhost:4000"
  : "https://api.omnimob.app";

/* Os parâmetros de listagem, escritos uma vez. São idênticos em imóveis,
   clientes, usuários e leads, e quatro cópias divergiriam na primeira mudança. */
const PARAMS_LISTA = [
  {
    name: "cursor",
    in: "query",
    schema: { type: "string" },
    description:
      "Continua a leitura depois deste id. É a forma recomendada para varrer tudo: ao contrário de `pagina`, inserções durante a varredura não deslocam a lista e nenhum registro é pulado. Use o `proximoCursor` que veio na resposta anterior.",
  },
  {
    name: "pagina",
    in: "query",
    schema: { type: "integer", minimum: 1, default: 1 },
    description:
      "Paginação por posição. Boa para telas numeradas; sobre dados que mudam ela pula e repete registros — para sincronizar, prefira `cursor`.",
  },
  {
    name: "porPagina",
    in: "query",
    schema: { type: "integer", minimum: 1, maximum: 500, default: 100 },
  },
  {
    name: "desde",
    in: "query",
    schema: { type: "string", format: "date-time" },
    description:
      "Só o que mudou a partir deste instante (ISO 8601). Guarde o horário da última leitura e peça o delta em vez do acervo inteiro. Data inválida é ignorada, e a resposta devolve `desde: null` para você perceber.",
  },
  {
    name: "formato",
    in: "query",
    schema: { type: "string", enum: ["json", "xml"], default: "json" },
    description: "`xml` devolve o mesmo conteúdo no XML da Omnimob, que a importação daqui aceita de volta.",
  },
];

const RESPOSTA_401 = {
  description: "Chave ausente, inválida ou revogada.",
  content: { "application/json": { example: { error: "Chave inválida ou revogada.", code: "CHAVE_INVALIDA" } } },
};

const RESPOSTA_403 = {
  description: "A chave é válida, mas não tem o escopo exigido — ou o plano da imobiliária não inclui a API.",
  content: {
    "application/json": {
      example: {
        error: "Esta chave não tem permissão para isto. Falta: clientes:ler.",
        code: "ESCOPO_INSUFICIENTE",
        escoposFaltando: ["clientes:ler"],
      },
    },
  },
};

function lista(entidade, titulo, escopo, extras = []) {
  return {
    summary: titulo,
    description: `Requer o escopo \`${escopo}\`.`,
    security: [{ chaveDaImobiliaria: [] }],
    parameters: [...PARAMS_LISTA, ...extras],
    responses: {
      200: {
        description: "A página pedida, mais `total`, `porPagina` e `proximoCursor`.",
        content: {
          "application/json": {
            example: {
              total: 128,
              pagina: 1,
              porPagina: 100,
              desde: null,
              proximoCursor: "cmstwultj0001u2bkf3sfciy0",
              [entidade]: ["…"],
            },
          },
        },
      },
      401: RESPOSTA_401,
      403: RESPOSTA_403,
    },
  };
}

export const ESPECIFICACAO = {
  openapi: "3.1.0",
  info: {
    title: "API da imobiliária — Omnimob",
    version: "1.0.0",
    description: [
      "Leitura e escrita do acervo, da carteira de clientes, da equipe e dos leads de UMA imobiliária.",
      "",
      "**Autenticação.** Uma chave por integração, gerada em Configurações › Dados › Disponibilizar dados.",
      "Mande em `Authorization: Bearer <chave>` ou em `X-Api-Key`. A chave aparece uma única vez, na criação:",
      "guardamos apenas um resumo criptográfico dela.",
      "",
      "**Escopos.** Cada chave carrega o que pode fazer (`imoveis:ler`, `clientes:escrever`, …).",
      "`GET /eu` devolve os escopos da chave que você está usando — é a primeira chamada a fazer.",
      "",
      "**Reenviar é seguro.** Toda escrita casa pelo campo `origemExterna` (o id do registro no SEU sistema):",
      "mandar o mesmo lote de novo ATUALIZA em vez de duplicar. É o que permite sincronizar de hora em hora",
      "sem acumular lixo. Registros sem `origemExterna` são sempre criados — mande sempre o seu id.",
      "",
      "**Nada é apagado por API.** `DELETE` desativa: o imóvel sai da vitrine e dos portais na hora, e o",
      "histórico de leads e vendas dele é preservado.",
      "",
      "**Limites.** 120 requisições por minuto por chave, e no máximo 200 registros por escrita em lote.",
    ].join("\n"),
    contact: { name: "Suporte Omnimob", url: "https://omnimob.app/contato" },
  },
  servers: [{ url: BASE }],
  security: [{ chaveDaImobiliaria: [] }],
  components: {
    securitySchemes: {
      chaveDaImobiliaria: {
        type: "http",
        scheme: "bearer",
        description: "A chave gerada no painel, no formato `omni_sk_…`.",
      },
    },
    schemas: {
      Imovel: {
        type: "object",
        properties: {
          id: { type: "string", description: "O id nesta plataforma." },
          origemExterna: {
            type: "string",
            nullable: true,
            description: "O id do registro no SEU sistema. É por ele que reenviar atualiza em vez de duplicar.",
          },
          title: { type: "string" },
          description: { type: "string" },
          price: { type: "number" },
          tipoImovel: { type: "string", description: "Nome do tipo, ex.: Apartamento. Tipo inexistente é criado." },
          tipoContrato: { type: "string", enum: ["VENDA", "LOCACAO", "PERMUTA", "BUILT_TO_SUIT"] },
          status: { type: "string", enum: ["DRAFT", "ACTIVE", "INACTIVE"], description: "Importado entra como DRAFT." },
          cep: { type: "string" },
          address: { type: "string" },
          neighborhood: { type: "string" },
          city: { type: "string" },
          state: { type: "string" },
          bedrooms: { type: "integer" },
          suites: { type: "integer" },
          banheiros: { type: "integer" },
          parkingSpots: { type: "integer" },
          areaPrivativa: { type: "number", nullable: true },
          areaTotal: { type: "number", nullable: true },
          fotos: {
            type: "array",
            items: { type: "string", format: "uri" },
            description:
              "Na LEITURA, endereços já hospedados aqui. Na ESCRITA, mande as URLs onde as imagens estão hoje: nós as copiamos para a nossa conta antes de gravar, para o acervo não depender do seu servidor.",
          },
        },
      },
      Cliente: {
        type: "object",
        properties: {
          id: { type: "string" },
          origemExterna: { type: "string", nullable: true },
          nome: { type: "string" },
          cpf: { type: "string", description: "Sem `origemExterna`, é o CPF que evita duplicar." },
          email: { type: "string" },
          telefone: { type: "string" },
          whatsapp: { type: "string" },
          observacoes: { type: "string" },
        },
      },
      Usuario: {
        type: "object",
        description: "Senha nunca sai nem entra por aqui: quem é criado define a dele no primeiro acesso.",
        properties: {
          id: { type: "string" },
          origemExterna: { type: "string", nullable: true },
          nome: { type: "string" },
          login: { type: "string" },
          email: { type: "string" },
          cargo: { type: "string", description: "Nome do cargo. Sem correspondência, cai em Corretor." },
          creci: { type: "string" },
          whatsapp: { type: "string" },
          exibirNaVitrine: { type: "boolean" },
        },
      },
      Lead: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string", nullable: true },
          email: { type: "string", nullable: true },
          phone: { type: "string", nullable: true },
          message: { type: "string", nullable: true },
          source: { type: "string", description: "De onde veio. Leads enviados por API trazem o nome da chave." },
          estagio: { type: "string", enum: ["NOVO", "EM_ATENDIMENTO", "VISITA", "PROPOSTA", "GANHO", "PERDIDO"] },
          property: { type: "object", properties: { id: { type: "string" }, title: { type: "string" } } },
        },
      },
      ResultadoDeEscrita: {
        type: "object",
        properties: {
          criados: { type: "integer" },
          atualizados: { type: "integer" },
          fotos: { type: "integer" },
          erros: {
            type: "array",
            description: "Uma linha por registro recusado, com o motivo. O resto do lote é gravado normalmente.",
            items: { type: "object", properties: { linha: { type: "integer" }, motivo: { type: "string" } } },
          },
        },
      },
    },
  },
  paths: {
    "/api/v1/eu": {
      get: {
        summary: "Quem sou eu e o que posso fazer",
        description: "A primeira chamada de qualquer integração: confirma a chave e lista os escopos dela.",
        security: [{ chaveDaImobiliaria: [] }],
        responses: {
          200: {
            description: "A imobiliária e os escopos da chave.",
            content: {
              "application/json": {
                example: {
                  imobiliaria: { nome: "Imobiliária Centro", slug: "imobiliaria-centro" },
                  chave: { nome: "Site próprio", escopos: ["imoveis:ler", "leads:escrever"] },
                },
              },
            },
          },
          401: RESPOSTA_401,
        },
      },
    },

    "/api/v1/imoveis": {
      get: lista("imoveis", "Listar imóveis", "imoveis:ler", [
        {
          name: "status",
          in: "query",
          schema: { type: "string", enum: ["DRAFT", "ACTIVE", "INACTIVE"] },
          description: "Sem filtro, vêm todos — inclusive rascunhos. Um site próprio geralmente quer `ACTIVE`.",
        },
      ]),
      post: {
        summary: "Criar ou atualizar imóveis em lote",
        description: [
          "Requer `imoveis:escrever`. Aceita JSON (`{\"imoveis\": [...]}` ou a lista crua) e XML",
          "(VRSync ou o XML da Omnimob) — o `Content-Type` decide.",
          "",
          "Casa por `origemExterna`: reenviar o mesmo lote atualiza. Máximo de 200 por requisição.",
          "As fotos são copiadas para a nossa conta antes da gravação.",
        ].join("\n"),
        security: [{ chaveDaImobiliaria: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", properties: { imoveis: { type: "array", items: { $ref: "#/components/schemas/Imovel" } } } },
              example: {
                imoveis: [
                  {
                    origemExterna: "AP-1042",
                    title: "Apartamento no Centro",
                    price: 350000,
                    tipoImovel: "Apartamento",
                    tipoContrato: "VENDA",
                    address: "Rua A, 100",
                    neighborhood: "Centro",
                    city: "São Paulo",
                    state: "SP",
                    bedrooms: 3,
                    fotos: ["https://seusistema.com/fotos/1042-1.jpg"],
                  },
                ],
              },
            },
            "application/xml": { schema: { type: "string" }, example: "<ListingDataFeed>…</ListingDataFeed>" },
          },
        },
        responses: {
          200: {
            description: "O relatório da gravação.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ResultadoDeEscrita" } } },
          },
          400: { description: "Formato não reconhecido, ou nenhum registro no corpo." },
          401: RESPOSTA_401,
          403: RESPOSTA_403,
          413: { description: "Mais de 200 registros numa requisição." },
        },
      },
    },

    "/api/v1/imoveis/feed.xml": {
      get: {
        summary: "O acervo em VRSync",
        description: [
          "O mesmo formato que ZAP, VivaReal e OLX consomem, autenticado — aceita `?status=` e enxerga",
          "rascunhos, ao contrário do feed público.",
          "",
          "Para cadastrar nos portais, use o endereço PÚBLICO (`/public/{slug}/feed.xml`): o robô do portal",
          "não tem como mandar uma chave.",
        ].join("\n"),
        security: [{ chaveDaImobiliaria: [] }],
        responses: { 200: { description: "XML VRSync.", content: { "application/xml": {} } }, 401: RESPOSTA_401 },
      },
    },

    "/api/v1/imoveis/{id}": {
      get: {
        summary: "Um imóvel",
        security: [{ chaveDaImobiliaria: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "O imóvel.", content: { "application/json": { schema: { $ref: "#/components/schemas/Imovel" } } } },
          404: { description: "Não existe, ou é de outra imobiliária." },
        },
      },
      put: {
        summary: "Atualizar um imóvel",
        description: "Requer `imoveis:escrever`. Um imóvel por chamada; para vários, use `POST /api/v1/imoveis`.",
        security: [{ chaveDaImobiliaria: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/Imovel" } } },
        },
        responses: {
          200: { description: "O imóvel atualizado." },
          400: { description: "Corpo com mais de um imóvel, ou campo obrigatório ausente." },
          404: { description: "Não existe, ou é de outra imobiliária." },
        },
      },
      delete: {
        summary: "Tirar um imóvel de circulação",
        description: [
          "Requer `imoveis:escrever`.",
          "",
          "**DESATIVA, não apaga.** O imóvel sai da vitrine e dos portais imediatamente, e os leads e as",
          "vendas ligados a ele são preservados — apagar de verdade destruiria o histórico da imobiliária",
          "a pedido de um sistema externo. Reative pelo painel.",
        ].join("\n"),
        security: [{ chaveDaImobiliaria: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: {
            description: "Desativado.",
            content: { "application/json": { example: { id: "cms…", status: "INACTIVE", aviso: "…" } } },
          },
          404: { description: "Não existe, ou é de outra imobiliária." },
        },
      },
    },

    "/api/v1/clientes": {
      get: lista("clientes", "Listar clientes", "clientes:ler"),
      post: {
        summary: "Criar ou atualizar clientes em lote",
        description:
          "Requer `clientes:escrever`. Casa por `origemExterna` e, na falta dele, pelo CPF. Aceita JSON e o XML da Omnimob.",
        security: [{ chaveDaImobiliaria: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: { clientes: [{ origemExterna: "C-1", nome: "Ana Prado", cpf: "12345678900", email: "ana@exemplo.com" }] },
            },
          },
        },
        responses: {
          200: { description: "O relatório da gravação.", content: { "application/json": { schema: { $ref: "#/components/schemas/ResultadoDeEscrita" } } } },
          401: RESPOSTA_401,
          403: RESPOSTA_403,
        },
      },
    },

    "/api/v1/clientes/{id}": {
      get: {
        summary: "Um cliente",
        security: [{ chaveDaImobiliaria: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "O cliente." }, 404: { description: "Não encontrado." } },
      },
    },

    "/api/v1/usuarios": {
      get: lista("usuarios", "Listar a equipe", "usuarios:ler"),
      post: {
        summary: "Criar ou atualizar usuários em lote",
        description: [
          "Requer `usuarios:escrever`. Casa por `origemExterna` e, na falta, pelo login.",
          "",
          "Senha não entra por aqui: quem é criado recebe uma provisória, devolvida NESTA resposta e em",
          "nenhum outro lugar, e define a própria no primeiro acesso.",
        ].join("\n"),
        security: [{ chaveDaImobiliaria: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { example: { usuarios: [{ origemExterna: "U-7", nome: "Marina Alves", login: "marina", cargo: "Corretor" }] } } },
        },
        responses: { 200: { description: "O relatório, com as senhas provisórias." }, 401: RESPOSTA_401, 403: RESPOSTA_403 },
      },
    },

    "/api/v1/leads": {
      get: lista("leads", "Listar leads", "leads:ler"),
      post: {
        summary: "Registrar um lead",
        description: [
          "Requer `leads:escrever`. É o caminho de quem tem site próprio: o formulário de lá manda o",
          "contato para cá.",
          "",
          "O lead pertence a um imóvel — informe `propertyId` (o id daqui) ou `propertyOrigemExterna`",
          "(o id do seu sistema). O lead entra na mesma distribuição automática da vitrine, então já",
          "chega com um corretor responsável.",
        ].join("\n"),
        security: [{ chaveDaImobiliaria: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                propertyOrigemExterna: "AP-1042",
                nome: "João da Silva",
                email: "joao@exemplo.com",
                telefone: "11999998888",
                mensagem: "Gostaria de agendar uma visita.",
                origem: "site-proprio",
              },
            },
          },
        },
        responses: {
          201: { description: "O lead criado.", content: { "application/json": { schema: { $ref: "#/components/schemas/Lead" } } } },
          400: { description: "Sem nome, e-mail nem telefone; ou sem referência ao imóvel." },
          404: { description: "O imóvel informado não é desta imobiliária." },
        },
      },
    },
  },
};
