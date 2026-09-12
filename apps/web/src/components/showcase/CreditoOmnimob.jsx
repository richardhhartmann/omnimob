/* ────────────────────────────────────────────────────────────────────────────
   "Desenvolvido por Omnimob" — a linha de crédito abaixo do rodapé das
   páginas públicas da imobiliária (vitrine, imóvel, região).

   Fica FORA do editor de propósito: é desenhada pelas PÁGINAS, depois do
   conteúdo que o editor controla — nem o Puck nem o renderizador de
   coordenadas a conhecem. Não é peça, não se move, não se apaga, não muda de
   texto. É a assinatura do produto, e existe sempre nas páginas do cliente.

   A arte segue o tema da vitrine: o tipo dourado sobre escuro, e a versão
   escura sobre claro. O link leva à Omnimob com o slug da imobiliária no
   `utm_source`, para saber de qual vitrine veio a visita.
   ──────────────────────────────────────────────────────────────────────────── */
export function CreditoOmnimob({ tenantSlug, isLightMode }) {
  const href = `https://omnimob.app/?utm_campaign=poweredby&utm_medium=vitrine&utm_source=${encodeURIComponent(tenantSlug || "vitrine")}`;
  return (
    <div className="credito-omnimob">
      <a href={href} target="_blank" rel="noopener nofollow">
        <span>Desenvolvido por</span>
        <img
          src={isLightMode ? "/tipo_header_alt_dark.png" : "/tipo_header_alt.png"}
          alt="Omnimob — plataforma de gestão imobiliária"
          width="100"
          height="21"
          loading="lazy"
        />
      </a>
    </div>
  );
}
