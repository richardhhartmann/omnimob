import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { prisma } from "../db.js";
import {
  requireSuperAdmin,
  requirePermissaoAdmin,
  permissoesDoCargo,
} from "../middlewares/superAdminMiddleware.js";
import {
  CARGO_ADMIN_PLATAFORMA,
  CHAVES_DA_PLATAFORMA,
  catalogoDePermissoes,
  ehAdministradorDaPlataforma,
  normalizarPermissoes,
} from "../services/permissoesSuperAdmin.js";
import { emailConviteSuperAdmin } from "../services/emailTemplates.js";
import { provisionTenant, senhaTemporaria } from "../services/provisioningService.js";
import { limparTrials, fidelizarTrial, verificarSlug, MOTIVO_SLUG } from "../services/trialService.js";
import {
  cancelarAssinaturasDoSlug,
  diagnosticarPagamento,
  precosDosPlanos,
  normalizarPeriodo,
  normalizarPacote,
  modulosDoPacote,
} from "../services/pagamentoService.js";
import { isEmailEnabled, sendEmail, verificarEmail } from "../services/notificationService.js";
import { registrarPagamento } from "../services/pagamentos.js";
import { diagnosticarBanco } from "../services/healthService.js";
import { cifrar, decifrar } from "../services/cofre.js";
import {
  conferir as conferirTotp,
  formatarSegredo,
  gerarCodigosDeRecuperacao,
  gerarSegredo,
  hashDeRecuperacao,
  pareceCodigoDeRecuperacao,
  uriDeProvisionamento,
} from "../services/totp.js";
import { montarSessao, impressaoDaSenha } from "./authRoutes.js";
import { CARGO_ADMIN } from "../services/cargosPadrao.js";

const JWT_SECRET = process.env.JWT_SECRET || "omnimob-dev-secret";

const STATUS_VALIDOS = ["TRIAL", "EM_DIA", "ATRASADO", "CANCELADO"];

export const adminRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Tente novamente em 15 minutos." },
});

/* ─── Login super-admin ──────────────────────────────────────────────────────

   Duas etapas quando a conta tem segundo fator, e a divisão entre elas é a
   regra inteira.

   A PRIMEIRA confere a senha e, se houver aplicativo autenticador ligado, NÃO
   devolve sessão nenhuma: devolve um DESAFIO, que é um token de cinco minutos
   sem `role` — ele não abre rota alguma, só prova que a senha já passou. Sem
   isso a tela teria de guardar a senha para reenviá-la na segunda chamada.

   A SEGUNDA troca desafio + código pela sessão de verdade.

   E as duas dividem o MESMO limitador: são a mesma tentativa de entrar, e um
   contador por rota daria ao atacante o dobro de tentativas de graça.
   ────────────────────────────────────────────────────────────────────────── */

/* As permissões vão junto para a tela desenhar o menu certo no primeiro
   quadro — mas NÃO ficam valendo por elas: o que decide é o banco, relido a
   cada requisição (`requireSuperAdmin`). A tela as reconfirma em
   `GET /api/admin/eu` ao abrir o painel. */
function sessaoDoSuperAdmin(admin) {
  const token = jwt.sign(
    { role: "SUPERADMIN", superAdminId: admin.id, email: admin.email },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
  return {
    token,
    id: admin.id,
    email: admin.email,
    nome: admin.nome,
    cargo: admin.cargo?.nome || null,
    cargoId: admin.cargoId ?? null,
    permissoes: permissoesDoCargo(admin.cargo),
  };
}

/* ─── O convite: link de uso único para definir a senha ──────────────────────

   É o MESMO mecanismo do "esqueci a senha" do Hub (`authRoutes`): um JWT com
   o id e a impressão digital da senha atual. Numa conta recém-criada a senha é
   vazia; definir a senha muda a impressão e o link deixa de valer — uso único
   sem tabela e sem revogação para lembrar.

   O propósito é próprio: um token de recuperação de usuário do Hub não pode
   abrir esta porta, nem o contrário.
   ────────────────────────────────────────────────────────────────────────── */
const PROPOSITO_CONVITE = "convite-super-admin";
const VALIDADE_CONVITE = "24h";

function assinarConvite(admin) {
  return jwt.sign(
    { superAdminId: admin.id, proposito: PROPOSITO_CONVITE, fp: impressaoDaSenha(admin.senha) },
    JWT_SECRET,
    { expiresIn: VALIDADE_CONVITE },
  );
}

/** Devolve o super-admin do convite, ou lança com `.code`. */
async function superAdminDoConvite(token) {
  let dados;
  try {
    dados = jwt.verify(String(token || ""), JWT_SECRET);
  } catch (erro) {
    const expirou = erro.name === "TokenExpiredError";
    const e = new Error(expirou ? "Este convite expirou. Peça um novo." : "Convite inválido.");
    e.code = expirou ? "TOKEN_EXPIRADO" : "TOKEN_INVALIDO";
    throw e;
  }
  if (dados.proposito !== PROPOSITO_CONVITE) {
    const e = new Error("Convite inválido.");
    e.code = "TOKEN_INVALIDO";
    throw e;
  }
  const admin = await prisma.superAdmin.findUnique({
    where: { id: String(dados.superAdminId || "") },
    include: { cargo: true },
  });
  if (!admin || !admin.ativo) {
    const e = new Error("Convite inválido.");
    e.code = "TOKEN_INVALIDO";
    throw e;
  }
  if (dados.fp !== impressaoDaSenha(admin.senha)) {
    const e = new Error("Este convite já foi usado. Peça um novo.");
    e.code = "TOKEN_USADO";
    throw e;
  }
  return admin;
}

/* Monta e envia o e-mail do convite. Devolve o que a tela precisa saber:
   se foi enviado e, quando não há transporte de e-mail (ambiente de dev), o
   próprio link — senão não haveria como concluir o cadastro localmente. Com
   e-mail configurado o link NUNCA volta na resposta: quem cria a conta não
   deve ter como escolher a senha da outra pessoa. */
async function enviarConvite(admin, { convidadoPor }) {
  const token = assinarConvite(admin);
  const base = (process.env.APP_URL || "").trim().replace(/\/+$/, "") || "https://omnimob.app";
  const link = `${base}/admin/definir-senha?token=${encodeURIComponent(token)}`;

  if (!isEmailEnabled()) {
    console.warn(`[admin/convite] sem transporte de e-mail; link para ${admin.email}: ${link}`);
    return { enviado: false, link };
  }

  const modelo = emailConviteSuperAdmin({
    nome: admin.nome,
    link,
    convidadoPor,
    cargo: admin.cargo?.nome || "",
  });
  /* Não aguardado: o transporte tem teto de 10 s, e prender a criação do
     usuário por isso deixaria a tela travada. Falha vai para o log. */
  sendEmail({ to: admin.email, subject: modelo.subject, body: modelo.body, html: modelo.html })
    .catch((e) => console.error("[admin/convite] falha ao enviar:", e.message));
  return { enviado: true, link: null };
}

/* Confere o segundo fator, seja o código do aplicativo ou um de recuperação, e
   devolve o que precisa ser GRAVADO por causa dele — o passo consumido ou o
   código de recuperação queimado. Quem chama grava; assim a regra de "usar
   consome" mora num lugar só e não depende de cada rota lembrar dela. */
function conferirSegundoFator(admin, codigo) {
  if (!admin.totpSegredo) return { ok: false };

  if (pareceCodigoDeRecuperacao(codigo)) {
    let hashes = [];
    try { hashes = JSON.parse(admin.totpRecuperacao || "[]"); } catch { hashes = []; }
    const alvo = hashDeRecuperacao(codigo);
    if (!hashes.includes(alvo)) return { ok: false };
    // Uso único: o código sai da lista no mesmo passo em que é aceito.
    const restantes = hashes.filter((h) => h !== alvo);
    return { ok: true, recuperacao: true, dados: { totpRecuperacao: JSON.stringify(restantes) }, restantes: restantes.length };
  }

  const { ok, passo } = conferirTotp(decifrar(admin.totpSegredo), codigo, { depoisDe: admin.totpUltimoPasso });
  if (!ok) return { ok: false };
  return { ok: true, recuperacao: false, dados: { totpUltimoPasso: passo } };
}

adminRouter.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, senha } = req.body || {};
    if (!email || !senha) return res.status(400).json({ error: "Email e senha sao obrigatorios." });

    const admin = await prisma.superAdmin.findUnique({ where: { email }, include: { cargo: true } });
    if (!admin || !admin.ativo) return res.status(401).json({ error: "Credenciais invalidas." });

    /* Conta convidada que ainda não definiu senha tem `senha` vazia. O
       `compare` já recusaria; a conferência explícita evita passar uma string
       vazia ao bcrypt — e deixa dito que este estado existe. */
    const ok = admin.senha ? await bcrypt.compare(senha, admin.senha) : false;
    if (!ok) return res.status(401).json({ error: "Credenciais invalidas." });

    if (admin.totpAtivadoEm) {
      const desafio = jwt.sign({ etapa: "totp", superAdminId: admin.id }, JWT_SECRET, { expiresIn: "5m" });
      return res.json({ precisaTotp: true, desafio });
    }

    return res.json(sessaoDoSuperAdmin(admin));
  } catch (err) {
    console.error("[POST /admin/login]", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});

