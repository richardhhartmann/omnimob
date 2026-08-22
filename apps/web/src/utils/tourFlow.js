/* ────────────────────────────────────────────────────────────────────────────
   O TOUR DO OMNIMOB FLOW.

   ── POR QUE É UM TOUR SEPARADO, E NÃO PASSOS A MAIS NO GLOBAL ──

   Três razões, e a terceira é a que decide:

   1. Público diferente. O tour do Hub é para quem acabou de entrar no sistema;
      este é para quem acabou de ENTRAR NO MÓDULO — e isso pode acontecer meses
      depois, quando a imobiliária contrata o Flow.

   2. Momento diferente. Ele não abre no primeiro acesso ao painel: abre na
      primeira vez que a pessoa troca para o Flow. Emendá-lo no global faria
      quem só tem o Hub ver um tour de 30 paradas sobre metade de um produto que
      ela não comprou.

   3. E a que decide: o GLOBAL JÁ TERIA SIDO CONCLUÍDO. A etapa `boas-vindas`
      fica marcada como FINALIZADO no banco, e é ela que silencia o convite para
      sempre. Um passo novo dentro daquele fluxo nunca mais apareceria para
      ninguém que já usa o sistema — que é exatamente todo mundo que vai
      contratar o Flow.

   Mesma estrutura de `tourFluxo.js`, e o mesmo motor (`TourGuiado`) desenha os
   dois. O que muda é o roteiro e a chave gravada no banco.

   ── A CHAVE ──

   `flow:` na frente, como `tela:` faz para os tours de tela. Sem prefixo, a
   etapa "funil" do Flow colidiria com uma etapa "funil" que o Hub venha a ter,
   e o progresso de uma silenciaria a outra.
   ──────────────────────────────────────────────────────────────────────────── */

export const PREFIXO_FLOW = "flow:";
export const ETAPA_BOAS_VINDAS_FLOW = `${PREFIXO_FLOW}boas-vindas`;

const chave = (nome) => `${PREFIXO_FLOW}${nome}`;

/**
 * Monta o roteiro do Flow filtrado pelo que ESTA pessoa alcança.
 *
 * Mesmo filtro em duas camadas de `montarFluxoTour`: a etapa inteira sai quando
 * a permissão falta, e o passo solto sai por `exige`. Um passo apontando para
 * um botão que a permissão esconde deixa o tour 3,5 segundos parado procurando
 * um elemento que nunca vai aparecer.
 *
 * @param {object} cargo  permissões (session.usuario.cargo)
 * @param {string} plano  para não prometer o que o plano não dá
 */
