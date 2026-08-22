import {
  Shield, Buildings, UserCircle, UserSquare,
  ClockCounterClockwise, PencilSimple, ShareNetwork, ChartPieSlice,
  SignIn, Kanban, FileText, Scales, CurrencyCircleDollar, Coins, Broadcast,
} from "@phosphor-icons/react";
import { planoLiberaRedes } from "./planos";
import { IconeRelatorios } from "./iconesRelatorios";

/* ────────────────────────────────────────────────────────────────────────────
   As permissões de cargo, num lugar só.

   Estavam dentro de `CargosPage`. Saíram de lá quando o cadastro de usuário
   ganhou a criação de cargo em linha — e duas telas passaram a precisar da
   mesma lista.

   Uma cópia seria a quarta vez neste projeto que uma lista duplicada diverge:
   já aconteceu com os cargos no servidor, com o ícone do WhatsApp e com as
   permissões da rota. O padrão é sempre o mesmo — a cópia envelhece na primeira
   permissão nova, e o sintoma é uma caixa que a tela mostra e o servidor
   ignora.
   ──────────────────────────────────────────────────────────────────────────── */

export const PERMISSOES = [
  { key: "verPainelGestor",   label: "Painel do Gestor",      Icon: ChartPieSlice },
  { key: "gerenciarImoveis",  label: "Gerenciar Imóveis",     Icon: Buildings },
  { key: "verRelatorios",     label: "Ver Relatórios",        Icon: IconeRelatorios },
  { key: "gerenciarClientes", label: "Gerenciar Clientes",    Icon: UserCircle },
  { key: "gerenciarUsuarios", label: "Gerenciar Usuários",    Icon: UserSquare },
  { key: "gerenciarCargos",   label: "Gerenciar Cargos",      Icon: Shield },
  { key: "verAuditoria",      label: "Registro de Atividade", Icon: ClockCounterClockwise },
  { key: "editarPagina",      label: "Editar Página",         Icon: PencilSimple },
  /* "Ver Relatórios" absorveu o antigo "Gerenciar Leads": ela abre a página
     Relatórios inteira — leads, relatório mensal, funil e comissões. */
  { key: "publicarRedes",     label: "Publicar em Redes",     Icon: ShareNetwork },
];

/* ── AS PERMISSÕES DO OMNIMOB FLOW ───────────────────────────────────────────

   Lista separada, e não sete itens a mais na de cima. Duas razões:

   1. Elas só existem para quem CONTRATOU o módulo. Uma imobiliária só de Hub
      não deve nem ver estas caixas — oferecer o que a conta não tem produz a
      pior conversa possível com o suporte ("marquei e não funciona").

   2. Dezessete caixas numa lista corrida deixam de ser uma tela e viram um
      formulário de imposto de renda. Agrupadas, a pessoa lê "o que ele faz no
      Hub" e "o que ele faz no Flow" — que é como ela pensa ao montar o cargo.

   `acessarFlow` está aqui e `acessarPainel` não está na lista do Hub, e a
   diferença é real: entrar no Hub é consequência de existir como cargo (o
   servidor força em toda gravação); entrar no Flow é uma DECISÃO, e é
   exatamente a decisão que o cliente pediu para poder tomar pessoa a pessoa. */
export const PERMISSOES_FLOW = [
  { key: "acessarFlow",        label: "Acessar o Flow",       Icon: SignIn },
  { key: "gerenciarNegocios",  label: "Gerenciar Negócios",   Icon: Kanban },
  { key: "gerenciarContratos", label: "Gerenciar Contratos",  Icon: FileText },
  { key: "gerenciarCaptacao",  label: "Configurar Captação",  Icon: Broadcast },
  { key: "validarJuridico",    label: "Validar (Jurídico)",   Icon: Scales },
  { key: "validarFinanceiro",  label: "Validar (Financeiro)", Icon: CurrencyCircleDollar },
  { key: "verComissoes",       label: "Ver Comissões",        Icon: Coins },
];

