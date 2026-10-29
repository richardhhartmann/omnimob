import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { chaveValida, normalizarNovidade, oQueVe } from "../services/novidades.js";
import { daApresentacao } from "../services/versao.js";

/* ────────────────────────────────────────────────────────────────────────────
   As Novidades da semana, do lado de FORA do super-admin (a regra mora em
   `services/novidades.js`; a revisão e a publicação, em `adminRoutes`).

   Duas portas, com autenticações diferentes:

     · `rascunhoNovidadeRouter` — a rotina de terça entrega o rascunho, com
       `Authorization: Bearer NOVIDADES_TOKEN`. Montado ANTES do
       `novidadeRouter` no `server.js`, senão o `requireAuth` dele o engoliria.
       Sem a variável, a porta não existe (404).
     · `novidadeRouter` — a imobiliária: o comunicado que abre sozinho, a lista
       de Ajuda › Notas de versão, e o registro de quem viu.
   ──────────────────────────────────────────────────────────────────────────── */

export const rascunhoNovidadeRouter = Router();

function tokenConfere(req) {
  const esperado = (process.env.NOVIDADES_TOKEN || "").trim();
  const veio = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!esperado || !veio || veio.length !== esperado.length) return false;
  return timingSafeEqual(Buffer.from(veio), Buffer.from(esperado));
}

rascunhoNovidadeRouter.put("/:chave", async (req, res) => {
  if (!(process.env.NOVIDADES_TOKEN || "").trim()) return res.status(404).json({ error: "Rota indisponível." });
  if (!tokenConfere(req)) return res.status(401).json({ error: "Chave inválida." });
  const { chave } = req.params;
  if (!chaveValida(chave)) return res.status(400).json({ error: "A chave é a terça da semana, em AAAA-MM-DD." });
  try {
    const conteudo = normalizarNovidade(req.body, chave);
    const atual = await prisma.novidade.findUnique({ where: { chave }, select: { status: true } });
    // A publicada não é sobrescrita pela rotina: a revisão de uma pessoa vale mais.
    if (atual?.status === "PUBLICADO") return res.status(409).json({ error: "Esta semana já foi publicada." });
    const dados = { conteudo, versao: daApresentacao(chave), origem: "agendamento", atualizadoPor: "agendamento" };
    await prisma.novidade.upsert({ where: { chave }, update: dados, create: { chave, ...dados } });
    return res.json({ chave, versao: dados.versao, status: "RASCUNHO" });
  } catch (erro) {
    if (erro.status === 400) return res.status(400).json({ error: erro.message });
    console.error("[PUT /novidades/rascunho]", erro);
    return res.status(500).json({ error: "Erro ao gravar o rascunho." });
  }
});

export const novidadeRouter = Router();
novidadeRouter.use(requireAuth);
novidadeRouter.use(requireTenant);

/* Quanto tempo uma publicação fica "nova": depois disso não abre sozinha para
   quem ainda não viu (continua em Notas de versão). */
const JANELA_DO_COMUNICADO_MS = 14 * 864e5;

const quemE = (req) => ({ tenant: req.tenant, cargo: req.authCargo });

/** A publicada, já cortada para esta pessoa; `null` se não houver ou não sobrar nada. */
async function publicadaPara(req, chave) {
  const n = await prisma.novidade.findUnique({ where: { chave } });
  if (!n || n.status !== "PUBLICADO") return null;
  const conteudo = oQueVe(n.conteudo, quemE(req));
  return conteudo ? { chave: n.chave, versao: n.versao, publicadoEm: n.publicadoEm, conteudo } : null;
}

/* O comunicado: a publicação mais recente desta janela que a pessoa ainda não
   abriu. Nem para a demonstração nem para o suporte dentro da conta — a
   apresentação é do cliente, e o "já viu" também. Quem entrou na equipe
   DEPOIS da publicação não a recebe: tem o tour de boas-vindas. */
