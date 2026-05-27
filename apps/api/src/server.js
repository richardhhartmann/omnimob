import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import { authRouter } from "./routes/authRoutes.js";
import { cargoRouter } from "./routes/cargoRoutes.js";
import { clienteRouter } from "./routes/clienteRoutes.js";
import { leadRouter } from "./routes/leadRoutes.js";
import { propertyRouter } from "./routes/propertyRoutes.js";
import { publicRouter } from "./routes/publicRoutes.js";
import { tenantRouter } from "./routes/tenantRoutes.js";
import { usuarioRouter } from "./routes/usuarioRoutes.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      // Em desenvolvimento, qualquer localhost é permitido
      if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Muitas tentativas de login. Tente novamente em 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authLimiter, authRouter);
app.use("/api/tenants", tenantRouter);
app.use("/api/properties", propertyRouter);
app.use("/api/leads", leadRouter);
app.use("/api/usuarios", usuarioRouter);
app.use("/api/cargos", cargoRouter);
app.use("/api/clientes", clienteRouter);
app.use("/public", publicRouter);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Erro interno no servidor." });
});

app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`);
});
