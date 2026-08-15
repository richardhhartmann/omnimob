import { planoLiberaIA, planoLiberaRedes, planoLiberaTour360 } from "./planos";

/* ────────────────────────────────────────────────────────────────────────────
   Tours DE TELA — mão na massa, um por página.

   Diferença para o tour global (`tourFluxo.js`): aquele passa por cima de tudo
   uma vez só, no primeiro acesso, e é uma apresentação. Estes são AULAS: abrem
   quando a pessoa decide entrar numa tela pela primeira vez, e a levam a fazer
   a coisa de verdade — cadastrar o imóvel, cadastrar o cliente. Por isso não
   entram nos 17 passos do global: quem só quis dar uma olhada no sistema não
   deve ser obrigado a preencher um formulário inteiro.

   PASSO INTERATIVO: `interativo: true` abre um furo na lâmina de bloqueio, e
   `aguardar` tranca o "Próximo" até a ação acontecer — e destranca de volta se
   a pessoa desfizer:
     "preencher" — o campo precisa ter valor (`minimo` exige N caracteres;
                   `vazioQuando` diz qual texto de combo ainda significa "vazio")
     "clique"    — o alvo precisa ser clicado; o tour segue sozinho depois
     "existir"   — espera `aguardarAlvo` APARECER no DOM
     "sumir"     — espera `aguardarAlvo` DESAPARECER
   Somados a `avancarSozinho` (segue sem pedir "Próximo") e a `pularSe` (o passo
   se descarta na hora quando o seletor está presente — como reconhecer que a
   pessoa já passou daquela etapa antes de o tour abrir).

   O ROTEIRO DO IMÓVEL MUDA COM O PLANO, e não por capricho: no Premium a IA
   está ligada e o formulário ESCONDE os campos até a primeira foto entrar
   (`bloquearSemFoto` em PropertyForm) — um tour que mandasse "digite o título"
   apontaria para um campo que ainda não existe. No Profissional não há IA mas
   há redes sociais, e existe um passo de divulgação que o Básico não tem.
   Prometer recurso que o plano não dá é pior que não falar dele.
   ──────────────────────────────────────────────────────────────────────────── */

// Prefixo das chaves no banco. Separa das etapas do tour global na hora de ler
// o progresso — e deixa óbvio na tabela de onde cada linha veio.
export const PREFIXO_TELA = "tela:";

const chave = (nome) => `${PREFIXO_TELA}${nome}`;

/** Rota → chave da tela. `startsWith` porque o editor tem slug no meio. */
export function telaDaRota(pathname) {
  if (pathname === "/imoveis/novo") return "imoveis-novo";
  if (pathname === "/clientes") return "clientes";
  if (pathname === "/usuarios") return "usuarios";
  if (pathname === "/cargos") return "cargos";
  if (pathname.startsWith("/vitrine/") && pathname.endsWith("/editar")) return "vitrine-editor";
  return null;
}

/* ── Cadastro de imóvel ─────────────────────────────────────────────────────
   O formulário é um assistente de quatro passos (Identificação → Localização →
   Detalhes → Divulgar). O tour acompanha os dois primeiros de perto, que é onde
   as pessoas travam, e depois entrega o volante.
   ────────────────────────────────────────────────────────────────────────── */
