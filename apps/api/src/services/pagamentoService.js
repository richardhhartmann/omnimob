/**
 * ─── Payment Service (Stripe Billing) ────────────────────────────────────────
 * Seam da cobrança recorrente, no mesmo espírito do tenantRegistry: quem chama
 * não sabe qual provedor está atrás. Trocar de provedor deve ser mexer só aqui.
 *
 * Usa a REST API do Stripe via `fetch`, sem SDK — mesmo padrão do aiService
 * (Gemini) e do notificationService (Resend).
 *
 * ─── O NÚMERO DO CARTÃO NÃO PASSA POR AQUI ────────────────────────────────────
 * Este serviço recebe um PaymentMethod (`pm_...`) já criado pelo Stripe Elements
 * dentro do navegador, num iframe do próprio Stripe. Se o número do cartão
 * passasse por este servidor, a Omnimob entraria no escopo mais pesado do PCI-DSS
 * (SAQ D): auditoria anual, varredura trimestral, segregação de rede. Inviável
 * para uma operação pequena — e, num vazamento, a responsabilidade é de quem
 * armazenou.
 *
 * ─── POR QUE NÃO GUARDAMOS IDS DO STRIPE NO TENANT ────────────────────────────
 * O vínculo vai em `metadata` (tenantId e slug) no cliente e na assinatura do
 * Stripe. O webhook lê de lá para saber de quem é o pagamento. Assim não é
 * preciso criar colunas novas — nem migração — só para casar os dois lados.
 */

const SECRET = process.env.STRIPE_SECRET_KEY || "";
const API = "https://api.stripe.com/v1";

/* Preços recorrentes criados no painel do Stripe (um por plano).
   Aceita duas grafias por variável — a longa, que espelha a chave do plano, e a
   abreviada em inglês. É fácil digitar uma pela outra, e um preço não lido faz
   o plano simplesmente sumir da tela, sem erro nenhum: melhor tolerar. */
const env = (...nomes) => nomes.map((n) => process.env[n]).find(Boolean) || "";

/* Dois preços por plano: a cobrança mensal e a anual.

   O preço ANUAL é outro objeto no Stripe (`recurring.interval = year`), não um
   desconto aplicado sobre o mensal — quem decide o valor é o painel do Stripe,
   e o código só lê. É o que mantém a página e a fatura contando a mesma
   história: se alguém mexer no preço lá, a landing acompanha sem deploy.

   As variáveis do anual são NOVAS e precisam ser criadas no ambiente (dev e
   Render). Enquanto elas não existirem, o plano simplesmente não oferece a
   opção anual — a mensal continua funcionando como sempre. Nada quebra por
   falta delas, o botão de "anual" é que não aparece.

     STRIPE_PRICE_BASICO_ANUAL        (ou STRIPE_PRICE_BASIC_ANNUAL)
     STRIPE_PRICE_PROFISSIONAL_ANUAL  (ou STRIPE_PRICE_PRO_ANNUAL)
     STRIPE_PRICE_PREMIUM_ANUAL       (ou STRIPE_PRICE_PREMIUM_ANNUAL) */
const PRECOS = {
  BASICO: {
    mensal: env("STRIPE_PRICE_BASICO", "STRIPE_PRICE_BASIC"),
    anual: env("STRIPE_PRICE_BASICO_ANUAL", "STRIPE_PRICE_BASIC_ANNUAL"),
  },
  PROFISSIONAL: {
    mensal: env("STRIPE_PRICE_PROFISSIONAL", "STRIPE_PRICE_PRO"),
    anual: env("STRIPE_PRICE_PROFISSIONAL_ANUAL", "STRIPE_PRICE_PRO_ANNUAL"),
  },
  PREMIUM: {
    mensal: env("STRIPE_PRICE_PREMIUM"),
    anual: env("STRIPE_PRICE_PREMIUM_ANUAL", "STRIPE_PRICE_PREMIUM_ANNUAL"),
  },
};

