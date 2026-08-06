import jwt from "jsonwebtoken";
import { getGlobalPrisma } from "./tenantRegistry.js";
import { provisionTenant } from "./provisioningService.js";
import { sendEmail } from "./notificationService.js";
import { emailTrialExpirado } from "./emailTemplates.js";

/**
 * ─── Trial Service ───────────────────────────────────────────────────────────
 * Auto-atendimento do teste grátis: alguém preenche nome + e-mail na landing e
 * sai com um tenant funcionando, já povoado com imóveis de demonstração.
 *
 * DECISÃO CENTRAL: o trial NÃO é um ambiente à parte. Ele nasce como um tenant
 * de verdade, no mesmo lugar onde tenants pagantes vivem, e só se distingue
 * pelo `statusPagamento = TRIAL` e pela data em `proximoVencimento`. Converter
 * em cliente é virar essa chave — sem migrar dado nenhum, e sem o cliente
 * perder o que montou durante o teste. Se o teste morasse em outro banco, a
 * conversão exigiria migração justamente no momento mais sensível da relação.
 */

const DIAS_DE_TRIAL = 14;
// Depois de vencido o trial fica desativado por este tempo antes de virar
// candidato a remoção — janela para a pessoa voltar e fechar negócio.
const DIAS_ATE_REMOVER = 30;

const CARGO_ADMIN = "Administrador";

export function fimDoTrial(inicio = new Date()) {
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + DIAS_DE_TRIAL);
  return fim;
}

// ─── Convite por link mágico ─────────────────────────────────────────────────

/* O tenant só nasce depois que a pessoa clica no link que recebeu por e-mail.
   Isso prova que o endereço é dela — sem isso, qualquer um cria ambientes em
   nome de terceiros e a base enche de cadastro falso.

   O convite é um JWT assinado, não uma linha no banco: assim não há tabela
   nova (nem migração), nem lixo de convites nunca confirmados para limpar
   depois. O preço é não conseguir revogar um convite já emitido — aceitável
   para uma janela de 30 minutos. Cliques repetidos são barrados por
   `trialExistenteParaEmail`, que também serve de trava de abuso: um teste por
   e-mail. */
const VALIDADE_CONVITE = "30m";
const JWT_SECRET = process.env.JWT_SECRET || "domus-dev-secret";

export function assinarConvite(dados, proposito = "trial") {
  return jwt.sign({ ...dados, proposito }, JWT_SECRET, { expiresIn: VALIDADE_CONVITE });
}

/* Convite de quem já pagou. Vale mais tempo que o do teste: o tenant já existe
   e a cobrança já passou, então o link é só a porta de entrada — expirar em 30
   minutos deixaria um cliente pagante trancado do lado de fora. */
export function assinarConviteAcesso(dados) {
  return jwt.sign({ ...dados, proposito: "assinatura" }, JWT_SECRET, { expiresIn: "7d" });
}

/** @throws {Error} com `.code` "CONVITE_INVALIDO" | "CONVITE_EXPIRADO" */
export function lerConvite(token, proposito = "trial") {
  try {
    const dados = jwt.verify(token, JWT_SECRET);
    if (dados.proposito !== proposito) throw new Error("propósito inesperado");
    return dados;
  } catch (erro) {
    const err = new Error(
      erro.name === "TokenExpiredError"
        ? "Este link expirou. Peça um novo teste."
        : "Link inválido.",
    );
    err.code = erro.name === "TokenExpiredError" ? "CONVITE_EXPIRADO" : "CONVITE_INVALIDO";
    throw err;
  }
}

/** Um teste por e-mail: barra tanto o clique duplo quanto a criação em série. */
export async function trialExistenteParaEmail(email) {
  const prisma = getGlobalPrisma();
  return prisma.tenant.findFirst({
    where: { email, statusPagamento: "TRIAL" },
    select: { id: true, slug: true, name: true, proximoVencimento: true },
  });
}

// ─── Slug ────────────────────────────────────────────────────────────────────

const RESERVADOS = new Set([
  "admin", "api", "app", "www", "domus", "painel", "public", "static",
  "login", "vitrine", "suporte", "contato", "blog", "teste", "demo",
]);

