import { planoLiberaFunil } from "./planos";

/* ────────────────────────────────────────────────────────────────────────────
   Quais relatórios este tenant enxerga.

   ── POR QUE UMA FUNÇÃO, E NÃO UM `filter` EM CADA TELA ──

   Três lugares fazem a mesma pergunta: os cartões do índice de `/relatorios`, o
   submenu da barra lateral e a própria tela de cada relatório.

   Eles já divergiram. A tela do relatório mensal trocava o conteúdo por um
   convite de upgrade no Básico, e tanto o menu quanto os cartões continuavam
   oferecendo o caminho até ela — o que é pior do que não ter escondido nada: a
   pessoa clica, chega numa parede de venda, e o produto parece quebrado em vez
   de parecer limitado.

   Foi o mesmo erro de `abasVisiveis` em `utils/abasConfiguracoes.js`, e pela
   mesma razão: a regra estava escrita duas vezes.

   ── O QUE DECIDE ──

   Permissão do cargo (`verRelatorios`) abre a página inteira; o PLANO decide
   quais cartões existem dentro dela. Leads é do Básico. Relatório mensal e
   Funil/Comissões começam no Profissional.
   ──────────────────────────────────────────────────────────────────────────── */

/* ── As cores dos cartões ────────────────────────────────────────────────────
   Todas eram #94a3b8, um cinza só, e isso vinha do desenho antigo: disco grande
   e tudo centralizado, onde a cor teria competido com o título. Com o cartão do
   Dashboard — ícone num quadrado tingido, à esquerda — o cinza vira ausência: a
   grade inteira fica sem ponto de referência e os cartões deixam de se
   distinguir de relance.

   As cores não são decorativas: elas ECOAM as do Dashboard, onde a mesma ideia
   já tem uma. Quem aprendeu que Relatórios é verde na tela inicial reencontra o
   verde aqui dentro. */
export const RELATORIOS = [
  {
    chave: "LEADS",
    acao: "relatorios.leads",
    param: "leads",
    title: "Leads",
    desc: "Quem entrou em contato pela vitrine, com o imóvel de origem e o histórico.",
    /* Ciano, como Clientes no Dashboard: os dois são gente. */
    accent: "#06b6d4",
    // Sem `liberado`: Leads faz parte do Básico.
  },
  {
    chave: "ATENDIMENTO",
    acao: "relatorios.atendimento",
    param: "atendimento",
    title: "Funil de atendimento",
    desc: "Em que estágio os leads empacam, por que se perdem e como cada corretor está indo.",
    /* Vermelho suave: é o relatório que aponta o que está PARADO. */
    accent: "#f87171",
    /* Sem `liberado`: é a leitura da lista de leads, e ela é do Básico. */
  },
  {
    chave: "MENSAL",
    acao: "relatorios.mensal",
    param: "mensal",
    title: "Relatório mensal",
    desc: "Visitas, leads, vendas e conversão do mês — na tela ou por e-mail.",
    /* O verde de Relatórios na tela inicial. */
    accent: "#10b981",
    /* Sem `liberado`: o relatório mensal NA TELA é do Básico — ele é
       "Relatórios e métricas de desempenho". O que começa no Profissional é
       MANDÁ-LO por e-mail, e essa trava fica no botão, dentro da tela. */
  },
  {
    chave: "FUNIL",
    acao: "relatorios.funil",
    param: "funil",
    title: "Funil de vendas",
    desc: "De visita a lead, de lead a fechamento — e onde o caminho aperta.",
    /* Roxo — é o único cartão sobre PROCESSO, não sobre números. */
    accent: "#8b5cf6",
    liberado: planoLiberaFunil,
  },
  {
    chave: "COMISSOES",
    acao: "relatorios.comissoes",
    param: "comissoes",
    title: "Comissões",
    desc: "Quanto cada corretor fechou no período e quanto tem a receber.",
    /* Âmbar: dinheiro, como o valor em negociação no Flow. */
    accent: "#f59e0b",
    /* Comissões saem das mesmas vendas do funil e moram no mesmo arquivo
       (`components/FunilVendas.jsx`), então é a mesma porta de plano. */
    liberado: planoLiberaFunil,
  },
];

/* Chave da view no endereço. Curta e em minúsculas porque aparece na barra do
   navegador — `?ver=funil` é legível, `?view=FUNIL` é código vazando.

   Mora aqui, e não na página: a barra lateral monta os mesmos endereços, e
   importar a PÁGINA dentro do layout arrastaria o pacote dela para o pedaço
   comum — ela é carregada sob demanda de propósito. */
export const PARAMETRO_DE = Object.fromEntries(RELATORIOS.map((r) => [r.chave, r.param]));

export const POR_PARAMETRO = Object.fromEntries(
  Object.entries(PARAMETRO_DE).map(([chave, param]) => [param, chave]),
);

export const TITULO_RELATORIO = Object.fromEntries(RELATORIOS.map((r) => [r.chave, r.title]));

/** Os relatórios que este plano abre. É esta lista que o índice e o menu leem. */
export function relatoriosVisiveis(plano) {
  return RELATORIOS.filter((r) => !r.liberado || r.liberado(plano));
}

/** Este plano abre este relatório? Usado para não deixar entrar pela URL. */
export function relatorioLiberado(chave, plano) {
  return relatoriosVisiveis(plano).some((r) => r.chave === chave);
}
