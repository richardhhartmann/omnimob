import crypto from "crypto";
import { Router } from "express";
import { prisma } from "../db.js";

/**
 * ─── Webhook do Stripe ───────────────────────────────────────────────────────
 * É ELE que mantém `statusPagamento` em dia, não a chamada que cria a
 * assinatura. Renovação mensal, cartão que falha no terceiro mês, cancelamento
 * pelo próprio cliente no portal — nada disso passa pela nossa API; chega aqui.
 *
 * Montado ANTES do express.json() e com corpo cru, porque a assinatura é
 * calculada sobre os bytes exatos que o Stripe enviou — mesmo motivo do webhook
 * do Meta, que já usa esse arranjo.
 */

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const TOLERANCIA_S = 300; // 5 min: evita reenvio de evento capturado (replay)

export const stripeWebhookRouter = Router();

/* Assinatura no formato `t=<timestamp>,v1=<hmac>`. Comparação em tempo
   constante: comparar com === vaza informação pelo tempo de resposta e permite
   descobrir a assinatura byte a byte. */
function assinaturaValida(bruto, cabecalho) {
  if (!WEBHOOK_SECRET || !cabecalho) return false;

  const partes = Object.fromEntries(
    String(cabecalho)
      .split(",")
      .map((p) => p.split("=").map((x) => x.trim())),
  );
  const timestamp = partes.t;
  const recebida = partes.v1;
  if (!timestamp || !recebida) return false;

  const idade = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(idade) || idade > TOLERANCIA_S) return false;

  const esperada = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(`${timestamp}.${bruto}`, "utf8")
    .digest("hex");

  const a = Buffer.from(esperada, "utf8");
  const b = Buffer.from(recebida, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* O vínculo com o tenant viaja em metadata — ver pagamentoService.js.
   Procuramos em vários lugares porque a forma da fatura mudou entre versões da
   API: `invoice.subscription_details` passou a viver dentro de `invoice.parent`.
   Como a versão é escolhida no painel, no cadastro do destino de eventos, o
   código não controla qual chega — então aceita as duas.

   Cada caminho, de onde vem:
     metadata                              assinatura (customer.subscription.*)
     parent.subscription_details.metadata  fatura, API nova
     subscription_details.metadata         fatura, API antiga
     lines.data[].metadata                 item da fatura, último recurso */
function tenantIdDoEvento(objeto) {
  const daLinha = (objeto?.lines?.data || [])
    .map((l) => l?.metadata?.tenantId || l?.parent?.subscription_item_details?.metadata?.tenantId)
    .find(Boolean);

  return (
    objeto?.metadata?.tenantId ||
    objeto?.parent?.subscription_details?.metadata?.tenantId ||
    objeto?.subscription_details?.metadata?.tenantId ||
    daLinha ||
    null
  );
}

/* Fim do período coberto pela fatura, para gravar o próximo vencimento. Mesma
   história da metadata: o período migrou para dentro de `parent` na API nova. */
function fimDoPeriodo(objeto) {
  const linha = objeto?.lines?.data?.[0];
  return linha?.period?.end || objeto?.period_end || null;
}

stripeWebhookRouter.post("/", async (req, res) => {
  const bruto = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body || "");

  if (!assinaturaValida(bruto, req.get("stripe-signature"))) {
    console.warn("[stripe] assinatura inválida — evento descartado.");
    return res.status(400).json({ error: "Assinatura inválida." });
  }

  let evento;
  try {
    evento = JSON.parse(bruto);
  } catch {
    return res.status(400).json({ error: "Corpo inválido." });
  }

  /* Responder 200 rápido é regra do Stripe: demorar faz ele reenviar, e o
     mesmo evento chega duas vezes. Por isso o processamento vem depois da
     resposta e cada tratamento é idempotente (só escreve estado final). */
  res.json({ received: true });

  try {
    const objeto = evento.data?.object || {};
    const tenantId = tenantIdDoEvento(objeto);

    /* Sem tenant não há o que atualizar, e cada `case` abaixo simplesmente sai.
       Silenciar isso já custou caro em outros pontos deste projeto: o evento
       chega, é descartado, e do lado de fora parece que o Stripe nunca avisou.
       Um pagamento aprovado que não ativa a assinatura precisa deixar rastro. */
    if (!tenantId && evento.type !== "ping") {
      console.error(
        `[stripe] evento ${evento.type} (${evento.id}) sem tenantId em metadata — ` +
          `NADA foi atualizado. Confira se a assinatura foi criada com metadata.tenantId ` +
          `e se a versão da API do destino de eventos mudou a forma do objeto.`,
      );
    }

    switch (evento.type) {
      // Fatura paga: mensalidade em dia e próxima cobrança registrada.
      case "invoice.paid": {
        if (!tenantId) break;
        const fim = fimDoPeriodo(objeto);
        await prisma.tenant.update({
          where: { id: tenantId },
          data: {
            statusPagamento: "EM_DIA",
            ativo: true,
            ...(fim ? { proximoVencimento: new Date(fim * 1000) } : {}),
          },
        });
        console.log(`[stripe] fatura paga — tenant ${tenantId} em dia.`);
        break;
      }

      // Cartão recusou. O Stripe ainda vai retentar por conta própria, então
      // aqui só marcamos ATRASADO — não desativamos o ambiente.
      case "invoice.payment_failed": {
        if (!tenantId) break;
        await prisma.tenant.update({
          where: { id: tenantId },
          data: { statusPagamento: "ATRASADO" },
        });
        console.warn(`[stripe] pagamento falhou — tenant ${tenantId} atrasado.`);
        break;
      }

      // Assinatura encerrada (cancelamento ou fim das retentativas).
      case "customer.subscription.deleted": {
        if (!tenantId) break;
        await prisma.tenant.update({
          where: { id: tenantId },
          data: { statusPagamento: "CANCELADO" },
        });
        console.warn(`[stripe] assinatura cancelada — tenant ${tenantId}.`);
        break;
      }

      default:
        break;
    }
  } catch (erro) {
    // A resposta já saiu; aqui só registramos. Se virar rotina, vale uma fila
    // com retentativa própria em vez de depender do reenvio do Stripe.
    console.error(`[stripe] falha ao tratar ${evento.type}:`, erro.message);
  }
});