function tourImovel({ plano }) {
  /* Os três recursos que MUDAM A TELA, não só o discurso:
       IA      esconde os campos até a primeira foto (`bloquearSemFoto`)
       redes   acrescenta uma quarta etapa "Divulgar" ao assistente
               (`visibleSteps = canPublish ? STEPS : STEPS.slice(0, 3)`)
       360     libera marcar foto como panorâmica
     Por isso o roteiro consulta os três: um passo que fale de etapa que não
     existe naquele plano manda a pessoa procurar um botão fantasma. */
  const comIA = planoLiberaIA(plano);
  const comRedes = planoLiberaRedes(plano);
  const com360 = planoLiberaTour360(plano);

  const passos = [
    {
      titulo: "Vamos cadastrar um imóvel juntos",
      texto:
        "Este é o cadastro que alimenta a sua vitrine, os anúncios e as métricas. " +
        "Vou acompanhar você até o imóvel estar no ar — leva poucos minutos.",
      alvo: null,
    },
    {
      alvo: '[data-tour="imovel-menu-novo"]',
      titulo: "Comece por aqui",
      texto: "Clique em <strong>Novo Imóvel</strong> para abrir o formulário.",
      lado: ["bottom", "top"],
      interativo: true,
      // Quem já abriu o formulário antes do tour subir não precisa ouvir para
      // clicar num botão que não está mais na tela.
      pularSe: '[data-tour="imovel-fotos"], [data-tour="imovel-titulo"]',
      // Espera o formulário ABRIR, não o clique: assim vale tanto para quem
      // clica agora quanto para quem já tinha clicado. E segue sozinho — o
      // formulário na tela já é a resposta, pedir "Próximo" seria cerimônia.
      aguardar: "existir",
      aguardarAlvo: '[data-tour="imovel-fotos"], [data-tour="imovel-titulo"]',
      avancarSozinho: true,
      rotuloEspera: "Clique em Novo Imóvel",
    },
  ];

  /* A ÁREA PONTILHADA SOME QUANDO EXISTE FOTO — o formulário só a desenha com
     `images.length === 0 && existingImages.length === 0`. Então "sumiu" é a
     forma honesta de perguntar "já tem foto?": vale para foto nova e para foto
     já salva, e volta a travar sozinho se a pessoa apagar a única que tinha. */
  const esperaFoto = {
    aguardar: "sumir",
    aguardarAlvo: '[data-tour="imovel-fotos"]',
    avancarSozinho: true,
    rotuloEspera: "Envie uma foto para seguir",
  };

  /* O campo de CEP só existe na etapa de Localização. Achá-lo na tela é a prova
     de que a Identificação já ficou para trás — então todo passo dela pode ser
     descartado na hora, em vez de esperar 3,5s cada um procurando um campo que
     a pessoa já preencheu antes de o tour abrir. */
  const jaPassouIdentificacao = { pularSe: '[data-tour="imovel-cep"]' };

  if (comIA) {
    /* Premium: a IA lê as fotos e preenche o resto. O formulário só revela os
       campos depois da primeira foto, então a foto é obrigatoriamente o
       primeiro passo — não é escolha do tour, é como a tela funciona. */
    passos.push(
      {
        alvo: '[data-tour="imovel-fotos"]',
        titulo: "Comece pelas fotos",
        texto:
          "No seu plano a <strong>IA preenche o cadastro a partir das fotos</strong>: " +
          "título, descrição e detalhes saem prontos, e você só revisa. " +
          "Envie ao menos uma foto do imóvel para continuar.",
        lado: ["bottom", "top"],
        interativo: true,
        ...esperaFoto,
      },
      {
        alvo: '[data-tour="imovel-titulo"]',
        ...jaPassouIdentificacao,
        titulo: "O título já veio pronto",
        texto:
          "A IA escreveu isto a partir das suas fotos. <strong>Revise sempre</strong> — " +
          "ela acerta o tom, mas quem conhece o imóvel é você. Pode editar à vontade.",
        lado: ["bottom", "top"],
        interativo: true,
        aguardar: "preencher",
        rotuloEspera: "Confira o título",
      },
    );
  } else {
    passos.push(
      {
        alvo: '[data-tour="imovel-fotos"]',
        titulo: "As fotos vêm primeiro",
        texto:
          "É a foto que faz o cliente parar na sua vitrine. Pode arrastar várias de uma vez — " +
          "a primeira vira a capa do anúncio." +
          (com360
            ? " Seu plano ainda aceita <strong>foto 360°</strong>: subiu uma panorâmica, o sistema reconhece e o cliente navega pelo ambiente."
            : "") +
          " Envie ao menos uma para continuar.",
        lado: ["bottom", "top"],
        interativo: true,
        ...esperaFoto,
      },
      {
        alvo: '[data-tour="imovel-titulo"]',
        ...jaPassouIdentificacao,
        titulo: "Título do anúncio",
        texto:
          "É a primeira linha que o cliente lê. Diga o tipo, os quartos e o bairro: " +
          "<em>Apartamento 3 quartos no Setor Bueno</em> funciona melhor que <em>Ótima oportunidade</em>.",
        lado: ["bottom", "top"],
        interativo: true,
        aguardar: "preencher",
        rotuloEspera: "Escreva o título",
      },
    );
  }

  passos.push(
    {
      alvo: '[data-tour="imovel-descricao"]',
      ...jaPassouIdentificacao,
      titulo: "Descrição",
      texto: comIA
        ? "Também escrita pela IA. Vale acrescentar o que só você sabe — o vizinho silencioso, a reforma recente, o sol da manhã."
        : "Conte os diferenciais: acabamento, posição do sol, o que tem por perto. É aqui que o interessado decide se agenda a visita.",
      lado: ["top", "bottom"],
      interativo: true,
      aguardar: "preencher",
      // Uma frase de verdade, não uma letra: descrição é o campo que mais
      // vende, e deixar passar "a" seria ensinar a preencher por preencher.
      minimo: 10,
      rotuloEspera: "Escreva a descrição",
    },
    {
      alvo: '[data-tour="imovel-preco"]',
      ...jaPassouIdentificacao,
      titulo: "Preço",
      texto: "Digite só os números — a formatação em reais é automática.",
      lado: ["top", "bottom"],
      interativo: true,
      aguardar: "preencher",
      rotuloEspera: "Informe o preço",
    },
    {
      alvo: '[data-tour="imovel-tipo"]',
      ...jaPassouIdentificacao,
      titulo: "Tipo de imóvel",
      texto:
        "A categoria decide quais campos aparecem adiante — um terreno não pergunta suítes. " +
        "Faltando alguma tipologia, dá para criá-la em Gerenciar Imóveis › Categoria.",
      lado: ["top", "bottom"],
      interativo: true,
      aguardar: "preencher",
      vazioQuando: "Selecione uma categoria",
      avancarSozinho: true,
      rotuloEspera: "Escolha a categoria",
    },
    {
      alvo: '[data-tour="imovel-contrato"]',
      ...jaPassouIdentificacao,
      titulo: "Venda, locação ou permuta",
      texto: "Define como o imóvel aparece na vitrine e em que filtro ele entra para o cliente.",
      lado: ["top", "bottom"],
      interativo: true,
      aguardar: "preencher",
      vazioQuando: "Selecione o tipo",
      avancarSozinho: true,
      rotuloEspera: "Escolha o tipo de negócio",
    },
    /* Comodidades da tipologia — OPCIONAL, e por dois motivos.

       Primeiro porque o bloco só existe quando a tipologia escolhida tem
       atributos configurados (`tipoSelecionado.atributos?.length > 0`): para um
       terreno sem atributos cadastrados ele nem é desenhado. `esperaAlvoMs`
       curto faz o tour seguir na hora nesse caso, em vez de encarar o vazio por
       três segundos e meio.

       Segundo porque nada aqui é obrigatório para salvar o imóvel — travar o
       "Próximo" seria inventar uma exigência que o formulário não faz. */
    {
      alvo: '[data-tour="imovel-atributos"]',
      ...jaPassouIdentificacao,
      titulo: "O que este imóvel tem",
      texto:
        "Piscina, elevador, portaria 24h, mobiliado — marque o que existe. " +
        "A lista muda conforme a tipologia, e é por estes itens que o cliente filtra na vitrine. " +
        "<strong>Opcional:</strong> pode marcar agora ou voltar depois.",
      lado: ["top", "bottom"],
      interativo: true,
      esperaAlvoMs: 700,
    },
    {
      alvo: '[data-tour="imovel-continuar"]',
      ...jaPassouIdentificacao,
      titulo: "Para a próxima etapa",
      texto:
        "A identificação está completa. <strong>Continuar</strong> leva à localização — " +
        "e o assistente só deixa avançar com o obrigatório preenchido.",
      lado: ["top", "right"],
      interativo: true,
      /* Espera CHEGAR na etapa seguinte, não o clique. O assistente recusa
         avançar quando falta obrigatório, e um passo que destravasse no clique
         seguiria com o tour enquanto a tela fica parada — a pessoa terminaria o
         roteiro na Identificação achando que cadastrou o imóvel. */
      aguardar: "existir",
      aguardarAlvo: '[data-tour="imovel-cep"]',
      avancarSozinho: true,
      rotuloEspera: "Clique em Continuar",
    },
    {
      alvo: '[data-tour="imovel-cep"]',
      titulo: "O CEP faz o resto",
      texto:
        "Digite o CEP e saia do campo: rua, bairro, cidade e estado se preenchem sozinhos. " +
        "Sobra só o número e o complemento. " +
        "<strong>Não sabe o CEP?</strong> Siga em frente — os próximos passos preenchem tudo na mão.",
      lado: ["bottom", "top"],
      interativo: true,
    },
    {
      alvo: '[data-tour="imovel-endereco"]',
      titulo: "Rua e número",
      texto:
        "Se você informou o CEP, a rua já veio; falta o que ele não sabe — número e complemento. " +
        "Se preferiu pular o CEP, escreva o logradouro inteiro aqui.",
      lado: ["bottom", "top"],
      interativo: true,
      aguardar: "preencher",
      minimo: 5,
      rotuloEspera: "Complete o endereço",
    },
    /* Bairro, cidade e UF são TÃO obrigatórios quanto o endereço
       (`FIELD_STEP` põe os quatro na etapa 1). O roteiro só cobria o endereço
       porque eu escrevi contando com o CEP preenchendo o resto — mas quem não
       tem o CEP em mãos preenche na mão, e o tour mandava clicar em Continuar
       num formulário que ia recusar por três campos que ele nunca mostrou.
       Passo separado porque bairro e cidade vivem numa grade de duas colunas: o
       holofote cobre as duas de uma vez. */
    {
      alvo: '[data-tour="imovel-bairro-cidade"]',
      titulo: "Bairro e cidade",
      texto:
        "Os dois são obrigatórios, e é por eles que o cliente filtra a busca na sua vitrine. " +
        "Vieram do CEP? Só confira. Vieram vazios? Preencha agora.",
      lado: ["bottom", "top"],
      interativo: true,
      aguardar: "preencher",
      todosCampos: true, // bairro E cidade — não basta um
      minimo: 2,
      rotuloEspera: "Preencha bairro e cidade",
    },
    {
      alvo: '[data-tour="imovel-uf"]',
      titulo: "Estado",
      texto: "Duas letras — <em>GO</em>, <em>SP</em>, <em>MG</em>. É o último obrigatório desta etapa.",
      lado: ["bottom", "top"],
      interativo: true,
      aguardar: "preencher",
      minimo: 2,
      rotuloEspera: "Informe a UF",
    },
  );

  /* O assistente tem QUATRO etapas (Identificação → Localização → Detalhes →
     Divulgar), e a de Detalhes é fácil de esquecer ao escrever o roteiro. Este
     passo existe para atravessá-la de verdade: precisa ser interativo e exigir
     o clique, senão a lâmina do tour bloqueia o próprio botão que ele manda
     apertar — e o "Próximo" do cartão avançaria o tour sem avançar a tela,
     deixando a pessoa no fim do roteiro parada na Localização. */
  passos.push(
    {
      alvo: '[data-tour="imovel-continuar"]',
      titulo: "Agora os detalhes",
      texto:
        "Localização pronta. <strong>Continuar</strong> leva à etapa de <strong>Detalhes</strong> — " +
        "quartos, suítes, vagas e área. Os campos aí mudam conforme a tipologia que você escolheu: " +
        "um terreno não pergunta suíte.",
      lado: ["top", "right"],
      interativo: true,
      // Mesma razão do passo anterior: o que libera é chegar em Detalhes (onde
      // o botão do rodapé vira "Cadastrar imóvel"), não ter clicado.
      aguardar: "existir",
      aguardarAlvo: '[data-tour="imovel-salvar"]',
      avancarSozinho: true,
      rotuloEspera: "Clique em Continuar",
    },
    /* Atributos e áreas. São obrigatórios (`FIELD_STEP` põe quartos, vagas,
       suítes e a primeira área na etapa 2) e mudam com a tipologia escolhida lá
       atrás: comercial pergunta salas e banheiros, residencial pergunta quartos
       e suítes, e as áreas vêm da configuração do tipo de imóvel. Por isso o
       texto fala do que a etapa É, não de campos com nome fixo — nomear
       "suítes" para quem cadastra um terreno seria apontar o vazio. */
    /* A FINALIDADE VEM ANTES DAS QUANTIDADES, e não é questão de ordem estética:
       é ela que decide QUAIS campos a grade seguinte mostra
       (`form.finalidade === "COMERCIAL"` troca quartos e suítes por salas e
       banheiros). Falar das quantidades primeiro seria descrever campos que
       ainda podem virar outros embaixo da pessoa. */
    {
      alvo: '[data-tour="imovel-finalidade"]',
      titulo: "Residencial ou comercial?",
      texto:
        "Esta escolha muda as perguntas logo abaixo: <strong>residencial</strong> pede quartos e suítes, " +
        "<strong>comercial</strong> pede salas e banheiros. Ela também separa o imóvel na busca da sua vitrine.",
      lado: ["top", "bottom"],
      interativo: true,
      aguardar: "preencher",
      vazioQuando: "Não informado",
      avancarSozinho: true,
      rotuloEspera: "Escolha a finalidade",
    },
    {
      alvo: '[data-tour="imovel-quantidades"]',
      titulo: "Os números do imóvel",
      texto:
        "Quantidades que o cliente usa para filtrar. Zero é resposta válida; deixar em branco não é.",
      lado: ["top", "bottom"],
      interativo: true,
      aguardar: "preencher",
      todosCampos: true,
      rotuloEspera: "Preencha as quantidades",
    },
    {
      alvo: '[data-tour="imovel-areas"]',
      titulo: "Área",
      texto:
        "Os campos de área vêm da tipologia: um apartamento pede área privativa, um terreno pede " +
        "área do terreno. A <strong>primeira é obrigatória</strong>; as demais entram se você tiver o dado.",
      lado: ["top", "bottom"],
      interativo: true,
      aguardar: "preencher",
      rotuloEspera: "Informe a área",
    },
    {
      alvo: '[data-tour="imovel-salvar"]',
      titulo: comRedes ? "Cadastrar e seguir para Divulgar" : "Fechar o cadastro",
      texto: comRedes
        ? "Preenchidos os detalhes, este botão grava o imóvel e abre a <strong>quarta etapa: Divulgar</strong>, " +
          "que o seu plano libera. De lá o mesmo anúncio vai para Facebook, Instagram e WhatsApp — " +
          (comIA
            ? "com legenda e hashtags escritas pela IA, prontas para revisar."
            : "sem você reescrever o texto em cada canal.") +
          " Nada é publicado sem você mandar."
        : "Preenchidos os detalhes, este botão fecha o cadastro. Assim que o imóvel ficar ativo, " +
          "ele já aparece na sua vitrine pública — é ela o seu canal de divulgação.",
      lado: ["top", "right"],
      /* NÃO interativo de propósito: aqui o holofote só mostra onde fica o
         botão. Publicar é decisão da pessoa, tomada com o cadastro revisado —
         não um passo do tutorial. Deixar o furo aberto convidaria a gravar um
         imóvel de treino no portfólio real, e um anúncio de mentira na vitrine
         pública é justamente o que passamos a evitar ao tirar os imóveis de
         exemplo do provisionamento. */
    },
    {
      alvo: null,
      titulo: "O resto é com você",
      texto:
        "Termine no seu ritmo. Vou sair daqui para não atrapalhar — " +
        "e este tour não volta a aparecer nesta tela.",
    },
  );

  return { chave: chave("imoveis-novo"), titulo: "Cadastro de imóvel", rota: null, passos };
}

