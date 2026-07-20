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
    descricao: "Para corretores autônomos e imobiliárias que estão começando a marcar presença digital.",
    cor: "#94a3b8",
  },
  {
    key: "PROFISSIONAL",
    nome: "Profissional",
    nivel: 1,
    ia: false,
    redes: true,
    tour360: true,
    descricao: "Para imobiliárias em crescimento que querem divulgar nas redes e encantar clientes com tours 360°.",
    cor: "#6366f1",
  },
  {
    key: "PREMIUM",
    nome: "Premium",
    nivel: 2,
    ia: true,
    redes: true,
    tour360: true,
    descricao: "Voltado para imobiliárias de alto padrão que buscam produtividade máxima com inteligência artificial.",
    cor: "#d4af37",
  },
];

// Recursos por linha (para a tabela comparativa). `plans` = quais planos incluem.
const TODOS = ["BASICO", "PROFISSIONAL", "PREMIUM"];
export const RECURSOS_PLANOS = [
  { label: "Cadastro de imóveis com fotos", plans: "BASICO" },
  { label: "Vitrine pública personalizável", plans: "BASICO" },
  { label: "Editor visual de arrastar e soltar", plans: "BASICO" },
  { label: "Captura e gestão de leads", plans: "BASICO" },
  { label: "Cadastro e gestão de clientes", plans: "BASICO" },
  { label: "Usuários, cargos e permissões", plans: "BASICO" },
  { label: "Relatórios e métricas de desempenho", plans: "BASICO" },
  { label: "Tudo do Plano Básico", plans: ["PROFISSIONAL"] },
  { label: "Divulgação em redes sociais", plans: ["PROFISSIONAL"] },
  { label: "Tour virtual 360°", plans: ["PROFISSIONAL"] },
  { label: "Tudo do Plano Profissional", plans: ["PREMIUM"] },
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
