import { AsyncLocalStorage } from "node:async_hooks";

/* ────────────────────────────────────────────────────────────────────────────
   Trilha de auditoria: quem fez o quê, sem ninguém precisar lembrar.

   A pergunta que ela responde aparece toda semana numa imobiliária — "sumiu um
   imóvel, quem apagou?" — e até aqui não havia resposta: nada deixava rastro.

   ── POR QUE UMA EXTENSÃO DO PRISMA, E NÃO UMA CHAMADA EM CADA ROTA ──

   Porque a segunda opção só funciona enquanto alguém lembra. São dezoito
   arquivos de rota hoje e vão ser mais amanhã; uma trilha que depende de o
   autor da rota nova lembrar de chamá-la é uma trilha com buracos, e um buraco
   descoberto tarde é pior que não ter trilha nenhuma — porque até então
   confiou-se nela. Plantada na camada de acesso ao banco, ela vale para o que
   já existe e para o que ainda vai existir.

   ── DE ONDE VEM O "QUEM" ──

   A extensão roda dentro da consulta e não enxerga o `req`. `AsyncLocalStorage`
   carrega o contexto da requisição por baixo de toda a cadeia de await sem
   passar parâmetro de mão em mão. O middleware abre um objeto MUTÁVEL no início
   da requisição — antes de a autenticação acontecer — e o `requireAuth`
   preenche depois. É por isso que o objeto é mutável em vez de imutável: quando
   ele nasce, ainda não se sabe quem é a pessoa.

   ── O QUE É GRAVADO, E O QUE NÃO É ──

   `create` e `update` guardam os campos enviados; `delete` guarda um resumo da
   linha lida ANTES de sumir — sem isso o registro diria "excluiu Property
   cmc3x9…", que não responde nada. A leitura extra acontece só em exclusão, que
   é rara.

   Update não lê o "antes". Seria uma consulta a mais em toda gravação — e o
   ganho é pequeno: o que se quer saber é o que passou a valer, não o que
   deixou. Senha, token e segredo nunca entram, em nenhum dos casos.
   ──────────────────────────────────────────────────────────────────────────── */

const contexto = new AsyncLocalStorage();

function novoStore(req) {
  return {
    usuarioId: null,
    usuarioNome: null,
    tenantId: null,
    ip: req.ip || req.headers["x-forwarded-for"] || null,
    rota: `${req.method} ${req.originalUrl?.split("?")[0] || req.path}`,
  };
}

/** Middleware: abre o contexto da requisição. Vai cedo na pilha do Express. */
export function contextoDeAuditoria(req, _res, next) {
  const store = novoStore(req);
  req.auditoria = store;
  contexto.run(store, next);
}

/* Preenche o contexto — e o ABRE se ainda não houver um.
 *
 * Chamado por `requireTenant` e `requireAuth`, que são os dois lugares que
 * descobrem quem é a pessoa e de qual imobiliária. Abrir aqui, e não só no
 * `server.js`, é o que faz a trilha não depender da montagem da aplicação: um
 * router usado fora dela — a suíte de testes monta cada um isolado — continua
 * auditando. Foi assim que a falta apareceu: o teste da trilha passava vazio,
 * porque zero registros satisfazem "nenhum registro é de outra imobiliária".
 *
 * `next` é chamado DENTRO do `run` de propósito: é isso que põe todo o resto da
 * cadeia debaixo do contexto. */
export function preencherContexto(req, campos, next) {
  const atual = contextoAtual();
  if (atual) {
    for (const [k, v] of Object.entries(campos)) if (v) atual[k] = v;
    return next();
  }
  const store = novoStore(req);
  for (const [k, v] of Object.entries(campos)) if (v) store[k] = v;
  req.auditoria = store;
  return contexto.run(store, next);
}

/** O contexto atual, ou `null` fora de uma requisição (scripts, agendadores). */
export function contextoAtual() {
  return contexto.getStore() || null;
}

/* Modelos que vale registrar.
 *
 * Lista de dentro, e não de fora: `PropertyMetricEvent` grava uma linha a cada
 * visita da vitrine, e auditá-lo dobraria a escrita do sistema para registrar
 * que um anônimo abriu uma página. O que entra aqui é o que uma PESSOA faz e
 * outra pessoa pode precisar explicar depois. */
const MODELOS = new Set([
  "Property", "PropertyImage", "PropertyLead", "Cliente", "Usuario", "Cargo",
  "TipoImovel", "ModeloAtributo", "Venda", "Tenant", "PerfilBusca",
]);