/* ── Demais telas ───────────────────────────────────────────────────────── */

function tourClientes() {
  return {
    chave: chave("clientes"),
    titulo: "Cadastro de cliente",
    rota: null,
    passos: [
      {
        alvo: '[data-tour="clientes-novo"]',
        titulo: "Vamos cadastrar um cliente",
        texto:
          "Lead é quem chegou pela vitrine; cliente é quem você já conhece e quer manter por perto. " +
          "Clique em <strong>Novo Cliente</strong> para começarmos.",
        lado: ["left", "bottom"],
        interativo: true,
        aguardar: "clique",
        rotuloEspera: "Clique em Novo Cliente",
      },
      {
        alvo: '[data-tour="cliente-nome"]',
        titulo: "Nome completo",
        texto: "É o único campo obrigatório. Todo o resto pode entrar depois, conforme você conhece a pessoa.",
        lado: ["bottom", "top"],
        interativo: true,
        aguardar: "preencher",
        rotuloEspera: "Escreva o nome",
      },
      {
        alvo: '[data-tour="cliente-cpf"]',
        titulo: "CPF",
        texto: "Opcional agora, necessário na hora do contrato. A máscara se encarrega da pontuação.",
        lado: ["bottom", "top"],
        interativo: true,
      },
      {
        alvo: '[data-tour="cliente-whatsapp"]',
        titulo: "WhatsApp",
        texto:
          "É o canal que mais fecha negócio. Preenchendo aqui, libera-se logo abaixo a opção de " +
          "<strong>receber divulgações</strong> — só marque com o consentimento da pessoa.",
        lado: ["bottom", "top"],
        interativo: true,
      },
      {
        alvo: null,
        titulo: "Pronto",
        texto:
          "Endereço, aniversário e observações ficam mais abaixo, todos opcionais. " +
          "Salve quando quiser — dá para completar o cadastro depois.",
      },
    ],
  };
}

