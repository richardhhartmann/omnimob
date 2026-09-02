import { Router } from "express";
import { z } from "zod";
import { canaisAutomaticos } from "../services/publicacaoAutomatica.js";
import { dispararPublicacaoAutomatica } from "../services/disparoAutomatico.js";
import prismaPkg from "@prisma/client";
import { prisma } from "../db.js";
import { opcoesDeRemocao, removerDosCanais } from "../services/remocaoDeCanais.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermissao } from "../middlewares/permissaoMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { planoPermiteTour360 } from "../middlewares/planoMiddleware.js";
import { gerarConteudoImovel, inferirComodidadesRegiao, isAiEnabled } from "../services/aiService.js";
import { createPropertySchema, updatePropertySchema, updateTiposContratoSchema } from "../validators/propertyValidators.js";
import { conferirAnuncio, TITULO_MIN, TITULO_MAX } from "../services/feedPortais.js";

const { PropertyStatus, MetricEventType, TipoContrato } = prismaPkg;

const TODOS_TIPOS_CONTRATO = Object.values(TipoContrato);

const requireImoveis = [requireAuth, requirePermissao("gerenciarImoveis")];

export const propertyRouter = Router();
propertyRouter.use(requireTenant);

const PROPERTY_INCLUDE = {
  publications: { orderBy: { createdAt: "asc" } },
  images: { orderBy: { position: "asc" } },
  tipoImovel: true,
  atributos: { include: { atributo: true } },
};

// Tour 360° é recurso do Profissional+. Se o plano não libera (ex.: tenant que
// era Profissional, marcou fotos como 360° e depois voltou pro Básico), zeramos
// o flag na leitura para que nenhuma imagem seja renderizada em 360° — nem no
// cadastro, nem na vitrine. O valor real permanece no banco e volta a valer se
// o plano subir de novo.
function gate360Images(images, plano) {
  if (planoPermiteTour360(plano)) return images;
  return (images || []).map((img) => (img.is360 ? { ...img, is360: false } : img));
}

function gate360Property(property, plano) {
  if (!property || planoPermiteTour360(plano)) return property;
  return { ...property, images: gate360Images(property.images, plano) };
}

// ─── Tipos de contrato liberados pela imobiliária ────────────────────────────
//
// Precisa vir antes de `PUT /:id`, senão "/tipos-contrato" seria capturado
// como se fosse o id de um imóvel.

// Lista vazia no banco significa "não parametrizado": liberamos todos em vez de
// travar o cadastro por completo.
function tiposContratoDoTenant(tenant) {
  const lista = tenant?.tiposContrato;
  return Array.isArray(lista) && lista.length > 0 ? lista : TODOS_TIPOS_CONTRATO;
}

propertyRouter.put("/tipos-contrato", requireImoveis, async (req, res) => {
  try {
    const parsed = updateTiposContratoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Tipos de contrato inválidos.", details: parsed.error.flatten() });
    }

    // Remove duplicatas mantendo a ordem canônica do enum.
    const tiposContrato = TODOS_TIPOS_CONTRATO.filter((t) => parsed.data.tiposContrato.includes(t));

    const tenant = await prisma.tenant.update({
      where: { id: req.tenant.id },
      data: { tiposContrato },
      select: { tiposContrato: true },
    });
    return res.json(tenant);
  } catch (err) {
    console.error("[PUT /properties/tipos-contrato]", err);
    return res.status(500).json({ error: "Erro ao salvar tipos de contrato." });
  }
});

// ─── Tipos de imóvel com seus atributos ──────────────────────────────────────

/* Todo acesso a tipo/atributo passa pelo tenant.

   A tabela era global e estas rotas não filtravam nada: `PUT /tipos/:id` com um
   id qualquer renomeava o tipo de outra imobiliária, e o DELETE apagava. Como o
   catálogo nasce igual para todo mundo, os ids são adivinháveis — não era
   preciso nem descobrir nada.

   O atributo não tem `tenantId` próprio: ele pertence a um tipo, e é o tipo que
   tem dono. Por isso as rotas de atributo sobem até o tipo para checar. */
async function tipoDoTenant(tipoId, tenantId) {
  const id = Number(tipoId);
  if (!Number.isInteger(id)) return null;
  return prisma.tipoImovel.findFirst({ where: { id, tenantId }, select: { id: true } });
}

async function atributoDoTenant(atributoId, tenantId) {
  const id = Number(atributoId);
  if (!Number.isInteger(id)) return null;
  return prisma.modeloAtributo.findFirst({
    where: { id, tipo: { tenantId } },
    select: { id: true },
  });
}

propertyRouter.get("/tipos", async (req, res) => {
  try {
    const tipos = await prisma.tipoImovel.findMany({
      where: { tenantId: req.tenant.id },
      orderBy: { id: "asc" },
      include: { atributos: { orderBy: [{ grupo: "asc" }, { descricao: "asc" }] } },
    });
    return res.json(tipos);
  } catch (err) {
    console.error("[GET /properties/tipos]", err);
    return res.status(500).json({ error: "Erro ao listar tipos de imovel.", detail: err.message });
  }
});

