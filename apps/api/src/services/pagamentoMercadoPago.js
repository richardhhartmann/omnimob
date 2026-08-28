import crypto from "crypto";
import { getGlobalPrisma } from "./tenantRegistry.js";
import { fidelizarTrial } from "./trialService.js";
import {
  valorDoPlano,
  normalizarPeriodo,
  normalizarPacote,
  modulosDoPacote,
} from "./pagamentoService.js";
import { planoInfo } from "../middlewares/planoMiddleware.js";

/* ─── Mercado Pago: a COBRANÇA ÚNICA ─────────────────────────────────────────

   Este arquivo não substitui o `pagamentoService.js`. Ele existe ao lado dele,
   e a divisão é de natureza, não de fornecedor:

     Stripe          assinatura recorrente, boleto recorrente e o proporcional
                     de quem troca de plano no meio do ciclo
     Mercado Pago    uma cobrança, uma vez, paga por Pix — e, na fase seguinte,
                     por cartão parcelado

   Foi por isso que a Fase 1 nasceu: em conta brasileira o Stripe faz Pix
   AVULSO, mas não faz Pix Automático (o comentário longo em
   `pagamentoService.js` conta a história), e não faz parcelado de jeito nenhum.
   Quem quer pagar o ano inteiro no Pix não tinha por onde.

   ── DUAS COISAS QUE ESTE ARQUIVO NÃO FAZ ──

   1. Não inventa preço. O valor vem de `valorDoPlano`, que lê o catálogo do
      STRIPE. O Mercado Pago recebe um número já decidido. Uma segunda tabela de
      preços seria a primeira coisa a envelhecer em silêncio.

   2. Não cria assinatura. Pagamento único não renova — quem paga em agosto tem
      `proximoVencimento` em agosto do ano seguinte e precisa ser avisado antes.
      Chamar isto de "assinatura" na tela seria prometer uma renovação que não
      existe.

   ⚠ ESCRITO CONTRA A DOCUMENTAÇÃO, NÃO VERIFICADO CONTRA A API REAL — mesma
   situação de `mercadoLivre.js` e de `flow/assinatura.js`. Publicar de verdade
   exige aplicação aprovada e conta de vendedor; os pontos duvidosos estão
   marcados com REVISAR.
   ────────────────────────────────────────────────────────────────────────── */

const API = "https://api.mercadopago.com";
const TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN || "";
const SEGREDO_WEBHOOK = process.env.MERCADOPAGO_WEBHOOK_SECRET || "";
const URL_NOTIFICACAO = process.env.MERCADOPAGO_WEBHOOK_URL || "";

/* Quanto tempo o QR fica de pé. Trinta minutos é o hábito do mercado: tempo de
   abrir o app do banco, e curto o bastante para o cliente que desistiu não
   voltar amanhã e pagar um valor que já mudou de preço. */
const MINUTOS_DE_VALIDADE = 30;

/* O Pix só é oferecido no ANUAL, e não é limitação técnica.

   Cobrança única no mensal significaria a pessoa lembrar de pagar todo mês, e a
   conta caindo no dia em que ela esquecer. O mensal tem assinatura de verdade
   no cartão; o anual é onde o pagamento único faz sentido — uma vez por ano,
   com o valor cheio na frente. */
export const PERIODO_DO_PIX = "anual";

export function mercadoPagoConfigurado() {
  return Boolean(TOKEN);
}

/** O provedor consegue CONFERIR o que recebeu? Sem segredo de webhook, não. */
export function webhookMercadoPagoConfigurado() {
  return Boolean(SEGREDO_WEBHOOK);
}

/* ── A conversa com o provedor ──────────────────────────────────────────────

   `fetch` cru, como o `stripe()` do outro arquivo e o `mercadoLivre.js`. O SDK
   oficial resolveria a mesma coisa e traria uma dependência que precisa
   acompanhar versão de API — e são cinco chamadas ao todo.

   `X-Idempotency-Key` NÃO é opcional aqui: sem ela, dois cliques no botão criam
   duas cobranças de mil e quatrocentos reais, e a segunda é uma devolução para
   alguém fazer na mão. */