export function slugify(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // tira acentos separados pelo NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

/**
 * Slug livre a partir do nome. Colisão ganha sufixo numérico — o nome da
 * imobiliária não é único no mundo real, então duas "Imobiliária Central"
 * precisam conviver.
 */
export async function gerarSlugUnico(nome) {
  const prisma = getGlobalPrisma();
  const base = slugify(nome) || "imobiliaria";
  const inicial = RESERVADOS.has(base) ? `${base}-imoveis` : base;

  for (let i = 0; i < 50; i += 1) {
    const tentativa = i === 0 ? inicial : `${inicial}-${i + 1}`;
    // eslint-disable-next-line no-await-in-loop
    const existe = await prisma.tenant.findUnique({ where: { slug: tentativa }, select: { id: true } });
    if (!existe) return tentativa;
  }
  return `${inicial}-${Date.now().toString(36)}`;
}

// ─── Senha temporária ────────────────────────────────────────────────────────

// Sem 0/O/1/l/I: a senha vai por e-mail e alguém vai digitar à mão.
const ALFABETO = "abcdefghjkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789";

export function senhaTemporaria(tamanho = 10) {
  let saida = "";
  for (let i = 0; i < tamanho; i += 1) {
    saida += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  }
  return saida;
}

// ─── Dados de demonstração ───────────────────────────────────────────────────

/* Sem leads de mentira: lead é contato de pessoa real, e encher a tela com
   nomes inventados confunde quem está avaliando — e ainda faz o painel prometer
   um interessado que não existe. Por isso também não populamos `leadCount` nem
   eventos de LEAD: contador sem registro por trás é pior que zero.

   Uma vitrine vazia não demonstra nada: quem entra precisa ver o produto
   funcionando em segundos, não uma tela pedindo cadastro. As fotos vivem no
   Cloudinary da própria Domus (pasta domus/demo), com f_auto/q_auto para o
   formato e a compressão saírem do provedor — o demo não depende de terceiro. */
const IMOVEIS_DEMO = [
  {
    tipo: "Apartamento",
    title: "Apartamento 2 quartos com varanda",
    description:
      "Apartamento de 78 m² com 2 quartos, sendo 1 suíte, varanda integrada à sala e 1 vaga coberta. " +
      "Prédio com portaria 24h, elevador e área de lazer completa, a poucos metros do metrô.",
    price: 420000,
    address: "Rua Direita, 250", neighborhood: "Centro", city: "São Paulo", state: "SP", cep: "01001000",
    bedrooms: 2, suites: 1, parkingSpots: 1, squareFootage: 78,
    views: 142,
    fotos: [
      "https://res.cloudinary.com/dpwuxmbli/image/upload/f_auto,q_auto,w_1600/domus/demo/demo-apto-varanda-1.jpg",
      "https://res.cloudinary.com/dpwuxmbli/image/upload/f_auto,q_auto,w_1600/domus/demo/demo-apto-varanda-2.jpg",
    ],
  },
  {
    tipo: "Casa",
    title: "Casa térrea com quintal e churrasqueira",
    description:
      "Casa térrea de 160 m² com 3 quartos, quintal espaçoso com churrasqueira e garagem coberta para 2 carros. " +
      "Rua tranquila, próxima a escolas, mercado e transporte.",
    price: 890000,
    address: "Rua dos Pinheiros, 800", neighborhood: "Pinheiros", city: "São Paulo", state: "SP", cep: "05422000",
    bedrooms: 3, suites: 1, parkingSpots: 2, squareFootage: 160,
    views: 208,
    fotos: [
      "https://res.cloudinary.com/dpwuxmbli/image/upload/f_auto,q_auto,w_1600/domus/demo/demo-casa-quintal-1.jpg",
      "https://res.cloudinary.com/dpwuxmbli/image/upload/f_auto,q_auto,w_1600/domus/demo/demo-casa-quintal-2.jpg",
    ],
  },
  {
    tipo: "Apartamento",
    title: "Cobertura duplex com vista panorâmica",
    description:
      "Cobertura duplex de 240 m² com 4 suítes, terraço com piscina privativa e vista livre. " +
      "Acabamento de alto padrão, 3 vagas e depósito.",
    price: 2450000,
    address: "Av. Brigadeiro Faria Lima, 3000", neighborhood: "Itaim Bibi", city: "São Paulo", state: "SP", cep: "04538133",
    bedrooms: 4, suites: 4, parkingSpots: 3, squareFootage: 240,
    views: 96,
    fotos: [
      "https://res.cloudinary.com/dpwuxmbli/image/upload/f_auto,q_auto,w_1600/domus/demo/demo-cobertura-1.jpg",
      "https://res.cloudinary.com/dpwuxmbli/image/upload/f_auto,q_auto,w_1600/domus/demo/demo-cobertura-2.jpg",
    ],
  },
  {
    tipo: "Apartamento",
    title: "Studio mobiliado pronto para morar",
    description:
      "Studio de 32 m² totalmente mobiliado, com cozinha integrada e prédio com coworking, lavanderia e academia. " +
      "Ideal para investimento ou primeira moradia.",
    price: 315000,
    address: "Rua Augusta, 1500", neighborhood: "Consolação", city: "São Paulo", state: "SP", cep: "01304001",
    bedrooms: 1, suites: 0, parkingSpots: 0, squareFootage: 32,
    views: 63,
    fotos: ["https://res.cloudinary.com/dpwuxmbli/image/upload/f_auto,q_auto,w_1600/domus/demo/demo-studio-1.jpg"],
  },
];


/**
 * Povoa um tenant recém-criado com imóveis, fotos e métricas de visita.
 * Best-effort: se falhar, o trial continua de pé (só mais vazio), porque um
 * erro aqui não justifica negar o acesso a quem acabou de se cadastrar.
 */
export async function semearDemonstracao(tenantId) {
  const prisma = getGlobalPrisma();
  const tipos = await prisma.tipoImovel.findMany({ select: { id: true, descricao: true } });
  const idDoTipo = (descricao) => tipos.find((t) => t.descricao === descricao)?.id ?? null;

  const criados = [];
  for (const item of IMOVEIS_DEMO) {
    // eslint-disable-next-line no-await-in-loop
    const imovel = await prisma.property.create({
      data: {
        tenantId,
        tipoImovelId: idDoTipo(item.tipo),
        propertyType: item.tipo,
        title: item.title,
        description: item.description,
        price: item.price,
        cep: item.cep,
        address: item.address,
        neighborhood: item.neighborhood,
        city: item.city,
        state: item.state,
        bedrooms: item.bedrooms,
        suites: item.suites,
        parkingSpots: item.parkingSpots,
        squareFootage: item.squareFootage,
        finalidade: "RESIDENCIAL",
        tipoContrato: "VENDA",
        status: "ACTIVE",
        viewCount: item.views,
        images: {
          create: item.fotos.map((url, i) => ({ tenantId, url, position: i })),
        },
      },
      select: { id: true },
    });
    criados.push(imovel.id);
  }

  // Métricas espalhadas nos últimos 30 dias, senão o gráfico sai como um pico
  // único no dia de hoje e não parece um histórico de verdade.
  const eventos = [];
  const agora = Date.now();
  criados.forEach((propertyId, indice) => {
    const visitas = IMOVEIS_DEMO[indice].views;
    for (let i = 0; i < visitas; i += 1) {
      eventos.push({
        tenantId, propertyId, type: "VIEW",
        createdAt: new Date(agora - Math.floor(Math.random() * 30) * 86400000),
      });
    }
  });
  await prisma.propertyMetricEvent.createMany({ data: eventos });

  return criados.length;
}

// ─── Criação do trial ────────────────────────────────────────────────────────

/**
 * Cria o tenant de teste completo e devolve as credenciais de acesso.
 * @returns {{ tenant, login, senha, expiraEm, imoveis, aviso }}
 */
export async function criarTrial({ imobiliaria, email, telefone = "", plano = "PREMIUM", emTeste = true }) {
  const prisma = getGlobalPrisma();
  const slug = await gerarSlugUnico(imobiliaria);
  // Quem já pagou não tem prazo de teste correndo contra ele.
  const expiraEm = emTeste ? fimDoTrial() : null;
  const senha = senhaTemporaria();
  const login = `admin-${slug}`.slice(0, 60);

  const { tenant, adminCreated, warning } = await provisionTenant({
    name: imobiliaria,
    slug,
    email,
    whatsapp: telefone,
    // No teste liberamos o produto inteiro; quem assina entra no plano que comprou.
    plano,
    statusPagamento: "TRIAL", // vira EM_DIA só depois da cobrança passar
    proximoVencimento: expiraEm,
    adminLogin: login,
    adminSenha: senha,
  });

  // provisionTenant não lança quando o cargo base não existe — ele avisa. Sem
  // usuário não há como entrar, então isso é falha de verdade para este fluxo.
  if (!adminCreated) {
    await prisma.tenant.delete({ where: { id: tenant.id } }).catch(() => {});
    const err = new Error(warning || `Não foi possível criar o acesso (cargo '${CARGO_ADMIN}' existe?).`);
    err.code = "SEM_ADMIN";
    throw err;
  }

  let imoveis = 0;
  let aviso = null;
  try {
    imoveis = await semearDemonstracao(tenant.id);
  } catch (erro) {
    aviso = `Tenant criado, mas o povoamento de demonstração falhou: ${erro.message}`;
    console.error("[trial] falha ao semear demonstração:", erro);
  }

  return { tenant, login, senha, expiraEm, imoveis, aviso };
}

// ─── Faxina ──────────────────────────────────────────────────────────────────

/**
 * Trials vencidos: desativa os que passaram da data e remove os que estão
 * vencidos há muito tempo. Sem isso, em alguns meses sobram milhares de tenants
 * abandonados — e, pior, com os slugs bons ocupados.
 *
 * `aplicar: false` (padrão) só relata o que seria feito. Remoção é irreversível
 * e cascateia para imóveis, fotos, leads e usuários — não é coisa para disparar
 * sem olhar antes.
 */
export async function limparTrials({ aplicar = false } = {}) {
  const prisma = getGlobalPrisma();
  const agora = new Date();
  const limiteRemocao = new Date(agora.getTime() - DIAS_ATE_REMOVER * 86400000);

  const aDesativar = await prisma.tenant.findMany({
    where: { statusPagamento: "TRIAL", ativo: true, proximoVencimento: { lt: agora } },
    select: { id: true, slug: true, name: true, email: true, proximoVencimento: true },
  });

  const aRemover = await prisma.tenant.findMany({
    where: { statusPagamento: "TRIAL", proximoVencimento: { lt: limiteRemocao } },
    select: { id: true, slug: true, name: true, email: true, proximoVencimento: true },
  });

  if (!aplicar) {
    return { aplicado: false, desativados: aDesativar, removidos: aRemover };
  }

  if (aDesativar.length) {
    await prisma.tenant.updateMany({
      where: { id: { in: aDesativar.map((t) => t.id) } },
      data: { ativo: false },
    });

    /* Avisa quem acabou de perder o acesso. Vai um a um e sem derrubar a
       faxina se um envio falhar: e-mail que não sai não pode impedir a
       limpeza de rodar. */
    const base = (process.env.APP_URL || "").replace(/\/+$/, "");
    for (const t of aDesativar) {
      if (!t.email) continue;
      const modelo = emailTrialExpirado({
        imobiliaria: t.name,
        slug: t.slug,
        diasAteRemover: DIAS_ATE_REMOVER,
        base,
      });
      // eslint-disable-next-line no-await-in-loop
      await sendEmail({
        to: t.email,
        subject: modelo.subject,
        body: modelo.body,
        html: modelo.html,
      }).catch((e) => console.error("[faxina] aviso de vencimento falhou:", e.message));
    }
  }
  if (aRemover.length) {
    await prisma.tenant.deleteMany({ where: { id: { in: aRemover.map((t) => t.id) } } });
  }

  return { aplicado: true, desativados: aDesativar, removidos: aRemover };
}

/** Converte um trial em cliente pagante. É só virar a chave. */
export async function fidelizarTrial(tenantId, { plano, valorMensal, proximoVencimento } = {}) {
  const prisma = getGlobalPrisma();
  return prisma.tenant.update({
    where: { id: tenantId },
    data: {
      statusPagamento: "EM_DIA",
      ativo: true,
      ...(plano ? { plano } : {}),
      ...(valorMensal != null && valorMensal !== "" ? { valorMensal: Number(valorMensal) } : {}),
      ...(proximoVencimento ? { proximoVencimento: new Date(proximoVencimento) } : {}),
    },
  });
}
