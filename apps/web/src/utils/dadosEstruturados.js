import { useEffect } from "react";

/* ────────────────────────────────────────────────────────────────────────────
   Dados estruturados (Schema.org, em JSON-LD) das páginas públicas.

   É o que faz o Google entender que a página do imóvel É um anúncio — com
   preço, quartos, metragem e endereço — e não um texto qualquer com números no
   meio. Sem isto ele indexa a página como artigo; com isto ela concorre pelos
   resultados de "apartamento 2 quartos em <bairro>" com marcação de preço, e
   a vitrine da imobiliária aparece como empresa local, com telefone e horário.

   ── ONDE MORA, E POR QUÊ ──
   No SPA, injetado no <head> por rota — o mesmo caminho de `useSeo`. O
   Googlebot executa JavaScript e lê o DOM renderizado, então o script entra no
   índice. A prévia do servidor (`previaRoutes.js`) carrega uma cópia para os
   robôs que não executam JS — mas quem manda é esta, porque é a que o Google
   vê. Os dois montam o objeto com as MESMAS funções, exportadas daqui: uma
   segunda tabela de campos na API divergiria no primeiro atributo novo.

   ── O ENDEREÇO OCULTO CONTINUA OCULTO ──
   A regra de `exibirEnderecoCompleto` vale aqui igual à tela: sem ela, o
   `PostalAddress` leva bairro, cidade e estado — e NUNCA a rua. Publicar a rua
   num script que a pessoa não vê seria esconder de quem olha e entregar a
   quem procura (ver `test/enderecoPublico.test.js` na API).

   ── NÚMERO QUE NÃO EXISTE NÃO ENTRA ──
   Zero quarto não é "0 quartos", é ausência; metragem zero, idem. Campo sem
   valor fica de fora do objeto em vez de virar zero — a mesma regra de
   `dadosDaVitrine.js`. Marcação com valor falso é pior que marcação nenhuma:
   o Google penaliza dado estruturado que não bate com a página.
   ──────────────────────────────────────────────────────────────────────────── */

const TIPO_POR_PALAVRA = [
  [/apartament|cobertura|flat|kitnet|studio|loft/i, "Apartment"],
  [/casa|sobrado|chácara|chacara|sítio|sitio|fazenda/i, "House"],
  [/sala|loja|comercial|galpão|galpao|escritório|escritorio|ponto/i, "Place"],
  [/terreno|lote|área|area/i, "Place"],
];

/** Schema.org do imóvel a partir do texto do tipo. Cai em `Accommodation`. */
export function tipoSchema(propertyType) {
  const texto = String(propertyType || "");
  for (const [re, tipo] of TIPO_POR_PALAVRA) if (re.test(texto)) return tipo;
  return "Accommodation";
}

/** Remove chaves com valor vazio (null, undefined, "", 0, [] e {} vazios). */
function enxugar(objeto) {
  if (Array.isArray(objeto)) return objeto.map(enxugar).filter((v) => v !== undefined);
  if (objeto && typeof objeto === "object") {
    const saida = {};
    for (const [k, v] of Object.entries(objeto)) {
      const limpo = enxugar(v);
      const vazio =
        limpo === undefined || limpo === null || limpo === "" || limpo === 0 ||
        (Array.isArray(limpo) && limpo.length === 0) ||
        (typeof limpo === "object" && !Array.isArray(limpo) && Object.keys(limpo).length === 0);
      if (!vazio) saida[k] = limpo;
    }
    return saida;
  }
  return objeto;
}

function enderecoDoImovel(p) {
  return {
    "@type": "PostalAddress",
    /* Só com a autorização explícita — ver o cabeçalho. */
    streetAddress: p.exibirEnderecoCompleto ? String(p.address || "").trim() : "",
    postalCode: p.exibirEnderecoCompleto ? String(p.cep || "").trim() : "",
    addressLocality: String(p.city || "").trim(),
    addressRegion: String(p.state || "").trim(),
    addressCountry: "BR",
  };
}

/**
 * O anúncio: `RealEstateListing` com a `Offer` e o imóvel em `about` — e
 * também `Product`, quando há preço e foto.
 *
 * ── POR QUE `Product` ──
 * `RealEstateListing` é o tipo certo para o Schema.org, mas não é um dos
 * resultados ricos do Google: o Rich Results Test só enxergava a trilha, e o
 * preço nunca aparecia na busca. `Product` é o tipo que o Google lê como
 * anúncio com preço. Os dois tipos juntos (`@type` em lista) valem ao mesmo
 * tempo — um leitor de Schema.org vê o imóvel, o Google vê a oferta.
 *
 * ── POR QUE SÓ COM PREÇO E FOTO ──
 * Para o Google, `Product` sem `offers` (o imóvel "sob consulta") é ERRO, não
 * aviso — e listagem de produto sem `image` também. Declarar o tipo sem poder
 * cumpri-lo é pior que não declarar: o anúncio sem preço continua sendo um
 * `RealEstateListing` válido, só não concorre como produto.
 * @param {{ property: object, tenant?: object, url: string }} o
 */
