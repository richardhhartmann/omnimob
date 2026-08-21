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

export const RELATORIOS = [
  {
    chave: "LEADS",
    acao: "relatorios.leads",
    param: "leads",
    title: "Leads",
    desc: "Quem entrou em contato pela vitrine, com o imóvel de origem e o histórico.",
    accent: "#94a3b8",
    // Sem `liberado`: Leads faz parte do Básico.
  },
  {
    chave: "MENSAL",
    acao: "relatorios.mensal",
    param: "mensal",
    title: "Relatório mensal",
    desc: "Visitas, leads, vendas e conversão do mês — na tela ou por e-mail.",
    accent: "#94a3b8",
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
    accent: "#94a3b8",
    liberado: planoLiberaFunil,
  },
  {
    chave: "COMISSOES",
    acao: "relatorios.comissoes",
    param: "comissoes",
    title: "Comissões",
    desc: "Quanto cada corretor fechou no período e quanto tem a receber.",
    accent: "#94a3b8",
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
