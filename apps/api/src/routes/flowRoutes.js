import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { requirePermissao } from "../middlewares/permissaoMiddleware.js";
import { requireFlow, requireRecursoFlow } from "../middlewares/moduloMiddleware.js";
import { proximoResponsavel } from "../services/distribuicaoLeads.js";
import {
  ESTAGIOS, TODOS_OS_ESTAGIOS, ROTULO_ESTAGIO, ESTAGIOS_EM_FECHAMENTO,
  estaEncerrado, podeMover, pendenciasParaFechar,
} from "../services/flow/funil.js";
import { dadosDoSplit, calcularSplit, emReais } from "../services/flow/comissoes.js";
import { CAMPOS, MODELO_INICIAL, conferirModelo, gerarContrato } from "../services/flow/minutas.js";
import {
  assinaturaConfigurada, configDoTenant, provedorDe, PROVEDORES_DISPONIVEIS,
} from "../services/flow/assinatura.js";
import { flowLibera } from "../services/modulos.js";
import { gerarChave, gerarSegredo } from "../services/flow/captacao.js";

/* ────────────────────────────────────────────────────────────────────────────
   OMNIMOB FLOW — as rotas do módulo.

   ── A CADEIA DE MIDDLEWARES, E POR QUE ESTA ORDEM ──

     requireAuth  →  requireTenant  →  requireFlow  →  requirePermissao

   Primeiro quem é a pessoa, depois de que imobiliária, depois se a imobiliária
   COMPROU o módulo, e só então se aquele cargo alcança a tela. Trocar as duas
   últimas faria um corretor sem permissão numa conta sem Flow receber "permissão
   negada" — e quem administra sairia mexendo em cargos em vez de contratar.

   O webhook de captação é a exceção e mora no fim do arquivo, com o motivo
   escrito lá: ele é chamado por um PORTAL, que não tem sessão nem cargo.
   ──────────────────────────────────────────────────────────────────────────── */

export const flowRouter = Router();

/* ── O que TODA rota autenticada do módulo exige ─────────────────────────── */
flowRouter.use(requireAuth);
flowRouter.use(requireTenant);
flowRouter.use(requireFlow);

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/** Registra no histórico do negócio. Nunca derruba a operação principal: um
 *  evento que não gravou é uma linha a menos no histórico, e desfazer a
 *  mudança de estágio por causa disso seria trocar um problema pequeno por um
 *  grande. Mesma escolha de `LeadEvento`. */
async function registrar(req, negocioId, tipo, dados = {}) {
  try {
    await prisma.negocioEvento.create({
      data: {
        tenantId: req.tenant.id,
        negocioId,
        usuarioId: req.authUserId || null,
        /* O nome copiado, e não só o id: o histórico precisa continuar legível
           depois que a pessoa sai da empresa. */
        usuarioNome: req.authUserNome || null,
        tipo,
        ...dados,
      },
    });
  } catch (err) {
    console.warn("[flow] não consegui gravar o evento:", err?.message || err);
  }
}

/** O negócio com tudo que as telas precisam, já confinado ao tenant.
 *  `findFirst` com `tenantId` e não `findUnique` pelo id: o id sozinho
 *  alcançaria o negócio de QUALQUER imobiliária — é o buraco que este projeto já
 *  teve três vezes. Fora do tenant responde 404: não existe, para quem pergunta. */
function negocioCompleto(tenantId, where) {
  return prisma.negocio.findFirst({
    where: { ...where, tenantId },
    include: {
      property: true,
      comprador: true,
      vendedor: true,
      lead: true,
      responsavel: { select: { id: true, nome: true, creci: true, email: true } },
      juridicoPor: { select: { id: true, nome: true } },
      financeiroPor: { select: { id: true, nome: true } },
      documentos: { orderBy: { createdAt: "desc" } },
      contratos: {
        orderBy: { createdAt: "desc" },
        include: { signatarios: { orderBy: { ordem: "asc" } } },
      },
      eventos: { orderBy: { createdAt: "desc" }, take: 80 },
    },
  });
}

/** As opções da trava, montadas num lugar só.
 *
 *  `exigeContrato` depende do PLANO: no Básico não há assinatura digital, e
 *  cobrar um documento que aquele plano não consegue produzir travaria o
 *  negócio para sempre — a trava viraria defeito em vez de controle. As duas
 *  validações humanas continuam valendo em todos os planos. */