propertyRouter.post("/tipos", requireImoveis, async (req, res) => {
  try {
    const { descricao, areaFields } = req.body;
    if (!descricao) return res.status(400).json({ error: "Descrição é obrigatória." });
    const tipo = await prisma.tipoImovel.create({
      data: {
        tenantId: req.tenant.id,
        descricao,
        areaFields: Array.isArray(areaFields) ? areaFields : [],
      },
      include: { atributos: true },
    });
    return res.status(201).json(tipo);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao criar tipo de imóvel." });
  }
});

propertyRouter.put("/tipos/:id", requireImoveis, async (req, res) => {
  try {
    if (!await tipoDoTenant(req.params.id, req.tenant.id)) {
      return res.status(404).json({ error: "Tipo de imóvel não encontrado." });
    }
    const { descricao, areaFields } = req.body;
    const data = {};
    if (descricao !== undefined) data.descricao = descricao;
    if (Array.isArray(areaFields)) data.areaFields = areaFields;
    const tipo = await prisma.tipoImovel.update({
      where: { id: Number(req.params.id) },
      data,
      include: { atributos: { orderBy: [{ grupo: "asc" }, { descricao: "asc" }] } },
    });
    return res.json(tipo);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao atualizar tipo de imóvel." });
  }
});

propertyRouter.delete("/tipos/:id", requireImoveis, async (req, res) => {
  try {
    if (!await tipoDoTenant(req.params.id, req.tenant.id)) {
      return res.status(404).json({ error: "Tipo de imóvel não encontrado." });
    }
    await prisma.tipoImovel.delete({ where: { id: Number(req.params.id) } });
    return res.status(204).send();
  } catch (err) {
    if (err.code === "P2003") return res.status(400).json({ error: "Tipo está em uso por imóveis cadastrados." });
    console.error(err);
    return res.status(500).json({ error: "Erro ao excluir tipo de imóvel." });
  }
});

propertyRouter.post("/tipos/:tipoId/atributos", requireImoveis, async (req, res) => {
  try {
    const { descricao, grupo } = req.body;
    if (!descricao) return res.status(400).json({ error: "Descrição é obrigatória." });
    if (!await tipoDoTenant(req.params.tipoId, req.tenant.id)) {
      return res.status(404).json({ error: "Tipo de imóvel não encontrado." });
    }
    const atr = await prisma.modeloAtributo.create({
      data: { tipoId: Number(req.params.tipoId), descricao, grupo: grupo || null },
    });
    return res.status(201).json(atr);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao criar atributo." });
  }
});

propertyRouter.put("/atributos/:id", requireImoveis, async (req, res) => {
  try {
    if (!await atributoDoTenant(req.params.id, req.tenant.id)) {
      return res.status(404).json({ error: "Atributo não encontrado." });
    }
    const { descricao, grupo } = req.body;
    const atr = await prisma.modeloAtributo.update({
      where: { id: Number(req.params.id) },
      data: { descricao, grupo: grupo || null },
    });
    return res.json(atr);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao atualizar atributo." });
  }
});

propertyRouter.delete("/atributos/:id", requireImoveis, async (req, res) => {
  try {
    if (!await atributoDoTenant(req.params.id, req.tenant.id)) {
      return res.status(404).json({ error: "Atributo não encontrado." });
    }
    await prisma.modeloAtributo.delete({ where: { id: Number(req.params.id) } });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao excluir atributo." });
  }
});

// ─── Listagem ─────────────────────────────────────────────────────────────────

propertyRouter.get("/", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const { status } = req.query;

    const where = {
      tenantId: req.tenant.id,
      ...(status ? { status } : {}),
    };

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: PROPERTY_INCLUDE,
        skip,
        take: limit,
      }),
      prisma.property.count({ where }),
    ]);

    const safe = properties.map((p) => gate360Property(p, req.tenant.plano));
    return res.json({ properties: safe, total, page, limit });
  } catch (err) {
    console.error("[GET /properties]", err);
    return res.status(500).json({ error: "Erro ao listar imoveis.", detail: err.message });
  }
});

/* ─── O que está ficando de fora do portal, e por quê ────────────────────────

   O feed exclui em silêncio o que o portal recusaria — e "em silêncio" é a
   parte cara. A imobiliária marca cem imóveis para o ZAP, oitenta entram, e não
   existe tela nenhuma que explique os vinte. A conversa vira "o sistema não
   está mandando", que é a pior forma de descobrir que faltavam duas fotos.

   Esta rota é a lista dessa diferença: um item por imóvel marcado que não passa
   em `conferirAnuncio`, com os motivos já em português e o `campo` de cada um,
   para a tela levar o corretor direto ao lugar que falta preencher.

   Vem ANTES de `/:id` na leitura do arquivo por hábito, não por necessidade —
   `/portais/pendencias` tem dois segmentos e `/:id` casa só com um. */
