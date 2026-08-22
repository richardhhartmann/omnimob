/* ────────────────────────────────────────────────────────────────────────────
   OS MÓDULOS DO PRODUTO — a definição que a tela inteira lê.

   O Omnimob deixou de ser um sistema só:

     · HUB  — o acervo e a presença. Imóveis, vitrine, leads, clientes, equipe,
              relatórios. É tudo que existia antes desta divisão.
     · FLOW — a operação comercial. Captação por webhook, funil de negócios,
              minuta contratual, assinatura digital, comissão.

   ── AS TRÊS PERGUNTAS, E A ORDEM DELAS ──

     1. A imobiliária CONTRATOU?  `tenant.modulos`        → se não, nem existe
     2. Esta pessoa ALCANÇA?      `cargo.acessarFlow`     → se não, é 403
     3. O PLANO libera o recurso? `RECURSOS_FLOW`         → se não, é convite

   As três são diferentes e produzem telas diferentes. Colapsá-las numa só foi a
   primeira tentativa e ela dava a mesma mensagem ("indisponível") para o
   cliente que precisa falar com o comercial, para o corretor que precisa falar
   com o chefe e para quem só precisa clicar em "fazer upgrade".

   ── ESPELHO DO SERVIDOR ──

   `apps/api/src/services/modulos.js` tem a mesma lista, e é ELE quem protege —
   isto aqui só decide o que desenhar. Mesmo arranjo que `planos.js` já tem com
   `planoMiddleware.js`: são dois pacotes npm sem um módulo comum.

   ── O QUE NÃO MUDA ENTRE OS MÓDULOS ──

   A moldura. `AdminLayout` é um só, e dentro dele `ds-head`, `ds-head--link` e
   `ds-foot` são os mesmos elementos, na mesma posição, com o mesmo
   comportamento. O que troca é o CONTEÚDO da navegação e a paleta de acento.
   Um segundo layout para o Flow seria a mesma armadilha que o editor de vitrine
   já caiu duas vezes: duas versões da mesma coisa divergem, sempre.
   ──────────────────────────────────────────────────────────────────────────── */

export const HUB = "HUB";
export const FLOW = "FLOW";

/* ── A identidade visual de cada módulo ──────────────────────────────────────

   `acento` é o que o seletor, os selos e os realces do módulo usam. NÃO é a cor
   da imobiliária (`--tenant-primary`): aquela é identidade do cliente e continua
   valendo para avatar, iniciais e botão primário. Esta é identidade do PRODUTO,
   e precisa ser a mesma em toda conta — é o que faz a pessoa reconhecer, de
   relance, em qual módulo ela está.

   ── A MARCA É IMAGEM, E ELA É COMPOSTA ──

   A logo de cada módulo é montada de duas peças:

     TIPO_OMNIMOB   o prédio + "OMNIMOB"  — a mesma nos dois
     palavra        "Hub" ou "flow"       — a parte que muda

   Duas imagens e não um wordmark fechado por módulo, e a razão é de
   manutenção: a metade "OMNIMOB" já existe no produto (é a arte do cabeçalho
   da landing), e com wordmarks fechados um retoque nela exigiria reexportar
   uma imagem por módulo — a terceira nasceria fora de registro com as outras
   duas.

   Só a barra ABERTA usa a logo. Recolhida, ela tem 64px e a composição não
   cabe; ali entra `SIMBOLO_OMNIMOB`, o prédio sozinho, e quem distingue o
   módulo é o anel na cor do acento.

   O texto continua aqui e não é decoração: `nome` e `tagline` viram o `alt` da
   imagem e o rótulo acessível do botão. Um seletor que é só imagem deixa quem
   usa leitor de tela sem saber entre o que está escolhendo.

   ── O ACENTO SAI DA LOGO, E NÃO O CONTRÁRIO ──

   `acento` é o que o item ativo da barra e os realces pintam, e ele COPIA a cor
   do wordmark: índigo no Hub (a cor que o painel sempre teve) e o rosa da
   palavra "flow" no Flow.

   O Flow chegou a nascer verde-azulado, antes de a arte existir. Ficou errado
   assim que a logo entrou: um wordmark rosa sentado numa faixa teal lê como
   duas marcas diferentes na mesma caixa. Cor de módulo tem uma fonte só, e é a
   arte.

   NÃO confundir com `--tenant-primary`: aquela é a cor da IMOBILIÁRIA (avatar,
   iniciais, botão primário) e varia de conta para conta. Esta é do PRODUTO e é
   igual em toda conta — é por não variar que ela diz, de relance, em qual
   metade do sistema a pessoa está. */