function opcoesDaTrava(tenant, negocio) {
  const exigeContrato = flowLibera(tenant.plano, "assinaturaDigital");
  const contratoAssinado = (negocio.contratos || []).some((c) => c.status === "ASSINADO");
  return { exigeContrato, contratoAssinado };
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAINEL
   ═══════════════════════════════════════════════════════════════════════════ */

/* Alimenta a tela inicial do módulo E o contador da barra lateral. Um endpoint
   só porque as duas perguntas são a mesma — e porque a barra lateral está em
   TODA tela: um endpoint dedicado ao contador seria uma requisição a mais em
   cada navegação. */
flowRouter.get("/painel", async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const cargo = req.authCargo;

    /* Corretor vê o funil DELE; quem tem visão de comissão ou de gestão vê o da
       casa. Não é sigilo — é foco: um corretor olhando 300 negócios da equipe
       não encontra os 12 dele. */
    const soMeus = !cargo?.verComissoes && !cargo?.verPainelGestor;
    const escopo = soMeus ? { responsavelId: req.authUserId } : {};

    const DIAS_PARADO = 5;
    const corteParado = new Date(Date.now() - DIAS_PARADO * 86400000);

    const [porEstagio, parados, ganhosDoMes, aguardandoValidacao, aguardandoAssinatura] =
      await Promise.all([
        prisma.negocio.groupBy({
          by: ["estagio"],
          where: { tenantId, ...escopo },
          _count: { _all: true },
          _sum: { valorProposta: true },
        }),
        /* "Parado" é negócio ABERTO sem toque há dias. Encerrado não conta:
           negócio ganho fica parado para sempre, por definição, e contá-lo faria
           o alerta crescer sem parar até virar ruído que ninguém olha. */
        prisma.negocio.count({
          where: {
            tenantId, ...escopo,
            estagio: { notIn: ["GANHO", "PERDIDO"] },
            OR: [
              { ultimoContatoEm: { lt: corteParado } },
              { ultimoContatoEm: null, createdAt: { lt: corteParado } },
            ],
          },
        }),
        prisma.negocio.aggregate({
          where: {
            tenantId, ...escopo, estagio: "GANHO",
            fechadoEm: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
          },
          _count: { _all: true },
          _sum: { valorFechado: true, comissaoTotal: true, comissaoCorretor: true },
        }),
        prisma.negocio.count({
          where: {
            tenantId, estagio: { in: ESTAGIOS_EM_FECHAMENTO },
            OR: [{ juridicoOk: false }, { financeiroOk: false }],
          },
        }),
        prisma.contrato.count({ where: { tenantId, status: { in: ["ENVIADO", "PARCIAL"] } } }),
      ]);

    const contagem = Object.fromEntries(TODOS_OS_ESTAGIOS.map((e) => [e, 0]));
    const soma = Object.fromEntries(TODOS_OS_ESTAGIOS.map((e) => [e, 0]));
    for (const linha of porEstagio) {
      contagem[linha.estagio] = linha._count._all;
      soma[linha.estagio] = Number(linha._sum.valorProposta || 0);
    }

    /* Conversão de ponta a ponta. Só faz sentido com histórico: com três
       negócios no mês, "33% de conversão" é ruído com aparência de indicador.
       Abaixo do mínimo devolve `null`, e a tela mostra um traço — é a mesma
       regra de `dadosDaVitrine.js`: número que não existe é null, não zero. */
    const encerrados = contagem.GANHO + contagem.PERDIDO;
    const conversao = encerrados >= 5 ? Math.round((contagem.GANHO / encerrados) * 100) : null;

    return res.json({
      escopo: soMeus ? "meus" : "casa",
      contagem,
      soma,
      parados,
      diasParaParado: DIAS_PARADO,
      conversao,
      mes: {
        ganhos: ganhosDoMes._count._all,
        valor: Number(ganhosDoMes._sum.valorFechado || 0),
        comissao: Number(ganhosDoMes._sum.comissaoTotal || 0),
        comissaoCorretor: Number(ganhosDoMes._sum.comissaoCorretor || 0),
      },
      aguardandoValidacao,
      aguardandoAssinatura,
      /* O que o módulo consegue fazer nesta conta. Vem do servidor para a tela
         não recalcular a régua de plano por conta própria — dois lugares
         decidindo isso é como o menu passou a oferecer relatório que a tela
         recusava. */
      recursos: {
        captacaoWebhook: flowLibera(req.tenant.plano, "captacaoWebhook"),
        assinaturaDigital: flowLibera(req.tenant.plano, "assinaturaDigital"),
        minutaComIA: flowLibera(req.tenant.plano, "minutaComIA"),
        assinaturaPronta: assinaturaConfigurada(req.tenant),
      },
    });
  } catch (err) {
    console.error("[GET /flow/painel]", err);
    return res.status(500).json({ error: "Erro ao carregar o painel do Flow." });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   NEGÓCIOS
   ═══════════════════════════════════════════════════════════════════════════ */

const podeNegocios = requirePermissao("gerenciarNegocios");

flowRouter.get("/negocios", podeNegocios, async (req, res) => {
  try {
    const { estagio, responsavel, busca, parados } = req.query;
    const where = { tenantId: req.tenant.id };

    if (estagio && TODOS_OS_ESTAGIOS.includes(estagio)) where.estagio = estagio;
    if (responsavel === "meus") where.responsavelId = req.authUserId;
    else if (responsavel) where.responsavelId = String(responsavel);
    if (parados === "1") {
      const corte = new Date(Date.now() - 5 * 86400000);
      where.estagio = { notIn: ["GANHO", "PERDIDO"] };
      where.OR = [
        { ultimoContatoEm: { lt: corte } },
        { ultimoContatoEm: null, createdAt: { lt: corte } },
      ];
    }
    if (busca) {
      const q = String(busca).trim();
      /* `AND` e não espalhar no `where`: a busca já usa `OR` internamente, e
         somá-la a um `OR` de "parados" faria os dois virarem um só — a tela
         pediria "parados que se chamam Maria" e receberia "parados OU Maria". */
      where.AND = [{
        OR: [
          { titulo: { contains: q, mode: "insensitive" } },
          { comprador: { nome: { contains: q, mode: "insensitive" } } },
          { property: { title: { contains: q, mode: "insensitive" } } },
          ...(Number.isInteger(Number(q)) ? [{ codigo: Number(q) }] : []),
        ],
      }];
    }

    const negocios = await prisma.negocio.findMany({
      where,
      orderBy: [{ estagio: "asc" }, { updatedAt: "desc" }],
      take: 400,
      include: {
        property: { select: { id: true, title: true, city: true, neighborhood: true, price: true } },
        comprador: { select: { id: true, nome: true, telefone: true, whatsapp: true } },
        responsavel: { select: { id: true, nome: true } },
        _count: { select: { documentos: true, contratos: true } },
      },
    });

    return res.json({ negocios, estagios: ESTAGIOS, rotulos: ROTULO_ESTAGIO });
  } catch (err) {
    console.error("[GET /flow/negocios]", err);
    return res.status(500).json({ error: "Erro ao listar os negócios." });
  }
});

flowRouter.get("/negocios/:id", podeNegocios, async (req, res) => {
  try {
    const negocio = await negocioCompleto(req.tenant.id, { id: req.params.id });
    if (!negocio) return res.status(404).json({ error: "Negócio não encontrado." });

    return res.json({
      negocio,
      /* O que falta para fechar vai JUNTO do negócio, e não numa rota separada:
         a tela precisa mostrar isso antes de a pessoa tentar arrastar o cartão,
         e uma segunda chamada faria a lista aparecer depois do erro. */
      pendencias: pendenciasParaFechar(negocio, opcoesDaTrava(req.tenant, negocio)),
      /* Prévia da comissão. Calculada e NÃO gravada: gravar aqui congelaria o
         split de um negócio que ainda pode mudar de valor. Ver `comissoes.js`. */
      previaComissao: (() => {
        const s = calcularSplit({
          valor: negocio.valorFechado ?? negocio.valorProposta,
          percentual: negocio.comissaoPercentual ?? req.tenant.comissaoPercentual,
          percentualCorretor: negocio.comissaoCorretorPerc ?? req.tenant.comissaoCorretorPerc,
        });
        return {
          total: Number(s.total), imobiliaria: Number(s.imobiliaria), corretor: Number(s.corretor),
          percentual: Number(s.percentual), percentualCorretor: Number(s.percentualCorretor),
        };
      })(),
    });
  } catch (err) {
    console.error("[GET /flow/negocios/:id]", err);
    return res.status(500).json({ error: "Erro ao carregar o negócio." });
  }
});

const negocioSchema = z.object({
  titulo: z.string().trim().min(1).max(200).optional(),
  propertyId: z.string().trim().nullish(),
  compradorId: z.string().trim().nullish(),
  vendedorId: z.string().trim().nullish(),
  responsavelId: z.string().trim().nullish(),
  valorProposta: z.coerce.number().min(0).max(999999999).nullish(),
  valorFechado: z.coerce.number().min(0).max(999999999).nullish(),
  comissaoPercentual: z.coerce.number().min(0).max(100).nullish(),
  comissaoCorretorPerc: z.coerce.number().min(0).max(100).nullish(),
  canal: z.string().trim().optional(),
  origem: z.string().trim().max(120).optional(),
});

/** Nenhum id de outra imobiliária entra num negócio desta.
 *
 *  A validação é POR CONSULTA e não por confiança no cliente: era exatamente
 *  assim que o `cargoCodigo` de outra empresa entrava num usuário daqui. Um id
 *  que não existe NESTE tenant é tratado como inexistente, e não como proibido —
 *  responder "403" confirmaria que ele existe em algum lugar. */
async function conferirVinculos(tenantId, dados) {
  const erros = [];
  if (dados.propertyId) {
    const ok = await prisma.property.findFirst({ where: { id: dados.propertyId, tenantId }, select: { id: true } });
    if (!ok) erros.push("Imóvel não encontrado.");
  }
  for (const [campo, rotulo] of [["compradorId", "Comprador"], ["vendedorId", "Vendedor"]]) {
    if (dados[campo]) {
      const ok = await prisma.cliente.findFirst({ where: { id: dados[campo], tenantId }, select: { id: true } });
      if (!ok) erros.push(`${rotulo} não encontrado.`);
    }
  }
  if (dados.responsavelId) {
    const ok = await prisma.usuario.findFirst({ where: { id: dados.responsavelId, tenantId }, select: { id: true } });
    if (!ok) erros.push("Responsável não encontrado.");
  }
  return erros;
}

flowRouter.post("/negocios", podeNegocios, async (req, res) => {
  const parsed = negocioSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
  }
  const dados = parsed.data;

  try {
    const erros = await conferirVinculos(req.tenant.id, dados);
    if (erros.length) return res.status(400).json({ error: erros.join(" ") });

    /* Sem responsável explícito, entra na MESMA roleta que distribui os leads.
       Duas filas produziriam dois rodízios desencontrados, e o corretor que
       recebeu o lead descobriria o negócio dele na mão de outra pessoa. */
    let responsavelId = dados.responsavelId ?? null;
    if (!responsavelId) {
      const escolhido = await proximoResponsavel(req.tenant.id);
      responsavelId = escolhido?.id ?? null;
    }

    const negocio = await prisma.negocio.create({
      data: {
        tenantId: req.tenant.id,
        titulo: dados.titulo || "Negócio sem título",
        propertyId: dados.propertyId || null,
        compradorId: dados.compradorId || null,
        vendedorId: dados.vendedorId || null,
        responsavelId,
        valorProposta: dados.valorProposta ?? null,
        comissaoPercentual: dados.comissaoPercentual ?? null,
        comissaoCorretorPerc: dados.comissaoCorretorPerc ?? null,
        canal: dados.canal || "SITE",
        origem: dados.origem || "manual",
        ultimoContatoEm: new Date(),
      },
    });

    await registrar(req, negocio.id, "CRIADO", { texto: "Negócio criado no painel." });
    return res.status(201).json(negocio);
  } catch (err) {
    console.error("[POST /flow/negocios]", err);
    return res.status(500).json({ error: "Erro ao criar o negócio." });
  }
});

flowRouter.put("/negocios/:id", podeNegocios, async (req, res) => {
  const parsed = negocioSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
  }
  const dados = parsed.data;

  try {
    const atual = await prisma.negocio.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
    });
    if (!atual) return res.status(404).json({ error: "Negócio não encontrado." });

    const erros = await conferirVinculos(req.tenant.id, dados);
    if (erros.length) return res.status(400).json({ error: erros.join(" ") });

    /* ── A EDIÇÃO NÃO MEXE NO ESTÁGIO ────────────────────────────────────────
       De propósito, e é a decisão que sustenta a trava inteira: se o `PUT`
       aceitasse `estagio`, quem quisesse pular jurídico e financeiro mandaria
       `{ estagio: "GANHO" }` por aqui e a trava do funil viraria enfeite. A
       mudança de estágio tem rota própria, logo abaixo, e é lá — em um lugar
       só — que a regra é cobrada. */
    const trocouResponsavel = dados.responsavelId !== undefined
      && (dados.responsavelId || null) !== atual.responsavelId;

    const negocio = await prisma.negocio.update({
      where: { id: atual.id },
      data: {
        ...(dados.titulo !== undefined ? { titulo: dados.titulo } : {}),
        ...(dados.propertyId !== undefined ? { propertyId: dados.propertyId || null } : {}),
        ...(dados.compradorId !== undefined ? { compradorId: dados.compradorId || null } : {}),
        ...(dados.vendedorId !== undefined ? { vendedorId: dados.vendedorId || null } : {}),
        ...(dados.responsavelId !== undefined ? { responsavelId: dados.responsavelId || null } : {}),
        ...(dados.valorProposta !== undefined ? { valorProposta: dados.valorProposta } : {}),
        ...(dados.valorFechado !== undefined ? { valorFechado: dados.valorFechado } : {}),
        ...(dados.comissaoPercentual !== undefined ? { comissaoPercentual: dados.comissaoPercentual } : {}),
        ...(dados.comissaoCorretorPerc !== undefined ? { comissaoCorretorPerc: dados.comissaoCorretorPerc } : {}),
        ...(dados.canal !== undefined ? { canal: dados.canal } : {}),
        ultimoContatoEm: new Date(),
      },
    });

    if (trocouResponsavel) {
      const novo = negocio.responsavelId
        ? await prisma.usuario.findUnique({ where: { id: negocio.responsavelId }, select: { nome: true } })
        : null;
      await registrar(req, negocio.id, "RESPONSAVEL", {
        para: novo?.nome || "sem responsável",
        texto: `Negócio passou para ${novo?.nome || "a caixa comum"}.`,
      });
    }

    return res.json(negocio);
  } catch (err) {
    console.error("[PUT /flow/negocios/:id]", err);
    return res.status(500).json({ error: "Erro ao salvar o negócio." });
  }
});

