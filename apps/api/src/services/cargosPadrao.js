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

import { criarTiposPadrao } from "./tiposPadrao.js";

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
  "verCobranca",
  "verRelatorios",
  "verAuditoria",
  "publicarRedes",
  "verPainelGestor",
  // ─── Omnimob Flow ───
  ...PERMISSOES_FLOW_LISTA,
];

/* `verConfiguracoes`, `verCobranca`, `gerenciarCargos`, `verAuditoria` e
   `verPainelGestor` aparecem SÓ no Administrador, e é deliberado: são as chaves
   da casa. Configurações guarda plano, domínio e o cancelamento da assinatura;
   Gerenciar Cargos permite reescrever as permissões de todo mundo — inclusive
   conceder a si mesmo o que faltava.

   `verCobranca` é a única das cinco que se pode CONCEDER: ela mostra o extrato
   e deixa adiantar um pagamento, e o financeiro de uma imobiliária média
   precisa exatamente disso — sem poder trocar de plano nem cancelar a
   assinatura, que continuam atrás de `verConfiguracoes`. Vem de fábrica no
   Administrador porque é ele quem responde pela conta; para os outros, a tela
   pede confirmação antes de conceder (ver `PERMISSOES_DE_RISCO`). */
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
    soComFlow: true,
    permite: ["acessarFlow", "gerenciarNegocios", "gerenciarContratos", "validarJuridico"],
  },
  {
    descricao: "Financeiro",
    soComFlow: true,
    permite: ["acessarFlow", "gerenciarNegocios", "validarFinanceiro", "verComissoes"],
  },
  {
    descricao: "Corretor Flow",
    /* Tem permissões do HUB e mesmo assim é do Flow: ele existe POR CAUSA do
       módulo. É o caso que provou que a marca precisa ser explícita — nenhuma
       dedução a partir das caixas marcadas o classificaria certo. */
    soComFlow: true,
    permite: ["acessarPainel", "acessarFlow", "gerenciarImoveis", "gerenciarClientes", "verRelatorios", "gerenciarNegocios"],
  },
];

/* ── `acessarPainel` É DERIVADA — E A REGRA MORA AQUI ────────────────────────

   Ela é a PORTA do Hub, o par de `acessarFlow` (ver `services/modulos.js`), e
   não é uma escolha de ninguém: não há caixa para ela na tela e um PUT feito à
   mão não a define. O que ela responde é "este cargo tem alguma coisa a fazer
   no Hub?".

   ── POR QUE ESTA FUNÇÃO EXISTE, E NÃO DUAS CÓPIAS DA REGRA ──

   Ela nasceu dentro de `cargoRoutes`, e isso durou uma tarde. Cargo é criado em
   DOIS caminhos: pela tela (`cargoRoutes`) e pelo catálogo, quando uma
   imobiliária é provisionada (`criarCargosPadrao`, logo abaixo). O segundo não
   passa pelo primeiro.

   O estrago foi imediato e total: `acessarPainel` tem `@default(false)` no
   schema e não está em `PERMISSOES`, então `dadosDoCargo` nunca a escrevia —
   todo cargo de tenant NOVO nascia sem a porta do Hub. Enquanto o login cravava
   `true` isso passou despercebido por anos; no instante em que a sessão passou
   a ler a coluna, criar uma imobiliária virou "entrei e caí na vitrine", para
   TODOS os cargos dela, inclusive o Administrador.

   Uma regra, um arquivo, os dois caminhos. */
export function alcancaOHub(permissoes) {
  const alcancaOFlow = PERMISSOES_FLOW_LISTA.some((p) => permissoes[p]);
  /* Sem nada do Flow, só resta o Hub — inclusive para o cargo em branco, que
     não é "só-Flow", é um cargo pela metade. Trancá-lo para fora de tudo
     devolveria o sintoma de ser mandado para a vitrine no login sem uma palavra
     de explicação. */
  if (!alcancaOFlow) return true;
  return PERMISSOES.some((p) => !PERMISSOES_FLOW_LISTA.includes(p) && permissoes[p]);
}

/** Monta o `data` de um cargo a partir de um item do catálogo. */
export function dadosDoCargo({ descricao, permite }, tenantId) {
  const data = { tenantId, descricao };
  for (const p of PERMISSOES) data[p] = permite.includes(p);
  /* Derivada, e não lida de `permite`: o catálogo lista `acessarPainel` em
     alguns cargos por hábito, e essas entradas eram silenciosamente ignoradas
     porque o laço acima percorre `PERMISSOES`, que não a contém. Deixar a
     dedução aqui faz o catálogo e a tela concordarem sem que ninguém precise
     lembrar de marcar a caixa certa. */
  data.acessarPainel = alcancaOHub(data);
  return data;
}