export const MODULOS = [
  {
    key: HUB,
    nome: "Hub",
    nomeCompleto: "Omnimob Hub",
    /* A PALAVRA do módulo, que senta à direita de `TIPO_OMNIMOB`. Ver a nota
       sobre a logo composta, acima. */
    palavra: "/hub.png",
    /* Uma linha dizendo o que o módulo É. Curta de propósito: ela cabe embaixo
       da logo no balão do seletor (228px) e vira a chamada do cartão na
       landing. Duas frases diferentes para as duas telas seriam duas versões da
       mesma ideia — e a da landing já tinha divergido uma vez. */
    tagline: "O acervo e a presença",
    descricao:
      "Onde a imobiliária cadastra os imóveis, monta a vitrine pública, recebe os " +
      "interessados e organiza a equipe.",
    acento: "#6366f1",
    acentoSuave: "rgba(99,102,241,0.14)",
    /* Para onde a pessoa vai ao entrar neste módulo. Função e não string: no
       Hub o destino depende de `verPainelGestor`, e cravar "/" mandaria o
       gestor para a tela errada toda vez que ele trocasse de módulo. */
    inicial: (cargo) => (cargo?.verPainelGestor ? "/inicio" : "/"),
    /* A porta: a permissão de cargo que dá acesso ao módulo. */
    porta: "acessarPainel",
  },
  {
    key: FLOW,
    nome: "Flow",
    nomeCompleto: "Omnimob Flow",
    palavra: "/flow.png",
    tagline: "A operação comercial",
    descricao:
      "Onde o lead vira negócio: captação automática dos portais, funil por " +
      "estágio, minuta, assinatura digital e comissão.",
    /* O rosa da palavra "flow" no wordmark. Ver a nota sobre o acento, acima. */
    acento: "#ec0b5b",
    acentoSuave: "rgba(236,11,91,0.14)",
    inicial: () => "/flow",
    porta: "acessarFlow",
  },
];

/* O símbolo sozinho, sem palavra nenhuma — o que a barra RECOLHIDA mostra.
   O mesmo para os dois módulos, porque ele É o mesmo nas duas artes. */
export const SIMBOLO_OMNIMOB = "/logo_nova.png";

/* A metade fixa da logo: o prédio e a palavra OMNIMOB, sem o nome do módulo.
   A mesma arte que a landing usa no cabeçalho — uma marca, um arquivo. */
export const TIPO_OMNIMOB = "/tipo_header_alt.png";

/* O acento do Flow, solto. O `ToggleDoFlow` aparece na LANDING, onde não há
   `.ds-shell` publicando `--modulo-acento` — ele precisa da cor como valor, e
   repetir o hexadecimal lá seria a terceira cópia da mesma tinta. */
export const FLOW_ACENTO = MODULOS.find((m) => m.key === FLOW).acento;

export function moduloInfo(key) {
  return MODULOS.find((m) => m.key === key) || MODULOS[0];
}

/** Os módulos que a IMOBILIÁRIA contratou. Ver `modulosDoTenant` no servidor —
 *  a garantia do HUB para conta antiga é feita lá, e esta função só protege
 *  contra a sessão gravada antes de o campo existir. */
export function modulosDoTenant(tenant) {
  const lista = Array.isArray(tenant?.modulos)
    ? tenant.modulos.filter((m) => MODULOS.some((x) => x.key === m))
    : [];
  return lista.includes(HUB) ? lista : [HUB, ...lista];
}

/** Os módulos que ESTA PESSOA alcança: contratados pela conta E abertos pelo
 *  cargo. É a lista que o seletor da barra lateral desenha — e quando ela tem
 *  um item só, o seletor não aparece.
 *
 *  Devolve as chaves na ordem de `MODULOS`, e não na ordem do banco: a ordem em
 *  que os módulos aparecem no seletor é decisão de produto, não de gravação. */
export function modulosDoUsuario(tenant, cargo) {
  const contratados = modulosDoTenant(tenant);
  return MODULOS
    .filter((m) => contratados.includes(m.key) && Boolean(cargo?.[m.porta]))
    .map((m) => m.key);
}

/* ── O que o plano libera dentro do Flow ─────────────────────────────────────
   Espelho de `RECURSOS_FLOW` em `apps/api/src/services/modulos.js`. Os mesmos
   níveis (0 Básico, 1 Profissional, 2 Premium) que `planos.js` usa. */
export const RECURSOS_FLOW = {
  funil: 0,
  negocios: 0,
  documentos: 0,
  minutas: 0,
  comissoes: 0,
  captacaoWebhook: 1,
  assinaturaDigital: 1,
  validacaoSetorial: 1,
  minutaComIA: 2,
};

const NIVEL_DO_PLANO = { BASICO: 0, PROFISSIONAL: 1, PREMIUM: 2 };

export function flowLibera(plano, recurso) {
  const minimo = RECURSOS_FLOW[recurso];
  if (minimo === undefined) return false;
  return (NIVEL_DO_PLANO[String(plano || "").toUpperCase()] ?? 0) >= minimo;
}

/** O nome do plano que abre o recurso — o convite de upgrade precisa dizer
 *  QUAL, senão ele é só um aviso de que a porta está fechada. */
export function planoQueLibera(recurso) {
  const minimo = RECURSOS_FLOW[recurso] ?? 0;
  return minimo >= 2 ? "Premium" : minimo >= 1 ? "Profissional" : "Básico";
}

/* ── Em que módulo esta rota vive ────────────────────────────────────────────

   O seletor precisa saber onde a pessoa ESTÁ para marcar o item certo, e o
   guardião de rota precisa saber para onde mandá-la quando ela chega por um
   link de outro módulo.

   Por PREFIXO e não por lista de rotas: uma tela nova do Flow nasce sob `/flow`
   e já é reconhecida, sem ninguém lembrar de cadastrá-la aqui. Foi assim que a
   lista de rotas do tour envelheceu antes. */
export function moduloDaRota(pathname) {
  return String(pathname || "").startsWith("/flow") ? FLOW : HUB;
}
