/* ────────────────────────────────────────────────────────────────────────────
   Os módulos do produto, e o que cada plano libera DENTRO de cada um.

   ── DUAS PERGUNTAS DIFERENTES, E AS DUAS PRECISAM SER SIM ──

     1. A imobiliária CONTRATOU o módulo?  → `Tenant.modulos`
     2. Esta pessoa ALCANÇA o módulo?      → `Cargo.acessarPainel` / `acessarFlow`

   Separadas de propósito. A conta contrata o Flow e nem por isso o estagiário
   passa a ver comissão — quem decide isso é quem administra, cargo por cargo.
   E o contrário também: promover alguém não pode dar acesso a um módulo que a
   imobiliária não paga.

   ── A TERCEIRA PERGUNTA: O PLANO ──

   Dentro do Flow o plano continua mandando, do mesmo jeito que manda no Hub.
   Contratar o Flow no Básico dá o funil e os negócios; assinatura digital e
   captação por webhook são do Profissional para cima; a IA sobre a minuta é do
   Premium. A régua é a mesma do Hub e não é coincidência — "IA é Premium" é uma
   frase só no produto inteiro.

   ── ESPELHO ──

   `apps/web/src/utils/modulos.js` tem a mesma lista para a TELA decidir o que
   desenhar. Quem protege de verdade é este arquivo, através de
   `middlewares/moduloMiddleware.js`. É o mesmo arranjo que `planoMiddleware.js`
   já tem com `utils/planos.js`, e pela mesma razão: são dois pacotes npm sem um
   módulo comum entre eles.
   ──────────────────────────────────────────────────────────────────────────── */

export const HUB = "HUB";
export const FLOW = "FLOW";

export const MODULOS = [HUB, FLOW];

/** Os módulos desta imobiliária, sempre como lista e sempre com HUB dentro.
 *
 * O HUB é garantido na LEITURA e não no banco: uma conta antiga pode ter a
 * coluna vazia (a migração só define o default para linhas novas), e a resposta
 * certa para ela é "tem o Hub" — era o que ela tinha antes de os módulos
 * existirem. Uma conta sem módulo nenhum não conseguiria abrir o painel. */
export function modulosDoTenant(tenant) {
  const lista = Array.isArray(tenant?.modulos) ? tenant.modulos.filter((m) => MODULOS.includes(m)) : [];
  return lista.includes(HUB) ? lista : [HUB, ...lista];
}

/** A imobiliária contratou este módulo? */
export function tenantTemModulo(tenant, modulo) {
  return modulosDoTenant(tenant).includes(modulo);
}

/* ── O que o plano libera dentro do Flow ──────────────────────────────────────

   Nível mínimo por recurso: 0 = Básico, 1 = Profissional, 2 = Premium. Os
   mesmos números de `planoMiddleware.js`, de propósito — dois jeitos de dizer
   "Profissional" seriam dois lugares para errar.

   O corte não é arbitrário. O funil e os negócios são o CORPO do módulo: sem
   eles não há Flow nenhum, e vender um Flow que não abre negócio seria vender
   uma tela vazia. O que sobe de degrau é o que custa dinheiro para nós ou o que
   é operação de escala:

     · captação por webhook — é integração com portal, que é o que o
       Profissional já vende no Hub (o feed VRSync está lá);
     · assinatura digital — tem custo por documento no provedor;
     · IA na minuta — é IA, e IA é Premium. Não há segunda régua. */
export const RECURSOS_FLOW = {
  funil: 0,
  negocios: 0,
  documentos: 0,
  minutas: 0,
  comissoes: 0,
  captacaoWebhook: 1,
  assinaturaDigital: 1,
  validacaoSetorial: 1,
  minutaComIA: 2,
};

const NIVEL_DO_PLANO = { BASICO: 0, PROFISSIONAL: 1, PREMIUM: 2 };

export function nivelDoPlano(plano) {
  return NIVEL_DO_PLANO[String(plano || "").toUpperCase()] ?? 0;
}

/** Este plano alcança este recurso do Flow? Recurso desconhecido é NÃO — o
 *  padrão seguro é fechar, não abrir. */
export function flowLibera(plano, recurso) {
  const minimo = RECURSOS_FLOW[recurso];
  if (minimo === undefined) return false;
  return nivelDoPlano(plano) >= minimo;
}

/** O nome do plano que abre este recurso — para a mensagem de erro dizer o que
 *  fazer em vez de só dizer não. */
export function planoQueLibera(recurso) {
  const minimo = RECURSOS_FLOW[recurso] ?? 0;
  return minimo >= 2 ? "Premium" : minimo >= 1 ? "Profissional" : "Básico";
}
