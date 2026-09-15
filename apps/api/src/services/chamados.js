import { prisma } from "../db.js";
import { emailRespostaChamado } from "./emailTemplates.js";
import { sendEmail } from "./notificationService.js";

/* ────────────────────────────────────────────────────────────────────────────
   A conversa de um chamado — regra única para os DOIS lados.

   O cliente escreve por `chamadoRoutes`, o suporte por `adminRoutes`, e os dois
   mexem no mesmo status e no mesmo fio. Duas cópias da régua divergiriam na
   primeira transição nova — e o sintoma seria um chamado que o cliente vê como
   "aguardando você" enquanto o suporte o vê como "em atendimento".

   ── A RÉGUA ──

     cliente abre .................... ABERTO
     suporte responde ................ AGUARDANDO_CLIENTE
     cliente responde ................ EM_ATENDIMENTO (a bola volta ao suporte)
     suporte resolve ................. RESOLVIDO  + anotação "Resolvido por …"
     cliente (ou suporte) reabre ..... ABERTO     + anotação "Reaberto por …"
     cliente responde a um resolvido . reabre (é o que ele quis dizer)

   `resolvido` continua sendo gravado, DERIVADO do status, porque a coluna
   ainda é lida em vários lugares (badge do menu, filtros, ordenação da fila).

   ── O E-MAIL ──

   Sai UMA vez por resposta do suporte, para quem abriu o chamado (ou para o
   e-mail da imobiliária, se a pessoa não tiver um). Anotação de sistema não
   avisa ninguém: "resolvido" chega junto da última resposta, e um segundo
   e-mail dizendo só isso é o que faz alguém filtrar a Omnimob como spam.
   ──────────────────────────────────────────────────────────────────────────── */

export const STATUS_CHAMADO = ["ABERTO", "EM_ATENDIMENTO", "AGUARDANDO_CLIENTE", "RESOLVIDO"];

export function serializarMensagem(m) {
  return {
    id: m.id,
    autorTipo: m.autorTipo,
    autorNome: m.autorNome,
    texto: m.texto,
    prints: m.prints || [],
    criadoEm: m.criadoEm,
  };
}

/** Os campos que os dois lados mostram. Cada rota acrescenta os seus. */
export function serializarChamado(c) {
  return {
    numero: c.numero,
    titulo: c.titulo,
    descricao: c.descricao,
    categoria: c.categoria,
    prioridade: c.prioridade,
    status: c.status,
    resolvido: c.resolvido,
    resolvidoEm: c.resolvidoEm,
    prints: c.prints,
    rota: c.rota,
    criadoEm: c.criadoEm,
    atualizadoEm: c.atualizadoEm,
    usuario: c.usuarioNome || "—",
    /* Quantas falas há — a lista mostra isso sem carregar a conversa. Quem
       carrega a conversa (`include: { mensagens }`) recebe `conversa` junto. */
    mensagens: c._count?.mensagens ?? (Array.isArray(c.mensagens) ? c.mensagens.length : 0),
    ...(Array.isArray(c.mensagens) ? { conversa: c.mensagens.map(serializarMensagem) } : {}),
  };
}

/** O `include` de quem quer a conversa inteira, na ordem em que aconteceu. */
export const COM_CONVERSA = { mensagens: { orderBy: { criadoEm: "asc" } } };
/** O `include` da listagem: só a contagem. */
export const COM_CONTAGEM = { _count: { select: { mensagens: true } } };

/* Os campos derivados do status, gravados juntos em toda transição. */
function dadosDoStatus(status, atual) {
  const resolvido = status === "RESOLVIDO";
  return {
    status,
    resolvido,
    /* A data de resolução é do SERVIDOR e só muda ao resolver: reabrir a
       limpa, resolver de novo a regrava. */
    resolvidoEm: resolvido ? (atual?.resolvido ? atual.resolvidoEm : new Date()) : null,
  };
}

async function anotar(chamado, texto) {
  return prisma.chamadoMensagem.create({
    data: {
      tenantId: chamado.tenantId,
      chamadoNumero: chamado.numero,
      autorTipo: "SISTEMA",
      autorNome: "Sistema",
      texto,
    },
  });
}

