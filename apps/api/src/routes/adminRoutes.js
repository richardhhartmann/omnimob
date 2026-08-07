import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { prisma } from "../db.js";
import { requireSuperAdmin } from "../middlewares/superAdminMiddleware.js";
import { provisionTenant } from "../services/provisioningService.js";
import { limparTrials, fidelizarTrial } from "../services/trialService.js";
import { cancelarAssinaturasDoSlug } from "../services/pagamentoService.js";

const JWT_SECRET = process.env.JWT_SECRET || "domus-dev-secret";

const STATUS_VALIDOS = ["TRIAL", "EM_DIA", "ATRASADO", "CANCELADO"];

export const adminRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Tente novamente em 15 minutos." },
});

// ─── Login super-admin (usuario armazenado no banco) ─────────────────────────
adminRouter.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, senha } = req.body || {};
    if (!email || !senha) return res.status(400).json({ error: "Email e senha sao obrigatorios." });

    const admin = await prisma.superAdmin.findUnique({ where: { email } });
    if (!admin || !admin.ativo) return res.status(401).json({ error: "Credenciais invalidas." });

    const ok = await bcrypt.compare(senha, admin.senha);
    if (!ok) return res.status(401).json({ error: "Credenciais invalidas." });

    const token = jwt.sign({ role: "SUPERADMIN", superAdminId: admin.id, email: admin.email }, JWT_SECRET, { expiresIn: "7d" });
    return res.json({ token, email: admin.email, nome: admin.nome });
  } catch (err) {
    console.error("[POST /admin/login]", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});

// Tudo abaixo exige super-admin.
adminRouter.use(requireSuperAdmin);

function serializeTenant(t) {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    email: t.email,
    whatsapp: t.whatsapp,
    cnpj: t.cnpj,
    creci: t.creci,
    cidade: t.cidade,
    estado: t.estado,
    ativo: t.ativo,
    plano: t.plano,
    statusPagamento: t.statusPagamento,
    proximoVencimento: t.proximoVencimento,
    valorMensal: t.valorMensal != null ? Number(t.valorMensal) : null,
    createdAt: t.createdAt,
    usuarios: t._count?.usuarios ?? 0,
    properties: t._count?.properties ?? 0,
  };
}

const withCount = { _count: { select: { usuarios: true, properties: true } } };

adminRouter.get("/tenants", async (_req, res) => {
  try {
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: withCount,
    });
    res.json(tenants.map(serializeTenant));
  } catch (err) {
    console.error("[GET /admin/tenants]", err);
    res.status(500).json({ error: "Erro ao listar tenants." });
  }
});

adminRouter.get("/tenants/:id", async (req, res) => {
  try {
    const t = await prisma.tenant.findUnique({ where: { id: req.params.id }, include: withCount });
    if (!t) return res.status(404).json({ error: "Tenant nao encontrado." });
    res.json(serializeTenant(t));
  } catch (err) {
    console.error("[GET /admin/tenants/:id]", err);
    res.status(500).json({ error: "Erro ao buscar tenant." });
  }
});

adminRouter.post("/tenants", async (req, res) => {
  try {
    const { tenant, warning } = await provisionTenant(req.body || {});
    res.status(201).json({ id: tenant.id, slug: tenant.slug, warning });
  } catch (err) {
    if (err.code === "SLUG_INVALIDO") return res.status(400).json({ error: err.message });
    if (err.code === "SLUG_EM_USO") return res.status(409).json({ error: err.message });
    console.error("[POST /admin/tenants]", err);
    res.status(500).json({ error: "Erro ao criar tenant.", detail: err.message });
  }
});

