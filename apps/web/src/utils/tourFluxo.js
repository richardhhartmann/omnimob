/* ────────────────────────────────────────────────────────────────────────────
   Roteiro do tour guiado de primeiro acesso.

   POR QUE O FLUXO MORA NO FRONT: quais telas existem, em que ordem aparecem e
   quem pode abrir cada uma depende do cargo do usuário e das rotas do painel —
   coisas que a tela conhece e a API não. O backend só guarda o que aconteceu
   com cada etapa (`/api/tutorial`), sem opinar sobre quais deveriam existir.
   Uma etapa nova é uma entrada aqui e uma string nova no banco: sem migração.

   ALVOS: todo passo aponta para um `data-tour="..."` colocado na tela de
   verdade. Nada de seletores estruturais (`.main-content > div:nth-child(2)`):
   eles quebram calados na primeira refatoração de layout. Passo cujo alvo não
   existe é PULADO pelo motor em vez de travar o tour — telas vazias, listas
   ainda carregando e itens escondidos por permissão são o caso comum, não a
   exceção.
   ──────────────────────────────────────────────────────────────────────────── */

// Etapa do modal de boas-vindas. Fica no fluxo (e no banco) porque "abriu o
// modal e mandou embora" é uma resposta diferente de "nunca chegou a ver".
export const ETAPA_BOAS_VINDAS = "boas-vindas";

/**
 * Monta o roteiro já filtrado pelo que este usuário enxerga.
 * @param {object} cargo  permissões do cargo (session.usuario.cargo)
 * @param {string} tenantSlug
 * @returns {Array<{chave, titulo, rota, passos: Array}>}
 */
