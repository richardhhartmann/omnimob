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
export function emailTrialNoAr({ imobiliaria, login, senha, slug, validade, base }) {
  const urlPainel = `${base}/login`;
  const urlVitrine = `${base}/vitrine/${slug}`;
  const subject = "Seu teste da Omnimob está no ar";

  const body = [
    `O ambiente da ${imobiliaria} já está funcionando.`,
    "",
    `Acesse:  ${urlPainel}`,
    `Usuário: ${login}`,
    `Senha:   ${senha}`,
    "",
    `Sua vitrine pública: ${urlVitrine}`,
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
        { rotulo: "Vitrine", valor: `/vitrine/${slug}`, mono: true },
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
      botao("Ver minha vitrine", urlVitrine, { tom: "escuro" }),
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
  imobiliaria, email, telefone, slug, validade, base,
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
      botao("Ver a vitrine dele", `${base}/vitrine/${slug}`),
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
  imobiliaria, plano, valorRotulo, proximaCobranca, inventario = {}, recursos = [], base, slug,
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
    `Vitrine: ${base}/vitrine/${slug}`,
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

export function emailTrialExpirado({ imobiliaria, slug, diasAteRemover, base }) {
  const subject = `O teste da ${imobiliaria} venceu — ainda dá para recuperar`;

  const body = [
    `O período de teste da ${imobiliaria} chegou ao fim e o ambiente foi desativado.`,
    "",
    `Nada foi apagado ainda: seus imóveis, fotos, leads e a vitrine continuam guardados por mais ${diasAteRemover} dias.`,
    "Se você assinar dentro desse prazo, tudo volta exatamente como estava.",
    "",
    `Painel: ${base}/login`,
    "",
    "Depois desse prazo o ambiente é removido e não há como recuperar.",
    "Se precisar de mais tempo ou quiser conversar sobre o plano, é só responder este e-mail.",
  ].join("\n");

  const html = layoutEmail({
    preheader: `Seus dados ficam guardados por ${diasAteRemover} dias. Dá para recuperar.`,
    conteudo: [
      eyebrow("● TESTE ENCERRADO", "#f59e0b"),
      titulo("Seu teste venceu — mas nada foi apagado"),
      paragrafo(
        `O período de teste da ${forte(imobiliaria)} chegou ao fim e o ambiente foi desativado.`,
      ),
      aviso(
        `Seus imóveis, fotos, leads e a vitrine continuam guardados por mais <strong style="color:${COR.forte};">${diasAteRemover} dias</strong>. Assinando dentro desse prazo, tudo volta exatamente como estava.`,
        "#f59e0b",
      ),
      botao("Assinar e recuperar meu ambiente", `${base}/login`),
      divisor(),
      paragrafo(
        `<span style="color:${COR.apagado};font-size:13px;">Passado esse prazo o ambiente é removido, e aí não há como recuperar. Precisa de mais tempo? Responda este e-mail que a gente resolve.</span>`,
      ),
    ].join(""),
    rodape: `Vitrine: ${esc(base)}/vitrine/${esc(slug)}`,
  });

  return { subject, body, html };
}
