import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { authRouter } from "./routes/authRoutes.js";
import { propertyRouter } from "./routes/propertyRoutes.js";
import { publicRouter } from "./routes/publicRoutes.js";
import { tenantRouter } from "./routes/tenantRoutes.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/tenants", tenantRouter);
app.use("/api/properties", propertyRouter);
app.use("/public", publicRouter);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Erro interno no servidor." });
});

app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`);
});