/* ── A MUDANÇA DE ESTÁGIO ─────────────────────────────────────────────────────

   A rota mais importante do módulo. É aqui — e SÓ aqui — que a trava do
   fechamento é cobrada, e é aqui que a comissão é calculada.

   A resposta de recusa devolve `motivos`, e não só uma mensagem: "este negócio
   ainda não pode ser fechado" sem dizer o que falta manda a pessoa procurar em
   quatro telas. */
flowRouter.post("/negocios/:id/estagio", podeNegocios, async (req, res) => {
  const destino = String(req.body?.estagio || "").toUpperCase();
  const motivo = String(req.body?.motivo || "").trim().slice(0, 300);

  try {
    const negocio = await negocioCompleto(req.tenant.id, { id: req.params.id });
    if (!negocio) return res.status(404).json({ error: "Negócio não encontrado." });

    const veredito = podeMover(negocio, destino, opcoesDaTrava(req.tenant, negocio));
    if (!veredito.ok) {
      return res.status(422).json({ error: veredito.erro, motivos: veredito.motivos || [] });
    }
    if (veredito.semMudanca) return res.json({ negocio, semMudanca: true });

    const agora = new Date();
    const data = { estagio: destino, ultimoContatoEm: agora };

    if (destino === "GANHO") {
      data.fechadoEm = agora;
      /* Sem valor fechado explícito, a proposta vira o valor do negócio. É o
         caso comum: o corretor arrasta o cartão para Ganho e o valor combinado
         já está lá. Deixar nulo faria a comissão sair zerada em silêncio, que é
         o pior desfecho possível numa tela de dinheiro. */
      if (negocio.valorFechado == null) data.valorFechado = negocio.valorProposta;
      Object.assign(data, dadosDoSplit({ ...negocio, ...data }, req.tenant));
    }
    if (destino === "PERDIDO") {
      data.perdidoMotivo = motivo || null;
      data.fechadoEm = agora;
    }
    /* Reabrir um negócio encerrado limpa o fechamento. Sem isto, um negócio que
       voltou de GANHO para NEGOCIACAO continuaria contando no faturamento do mês
       com a comissão que foi calculada — e a conta da imobiliária ficaria errada
       para cima sem nenhum sintoma. */
    if (!estaEncerrado(destino) && estaEncerrado(negocio.estagio)) {
      data.fechadoEm = null;
      data.perdidoMotivo = null;
      data.comissaoTotal = null;
      data.comissaoImobiliaria = null;
      data.comissaoCorretor = null;
      data.comissaoCalculadaEm = null;
    }

    const atualizado = await prisma.negocio.update({ where: { id: negocio.id }, data });

    await registrar(req, negocio.id, "ESTAGIO", {
      de: ROTULO_ESTAGIO[negocio.estagio],
      para: ROTULO_ESTAGIO[destino],
      texto: motivo || null,
    });
    if (destino === "GANHO" && atualizado.comissaoTotal != null) {
      await registrar(req, negocio.id, "COMISSAO", {
        texto:
          `Comissão de ${emReais(atualizado.comissaoTotal)} ` +
          `(${atualizado.comissaoPercentual}% sobre ${emReais(atualizado.valorFechado)}): ` +
          `${emReais(atualizado.comissaoImobiliaria)} para a imobiliária e ` +
          `${emReais(atualizado.comissaoCorretor)} para o corretor.`,
      });
    }

    return res.json({ negocio: atualizado });
  } catch (err) {
    console.error("[POST /flow/negocios/:id/estagio]", err);
    return res.status(500).json({ error: "Erro ao mover o negócio." });
  }
});