adminRouter.put("/tenants/:id", async (req, res) => {
  try {
    const b = req.body || {};
    const data = {};
    for (const k of ["name", "email", "whatsapp", "cnpj", "creci", "cidade", "estado", "plano"]) {
      if (k in b) data[k] = b[k];
    }
    if ("ativo" in b) data.ativo = Boolean(b.ativo);
    if ("statusPagamento" in b && STATUS_VALIDOS.includes(b.statusPagamento)) data.statusPagamento = b.statusPagamento;
    if ("valorMensal" in b) data.valorMensal = b.valorMensal === "" || b.valorMensal == null ? null : Number(b.valorMensal);
    if ("proximoVencimento" in b) data.proximoVencimento = b.proximoVencimento ? new Date(b.proximoVencimento) : null;

    const t = await prisma.tenant.update({ where: { id: req.params.id }, data });
    res.json({ id: t.id });
  } catch (err) {
    console.error("[PUT /admin/tenants/:id]", err);
    res.status(500).json({ error: "Erro ao atualizar tenant.", detail: err.message });
  }
});

/* Excluir o tenant é excluir também a cobrança dele.

   A ORDEM IMPORTA: cancela no Stripe ANTES de apagar a linha. Depois de
   `tenant.delete()` o slug já não existe, e o slug é justamente a chave que
   casa a assinatura lá (fica em `metadata.slug`) — invertendo, sobraria uma
   assinatura ativa cobrando todo mês por um ambiente que não existe mais, e
   sem nada no nosso lado apontando para ela.

   Falha no Stripe NÃO impede a exclusão: o pedido do administrador é apagar o
   tenant, e travar isso porque uma API de terceiro caiu deixaria o painel
   refém. O que sobra vai no corpo da resposta (`stripe`), para a tela poder
   avisar que aquela assinatura precisa de um cancelamento manual — silenciar
   seria pior que falhar. */
adminRouter.delete("/tenants/:id", async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      select: { id: true, slug: true },
    });
    if (!tenant) return res.status(404).json({ error: "Tenant não encontrado." });

    let stripeResultado = { configurado: false, encontradas: 0, canceladas: [], falhas: [] };
    try {
      stripeResultado = await cancelarAssinaturasDoSlug(tenant.slug);
    } catch (erro) {
      console.error(`[DELETE /admin/tenants] Stripe falhou para "${tenant.slug}":`, erro.message);
      stripeResultado = { configurado: true, encontradas: null, canceladas: [], falhas: [{ motivo: erro.message }] };
    }

    await prisma.tenant.delete({ where: { id: tenant.id } });

    return res.json({
      excluido: true,
      slug: tenant.slug,
      stripe: stripeResultado,
    });
  } catch (err) {
    console.error("[DELETE /admin/tenants/:id]", err);
    res.status(500).json({ error: "Erro ao excluir tenant.", detail: err.message });
  }
});

/* ── Trials ──────────────────────────────────────────────────────────────────
   Faxina dos testes vencidos. O padrão é ENSAIO: só relata o que seria feito.
   A remoção é irreversível e cascateia para imóveis, fotos, leads e usuários,
   então exige `aplicar: true` explícito no corpo. Enquanto não houver agendador
   no projeto, isto é chamado à mão — e depois é só pendurar num cron. */
adminRouter.post("/trials/faxina", async (req, res) => {
  try {
    const aplicar = req.body?.aplicar === true;
    const resultado = await limparTrials({ aplicar });
    res.json({
      aplicado: resultado.aplicado,
      totalDesativados: resultado.desativados.length,
      totalRemovidos: resultado.removidos.length,
      desativados: resultado.desativados,
      removidos: resultado.removidos,
    });
  } catch (err) {
    console.error("[POST /admin/trials/faxina]", err);
    res.status(500).json({ error: "Erro na faxina de trials.", detail: err.message });
  }
});

/* ── Chamados ────────────────────────────────────────────────────────────────
   A caixa de entrada do suporte. Diferente do lado da imobiliária, aqui vêm
   TODOS os tenants — é a tela em que se decide o que atender primeiro.

   A ordenação é por não-resolvido primeiro e depois por data: prioridade alta
   de um chamado já fechado não pode empurrar para baixo uma dúvida aberta. */
