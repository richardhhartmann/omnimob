import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermissao } from "../middlewares/permissaoMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { requirePlano } from "../middlewares/planoMiddleware.js";
import { EVENTOS, eventosValidos, gerarSegredo, testar } from "../services/webhooks.js";

/* ────────────────────────────────────────────────────────────────────────────
   Gerência dos webhooks, pelo painel.

   Mesma permissão das chaves de API (`verConfiguracoes`) e mesmo degrau de
   plano (Profissional+): um webhook entrega dados de lead — nome, telefone,
   mensagem — para fora, e é a mesma decisão que criar uma chave de leitura.

   ── O SEGREDO SAI NA RESPOSTA, E CONTINUA SAINDO ──

   Ao contrário da chave de API, aqui o segredo NÃO é hash. Ele é uma chave
   compartilhada: quem recebe precisa dele para recalcular o HMAC e conferir a
   assinatura, e um segredo que só nós conhecemos não valida nada. É o mesmo
   arranjo do Stripe e do Meta, e por isso ele fica visível na tela — a pessoa
   volta lá para copiá-lo quando for configurar o outro lado.
   ──────────────────────────────────────────────────────────────────────────── */

export const webhookRouter = Router();
webhookRouter.use(requireAuth);
webhookRouter.use(requireTenant);
webhookRouter.use(requirePermissao("verConfiguracoes"));
webhookRouter.use(requirePlano(1, "Profissional"));

webhookRouter.get("/eventos", (_req, res) => res.json({ eventos: EVENTOS }));

webhookRouter.get("/", async (req, res) => {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: { tenantId: req.tenant.id },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ webhooks });
  } catch (erro) {
    console.error("[webhooks] listar:", erro);
    return res.status(500).json({ error: "Erro ao listar os webhooks." });
  }
});

webhookRouter.post("/", async (req, res) => {
  try {
    const url = String(req.body?.url || "").trim();
    /* HTTPS obrigatório. O corpo carrega nome, telefone e mensagem de um lead —
       dado pessoal de terceiro, de quem preencheu o formulário e não escolheu
       nada disso. Entregar em texto claro seria uma decisão do cliente sobre a
       privacidade de outra pessoa. */
    if (!/^https:\/\//i.test(url)) {
      return res.status(400).json({ error: "O endereço precisa começar com https:// — o aviso carrega dados de contato." });
    }

    const eventos = eventosValidos(req.body?.eventos);
    if (!eventos.length) {
      return res.status(400).json({ error: "Escolha ao menos um evento para receber." });
    }

    const webhook = await prisma.webhook.create({
      data: {
        tenantId: req.tenant.id,
        url,
        eventos,
        segredo: gerarSegredo(),
        criadoPor: req.authUserNome || null,
      },
    });
    return res.status(201).json({ webhook });
  } catch (erro) {
    console.error("[webhooks] criar:", erro);
    return res.status(500).json({ error: "Erro ao criar o webhook." });
  }
});

webhookRouter.put("/:id", async (req, res) => {
  try {
    const atual = await prisma.webhook.findFirst({ where: { id: req.params.id, tenantId: req.tenant.id } });
    if (!atual) return res.status(404).json({ error: "Webhook não encontrado." });

    const data = {};
    if (req.body?.eventos !== undefined) {
      const eventos = eventosValidos(req.body.eventos);
      if (!eventos.length) return res.status(400).json({ error: "Escolha ao menos um evento." });
      data.eventos = eventos;
    }
    if (req.body?.ativo !== undefined) {
      data.ativo = Boolean(req.body.ativo);
      /* Religar zera o contador de falhas. Sem isso, um webhook desarmado por
         dez falhas voltaria com o contador cheio e se desarmaria de novo na
         primeira falha isolada, depois de o endereço já ter sido consertado. */
      if (data.ativo) { data.falhasSeguidas = 0; data.ultimaFalha = null; }
    }

    const webhook = await prisma.webhook.update({ where: { id: atual.id }, data });
    return res.json({ webhook });
  } catch (erro) {
    console.error("[webhooks] editar:", erro);
    return res.status(500).json({ error: "Erro ao atualizar o webhook." });
  }
});

webhookRouter.delete("/:id", async (req, res) => {
  try {
    const atual = await prisma.webhook.findFirst({ where: { id: req.params.id, tenantId: req.tenant.id } });
    if (!atual) return res.status(404).json({ error: "Webhook não encontrado." });
    await prisma.webhook.delete({ where: { id: atual.id } });
    return res.json({ ok: true });
  } catch (erro) {
    console.error("[webhooks] remover:", erro);
    return res.status(500).json({ error: "Erro ao remover o webhook." });
  }
});

/* Uma entrega de teste, com corpo de exemplo. É o que responde "configurei
   certo?" sem a pessoa ter de esperar um lead de verdade aparecer — e sem
   inventar um lead falso no banco para descobrir. */
webhookRouter.post("/:id/testar", async (req, res) => {
  try {
    const webhook = await prisma.webhook.findFirst({ where: { id: req.params.id, tenantId: req.tenant.id } });
    if (!webhook) return res.status(404).json({ error: "Webhook não encontrado." });
    return res.json(await testar(webhook));
  } catch (erro) {
    console.error("[webhooks] testar:", erro);
    return res.status(500).json({ error: "Erro ao testar o webhook." });
  }
});
