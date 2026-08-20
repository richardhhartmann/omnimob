import {
  layoutEmail,
  eyebrow,
  titulo,
  paragrafo,
  forte,
  botao,
  aviso,
  dados,
  itens,
  linkDeReserva,
  divisor,
  esc,
  CORES_EMAIL as COR,
} from "./emailLayout.js";

/**
 * ─── Modelos de e-mail ───────────────────────────────────────────────────────
 * Um por situação. Cada um devolve `{ subject, body, html }`:
 *  - `html` é o que a maioria vê;
 *  - `body` é a versão em texto puro, obrigatória. Cliente que bloqueia HTML,
 *    leitor de tela e filtro de spam olham para ela — mandar só HTML piora a
 *    entregabilidade e deixa gente sem conseguir ler.
 */

const NOME_PLANO = { BASICO: "Básico", PROFISSIONAL: "Profissional", PREMIUM: "Premium" };

/* Endereço público da vitrine para os links dos e-mails.

   Quem chama passa `urlVitrine` já resolvido (ver `enderecoDaVitrine` em
   dominioService) — porque só ele sabe se a imobiliária tem domínio próprio ou
   se o subdomínio está ligado. O fallback existe para não quebrar chamada
   antiga, e reproduz o formato de caminho.

   Link de e-mail erra pior que link de tela: a pessoa guarda a mensagem,
   encaminha para o corretor, cola no WhatsApp. Um endereço desatualizado ali
   circula por semanas. */
function vitrineUrl({ urlVitrine, base, slug }) {
  if (urlVitrine) return urlVitrine;
  return `${String(base || "").replace(/\/+$/, "")}/vitrine/${slug}`;
}

