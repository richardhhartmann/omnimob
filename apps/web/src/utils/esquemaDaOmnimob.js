import { useDadosEstruturados } from "./dadosEstruturados";

/* ────────────────────────────────────────────────────────────────────────────
   O JSON-LD da Omnimob como empresa e produto: Organization, WebSite e
   SoftwareApplication. Vivia no `index.html`, e o `index.html` serve TODAS as
   rotas — inclusive `/vitrine/<cliente>`, onde ele dizia ao Google que a
   página pertencia à Omnimob, competindo com o `RealEstateAgent` da própria
   imobiliária. Aqui ele entra só onde a página É da Omnimob: a landing e as
   institucionais. Mesma mecânica de `useDadosEstruturados`, mesma limpeza ao
   sair da rota.
   ──────────────────────────────────────────────────────────────────────────── */
export const ESQUEMA_DA_OMNIMOB = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://omnimob.app/#organizacao",
      "name": "Omnimob",
      "url": "https://omnimob.app/",
      "logo": {
        "@type": "ImageObject",
        "url": "https://omnimob.app/logo.png",
        "width": 499,
        "height": 603
      },
      "image": "https://omnimob.app/og-image.png",
      "description": "Plataforma de gestão imobiliária com vitrine digital personalizável, captação de leads e publicação nas redes sociais.",
      "areaServed": {
        "@type": "Country",
        "name": "Brasil"
      }
    },
    {
      "@type": "WebSite",
      "@id": "https://omnimob.app/#site",
      "url": "https://omnimob.app/",
      "name": "Omnimob",
      "inLanguage": "pt-BR",
      "publisher": {
        "@id": "https://omnimob.app/#organizacao"
      }
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://omnimob.app/#software",
      "name": "Omnimob",
      "applicationCategory": "BusinessApplication",
      "applicationSubCategory": "CRM imobiliário",
      "operatingSystem": "Web",
      "url": "https://omnimob.app/",
      "inLanguage": "pt-BR",
      "description": "CRM e sistema de gestão para imobiliárias e corretores: cadastro de imóveis, vitrine digital personalizável, captação e gestão de leads, e publicação em Facebook, Instagram e WhatsApp.",
      "publisher": {
        "@id": "https://omnimob.app/#organizacao"
      },
      "featureList": [
        "Cadastro e gestão de imóveis",
        "Vitrine digital personalizável com editor visual",
        "Captação e gestão de leads",
        "Publicação em Facebook, Instagram e WhatsApp",
        "Geração de descrições e anúncios com inteligência artificial",
        "Métricas de visitas, leads e vendas"
      ],
      "offers": {
        "@type": "AggregateOffer",
        "priceCurrency": "BRL",
        "lowPrice": "99",
        "offerCount": 3,
        "url": "https://omnimob.app/#planos"
      }
    }
  ]
};

export function useEsquemaDaOmnimob() {
  useDadosEstruturados("omnimob", ESQUEMA_DA_OMNIMOB);
}