/* ── O CATÁLOGO DEPENDE DO QUE A CONTA CONTRATOU ─────────────────────────────

   Três dos dez cargos existem só por causa do Flow: Jurídico, Financeiro e
   Corretor Flow. Numa imobiliária que não contratou o módulo eles não são
   inofensivos — são piores que inúteis:

     · "Corretor Flow" aparece na tela de cargos ao lado de "Corretor", com
       nome de um produto que a conta não tem. Quem administra fica escolhendo
       entre dois cargos e um deles é uma promessa vazia.

     · Jurídico e Financeiro são SÓ-FLOW: `acessarPainel` deriva para `false`
       (não têm permissão nenhuma do Hub) e `acessarFlow` para `true` num
       módulo que não existe ali. O resultado é um cargo que não alcança NADA —
       e quem for posto nele é despejado na vitrine ao entrar, sem explicação.

   ── POR QUE UMA MARCA EXPLÍCITA, E NÃO UMA DEDUÇÃO ──

   A primeira tentativa deduziu: "tem permissão do Flow, logo é do Flow". Errou
   nos dois sentidos, e a lista abaixo mostra por quê.

     · Administrador e Gerente TÊM permissões do Flow e não são cargos do Flow —
       são os cargos centrais da casa, que por acaso também alcançam o módulo.
       A dedução os apagava do catálogo, e uma imobiliária sem Flow nascia sem
       administrador.
     · "Corretor Flow" tem permissões do HUB (imóveis, clientes, relatórios) e
       existe só por causa do módulo. A dedução o mantinha.

   `soComFlow` diz a intenção, que é o que a dedução não alcança: este cargo
   existe POR CAUSA do Flow, independentemente de quais caixas ele marca.

   Os que ficam mantêm as permissões de Flow que têm. Não incomodam: quem lê o
   que a pessoa alcança cruza com os módulos da CONTA (`modulosDoUsuario`), e
   sem o módulo elas não valem nada. Zerá-las custaria a vantagem de o
   administrador já sair pronto no dia em que a imobiliária contratar.

   Contratar o Flow depois NÃO cria estes cargos retroativamente, e é aceitável:
   a tela de cargos passa a mostrar o grupo do Flow e quem administra monta o
   arranjo que quiser. Criá-los de surpresa numa conta que já ajustou os cargos
   à mão seria pior. */
export function cargosDoCatalogo({ temFlow = false } = {}) {
  return temFlow ? CARGOS_PADRAO : CARGOS_PADRAO.filter((c) => !c.soComFlow);
}

/**
 * Cria o conjunto inicial de cargos de uma imobiliária e devolve o
 * Administrador — que é sempre o próximo passo de quem chama (o usuário
 * inicial precisa de um cargo).
 *
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {string} tenantId
 * @param {{ temFlow?: boolean }} [opcoes] a imobiliária contratou o Flow?
 * @returns {Promise<{ id: number, descricao: string }>} o cargo Administrador
 */
export async function criarCargosPadrao(prisma, tenantId, { temFlow = false, apenasAdministrador = false } = {}) {
  /* ── SÓ O ADMINISTRADOR, quando o catálogo é opcional ─────────────────────
     O provisionamento passou a criar apenas ele: os outros seis viraram uma
     ESCOLHA, feita no assistente de primeiro acesso (ver a rota
     `/me/catalogos-padrao`). O Administrador continua vindo de fábrica porque
     não é catálogo — é a porta: o usuário inicial precisa de um cargo, e sem
     ele ninguém entra na conta recém-criada. */
  const catalogo = apenasAdministrador
    ? CARGOS_PADRAO.filter((c) => c.descricao === CARGO_ADMIN)
    : cargosDoCatalogo({ temFlow });

  /* Esta função passou a poder rodar DUAS vezes na vida de uma conta: uma no
     provisionamento (só o Administrador) e outra quando a pessoa aceita o
     catálogo no assistente. `Cargo` não tem chave única em `descricao` — o
     banco aceitaria dois "Administrador" sem reclamar —, então quem chama a
     segunda vez é que filtra o que já existe. Ver `catalogosPadraoDoTenant`. */
  await prisma.cargo.createMany({
    data: catalogo.map((c) => dadosDoCargo(c, tenantId)),
  });
  /* Relido em vez de deduzido do createMany: o Postgres não devolve os ids
     criados em lote, e inventar um "o primeiro é o Administrador" a partir da
     ordem da lista amarraria esta função à ordenação do array acima. */
  return prisma.cargo.findFirst({
    where: { tenantId, descricao: CARGO_ADMIN },
    select: { id: true, descricao: true },
  });
}

/**
 * Preenche os catálogos que o assistente de primeiro acesso oferece.
 *
 * ── POR QUE ISTO SAIU DO PROVISIONAMENTO ──
 * Sete cargos e dezenove tipos de imóvel nasciam com toda conta, decididos por
 * nós. Para muita imobiliária eles servem; para a que já tem o próprio arranjo,
 * a primeira tarefa no sistema virava APAGAR o que veio — e apagar dá mais
 * trabalho do que criar. Agora a pessoa escolhe, no mesmo passo em que preenche
 * a ficha da imobiliária.
 *
 * Só ACRESCENTA o que falta: quem já criou "Corretor" à mão não ganha um
 * segundo, e chamar duas vezes não duplica nada.
 *
 * @returns {Promise<{ cargos: number, tipos: number }>} quantos foram criados
 */
export async function catalogosPadraoDoTenant(prisma, tenantId, { cargos = false, tipos = false, temFlow = false } = {}) {
  const criados = { cargos: 0, tipos: 0 };

  if (cargos) {
    const existentes = await prisma.cargo.findMany({
      where: { tenantId },
      select: { descricao: true },
    });
    const jaTem = new Set(existentes.map((c) => c.descricao));
    const faltando = cargosDoCatalogo({ temFlow }).filter((c) => !jaTem.has(c.descricao));
    if (faltando.length) {
      await prisma.cargo.createMany({ data: faltando.map((c) => dadosDoCargo(c, tenantId)) });
      criados.cargos = faltando.length;
    }
  }

  if (tipos) {
    /* `criarTiposPadrao` já é idempotente à sua maneira — ver o cabeçalho dele.
       O que se conta aqui é o que passou a existir. */
    const antes = await prisma.tipoImovel.count({ where: { tenantId } });
    await criarTiposPadrao(prisma, tenantId);
    criados.tipos = (await prisma.tipoImovel.count({ where: { tenantId } })) - antes;
  }

  return criados;
}
