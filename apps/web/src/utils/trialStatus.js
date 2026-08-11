import { api } from "../api";

/* ────────────────────────────────────────────────────────────────────────────
   Situação do teste/assinatura, buscada uma vez e compartilhada.

   `GET /api/tenants/me/trial` é pedido por três telas, e duas delas montam ao
   mesmo tempo dentro do AdminLayout: o [BoasVindasModal] (decide se abre o
   modal de entrada) e o [TrialAviso] (o selo de dias restantes no rodapé).
   Eram duas requisições idênticas, disparadas no mesmo quadro, para responder
   exatamente a mesma pergunta.

   Isso importa mais do que parece porque hoje cada ida ao banco custa caro em
   produção — a API e o Postgres estão em regiões distantes, e uma consulta
   trivial leva ~900 ms. Duas chamadas simultâneas disputam a mesma piscina de
   conexões e o painel inteiro fica esperando.

   A janela é curta de propósito: situação de cobrança muda por ação da própria
   pessoa (assinar, cancelar), e quem faz isso recarrega a tela em seguida. O
   que a janela evita é a rajada da montagem, não a atualização legítima.
   ──────────────────────────────────────────────────────────────────────────── */

const JANELA_MS = 15_000;

/** slug → { quando, promessa } */
const cache = new Map();

/**
 * Mesma resposta de `api.getTrialStatus`, compartilhada entre quem pedir junto.
 * Chamadas concorrentes recebem a MESMA promessa, então há uma requisição só.
 */
export function getTrialStatusCompartilhado(tenantSlug) {
  if (!tenantSlug) return Promise.resolve(null);

  const guardado = cache.get(tenantSlug);
  if (guardado && Date.now() - guardado.quando < JANELA_MS) {
    return guardado.promessa;
  }

  /* A falha não fica em cache: se a rede caiu, a próxima montagem deve tentar
     de novo em vez de herdar o erro pelos 15 s seguintes. */
  const promessa = api.getTrialStatus(tenantSlug).catch((erro) => {
    cache.delete(tenantSlug);
    throw erro;
  });

  cache.set(tenantSlug, { quando: Date.now(), promessa });
  return promessa;
}

/** Descarta o guardado — use depois de assinar ou cancelar. */
export function esquecerTrialStatus(tenantSlug) {
  if (tenantSlug) cache.delete(tenantSlug);
  else cache.clear();
}
