import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { prisma } from "../db.js";
import { requireSuperAdmin } from "../middlewares/superAdminMiddleware.js";

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
    const b = req.body || {};
    if (!b.name || !b.slug) return res.status(400).json({ error: "Nome e slug sao obrigatorios." });
    if (!/^[a-z0-9-]+$/.test(b.slug)) {
      return res.status(400).json({ error: "Slug invalido (use minusculas, numeros e hifens)." });
    }
    const exists = await prisma.tenant.findUnique({ where: { slug: b.slug } });
    if (exists) return res.status(409).json({ error: "Ja existe um tenant com esse slug." });

    const tenant = await prisma.tenant.create({
      data: {
        name: b.name,
        slug: b.slug,
        email: b.email || "",
        whatsapp: b.whatsapp || "",
        plano: b.plano || null,
        statusPagamento: STATUS_VALIDOS.includes(b.statusPagamento) ? b.statusPagamento : "TRIAL",
        valorMensal: b.valorMensal != null && b.valorMensal !== "" ? Number(b.valorMensal) : null,
        proximoVencimento: b.proximoVencimento ? new Date(b.proximoVencimento) : null,
      },
    });

    // Opcional: cria um usuario administrador inicial para o tenant.
    let warning = null;
    if (b.adminLogin && b.adminSenha) {
      try {
        const cargo = await prisma.cargo.findFirst({ where: { descricao: "Administrador" } });
        if (!cargo) {
          warning = "Tenant criado, mas cargo 'Administrador' nao existe (rode o seed base).";
        } else {
          const senhaHash = await bcrypt.hash(b.adminSenha, 10);
          await prisma.usuario.create({
            data: { login: b.adminLogin, nome: `Admin ${b.name}`, senha: senhaHash, tenantId: tenant.id, cargoCodigo: cargo.id, ativo: true },
          });
        }
      } catch (e) {
        warning = `Tenant criado, mas falha ao criar usuario admin: ${e.code === "P2002" ? "login ja existe" : e.message}`;
      }
    }
    res.status(201).json({ id: tenant.id, slug: tenant.slug, warning });
  } catch (err) {
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

adminRouter.delete("/tenants/:id", async (req, res) => {
  try {
    await prisma.tenant.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    console.error("[DELETE /admin/tenants/:id]", err);
    res.status(500).json({ error: "Erro ao excluir tenant.", detail: err.message });
  }
});
