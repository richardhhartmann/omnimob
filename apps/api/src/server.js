import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import { adminRouter } from "./routes/adminRoutes.js";
import { aiRouter } from "./routes/aiRoutes.js";
import { authRouter } from "./routes/authRoutes.js";
import { cargoRouter } from "./routes/cargoRoutes.js";
import { clienteRouter } from "./routes/clienteRoutes.js";
import { leadRouter } from "./routes/leadRoutes.js";
import { propertyRouter } from "./routes/propertyRoutes.js";
import { publicRouter } from "./routes/publicRoutes.js";
import { stripeWebhookRouter } from "./routes/stripeWebhookRoutes.js";
import { iniciarFaxinaAutomatica } from "./services/faxinaScheduler.js";
import { socialRouter } from "./routes/socialRoutes.js";
import { socialWebhookRouter } from "./routes/socialWebhookRoutes.js";
import { tenantRouter } from "./routes/tenantRoutes.js";
import { usuarioRouter } from "./routes/usuarioRoutes.js";
import { getHealth } from "./services/healthService.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);

app.set("trust proxy", 1);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      
      if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Webhook do Meta — montado ANTES do express.json() e com corpo cru, pois a
// validação de assinatura (X-Hub-Signature-256) exige o body sem parsing.
app.use("/api/social/webhook", express.raw({ type: "*/*" }), socialWebhookRouter);
// Mesmo motivo: a assinatura do Stripe é sobre os bytes crus do corpo.
app.use("/api/webhooks/stripe", express.raw({ type: "*/*" }), stripeWebhookRouter);

// Limite maior que o padrão (100kb) para acomodar imagens em base64 enviadas
// à IA (rota /api/ai/imovel/sugerir). Demais rotas continuam pequenas.
app.use(express.json({ limit: "12mb" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: "Muitas tentativas de login. Tente novamente em 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);

app.get("/health", async (_req, res) => {
  const health = await getHealth();
  res.status(health.status === "ok" ? 200 : 503).json(health);
});

app.use("/api/admin", adminRouter);
app.use("/api/auth", authLimiter, authRouter);
app.use("/api/tenants", tenantRouter);
app.use("/api/properties", propertyRouter);
app.use("/api/leads", leadRouter);
app.use("/api/usuarios", usuarioRouter);
app.use("/api/cargos", cargoRouter);
app.use("/api/clientes", clienteRouter);
app.use("/api/social", socialRouter);
app.use("/api/ai", aiRouter);
app.use("/public", publicRouter);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Erro interno no servidor." });
});

app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`);
  // Só liga com FAXINA_AUTOMATICA=true — ver o porquê em faxinaScheduler.js.
  iniciarFaxinaAutomatica();
});