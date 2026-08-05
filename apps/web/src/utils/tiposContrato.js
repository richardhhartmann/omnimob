// Tipos de contrato do imóvel — a natureza do negócio.
//
// Fonte única de verdade do frontend: o combo do cadastro, os selos da vitrine,
// da lista e da tela de insights leem daqui. As chaves espelham o enum
// `TipoContrato` do Prisma (apps/api/prisma/schema.prisma).
//
// Não confundir com `aceitaPermuta`, que é outra coisa: um imóvel de VENDA pode
// aceitar permuta como parte do pagamento sem que o negócio seja uma PERMUTA.

export const TIPOS_CONTRATO = [
  {
    key: "VENDA",
    label: "Venda",
    descricao: "Transferência de propriedade",
    cor: "#10b981",
  },
  {
    key: "LOCACAO",
    label: "Locação",
    descricao: "Aluguel do imóvel",
    cor: "#6366f1",
  },
  {
    key: "PERMUTA",
    label: "Permuta",
    descricao: "Troca de bens",
    cor: "#d4af37",
  },
  {
    key: "BUILT_TO_SUIT",
    label: "Built to Suit",
    descricao: "Construção sob medida para locação comercial",
    cor: "#f472b6",
  },
];

export const TIPOS_CONTRATO_KEYS = TIPOS_CONTRATO.map((t) => t.key);

const POR_CHAVE = Object.fromEntries(TIPOS_CONTRATO.map((t) => [t.key, t]));

export function tipoContratoInfo(key) {
  return POR_CHAVE[key] || null;
}

export function tipoContratoLabel(key, fallback = "—") {
  return POR_CHAVE[key]?.label ?? fallback;
}

// Lista vazia ou ausente significa "não parametrizado" — devolve todos, para
// não travar o cadastro de uma imobiliária que nunca mexeu nessa tela.
// Mesma regra aplicada no backend (propertyRoutes.tiposContratoDoTenant).
export function tiposContratoAtivos(tenant) {
  const lista = tenant?.tiposContrato;
  if (!Array.isArray(lista) || lista.length === 0) return TIPOS_CONTRATO;
  return TIPOS_CONTRATO.filter((t) => lista.includes(t.key));
}