/* O mesmo endereço sem protocolo, para MOSTRAR dentro do corpo do e-mail. */
function vitrineTexto(args) {
  return vitrineUrl(args).replace(/^https?:\/\//, "");
}

// ─── 1. Interesse comercial (vai para o time) ────────────────────────────────

export function emailInteresseComercial({ imobiliaria, email, telefone, plano, temWhatsapp }) {
  const planoTexto = plano ? NOME_PLANO[plano] : "não escolheu (quer conversar)";
  const subject = `Omnimob · novo interesse — ${imobiliaria}${plano ? ` (${NOME_PLANO[plano]})` : ""}`;

  const body = [
    "Novo interesse pela Omnimob vindo da landing.",
    "",
    `Imobiliária: ${imobiliaria}`,
    `E-mail:      ${email}`,
    `Telefone:    ${telefone}${temWhatsapp ? " (tem WhatsApp)" : ""}`,
    `Plano:       ${planoTexto}`,
    "",
    `Recebido em: ${new Date().toLocaleString("pt-BR")}`,
  ].join("\n");

  const html = layoutEmail({
    preheader: `${imobiliaria} pediu contato — plano ${planoTexto}.`,
    conteudo: [
      eyebrow("● NOVO INTERESSE"),
      titulo("Alguém quer falar com a Omnimob"),
      paragrafo(`Veio do formulário da landing. Responder este e-mail já cai direto no interessado.`),
      dados([
        { rotulo: "Imobiliária", valor: imobiliaria },
        { rotulo: "E-mail", valor: email, mono: true },
        { rotulo: "Telefone", valor: `${telefone}${temWhatsapp ? "  ·  tem WhatsApp" : ""}`, mono: true },
        { rotulo: "Plano", valor: planoTexto },
      ]),
      botao("Responder agora", `mailto:${email}`),
      divisor(),
      paragrafo(
        `<span style="color:${COR.apagado};font-size:13px;">Recebido em ${esc(
          new Date().toLocaleString("pt-BR"),
        )}.</span>`,
      ),
    ].join(""),
    rodape: "Aviso interno da plataforma Omnimob.",
  });

  return { subject, body, html };
}

// ─── 2. Convite do teste grátis (link mágico) ────────────────────────────────

export function emailConviteTrial({ imobiliaria, link }) {
  const subject = "Confirme para liberar seu teste da Omnimob";

  const body = [
    `Olá! Falta um passo para o ambiente da ${imobiliaria} entrar no ar.`,
    "",
    "Confirme que este e-mail é seu abrindo o link abaixo:",
    link,
    "",
    "O link vale por 30 minutos. Se não foi você quem pediu, ignore esta mensagem.",
  ].join("\n");

  const html = layoutEmail({
    preheader: `Um clique e o ambiente da ${imobiliaria} entra no ar.`,
    conteudo: [
      eyebrow("● FALTA UM PASSO"),
      titulo("Confirme seu e-mail"),
      paragrafo(
        `Assim que você abrir o link abaixo, criamos o ambiente da ${forte(
          imobiliaria,
        )} na hora — com o painel liberado e a vitrine pública já no ar.`,
      ),
      botao("Liberar meu teste", link),
      linkDeReserva(link),
      aviso(
        `Este link vale por <strong style="color:${COR.forte};">30 minutos</strong>. Se não foi você quem pediu, é só ignorar — nada será criado.`,
      ),
    ].join(""),
  });

  return { subject, body, html };
}

// ─── 3. Ambiente no ar (credenciais) ─────────────────────────────────────────

// `imoveis` continua na assinatura porque as rotas ainda o passam; o ambiente
// nasce vazio, então o texto não promete mais nada cadastrado lá dentro.
export function emailTrialNoAr({ imobiliaria, login, senha, slug, validade, base, urlVitrine }) {
  const urlPainel = `${base}/login`;
  const urlDaVitrine = vitrineUrl({ urlVitrine, base, slug });
  const subject = "Seu teste da Omnimob está no ar";

  const body = [
    `O ambiente da ${imobiliaria} já está funcionando.`,
    "",
    `Acesse:  ${urlPainel}`,
    `Usuário: ${login}`,
    `Senha:   ${senha}`,
    "",
    `Sua vitrine pública: ${urlDaVitrine}`,
    "",
    `O ambiente está limpo, esperando os seus imóveis — o primeiro cadastro leva poucos minutos.`,
    `O teste vale até ${validade} — e nada se perde se você fechar plano antes.`,
  ].join("\n");

  const html = layoutEmail({
    preheader: `Usuário, senha e vitrine da ${imobiliaria} — tudo pronto.`,
    conteudo: [
      eyebrow("● TUDO PRONTO", COR.menta),
      titulo("Seu ambiente está no ar"),
      paragrafo(
        `Criamos a ${forte(imobiliaria)} do zero, com a vitrine já no ar. Ela está esperando os seus imóveis — nada de anúncio de mentira para você apagar depois.`,
      ),
      dados([
        { rotulo: "Usuário", valor: login, mono: true },
        { rotulo: "Senha", valor: senha, mono: true },
        { rotulo: "Vitrine", valor: vitrineTexto({ urlVitrine, base, slug }), mono: true },
      ]),
      botao("Entrar no painel", urlPainel),
      aviso(
        `Guarde esta senha: ela é temporária e você pode trocá-la a qualquer momento dentro do painel.`,
      ),
      divisor(),
      paragrafo(`Por onde começar:`),
      itens([
        "Cadastre o primeiro imóvel com fotos, valor e endereço",
        "Abra a vitrine e veja como ele aparece para o cliente",
        "Arraste os blocos no editor para deixar a página com a sua cara",
      ]),
      botao("Ver minha vitrine", urlDaVitrine, { tom: "escuro" }),
      aviso(
        `O teste vale até <strong style="color:${COR.forte};">${esc(
          validade,
        )}</strong>. Se fechar plano antes disso, nada do que você montou se perde.`,
        COR.dourado,
      ),
    ].join(""),
    rodape: "Dúvida? É só responder este e-mail.",
  });

  return { subject, body, html };
}

// ─── 4. Aviso de novo teste (vai para o time) ────────────────────────────────

/* Rótulos legíveis para o que o formulário manda em código. Ficam aqui, e não
   no front, porque quem lê este e-mail é uma pessoa do time — "nao_sei" numa
   caixa de entrada obriga quem lê a decorar o enum. */
const ITEM_MIGRACAO = {
  imoveis: "imóveis e fotos",
  clientes: "clientes",
  leads: "leads",
  usuarios: "usuários e cargos",
};
const FORMATO_MIGRACAO = {
  planilha: "tem planilha/CSV",
  exportacao: "consegue exportar do sistema atual",
  api: "o sistema atual tem API",
  nao_sei: "não sabe como exportar — precisa de ajuda",
};

export function emailAvisoNovoTrial({
  imobiliaria, email, telefone, slug, validade, base, urlVitrine,
  perfil = "nova", planoDesejado, migracao,
}) {
  /* Duas conversas diferentes, e é o assunto do e-mail que precisa separá-las:
     quem já opera tem uma base para trazer e um fornecedor para deixar, e esse
     contato tem urgência e roteiro próprios. */
  const jaOpera = perfil === "existente";
  const subject = jaOpera
    ? `Omnimob · teste com MIGRAÇÃO — ${imobiliaria}`
    : `Omnimob · novo teste grátis — ${imobiliaria}`;

  // `itensTexto` e não `itens`: este módulo importa um helper `itens()` do
  // layout, e a variável local o esconderia dentro desta função.
  const itensTexto = (migracao?.itens || []).map((i) => ITEM_MIGRACAO[i] || i).join(", ");
  const linhasMigracao = migracao
    ? [
        { rotulo: "Sistema atual", valor: migracao.sistemaAtual || "não informou" },
        { rotulo: "Quer trazer", valor: itensTexto || "não marcou nada" },
        { rotulo: "Volume", valor: migracao.volume || "não informou" },
        { rotulo: "Exportação", valor: FORMATO_MIGRACAO[migracao.formato] || "não informou" },
        ...(migracao.observacao ? [{ rotulo: "Observação", valor: migracao.observacao }] : []),
      ]
    : [];

  const body = [
    jaOpera
      ? "Uma imobiliária JÁ EM OPERAÇÃO confirmou o e-mail e iniciou um teste."
      : "Alguém confirmou o e-mail e iniciou um teste grátis.",
    "",
    `Imobiliária: ${imobiliaria}`,
    `E-mail:      ${email}`,
    `Telefone:    ${telefone || "(não informou)"}`,
    `Slug:        ${slug}`,
    `Vence em:    ${validade}`,
    `Perfil:      ${jaOpera ? "já tem imobiliária (quer migrar)" : "está abrindo agora"}`,
    ...(planoDesejado ? [`Plano de interesse: ${planoDesejado}`] : []),
    ...(linhasMigracao.length
      ? ["", "— Migração —", ...linhasMigracao.map((l) => `${l.rotulo}: ${l.valor}`)]
      : jaOpera
        ? ["", "— Migração —", "Pulou o questionário. Vale perguntar no contato."]
        : []),
  ].join("\n");

  const html = layoutEmail({
    preheader: jaOpera
      ? `${imobiliaria} já opera e quer trazer a base. Vence em ${validade}.`
      : `${imobiliaria} está testando a plataforma. Vence em ${validade}.`,
    conteudo: [
      eyebrow(jaOpera ? "● TESTE COM MIGRAÇÃO" : "● NOVO TESTE GRÁTIS", jaOpera ? COR.dourado : COR.menta),
      titulo(jaOpera ? "Imobiliária em operação quer migrar" : "Lead quente: alguém entrou na plataforma"),
      paragrafo(
        jaOpera
          ? "Confirmou o e-mail, o ambiente está rodando e ela tem uma base em outro sistema. "
            + "<strong>A promessa feita na landing foi que um especialista responde para combinar a importação</strong> — "
            + "esse retorno precisa sair antes do teste vencer."
          : "Confirmou o e-mail e já está com o ambiente rodando. Vale um contato antes do teste vencer.",
      ),
      dados([
        { rotulo: "Imobiliária", valor: imobiliaria },
        { rotulo: "E-mail", valor: email, mono: true },
        { rotulo: "Telefone", valor: telefone || "não informou", mono: true },
        { rotulo: "Slug", valor: slug, mono: true },
        { rotulo: "Vence em", valor: validade },
        ...(planoDesejado ? [{ rotulo: "Interesse", valor: planoDesejado }] : []),
      ]),
      ...(linhasMigracao.length
        ? [divisor(), eyebrow("● O QUE ELA TEM HOJE", COR.dourado), dados(linhasMigracao)]
        : jaOpera
          ? [divisor(), paragrafo(
              `<span style="color:${COR.apagado};font-size:13px;">Pulou o questionário de migração — `
              + "levante isso no primeiro contato.</span>",
            )]
          : []),
      botao("Ver a vitrine dele", vitrineUrl({ urlVitrine, base, slug })),
      divisor(),
      paragrafo(
        `<span style="color:${COR.apagado};font-size:13px;">Responder este e-mail cai direto no interessado.</span>`,
      ),
    ].join(""),
    rodape: "Aviso interno da plataforma Omnimob.",
  });

  return { subject, body, html };
}

// ─── 5. Assinatura confirmada (vai para o cliente) ───────────────────────────

export function emailAssinaturaConfirmada({
  imobiliaria, plano, valorRotulo, proximaCobranca, inventario = {}, recursos = [], base, slug, urlVitrine,
}) {
  const subject = `Assinatura confirmada — bem-vindo à Omnimob, ${imobiliaria}`;

  const mantidos = [
    inventario.imoveis ? `${inventario.imoveis} imóveis` : null,
    inventario.fotos ? `${inventario.fotos} fotos` : null,
    inventario.clientes ? `${inventario.clientes} clientes` : null,
    inventario.leads ? `${inventario.leads} leads` : null,
    inventario.usuarios ? `${inventario.usuarios} usuários` : null,
  ].filter(Boolean);

  const body = [
    `Obrigado! A assinatura da ${imobiliaria} está ativa.`,
    "",
    `Plano:            ${plano}`,
    `Valor:            ${valorRotulo}`,
    proximaCobranca ? `Próxima cobrança: ${proximaCobranca}` : "",
    "",
    mantidos.length
      ? `Tudo que você montou no teste continua no lugar: ${mantidos.join(", ")}.`
      : "Seu ambiente segue exatamente como estava.",
    "",
    recursos.length ? `O plano libera:\n- ${recursos.join("\n- ")}` : "",
    "",
    `Painel:  ${base}/login`,
    `Vitrine: ${vitrineUrl({ urlVitrine, base, slug })}`,
    "",
    "A cobrança é mensal e automática. Para cancelar ou trocar o cartão, é só responder este e-mail.",
  ]
    .filter((l) => l !== "")
    .join("\n");

  const html = layoutEmail({
    preheader: `Plano ${plano} ativo. Nada do que você montou se perdeu.`,
    conteudo: [
      eyebrow("● ASSINATURA CONFIRMADA", COR.menta),
      titulo("Bem-vindo à Omnimob de verdade"),
      paragrafo(
        `A ${forte(imobiliaria)} deixou de ser um teste. Tudo que você montou continua exatamente onde estava.`,
      ),
      dados(
        [
          { rotulo: "Plano", valor: plano },
          { rotulo: "Valor", valor: valorRotulo },
          proximaCobranca ? { rotulo: "Próxima cobrança", valor: proximaCobranca } : null,
        ].filter(Boolean),
      ),
      mantidos.length
        ? paragrafo(`Seguem com você: ${forte(mantidos.join(", "))}.`)
        : "",
      recursos.length ? paragrafo("O que este plano libera:") + itens(recursos) : "",
      botao("Ir para o painel", `${base}/login`),
      aviso(
        "A cobrança é mensal e automática. Para cancelar ou trocar o cartão, é só responder este e-mail.",
        COR.menta,
      ),
    ].join(""),
    rodape: "Obrigado por confiar na Omnimob.",
  });

  return { subject, body, html };
}

// ─── 6. Teste vencido (vai para o cliente) ───────────────────────────────────

export function emailTrialExpirado({ imobiliaria, slug, diasAteRemover, base, urlVitrine, eraTeste = true }) {
  /* O mesmo e-mail serve aos dois desfechos — teste que acabou e plano que
     venceu —, mudando só o nome do que acabou. São a mesma mensagem para quem
     lê: "você perdeu o acesso, nada foi apagado, tem 30 dias".

     O que NÃO pode acontecer é falar de "período de teste" para quem estava
     pagando: a frase é falsa, e uma mensagem que erra o fato básico perde a
     credibilidade justo quando precisa dela para trazer o cliente de volta. */
  const oQueAcabou = eraTeste ? "O período de teste" : "A assinatura";
  const subject = eraTeste
    ? `O teste da ${imobiliaria} venceu — ainda dá para recuperar`
    : `A assinatura da ${imobiliaria} venceu — ainda dá para recuperar`;

  const body = [
    `${oQueAcabou} da ${imobiliaria} chegou ao fim e o ambiente foi desativado.`,
    "",
    "Enquanto isso, ninguém da sua equipe consegue entrar no painel.",
    "",
    `Nada foi apagado ainda: imóveis, fotos, leads e a vitrine continuam guardados por mais ${diasAteRemover} dias.`,
    "Se você assinar um plano dentro desse prazo, tudo volta exatamente como estava.",
    "",
    `Para reativar, entre com seu login de sempre: ${base}/login`,
    "Quem responde pela conta cai direto na tela de assinatura — o painel continua fechado até o pagamento passar.",
    "",
    "Depois desse prazo o ambiente é removido e não há como recuperar.",
    "Se precisar de mais tempo ou quiser conversar sobre o plano, é só responder este e-mail.",
  ].join("\n");

  const html = layoutEmail({
    preheader: `Seus dados ficam guardados por ${diasAteRemover} dias. Dá para recuperar.`,
    conteudo: [
      eyebrow(eraTeste ? "● TESTE ENCERRADO" : "● ACESSO SUSPENSO", "#f59e0b"),
      titulo(eraTeste ? "Seu teste venceu — mas nada foi apagado" : "Sua assinatura venceu — mas nada foi apagado"),
      paragrafo(
        `${oQueAcabou} da ${forte(imobiliaria)} chegou ao fim e o ambiente foi desativado. ` +
          "Ninguém da sua equipe consegue entrar no painel enquanto isso.",
      ),
      aviso(
        `Imóveis, fotos, leads e a vitrine continuam guardados por mais <strong style="color:${COR.forte};">${diasAteRemover} dias</strong>. Assinando dentro desse prazo, tudo volta exatamente como estava.`,
        "#f59e0b",
      ),
      /* O botão manda para o LOGIN, e isso já foi um beco sem saída: a conta
         vencida perdia o painel, o pagamento morava no painel, e o login
         recusava. Hoje quem responde pela conta entra numa sessão de escopo
         reduzido e cai direto na tela de assinatura — ver `ContaSuspensaPage`
         e `authMiddleware`. Sem isso este botão levaria a pessoa a uma porta
         trancada, que é o pior lugar para terminar um e-mail de recuperação. */
      botao("Assinar e recuperar meu ambiente", `${base}/login`),
      paragrafo(
        `<span style="color:${COR.apagado};font-size:13px;">Use seu login de sempre. Quem responde pela conta cai direto na tela de assinatura; o resto do painel continua fechado até o pagamento passar.</span>`,
      ),
      divisor(),
      paragrafo(
        `<span style="color:${COR.apagado};font-size:13px;">Passado esse prazo o ambiente é removido, e aí não há como recuperar. Precisa de mais tempo? Responda este e-mail que a gente resolve.</span>`,
      ),
    ].join(""),
    rodape: `Vitrine: ${esc(vitrineUrl({ urlVitrine, base, slug }))}`,
  });

  return { subject, body, html };
}

// ─── 7. Pesquisa do teste (vai para o time) ──────────────────────────────────

/* A pessoa disse, dentro do painel e durante o teste, o que está achando.

   O aviso NÃO sai a cada resposta: quem clicou "estou amando" e seguiu
   trabalhando não é assunto para ninguém às 3 da tarde. A rota só chama isto
   quando há o que fazer — dificuldade relatada, comentário escrito, ou o
   pedido de mais prazo, que é uma objeção de compra em forma de botão. */
export function emailPesquisaTrial({
  imobiliaria, slug, autor, sentimento, escolha, comentario, diasRestantes, base, emailContato,
}) {
  const ROTULO_SENTIMENTO = {
    AMANDO: "Está amando",
    NEUTRO: "Vai indo",
    DIFICIL: "Está com dificuldade",
  };
  const ROTULO_ESCOLHA = {
    ASSINAR: "Foi para a tela de assinatura",
    ESTENDER: "Pediu mais prazo de teste",
    DEPOIS: "Deixou para depois",
    FECHOU: "Fechou sem responder",
  };

  const dificuldade = sentimento === "DIFICIL";
  const subject = dificuldade
    ? `Omnimob · ${imobiliaria} está com dificuldade no teste`
    : escolha === "ESTENDER"
      ? `Omnimob · ${imobiliaria} pediu mais prazo de teste`
      : `Omnimob · resposta da pesquisa — ${imobiliaria}`;

  const linhas = [
    { rotulo: "Imobiliária", valor: imobiliaria },
    { rotulo: "Slug", valor: slug, mono: true },
    { rotulo: "Respondeu", valor: autor || "não identificado" },
    { rotulo: "Como está sendo", valor: ROTULO_SENTIMENTO[sentimento] || "não disse" },
    { rotulo: "O que escolheu", valor: ROTULO_ESCOLHA[escolha] || escolha },
    ...(diasRestantes != null ? [{ rotulo: "Dias de teste", valor: String(diasRestantes) }] : []),
    ...(emailContato ? [{ rotulo: "E-mail", valor: emailContato, mono: true }] : []),
  ];

  const body = [
    dificuldade
      ? "Uma imobiliária em teste relatou dificuldade no painel."
      : "Resposta da pesquisa que aparece durante o teste.",
    "",
    ...linhas.map((l) => `${l.rotulo}: ${l.valor}`),
    ...(comentario ? ["", "— O que ela escreveu —", comentario] : []),
    "",
    dificuldade
      ? "Vale um contato hoje: dificuldade não relatada vira teste que vence em silêncio."
      : "",
  ].join("\n");

  const html = layoutEmail({
    preheader: dificuldade
      ? `${imobiliaria} travou em alguma parte do teste.`
      : `${imobiliaria} respondeu a pesquisa do teste.`,
    conteudo: [
      eyebrow(dificuldade ? "● DIFICULDADE NO TESTE" : "● PESQUISA DO TESTE", dificuldade ? "#f59e0b" : COR.menta),
      titulo(
        dificuldade
          ? "Alguém está travando durante o teste"
          : escolha === "ESTENDER"
            ? "Pediu mais tempo antes de decidir"
            : "Resposta da pesquisa do painel",
      ),
      paragrafo(
        dificuldade
          ? `A ${forte(imobiliaria)} disse, dentro do painel, que está com dificuldade. `
            + "O teste continua correndo — o contato precisa sair antes do vencimento."
          : `A ${forte(imobiliaria)} respondeu a pesquisa que aparece durante o teste.`,
      ),
      dados(linhas),
      ...(comentario
        ? [divisor(), eyebrow("● O QUE ELA ESCREVEU", COR.dourado), aviso(esc(comentario), dificuldade ? "#f59e0b" : COR.dourado)]
        : []),
      ...(base ? [botao("Abrir o painel super-admin", `${String(base).replace(/\/+$/, "")}/admin`)] : []),
      divisor(),
      paragrafo(
        `<span style="color:${COR.apagado};font-size:13px;">Aviso automático — sai só quando há dificuldade, comentário escrito ou pedido de mais prazo.</span>`,
      ),
    ].join(""),
    rodape: "Aviso interno da plataforma Omnimob.",
  });

  return { subject, body, html };
}

/* Recuperação de senha.

   O texto evita prometer que a conta existe: quem pede a recuperação vê sempre
   a mesma resposta na tela, e o e-mail só chega para quem tem cadastro. Dizer
   aqui "sua conta está ativa" transformaria o e-mail no confirmador que a tela
   se recusou a ser. */
export function emailRecuperarSenha({ nome, link, imobiliaria }) {
  const subject = "Redefinir sua senha da Omnimob";

  const body = [
    `Olá, ${nome}.`,
    "",
    `Recebemos um pedido para redefinir a senha do seu acesso${imobiliaria ? ` na ${imobiliaria}` : ""}.`,
    "",
    "Abra o link abaixo para escolher uma nova senha:",
    link,
    "",
    "O link vale por 1 hora e só pode ser usado uma vez.",
    "Se não foi você quem pediu, ignore esta mensagem — sua senha continua a mesma.",
  ].join("\n");

  const html = layoutEmail({
    preheader: "Escolha uma nova senha para o seu acesso.",
    conteudo: [
      eyebrow("● REDEFINIR SENHA"),
      titulo("Escolha uma nova senha"),
      paragrafo(
        `Olá, ${forte(nome)}. Recebemos um pedido para redefinir a senha do seu acesso${
          imobiliaria ? ` na ${forte(imobiliaria)}` : ""
        }.`,
      ),
      botao("Criar nova senha", link),
      linkDeReserva(link),
      aviso(
        `Este link vale por <strong style="color:${COR.forte};">1 hora</strong> e só funciona uma vez. ` +
          "Se não foi você quem pediu, é só ignorar — sua senha continua a mesma.",
      ),
    ].join(""),
  });

  return { subject, body, html };
}

// ─── 8. Relatório mensal da imobiliária ──────────────────────────────────────

/* Vai para quem assina Profissional ou Premium, no começo de cada mês, com o
   fechamento do mês anterior.

   Não é só informação: é o e-mail que faz o plano LEMBRAR de si. Uma assinatura
   que nunca escreve some da cabeça de quem paga, e some primeiro na hora de
   cortar custo. Por isso ele fecha com o caminho para o painel — a mensagem
   quer terminar dentro do produto, não nela mesma. */
export function emailRelatorioMensal({ imobiliaria, relatorio, base }) {
  const r = relatorio;
  const painel = `${String(base || "").replace(/\/+$/, "")}/`;
  const subject = `Omnimob · ${imobiliaria}: seu ${r.periodo.rotulo} em números`;

  const sinal = (v) => (v > 0 ? `+${v}` : String(v));
  const compara =
    r.variacaoVisitas === null
      ? "Primeiro mês com movimento registrado."
      : `${sinal(r.variacaoVisitas)}% de visitas em relação ao mês anterior.`;

  const body = [
    `${imobiliaria} — ${r.periodo.rotulo}`,
    "",
    `Visitas à vitrine: ${r.visitas}`,
    `Leads recebidos:   ${r.leads}`,
    `Vendas no mês:     ${r.vendas}`,
    `Imóveis ativos:    ${r.imoveisAtivos}`,
    r.conversao !== null ? `Conversão:         ${r.conversao}% das visitas viraram lead` : "",
    "",
    compara,
    "",
    r.destaques.length ? "Imóveis mais vistos:" : "",
    ...r.destaques.map((d, i) => `  ${i + 1}. ${d.title}${d.local ? ` (${d.local})` : ""} — ${d.visitas} visitas`),
    "",
    `Painel: ${painel}`,
  ]
    .filter((l) => l !== "")
    .join("\n");

  const html = layoutEmail({
    preheader: `${r.visitas} visitas e ${r.leads} leads em ${r.periodo.rotulo}.`,
    conteudo: [
      eyebrow("● RELATÓRIO MENSAL"),
      titulo(`${esc(imobiliaria)} em ${esc(r.periodo.rotulo)}`),
      paragrafo(compara),
      dados(
        [
          { rotulo: "Visitas à vitrine", valor: String(r.visitas) },
          { rotulo: "Leads recebidos", valor: String(r.leads) },
          { rotulo: "Vendas no mês", valor: String(r.vendas) },
          { rotulo: "Imóveis ativos", valor: String(r.imoveisAtivos) },
          r.conversao !== null
            ? { rotulo: "Visitas que viraram lead", valor: `${r.conversao}%` }
            : null,
        ].filter(Boolean),
      ),
      r.destaques.length
        ? divisor() +
          paragrafo(forte("Imóveis mais vistos no mês")) +
          itens(
            r.destaques.map(
              (d) => `${esc(d.title)}${d.local ? ` — ${esc(d.local)}` : ""}  ·  ${d.visitas} visitas`,
            ),
          )
        : "",
      botao("Abrir o painel", painel),
    ].join(""),
    rodape: "Você recebe este resumo porque sua assinatura inclui relatório mensal.",
  });

  return { subject, body, html };
}
