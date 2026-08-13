import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

/* ────────────────────────────────────────────────────────────────────────────
   Chamados de suporte — lado da imobiliária.

   Sem `requirePermissao`: pedir ajuda é direito de qualquer pessoa da equipe,
   inclusive do corretor que só enxerga imóveis. Amarrar isto a uma permissão de
   gestão deixaria justamente quem mais precisa sem como falar com a gente.

   Quem LÊ todos os chamados é o super-admin, por `/api/admin/chamados`. Aqui
   cada tenant só enxerga os próprios — e o filtro vem do `req.tenant`, nunca de
   um id no corpo da requisição.
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

const abrirSchema = z.object({
  titulo: z.string().trim().min(4, "Escreva um assunto.").max(140),
  descricao: z.string().trim().min(15, "Descreva o que aconteceu.").max(4000),
  categoria: z.string().trim().max(30).optional().default("duvida"),
  prioridade: z.enum(PRIORIDADES).optional().default("MEDIA"),
  rota: z.string().trim().max(200).optional().default(""),
  /* Prints já subiram para o Cloudinary pelo navegador — aqui chegam só as
     URLs, como no cadastro de imóvel. O teto de 6 evita que um chamado vire
     um álbum, e o `.url()` barra caminho local colado por engano. */
  prints: z.array(z.string().url().max(500)).max(6).optional().default([]),
});

function serializar(c) {
  return {
    numero: c.numero,
    titulo: c.titulo,
    descricao: c.descricao,
    categoria: c.categoria,
    prioridade: c.prioridade,
    resolvido: c.resolvido,
    resolvidoEm: c.resolvidoEm,
    prints: c.prints,
    rota: c.rota,
    criadoEm: c.criadoEm,
    usuario: c.usuarioNome || "—",
  };
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

    const chamado = await prisma.chamado.create({
      data: {
        ...parsed.data,
        prioridade: prioridadeComPlano(parsed.data.prioridade, req.tenant.plano),
        tenantId: req.tenant.id,
        usuarioId: usuario?.id ?? null,
        usuarioNome: usuario ? `${usuario.nome} (${usuario.login})` : "",
      },
    });

    return res.status(201).json(serializar(chamado));
  } catch (err) {
    console.error("[chamados] falha ao abrir:", err);
    return res.status(500).json({ error: "Não foi possível registrar o chamado." });
  }
});

/** Os chamados desta imobiliária, do mais novo para o mais antigo. */
chamadoRouter.get("/", async (req, res) => {
  try {
    const chamados = await prisma.chamado.findMany({
      where: { tenantId: req.tenant.id },
      orderBy: { criadoEm: "desc" },
      take: 100,
    });
    return res.json(chamados.map(serializar));
  } catch (err) {
    console.error("[chamados] falha ao listar:", err);
    return res.status(500).json({ error: "Erro ao carregar os chamados." });
  }
});