function tourUsuarios() {
  /* O formulário SUBSTITUI a listagem (`view === "form"` troca a tela inteira),
     então nenhum alvo da lista sobrevive ao clique em "Novo Usuário" — era isso
     que deixava o tour sem onde se agarrar da metade em diante: ele apontava
     para o cabeçalho da lista, que já não estava montado. Daqui para baixo todo
     passo ancora numa âncora do próprio formulário. */
  return {
    chave: chave("usuarios"),
    titulo: "Cadastro de usuário",
    rota: null,
    passos: [
      {
        alvo: '[data-tour="usuarios-novo"]',
        titulo: "Vamos criar um acesso",
        texto:
          "Cada pessoa da equipe entra com o próprio login — nada de senha compartilhada. " +
          "Clique em <strong>Novo Usuário</strong>.",
        lado: ["left", "bottom"],
        interativo: true,
        // Quem já estava com o formulário aberto não precisa ouvir para clicar
        // num botão que a troca de view tirou da tela.
        pularSe: '[data-tour="usuario-nome"]',
        // Espera o formulário APARECER, não o clique: vale para quem clica agora
        // e para quem já tinha clicado, e o formulário na tela já é a resposta.
        aguardar: "existir",
        aguardarAlvo: '[data-tour="usuario-nome"]',
        avancarSozinho: true,
        rotuloEspera: "Clique em Novo Usuário",
      },
      {
        alvo: '[data-tour="usuario-nome"]',
        titulo: "Quem é a pessoa",
        texto:
          "Nome completo, como você quer vê-la na lista da equipe e ao lado dos imóveis que ela cadastrar.",
        lado: ["bottom", "top"],
        interativo: true,
        aguardar: "preencher",
        minimo: 3,
        rotuloEspera: "Escreva o nome",
      },
      {
        alvo: '[data-tour="usuario-login"]',
        titulo: "O login e o sufixo da casa",
        texto:
          "Digite só a base — <em>joao</em>, <em>maria.silva</em>. O <strong>sufixo da sua imobiliária</strong> " +
          "aparece colado ao campo e entra sozinho: é ele que permite a duas imobiliárias diferentes " +
          "terem um <em>joao</em> cada uma. A linha abaixo do campo mostra o login final.",
        lado: ["bottom", "top"],
        interativo: true,
        aguardar: "preencher",
        minimo: 3,
        rotuloEspera: "Escreva o login",
      },
      {
        alvo: '[data-tour="usuario-cargo"]',
        titulo: "O cargo é que manda",
        texto:
          "Permissão não se dá por pessoa, e sim pelo <strong>cargo</strong> escolhido aqui: " +
          "ele decide quais telas e quais botões existem para ela. " +
          "Quem monta os cargos é você, na tela de <strong>Cargos e Permissões</strong>.",
        lado: ["bottom", "top"],
        interativo: true,
        aguardar: "preencher",
        vazioQuando: "Selecione o cargo",
        avancarSozinho: true,
        rotuloEspera: "Escolha o cargo",
      },
      {
        alvo: '[data-tour="usuario-senha"]',
        titulo: "Sem senha aqui",
        texto:
          "Você não define senha para ninguém. A pessoa informa o login no primeiro acesso e " +
          "escolhe a própria senha na tela seguinte — você nunca chega a saber qual é. " +
          "Se um dia ela esquecer, você marca <em>forçar troca</em> na edição em vez de descobrir a antiga.",
        lado: ["top", "bottom"],
      },
      {
        alvo: '[data-tour="usuario-salvar"]',
        titulo: "Criar o acesso",
        texto:
          "<strong>Criar Usuário</strong> fecha o cadastro e a pessoa já pode entrar. " +
          "Na listagem dá para desativar quem saiu da equipe — o acesso morre na hora e o " +
          "histórico do que ela fez continua de pé.",
        lado: ["top", "right"],
        /* NÃO interativo de propósito: o holofote mostra onde fica o botão.
           Gravar o usuário é decisão de quem está cadastrando, não passo do
           tutorial — o tour não deve deixar um "teste" na equipe real. */
      },
      {
        alvo: null,
        titulo: "O resto é com você",
        texto:
          "Termine no seu ritmo. Vou sair daqui para não atrapalhar — " +
          "e este tour não volta a aparecer nesta tela.",
      },
    ],
  };
}