adminRouter.post("/login/totp", loginLimiter, async (req, res) => {
  try {
    const { desafio, codigo } = req.body || {};
    if (!desafio || !codigo) return res.status(400).json({ error: "Desafio e codigo sao obrigatorios." });

    let payload;
    try {
      payload = jwt.verify(desafio, JWT_SECRET);
    } catch {
      /* Código próprio: a tela precisa distinguir "o código está errado" (tente
         de novo) de "o desafio venceu" (volte e digite a senha). Sem isso a
         pessoa fica batendo num campo que não vai mais aceitar nada. */
      return res.status(401).json({ error: "Sua sessao de login expirou. Entre novamente.", code: "DESAFIO_EXPIRADO" });
    }
    // O desafio não é sessão: ele não carrega `role`, e esta é a única rota que
    // o aceita.
    if (payload.etapa !== "totp" || !payload.superAdminId) {
      return res.status(401).json({ error: "Desafio invalido.", code: "DESAFIO_EXPIRADO" });
    }

    const admin = await prisma.superAdmin.findUnique({ where: { id: payload.superAdminId }, include: { cargo: true } });
    if (!admin || !admin.ativo || !admin.totpAtivadoEm) return res.status(401).json({ error: "Credenciais invalidas." });

    const conferido = conferirSegundoFator(admin, codigo);
    if (!conferido.ok) return res.status(401).json({ error: "Codigo invalido ou ja usado." });

    await prisma.superAdmin.update({ where: { id: admin.id }, data: conferido.dados });

    const sessao = sessaoDoSuperAdmin(admin);
    /* Quem entrou com código de recuperação precisa saber quantos sobraram — é
       a única hora em que ele olha para isso, e chegar a zero sem aviso é
       ficar trancado do lado de fora. */
    if (conferido.recuperacao) {
      sessao.recuperacaoUsada = true;
      sessao.recuperacaoRestantes = conferido.restantes;
    }
    return res.json(sessao);
  } catch (err) {
    console.error("[POST /admin/login/totp]", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});

/* ── O convite, do lado de quem o recebe ─────────────────────────────────────
   Públicas por natureza: quem está definindo a senha ainda não tem sessão.
   Montadas ANTES do `requireSuperAdmin`, senão ele as engoliria. */

/* Confere o link ANTES de a pessoa digitar a senha — o mesmo motivo do
   `GET /auth/redefinir-senha/:token`. */
adminRouter.get("/convite/:token", async (req, res) => {
  try {
    const admin = await superAdminDoConvite(req.params.token);
    return res.json({ valido: true, nome: admin.nome, email: admin.email, cargo: admin.cargo?.nome || null });
  } catch (err) {
    return res.status(400).json({ valido: false, error: err.message, code: err.code });
  }
});

adminRouter.post("/convite", loginLimiter, async (req, res) => {
  try {
    const { token, novaSenha } = req.body || {};
    if (String(novaSenha || "").length < 8) {
      return res.status(400).json({ error: "A senha deve ter ao menos 8 caracteres." });
    }
    const admin = await superAdminDoConvite(token);
    const atualizado = await prisma.superAdmin.update({
      where: { id: admin.id },
      data: { senha: await bcrypt.hash(String(novaSenha), 10) },
      include: { cargo: true },
    });
    // Já devolve a sessão: quem definiu a senha entra direto.
    return res.json(sessaoDoSuperAdmin(atualizado));
  } catch (err) {
    if (err.code) return res.status(400).json({ error: err.message, code: err.code });
    console.error("[POST /admin/convite]", err);
    return res.status(500).json({ error: "Erro ao definir a senha." });
  }
});

// Tudo abaixo exige super-admin.
adminRouter.use(requireSuperAdmin);

/* Quem sou e o que alcanço — relido do banco pelo middleware. A tela chama ao
   abrir o painel, e é isto que faz um rebaixamento aparecer na requisição
   seguinte em vez de daqui a sete dias. */
adminRouter.get("/eu", (req, res) => {
  const { id, nome, email, cargoId, cargoNome, permissoes } = req.superAdmin;
  return res.json({ id, nome, email, cargoId, cargo: cargoNome, permissoes, catalogo: catalogoDePermissoes() });
});

/* ─── Segundo fator: ligar, conferir e desligar ───────────────────────────────

   As três rotas exigem estar logado, e isso é a regra de segurança: o segundo
   fator nasce de quem JÁ PROVOU ser aquela conta. É o mesmo desenho do vínculo
   com o Google em `authRoutes` — vincular exige sessão, entrar só procura.
   ────────────────────────────────────────────────────────────────────────── */

async function superAdminDaSessao(req) {
  return prisma.superAdmin.findUnique({ where: { id: req.superAdmin.id } });
}

function situacaoDoSegundoFator(admin) {
  let restantes = 0;
  try { restantes = JSON.parse(admin.totpRecuperacao || "[]").length; } catch { restantes = 0; }
  return {
    ativo: Boolean(admin.totpAtivadoEm),
    // Chave gerada mas ainda não confirmada: a tela precisa oferecer "continuar".
    pendente: Boolean(admin.totpSegredo && !admin.totpAtivadoEm),
    ativadoEm: admin.totpAtivadoEm,
    codigosRestantes: restantes,
  };
}

adminRouter.get("/totp", requirePermissaoAdmin("verSeguranca"), async (req, res) => {
  try {
    const admin = await superAdminDaSessao(req);
    if (!admin) return res.status(404).json({ error: "Conta nao encontrada." });
    return res.json(situacaoDoSegundoFator(admin));
  } catch (err) {
    console.error("[GET /admin/totp]", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});

/* Gera a chave e a guarda cifrada, SEM ativar. Chamar de novo antes de
   confirmar descarta a anterior — quem começou o cadastro, errou o aplicativo e
   recomeçou não fica preso a uma chave que o celular dele não tem. */
adminRouter.post("/totp/iniciar", requirePermissaoAdmin("verSeguranca"), async (req, res) => {
  try {
    const admin = await superAdminDaSessao(req);
    if (!admin) return res.status(404).json({ error: "Conta nao encontrada." });
    if (admin.totpAtivadoEm) {
      return res.status(409).json({ error: "O segundo fator ja esta ativo. Desative antes de cadastrar outro aplicativo." });
    }

    const segredo = gerarSegredo();
    await prisma.superAdmin.update({
      where: { id: admin.id },
      data: { totpSegredo: cifrar(segredo), totpUltimoPasso: null },
    });

    /* O texto do segredo sai daqui UMA vez. Depois disto ele só existe cifrado,
       e nem esta rota o devolve de novo: quem perdeu o meio do caminho começa
       outro. */
    return res.json({
      segredo,
      segredoFormatado: formatarSegredo(segredo),
      uri: uriDeProvisionamento({ segredo, conta: admin.email }),
    });
  } catch (err) {
    console.error("[POST /admin/totp/iniciar]", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});

/* Só o código do aplicativo prova que a chave chegou lá. Ativar sem essa prova
   é a forma exata de se trancar para fora: o login passaria a exigir um código
   que nenhum aplicativo consegue gerar. */
adminRouter.post("/totp/confirmar", requirePermissaoAdmin("verSeguranca"), async (req, res) => {
  try {
    const { codigo } = req.body || {};
    const admin = await superAdminDaSessao(req);
    if (!admin) return res.status(404).json({ error: "Conta nao encontrada." });
    if (admin.totpAtivadoEm) return res.status(409).json({ error: "O segundo fator ja esta ativo." });
    if (!admin.totpSegredo) return res.status(400).json({ error: "Nenhum cadastro em andamento. Comece de novo." });

    const { ok, passo } = conferirTotp(decifrar(admin.totpSegredo), codigo);
    if (!ok) return res.status(400).json({ error: "Codigo invalido. Confira o relogio do celular e tente o proximo." });

    const { textos, hashes } = gerarCodigosDeRecuperacao();
    await prisma.superAdmin.update({
      where: { id: admin.id },
      data: { totpAtivadoEm: new Date(), totpUltimoPasso: passo, totpRecuperacao: JSON.stringify(hashes) },
    });

    // Os textos aparecem aqui e nunca mais: o banco só guarda o hash.
    return res.json({ ativo: true, codigos: textos });
  } catch (err) {
    console.error("[POST /admin/totp/confirmar]", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});

/* Desligar exige a senha E um código válido. Só a senha não serviria: senha nas
   mãos erradas é exatamente o que o segundo fator existe para conter, e uma
   rota que o desliga com ela o anula por completo. */
adminRouter.delete("/totp", requirePermissaoAdmin("verSeguranca"), async (req, res) => {
  try {
    const { senha, codigo } = req.body || {};
    const admin = await superAdminDaSessao(req);
    if (!admin) return res.status(404).json({ error: "Conta nao encontrada." });
    if (!admin.totpAtivadoEm) return res.status(400).json({ error: "O segundo fator nao esta ativo." });
    if (!senha || !codigo) return res.status(400).json({ error: "Senha e codigo sao obrigatorios." });

    if (!(await bcrypt.compare(senha, admin.senha))) {
      return res.status(401).json({ error: "Senha incorreta." });
    }
    if (!conferirSegundoFator(admin, codigo).ok) {
      return res.status(401).json({ error: "Codigo invalido ou ja usado." });
    }

    await prisma.superAdmin.update({
      where: { id: admin.id },
      data: { totpSegredo: null, totpAtivadoEm: null, totpUltimoPasso: null, totpRecuperacao: null },
    });
    return res.json({ ativo: false });
  } catch (err) {
    console.error("[DELETE /admin/totp]", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});

/* Diagnóstico do envio de e-mail: conecta e autentica no provedor, sem enviar
   mensagem nenhuma. Fica atrás do super-admin porque a resposta revela o
   transporte e o host — informação de infraestrutura, não de produto.

   Serve para responder de fora "este servidor consegue enviar e-mail?", que era
   pergunta impossível: o fluxo do teste grátis trata a falha em silêncio, então
   só se descobria cadastrando alguém e conferindo a caixa de entrada. */
/* `?porta=587&seguro=false` testa uma porta alternativa sem mudar variável de
   ambiente nem esperar redeploy — o host segue sendo o configurado. */
adminRouter.get("/diagnostico/email", requirePermissaoAdmin("verSeguranca"), async (req, res) => {
  const porta = req.query.porta !== undefined ? Number(req.query.porta) : undefined;
  const seguro = req.query.seguro !== undefined ? req.query.seguro !== "false" : undefined;
  if (porta !== undefined && !Number.isInteger(porta)) {
    return res.status(400).json({ error: "Porta inválida." });
  }
  const r = await verificarEmail({ porta, seguro });
  return res.status(r.ok ? 200 : 503).json(r);
});

/* Onde o tempo do banco é gasto, medido de dentro do servidor. Serve para
   decidir entre "mudar de região" e "mexer na conexão" com número em vez de
   palpite — ver o comentário de `diagnosticarBanco`. */
adminRouter.get("/diagnostico/banco", requirePermissaoAdmin("verSeguranca"), async (req, res) => {
  const amostras = Math.min(Number(req.query.amostras) || 5, 15);
  return res.json(await diagnosticarBanco({ amostras }));
});

/* Cobrança: modo da chave e se cada preço existe de fato na conta dela. O
   `No such price` do Stripe não distingue "não existe" de "existe em outra
   conta", e é sempre o segundo. */
adminRouter.get("/diagnostico/stripe", requirePermissaoAdmin("verSeguranca"), async (_req, res) => {
  const r = await diagnosticarPagamento();
  const todosOk = r.configurado && Object.values(r.planos || {}).every((p) => p.ok);
  return res.status(todosOk ? 200 : 503).json(r);
});

function serializeTenant(t) {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    email: t.email,
    whatsapp: t.whatsapp,
    cnpj: t.cnpj,
    creci: t.creci,
    cidade: t.cidade,
    estado: t.estado,
    ativo: t.ativo,
    plano: t.plano,
    modulos: t.modulos?.length ? t.modulos : ["HUB"],
    statusPagamento: t.statusPagamento,
    proximoVencimento: t.proximoVencimento,
    valorMensal: t.valorMensal != null ? Number(t.valorMensal) : null,
    createdAt: t.createdAt,
    usuarios: t._count?.usuarios ?? 0,
    properties: t._count?.properties ?? 0,
  };
}

const withCount = { _count: { select: { usuarios: true, properties: true } } };

adminRouter.get("/tenants", requirePermissaoAdmin("verTenants"), async (_req, res) => {
  try {
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: withCount,
    });
    res.json(tenants.map(serializeTenant));
  } catch (err) {
    console.error("[GET /admin/tenants]", err);
    res.status(500).json({ error: "Erro ao listar tenants." });
  }
});

adminRouter.get("/tenants/:id", requirePermissaoAdmin("verTenants"), async (req, res) => {
  try {
    const t = await prisma.tenant.findUnique({ where: { id: req.params.id }, include: withCount });
    if (!t) return res.status(404).json({ error: "Tenant nao encontrado." });
    res.json(serializeTenant(t));
  } catch (err) {
    console.error("[GET /admin/tenants/:id]", err);
    res.status(500).json({ error: "Erro ao buscar tenant." });
  }
});

/* Provisionamento à mão, pelo painel da Omnimob. O endereço da vitrine não é
   digitado: ele sai do nome, pela mesma regra do auto-atendimento da landing —
   duas portas de entrada que compusessem o slug de formas diferentes dariam
   endereços diferentes para o mesmo nome. O painel mostra o endereço enquanto
   se digita; esta conferência é a que vale.

   O acesso inicial também nasce aqui, e não é mais opcional: um tenant sem
   usuário é um ambiente onde ninguém entra. As credenciais voltam na resposta
   porque é a única vez em que a senha existe em texto — depois disto só há o
   hash, e ela vale só até o primeiro acesso, que obriga a troca. */
/* Os módulos que o comercial pode entregar. Lista fechada aqui e não um
   passe-livre para o que o cliente mandar: `modulos` decide o que a conta paga,
   e uma string desconhecida gravada no array viraria um módulo fantasma que
   nenhuma tela reconhece. */
const MODULOS_VALIDOS = ["HUB", "FLOW"];
function modulosDoCorpo(body) {
  if (!Array.isArray(body?.modulos)) return null;
  const limpos = [...new Set(body.modulos.filter((m) => MODULOS_VALIDOS.includes(m)))];
  /* O HUB entra sempre: é onde o cadastro vive, e uma conta só-Flow criada por
     engano no painel seria uma imobiliária sem lugar para cadastrar imóvel. */
  return limpos.includes("HUB") ? limpos : ["HUB", ...limpos];
}

adminRouter.post("/tenants", requirePermissaoAdmin("editarTenant"), async (req, res) => {
  try {
    const body = req.body || {};
    const nome = String(body.name || "").trim();

    const endereco = await verificarSlug(nome);
    if (!endereco.disponivel) {
      return res.status(endereco.motivo === "ocupado" ? 409 : 400).json({
        error: MOTIVO_SLUG[endereco.motivo] || "Escolha outro nome para a imobiliária.",
        motivo: endereco.motivo,
      });
    }

    const { tenant, adminCreated, adminLogin, adminSenha, warning } = await provisionTenant({
      ...body,
      name: nome,
      slug: endereco.slug,
      modulos: modulosDoCorpo(body),
    });
    res.status(201).json({
      id: tenant.id,
      slug: tenant.slug,
      warning,
      admin: adminCreated ? { login: adminLogin, senha: adminSenha } : null,
    });
  } catch (err) {
    if (err.code === "SLUG_INVALIDO") return res.status(400).json({ error: err.message });
    if (err.code === "SLUG_EM_USO") return res.status(409).json({ error: err.message });
    console.error("[POST /admin/tenants]", err);
    res.status(500).json({ error: "Erro ao criar tenant.", detail: err.message });
  }
});

adminRouter.put("/tenants/:id", requirePermissaoAdmin("editarTenant"), async (req, res) => {
  try {
    const b = req.body || {};
    const data = {};
    for (const k of ["name", "email", "whatsapp", "cnpj", "creci", "cidade", "estado", "plano"]) {
      if (k in b) data[k] = b[k];
    }
    if ("ativo" in b) data.ativo = Boolean(b.ativo);
    /* Tirar o Flow de uma conta NÃO apaga nada: os negócios, contratos e
       comissões continuam no banco. O que some é o acesso — e é o certo, porque
       quem volta a contratar espera reencontrar o que deixou. */
    const modulos = modulosDoCorpo(b);
    if (modulos) data.modulos = modulos;
    if ("statusPagamento" in b && STATUS_VALIDOS.includes(b.statusPagamento)) data.statusPagamento = b.statusPagamento;
    if ("valorMensal" in b) data.valorMensal = b.valorMensal === "" || b.valorMensal == null ? null : Number(b.valorMensal);
    if ("proximoVencimento" in b) data.proximoVencimento = b.proximoVencimento ? new Date(b.proximoVencimento) : null;

    const t = await prisma.tenant.update({ where: { id: req.params.id }, data });
    res.json({ id: t.id });
  } catch (err) {
    console.error("[PUT /admin/tenants/:id]", err);
    res.status(500).json({ error: "Erro ao atualizar tenant.", detail: err.message });
  }
});

/* Excluir o tenant é excluir também a cobrança dele.

   A ORDEM IMPORTA: cancela no Stripe ANTES de apagar a linha. Depois de
   `tenant.delete()` o slug já não existe, e o slug é justamente a chave que
   casa a assinatura lá (fica em `metadata.slug`) — invertendo, sobraria uma
   assinatura ativa cobrando todo mês por um ambiente que não existe mais, e
   sem nada no nosso lado apontando para ela.

   Falha no Stripe NÃO impede a exclusão: o pedido do administrador é apagar o
   tenant, e travar isso porque uma API de terceiro caiu deixaria o painel
   refém. O que sobra vai no corpo da resposta (`stripe`), para a tela poder
   avisar que aquela assinatura precisa de um cancelamento manual — silenciar
   seria pior que falhar. */
adminRouter.delete("/tenants/:id", requirePermissaoAdmin("excluirTenant"), async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      select: { id: true, slug: true },
    });
    if (!tenant) return res.status(404).json({ error: "Tenant não encontrado." });

    let stripeResultado = { configurado: false, encontradas: 0, canceladas: [], falhas: [] };
    try {
      stripeResultado = await cancelarAssinaturasDoSlug(tenant.slug);
    } catch (erro) {
      console.error(`[DELETE /admin/tenants] Stripe falhou para "${tenant.slug}":`, erro.message);
      stripeResultado = { configurado: true, encontradas: null, canceladas: [], falhas: [{ motivo: erro.message }] };
    }

    await prisma.tenant.delete({ where: { id: tenant.id } });

    return res.json({
      excluido: true,
      slug: tenant.slug,
      stripe: stripeResultado,
    });
  } catch (err) {
    console.error("[DELETE /admin/tenants/:id]", err);
    res.status(500).json({ error: "Erro ao excluir tenant.", detail: err.message });
  }
});

/* ── Trials ──────────────────────────────────────────────────────────────────
   Faxina dos testes vencidos. O padrão é ENSAIO: só relata o que seria feito.
   A remoção é irreversível e cascateia para imóveis, fotos, leads e usuários,
   então exige `aplicar: true` explícito no corpo. Enquanto não houver agendador
   no projeto, isto é chamado à mão — e depois é só pendurar num cron. */
adminRouter.post("/trials/faxina", requirePermissaoAdmin("excluirTenant"), async (req, res) => {
  try {
    const aplicar = req.body?.aplicar === true;
    const resultado = await limparTrials({ aplicar });
    res.json({
      aplicado: resultado.aplicado,
      totalDesativados: resultado.desativados.length,
      totalRemovidos: resultado.removidos.length,
      desativados: resultado.desativados,
      removidos: resultado.removidos,
    });
  } catch (err) {
    console.error("[POST /admin/trials/faxina]", err);
    res.status(500).json({ error: "Erro na faxina de trials.", detail: err.message });
  }
});

/* ── Chamados ────────────────────────────────────────────────────────────────
   A caixa de entrada do suporte. Diferente do lado da imobiliária, aqui vêm
   TODOS os tenants — é a tela em que se decide o que atender primeiro.

   A ordenação é por não-resolvido primeiro e depois por data: prioridade alta
   de um chamado já fechado não pode empurrar para baixo uma dúvida aberta. */
adminRouter.get("/chamados", requirePermissaoAdmin("verChamados"), async (req, res) => {
  try {
    const { resolvido, tenantId } = req.query;
    const where = {};
    if (resolvido === "true") where.resolvido = true;
    if (resolvido === "false") where.resolvido = false;
    if (tenantId) where.tenantId = String(tenantId);

    const chamados = await prisma.chamado.findMany({
      where,
      orderBy: [{ resolvido: "asc" }, { criadoEm: "desc" }],
      take: 300,
      include: { tenant: { select: { name: true, slug: true, plano: true } } },
    });

    res.json(
      chamados.map((c) => ({
        numero: c.numero,
        titulo: c.titulo,
        descricao: c.descricao,
        categoria: c.categoria,
        prioridade: c.prioridade,
        resolvido: c.resolvido,
        resolvidoEm: c.resolvidoEm,
        prints: c.prints,
        rota: c.rota,
        criadoEm: c.criadoEm,
        usuario: c.usuarioNome || "—",
        tenantId: c.tenantId,
        tenantNome: c.tenant?.name || "—",
        tenantSlug: c.tenant?.slug || "",
        // O plano ATUAL do tenant. A prioridade gravada no chamado já embute o
        // plano de quando ele foi aberto (ver prioridadeComPlano em
        // chamadoRoutes); isto aqui é para a tela poder mostrar de quem é.
        tenantPlano: c.tenant?.plano || "BASICO",
      })),
    );
  } catch (err) {
    console.error("[GET /admin/chamados]", err);
    res.status(500).json({ error: "Erro ao listar chamados." });
  }
});

/* Marcar resolvido e/ou repriorizar. `resolvidoEm` é derivado, nunca recebido:
   é o servidor que sabe quando o clique aconteceu, e deixar a data vir do
   cliente permitiria um histórico que não bate com os fatos. */
adminRouter.patch("/chamados/:numero", requirePermissaoAdmin("resolverChamado"), async (req, res) => {
  const numero = Number(req.params.numero);
  if (!Number.isInteger(numero)) return res.status(400).json({ error: "Número inválido." });

  try {
    const data = {};
    if ("resolvido" in (req.body || {})) {
      data.resolvido = Boolean(req.body.resolvido);
      data.resolvidoEm = data.resolvido ? new Date() : null;
    }
    if (req.body?.prioridade && ["BAIXA", "MEDIA", "ALTA", "URGENTE"].includes(req.body.prioridade)) {
      data.prioridade = req.body.prioridade;
    }
    if (!Object.keys(data).length) return res.status(400).json({ error: "Nada para atualizar." });

    const c = await prisma.chamado.update({ where: { numero }, data });
    res.json({ numero: c.numero, resolvido: c.resolvido, prioridade: c.prioridade, resolvidoEm: c.resolvidoEm });
  } catch (err) {
    console.error("[PATCH /admin/chamados/:numero]", err);
    res.status(500).json({ error: "Erro ao atualizar o chamado." });
  }
});

/* ── Progresso dos tutoriais ─────────────────────────────────────────────────
   Devolve o PROGRESSO BRUTO, por usuário: as etapas registradas e o status de
   cada uma. Quem transforma isso em porcentagem é a tela.

   Isso não é preguiça — é onde a informação existe. O denominador (quantas
   etapas ESTE usuário deveria ver) depende do fluxo declarado em
   `utils/tourFluxo.js` e das permissões do cargo dele, e o fluxo mora no front
   justamente porque depende das rotas do painel. Calcular a porcentagem aqui
   exigiria uma segunda cópia dessa lista, fadada a divergir da primeira no dia
   em que uma etapa nova entrar. Por isso mandamos junto o cargo inteiro: é o
   que a tela precisa para montar o fluxo daquele usuário. */
adminRouter.get("/tutoriais", requirePermissaoAdmin("verTutoriais"), async (_req, res) => {
  try {
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        usuarios: {
          where: { ativo: true },
          orderBy: { nome: "asc" },
          select: {
            id: true,
            nome: true,
            login: true,
            cargo: true,
            tutorial: { select: { etapa: true, status: true, passoParou: true, totalPassos: true, atualizadoEm: true } },
          },
        },
      },
    });

    res.json(
      tenants.map((t) => ({
        id: t.id,
        nome: t.name,
        slug: t.slug,
        usuarios: t.usuarios.map((u) => ({
          id: u.id,
          nome: u.nome,
          login: u.login,
          cargo: u.cargo,
          etapas: u.tutorial,
        })),
      })),
    );
  } catch (err) {
    console.error("[GET /admin/tutoriais]", err);
    res.status(500).json({ error: "Erro ao carregar o progresso dos tutoriais." });
  }
});

