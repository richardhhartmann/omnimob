import {
  House, ChartPieSlice, Buildings, SquaresFour, UserCircle, UserSquare, Shield,
  GearSix, PencilSimple, ArrowSquareOut, PlusCircle, Tag, ClockCounterClockwise,
  Kanban, Handshake, FileText, Scroll, Broadcast, Coins, SealCheck,
} from "@phosphor-icons/react";
import { relatoriosVisiveis, PARAMETRO_DE } from "../utils/relatorios";
import { IconeRelatorios, ICONES_RELATORIOS } from "../utils/iconesRelatorios";
import { abasVisiveis } from "../utils/abasConfiguracoes";
import { podeImportar } from "./ImportadorDados.jsx";
import { FLOW, HUB, flowLibera } from "../utils/modulos";

/* ────────────────────────────────────────────────────────────────────────────
   A NAVEGAÇÃO DE CADA MÓDULO.

   Saiu de dentro do `AdminLayout` quando o segundo módulo entrou. O layout
   continua sendo um só — a moldura, o cabeçalho, o rodapé e o comportamento da
   barra não mudam entre Hub e Flow, e é isso que faz a troca parecer uma troca
   de conteúdo em vez de uma troca de sistema. O que este arquivo devolve é
   apenas O QUE VAI DENTRO da `<nav>`.

   ── A FORMA DE UM GRUPO ──

     { label?: "IMÓVEIS", itens: [ { key, Icon, label, active, onClick|href,
                                     badge?, beta?, subitens?, bloqueado? } ] }

   `label` ausente = grupo sem título (o primeiro, com o Dashboard). Grupo que
   fica sem item nenhum depois do filtro de permissão é descartado pelo layout —
   um título de seção sozinho é ruído.

   ── `bloqueado` ──

   Item que a imobiliária VÊ mas não alcança, porque o plano dela não inclui.
   Ele fica na barra de propósito: sumir esconde a existência do recurso de
   quem mais se beneficiaria em conhecê-lo, e o convite ao upgrade é a tela do
   próprio item. É a mesma escolha que Relatórios e Configurações já fazem com
   os cartões pagos.
   ──────────────────────────────────────────────────────────────────────────── */

/** Recorta os grupos vazios. Vale para os dois módulos. */
function limpar(grupos) {
  return grupos
    .map((g) => ({ ...g, itens: g.itens.filter(Boolean) }))
    .filter((g) => g.itens.length > 0);
}

/* ═══════════════════════════════════════════════════════════════════════════
   HUB — acervo, vitrine e relacionamento
   ═══════════════════════════════════════════════════════════════════════════ */

