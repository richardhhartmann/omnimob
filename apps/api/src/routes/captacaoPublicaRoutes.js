import { Router } from "express";
import { prisma } from "../db.js";
import { proximoResponsavel } from "../services/distribuicaoLeads.js";
import {
  lerPayload, temContato, assinaturaConfere, filtroDeDuplicata,
  normalizarTelefone, tituloDoNegocio,
} from "../services/flow/captacao.js";
import { tenantTemModulo, flowLibera, FLOW } from "../services/modulos.js";
import { emitir } from "../services/webhooks.js";

/* ────────────────────────────────────────────────────────────────────────────
   A PORTA DE ENTRADA DE LEAD — chamada pelos portais e pelas redes.

   ── POR QUE ELA NÃO ESTÁ EM `flowRoutes.js` ──

   Porque quem chama é um ROBÔ do ZAP, não uma pessoa logada. Ela não tem
   sessão, não tem `x-tenant-slug`, não tem cargo. Deixá-la sob o
   `flowRouter.use(requireAuth)` significaria abrir uma exceção no meio de uma
   cadeia de middlewares que existe justamente para não ter exceção — e exceção
   em middleware de autenticação é como buraco de segurança nasce.

   Aqui a autenticação é outra: a CHAVE no caminho (24 bytes aleatórios,
   revogável por fonte) e, quando a fonte assina, o HMAC do corpo.

   ── E POR QUE ELE NÃO FICA SOB /api/flow ──

   Porque `/:chave` casa com qualquer palavra, inclusive com `fontes` e
   `eventos` — as rotas de gerência do painel. Montado ali, ele as engolia: a
   tela pedia a lista de fontes e recebia 404 "Fonte não encontrada", porque o
   webhook tinha lido "fontes" como uma chave de portal.

   Em `/api/captacao` ele fica sozinho e a colisão deixa de ser possível, em vez
   de depender da ordem de montagem para não acontecer.

   ── AS REGRAS DE OURO DESTA ROTA ──

   1. RESPONDER 200 QUASE SEMPRE. Portal que recebe erro desativa a integração
      por conta própria, e ninguém avisa a imobiliária. Corpo que não
      entendemos, lead sem contato, duplicata — tudo isso é 200 com o motivo no
      corpo, e vira uma linha no diagnóstico. Os únicos erros de verdade são
      chave inválida (404) e assinatura errada (401): nesses dois casos quem
      está chamando não é quem diz ser, e engolir seria pior.

   2. GRAVAR O CORPO CRU, SEMPRE. Antes de qualquer interpretação. Portal muda
      o formato sem avisar e o sintoma é "paramos de receber leads do VivaReal"
      três dias depois — sem o corpo original não há como descobrir o que
      mudou, e os leads daqueles três dias estão perdidos.

   3. NUNCA DERRUBAR POR CAUSA DO QUE VEM DEPOIS. Abrir negócio, avisar webhook
      de saída, distribuir para o corretor: nada disso pode fazer o lead se
      perder. O lead é o ativo; o resto é conveniência.
   ──────────────────────────────────────────────────────────────────────────── */

export const captacaoPublicaRouter = Router();

/* Um teto por fonte, e por hora. Não é rate limit de segurança — é contenção de
   laço: integrador mal configurado que reenvia em loop já encheu o banco de
   cliente de gente boa. Acima do teto continua respondendo 200 (regra 1) e
   registra como RECUSADO, então o diagnóstico mostra exatamente o que
   aconteceu. */
const TETO_POR_HORA = 300;

/**
 * `GET` na mesma URL: a verificação que alguns provedores exigem antes de
 * ativar o webhook (o Facebook manda `hub.challenge`), e o teste que a pessoa
 * faz colando a URL no navegador para ver se "está no ar".
 *
 * Não expõe nada sobre a imobiliária — só confirma que a porta existe.
 */
captacaoPublicaRouter.get("/:chave", async (req, res) => {
  const desafio = req.query["hub.challenge"];
  const fonte = await prisma.fonteCaptacao.findUnique({
    where: { chave: req.params.chave },
    select: { id: true, ativa: true, canal: true },
  });
  if (!fonte) return res.status(404).json({ error: "Fonte não encontrada." });
  /* O desafio do Facebook espera o valor cru de volta, como texto. */
  if (desafio) return res.type("text/plain").send(String(desafio));
  return res.json({ ok: true, canal: fonte.canal, ativa: fonte.ativa });
});

