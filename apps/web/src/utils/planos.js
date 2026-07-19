// Definição canônica dos planos e o que cada um libera. Fonte única de verdade
// usada tanto para exibir a tabela de planos quanto para liberar/bloquear recursos.
//
// Regra: todos os recursos são do Básico, EXCETO:
//  - Divulgação em redes sociais  → a partir do Profissional
//  - Recursos de IA               → apenas no Premium

export const PLANOS = [
  {
    key: "BASICO",
    nome: "Básico",
    nivel: 0,
    ia: false,
    redes: false,
    tour360: false,
    descricao: "Gestão completa de imóveis, leads, clientes e vitrine.",
    cor: "#94a3b8",
  },
  {
    key: "PROFISSIONAL",
    nome: "Profissional",
    nivel: 1,
    ia: false,
    redes: true,
    tour360: true,
    descricao: "Tudo do Básico + divulgação nas redes sociais e tour virtual 360°.",
    cor: "#6366f1",
  },
  {
    key: "PREMIUM",
    nome: "Premium",
    nivel: 2,
    ia: true,
    redes: true,
    tour360: true,
    descricao: "Tudo do Profissional + geração de conteúdo por IA.",
    cor: "#d4af37",
  },
];

// Recursos por linha (para a tabela comparativa). `plans` = quais planos incluem.
export const RECURSOS_PLANOS = [
  { label: "Imóveis, leads, clientes e vitrine", plans: ["BASICO", "PROFISSIONAL", "PREMIUM"] },
  { label: "Relatórios de desempenho", plans: ["BASICO", "PROFISSIONAL", "PREMIUM"] },
  { label: "Divulgação em redes sociais", plans: ["PROFISSIONAL", "PREMIUM"] },
  { label: "Tour virtual 360°", plans: ["PROFISSIONAL", "PREMIUM"] },
  { label: "Geração de conteúdo por IA", plans: ["PREMIUM"] },
];

export function normalizePlano(plano) {
  const p = String(plano || "").toUpperCase();
  return PLANOS.some((x) => x.key === p) ? p : "BASICO";
}

export function planoInfo(plano) {
  const key = normalizePlano(plano);
  return PLANOS.find((x) => x.key === key);
}

// Recursos de IA liberados? (apenas Premium)
export function planoLiberaIA(plano) {
  return planoInfo(plano).ia;
}

// Divulgação em redes liberada? (Profissional ou Premium)
export function planoLiberaRedes(plano) {
  return planoInfo(plano).redes;
}

// Tour virtual 360° liberado? (Profissional ou Premium)
export function planoLiberaTour360(plano) {
  return planoInfo(plano).tour360;
}
