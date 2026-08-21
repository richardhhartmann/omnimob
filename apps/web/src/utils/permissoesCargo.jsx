import {
  Shield, Buildings, UserCircle, UserSquare,
  ClockCounterClockwise, PencilSimple, ShareNetwork, ChartPieSlice,
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

/** Um cargo em branco, com todas as permissões desmarcadas. */
export function cargoVazio() {
  const f = { descricao: "" };
  for (const p of PERMISSOES) f[p.key] = false;
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
