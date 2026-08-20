import { autenticarChave } from "../services/chavesApi.js";
import { preencherContexto } from "../services/auditoria.js";
import { requirePlano } from "./planoMiddleware.js";

/* ────────────────────────────────────────────────────────────────────────────
   Autenticação da API pública por imobiliária.

   Caminho SEPARADO do `authMiddleware`, e não um ramo dentro dele. As duas
   perguntas parecem a mesma ("quem está chamando?") e não são:

     · o JWT identifica uma PESSOA, e o painel relê o cargo dela a cada
       requisição para que desativar alguém tenha efeito na hora;
     · a chave identifica um SISTEMA, não tem cargo, não tem sessão e vale até
       ser revogada.

   Misturar os dois num middleware só significaria um `if` decidindo qual
   metade das regras aplicar — e é nesse `if` que mora a chance de uma
   requisição autenticada por chave herdar as permissões de uma pessoa.

   O que a chave pode fazer vem dos ESCOPOS dela, e de mais nada.
   ──────────────────────────────────────────────────────────────────────────── */

function lerCredencial(req) {
  const cabecalho = String(req.headers.authorization || "");
  const bearer = /^Bearer\s+(.+)$/i.exec(cabecalho);
  if (bearer) return bearer[1].trim();
  /* `X-Api-Key` também, porque metade dos painéis de integração por aí só sabe
     mandar um cabeçalho simples — e recusar por causa da grafia geraria um
     chamado de suporte para cada cliente que tentar. */
  const simples = req.headers["x-api-key"];
  return simples ? String(simples).trim() : "";
}

/**
 * Exige uma chave viva com TODOS os escopos pedidos.
 * @param {...string} escoposExigidos
 */
export function requireChaveApi(...escoposExigidos) {
  return async function (req, res, next) {
    const credencial = lerCredencial(req);
    if (!credencial) {
      /* `WWW-Authenticate` porque é o que a especificação manda num 401 e é o
         que faz cliente HTTP genérico entender que falta credencial, em vez de
         reportar "erro desconhecido do servidor". */
      res.set("WWW-Authenticate", 'Bearer realm="Omnimob API"');
      return res.status(401).json({
        error: "Informe a chave da API em Authorization: Bearer <chave> ou no cabeçalho X-Api-Key.",
        code: "SEM_CHAVE",
      });
    }

    let chave = null;
    try {
      chave = await autenticarChave(credencial);
    } catch (erro) {
      console.error("[api-key] falha ao autenticar:", erro);
      return res.status(500).json({ error: "Erro ao validar a chave." });
    }

    /* Uma mensagem só para chave inexistente, revogada e de conta desativada.
       Distinguir as três diria a quem tenta às cegas se acertou o formato, se a
       chave já existiu e se a imobiliária está no ar. */
    if (!chave) {
      return res.status(401).json({ error: "Chave inválida ou revogada.", code: "CHAVE_INVALIDA" });
    }

    const faltando = escoposExigidos.filter((e) => !chave.escopos.includes(e));
    if (faltando.length) {
      /* 403 e não 401: a credencial é boa, o que falta é permissão. E dizemos
         QUAL escopo falta — quem chama já provou ser dono da chave, e a
         alternativa é o cliente descobrir por tentativa e erro. */
      return res.status(403).json({
        error: `Esta chave não tem permissão para isto. Falta: ${faltando.join(", ")}.`,
        code: "ESCOPO_INSUFICIENTE",
        escoposFaltando: faltando,
      });
    }

    req.tenant = chave.tenant;
    req.chaveApi = { id: chave.id, nome: chave.nome, escopos: chave.escopos };

    /* ── A TRILHA DE AUDITORIA PRECISA SABER QUE FOI A CHAVE ─────────────────
       A extensão do Prisma que grava a trilha lê o `tenantId` do contexto da
       requisição, e quem o preenche são `requireAuth` e `requireTenant` — os
       dois lugares que descobrem quem é a PESSOA. Este caminho não passa por
       nenhum dos dois.

       Sem esta chamada, o contexto ficava sem `tenantId`, e a extensão trata
       isso como "operação sem dono" e passa direto (é o que faz um script de
       linha de comando não poluir a trilha). O efeito: uma integração criava ou
       atualizava quinhentos imóveis e o Registro de atividade não mostrava
       nada — justamente no caso em que a pergunta "quem mexeu nisto?" é mais
       difícil de responder de cabeça, porque não foi ninguém da equipe.

       `usuarioId` fica NULO de propósito: não houve pessoa. O nome carrega a
       origem — "API · Site próprio" — e é isso que a tela mostra. A tabela
       aceita, porque `usuarioId` já era anulável e não tem FK. */
    return preencherContexto(
      req,
      {
        tenantId: chave.tenant.id,
        usuarioNome: `API · ${chave.nome}`,
      },
      next,
    );
  };
}

/* ── A API é recurso de plano ────────────────────────────────────────────────
   Profissional+, o mesmo degrau de domínio próprio e redes sociais: os três
   respondem à mesma pergunta ("a imobiliária existe fora da Omnimob?"), e
   colocá-los em degraus diferentes seria arbitrário.

   Roda DEPOIS da autenticação, e é por isso que é uma função separada em vez de
   um `app.use` no router: `requirePlano` lê `req.tenant`, que só existe quando
   a chave já foi resolvida. Invertido, ele leria `undefined` e recusaria todo
   mundo — inclusive quem paga. */
const exigePlano = requirePlano(1, "Profissional");

/**
 * Chave viva + escopos + plano. É este que as rotas usam.
 * @param {...string} escoposExigidos
 */
export function requireApi(...escoposExigidos) {
  return [requireChaveApi(...escoposExigidos), exigePlano];
}