async function mp(caminho, { method = "POST", dados, idempotencia } = {}) {
  if (!mercadoPagoConfigurado()) {
    const err = new Error("O Mercado Pago não está conectado nesta instalação.");
    err.code = "PROVEDOR_NAO_CONFIGURADO";
    throw err;
  }

  const resposta = await fetch(`${API}${caminho}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(idempotencia ? { "X-Idempotency-Key": idempotencia } : {}),
    },
    body: dados ? JSON.stringify(dados) : undefined,
  });

  const texto = await resposta.text();
  let corpo = null;
  try {
    corpo = texto ? JSON.parse(texto) : null;
  } catch {
    corpo = null;
  }

  if (!resposta.ok) {
    /* A mensagem útil do Mercado Pago mora em `message`, e o detalhe do que
       exatamente ele recusou em `cause[].description` — que é o campo que diz
       "payer.email inválido" em vez de "Bad Request". */
    const detalhe = (corpo?.cause || []).map((c) => c.description).filter(Boolean).join("; ");
    const err = new Error(
      [corpo?.message || `Mercado Pago respondeu ${resposta.status}.`, detalhe].filter(Boolean).join(" — "),
    );
    err.code = "PROVEDOR_FALHOU";
    err.status = resposta.status;
    throw err;
  }

  return corpo;
}

/* ── O corpo da cobrança ────────────────────────────────────────────────────

   Função separada e PURA porque é ela que o teste consegue conferir sem rede.
   O risco aqui é o mesmo de `formatosImportacao.js`: não é vazamento, é
   TRADUÇÃO — um campo no lugar errado cobra o valor errado, ou cobra certo e
   ninguém consegue ligar o pagamento ao tenant depois.

   `external_reference` é o elo com a imobiliária, e é ele que o webhook lê. Vai
   junto de `metadata` porque os dois sobrevivem a coisas diferentes: a
   referência aparece no extrato e nas telas do Mercado Pago (é o que um humano
   procura), e a metadata carrega o resto do contexto (plano, período, pacote)
   sem o qual a ativação não saberia o que entregar. */
export function corpoDaCobrancaPix({ tenant, plano, periodo, pacote, valor, agora = new Date() }) {
  const periodoEscolhido = normalizarPeriodo(periodo);
  const pacoteEscolhido = normalizarPacote(pacote);
  const nome = planoInfo(plano)?.nome || plano;

  return {
    transaction_amount: Number(valor),
    /* O que a pessoa vê no app do banco na hora de confirmar. Diz o produto, o
       plano e o prazo — "OMNIMOB" sozinho, meses depois, no extrato, não
       responde por que aquele valor saiu. */
    description: `Omnimob ${nome} — ${pacoteEscolhido === "HUB_FLOW" ? "Hub + Flow, " : ""}${
      periodoEscolhido === "anual" ? "12 meses" : "1 mês"
    }`,
    payment_method_id: "pix",
    payer: {
      email: tenant.email || undefined,
      first_name: (tenant.name || "").slice(0, 60) || undefined,
      ...documentoDoPagador(tenant.cnpj),
    },
    external_reference: tenant.id,
    date_of_expiration: comFusoExplicito(new Date(agora.getTime() + MINUTOS_DE_VALIDADE * 60000)),
    /* Chaves em minúsculo e sem acento de propósito: o Mercado Pago normaliza
       nomes de metadata para snake_case, e um `tenantId` volta do GET como
       `tenant_id`. Escrever já no formato dele evita a surpresa na leitura. */
    metadata: {
      tenant_id: tenant.id,
      slug: tenant.slug,
      plano,
      periodo: periodoEscolhido,
      pacote: pacoteEscolhido,
    },
    /* Só quando é um endereço público de verdade. Em desenvolvimento o webhook
       não tem como chegar, e mandar `http://localhost` faz o provedor recusar a
       cobrança inteira — o pagamento morreria por causa do aviso. */
    ...(URL_NOTIFICACAO.startsWith("https://") ? { notification_url: URL_NOTIFICACAO } : {}),
  };
}

