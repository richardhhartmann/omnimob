import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { requirePermissao } from "../middlewares/permissaoMiddleware.js";
import { requirePlanoIA } from "../middlewares/planoMiddleware.js";
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

// Daqui para baixo, todo recurso de IA exige plano Premium.
aiRouter.use(requirePlanoIA);

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

/* ── Reescrita em massa do acervo ─────────────────────────────────────────────
   Rodar a IA sobre dezenas de imóveis de uma vez. Inútil para quem tem quinze
   imóveis; decisivo para quem tem trezentos — que é o acervo do público que a
   gente quer no Premium.

   DOIS PASSOS, e não um. Gerar e salvar na mesma requisição significaria
   sobrescrever trinta descrições escritas à mão sem ninguém ter lido uma linha
   do que entrou no lugar — e o texto antigo não volta. Aqui o POST só GERA e
   devolve antes/depois; o PUT salva o que a pessoa aprovou.

   Isso custa uma chamada de IA só (a do POST): o PUT recebe os textos prontos,
   não gera nada. */

const TETO_MASSA = 25;

aiRouter.post("/imovel/massa", requirePermissao("gerenciarImoveis"), async (req, res) => {
  try {
    if (!isAiEnabled()) {
      return res.status(503).json({ error: "IA indisponível: GEMINI_API_KEY não configurada." });
    }
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x) => typeof x === "string") : [];
    if (!ids.length) return res.status(400).json({ error: "Envie ao menos um imóvel." });
    if (ids.length > TETO_MASSA) {
      return res.status(400).json({ error: `Máximo de ${TETO_MASSA} imóveis por vez.` });
    }

    /* O `where` filtra por tenant ANTES de qualquer coisa: os ids vêm do corpo
       da requisição, e id vindo do cliente é a porta de entrada clássica para
       mexer no imóvel de outra imobiliária. Quem não for do tenant simplesmente
       não volta da consulta. */
    const imoveis = await prisma.property.findMany({
      where: { id: { in: ids }, tenantId: req.tenant.id },
      include: { atributos: { include: { atributo: true } } },
    });

    /* Um de cada vez, de propósito. Vinte e cinco chamadas simultâneas ao
       Gemini batem no limite de taxa da conta e voltam 429 em bloco — o que
       transformaria uma reescrita parcial numa falha inteira. Em série é mais
       lento e termina. */
    const resultados = [];
    for (const im of imoveis) {
      const ficha = {
        ...im,
        price: Number(im.price),
        atributos: im.atributos.map((a) => a.atributo?.descricao).filter(Boolean),
      };
      try {
        const texto = (im.description || "").trim();
        // Sem descrição não há o que "melhorar": aí a IA escreve do zero, a
        // partir da ficha. Mandar string vazia para melhorarDescricao devolveria
        // um texto genérico sobre nada.
        const nova = texto
          ? await melhorarDescricao(texto, ficha)
          : (await gerarConteudoImovel(ficha, ["descricao"])).resultados?.descricao || "";
        resultados.push({ id: im.id, title: im.title, antes: texto, depois: String(nova || "").trim() });
      } catch (err) {
        resultados.push({ id: im.id, title: im.title, erro: err.message });
      }
    }

    return res.json({ resultados });
  } catch (err) {
    console.error("[POST /ai/imovel/massa]", err);
    return res.status(500).json({ error: "Erro na reescrita em massa.", detail: err.message });
  }
});

/** Salva as descrições aprovadas. Não chama IA — recebe texto pronto. */
aiRouter.put("/imovel/massa", requirePermissao("gerenciarImoveis"), async (req, res) => {
  try {
    const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];
    const validos = itens.filter(
      (i) => i && typeof i.id === "string" && typeof i.descricao === "string" && i.descricao.trim(),
    );
    if (!validos.length) return res.status(400).json({ error: "Nada para salvar." });
    if (validos.length > TETO_MASSA) {
      return res.status(400).json({ error: `Máximo de ${TETO_MASSA} imóveis por vez.` });
    }

    /* updateMany com tenantId no where, um por item: `update` pelo id sozinho
       gravaria no imóvel de qualquer imobiliária que mandasse o id certo. O
       count de retorno é 0 quando o id não é deste tenant, e é assim que a
       resposta diz quantos realmente mudaram. */
    let salvos = 0;
    for (const item of validos) {
      const r = await prisma.property.updateMany({
        where: { id: item.id, tenantId: req.tenant.id },
        data: { description: item.descricao.trim() },
      });
      salvos += r.count;
    }

    return res.json({ salvos });
  } catch (err) {
    console.error("[PUT /ai/imovel/massa]", err);
    return res.status(500).json({ error: "Erro ao salvar as descrições.", detail: err.message });
  }
});
