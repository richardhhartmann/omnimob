import { prisma } from "../db.js";
import { emailChamadoInterno, emailRespostaChamado } from "./emailTemplates.js";
import { emailDoUsuario, sendEmail } from "./notificationService.js";

/* ────────────────────────────────────────────────────────────────────────────
   A conversa de um chamado — regra única para os DOIS lados.

   O cliente escreve por `chamadoRoutes`, o suporte por `adminRoutes`, e os dois
   mexem no mesmo status e no mesmo fio. Duas cópias da régua divergiriam na
   primeira transição nova — e o sintoma seria um chamado que o cliente vê como
   "aguardando você" enquanto o suporte o vê como "em atendimento".

   ── A RÉGUA ──

     cliente abre .................... ABERTO
     suporte responde ................ AGUARDANDO_CLIENTE (inclusive num resolvido:
                                       é o suporte voltando ao assunto, e a tela
                                       avisa "responder reabre o chamado")
     cliente responde ................ EM_ATENDIMENTO (a bola volta ao suporte;
                                       vale também para quem escreve de novo
                                       num ABERTO — alguém está falando)
     cliente responde a um resolvido . ABERTO     + anotação "Reaberto por …"
     alguém resolve .................. RESOLVIDO  + anotação "Resolvido por …"
                                       (o cliente também: "já resolvi sozinho")
     alguém reabre ................... ABERTO     + anotação "Reaberto por …"

   `resolvido` continua sendo gravado, DERIVADO do status, porque a coluna
   ainda é lida em vários lugares (badge do menu, filtros, ordenação da fila).

   ── A NOVIDADE ──

   Toda fala e toda mudança de status regravam `atualizadoEm`. Ele depois de
   `vistoClienteEm` é o que o dono ainda não viu — o selo vermelho do avatar e a
   lista do menu de Ajuda. Abrir o chamado (ou mexer nele) marca o visto; quem
   marca passa o `atualizadoEm` explícito, senão o `@updatedAt` do Prisma o
   empurraria para agora e nada mais seria novidade.

   ── O E-MAIL ──

   Sai UMA vez por resposta do suporte, para quem abriu o chamado (ou para o
   e-mail da imobiliária, se a pessoa não tiver um). Anotação de sistema não
   avisa ninguém: "resolvido" chega junto da última resposta, e um segundo
   e-mail dizendo só isso é o que faz alguém filtrar a Omnimob como spam.

   O chamado INTERNO não avisa o cliente — ele é da equipe para o
   desenvolvimento, e quem está na ficha como autor é o Administrador do
   cliente só porque a sessão é a dele. Ele avisa, na ABERTURA, o
   desenvolvimento (`avisarChamadoInterno`).
   ──────────────────────────────────────────────────────────────────────────── */

export const STATUS_CHAMADO = ["ABERTO", "EM_ATENDIMENTO", "AGUARDANDO_CLIENTE", "RESOLVIDO"];
/** De quem é a vez: o suporte deve resposta. Decide o "sua vez" da fila. */
export const VEZ_DO_SUPORTE = ["ABERTO", "EM_ATENDIMENTO"];

/* @[rótulo](/caminho) — a menção de uma tela, que o suporte cita com "@" na
   caixa de resposta. Só caminho INTERNO (uma barra, nunca duas): é a mesma
   regra de quem desenha o link (`utils/mencoes.js` no front), e um texto
   digitado à mão nesse formato não vira link para fora do sistema. */