/* CPF e CNPJ pelo tamanho. O cadastro tem uma coluna só (`cnpj`), e autônomo
   com CRECI põe o CPF nela — recusar por causa disso seria bloquear justamente
   o cliente do plano Básico. Documento ilegível simplesmente não vai: ele é
   recomendado, não obrigatório, e a cobrança nasce do mesmo jeito. */
function documentoDoPagador(bruto) {
  const digitos = String(bruto || "").replace(/\D/g, "");
  if (digitos.length !== 11 && digitos.length !== 14) return {};
  return { identification: { type: digitos.length === 11 ? "CPF" : "CNPJ", number: digitos } };
}

/* O Mercado Pago quer a data com FUSO EXPLÍCITO (`2026-08-27T10:00:00.000-03:00`).
   `toISOString()` termina em "Z", que é ISO 8601 legítimo mas já foi recusado
   por versões da API deles. Trocamos o "Z" por "+00:00", que diz a mesma coisa
   na forma que eles documentam. REVISAR contra a API real. */
function comFusoExplicito(data) {
  return data.toISOString().replace("Z", "+00:00");
}

/* ── Criar a cobrança ───────────────────────────────────────────────────────

   Devolve o QR e o copia-e-cola. NÃO toca no tenant: quem vira a chave é o
   pagamento aprovado, e marcar a conta agora liberaria o plano para quem só
   gerou o código e fechou a aba. É a mesma regra do boleto no Stripe. */
export async function criarCobrancaPix({ tenant, plano, periodo, pacote }) {
  const periodoEscolhido = normalizarPeriodo(periodo);
  const pacoteEscolhido = normalizarPacote(pacote);

  if (periodoEscolhido !== PERIODO_DO_PIX) {
    const err = new Error(
      "O Pix está disponível para o plano anual, pago de uma vez. No mensal a cobrança é automática, no cartão.",
    );
    err.code = "PERIODO_INDISPONIVEL";
    throw err;
  }

  const valor = await valorDoPlano(plano, periodoEscolhido, pacoteEscolhido);
  if (!valor) {
    const err = new Error("A cobrança anual deste plano ainda não está disponível. Fale com o time.");
    err.code = "PERIODO_INDISPONIVEL";
    throw err;
  }

  const corpo = corpoDaCobrancaPix({ tenant, plano, periodo: periodoEscolhido, pacote: pacoteEscolhido, valor });

  const pagamento = await mp("/v1/payments", {
    dados: corpo,
    /* A chave amarra a TENTATIVA, não o pedido: tenant, plano, pacote e a
       janela de validade. Dois cliques seguidos reencontram a mesma cobrança —
       e o mesmo QR, que é o que a pessoa já tem na tela. Meia hora depois, com
       o código vencido, a chave muda e nasce um novo. */
    idempotencia: `pix-${tenant.id}-${plano}-${pacoteEscolhido}-${janelaAtual()}`,
  });

  const dados = pagamento?.point_of_interaction?.transaction_data || {};
  if (!dados.qr_code) {
    const err = new Error("O Mercado Pago não devolveu o código Pix.");
    err.code = "PROVEDOR_FALHOU";
    throw err;
  }

  return {
    cobrancaId: String(pagamento.id),
    status: normalizarStatus(pagamento.status),
    valor: Number(pagamento.transaction_amount || valor),
    /* O copia-e-cola é o que a maioria usa (o celular já está com o app
       aberto); a imagem serve a quem paga de outro aparelho. Os dois vão. */
    qrCode: dados.qr_code,
    qrCodeBase64: dados.qr_code_base64 || null,
    /* Página hospedada pelo provedor, com o mesmo código. É a saída de quem
       está com problema para ler o QR na nossa tela. */
    ticketUrl: dados.ticket_url || null,
    venceEm: pagamento.date_of_expiration ? new Date(pagamento.date_of_expiration) : null,
    periodo: periodoEscolhido,
    plano,
    pacote: pacoteEscolhido,
  };
}

/* A janela de meia hora em que a chave de idempotência vale. Inteiro, para dois
   cliques no mesmo minuto caírem no mesmo balde. */
