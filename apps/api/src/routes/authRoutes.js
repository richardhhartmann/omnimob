import { Router } from "express";
import { prisma } from "../db.js";
import { loginSchema } from "../validators/authValidators.js";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados invalidos para login.", details: parsed.error.flatten() });
  }

  const user = await prisma.user.findUnique({
    where: { username: parsed.data.username },
    include: { tenant: true },
  });

  if (!user || !user.isActive || user.password !== parsed.data.password) {
    return res.status(401).json({ error: "Usuario ou senha invalidos." });
  }

  return res.json({
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
});
