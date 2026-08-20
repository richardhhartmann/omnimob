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
import { buscarFonte, ErroDeFonte } from "../services/fonteRemota.js";
import { lerFonte, ErroDeFormato } from "../services/formatosImportacao.js";
import { copiarFotosDasLinhas, copiaDeFotosConfigurada } from "../services/copiaDeFotos.js";
import { sincronizar } from "../services/sincronizacao.js";

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

/* ── Importar de uma URL ─────────────────────────────────────────────────────
   A migração de verdade: a imobiliária pede ao fornecedor antigo o link do feed
   e cola aqui. Nenhum pareamento de coluna, porque o formato já diz o que cada
   campo é — e o link continua valendo amanhã, ao contrário da planilha, que era
   uma foto do dia em que foi exportada.

   DOIS PASSOS, e o primeiro não escreve nada. `POST /fonte/previa` busca, lê e
   devolve as primeiras linhas para conferência; `POST /fonte/importar` faz o
   trabalho. Separar não é cerimônia: é o único momento em que dá para perceber
   que o feed aponta para a filial errada ANTES de quinhentos imóveis entrarem.

   O corpo NÃO é buscado duas vezes por acaso — é buscado de novo na importação
   porque guardar megabytes entre requisições exigiria estado no servidor, e um
   feed relido é, no pior caso, mais atual que o da prévia.
   ────────────────────────────────────────────────────────────────────────── */

const PERMISSAO_DA_ENTIDADE = {
  imoveis: "gerenciarImoveis",
  clientes: "gerenciarClientes",
  usuarios: "gerenciarUsuarios",
};

/** Lê a URL e converte, traduzindo as duas famílias de erro para 400 com texto
    acionável. 500 aqui seria mentira: o defeito é do endereço, não nosso. */
async function lerDaUrl(req) {
  const entidade = String(req.body?.entidade || "");
  if (!PERMISSAO_DA_ENTIDADE[entidade]) {
    const erro = new Error("Escolha o que importar: imóveis, clientes ou usuários.");
    erro.status = 400;
    throw erro;
  }
  if (!req.authCargo?.[PERMISSAO_DA_ENTIDADE[entidade]]) {
    const erro = new Error("Você não tem permissão para importar isto.");
    erro.status = 403;
    throw erro;
  }

  const { corpo, tipoConteudo, url } = await buscarFonte(req.body?.url);
  const { formato, linhas } = lerFonte(corpo, entidade, tipoConteudo);
  return { entidade, formato, linhas, url };
}

function responderErroDeFonte(res, erro, contexto) {
  if (erro?.status) return res.status(erro.status).json({ error: erro.message });
  if (erro instanceof ErroDeFonte || erro instanceof ErroDeFormato) {
    return res.status(400).json({ error: erro.message });
  }
  console.error(contexto, erro);
  return res.status(500).json({ error: "Erro ao ler a fonte." });
}

/** Quantas linhas da prévia vão para a tela. O suficiente para reconhecer o
    acervo, pouco o bastante para não mandar o feed inteiro de volta. */
const LINHAS_NA_PREVIA = 8;

importacaoRouter.post("/fonte/previa", async (req, res) => {
  try {
    const { entidade, formato, linhas, url } = await lerDaUrl(req);
    return res.json({
      entidade,
      formato,
      url,
      total: linhas.length,
      amostra: linhas.slice(0, LINHAS_NA_PREVIA),
      /* Quantos vêm sem identificador do sistema de origem. Importa porque é a
         chave de "atualizar ou criar": sem ela, reimportar duplica em vez de
         corrigir, e a pessoa merece saber disso antes e não depois. */
      semIdentificador: linhas.filter((l) => !String(l.origemExterna || "").trim()).length,
    });
  } catch (erro) {
    return responderErroDeFonte(res, erro, "[importacao:previa]");
  }
});

