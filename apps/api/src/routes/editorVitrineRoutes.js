import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { requirePermissao } from "../middlewares/permissaoMiddleware.js";
import { updateTenantProfileSchema } from "../validators/propertyValidators.js";

/* ────────────────────────────────────────────────────────────────────────────
   O EDITOR DE VITRINE: RASCUNHO, PUBLICAÇÃO E VERSÕES (31/10/2026).

   ── O RASCUNHO NÃO ESTÁ NO AR ──

   Antes, o autosave do editor gravava direto em `Tenant.showcaseConfig`, que é
   o que a vitrine pública desenha: um segundo depois de apagar a grade de
   imóveis para recolocá-la mais abaixo, o visitante via a página sem imóveis.
   Agora o autosave grava em `RascunhoVitrine`, e só o "Publicar" leva ao ar.

   ── DOIS EDITORES ABERTOS NÃO SE APAGAM ──

   Quem grava manda a `versao` do rascunho em que se baseou. A gravação só
   passa se ela for a que está no banco (`updateMany` com a versão no `where`,
   o que fecha a corrida de dois pedidos ao mesmo tempo); senão, 409 com quem
   gravou por último. A tela avisa e oferece recarregar — o contrário era o
   último a salvar apagar o outro em silêncio.

   ── PUBLICAR MESCLA NO QUE ESTÁ NO BANCO AGORA ──

   A tela guardava o `showcaseConfig` de quando abriu e gravava o objeto
   inteiro por cima. O que outra tela tivesse gravado ali no meio tempo (o
   assistente de boas-vindas grava `modeloEscolhido`) sumia. Aqui o servidor
   lê o config ATUAL e troca só o que o editor edita: o documento (`puck`) e
   as opções de página.

   ── VERSÕES ──

   Cada publicação vira uma `VersaoVitrine`, no servidor: voltar a algo de
   ontem funciona em qualquer computador. Restaurar não publica — a versão
   volta como rascunho, e a pessoa confere e publica.

   O rascunho e as versões ficam FORA da trilha de auditoria de propósito
   (`services/auditoria.js` não os lista): o autosave grava a cada segundo de
   silêncio. A publicação entra, porque ela altera o `Tenant`.
   ──────────────────────────────────────────────────────────────────────────── */

export const editorVitrineRouter = Router();
editorVitrineRouter.use(requireAuth, requireTenant, requirePermissao("editarPagina"));

/* Teto de versões guardadas por imobiliária: as mais antigas saem. */
export const MAXIMO_VERSOES = 30;
/* Teto do documento. Uma vitrine grande tem algumas dezenas de kB; o teto é
   contra lixo, não contra o cliente. */
const MAXIMO_BYTES = 2_000_000;

/* As opções de página que o editor pode levar ao nível de cima do
   `showcaseConfig`. Lista FECHADA: sem ela, um corpo forjado poderia gravar
   `puck`, `widgets` ou `layout` por este caminho. Quem calcula os valores é a
   tela (`opcoesDaPagina` no `VitrinePuckPage`). */
const OPCOES_DA_PAGINA = new Set([
  "appearanceMode", "globalFont", "zebrado", "zebraEstilo", "cabecalhoFixo", "larguraLivre",
  "espacamento", "larguraDasPecas", "corPrimaria", "corSecundaria", "herdarCoresDoPainel",
]);
/* O cadastro que a prancheta edita: a raiz da Página (logo, slogan, descrição,
   WhatsApp, e-mail) e os textos `form|` da ponte (manchete e submanchete). São
   colunas do `Tenant`, não documento — ver o cabeçalho de `puck/PonteDeEdicao`. */
const CAMPOS_DO_CADASTRO = ["logoUrl", "slogan", "description", "whatsapp", "email", "showcaseHeadline", "showcaseSubheadline"];

const objetoSimples = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);