// Converte um teste em cliente pagante. Nenhum dado se move: o tenant já vive
// no lugar definitivo desde que nasceu.
/* ────────────────────────────────────────────────────────────────────────────
   ENTRAR NUMA IMOBILIÁRIA COMO O ADMINISTRADOR DELA.

   O suporte precisa disto: "não consigo publicar" é impossível de responder
   sem ver a tela que a pessoa está vendo, e pedir a senha do cliente é a
   alternativa que existia — a pior possível, porque a senha depois continua
   com quem pediu.

   ── AS TRÊS TRAVAS ──

   1. SÓ SUPER-ADMIN COM A PERMISSÃO. `adminRouter.use(requireSuperAdmin)`
      cobre esta rota como cobre as outras, e `entrarNoTenant` é uma permissão
      própria: um cargo "Suporte" vê a lista de tenants e não entra em conta
      nenhuma. Não há caminho para um usuário comum chegar aqui.

   2. SESSÃO CURTA. Duas horas, e não os sete dias de um login normal. Entrar
      na conta de um cliente é uma visita, não uma mudança: um token de sete
      dias vira acesso permanente esquecido num navegador.

   3. FICA REGISTRADO NA TRILHA DA IMOBILIÁRIA — e é a trava que mais importa.
      Quem administra a conta vê, em Registro de Atividade, que a Omnimob
      entrou, quando e quem. Sem isso o recurso é uma porta dos fundos; com
      isso é uma visita anunciada.

      A escrita é EXPLÍCITA e não pela extensão do Prisma: a extensão registra
      quem a requisição diz ser, e aqui não há usuário do tenant fazendo nada —
      o ator é externo à imobiliária. A trilha precisa dizer isso com todas as
      letras.

   ── O QUE ELA NÃO FAZ ──

   Não cria usuário, não muda senha, não altera permissão. Devolve uma sessão
   para um Administrador que JÁ existe e está ativo. Se não houver nenhum, o
   pedido falha em vez de inventar um — criar um administrador escondido numa
   conta de cliente é exatamente o tipo de coisa que ninguém deveria conseguir
   fazer a partir de um botão.
   ──────────────────────────────────────────────────────────────────────────── */
