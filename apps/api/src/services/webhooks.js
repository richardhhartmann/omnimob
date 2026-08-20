import crypto from "node:crypto";
import { prisma } from "../db.js";

/* ────────────────────────────────────────────────────────────────────────────
   Webhooks de saída.

   O inverso do feed, e é essa simetria que explica por que os dois existem.

   No feed, o dado é do OUTRO lado e nós vamos buscar quando quisermos. Aqui o
   EVENTO é nosso — um lead acabou de chegar pela vitrine — e quem precisa saber
   está lá fora. Sem webhook, o CRM do cliente só descobre perguntando de
   tempos em tempos, e recebendo "nada" na quase totalidade das vezes. Para um
   lead, essa espera é o produto: o número que mais separa imobiliária que
   converte de imobiliária que não converte é o tempo até a primeira resposta.

   ── ENTREGA ──

   Disparado e esquecido, de propósito. A requisição que criou o lead NÃO espera
   o webhook: um CRM lento faria o formulário da vitrine demorar, e um CRM fora
   do ar faria ele falhar — para um visitante que não tem nada a ver com isso.
   O lead já está gravado; o aviso é consequência, não condição.

   ── ASSINATURA ──

   HMAC-SHA256 do corpo, com o segredo do webhook, no cabeçalho
   `X-Omnimob-Assinatura`. A URL não é credencial, é endereço: sem assinatura,
   qualquer um que a descubra pode inventar leads no CRM do cliente. Quem recebe
   confere recalculando o mesmo HMAC.

   O carimbo de tempo entra no que é assinado (`X-Omnimob-Timestamp`) para o
   outro lado poder recusar uma entrega antiga reenviada por terceiros.

   ── DESARME AUTOMÁTICO ──

   Endereço que morreu e ninguém removeu custa uma tentativa perdida por evento,
   para sempre. Depois de falhas seguidas o webhook se desativa e a tela mostra
   por quê. Zera na primeira entrega boa.
   ──────────────────────────────────────────────────────────────────────────── */

/** Os eventos que existem. A tela lê daqui — segunda lista desencontra. */
export const EVENTOS = [
  { id: "lead.criado", rotulo: "Lead recebido", desc: "Alguém deixou contato na vitrine." },
  { id: "imovel.criado", rotulo: "Imóvel cadastrado", desc: "Um imóvel novo entrou no acervo." },
  { id: "imovel.atualizado", rotulo: "Imóvel alterado", desc: "Preço, status ou dados de um imóvel mudaram." },
];

const EVENTOS_VALIDOS = new Set(EVENTOS.map((e) => e.id));

export function eventosValidos(lista) {
  if (!Array.isArray(lista)) return [];
  return [...new Set(lista.filter((e) => EVENTOS_VALIDOS.has(e)))];
}

/** Segredo de assinatura. Mostrado à tela — quem recebe precisa dele para
    conferir, então não é hash: é uma chave compartilhada, como as do Stripe. */
export function gerarSegredo() {
  return `whsec_${crypto.randomBytes(24).toString("base64url")}`;
}

const TEMPO_LIMITE_MS = 10_000;
const FALHAS_ATE_DESARMAR = 10;

function assinar(segredo, timestamp, corpo) {
  return crypto.createHmac("sha256", segredo).update(`${timestamp}.${corpo}`, "utf8").digest("hex");
}

async function entregar(webhook, evento, dados) {
  const timestamp = Date.now();
  const corpo = JSON.stringify({ evento, em: new Date(timestamp).toISOString(), dados });
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);

  try {
    const resposta = await fetch(webhook.url, {
      method: "POST",
      signal: controle.signal,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Omnimob-Webhook/1.0",
        "X-Omnimob-Evento": evento,
        "X-Omnimob-Timestamp": String(timestamp),
        "X-Omnimob-Assinatura": assinar(webhook.segredo, timestamp, corpo),
      },
      body: corpo,
    });
    if (!resposta.ok) throw new Error(`respondeu ${resposta.status}`);

    await prisma.webhook.update({
      where: { id: webhook.id },
      data: { ultimoEnvio: new Date(), falhasSeguidas: 0, ultimaFalha: null },
    });
  } catch (erro) {
    const falhas = webhook.falhasSeguidas + 1;
    await prisma.webhook
      .update({
        where: { id: webhook.id },
        data: {
          falhasSeguidas: falhas,
          ultimaFalha: String(erro.message || erro).slice(0, 200),
          /* Desarma, não apaga. A linha continua na tela com o motivo, e a
             pessoa religa depois de consertar o endereço — apagar faria o
             webhook sumir sem explicação e o cliente abrir um chamado
             perguntando por que parou de receber. */
          ...(falhas >= FALHAS_ATE_DESARMAR ? { ativo: false } : {}),
        },
      })
      .catch(() => {});
  } finally {
    clearTimeout(relogio);
  }
}

/**
 * Avisa quem estiver ouvindo. NÃO é esperado por quem chama.
 *
 * @param {string} tenantId
 * @param {string} evento  um dos `EVENTOS`
 * @param {object} dados   o corpo do aviso, já sem campo sensível
 */
export function emitir(tenantId, evento, dados) {
  if (!tenantId || !EVENTOS_VALIDOS.has(evento)) return;

  /* O `void` é literal: quem chama segue em frente na mesma linha. Um `await`
     aqui faria o formulário da vitrine esperar o CRM do cliente responder. */
  void (async () => {
    try {
      const alvos = await prisma.webhook.findMany({
        where: { tenantId, ativo: true, eventos: { has: evento } },
      });
      // Em paralelo: um endereço lento não deve atrasar o aviso aos outros.
      await Promise.all(alvos.map((w) => entregar(w, evento, dados)));
    } catch (erro) {
      console.warn(`[webhook] falha ao emitir ${evento}: ${erro.message}`);
    }
  })();
}

/** Uma entrega de teste, esperada por quem chama — a tela mostra o resultado. */
export async function testar(webhook) {
  const antes = webhook.falhasSeguidas;
  await entregar(webhook, "lead.criado", {
    teste: true,
    lead: { id: "exemplo", nome: "Lead de teste", email: "teste@exemplo.com", telefone: "11999999999" },
  });
  const depois = await prisma.webhook.findUnique({ where: { id: webhook.id } });
  return {
    ok: depois.falhasSeguidas <= antes,
    ultimaFalha: depois.ultimaFalha,
    ultimoEnvio: depois.ultimoEnvio,
  };
}
