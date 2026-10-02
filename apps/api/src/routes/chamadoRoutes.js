import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { CARGO_ADMIN } from "../services/cargosPadrao.js";
import {
  avisarChamadoInterno,
  COM_CONTAGEM,
  COM_CONVERSA,
  contadoresDoCliente,
  marcarVisto,
  mudarStatus,
  novidadesDoCliente,
  responderComoCliente,
  serializarChamado,
  serializarMensagem,
} from "../services/chamados.js";

/* ────────────────────────────────────────────────────────────────────────────
   Chamados de suporte — lado da imobiliária.

   Sem `requirePermissao`: pedir ajuda é direito de qualquer pessoa da equipe,
   inclusive do corretor que só enxerga imóveis. Amarrar isto a uma permissão de
   gestão deixaria justamente quem mais precisa sem como falar com a gente.

   Quem LÊ todos os chamados é o super-admin, por `/api/admin/chamados`. Aqui
   cada tenant só enxerga os próprios — e o filtro vem do `req.tenant`, nunca de
   um id no corpo da requisição.

   ── DENTRO DO TENANT, CADA UM VÊ OS SEUS ──

   O chamado é de quem o abriu: a conversa pode ter print de tela com dado de
   cliente, e o corretor não tem por que ler o do colega. O ADMINISTRADOR da
   imobiliária vê os de todo mundo — é visibilidade, e não autoridade: na tela
   ele continua sendo cliente, nunca "responde como suporte". O filtro entra em
   TODA busca (`chamadoVisivel`), não só na lista; sem isso trocar o número na
   URL leria o chamado do colega.

   ── AQUI TODO MUNDO É CLIENTE ──

   Inclusive a equipe da Omnimob quando entra na conta pelo super-admin: a fala
   que sai daqui é sempre CLIENTE. Falar como suporte é privilégio de
   `adminRoutes`. O que a equipe ganha aqui é o chamado INTERNO — o suporte
   pedindo algo ao desenvolvimento —, e quem decide que é interno é o TOKEN
   (`req.authSuporte`), nunca o corpo.
   ──────────────────────────────────────────────────────────────────────────── */

export const chamadoRouter = Router();
chamadoRouter.use(requireAuth);
chamadoRouter.use(requireTenant);

const PRIORIDADES = ["BAIXA", "MEDIA", "ALTA", "URGENTE"];

/* ── Suporte prioritário por plano ───────────────────────────────────────────
   A prioridade que chega no corpo vem da CATEGORIA, não de um seletor: "algo
   não funciona" é objetivamente mais urgente que "tenho uma ideia" (ver
   `prioridadeDaCategoria` em utils/suporte.js). Ela diz a NATUREZA do problema.

   O plano entra por cima disso, empurrando o chamado alguns degraus para cima
   na mesma escala: Profissional sobe um, Premium sobe dois. É por isso que é um
   DESLOCAMENTO e não um piso — com piso, todo chamado de Premium viraria
   URGENTE e a fila do Premium perderia qualquer ordem interna. Somando, a
   natureza do problema continua ordenando dentro de cada plano, e o plano
   ordena entre eles.

   Na prática: uma dúvida de Premium (BAIXA +2) empata com um problema de Básico
   (ALTA +0). Que é exatamente o que "suporte prioritário" significa — e é
   aplicado no SERVIDOR, porque o corpo da requisição é do cliente. */
const DEGRAUS_POR_PLANO = { BASICO: 0, PROFISSIONAL: 1, PREMIUM: 2 };

function prioridadeComPlano(prioridade, plano) {
  const base = PRIORIDADES.indexOf(prioridade);
  if (base < 0) return "MEDIA";
  const degraus = DEGRAUS_POR_PLANO[String(plano || "").toUpperCase()] ?? 0;
  return PRIORIDADES[Math.min(base + degraus, PRIORIDADES.length - 1)];
}

/* Prints já subiram para o Cloudinary pelo navegador — aqui chegam só as URLs,
   como no cadastro de imóvel. O teto de 6 evita que um chamado vire um álbum
   (o print da tela + até 3 anexadas cabem com folga), e o `.url()` barra
   caminho local colado por engano. */
const PRINTS = z.array(z.string().url().max(500)).max(6).optional().default([]);

const abrirSchema = z.object({
  titulo: z.string().trim().min(4, "Escreva um assunto.").max(140),
  descricao: z.string().trim().min(15, "Descreva o que aconteceu.").max(4000),
  categoria: z.string().trim().max(30).optional().default("duvida"),
  prioridade: z.enum(PRIORIDADES).optional().default("MEDIA"),
  rota: z.string().trim().max(200).optional().default(""),
  prints: PRINTS,
});

const responderSchema = z.object({
  texto: z.string().trim().min(1, "Escreva a mensagem.").max(4000),
  prints: PRINTS,
});

/* A forma é a de `services/chamados.js`, a mesma que o super-admin lê: os
   dois lados olham para o mesmo chamado, e duas serializações divergiriam
   no primeiro campo novo. */