adminRouter.post("/tenants/:id/entrar", requirePermissaoAdmin("entrarNoTenant"), async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, slug: true, ativo: true },
    });
    if (!tenant) return res.status(404).json({ error: "Imobiliária não encontrada." });

    /* Conta desativada não abre. O painel de uma conta desligada não é uma
       tela de suporte: metade dele responde erro, e o que se aprende ali sobre
       o problema do cliente é nada. */
    if (!tenant.ativo) {
      return res.status(400).json({ error: "Esta imobiliária está desativada. Reative antes de entrar." });
    }

    /* O Administrador ATIVO da casa. `findFirst` com o tenant junto — a mesma
       regra de todo o resto: id sozinho alcança linha de outra imobiliária. */
    const usuario = await prisma.usuario.findFirst({
      where: { tenantId: tenant.id, ativo: true, cargo: { descricao: CARGO_ADMIN } },
      orderBy: { createdAt: "asc" },
      include: { tenant: true, cargo: true },
    });

    if (!usuario) {
      return res.status(409).json({
        error: `${tenant.name} não tem nenhum Administrador ativo. Ative um usuário com esse cargo antes de entrar.`,
      });
    }

    /* ── O ADMINISTRADOR QUE AINDA NÃO TEM SENHA ────────────────────────────

       Imobiliária recém-provisionada nasce com uma senha TEMPORÁRIA e
       `forcaAlterarSenha`. O login normal recusa entrar nesse estado: devolve
       403 com `forcaAlterarSenha` e manda definir a senha antes.

       Este atalho não passava por lá, e o estrago era duplo:

       1. SEGURANÇA. A exigência de trocar a senha temporária existe justamente
          porque ela viajou por e-mail e apareceu num modal. Entrar por aqui
          pulava a exigência inteira e deixava a conta rodando com ela.

       2. A SENHA SE PERDIA. Ela é mostrada UMA vez, na criação. Quem fechasse
          aquele modal e clicasse em "Entrar" ficava dentro da conta e sem a
          senha — e o cliente, do lado de fora, sem nenhuma forma de entrar.

       A resposta não é uma sessão: é o recado de que falta definir a senha.
       Quem chamou leva a pessoa para a tela que define — que é o mesmo lugar
       onde o login normal a colocaria. Sem sessão nenhuma emitida aqui: uma
       sessão "só para definir senha" seria uma quarta forma de entrar, e as
       três que existem já dão trabalho suficiente. */
    if (!usuario.senha || usuario.forcaAlterarSenha) {
      return res.status(409).json({
        error:
          `${tenant.name} ainda não definiu a senha do Administrador. ` +
          "Abra a tela de acesso para criá-la — a senha temporária vale só até isso acontecer.",
        precisaDefinirSenha: true,
        login: usuario.login,
        tenantSlug: tenant.slug,
      });
    }

    const quem = req.superAdmin?.email || req.superAdmin?.nome || "super-admin";

    /* Antes de devolver a sessão, e não depois: se a gravação da trilha falhar,
       o acesso NÃO acontece. É o oposto do padrão do resto do sistema (onde a
       auditoria nunca derruba a operação), e a inversão é deliberada — aqui a
       trilha não é o registro de uma ação, ela é a condição que torna a ação
       aceitável. */
    await prisma.auditoria.create({
      data: {
        tenantId: tenant.id,
        usuarioId: usuario.id,
        usuarioNome: `Omnimob (${quem})`,
        acao: "ACESSO_SUPORTE",
        entidade: "Sessao",
        entidadeId: usuario.id,
        resumo: `A equipe da Omnimob entrou nesta conta como ${usuario.nome}.`,
        dados: { superAdmin: quem, usuario: usuario.login },
        ip: req.ip,
        rota: req.originalUrl,
      },
    });

    console.warn(`[suporte] ${quem} entrou em ${tenant.slug} como ${usuario.login}`);

    /* A MESMA `montarSessao` do login. Uma segunda montagem aqui divergiria da
       de lá na primeira coisa que a tela passasse a ler. */
    return res.json({
      ...montarSessao(usuario, { validade: "2h" }),
      /* A tela usa para avisar quem está dentro. Ver `SuperAdminPage`. */
      acessoDeSuporte: { por: quem, imobiliaria: tenant.name },
    });
  } catch (err) {
    console.error("[POST /admin/tenants/:id/entrar]", err);
    return res.status(500).json({ error: "Erro ao entrar na imobiliária." });
  }
});