/**
 * Muda o status pela mão de alguém (suporte resolvendo/reabrindo, cliente
 * reabrindo). Resolver e reabrir deixam anotação; as outras paradas, não —
 * "em atendimento" não é um fato que o cliente precise ler numa linha.
 */
export async function mudarStatus(chamado, status, { autorNome }) {
  if (!STATUS_CHAMADO.includes(status)) throw new Error("Status inválido.");
  if (chamado.status === status) return chamado;

  const atualizado = await prisma.chamado.update({
    where: { numero: chamado.numero },
    data: dadosDoStatus(status, chamado),
  });
  if (status === "RESOLVIDO") await anotar(chamado, `Resolvido por ${autorNome}.`);
  else if (chamado.status === "RESOLVIDO") await anotar(chamado, `Reaberto por ${autorNome}.`);
  return atualizado;
}

/** A resposta do suporte: mensagem, bola para o cliente, e o e-mail. */
export async function responderComoSuporte(chamado, { texto, autorNome }) {
  const mensagem = await prisma.chamadoMensagem.create({
    data: {
      tenantId: chamado.tenantId,
      chamadoNumero: chamado.numero,
      autorTipo: "SUPORTE",
      autorNome,
      texto,
    },
  });
  /* Responder um chamado resolvido não o reabre: é o suporte completando uma
     informação depois de fechar. Só o cliente reabre, ao responder ou ao
     clicar em reabrir. */
  const proximo = chamado.status === "RESOLVIDO" ? "RESOLVIDO" : "AGUARDANDO_CLIENTE";
  const atualizado =
    proximo === chamado.status
      ? chamado
      : await prisma.chamado.update({ where: { numero: chamado.numero }, data: dadosDoStatus(proximo, chamado) });

  avisarCliente(chamado, mensagem).catch((e) =>
    console.error(`[chamados] falha ao avisar o cliente do #${chamado.numero}:`, e.message),
  );
  return { mensagem, chamado: atualizado };
}

/** A resposta do cliente: mensagem, e a bola volta para o suporte. */
export async function responderComoCliente(chamado, { texto, prints = [], autorNome }) {
  const mensagem = await prisma.chamadoMensagem.create({
    data: {
      tenantId: chamado.tenantId,
      chamadoNumero: chamado.numero,
      autorTipo: "CLIENTE",
      autorNome,
      texto,
      prints,
    },
  });

  let atualizado = chamado;
  if (chamado.status === "RESOLVIDO") {
    // Escrever num chamado fechado é reabri-lo — e fica dito na conversa.
    atualizado = await mudarStatus(chamado, "ABERTO", { autorNome });
  } else if (chamado.status === "AGUARDANDO_CLIENTE") {
    atualizado = await prisma.chamado.update({
      where: { numero: chamado.numero },
      data: dadosDoStatus("EM_ATENDIMENTO", chamado),
    });
  }
  return { mensagem, chamado: atualizado };
}

/* Para quem vai o aviso: quem abriu, se ainda tiver e-mail; senão, a
   imobiliária. O nome de quem abriu foi copiado para o chamado, mas o e-mail
   não — é lido na hora, porque a pessoa pode ter trocado. */
async function avisarCliente(chamado, mensagem) {
  const [usuario, tenant] = await Promise.all([
    chamado.usuarioId
      ? prisma.usuario.findFirst({ where: { id: chamado.usuarioId, tenantId: chamado.tenantId, ativo: true }, select: { nome: true, email: true } })
      : null,
    prisma.tenant.findUnique({ where: { id: chamado.tenantId }, select: { name: true, email: true } }),
  ]);
  const para = usuario?.email || tenant?.email;
  if (!para) {
    console.warn(`[chamados] #${chamado.numero} sem e-mail para avisar (nem quem abriu, nem a imobiliária).`);
    return;
  }

  const base = (process.env.APP_URL || "").trim().replace(/\/+$/, "") || "https://omnimob.app";
  const modelo = emailRespostaChamado({
    nome: usuario?.nome || tenant?.name || "",
    imobiliaria: tenant?.name || "",
    numero: chamado.numero,
    titulo: chamado.titulo,
    autor: mensagem.autorNome,
    texto: mensagem.texto,
    link: `${base}/suporte/${chamado.numero}`,
  });
  await sendEmail({ to: para, subject: modelo.subject, body: modelo.body, html: modelo.html });
}