importacaoRouter.post("/fonte/importar", async (req, res) => {
  try {
    const { entidade, linhas, formato } = await lerDaUrl(req);
    if (!linhas.length) return res.status(400).json({ error: "A fonte não trouxe nenhum registro." });

    /* Fatiado aqui dentro, e não pelo navegador. No caminho da planilha era o
       browser que dividia porque ele é quem tinha o arquivo; aqui o conteúdo já
       está neste processo, e devolver o controle para a tela só para ela pedir
       de volta em pedaços seria uma viagem de rede por lote sem nada em troca. */
    /* AS FOTOS VÊM PARA CÁ ANTES DE QUALQUER COISA SER GRAVADA.

       Sem este passo, o banco guardaria os endereços do sistema antigo e o
       acervo pareceria importado — até o dia em que a imobiliária cancelasse
       aquele contrato e a vitrine inteira ficasse sem imagem. É a falha que só
       aparece semanas depois, quando ninguém mais liga uma coisa à outra.

       Antes da gravação e não depois: um imóvel que entra com a URL antiga e
       seria corrigido num segundo passo fica errado se o segundo passo falhar. */
    let copia = { copiadas: 0, falhas: [], pulou: true };
    if (entidade === "imoveis") copia = await copiarFotosDasLinhas(linhas);

    const junto = { criados: 0, atualizados: 0, fotos: 0, senhas: [], erros: [] };
    for (let i = 0; i < linhas.length; i += LOTE_MAXIMO) {
      const lote = linhas.slice(i, i + LOTE_MAXIMO);
      let parcial;
      if (entidade === "imoveis") {
        parcial = await importarImoveis(req.tenant.id, lote);
      } else if (entidade === "clientes") {
        parcial = await importarClientes(req.tenant.id, lote);
      } else {
        const cargoPadrao = await prisma.cargo.findFirst({
          where: { tenantId: req.tenant.id, descricao: req.body?.cargoPadrao || "Corretor" },
          select: { id: true },
        });
        parcial = await importarUsuarios(req.tenant.id, lote, {
          slug: req.tenant.slug,
          cargoPadraoId: cargoPadrao?.id || null,
        });
      }
      junto.criados += parcial.criados || 0;
      junto.atualizados += parcial.atualizados || 0;
      junto.fotos += parcial.fotos || 0;
      if (parcial.senhas) junto.senhas.push(...parcial.senhas);
      if (parcial.erros) junto.erros.push(...parcial.erros);
    }

    return res.json({
      ...junto,
      entidade,
      formato,
      total: linhas.length,
      /* O que aconteceu com as fotos vai junto, inclusive quando não aconteceu
         nada. "Importei 300 imóveis" sem dizer que nenhuma foto veio é a
         resposta que faz a pessoa descobrir o problema sozinha, depois. */
      copiaDeFotos: {
        copiadas: copia.copiadas,
        falhas: copia.falhas.length,
        indisponivel: copia.pulou && entidade === "imoveis" && !copiaDeFotosConfigurada,
      },
    });
  } catch (erro) {
    return responderErroDeFonte(res, erro, "[importacao:fonte]");
  }
});

/* ── Fontes guardadas ────────────────────────────────────────────────────────
   O endereço do feed, salvo para ser lido DE NOVO. É o que separa "importei uma
   vez" de "está integrado": o sistema antigo publica o acervo atualizado no
   mesmo lugar, e sem guardar a URL cada atualização é repetir o ritual inteiro.

   A permissão é a da ENTIDADE, não uma permissão de "gerenciar fontes": criar
   uma fonte de imóveis é assumir que aquele endereço vai escrever no acervo de
   hora em hora — decisão maior que a de cadastrar um imóvel, não menor.
   ────────────────────────────────────────────────────────────────────────── */

function conferirPermissaoDaEntidade(req, entidade) {
  const permissao = PERMISSAO_DA_ENTIDADE[entidade];
  if (!permissao) {
    const erro = new Error("Escolha o que sincronizar: imóveis, clientes ou usuários.");
    erro.status = 400;
    throw erro;
  }
  if (!req.authCargo?.[permissao]) {
    const erro = new Error("Você não tem permissão para importar isto.");
    erro.status = 403;
    throw erro;
  }
}