/** Períodos aceitos. Qualquer outra coisa vinda do cliente vira "mensal". */
export const PERIODOS = ["mensal", "anual"];
export function normalizarPeriodo(valor) {
  return PERIODOS.includes(String(valor)) ? String(valor) : "mensal";
}

/** O id de preço do Stripe para um plano num período. */
function idDoPreco(plano, periodo) {
  return PRECOS[plano]?.[normalizarPeriodo(periodo)] || "";
}

export function pagamentoConfigurado() {
  return Boolean(SECRET);
}

/* O Stripe embute um fragmento da CONTA nos identificadores: a chave
   `sk_live_51AbcDefGhi...` e o preço `price_1XyzAbcDefGhi...` compartilham o
   mesmo pedaço quando pertencem à mesma conta.

   Isso permite detectar, sem chamar a API, o erro mais comum de configuração —
   preço criado numa conta (ou num modo) e chave de outra. O sintoma é
   `No such price`, que sugere "o preço não existe" quando na verdade ele
   existe, só que em outro lugar. */
function fragmentoDeConta(id) {
  const m = String(id || "").match(/^(?:sk|pk)_(?:test|live)_51(.{10})/) ||
            String(id || "").match(/^price_1.{6}(.{10})/);
  return m ? m[1] : null;
}

/**
 * Conferência da configuração de cobrança, para rodar no ambiente de verdade.
 *
 * Diz o modo da chave, se cada preço configurado realmente existe na conta
 * dela, e — quando não existe — se o motivo é o preço pertencer a outra conta.
 * Nunca devolve a chave nem qualquer segredo.
 */