/** O corpo do rascunho pronto para gravar, ou `{ erro }`. */
export function normalizarRascunho(corpo) {
  if (!objetoSimples(corpo)) return { erro: "Corpo inválido." };
  const { documento, opcoes = {}, cadastro = {}, versao } = corpo;
  if (!objetoSimples(documento) || !Array.isArray(documento.content)) return { erro: "Documento inválido." };
  if (documento.root !== undefined && !objetoSimples(documento.root)) return { erro: "Documento inválido." };
  if (!Number.isInteger(versao) || versao < 0) return { erro: "Versão inválida." };
  if (!objetoSimples(opcoes) || !objetoSimples(cadastro)) return { erro: "Opções ou cadastro inválidos." };

  const opcoesLimpas = {};
  for (const [chave, valor] of Object.entries(opcoes)) {
    if (!OPCOES_DA_PAGINA.has(chave)) return { erro: `Opção de página desconhecida: ${chave}.` };
    opcoesLimpas[chave] = valor;
  }
  const cadastroLimpo = {};
  for (const [chave, valor] of Object.entries(cadastro)) {
    if (!CAMPOS_DO_CADASTRO.includes(chave)) return { erro: `Campo de cadastro desconhecido: ${chave}.` };
    cadastroLimpo[chave] = valor;
  }
  /* O cadastro passa pela MESMA validação do PUT /api/tenants/me (e-mail e URL
     do logo com formato), que é por onde ele era gravado antes. */
  const conferido = updateTenantProfileSchema.safeParse(cadastroLimpo);
  if (!conferido.success) return { erro: "Cadastro inválido (confira o e-mail e o endereço do logo)." };

  const doc = { content: documento.content, root: documento.root || {} };
  if (JSON.stringify(doc).length + JSON.stringify(opcoesLimpas).length > MAXIMO_BYTES) {
    return { erro: "A página ficou grande demais para gravar." };
  }
  return { documento: doc, opcoes: opcoesLimpas, cadastro: conferido.data, versao };
}

function emConflito(res, atual) {
  return res.status(409).json({
    error: atual
      ? `Esta página foi alterada em outro lugar${atual.atualizadoPorNome ? ` por ${atual.atualizadoPorNome}` : ""}. Recarregue para ver a versão mais recente.`
      : "Esta página foi publicada ou descartada em outro lugar. Recarregue para ver a versão mais recente.",
    codigo: "CONFLITO_DE_VERSAO",
    versao: atual?.versao ?? 0,
    atualizadoPorNome: atual?.atualizadoPorNome ?? null,
    atualizadoEm: atual?.atualizadoEm ?? null,
  });
}

const resumoDoRascunho = (r) => (r ? {
  documento: r.documento, opcoes: r.opcoes, cadastro: r.cadastro, versao: r.versao,
  atualizadoEm: r.atualizadoEm, atualizadoPorNome: r.atualizadoPorNome,
} : null);

/* O rascunho, se houver. O resto do que o editor precisa (imobiliária, acervo,
   o que está no ar) continua vindo do `GET /public/:slug`. */
editorVitrineRouter.get("/", async (req, res) => {
  try {
    const rascunho = await prisma.rascunhoVitrine.findUnique({ where: { tenantId: req.tenant.id } });
    return res.json({ rascunho: resumoDoRascunho(rascunho) });
  } catch (erro) {
    console.error("[editor-vitrine] ler:", erro);
    return res.status(500).json({ error: "Não consegui ler o rascunho da página." });
  }
});

/* O autosave. `versao` é a do rascunho em que a tela se baseou; 0 = "não havia
   rascunho quando abri". */
editorVitrineRouter.put("/rascunho", async (req, res) => {
  const corpo = normalizarRascunho(req.body);
  if (corpo.erro) return res.status(400).json({ error: corpo.erro });
  const tenantId = req.tenant.id;
  const dados = {
    documento: corpo.documento, opcoes: corpo.opcoes, cadastro: corpo.cadastro,
    atualizadoPorId: req.authUserId, atualizadoPorNome: req.authUserNome || null,
  };
  try {
    if (corpo.versao === 0) {
      try {
        const criado = await prisma.rascunhoVitrine.create({ data: { tenantId, versao: 1, ...dados } });
        return res.json({ versao: criado.versao, atualizadoEm: criado.atualizadoEm });
      } catch (erro) {
        // Outra aba criou o rascunho primeiro (índice único em tenantId).
        if (erro?.code !== "P2002") throw erro;
        return emConflito(res, await prisma.rascunhoVitrine.findUnique({ where: { tenantId } }));
      }
    }
    const { count } = await prisma.rascunhoVitrine.updateMany({
      where: { tenantId, versao: corpo.versao },
      data: { ...dados, versao: { increment: 1 } },
    });
    if (!count) return emConflito(res, await prisma.rascunhoVitrine.findUnique({ where: { tenantId } }));
    return res.json({ versao: corpo.versao + 1, atualizadoEm: new Date() });
  } catch (erro) {
    console.error("[editor-vitrine] rascunho:", erro);
    return res.status(500).json({ error: "Não consegui salvar o rascunho." });
  }
});

