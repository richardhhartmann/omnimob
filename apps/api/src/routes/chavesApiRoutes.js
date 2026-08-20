import { Router } from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermissao } from "../middlewares/permissaoMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { ESCOPOS, criarChave, escoposValidos, listarChaves, revogarChave } from "../services/chavesApi.js";

/* ────────────────────────────────────────────────────────────────────────────
   Gerência das chaves de API, pelo painel.

   Autenticado por JWT — quem mexe aqui é uma PESSOA. Não confundir com
   `apiPublicaRoutes`, que é autenticado pelas chaves que esta tela cria.

   ── A PERMISSÃO ──

   `verConfiguracoes`, a mesma que abre a tela onde isto mora. Não é uma escolha
   frouxa: uma chave com `clientes:ler` exporta a carteira inteira da
   imobiliária, com CPF e telefone. Dar isso a quem administra imóveis seria
   entregar, por um caminho lateral, o que a tela de Clientes protege pela porta
   da frente.
   ──────────────────────────────────────────────────────────────────────────── */

export const chavesApiRouter = Router();
chavesApiRouter.use(requireAuth);
chavesApiRouter.use(requireTenant);
chavesApiRouter.use(requirePermissao("verConfiguracoes"));

/** O catálogo de escopos, para a tela montar as opções sem uma segunda lista. */
chavesApiRouter.get("/escopos", (_req, res) => res.json({ escopos: ESCOPOS }));

chavesApiRouter.get("/", async (req, res) => {
  try {
    return res.json({ chaves: await listarChaves(req.tenant.id) });
  } catch (erro) {
    console.error("[chaves-api] listar:", erro);
    return res.status(500).json({ error: "Erro ao listar as chaves." });
  }
});

chavesApiRouter.post("/", async (req, res) => {
  try {
    const escopos = escoposValidos(req.body?.escopos);
    /* Chave sem escopo nenhum não é um caso de borda inofensivo: ela autentica,
       responde 403 em tudo e a pessoa passa a tarde achando que a integração
       está quebrada. Melhor recusar na criação. */
    if (!escopos.length) {
      return res.status(400).json({ error: "Escolha ao menos uma permissão para a chave." });
    }

    const { registro, texto } = await criarChave({
      tenantId: req.tenant.id,
      nome: req.body?.nome,
      escopos,
      criadaPor: req.authUserNome || null,
    });

    /* O TEXTO INTEGRAL sai daqui, e só daqui. Está no corpo desta resposta e em
       nenhum outro lugar do sistema — a listagem devolve o prefixo, e o banco
       tem só o hash. Quem fechar a tela sem copiar gera outra. */
    return res.status(201).json({ chave: registro, texto });
  } catch (erro) {
    console.error("[chaves-api] criar:", erro);
    return res.status(500).json({ error: "Erro ao criar a chave." });
  }
});

chavesApiRouter.delete("/:id", async (req, res) => {
  try {
    const chave = await revogarChave(req.tenant.id, req.params.id);
    /* 404 quando não é desta imobiliária. É o mesmo cuidado do resto do sistema:
       responder 403 confirmaria a existência de um id de outra empresa. */
    if (!chave) return res.status(404).json({ error: "Chave não encontrada." });
    return res.json({ chave });
  } catch (erro) {
    console.error("[chaves-api] revogar:", erro);
    return res.status(500).json({ error: "Erro ao revogar a chave." });
  }
});