flowRouter.post("/negocios/:id/nota", podeNegocios, async (req, res) => {
  const texto = String(req.body?.texto || "").trim().slice(0, 4000);
  if (!texto) return res.status(400).json({ error: "Escreva alguma coisa." });
  try {
    const negocio = await prisma.negocio.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id }, select: { id: true },
    });
    if (!negocio) return res.status(404).json({ error: "Negócio não encontrado." });
    await registrar(req, negocio.id, "NOTA", { texto });
    /* A nota conta como contato: quem anotou "liguei, sem resposta" encostou no
       negócio, e ele não pode continuar na lista de esquecidos. */
    await prisma.negocio.update({ where: { id: negocio.id }, data: { ultimoContatoEm: new Date() } });
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error("[POST /flow/negocios/:id/nota]", err);
    return res.status(500).json({ error: "Erro ao gravar a nota." });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   AS DUAS TRAVAS — validação jurídica e financeira
   ═══════════════════════════════════════════════════════════════════════════

   Uma rota por setor, cada uma com a permissão do setor. Uma rota só com o
   setor no corpo seria mais curta e estaria errada: `requirePermissao` decide
   pelo CAMINHO, e um corpo `{ setor: "juridico" }` obrigaria a checagem a virar
   um `if` dentro do handler — que é onde ela vira esquecível. */

const SETORES = {
  juridico: {
    permissao: "validarJuridico",
    rotulo: "jurídico",
    campos: { ok: "juridicoOk", por: "juridicoPorId", em: "juridicoEm", nota: "juridicoNota" },
  },
  financeiro: {
    permissao: "validarFinanceiro",
    rotulo: "financeiro",
    campos: { ok: "financeiroOk", por: "financeiroPorId", em: "financeiroEm", nota: "financeiroNota" },
  },
};

for (const [chave, setor] of Object.entries(SETORES)) {
  flowRouter.post(
    `/negocios/:id/validar/${chave}`,
    requirePermissao(setor.permissao),
    requireRecursoFlow("validacaoSetorial"),
    async (req, res) => {
      const aprovado = req.body?.aprovado !== false;
      const nota = String(req.body?.nota || "").trim().slice(0, 2000) || null;

      try {
        const negocio = await prisma.negocio.findFirst({
          where: { id: req.params.id, tenantId: req.tenant.id },
        });
        if (!negocio) return res.status(404).json({ error: "Negócio não encontrado." });

        /* ── VALIDAR NEGÓCIO JÁ FECHADO NÃO FAZ SENTIDO ────────────────────
           E RETIRAR a validação de um negócio fechado faz menos ainda: o
           contrato já foi assinado e a comissão já foi paga. Reabrir é o
           caminho — voltar o estágio, corrigir, fechar de novo —, e ele deixa
           rastro no histórico, que é o ponto. */
        if (estaEncerrado(negocio.estagio)) {
          return res.status(422).json({
            error: "Este negócio já está encerrado. Reabra-o antes de mexer nas validações.",
          });
        }

        const { campos } = setor;
        const atualizado = await prisma.negocio.update({
          where: { id: negocio.id },
          data: {
            [campos.ok]: aprovado,
            /* Quem e quando são apagados na REPROVAÇÃO. "Reprovado por Ana em
               terça" guardado no mesmo par de colunas que "aprovado por" faria a
               tela dizer que Ana aprovou. O motivo da recusa vai na nota e no
               histórico, que é onde ele é lido. */
            [campos.por]: aprovado ? req.authUserId : null,
            [campos.em]: aprovado ? new Date() : null,
            [campos.nota]: nota,
            ultimoContatoEm: new Date(),
          },
        });

        await registrar(req, negocio.id, "VALIDACAO", {
          para: aprovado ? "aprovado" : "pendente",
          texto: `${aprovado ? "Validação" : "Ressalva"} do setor ${setor.rotulo}${nota ? `: ${nota}` : "."}`,
        });

        const completo = await negocioCompleto(req.tenant.id, { id: negocio.id });
        return res.json({
          negocio: atualizado,
          pendencias: pendenciasParaFechar(completo, opcoesDaTrava(req.tenant, completo)),
        });
      } catch (err) {
        console.error(`[POST /flow/negocios/:id/validar/${chave}]`, err);
        return res.status(500).json({ error: "Erro ao registrar a validação." });
      }
    },
  );
}

/** A fila de quem confere. Lista o que está EM FECHAMENTO e ainda falta
 *  validar — e não todos os negócios: o conferente não tem o que fazer com um
 *  lead que chegou hoje. */
flowRouter.get("/validacao", requirePermissao("validarJuridico", "validarFinanceiro"), async (req, res) => {
  try {
    const negocios = await prisma.negocio.findMany({
      where: {
        tenantId: req.tenant.id,
        estagio: { in: ESTAGIOS_EM_FECHAMENTO },
      },
      orderBy: { updatedAt: "asc" },
      take: 200,
      include: {
        property: { select: { id: true, title: true, city: true } },
        comprador: { select: { id: true, nome: true } },
        vendedor: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true } },
        juridicoPor: { select: { nome: true } },
        financeiroPor: { select: { nome: true } },
        _count: { select: { documentos: true } },
      },
    });
    return res.json({
      negocios,
      /* O que ESTE conferente pode marcar. A tela desenha os dois cartões
         (jurídico e financeiro) para todo mundo — ver a conferência do outro
         setor é metade do valor da fila —, mas só habilita o botão de quem tem
         a permissão. */
      podeJuridico: Boolean(req.authCargo?.validarJuridico),
      podeFinanceiro: Boolean(req.authCargo?.validarFinanceiro),
    });
  } catch (err) {
    console.error("[GET /flow/validacao]", err);
    return res.status(500).json({ error: "Erro ao carregar a fila de validação." });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   DOCUMENTOS
   ═══════════════════════════════════════════════════════════════════════════ */

const documentoSchema = z.object({
  tipo: z.string().trim().default("OUTRO"),
  refereA: z.enum(["comprador", "vendedor", "imovel"]).default("comprador"),
  nome: z.string().trim().min(1).max(200),
  url: z.string().trim().url().max(1000),
  mime: z.string().trim().max(120).optional(),
  tamanho: z.coerce.number().int().min(0).max(80 * 1024 * 1024).nullish(),
});

flowRouter.post("/negocios/:id/documentos", podeNegocios, async (req, res) => {
  const parsed = documentoSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
  }
  const d = parsed.data;

  try {
    const negocio = await prisma.negocio.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id }, select: { id: true },
    });
    if (!negocio) return res.status(404).json({ error: "Negócio não encontrado." });

    /* O arquivo vai do NAVEGADOR direto para o Cloudinary, como a foto do
       imóvel — o backend nunca vê o binário. O que chega aqui é o endereço. É
       o que mantém esta rota barata numa API que já divide piscina de conexões
       com o painel inteiro. */
    const doc = await prisma.negocioDocumento.create({
      data: {
        tenantId: req.tenant.id,
        negocioId: negocio.id,
        tipo: d.tipo,
        refereA: d.refereA,
        nome: d.nome,
        url: d.url,
        mime: d.mime || "",
        tamanho: d.tamanho ?? null,
        enviadoPorId: req.authUserId || null,
      },
    });

    await registrar(req, negocio.id, "DOCUMENTO", { texto: `Documento anexado: ${d.nome}.` });
    return res.status(201).json(doc);
  } catch (err) {
    console.error("[POST /flow/negocios/:id/documentos]", err);
    return res.status(500).json({ error: "Erro ao anexar o documento." });
  }
});