export async function diagnosticarPagamento() {
  if (!SECRET) return { configurado: false, detalhe: "STRIPE_SECRET_KEY ausente." };

  const modo = SECRET.startsWith("sk_live_") ? "live" : SECRET.startsWith("sk_test_") ? "test" : "desconhecido";
  const contaDaChave = fragmentoDeConta(SECRET);

  /* A conta REAL da chave, perguntada ao Stripe. O fragmento embutido no ID
     serve para explicar o erro, mas quem decide é isto: comparar este `id` com
     o que aparece no painel onde os preços foram criados encerra a dúvida.

     Vale lembrar que "modo de teste" e "sandbox" não são a mesma coisa no
     Stripe: cada sandbox é uma conta própria, com `acct_` diferente do da conta
     ativada. Trocar de sandbox para produção troca de conta sem que ninguém
     tenha escolhido trocar de conta — e é o caminho mais comum para os preços
     e a chave acabarem em lugares diferentes. */
  let conta = null;
  try {
    const a = await stripe("/account", { method: "GET" });
    conta = {
      id: a.id,
      nome: a.settings?.dashboard?.display_name || null,
      pais: a.country || null,
      cobrancasAtivas: Boolean(a.charges_enabled),
    };
  } catch (erro) {
    conta = { erro: erro.message };
  }

  /* Uma linha por plano E período — `PREMIUM/anual` é um preço diferente de
     `PREMIUM/mensal` e falha por conta própria. Chave achatada porque o valor
     desta função é ser lida por gente. */
  const planos = {};
  for (const [plano, porPeriodo] of Object.entries(PRECOS)) {
    for (const periodo of PERIODOS) {
      const rotulo = `${plano}/${periodo}`;
      const precoId = porPeriodo[periodo];
      if (!precoId) {
        planos[rotulo] = {
          ok: false,
          opcional: periodo === "anual",
          detalhe:
            periodo === "anual"
              ? `Nenhum ID configurado (STRIPE_PRICE_${plano}_ANUAL). O plano segue só no mensal.`
              : "Nenhum ID de preço configurado.",
        };
        continue;
      }

      const contaDoPreco = fragmentoDeConta(precoId);
      const mesmaConta = contaDaChave && contaDoPreco ? contaDoPreco.startsWith(contaDaChave.slice(0, 8)) : null;

      try {
        const preco = await stripe(`/prices/${encodeURIComponent(precoId)}`, { method: "GET" });
        const esperado = periodo === "anual" ? "year" : "month";
        planos[rotulo] = {
          ok: true,
          precoId,
          ativo: preco.active,
          valor: preco.unit_amount != null ? preco.unit_amount / 100 : null,
          moeda: preco.currency,
          recorrencia: preco.recurring?.interval || null,
          modoDoPreco: preco.livemode ? "live" : "test",
          /* Preço anual apontando para um `interval: month` cobraria doze vezes
             o valor do ano. Não dá erro em lugar nenhum — só na fatura. */
          alerta:
            preco.recurring?.interval && preco.recurring.interval !== esperado
              ? `Este preço é ${preco.recurring.interval}ly, mas está configurado como ${periodo}. A cobrança sairia no ciclo errado.`
              : undefined,
        };
      } catch (erro) {
        planos[rotulo] = {
          ok: false,
          precoId,
          detalhe: erro.message,
          mesmaConta,
          diagnostico:
            mesmaConta === false
              ? "Este preço pertence a OUTRA conta Stripe (fragmento diferente do da chave). Use a chave da conta onde ele foi criado."
              : "Preço não encontrado nesta conta/modo. Confira se foi criado no mesmo modo da chave.",
        };
      }
    }
  }

  const algumForaDaConta = Object.values(planos).some((p) => p.mesmaConta === false);
  /* Anual ainda não cadastrado não é falha de configuração — é uma opção que
     não está à venda. Sem esta ressalva o diagnóstico gritaria enquanto as
     variáveis novas não existissem. */
  const pendentes = Object.values(planos).filter((p) => !p.ok && !p.opcional);
  const cicloErrado = Object.entries(planos).filter(([, p]) => p.alerta);

  return {
    configurado: true,
    modo,
    conta,
    contaDaChave,
    planos,
    leitura: algumForaDaConta
      ? "Há preço criado em outra conta Stripe. Compare o `conta.id` acima com a conta aberta no painel onde os preços aparecem — sandbox e conta ativada são contas distintas."
      : cicloErrado.length
        ? `Preço com recorrência trocada: ${cicloErrado.map(([r]) => r).join(", ")}. Confira o intervalo no painel do Stripe.`
        : pendentes.length === 0
          ? `Chave e preços na mesma conta (${conta?.id || "?"}), modo ${modo}.`
          : "Preço não encontrado, mas o fragmento da conta bate: confira se ele foi arquivado ou criado no outro modo desta mesma conta.",
  };
}

export function planoTemPreco(plano, periodo) {
  return periodo ? Boolean(idDoPreco(plano, periodo)) : Boolean(idDoPreco(plano, "mensal"));
}

/** Períodos que um plano realmente pode cobrar hoje (o anual só quando existe). */
export function periodosDoPlano(plano) {
  return PERIODOS.filter((periodo) => Boolean(idDoPreco(plano, periodo)));
}

/* A API do Stripe é form-urlencoded e aceita aninhamento por colchetes
   (`metadata[tenantId]`, `items[0][price]`). Este encoder achata o objeto
   nesse formato. */
function paraForm(objeto, prefixo = "", saida = new URLSearchParams()) {
  Object.entries(objeto).forEach(([chave, valor]) => {
    if (valor === undefined || valor === null) return;
    const nome = prefixo ? `${prefixo}[${chave}]` : chave;
    if (Array.isArray(valor)) {
      valor.forEach((item, i) => {
        if (item && typeof item === "object") paraForm(item, `${nome}[${i}]`, saida);
        else saida.append(`${nome}[${i}]`, String(item));
      });
    } else if (valor && typeof valor === "object") {
      paraForm(valor, nome, saida);
    } else {
      saida.append(nome, String(valor));
    }
  });
  return saida;
}

