import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { prisma } from "../db.js";
import { requireApi } from "../middlewares/apiKeyMiddleware.js";
import { montarXmlOmnimob } from "../services/xmlDaApi.js";
import { montarFeedVRSync } from "../services/feedPortais.js";
import { lerFonte, ErroDeFormato } from "../services/formatosImportacao.js";
import { copiarFotosDasLinhas } from "../services/copiaDeFotos.js";
import { proximoResponsavel } from "../services/distribuicaoLeads.js";
import { emitir } from "../services/webhooks.js";
import { ESPECIFICACAO } from "../services/documentacaoApi.js";
import {
  importarClientes,
  importarImoveis,
  importarUsuarios,
  LOTE_MAXIMO,
} from "../services/importacaoService.js";

/* ────────────────────────────────────────────────────────────────────────────
   A API da imobiliária — `/api/v1`.

   Até aqui, tirar dado do Omnimob significava o feed VRSync: público, só de
   leitura e só de imóveis. Quem quisesse levar a carteira de clientes para um
   CRM, alimentar um site próprio ou manter dois sistemas em dia não tinha
   caminho nenhum.

   ── AUTENTICAÇÃO ──

   Chave do tenant, não JWT. Quem chama aqui é um SISTEMA — sem sessão, sem
   cargo, sem tela de login. O que ele pode fazer sai dos escopos da chave, e
   `requireApi` já resolveu o tenant quando o handler roda: nenhuma consulta
   abaixo repete o filtro por tenant à mão, e nenhuma pode esquecê-lo. Ele
   também abre o contexto da trilha de auditoria e cobra o plano.

   ── SINCRONIZAÇÃO CONTÍNUA ──

   A primeira versão só sabia listar tudo e criar em lote — boa para migrar,
   ruim para conviver. O que faz uma integração viver de hora em hora está aqui:

     `?desde=`    só o que mudou depois daquele instante
     `?cursor=`   paginação estável (ver o comentário em `paginacao`)
     GET /:id     conferir um registro específico
     PUT /:id     corrigir um sem reenviar o lote
     DELETE /:id  tirar de circulação o que saiu do outro lado

   ── VERSÃO NO CAMINHO ──

   `/api/v1` desde o primeiro dia. Chave de API é integração de terceiro: quem a
   usa não vê o nosso deploy e não pode ser quebrado por ele.
   ──────────────────────────────────────────────────────────────────────────── */

export const apiPublicaRouter = Router();

/* Teto por chave, além do limite geral por IP que a aplicação já aplica. Os
   dois medem coisas diferentes: o de IP protege o processo de um cliente
   barulhento; este impede que UMA integração descontrolada consuma a cota da
   imobiliária inteira. */
apiPublicaRouter.use(
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    /* `ipKeyGenerator` no caminho sem credencial: um IPv6 é uma faixa /64
       inteira por assinante, e contar pelo endereço exato deixaria qualquer um
       trocar de endereço dentro da própria faixa para zerar o limite. */
    keyGenerator: (req) =>
      String(req.headers.authorization || req.headers["x-api-key"] || "") || ipKeyGenerator(req.ip),
    message: { error: "Muitas requisições. Tente de novo em um minuto.", code: "LIMITE" },
  }),
);

/* ── Paginação ───────────────────────────────────────────────────────────────
   Duas formas, e a recomendada não é a óbvia.

   OFFSET (`?pagina=`) é o que todo mundo espera e o que serve a uma tela com
   numeração. Tem um defeito conhecido: sobre dados que mudam, ele PULA e REPETE
   registros. Se um imóvel é criado enquanto a integração está na página 3, tudo
   desce uma posição e um registro que estava na fronteira nunca é lido —
   silenciosamente, e justamente durante uma sincronização completa, que é a
   hora em que mais dados estão sendo mexidos.

   CURSOR (`?cursor=`) não tem isso: ele diz "continue depois DESTE id", e
   inserções em outro ponto da lista não deslocam nada. É o que a documentação
   recomenda para varrer o acervo inteiro.

   Os dois convivem porque servem a usos diferentes, não porque um substituiu o
   outro pela metade. */