/* ────────────────────────────────────────────────────────────────────────────
   REEMITIR A SENHA TEMPORÁRIA DO ADMINISTRADOR.

   ── O BURACO QUE ISTO FECHA ──

   A senha temporária de uma imobiliária nova aparece UMA vez, no modal da
   criação. Fechar aquele modal sem copiá-la deixava a conta num beco: o
   cliente não tinha como entrar, e não havia tela nenhuma para reemiti-la. A
   única saída era apagar a imobiliária e criar de novo.

   ── POR QUE REEMITIR, E NÃO DEIXAR O SUPER-ADMIN ESCOLHER A SENHA ──

   Escrever a senha do cliente faria a Omnimob CONHECER a senha dele — e ela
   costuma ser reaproveitada noutros lugares. Uma temporária aleatória, que a
   pessoa é obrigada a trocar no primeiro acesso, entrega o mesmo resultado sem
   que ninguém daqui saiba a senha real de ninguém.

   `forcaAlterarSenha` volta a `true` de propósito: a senha nova viaja por
   WhatsApp ou e-mail para chegar ao cliente, e senha que viajou não pode ser a
   definitiva.

   Vale para QUALQUER estado, não só para quem nunca definiu senha: "o cliente
   perdeu o acesso e não recebe o e-mail de recuperação" é o chamado mais comum
   de todos, e até aqui ele não tinha resposta.
   ──────────────────────────────────────────────────────────────────────────── */
