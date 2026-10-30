import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

/* ────────────────────────────────────────────────────────────────────────────
   O COMUNICADO AVULSO, do lado da imobiliária — porte do modal de comunicado
   do VYA. É o aviso que não é novidade de produto ("manutenção no sábado às
   22h"): o super-admin manda para um cliente ou para todos, e ele abre UMA vez
   para cada pessoa ao entrar no painel, enquanto estiver ativo e no prazo.

   Nem para a demonstração nem para o suporte dentro da conta: o aviso é do
   cliente, e o "já viu" também.
   ──────────────────────────────────────────────────────────────────────────── */

export const comunicadoRouter = Router();
comunicadoRouter.use(requireAuth);
comunicadoRouter.use(requireTenant);

/** O que vale para esta imobiliária agora: ativo, no prazo, dela ou de todos. */
export const comunicadosValendo = (tenantId, agora = new Date()) => ({
  ativo: true,
  OR: [{ tenantId: null }, { tenantId }],
  AND: [{ OR: [{ expiraEm: null }, { expiraEm: { gt: agora } }] }],
});

/* O mais ANTIGO que a pessoa ainda não viu: dois avisos na fila saem na
   ordem em que foram mandados, um por entrada no painel. */
comunicadoRouter.get("/pendente", async (req, res) => {
  try {
    if (req.authDemo || req.authSuporte) return res.json({ comunicado: null });
    const comunicado = await prisma.comunicado.findFirst({
      where: { ...comunicadosValendo(req.tenant.id), vistos: { none: { usuarioId: req.authUserId } } },
      orderBy: { createdAt: "asc" },
      select: { id: true, titulo: true, texto: true, createdAt: true },
    });
    return res.json({ comunicado });
  } catch (erro) {
    console.error("[GET /comunicados/pendente]", erro);
    return res.status(500).json({ error: "Erro ao buscar o comunicado." });
  }
});

comunicadoRouter.post("/:id/visto", async (req, res) => {
  try {
    if (req.authSuporte) return res.status(204).end();
    const valendo = await prisma.comunicado.findFirst({ where: { id: req.params.id, ...comunicadosValendo(req.tenant.id) }, select: { id: true } });
    if (!valendo) return res.status(404).json({ error: "Comunicado não encontrado." });
    await prisma.comunicadoVisto.upsert({
      where: { comunicadoId_usuarioId: { comunicadoId: valendo.id, usuarioId: req.authUserId } },
      update: {},
      create: { comunicadoId: valendo.id, usuarioId: req.authUserId, tenantId: req.tenant.id },
    });
    return res.status(204).end();
  } catch (erro) {
    console.error("[POST /comunicados/:id/visto]", erro);
    return res.status(500).json({ error: "Erro ao registrar." });
  }
});