const POR_PAGINA_PADRAO = 100;
const POR_PAGINA_MAXIMO = 500;

function paginacao(req) {
  const pagina = Math.max(1, Number.parseInt(req.query.pagina, 10) || 1);
  const pedido = Number.parseInt(req.query.porPagina, 10) || POR_PAGINA_PADRAO;
  const porPagina = Math.min(Math.max(1, pedido), POR_PAGINA_MAXIMO);
  const cursor = String(req.query.cursor || "").trim();

  if (cursor) {
    /* `skip: 1` pula o próprio cursor — sem ele, o último registro de cada
       página apareceria de novo como primeiro da seguinte. */
    return { modo: "cursor", pagina: null, porPagina, extra: { cursor: { id: cursor }, skip: 1 } };
  }
  return { modo: "offset", pagina, porPagina, extra: { skip: (pagina - 1) * porPagina } };
}

/* `?desde=` — só o que mudou. É o que transforma "sincronizar" de uma varredura
   completa numa conversa curta: a integração guarda o instante da última
   leitura e pergunta pelo delta.

   Data inválida é IGNORADA em vez de recusada. O contrário transformaria um
   parâmetro mal formatado numa integração parada; assim ela lê tudo, que é
   apenas mais lento — e a resposta devolve `desde` para quem chamou perceber
   que não foi aplicado. */
function filtroDeMudanca(req, campo = "updatedAt") {
  const bruto = String(req.query.desde || "").trim();
  if (!bruto) return { where: {}, desdeAplicado: null };
  const data = new Date(bruto);
  if (Number.isNaN(data.getTime())) return { where: {}, desdeAplicado: null };
  return { where: { [campo]: { gte: data } }, desdeAplicado: data.toISOString() };
}

function querXml(req) {
  if (String(req.query.formato || "").toLowerCase() === "xml") return true;
  const aceita = String(req.headers.accept || "");
  return /xml/i.test(aceita) && !/json/i.test(aceita);
}

function responder(req, res, entidade, itens, meta) {
  /* O cursor da PRÓXIMA página é o id do último item desta. Vem sempre que a
     página veio cheia, e não só quando sabidamente há mais: quem varre para
     quando a página volta menor que o pedido, e uma última chamada vazia é
     mais barata do que uma contagem exata a cada página. */
  const proximo = itens.length === meta.porPagina ? itens[itens.length - 1]?.id : null;
  const completo = { ...meta, proximoCursor: proximo || null };
  if (querXml(req)) {
    res.type("application/xml");
    return res.send(montarXmlOmnimob(entidade, itens, completo));
  }
  return res.json({ ...completo, [entidade]: itens });
}

/* ── Formas públicas ─────────────────────────────────────────────────────────
   Um `select` explícito por entidade, e não o registro cru. É a mesma regra do
   `dadosDaVitrine`: a distância entre "trouxe do banco" e "publicou" é uma
   linha de JSON, e um `include` traria senha de usuário e token de rede social
   para dentro de uma resposta que sai da nossa casa.

   Escrever a forma à mão também é o que faz uma coluna nova ser invisível por
   padrão — quem acrescentar um campo sensível ao schema não o exporta sem
   passar por aqui. */
const IMOVEL_PUBLICO = {
  id: true, origemExterna: true, title: true, description: true, price: true,
  propertyType: true, tipoContrato: true, status: true, publicarPortais: true,
  cep: true, address: true, neighborhood: true, city: true, state: true,
  bedrooms: true, suites: true, banheiros: true, salas: true, parkingSpots: true,
  squareFootage: true, areaTerreno: true, areaConstruida: true, areaPrivativa: true, areaTotal: true,
  finalidade: true, andamento: true, aceitaPermuta: true,
  viewCount: true, leadCount: true, createdAt: true, updatedAt: true,
  tipoImovel: { select: { descricao: true } },
  images: { orderBy: { position: "asc" }, select: { url: true, is360: true, position: true } },
};