adminRouter.post("/tenants/:id/senha-admin", requirePermissaoAdmin("editarTenant"), async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, slug: true },
    });
    if (!tenant) return res.status(404).json({ error: "Imobiliária não encontrada." });

    const usuario = await prisma.usuario.findFirst({
      where: { tenantId: tenant.id, ativo: true, cargo: { descricao: CARGO_ADMIN } },
      orderBy: { createdAt: "asc" },
      select: { id: true, nome: true, login: true },
    });
    if (!usuario) {
      return res.status(409).json({ error: `${tenant.name} não tem nenhum Administrador ativo.` });
    }

    const nova = senhaTemporaria();
    const quem = req.superAdmin?.email || "super-admin";

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        senha: await bcrypt.hash(nova, 10),
        forcaAlterarSenha: true,
        /* Zera a trava de força bruta: a conta que estava bloqueada por
           tentativas erradas volta a aceitar login com a senha nova. Sem isto,
           reemitir a senha não resolveria o chamado. */
        tentativasFalhas: 0,
        bloqueadoAte: null,
      },
    });

    /* Trocar a senha de alguém é mais grave do que entrar na conta: fica na
       trilha da imobiliária, como o acesso de suporte. */
    await prisma.auditoria.create({
      data: {
        tenantId: tenant.id,
        usuarioId: usuario.id,
        usuarioNome: `Omnimob (${quem})`,
        acao: "SENHA_REEMITIDA",
        entidade: "Usuario",
        entidadeId: usuario.id,
        resumo: `A equipe da Omnimob gerou uma nova senha temporária para ${usuario.nome}.`,
        dados: { superAdmin: quem, usuario: usuario.login },
        ip: req.ip,
        rota: req.originalUrl,
      },
    });

    console.warn(`[suporte] ${quem} reemitiu a senha de ${usuario.login} (${tenant.slug})`);

    /* O texto sai UMA vez, como na criação. Não é guardado em lugar nenhum
       além do hash. */
    return res.json({ login: usuario.login, senha: nova, nome: usuario.nome });
  } catch (err) {
    console.error("[POST /admin/tenants/:id/senha-admin]", err);
    return res.status(500).json({ error: "Erro ao gerar a senha." });
  }
});

/* ─── Ativar a conta À MÃO, como se a assinatura tivesse sido paga ───────────

   Existe porque o dinheiro nem sempre entra pelo provedor: transferência,
   acordo comercial, cortesia, cliente que fechou por fora, ambiente de
   demonstração. Antes disto, quem precisava disso mexia em quatro campos do
   cadastro (status, plano, valor, vencimento) — e o quinto, `suspensoEm`, não
   estava lá: conta suspensa voltava para EM_DIA com o relógio da remoção ainda
   correndo, e a faxina a levava dias depois, já paga.

   `fidelizarTrial` é a MESMA função que o caminho pago usa. Não existe uma
   segunda definição de "conta em dia" — é a diferença entre uma ativação
   manual e uma gambiarra.

   O que esta rota acrescenta a ela são as três contas que quem clica não
   deveria fazer de cabeça:
     · a data — período escolhido a partir do vencimento atual, e não de hoje,
       para que renovar antes do fim não jogue fora os dias que faltavam;
     · o valor — lido do CATÁLOGO do provedor, nunca digitado (preço escrito à
       mão é preço que envelhece);
     · os módulos — o pacote vira `Tenant.modulos`, senão o Flow vendido por
       fora nunca acende.
   ────────────────────────────────────────────────────────────────────────── */

/** Soma meses a uma data preservando o fim de mês (31/01 + 1 mês = 28/02). */
function somarMeses(base, meses) {
  const d = new Date(base);
  const dia = d.getDate();
  d.setMonth(d.getMonth() + meses);
  // Estourou para o mês seguinte (31 → 31/04 não existe): volta para o último
  // dia do mês pretendido.
  if (d.getDate() < dia) d.setDate(0);
  return d;
}

