import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

/* ────────────────────────────────────────────────────────────────────────────
   Progresso do tour guiado, por usuário.

   Sem `requirePermissao`: o tour é do primeiro acesso de QUALQUER pessoa da
   equipe, inclusive de um corretor que só enxerga imóveis. Amarrar isto a uma
   permissão de gestão deixaria justamente quem mais precisa de ajuda sem o
   registro do próprio progresso.

   O fluxo (quais etapas existem e em que ordem) mora no front, em
   `utils/tourFluxo.js`, porque depende das permissões do cargo e das rotas do
   painel — coisas que a tela conhece e a API não. Aqui só guardamos o que
   aconteceu com cada etapa, sem opinar sobre quais deveriam existir. Por isso
   `etapa` é texto: uma etapa nova é só uma string nova, sem migração.
   ──────────────────────────────────────────────────────────────────────────── */

export const tutorialRouter = Router();
tutorialRouter.use(requireAuth);
tutorialRouter.use(requireTenant);

const ETAPA_MAX = 60;

const marcarSchema = z.object({
  etapa: z.string().trim().min(1).max(ETAPA_MAX),
  status: z.enum(["EM_ANDAMENTO", "FINALIZADO", "PULADO"]),
  passoParou: z.number().int().min(0).max(999).nullish(),
  totalPassos: z.number().int().min(0).max(999).nullish(),
});

const pularTudoSchema = z.object({
  // O front manda as etapas que ESTE usuário enxerga (o fluxo já filtrado por
  // permissão). Marcar as que ele nunca poderia ver inventaria um "pulou" para
  // uma tela que o cargo dele nem abre.
  etapas: z.array(z.string().trim().min(1).max(ETAPA_MAX)).min(1).max(40),
  passoParou: z.number().int().min(0).max(999).nullish(),
});

/** O usuário da sessão, confirmado dentro do tenant do header. */
async function usuarioDaSessao(req) {
  return prisma.usuario.findFirst({
    where: { id: req.authUserId, tenantId: req.tenant.id },
    select: { id: true },
  });
}

/* Estado completo do tour deste usuário. Devolve só o que foi registrado — a
   tela cruza com o fluxo dela para saber o que falta. */
tutorialRouter.get("/", async (req, res) => {
  try {
    const usuario = await usuarioDaSessao(req);
    if (!usuario) return res.status(404).json({ error: "Usuário não encontrado." });

    const linhas = await prisma.usuarioTutorial.findMany({
      where: { usuarioId: usuario.id },
      select: {
        etapa: true, status: true, passoParou: true, totalPassos: true, atualizadoEm: true,
      },
      orderBy: { atualizadoEm: "asc" },
    });

    return res.json({ etapas: linhas });
  } catch (err) {
    console.error("[tutorial] falha ao ler progresso:", err);
    return res.status(500).json({ error: "Erro ao carregar o progresso do tutorial." });
  }
});

/* Registra o desfecho de uma etapa. Idempotente por (usuário, etapa).

   EM_ANDAMENTO nunca sobrescreve um desfecho: se a pessoa reabre uma tela que
   já concluiu, o "abriu de novo" não pode apagar o "concluiu". */
tutorialRouter.post("/marcar", async (req, res) => {
  const parsed = marcarSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
  }
  const { etapa, status, passoParou, totalPassos } = parsed.data;

  try {
    const usuario = await usuarioDaSessao(req);
    if (!usuario) return res.status(404).json({ error: "Usuário não encontrado." });

    if (status === "EM_ANDAMENTO") {
      const existente = await prisma.usuarioTutorial.findUnique({
        where: { usuarioId_etapa: { usuarioId: usuario.id, etapa } },
        select: { status: true },
      });
      if (existente && existente.status !== "EM_ANDAMENTO") {
        return res.json({ etapa, status: existente.status, jaConcluida: true });
      }
    }

    const linha = await prisma.usuarioTutorial.upsert({
      where: { usuarioId_etapa: { usuarioId: usuario.id, etapa } },
      create: {
        tenantId: req.tenant.id,
        usuarioId: usuario.id,
        etapa,
        status,
        passoParou: passoParou ?? null,
        totalPassos: totalPassos ?? null,
      },
      update: {
        status,
        passoParou: passoParou ?? null,
        totalPassos: totalPassos ?? null,
      },
      select: { etapa: true, status: true, passoParou: true, totalPassos: true },
    });

    return res.json(linha);
  } catch (err) {
    console.error("[tutorial] falha ao marcar etapa:", err);
    return res.status(500).json({ error: "Erro ao registrar o progresso." });
  }
});

/* "Pular tudo" no modal de boas-vindas: fecha o assunto de uma vez.

   Grava PULADO em cada etapa em vez de uma flag "dispensou o tour": a pergunta
   que o produto precisa responder é por TELA — quantos desistiram sem ver
   Leads? —, e uma flag geral não responde isso. */
tutorialRouter.post("/pular-tudo", async (req, res) => {
  const parsed = pularTudoSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
  }
  const { etapas, passoParou } = parsed.data;

  try {
    const usuario = await usuarioDaSessao(req);
    if (!usuario) return res.status(404).json({ error: "Usuário não encontrado." });

    // Sequencial e não createMany: o upsert precisa respeitar quem já concluiu
    // alguma etapa antes de pular o resto.
    const unicas = [...new Set(etapas)];
    for (const etapa of unicas) {
      const existente = await prisma.usuarioTutorial.findUnique({
        where: { usuarioId_etapa: { usuarioId: usuario.id, etapa } },
        select: { status: true },
      });
      if (existente?.status === "FINALIZADO") continue;

      await prisma.usuarioTutorial.upsert({
        where: { usuarioId_etapa: { usuarioId: usuario.id, etapa } },
        create: {
          tenantId: req.tenant.id,
          usuarioId: usuario.id,
          etapa,
          status: "PULADO",
          passoParou: passoParou ?? null,
        },
        update: { status: "PULADO", passoParou: passoParou ?? null },
      });
    }

    const linhas = await prisma.usuarioTutorial.findMany({
      where: { usuarioId: usuario.id },
      select: { etapa: true, status: true, passoParou: true, totalPassos: true },
    });
    return res.json({ etapas: linhas });
  } catch (err) {
    console.error("[tutorial] falha ao pular tudo:", err);
    return res.status(500).json({ error: "Erro ao registrar o progresso." });
  }
});

/* Zera o tour do próprio usuário — é o que permite rever o tutorial pelas
   Configurações sem mexer no banco na mão. */
tutorialRouter.post("/reiniciar", async (req, res) => {
  try {
    const usuario = await usuarioDaSessao(req);
    if (!usuario) return res.status(404).json({ error: "Usuário não encontrado." });

    await prisma.usuarioTutorial.deleteMany({ where: { usuarioId: usuario.id } });
    return res.json({ etapas: [] });
  } catch (err) {
    console.error("[tutorial] falha ao reiniciar:", err);
    return res.status(500).json({ error: "Erro ao reiniciar o tutorial." });
  }
});