function imovelParaFora(p) {
  return {
    ...p,
    price: p.price === null ? null : Number(p.price),
    tipoImovel: p.tipoImovel?.descricao || p.propertyType || "",
    fotos: (p.images || []).map((i) => i.url),
    images: undefined,
  };
}

/* Ordenação estável para o cursor.

   `updatedAt` sozinho não serve de âncora: dois imóveis salvos no mesmo
   milissegundo dariam uma ordem que muda entre chamadas, e a paginação pularia
   um deles. O `id` desempata, e é ele que o cursor carrega. */
const ORDEM = [{ updatedAt: "desc" }, { id: "desc" }];

// ─── Imóveis ─────────────────────────────────────────────────────────────────

apiPublicaRouter.get("/imoveis", requireApi("imoveis:ler"), async (req, res) => {
  try {
    const pag = paginacao(req);
    const { where: mudou, desdeAplicado } = filtroDeMudanca(req);
    /* `status` filtrável porque a pergunta muda com o uso: um site próprio quer
       só os ATIVOS, uma migração quer tudo, inclusive rascunho. O padrão é
       tudo — a API é da imobiliária, sobre o acervo dela. */
    const where = { tenantId: req.tenant.id, ...mudou };
    const status = String(req.query.status || "").toUpperCase();
    if (["DRAFT", "ACTIVE", "INACTIVE"].includes(status)) where.status = status;

    const [total, imoveis] = await Promise.all([
      prisma.property.count({ where }),
      prisma.property.findMany({ where, select: IMOVEL_PUBLICO, orderBy: ORDEM, take: pag.porPagina, ...pag.extra }),
    ]);

    return responder(req, res, "imoveis", imoveis.map(imovelParaFora), {
      total, pagina: pag.pagina, porPagina: pag.porPagina, desde: desdeAplicado,
    });
  } catch (erro) {
    console.error("[api/v1 imoveis]", erro);
    return res.status(500).json({ error: "Erro ao listar imóveis." });
  }
});

/* O feed vem ANTES de `/imoveis/:id` na ordem de declaração, e a ordem importa:
   o Express casa de cima para baixo, e a rota com parâmetro engoliria
   `feed.xml` como se fosse um id de imóvel. */
apiPublicaRouter.get("/imoveis/feed.xml", requireApi("imoveis:ler"), async (req, res) => {
  try {
    const where = { tenantId: req.tenant.id, status: "ACTIVE" };
    const status = String(req.query.status || "").toUpperCase();
    if (["DRAFT", "ACTIVE", "INACTIVE"].includes(status)) where.status = status;

    const imoveis = await prisma.property.findMany({
      where,
      include: { images: { orderBy: { position: "asc" } }, tipoImovel: { select: { descricao: true } } },
      orderBy: { updatedAt: "desc" },
      take: POR_PAGINA_MAXIMO,
    });
    res.type("application/xml");
    return res.send(montarFeedVRSync(req.tenant, imoveis, null));
  } catch (erro) {
    console.error("[api/v1 feed]", erro);
    return res.status(500).json({ error: "Erro ao gerar o feed." });
  }
});

apiPublicaRouter.get("/imoveis/:id", requireApi("imoveis:ler"), async (req, res) => {
  try {
    /* `findFirst` com `tenantId` no where, e não `findUnique` pelo id. É a regra
       do projeto inteiro: pedir um recurso de outra imobiliária pelo id real
       responde 404, não o registro. */
    const imovel = await prisma.property.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      select: IMOVEL_PUBLICO,
    });
    if (!imovel) return res.status(404).json({ error: "Imóvel não encontrado." });
    return res.json(imovelParaFora(imovel));
  } catch (erro) {
    console.error("[api/v1 imovel]", erro);
    return res.status(500).json({ error: "Erro ao buscar o imóvel." });
  }
});

