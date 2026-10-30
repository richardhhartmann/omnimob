/* Os 24 depoimentos de EXEMPLO da parede "Por que Omnimob" da landing, e a
   regra que monta a parede com as avaliações reais. Saíram da landing porque a
   aba Avaliações do super-admin também lista os exemplos (para ligar e
   desligar cada um) e precisa mostrar a parede exatamente como ela vai ficar. */

/* ── OS RELATOS DA PAREDE ────────────────────────────────────────────────────

   Cada cartão da parede "Por que Omnimob" é uma pessoa falando: nome, cargo,
   imobiliária, cidade e o que ela diz. `frase` é o que cabe no cartão; `relato`
   é o texto inteiro, que abre no painel ao clicar.

   ── TUDO AQUI É FICTÍCIO, E ESTÁ ESCRITO ASSIM DE PROPÓSITO ──
   Pessoas, imobiliárias e cidades não existem — são hipóteses de uso do
   produto, uma por recurso, para a parede não ser uma lista de funcionalidades
   com outro nome. Por isso NÃO há fotos de pessoas: `foto` fica vazio e o
   cartão desenha um avatar de iniciais. No dia em que houver depoimentos de
   verdade, é só preencher `foto` (public/relatos/…) e trocar o texto — e é
   nesse dia que esta seção deixa de ser hipótese. Depoimento inventado com
   rosto de gente numa página que vende é publicidade enganosa (CDC, art. 37).

   `tom` (mint | gold | accent | rose) pinta o cartão como os antigos cartões de
   estatística: é o "marca-texto" que dá ritmo à parede. Os de tom `rose` são
   os do Omniflow.

   ── O TOM DO TEXTO ──
   Escrito como gente escreve, e não como release: minúscula no começo, frase
   sem ponto, "pra", "tá", "kkk", número em algarismo, um parêntese no meio da
   ideia. Vinte e quatro depoimentos todos na mesma gramática perfeita denunciam
   a origem de longe — e é a irregularidade que faz parecer que são pessoas
   diferentes. Ao editar, resista a "corrigir" para o padrão. */
