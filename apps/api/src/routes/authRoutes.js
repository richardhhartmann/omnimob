import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../db.js";
import { loginSchema } from "../validators/authValidators.js";

const JWT_SECRET = process.env.JWT_SECRET || "domus-dev-secret";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados invalidos para login.", details: parsed.error.flatten() });
    }

    const user = await prisma.user.findUnique({
      where: { username: parsed.data.username },
      include: { tenant: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Usuario ou senha invalidos." });
    }

    const passwordMatch = await bcrypt.compare(parsed.data.password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Usuario ou senha invalidos." });
    }

    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenantId, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: { id: user.id, name: user.name, username: user.username, role: user.role },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
        whatsapp: user.tenant.whatsapp,
        email: user.tenant.email,
        description: user.tenant.description,
        slogan: user.tenant.slogan,
        logoUrl: user.tenant.logoUrl,
        primaryColor: user.tenant.primaryColor,
        secondaryColor: user.tenant.secondaryColor,
        showcaseHeadline: user.tenant.showcaseHeadline,
        showcaseSubheadline: user.tenant.showcaseSubheadline,
        showcaseConfig: user.tenant.showcaseConfig,
      },
    });
  } catch {
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});