/* `acessarPainel` também não está, e pelo mesmo motivo: ela não é uma escolha.
   Criar um cargo é dizer que aquelas pessoas entram no painel — a pergunta que
   sobra é O QUE elas alcançam lá dentro.

   Como caixa, ela só produzia um estado sem sentido: um cargo com quatro
   permissões marcadas e a porta fechada. E o sintoma não explicava nada — a
   pessoa era mandada para a vitrine ao entrar, sem uma palavra sobre o porquê.
   O servidor a força em toda gravação (ver `cargoRoutes`). */

/* `verConfiguracoes` NÃO está na lista, e é de propósito: ela não é uma
   escolha, é uma consequência de ser o Administrador. O servidor a recalcula a
   cada gravação a partir do nome do cargo (ver `cargoRoutes`), então não há o
   que marcar, desmarcar ou exibir — nem para o Administrador. */

const DEPENDE_DO_PLANO = {
  publicarRedes: planoLiberaRedes,
};

/** As permissões que fazem sentido oferecer neste plano. */
export function permissoesDoPlano(plano) {
  return PERMISSOES.filter((p) => {
    const exige = DEPENDE_DO_PLANO[p.key];
    return exige ? exige(plano) : true;
  });
}

/* ── Os DOIS grupos que a tela desenha ───────────────────────────────────────

   Devolve `[{ titulo, itens }]`. O grupo do Flow só aparece quando a conta
   contratou o módulo — ver `PERMISSOES_FLOW`.

   Por que uma função e não os dois arrays exportados soltos: quem desenha
   (`GradeDePermissoes`) não deve precisar saber que existe módulo, nem cruzar
   `tenant.modulos` por conta própria. Ele recebe grupos e desenha grupos; a
   regra de quais existem mora aqui, num lugar só. */
export function gruposDePermissao(plano, { temFlow = false } = {}) {
  const grupos = [{ titulo: null, itens: permissoesDoPlano(plano) }];
  if (temFlow) {
    grupos.push({ titulo: "No Omnimob Flow", itens: PERMISSOES_FLOW });
  }
  return grupos;
}

/** Um cargo em branco, com todas as permissões desmarcadas — as dos dois
 *  módulos. Zerar só as do Hub deixaria as do Flow como `undefined`, e o
 *  servidor as gravaria como `false` de qualquer jeito; o problema seria na
 *  TELA, onde uma caixa controlada que começa `undefined` vira não-controlada e
 *  o React reclama no console a cada clique. */
export function cargoVazio() {
  const f = { descricao: "" };
  for (const p of [...PERMISSOES, ...PERMISSOES_FLOW]) f[p.key] = false;
  return f;
}

/* ── As permissões que pedem ciência antes de serem concedidas ───────────────

   Duas, e por motivos diferentes. `gerenciarCargos` é a chave de todas as
   outras portas: quem a tem edita o próprio cargo e se dá qualquer permissão
   que falte. `gerenciarUsuarios` não muda permissão nenhuma — muda QUEM as
   tem: desativa, exclui e altera os dados de qualquer pessoa da imobiliária,
   inclusive de quem está concedendo.

   Mora aqui, e não na tela de Cargos: o `+` do cadastro de usuário cria cargo
   com as mesmas permissões, e sem o aviso ele era um caminho para conceder
   `gerenciarCargos` por fora do modal.

   Um catálogo em vez de uma constante porque o texto é DIFERENTE em cada uma.
   Um aviso genérico ("esta permissão é sensível") ensina a clicar em confirmar
   sem ler — e aí o modal deixa de proteger e vira só um passo a mais. */