function tourCargos() {
  /* Mesma armadilha da tela de Usuários: o formulário troca a view inteira, e a
     listagem some com ele. Por isso o roteiro atravessa de verdade — entra no
     "Novo Cargo", nomeia o cargo e explica a grade de permissões onde ela está,
     em vez de descrever tudo de longe a partir do cabeçalho. */
  return {
    chave: chave("cargos"),
    titulo: "Cargos e permissões",
    rota: null,
    passos: [
      {
        alvo: '[data-tour="cargos-cabecalho"]',
        titulo: "Aqui se decide quem pode o quê",
        texto:
          "Permissão é por <strong>cargo</strong>, não por pessoa. Monte o cargo uma vez e " +
          "todo mundo que o receber herda o mesmo acesso — inclusive quem entrar na equipe amanhã.",
        lado: "bottom",
        pularSe: '[data-tour="cargo-nome"]',
      },
      {
        alvo: '[data-tour="cargos-novo"]',
        titulo: "Vamos montar um cargo",
        texto:
          "Clique em <strong>Novo Cargo</strong>. O caminho curto é espelhar os papéis que a " +
          "imobiliária já tem: Corretor, Gerente, Estagiário.",
        lado: ["left", "bottom"],
        interativo: true,
        pularSe: '[data-tour="cargo-nome"]',
        // O formulário na tela é a resposta; esperar o clique daria no mesmo com
        // um passo a mais de cerimônia.
        aguardar: "existir",
        aguardarAlvo: '[data-tour="cargo-nome"]',
        avancarSozinho: true,
        rotuloEspera: "Clique em Novo Cargo",
      },
      {
        alvo: '[data-tour="cargo-nome"]',
        titulo: "O nome do cargo vai aqui",
        texto:
          "É o rótulo que aparece na hora de cadastrar um usuário — então escreva a função real, " +
          "não uma sigla: <em>Corretor</em>, <em>Gerente</em>, <em>Estagiário</em>. " +
          "Cargo que descreve a função de verdade quase nunca precisa de ajuste depois.",
        lado: ["bottom", "top"],
        interativo: true,
        aguardar: "preencher",
        minimo: 3,
        rotuloEspera: "Dê um nome ao cargo",
      },
      {
        alvo: '[data-tour="cargo-permissoes"]',
        titulo: "Cada caixa é uma porta do painel",
        texto:
          "Marcar libera, desmarcar tranca — e o que fica desmarcado <strong>some da tela</strong> " +
          "de quem tem esse cargo: não é um botão que avisa “sem permissão”, é um menu que nem aparece. " +
          "<strong>Acessar Painel</strong> é a porta da frente: sem ela, as outras não valem de nada.",
        lado: ["top", "bottom"],
        interativo: true,
      },
      {
        alvo: '[data-tour="cargo-permissoes"]',
        titulo: "Menos é mais seguro",
        texto:
          "Marque o que a função <em>precisa</em>, não o que ela <em>poderia</em> usar. Um corretor " +
          "costuma viver bem com imóveis, leads e clientes; <strong>Gerenciar Usuários</strong> e " +
          "<strong>Gerenciar Cargos</strong> dão poder sobre a própria equipe, e valem só para quem manda. " +
          "Faltou alguma coisa, você acrescenta em dois cliques.",
        lado: ["top", "bottom"],
        interativo: true,
      },
      {
        alvo: '[data-tour="cargo-salvar"]',
        titulo: "Criar e ajustar depois",
        texto:
          "<strong>Criar Cargo</strong> grava o cargo com as caixas que você marcou. " +
          "Daí em diante ele muda sem botão de salvar: ao <em>editar</em> um cargo já existente, " +
          "cada clique numa permissão vai para o banco na hora — o aviso ao lado do título confirma.",
        lado: ["top", "left"],
      },
      {
        alvo: null,
        titulo: "Duas travas que você vai encontrar",
        texto:
          "Não dá para remover <strong>Acessar Painel</strong> nem <strong>Gerenciar Cargos</strong> do " +
          "seu próprio cargo — seria trancar a si mesmo do lado de fora, e essas caixas aparecem " +
          "esmaecidas para você. E cargo em uso por alguém não pode ser excluído sem antes mover essas pessoas.",
      },
    ],
  };
}