const serializar = serializarChamado;

/** Quem pergunta, e o que alcança. Uma leitura por requisição. */
function quem(req) {
  return {
    usuarioId: req.authUserId,
    /* O Administrador da imobiliária, pela mesma régua do resto do sistema
       (`CARGO_ADMIN`). Não `gerenciarUsuarios` ou parecido: essas caixas se
       desmarcam, e "ver os chamados da empresa" é de quem responde pela conta. */
    veDaEmpresa: req.authCargo?.descricao === CARGO_ADMIN,
    suporte: req.authSuporte || null,
  };
}

/* O filtro de visibilidade, em UM lugar: lista, leitura, resposta e status
   passam por aqui. `todos` só alarga para quem `veDaEmpresa`. */
function filtroVisivel(req, { todos = false } = {}) {
  const q = quem(req);
  return {
    tenantId: req.tenant.id,
    ...(q.veDaEmpresa && todos ? {} : { usuarioId: q.usuarioId }),
    // O interno é da equipe: o Administrador do cliente, logado por conta
    // própria, não o vê — nem na lista, nem pelo número.
    ...(q.suporte ? {} : { interno: false }),
  };
}

/* Quem está falando, com o login — como `usuarioNome` no chamado. No interno a
   sessão é a do Administrador do cliente, e o nome que importa é o da equipe. */
async function nomeDeQuemFala(req, chamado) {
  const q = quem(req);
  if (chamado?.interno && q.suporte?.nome) return `${q.suporte.nome} (suporte)`;
  const usuario = await prisma.usuario.findFirst({
    where: { id: req.authUserId, tenantId: req.tenant.id },
    select: { nome: true, login: true },
  });
  return usuario ? `${usuario.nome} (${usuario.login})` : "Cliente";
}

/* `findFirst` com o tenant e a visibilidade juntos, e não `findUnique` pelo
   número: o número é sequencial e global — o #12 de uma imobiliária é vizinho
   do #13 de outra, e o #12 do corretor é vizinho do #13 do colega. Fora do
   alcance, responde 404: não existe, para quem pergunta. */
async function chamadoVisivel(req, include) {
  const numero = Number(req.params.numero);
  if (!Number.isInteger(numero)) return null;
  return prisma.chamado.findFirst({ where: { numero, ...filtroVisivel(req, { todos: true }) }, include });
}

/* O dono viu o que está no chamado. O Administrador olhando o chamado de um
   colega não conta como leitura do colega — nem a equipe dentro da conta como
   leitura do Administrador. */
function vistoSeForDoDono(req, chamado) {
  if (chamado && chamado.usuarioId === req.authUserId && !req.authSuporte) return marcarVisto(chamado);
  return null;
}

/** Abre um chamado em nome de quem está logado. */
chamadoRouter.post("/", async (req, res) => {
  const parsed = abrirSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
  }

  try {
    /* O nome vai COPIADO para dentro do chamado, além da chave estrangeira.
       Quem abriu pode sair da imobiliária depois, e um histórico de suporte que
       perde o autor não serve para nada. */
    const usuario = await prisma.usuario.findFirst({
      where: { id: req.authUserId, tenantId: req.tenant.id },
      select: { id: true, nome: true, login: true },
    });
    const { suporte } = quem(req);

    const chamado = await prisma.chamado.create({
      data: {
        ...parsed.data,
        prioridade: prioridadeComPlano(parsed.data.prioridade, req.tenant.plano),
        tenantId: req.tenant.id,
        usuarioId: usuario?.id ?? null,
        usuarioNome: usuario ? `${usuario.nome} (${usuario.login})` : "",
        // Interno é decidido AQUI, por quem está logado — nunca pelo corpo.
        interno: Boolean(suporte),
        abertoPor: suporte ? String(suporte.nome || suporte.email || "equipe").slice(0, 80) : null,
      },
    });

    if (chamado.interno) avisarChamadoInterno(chamado, { imobiliaria: req.tenant.name });
    return res.status(201).json(serializar(chamado));
  } catch (err) {
    console.error("[chamados] falha ao abrir:", err);
    return res.status(500).json({ error: "Não foi possível registrar o chamado." });
  }
});

/** Os chamados de quem pergunta (ou da empresa, para o Administrador com `?todos=1`). */
chamadoRouter.get("/", async (req, res) => {
  try {
    const q = quem(req);
    /* `todos` só vale para o Administrador; sem isso, qualquer um leria a
       fila inteira da empresa só acrescentando o parâmetro. */
    const todos = q.veDaEmpresa && ["1", "true"].includes(String(req.query.todos || "").toLowerCase());
    const [chamados, contadores] = await Promise.all([
      prisma.chamado.findMany({
        where: filtroVisivel(req, { todos }),
        /* Abertos primeiro, e dentro de cada grupo o que mexeu por último —
           é a ordem da caixa de entrada, não a do protocolo. */
        orderBy: [{ resolvido: "asc" }, { atualizadoEm: "desc" }],
        take: 100,
        include: COM_CONTAGEM,
      }),
      contadoresDoCliente(req.tenant.id, q.usuarioId, { suporte: Boolean(q.suporte) }),
    ]);
    return res.json({
      chamados: chamados.map(serializar),
      podeVerTodos: q.veDaEmpresa,
      aguardando: contadores.aguardando,
    });
  } catch (err) {
    console.error("[chamados] falha ao listar:", err);
    return res.status(500).json({ error: "Erro ao carregar os chamados." });
  }
});

