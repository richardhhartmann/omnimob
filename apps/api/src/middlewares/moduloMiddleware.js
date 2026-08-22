import { FLOW, flowLibera, planoQueLibera, tenantTemModulo } from "../services/modulos.js";

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

/** A imobiliária contratou o módulo? */
export function requireModulo(modulo) {
  return (req, res, next) => {
    if (tenantTemModulo(req.tenant, modulo)) return next();
    return res.status(403).json({
      error: `O módulo Omnimob ${modulo === FLOW ? "Flow" : "Hub"} não está contratado nesta conta.`,
      moduloNaoContratado: modulo,
    });
  };
}

export const requireFlow = requireModulo(FLOW);

/** Dentro do Flow, o plano ainda manda. Ver `RECURSOS_FLOW`. */
export function requireRecursoFlow(recurso) {
  return (req, res, next) => {
    if (flowLibera(req.tenant?.plano, recurso)) return next();
    return res.status(403).json({
      error: `Recurso disponível no Omnimob Flow a partir do plano ${planoQueLibera(recurso)}.`,
      planoInsuficiente: planoQueLibera(recurso),
    });
  };
}