captacaoPublicaRouter.post("/:chave", async (req, res) => {
  const chave = req.params.chave;

  let fonte;
  try {
    fonte = await prisma.fonteCaptacao.findUnique({
      where: { chave },
      include: { tenant: true },
    });
  } catch (err) {
    console.error("[captacao] falha ao resolver a fonte:", err);
    return res.status(500).json({ error: "Erro interno." });
  }

  /* 404 e não 403: dizer "existe mas você não pode" confirmaria a chave para
     quem está tentando adivinhar. */
  if (!fonte) return res.status(404).json({ error: "Fonte não encontrada." });

  const tenant = fonte.tenant;

  /* ── A assinatura, antes de qualquer coisa ────────────────────────────────
     `req.rawBody` é o corpo EXATO em bytes, guardado pelo `verify` do
     express.json (ver `server.js`). Recalcular o HMAC sobre
     `JSON.stringify(req.body)` não funciona: a ordem das chaves e o
     espaçamento mudam na ida e volta, e a assinatura nunca bateria. */
  const corpoBruto = req.rawBody || JSON.stringify(req.body || {});
  const recebida = req.header("x-omnimob-assinatura")
    || req.header("x-hub-signature-256")
    || req.header("x-signature");
  const { conferida, valida } = assinaturaConfere(corpoBruto, fonte.segredo, recebida);
  if (conferida && !valida) {
    /* Um dos dois erros que NÃO viram 200: quem chamou não é quem diz ser. */
    await registrarEvento(fonte, req.body, "RECUSADO", "Assinatura inválida.");
    return res.status(401).json({ error: "Assinatura inválida." });
  }

  /* ── As portas do produto ─────────────────────────────────────────────────
     Contratou o Flow? O plano libera captação? Conta ativa? As três respondem
     200 com motivo: do outro lado está um robô, e o problema é comercial, não
     técnico. Quem precisa ficar sabendo é a imobiliária, e ela fica — pelo
     diagnóstico. */
  if (!tenant?.ativo) {
    await registrarEvento(fonte, req.body, "RECUSADO", "Conta desativada.");
    return res.json({ recebido: false, motivo: "conta-inativa" });
  }
  if (!tenantTemModulo(tenant, FLOW)) {
    await registrarEvento(fonte, req.body, "RECUSADO", "Módulo Flow não contratado.");
    return res.json({ recebido: false, motivo: "modulo-nao-contratado" });
  }
  if (!flowLibera(tenant.plano, "captacaoWebhook")) {
    await registrarEvento(fonte, req.body, "RECUSADO", "Captação por webhook exige o plano Profissional.");
    return res.json({ recebido: false, motivo: "plano-insuficiente" });
  }
  if (!fonte.ativa) {
    await registrarEvento(fonte, req.body, "RECUSADO", "Fonte desativada.");
    return res.json({ recebido: false, motivo: "fonte-inativa" });
  }

  const desdeUmaHora = new Date(Date.now() - 3600_000);
  const naHora = await prisma.captacaoEvento.count({
    where: { fonteId: fonte.id, createdAt: { gte: desdeUmaHora } },
  });
  if (naHora >= TETO_POR_HORA) {
    await registrarEvento(fonte, req.body, "RECUSADO", `Teto de ${TETO_POR_HORA} chamadas por hora atingido.`);
    return res.json({ recebido: false, motivo: "teto-por-hora" });
  }

  try {
    const lido = lerPayload(fonte.canal, req.body);

    if (!temContato(lido)) {
      /* Sem e-mail nem telefone não há lead: há o registro de que alguém
         clicou, e o corretor não pode fazer nada com isso. Vira linha no
         diagnóstico — é assim que a imobiliária descobre que o formulário do
         portal está mandando o campo errado. */
      await registrarEvento(fonte, req.body, "RECUSADO", "Sem e-mail nem telefone no corpo recebido.");
      return res.json({ recebido: false, motivo: "sem-contato" });
    }

    /* ── Qual imóvel? ───────────────────────────────────────────────────────
       O portal manda a referência que ELE conhece, que é o `origemExterna` do
       nosso cadastro quando o acervo veio de importação. Sem casar, o lead entra
       sem imóvel — e isso é aceitável: um interessado sem imóvel identificado
       ainda é um interessado. Recusá-lo por causa disso seria jogar fora o
       ativo por causa do enfeite. */
    let property = null;
    if (lido.referenciaImovel) {
      property = await prisma.property.findFirst({
        where: {
          tenantId: tenant.id,
          OR: [{ origemExterna: lido.referenciaImovel }, { id: lido.referenciaImovel }],
        },
        select: { id: true, title: true },
      });
    }

    /* ── Duplicata ──────────────────────────────────────────────────────────
       Portais reenviam. Ver `JANELA_DUPLICATA_MS` em `captacao.js` para por que
       a janela é de seis horas e não de sempre. */
    const filtro = filtroDeDuplicata({
      tenantId: tenant.id,
      propertyId: property?.id,
      email: lido.email,
      telefone: lido.telefone,
    });
    if (filtro) {
      const jaExiste = await prisma.propertyLead.findFirst({
        where: filtro, select: { id: true }, orderBy: { createdAt: "desc" },
      });
      if (jaExiste) {
        await registrarEvento(fonte, req.body, "DUPLICADO", null, { leadId: jaExiste.id });
        return res.json({ recebido: true, duplicado: true, leadId: jaExiste.id });
      }
    }

    /* ── O LEAD VAI PARA A TABELA QUE JÁ EXISTE ─────────────────────────────
       `PropertyLead`, a mesma da vitrine. NÃO existe uma segunda caixa de
       entrada: duas divergiriam no primeiro mês e a imobiliária passaria a ter
       dois números diferentes para "quantos interessados chegaram ontem".

       `propertyId` é obrigatório no schema (a relação nasceu da vitrine, onde
       sempre há imóvel). Sem imóvel identificado, o lead não pode ser gravado —
       então ele vira negócio direto, sem lead, e o diagnóstico registra. É o
       caso menos comum e o menos ruim: o contato chega ao corretor de qualquer
       jeito. */
    const responsavel = await proximoResponsavel(tenant.id);

    let lead = null;
    if (property) {
      lead = await prisma.propertyLead.create({
        data: {
          tenantId: tenant.id,
          propertyId: property.id,
          name: lido.nome,
          email: lido.email,
          phone: lido.telefone ? normalizarTelefone(lido.telefone) : null,
          message: lido.mensagem,
          source: `flow:${String(fonte.canal).toLowerCase()}`,
          responsavelId: responsavel?.id ?? null,
        },
      });
      if (responsavel) {
        await prisma.leadEvento.create({
          data: {
            tenantId: tenant.id, leadId: lead.id, tipo: "RESPONSAVEL",
            para: responsavel.nome,
            texto: `Distribuído automaticamente para ${responsavel.nome} (captação: ${fonte.nome}).`,
          },
        }).catch(() => {});
      }
    }

    /* ── O negócio ──────────────────────────────────────────────────────────
       Opt-out por fonte (`abrirNegocio`). Nem toda fonte merece um negócio: uma
       campanha de captação de PROPRIETÁRIO encheria o funil de vendas de gente
       que quer anunciar, não comprar. */
    let negocio = null;
    if (fonte.abrirNegocio) {
      negocio = await prisma.negocio.create({
        data: {
          tenantId: tenant.id,
          titulo: tituloDoNegocio({ nome: lido.nome, imovelTitulo: property?.title }),
          propertyId: property?.id ?? null,
          leadId: lead?.id ?? null,
          responsavelId: responsavel?.id ?? null,
          canal: fonte.canal,
          origem: fonte.nome,
          estagio: "LEAD",
          ultimoContatoEm: new Date(),
        },
      });
      await prisma.negocioEvento.create({
        data: {
          tenantId: tenant.id, negocioId: negocio.id, tipo: "CRIADO",
          usuarioNome: null,
          texto:
            `Captado automaticamente por ${fonte.nome} (${fonte.canal})` +
            `${responsavel ? ` e distribuído para ${responsavel.nome}` : " — sem corretor elegível na fila"}.`,
        },
      }).catch(() => {});
    }

    await registrarEvento(fonte, req.body, "ACEITO", null, {
      leadId: lead?.id ?? null, negocioId: negocio?.id ?? null,
    });

    /* Avisa os webhooks de SAÍDA da imobiliária (o CRM dela). Disparado e
       esquecido — um CRM lento não pode atrasar a resposta ao portal, que é
       exatamente o que faria o portal considerar a integração fora do ar. */
    emitir(tenant.id, "lead.criado", {
      leadId: lead?.id ?? null,
      negocioId: negocio?.id ?? null,
      nome: lido.nome, email: lido.email, telefone: lido.telefone,
      canal: fonte.canal, fonte: fonte.nome,
      imovelId: property?.id ?? null,
    });

    return res.json({
      recebido: true,
      leadId: lead?.id ?? null,
      negocioId: negocio?.id ?? null,
      imovelReconhecido: Boolean(property),
    });
  } catch (err) {
    console.error("[captacao] falha ao processar:", err);
    await registrarEvento(fonte, req.body, "ERRO", String(err?.message || err).slice(0, 1000));
    /* Mesmo aqui: 200. O erro é NOSSO, e fazer o portal desativar a integração
       por causa de um defeito nosso multiplicaria o estrago — o lead se perde
       uma vez, a integração desligada perde todos os próximos. O diagnóstico
       registra e a tela mostra em vermelho. */
    return res.json({ recebido: false, motivo: "erro-interno" });
  }
});

/** Sempre grava, e nunca derruba a resposta. O diagnóstico é importante; ele
 *  não é mais importante que o lead. */
async function registrarEvento(fonte, payload, status, erro = null, extra = {}) {
  try {
    await prisma.captacaoEvento.create({
      data: {
        tenantId: fonte.tenantId,
        fonteId: fonte.id,
        /* Corpo não-objeto (texto puro, array) embrulhado: a coluna é Json e
           gravar uma string crua faria o diagnóstico mostrar aspas em volta de
           tudo. */
        payload: payload && typeof payload === "object" ? payload : { bruto: String(payload ?? "") },
        status,
        erro,
        ...extra,
      },
    });
    await prisma.fonteCaptacao.update({
      where: { id: fonte.id },
      data: {
        ultimoEventoEm: new Date(),
        ...(status === "ACEITO"
          ? { totalRecebido: { increment: 1 } }
          : { totalRecusado: { increment: 1 } }),
      },
    });
  } catch (err) {
    console.warn("[captacao] não consegui registrar o evento:", err?.message || err);
  }
}
