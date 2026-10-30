import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { conferirCoerencia, podeConsentir } from "../services/relatosDaParede.js";

/* ────────────────────────────────────────────────────────────────────────────
   "O que você está achando da Omnimob?" — do lado da imobiliária.

   Porte do pedido de avaliação do VYA. A tela pergunta de vez em quando,
   depois de trabalho feito (`web/utils/pulsoAvaliacao.js`); quem DECIDE se
   pergunta é este arquivo, porque só ele sabe as quatro respostas:

     · já avaliou? — uma por pessoa, e o índice único é a trava de verdade;
     · está em teste? — conta em trial já tem a `PesquisaTrial`, e duas
       perguntas sobre o mesmo produto viram ruído;
     · é a equipe da Omnimob dentro da conta (o "Entrar" do super-admin)? —
       a opinião seria nossa, não do cliente;
     · é a demonstração? — não grava nada, então não pergunta.

   Sem `requirePermissao`: dar opinião é de qualquer pessoa da equipe.
   ──────────────────────────────────────────────────────────────────────────── */

export const avaliacaoRouter = Router();
avaliacaoRouter.use(requireAuth);
avaliacaoRouter.use(requireTenant);

function motivoParaNaoPerguntar(req) {
  if (req.authDemo) return "demonstracao";
  if (req.authSuporte) return "suporte";
  if (req.tenant?.statusPagamento === "TRIAL") return "trial";
  return null;
}

/* Chamado só quando o pulso da tela diz "é a hora": não é uma ida ao banco por
   página aberta. */
avaliacaoRouter.get("/minha", async (req, res) => {
  try {
    const motivo = motivoParaNaoPerguntar(req);
    const minha = await prisma.avaliacao.findUnique({
      where: { tenantId_usuarioId: { tenantId: req.tenant.id, usuarioId: req.authUserId } },
      select: { nota: true, createdAt: true },
    });
    return res.json({ jaAvaliou: Boolean(minha), perguntar: !minha && !motivo, motivo: minha ? "respondeu" : motivo });
  } catch (erro) {
    console.error("[GET /avaliacoes/minha]", erro);
    return res.status(500).json({ error: "Erro ao consultar a avaliação." });
  }
});

const avaliacaoSchema = z.object({
  nota: z.number().int().min(1).max(5),
  comentario: z.string().trim().max(2000).optional().nullable(),
  tela: z.string().trim().max(200).optional().nullable(),
  /* "Pode publicar na página da Omnimob". A tela só oferece com 4+ estrelas e
     comentário; o servidor confere de novo, e fora disso grava `false`. */
  permitePublicar: z.boolean().optional(),
});

avaliacaoRouter.post("/", async (req, res) => {
  const motivo = motivoParaNaoPerguntar(req);
  if (motivo === "suporte") {
    return res.status(403).json({ error: "A avaliação é do cliente; a equipe da Omnimob não responde por ele." });
  }
  const lido = avaliacaoSchema.safeParse(req.body || {});
  if (!lido.success) return res.status(400).json({ error: "Escolha de 1 a 5 estrelas.", details: lido.error.flatten() });
  const { nota, comentario } = lido.data;
  const permitePublicar = Boolean(lido.data.permitePublicar) &&
    podeConsentir({ nota, comentario, trial: motivo === "trial" || motivo === "demonstracao" });
  try {
    const criada = await prisma.avaliacao.create({
      data: {
        tenantId: req.tenant.id,
        usuarioId: req.authUserId,
        usuarioNome: req.authUserNome || "",
        usuarioCargo: req.authCargo?.descricao || null,
        nota,
        comentario: comentario || null,
        tela: lido.data.tela || null,
        permitePublicar,
      },
      select: { id: true, nota: true, comentario: true, permitePublicar: true },
    });
    // Só quem pode ir para a landing gasta uma chamada de IA.
    if (permitePublicar) conferirCoerencia(prisma, criada);
    return res.status(201).json({ id: criada.id, nota: criada.nota, permitePublicar });
  } catch (erro) {
    if (erro.code === "P2002") return res.status(409).json({ error: "Você já avaliou. Obrigado!" });
    console.error("[POST /avaliacoes]", erro);
    return res.status(500).json({ error: "Erro ao gravar a avaliação." });
  }
});
