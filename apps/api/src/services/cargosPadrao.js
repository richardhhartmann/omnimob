/* ────────────────────────────────────────────────────────────────────────────
   Os cargos com que uma imobiliária nasce.

   Vive num módulo próprio porque tem DOIS consumidores — o seed e o
   provisionamento de tenant novo — e eles precisam concordar. Enquanto a lista
   estava só no seed, o provisionamento se virava com um
   `findFirst({ descricao: "Administrador" })`: pegava o cargo de OUTRA
   imobiliária (a tabela era global) e pendurava o admin do cliente novo nele.
   Era a origem prática do vazamento de permissões entre empresas.

   Cada imobiliária recebe a sua própria cópia desta lista. Depois ela edita,
   renomeia e apaga o que quiser sem tocar em ninguém.
   ──────────────────────────────────────────────────────────────────────────── */

export const CARGO_ADMIN = "Administrador";

/* ── As permissões do segundo módulo ─────────────────────────────────────────

   Ficam numa lista à parte e são concatenadas em `PERMISSOES` logo abaixo. Duas
   razões, e nenhuma é organização:

   1. A TELA precisa saber quais são do Flow para agrupá-las — a grade de
      permissões mostra "O que este cargo pode fazer" e misturar "Editar Página"
      com "Validar Financeiro" numa lista corrida de dezessete caixas não é uma
      tela, é um formulário de imposto de renda.

   2. Elas só valem para quem contratou o módulo. Uma imobiliária só de Hub não
      deve nem ver estas sete caixas, e é esta lista que diz quais esconder.

   `PERMISSOES` continua sendo a lista canônica única que `cargoRoutes` percorre
   ao gravar — separar aqui não cria uma segunda fonte de verdade, só um recorte
   nomeado dela. */
export const PERMISSOES_FLOW_LISTA = [
  "acessarFlow",
  "gerenciarNegocios",
  "gerenciarContratos",
  "validarJuridico",
  "validarFinanceiro",
  "verComissoes",
  "gerenciarCaptacao",
];

/* `gerenciarLeads` SAIU desta lista.

   Leads deixaram de ser uma tela própria: viraram um item dentro de
   "Relatórios", junto do relatório mensal, do funil e das comissões. Duas
   permissões para a mesma tela produziriam o estado sem sentido de alguém ver
   o menu e não ver o conteúdo — ou o contrário. Quem manda agora é
   `verRelatorios`, e quem a tem alcança tudo que está lá dentro.

   A COLUNA continua no schema, e de propósito: ela guarda o que cada cargo
   tinha antes, e derrubá-la é migração destrutiva sem volta. Ela simplesmente
   não é mais lida nem escrita. */
/* `acessarPainel` NÃO está aqui, e é o mesmo motivo de `verConfiguracoes`:
   ela não é uma escolha. Criar um cargo é dizer que aquelas pessoas entram no
   painel — a pergunta que sobra é O QUE elas alcançam lá dentro.

   Como opção, ela só produzia um estado sem sentido: um cargo com quatro
   permissões marcadas e a porta fechada, cujo sintoma era ser redirecionado
   para a vitrine no login sem nenhuma explicação. O servidor a força em toda
   gravação (ver `cargoRoutes`). */
export const PERMISSOES = [
  "editarPagina",
  "gerenciarImoveis",
  "gerenciarUsuarios",
  "gerenciarClientes",
  "gerenciarCargos",
  "verConfiguracoes",
  "verRelatorios",
  "verAuditoria",
  "publicarRedes",
  "verPainelGestor",
  // ─── Omnimob Flow ───
  ...PERMISSOES_FLOW_LISTA,
];

/* `verConfiguracoes`, `gerenciarCargos`, `verAuditoria` e `verPainelGestor`
   aparecem SÓ no Administrador, e é deliberado: são as chaves da casa. Configurações guarda plano, cobrança,
   domínio e o cancelamento da assinatura; Gerenciar Cargos permite reescrever
   as permissões de todo mundo — inclusive conceder a si mesmo o que faltava. */