export function gruposDoHub(ctx) {
  const { cargo, plano, navigate, rota: p, ver, leadsBadge, showcaseLink, showcaseEditorLink, flags } = ctx;

  return limpar([
    {
      /* O Painel do Gestor NÃO tem item aqui: chega-se a ele pelo cabeçalho da
         barra, logo acima. Dois caminhos para a mesma tela — um item de menu e
         o logotipo — fariam a pessoa se perguntar se são telas diferentes. */
      itens: [
        { key: "dashboard", Icon: House, label: "Dashboard", active: flags.isDashboard, onClick: () => navigate("/") },
      ],
    },
    {
      label: "IMÓVEIS",
      itens: cargo?.gerenciarImoveis ? [
        {
          key: "imoveis-novo", Icon: Buildings, label: "Gerenciar Imóveis",
          active: flags.isGerenciarImoveis, onClick: () => navigate("/imoveis"),
          subitens: [
            { key: "imovel-form", Icon: PlusCircle, label: "Novo Imóvel", active: p === "/imoveis/novo", onClick: () => navigate("/imoveis/novo") },
            { key: "imovel-tipos", Icon: Tag, label: "Categoria de Imóvel", active: p === "/tipos-imovel", onClick: () => navigate("/tipos-imovel") },
          ],
        },
        { key: "imoveis-lista", Icon: SquaresFour, label: "Portfólio Ativo", active: flags.isImovelList || flags.isInsights, onClick: () => navigate("/imoveis/portfolio") },
      ] : [],
    },
    {
      label: "RELACIONAMENTO",
      itens: [
        /* Um item só para tudo que é leitura do que aconteceu: leads, relatório
           mensal, funil e comissões. O rótulo é "Relatórios" e o destino é a
           página que reúne os quatro — cada recurso novo entra LÁ DENTRO, e não
           como mais uma linha nesta barra. */
        cargo?.verRelatorios && {
          key: "leads", Icon: IconeRelatorios, label: "Relatórios",
          active: flags.isLeads, onClick: () => navigate("/relatorios"), badge: leadsBadge,
          subitens: [
            /* Os subitens saem da MESMA lista que desenha os cartões do índice
               (`utils/relatorios.js`), inclusive a regra de plano. Uma cópia
               aqui já deu um menu que oferecia o relatório mensal no Básico
               enquanto a tela mostrava convite de upgrade. */
            ...relatoriosVisiveis(plano).map((r) => ({
              key: `rel-${PARAMETRO_DE[r.chave]}`,
              Icon: ICONES_RELATORIOS[r.chave],
              label: r.title,
              active: ver === PARAMETRO_DE[r.chave],
              onClick: () => navigate(`/relatorios?ver=${PARAMETRO_DE[r.chave]}`),
            })),
          ],
        },
        cargo?.gerenciarClientes && { key: "clientes", Icon: UserCircle, label: "Clientes", active: flags.isClientes, onClick: () => navigate("/clientes") },
      ],
    },
    {
      label: "EQUIPE",
      itens: [
        cargo?.gerenciarUsuarios && { key: "usuarios", Icon: UserSquare, label: "Usuários", active: flags.isUsuarios, onClick: () => navigate("/usuarios") },
        cargo?.gerenciarCargos && { key: "cargos", Icon: Shield, label: "Cargos", active: flags.isCargos, onClick: () => navigate("/cargos") },
        /* Registro de atividade vive em EQUIPE, e não em Configurações: a
           pergunta que ele responde é sobre PESSOAS — quem apagou, quem
           alterou —, e é ao lado de Usuários e Cargos que ela é feita. */
        cargo?.verAuditoria && { key: "auditoria", Icon: ClockCounterClockwise, label: "Registro de Atividade", active: flags.isAuditoria, onClick: () => navigate("/auditoria") },
      ],
    },
    {
      label: "VITRINE",
      itens: [
        cargo?.verConfiguracoes && {
          key: "config", Icon: GearSix, label: "Configurações",
          active: flags.isConfiguracoes, onClick: () => navigate("/configuracoes"),
          /* Os subitens saem da MESMA lista que desenha os cartões da tela
             (`utils/abasConfiguracoes.js`), inclusive a regra de permissão da
             seção de Dados. Uma cópia aqui daria um menu que promete uma seção
             que a tela não abre. */
          subitens: abasVisiveis(cargo, plano, { podeImportar, temFlow: ctx.temFlow }).map((a) => ({
            key: `config-${a.key}`, Icon: a.Icon, label: a.label,
            active: flags.isConfiguracoes && ver === a.key,
            onClick: () => navigate(`/configuracoes?ver=${a.key}`),
          })),
        },
        cargo?.editarPagina && { key: "editar-pagina", Icon: PencilSimple, label: "Editar Página", active: flags.isShowcaseEditor, href: showcaseEditorLink, beta: true },
        { key: "ver-pagina", Icon: ArrowSquareOut, label: "Ver Página", href: showcaseLink, external: true },
      ],
    },
  ]);
}

/* ═══════════════════════════════════════════════════════════════════════════
   FLOW — captação, funil e fechamento
   ═══════════════════════════════════════════════════════════════════════════

   A ordem dos grupos é a ordem do TRABALHO, e não a de importância: o negócio
   entra pela captação, anda no funil, vira contrato, é validado e paga
   comissão. Quem abre o módulo pela primeira vez lê o processo de cima para
   baixo na barra lateral, sem que ninguém precise explicar.

   `gerenciarNegocios` é a permissão de base do módulo — sem ela sobra o painel
   e nada mais. Não é `acessarFlow`: aquela é a PORTA (aparece no seletor),
   esta é o TRABALHO. Um cargo de conferente jurídico entra no Flow para
   validar, e não para mover negócios no funil.
   ═══════════════════════════════════════════════════════════════════════════ */