adminRouter.post("/tenants/:id/fidelizar", requirePermissaoAdmin("editarTenant"), async (req, res) => {
  try {
    const b = req.body || {};
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      select: { id: true, slug: true, name: true, plano: true, modulos: true, proximoVencimento: true },
    });
    if (!tenant) return res.status(404).json({ error: "Tenant não encontrado." });

    const plano = ["BASICO", "PROFISSIONAL", "PREMIUM"].includes(b.plano) ? b.plano : tenant.plano || "BASICO";
    const periodo = normalizarPeriodo(b.periodo);
    const modulos = modulosDoCorpo(b) || (b.pacote ? modulosDoPacote(normalizarPacote(b.pacote)) : null);

    /* A data. Explícita no corpo manda; senão, o período conta a partir do
       vencimento atual quando ele ainda está no futuro — renovar no dia 20 com
       vencimento no dia 30 não pode custar dez dias ao cliente. */
    const agora = new Date();
    const partida =
      tenant.proximoVencimento && tenant.proximoVencimento > agora ? tenant.proximoVencimento : agora;
    const vencimento = b.proximoVencimento
      ? new Date(b.proximoVencimento)
      : somarMeses(partida, periodo === "anual" ? 12 : 1);

    /* O valor. Vem do catálogo do provedor — a MESMA fonte que a landing e a
       tela de planos leem —, e só é digitado quando quem ativa quer registrar
       um acordo diferente do preço de tabela. Provedor desligado devolve `{}`:
       aí não gravamos valor nenhum, em vez de inventar um. */
    let valorMensal = b.valorMensal === "" || b.valorMensal == null ? null : Number(b.valorMensal);
    if (valorMensal == null) {
      try {
        const precos = await precosDosPlanos();
        const pacote = modulos?.includes("FLOW") ? "HUB_FLOW" : "HUB";
        const doPlano = pacote === "HUB_FLOW" ? precos?.[plano]?.flow : precos?.[plano];
        /* Sem preço anual cadastrado, cai no mensal — o mesmo que a landing
           faz. E no anual o que se GRAVA é a média mensal, porque a coluna se
           chama `valorMensal` e é ela que a tela de planos exibe. */
        const ehAnual = periodo === "anual" && doPlano?.anual?.valor > 0;
        const doPeriodo = ehAnual ? doPlano.anual : doPlano?.mensal;
        if (doPeriodo?.valor > 0) {
          valorMensal = ehAnual
            ? Math.round((doPeriodo.valor / 12) * 100) / 100
            : doPeriodo.valor;
        }
      } catch (erro) {
        console.warn("[admin/fidelizar] não consegui ler o preço no provedor:", erro.message);
      }
    }

    const atualizado = await fidelizarTrial(tenant.id, {
      plano,
      valorMensal,
      proximoVencimento: vencimento,
      ...(modulos ? { modulos } : {}),
    });

    /* Quem liberou. Declarado aqui em cima porque as DUAS anotações abaixo o
       usam: a linha do histórico e a trilha de auditoria. */
    const quem = req.superAdmin?.email || req.superAdmin?.nome || "super-admin";

    /* No histórico de pagamento, para a imobiliária ver por que está em dia.
       Sem esta linha, quem foi ativado por acordo comercial abriria a tela de
       cobrança e encontraria o vazio — a pior resposta possível para "eu
       paguei?". É o buraco que nenhum fornecedor cobre, porque esta ativação
       não existe em fornecedor nenhum. */
    const meses = periodo === "anual" ? 12 : 1;
    await registrarPagamento({
      tenantId: tenant.id,
      provedor: "MANUAL",
      meio: "manual",
      status: "PAGO",
      /* O valor do PERÍODO, não a mensalidade: é o que foi "pago". Sem preço
         lido do provedor não há valor, e aí não há linha — melhor um histórico
         com uma lacuna do que um "R$ 0,00" que ninguém sabe explicar. */
      valor: valorMensal != null ? Number(valorMensal) * meses : 0,
      plano,
      periodo,
      cobreDe: partida,
      cobreAte: vencimento,
      descricao: `Ativado pela equipe da Omnimob (${quem}), sem cobrança pelo provedor.`,
    });

    /* Na trilha DA IMOBILIÁRIA, como o acesso de suporte e a reemissão de
       senha. Quem abrir o registro de atividade meses depois precisa achar por
       que a conta ficou em dia sem nenhuma fatura correspondente. */
    await prisma.auditoria.create({
      data: {
        tenantId: tenant.id,
        usuarioId: null,
        usuarioNome: `Omnimob (${quem})`,
        acao: "ASSINATURA_ATIVADA_MANUALMENTE",
        entidade: "Tenant",
        entidadeId: tenant.id,
        resumo:
          `A equipe da Omnimob ativou o plano ${plano} (${periodo}) até ` +
          `${vencimento.toLocaleDateString("pt-BR")} sem cobrança pelo provedor.`,
        dados: { superAdmin: quem, plano, periodo, modulos, valorMensal, ate: vencimento },
        ip: req.ip,
        rota: req.originalUrl,
      },
    });

    console.warn(
      `[suporte] ${quem} ativou manualmente ${tenant.slug} — ${plano}/${periodo} até ${vencimento.toISOString().slice(0, 10)}`,
    );

    return res.json({
      tenant: atualizado,
      /* O que de fato foi gravado, para a tela não ter de recalcular nada — e
         para a mensagem de confirmação dizer a data certa. */
      ativacao: { plano, periodo, modulos: atualizado.modulos, valorMensal, ate: vencimento },
    });
  } catch (err) {
    console.error("[POST /admin/tenants/:id/fidelizar]", err);
    res.status(500).json({ error: "Erro ao ativar a assinatura.", detail: err.message });
  }
});

/* ────────────────────────────────────────────────────────────────────────────
   USUÁRIOS E CARGOS DA PLATAFORMA.

   O desenho é o do Hub — `usuarioRoutes` + `cargoRoutes` —, e não um segundo:
   catálogo canônico de permissões num serviço, o Administrador reconhecido
   pelo nome e com as chaves da casa DERIVADAS a cada gravação (não recusadas),
   ninguém desativa a si mesmo, cargo com gente dentro não é apagado.

   As duas travas de "não ficar sem ninguém" valem aqui como lá: o último
   Administrador ativo não é desativado nem rebaixado, e o cargo Administrador
   não é excluído. A plataforma inteira sem ninguém que reabra a porta é o
   estado que estas linhas existem para impedir.
   ──────────────────────────────────────────────────────────────────────────── */

const SUPER_ADMIN_VISIVEL = {
  id: true, nome: true, email: true, ativo: true, cargoId: true, createdAt: true,
  totpAtivadoEm: true,
  cargo: { select: { id: true, nome: true } },
};

function serializarSuperAdmin(u) {
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    ativo: u.ativo,
    cargoId: u.cargoId,
    cargo: u.cargo?.nome || null,
    segundoFator: Boolean(u.totpAtivadoEm),
    /* Sem senha = convidado que ainda não definiu a dele. A tela oferece
       "reenviar convite" só nesse estado. */
    aguardandoConvite: !u.senha,
    createdAt: u.createdAt,
  };
}

/* Quantos Administradores ATIVOS com senha sobram além deste. Serve às duas
   travas — desativar e rebaixar — e por isso mora numa função só. */
async function outrosAdministradoresAtivos(excetoId) {
  return prisma.superAdmin.count({
    where: { id: { not: excetoId }, ativo: true, senha: { not: "" }, cargo: { nome: CARGO_ADMIN_PLATAFORMA } },
  });
}

async function cargoExiste(cargoId) {
  const id = Number(cargoId);
  if (!Number.isInteger(id)) return null;
  return prisma.cargoSuperAdmin.findUnique({ where: { id }, select: { id: true, nome: true } });
}

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

adminRouter.get("/usuarios", requirePermissaoAdmin("verUsuarios"), async (_req, res) => {
  try {
    const lista = await prisma.superAdmin.findMany({
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
      select: { ...SUPER_ADMIN_VISIVEL, senha: true },
    });
    return res.json(lista.map(serializarSuperAdmin));
  } catch (err) {
    console.error("[GET /admin/usuarios]", err);
    return res.status(500).json({ error: "Erro ao listar usuários." });
  }
});

/* Cria com senha VAZIA e manda o convite. "Definir senha no primeiro acesso"
   é o único caminho, de propósito: quem cria a conta não escolhe a senha da
   outra pessoa — é o mesmo motivo de a reemissão de senha do tenant gerar uma
   temporária em vez de aceitar uma digitada. */
adminRouter.post("/usuarios", requirePermissaoAdmin("gerenciarUsuarios"), async (req, res) => {
  try {
    const nome = String(req.body?.nome || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!nome || !email) return res.status(400).json({ error: "Nome e e-mail são obrigatórios." });
    if (!EMAIL_VALIDO.test(email)) return res.status(400).json({ error: "E-mail inválido." });

    const cargo = await cargoExiste(req.body?.cargoId);
    if (!cargo) return res.status(400).json({ error: "Escolha um cargo." });

    const criado = await prisma.superAdmin.create({
      data: { nome, email, senha: "", ativo: true, cargoId: cargo.id },
      include: { cargo: true },
    });

    const convite = await enviarConvite(criado, { convidadoPor: req.superAdmin.nome || req.superAdmin.email });
    return res.status(201).json({ ...serializarSuperAdmin(criado), convite });
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Já existe um usuário com este e-mail." });
    console.error("[POST /admin/usuarios]", err);
    return res.status(500).json({ error: "Erro ao criar usuário." });
  }
});

