import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermissao } from "../middlewares/permissaoMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import {
  importarClientes,
  importarImoveis,
  importarUsuarios,
  LOTE_MAXIMO,
} from "../services/importacaoService.js";

/* ────────────────────────────────────────────────────────────────────────────
   Importação de dados de outra plataforma.

   Recebe LINHAS JÁ MAPEADAS, em JSON — nunca o arquivo. Quem lê a planilha,
   mostra as colunas e pergunta "esta coluna é o título?" é o navegador; ver o
   comentário de cabeçalho do `importacaoService`.

   Uma permissão por tipo de dado, e não uma permissão de "importar": trazer
   quinhentos imóveis é a mesma decisão que cadastrar quinhentos imóveis, só
   que mais rápida. Quem não pode fazer um não deveria poder fazer o outro em
   lote — e um cargo que só cuida de clientes não deveria ganhar acesso a criar
   usuários porque a tela é a mesma.
   ──────────────────────────────────────────────────────────────────────────── */

export const importacaoRouter = Router();
importacaoRouter.use(requireAuth);
importacaoRouter.use(requireTenant);

/* Lotes existem porque uma planilha de imobiliária tem milhares de linhas e a
   requisição tem tempo limitado. O navegador fatia e chama várias vezes,
   somando os resultados — assim o progresso aparece na tela enquanto anda, em
   vez de a pessoa encarar uma barra parada por dois minutos sem saber se
   travou. */
function validarLote(req, res, next) {
  const linhas = req.body?.linhas;
  if (!Array.isArray(linhas) || linhas.length === 0) {
    return res.status(400).json({ error: "Envie ao menos uma linha." });
  }
  if (linhas.length > LOTE_MAXIMO) {
    return res.status(413).json({
      error: `Lote grande demais. Envie no máximo ${LOTE_MAXIMO} linhas por vez.`,
      loteMaximo: LOTE_MAXIMO,
    });
  }
  return next();
}

importacaoRouter.post(
  "/clientes",
  requirePermissao("gerenciarClientes"),
  validarLote,
  async (req, res) => {
    try {
      return res.json(await importarClientes(req.tenant.id, req.body.linhas));
    } catch (erro) {
      console.error("[importacao:clientes]", erro);
      return res.status(500).json({ error: "Erro ao importar clientes." });
    }
  },
);

importacaoRouter.post(
  "/imoveis",
  requirePermissao("gerenciarImoveis"),
  validarLote,
  async (req, res) => {
    try {
      return res.json(await importarImoveis(req.tenant.id, req.body.linhas));
    } catch (erro) {
      console.error("[importacao:imoveis]", erro);
      return res.status(500).json({ error: "Erro ao importar imóveis." });
    }
  },
);

importacaoRouter.post(
  "/usuarios",
  requirePermissao("gerenciarUsuarios"),
  validarLote,
  async (req, res) => {
    try {
      /* Cargo padrão para quem a planilha não disser, ou disser um nome que não
         existe aqui. Sem isso, uma coluna "cargo" com valores do sistema antigo
         ("Corretor Sênior") reprovaria a planilha inteira. */
      const cargoPadrao = await prisma.cargo.findFirst({
        where: { tenantId: req.tenant.id, descricao: req.body.cargoPadrao || "Corretor" },
        select: { id: true },
      });

      return res.json(
        await importarUsuarios(req.tenant.id, req.body.linhas, {
          slug: req.tenant.slug,
          cargoPadraoId: cargoPadrao?.id || null,
        }),
      );
    } catch (erro) {
      console.error("[importacao:usuarios]", erro);
      return res.status(500).json({ error: "Erro ao importar usuários." });
    }
  },
);

/* O que a tela precisa saber para montar o mapeamento: os tipos de imóvel e os
   cargos que ESTA imobiliária tem, para casar com o que vier na planilha e
   avisar antes o que não vai casar. */
importacaoRouter.get("/referencias", async (req, res) => {
  try {
    const [tipos, cargos] = await Promise.all([
      prisma.tipoImovel.findMany({
        where: { tenantId: req.tenant.id },
        select: { id: true, descricao: true },
        orderBy: { descricao: "asc" },
      }),
      prisma.cargo.findMany({
        where: { tenantId: req.tenant.id },
        select: { id: true, descricao: true },
        orderBy: { descricao: "asc" },
      }),
    ]);
    return res.json({ tipos, cargos, loteMaximo: LOTE_MAXIMO });
  } catch {
    return res.status(500).json({ error: "Erro ao carregar referências." });
  }
});
