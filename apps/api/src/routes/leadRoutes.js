import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermissao } from "../middlewares/permissaoMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { requirePlanoIA } from "../middlewares/planoMiddleware.js";
import { analisarLead, isAiEnabled } from "../services/aiService.js";
import { filtroDeParados, marcarParados, HORAS_PADRAO } from "../services/leadsParados.js";

/* Ordem do funil. A lista é a fonte para validar o que chega e para o
   relatório empilhar os estágios — uma só, para os dois não desencontrarem. */
const ESTAGIOS = ["NOVO", "EM_ATENDIMENTO", "VISITA", "PROPOSTA", "GANHO", "PERDIDO"];

/* Os degraus do funil, sem a saída por baixo. É por esta ordem que o relatório
   diz "chegou até": quem está em PROPOSTA passou por VISITA mesmo que tenha
   pulado o clique. */
const DEGRAUS = ["NOVO", "EM_ATENDIMENTO", "VISITA", "PROPOSTA", "GANHO"];

const MOTIVO_PERDA_MAX = 120;

/* Quem escreveu o evento. `usuarioNome` vai gravado junto de propósito: o
   histórico precisa continuar legível depois que a pessoa sai da empresa. */
const autor = (req) => ({ usuarioId: req.authUserId || null, usuarioNome: req.authUserNome || null });

export const leadRouter = Router();
leadRouter.use(requireTenant);
leadRouter.use(requireAuth);
/* `verRelatorios`, e não mais `gerenciarLeads`: leads viraram um item dentro
   de Relatórios, e quem alcança a página alcança tudo que está nela. */
leadRouter.use(requirePermissao("verRelatorios"));

leadRouter.get("/", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const { propertyId, estagio, responsavelId, parados } = req.query;
    const horas = req.tenant.leadParadoHoras || HORAS_PADRAO;
    const soParados = parados === "1";

    const where = {
      tenantId: req.tenant.id,
      ...(propertyId ? { propertyId } : {}),
      ...(ESTAGIOS.includes(String(estagio)) ? { estagio: String(estagio) } : {}),
      /* "sem" é filtro de verdade e não ausência de filtro: a caixa comum — os
         leads que a distribuição não conseguiu atribuir — é justamente a lista
         que alguém precisa abrir todo dia. */
      ...(responsavelId === "sem" ? { responsavelId: null } : responsavelId ? { responsavelId: String(responsavelId) } : {}),
      /* "Parado" é regra do servidor (`leadsParados.js`), e o filtro vem de lá
         também — a tela não sabe contar horas, só pedir. */
      ...(soParados ? filtroDeParados({ horas }) : {}),
    };

    const [leadsCrus, total, equipe, totalParados] = await Promise.all([
      prisma.propertyLead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          property: { select: { id: true, title: true } },
          responsavel: { select: { id: true, nome: true } },
          _count: { select: { eventos: true } },
          /* Só o evento mais recente, para carimbar "parado desde". O array é
             removido antes de sair — ver `marcarParados`. */
          eventos: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
        },
        skip,
        take: limit,
      }),
      prisma.propertyLead.count({ where }),
      /* A equipe vem junto com a lista, e não numa chamada separada: o seletor
         de responsável existe em toda linha da tela, e uma segunda requisição
         só para preenchê-lo faria a lista aparecer antes dos nomes. */
      prisma.usuario.findMany({
        where: { tenantId: req.tenant.id, ativo: true, cargo: { OR: [{ gerenciarLeads: true }, { verRelatorios: true }] } },
        select: { id: true, nome: true },
        orderBy: { nome: "asc" },
      }),
      /* O contador de parados ignora os filtros da tela de propósito: ele é o
         alerta da casa ("há 7 esquecidos"), não "há 7 esquecidos do Pedro em
         proposta". */
      prisma.propertyLead.count({ where: { tenantId: req.tenant.id, ...filtroDeParados({ horas }) } }),
    ]);

    const leads = marcarParados(leadsCrus, { horas });
    return res.json({ leads, total, page, limit, equipe, estagios: ESTAGIOS, parados: totalParados, horasParaParado: horas });
  } catch {
    return res.status(500).json({ error: "Erro ao buscar leads." });
  }
});