propertyRouter.get("/portais/pendencias", async (req, res) => {
  try {
    const imoveis = await prisma.property.findMany({
      where: { tenantId: req.tenant.id, status: "ACTIVE", publicarPortais: true },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, title: true, price: true, city: true, state: true,
        description: true, publicarPortais: true,
        images: { select: { id: true, url: true, is360: true } },
      },
    });

    const pendentes = [];
    for (const imovel of imoveis) {
      const { pode, problemas } = conferirAnuncio(imovel);
      if (pode) continue;
      pendentes.push({
        id: imovel.id,
        title: imovel.title,
        problemas,
      });
    }

    return res.json({
      pendentes,
      total: pendentes.length,
      /* Quantos DE FATO alimentam o portal. É o número que a imobiliária
         compara com o painel do ZAP quando desconfia da carga. */
      publicando: imoveis.length - pendentes.length,
      marcados: imoveis.length,
    });
  } catch (err) {
    console.error("[GET /properties/portais/pendencias]", err);
    return res.status(500).json({ error: "Erro ao conferir os anúncios.", detail: err.message });
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   CADASTROS DE IMÓVEL INTERROMPIDOS
   ════════════════════════════════════════════════════════════════════════════

   O rascunho do formulário, guardado por PESSOA. Ver o comentário do modelo
   `RascunhoImovel` no schema para por que é tabela e não `localStorage`.

   ── OS TRÊS VERBOS, E O QUE CADA UM PROTEGE ──

   `GET` devolve só os rascunhos de quem pediu — nunca os do colega. Não é
   pudor: o rascunho carrega o preço que a imobiliária ainda está decidindo,
   e ele não é assunto de todo mundo que tem `gerenciarImoveis`.

   `PUT` é upsert pela `chave` que o navegador gerou. É chamado a cada segundo e
   meio enquanto a pessoa digita, então precisa ser idempotente e barato: uma
   linha, sem leitura antes, sem trilha de auditoria.

   `DELETE` some com o rascunho, e é chamado nos dois desfechos — publicou o
   imóvel, ou descartou de propósito.

   VÊM ANTES DE `/:id`: "rascunhos" tem um segmento só e seria capturado como
   se fosse o id de um imóvel. É a mesma armadilha que `/tipos` já tinha.
   ──────────────────────────────────────────────────────────────────────────── */

/* Teto de rascunhos por pessoa. Não é economia de disco — é a lista: vinte
   cadastros pela metade não é um lugar onde alguém encontra o de ontem. Ao
   passar do teto, o mais ANTIGO sai, porque o que interessa é sempre o
   recente. */
const MAX_RASCUNHOS = 12;

/* O que cabe num rascunho. Frouxo de propósito no `dados`: é o formulário
   inteiro, que muda de campo a cada versão da tela, e um espelho do `EMPTY` do
   PropertyForm aqui envelheceria em silêncio — a tela ganharia um campo novo e
   o rascunho o descartaria sem erro nenhum. O que é cobrado é o TAMANHO. */
const rascunhoSchema = z.object({
  titulo: z.string().trim().max(200).nullish(),
  etapa: z.coerce.number().int().min(0).max(10).optional(),
  fotos: z.coerce.number().int().min(0).max(100).optional(),
  dados: z.record(z.any()),
});

/* Um rascunho é texto de formulário; 128 kB é folgado para isso e fecha a porta
   de alguém usar a tabela como armazenamento de arquivo em base64. */
const RASCUNHO_MAX_BYTES = 128 * 1024;

function rascunhoParaTela(r) {
  return {
    chave: r.chave,
    titulo: r.titulo,
    etapa: r.etapa,
    fotos: r.fotos,
    dados: r.dados,
    criadoEm: r.criadoEm,
    atualizadoEm: r.atualizadoEm,
  };
}

propertyRouter.get("/rascunhos", requireImoveis, async (req, res) => {
  try {
    const rascunhos = await prisma.rascunhoImovel.findMany({
      where: { tenantId: req.tenant.id, usuarioId: req.authUserId },
      orderBy: { atualizadoEm: "desc" },
      take: MAX_RASCUNHOS,
    });
    return res.json({ rascunhos: rascunhos.map(rascunhoParaTela) });
  } catch (err) {
    console.error("[GET /properties/rascunhos]", err);
    return res.status(500).json({ error: "Erro ao ler os cadastros em andamento." });
  }
});

propertyRouter.put("/rascunhos/:chave", requireImoveis, async (req, res) => {
  const chave = String(req.params.chave || "").trim();
  if (!chave || chave.length > 64) {
    return res.status(400).json({ error: "Chave de rascunho inválida." });
  }

  const parsed = rascunhoSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Rascunho inválido.", details: parsed.error.flatten() });
  }

  const { titulo = null, etapa = 0, fotos = 0, dados } = parsed.data;
  if (Buffer.byteLength(JSON.stringify(dados), "utf8") > RASCUNHO_MAX_BYTES) {
    return res.status(413).json({ error: "Este rascunho é grande demais para ser guardado." });
  }

  try {
    /* O `where` do upsert é `[usuarioId, chave]`, e não a chave sozinha: duas
       pessoas podem gerar a mesma chave (improvável, não impossível), e sem o
       dono na chave uma escreveria por cima do rascunho da outra. */
    const rascunho = await prisma.rascunhoImovel.upsert({
      where: { usuarioId_chave: { usuarioId: req.authUserId, chave } },
      create: {
        tenantId: req.tenant.id,
        usuarioId: req.authUserId,
        chave,
        titulo: titulo || null,
        etapa,
        fotos,
        dados,
      },
      update: { titulo: titulo || null, etapa, fotos, dados },
    });

    /* A poda roda DEPOIS de gravar e nunca derruba a resposta: o rascunho da
       pessoa já está a salvo, e falhar aqui só deixaria uma linha velha a mais.
       Trocar a ordem faria um erro de limpeza custar o trabalho dela. */
    try {
      const excedentes = await prisma.rascunhoImovel.findMany({
        where: { tenantId: req.tenant.id, usuarioId: req.authUserId },
        orderBy: { atualizadoEm: "desc" },
        skip: MAX_RASCUNHOS,
        select: { id: true },
      });
      if (excedentes.length) {
        await prisma.rascunhoImovel.deleteMany({ where: { id: { in: excedentes.map((e) => e.id) } } });
      }
    } catch (podaErr) {
      console.error("[PUT /properties/rascunhos] poda", podaErr);
    }

    return res.json(rascunhoParaTela(rascunho));
  } catch (err) {
    console.error("[PUT /properties/rascunhos]", err);
    return res.status(500).json({ error: "Erro ao guardar o cadastro em andamento." });
  }
});

propertyRouter.delete("/rascunhos/:chave", requireImoveis, async (req, res) => {
  try {
    /* `deleteMany` e não `delete`: apagar duas vezes é o normal aqui (a tela
       apaga ao publicar, e o desmonte do formulário pode repetir a chamada), e
       um 404 no segundo pedido viraria um toast de erro sobre uma operação que
       deu certo. */
    const { count } = await prisma.rascunhoImovel.deleteMany({
      where: { tenantId: req.tenant.id, usuarioId: req.authUserId, chave: String(req.params.chave || "") },
    });
    return res.json({ removidos: count });
  } catch (err) {
    console.error("[DELETE /properties/rascunhos]", err);
    return res.status(500).json({ error: "Erro ao descartar o cadastro em andamento." });
  }
});

propertyRouter.get("/:id", async (req, res) => {
  try {
    const property = await prisma.property.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      include: PROPERTY_INCLUDE,
    });

    if (!property) {
      return res.status(404).json({ error: "Imovel nao encontrado para este tenant." });
    }

    return res.json(gate360Property(property, req.tenant.plano));
  } catch {
    return res.status(500).json({ error: "Erro ao buscar imovel." });
  }
});