importacaoRouter.get("/fontes", async (req, res) => {
  try {
    const fontes = await prisma.fonteImportacao.findMany({
      where: { tenantId: req.tenant.id },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ fontes });
  } catch (erro) {
    console.error("[importacao:fontes]", erro);
    return res.status(500).json({ error: "Erro ao listar as fontes." });
  }
});

importacaoRouter.post("/fontes", async (req, res) => {
  try {
    const entidade = String(req.body?.entidade || "");
    conferirPermissaoDaEntidade(req, entidade);

    /* Confere o endereço ANTES de guardar. Uma fonte salva que nunca leu nada é
       pior que um erro na hora: ela fica na tela parecendo configurada, e o
       problema só aparece na primeira sincronização automática — de
       madrugada, sem ninguém olhando. */
    const { corpo, tipoConteudo } = await buscarFonte(req.body?.url);
    const { linhas } = lerFonte(corpo, entidade, tipoConteudo);

    const fonte = await prisma.fonteImportacao.create({
      data: {
        tenantId: req.tenant.id,
        nome: String(req.body?.nome || "").trim().slice(0, 60) || "Sistema anterior",
        entidade,
        url: String(req.body.url).trim(),
        desativarAusentes: Boolean(req.body?.desativarAusentes) && entidade === "imoveis",
        criadaPor: req.authUserNome || null,
      },
    });
    return res.status(201).json({ fonte, registrosNaFonte: linhas.length });
  } catch (erro) {
    return responderErroDeFonte(res, erro, "[importacao:fontes:criar]");
  }
});

importacaoRouter.put("/fontes/:id", async (req, res) => {
  try {
    const fonte = await prisma.fonteImportacao.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
    });
    if (!fonte) return res.status(404).json({ error: "Fonte não encontrada." });
    conferirPermissaoDaEntidade(req, fonte.entidade);

    const data = {};
    if (req.body?.nome !== undefined) data.nome = String(req.body.nome).trim().slice(0, 60);
    if (req.body?.ativa !== undefined) data.ativa = Boolean(req.body.ativa);
    if (req.body?.desativarAusentes !== undefined) {
      data.desativarAusentes = Boolean(req.body.desativarAusentes) && fonte.entidade === "imoveis";
    }

    const atualizada = await prisma.fonteImportacao.update({ where: { id: fonte.id }, data });
    return res.json({ fonte: atualizada });
  } catch (erro) {
    return responderErroDeFonte(res, erro, "[importacao:fontes:editar]");
  }
});

importacaoRouter.delete("/fontes/:id", async (req, res) => {
  try {
    const fonte = await prisma.fonteImportacao.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
    });
    if (!fonte) return res.status(404).json({ error: "Fonte não encontrada." });
    conferirPermissaoDaEntidade(req, fonte.entidade);
    /* Apagar a fonte não desfaz nada do que ela trouxe. Os imóveis importados
       continuam sendo da imobiliária — o que acaba é a ligação com o endereço. */
    await prisma.fonteImportacao.delete({ where: { id: fonte.id } });
    return res.json({ ok: true });
  } catch (erro) {
    return responderErroDeFonte(res, erro, "[importacao:fontes:remover]");
  }
});

/* Sincronizar agora, a pedido. O mesmo caminho que o agendador percorre — não
   uma segunda implementação "manual", que divergiria da automática justamente
   no que é difícil (a política de ausência). */
importacaoRouter.post("/fontes/:id/sincronizar", async (req, res) => {
  try {
    const fonte = await prisma.fonteImportacao.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
    });
    if (!fonte) return res.status(404).json({ error: "Fonte não encontrada." });
    conferirPermissaoDaEntidade(req, fonte.entidade);

    const relatorio = await sincronizar(fonte, req.tenant);
    if (!relatorio.ok) return res.status(400).json({ error: relatorio.erro, relatorio });
    return res.json({ relatorio });
  } catch (erro) {
    return responderErroDeFonte(res, erro, "[importacao:fontes:sincronizar]");
  }
});

/* O que a tela precisa saber para montar a importação: os tipos de imóvel e os
   cargos que ESTA imobiliária tem, para casar com o que vier na fonte e avisar
   antes o que não vai casar. */
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
