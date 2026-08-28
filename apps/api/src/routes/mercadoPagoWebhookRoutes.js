import { Router } from "express";
import {
  lerWebhook,
  consultarCobranca,
  aplicarCobrancaAprovada,
  webhookMercadoPagoConfigurado,
} from "../services/pagamentoMercadoPago.js";

/**
 * ─── Webhook do Mercado Pago ─────────────────────────────────────────────────
 * É ele que libera o plano depois de um Pix compensar. A rota que cria a
 * cobrança devolve só o QR — quem paga está no app do banco, e a confirmação
 * chega aqui segundos ou minutos depois.
 *
 * Montado ANTES do express.json() e com corpo cru, como o do Stripe e o do
 * Meta: a assinatura é calculada sobre os bytes exatos que chegaram.
 *
 * ── O CORPO NÃO É PROVA DE NADA ──
 * Ele traz um id. O estado do dinheiro vem de um GET nosso ao provedor, e essa
 * é a única leitura em que confiamos. Sem isso, esta URL pública viraria um
 * botão de "ativar plano de graça" para quem descobrisse o endereço.
 */

export const mercadoPagoWebhookRouter = Router();

mercadoPagoWebhookRouter.post("/", async (req, res) => {
  const bruto = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body || "");

  let corpo = null;
  try {
    corpo = bruto ? JSON.parse(bruto) : null;
  } catch {
    return res.status(400).json({ error: "Corpo inválido." });
  }

  /* Sem segredo configurado NÃO se processa nada. A tentação é aceitar "só em
     desenvolvimento" — e é assim que um ambiente sobe em produção sem a
     variável e com a porta aberta. Em desenvolvimento o caminho de verdade é
     outro: a tela consulta o pagamento enquanto espera, e a ativação acontece
     por lá (ver `aplicarCobrancaAprovada`). */
  if (!webhookMercadoPagoConfigurado()) {
    console.warn("[mercadopago] webhook recebido sem MERCADOPAGO_WEBHOOK_SECRET — descartado.");
    return res.status(503).json({ error: "Webhook não configurado." });
  }

  let aviso;
  try {
    aviso = lerWebhook({
      corpo,
      assinatura: req.get("x-signature"),
      requestId: req.get("x-request-id"),
      /* O id que eles ASSINAM é o da query (`?data.id=…`), não o do corpo.
         Quando a query não vem, `lerWebhook` cai no corpo — que é o que
         acontece nos avisos de teste do painel deles. */
      idDaQuery: req.query?.["data.id"],
    });
  } catch (erro) {
    console.warn(`[mercadopago] aviso recusado: ${erro.message}`);
    return res.status(400).json({ error: "Assinatura inválida." });
  }

  /* 200 imediato. Demorar faz o provedor reenviar, e o mesmo aviso chega
     várias vezes — o que é seguro (a aplicação é idempotente pelo id da
     cobrança), mas enche o log de trabalho repetido. */
  res.json({ recebido: true });

  try {
    /* Só pagamento. Eles mandam avisos de outros assuntos na mesma URL
       (`merchant_order`, entre outros), e cada um com uma forma diferente. */
    if (aviso.tipo !== "payment" || !aviso.id) return;

    const cobranca = await consultarCobranca(aviso.id);
    if (cobranca.status !== "aprovado") {
      console.log(`[mercadopago] pagamento ${aviso.id} está ${cobranca.statusBruto} — nada a fazer ainda.`);
      return;
    }

    const r = await aplicarCobrancaAprovada(cobranca);
    /* Pagamento aprovado que não ativou ninguém precisa deixar rastro. Foi o
       silêncio nesse ponto que, no webhook do Stripe, fez um cliente pagar e
       continuar bloqueado sem ninguém entender por quê. */
    if (!r.aplicado && r.motivo !== "JA_APLICADO") {
      console.error(
        `[mercadopago] pagamento ${aviso.id} APROVADO mas não ativou nada (${r.motivo}). ` +
          `Confira se a cobrança foi criada com external_reference do tenant.`,
      );
    }
  } catch (erro) {
    // A resposta já saiu; aqui só registramos. O provedor reenvia por conta
    // própria, e a aplicação é idempotente.
    console.error(`[mercadopago] falha ao tratar o aviso ${aviso.id}:`, erro.message);
  }
});