function janelaAtual() {
  return Math.floor(Date.now() / (MINUTOS_DE_VALIDADE * 60000));
}

/** Os estados do Mercado Pago, reduzidos aos três que a tela sabe desenhar. */
export function normalizarStatus(bruto) {
  switch (String(bruto)) {
    case "approved":
      return "aprovado";
    case "pending":
    case "in_process":
    case "authorized":
    case "in_mediation":
      return "pendente";
    default:
      /* rejected, cancelled, refunded, charged_back — e qualquer estado novo
         que eles inventem. Tratar desconhecido como pendente deixaria a tela
         girando para sempre; como recusado, ela ao menos oferece tentar de
         novo. */
      return "recusado";
  }
}

/** Lê o pagamento no provedor. É a única fonte de verdade sobre o dinheiro. */
export async function consultarCobranca(id) {
  const pagamento = await mp(`/v1/payments/${encodeURIComponent(id)}`, { method: "GET" });
  return {
    cobrancaId: String(pagamento?.id || id),
    status: normalizarStatus(pagamento?.status),
    statusBruto: pagamento?.status || null,
    valor: Number(pagamento?.transaction_amount || 0),
    tenantId: pagamento?.external_reference || pagamento?.metadata?.tenant_id || null,
    plano: pagamento?.metadata?.plano || null,
    periodo: pagamento?.metadata?.periodo || null,
    pacote: pagamento?.metadata?.pacote || null,
    aprovadoEm: pagamento?.date_approved ? new Date(pagamento.date_approved) : null,
  };
}

/* ── O webhook ──────────────────────────────────────────────────────────────

   O corpo que chega NÃO é confiável e nem pretende ser: ele traz um id, e o
   estado do dinheiro vem de um GET nosso. Isso não é excesso de zelo — é o
   desenho do provedor, e é o que impede alguém de mandar
   `{"type":"payment","data":{"id":123}}` para uma URL pública e ganhar um ano
   de plano.

   A assinatura confere que o aviso veio mesmo deles. O manifesto é montado com
   os campos NESTA ordem, com ponto e vírgula no fim de cada um:

       id:<data.id>;request-id:<x-request-id>;ts:<ts>;

   e o `data.id` que entra aqui é o da QUERY STRING (`?data.id=…`), que é o que
   eles assinam — não o do corpo. Quando um dos campos não vem, o segmento dele
   sai inteiro do manifesto.

   Comparação em tempo constante pelo mesmo motivo do webhook do Stripe: `===`
   vaza a resposta pelo tempo e deixa descobrir a assinatura byte a byte. */
const TOLERANCIA_S = 300;

export function lerWebhook({ corpo, assinatura, requestId, idDaQuery, agora = Date.now() }) {
  if (!SEGREDO_WEBHOOK) {
    const err = new Error("MERCADOPAGO_WEBHOOK_SECRET não está definido — aviso descartado.");
    err.code = "WEBHOOK_SEM_SEGREDO";
    throw err;
  }

  const partes = Object.fromEntries(
    String(assinatura || "")
      .split(",")
      .map((p) => p.split("=").map((x) => x.trim()))
      .filter((p) => p.length === 2),
  );
  const ts = partes.ts;
  const recebida = partes.v1;
  if (!ts || !recebida) {
    const err = new Error("Assinatura ausente ou malformada.");
    err.code = "ASSINATURA_INVALIDA";
    throw err;
  }

  const idade = Math.abs(agora / 1000 - Number(ts));
  if (!Number.isFinite(idade) || idade > TOLERANCIA_S) {
    const err = new Error("Aviso fora da janela de tolerância (possível reenvio capturado).");
    err.code = "ASSINATURA_INVALIDA";
    throw err;
  }

  /* Id alfanumérico entra em MINÚSCULO no manifesto — está na documentação
     deles, e é o tipo de detalhe que faz a assinatura nunca bater sem que
     nada no erro diga por quê. */
  const id = String(idDaQuery ?? corpo?.data?.id ?? "").toLowerCase();
  const manifesto =
    (id ? `id:${id};` : "") + (requestId ? `request-id:${requestId};` : "") + `ts:${ts};`;

  const esperada = crypto.createHmac("sha256", SEGREDO_WEBHOOK).update(manifesto, "utf8").digest("hex");
  const a = Buffer.from(esperada, "utf8");
  const b = Buffer.from(String(recebida), "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    const err = new Error("Assinatura não confere.");
    err.code = "ASSINATURA_INVALIDA";
    throw err;
  }

  return {
    tipo: corpo?.type || corpo?.topic || null,
    acao: corpo?.action || null,
    id: String(idDaQuery ?? corpo?.data?.id ?? "") || null,
  };
}