/* Marcar como conferido. Quem confere documentação é o mesmo perfil que valida
   o setor — por isso a permissão é a do setor, e não `gerenciarNegocios`: o
   corretor que subiu o arquivo não é quem atesta que ele está certo. */
flowRouter.post(
  "/documentos/:id/verificar",
  requirePermissao("validarJuridico", "validarFinanceiro"),
  async (req, res) => {
    const verificado = req.body?.verificado !== false;
    const observacao = String(req.body?.observacao || "").trim().slice(0, 1000) || null;
    try {
      const doc = await prisma.negocioDocumento.findFirst({
        where: { id: req.params.id, tenantId: req.tenant.id },
      });
      if (!doc) return res.status(404).json({ error: "Documento não encontrado." });

      const atualizado = await prisma.negocioDocumento.update({
        where: { id: doc.id },
        data: { verificado, verificadoEm: verificado ? new Date() : null, observacao },
      });
      await registrar(req, doc.negocioId, "DOCUMENTO", {
        texto: `${verificado ? "Conferido" : "Marcado como pendente"}: ${doc.nome}${observacao ? ` — ${observacao}` : "."}`,
      });
      return res.json(atualizado);
    } catch (err) {
      console.error("[POST /flow/documentos/:id/verificar]", err);
      return res.status(500).json({ error: "Erro ao marcar o documento." });
    }
  },
);

flowRouter.delete("/documentos/:id", podeNegocios, async (req, res) => {
  try {
    const doc = await prisma.negocioDocumento.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
    });
    if (!doc) return res.status(404).json({ error: "Documento não encontrado." });
    await prisma.negocioDocumento.delete({ where: { id: doc.id } });
    await registrar(req, doc.negocioId, "DOCUMENTO", { texto: `Documento removido: ${doc.nome}.` });
    return res.status(204).end();
  } catch (err) {
    console.error("[DELETE /flow/documentos/:id]", err);
    return res.status(500).json({ error: "Erro ao remover o documento." });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   MODELOS DE MINUTA
   ═══════════════════════════════════════════════════════════════════════════ */

const podeContratos = requirePermissao("gerenciarContratos");

/** O vocabulário que a tela mostra ao lado do editor. Vem do SERVIDOR e não de
 *  uma cópia no front: um marcador novo no motor tem que aparecer na lista sem
 *  ninguém lembrar de atualizar duas listas. É a mesma escolha do assistente de
 *  IA da vitrine, na direção contrária. */
flowRouter.get("/minutas/campos", podeContratos, (req, res) => {
  return res.json({ campos: CAMPOS });
});

flowRouter.get("/modelos", podeContratos, async (req, res) => {
  try {
    const modelos = await prisma.modeloContrato.findMany({
      where: { tenantId: req.tenant.id },
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    });
    return res.json({ modelos, sugestao: modelos.length ? null : MODELO_INICIAL });
  } catch (err) {
    console.error("[GET /flow/modelos]", err);
    return res.status(500).json({ error: "Erro ao listar os modelos." });
  }
});

const modeloSchema = z.object({
  nome: z.string().trim().min(1).max(160),
  tipo: z.string().trim().max(40).default("VENDA"),
  corpo: z.string().min(1).max(120_000),
  ativo: z.boolean().optional(),
});

/* A conferência de marcadores acontece ao SALVAR o modelo, e não ao gerar o
   contrato. Quem escreveu `{{comprador.cpj}}` é quem tem como corrigir, e é
   agora que ele está olhando para o texto — descobrir isso seis meses depois,
   com um negócio parado esperando assinatura, é tarde demais.

   Recusa e devolve a lista: um aviso que deixa salvar é um aviso que ninguém
   lê. Marcador desconhecido é sempre erro de digitação, e não intenção. */
function conferirOuRecusar(res, corpo) {
  const { desconhecidos } = conferirModelo(corpo);
  if (desconhecidos.length) {
    res.status(400).json({
      error: "A minuta usa marcadores que não existem.",
      marcadoresDesconhecidos: desconhecidos,
    });
    return false;
  }
  return true;
}

flowRouter.post("/modelos", podeContratos, async (req, res) => {
  const parsed = modeloSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
  }
  if (!conferirOuRecusar(res, parsed.data.corpo)) return undefined;

  try {
    const modelo = await prisma.modeloContrato.create({
      data: { tenantId: req.tenant.id, ...parsed.data },
    });
    return res.status(201).json(modelo);
  } catch (err) {
    console.error("[POST /flow/modelos]", err);
    return res.status(500).json({ error: "Erro ao criar o modelo." });
  }
});

flowRouter.put("/modelos/:id", podeContratos, async (req, res) => {
  const parsed = modeloSchema.partial().safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
  }
  if (parsed.data.corpo !== undefined && !conferirOuRecusar(res, parsed.data.corpo)) return undefined;

  try {
    const atual = await prisma.modeloContrato.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id }, select: { id: true },
    });
    if (!atual) return res.status(404).json({ error: "Modelo não encontrado." });

    const modelo = await prisma.modeloContrato.update({ where: { id: atual.id }, data: parsed.data });
    return res.json(modelo);
  } catch (err) {
    console.error("[PUT /flow/modelos/:id]", err);
    return res.status(500).json({ error: "Erro ao salvar o modelo." });
  }
});