async function stripe(caminho, { method = "POST", dados, idempotencia } = {}) {
  const headers = {
    Authorization: `Bearer ${SECRET}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  // Chave de idempotência: a rede cai, o cliente clica de novo, e sem isso
  // sairiam duas assinaturas para o mesmo tenant.
  if (idempotencia) headers["Idempotency-Key"] = idempotencia;

  const resposta = await fetch(`${API}${caminho}`, {
    method,
    headers,
    body: dados ? paraForm(dados).toString() : undefined,
  });

  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    const err = new Error(corpo?.error?.message || `Stripe respondeu ${resposta.status}.`);
    // card_error = cartão recusado, e a mensagem do Stripe já vem em bom
    // português para o portador; o resto é problema nosso.
    err.code = corpo?.error?.type === "card_error" ? "RECUSADO" : "PROVEDOR_FALHOU";
    err.stripe = corpo?.error;
    throw err;
  }
  return corpo;
}

/**
 * Cria a assinatura recorrente do tenant.
 *
 * @param {object} args
 * @param {object} args.tenant           tenant que está assinando
 * @param {string} args.plano            BASICO | PROFISSIONAL | PREMIUM
 * @param {string} args.periodo          mensal | anual (padrão mensal)
 * @param {string} args.tokenPagamento   PaymentMethod (`pm_...`) vindo do Elements
 * @returns {Promise<{ assinaturaId, clienteId, proximoVencimento, valorMensal, valorCobrado, periodo, statusStripe }>}
 * @throws  {Error} `.code`: PROVEDOR_NAO_CONFIGURADO | TOKEN_AUSENTE |
 *                  PLANO_SOB_CONSULTA | PERIODO_INDISPONIVEL | RECUSADO |
 *                  PENDENTE | PROVEDOR_FALHOU
 */
export async function criarAssinatura({ tenant, plano, periodo, tokenPagamento }) {
  if (!pagamentoConfigurado()) {
    const err = new Error(
      "Cobrança automática ainda não está conectada. Fale com o time para fechar o plano.",
    );
    err.code = "PROVEDOR_NAO_CONFIGURADO";
    throw err;
  }
  if (!tokenPagamento) {
    const err = new Error("Dados de pagamento não recebidos.");
    err.code = "TOKEN_AUSENTE";
    throw err;
  }
  const periodoEscolhido = normalizarPeriodo(periodo);
  const preco = idDoPreco(plano, periodoEscolhido);
  if (!preco) {
    /* Sem preço para ESTE período. Duas causas, e a mensagem distingue: o plano
       nunca teve cobrança automática (sob consulta), ou o anual ainda não foi
       cadastrado no ambiente — que é erro de configuração nosso, não decisão
       comercial, e o cliente não deve ler "fale com o time" por isso. */
    const temMensal = Boolean(idDoPreco(plano, "mensal"));
    const err = new Error(
      temMensal && periodoEscolhido === "anual"
        ? "A cobrança anual deste plano ainda não está disponível. Escolha mensal ou fale com o time."
        : "Este plano é fechado sob consulta. Fale com o time.",
    );
    err.code = temMensal && periodoEscolhido === "anual" ? "PERIODO_INDISPONIVEL" : "PLANO_SOB_CONSULTA";
    throw err;
  }

  // 1. Cliente no Stripe, já com o método de pagamento como padrão das faturas.
  const cliente = await stripe("/customers", {
    dados: {
      name: tenant.name,
      email: tenant.email || undefined,
      payment_method: tokenPagamento,
      invoice_settings: { default_payment_method: tokenPagamento },
      metadata: { tenantId: tenant.id, slug: tenant.slug },
    },
    idempotencia: `cliente-${tenant.id}`,
  });

  // 2. Assinatura. `expand` traz o PaymentIntent da primeira fatura, que é onde
  //    se vê se o cartão passou ou se caiu em autenticação (3-D Secure).
  const assinatura = await stripe("/subscriptions", {
    dados: {
      customer: cliente.id,
      items: [{ price: preco }],
      default_payment_method: tokenPagamento,
      payment_behavior: "error_if_incomplete", // falha na hora em vez de nascer pendente
      expand: ["latest_invoice.payment_intent"],
      metadata: { tenantId: tenant.id, slug: tenant.slug, plano, periodo: periodoEscolhido },
    },
    /* O período entra na chave de idempotência: sem ele, quem assinasse o
       mensal e trocasse para o anual no mesmo tenant receberia de volta a
       assinatura ANTERIOR, silenciosamente, em vez de uma nova. */
    idempotencia: `assinatura-${tenant.id}-${plano}-${periodoEscolhido}`,
  });

  const intent = assinatura?.latest_invoice?.payment_intent;
  if (intent && intent.status !== "succeeded") {
    // Cartão que exige 3-D Secure cai aqui. Tratar exige devolver o
    // client_secret e concluir no navegador — ver a ressalva no README.
    const err = new Error(
      "O banco pediu confirmação extra para este cartão. Tente outro cartão ou fale com o time.",
    );
    err.code = "PENDENTE";
    err.clientSecret = intent.client_secret;
    throw err;
  }

  /* O valor cobrado é o do preço contratado — no anual, o ano inteiro de uma
     vez. `tenant.valorMensal` é uma coluna com "mensal" no nome e é lida como
     tal na tela e no e-mail, então o anual é dividido por 12 antes de ir para
     lá. `valorCobrado` guarda o número que realmente sai no cartão, para quem
     precisar dele. */
  const valorCobrado = (assinatura.items?.data?.[0]?.price?.unit_amount ?? 0) / 100;

  return {
    assinaturaId: assinatura.id,
    clienteId: cliente.id,
    statusStripe: assinatura.status,
    periodo: periodoEscolhido,
    valorCobrado,
    valorMensal:
      periodoEscolhido === "anual"
        ? Math.round((valorCobrado / 12) * 100) / 100
        : valorCobrado,
    /* Nas versões recentes da API o `current_period_end` saiu da assinatura e
       passou para o item — a chave antiga volta undefined e a data da próxima
       cobrança sumia da tela e do e-mail. Lemos as duas, na ordem nova. */
    proximoVencimento: (() => {
      const fim =
        assinatura.items?.data?.[0]?.current_period_end ?? assinatura.current_period_end;
      return fim ? new Date(fim * 1000) : null;
    })(),
  };
}

/** Cancela a assinatura no fim do período já pago. */
export async function cancelarAssinatura(assinaturaId) {
  if (!pagamentoConfigurado()) return null;
  return stripe(`/subscriptions/${assinaturaId}`, {
    dados: { cancel_at_period_end: true },
  });
}

/* ─── Cancelamento pedido pelo próprio cliente ───────────────────────────────
 * Agenda o fim da assinatura para o TÉRMINO DO PERÍODO JÁ PAGO — não corta na
 * hora. Quem pagou o mês tem direito ao mês; cancelar imediatamente seria
 * cobrar por um serviço e retirá-lo no mesmo gesto.
 *
 * Distingue-se de `cancelarAssinaturasDoSlug`, que faz DELETE e mata na hora:
 * aquela serve à exclusão do tenant pelo super-admin, onde não sobra nada para
 * usar mesmo. Esta é o botão do cliente.
 *
 * A busca é por `metadata.slug`, como lá — o id da assinatura não é guardado em
 * coluna nenhuma (ver o cabeçalho deste arquivo).
 *
 * Não mexe em `statusPagamento`: o tenant segue EM_DIA até o período acabar, e
 * quem vira a chave para CANCELADO é o webhook, ao receber
 * `customer.subscription.deleted` do Stripe na data. Marcar aqui tiraria o
 * acesso de quem ainda pagou por ele.
 *
 * @returns {{ configurado, encontradas, agendadas: Array<{id, terminaEm}>, falhas }}
 */
export async function agendarCancelamentoDoSlug(slug) {
  const vazio = { configurado: false, encontradas: 0, agendadas: [], falhas: [] };
  if (!pagamentoConfigurado() || !slug) return vazio;

  const lista = await stripe("/subscriptions?limit=100&status=active", { method: "GET" });
  const alvos = (lista?.data || []).filter((s) => s.metadata?.slug === slug);

  const resultado = { configurado: true, encontradas: alvos.length, agendadas: [], falhas: [] };
  for (const assinatura of alvos) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const atualizada = await stripe(`/subscriptions/${assinatura.id}`, {
        dados: { cancel_at_period_end: true },
      });
      /* Nas versões recentes o `current_period_end` saiu da assinatura e passou
         para o item — mesma leitura defensiva que `criarAssinatura` faz. */
      const fim =
        atualizada?.items?.data?.[0]?.current_period_end ??
        atualizada?.current_period_end ??
        assinatura?.items?.data?.[0]?.current_period_end ??
        assinatura?.current_period_end ??
        null;
      resultado.agendadas.push({
        id: assinatura.id,
        terminaEm: fim ? new Date(fim * 1000) : null,
      });
    } catch (erro) {
      resultado.falhas.push({ id: assinatura.id, motivo: erro.message });
    }
  }
  return resultado;
}

/* ─── Limpeza por slug ────────────────────────────────────────────────────────
 * Cancela IMEDIATAMENTE toda assinatura ativa marcada com este slug. É o que o
 * script `npm run stripe:limpar -- --slug=…` faz, extraído para cá porque agora
 * a exclusão de tenant no painel precisa do mesmo comportamento — e disparar um
 * `npm run` de dentro de uma rota HTTP seria frágil (cwd, PATH, spawn no
 * Windows) e lento, para chamar um código que já mora neste processo.
 *
 * O casamento é por `metadata.slug`, gravado por `criarAssinatura`. Não temos o
 * id da assinatura em coluna nenhuma (ver o cabeçalho deste arquivo), então a
 * varredura é a forma disponível de achar o que é daquele tenant.
 *
 * `ensaio: true` só relata. É o padrão do script, e continua sendo o padrão
 * aqui: cancelar é irreversível.
 *
 * @returns {{ configurado, ensaio, encontradas, canceladas, falhas }}
 */
export async function cancelarAssinaturasDoSlug(slug, { ensaio = false } = {}) {
  const vazio = { configurado: false, ensaio, encontradas: 0, canceladas: [], falhas: [] };
  if (!pagamentoConfigurado() || !slug) return vazio;

  const lista = await stripe("/subscriptions?limit=100&status=active", { method: "GET" });
  const alvos = (lista?.data || []).filter((s) => s.metadata?.slug === slug);

  const resultado = { configurado: true, ensaio, encontradas: alvos.length, canceladas: [], falhas: [] };
  if (ensaio) return resultado;

  for (const assinatura of alvos) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await stripe(`/subscriptions/${assinatura.id}`, { method: "DELETE" });
      resultado.canceladas.push(assinatura.id);
    } catch (erro) {
      // Uma falha não pode abortar as outras: o objetivo é deixar o mínimo
      // possível de cobrança viva para um tenant que não existe mais.
      resultado.falhas.push({ id: assinatura.id, motivo: erro.message });
    }
  }
  return resultado;
}

/* ── Preços vindos do Stripe ─────────────────────────────────────────────────
   O valor exibido no painel é lido do próprio Stripe, não fixado no código.
   Assim, mudar o preço lá dentro (ou pôr R$ 1 para testar) reflete na hora, e
   não existe a chance de a tela dizer um valor e a cobrança fazer outro.

   Cache curto em memória: preço muda raramente e isso evita uma ida ao Stripe
   a cada abertura do modal. */
let cachePrecos = { em: 0, dados: null };
const CACHE_MS = 5 * 60 * 1000;

function formatarBRL(centavos, moeda) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: (moeda || "brl").toUpperCase(),
  }).format((centavos ?? 0) / 100);
}

/**
 * Economia do plano anual, em reais, em percentual e em meses grátis.
 *
 * Vive separado (e exportado) porque é o número que a landing ANUNCIA: "2,5
 * meses grátis", "economize R$ 372,50". Sendo função pura sobre os dois valores
 * que o Stripe cobra, dá para conferir a conta sem nenhuma chamada de rede — e
 * é impossível a página prometer um abatimento que a fatura não pratica.
 *
 * Devolve null quando não há anual, ou quando ele não é mais barato: aí não há
 * vantagem para anunciar, e um selo de "economize R$ -30" seria pior que nada.
 */
export function economiaDoAnual(mensal, anual) {
  if (!(mensal > 0) || !(anual > 0)) return null;
  const cheio = mensal * 12;
  if (anual >= cheio) return null;
  return {
    valor: Math.round((cheio - anual) * 100) / 100,
    percentual: Math.round((1 - anual / cheio) * 100),
    mesesGratis: Math.round(((cheio - anual) / mensal) * 10) / 10,
  };
}

/**
 * @returns {Promise<{ [plano: string]: {
 *            mensal?: { rotulo: string, numero: string, sufixo: string, valor: number, intervalo: string },
 *            anual?:  { rotulo: string, numero: string, sufixo: string, valor: number, intervalo: string },
 *            economia?: { valor: number, percentual: number, mesesGratis: number },
 *          } }>}
 *          Só os planos com preço configurado E existente no Stripe.
 */
export async function precosDosPlanos() {
  if (!pagamentoConfigurado()) return {};
  if (cachePrecos.dados && Date.now() - cachePrecos.em < CACHE_MS) return cachePrecos.dados;

  /* Um par por plano: { mensal, anual }. O anual pode faltar — enquanto a
     variável não existir no ambiente, o plano volta com `anual: null` e a
     página não oferece a opção. */
  const saida = {};
  const pedidos = [];
  for (const [plano, porPeriodo] of Object.entries(PRECOS)) {
    for (const periodo of PERIODOS) {
      const id = porPeriodo[periodo];
      if (!id) continue;
      pedidos.push(
        (async () => {
          try {
            const preco = await stripe(`/prices/${id}`, { method: "GET" });
            const intervalo = preco.recurring?.interval;
            const sufixo = intervalo === "month" ? "/mês" : intervalo === "year" ? "/ano" : "";
            saida[plano] = saida[plano] || {};
            /* `rotulo` inteiro para quem só quer imprimir; `numero` e `sufixo`
               separados para quem desenha os dois em tamanhos diferentes (a
               landing põe o valor em 34px e o "/mês" pequeno ao lado). Partido
               aqui e não no navegador porque quem monta a string é este arquivo:
               separar lá seria adivinhar onde o número termina, e a moeda pode
               mudar de formato. */
            saida[plano][periodo] = {
              valor: (preco.unit_amount ?? 0) / 100,
              numero: formatarBRL(preco.unit_amount, preco.currency),
              sufixo,
              rotulo: `${formatarBRL(preco.unit_amount, preco.currency)}${sufixo}`,
              intervalo: intervalo || null,
            };
          } catch (erro) {
            // Preço apagado ou id errado no .env: melhor sumir da lista do que
            // oferecer um plano que vai falhar na hora de cobrar.
            console.warn(`[pagamento] preço ${periodo} do plano ${plano} indisponível:`, erro.message);
          }
        })(),
      );
    }
  }
  await Promise.all(pedidos);

  /* Economia do anual, calculada a partir do que o Stripe REALMENTE cobra —
     nunca de um percentual escrito à mão. A página exibe este número, então
     mexer no preço lá dentro corrige o texto da landing sozinho, e é impossível
     anunciar um desconto que a fatura não pratica. */
  for (const dados of Object.values(saida)) {
    const economia = economiaDoAnual(dados.mensal?.valor, dados.anual?.valor);
    if (economia) dados.economia = economia;
  }

  cachePrecos = { em: Date.now(), dados: saida };
  return saida;
}