function tourVitrineEditor() {
  return {
    chave: chave("vitrine-editor"),
    titulo: "Editor de vitrine",
    rota: null,
    passos: [
      {
        alvo: '[data-tour="vitrine-canvas"]',
        titulo: "Sua página, do seu jeito",
        texto:
          "Esta é a vitrine que o cliente vê. Cada bloco — cabeçalho, destaques, imóveis, rodapé — " +
          "pode ser <strong>arrastado e redimensionado</strong> direto aqui. Nada de código.",
        lado: ["left", "top"],
      },
      {
        alvo: '[data-tour="vitrine-painel"]',
        titulo: "O painel muda com o que você seleciona",
        texto:
          "Sem nada selecionado, ele mostra os ajustes da <strong>página</strong>: tema, cores, dados da empresa. " +
          "Clicando num bloco, ele troca para os ajustes <strong>daquele bloco</strong> — cor, banner, brilho, texto.",
        lado: ["left", "bottom"],
      },
      {
        alvo: '[data-tour="vitrine-modo"]',
        titulo: "Desktop e celular são layouts separados",
        texto:
          "Isto não é uma pré-visualização: são <strong>duas montagens independentes</strong>. " +
          "Mover um bloco no celular não mexe no desktop. Existe um botão para copiar um no outro quando você quiser partir do pronto.",
        lado: "bottom",
      },
      {
        alvo: '[data-tour="vitrine-biblioteca"]',
        titulo: "Tudo o que dá para acrescentar mora aqui",
        texto:
          "<strong>Adicionar</strong> traz a biblioteca de peças — depoimento, números, horários, CTA. " +
          "Clique para pôr no fim da página ou arraste para soltar num ponto exato. " +
          "<strong>Camadas</strong> lista a página inteira, para selecionar, ocultar ou travar sem caçar no canvas.",
        lado: ["right", "bottom"],
      },
      {
        alvo: '[data-tour="vitrine-acoes"]',
        titulo: "Errou? Nada aqui é definitivo",
        texto:
          "Não existe botão de salvar: cada ajuste vai para o banco em segundos. " +
          "Neste menu ficam o <strong>Histórico</strong> de versões e o <strong>Resetar posições</strong>, " +
          "que devolve o layout ao padrão sem tocar nas suas cores e textos. E Ctrl+Z desfaz movimento por movimento.",
        lado: "bottom",
      },
      {
        alvo: null,
        titulo: "Agora é brincar",
        texto:
          "Mexa à vontade — dá para desfazer tudo. Quando gostar do resultado, use <em>Ver Página</em> " +
          "para conferir como ficou para quem chega de fora.",
      },
    ],
  };
}

/**
 * Roteiro da tela pedida, já ajustado ao plano e às permissões.
 * @returns {{chave, titulo, rota, passos}|null}
 */
export function montarTourDeTela(tela, { plano } = {}) {
  switch (tela) {
    case "imoveis-novo":    return tourImovel({ plano });
    case "clientes":        return tourClientes();
    case "usuarios":        return tourUsuarios();
    case "cargos":          return tourCargos();
    case "vitrine-editor":  return tourVitrineEditor();
    default:                return null;
  }
}

/** Chaves de todos os tours de tela — o que "explorar por conta própria" cala. */
export function chavesDasTelas() {
  return ["imoveis-novo", "clientes", "usuarios", "cargos", "vitrine-editor"].map(chave);
}