/* ── Funil de atendimento ────────────────────────────────────────────────────
   Onde os leads estão sendo perdidos, e por quê. É o relatório que o dono da
   imobiliária lê; a lista de leads é o que o corretor trabalha.

   "Chegou até X" conta quem está em X ou adiante, OU já passou por X (evento
   ESTAGIO com `para` = X) mesmo que tenha voltado. Lead perdido conta até o
   estágio mais alto que alcançou — é assim que se vê "perdemos 12 na proposta"
   em vez de "perdemos 12".

   Período pela data de CHEGADA do lead: a pergunta é "dos que entraram neste
   mês, quantos viraram visita?". Contar por data do evento misturaria safras.
   ────────────────────────────────────────────────────────────────────────── */
const TETO_FUNIL = 5000;

leadRouter.get("/funil", async (req, res) => {
  try {
    const ate = req.query.ate ? new Date(`${req.query.ate}T23:59:59.999`) : new Date();
    const de = req.query.de ? new Date(`${req.query.de}T00:00:00`) : new Date(ate.getTime() - 30 * 86400000);
    if (Number.isNaN(de.getTime()) || Number.isNaN(ate.getTime())) {
      return res.status(400).json({ error: "Período inválido." });
    }
    const horas = req.tenant.leadParadoHoras || HORAS_PADRAO;
    const corteParado = new Date(Date.now() - horas * 3_600_000);

    const leads = await prisma.propertyLead.findMany({
      where: { tenantId: req.tenant.id, createdAt: { gte: de, lte: ate } },
      select: {
        estagio: true, motivoPerda: true, createdAt: true, primeiroContatoEm: true,
        responsavel: { select: { id: true, nome: true } },
        eventos: { select: { tipo: true, para: true, createdAt: true }, orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
      take: TETO_FUNIL,
    });

    const grau = (e) => DEGRAUS.indexOf(e);
    const maisAlto = (l) => {
      let g = l.estagio === "PERDIDO" ? 0 : grau(l.estagio);
      for (const ev of l.eventos) {
        if (ev.tipo === "ESTAGIO" && ev.para && ev.para !== "PERDIDO") g = Math.max(g, grau(ev.para));
      }
      return Math.max(g, 0);
    };

    const alcancaram = Object.fromEntries(DEGRAUS.map((d) => [d, 0]));
    const atuais = Object.fromEntries(ESTAGIOS.map((e) => [e, 0]));
    const perdidosPorDegrau = Object.fromEntries(DEGRAUS.map((d) => [d, 0]));
    const motivos = new Map();
    const porPessoa = new Map();
    let somaContatoMin = 0;
    let comContato = 0;
    let semContato = 0;
    let parados = 0;

    for (const l of leads) {
      atuais[l.estagio] += 1;
      const topo = maisAlto(l);
      for (let i = 0; i <= topo; i += 1) alcancaram[DEGRAUS[i]] += 1;

      const aberto = l.estagio !== "GANHO" && l.estagio !== "PERDIDO";
      const ultimo = l.eventos[0]?.createdAt || l.createdAt;
      const parado = aberto && new Date(ultimo) < corteParado;
      if (parado) parados += 1;

      if (l.primeiroContatoEm) {
        comContato += 1;
        somaContatoMin += (new Date(l.primeiroContatoEm) - new Date(l.createdAt)) / 60000;
      } else if (aberto) {
        semContato += 1;
      }

      if (l.estagio === "PERDIDO") {
        perdidosPorDegrau[DEGRAUS[topo]] += 1;
        const m = l.motivoPerda || "Sem motivo informado";
        motivos.set(m, (motivos.get(m) || 0) + 1);
      }

      const chave = l.responsavel?.id || "";
      if (!porPessoa.has(chave)) {
        porPessoa.set(chave, { id: chave || null, nome: l.responsavel?.nome || "Sem responsável", total: 0, ganhos: 0, perdidos: 0, abertos: 0, parados: 0, somaContatoMin: 0, comContato: 0 });
      }
      const p = porPessoa.get(chave);
      p.total += 1;
      if (l.estagio === "GANHO") p.ganhos += 1;
      else if (l.estagio === "PERDIDO") p.perdidos += 1;
      else p.abertos += 1;
      if (parado) p.parados += 1;
      if (l.primeiroContatoEm) {
        p.comContato += 1;
        p.somaContatoMin += (new Date(l.primeiroContatoEm) - new Date(l.createdAt)) / 60000;
      }
    }

    /* Taxa entre degraus vizinhos: de quem chegou em A, quantos chegaram em B.
       Nulo quando não há base — "0 de 0" não é 0%, é nada. */
    const taxas = {};
    for (let i = 1; i < DEGRAUS.length; i += 1) {
      const base = alcancaram[DEGRAUS[i - 1]];
      taxas[DEGRAUS[i]] = base ? Math.round((alcancaram[DEGRAUS[i]] / base) * 100) : null;
    }

    const encerrados = atuais.GANHO + atuais.PERDIDO;
    return res.json({
      periodo: { de: de.toISOString(), ate: ate.toISOString() },
      total: leads.length,
      truncado: leads.length >= TETO_FUNIL,
      degraus: DEGRAUS,
      alcancaram,
      atuais,
      taxas,
      /* Conversão de ponta a ponta só com base: com três leads encerrados,
         "33%" é ruído com cara de indicador. Mesma régua do painel do Flow. */
      conversao: encerrados >= 5 ? Math.round((atuais.GANHO / encerrados) * 100) : null,
      perdidosPorDegrau,
      motivosPerda: [...motivos.entries()].map(([motivo, quantidade]) => ({ motivo, quantidade })).sort((a, b) => b.quantidade - a.quantidade),
      tempoMedioPrimeiroContatoMin: comContato ? Math.round(somaContatoMin / comContato) : null,
      semContato,
      parados,
      horasParaParado: horas,
      porResponsavel: [...porPessoa.values()]
        .map(({ somaContatoMin: soma, comContato: n, ...p }) => ({ ...p, tempoMedioPrimeiroContatoMin: n ? Math.round(soma / n) : null }))
        .sort((a, b) => b.total - a.total),
    });
  } catch (erro) {
    console.error("[GET /leads/funil]", erro);
    return res.status(500).json({ error: "Erro ao montar o funil." });
  }
});

leadRouter.get("/:id", async (req, res) => {
  try {
    const lead = await prisma.propertyLead.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      include: {
        property: { select: { id: true, title: true } },
        responsavel: { select: { id: true, nome: true } },
        eventos: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!lead) {
      return res.status(404).json({ error: "Lead nao encontrado." });
    }
    return res.json(lead);
  } catch {
    return res.status(500).json({ error: "Erro ao buscar lead." });
  }
});

/* ── IA sobre o lead (Premium) ────────────────────────────────────────────────
   Resumo do que a pessoa quer, temperatura, resposta pronta e imóveis do acervo
   que servem para ela.

   `requirePlanoIA` fica NA ROTA e não no router inteiro: as outras três rotas de
   lead são de todos os planos, e subir o middleware trancaria a lista de leads
   para quem está no Básico.

   Teto de 40 imóveis no acervo enviado à IA: o prompt é cobrado por token, e uma
   imobiliária com 600 imóveis mandaria 600 linhas para escolher três. Os 40 mais
   recentes ativos são uma amostra boa do que está sendo oferecido hoje. */
const TETO_ACERVO_IA = 40;

leadRouter.post("/:id/ia", requirePlanoIA, async (req, res) => {
  try {
    // findFirst com tenantId no where, e não findUnique pelo id: é o que faz o
    // lead de outra imobiliária responder 404 em vez de vazar.
    const lead = await prisma.propertyLead.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      include: { property: { include: { images: { orderBy: { position: "asc" }, take: 1 } } } },
    });
    if (!lead) return res.status(404).json({ error: "Lead nao encontrado." });

    // A chave só é conferida DEPOIS do isolamento: sem GEMINI_API_KEY a rota
    // respondia 503 para qualquer id — inclusive o lead de outra imobiliária,
    // que tem de ser 404 independentemente de a IA existir nesta instalação.
    if (!isAiEnabled()) {
      return res.status(503).json({ error: "IA indisponível: GEMINI_API_KEY não configurada." });
    }

    const acervo = await prisma.property.findMany({
      where: {
        tenantId: req.tenant.id,
        status: "ACTIVE",
        // O imóvel que ela já abriu não entra: sugerir de volta o que a pessoa
        // estava olhando é a única sugestão garantidamente inútil.
        id: { not: lead.propertyId },
      },
      orderBy: { createdAt: "desc" },
      take: TETO_ACERVO_IA,
      select: {
        id: true, title: true, price: true, city: true, neighborhood: true,
        bedrooms: true, parkingSpots: true, squareFootage: true,
        areaPrivativa: true, propertyType: true,
      },
    });

    const analise = await analisarLead(lead, lead.property, acervo);

    /* Os ids voltam com título e preço junto. A IA devolve só o id, e a tela
       precisaria de uma segunda requisição por sugestão para ter o que mostrar. */
    const porId = new Map(acervo.map((p) => [p.id, p]));
    return res.json({
      ...analise,
      sugestoes: analise.sugestoes.map((id) => {
        const p = porId.get(id);
        return { id, title: p?.title || "", price: p?.price ?? null, city: p?.city || "", neighborhood: p?.neighborhood || "" };
      }),
    });
  } catch (err) {
    console.error("[POST /leads/:id/ia]", err);
    return res.status(500).json({ error: "Erro ao analisar o lead.", detail: err.message });
  }
});