/* DELETE DESATIVA, não apaga — e a escolha é deliberada.

   Apagar de verdade levaria junto as fotos, os leads que aquele imóvel gerou e
   as vendas registradas nele: o histórico da imobiliária, destruído por uma
   chamada de um sistema externo que talvez estivesse só sincronizando um
   catálogo. INATIVO tira da vitrine e dos portais no mesmo instante, que é o
   efeito que quem chama quer, e é desfazível de dentro do painel.

   A resposta diz isso em `aviso`, para não parecer que o DELETE foi ignorado. */
apiPublicaRouter.delete("/imoveis/:id", requireApi("imoveis:escrever"), async (req, res) => {
  try {
    const imovel = await prisma.property.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      select: { id: true, status: true },
    });
    if (!imovel) return res.status(404).json({ error: "Imóvel não encontrado." });

    await prisma.property.update({ where: { id: imovel.id }, data: { status: "INACTIVE" } });
    return res.json({
      id: imovel.id,
      status: "INACTIVE",
      aviso:
        "O imóvel foi desativado, não excluído: sai da vitrine e dos portais, e o histórico de leads e vendas é preservado.",
    });
  } catch (erro) {
    console.error("[api/v1 imovel delete]", erro);
    return res.status(500).json({ error: "Erro ao desativar o imóvel." });
  }
});

// ─── Clientes ────────────────────────────────────────────────────────────────

const CLIENTE_PUBLICO = {
  id: true, origemExterna: true, nome: true, cpf: true, email: true,
  telefone: true, whatsapp: true, observacoes: true, createdAt: true, updatedAt: true,
};

apiPublicaRouter.get("/clientes", requireApi("clientes:ler"), async (req, res) => {
  try {
    const pag = paginacao(req);
    const { where: mudou, desdeAplicado } = filtroDeMudanca(req);
    const where = { tenantId: req.tenant.id, ...mudou };
    const [total, clientes] = await Promise.all([
      prisma.cliente.count({ where }),
      prisma.cliente.findMany({ where, select: CLIENTE_PUBLICO, orderBy: ORDEM, take: pag.porPagina, ...pag.extra }),
    ]);
    return responder(req, res, "clientes", clientes, {
      total, pagina: pag.pagina, porPagina: pag.porPagina, desde: desdeAplicado,
    });
  } catch (erro) {
    console.error("[api/v1 clientes]", erro);
    return res.status(500).json({ error: "Erro ao listar clientes." });
  }
});

apiPublicaRouter.get("/clientes/:id", requireApi("clientes:ler"), async (req, res) => {
  try {
    const cliente = await prisma.cliente.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      select: CLIENTE_PUBLICO,
    });
    if (!cliente) return res.status(404).json({ error: "Cliente não encontrado." });
    return res.json(cliente);
  } catch (erro) {
    console.error("[api/v1 cliente]", erro);
    return res.status(500).json({ error: "Erro ao buscar o cliente." });
  }
});

// ─── Usuários ────────────────────────────────────────────────────────────────

/* Sem `senha`, sem `forcaAlterarSenha` e sem o hash — nem por engano. */
const USUARIO_PUBLICO = {
  id: true, origemExterna: true, nome: true, login: true, email: true, ativo: true,
  creci: true, whatsapp: true, cargoVitrine: true, exibirNaVitrine: true,
  createdAt: true, updatedAt: true, cargo: { select: { descricao: true } },
};

apiPublicaRouter.get("/usuarios", requireApi("usuarios:ler"), async (req, res) => {
  try {
    const pag = paginacao(req);
    const { where: mudou, desdeAplicado } = filtroDeMudanca(req);
    const where = { tenantId: req.tenant.id, ...mudou };
    const [total, usuarios] = await Promise.all([
      prisma.usuario.count({ where }),
      prisma.usuario.findMany({ where, select: USUARIO_PUBLICO, orderBy: ORDEM, take: pag.porPagina, ...pag.extra }),
    ]);
    return responder(
      req, res, "usuarios",
      usuarios.map((u) => ({ ...u, cargo: u.cargo?.descricao || "" })),
      { total, pagina: pag.pagina, porPagina: pag.porPagina, desde: desdeAplicado },
    );
  } catch (erro) {
    console.error("[api/v1 usuarios]", erro);
    return res.status(500).json({ error: "Erro ao listar usuários." });
  }
});

