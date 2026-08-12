import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "./db.js";
import { adminRouter } from "./routes/adminRoutes.js";
import { aiRouter } from "./routes/aiRoutes.js";
import { authRouter } from "./routes/authRoutes.js";
import { cargoRouter } from "./routes/cargoRoutes.js";
import { chamadoRouter } from "./routes/chamadoRoutes.js";
import { importacaoRouter } from "./routes/importacaoRoutes.js";
import { clienteRouter } from "./routes/clienteRoutes.js";
import { leadRouter } from "./routes/leadRoutes.js";
import { propertyRouter } from "./routes/propertyRoutes.js";
import { publicRouter } from "./routes/publicRoutes.js";
import { previaRouter } from "./routes/previaRoutes.js";
import { stripeWebhookRouter } from "./routes/stripeWebhookRoutes.js";
import { iniciarFaxinaAutomatica } from "./services/faxinaScheduler.js";
import { socialRouter } from "./routes/socialRoutes.js";
import { socialWebhookRouter } from "./routes/socialWebhookRoutes.js";
import { tenantRouter } from "./routes/tenantRoutes.js";
import { tutorialRouter } from "./routes/tutorialRoutes.js";
import { usuarioRouter } from "./routes/usuarioRoutes.js";
import { getHealth } from "./services/healthService.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);

app.set("trust proxy", 1);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : [];

/* O atalho de localhost existe porque o Vite troca de porta sozinho quando a
   5173 está ocupada, e ninguém quer editar ALLOWED_ORIGINS por causa disso.
   Mas ele vale só fora de produção: com `credentials: true`, uma origem
   permitida pode ler resposta autenticada, e "qualquer localhost" é uma porta
   aberta que não tem por que existir no servidor público. Em produção manda a
   lista, e só ela. */
const ehProducao = process.env.NODE_ENV === "production";

/* ─── Domínios próprios das imobiliárias ─────────────────────────────────────
   Quando uma imobiliária traz o domínio dela, a vitrine passa a ser servida em
   `imobiliaria.com.br` e o navegador chama a API com ESSA origem — que não está
   (nem poderia estar) na lista fixa do ALLOWED_ORIGINS.

   Consultar o banco a cada preflight seria caro: hoje uma consulta trivial leva
   ~900 ms em produção, e preflight acontece antes de praticamente toda
   requisição. Então mantemos a lista em memória e recarregamos por tempo.

   A janela é curta porque o custo de estar desatualizado é assimétrico: um
   domínio recém-ativado que ainda não entrou no cache só falha por menos de um
   minuto, enquanto um cache longo faria a vitrine do cliente parecer quebrada
   logo depois de ele configurar tudo certo. */
const JANELA_DOMINIOS_MS = 60_000;
let dominiosCache = { em: 0, lista: [] };

/* Subdomínios da própria casa: `<slug>.omnimob.app`.

   Cada vitrine servida por subdomínio chama esta API com aquela origem, que não
   está (nem faria sentido estar) na lista fixa. Consultar o banco por tenant
   seria absurdo: o subdomínio JÁ é nosso por construção — ninguém de fora
   consegue um endereço abaixo de omnimob.app, porque o DNS é nosso.

   Por isso vale a forma, não a lista. Um rótulo só, sem ponto no meio: assim
   `a.b.omnimob.app` não passa. */
const RAIZ_VITRINE = (process.env.VITRINE_DOMINIO_RAIZ || "omnimob.app").replace(/\./g, "\\.");
const SUBDOMINIO_NOSSO = new RegExp(`^https://[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.${RAIZ_VITRINE}$`);

async function dominiosDeClientes() {
  if (Date.now() - dominiosCache.em < JANELA_DOMINIOS_MS) return dominiosCache.lista;
  try {
    const linhas = await prisma.tenant.findMany({
      where: { dominioStatus: "ATIVO", dominioProprio: { not: null }, ativo: true },
      select: { dominioProprio: true },
    });
    // Cada domínio vale por si e pelo www — a Vercel serve os dois, e o cliente
    // pode ter divulgado qualquer um dos dois.
    const lista = linhas.flatMap((l) => [
      `https://${l.dominioProprio}`,
      `https://www.${l.dominioProprio}`,
    ]);
    dominiosCache = { em: Date.now(), lista };
    return lista;
  } catch (erro) {
    // Banco fora do ar não pode derrubar o CORS de quem já estava na lista fixa:
    // devolvemos o último cache conhecido e seguimos.
    console.warn(`[cors] não consegui recarregar domínios de clientes: ${erro.message}`);
    return dominiosCache.lista;
  }
}

app.use(
  cors({
    origin: async (origin, callback) => {
      if (!origin) return callback(null, true);

      if (!ehProducao && /^http:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (SUBDOMINIO_NOSSO.test(origin)) return callback(null, true);
      if ((await dominiosDeClientes()).includes(origin)) return callback(null, true);
      // Diagnóstico: sem isto, "Not allowed by CORS" não diz qual origem chegou
      // nem o que o servidor considera permitido — impossível de depurar no Render.
      console.warn(
        `[cors] Origin recusada: "${origin}" — permitidas: ${allowedOrigins.join(", ") || "(nenhuma)"}`
      );
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
app.use("/api/tutorial", tutorialRouter);
app.use("/api/chamados", chamadoRouter);
app.use("/api/importacao", importacaoRouter);
app.use("/api/cargos", cargoRouter);
app.use("/api/clientes", clienteRouter);
app.use("/api/social", socialRouter);
app.use("/api/ai", aiRouter);
app.use("/public", publicRouter);
/* Prévia de link para robôs de rede social. Montado ANTES de qualquer coisa que
   pudesse capturar `/previa/*`, e fora do `publicRouter` porque devolve HTML, e
   não JSON — misturar os dois no mesmo router faria o tratamento de erro comum
   responder JSON para um robô que só entende marcação. */
app.use("/previa", previaRouter);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Erro interno no servidor." });
});

app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`);
  // Só liga com FAXINA_AUTOMATICA=true — ver o porquê em faxinaScheduler.js.
  iniciarFaxinaAutomatica();
});