// Valida que os atributosIds existem e (quando há tipo) pertencem ao tipo escolhido.
// Retorna null se tudo OK, ou um objeto de erro pronto para responder com 400.
// O tipo de contrato escolhido precisa estar entre os liberados pela
// imobiliária. Sem essa checagem, bastaria um POST direto na API para gravar um
// tipo que a tela nem oferece.
function validarTipoContrato(tipoContrato, tenant) {
  if (tipoContrato == null) return null;
  if (tiposContratoDoTenant(tenant).includes(tipoContrato)) return null;
  return { error: "Este tipo de contrato não está habilitado para a sua imobiliária.", tipoContrato };
}

/* ─── O título que o portal aceita ──────────────────────────────────────────

   ZAP, VivaReal e OLX recusam anúncio com título fora de 10–100 caracteres. O
   limite mora em `feedPortais.js` junto do resto das regras do portal, e é
   importado daqui: escrever `10` outra vez neste arquivo é como as listas
   duplicadas deste projeto começaram todas as vezes.

   ── QUANDO ISTO COBRA, E QUANDO NÃO ──

   Cobrar sempre que o imóvel esteja marcado para portais seria uma armadilha:
   metade do acervo antigo tem título curto, e mexer no PREÇO de um deles
   passaria a devolver um erro sobre o título — um campo que a pessoa não
   tocou, numa tela que ela não abriu por causa dele.

   Então a trava cai só sobre a ação que de fato publica:
     • criar um imóvel já marcado para portais;
     • LIGAR a marcação num imóvel que estava fora;
     • MUDAR o título de um imóvel que está marcado.

   O acervo antigo com título curto não fica travado — fica FORA do feed, pelo
   mesmo `conferirAnuncio`, e aparece nomeado em `/portais/pendencias`. É a
   diferença entre impedir a pessoa de trabalhar e mostrar a ela o que falta. */
function validarTituloDePortal(titulo) {
  const limpo = String(titulo || "").trim();
  if (limpo.length >= TITULO_MIN && limpo.length <= TITULO_MAX) return null;

  return {
    error:
      limpo.length < TITULO_MIN
        ? `Para publicar nos portais, o título precisa de pelo menos ${TITULO_MIN} caracteres (tem ${limpo.length}).`
        : `Para publicar nos portais, o título não pode passar de ${TITULO_MAX} caracteres (tem ${limpo.length}).`,
    code: "TITULO_FORA_DO_PORTAL",
    campo: "title",
    minimo: TITULO_MIN,
    maximo: TITULO_MAX,
    tamanho: limpo.length,
  };
}

/* `tenantId` fecha o caso em que não veio tipo: sem ele, o filtro caía só sobre
   os ids e um atributo de outra imobiliária passava na validação. Com tipo
   informado o vínculo já bastaria (o tipo é conferido antes), mas depender
   disso deixaria a função correta só enquanto quem chama lembrar da ordem. */
