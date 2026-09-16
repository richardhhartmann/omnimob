/* ────────────────────────────────────────────────────────────────────────────
   Imobiliárias que NÃO PODEM ser apagadas.

   Hoje é uma: a de demonstração — a conta que o "Ver por dentro" da landing
   abre para todo visitante. Excluí-la pelo super-admin, num clique com a
   confirmação errada, tiraria a demonstração do ar em produção e exigiria
   rodar o `npm run demonstracao` de novo (e redistribuir a senha). A faxina de
   trials também passa por aqui, por segurança: a conta nasce EM_DIA e sem
   vencimento justamente para não cair nela, mas uma edição à mão que a
   colocasse em TRIAL não pode virar remoção automática.

   Duas fontes, de propósito: o slug em `DEMO_TENANT_SLUG` (o que a rota da
   demonstração usa) E o slug fixo `demonstracao` (o que o script cria). Assim a
   proteção vale mesmo num ambiente em que a variável ainda não foi definida —
   ou foi apagada por engano.
   ──────────────────────────────────────────────────────────────────────────── */

const SLUG_DA_DEMONSTRACAO = "demonstracao";

/** Os slugs protegidos neste ambiente, sem vazios nem repetidos. */
export function slugsProtegidos() {
  const daEnv = (process.env.DEMO_TENANT_SLUG || "").trim();
  return [...new Set([SLUG_DA_DEMONSTRACAO, daEnv].filter(Boolean))];
}

/** A imobiliária deste slug é protegida contra exclusão? */
export function ehTenantProtegido(slug) {
  return Boolean(slug) && slugsProtegidos().includes(slug);
}

/** Por que não pode. Texto para a tela e para a resposta da API. */
export const MOTIVO_PROTEGIDO =
  "Esta é a imobiliária de demonstração, a que a landing abre para os visitantes. Ela não pode ser excluída.";
