// Definição canônica dos planos e o que cada um libera. Fonte única de verdade
// usada tanto para exibir a tabela de planos quanto para liberar/bloquear recursos.
//
// Regra: todos os recursos são do Básico, EXCETO:
//  - Divulgação em redes, tour 360° e domínio próprio → a partir do Profissional
//  - Operação (suporte prioritário, relatório mensal, funil) → a partir do Profissional
//  - Tudo que envolve IA → apenas no Premium
//
// A linha que separa os dois últimos grupos é "tem IA dentro?". O Profissional
// leva o que dá musculatura à OPERAÇÃO; o Premium leva a mesma operação com a
// IA por dentro dela. Assim o Premium não vira uma lista inflada de coisas
// soltas — ele vira uma versão do Profissional, e é uma frase só de vender.
//
// ⚠ Os campos marcados "(a construir)" abaixo são PORTAS, não recursos: eles
// dizem onde cada coisa vai morar quando existir. Só entra em RECURSOS_PLANOS —
// a tabela da landing, que é página de venda — o que já funciona de verdade.

export const PLANOS = [
  {
    key: "BASICO",
    nome: "Básico",
    nivel: 0,
    ia: false,
    redes: false,
    tour360: false,
    dominio: false,
    suportePrioritario: false,
    relatorioMensal: false,
    funilVendas: false,
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
    dominio: true,
    /* PRONTO. Os chamados deste tenant sobem um degrau na escala de prioridade
       (o Premium sobe dois) no momento em que são abertos, e a fila do
       super-admin passou a ordenar por ela. Quem aplica é o SERVIDOR:
       `prioridadeComPlano` em api/src/routes/chamadoRoutes.js. */
    suportePrioritario: true,
    /* PRONTO. `relatorioService` soma o mês a partir de PropertyMetricEvent,
       `emailRelatorioMensal` monta a mensagem e o envio sai pelo script
       `npm run relatorio` (ou pelo agendador, desligado por padrão). Na tela, o
       bloco no topo do painel — que é onde dá para CONFERIR antes de mandar. */
    relatorioMensal: true,
    // (a construir) Funil e comissões sobre o model Venda, que está no schema
    // e hoje não aparece em plano nenhum.
    funilVendas: true,
    descricao: "Para imobiliárias em crescimento que querem divulgar nas redes e encantar clientes com tours 360°.",
    cor: "#6366f1",
  },
  {
    key: "PREMIUM",
    nome: "Premium",
    nivel: 2,
    /* Porta ÚNICA de tudo que é IA, e são três coisas hoje:
         1. conteúdo do imóvel — pronto (aiService.gerarConteudoImovel,
            sugerirTituloDescricao pelas fotos, inferirComodidadesRegiao)
         2. IA sobre o lead — pronto (aiService.analisarLead, servida por
            POST /api/leads/:id/ia): resumo, temperatura, resposta pronta e
            imóveis do acervo que servem para aquele interessado
         3. reescrita em massa do acervo — pronto (POST/PUT /api/ai/imovel/massa):
            gera e devolve antes/depois; salvar é um segundo passo, aprovado
            item a item
       Uma flag só, e não três: enquanto a régua for "IA é Premium", três flags
       sempre iguais entre si seriam três lugares para esquecer de mexer. */
    ia: true,
    redes: true,
    tour360: true,
    dominio: true,
    suportePrioritario: true,
    relatorioMensal: true,
    funilVendas: true,
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
  { label: "Divulgação automática em redes sociais", plans: ["PROFISSIONAL"] },
  { label: "Tour virtual 360°", plans: ["PROFISSIONAL"] },
  { label: "Domínio próprio da imobiliária na vitrine", plans: ["PROFISSIONAL"] },
  { label: "Suporte prioritário no atendimento", plans: ["PROFISSIONAL"] },
  { label: "Relatório mensal de desempenho por e-mail", plans: ["PROFISSIONAL"] },
  { label: "Tudo do Plano Profissional", plans: ["PREMIUM"] },
  { label: "IA enriquece o cadastro e gera divulgação do imóvel", plans: ["PREMIUM"] },
  { label: "Resumo de lead e sugestão de resposta pronta com IA", plans: ["PREMIUM"] },
  { label: "Reescrita das descrições do acervo em massa com IA", plans: ["PREMIUM"] },
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

// Domínio próprio da vitrine liberado? (Profissional ou Premium)
export function planoLiberaDominio(plano) {
  return planoInfo(plano).dominio;
}

// Tour virtual 360° liberado? (Profissional ou Premium)
export function planoLiberaTour360(plano) {
  return planoInfo(plano).tour360;
}

/* ── Portas dos recursos de operação (Profissional ou Premium) ───────────────
   A regra de plano vem daqui e não de um `if` espalhado — que foi como os
   vazamentos entre imobiliárias deste projeto começaram. Vale lembrar: quem
   protege de verdade é o middleware da API; estas funções servem para a TELA
   decidir o que mostrar. */

// Chamados do tenant sobem na fila do suporte?
export function planoLiberaSuportePrioritario(plano) {
  return planoInfo(plano).suportePrioritario;
}

// Resumo mensal por e-mail?
export function planoLiberaRelatorioMensal(plano) {
  return planoInfo(plano).relatorioMensal;
}

// Funil de vendas e comissões? (a construir)
export function planoLiberaFunil(plano) {
  return planoInfo(plano).funilVendas;
}