novidadeRouter.get("/pendente", async (req, res) => {
  try {
    if (req.authDemo || req.authSuporte) return res.json({ novidade: null });
    const usuario = await prisma.usuario.findUnique({ where: { id: req.authUserId }, select: { createdAt: true } });
    const recentes = await prisma.novidade.findMany({
      where: { status: "PUBLICADO", publicadoEm: { gte: new Date(Date.now() - JANELA_DO_COMUNICADO_MS) } },
      orderBy: { chave: "desc" },
      take: 3,
    });
    for (const n of recentes) {
      if (usuario?.createdAt && n.publicadoEm && usuario.createdAt > n.publicadoEm) continue;
      const viu = await prisma.novidadeVisto.findFirst({ where: { chave: n.chave, usuarioId: req.authUserId }, select: { id: true } });
      if (viu) continue;
      const conteudo = oQueVe(n.conteudo, quemE(req));
      if (conteudo) return res.json({ novidade: { chave: n.chave, versao: n.versao, publicadoEm: n.publicadoEm, conteudo } });
    }
    return res.json({ novidade: null });
  } catch (erro) {
    console.error("[GET /novidades/pendente]", erro);
    return res.status(500).json({ error: "Erro ao buscar as novidades." });
  }
});

/** Ajuda › Notas de versão: as publicadas que têm algo para esta pessoa. */
novidadeRouter.get("/", async (req, res) => {
  try {
    const publicadas = await prisma.novidade.findMany({ where: { status: "PUBLICADO" }, orderBy: { chave: "desc" }, take: 26 });
    const lista = publicadas
      .map((n) => ({ n, visto: oQueVe(n.conteudo, quemE(req)) }))
      .filter((x) => x.visto)
      .map(({ n, visto }) => ({ chave: n.chave, versao: n.versao, titulo: visto.titulo, publicadoEm: n.publicadoEm }));
    return res.json({ novidades: lista });
  } catch (erro) {
    console.error("[GET /novidades]", erro);
    return res.status(500).json({ error: "Erro ao listar as novidades." });
  }
});

novidadeRouter.get("/:chave", async (req, res) => {
  try {
    const n = await publicadaPara(req, req.params.chave);
    if (!n) return res.status(404).json({ error: "Novidade não encontrada." });
    return res.json(n);
  } catch (erro) {
    console.error("[GET /novidades/:chave]", erro);
    return res.status(500).json({ error: "Erro ao abrir a novidade." });
  }
});

const inteiro = (v, min, max) => Math.max(min, Math.min(max, Number.parseInt(v, 10) || min));

/* QUEM VIU. Cada abertura cria uma linha (`origem`, `total`, `dispositivo`) e
   devolve o id; depois chegam o maior slide alcançado e o fechamento, sempre
   com o id. A linha é DESTA pessoa: o id de outra responde 404. O suporte
   dentro da conta não é registrado — a revisão não é o cliente vendo. */
novidadeRouter.post("/:chave/visto", async (req, res) => {
  try {
    if (req.authSuporte) return res.status(204).end();
    const { chave } = req.params;
    const b = req.body || {};
    if (b.id) {
      const linha = await prisma.novidadeVisto.findFirst({ where: { id: String(b.id), chave, usuarioId: req.authUserId } });
      if (!linha) return res.status(404).json({ error: "Registro não encontrado." });
      const slide = Math.min(inteiro(b.slide, 1, 500), linha.totalSlides || 500);
      const slideMax = Math.max(linha.slideMax, slide);
      await prisma.novidadeVisto.update({
        where: { id: linha.id },
        data: {
          slideMax,
          chegouAoFim: linha.chegouAoFim || (linha.totalSlides > 0 && slideMax >= linha.totalSlides),
          ultimoEm: new Date(),
          ...(b.fechou ? { fechadoEm: new Date() } : {}),
        },
      });
      return res.status(204).end();
    }
    if (!(await publicadaPara(req, chave))) return res.status(404).json({ error: "Novidade não encontrada." });
    const criada = await prisma.novidadeVisto.create({
      data: {
        chave,
        tenantId: req.tenant.id,
        usuarioId: req.authUserId,
        usuarioNome: req.authUserNome || "",
        origem: b.origem === "menu" ? "menu" : "comunicado",
        dispositivo: b.dispositivo === "celular" ? "celular" : "computador",
        totalSlides: inteiro(b.total, 0, 500),
      },
      select: { id: true },
    });
    return res.status(201).json(criada);
  } catch (erro) {
    console.error("[POST /novidades/:chave/visto]", erro);
    return res.status(500).json({ error: "Erro ao registrar a visualização." });
  }
});