/* Os dois números do menu: `aguardando` (o suporte espera a resposta da
   pessoa) e `novidades` (o que ela ainda não viu — o selo do avatar). Separado
   da listagem porque a listagem carrega descrição e prints de todos os
   chamados — caro demais para pintar um contador a cada 90 segundos. */
chamadoRouter.get("/pendentes", async (req, res) => {
  try {
    const q = quem(req);
    return res.json(await contadoresDoCliente(req.tenant.id, q.usuarioId, { suporte: Boolean(q.suporte) }));
  } catch (err) {
    console.error("[chamados] falha ao contar:", err);
    return res.json({ aguardando: 0, novidades: 0 });
  }
});

/* O que mudou nos chamados desta pessoa desde a última vez que ela os viu,
   com a última fala de cada um — a lista do menu de Ajuda. Leve: sem prints,
   sem descrição. */
chamadoRouter.get("/novidades", async (req, res) => {
  try {
    const q = quem(req);
    return res.json({ novidades: await novidadesDoCliente(req.tenant.id, q.usuarioId, { suporte: Boolean(q.suporte) }) });
  } catch (err) {
    console.error("[chamados] falha ao ler novidades:", err);
    return res.json({ novidades: [] });
  }
});

/** Um chamado com a conversa inteira. Abrir marca como visto. */
chamadoRouter.get("/:numero", async (req, res) => {
  try {
    const chamado = await chamadoVisivel(req, COM_CONVERSA);
    if (!chamado) return res.status(404).json({ error: "Chamado não encontrado." });
    await vistoSeForDoDono(req, chamado);
    return res.json(serializar(chamado));
  } catch (err) {
    console.error("[chamados] falha ao abrir a conversa:", err);
    return res.status(500).json({ error: "Erro ao carregar o chamado." });
  }
});

/** O cliente responde. Num chamado resolvido, isto o reabre. */
chamadoRouter.post("/:numero/mensagens", async (req, res) => {
  const parsed = responderSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
  }
  try {
    const chamado = await chamadoVisivel(req);
    if (!chamado) return res.status(404).json({ error: "Chamado não encontrado." });

    const { mensagem, chamado: atualizado } = await responderComoCliente(chamado, {
      ...parsed.data,
      autorNome: await nomeDeQuemFala(req, chamado),
    });
    await vistoSeForDoDono(req, atualizado);
    return res.status(201).json({ mensagem: serializarMensagem(mensagem), status: atualizado.status });
  } catch (err) {
    console.error("[chamados] falha ao responder:", err);
    return res.status(500).json({ error: "Não foi possível enviar a mensagem." });
  }
});

/* Encerrar ou reabrir. Encerrar o PRÓPRIO chamado é do cliente: "já resolvi
   sozinho" é uma resposta legítima, e obrigá-lo a esperar o suporte fechar
   deixaria a lista dele cheia de coisa terminada. O escopo de `chamadoVisivel`
   é o que garante que isso só alcança o que a pessoa enxerga. */
async function trocarStatus(req, res, status) {
  if (!["RESOLVIDO", "ABERTO"].includes(status)) {
    return res.status(400).json({ error: "Status inválido." });
  }
  try {
    const chamado = await chamadoVisivel(req);
    if (!chamado) return res.status(404).json({ error: "Chamado não encontrado." });
    if (chamado.status === status || (status === "ABERTO" && chamado.status !== "RESOLVIDO")) {
      return res.status(400).json({
        error: status === "RESOLVIDO" ? "Este chamado já está resolvido." : "Este chamado ainda está aberto.",
      });
    }
    const atualizado = await mudarStatus(chamado, status, { autorNome: await nomeDeQuemFala(req, chamado) });
    await vistoSeForDoDono(req, atualizado);
    return res.json({ status: atualizado.status });
  } catch (err) {
    console.error("[chamados] falha ao mudar o status:", err);
    return res.status(500).json({ error: "Não foi possível atualizar o chamado." });
  }
}

chamadoRouter.post("/:numero/status", (req, res) => trocarStatus(req, res, String(req.body?.status || "").toUpperCase()));

/** Reabrir sem escrever nada — o contrato antigo da tela, mantido. */
chamadoRouter.post("/:numero/reabrir", (req, res) => trocarStatus(req, res, "ABERTO"));