async function validarAtributos(atributosIds, tipoImovelId, tenantId) {
  const encontrados = await prisma.modeloAtributo.findMany({
    where: {
      id: { in: atributosIds },
      tipo: { tenantId },
      ...(tipoImovelId ? { tipoId: tipoImovelId } : {}),
    },
    select: { id: true },
  });
  const validos = new Set(encontrados.map((a) => a.id));
  const invalidos = atributosIds.filter((id) => !validos.has(id));
  if (invalidos.length > 0) {
    return { error: "Alguns atributos selecionados não existem ou não pertencem ao tipo de imóvel escolhido.", invalidos };
  }
  return null;
}

// ─── Criar ────────────────────────────────────────────────────────────────────

/* ─── Cadastro concluído: publica o que for automático ───────────────────────

   Existe porque o painel cria o imóvel e sobe as fotos DEPOIS, uma a uma. O
   disparo na criação publicava um anúncio sem imagem — o Facebook postava só
   texto e o Instagram recusava. Esta rota é o sinal de que o cadastro terminou
   de verdade.

   IDEMPOTENTE por canal: só publica onde ainda não há registro. Sem isso, quem
   editasse o imóvel e voltasse ao último passo ganharia um segundo anúncio do
   mesmo imóvel — no Mercado Livre isso custa dinheiro, e no Instagram não dá
   para apagar. */
propertyRouter.post("/:id/publicar-automatico", requireImoveis, async (req, res) => {
  try {
    const automaticos = canaisAutomaticos(req.tenant);
    if (!Object.values(automaticos).some(Boolean)) return res.json({ publicado: {} });

    const imovel = await prisma.property.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      include: { images: { orderBy: { position: "asc" } } },
    });
    if (!imovel) return res.status(404).json({ error: "Imóvel não encontrado." });

    /* O que já saiu não sai de novo. Conta PUBLISHED apenas: uma tentativa que
       falhou deve poder ser refeita. */
    const jaPublicado = await prisma.propertyPublication.findMany({
      where: { propertyId: imovel.id, tenantId: req.tenant.id, status: "PUBLISHED" },
      select: { channel: true },
    });
    const feitos = new Set(jaPublicado.map((p) => p.channel));
    const pendentes = {
      portais: automaticos.portais,
      mercadoLivre: automaticos.mercadoLivre && !feitos.has("MERCADO_LIVRE"),
      facebook: automaticos.facebook && !feitos.has("FACEBOOK"),
      instagram: automaticos.instagram && !feitos.has("INSTAGRAM"),
    };

    if (!Object.values(pendentes).some(Boolean)) return res.json({ publicado: {} });

    /* Aqui a espera É devida, ao contrário do disparo na criação: a tela está
       no último passo e vai MOSTRAR o resultado. Devolver antes deixaria os
       cards dizendo "pronto" sobre algo que ainda não saiu. */
    await dispararPublicacaoAutomatica({ tenant: req.tenant, imovel, canais: pendentes });

    const depois = await prisma.propertyPublication.findMany({
      where: { propertyId: imovel.id, tenantId: req.tenant.id },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ publicado: pendentes, publicacoes: depois });
  } catch (erro) {
    console.error("[POST /properties/:id/publicar-automatico]", erro);
    return res.status(500).json({ error: "Erro ao publicar automaticamente." });
  }
});
propertyRouter.post("/", requireImoveis, async (req, res) => {
  try {
    const parsed = createPropertySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados invalidos para imovel.", details: parsed.error.flatten() });
    }

    const { tipoImovelId, atributosIds, ...propertyData } = parsed.data;

    const erroContrato = validarTipoContrato(propertyData.tipoContrato, req.tenant);
    if (erroContrato) return res.status(400).json(erroContrato);

    /* Nasce marcado para portais? Então o título já tem de servir. O padrão de
       `publicarPortais` é ligado, então isto cobre o cadastro comum. */
    if (propertyData.publicarPortais !== false) {
      const erroTitulo = validarTituloDePortal(propertyData.title);
      if (erroTitulo) return res.status(400).json(erroTitulo);
    }

    // Deriva propertyType do tipo selecionado para manter compatibilidade
    let propertyType = propertyData.propertyType || "";
    if (tipoImovelId) {
      const tipo = await prisma.tipoImovel.findFirst({ where: { id: tipoImovelId, tenantId: req.tenant.id } });
      if (!tipo) return res.status(400).json({ error: "Tipo de imovel nao encontrado." });
      propertyType = tipo.descricao;
    }

    // Garante que os atributos existem (e pertencem ao tipo), evitando erro de FK (P2003).
    if (atributosIds.length > 0) {
      const erroAtributos = await validarAtributos(atributosIds, tipoImovelId, req.tenant.id);
      if (erroAtributos) return res.status(400).json(erroAtributos);
    }

    const property = await prisma.property.create({
      data: {
        tenantId: req.tenant.id,
        tipoImovelId: tipoImovelId ?? null,
        propertyType,
        ...propertyData,
        ...(atributosIds.length > 0
          ? { atributos: { create: atributosIds.map((id) => ({ atributoId: id })) } }
          : {}),
      },
      include: PROPERTY_INCLUDE,
    });
    /* ── O disparo NÃO acontece aqui, e a razão é uma armadilha real ──────

       O painel cria o imóvel e SÓ DEPOIS sobe as fotos, uma a uma. Disparar
       na criação publicava um imóvel sem imagem nenhuma: o Facebook postava
       só texto, e o Instagram — que exige ao menos uma foto — recusava.
       Aconteceu exatamente assim no primeiro teste.

       Quem chama o disparo é a rota publicar-automatico, depois que as
       fotos terminam de subir. A exceção é quem já cria COM imagem (ainda
       ninguém, mas o dia em que a API aceitar isso, funciona sozinho). */
    if ((property.images?.length || 0) > 0) {
      const automaticos = canaisAutomaticos(req.tenant);
      if (Object.values(automaticos).some(Boolean)) {
        void dispararPublicacaoAutomatica({ tenant: req.tenant, imovel: property, canais: automaticos })
          .catch((e) => console.error("[automacao] falhou:", e.message));
      }
    }

    return res.status(201).json(gate360Property(property, req.tenant.plano));
  } catch (err) {
    console.error("[POST /properties]", err);
    return res.status(500).json({ error: "Erro ao criar imovel.", detail: err.message });
  }
});