export function montarFluxoTour({ cargo, tenantSlug }) {
  const podeImoveis  = Boolean(cargo?.gerenciarImoveis);
  const podeLeads    = Boolean(cargo?.verRelatorios);
  const podeClientes = Boolean(cargo?.gerenciarClientes);
  const podeUsuarios = Boolean(cargo?.gerenciarUsuarios);
  const podeCargos   = Boolean(cargo?.gerenciarCargos);
  const podeVitrine  = Boolean(cargo?.editarPagina);
  const podeConfig   = Boolean(cargo?.verConfiguracoes);
  const podeAuditoria = Boolean(cargo?.verAuditoria);
  const podeGestor   = Boolean(cargo?.verPainelGestor);

  const etapas = [
    /* ── O Painel do Gestor ────────────────────────────────────────────────
       Só para quem tem `verPainelGestor` — e é a PRIMEIRA etapa porque é onde
       essa pessoa aterrissa ao entrar. Começar apresentando a tela do acervo a
       quem foi levado para outra seria começar no lugar errado. */
    podeGestor && {
      chave: "gestor",
      titulo: "Início",
      rota: "/inicio",
      passos: [
        {
          alvo: '[data-tour="gestor-saudacao"]',
          titulo: "Como a casa está hoje",
          texto:
            "Esta é a sua primeira tela ao entrar. Ela responde o que mudou desde ontem: " +
            "quem procurou a imobiliária, o que está sendo visto e quanto entrou no mês.",
          lado: "bottom",
        },
        {
          alvo: '[data-tour="gestor-indicadores"]',
          titulo: "Sempre comparado",
          texto:
            "Cada número vem com a comparação — <strong>12 interessados hoje</strong> não diz nada, " +
            "<strong>12 contra 4 ontem</strong> diz. Onde não há com que comparar, aparece um traço.",
          lado: ["bottom", "top"],
        },
        {
          alvo: '[data-tour="gestor-equipe"]',
          titulo: "Quem está fechando",
          texto:
            "O resultado de cada corretor no mês, por valor fechado. As vendas entram " +
            "pelo <strong>Funil de vendas</strong>, em Relatórios.",
          lado: ["top", "bottom"],
        },
      ],
    },

    {
      chave: "inicio",
      titulo: "Dashboard",
      rota: "/",
      passos: [
        {
          alvo: '[data-tour="inicio-saudacao"]',
          titulo: podeGestor ? "E este é o painel de trabalho" : "Este é o seu painel",
          texto: podeGestor
            ? "Enquanto o Início conta como a imobiliária está, o Dashboard é por onde se " +
              "trabalha: imóveis, vitrine, leads e equipe. Vamos passar rápido por cada parte."
            : "Tudo da sua imobiliária mora aqui dentro: imóveis, vitrine, leads e equipe. " +
              "Vamos passar rápido por cada parte — leva menos de um minuto.",
          lado: "bottom",
        },
        {
          alvo: '[data-tour="sidebar"]',
          titulo: "O menu lateral",
          texto:
            "É por aqui que você anda pelo sistema. Os itens são agrupados por assunto, " +
            "e o menu abre sozinho quando o mouse passa por cima.",
          lado: ["right", "bottom"],
          respiro: 8,
        },
        {
          /* Só faz sentido para quem tem a permissão: sem ela o cabeçalho não é
             clicável, e o passo mandaria a pessoa clicar numa `<div>`. */
          exige: podeGestor,
          alvo: '[data-tour="sidebar"] .ds-head',
          titulo: "O logotipo leva ao Início",
          texto:
            "Clique na marca da imobiliária, no topo do menu, para voltar ao painel de gestão " +
            "de qualquer tela do sistema.",
          lado: ["right", "bottom"],
          respiro: 6,
        },
        {
          alvo: '[data-tour="inicio-atalhos"]',
          titulo: "Atalhos do dia a dia",
          texto:
            "Os mesmos destinos do menu, em cartões. Útil quando você ainda está " +
            "se acostumando com onde fica cada coisa.",
          lado: ["top", "bottom"],
        },
      ],
    },

    podeImoveis && {
      chave: "imoveis",
      titulo: "Imóveis",
      rota: "/imoveis/portfolio",
      passos: [
        {
          alvo: '[data-tour="portfolio-cabecalho"]',
          titulo: "Seu portfólio",
          texto:
            "Todos os imóveis cadastrados, do rascunho ao anunciado. É esta lista que " +
            "alimenta a sua vitrine pública.",
          lado: "bottom",
        },
        {
          alvo: '[data-tour="portfolio-filtros"]',
          titulo: "Achar um imóvel",
          texto:
            "Busque por título ou filtre por tipo, cidade, preço e quartos. Com a carteira " +
            "cheia, é daqui que você parte.",
          lado: "bottom",
        },
        {
          alvo: '[data-tour="nav-imoveis-novo"]',
          titulo: "Cadastrar um imóvel",
          texto:
            "Em <strong>Gerenciar Imóveis</strong> você cadastra um novo ativo: fotos, valor, " +
            "endereço e atributos. Assim que ficar ativo, ele aparece na vitrine.",
          lado: "right",
          respiro: 6,
        },
      ],
    },

    /* ── Relatórios ──────────────────────────────────────────────────────────
       Era a etapa "Leads", e ela ficou para trás quando a tela virou um ÍNDICE.

       Três coisas estavam erradas ao mesmo tempo. A rota era `/leads`, que hoje
       só redireciona para `/relatorios` — e o motor navegava, era desviado e
       navegava de novo, sem fim. Os dois alvos (`leads-cabecalho`,
       `leads-lista`) moram dentro da LeadsPage, que só aparece em
       `?ver=leads`; parados no índice, nenhum dos dois existia. E o texto
       descrevia uma tela de lista para quem estava olhando quatro cartões.

       Agora a etapa é sobre o que a tela virou: um índice com quatro
       relatórios, e um submenu que leva direto a cada um. */
    podeLeads && {
      chave: "relatorios",
      titulo: "Relatórios",
      rota: "/relatorios",
      passos: [
        {
          alvo: '[data-tour="relatorios-indice"]',
          titulo: "Tudo que já aconteceu, num lugar só",
          texto:
            "<strong>Leads</strong> traz cada contato deixado na sua vitrine, com o imóvel que a " +
            "pessoa estava vendo — responder rápido é o que separa a visita da venda. Ao lado " +
            "dele, o relatório do mês, o funil de vendas e as comissões da equipe.",
          lado: "bottom",
        },
        {
          alvo: '[data-tour="nav-rel-leads"]',
          titulo: "Depois, vá direto",
          texto:
            "O item <strong>Relatórios</strong> no menu abre um atalho para cada um dos quatro. " +
            "Passar por esta tela de escolha é só do primeiro dia — quando você já souber o que " +
            "quer ver, clique no nome dele aqui.",
          lado: "right",
          respiro: 6,
          /* Menu recolhido não desenha submenu — em 64px não cabe "Relatório
             mensal". Sem isto o passo ficaria 3,5s procurando um botão que a
             barra decidiu não ter. */
          pularSe: ".ds-side.is-collapsed",
        },
      ],
    },

    podeClientes && {
      chave: "clientes",
      titulo: "Clientes",
      rota: "/clientes",
      passos: [
        {
          alvo: '[data-tour="clientes-cabecalho"]',
          titulo: "Sua base de clientes",
          texto:
            "Lead é quem acabou de chegar; cliente é quem você já conhece. Aqui ficam os " +
            "dados completos — documento, contato, endereço e aniversário.",
          lado: "bottom",
        },
        {
          alvo: '[data-tour="clientes-novo"]',
          titulo: "Cadastrar cliente",
          texto:
            "Quem opta por receber divulgação entra nos disparos dos imóveis novos. " +
            "É opcional, e a escolha fica registrada no cadastro.",
          lado: ["left", "bottom"],
        },
      ],
    },

    podeUsuarios && {
      chave: "usuarios",
      titulo: "Usuários",
      rota: "/usuarios",
      passos: [
        {
          alvo: '[data-tour="usuarios-cabecalho"]',
          titulo: "Sua equipe",
          texto:
            "Quem tem acesso ao painel e com qual cargo. Cada pessoa entra com o próprio " +
            "login e define a senha no primeiro acesso.",
          lado: "bottom",
        },
        {
          alvo: '[data-tour="usuarios-novo"]',
          titulo: "Convidar alguém",
          texto:
            "Você cadastra nome, login e cargo — sem senha. A pessoa define a dela ao " +
            "entrar pela primeira vez.",
          lado: ["left", "bottom"],
        },
      ],
    },

    podeCargos && {
      chave: "cargos",
      titulo: "Cargos",
      rota: "/cargos",
      passos: [
        {
          alvo: '[data-tour="cargos-cabecalho"]',
          titulo: "Quem pode o quê",
          texto:
            "Permissão não é por pessoa, é por cargo. Você monta o cargo uma vez " +
            "— Corretor, Gerente, Estagiário — e todo mundo daquele cargo herda o acesso.",
          lado: "bottom",
        },
      ],
    },

    /* Entra depois de Cargos e antes de Configurações: a sequência do tour é a
       da barra lateral, e é lá que ele fecha o grupo EQUIPE. */
    podeAuditoria && {
      chave: "auditoria",
      titulo: "Registro de atividade",
      rota: "/auditoria",
      passos: [
        {
          alvo: '[data-tour="auditoria-cabecalho"]',
          titulo: "Nada acontece sem deixar rastro",
          texto:
            "Toda criação, alteração e exclusão feita no painel fica registrada aqui — com " +
            "<strong>autor, data e origem</strong>. É o que responde “sumiu um imóvel, quem apagou?” " +
            "sem depender da memória de ninguém.",
          lado: "bottom",
        },
      ],
    },

    /* Mesma forma de Relatórios, e por isso a mesma dupla de passos: o índice
       e o atalho. Falar do submenu nas duas telas não é repetição — é o que
       ensina que o padrão vale para as duas, e é o que faz a pessoa parar de
       passar pelo índice toda vez. */
    podeConfig && {
      chave: "configuracoes",
      titulo: "Configurações",
      rota: "/configuracoes",
      passos: [
        {
          alvo: '[data-tour="config-cabecalho"]',
          titulo: "A cara da sua imobiliária",
          texto:
            "Logo, cores, dados de contato, redes sociais e plano — cada assunto no seu " +
            "cartão. É o que aparece para o cliente na vitrine e nos materiais gerados " +
            "pela plataforma.",
          lado: "bottom",
        },
        {
          alvo: '[data-tour="nav-config-perfil"]',
          titulo: "Cada seção tem atalho",
          texto:
            "Como em Relatórios, o menu abre as seções uma a uma. É por aqui que você volta " +
            "para <strong>Aparência</strong> quando trocar a logo, ou para <strong>Plano</strong> " +
            "quando precisar de mais espaço — sem passar pelos cartões de novo.",
          lado: "right",
          respiro: 6,
          pularSe: ".ds-side.is-collapsed",
        },
      ],
    },

    podeVitrine && {
      chave: "vitrine",
      titulo: "Vitrine",
      // Sem rota: o editor é uma tela de arrastar e soltar com salvamento
      // automático e onboarding próprio. Levar alguém para dentro dele no meio
      // do tour significaria dois tutoriais disputando a mesma tela — e o
      // primeiro movimento do tour já salvaria layout no banco. Aqui só
      // apontamos a porta; o editor se apresenta sozinho quando ela é aberta.
      rota: null,
      passos: [
        {
          alvo: '[data-tour="nav-editar-pagina"]',
          titulo: "Sua página pública",
          texto:
            "O editor de vitrine é uma tela de arrastar e soltar: você posiciona os blocos, " +
            "troca cores, sobe um banner e escreve os textos direto na página. Tudo salva sozinho.",
          lado: "right",
          respiro: 6,
        },
        {
          alvo: '[data-tour="nav-ver-pagina"]',
          titulo: "Ver como o cliente vê",
          texto:
            "Abre a vitrine publicada numa aba nova — o mesmo endereço que você divulga " +
            "nas redes e manda para os interessados.",
          lado: "right",
          respiro: 6,
        },
      ],
    },
  ].filter(Boolean);

  /* ── O filtro por PASSO ────────────────────────────────────────────────────

     A etapa inteira já era filtrada por permissão, e isso resolve o caso óbvio:
     quem não gerencia imóveis não vê a etapa de imóveis.

     O que faltava era o passo SOLTO dentro de uma etapa que a pessoa VÊ, mas
     cujo alvo depende de outra coisa — outra permissão, o plano, um recurso que
     aquele cargo não tem. O tour não quebrava: ele ficava 3,5 segundos parado
     procurando um elemento que nunca ia aparecer, e só então pulava. Com dois
     ou três passos assim, ele passa quase meio minuto apontando para o nada e
     chega ao fim com cara de perdido.

     `exige: false` no passo o descarta AQUI, na montagem, e o tour nem sabe que
     ele existiu. Passo sem `exige` continua valendo sempre — não é preciso
     declarar nada nos que não dependem de contexto. */
  for (const etapa of etapas) {
    etapa.passos = etapa.passos.filter((passo) => passo.exige === undefined || passo.exige);
  }

  /* Etapa que ficou sem passo nenhum sai fora: um título de seção sem conteúdo
     conta como uma parada do tour e não diz nada. */
  const comPassos = etapas.filter((e) => e.passos.length);
  etapas.length = 0;
  etapas.push(...comPassos);

  /* Dois passos finais, sempre na última etapa que sobrou depois do filtro de
     permissões — assim eles fecham o tour seja qual for o cargo.

     O da AJUDA vem antes do encerramento de propósito: é a resposta para a
     pergunta que o próprio fim do tour cria ("e quando eu esquecer?"). Dizer
     isso depois do "é isso!" seria dizer depois de a pessoa já ter parado de
     ouvir. */
  const ultima = etapas[etapas.length - 1];
  if (ultima) {
    ultima.passos = [
      ...ultima.passos,
      {
        alvo: '[data-tour="ajuda"]',
        titulo: "Perdeu o fio? O botão de Ajuda",
        texto:
          "Fica no fim do menu, em toda tela. Ele oferece duas saídas: " +
          "<strong>rever o tour da tela em que você está</strong> — cada tela tem o seu, " +
          "com o passo a passo do que fazer ali — ou <strong>abrir um chamado</strong>, " +
          "quando o problema não é falta de explicação.",
        lado: ["right", "top"],
        respiro: 6,
      },
      {
        alvo: '[data-tour="perfil"]',
        titulo: "É isso!",
        texto:
          "Você pode rever este tour quando quiser, em <strong>Configurações</strong>. " +
          "Agora é sua vez: cadastre o primeiro imóvel e veja ele aparecer na vitrine.",
        lado: ["right", "top"],
      },
    ];
  }

  return etapas.map((e) => ({ ...e, tenantSlug }));
}

/* ── O número de paradas, contado num lugar só ───────────────────────────────

   Duas telas anunciam esse número, e elas TÊM que dizer o mesmo: o convite
   promete "8 paradas curtas" e o contador do tour precisa terminar em 8/8. Cada
   uma fazia o próprio `reduce` sobre o mesmo fluxo — igual hoje, e livre para
   divergir no dia em que uma delas passasse a descontar algo (passo já visto,
   etapa oculta) e a outra não. O sintoma seria um tour que promete oito e
   entrega dez, que é a forma mais barata de a ferramenta perder a confiança de
   quem está sendo apresentado a ela.

   O número sai do fluxo JÁ FILTRADO pelo cargo — quem abre duas telas tem um
   tour menor, e é o menor que ele lê no convite. */
export function totalDePassos(fluxo) {
  return (fluxo || []).reduce((n, e) => n + (e?.passos?.length || 0), 0);
}

/** Todas as chaves do fluxo, incluindo o modal — é o que "pular tudo" marca. */
export function chavesDoFluxo(fluxo) {
  return [ETAPA_BOAS_VINDAS, ...fluxo.map((e) => e.chave)];
}