/* ── O Flow nos cargos que já nascem prontos ─────────────────────────────────

   Só três dos sete cargos padrão o alcançam, e o Administrador NÃO recebe as
   duas validações mesmo tendo tudo o resto.

   É a única exceção à regra "o Administrador tem tudo", e ela existe porque a
   trava perde o sentido sem ela. `validarJuridico` e `validarFinanceiro` são o
   que segura um negócio antes do fechamento; numa imobiliária com um
   administrador só — que é a maioria dos clientes — dá-las a ele por padrão
   faria a pessoa aprovar o próprio negócio com dois cliques e nunca perceber
   que havia uma conferência ali. Quem quiser esse arranjo pode marcá-las na
   tela; o que não pode é ele vir de fábrica.

   Os cargos "Jurídico" e "Financeiro" entram no catálogo por isso: eles são a
   forma DESENHADA de usar o recurso, e um catálogo que não a oferece obriga
   toda imobiliária a descobri-la sozinha. */
export const CARGOS_PADRAO = [
  {
    descricao: CARGO_ADMIN,
    permite: PERMISSOES.filter((p) => p !== "validarJuridico" && p !== "validarFinanceiro"),
  },
  {
    descricao: "Gerente",
    permite: [
      "acessarPainel", "editarPagina", "gerenciarImoveis", "gerenciarUsuarios",
      "gerenciarClientes", "verRelatorios", "publicarRedes",
      "acessarFlow", "gerenciarNegocios", "gerenciarContratos", "verComissoes", "gerenciarCaptacao",
    ],
  },
  {
    descricao: "Corretor",
    permite: ["acessarPainel", "gerenciarImoveis", "gerenciarClientes", "verRelatorios", "publicarRedes"],
  },
  {
    descricao: "Assistente Comercial",
    // Ganhou verRelatorios no lugar do antigo gerenciarLeads: é o cargo que
    // atende o interessado, e sem ela perderia a tela de leads.
    permite: ["acessarPainel", "verRelatorios", "gerenciarClientes"],
  },
  {
    descricao: "Marketing",
    permite: ["acessarPainel", "editarPagina", "verRelatorios", "publicarRedes"],
  },
  {
    descricao: "Editor de Vitrine",
    permite: ["editarPagina"],
  },
  {
    descricao: "Consulta (Somente Leitura)",
    permite: ["acessarPainel", "verRelatorios"],
  },
  /* ── Os três do Flow ──────────────────────────────────────────────────────
     Jurídico e Financeiro entram SEM `acessarPainel`: eles não têm nada a fazer
     no Hub. Quem confere documentação de um negócio não precisa do cadastro de
     imóvel nem do editor de vitrine, e dar acesso "porque não custa nada" é
     como as permissões incham até ninguém saber mais quem alcança o quê.

     São, na prática, os primeiros cargos SÓ-FLOW do produto — e existirem no
     catálogo é o que prova que usuário só-Flow é um arranjo previsto, e não um
     efeito colateral de desmarcar caixas. */
  {
    descricao: "Jurídico",
    permite: ["acessarFlow", "gerenciarNegocios", "gerenciarContratos", "validarJuridico"],
  },
  {
    descricao: "Financeiro",
    permite: ["acessarFlow", "gerenciarNegocios", "validarFinanceiro", "verComissoes"],
  },
  {
    descricao: "Corretor Flow",
    permite: ["acessarPainel", "acessarFlow", "gerenciarImoveis", "gerenciarClientes", "verRelatorios", "gerenciarNegocios"],
  },
];

/** Monta o `data` de um cargo a partir de um item do catálogo. */
export function dadosDoCargo({ descricao, permite }, tenantId) {
  const data = { tenantId, descricao };
  for (const p of PERMISSOES) data[p] = permite.includes(p);
  return data;
}

/**
 * Cria o conjunto inicial de cargos de uma imobiliária e devolve o
 * Administrador — que é sempre o próximo passo de quem chama (o usuário
 * inicial precisa de um cargo).
 *
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {string} tenantId
 * @returns {Promise<{ id: number, descricao: string }>} o cargo Administrador
 */
export async function criarCargosPadrao(prisma, tenantId) {
  await prisma.cargo.createMany({
    data: CARGOS_PADRAO.map((c) => dadosDoCargo(c, tenantId)),
  });
  /* Relido em vez de deduzido do createMany: o Postgres não devolve os ids
     criados em lote, e inventar um "o primeiro é o Administrador" a partir da
     ordem da lista amarraria esta função à ordenação do array acima. */
  return prisma.cargo.findFirst({
    where: { tenantId, descricao: CARGO_ADMIN },
    select: { id: true, descricao: true },
  });
}