/* Descartar: o editor volta a mostrar o que está no ar. */
editorVitrineRouter.delete("/rascunho", async (req, res) => {
  try {
    await prisma.rascunhoVitrine.deleteMany({ where: { tenantId: req.tenant.id } });
    return res.json({ ok: true });
  } catch (erro) {
    console.error("[editor-vitrine] descartar:", erro);
    return res.status(500).json({ error: "Não consegui descartar o rascunho." });
  }
});

/* Leva o rascunho ao ar. Tudo numa transação: config, cadastro, versão nova e
   o rascunho apagado — meio publicado seria pior que não publicado. */
editorVitrineRouter.post("/publicar", async (req, res) => {
  const versao = req.body?.versao;
  if (!Number.isInteger(versao) || versao < 1) return res.status(400).json({ error: "Versão inválida." });
  const tenantId = req.tenant.id;
  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const rascunho = await tx.rascunhoVitrine.findUnique({ where: { tenantId } });
      if (!rascunho || rascunho.versao !== versao) return { conflito: rascunho };
      const atual = await tx.tenant.findUnique({ where: { id: tenantId }, select: { showcaseConfig: true } });
      const config = objetoSimples(atual?.showcaseConfig) ? atual.showcaseConfig : {};
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          ...rascunho.cadastro,
          showcaseConfig: { ...config, ...rascunho.opcoes, puck: rascunho.documento },
        },
      });
      const versaoNova = await tx.versaoVitrine.create({
        data: {
          tenantId, documento: rascunho.documento, opcoes: rascunho.opcoes, cadastro: rascunho.cadastro,
          publicadoPorId: req.authUserId, publicadoPorNome: req.authUserNome || null,
        },
      });
      // Só apaga se ninguém gravou no meio (a versão no `where`).
      const { count } = await tx.rascunhoVitrine.deleteMany({ where: { tenantId, versao } });
      if (!count) throw Object.assign(new Error("corrida"), { corrida: true });
      const antigas = await tx.versaoVitrine.findMany({
        where: { tenantId }, orderBy: { publicadoEm: "desc" }, skip: MAXIMO_VERSOES, select: { id: true },
      });
      if (antigas.length) await tx.versaoVitrine.deleteMany({ where: { id: { in: antigas.map((v) => v.id) } } });
      return { versao: versaoNova };
    });
    if (resultado.conflito !== undefined) return emConflito(res, resultado.conflito);
    return res.json({ publicadoEm: resultado.versao.publicadoEm, versaoId: resultado.versao.id });
  } catch (erro) {
    if (erro?.corrida) return emConflito(res, await prisma.rascunhoVitrine.findUnique({ where: { tenantId } }));
    console.error("[editor-vitrine] publicar:", erro);
    return res.status(500).json({ error: "Não consegui publicar a página." });
  }
});

editorVitrineRouter.get("/versoes", async (req, res) => {
  try {
    const versoes = await prisma.versaoVitrine.findMany({
      where: { tenantId: req.tenant.id },
      orderBy: { publicadoEm: "desc" },
      take: MAXIMO_VERSOES,
      select: { id: true, publicadoEm: true, publicadoPorNome: true },
    });
    return res.json({ versoes });
  } catch (erro) {
    console.error("[editor-vitrine] versões:", erro);
    return res.status(500).json({ error: "Não consegui listar as versões." });
  }
});

/* Uma versão inteira, para restaurar. Sempre com o `tenantId`: o id de outra
   imobiliária responde 404, como em todo o resto. */
editorVitrineRouter.get("/versoes/:id", async (req, res) => {
  try {
    const versao = await prisma.versaoVitrine.findFirst({ where: { id: req.params.id, tenantId: req.tenant.id } });
    if (!versao) return res.status(404).json({ error: "Versão não encontrada." });
    return res.json({ versao });
  } catch (erro) {
    console.error("[editor-vitrine] versão:", erro);
    return res.status(500).json({ error: "Não consegui abrir esta versão." });
  }
});