export function montarFluxoFlow({ cargo, plano }) {
  const podeNegocios = Boolean(cargo?.gerenciarNegocios);
  const podeContratos = Boolean(cargo?.gerenciarContratos);
  const podeCaptacao = Boolean(cargo?.gerenciarCaptacao);
  const podeValidar = Boolean(cargo?.validarJuridico || cargo?.validarFinanceiro);
  const podeComissoes = Boolean(cargo?.verComissoes);

  const nivel = { BASICO: 0, PROFISSIONAL: 1, PREMIUM: 2 }[String(plano || "").toUpperCase()] ?? 0;
  const temCaptacao = nivel >= 1;
  const temAssinatura = nivel >= 1;

  const etapas = [
    {
      chave: chave("inicio"),
      titulo: "Visão do Flow",
      rota: "/flow",
      passos: [
        {
          alvo: '[data-tour="seletor-modulo"]',
          titulo: "Você trocou de módulo",
          texto:
            "O <strong>Hub</strong> cuida do que a imobiliária TEM: acervo, vitrine, equipe. O " +
            "<strong>Flow</strong> cuida do que ela está FECHANDO. Este seletor troca entre os dois " +
            "— e o seu trabalho no Hub continua exatamente onde estava.",
          lado: ["right", "bottom"],
          respiro: 6,
        },
        {
          alvo: '[data-tour="flow-funil-resumo"]',
          titulo: "O funil de relance",
          texto:
            "Sete etapas, do primeiro contato ao fechamento. Cada barra é clicável e leva à lista " +
            "daquela etapa. O valor ao lado é a soma do que está em jogo ali.",
          lado: ["top", "bottom"],
        },
        {
          /* Só existe quando há negócio parado — e é justamente o passo que
             mais ensina. Sem o alvo, o motor esperaria 3,5s e desistiria. */
          exige: podeNegocios,
          alvo: '[data-tour="flow-parados"]',
          titulo: "O que pede ação vem primeiro",
          texto:
            "Negócio sem contato registrado há dias aparece aqui, no topo, antes de qualquer " +
            "número bonito. Negócio esquecido não avisa que morreu — ele só some do fim do mês.",
          lado: "bottom",
          /* Some se não houver nenhum parado: descartado na montagem em vez de
             procurado em vão. */
          pularSe: undefined,
        },
      ],
    },

    podeNegocios && {
      chave: chave("funil"),
      titulo: "Funil de vendas",
      rota: "/flow/funil",
      passos: [
        {
          alvo: '[data-tour="flow-funil"]',
          titulo: "Arraste para mudar de etapa",
          texto:
            "Cada cartão é um negócio. Arraste entre as colunas para movê-lo — e dá para voltar, " +
            "que é o normal: cliente some, volta, muda de imóvel. Um funil que só anda para a " +
            "frente força o corretor a mentir sobre onde o negócio está.",
          lado: "bottom",
        },
        {
          alvo: '[data-tour="flow-funil"] .funil-cartao',
          titulo: "No celular, o seletor",
          texto:
            "Dentro do cartão há uma lista de etapas. Ela faz o mesmo que o arrasto e funciona no " +
            "toque e no teclado — arrastar é o atalho do mouse, não o único caminho.",
          lado: ["right", "bottom"],
          esperaAlvoMs: 1500,
        },
      ],
    },

    podeNegocios && {
      chave: chave("negocio"),
      titulo: "Dentro de um negócio",
      // Sem rota: o tour não tem como saber o id de um negócio que talvez nem
      // exista ainda. Ele aponta a porta a partir do funil, como a etapa da
      // Vitrine faz no tour do Hub.
      rota: null,
      passos: [
        {
          alvo: '[data-tour="flow-negocios"], [data-tour="flow-funil"]',
          titulo: "A ficha do negócio",
          texto:
            "Clicar num cartão abre a ficha: as partes, o imóvel, os documentos, as validações e o " +
            "contrato. É lá que o negócio é trabalhado de verdade — e é lá que o sistema diz, em " +
            "letras grandes, <strong>o que ainda falta para fechar</strong>.",
          lado: ["top", "bottom"],
        },
      ],
    },

    podeCaptacao && {
      chave: chave("captacao"),
      titulo: "Captação",
      rota: "/flow/captacao",
      passos: [
        {
          alvo: '[data-tour="flow-captacao"]',
          titulo: "O lead entra sozinho",
          texto: temCaptacao
            ? "Cada portal ganha um endereço próprio. Você cola essa URL no painel do ZAP, do " +
              "VivaReal ou do Facebook, e o interessado vira lead, vira negócio e cai na fila de " +
              "um corretor — sem ninguém digitar nada."
            : "Aqui ficam os endereços que os portais chamam para entregar leads automaticamente. " +
              "No seu plano atual os negócios são criados à mão; a captação automática entra a " +
              "partir do <strong>Profissional</strong>.",
          lado: "bottom",
        },
      ],
    },

    podeValidar && {
      chave: chave("validacao"),
      titulo: "Conferência",
      rota: "/flow/validacao",
      passos: [
        {
          alvo: '[data-tour="flow-validacao"]',
          titulo: "As duas travas",
          texto:
            "Nenhum negócio vira <strong>Ganho</strong> sem que o jurídico e o financeiro marquem " +
            "aqui que conferiram. Não é burocracia da ferramenta: é a sua regra, aplicada por ela. " +
            "Cada setor só consegue marcar a própria caixa.",
          lado: "bottom",
        },
      ],
    },

    podeContratos && {
      chave: chave("contratos"),
      titulo: "Contratos",
      rota: "/flow/modelos",
      passos: [
        {
          alvo: '[data-tour="flow-modelos"]',
          titulo: "A minuta se preenche sozinha",
          texto:
            "Você cadastra o texto do contrato uma vez, com marcadores no lugar dos dados. O " +
            "sistema cruza comprador, vendedor e imóvel e devolve o documento pronto. Um modelo de " +
            "compra e venda já vem junto para você começar.",
          lado: "bottom",
        },
        {
          alvo: '[data-tour="flow-modelos"]',
          titulo: "E ele nunca sai pela metade",
          texto: temAssinatura
            ? "Marcador sem dado no cadastro <strong>impede</strong> o contrato de ser gerado — ele " +
              "nunca vira espaço em branco. Com tudo preenchido, o contrato vai para assinatura " +
              "digital e o painel acompanha quem já assinou."
            : "Marcador sem dado no cadastro <strong>impede</strong> o contrato de ser gerado — ele " +
              "nunca vira espaço em branco. A assinatura digital integrada entra a partir do plano " +
              "<strong>Profissional</strong>.",
          lado: "top",
        },
      ],
    },

    podeComissoes && {
      chave: chave("comissoes"),
      titulo: "Comissões",
      rota: "/flow/comissoes",
      passos: [
        {
          alvo: '[data-tour="flow-comissoes"]',
          titulo: "O split sai automático",
          texto:
            "Quando o negócio fecha, a comissão é calculada e <strong>congelada</strong>: quanto " +
            "ficou com a casa e quanto com o corretor. Mudar a política depois não reescreve o " +
            "passado — quem recebeu já recebeu.",
          lado: "bottom",
        },
      ],
    },
  ].filter(Boolean);

  // Mesmo filtro por passo do tour do Hub. Ver `montarFluxoTour`.
  for (const etapa of etapas) {
    etapa.passos = etapa.passos.filter((p) => p.exige === undefined || p.exige);
  }
  const comPassos = etapas.filter((e) => e.passos.length);

  /* O fecho, na última etapa que sobrou. Ele aponta de volta para o seletor:
     o medo de quem acabou de conhecer um módulo novo é "e o meu trabalho de
     antes?". Terminar mostrando a porta de volta responde isso sem ninguém
     precisar perguntar. */
  const ultima = comPassos[comPassos.length - 1];
  if (ultima) {
    ultima.passos = [
      ...ultima.passos,
      {
        alvo: '[data-tour="seletor-modulo"]',
        titulo: "É isso — e o Hub continua ali",
        texto:
          "O seletor no topo leva de volta ao <strong>Hub</strong> a qualquer momento, com tudo " +
          "como você deixou. Pode rever este tour em <strong>Configurações</strong>.",
        lado: ["right", "bottom"],
        respiro: 6,
      },
    ];
  }

  return comPassos;
}

/** Todas as chaves do tour do Flow — é o que "explorar por conta própria" marca. */
export function chavesDoFlow(fluxo) {
  return [ETAPA_BOAS_VINDAS_FLOW, ...fluxo.map((e) => e.chave)];
}
