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
    /* Funil e comissões ficam no BÁSICO. Eles são "Relatórios e métricas de
       desempenho", que a tabela de recursos já vende neste plano — a linha do
       Profissional é "Relatório mensal de desempenho POR E-MAIL", que é outra
       coisa. A tabela dizia `false` aqui e contradizia a própria lista que a
       landing mostra ao cliente. */
    funilVendas: true,
    /* Portais imobiliários (ZAP, VivaReal, OLX). Fora do Básico: alimentar
       portal é distribuição, que é o que o Profissional vende. O Básico entrega
       a vitrine própria — que continua inteira. */
    portais: false,
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
    portais: true,
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
    portais: true,
    descricao: "Voltado para imobiliárias de alto padrão que buscam produtividade máxima com inteligência artificial.",
    cor: "#d4af37",
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   OS DOIS PACOTES — Hub, e Hub + Flow
   ═══════════════════════════════════════════════════════════════════════════

   O plano diz o TAMANHO da conta (Básico, Profissional, Premium). O pacote diz
   QUANTOS MÓDULOS ela leva. São duas perguntas independentes, e é por isso que
   são dois eixos e não seis planos numa lista só:

     · seis planos numa escada obrigariam o cliente Básico que quer o funil a
       comprar IA junto;
     · e a tabela de recursos viraria seis colunas, que ninguém compara.

   No Stripe isso dá 3 planos × 2 pacotes × 2 períodos = DOZE preços — seis já
   existiam (os do Hub) e seis são novos (os do Flow). O `pacote` viaja
   junto do plano na assinatura; o servidor grava `Tenant.modulos` a partir dele.

   ── DENTRO DO FLOW, O PLANO CONTINUA MANDANDO ──

   Contratar o Flow no Básico dá funil, negócios, documentos, minutas e
   comissão. Captação por webhook e assinatura digital são do Profissional para
   cima; IA na minuta é do Premium. A régua é a mesma do Hub, e não é
   coincidência: "IA é Premium" é uma frase só no produto inteiro.
   Ver `utils/modulos.js` → `RECURSOS_FLOW`. */
export const PACOTES = [
  {
    key: "HUB",
    nome: "Hub",
    modulos: ["HUB"],
    titulo: "Só o Omnimob Hub",
    descricao: "Acervo, vitrine pública, leads, clientes, equipe e relatórios.",
  },
  {
    key: "HUB_FLOW",
    nome: "Hub + Flow",
    modulos: ["HUB", "FLOW"],
    titulo: "Omnimob Hub + Flow",
    descricao:
      "Tudo do Hub, mais a operação comercial: captação automática dos portais, " +
      "funil de negócios, minuta contratual, assinatura digital e comissão.",
    /* Selo da coluna na landing. É o pacote que queremos vender e a tabela pode
       dizer isso — o que ela não pode é esconder que o outro existe. */
    destaque: true,
  },
];

export function normalizePacote(p) {
  const k = String(p || "").toUpperCase();
  return PACOTES.some((x) => x.key === k) ? k : "HUB";
}

export function pacoteInfo(p) {
  return PACOTES.find((x) => x.key === normalizePacote(p)) || PACOTES[0];
}

/** Os módulos que um pacote entrega — é o que vira `Tenant.modulos`. */
export function modulosDoPacote(p) {
  return pacoteInfo(p).modulos;
}

/* O que o Flow acrescenta, linha a linha, para a tabela comparativa da landing.
   Separado de `RECURSOS_PLANOS` porque ele só aparece na coluna do pacote com
   Flow — misturá-los faria a tabela do Hub prometer funil de negócios. */
export const RECURSOS_FLOW_PLANOS = [
  { label: "Funil de vendas visual com 7 etapas", plans: "BASICO" },
  { label: "Distribuição automática de leads por corretor", plans: "BASICO" },
  { label: "Documentos de comprovação anexados ao negócio", plans: "BASICO" },
  { label: "Minutas contratuais preenchidas automaticamente", plans: "BASICO" },
  { label: "Split de comissão calculado no fechamento", plans: "BASICO" },
  { label: "Captação automática dos portais e das redes", plans: ["PROFISSIONAL"] },
  { label: "Assinatura digital (Clicksign ou DocuSign)", plans: ["PROFISSIONAL"] },
  { label: "Trava de fechamento por jurídico e financeiro", plans: ["PROFISSIONAL"] },
  { label: "Minuta revisada e sugerida por IA", plans: ["PREMIUM"] },
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
  { label: "Envio aos portais: ZAP, VivaReal e OLX Imóveis", plans: ["PROFISSIONAL"] },
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

/* Envio aos portais imobiliários?
   Vale para as TRÊS integrações de uma vez — ZAP, VivaReal e OLX. Escolher
   quais é decisão da imobiliária; PODER escolher é o que o plano libera. */
export function planoLiberaPortais(plano) {
  return planoInfo(plano).portais;
}

// Funil de vendas e comissões? (a construir)
export function planoLiberaFunil(plano) {
  return planoInfo(plano).funilVendas;
}