export const PERMISSOES_DE_RISCO = {
  /* ── As duas travas do Flow ───────────────────────────────────────────────
     Elas não concedem acesso a nada: concedem o poder de dizer "conferi, pode
     fechar". É a permissão mais silenciosa do produto — quem a tem não vê
     nenhuma tela nova, só ganha um botão —, e por isso é a mais fácil de
     conceder por engano ao montar um cargo às pressas.

     O aviso existe porque o estrago é assimétrico: dar `gerenciarImoveis` a
     mais faz alguém editar um anúncio; dar `validarFinanceiro` a mais faz um
     negócio de setecentos mil fechar sem ninguém do financeiro ter olhado. */
  validarJuridico: {
    titulo: "Conceder a validação jurídica?",
    verbo: "o poder de liberar juridicamente um negócio para fechamento",
    riscos: [
      "Nenhum negócio vira GANHO sem esta marca. Quem a tem destrava o fechamento sozinho.",
      "É uma conferência de documentação — matrícula, certidões, qualificação das partes. Quem não faz essa leitura não deveria poder atestá-la.",
      "A liberação fica registrada com o nome da pessoa e a data. Se o negócio for questionado depois, é o nome dela que responde.",
      "Num time pequeno, dar isto ao mesmo cargo que trabalha o negócio elimina a conferência: a pessoa aprova o próprio trabalho.",
    ],
    textoCiencia: "Estou ciente de que este cargo poderá liberar juridicamente negócios para fechamento, e quero conceder assim mesmo.",
  },
  validarFinanceiro: {
    titulo: "Conceder a validação financeira?",
    verbo: "o poder de liberar financeiramente um negócio para fechamento",
    riscos: [
      "Nenhum negócio vira GANHO sem esta marca — e é no fechamento que a comissão é calculada e congelada.",
      "É a conferência de sinal, forma de pagamento e financiamento aprovado. Liberar antes disso fecha um negócio que ainda pode cair.",
      "A liberação fica registrada com o nome da pessoa e a data.",
      "Num time pequeno, dar isto a quem também vende elimina a conferência: a pessoa libera o próprio negócio.",
    ],
    textoCiencia: "Estou ciente de que este cargo poderá liberar financeiramente negócios para fechamento, e quero conceder assim mesmo.",
  },
  gerenciarCargos: {
    titulo: "Conceder Gerenciar Cargos?",
    verbo: "o poder de editar cargos e permissões desta imobiliária",
    riscos: [
      "Quem tem esta permissão pode editar o PRÓPRIO cargo e se conceder qualquer outra permissão — inclusive as que você não deu.",
      "Pode alterar as permissões de todos os outros cargos, e remover acessos de quem trabalha aqui.",
      "Pode conceder este mesmo poder a mais cargos, sem passar por você.",
      "Na prática, é um segundo administrador: você deixa de ser o único a decidir quem pode o quê.",
    ],
    textoCiencia: "Estou ciente de que este cargo poderá alterar permissões — inclusive as dele mesmo — e quero conceder assim mesmo.",
  },
  verPainelGestor: {
    titulo: "Conceder o Painel do Gestor?",
    verbo: "acesso ao faturamento da imobiliária e ao desempenho individual de cada corretor",
    riscos: [
      "Mostra quanto a imobiliária faturou no mês e quanto pagou de comissão — o resultado do negócio, não só o trabalho.",
      "Mostra o desempenho de CADA corretor pelo nome: quanto vendeu, quanto tem a receber e quantos leads atende.",
      "Quem tem isto compara o próprio resultado com o dos colegas, e é uma informação que costuma ser da direção.",
      "Não há como liberar meia tela: os números do negócio e os da equipe vêm juntos.",
    ],
    textoCiencia: "Estou ciente de que este cargo verá o faturamento da imobiliária e o resultado individual de cada corretor, e quero conceder assim mesmo.",
  },

  gerenciarUsuarios: {
    titulo: "Conceder Gerenciar Usuários?",
    verbo: "o poder de criar, alterar e desativar as pessoas desta imobiliária",
    riscos: [
      "Pode DESATIVAR qualquer pessoa da equipe e quem é desativado perde o acesso ao painel na hora.",
      "Pode EXCLUIR usuários, e com eles o vínculo com leads e imóveis que estavam sob responsabilidade da pessoa.",
      "Pode alterar e-mail e senha de qualquer conta, o que basta para entrar no lugar dela.",
      "Pode trocar o cargo de alguém — e com isso dar acessos que você não concedeu, sem editar cargo nenhum.",
    ],
    textoCiencia: "Estou ciente de que este cargo poderá desativar, excluir e alterar as contas da equipe, e quero conceder assim mesmo.",
  },
};