export function gruposDoFlow(ctx) {
  const { cargo, plano, navigate, rota: p, ver, negociosBadge } = ctx;

  const temAssinatura = flowLibera(plano, "assinaturaDigital");
  const temCaptacao = flowLibera(plano, "captacaoWebhook");

  return limpar([
    {
      itens: [
        { key: "flow-inicio", Icon: ChartPieSlice, label: "Visão do Flow", active: p === "/flow", onClick: () => navigate("/flow") },
      ],
    },
    {
      label: "CAPTAÇÃO",
      itens: [
        cargo?.gerenciarCaptacao && {
          key: "flow-captacao", Icon: Broadcast, label: "Fontes de Captação",
          active: p === "/flow/captacao", onClick: () => navigate("/flow/captacao"),
          /* Mostrado no Básico e bloqueado, em vez de escondido: é assim que a
             imobiliária descobre que o recurso existe. Ver `bloqueado`, no topo
             deste arquivo. */
          bloqueado: temCaptacao ? null : "Profissional",
        },
      ],
    },
    {
      label: "NEGÓCIOS",
      itens: [
        cargo?.gerenciarNegocios && {
          key: "flow-funil", Icon: Kanban, label: "Funil de Vendas",
          active: p === "/flow/funil", onClick: () => navigate("/flow/funil"),
          badge: negociosBadge,
        },
        cargo?.gerenciarNegocios && {
          key: "flow-negocios", Icon: Handshake, label: "Todos os Negócios",
          active: p.startsWith("/flow/negocios"), onClick: () => navigate("/flow/negocios"),
        },
      ],
    },
    {
      label: "CONTRATOS",
      itens: [
        cargo?.gerenciarContratos && {
          key: "flow-contratos", Icon: FileText, label: "Contratos",
          active: p === "/flow/contratos", onClick: () => navigate("/flow/contratos"),
          bloqueado: temAssinatura ? null : "Profissional",
        },
        cargo?.gerenciarContratos && {
          key: "flow-modelos", Icon: Scroll, label: "Modelos de Minuta",
          active: p === "/flow/modelos", onClick: () => navigate("/flow/modelos"),
        },
      ],
    },
    {
      label: "CONFERÊNCIA",
      itens: [
        /* A fila de validação só aparece para quem valida. Quem não tem nenhuma
           das duas flags não tem o que fazer nesta tela — e vê-la na barra
           sugeriria que o botão de aprovar está a um clique de distância. */
        (cargo?.validarJuridico || cargo?.validarFinanceiro) && {
          key: "flow-validacao", Icon: SealCheck, label: "Fila de Validação",
          active: p === "/flow/validacao", onClick: () => navigate("/flow/validacao"),
        },
        cargo?.verComissoes && {
          key: "flow-comissoes", Icon: Coins, label: "Comissões",
          active: p === "/flow/comissoes", onClick: () => navigate("/flow/comissoes"),
        },
      ],
    },
    {
      label: "CONFIGURAÇÃO",
      itens: [
        /* O MESMO destino de Configurações do Hub, com o parâmetro do Flow. Uma
           segunda tela de configuração — com plano, cobrança e domínio
           duplicados — é exatamente a divergência que este projeto já pagou
           duas vezes. O que o Flow acrescenta é uma ABA lá dentro. */
        cargo?.verConfiguracoes && {
          key: "flow-config", Icon: GearSix, label: "Configurações",
          active: p === "/configuracoes" && ver === "flow",
          onClick: () => navigate("/configuracoes?ver=flow"),
        },
      ],
    },
  ]);
}

/** O despachante. É por aqui que o `AdminLayout` pergunta, sem saber de módulo
 *  nenhum além do nome. */
export function gruposDoModulo(modulo, ctx) {
  return modulo === FLOW ? gruposDoFlow(ctx) : gruposDoHub(ctx);
}

export { HUB, FLOW };
