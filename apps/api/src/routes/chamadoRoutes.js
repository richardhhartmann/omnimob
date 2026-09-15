import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import {
  COM_CONTAGEM,
  COM_CONVERSA,
  mudarStatus,
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

/* A forma é a de `services/chamados.js`, a mesma que o super-admin lê: os
   dois lados olham para o mesmo chamado, e duas serializações divergiriam
   no primeiro campo novo. */
const serializar = serializarChamado;

/* Quem está falando, com o login — como `usuarioNome` no chamado. */
async function nomeDeQuemFala(req) {
  const usuario = await prisma.usuario.findFirst({
    where: { id: req.authUserId, tenantId: req.tenant.id },
    select: { nome: true, login: true },
  });
  return usuario ? `${usuario.nome} (${usuario.login})` : "Cliente";
}

/* `findFirst` com o tenant junto, e não `findUnique` pelo número: o número é
   sequencial e global — o #12 de uma imobiliária é vizinho do #13 de outra.
   Fora do tenant, responde 404: não existe, para quem pergunta. */
async function chamadoDoTenant(req, include) {
  const numero = Number(req.params.numero);
  if (!Number.isInteger(numero)) return null;
  return prisma.chamado.findFirst({ where: { numero, tenantId: req.tenant.id }, include });
}

const responderSchema = z.object({
  texto: z.string().trim().min(1, "Escreva a mensagem.").max(4000),
  prints: z.array(z.string().url().max(500)).max(6).optional().default([]),
});

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
      /* Abertos primeiro, e dentro de cada grupo o que mexeu por último —
         é a ordem da caixa de entrada, não a do protocolo. */
      orderBy: [{ resolvido: "asc" }, { atualizadoEm: "desc" }],
      take: 100,
      include: COM_CONTAGEM,
    });
    return res.json(chamados.map(serializar));
  } catch (err) {
    console.error("[chamados] falha ao listar:", err);
    return res.status(500).json({ error: "Erro ao carregar os chamados." });
  }
});

/** Um chamado com a conversa inteira. */
chamadoRouter.get("/:numero", async (req, res) => {
  try {
    const chamado = await chamadoDoTenant(req, COM_CONVERSA);
    if (!chamado) return res.status(404).json({ error: "Chamado não encontrado." });
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
    const chamado = await chamadoDoTenant(req);
    if (!chamado) return res.status(404).json({ error: "Chamado não encontrado." });

    const { mensagem, chamado: atualizado } = await responderComoCliente(chamado, {
      ...parsed.data,
      autorNome: await nomeDeQuemFala(req),
    });
    return res.status(201).json({ mensagem: serializarMensagem(mensagem), status: atualizado.status });
  } catch (err) {
    console.error("[chamados] falha ao responder:", err);
    return res.status(500).json({ error: "Não foi possível enviar a mensagem." });
  }
});

/** Reabrir um chamado resolvido, sem precisar escrever nada. */
chamadoRouter.post("/:numero/reabrir", async (req, res) => {
  try {
    const chamado = await chamadoDoTenant(req);
    if (!chamado) return res.status(404).json({ error: "Chamado não encontrado." });
    if (chamado.status !== "RESOLVIDO") {
      return res.status(400).json({ error: "Este chamado ainda está aberto." });
    }
    const atualizado = await mudarStatus(chamado, "ABERTO", { autorNome: await nomeDeQuemFala(req) });
    return res.json({ status: atualizado.status });
  } catch (err) {
    console.error("[chamados] falha ao reabrir:", err);
    return res.status(500).json({ error: "Não foi possível reabrir o chamado." });
  }
});