flowRouter.delete("/modelos/:id", podeContratos, async (req, res) => {
  try {
    const modelo = await prisma.modeloContrato.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id }, select: { id: true },
    });
    if (!modelo) return res.status(404).json({ error: "Modelo não encontrado." });
    /* O contrato guarda o CORPO renderizado, então apagar o modelo não apaga
       contrato nenhum (`modeloId` é SetNull). O que se perde é a origem — e a
       tela avisa antes. */
    await prisma.modeloContrato.delete({ where: { id: modelo.id } });
    return res.status(204).end();
  } catch (err) {
    console.error("[DELETE /flow/modelos/:id]", err);
    return res.status(500).json({ error: "Erro ao remover o modelo." });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   CONTRATOS
   ═══════════════════════════════════════════════════════════════════════════ */

/** O negócio com tudo que o motor de minutas precisa cruzar. */
function negocioParaMinuta(tenantId, id) {
  return prisma.negocio.findFirst({
    where: { id, tenantId },
    include: {
      property: true,
      comprador: true,
      vendedor: true,
      responsavel: { select: { id: true, nome: true, creci: true, email: true } },
    },
  });
}

/* ── A PRÉVIA ─────────────────────────────────────────────────────────────────
   Gera sem gravar. É o que permite a tela mostrar o contrato preenchido E a
   lista do que falta ANTES de a pessoa se comprometer com nada — que é o
   momento em que corrigir um CPF ainda é barato. */
flowRouter.post("/negocios/:id/contratos/previa", podeContratos, async (req, res) => {
  try {
    const negocio = await negocioParaMinuta(req.tenant.id, req.params.id);
    if (!negocio) return res.status(404).json({ error: "Negócio não encontrado." });

    let corpo = req.body?.corpo;
    if (!corpo && req.body?.modeloId) {
      const modelo = await prisma.modeloContrato.findFirst({
        where: { id: String(req.body.modeloId), tenantId: req.tenant.id },
      });
      if (!modelo) return res.status(404).json({ error: "Modelo não encontrado." });
      corpo = modelo.corpo;
    }
    if (!corpo) return res.status(400).json({ error: "Informe o modelo ou o corpo da minuta." });

    const r = gerarContrato({ corpo, negocio, tenant: req.tenant, permitirIncompleto: true });
    return res.json(r);
  } catch (err) {
    console.error("[POST /flow/negocios/:id/contratos/previa]", err);
    return res.status(500).json({ error: "Erro ao montar a prévia." });
  }
});

flowRouter.post("/negocios/:id/contratos", podeContratos, async (req, res) => {
  const modeloId = req.body?.modeloId ? String(req.body.modeloId) : null;
  const titulo = String(req.body?.titulo || "").trim().slice(0, 200);
  const forcar = req.body?.gerarIncompleto === true;

  try {
    const negocio = await negocioParaMinuta(req.tenant.id, req.params.id);
    if (!negocio) return res.status(404).json({ error: "Negócio não encontrado." });

    let corpoModelo = req.body?.corpo;
    let modelo = null;
    if (modeloId) {
      modelo = await prisma.modeloContrato.findFirst({ where: { id: modeloId, tenantId: req.tenant.id } });
      if (!modelo) return res.status(404).json({ error: "Modelo não encontrado." });
      corpoModelo = modelo.corpo;
    }
    if (!corpoModelo) return res.status(400).json({ error: "Informe o modelo ou o corpo da minuta." });

    const r = gerarContrato({
      corpo: corpoModelo, negocio, tenant: req.tenant, permitirIncompleto: forcar,
    });

    /* ── A REGRA DO MOTOR, COBRADA AQUI ────────────────────────────────────
       Marcador sem dado não vira contrato. `gerarIncompleto` existe porque às
       vezes é legítimo — a minuta vai para revisão manual antes de assinar —,
       mas exige dizer isso explicitamente, e o resultado sai com `[ ... ]` nas
       lacunas em vez de espaço em branco. Ver `services/flow/minutas.js`. */
    if (r.pendencias.length && !forcar) {
      return res.status(422).json({
        error: "A minuta tem campos sem preenchimento.",
        pendencias: r.pendencias,
      });
    }

    const contrato = await prisma.contrato.create({
      data: {
        tenantId: req.tenant.id,
        negocioId: negocio.id,
        modeloId: modelo?.id ?? null,
        titulo: titulo || modelo?.nome || `Contrato do negócio ${negocio.codigo}`,
        /* O corpo RENDERIZADO, congelado. A imobiliária edita a minuta padrão em
           julho e o contrato de maio não pode mudar junto. Ver o schema. */
        corpo: r.texto,
        status: "RASCUNHO",
      },
    });

    await registrar(req, negocio.id, "CONTRATO", {
      texto: `Contrato gerado: ${contrato.titulo}${r.pendencias.length ? " (com lacunas para revisão)" : "."}`,
    });
    return res.status(201).json({ contrato, pendencias: r.pendencias });
  } catch (err) {
    console.error("[POST /flow/negocios/:id/contratos]", err);
    return res.status(500).json({ error: "Erro ao gerar o contrato." });
  }
});

flowRouter.get("/contratos", podeContratos, async (req, res) => {
  try {
    const where = { tenantId: req.tenant.id };
    if (req.query.status) where.status = String(req.query.status).toUpperCase();

    const contratos = await prisma.contrato.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 300,
      include: {
        signatarios: { orderBy: { ordem: "asc" } },
        negocio: {
          select: {
            id: true, codigo: true, titulo: true, estagio: true,
            property: { select: { title: true } },
          },
        },
      },
    });
    return res.json({
      contratos,
      provedores: PROVEDORES_DISPONIVEIS,
      configurado: assinaturaConfigurada(req.tenant),
    });
  } catch (err) {
    console.error("[GET /flow/contratos]", err);
    return res.status(500).json({ error: "Erro ao listar os contratos." });
  }
});

flowRouter.put("/contratos/:id", podeContratos, async (req, res) => {
  const corpo = typeof req.body?.corpo === "string" ? req.body.corpo.slice(0, 200_000) : undefined;
  const titulo = req.body?.titulo ? String(req.body.titulo).trim().slice(0, 200) : undefined;
  try {
    const contrato = await prisma.contrato.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
    });
    if (!contrato) return res.status(404).json({ error: "Contrato não encontrado." });

    /* ── SÓ RASCUNHO SE EDITA ───────────────────────────────────────────────
       Depois de enviado, o texto no provedor é o que vale, e mexer aqui criaria
       duas versões do mesmo contrato: a que o cliente assinou e a que o painel
       mostra. Quem precisa mudar o texto cancela e gera outro — e o cancelamento
       fica no histórico, que é exatamente o que se quer nesse caso. */
    if (contrato.status !== "RASCUNHO") {
      return res.status(422).json({
        error: "Este contrato já foi enviado para assinatura. Cancele-o e gere outro para mudar o texto.",
      });
    }

    const atualizado = await prisma.contrato.update({
      where: { id: contrato.id },
      data: { ...(corpo !== undefined ? { corpo } : {}), ...(titulo !== undefined ? { titulo } : {}) },
    });
    return res.json(atualizado);
  } catch (err) {
    console.error("[PUT /flow/contratos/:id]", err);
    return res.status(500).json({ error: "Erro ao salvar o contrato." });
  }
});

const signatarioSchema = z.object({
  nome: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(200),
  documento: z.string().trim().max(40).nullish(),
  papel: z.enum(["COMPRADOR", "VENDEDOR", "IMOBILIARIA", "TESTEMUNHA", "FIADOR", "PROCURADOR"]).default("COMPRADOR"),
});

/* ── O ENVIO PARA ASSINATURA ──────────────────────────────────────────────────
   Aqui o contrato sai do nosso banco e vai para o provedor. É a operação mais
   cara e a menos reversível do módulo — cada envio consome um documento no
   plano da imobiliária e dispara e-mail para o cliente dela. */