export function esquemaDoImovel({ property: p, tenant, url }) {
  if (!p) return null;
  const locacao = p.tipoContrato === "LOCACAO" || p.tipoContrato === "BUILT_TO_SUIT";
  const preco = Number(p.price);
  const temPreco = Number.isFinite(preco) && preco > 0;
  const imagens = (p.images || []).map((i) => i?.url).filter(Boolean);
  const area = Number(p.areaPrivativa || p.squareFootage || p.areaConstruida || p.areaTotal || 0);

  return enxugar({
    "@context": "https://schema.org",
    "@type": temPreco && imagens.length ? ["RealEstateListing", "Product"] : "RealEstateListing",
    "@id": url,
    url,
    name: String(p.title || "").trim(),
    description: String(p.description || "").trim().slice(0, 500),
    image: imagens,
    datePosted: p.createdAt ? String(p.createdAt).slice(0, 10) : "",
    about: {
      "@type": tipoSchema(p.propertyType),
      name: String(p.title || "").trim(),
      numberOfRooms: Number(p.bedrooms) || 0,
      numberOfBathroomsTotal: Number(p.banheiros) || 0,
      floorSize: area > 0 ? { "@type": "QuantitativeValue", value: area, unitCode: "MTK" } : null,
      address: enderecoDoImovel(p),
      /* Bairro não tem campo no PostalAddress; vai como o lugar que contém. */
      containedInPlace: p.neighborhood ? { "@type": "Place", name: String(p.neighborhood).trim() } : null,
      amenityFeature: p.parkingSpots
        ? [{ "@type": "LocationFeatureSpecification", name: "Vagas de garagem", value: Number(p.parkingSpots) }]
        : [],
    },
    offers: temPreco
      ? {
          "@type": "Offer",
          price: preco,
          priceCurrency: "BRL",
          availability: "https://schema.org/InStock",
          /* Venda ou locação — é o que separa "R$ 3.000" de "R$ 3.000 por mês". */
          businessFunction: locacao ? "http://purl.org/goodrelations/v1#LeaseOut" : "http://purl.org/goodrelations/v1#Sell",
          ...(locacao ? { priceSpecification: { "@type": "UnitPriceSpecification", price: preco, priceCurrency: "BRL", unitCode: "MON" } } : {}),
          seller: tenant?.name ? { "@type": "RealEstateAgent", name: tenant.name } : null,
        }
      : null,
  });
}

/* O horário da vitrine ("Segunda a sexta", "08:00", "18:00") não é o vocabulário
   fechado do Schema.org (`Monday`…). Só o que dá para traduzir com segurança
   entra; o resto fica de fora em vez de sair errado. */
const DIAS = [
  [/segunda/i, "Monday"], [/ter[cç]a/i, "Tuesday"], [/quarta/i, "Wednesday"],
  [/quinta/i, "Thursday"], [/sexta/i, "Friday"], [/s[aá]bado/i, "Saturday"], [/domingo/i, "Sunday"],
];
export function diasSchema(texto) {
  const t = String(texto || "");
  const faixa = t.match(/(segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)\s*(?:a|à|até|-)\s*(segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)/i);
  const indice = (palavra) => DIAS.findIndex(([re]) => re.test(palavra));
  if (faixa) {
    const a = indice(faixa[1]); const b = indice(faixa[2]);
    if (a >= 0 && b >= a) return DIAS.slice(a, b + 1).map(([, d]) => d);
  }
  return DIAS.filter(([re]) => re.test(t)).map(([, d]) => d);
}

/**
 * A imobiliária como empresa local: `RealEstateAgent` com contato, endereço e
 * horários. `vitrine` é o bloco de dados reais de `dadosDaVitrine.js`.
 */
export function esquemaDaImobiliaria({ tenant, vitrine, url }) {
  if (!tenant?.name) return null;
  const end = vitrine?.endereco;
  const contato = vitrine?.contato || {};
  const telefone = String(contato.telefone || contato.whatsapp || tenant.whatsapp || "").replace(/\D/g, "");
  const horarios = (vitrine?.horarios || [])
    .filter((h) => !h.fechado && h.abre && h.fecha)
    .map((h) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: diasSchema(h.dias), opens: h.abre, closes: h.fecha }))
    .filter((h) => h.dayOfWeek.length);
  const redes = vitrine?.redes || {};

  return enxugar({
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "@id": url,
    url,
    name: tenant.name,
    description: String(tenant.description || tenant.slogan || "").trim(),
    logo: tenant.logoUrl || "",
    image: tenant.logoUrl || "",
    telephone: telefone ? `+55${telefone.replace(/^55/, "")}` : "",
    email: String(contato.email || tenant.email || "").trim(),
    address: end
      ? { "@type": "PostalAddress", streetAddress: end.logradouro, addressLocality: end.cidade, addressRegion: end.estado, postalCode: end.cep, addressCountry: "BR" }
      : null,
    openingHoursSpecification: horarios,
    sameAs: [redes.facebook, redes.instagram].filter(Boolean),
  });
}

/** Trilha "Vitrine › Imóvel", para o Google mostrar o caminho no resultado. */
export function esquemaDaTrilha(itens) {
  const lista = (itens || []).filter((i) => i && i.nome && i.url);
  if (!lista.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: lista.map((i, n) => ({ "@type": "ListItem", position: n + 1, name: i.nome, item: i.url })),
  };
}

/** Serializa para dentro de <script>: "</" quebraria a tag no meio do JSON. */
export function serializar(objetos) {
  const lista = (Array.isArray(objetos) ? objetos : [objetos]).filter(Boolean);
  return JSON.stringify(lista.length === 1 ? lista[0] : lista).replace(/<\//g, "<\\/");
}

/**
 * Escreve o JSON-LD da rota no <head>. Um <script> por `chave`, trocado a
 * cada mudança e removido ao sair da página — senão a home levaria o anúncio
 * do último imóvel visitado.
 */
export function useDadosEstruturados(chave, objetos) {
  const json = objetos ? serializar(objetos) : "";
  useEffect(() => {
    if (typeof document === "undefined" || !json) return undefined;
    const seletor = `script[type="application/ld+json"][data-seo="${chave}"]`;
    let el = document.head.querySelector(seletor);
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.setAttribute("data-seo", chave);
      document.head.appendChild(el);
    }
    el.textContent = json;
    return () => { el?.remove(); };
  }, [chave, json]);
}
