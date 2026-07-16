import { Router } from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { requirePermissao } from "../middlewares/permissaoMiddleware.js";
import {
  gerarConteudoImovel,
  melhorarDescricao,
  sugerirTituloDescricao,
  tiposDisponiveis,
  isAiEnabled,
} from "../services/aiService.js";

export const aiRouter = Router();

aiRouter.use(requireAuth, requireTenant);

// Lista os tipos de conteúdo que a IA sabe gerar (para o frontend montar a UI).
aiRouter.get("/tipos", (_req, res) => {
  res.json({ enabled: isAiEnabled(), tipos: tiposDisponiveis() });
});

// Gera conteúdo a partir dos dados de um imóvel (salvo OU rascunho no formulário).
// body: { imovel: {...campos}, tipos?: string[] }
aiRouter.post("/imovel/conteudo", requirePermissao("gerenciarImoveis"), async (req, res) => {
  try {
    if (!isAiEnabled()) {
      return res.status(503).json({ error: "IA indisponível: GEMINI_API_KEY não configurada." });
    }
    const { imovel, tipos } = req.body || {};
    if (!imovel || typeof imovel !== "object") {
      return res.status(400).json({ error: "Campo 'imovel' é obrigatório." });
    }
    const { resultados, erros } = await gerarConteudoImovel(imovel, tipos);
    return res.json({ resultados, erros });
  } catch (err) {
    console.error("[POST /ai/imovel/conteudo]", err);
    return res.status(500).json({ error: "Erro ao gerar conteúdo.", detail: err.message });
  }
});

// Sugere título + descrição a partir das FOTOS + dados (multimodal).
// body: { imovel: {...campos}, imagens?: [{base64,mimeType} | {url}] }
aiRouter.post("/imovel/sugerir", requirePermissao("gerenciarImoveis"), async (req, res) => {
  try {
    if (!isAiEnabled()) {
      return res.status(503).json({ error: "IA indisponível: GEMINI_API_KEY não configurada." });
    }
    const { imovel, imagens, tiposDisponiveis } = req.body || {};
    if (!imovel || typeof imovel !== "object") {
      return res.status(400).json({ error: "Campo 'imovel' é obrigatório." });
    }
    const sugestao = await sugerirTituloDescricao(imovel, Array.isArray(imagens) ? imagens : [], Array.isArray(tiposDisponiveis) ? tiposDisponiveis : []);
    return res.json(sugestao);
  } catch (err) {
    console.error("[POST /ai/imovel/sugerir]", err);
    return res.status(500).json({ error: "Erro ao gerar sugestão.", detail: err.message });
  }
});

// Melhora/reescreve uma descrição existente.
// body: { texto: string, imovel?: {...campos} }
aiRouter.post("/imovel/melhorar-descricao", requirePermissao("gerenciarImoveis"), async (req, res) => {
  try {
    if (!isAiEnabled()) {
      return res.status(503).json({ error: "IA indisponível: GEMINI_API_KEY não configurada." });
    }
    const { texto, imovel } = req.body || {};
    if (!texto || typeof texto !== "string") {
      return res.status(400).json({ error: "Campo 'texto' é obrigatório." });
    }
    const resultado = await melhorarDescricao(texto, imovel || {});
    return res.json({ resultado });
  } catch (err) {
    console.error("[POST /ai/imovel/melhorar-descricao]", err);
    return res.status(500).json({ error: "Erro ao melhorar descrição.", detail: err.message });
  }
});