flowRouter.post(
  "/contratos/:id/enviar",
  podeContratos,
  requireRecursoFlow("assinaturaDigital"),
  async (req, res) => {
    const parsed = z.array(signatarioSchema).min(1).max(12).safeParse(req.body?.signatarios || []);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Informe ao menos um signatário com nome e e-mail válidos.",
        details: parsed.error.flatten(),
      });
    }

    try {
      const contrato = await prisma.contrato.findFirst({
        where: { id: req.params.id, tenantId: req.tenant.id },
      });
      if (!contrato) return res.status(404).json({ error: "Contrato não encontrado." });
      /* Reenviar um contrato já enviado criaria um SEGUNDO documento no
         provedor, e o cliente receberia dois e-mails pedindo assinatura do
         mesmo contrato — sem saber qual vale. */
      if (contrato.status !== "RASCUNHO") {
        return res.status(422).json({ error: "Este contrato já foi enviado." });
      }

      const cfg = configDoTenant(req.tenant);
      const provedor = cfg && provedorDe(cfg.provedor);
      if (!provedor) {
        return res.status(422).json({
          error: "Configure a assinatura digital em Configurações → Flow antes de enviar.",
          faltaConfigurar: true,
        });
      }

      /* Os signatários são gravados ANTES da chamada externa, e é deliberado:
         se o provedor responder e nós perdermos a resposta (timeout, queda), o
         documento existe lá e nós precisamos ter para quem ele foi. Sem isto, o
         contrato ficaria em RASCUNHO com um documento órfão do outro lado. */
      const criados = [];
      for (const [i, s] of parsed.data.entries()) {
        criados.push(await prisma.contratoSignatario.create({
          data: { contratoId: contrato.id, ...s, ordem: i },
        }));
      }

      let resultado;
      try {
        resultado = await provedor.enviar({ cfg, contrato, signatarios: criados });
      } catch (erro) {
        /* A falha é do provedor e a mensagem dele é a única pista útil. Guardada
           no contrato para a tela poder mostrar "a Clicksign recusou: saldo de
           documentos esgotado" em vez de "erro ao enviar". */
        await prisma.contrato.update({
          where: { id: contrato.id },
          data: { ultimoErro: String(erro?.message || erro).slice(0, 2000) },
        });
        await prisma.contratoSignatario.deleteMany({ where: { contratoId: contrato.id } });
        return res.status(502).json({
          error: `O provedor de assinatura recusou o envio: ${erro?.message || "erro desconhecido"}`,
        });
      }

      for (const s of resultado.signatarios || []) {
        await prisma.contratoSignatario.update({
          where: { id: s.id },
          data: { chaveExterna: s.chaveExterna || null, urlAssinatura: s.urlAssinatura || null },
        }).catch(() => {});
      }

      const atualizado = await prisma.contrato.update({
        where: { id: contrato.id },
        data: {
          status: "ENVIADO",
          provedor: cfg.provedor,
          documentoExterno: resultado.documentoExterno || null,
          urlDocumento: resultado.urlDocumento || null,
          enviadoEm: new Date(),
          sincronizadoEm: new Date(),
          ultimoErro: null,
        },
        include: { signatarios: { orderBy: { ordem: "asc" } } },
      });

      await registrar(req, contrato.negocioId, "CONTRATO", {
        para: "ENVIADO",
        texto: `Contrato enviado para assinatura (${provedor.rotulo}) — ${criados.length} signatário(s).`,
      });
      return res.json(atualizado);
    } catch (err) {
      console.error("[POST /flow/contratos/:id/enviar]", err);
      return res.status(500).json({ error: "Erro ao enviar o contrato." });
    }
  },
);

/* ── A RELEITURA SOB DEMANDA ──────────────────────────────────────────────────
   O webhook é o caminho normal, e webhook se perde: gateway fora do ar, deploy
   no meio, a Clicksign desistindo depois de N tentativas. "O cliente jura que
   assinou e o painel diz pendente" é uma dúvida que não se resolve esperando —
   então a tela do contrato oferece o botão, e ele pergunta na fonte. */
flowRouter.post("/contratos/:id/sincronizar", podeContratos, async (req, res) => {
  try {
    const contrato = await prisma.contrato.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      include: { signatarios: true },
    });
    if (!contrato) return res.status(404).json({ error: "Contrato não encontrado." });
    if (!contrato.documentoExterno) {
      return res.status(422).json({ error: "Este contrato ainda não foi enviado." });
    }

    const cfg = configDoTenant(req.tenant);
    const provedor = cfg && provedorDe(contrato.provedor || cfg.provedor);
    if (!provedor) return res.status(422).json({ error: "Provedor de assinatura não configurado." });

    const estado = await provedor.consultar({ cfg, contrato });
    const atualizado = await aplicarEstado(req, contrato, estado);
    return res.json(atualizado);
  } catch (err) {
    console.error("[POST /flow/contratos/:id/sincronizar]", err);
    return res.status(502).json({ error: `Não consegui falar com o provedor: ${err?.message || err}` });
  }
});

flowRouter.post("/contratos/:id/cancelar", podeContratos, async (req, res) => {
  try {
    const contrato = await prisma.contrato.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
    });
    if (!contrato) return res.status(404).json({ error: "Contrato não encontrado." });
    if (contrato.status === "ASSINADO") {
      return res.status(422).json({ error: "Contrato já assinado não pode ser cancelado." });
    }

    /* Se ele chegou a ir para o provedor, cancela LÁ também. Marcar só aqui
       deixaria o documento vivo do outro lado, e o cliente ainda receberia
       lembretes para assinar um contrato que a imobiliária considera morto. */
    if (contrato.documentoExterno) {
      const cfg = configDoTenant(req.tenant);
      const provedor = cfg && provedorDe(contrato.provedor || cfg.provedor);
      if (provedor) {
        await provedor.cancelar({ cfg, contrato }).catch((e) => {
          console.warn("[flow] o provedor recusou o cancelamento:", e?.message || e);
        });
      }
    }

    const atualizado = await prisma.contrato.update({
      where: { id: contrato.id },
      data: { status: "CANCELADO", canceladoEm: new Date() },
    });
    await registrar(req, contrato.negocioId, "CONTRATO", {
      para: "CANCELADO", texto: `Contrato cancelado: ${contrato.titulo}.`,
    });
    return res.json(atualizado);
  } catch (err) {
    console.error("[POST /flow/contratos/:id/cancelar]", err);
    return res.status(500).json({ error: "Erro ao cancelar o contrato." });
  }
});

/**
 * Aplica o que o provedor disse. Um lugar só, usado pela releitura sob demanda
 * E pelo webhook — se fossem dois, os dois caminhos discordariam sobre o que
 * "assinado" faz com o negócio.
 *
 * Estado desconhecido MANTÉM o que estava: provedor acrescenta palavra nova sem
 * avisar, e o pior desfecho seria um contrato assinado voltar para rascunho.
 */