const RELATOS = [
  {
    nome: "Mariana Teles", cargo: "Sócia-diretora", imobiliaria: "Horizonte Azul Imóveis", cidade: "Vila Serena", uf: "SP",
    frase: "o lead chega do site já com o imóvel e o corretor certo. acabou a planilha de segunda de manhã, graças a Deus",
    relato: "Antes os contatos do site caíam num e-mail que alguém lembrava (ou não) de repassar no grupo. Hoje o interessado aparece no painel com o imóvel que ele viu, de onde veio e quem vai atender. Pela primeira vez eu sei de onde vem cada negócio, e olha que já tô nisso há 14 anos.",
  },
  {
    nome: "Rafael Nogueira", cargo: "Corretor", imobiliaria: "Casa & Cia", cidade: "Monte Aurora", uf: "MG",
    frase: "montei a vitrine num sábado de manhã arrastando os bloco. não liguei pra ninguém de TI kkk",
    relato: "Sempre dependi de agência pra mexer no site, e cada vírgula levava uma semana e um boleto. No editor eu mesmo troquei a ordem dos blocos, botei as cores da imobiliária e escrevi direto na página. O que tá no editor é o que sai no ar, sem surpresa.",
    tom: "mint",
  },
  {
    nome: "Cláudia Farias", cargo: "Gerente comercial", imobiliaria: "Lar Serrano", cidade: "Alto do Cedro", uf: "RS",
    frase: "Sei qual imóvel todo mundo abre e ninguém pergunta. Aí é foto ou preço, não tem erro",
    relato: "O desempenho por imóvel me mostra visualização, lead e venda no mesmo cadastro. Apartamento que recebe 300 visitas e zero contato tem alguma coisa errada — antes eu ia descobrir isso 3 meses depois, na reunião de resultado. Agora vejo na quarta-feira.",
  },
  {
    nome: "Diego Salvatti", cargo: "Dono", imobiliaria: "Pontal Imóveis", cidade: "Porto das Garças", uf: "SC",
    frase: "Cadastro uma vez e vai pro site, pro ZAP e pro Instagram. Uma ficha só. Parece bobagem mas não é",
    relato: "Eu mantinha três cadastros do mesmo imóvel: sistema, site e portal. Preço errado em um deles e pronto, dor de cabeça com cliente. Hoje a ficha é uma, o feed dos portais e a publicação nas redes leem dela e eu durmo tranquilo.",
    tom: "gold",
  },
  {
    nome: "Beatriz Camargo", cargo: "Corretora", imobiliaria: "Maresia Imobiliária", cidade: "Baía Clara", uf: "ES",
    frase: "o aviso de lead parado me salvou de perder um cliente que eu tinha esquecido na quinta. ele fechou.",
    relato: "Recebo um e-mail quando um lead fica dois dias sem ninguém encostar. Parece pouco, mas eu atendo umas 30 pessoas por semana e sempre alguém cai no esquecimento, é humano. Agora quem cai volta — e o cliente nem fica sabendo que quase foi esquecido rs",
  },
  {
    nome: "Henrique Dutra", cargo: "Sócio", imobiliaria: "Raiz Imóveis", cidade: "São Bento das Colinas", uf: "PR",
    frase: "cada um vê o que é dele. estagiário não apaga imóvel mais. sim, isso já aconteceu aqui",
    relato: "Criei os cargos: administrador, corretor e um só pra quem edita a vitrine. Antes era todo mundo com a mesma senha de admin, e um belo dia sumiram 12 imóveis e ninguém sabia como. Hoje o registro de atividade diz quem fez o quê, e cada um alcança o que o cargo permite.",
    tom: "accent",
  },
  {
    nome: "Luciana Prado", cargo: "Diretora", imobiliaria: "Bem-Morar", cidade: "Santa Rita das Pedras", uf: "GO",
    frase: "Nosso domínio, nossa cara. O cliente não faz ideia que tem uma Omnimob por trás, e é assim que tem que ser",
    relato: "A vitrine está no nosso endereço, com as nossas cores e o nosso logo. A tecnologia fica invisível. Quem aparece pra quem procura imóvel é a imobiliária — o software é coadjuvante, e o bom coadjuvante ninguém nota.",
  },
  {
    nome: "Tiago Menezes", cargo: "Corretor autônomo", imobiliaria: "Tiago Menezes Imóveis", cidade: "Bosque Alegre", uf: "SP",
    frase: "sou eu sozinho. pago no pix, sem cartão, e o sistema me lembra antes de vencer. nunca mais acordei fora do ar",
    relato: "Não tenho CNPJ com cartão corporativo, é eu e o celular. Pago o plano mensal por Pix e recebo um lembrete 7 dias antes e outro na véspera. Pra quem trabalha sozinho um dia fora do ar é um dia sem trabalhar, então isso pra mim não é detalhe não.",
    tom: "mint",
  },
  {
    nome: "Fernanda Lisboa", cargo: "Marketing", imobiliaria: "Vértice Imóveis", cidade: "Ribeirão Dourado", uf: "MG",
    frase: "A descrição do imóvel a IA escreve em 10 segundos. Eu dou uma revisada, ajusto o tom e vai",
    relato: "Escrever descrição pra 40 imóveis novos por mês era o meu gargalo, sério. Hoje a IA gera título, descrição e legenda a partir da ficha. Eu tiro os exageros, boto a nossa voz e publico. O tempo que sobrou virou vídeo e story, que é o que traz gente de verdade.",
  },
  {
    nome: "Paulo Sérgio Andrade", cargo: "Dono", imobiliaria: "Alameda Imóveis", cidade: "Pedra Branca do Norte", uf: "CE",
    frase: "importei 1.200 imóveis do sistema antigo pela URL do feed. numa tarde. eu tinha pavor disso",
    relato: "Eu tinha medo de trocar de sistema por causa do acervo, era o que me segurava. Colei o endereço do feed do sistema antigo, conferi a prévia — preço no lugar certo, fotos copiadas — e rodei. Entraram como rascunho e a equipe revisou aos poucos antes de publicar. Nem doeu.",
    tom: "gold",
  },
  {
    nome: "Aline Botelho", cargo: "Corretora", imobiliaria: "Sol Nascente", cidade: "Vale dos Ipês", uf: "MT",
    frase: "errei o layout inteiro da vitrine e voltei atrás com ctrl+z. umas 50 vezes, se bobear",
    relato: "No editor eu experimento sem medo: mudo tudo de lugar, não gosto, desfaço. Ele guarda 50 passos e vai salvando sozinho enquanto eu mexo. Nunca mais perdi uma versão que estava boa por ter clicado no lugar errado.",
  },
  {
    nome: "Marcos Vinícius Rocha", cargo: "Gerente", imobiliaria: "Terra Firme Imóveis", cidade: "Campo Sereno", uf: "MS",
    frase: "O celular tem o layout dele. Não é o site do computador espremido — isso muda tudo pra gente",
    relato: "70% dos nossos acessos são pelo celular. Na Omnimob a vitrine do celular é montada separada da do computador: mesma informação, outra ordem, outro tamanho de foto. Foi a diferença entre o cliente rolar a página e o cliente ir embora.",
    tom: "accent",
  },
  {
    nome: "Renata Siqueira", cargo: "Atendimento", imobiliaria: "Novo Lar", cidade: "Serra do Lume", uf: "RJ",
    frase: "o funil me mostrou onde os leads morriam. era na visita. mudamos o roteiro e pronto",
    relato: "O relatório de atendimento mostra até onde cada lead chegou e por que os perdidos se perderam. Descobrimos que a maioria parava depois da visita. Trocamos quem acompanhava as visitas, e o motivo de perda mais comum simplesmente sumiu do gráfico. Dado bom é isso.",
  },
  {
    nome: "Gustavo Amorim", cargo: "Corretor", imobiliaria: "Recanto Imóveis", cidade: "Lagoa Nova do Sul", uf: "RS",
    frase: "peço a arte do status com um toque, publico e vou pra próxima visita. eram 6 por dia no Canva, dentro do carro",
    relato: "O sistema gera a arte do imóvel no formato do status do WhatsApp, com foto, preço e o meu contato. Eu só publico. Parece detalhe mas eu posto 6 imóveis por dia, e antes fazia cada um no Canva, no estacionamento, entre uma visita e outra. Ganhei uma hora por dia fácil.",
    tom: "gold",
  },
  {
    nome: "Simone Carvalho", cargo: "Sócia", imobiliaria: "Trilha Imóveis", cidade: "Cruzeiro das Palmas", uf: "BA",
    frase: "Abri um chamado 22h e de manhã a resposta tava lá no painel, com a conversa inteira. Não é ticket perdido em e-mail",
    relato: "O suporte fica dentro do sistema: abro o chamado, o print da tela vai junto, e a conversa continua ali. Quando resolvem eu sei quem resolveu e quando. Se o problema voltar, reabro o mesmo chamado em vez de explicar tudo de novo pra outra pessoa.",
  },
  {
    nome: "Eduardo Peixoto", cargo: "Diretor", imobiliaria: "Ipê Amarelo Imobiliária", cidade: "Praia do Sol Nascente", uf: "RN",
    frase: "Meus dados são meus. Exportei tudo num arquivo só pra ter certeza — e tinha tudo mesmo",
    relato: "Antes de assinar perguntei como é que eu saía, se um dia quisesse. A resposta foi um botão: exporta imóveis, clientes, leads e equipe num JSON. Testei no primeiro mês. Saber que a porta tá aberta foi, ironicamente, o que me fez ficar.",
    tom: "mint",
  },
  {
    nome: "Patrícia Ramalho", cargo: "Gerente de locação", imobiliaria: "Âncora Imóveis", cidade: "Mirante Alto", uf: "SP",
    frase: "O cliente diz o que procura e o sistema me avisa quando entra um imóvel parecido. Já fechei locação no dia que o imóvel entrou",
    relato: "Cadastro o perfil de busca: bairro, faixa de preço, quartos. Quando entra um imóvel que casa com o perfil, ou quase casa, um pouquinho acima do teto, eu vejo o cruzamento e ligo na hora. Locação é velocidade, quem liga primeiro leva.",
  },
  {
    nome: "Ricardo Tavares", cargo: "Dono", imobiliaria: "Mirante Imobiliária", cidade: "Jardim das Acácias", uf: "PR",
    frase: "a página de cada bairro aparece no Google. gente chega procurando \"apartamento em\" e cai na minha vitrine, do nada",
    relato: "A vitrine gera uma página por bairro e por tipo de imóvel, com o texto certo pra busca. Não fiz nada além de cadastrar bem o endereço. Em 4 meses o site passou a trazer mais contato que o portal que eu pago caro. Tô até repensando o portal.",
    tom: "accent",
  },
  {
    nome: "Camila Ferraz", cargo: "Corretora", imobiliaria: "Aurora Imóveis", cidade: "Terra Nova do Vale", uf: "TO",
    frase: "o interessado marca a visita direto na página do imóvel, com dia e período. metade do vai-e-vem do zap sumiu",
    relato: "O formulário do imóvel tem pedido de visita: a pessoa escolhe a data e se prefere de manhã ou à tarde, e isso chega pra mim como lead já com contexto. Ligo só pra confirmar. Antes eram uns 8 áudios pra marcar uma visita, vocês sabem como é.",
  },
  /* ── O Omniflow ── */
  {
    nome: "Dra. Helena Vasconcelos", cargo: "Jurídico", imobiliaria: "Vale Verde Imobiliária", cidade: "Colinas do Oeste", uf: "MG",
    frase: "O contrato não sai com campo em branco. Falta dado, ele não gera — e me diz o que falta. Pro jurídico isso é tudo",
    relato: "Nas minutas do Omniflow um marcador sem informação vira pendência, não um espaço vazio no documento. Já vi contrato assinado com o CPF do comprador em branco, em outro sistema, e o transtorno que deu. Aqui isso é impossível por construção.",
    tom: "rose",
  },
  {
    nome: "Otávio Brandão", cargo: "Financeiro", imobiliaria: "Acácia Imóveis", cidade: "Enseada Bonita", uf: "SC",
    frase: "a comissão é dividida no fechamento e fica congelada ali. mudou a política depois? o passado não muda. fechar o mês virou conferência",
    relato: "O split do negócio é calculado uma vez, com aritmética decimal (quem já viu 50838,000000000007 numa planilha sabe do que eu falo), e gravado no próprio negócio. Quando a diretoria mudou os percentuais em janeiro, nada de dezembro foi reescrito.",
    tom: "rose",
  },
  {
    nome: "Vanessa Quintela", cargo: "Gerente de vendas", imobiliaria: "Brisa Imobiliária", cidade: "Vila Formosa do Sul", uf: "RS",
    frase: "O negócio só vira ganho com jurídico e financeiro validando. E o painel diz o que falta — acabou o \"quem tava esperando quem\"",
    relato: "A trava de fechamento não bloqueia em silêncio, ela lista os motivos: falta a validação jurídica, falta a financeira, falta o contrato assinado. Cada um sabe o que é seu. Antes era reunião de meia hora pra descobrir que faltava uma assinatura.",
    tom: "rose",
  },
  {
    nome: "Bruno Cavalcanti", cargo: "Corretor", imobiliaria: "Marco Zero Imóveis", cidade: "Pontal das Águas", uf: "PE",
    frase: "o lead do ZAP entra no funil sozinho. colei uma URL no portal e nunca mais copiei e colei nada",
    relato: "Cada portal ganhou um endereço de captação, e é isso que vai no integrador deles. O que chega vira negócio no primeiro estágio, com nome, telefone e o imóvel. Quando um portal mudou o formato do envio, o suporte olhou o corpo original da chamada e ajustou no mesmo dia.",
    tom: "rose",
  },
  {
    nome: "Isabela Monteiro", cargo: "Sócia", imobiliaria: "Girassol Imóveis", cidade: "Morro Azul da Serra", uf: "SP",
    frase: "o contrato vai pra assinatura digital de dentro do negócio e volta assinado pro mesmo lugar. eram 4 sistemas antes",
    relato: "Gero a minuta, mando pra Clicksign sem sair da tela e acompanho quem já assinou. Quando o último assina, o negócio recebe o contrato e libera o fechamento. Antes eram quatro sistemas abertos e um e-mail com anexo pra cada parte. Não sinto falta.",
    tom: "rose",
  },
];