// ─── Atualizar ────────────────────────────────────────────────────────────────

propertyRouter.put("/:id", requireImoveis, async (req, res) => {
  try {
    const parsed = updatePropertySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados invalidos para atualizacao.", details: parsed.error.flatten() });
    }

    const current = await prisma.property.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
    });
    if (!current) {
      return res.status(404).json({ error: "Imovel nao encontrado para este tenant." });
    }

    const { tipoImovelId, atributosIds, ...propertyData } = parsed.data;

    const erroContrato = validarTipoContrato(propertyData.tipoContrato, req.tenant);
    if (erroContrato) return res.status(400).json(erroContrato);

    /* Ver `validarTituloDePortal`: cobra só quando a edição É a publicação —
       ligar a marcação, ou trocar o título de quem já está marcado. Editar
       qualquer outro campo de um imóvel antigo continua passando. */
    const vaiParaPortais =
      propertyData.publicarPortais !== undefined
        ? propertyData.publicarPortais
        : current.publicarPortais;
    const ligandoAgora = propertyData.publicarPortais === true && !current.publicarPortais;
    const mudandoTitulo = propertyData.title !== undefined && propertyData.title !== current.title;

    if (vaiParaPortais && (ligandoAgora || mudandoTitulo)) {
      const erroTitulo = validarTituloDePortal(
        propertyData.title !== undefined ? propertyData.title : current.title,
      );
      if (erroTitulo) return res.status(400).json(erroTitulo);
    }

    let propertyType = propertyData.propertyType;
    if (tipoImovelId !== undefined) {
      if (tipoImovelId === null) {
        propertyType = "";
      } else {
        const tipo = await prisma.tipoImovel.findFirst({ where: { id: tipoImovelId, tenantId: req.tenant.id } });
        if (!tipo) return res.status(400).json({ error: "Tipo de imovel nao encontrado." });
        propertyType = tipo.descricao;
      }
    }

    // Garante que os atributos existem (e pertencem ao tipo), evitando erro de FK (P2003).
    if (atributosIds !== undefined && atributosIds.length > 0) {
      const tipoAlvo = tipoImovelId !== undefined ? tipoImovelId : current.tipoImovelId;
      const erroAtributos = await validarAtributos(atributosIds, tipoAlvo ?? undefined, req.tenant.id);
      if (erroAtributos) return res.status(400).json(erroAtributos);
    }

    // Atualiza atributos apenas se veio no payload
    const atributosUpdate =
      atributosIds !== undefined
        ? {
            atributos: {
              deleteMany: {},
              ...(atributosIds.length > 0
                ? { create: atributosIds.map((id) => ({ atributoId: id })) }
                : {}),
            },
          }
        : {};

    const property = await prisma.property.update({
      where: { id: req.params.id },
      data: {
        ...(tipoImovelId !== undefined ? { tipoImovelId } : {}),
        ...(propertyType !== undefined ? { propertyType } : {}),
        ...propertyData,
        ...atributosUpdate,
      },
      include: PROPERTY_INCLUDE,
    });

    return res.json(gate360Property(property, req.tenant.plano));
  } catch (err) {
    console.error("[PUT /properties/:id]", err);
    return res.status(500).json({ error: "Erro ao atualizar imovel.", detail: err.message });
  }
});

// ─── Deletar ──────────────────────────────────────────────────────────────────

/* Antes de apagar, a tela pergunta o que fazer com os anúncios que este imóvel
   tem espalhados por aí. Esta rota diz o que existe e o que dá para fazer com
   cada um — ver `services/remocaoDeCanais.js`. */
propertyRouter.get("/:id/canais-para-remover", requireImoveis, async (req, res) => {
  try {
    const existe = await prisma.property.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      select: { id: true },
    });
    if (!existe) {
      return res.status(404).json({ error: "Imovel nao encontrado para este tenant." });
    }
    const opcoes = await opcoesDeRemocao(req.tenant, req.params.id);
    return res.json({ opcoes });
  } catch (erro) {
    console.error("[imoveis] canais-para-remover:", erro);
    /* Lista vazia, não 500: não saber o que há nos canais não pode IMPEDIR a
       exclusão do imóvel. A tela cai no aviso genérico e segue. */
    return res.json({ opcoes: [] });
  }
});