/* ── Trabalhar o lead ────────────────────────────────────────────────────────
   Mover de estágio, trocar o responsável e escrever uma nota. As três coisas
   que uma pessoa faz com um contato, e as três geram histórico.

   Uma rota só para estágio e responsável porque na tela eles são o mesmo gesto:
   "assumi e comecei a atender". Duas rotas obrigariam a interface a fazer duas
   chamadas para uma ação que a pessoa entende como uma.
   ────────────────────────────────────────────────────────────────────────── */
leadRouter.patch("/:id", async (req, res) => {
  try {
    const lead = await prisma.propertyLead.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      include: { responsavel: { select: { id: true, nome: true } } },
    });
    if (!lead) return res.status(404).json({ error: "Lead nao encontrado." });

    const { estagio, responsavelId } = req.body || {};
    const motivoPerda = String(req.body?.motivoPerda || "").trim().slice(0, MOTIVO_PERDA_MAX);
    const data = {};
    const eventos = [];

    if (estagio !== undefined && estagio !== lead.estagio) {
      if (!ESTAGIOS.includes(estagio)) {
        return res.status(400).json({ error: "Estágio inválido." });
      }
      /* Perder exige o motivo. Sem ele o relatório diz QUANTOS se perderam e
         nunca POR QUÊ — e "por quê" é a única parte que muda o que a
         imobiliária faz amanhã. O motivo vai no evento também, para o
         histórico contar a história inteira mesmo depois de o lead voltar. */
      if (estagio === "PERDIDO" && !motivoPerda) {
        return res.status(400).json({ error: "Informe o motivo da perda." });
      }
      data.estagio = estagio;
      data.motivoPerda = estagio === "PERDIDO" ? motivoPerda : null;
      eventos.push({
        tenantId: req.tenant.id, tipo: "ESTAGIO", de: lead.estagio, para: estagio,
        ...(estagio === "PERDIDO" ? { texto: motivoPerda } : {}),
        ...autor(req),
      });

      /* Sair de NOVO é o primeiro contato, e o carimbo é o que permite medir
         tempo de resposta depois. Só a primeira vez: voltar para NOVO e sair de
         novo não reescreve a história. */
      if (lead.estagio === "NOVO" && !lead.primeiroContatoEm) {
        data.primeiroContatoEm = new Date();
      }
    }

    if (responsavelId !== undefined && responsavelId !== lead.responsavelId) {
      let nomeNovo = null;
      if (responsavelId) {
        /* Confere que o corretor é DESTA imobiliária. Sem isto, um id válido de
           outro tenant passaria pela chave estrangeira e o lead ficaria com um
           dono que nunca vai vê-lo. */
        const alvo = await prisma.usuario.findFirst({
          where: { id: String(responsavelId), tenantId: req.tenant.id, ativo: true },
          select: { id: true, nome: true },
        });
        if (!alvo) return res.status(400).json({ error: "Responsável inválido." });
        nomeNovo = alvo.nome;
      }
      data.responsavelId = responsavelId || null;
      eventos.push({
        tenantId: req.tenant.id,
        tipo: "RESPONSAVEL",
        de: lead.responsavel?.nome || null,
        para: nomeNovo,
        ...autor(req),
      });
    }

    if (!Object.keys(data).length) {
      return res.status(400).json({ error: "Nada para alterar." });
    }

    const atualizado = await prisma.propertyLead.update({
      where: { id: lead.id },
      data: { ...data, eventos: { create: eventos } },
      include: {
        property: { select: { id: true, title: true } },
        responsavel: { select: { id: true, nome: true } },
        eventos: { orderBy: { createdAt: "desc" } },
      },
    });

    return res.json(atualizado);
  } catch (erro) {
    console.error("[PATCH /leads/:id]", erro);
    return res.status(500).json({ error: "Erro ao atualizar o lead." });
  }
});