/* ── O que um pagamento aprovado faz na conta ────────────────────────────────

   Uma função só, chamada de DOIS lugares: o webhook (o caminho normal) e a
   consulta que a tela faz enquanto a pessoa espera o QR ser pago. Não é
   redundância — é que o aviso do provedor pode demorar, e em desenvolvimento
   ele nem chega (localhost não recebe webhook). Sem o segundo caminho, a tela
   giraria para sempre numa cobrança já paga.

   Duas chamadas com o mesmo pagamento não podem cobrar duas vezes o calendário,
   e é isso que `cobrancaId` guarda: se a conta já foi ativada por ESTE
   pagamento, não há nada a fazer. Comparação por id, e não uma janela de tempo,
   porque o provedor reenvia o mesmo aviso por horas.

   Devolve `{ aplicado, motivo }` em vez de lançar: nenhum dos dois chamadores
   pode virar erro por causa disto — o webhook precisa responder 200 e a tela
   precisa continuar mostrando o QR. */
export async function aplicarCobrancaAprovada(cobranca) {
  const prisma = getGlobalPrisma();

  if (cobranca.status !== "aprovado") return { aplicado: false, motivo: "NAO_APROVADO" };
  if (!cobranca.tenantId) return { aplicado: false, motivo: "SEM_TENANT" };

  const tenant = await prisma.tenant.findUnique({
    where: { id: cobranca.tenantId },
    select: { id: true, slug: true, cobrancaId: true, proximoVencimento: true },
  });
  if (!tenant) return { aplicado: false, motivo: "TENANT_NAO_ENCONTRADO" };
  if (tenant.cobrancaId === cobranca.cobrancaId) return { aplicado: false, motivo: "JA_APLICADO" };

  /* O prazo conta a partir do vencimento atual quando ele ainda está no futuro:
     quem renova em setembro com o plano válido até outubro não pode perder o
     mês que faltava. Mesma regra da extensão de teste e da ativação manual. */
  const base = new Date(cobranca.aprovadoEm || Date.now());
  const partida = tenant.proximoVencimento && tenant.proximoVencimento > base ? tenant.proximoVencimento : base;
  const meses = cobranca.periodo === "anual" ? 12 : 1;
  const vencimento = new Date(partida);
  const dia = vencimento.getDate();
  vencimento.setMonth(vencimento.getMonth() + meses);
  if (vencimento.getDate() < dia) vencimento.setDate(0);

  const valor = Number(cobranca.valor || 0);
  await fidelizarTrial(tenant.id, {
    ...(cobranca.plano ? { plano: cobranca.plano } : {}),
    /* `valorMensal` é o nome da coluna e o que a tela de planos exibe — no
       anual, o que se grava é a média mensal, não o valor cobrado. */
    ...(valor > 0 ? { valorMensal: Math.round((valor / meses) * 100) / 100 } : {}),
    proximoVencimento: vencimento,
    ...(cobranca.pacote ? { modulos: modulosDoPacote(cobranca.pacote) } : {}),
  });

  /* O carimbo do pagamento que ativou. É ele que torna esta função idempotente,
     e é por onde o suporte responde "que cobrança pagou este ano?". */
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { cobrancaId: cobranca.cobrancaId, cobrancaProvedor: "MERCADO_PAGO" },
  });

  console.log(
    `[mercadopago] pagamento ${cobranca.cobrancaId} aprovado — ${tenant.slug} em dia até ${vencimento
      .toISOString()
      .slice(0, 10)}.`,
  );
  return { aplicado: true, ate: vencimento };
}