export const MENCAO_RE = /@\[([^[\]\n]{1,120})\]\((\/(?!\/)[A-Za-z0-9\-._~/?=&%#+]{0,300})\)/g;

/** O texto com cada menção trocada pelo nome da tela — para trecho e e-mail. */
export function semMencoes(texto) {
  return String(texto ?? "").replace(MENCAO_RE, (_, rotulo) => rotulo);
}

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
    /* Quem abriu, pelo id: a tela do cliente usa para saber se o chamado é
       DELE (o administrador também vê os dos colegas). */
    usuarioId: c.usuarioId ?? null,
    interno: Boolean(c.interno),
    abertoPor: c.abertoPor || null,
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

/* Regrava o chamado depois de uma fala: o status novo (se mudou) e SEMPRE o
   `atualizadoEm`. Sem tocar na linha, a fala que não muda o status (o cliente
   escrevendo duas vezes seguidas) não seria novidade para ninguém. */
function tocar(chamado, status) {
  return prisma.chamado.update({
    where: { numero: chamado.numero },
    data: {
      ...(status && status !== chamado.status ? dadosDoStatus(status, chamado) : {}),
      atualizadoEm: new Date(),
    },
  });
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
 * encerrando ou reabrindo). Resolver e reabrir deixam anotação — sem ela a
 * conversa fica com um salto de status que ninguém explica; "em atendimento"
 * não, porque não é um fato que o cliente precise ler numa linha.
 */
export async function mudarStatus(chamado, status, { autorNome }) {
  if (!STATUS_CHAMADO.includes(status)) throw new Error("Status inválido.");
  if (chamado.status === status) return chamado;

  const atualizado = await prisma.chamado.update({
    where: { numero: chamado.numero },
    data: { ...dadosDoStatus(status, chamado), atualizadoEm: new Date() },
  });
  if (status === "RESOLVIDO") await anotar(chamado, `Resolvido por ${autorNome}.`);
  else if (chamado.status === "RESOLVIDO") await anotar(chamado, `Reaberto por ${autorNome}.`);
  return atualizado;
}

/** A resposta do suporte: mensagem, bola para o cliente, e o e-mail. */
export async function responderComoSuporte(chamado, { texto, prints = [], autorNome }) {
  const mensagem = await prisma.chamadoMensagem.create({
    data: {
      tenantId: chamado.tenantId,
      chamadoNumero: chamado.numero,
      autorTipo: "SUPORTE",
      autorNome,
      texto,
      prints,
    },
  });
  /* Sempre AGUARDANDO_CLIENTE — inclusive num resolvido. Voltar a escrever
     num chamado fechado é reabrir o assunto, e deixá-lo "Resolvido" com uma
     pergunta nova dentro faria o cliente nunca a ver na lista de abertos. */
  const atualizado = await tocar(chamado, "AGUARDANDO_CLIENTE");

  if (!chamado.interno) {
    avisarCliente(chamado, mensagem).catch((e) =>
      console.error(`[chamados] falha ao avisar o cliente do #${chamado.numero}:`, e.message),
    );
  }
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

  let atualizado;
  if (chamado.status === "RESOLVIDO") {
    // Escrever num chamado fechado é reabri-lo — e fica dito na conversa.
    atualizado = await mudarStatus(chamado, "ABERTO", { autorNome });
  } else {
    atualizado = await tocar(chamado, "EM_ATENDIMENTO");
  }
  return { mensagem, chamado: atualizado };
}

/* ── O que o dono ainda não viu ─────────────────────────────────────────────── */

/**
 * O dono abriu (ou mexeu em) o chamado: o que houve até agora está visto.
 * Falha em silêncio — o pior caso é um selo a mais.
 */
export async function marcarVisto(chamado) {
  try {
    await prisma.chamado.update({
      where: { numero: chamado.numero },
      // `atualizadoEm` explícito: sem ele o @updatedAt o puxaria para agora.
      data: { vistoClienteEm: new Date(), atualizadoEm: chamado.atualizadoEm },
    });
  } catch (e) {
    console.warn(`[chamados] não marquei o #${chamado.numero} como visto:`, e.message);
  }
}

/* Os chamados de UMA pessoa, para os contadores. O interno fica de fora para
   quem não é a equipe: a sessão de suporte usa o login do Administrador do
   cliente, e sem o filtro o chamado interno acenderia o selo dele. */
function dosMeus(tenantId, usuarioId, { suporte = false } = {}) {
  return { tenantId, usuarioId, ...(suporte ? {} : { interno: false }) };
}

const temNovidade = (c) => c.atualizadoEm > (c.vistoClienteEm || c.criadoEm);

/**
 * Os chamados desta pessoa com algo que ela ainda não viu, cada um com a
 * última fala — é o que a lista do menu de Ajuda diz. A comparação entre duas
 * colunas fica aqui, e não no banco, porque o Prisma não a expressa; o volume
 * é o de UMA pessoa, e os resolvidos antigos (visto há muito) saem pelo corte.
 */
export async function novidadesDoCliente(tenantId, usuarioId, { suporte = false, limite = 20 } = {}) {
  if (!usuarioId) return [];
  const candidatos = await prisma.chamado.findMany({
    where: dosMeus(tenantId, usuarioId, { suporte }),
    orderBy: { atualizadoEm: "desc" },
    take: 100,
    select: {
      numero: true, titulo: true, status: true, criadoEm: true, atualizadoEm: true, vistoClienteEm: true,
      mensagens: { orderBy: { criadoEm: "desc" }, take: 1, select: { autorTipo: true, autorNome: true, texto: true } },
    },
  });
  return candidatos
    .filter(temNovidade)
    .slice(0, limite)
    .map((c) => {
      const ultima = c.mensagens[0];
      return {
        numero: c.numero,
        titulo: c.titulo,
        status: c.status,
        atualizadoEm: c.atualizadoEm,
        autorTipo: ultima?.autorTipo || null,
        autorNome: ultima?.autorNome || null,
        trecho: semMencoes(ultima?.texto || "").slice(0, 160),
      };
    });
}

/** Os dois números do menu: o que espera a pessoa, e o que ela não viu. */
export async function contadoresDoCliente(tenantId, usuarioId, { suporte = false } = {}) {
  if (!usuarioId) return { aguardando: 0, novidades: 0 };
  const meus = await prisma.chamado.findMany({
    where: dosMeus(tenantId, usuarioId, { suporte }),
    orderBy: { atualizadoEm: "desc" },
    take: 200,
    select: { status: true, criadoEm: true, atualizadoEm: true, vistoClienteEm: true },
  });
  return {
    aguardando: meus.filter((c) => c.status === "AGUARDANDO_CLIENTE").length,
    novidades: meus.filter(temNovidade).length,
  };
}

/* ── Avisos por e-mail ──────────────────────────────────────────────────────── */

/* Para quem vai o aviso: quem abriu, se ainda tiver e-mail; senão, a
   imobiliária. O nome de quem abriu foi copiado para o chamado, mas o e-mail
   não — é lido na hora, porque a pessoa pode ter trocado. */
async function avisarCliente(chamado, mensagem) {
  const [usuario, tenant] = await Promise.all([
    chamado.usuarioId
      ? prisma.usuario.findFirst({ where: { id: chamado.usuarioId, tenantId: chamado.tenantId, ativo: true }, select: { nome: true, email: true, googleEmail: true } })
      : null,
    prisma.tenant.findUnique({ where: { id: chamado.tenantId }, select: { name: true, email: true } }),
  ]);
  const para = emailDoUsuario(usuario) || tenant?.email;
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
    texto: semMencoes(mensagem.texto),
    link: `${base}/suporte/${chamado.numero}`,
  });
  await sendEmail({ to: para, subject: modelo.subject, body: modelo.body, html: modelo.html });
}

/**
 * O chamado interno chega ao desenvolvimento por e-mail, além da fila: quem
 * vai investigar não vive dentro do painel de suporte. Disparado e esquecido —
 * o chamado já está gravado, e quem abriu não espera o provedor de e-mail.
 *
 * Destino: `CHAMADOS_INTERNOS_EMAIL`, ou `CONTATO_EMAIL` na falta dela.
 */
export function avisarChamadoInterno(chamado, { imobiliaria }) {
  const para = (process.env.CHAMADOS_INTERNOS_EMAIL || process.env.CONTATO_EMAIL || "").trim();
  if (!para) {
    console.warn(`[chamados] interno #${chamado.numero}: sem CHAMADOS_INTERNOS_EMAIL nem CONTATO_EMAIL — só na fila.`);
    return;
  }
  const base = (process.env.APP_URL || "").trim().replace(/\/+$/, "") || "https://omnimob.app";
  const modelo = emailChamadoInterno({
    numero: chamado.numero,
    titulo: chamado.titulo,
    descricao: chamado.descricao,
    categoria: chamado.categoria,
    abertoPor: chamado.abertoPor,
    imobiliaria,
    rota: chamado.rota,
    prints: chamado.prints || [],
    link: `${base}/admin`,
  });
  sendEmail({ to: para, subject: modelo.subject, body: modelo.body, html: modelo.html }).catch((e) =>
    console.error(`[chamados] interno #${chamado.numero}: falha ao avisar o desenvolvimento:`, e.message),
  );
}
