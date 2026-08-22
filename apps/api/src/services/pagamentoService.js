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
/* ── E, desde o Omnimob Flow, DOIS PACOTES por plano ──────────────────────────

   `HUB` é o que sempre existiu. `HUB_FLOW` é a conta com os dois módulos, num
   preço próprio. A conta completa é 3 planos × 2 pacotes × 2 períodos = DOZE
   objetos de preço no Stripe. Seis já existiam (os do Hub, mensal e anual); os
   seis novos são os do Flow.

   As variáveis do Flow são NOVAS e OPCIONAIS. Enquanto não existirem, o pacote
   com Flow simplesmente não é vendável e a landing não o oferece; o Hub segue
   funcionando exatamente como antes. Nada quebra por falta delas — é a mesma
   escolha que o preço anual fez quando entrou.

     STRIPE_PRICE_BASICO_FLOW              STRIPE_PRICE_BASICO_FLOW_ANUAL
     STRIPE_PRICE_PROFISSIONAL_FLOW        STRIPE_PRICE_PROFISSIONAL_FLOW_ANUAL
     STRIPE_PRICE_PREMIUM_FLOW             STRIPE_PRICE_PREMIUM_FLOW_ANUAL

   O aninhamento é `plano → pacote → periodo`, e não `plano → periodo` com o
   pacote no nome da chave: com o pacote na chave, `periodosDoPlano` e
   `planoTemPreco` teriam de decompor string, e a primeira variação nova (um
   terceiro módulo) multiplicaria as combinações escritas à mão. */
const PRECOS = {
  BASICO: {
    HUB: {
      mensal: env("STRIPE_PRICE_BASICO", "STRIPE_PRICE_BASIC"),
      anual: env("STRIPE_PRICE_BASICO_ANUAL", "STRIPE_PRICE_BASIC_ANNUAL"),
    },
    HUB_FLOW: {
      mensal: env("STRIPE_PRICE_BASICO_FLOW", "STRIPE_PRICE_BASIC_FLOW"),
      anual: env("STRIPE_PRICE_BASICO_FLOW_ANUAL", "STRIPE_PRICE_BASIC_FLOW_ANNUAL"),
    },
  },
  PROFISSIONAL: {
    HUB: {
      mensal: env("STRIPE_PRICE_PROFISSIONAL", "STRIPE_PRICE_PRO"),
      anual: env("STRIPE_PRICE_PROFISSIONAL_ANUAL", "STRIPE_PRICE_PRO_ANNUAL"),
    },
    HUB_FLOW: {
      mensal: env("STRIPE_PRICE_PROFISSIONAL_FLOW", "STRIPE_PRICE_PRO_FLOW"),
      anual: env("STRIPE_PRICE_PROFISSIONAL_FLOW_ANUAL", "STRIPE_PRICE_PRO_FLOW_ANNUAL"),
    },
  },
  PREMIUM: {
    HUB: {
      mensal: env("STRIPE_PRICE_PREMIUM"),
      anual: env("STRIPE_PRICE_PREMIUM_ANUAL", "STRIPE_PRICE_PREMIUM_ANNUAL"),
    },
    HUB_FLOW: {
      mensal: env("STRIPE_PRICE_PREMIUM_FLOW"),
      anual: env("STRIPE_PRICE_PREMIUM_FLOW_ANUAL", "STRIPE_PRICE_PREMIUM_FLOW_ANNUAL"),
    },
  },
};

/** Pacotes aceitos. Qualquer outra coisa vinda do cliente vira "HUB" — o padrão
 *  seguro é o que a conta sempre teve, e nunca o que custa mais caro. */
export const PACOTES_VALIDOS = ["HUB", "HUB_FLOW"];
export function normalizarPacote(valor) {
  return PACOTES_VALIDOS.includes(String(valor)) ? String(valor) : "HUB";
}

/** Os módulos que um pacote entrega — é o que vira `Tenant.modulos` ao assinar.
 *  Espelho de `modulosDoPacote` em `apps/web/src/utils/planos.js`. */
export function modulosDoPacote(pacote) {
  return normalizarPacote(pacote) === "HUB_FLOW" ? ["HUB", "FLOW"] : ["HUB"];
}

/** Períodos aceitos. Qualquer outra coisa vinda do cliente vira "mensal". */
export const PERIODOS = ["mensal", "anual"];
export function normalizarPeriodo(valor) {
  return PERIODOS.includes(String(valor)) ? String(valor) : "mensal";
}

/** O id de preço do Stripe para um plano, num pacote e num período.
 *
 *  `pacote` é o último parâmetro e tem padrão: as chamadas antigas continuam
 *  significando o que sempre significaram — o Hub sozinho. */