adminRouter.get("/chamados", async (req, res) => {
  try {
    const { resolvido, tenantId } = req.query;
    const where = {};
    if (resolvido === "true") where.resolvido = true;
    if (resolvido === "false") where.resolvido = false;
    if (tenantId) where.tenantId = String(tenantId);

    const chamados = await prisma.chamado.findMany({
      where,
      orderBy: [{ resolvido: "asc" }, { criadoEm: "desc" }],
      take: 300,
      include: { tenant: { select: { name: true, slug: true } } },
    });

    res.json(
      chamados.map((c) => ({
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
        tenantId: c.tenantId,
        tenantNome: c.tenant?.name || "—",
        tenantSlug: c.tenant?.slug || "",
      })),
    );
  } catch (err) {
    console.error("[GET /admin/chamados]", err);
    res.status(500).json({ error: "Erro ao listar chamados." });
  }
});

/* Marcar resolvido e/ou repriorizar. `resolvidoEm` é derivado, nunca recebido:
   é o servidor que sabe quando o clique aconteceu, e deixar a data vir do
   cliente permitiria um histórico que não bate com os fatos. */
adminRouter.patch("/chamados/:numero", async (req, res) => {
  const numero = Number(req.params.numero);
  if (!Number.isInteger(numero)) return res.status(400).json({ error: "Número inválido." });

  try {
    const data = {};
    if ("resolvido" in (req.body || {})) {
      data.resolvido = Boolean(req.body.resolvido);
      data.resolvidoEm = data.resolvido ? new Date() : null;
    }
    if (req.body?.prioridade && ["BAIXA", "MEDIA", "ALTA", "URGENTE"].includes(req.body.prioridade)) {
      data.prioridade = req.body.prioridade;
    }
    if (!Object.keys(data).length) return res.status(400).json({ error: "Nada para atualizar." });

    const c = await prisma.chamado.update({ where: { numero }, data });
    res.json({ numero: c.numero, resolvido: c.resolvido, prioridade: c.prioridade, resolvidoEm: c.resolvidoEm });
  } catch (err) {
    console.error("[PATCH /admin/chamados/:numero]", err);
    res.status(500).json({ error: "Erro ao atualizar o chamado." });
  }
});

/* ── Progresso dos tutoriais ─────────────────────────────────────────────────
   Devolve o PROGRESSO BRUTO, por usuário: as etapas registradas e o status de
   cada uma. Quem transforma isso em porcentagem é a tela.

   Isso não é preguiça — é onde a informação existe. O denominador (quantas
   etapas ESTE usuário deveria ver) depende do fluxo declarado em
   `utils/tourFluxo.js` e das permissões do cargo dele, e o fluxo mora no front
   justamente porque depende das rotas do painel. Calcular a porcentagem aqui
   exigiria uma segunda cópia dessa lista, fadada a divergir da primeira no dia
   em que uma etapa nova entrar. Por isso mandamos junto o cargo inteiro: é o
   que a tela precisa para montar o fluxo daquele usuário. */
adminRouter.get("/tutoriais", async (_req, res) => {
  try {
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        usuarios: {
          where: { ativo: true },
          orderBy: { nome: "asc" },
          select: {
            id: true,
            nome: true,
            login: true,
            cargo: true,
            tutorial: { select: { etapa: true, status: true, passoParou: true, totalPassos: true, atualizadoEm: true } },
          },
        },
      },
    });

    res.json(
      tenants.map((t) => ({
        id: t.id,
        nome: t.name,
        slug: t.slug,
        usuarios: t.usuarios.map((u) => ({
          id: u.id,
          nome: u.nome,
          login: u.login,
          cargo: u.cargo,
          etapas: u.tutorial,
        })),
      })),
    );
  } catch (err) {
    console.error("[GET /admin/tutoriais]", err);
    res.status(500).json({ error: "Erro ao carregar o progresso dos tutoriais." });
  }
});

// Converte um teste em cliente pagante. Nenhum dado se move: o tenant já vive
// no lugar definitivo desde que nasceu.
adminRouter.post("/tenants/:id/fidelizar", async (req, res) => {
  try {
    const { plano, valorMensal, proximoVencimento } = req.body || {};
    const tenant = await fidelizarTrial(req.params.id, { plano, valorMensal, proximoVencimento });
    res.json({ tenant });
  } catch (err) {
    console.error("[POST /admin/tenants/:id/fidelizar]", err);
    res.status(500).json({ error: "Erro ao fidelizar tenant.", detail: err.message });
  }
});
