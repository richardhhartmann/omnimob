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
  const podeLeads    = Boolean(cargo?.gerenciarLeads);
  const podeClientes = Boolean(cargo?.gerenciarClientes);
  const podeUsuarios = Boolean(cargo?.gerenciarUsuarios);
  const podeCargos   = Boolean(cargo?.gerenciarCargos);
  const podeVitrine  = Boolean(cargo?.editarPagina);
  const podeConfig   = Boolean(cargo?.verConfiguracoes);

  const etapas = [
    {
      chave: "inicio",
      titulo: "Início",
      rota: "/",
      passos: [
        {
          alvo: '[data-tour="inicio-saudacao"]',
          titulo: "Este é o seu painel",
          texto:
            "Tudo da sua imobiliária mora aqui dentro: imóveis, vitrine, leads e equipe. " +
            "Vamos passar rápido por cada parte — leva menos de um minuto.",
          lado: "bottom",
        },
        {
          alvo: '[data-tour="sidebar"]',
          titulo: "O menu lateral",
          texto:
            "É por aqui que você anda pelo sistema. Os itens são agrupados por assunto, " +
            "e o menu pode ser recolhido quando você quiser mais espaço na tela.",
          lado: ["right", "bottom"],
          respiro: 8,
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
      rota: "/imoveis",
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

    podeLeads && {
      chave: "leads",
      titulo: "Leads",
      rota: "/leads",
      passos: [
        {
          alvo: '[data-tour="leads-cabecalho"]',
          titulo: "Quem demonstrou interesse",
          texto:
            "Cada contato deixado na sua vitrine cai aqui, com o imóvel que a pessoa estava " +
            "vendo. Responder rápido é o que separa a visita da venda.",
          lado: "bottom",
        },
        {
          alvo: '[data-tour="leads-lista"]',
          titulo: "Trabalhando a lista",
          texto:
            "Dá para filtrar, marcar o que já foi atendido e abrir a conversa direto no " +
            "WhatsApp de quem chamou.",
          lado: ["top", "bottom"],
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

    podeConfig && {
      chave: "configuracoes",
      titulo: "Configurações",
      rota: "/configuracoes",
      passos: [
        {
          alvo: '[data-tour="config-cabecalho"]',
          titulo: "A cara da sua imobiliária",
          texto:
            "Logo, cores, dados de contato e informações legais. É o que aparece para o " +
            "cliente na vitrine e nos materiais gerados pela plataforma.",
          lado: "bottom",
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

/** Todas as chaves do fluxo, incluindo o modal — é o que "pular tudo" marca. */
export function chavesDoFluxo(fluxo) {
  return [ETAPA_BOAS_VINDAS, ...fluxo.map((e) => e.chave)];
}
