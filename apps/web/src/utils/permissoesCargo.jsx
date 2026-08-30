import {
  Shield, Buildings, UserCircle, UserSquare,
  ClockCounterClockwise, PencilSimple, ShareNetwork, ChartPieSlice,
  SignIn, Kanban, FileText, Scales, CurrencyCircleDollar, Coins, Broadcast, Receipt,
} from "@phosphor-icons/react";
import { planoLiberaRedes } from "./planos";
import { IconeRelatorios } from "./iconesRelatorios";

export const PERMISSOES = [
  { key: "verPainelGestor",   label: "Painel do Gestor",      Icon: ChartPieSlice },
  { key: "gerenciarUsuarios", label: "Gerenciar Usuários",    Icon: UserSquare },
  { key: "gerenciarCargos",   label: "Gerenciar Cargos",      Icon: Shield },
  { key: "verCobranca",       label: "Cobrança e Pagamentos", Icon: Receipt },
  { key: "gerenciarImoveis",  label: "Gerenciar Imóveis",     Icon: Buildings },
  { key: "verRelatorios",     label: "Ver Relatórios",        Icon: IconeRelatorios },
  { key: "gerenciarClientes", label: "Gerenciar Clientes",    Icon: UserCircle },
  { key: "verAuditoria",      label: "Registro de Atividade", Icon: ClockCounterClockwise },
  { key: "editarPagina",      label: "Editar Página",         Icon: PencilSimple },
  { key: "publicarRedes",     label: "Publicar em Redes",     Icon: ShareNetwork },
];

export const PORTA_DO_FLOW = {
  key: "acessarFlow",
  label: "Acessar o Omnimob Flow",
  descricao: "Sem isto, o módulo não aparece no seletor da barra lateral.",
  Icon: SignIn,
};

export const PERMISSOES_FLOW = [
  PORTA_DO_FLOW,
  { key: "validarFinanceiro",  label: "Validar (Financeiro)", Icon: CurrencyCircleDollar },
  { key: "validarJuridico",    label: "Validar (Jurídico)",   Icon: Scales },
  { key: "gerenciarNegocios",  label: "Gerenciar Negócios",   Icon: Kanban },
  { key: "gerenciarContratos", label: "Gerenciar Contratos",  Icon: FileText },
  { key: "gerenciarCaptacao",  label: "Configurar Captação",  Icon: Broadcast },
  { key: "verComissoes",       label: "Ver Comissões",        Icon: Coins },
];

const DEPENDE_DO_PLANO = {
  publicarRedes: planoLiberaRedes,
};

export function permissoesDoPlano(plano) {
  return PERMISSOES.filter((p) => {
    const exige = DEPENDE_DO_PLANO[p.key];
    return exige ? exige(plano) : true;
  });
}

export function gruposDePermissao(plano, { temFlow = false } = {}) {
  const grupos = [{ titulo: null, itens: permissoesDoPlano(plano) }];
  if (temFlow) {
    grupos.push({
      titulo: "No Omnimob Flow",
      porta: PORTA_DO_FLOW,
      itens: PERMISSOES_FLOW.filter((p) => p.key !== PORTA_DO_FLOW.key),
    });
  }
  return grupos;
}

export const TODAS_AS_PERMISSOES = [...PERMISSOES, ...PERMISSOES_FLOW];

export function cargoVazio() {
  const f = { descricao: "" };
  for (const p of TODAS_AS_PERMISSOES) f[p.key] = false;
  return f;
}

export const TRAVADAS_NO_ADMINISTRADOR = [
  "gerenciarCargos",
  "gerenciarUsuarios",
  "verCobranca",
  "verPainelGestor",
];

export const PERMISSOES_DE_RISCO = {
  verCobranca: {
    titulo: "Dar acesso à cobrança da imobiliária?",
    verbo: "ver o que a imobiliária paga e adiantar pagamentos",
    riscos: [
      "Este cargo passa a ver quanto a imobiliária paga, o que já foi pago e por qual forma.",
      "Pode ADIANTAR um pagamento: o botão gera uma cobrança Pix de verdade, no valor de um mês ou de doze.",
      "Não dá acesso a trocar de plano, mexer no domínio ou cancelar a assinatura — isso continua sendo só do Administrador.",
      "Faz sentido para quem cuida do financeiro. Não faz para quem só atende cliente.",
    ],
    textoCiencia: "Estou ciente de que este cargo poderá ver a cobrança da imobiliária e gerar pagamentos, e quero conceder assim mesmo.",
  },
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