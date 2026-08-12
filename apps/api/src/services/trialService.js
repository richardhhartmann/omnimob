import jwt from "jsonwebtoken";
import { getGlobalPrisma } from "./tenantRegistry.js";
import { provisionTenant, senhaTemporaria } from "./provisioningService.js";
import { sendEmail } from "./notificationService.js";
import { emailTrialExpirado } from "./emailTemplates.js";

/**
 * ─── Trial Service ───────────────────────────────────────────────────────────
 * Auto-atendimento do teste grátis: alguém preenche nome + e-mail na landing e
 * sai com um tenant funcionando, pronto para receber os imóveis dele.
 *
 * SEM IMÓVEIS DE EXEMPLO. O ambiente nasce vazio, para teste e para quem paga.
 * A vitrine de demonstração parecia hospitalidade e cobrava caro: o cliente
 * abria a própria página pública e via anúncio que não é dele, precisava fazer
 * faxina antes de usar, e corria o risco de um "Apartamento 2 quartos com
 * varanda" fictício ficar no ar para o cliente final dele. Quem entra agora
 * cadastra o primeiro imóvel — que é justamente o que o tour guiado ensina.
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
const JWT_SECRET = process.env.JWT_SECRET || "omnimob-dev-secret";

export function assinarConvite(dados, proposito = "trial") {
  return jwt.sign({ ...dados, proposito }, JWT_SECRET, { expiresIn: VALIDADE_CONVITE });
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

export const RESERVADOS = new Set([
  "admin", "api", "app", "www", "omnimob", "domus", "painel", "public", "static",
  "login", "vitrine", "suporte", "contato", "blog", "teste", "demo",
]);

// Mesmo mínimo do nome da imobiliária (trialSchema): um nome aceito no
// formulário não pode gerar um slug recusado aqui.
export const SLUG_MIN = 2;

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

/**
 * O slug deste nome está livre?
 *
 * Complementa `gerarSlugUnico` em vez de substituí-lo, e a diferença é de
 * INTENÇÃO: lá o objetivo é sempre sair com um endereço válido (colisão vira
 * "-2"), aqui é dizer um sim ou um não para quem ainda está digitando. Sufixo
 * numérico resolve o banco e estraga a marca — ninguém quer descobrir depois
 * que a vitrine dele mora em /vitrine/imobiliaria-central-3. Melhor avisar
 * enquanto o nome ainda pode mudar.
 *
 * @returns {Promise<{ slug: string, disponivel: boolean, motivo: string|null }>}
 *   motivo: "curto" | "invalido" | "reservado" | "ocupado" | null
 */
export async function verificarSlug(nome) {
  const slug = slugify(nome);
  const bruto = String(nome || "").trim();

  if (!slug) return { slug: "", disponivel: false, motivo: bruto ? "invalido" : "curto" };
  if (slug.length < SLUG_MIN) return { slug, disponivel: false, motivo: "curto" };
  if (RESERVADOS.has(slug)) return { slug, disponivel: false, motivo: "reservado" };

  const prisma = getGlobalPrisma();
  const existe = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (existe) return { slug, disponivel: false, motivo: "ocupado" };

  return { slug, disponivel: true, motivo: null };
}

/* Mensagens em um lugar só: a rota de verificação, a de criação e a landing
   precisam dizer a mesma coisa sobre o mesmo nome. */
export const MOTIVO_SLUG = {
  curto: "Nome curto demais. Use pelo menos duas letras.",
  invalido: "Use letras ou números no nome da imobiliária.",
  reservado: "Este nome é reservado pela Omnimob. Escolha outro.",
  ocupado: "Este nome já está em uso por outra imobiliária. Escolha outro.",
};

// ─── Criação do trial ────────────────────────────────────────────────────────

/**
 * Cria o tenant de teste completo e devolve as credenciais de acesso.
 *
 * Todo tenant nasce em teste — não existe mais entrada pagando de cara. O
 * parâmetro `emTeste` sumiu junto com aquele fluxo: um booleano que só recebia
 * `true` é uma bifurcação que ninguém percorre e que engana quem lê depois.
 *
 * `slugEscolhido` é o endereço que a landing conferiu e mostrou para a pessoa
 * antes de ela pedir o teste — ele vem junto no convite para o ambiente nascer
 * exatamente no endereço prometido. Entre o pedido e o clique no e-mail cabem
 * até 30 minutos, e nesse intervalo alguém pode ter levado o mesmo nome: aí, e
 * só aí, cai no sufixo numérico de `gerarSlugUnico` — um endereço com "-2" é
 * melhor que recusar um teste que já foi confirmado.
 *
 * @returns {{ tenant, login, senha, expiraEm, imoveis, aviso }}
 */
export async function criarTrial({ imobiliaria, email, telefone = "", plano = "PREMIUM", slugEscolhido = "" }) {
  const prisma = getGlobalPrisma();
  const preferido = slugEscolhido ? await verificarSlug(slugEscolhido) : null;
  const slug = preferido?.disponivel ? preferido.slug : await gerarSlugUnico(imobiliaria);
  if (slugEscolhido && slug !== slugEscolhido) {
    console.warn(`[trial] slug "${slugEscolhido}" ficou indisponível entre o convite e a confirmação; usando "${slug}".`);
  }
  const expiraEm = fimDoTrial();
  const senha = senhaTemporaria();
  const login = `admin-${slug}`.slice(0, 60);

  const { tenant, adminCreated, warning } = await provisionTenant({
    name: imobiliaria,
    slug,
    email,
    whatsapp: telefone,
    // O plano vem da escolha feita na landing e vale durante todo o teste: a
    // pessoa experimenta o que pretende contratar, não uma versão maior que ela
    // vai perder ao assinar.
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

  /* `imoveis` e `aviso` continuam no retorno, sempre zerados, porque as rotas
     que chamam isto ainda os repassam adiante. Tirá-los daqui seria mudar o
     contrato em quatro lugares de uma vez; deixá-los explícitos deixa claro
     que ninguém mais semeia nada. */
  return { tenant, login, senha, expiraEm, imoveis: 0, aviso: null };
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
    // Os campos de domínio entram aqui porque o e-mail de expiração linka a
    // vitrine, e o endereço dela depende deles.
    select: { id: true, slug: true, name: true, email: true, proximoVencimento: true, dominioProprio: true, dominioStatus: true },
  });

  const aRemover = await prisma.tenant.findMany({
    where: { statusPagamento: "TRIAL", proximoVencimento: { lt: limiteRemocao } },
    // Os campos de domínio entram aqui porque o e-mail de expiração linka a
    // vitrine, e o endereço dela depende deles.
    select: { id: true, slug: true, name: true, email: true, proximoVencimento: true, dominioProprio: true, dominioStatus: true },
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
        urlVitrine: enderecoDaVitrine(t, base),
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