// ─── Leads ───────────────────────────────────────────────────────────────────

const LEAD_PUBLICO = {
  id: true, name: true, email: true, phone: true, message: true, source: true,
  estagio: true, createdAt: true, primeiroContatoEm: true,
  property: { select: { id: true, title: true, origemExterna: true } },
};

apiPublicaRouter.get("/leads", requireApi("leads:ler"), async (req, res) => {
  try {
    const pag = paginacao(req);
    /* Lead usa `createdAt` e não `updatedAt` no `?desde=`: quem sincroniza leads
       quer os NOVOS. Filtrar por atualização traria de volta todo lead que
       mudou de estágio, e o CRM os trataria como contatos novos. */
    const { where: mudou, desdeAplicado } = filtroDeMudanca(req, "createdAt");
    const where = { tenantId: req.tenant.id, ...mudou };

    const [total, leads] = await Promise.all([
      prisma.propertyLead.count({ where }),
      prisma.propertyLead.findMany({
        where, select: LEAD_PUBLICO,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: pag.porPagina, ...pag.extra,
      }),
    ]);
    return responder(req, res, "leads", leads, {
      total, pagina: pag.pagina, porPagina: pag.porPagina, desde: desdeAplicado,
    });
  } catch (erro) {
    console.error("[api/v1 leads]", erro);
    return res.status(500).json({ error: "Erro ao listar leads." });
  }
});

/* Lead DE FORA para dentro — o caso de quem tem site próprio e usa a Omnimob
   como CRM. Sem isto, o formulário do site do cliente não tinha para onde
   mandar o contato, e a integração era de mão única.

   Passa pela MESMA distribuição automática da vitrine (`proximoResponsavel`):
   um lead que entra por fora e não cai na roleta ficaria sem dono, invisível na
   fila de quem atende. */
apiPublicaRouter.post("/leads", requireApi("leads:escrever"), async (req, res) => {
  try {
    const corpo = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const { propertyId, propertyOrigemExterna, nome, email, telefone, mensagem, origem } = corpo;

    if (!String(nome || "").trim() && !String(email || "").trim() && !String(telefone || "").trim()) {
      return res.status(400).json({ error: "Um lead precisa de ao menos nome, e-mail ou telefone." });
    }

    /* O lead pertence a um imóvel — a coluna é obrigatória no schema, e um lead
       sem imóvel não diz ao corretor sobre o que a pessoa quer falar. Aceitamos
       o id daqui OU o código do sistema de origem, porque quem manda de um site
       próprio conhece o segundo e não o primeiro. */
    const chaveDoImovel = propertyId
      ? { id: String(propertyId) }
      : { origemExterna: String(propertyOrigemExterna || "") };
    if (!propertyId && !String(propertyOrigemExterna || "").trim()) {
      return res.status(400).json({
        error: "Informe `propertyId` ou `propertyOrigemExterna` do imóvel.",
        code: "IMOVEL_NAO_INFORMADO",
      });
    }

    const imovel = await prisma.property.findFirst({
      where: { tenantId: req.tenant.id, ...chaveDoImovel },
      select: { id: true },
    });
    if (!imovel) {
      return res.status(404).json({
        error: "Imóvel não encontrado nesta imobiliária.",
        code: "IMOVEL_NAO_ENCONTRADO",
      });
    }

    const responsavel = await proximoResponsavel(req.tenant.id);
    const lead = await prisma.propertyLead.create({
      data: {
        tenantId: req.tenant.id,
        propertyId: imovel.id,
        name: String(nome || "").trim() || null,
        email: String(email || "").trim() || null,
        phone: String(telefone || "").trim() || null,
        message: String(mensagem || "").trim() || null,
        /* `source` diz de onde veio, e o padrão é o nome da chave. É o que
           permite a imobiliária ver depois que metade dos leads chega pelo site
           próprio e não pela vitrine. */
        source: String(origem || "").trim() || `api:${req.chaveApi.nome}`,
        ...(responsavel ? { responsavelId: responsavel.id } : {}),
      },
      select: LEAD_PUBLICO,
    });
    await prisma.property.update({ where: { id: imovel.id }, data: { leadCount: { increment: 1 } } });

    /* Avisa os webhooks. Um lead que entra pela API também é um lead novo, e o
       CRM que ouve não deve precisar saber por qual porta ele veio. */
    emitir(req.tenant.id, "lead.criado", lead);

    return res.status(201).json(lead);
  } catch (erro) {
    console.error("[api/v1 lead escrita]", erro);
    return res.status(500).json({ error: "Erro ao registrar o lead." });
  }
});