const ACAO = {
  create: "CRIOU", createMany: "CRIOU",
  update: "ALTEROU", updateMany: "ALTEROU", upsert: "ALTEROU",
  delete: "EXCLUIU", deleteMany: "EXCLUIU",
};

/* Campos que nunca são gravados no log, casados por nome.
 *
 * Por padrão de nome e não por lista fechada: um campo `senhaProvisoria` ou
 * `metaAccessToken` que apareça amanhã já nasce protegido. Falso positivo aqui
 * custa um campo a menos no log; falso negativo custa uma senha em texto puro
 * numa tabela feita para ser lida. */
const SEGREDO = /senha|password|token|secret|chave|apikey|api_key/i;

function limparSegredos(valor, profundidade = 0) {
  if (valor === null || valor === undefined) return valor;
  if (profundidade > 3) return "…";
  if (Array.isArray(valor)) return valor.slice(0, 20).map((v) => limparSegredos(v, profundidade + 1));
  if (typeof valor === "object") {
    if (valor instanceof Date) return valor.toISOString();
    const saida = {};
    for (const [k, v] of Object.entries(valor)) {
      saida[k] = SEGREDO.test(k) ? "‹oculto›" : limparSegredos(v, profundidade + 1);
    }
    return saida;
  }
  // Decimal do Prisma e afins: viram texto em vez de "{}" no JSON.
  if (typeof valor === "object" || typeof valor === "bigint") return String(valor);
  if (typeof valor === "string" && valor.length > 500) return `${valor.slice(0, 500)}…`;
  return valor;
}

/* Como a pessoa reconhece o registro na tela. O primeiro campo que existir. */
const ROTULOS = ["title", "titulo", "nome", "descricao", "name", "login", "email"];

function resumoDe(registro) {
  if (!registro || typeof registro !== "object") return null;
  for (const campo of ROTULOS) {
    const v = registro[campo];
    if (typeof v === "string" && v.trim()) return v.slice(0, 160);
  }
  return null;
}

function idDe(registro, args) {
  if (registro && typeof registro === "object" && registro.id !== undefined) return String(registro.id);
  const where = args?.where;
  if (where && where.id !== undefined) return String(where.id);
  return null;
}

/* Escreve a linha. Nunca lança: auditoria que derruba a operação é pior que a
   falta dela — o cliente perderia o trabalho por causa do registro do trabalho.

   Recebe o cliente por parâmetro em vez de importar `db.js`. Importar criaria
   um ciclo (db → auditoria → db) e, pior, gravaria pelo cliente JÁ estendido,
   que passaria a auditar a própria auditoria. */
async function registrar(client, linha) {
  try {
    await client.auditoria.create({ data: linha });
  } catch (erro) {
    console.error("[auditoria] não consegui registrar:", erro.message);
  }
}

/**
 * A extensão. Aplicada ao cliente exportado em `db.js`.
 *
 * O `tenantId` sai do contexto da requisição, e não do argumento da consulta:
 * é o valor que o middleware de tenant já validou contra o token. Sem ele — um
 * script de linha de comando, o agendador da faxina — não há o que registrar
 * numa tabela cuja chave é a imobiliária, e a operação passa direto.
 */
export function extensaoDeAuditoria(client) {
  return client.$extends({
    name: "auditoria",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const acao = ACAO[operation];
          if (!acao || !MODELOS.has(model)) return query(args);

          const ctx = contextoAtual();
          if (!ctx?.tenantId) return query(args);

          /* Só na exclusão vale a leitura extra: depois do delete não há mais o
             que ler, e "excluiu Property cmc3x9…" não é resposta para ninguém. */
          let anterior = null;
          if (operation === "delete") {
            try {
              anterior = await client[model[0].toLowerCase() + model.slice(1)].findUnique({ where: args.where });
            } catch { /* sem resumo, segue */ }
          }

          const resultado = await query(args);

          const alvo = anterior || (operation.endsWith("Many") ? null : resultado);
          await registrar(client, {
            tenantId: ctx.tenantId,
            usuarioId: ctx.usuarioId,
            usuarioNome: ctx.usuarioNome,
            acao,
            entidade: model,
            entidadeId: idDe(alvo, args),
            resumo: resumoDe(alvo),
            dados: limparSegredos(
              operation.endsWith("Many")
                ? { quantidade: resultado?.count ?? null, filtro: args?.where ?? null }
                : args?.data ?? args?.where ?? null
            ),
            ip: ctx.ip ? String(ctx.ip).slice(0, 60) : null,
            rota: ctx.rota ? String(ctx.rota).slice(0, 200) : null,
          });

          return resultado;
        },
      },
    },
  });
}
