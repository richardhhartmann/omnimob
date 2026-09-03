import {
  FLOW, cargoAlcancaModulo, flowLibera, planoQueLibera, tenantTemModulo,
} from "../services/modulos.js";

/* ────────────────────────────────────────────────────────────────────────────
   A porta do módulo, do lado do servidor.

   Roda DEPOIS de `requireTenant` (que põe `req.tenant`) e antes de
   `requirePermissao`. A ordem importa e diz uma coisa sobre o produto: primeiro
   perguntamos se a imobiliária comprou, depois se a pessoa alcança. Invertida,
   um corretor sem permissão numa conta sem Flow receberia "permissão negada" —
   e quem administra sairia procurando um cargo para consertar em vez de
   contratar o módulo.

   As duas respostas são 403, mas com marcas diferentes no corpo
   (`moduloNaoContratado`, `planoInsuficiente`). É o que permite a tela oferecer
   o caminho certo: "fale com o comercial" contra "faça upgrade" contra "peça ao
   administrador".
   ──────────────────────────────────────────────────────────────────────────── */

/** A imobiliária contratou o módulo, E este cargo alcança? */
export function requireModulo(modulo) {
  const nome = modulo === FLOW ? "Omniflow" : "Omnimob";

  return (req, res, next) => {
    if (!tenantTemModulo(req.tenant, modulo)) {
      return res.status(403).json({
        error: `O módulo Omnimob ${nome} não está contratado nesta conta.`,
        moduloNaoContratado: modulo,
      });
    }

    /* ── A SEGUNDA PERGUNTA, QUE FALTAVA AQUI ───────────────────────────────

       `cargo.acessarFlow` era conferido só na TELA: o menu escondia o módulo,
       o seletor não desenhava o chevron e as rotas do React redirecionavam.
       Nada disso é uma tranca — é decoração. Quem colasse a URL da API com o
       próprio token entrava.

       E entrava mesmo: `GET /api/flow/painel` devolvia 200 para um Corretor
       com `acessarFlow: false`, porque é a única rota do Flow sem
       `requirePermissao` (as outras só escapavam por acidente, exigindo uma
       permissão que aquele cargo também não tinha). Um cargo com
       "Gerenciar Negócios" marcado e "Acessar o Flow" desmarcado — combinação
       que a tela de cargos permite montar — alcançava a API de negócios
       inteira.

       Aqui a tranca vale para as 30 rotas de uma vez, inclusive as que ainda
       não existem: quem acrescentar rota nova ao `flowRouter` a ganha sem
       lembrar de nada.

       Marca PRÓPRIA no corpo, e não a de módulo não contratado. São conversas
       diferentes — "fale com o comercial" contra "peça ao administrador" —, e
       colapsá-las numa mensagem só foi a primeira tentativa desta divisão e
       estava errada. */
    if (!cargoAlcancaModulo(req.authCargo, modulo)) {
      return res.status(403).json({
        error: `O seu cargo não tem acesso ao Omnimob ${nome}. Peça a quem administra a conta.`,
        cargoSemModulo: modulo,
      });
    }

    return next();
  };
}

export const requireFlow = requireModulo(FLOW);

/** Dentro do Flow, o plano ainda manda. Ver `RECURSOS_FLOW`. */
export function requireRecursoFlow(recurso) {
  return (req, res, next) => {
    if (flowLibera(req.tenant?.plano, recurso)) return next();
    return res.status(403).json({
      error: `Recurso disponível no Omniflow a partir do plano ${planoQueLibera(recurso)}.`,
      planoInsuficiente: planoQueLibera(recurso),
    });
  };
}