/** Os exemplos com a `chave` que o servidor guarda quando um sai do ar. */
export const RELATOS_DEMO = RELATOS.map((r) => ({
  ...r,
  chave: r.nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  demo: true,
}));

export const LIMITE_DA_PAREDE = 24;

/**
 * A parede como vai ao ar: as avaliações reais primeiro, e os exemplos que
 * continuam no ar completando as vagas, na ordem escrita. É assim que "a real
 * empurra o exemplo": quando entra uma real, o último exemplo da fila sai.
 * `noAr` diz, de cada exemplo, se ele aparece — a aba do super-admin usa para
 * mostrar "sem vaga" no que está ligado mas não coube.
 */
export function montarParede({ reais = [], ocultos = [] } = {}, demos = RELATOS_DEMO, limite = LIMITE_DA_PAREDE) {
  const fora = new Set(ocultos);
  const reaisNoAr = reais.slice(0, limite);
  const vagas = limite - reaisNoAr.length;
  const ligados = demos.filter((d) => !fora.has(d.chave));
  const exemplosNoAr = ligados.slice(0, vagas);
  const noAr = new Set(exemplosNoAr.map((d) => d.chave));
  return {
    relatos: [...reaisNoAr, ...exemplosNoAr],
    estadoDosExemplos: demos.map((d) => ({ ...d, ligado: !fora.has(d.chave), noAr: noAr.has(d.chave) })),
  };
}