/** Nota livre no histórico — "liguei, pediu para retornar sábado". */
leadRouter.post("/:id/nota", async (req, res) => {
  try {
    const texto = String(req.body?.texto || "").trim();
    if (!texto) return res.status(400).json({ error: "Escreva a nota antes de salvar." });
    if (texto.length > 2000) return res.status(400).json({ error: "Nota longa demais (máx. 2000 caracteres)." });

    const lead = await prisma.propertyLead.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      select: { id: true, estagio: true, primeiroContatoEm: true },
    });
    if (!lead) return res.status(404).json({ error: "Lead nao encontrado." });

    /* Escrever uma nota TAMBÉM é encostar no lead. Sem esta linha, quem
       registrasse o telefonema sem mexer no estágio deixaria o lead marcado
       como nunca contatado — e o relatório de tempo de resposta mentiria. */
    const data = { eventos: { create: [{ tenantId: req.tenant.id, tipo: "NOTA", texto, ...autor(req) }] } };
    if (!lead.primeiroContatoEm) data.primeiroContatoEm = new Date();

    const atualizado = await prisma.propertyLead.update({
      where: { id: lead.id },
      data,
      include: { eventos: { orderBy: { createdAt: "desc" } } },
    });

    return res.status(201).json(atualizado);
  } catch (erro) {
    console.error("[POST /leads/:id/nota]", erro);
    return res.status(500).json({ error: "Erro ao salvar a nota." });
  }
});

leadRouter.delete("/:id", async (req, res) => {
  try {
    const lead = await prisma.propertyLead.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
    });
    if (!lead) {
      return res.status(404).json({ error: "Lead nao encontrado." });
    }
    await prisma.propertyLead.delete({ where: { id: lead.id } });
    return res.status(204).send();
  } catch {
    return res.status(500).json({ error: "Erro ao deletar lead." });
  }
});