/* ── Escrita em lote ─────────────────────────────────────────────────────────
   O outro lado da mesma moeda: é por aqui que a plataforma antiga (ou um
   integrador) empurra dados para cá, e é o caminho de importação de clientes e
   usuários — que nenhum XML imobiliário cobre.

   Aceita JSON e XML no MESMO endpoint, decidido pelo `Content-Type`. Dois
   endpoints por entidade dobrariam a superfície por uma diferença de
   codificação, e é o `formatosImportacao` que já sabe reconhecer os dois.

   Reaproveita `importacaoService` inteiro, então "atualizar ou criar por
   `origemExterna`" vale aqui igual: reenviar o mesmo lote corrige, não duplica.
   É o que permite a integração rodar de hora em hora sem acumular lixo. */
function corpoBruto(req) {
  // O `express.text` montado no server entrega string; o `express.json`, objeto.
  if (typeof req.body === "string") return req.body;
  return JSON.stringify(req.body ?? {});
}

function escrever(entidade, escopo, executar) {
  return [
    ...requireApi(escopo),
    async (req, res) => {
      let linhas;
      try {
        ({ linhas } = lerFonte(corpoBruto(req), entidade, String(req.headers["content-type"] || "")));
      } catch (erro) {
        if (erro instanceof ErroDeFormato) {
          return res.status(400).json({ error: erro.message, code: "FORMATO" });
        }
        throw erro;
      }

      if (!linhas.length) return res.status(400).json({ error: `Nenhum registro de ${entidade} no corpo.` });
      if (linhas.length > LOTE_MAXIMO) {
        return res.status(413).json({
          error: `Envie no máximo ${LOTE_MAXIMO} registros por requisição.`,
          loteMaximo: LOTE_MAXIMO,
        });
      }

      try {
        return res.json(await executar(req, linhas));
      } catch (erro) {
        console.error(`[api/v1 escrita ${entidade}]`, erro);
        return res.status(500).json({ error: `Erro ao gravar ${entidade}.` });
      }
    },
  ];
}

apiPublicaRouter.post(
  "/imoveis",
  ...escrever("imoveis", "imoveis:escrever", async (req, linhas) => {
    /* A foto vem para a nossa conta ANTES de o imóvel ser gravado. Uma
       integração que manda URLs do próprio servidor deixaria o acervo
       dependendo dele para sempre — e quando aquele servidor saísse do ar, a
       vitrine ficaria sem imagem sem ninguém ter mexido em nada aqui. */
    const copia = await copiarFotosDasLinhas(linhas);
    const resultado = await importarImoveis(req.tenant.id, linhas);
    if (resultado.criados) emitir(req.tenant.id, "imovel.criado", { quantidade: resultado.criados });
    if (resultado.atualizados) emitir(req.tenant.id, "imovel.atualizado", { quantidade: resultado.atualizados });
    return { ...resultado, copiaDeFotos: { copiadas: copia.copiadas, falhas: copia.falhas.length } };
  }),
);

/* PUT de um imóvel só. O POST em lote já sabe atualizar por `origemExterna`;
   este existe para quem tem o NOSSO id — corrigir um preço sem remontar o lote
   inteiro, que é o que uma integração faz o dia todo depois que a migração
   acabou. */