adminRouter.put("/usuarios/:id", requirePermissaoAdmin("gerenciarUsuarios"), async (req, res) => {
  try {
    const atual = await prisma.superAdmin.findUnique({ where: { id: req.params.id }, include: { cargo: true } });
    if (!atual) return res.status(404).json({ error: "Usuário não encontrado." });

    const b = req.body || {};
    const data = {};
    if (b.nome !== undefined) {
      data.nome = String(b.nome).trim();
      if (!data.nome) return res.status(400).json({ error: "Nome é obrigatório." });
    }
    if (b.email !== undefined) {
      data.email = String(b.email).trim().toLowerCase();
      if (!EMAIL_VALIDO.test(data.email)) return res.status(400).json({ error: "E-mail inválido." });
    }
    if (b.ativo !== undefined) data.ativo = Boolean(b.ativo);
    if (b.cargoId !== undefined) {
      const cargo = await cargoExiste(b.cargoId);
      if (!cargo) return res.status(400).json({ error: "Cargo não encontrado." });
      data.cargoId = cargo.id;
    }

    /* Desativar a si mesmo é a forma de se trancar para fora com a porta
       aberta para mais ninguém. A tela já esconde; aqui é a trava de verdade. */
    if (data.ativo === false && atual.id === req.superAdmin.id) {
      return res.status(400).json({ error: "Você não pode desativar o seu próprio usuário." });
    }

    /* O ÚLTIMO Administrador ativo não é desativado nem rebaixado. */
    const eraAdmin = ehAdministradorDaPlataforma(atual.cargo);
    const perdeAdmin = data.ativo === false || (data.cargoId !== undefined && data.cargoId !== atual.cargoId);
    if (eraAdmin && atual.ativo && perdeAdmin && (await outrosAdministradoresAtivos(atual.id)) === 0) {
      return res.status(400).json({
        error: "Este é o único Administrador ativo da plataforma. Dê o cargo a outra pessoa antes.",
      });
    }

    const atualizado = await prisma.superAdmin.update({
      where: { id: atual.id },
      data,
      select: { ...SUPER_ADMIN_VISIVEL, senha: true },
    });
    return res.json(serializarSuperAdmin(atualizado));
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Já existe um usuário com este e-mail." });
    console.error("[PUT /admin/usuarios/:id]", err);
    return res.status(500).json({ error: "Erro ao atualizar usuário." });
  }
});

/* Reenvia o convite. Só para quem ainda não definiu senha: para quem já tem,
   o link não abriria nada (a impressão digital já é outra) — e mandar assim
   mesmo seria um e-mail que confunde. */
adminRouter.post("/usuarios/:id/convite", requirePermissaoAdmin("gerenciarUsuarios"), async (req, res) => {
  try {
    const admin = await prisma.superAdmin.findUnique({ where: { id: req.params.id }, include: { cargo: true } });
    if (!admin) return res.status(404).json({ error: "Usuário não encontrado." });
    if (!admin.ativo) return res.status(400).json({ error: "Reative o usuário antes de reenviar o convite." });
    if (admin.senha) return res.status(400).json({ error: "Este usuário já definiu a senha." });

    const convite = await enviarConvite(admin, { convidadoPor: req.superAdmin.nome || req.superAdmin.email });
    return res.json({ convite });
  } catch (err) {
    console.error("[POST /admin/usuarios/:id/convite]", err);
    return res.status(500).json({ error: "Erro ao reenviar o convite." });
  }
});

// ─── Cargos ──────────────────────────────────────────────────────────────────

function serializarCargo(c) {
  const { _count, ...resto } = c;
  return { ...resto, ehAdministrador: ehAdministradorDaPlataforma(c), usuarios: _count?.superAdmins ?? 0 };
}

const COM_CONTAGEM = { _count: { select: { superAdmins: true } } };

/* `verUsuarios` também lê: a tela de usuários precisa da lista de cargos para
   o seletor, e exigir `verCargos` ali obrigaria quem gere gente a também poder
   reescrever permissões. */
adminRouter.get("/cargos", requirePermissaoAdmin("verCargos", "verUsuarios"), async (_req, res) => {
  try {
    const cargos = await prisma.cargoSuperAdmin.findMany({ orderBy: { id: "asc" }, include: COM_CONTAGEM });
    /* `ehAdministrador` e as chaves travadas vão CALCULADOS: a tela que
       desenha a caixa travada precisa concordar com quem recusa o PUT. */
    return res.json({ cargos: cargos.map(serializarCargo), catalogo: catalogoDePermissoes(), travadas: CHAVES_DA_PLATAFORMA });
  } catch (err) {
    console.error("[GET /admin/cargos]", err);
    return res.status(500).json({ error: "Erro ao listar cargos." });
  }
});

adminRouter.post("/cargos", requirePermissaoAdmin("verCargos"), async (req, res) => {
  try {
    const nome = String(req.body?.nome || "").trim();
    if (!nome) return res.status(400).json({ error: "Nome é obrigatório." });
    const data = { nome, ...normalizarPermissoes(req.body, { nome }) };
    const cargo = await prisma.cargoSuperAdmin.create({ data, include: COM_CONTAGEM });
    return res.status(201).json(serializarCargo(cargo));
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Já existe um cargo com este nome." });
    console.error("[POST /admin/cargos]", err);
    return res.status(500).json({ error: "Erro ao criar cargo." });
  }
});

adminRouter.put("/cargos/:id", requirePermissaoAdmin("verCargos"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const cargo = Number.isInteger(id) ? await prisma.cargoSuperAdmin.findUnique({ where: { id } }) : null;
    if (!cargo) return res.status(404).json({ error: "Cargo não encontrado." });

    const data = {};
    if (req.body?.nome !== undefined) {
      data.nome = String(req.body.nome).trim();
      if (!data.nome) return res.status(400).json({ error: "Nome é obrigatório." });
      /* Renomear o Administrador o faria deixar de ser reconhecido — e as
         chaves da casa deixariam de ser derivadas. Recusar é mais simples
         que inventar uma flag para marcá-lo. */
      if (ehAdministradorDaPlataforma(cargo) && data.nome !== cargo.nome) {
        return res.status(400).json({ error: "O cargo Administrador não pode ser renomeado." });
      }
    }
    Object.assign(data, normalizarPermissoes(req.body, { nome: data.nome ?? cargo.nome, base: cargo }));

    /* Quem edita não tira `verCargos` do PRÓPRIO cargo — seria se trancar do
       lado de fora, e sem ninguém para reabrir. Mesma trava do Hub. */
    if (id === req.superAdmin.cargoId && data.verCargos === false) {
      return res.status(400).json({ error: "Você não pode remover 'Cargos' do seu próprio cargo." });
    }

    const atualizado = await prisma.cargoSuperAdmin.update({ where: { id }, data, include: COM_CONTAGEM });
    return res.json(serializarCargo(atualizado));
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Já existe um cargo com este nome." });
    console.error("[PUT /admin/cargos/:id]", err);
    return res.status(500).json({ error: "Erro ao atualizar cargo." });
  }
});

adminRouter.delete("/cargos/:id", requirePermissaoAdmin("verCargos"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const cargo = Number.isInteger(id)
      ? await prisma.cargoSuperAdmin.findUnique({ where: { id }, include: COM_CONTAGEM })
      : null;
    if (!cargo) return res.status(404).json({ error: "Cargo não encontrado." });
    if (ehAdministradorDaPlataforma(cargo)) {
      return res.status(400).json({ error: "O cargo Administrador não pode ser excluído." });
    }
    if (cargo._count.superAdmins > 0) {
      return res.status(400).json({
        error: `Cargo está vinculado a ${cargo._count.superAdmins} usuário(s). Reatribua-os antes de excluir.`,
      });
    }
    await prisma.cargoSuperAdmin.delete({ where: { id } });
    return res.status(204).send();
  } catch (err) {
    console.error("[DELETE /admin/cargos/:id]", err);
    return res.status(500).json({ error: "Erro ao excluir cargo." });
  }
});