function idDoPreco(plano, periodo, pacote = "HUB") {
  return PRECOS[plano]?.[normalizarPacote(pacote)]?.[normalizarPeriodo(periodo)] || "";
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

export function planoTemPreco(plano, periodo, pacote = "HUB") {
  return periodo
    ? Boolean(idDoPreco(plano, periodo, pacote))
    : Boolean(idDoPreco(plano, "mensal", pacote));
}

/** Períodos que um plano realmente pode cobrar hoje (o anual só quando existe). */
export function periodosDoPlano(plano, pacote = "HUB") {
  return PERIODOS.filter((periodo) => Boolean(idDoPreco(plano, periodo, pacote)));
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
export async function criarAssinatura({ tenant, plano, periodo, pacote, tokenPagamento }) {
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
  const pacoteEscolhido = normalizarPacote(pacote);
  const preco = idDoPreco(plano, periodoEscolhido, pacoteEscolhido);
  if (!preco) {
    /* Sem preço para ESTE período. Duas causas, e a mensagem distingue: o plano
       nunca teve cobrança automática (sob consulta), ou o anual ainda não foi
       cadastrado no ambiente — que é erro de configuração nosso, não decisão
       comercial, e o cliente não deve ler "fale com o time" por isso. */
    const temMensal = Boolean(idDoPreco(plano, "mensal", pacoteEscolhido));
    const err = new Error(
      temMensal && periodoEscolhido === "anual"
        ? "A cobrança anual deste plano ainda não está disponível. Escolha mensal ou fale com o time."
        : "Este plano é fechado sob consulta. Fale com o time.",
    );
    err.code = temMensal && periodoEscolhido === "anual" ? "PERIODO_INDISPONIVEL" : "PLANO_SOB_CONSULTA";
    throw err;
  }

/* ── A CHAVE DE IDEMPOTÊNCIA PRECISA INCLUIR O MÉTODO DE PAGAMENTO ──────────

   Ela era só `cliente-<tenant>`, e o Stripe recusa reutilizar uma chave com
   parâmetros diferentes. Como o corpo carrega `payment_method`, que muda a cada
   tentativa, a SEGUNDA tentativa morria com `idempotency_error` — e o texto do
   erro fala de chaves, não de cartão, então quem tentasse outro cartão depois
   de uma recusa levava uma parede sem relação aparente com o que fez.

   Incluindo o método, a chave passa a identificar A TENTATIVA. A proteção que
   ela existia para dar continua de pé: clique duplo e retentativa de rede
   mandam o MESMO método, caem na mesma chave, e o Stripe devolve o mesmo
   cliente em vez de criar dois. Tentativa nova, com outro cartão, é outro
   pedido — e deve ser tratada como tal. */
  // 1. Cliente no Stripe, já com o método de pagamento como padrão das faturas.
  const cliente = await stripe("/customers", {
    dados: {
      name: tenant.name,
      email: tenant.email || undefined,
      payment_method: tokenPagamento,
      invoice_settings: { default_payment_method: tokenPagamento },
      metadata: { tenantId: tenant.id, slug: tenant.slug },
    },
    idempotencia: `cliente-${tenant.id}-${tokenPagamento}`,
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

/* O id do PaymentIntent da fatura, nas DUAS formas.

   Nas versões recentes da API (`2026-07-29.dahlia` em diante) o
   `latest_invoice.payment_intent` deixou de existir: ele agora mora em
   `latest_invoice.payments[].payment.payment_intent`. A chave antiga volta
   `undefined`, sem erro nenhum.

   Foi assim que o boleto passou a nascer morto: sem o id, a confirmação era
   simplesmente pulada, o PaymentIntent ficava em `requires_confirmation`, e
   nenhuma guia era gerada — enquanto a tela anunciava "boleto gerado". É a
   mesma armadilha que já custou o `current_period_end` neste arquivo. */
function idDoIntent(fatura) {
  return (
    fatura?.payments?.data?.[0]?.payment?.payment_intent ||
    fatura?.payment_intent?.id ||
    fatura?.payment_intent ||
    null
  );
}

/* ─── A cobrança em aberto ───────────────────────────────────────────────────

   Responde uma pergunta que o painel não sabia responder: "gerei um boleto —
   ele foi pago?".

   Ela existe porque o boleto separa em dois o que o cartão faz num passo só.
   Com cartão, ou passou ou não passou, e a resposta da requisição já conta a
   história. Com boleto a assinatura fica `incomplete` até o dinheiro entrar, e
   nesse intervalo — que pode ser dias — o produto não tinha nada a mostrar. A
   pessoa gerava a guia, fechava a tela, e não havia mais onde reencontrá-la.

   Não guardamos o id da assinatura em lugar nenhum, então achamos pela busca do
   provedor, por `metadata.tenantId` — que já gravamos desde sempre. Uma coluna
   nova seria mais rápida, e também mais uma coisa para sair de sincronia com a
   verdade, que mora lá.
   ────────────────────────────────────────────────────────────────────────── */
export async function cobrancaEmAberto(tenantId) {
  if (!pagamentoConfigurado() || !tenantId) return null;
  try {
    const busca = await stripe(
      `/subscriptions/search?limit=1&query=${encodeURIComponent(`metadata['tenantId']:'${tenantId}'`)}&expand[]=data.latest_invoice.payments`,
      { method: "GET" },
    );
    const assinatura = busca?.data?.[0];
    if (!assinatura) return null;

    /* Só o id vem no `expand`; os detalhes da guia exigem buscar o intent. */
    const intentId = idDoIntent(assinatura.latest_invoice);
    const intent = intentId ? await stripe(`/payment_intents/${intentId}`, { method: "GET" }) : null;
    const guia = intent?.next_action?.boleto_display_details || null;

    /* `incomplete` é o estado que interessa: existe uma cobrança criada e não
       liquidada. `active` significa pago, e aí não há nada em aberto para
       avisar. `incomplete_expired` é o boleto que venceu sem pagamento. */
    const situacao =
      assinatura.status === "active" || assinatura.status === "trialing" ? "paga"
      : assinatura.status === "incomplete_expired" ? "vencida"
      : intent?.status === "processing" || intent?.status === "requires_action" ? "aberta"
      : assinatura.status === "incomplete" ? "aberta"
      : null;

    if (!situacao || situacao === "paga") return null;

    return {
      meio: assinatura.metadata?.meio || intent?.payment_method_types?.[0] || null,
      situacao,
      plano: assinatura.metadata?.plano || null,
      valor: (assinatura.items?.data?.[0]?.price?.unit_amount ?? 0) / 100 || null,
      guia: guia
        ? {
            url: guia.hosted_voucher_url || null,
            pdf: guia.pdf || null,
            numero: guia.number || null,
            venceEm: guia.expires_at ? new Date(guia.expires_at * 1000) : null,
          }
        : null,
    };
  } catch {
    /* Falha aqui não pode derrubar a tela do painel: é informação ACESSÓRIA
       sobre uma cobrança, não o que decide se a pessoa entra. */
    return null;
  }
}

/* ─── O que a CONTA consegue cobrar ──────────────────────────────────────────

   Não é o que o produto suporta — é o que a Stripe liberou para esta conta.
   `available: false` não significa "desligado, é só clicar": significa que a
   capacidade não foi concedida.

   Existe porque a tela ofereceu Pix num ambiente onde ele nunca funcionaria, e
   o cliente só descobria no clique. Oferecer um meio de pagamento que falha é
   pior que não oferecer.

   Em cache: isto muda quando alguém fala com o suporte da Stripe, não a cada
   requisição, e é consultado na montagem de uma tela que já é pesada. */
let meiosEmCache = null;
let meiosLidosEm = 0;
const VALIDADE_DOS_MEIOS_MS = 10 * 60 * 1000;

/* A MARCA da conta, embutida nas chaves do Stripe.

   Serve para uma coisa só, e ela é importante: a chave publicável mora no
   `.env` do web e o servidor nunca a vê. Se ela for de OUTRA conta — duas
   sandboxes, um copiar-colar trocado —, tudo parece certo até o último passo:
   o servidor cria o PaymentIntent na conta dele, o navegador tenta confirmar na
   conta da chave publicável, e o Stripe responde 404 porque ali aquele
   PaymentIntent não existe.

   O erro é mudo e caro: aparece só na hora de pagar, num stack trace de dentro
   do Stripe.js, sem dizer que o problema é de configuração. Publicando a marca,
   a tela compara e avisa antes. */
export async function marcaDaConta() {
  if (!pagamentoConfigurado()) return null;
  try {
    const conta = await stripe("/account", { method: "GET" });
    return String(conta?.id || "").replace(/^acct_1/, "") || null;
  } catch {
    return null;
  }
}

export async function meiosDisponiveis() {
  if (!pagamentoConfigurado()) return { cartao: false, pix: false, boleto: false };
  if (meiosEmCache && Date.now() - meiosLidosEm < VALIDADE_DOS_MEIOS_MS) return meiosEmCache;

  try {
    const r = await stripe("/payment_method_configurations", { method: "GET" });
    const c = r?.data?.[0] || {};
    const ligado = (m) => Boolean(c[m]?.available);
    meiosEmCache = { cartao: ligado("card"), pix: ligado("pix"), boleto: ligado("boleto") };
    meiosLidosEm = Date.now();
  } catch {
    /* Falha de rede não pode esconder o cartão, que é o caminho principal.
       Assume o mínimo que sempre existiu. */
    meiosEmCache = { cartao: true, pix: false, boleto: false };
    meiosLidosEm = Date.now();
  }
  return meiosEmCache;
}

/* ─── Pix Automático ─────────────────────────────────────────────────────────

   ⚠️  NÃO FUNCIONA EM CONTA STRIPE BRASILEIRA, e não é questão de esperar.

   A documentação do Pix Automático descreve mandato, notificação prévia e
   cobrança recorrente — tudo real, e tudo indisponível para quem tem a conta no
   Brasil. O artigo de suporte da Stripe é explícito: conta brasileira aceita
   "apenas pagamentos únicos com Pix", e "o Pix Automático (pagamentos
   recorrentes) não está disponível".

   O código fica porque está correto para as contas que TÊM a capacidade, e
   porque a alternativa — apagar e reescrever quando liberar — perde o trabalho
   de ler a especificação. Mas quem decide se ele aparece na tela é
   `meiosDisponiveis()`, não a esperança.

   Para conta brasileira, os caminhos que existem hoje são: BOLETO, que suporta
   recorrência de verdade com o Stripe Billing, e PIX AVULSO, que serviria para
   o plano anual cobrado por fatura. Os dois exigem elegibilidade (60 dias
   processando + pedido ao suporte).
   ── COMO ELE FUNCIONA, PARA QUEM PODE USAR ──

   Assinatura recorrente paga por Pix. O cliente autoriza um MANDATO no app do
   banco dele uma vez, e as cobranças seguintes saem sozinhas — não é o Pix
   avulso em que alguém precisa lembrar de pagar todo mês.

   ── O QUE MUDA EM RELAÇÃO AO CARTÃO ──

   O cartão é síncrono: o navegador manda o método de pagamento, o servidor cria
   a assinatura, e ou passou ou não passou. O Pix é o contrário — a assinatura
   nasce `incomplete`, o cliente autoriza no banco, e a confirmação chega DEPOIS,
   por webhook. Por isso esta função devolve um `clientSecret` em vez de um
   desfecho: quem termina o trabalho é a tela, e quem avisa que deu certo é o
   `invoice.paid` (que já existe e já ativa o tenant).

   ── OS TRÊS DIAS ──

   O banco do cliente é obrigado a avisá-lo 3 dias antes de cada débito. Então a
   cobrança cai no ciclo + 3 dias, e nesse intervalo o pagamento fica em
   `processing`. Quem cortar acesso por vencimento precisa saber disso.
   ────────────────────────────────────────────────────────────────────────── */

/* Teto que o cliente autoriza por ciclo. O padrão do Stripe é 400 BRL, e um
   Premium anual passa disso — a cobrança seguinte falharia por estourar o
   mandato, meses depois, sem ninguém relacionar as duas coisas.

   A folga de 30% existe porque o mandato é assinado UMA VEZ e vale para sempre:
   reajuste de preço, IOF e imposto entram por dentro dele. Pedir um teto justo
   significaria trazer o cliente de volta ao app do banco a cada centavo a mais. */
const FOLGA_DO_MANDATO = 1.3;

/* Pix e boleto são o MESMO fluxo com dois campos diferentes: assinatura nasce
   pendente, o cliente conclui por fora, o webhook confirma. Duas funções quase
   idênticas divergiriam no primeiro ajuste — e o ajuste sempre chega. */
export async function criarAssinaturaBoleto({ tenant, plano, periodo, pacote, tokenPagamento }) {
  return criarAssinaturaAssincrona({ tenant, plano, periodo, pacote, meio: "boleto", tokenPagamento });
}

export async function criarAssinaturaPix({ tenant, plano, periodo, pacote }) {
  return criarAssinaturaAssincrona({ tenant, plano, periodo, pacote, meio: "pix" });
}

async function criarAssinaturaAssincrona({ tenant, plano, periodo, pacote, meio, tokenPagamento }) {
  if (!pagamentoConfigurado()) {
    const err = new Error(
      "Cobrança automática ainda não está conectada. Fale com o time para fechar o plano.",
    );
    err.code = "PROVEDOR_NAO_CONFIGURADO";
    throw err;
  }

  const periodoEscolhido = normalizarPeriodo(periodo);
  const pacoteEscolhido = normalizarPacote(pacote);
  const preco = idDoPreco(plano, periodoEscolhido, pacoteEscolhido);
  if (!preco) {
    const temMensal = Boolean(idDoPreco(plano, "mensal", pacoteEscolhido));
    const err = new Error(
      temMensal && periodoEscolhido === "anual"
        ? "A cobrança anual deste plano ainda não está disponível. Escolha mensal ou fale com o time."
        : "Este plano é fechado sob consulta. Fale com o time.",
    );
    err.code = temMensal && periodoEscolhido === "anual" ? "PERIODO_INDISPONIVEL" : "PLANO_SOB_CONSULTA";
    throw err;
  }

  // Quanto o Stripe vai cobrar, para dimensionar o teto do mandato.
  const objetoPreco = await stripe(`/prices/${preco}`, { method: "GET" });
  const centavos = Number(objetoPreco?.unit_amount || 0);
  if (!centavos) {
    const err = new Error("Não consegui ler o valor deste plano no provedor.");
    err.code = "PROVEDOR_FALHOU";
    throw err;
  }

  const cliente = await stripe("/customers", {
    dados: {
      name: tenant.name,
      email: tenant.email || undefined,
      /* O método já vem pronto do navegador — o Payment Element coletou o
         documento e o endereço que o boleto exige, e nós não vemos nem
         guardamos nada disso. */
      ...(tokenPagamento ? { payment_method: tokenPagamento } : {}),
      metadata: { tenantId: tenant.id, slug: tenant.slug },
    },
    idempotencia: `cliente-assinc-${tenant.id}-${tokenPagamento || "sem-metodo"}`,
  });

  const assinatura = await stripe("/subscriptions", {
    dados: {
      customer: cliente.id,
      items: [{ price: preco }],
      /* `default_incomplete`, e não o `error_if_incomplete` do cartão: aqui
         nascer pendente é o caminho normal, não uma falha. A assinatura espera
         o cliente autorizar o mandato no banco. */
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
        payment_method_types: [meio],
        payment_method_options: meio !== "pix" ? undefined : {
          pix: {
            mandate_options: {
              amount: Math.ceil(centavos * FOLGA_DO_MANDATO),
              /* Só `amount`. `amount_type` e `reference` existem na
                 documentação, mas numa versão da API mais nova que a desta
                 conta — mandá-los devolve "Received unknown parameters".
                 `amount_type` cai no padrão `maximum`, que é o que queremos;
                 o `reference` (nome exibido no app do banco) cai no nome
                 comercial da conta, e é o que se perde por ora. */
              /* Deixamos o `payment_schedule` no padrão (mensal) mesmo no plano
                 anual. O campo diz com que FREQUÊNCIA se pode cobrar, não com
                 que frequência se cobra — mensal permite cobrar uma vez ao ano;
                 o inverso é que falharia. */
            },
          },
        },
      },
      ...(tokenPagamento ? { default_payment_method: tokenPagamento } : {}),
      expand: ["latest_invoice.confirmation_secret", "latest_invoice.payments"],
      metadata: { tenantId: tenant.id, slug: tenant.slug, plano, periodo: periodoEscolhido, meio },
    },
    /* Mesmo motivo da chave do cliente: o corpo leva `default_payment_method`.
       Sem o método aqui, trocar de cartão depois de uma recusa reencontrava a
       chave antiga com corpo novo e o pedido morria. */
    idempotencia: `assinatura-${meio}-${tenant.id}-${plano}-${periodoEscolhido}-${tokenPagamento || "sem-metodo"}`,
  });

  const segredo = assinatura?.latest_invoice?.confirmation_secret?.client_secret;

  /* ── Confirmar do lado do SERVIDOR ────────────────────────────────────────
     Com o método já em mãos, confirmar aqui é melhor que devolver um segredo
     para a tela confirmar de novo: o boleto nasce nesta chamada e volta com a
     URL da guia, então a tela recebe algo para MOSTRAR em vez de mais um passo
     para executar.

     E resolve o problema que originou tudo isto: o Payment Element já é o
     seletor de meio de pagamento. Um segundo seletor nosso em cima dele
     perguntava duas vezes a mesma coisa. */
  let guia = null;
  const intentId = idDoIntent(assinatura?.latest_invoice);
  if (tokenPagamento && intentId) {
    /* `receipt_email` decide PARA ONDE o Stripe manda as instruções do boleto
       (quando o envio está ligado no painel dele). Sem ele, o destino é o
       e-mail que a pessoa digitou no formulário de pagamento — que costuma ser
       o certo, mas é o que ela digitou, não o que a imobiliária cadastrou.

       Mandamos o do CADASTRO: a cobrança é da empresa, e quem paga hoje pode
       não ser quem paga no mês que vem. Quem digitou o próprio e-mail continua
       recebendo pelo recibo do método de pagamento. */
    const intent = await stripe(`/payment_intents/${intentId}/confirm`, {
      dados: {
        payment_method: tokenPagamento,
        ...(tenant.email ? { receipt_email: tenant.email } : {}),
      },
    });
    const detalhes = intent?.next_action?.boleto_display_details;
    if (detalhes) {
      guia = {
        url: detalhes.hosted_voucher_url || null,
        pdf: detalhes.pdf || null,
        /* A linha digitável é o que a maioria usa: copia e cola no app do
           banco. O PDF é para quem imprime ou repassa ao financeiro — comum
           em imobiliária, e por isso os dois vão. */
        numero: detalhes.number || null,
        venceEm: detalhes.expires_at ? new Date(detalhes.expires_at * 1000) : null,
      };
    }
  }

  if (!segredo && !guia) {
    const err = new Error(`O provedor não devolveu os dados para concluir o ${meio}.`);
    err.code = "PROVEDOR_FALHOU";
    throw err;
  }

  const valorCobrado = centavos / 100;
  return {
    meio,
    guia,
    clientSecret: segredo,
    assinaturaId: assinatura.id,
    clienteId: cliente.id,
    periodo: periodoEscolhido,
    valorCobrado,
    valorMensal:
      periodoEscolhido === "anual"
        ? Math.round((valorCobrado / 12) * 100) / 100
        : valorCobrado,
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
  /* ── A FORMA DA RESPOSTA, e por que ela não é uma matriz ──────────────────

     `{ BASICO: { mensal, anual, economia, flow: { mensal, anual, economia } } }`

     O pacote HUB fica na RAIZ do plano, exatamente onde sempre esteve, e o
     Hub+Flow entra num `flow` aninhado. A forma simétrica
     (`{ BASICO: { HUB: {...}, HUB_FLOW: {...} } }`) é mais bonita e quebraria
     todos os consumidores de uma vez — a landing, a aba de Plano, o modal de
     boas-vindas e a parede de reativação leem `precos.BASICO.mensal.rotulo`
     hoje.

     Assimetria deliberada, então: o que existia continua onde estava, e o que é
     novo é opcional. Quem não conhece o Flow nem percebe que a chave apareceu.
     ────────────────────────────────────────────────────────────────────────── */
  const saida = {};
  const pedidos = [];
  for (const [plano, porPacote] of Object.entries(PRECOS)) {
    for (const pacote of PACOTES_VALIDOS) {
      const porPeriodo = porPacote[pacote] || {};
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
            /* O HUB na raiz; o HUB_FLOW em `flow`. Ver o comentário acima. */
            const alvo = pacote === "HUB_FLOW"
              ? (saida[plano].flow = saida[plano].flow || {})
              : saida[plano];
            /* `rotulo` inteiro para quem só quer imprimir; `numero` e `sufixo`
               separados para quem desenha os dois em tamanhos diferentes (a
               landing põe o valor em 34px e o "/mês" pequeno ao lado). Partido
               aqui e não no navegador porque quem monta a string é este arquivo:
               separar lá seria adivinhar onde o número termina, e a moeda pode
               mudar de formato. */
            alvo[periodo] = {
              valor: (preco.unit_amount ?? 0) / 100,
              numero: formatarBRL(preco.unit_amount, preco.currency),
              sufixo,
              rotulo: `${formatarBRL(preco.unit_amount, preco.currency)}${sufixo}`,
              intervalo: intervalo || null,
            };
          } catch (erro) {
            // Preço apagado ou id errado no .env: melhor sumir da lista do que
            // oferecer um plano que vai falhar na hora de cobrar.
            console.warn(`[pagamento] preço ${periodo} do plano ${plano} (${pacote}) indisponível:`, erro.message);
          }
        })(),
      );
      }
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
    /* O pacote com Flow tem a economia dele, calculada dos preços DELE. Herdar
       a do Hub anunciaria um desconto que a fatura do Hub+Flow não pratica. */
    if (dados.flow) {
      const doFlow = economiaDoAnual(dados.flow.mensal?.valor, dados.flow.anual?.valor);
      if (doFlow) dados.flow.economia = doFlow;
    }
  }

  cachePrecos = { em: Date.now(), dados: saida };
  return saida;
}

/* ═══════════════════════════════════════════════════════════════════════════
   AJUSTAR UMA ASSINATURA QUE JÁ ESTÁ RODANDO
   ═══════════════════════════════════════════════════════════════════════════

   Trocar de plano ou contratar o Omnimob Flow no meio do ciclo. Até aqui as
   duas rotas mudavam o que a imobiliária USA e respondiam `cobrancaAjustada:
   false` — o valor era acertado à mão pelo time, porque o id da assinatura no
   provedor não era guardado em lugar nenhum.

   ── O PROPORCIONAL É DO STRIPE, E NÃO NOSSO ──

   A tentação é calcular: "faltam 18 dias de 30, a diferença é R$ 40, cobro
   R$ 24". Errado por três motivos, e todos aparecem em produção:

     · o ciclo não tem 30 dias — tem o que o mês tiver, e o anual tem 365 ou 366;
     · a data de corte é a da assinatura, não a do calendário;
     · desconto, cupom e imposto entram na conta e nós não os conhecemos.

   O Stripe faz essa conta com os dados que só ele tem. Mandamos
   `proration_behavior` e ele emite as linhas de crédito e débito. Duplicar a
   aritmética aqui produziria um número que discorda da fatura — e o número que
   vale é sempre o da fatura.

   ── POR QUE `create_prorations`, E NÃO COBRAR NA HORA ──

   `always_invoice` fecha uma fatura no ato e passa o cartão. Para quem clicou
   em "contratar o Flow" isso é uma cobrança inesperada no meio do dia, de um
   valor quebrado que ninguém conferiu.

   `create_prorations` lança as linhas na PRÓXIMA fatura, que é quando o cliente
   já espera pagar. A diferença aparece discriminada, ele confere, e o valor
   fecha com o ciclo. É o comportamento que assinatura B2B tem em todo lugar.

   Na REMOÇÃO isso importa ainda mais: sair do Flow gera crédito, e crédito com
   `always_invoice` viraria uma fatura de valor negativo — que o Stripe trata
   como saldo, e o cliente lê como cobrança estranha.

   ── ACHAR A ASSINATURA ──

   `tenant.assinaturaId` é o caminho rápido. Vazio (toda conta anterior a esta
   coluna) cai na busca por `metadata.tenantId`, e o que ela achar é GRAVADO —
   a conta se conserta sozinha no primeiro ajuste, sem backfill.

   O id guardado nunca é usado às cegas: a assinatura é LIDA antes de qualquer
   escrita. Um id morto vira "não achei" e cai na busca também.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Os estados em que ainda faz sentido mexer. `incomplete` fica de fora: é
 *  boleto ou Pix esperando dinheiro, e mudar o preço antes de a primeira
 *  cobrança liquidar produziria uma fatura que não bate com a guia que o
 *  cliente já tem na mão. */
const AJUSTAVEIS = ["active", "trialing", "past_due"];

/** O período que a assinatura cobra hoje, lido do preço dela.
 *
 *  Do PROVEDOR e não de uma coluna nossa: é ele quem sabe o que está cobrando,
 *  e uma cópia aqui seria a segunda fonte de verdade que o comentário de
 *  `cobrancaEmAberto` alerta contra. */
function periodoDaAssinatura(assinatura) {
  const intervalo = assinatura?.items?.data?.[0]?.price?.recurring?.interval;
  return intervalo === "year" ? "anual" : "mensal";
}

/**
 * Acha a assinatura viva do tenant. Devolve `null` quando não há nenhuma.
 *
 * @returns {Promise<{ assinatura: object, veioDaBusca: boolean }|null>}
 */
async function acharAssinatura(tenant) {
  // 1. O caminho rápido: o id guardado.
  if (tenant.assinaturaId) {
    try {
      const a = await stripe(`/subscriptions/${tenant.assinaturaId}`, { method: "GET" });
      if (a && a.status !== "canceled") return { assinatura: a, veioDaBusca: false };
    } catch {
      /* Id morto (assinatura apagada no painel, conta trocada). Não é erro: cai
         na busca, que é justamente o caminho de quem não tem id nenhum. */
    }
  }

  // 2. O resgate: a mesma busca que `cobrancaEmAberto` usa.
  try {
    const busca = await stripe(
      `/subscriptions/search?limit=1&query=${encodeURIComponent(`metadata['tenantId']:'${tenant.id}'`)}`,
      { method: "GET" },
    );
    const a = busca?.data?.[0];
    if (a && a.status !== "canceled") return { assinatura: a, veioDaBusca: true };
  } catch {
    /* Busca indisponível é indistinguível de "não achou" para quem chama: nos
       dois casos não há o que ajustar, e a resposta é a mesma. */
  }
  return null;
}

/* O motivo, em português, de um ajuste que não aconteceu. Ele vai para a tela,
   então cada um diz o que FAZER — "não foi possível" sozinho manda a pessoa
   abrir chamado para descobrir o óbvio. */
const MOTIVOS = {
  SEM_PROVEDOR: "A cobrança automática não está configurada nesta instalação.",
  SEM_ASSINATURA: "Não encontramos uma assinatura ativa desta conta no provedor. O valor será acertado pelo nosso time.",
  ESTADO: "A assinatura está com uma cobrança em aberto. O valor será ajustado assim que ela liquidar.",
  SEM_PRECO: "Ainda não há preço cadastrado para esta combinação de plano e módulos. O valor será acertado pelo nosso time.",
  IGUAL: "O valor da assinatura não mudou.",
  FALHOU: "O provedor recusou o ajuste. O valor será acertado pelo nosso time.",
};

/**
 * Aponta a assinatura viva para o preço de (plano × pacote), no MESMO período
 * que ela já cobra, e deixa o Stripe calcular o proporcional.
 *
 * Nunca lança: um ajuste de cobrança que falha não pode desfazer a mudança de
 * plano ou de módulo que já foi gravada — o cliente ficaria sem o que pediu E
 * sem explicação. A falha vira `{ ajustada: false, motivo }` e a tela conta a
 * verdade.
 *
 * @param {object} args
 * @param {object} args.tenant  precisa de `id`, `assinaturaId`
 * @param {string} args.plano   BASICO | PROFISSIONAL | PREMIUM
 * @param {string} args.pacote  HUB | HUB_FLOW
 * @returns {Promise<{ ajustada, motivo?, de?, para?, periodo?, valorMensal?, proximoVencimento?, assinaturaId? }>}
 */
export async function ajustarAssinatura({ tenant, plano, pacote }) {
  if (!pagamentoConfigurado()) return { ajustada: false, motivo: MOTIVOS.SEM_PROVEDOR };

  const achado = await acharAssinatura(tenant);
  if (!achado) return { ajustada: false, motivo: MOTIVOS.SEM_ASSINATURA };

  const { assinatura, veioDaBusca } = achado;
  if (!AJUSTAVEIS.includes(assinatura.status)) {
    return { ajustada: false, motivo: MOTIVOS.ESTADO, assinaturaId: assinatura.id };
  }

  const item = assinatura.items?.data?.[0];
  if (!item?.id) return { ajustada: false, motivo: MOTIVOS.FALHOU, assinaturaId: assinatura.id };

  /* O período NÃO muda num ajuste de plano ou de módulo. Quem assinou o anual
     continua no anual: trocar o ciclo junto seria decidir por ele uma coisa que
     ele não pediu, e ainda geraria um proporcional de doze meses. */
  const periodo = periodoDaAssinatura(assinatura);
  const precoNovo = idDoPreco(plano, periodo, pacote);
  if (!precoNovo) {
    return { ajustada: false, motivo: MOTIVOS.SEM_PRECO, assinaturaId: assinatura.id, periodo };
  }

  const precoAtual = item.price?.id || null;
  if (precoAtual === precoNovo) {
    return { ajustada: false, motivo: MOTIVOS.IGUAL, semMudanca: true, assinaturaId: assinatura.id, periodo };
  }

  try {
    const atualizada = await stripe(`/subscriptions/${assinatura.id}`, {
      dados: {
        items: [{ id: item.id, price: precoNovo }],
        /* Ver o cabeçalho: as linhas entram na PRÓXIMA fatura, e não numa
           cobrança imediata. */
        proration_behavior: "create_prorations",
        /* O metadata acompanha o que passou a ser cobrado. Ele é lido pelo
           webhook e pela busca; deixá-lo apontando para o plano antigo faria a
           conciliação contar errado no mês seguinte. */
        metadata: { tenantId: tenant.id, plano, periodo, pacote },
        expand: ["items.data.price"],
      },
      /* Idempotência pelo DESTINO, e não por um carimbo de tempo: dois cliques
         no mesmo botão pedem exatamente o mesmo ajuste, e o segundo tem que ser
         inofensivo. Com a hora dentro da chave ele viraria um segundo
         proporcional sobre o primeiro. */
      idempotencia: `ajuste-${tenant.id}-${precoNovo}`,
    });

    const novoItem = atualizada.items?.data?.[0];
    const valorCobrado = (novoItem?.price?.unit_amount ?? 0) / 100;

    return {
      ajustada: true,
      assinaturaId: atualizada.id,
      /* Gravado pelo chamador quando veio da busca — é o que conserta a conta
         antiga sem backfill. */
      gravarId: veioDaBusca || tenant.assinaturaId !== atualizada.id,
      de: precoAtual,
      para: precoNovo,
      periodo,
      valorCobrado,
      /* A coluna se chama `valorMensal` e é lida como tal na tela e no e-mail;
         no anual, o valor do ano é dividido antes de ir para lá. Mesma regra de
         `criarAssinatura`. */
      valorMensal: periodo === "anual" ? Math.round((valorCobrado / 12) * 100) / 100 : valorCobrado,
      proximoVencimento: atualizada.current_period_end
        ? new Date(atualizada.current_period_end * 1000)
        : null,
    };
  } catch (erro) {
    console.warn("[pagamento] o provedor recusou o ajuste:", erro?.message || erro);
    return { ajustada: false, motivo: MOTIVOS.FALHOU, assinaturaId: assinatura.id, detalhe: erro?.message };
  }
}

/**
 * Quanto o ajuste vai somar (ou abater) na próxima fatura, ANTES de aplicar.
 *
 * É informativo e por isso nunca derruba nada: qualquer falha devolve `null` e
 * a tela simplesmente não mostra o número. A operação em si não depende dele.
 *
 * ⚠ A rota de prévia de fatura mudou de nome entre versões da API do Stripe
 * (`/invoices/upcoming` nas antigas, `/invoices/create_preview` nas novas).
 * Tentamos a antiga e, no 404, a nova — em vez de cravar uma e quebrar
 * conforme a versão configurada na conta.
 */
export async function previaDoAjuste({ tenant, plano, pacote }) {
  if (!pagamentoConfigurado()) return null;

  try {
    const achado = await acharAssinatura(tenant);
    if (!achado) return null;
    const { assinatura } = achado;
    if (!AJUSTAVEIS.includes(assinatura.status)) return null;

    const item = assinatura.items?.data?.[0];
    const periodo = periodoDaAssinatura(assinatura);
    const precoNovo = idDoPreco(plano, periodo, pacote);
    if (!item?.id || !precoNovo || item.price?.id === precoNovo) return null;

    const params = new URLSearchParams({
      subscription: assinatura.id,
      "subscription_items[0][id]": item.id,
      "subscription_items[0][price]": precoNovo,
      subscription_proration_behavior: "create_prorations",
    });

    let previa = null;
    try {
      previa = await stripe(`/invoices/upcoming?${params}`, { method: "GET" });
    } catch {
      previa = await stripe(`/invoices/create_preview?${params}`, { method: "GET" }).catch(() => null);
    }
    if (!previa) return null;

    /* Só as linhas de PROPORCIONAL. O total da prévia inclui a mensalidade
       cheia do próximo ciclo, e anunciar isso como "o que você vai pagar a
       mais" assustaria por um valor que não tem nada a ver com a mudança. */
    const linhas = (previa.lines?.data || []).filter((l) => l.proration);
    const centavos = linhas.reduce((soma, l) => soma + (l.amount || 0), 0);
    if (!linhas.length) return null;

    return {
      /* Positivo é o que entra a mais; negativo é crédito (saída do Flow). A
         tela decide a palavra — "a mais" ou "de crédito" —, e o sinal é a
         informação. */
      valor: centavos / 100,
      credito: centavos < 0,
      quando: previa.next_payment_attempt ? new Date(previa.next_payment_attempt * 1000) : null,
    };
  } catch {
    return null;
  }
}