apiPublicaRouter.put("/imoveis/:id", requireApi("imoveis:escrever"), async (req, res) => {
  try {
    const existente = await prisma.property.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      select: { id: true, origemExterna: true },
    });
    if (!existente) return res.status(404).json({ error: "Imóvel não encontrado." });

    let linhas;
    try {
      ({ linhas } = lerFonte(corpoBruto(req), "imoveis", String(req.headers["content-type"] || "")));
    } catch (erro) {
      if (erro instanceof ErroDeFormato) return res.status(400).json({ error: erro.message, code: "FORMATO" });
      throw erro;
    }
    if (linhas.length !== 1) {
      return res.status(400).json({
        error: "Envie exatamente um imóvel no corpo. Para vários, use POST /api/v1/imoveis.",
      });
    }

    /* Casa pelo `origemExterna` que o registro JÁ tem, e não pelo que veio no
       corpo. Sem isso, um PUT carregando o código de outro imóvel atualizaria o
       ERRADO — o serviço de importação procura pelo código antes de qualquer
       coisa, e o id da rota deixaria de ser quem manda. */
    const linha = { ...linhas[0] };
    if (existente.origemExterna) {
      linha.origemExterna = existente.origemExterna;
    } else {
      /* Imóvel sem código de origem: gravamos um derivado do nosso id para o
         serviço encontrar ESTE em vez de criar um segundo. Fica no registro e
         serve de âncora nas próximas chamadas. */
      linha.origemExterna = `omnimob:${existente.id}`;
      await prisma.property.update({
        where: { id: existente.id },
        data: { origemExterna: linha.origemExterna },
      });
    }

    await copiarFotosDasLinhas([linha]);
    const resultado = await importarImoveis(req.tenant.id, [linha]);
    if (resultado.erros.length) {
      return res.status(400).json({ error: resultado.erros[0].motivo, erros: resultado.erros });
    }

    emitir(req.tenant.id, "imovel.atualizado", { id: existente.id });
    const atualizado = await prisma.property.findUnique({
      where: { id: existente.id },
      select: IMOVEL_PUBLICO,
    });
    return res.json(imovelParaFora(atualizado));
  } catch (erro) {
    console.error("[api/v1 imovel put]", erro);
    return res.status(500).json({ error: "Erro ao atualizar o imóvel." });
  }
});

apiPublicaRouter.post(
  "/clientes",
  ...escrever("clientes", "clientes:escrever", (req, linhas) => importarClientes(req.tenant.id, linhas)),
);

apiPublicaRouter.post(
  "/usuarios",
  ...escrever("usuarios", "usuarios:escrever", async (req, linhas) => {
    /* Cargo de quem chega sem cargo, ou com um nome que não existe aqui. Mesma
       regra do painel: sem ela, um envio com "Corretor Sênior" — o nome que o
       sistema antigo usava — reprovaria a lista inteira em vez de cair no
       padrão. */
    const cargoPadrao = await prisma.cargo.findFirst({
      where: { tenantId: req.tenant.id, descricao: "Corretor" },
      select: { id: true },
    });
    return importarUsuarios(req.tenant.id, linhas, {
      slug: req.tenant.slug,
      cargoPadraoId: cargoPadrao?.id || null,
    });
  }),
);

/* ── Descoberta ──────────────────────────────────────────────────────────────
   As duas primeiras chamadas de quem monta uma integração. Não existirem
   significa descobrir os escopos por 403 sucessivos e os campos por tentativa. */

apiPublicaRouter.get("/eu", requireApi(), (req, res) =>
  res.json({
    imobiliaria: { nome: req.tenant.name, slug: req.tenant.slug },
    chave: { nome: req.chaveApi.nome, escopos: req.chaveApi.escopos },
  }),
);

/* A especificação, SEM chave. É o que se cola no Postman ou no Insomnia antes
   de ter uma chave — exigir credencial para ler a documentação é o tipo de
   atrito que faz o integrador desistir na primeira tarde. Não há segredo
   nenhum aqui: são nomes de campo e formatos, os mesmos que a tela mostra. */
apiPublicaRouter.get("/openapi.json", (_req, res) => res.json(ESPECIFICACAO));