propertyRouter.delete("/:id", requireImoveis, async (req, res) => {
  try {
    const current = await prisma.property.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
    });
    if (!current) {
      return res.status(404).json({ error: "Imovel nao encontrado para este tenant." });
    }

    /* A remoção nos canais vem ANTES do delete: as linhas de publicação caem
       junto com o imóvel (cascade), e é nelas que mora o `externalRef` — sem
       ele não há como alcançar o anúncio lá fora nunca mais. */
    const pedidos = String(req.query.canais || "").split(",").filter(Boolean);
    let canais = [];
    if (pedidos.length) {
      canais = await removerDosCanais(req.tenant, req.params.id, pedidos);
    }

    await prisma.property.delete({ where: { id: req.params.id } });

    /* 200 com o relato, e não 204: falhar em encerrar no Mercado Livre não
       desfaz a exclusão aqui — mas a pessoa precisa saber que ficou anúncio no
       ar. Um 204 mudo esconderia exatamente isso. */
    return res.json({ ok: true, canais });
  } catch (erro) {
    console.error("[imoveis] excluir:", erro);
    return res.status(500).json({ error: "Erro ao deletar imovel." });
  }
});

// ─── IA: gera conteúdo para um imóvel já salvo ────────────────────────────────

propertyRouter.post("/:id/ai/gerar", requireImoveis, async (req, res) => {
  try {
    if (!isAiEnabled()) {
      return res.status(503).json({ error: "IA indisponível: GEMINI_API_KEY não configurada." });
    }
    const property = await prisma.property.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      include: { tipoImovel: true, atributos: { include: { atributo: true } } },
    });
    if (!property) {
      return res.status(404).json({ error: "Imovel nao encontrado para este tenant." });
    }

    const imovel = {
      ...property,
      price: Number(property.price),
      tipo: property.tipoImovel?.descricao || property.propertyType,
      atributos: property.atributos.map((a) => a.atributo?.descricao).filter(Boolean),
    };
    const { tipos } = req.body || {};
    const { resultados, erros } = await gerarConteudoImovel(imovel, tipos);
    return res.json({ resultados, erros });
  } catch (err) {
    console.error("[POST /properties/:id/ai/gerar]", err);
    return res.status(500).json({ error: "Erro ao gerar conteúdo com IA.", detail: err.message });
  }
});

// ─── IA: infere comodidades da região a partir do endereço/CEP ────────────────

propertyRouter.post("/ai/comodidades", requireImoveis, async (req, res) => {
  try {
    if (!isAiEnabled()) {
      return res.status(503).json({ error: "IA indisponível: GEMINI_API_KEY não configurada." });
    }
    const { endereco, comodidades } = req.body || {};
    if (!endereco || typeof endereco !== "object") {
      return res.status(400).json({ error: "Campo 'endereco' é obrigatório." });
    }
    if (!Array.isArray(comodidades) || comodidades.length === 0) {
      return res.status(400).json({ error: "Campo 'comodidades' é obrigatório." });
    }
    const resultado = await inferirComodidadesRegiao(endereco, comodidades);
    return res.json(resultado);
  } catch (err) {
    console.error("[POST /properties/ai/comodidades]", err);
    return res.status(500).json({ error: "Erro ao inferir comodidades com IA.", detail: err.message });
  }
});

// ─── Publicações ──────────────────────────────────────────────────────────────

propertyRouter.get("/:id/publications", async (req, res) => {
  try {
    const publications = await prisma.propertyPublication.findMany({
      where: { propertyId: req.params.id, tenantId: req.tenant.id },
      orderBy: { createdAt: "asc" },
    });
    return res.json(publications);
  } catch {
    return res.status(500).json({ error: "Erro ao buscar publicacoes." });
  }
});

// ─── Métricas ─────────────────────────────────────────────────────────────────

propertyRouter.get("/:id/metrics", async (req, res) => {
  try {
    const { from, to } = req.query;

    const property = await prisma.property.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      select: {
        id: true,
        title: true,
        viewCount: true,
        leadCount: true,
        saleCount: true,
        createdAt: true,
      },
    });

    if (!property) {
      return res.status(404).json({ error: "Imovel nao encontrado para este tenant." });
    }

    const hasDateFilter = from || to;
    const dateFilter = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      dateFilter.lte = toDate;
    }

    const timelineWhere = {
      tenantId: req.tenant.id,
      propertyId: req.params.id,
      ...(hasDateFilter ? { createdAt: dateFilter } : {}),
    };

    const timeline = await prisma.propertyMetricEvent.groupBy({
      by: ["type"],
      where: timelineWhere,
      _count: { _all: true },
    });

    const filteredCounts = { VIEW: 0, LEAD: 0, SALE: 0 };
    timeline.forEach((e) => { filteredCounts[e.type] = e._count._all; });

    const views = hasDateFilter ? filteredCounts.VIEW : property.viewCount;
    const leads = hasDateFilter ? filteredCounts.LEAD : property.leadCount;
    const sales = hasDateFilter ? filteredCounts.SALE : property.saleCount;

    const leadConversionRate = views > 0 ? Number(((leads / views) * 100).toFixed(2)) : 0;
    const saleConversionRate = leads > 0 ? Number(((sales / leads) * 100).toFixed(2)) : 0;

    return res.json({
      property: { ...property, viewCount: views, leadCount: leads, saleCount: sales },
      summary: { leadConversionRate, saleConversionRate },
      eventsByType: timeline.map((e) => ({ type: e.type, count: e._count._all })),
      filter: hasDateFilter ? { from: from || null, to: to || null } : null,
    });
  } catch {
    return res.status(500).json({ error: "Erro ao buscar metricas." });
  }
});

