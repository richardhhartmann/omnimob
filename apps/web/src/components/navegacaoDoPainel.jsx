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

/* ── CONFIGURAÇÕES É UM ITEM SÓ, NOS DOIS MÓDULOS ────────────────────────────

   Mesma chave, mesmo destino, mesmos subitens — e é isso que "compartilhada"
   quer dizer: quem clica em Configurações no Flow chega EXATAMENTE onde chega
   quem clica no Hub, em `/configuracoes`, sem parâmetro nenhum.

   A versão anterior mandava o Flow para `/configuracoes?ver=flow`. O destino
   já era o mesmo arquivo, mas a entrada não: o Flow caía direto numa aba
   interna, e a pessoa que trocava de módulo via a mesma tela abrir em lugares
   diferentes conforme de onde veio. A aba do Flow continua existindo lá dentro
   — ela só deixou de ser a porta.

   Uma função e não duas cópias do objeto: dois menus que apontam para a mesma
   tela divergem no primeiro subitem novo, e é a forma exata como as listas
   duplicadas deste projeto começaram todas as vezes. */
function itemDeConfiguracoes(ctx) {
  /* `podeImportar` NÃO sai do ctx: é a função importada de `ImportadorDados`,
     e destruturá-la daqui a sombreava com `undefined` — `abasVisiveis` a chama.
     Foi o que quebrou o menu inteiro na primeira tentativa. */
  const { cargo, plano, navigate, flags, ver } = ctx;
  if (!cargo?.verConfiguracoes) return null;

  return {
    key: "config", Icon: GearSix, label: "Configurações",
    active: flags.isConfiguracoes, onClick: () => navigate("/configuracoes"),
    /* Os subitens saem da MESMA lista que desenha os cartões da tela
       (`utils/abasConfiguracoes.js`), inclusive a regra de permissão da seção
       de Dados. Uma cópia aqui daria um menu que promete uma seção que a tela
       não abre. */
    subitens: abasVisiveis(cargo, plano, { podeImportar, temFlow: ctx.temFlow }).map((a) => ({
      key: `config-${a.key}`, Icon: a.Icon, label: a.label,
      active: flags.isConfiguracoes && ver === a.key,
      onClick: () => navigate(`/configuracoes?ver=${a.key}`),
    })),
  };
}

export function gruposDoHub(ctx) {
  const { cargo, plano, navigate, rota: p, ver, leadsBadge, menuDeImoveis, showcaseLink, showcaseEditorLink, flags } = ctx;

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
          /* Os três pontinhos, que aparecem no hover. Guardam o que PERTENCE a
             este item sem ser o destino dele — hoje, os cadastros que ficaram
             pela metade. Como subitem eles competiriam com "Novo Imóvel" e
             "Categoria"; como tela nova, exigiriam navegação para uma pergunta
             que na maioria dos dias se responde com "não há nada".
             O menu vem PRONTO do layout: o cartão da tela inicial desenha o
             mesmo item, e duas listas montadas em dois arquivos divergiriam na
             primeira opção nova. Ver `MenuDeCanto`. */
          menu: menuDeImoveis,
          subitens: [
            { key: "imovel-form", Icon: PlusCircle, label: "Novo Imóvel", active: p === "/imoveis/novo", onClick: () => navigate("/imoveis/novo") },
            { key: "imovel-tipos", Icon: Tag, label: "Categoria de Imóvel", active: flags.isTiposImovel, onClick: () => navigate("/tipos-imovel") },
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
        itemDeConfiguracoes(ctx),
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
        /* "Dashboard", o mesmo rótulo do Hub. Chamava-se "Visão do Flow", e a
           diferença não era estética: quem troca de módulo procura a tela
           inicial pelo NOME que aprendeu no outro lado, e não achava. Dois
           nomes para a mesma função em dois módulos da mesma moldura obrigam a
           reaprender o mapa a cada troca. */
        /* E o mesmo ÍCONE do Hub, pela mesma razão do rótulo: a casinha é o
           sinal de "tela inicial" que a pessoa aprendeu do outro lado. Um
           gráfico de pizza aqui a faria procurar o começo em outro item. */
        { key: "flow-inicio", Icon: House, label: "Dashboard", active: p === "/flow", onClick: () => navigate("/flow") },
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
        /* O MESMÍSSIMO item do Hub — ver `itemDeConfiguracoes`. Uma segunda
           tela de configuração, com plano, cobrança e domínio duplicados, é a
           divergência que este projeto já pagou duas vezes. */
        itemDeConfiguracoes(ctx),
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