async function aplicarEstado(req, contrato, estado) {
  const data = { sincronizadoEm: new Date() };
  if (estado.status) data.status = estado.status;
  if (estado.urlAssinado) data.urlAssinado = estado.urlAssinado;
  if (estado.status === "ASSINADO" && !contrato.assinadoEm) data.assinadoEm = new Date();

  for (const a of estado.assinados || []) {
    if (!a.chaveExterna) continue;
    await prisma.contratoSignatario.updateMany({
      where: { contratoId: contrato.id, chaveExterna: String(a.chaveExterna) },
      data: { status: "ASSINADO", assinadoEm: a.assinadoEm ? new Date(a.assinadoEm) : new Date() },
    });
  }

  /* PARCIAL não vem do provedor: ele diz "running" tanto para zero assinaturas
     quanto para três de quatro. Quem sabe a diferença somos nós, e é ela que a
     tela precisa mostrar — "aguardando 1 de 3" contra "aguardando". */
  if (data.status === "ENVIADO" || (!data.status && contrato.status === "ENVIADO")) {
    const [total, assinados] = await Promise.all([
      prisma.contratoSignatario.count({ where: { contratoId: contrato.id } }),
      prisma.contratoSignatario.count({ where: { contratoId: contrato.id, status: "ASSINADO" } }),
    ]);
    if (assinados > 0 && assinados < total) data.status = "PARCIAL";
  }

  const atualizado = await prisma.contrato.update({
    where: { id: contrato.id },
    data,
    include: { signatarios: { orderBy: { ordem: "asc" } } },
  });

  if (data.status && data.status !== contrato.status && req) {
    await registrar(req, contrato.negocioId, "CONTRATO", {
      de: contrato.status, para: data.status,
      texto: `Contrato agora está ${data.status.toLowerCase()}.`,
    });
  }
  return atualizado;
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMISSÕES
   ═══════════════════════════════════════════════════════════════════════════ */

flowRouter.get("/comissoes", requirePermissao("verComissoes"), async (req, res) => {
  try {
    const agora = new Date();
    const ano = Number(req.query.ano) || agora.getFullYear();
    const mes = req.query.mes != null ? Number(req.query.mes) : agora.getMonth() + 1;
    const inicio = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 1);

    const negocios = await prisma.negocio.findMany({
      where: {
        tenantId: req.tenant.id,
        estagio: "GANHO",
        fechadoEm: { gte: inicio, lt: fim },
      },
      orderBy: { fechadoEm: "desc" },
      include: {
        property: { select: { title: true, city: true } },
        comprador: { select: { nome: true } },
        responsavel: { select: { id: true, nome: true } },
      },
    });

    /* O total por corretor sai do MESMO conjunto que a lista, e não de um
       `groupBy` separado. Duas consultas com filtros escritos duas vezes é como
       a soma do rodapé deixa de bater com as linhas da tabela — e numa tela de
       comissão isso vira uma conversa muito ruim com a equipe. */
    const porCorretor = new Map();
    let totalGeral = 0;
    let totalCasa = 0;
    let totalCorretores = 0;

    for (const n of negocios) {
      const chave = n.responsavelId || "sem-responsavel";
      const atual = porCorretor.get(chave) || {
        id: n.responsavelId, nome: n.responsavel?.nome || "Sem responsável",
        negocios: 0, valor: 0, comissao: 0,
      };
      atual.negocios += 1;
      atual.valor += Number(n.valorFechado || 0);
      atual.comissao += Number(n.comissaoCorretor || 0);
      porCorretor.set(chave, atual);

      totalGeral += Number(n.valorFechado || 0);
      totalCasa += Number(n.comissaoImobiliaria || 0);
      totalCorretores += Number(n.comissaoCorretor || 0);
    }

    return res.json({
      periodo: { ano, mes },
      negocios,
      porCorretor: [...porCorretor.values()].sort((a, b) => b.comissao - a.comissao),
      totais: {
        vendido: totalGeral,
        comissao: totalCasa + totalCorretores,
        imobiliaria: totalCasa,
        corretores: totalCorretores,
      },
    });
  } catch (err) {
    console.error("[GET /flow/comissoes]", err);
    return res.status(500).json({ error: "Erro ao calcular as comissões." });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   FONTES DE CAPTAÇÃO
   ═══════════════════════════════════════════════════════════════════════════ */

const podeCaptacao = requirePermissao("gerenciarCaptacao");

flowRouter.get("/captacao/fontes", podeCaptacao, async (req, res) => {
  try {
    const fontes = await prisma.fonteCaptacao.findMany({
      where: { tenantId: req.tenant.id },
      orderBy: { createdAt: "desc" },
    });

    const base = (process.env.API_URL || "").replace(/\/+$/, "")
      || `${req.protocol}://${req.get("host")}`;

    return res.json({
      /* A URL vai montada, e o SEGREDO vai junto. Ao contrário da `ChaveApi` —
         que aparece uma vez e some —, aqui ele precisa ser recuperável: quem
         configura o webhook no painel do ZAP volta semanas depois para
         reconfigurar, e um segredo irrecuperável obrigaria a criar uma fonte
         nova (e perder o histórico dela) por causa de um copiar e colar. É
         segredo de ASSINATURA, não credencial de acesso: sozinho ele não abre
         nada, porque a chave da URL também é exigida. */
      fontes: fontes.map((f) => ({ ...f, url: `${base}/api/captacao/${f.chave}` })),
      liberado: flowLibera(req.tenant.plano, "captacaoWebhook"),
    });
  } catch (err) {
    console.error("[GET /flow/captacao/fontes]", err);
    return res.status(500).json({ error: "Erro ao listar as fontes." });
  }
});

const fonteSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  canal: z.enum([
    "ZAP", "VIVAREAL", "OLX", "MERCADOLIVRE", "FACEBOOK",
    "INSTAGRAM", "WHATSAPP", "SITE", "INDICACAO", "OUTRO",
  ]),
  abrirNegocio: z.boolean().optional(),
  ativa: z.boolean().optional(),
});

flowRouter.post(
  "/captacao/fontes",
  podeCaptacao,
  requireRecursoFlow("captacaoWebhook"),
  async (req, res) => {
    const parsed = fonteSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
    }
    try {
      const fonte = await prisma.fonteCaptacao.create({
        data: {
          tenantId: req.tenant.id,
          ...parsed.data,
          chave: gerarChave(),
          segredo: gerarSegredo(),
        },
      });
      const base = (process.env.API_URL || "").replace(/\/+$/, "")
        || `${req.protocol}://${req.get("host")}`;
      return res.status(201).json({ ...fonte, url: `${base}/api/captacao/${fonte.chave}` });
    } catch (err) {
      console.error("[POST /flow/captacao/fontes]", err);
      return res.status(500).json({ error: "Erro ao criar a fonte." });
    }
  },
);

flowRouter.put("/captacao/fontes/:id", podeCaptacao, async (req, res) => {
  const parsed = fonteSchema.partial().safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
  }
  try {
    const fonte = await prisma.fonteCaptacao.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id }, select: { id: true },
    });
    if (!fonte) return res.status(404).json({ error: "Fonte não encontrada." });
    const atualizada = await prisma.fonteCaptacao.update({ where: { id: fonte.id }, data: parsed.data });
    return res.json(atualizada);
  } catch (err) {
    console.error("[PUT /flow/captacao/fontes/:id]", err);
    return res.status(500).json({ error: "Erro ao salvar a fonte." });
  }
});

flowRouter.delete("/captacao/fontes/:id", podeCaptacao, async (req, res) => {
  try {
    const fonte = await prisma.fonteCaptacao.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id }, select: { id: true },
    });
    if (!fonte) return res.status(404).json({ error: "Fonte não encontrada." });
    await prisma.fonteCaptacao.delete({ where: { id: fonte.id } });
    return res.status(204).end();
  } catch (err) {
    console.error("[DELETE /flow/captacao/fontes/:id]", err);
    return res.status(500).json({ error: "Erro ao remover a fonte." });
  }
});

/* O diagnóstico. É a tela que responde "por que paramos de receber leads do
   VivaReal" — e ela só consegue responder porque guardamos o corpo cru de cada
   chamada. Ver `CaptacaoEvento` no schema. */
flowRouter.get("/captacao/eventos", podeCaptacao, async (req, res) => {
  try {
    const eventos = await prisma.captacaoEvento.findMany({
      where: {
        tenantId: req.tenant.id,
        ...(req.query.fonte ? { fonteId: String(req.query.fonte) } : {}),
        ...(req.query.status ? { status: String(req.query.status).toUpperCase() } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { fonte: { select: { nome: true, canal: true } } },
    });
    return res.json({ eventos });
  } catch (err) {
    console.error("[GET /flow/captacao/eventos]", err);
    return res.status(500).json({ error: "Erro ao listar os eventos." });
  }
});