async function incrementMetric(req, res, type) {
  try {
    const property = await prisma.property.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
    });

    if (!property) {
      return res.status(404).json({ error: "Imovel nao encontrado para este tenant." });
    }

    const data = {};
    if (type === MetricEventType.VIEW) data.viewCount = { increment: 1 };
    if (type === MetricEventType.LEAD) data.leadCount = { increment: 1 };
    if (type === MetricEventType.SALE) data.saleCount = { increment: 1 };

    const updated = await prisma.property.update({ where: { id: req.params.id }, data });

    await prisma.propertyMetricEvent.create({
      data: { tenantId: req.tenant.id, propertyId: req.params.id, type },
    });

    return res.json({
      id: updated.id,
      viewCount: updated.viewCount,
      leadCount: updated.leadCount,
      saleCount: updated.saleCount,
    });
  } catch {
    return res.status(500).json({ error: "Erro ao registrar metrica." });
  }
}

propertyRouter.post("/:id/metrics/view", (req, res) => incrementMetric(req, res, MetricEventType.VIEW));
propertyRouter.post("/:id/metrics/lead", (req, res) => incrementMetric(req, res, MetricEventType.LEAD));
propertyRouter.post("/:id/metrics/sale", (req, res) => incrementMetric(req, res, MetricEventType.SALE));

// ─── Imagens ──────────────────────────────────────────────────────────────────

propertyRouter.get("/:id/images", async (req, res) => {
  try {
    const property = await prisma.property.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
    });

    if (!property) {
      return res.status(404).json({ error: "Imovel nao encontrado para este tenant." });
    }

    const images = await prisma.propertyImage.findMany({
      where: { tenantId: req.tenant.id, propertyId: req.params.id },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });

    return res.json(gate360Images(images, req.tenant.plano));
  } catch {
    return res.status(500).json({ error: "Erro ao buscar imagens." });
  }
});

propertyRouter.post("/:id/images", async (req, res) => {
  try {
    const { url, publicId, is360 } = req.body || {};
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Campo url e obrigatorio para imagem." });
    }

    const property = await prisma.property.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
    });

    if (!property) {
      return res.status(404).json({ error: "Imovel nao encontrado para este tenant." });
    }

    const last = await prisma.propertyImage.findFirst({
      where: { tenantId: req.tenant.id, propertyId: req.params.id },
      orderBy: { position: "desc" },
    });

    // Tour 360° é recurso do Profissional+; para outros planos o flag é ignorado.
    const marcar360 = is360 === true && planoPermiteTour360(req.tenant.plano);

    const image = await prisma.propertyImage.create({
      data: {
        tenantId: req.tenant.id,
        propertyId: req.params.id,
        url,
        publicId: typeof publicId === "string" ? publicId : null,
        position: (last?.position || 0) + 1,
        is360: marcar360,
      },
    });

    return res.status(201).json(image);
  } catch {
    return res.status(500).json({ error: "Erro ao adicionar imagem." });
  }
});

propertyRouter.put("/:id/images/reorder", async (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ error: "order deve ser um array de IDs." });
    await Promise.all(
      order.map((imageId, i) =>
        prisma.propertyImage.updateMany({
          where: { id: imageId, propertyId: req.params.id, tenantId: req.tenant.id },
          data: { position: i + 1 },
        })
      )
    );
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Erro ao reordenar imagens." });
  }
});

// Marca/desmarca uma imagem existente como panorâmica 360° (Profissional+).
propertyRouter.patch("/:id/images/:imageId", async (req, res) => {
  try {
    const { is360 } = req.body || {};
    if (typeof is360 !== "boolean") {
      return res.status(400).json({ error: "Campo is360 (boolean) e obrigatorio." });
    }
    if (is360 && !planoPermiteTour360(req.tenant.plano)) {
      return res.status(403).json({ error: "Tour 360° disponível a partir do plano Profissional." });
    }
    const image = await prisma.propertyImage.findFirst({
      where: { id: req.params.imageId, propertyId: req.params.id, tenantId: req.tenant.id },
    });
    if (!image) {
      return res.status(404).json({ error: "Imagem nao encontrada para este imovel." });
    }
    const updated = await prisma.propertyImage.update({
      where: { id: image.id },
      data: { is360 },
    });
    return res.json(updated);
  } catch {
    return res.status(500).json({ error: "Erro ao atualizar imagem." });
  }
});

propertyRouter.delete("/:id/images/:imageId", async (req, res) => {
  try {
    const image = await prisma.propertyImage.findFirst({
      where: {
        id: req.params.imageId,
        propertyId: req.params.id,
        tenantId: req.tenant.id,
      },
    });

    if (!image) {
      return res.status(404).json({ error: "Imagem nao encontrada para este imovel." });
    }

    await prisma.propertyImage.delete({ where: { id: image.id } });
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "Erro ao deletar imagem." });
  }
});
