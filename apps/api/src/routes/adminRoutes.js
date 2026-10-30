import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { prisma, plataforma, plataformaExterna } from "../db.js";
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
import { ehTenantProtegido, MOTIVO_PROTEGIDO } from "../services/tenantProtegido.js";
import { CARGO_ADMIN } from "../services/cargosPadrao.js";
import { historico, versaoAtual } from "../services/versao.js";
import { chaveValida, configDasNovidades, normalizarNovidade, publicarNovidade, resumoDaNovidade } from "../services/novidades.js";
import { controleDeUso } from "../services/controleDeUso.js";
import { dispositivoDe } from "../services/sessoes.js";
import { LIMITE_DA_PAREDE, publicavel, relatosNoAr } from "../services/relatosDaParede.js";
import {
  COM_CONTAGEM as CHAMADO_COM_CONTAGEM,
  COM_CONVERSA as CHAMADO_COM_CONVERSA,
  STATUS_CHAMADO,
  VEZ_DO_SUPORTE,
  mudarStatus,
  responderComoSuporte,
  serializarChamado,
  serializarMensagem,
} from "../services/chamados.js";

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
  const admin = await plataforma.superAdmin.findUnique({
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

  /* Super-admin compartilhado com outro banco (dev apontando para a produção,
     ver `db.js`): a CONTA nasce no lugar certo, mas o link não — ele aponta
     para o `APP_URL` daqui e vai assinado com o `JWT_SECRET` daqui, e só abre
     nesta máquina. Foi assim que um convite mandado do localhost chegou na
     caixa de um colega apontando para `localhost:5173`. O link volta para quem
     convidou (vale para testar aqui); o convite de verdade sai do painel de
     produção, por "Reenviar convite". */
  if (plataformaExterna) {
    console.warn(`[admin/convite] super-admin em banco externo; e-mail NÃO enviado para ${admin.email}. Link local: ${link}`);
    return {
      enviado: false,
      link,
      motivo:
        "este ambiente compartilha os super-admins com outro banco, e o link só abre aqui — " +
        "para a pessoa definir a senha, use \"Reenviar convite\" no painel de produção",
    };
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

    const admin = await plataforma.superAdmin.findUnique({ where: { email }, include: { cargo: true } });
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

    const admin = await plataforma.superAdmin.findUnique({ where: { id: payload.superAdminId }, include: { cargo: true } });
    if (!admin || !admin.ativo || !admin.totpAtivadoEm) return res.status(401).json({ error: "Credenciais invalidas." });

    const conferido = conferirSegundoFator(admin, codigo);
    if (!conferido.ok) return res.status(401).json({ error: "Codigo invalido ou ja usado." });

    await plataforma.superAdmin.update({ where: { id: admin.id }, data: conferido.dados });

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
    const atualizado = await plataforma.superAdmin.update({
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
  return res.json({ id, nome, email, cargoId, cargo: cargoNome, permissoes, catalogo: catalogoDePermissoes(), versao: versaoAtual() });
});

/* As versões da Omnimob e o que cada uma mudou (`services/versao.js`). Sem
   permissão própria: todo cargo do painel vê, porque é a primeira pergunta do
   suporte ("isso já estava no ar quando o cliente reclamou?"). */
adminRouter.get("/versoes", (_req, res) => {
  const h = historico();
  return res.json({ ...(h || { versoes: [], antes: null }), indisponivel: !h, no_ar: versaoAtual() });
});

/* ─── Segundo fator: ligar, conferir e desligar ───────────────────────────────

   As três rotas exigem estar logado, e isso é a regra de segurança: o segundo
   fator nasce de quem JÁ PROVOU ser aquela conta. É o mesmo desenho do vínculo
   com o Google em `authRoutes` — vincular exige sessão, entrar só procura.
   ────────────────────────────────────────────────────────────────────────── */

async function superAdminDaSessao(req) {
  return plataforma.superAdmin.findUnique({ where: { id: req.superAdmin.id } });
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
    await plataforma.superAdmin.update({
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
    await plataforma.superAdmin.update({
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

    await plataforma.superAdmin.update({
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
    // A tela esconde o "Excluir" (e explica por quê); quem recusa é a rota.
    protegido: ehTenantProtegido(t.slug),
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
    /* ANTES do Stripe: cancelar a assinatura e depois recusar a exclusão
       deixaria a conta viva e sem cobrança. A tela esconde o botão; isto é o
       que vale quando alguém chama a URL. */
    if (ehTenantProtegido(tenant.slug)) {
      return res.status(403).json({ error: MOTIVO_PROTEGIDO, code: "TENANT_PROTEGIDO" });
    }

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

/* O chamado como o super-admin o vê: a forma comum mais de quem é. */
function serializarChamadoParaAdmin(c) {
  return {
    ...serializarChamado(c),
    tenantId: c.tenantId,
    tenantNome: c.tenant?.name || "—",
    tenantSlug: c.tenant?.slug || "",
    // O plano ATUAL do tenant. A prioridade gravada no chamado já embute o
    // plano de quando ele foi aberto (ver prioridadeComPlano em
    // chamadoRoutes); isto aqui é para a tela poder mostrar de quem é.
    tenantPlano: c.tenant?.plano || "BASICO",
  };
}

const CHAMADO_COM_TENANT = { tenant: { select: { name: true, slug: true, plano: true } } };

/* Quem atende, e o que o cargo alcança. O chamado INTERNO (a equipe pedindo ao
   desenvolvimento) é só do Administrador da plataforma: é conversa da casa, e
   um cargo "Suporte" que atende cliente não tem o que fazer com ela. Quem não
   o vê também não o CONTA — senão o número da aba diria que há trabalho que a
   pessoa não consegue abrir. */
function atendente(req) {
  return {
    nome: req.superAdmin?.nome || req.superAdmin?.email || "Suporte Omnimob",
    veInternos: ehAdministradorDaPlataforma({ nome: req.superAdmin?.cargoNome }),
  };
}

/* O chamado pelo número, se quem atende pode vê-lo. Interno de quem não o vê
   é 404, como chamado que não existe. */
async function chamadoParaAtender(req, include) {
  const numero = Number(req.params.numero);
  if (!Number.isInteger(numero)) return { erro: 400 };
  const c = await prisma.chamado.findUnique({ where: { numero }, include });
  if (!c || (c.interno && !atendente(req).veInternos)) return { erro: 404 };
  return { chamado: c };
}

/* Releitura com a conversa, para devolver depois de responder ou mudar o
   status: a tela redesenha o fio inteiro (com a anotação de sistema que a
   mudança deixou) sem uma segunda ida. */
async function chamadoCompleto(numero) {
  const c = await prisma.chamado.findUnique({
    where: { numero },
    include: { ...CHAMADO_COM_TENANT, ...CHAMADO_COM_CONVERSA },
  });
  return serializarChamadoParaAdmin(c);
}

const PESO_PRIORIDADE = { URGENTE: 3, ALTA: 2, MEDIA: 1, BAIXA: 0 };

/* ── Chamados ────────────────────────────────────────────────────────────────
   A caixa de entrada do suporte. Diferente do lado da imobiliária, aqui vêm
   TODOS os tenants — é a tela em que se decide o que atender primeiro.

   A ORDEM É DAQUI, e a tela não reordena (decidir duas vezes a mesma coisa
   diverge): não resolvido primeiro; dentro dele, o que espera resposta NOSSA
   (ABERTO, EM_ATENDIMENTO) antes do que espera o cliente; depois a prioridade
   — que soma a categoria e o plano do tenant, é o "suporte prioritário" que o
   Premium compra —; e, no empate, o que mexeu por último.

   Os contadores saem do banco, e não da lista: com o corte de 400 a lista pode
   estar incompleta, e o painel mostraria menos do que há. */
adminRouter.get("/chamados", requirePermissaoAdmin("verChamados"), async (req, res) => {
  try {
    const eu = atendente(req);
    const { resolvido, tenantId, status } = req.query;
    const escopo = eu.veInternos ? {} : { interno: false };
    const where = { ...escopo };
    if (resolvido === "true") where.resolvido = true;
    if (resolvido === "false") where.resolvido = false;
    if (tenantId) where.tenantId = String(tenantId);
    if (status && STATUS_CHAMADO.includes(String(status).toUpperCase())) where.status = String(status).toUpperCase();

    const [chamados, porStatusBruto, internosAbertos] = await Promise.all([
      prisma.chamado.findMany({
        where,
        orderBy: [{ resolvido: "asc" }, { atualizadoEm: "desc" }],
        take: 400,
        include: { ...CHAMADO_COM_TENANT, ...CHAMADO_COM_CONTAGEM },
      }),
      prisma.chamado.groupBy({
        by: ["status"],
        where: { ...escopo, ...(tenantId ? { tenantId: String(tenantId) } : {}) },
        _count: { _all: true },
      }),
      eu.veInternos ? prisma.chamado.count({ where: { interno: true, resolvido: false } }) : 0,
    ]);

    const vezDoSuporte = (c) => (VEZ_DO_SUPORTE.includes(c.status) ? 0 : 1);
    chamados.sort((a, b) =>
      (a.resolvido === b.resolvido ? 0 : a.resolvido ? 1 : -1) ||
      vezDoSuporte(a) - vezDoSuporte(b) ||
      (PESO_PRIORIDADE[b.prioridade] ?? 1) - (PESO_PRIORIDADE[a.prioridade] ?? 1) ||
      new Date(b.atualizadoEm) - new Date(a.atualizadoEm),
    );

    res.json({
      chamados: chamados.map(serializarChamadoParaAdmin),
      porStatus: Object.fromEntries(porStatusBruto.map((l) => [l.status, l._count._all])),
      internosAbertos,
      /* O que a tela não deve oferecer. As rotas conferem de novo — isto é só
         não desenhar o botão que vai ser recusado. Responder e resolver são a
         mesma caixa (`resolverChamado`) de propósito: uma terceira exigiria
         coluna nova no CargoSuperAdmin, que vive no banco da PLATAFORMA. */
      eu: {
        nome: eu.nome,
        podeResponder: Boolean(req.superAdmin?.permissoes?.resolverChamado),
        podeResolver: Boolean(req.superAdmin?.permissoes?.resolverChamado),
        veInternos: eu.veInternos,
      },
    });
  } catch (err) {
    console.error("[GET /admin/chamados]", err);
    res.status(500).json({ error: "Erro ao listar chamados." });
  }
});

/* A conversa de um chamado, de qualquer imobiliária — é o suporte. */
adminRouter.get("/chamados/:numero", requirePermissaoAdmin("verChamados"), async (req, res) => {
  try {
    const { chamado, erro } = await chamadoParaAtender(req, { ...CHAMADO_COM_TENANT, ...CHAMADO_COM_CONVERSA });
    if (erro === 400) return res.status(400).json({ error: "Número inválido." });
    if (erro) return res.status(404).json({ error: "Chamado não encontrado." });
    return res.json(serializarChamadoParaAdmin(chamado));
  } catch (err) {
    console.error("[GET /admin/chamados/:numero]", err);
    return res.status(500).json({ error: "Erro ao carregar o chamado." });
  }
});

/* A resposta do suporte. Vai para a conversa, passa a bola para o cliente e
   dispara o e-mail — tudo em `responderComoSuporte`, a MESMA régua que o lado
   do cliente usa. Até 3 imagens por fala, já no Cloudinary (só as URLs). */
adminRouter.post("/chamados/:numero/mensagens", requirePermissaoAdmin("resolverChamado"), async (req, res) => {
  const texto = String(req.body?.texto || "").trim();
  if (!texto) return res.status(400).json({ error: "Escreva a resposta." });
  if (texto.length > 4000) return res.status(400).json({ error: "A resposta é longa demais." });
  const prints = (Array.isArray(req.body?.prints) ? req.body.prints : [])
    .filter((u) => typeof u === "string" && /^https:\/\//i.test(u) && u.length <= 500)
    .slice(0, 3);

  try {
    const { chamado, erro } = await chamadoParaAtender(req);
    if (erro === 400) return res.status(400).json({ error: "Número inválido." });
    if (erro) return res.status(404).json({ error: "Chamado não encontrado." });

    const { mensagem, chamado: atualizado } = await responderComoSuporte(chamado, {
      texto,
      prints,
      autorNome: atendente(req).nome,
    });
    return res.status(201).json({
      mensagem: serializarMensagem(mensagem),
      status: atualizado.status,
      chamado: await chamadoCompleto(chamado.numero),
    });
  } catch (err) {
    console.error("[POST /admin/chamados/:numero/mensagens]", err);
    return res.status(500).json({ error: "Erro ao responder o chamado." });
  }
});

/* Mudar o status e/ou repriorizar. Aceita `status` (a régua nova) e ainda
   `resolvido` (o contrato antigo da tela): `true` é RESOLVIDO, `false` reabre.
   `resolvidoEm` é derivado, nunca recebido: é o servidor que sabe quando o
   clique aconteceu. Resolver e reabrir deixam anotação na conversa. */
adminRouter.patch("/chamados/:numero", requirePermissaoAdmin("resolverChamado"), async (req, res) => {
  try {
    const b = req.body || {};
    let status = null;
    if (typeof b.status === "string") {
      if (!STATUS_CHAMADO.includes(b.status)) return res.status(400).json({ error: "Status inválido." });
      status = b.status;
    } else if ("resolvido" in b) {
      status = b.resolvido ? "RESOLVIDO" : "ABERTO";
    }
    const prioridade = b.prioridade && ["BAIXA", "MEDIA", "ALTA", "URGENTE"].includes(b.prioridade) ? b.prioridade : null;
    if (!status && !prioridade) return res.status(400).json({ error: "Nada para atualizar." });

    let { chamado: c, erro } = await chamadoParaAtender(req);
    if (erro === 400) return res.status(400).json({ error: "Número inválido." });
    if (erro) return res.status(404).json({ error: "Chamado não encontrado." });

    /* Repriorizar é arrumação da fila, não novidade para o cliente:
       `atualizadoEm` explícito para o selo dele não acender por isso. */
    if (prioridade) c = await prisma.chamado.update({ where: { numero: c.numero }, data: { prioridade, atualizadoEm: c.atualizadoEm } });
    if (status) c = await mudarStatus(c, status, { autorNome: atendente(req).nome });

    res.json({
      numero: c.numero, status: c.status, resolvido: c.resolvido, prioridade: c.prioridade, resolvidoEm: c.resolvidoEm,
      chamado: await chamadoCompleto(c.numero),
    });
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
      ...montarSessao(usuario, {
        validade: "2h",
        suporte: { nome: req.superAdmin?.nome || quem, email: req.superAdmin?.email || null },
      }),
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
  return plataforma.superAdmin.count({
    where: { id: { not: excetoId }, ativo: true, senha: { not: "" }, cargo: { nome: CARGO_ADMIN_PLATAFORMA } },
  });
}

async function cargoExiste(cargoId) {
  const id = Number(cargoId);
  if (!Number.isInteger(id)) return null;
  return plataforma.cargoSuperAdmin.findUnique({ where: { id }, select: { id: true, nome: true } });
}

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

adminRouter.get("/usuarios", requirePermissaoAdmin("verUsuarios"), async (_req, res) => {
  try {
    const lista = await plataforma.superAdmin.findMany({
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

    const criado = await plataforma.superAdmin.create({
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
    const atual = await plataforma.superAdmin.findUnique({ where: { id: req.params.id }, include: { cargo: true } });
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

    const atualizado = await plataforma.superAdmin.update({
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
    const admin = await plataforma.superAdmin.findUnique({ where: { id: req.params.id }, include: { cargo: true } });
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
    const cargos = await plataforma.cargoSuperAdmin.findMany({ orderBy: { id: "asc" }, include: COM_CONTAGEM });
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
    const cargo = await plataforma.cargoSuperAdmin.create({ data, include: COM_CONTAGEM });
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
    const cargo = Number.isInteger(id) ? await plataforma.cargoSuperAdmin.findUnique({ where: { id } }) : null;
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

    const atualizado = await plataforma.cargoSuperAdmin.update({ where: { id }, data, include: COM_CONTAGEM });
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
      ? await plataforma.cargoSuperAdmin.findUnique({ where: { id }, include: COM_CONTAGEM })
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
    await plataforma.cargoSuperAdmin.delete({ where: { id } });
    return res.status(204).send();
  } catch (err) {
    console.error("[DELETE /admin/cargos/:id]", err);
    return res.status(500).json({ error: "Erro ao excluir cargo." });
  }
});

/* ─── A trilha da PLATAFORMA ──────────────────────────────────────────────────

   As escritas de super-admin (usuários e cargos da Omnimob) já entravam na
   `Auditoria` com `tenantId` nulo; faltava onde lê-las. Só leitura, como a da
   imobiliária, e do cliente `plataforma`: é para o banco da plataforma que
   essas linhas vão (ver `db.js`).

   Paginada por página, e os filtros saem do que existe na trilha — o mesmo
   desenho de `auditoriaRoutes`, para as duas telas se lerem igual. */
const TRILHA_DA_PLATAFORMA = { tenantId: null };

adminRouter.get("/auditoria", requirePermissaoAdmin("verAuditoria"), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 40));
    const { acao, entidade, usuarioId, busca } = req.query;
    const where = {
      ...TRILHA_DA_PLATAFORMA,
      ...(acao ? { acao: String(acao) } : {}),
      ...(entidade ? { entidade: String(entidade) } : {}),
      ...(usuarioId ? { usuarioId: String(usuarioId) } : {}),
      ...(busca
        ? {
            OR: [
              { resumo: { contains: String(busca), mode: "insensitive" } },
              { usuarioNome: { contains: String(busca), mode: "insensitive" } },
              { entidadeId: String(busca) },
            ],
          }
        : {}),
    };
    /* Com o super-admin em outro banco (dev, ver `db.js`), a trilha mora nos
       dois: usuários e cargos no da plataforma, as imobiliárias mexidas pelo
       super-admin no desta instância. Lê os dois e intercala por data —
       pegar as N primeiras de cada um e cortar é a paginação certa. */
    const fontes = plataformaExterna ? [plataforma, prisma] : [plataforma];
    const lidas = await Promise.all(fontes.map((c) => Promise.all([
      c.auditoria.findMany({ where, orderBy: { createdAt: "desc" }, take: page * limit }),
      c.auditoria.count({ where }),
      c.auditoria.groupBy({
        by: ["usuarioId", "usuarioNome"],
        where: { ...TRILHA_DA_PLATAFORMA, usuarioId: { not: null } },
        _count: { usuarioId: true },
      }),
    ])));
    const registros = lidas.flatMap(([r]) => r).sort((a, b) => b.createdAt - a.createdAt).slice((page - 1) * limit, page * limit);
    const pessoas = new Map();
    for (const p of lidas.flatMap(([, , g]) => g)) {
      const atual = pessoas.get(p.usuarioId) || { id: p.usuarioId, nome: p.usuarioNome || "(sem nome)", total: 0 };
      atual.total += p._count.usuarioId;
      pessoas.set(p.usuarioId, atual);
    }
    return res.json({
      registros,
      total: lidas.reduce((t, [, n]) => t + n, 0),
      page,
      limit,
      usuarios: [...pessoas.values()].sort((a, b) => b.total - a.total),
    });
  } catch (err) {
    console.error("[GET /admin/auditoria]", err);
    return res.status(500).json({ error: "Erro ao buscar a trilha da plataforma." });
  }
});

/* ─── Avaliações ──────────────────────────────────────────────────────────────

   A nota que os usuários dão ao painel (`avaliacaoRoutes`). As mais recentes
   primeiro, paginadas no servidor, com o resumo do filtro (média e quantas de
   cada nota) e o total de NÃO LIDAS de todos os clientes — é ele que acende o
   contador do menu. Abrir a aba não marca nada como lido: é o botão. */
adminRouter.get("/avaliacoes", requirePermissaoAdmin("verAvaliacoes"), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const nota = Number(req.query.nota);
    const where = {
      ...(req.query.tenantId ? { tenantId: String(req.query.tenantId) } : {}),
      ...(nota >= 1 && nota <= 5 ? { nota } : {}),
      ...(req.query.naoLidas === "1" ? { lidaEm: null } : {}),
      ...(req.query.publicaveis === "1" ? { permitePublicar: true } : {}),
    };
    const [avaliacoes, total, porNota, naoLidas] = await Promise.all([
      prisma.avaliacao.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { tenant: { select: { id: true, name: true, slug: true } } },
      }),
      prisma.avaliacao.count({ where }),
      prisma.avaliacao.groupBy({ by: ["nota"], where: { ...where, nota: undefined }, _count: { nota: true } }),
      prisma.avaliacao.count({ where: { lidaEm: null } }),
    ]);
    const distribuicao = Object.fromEntries([1, 2, 3, 4, 5].map((n) => [n, porNota.find((p) => p.nota === n)?._count.nota || 0]));
    const respostas = Object.values(distribuicao).reduce((s, n) => s + n, 0);
    const media = respostas ? Object.entries(distribuicao).reduce((s, [n, q]) => s + Number(n) * q, 0) / respostas : null;
    return res.json({ avaliacoes, total, page, limit, naoLidas, distribuicao, media });
  } catch (err) {
    console.error("[GET /admin/avaliacoes]", err);
    return res.status(500).json({ error: "Erro ao carregar as avaliações." });
  }
});

/* Marca como lidas as `ids` do corpo, ou TODAS as não lidas sem `ids`. */
adminRouter.post("/avaliacoes/lidas", requirePermissaoAdmin("verAvaliacoes"), async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : null;
    const r = await prisma.avaliacao.updateMany({
      where: { lidaEm: null, ...(ids ? { id: { in: ids } } : {}) },
      data: { lidaEm: new Date() },
    });
    return res.json({ marcadas: r.count });
  } catch (err) {
    console.error("[POST /admin/avaliacoes/lidas]", err);
    return res.status(500).json({ error: "Erro ao marcar como lidas." });
  }
});

/* ── A parede "Por que Omnimob" ──────────────────────────────────────────────
   O que está no ar, e as duas chaves: pôr ou tirar uma avaliação real, ligar
   ou desligar um depoimento de exemplo. As regras moram em
   `services/relatosDaParede.js`; quem monta a parede (reais primeiro, exemplos
   completando as vagas) é a tela, com a mesma função da landing.
   shortcut: publicar usa a `verAvaliacoes`; uma permissão de AÇÃO própria
   exige migration no banco da plataforma (compartilhado dev/prod) — criar
   quando houver quem veja as avaliações sem dever publicá-las. */
adminRouter.get("/avaliacoes/parede", requirePermissaoAdmin("verAvaliacoes"), async (_req, res) => {
  try {
    return res.json({ limite: LIMITE_DA_PAREDE, ...(await relatosNoAr(prisma)) });
  } catch (err) {
    console.error("[GET /admin/avaliacoes/parede]", err);
    return res.status(500).json({ error: "Erro ao carregar a parede." });
  }
});

adminRouter.post("/avaliacoes/:id/parede", requirePermissaoAdmin("verAvaliacoes"), async (req, res) => {
  try {
    const publicar = Boolean(req.body?.publicar);
    const avaliacao = await prisma.avaliacao.findUnique({ where: { id: String(req.params.id) } });
    if (!avaliacao) return res.status(404).json({ error: "Avaliação não encontrada." });
    if (publicar) {
      if (!avaliacao.permitePublicar) return res.status(409).json({ error: "Quem avaliou não autorizou a publicação." });
      if (!publicavel(avaliacao)) return res.status(409).json({ error: "O texto não condiz com a nota; não vai para a landing." });
      const noAr = await prisma.avaliacao.count({ where: { publicadaEm: { not: null } } });
      if (!avaliacao.publicadaEm && noAr >= LIMITE_DA_PAREDE) {
        return res.status(409).json({ error: `A parede já tem ${LIMITE_DA_PAREDE} avaliações reais. Tire uma do ar antes.` });
      }
    }
    const atualizada = await prisma.avaliacao.update({
      where: { id: avaliacao.id },
      data: { publicadaEm: publicar ? avaliacao.publicadaEm || new Date() : null },
      select: { id: true, publicadaEm: true },
    });
    return res.json(atualizada);
  } catch (err) {
    console.error("[POST /admin/avaliacoes/:id/parede]", err);
    return res.status(500).json({ error: "Erro ao publicar a avaliação." });
  }
});

adminRouter.post("/avaliacoes/demo/:chave", requirePermissaoAdmin("verAvaliacoes"), async (req, res) => {
  try {
    const chave = String(req.params.chave).slice(0, 120);
    if (req.body?.noAr) await prisma.relatoDemoOculto.deleteMany({ where: { chave } });
    else await prisma.relatoDemoOculto.upsert({ where: { chave }, create: { chave }, update: {} });
    return res.json({ chave, noAr: Boolean(req.body?.noAr) });
  } catch (err) {
    console.error("[POST /admin/avaliacoes/demo/:chave]", err);
    return res.status(500).json({ error: "Erro ao mudar o depoimento de exemplo." });
  }
});

/* ─── Novidades ───────────────────────────────────────────────────────────────

   A revisão antes de ir para os clientes. A rotina de terça deixa o rascunho
   (`novidadeRoutes`); aqui se lê, reescreve, anexa os prints e publica. A
   regra (validação, o que cada um vê, o e-mail) é de `services/novidades.js`.
   Ver: `verNovidades`. Publicar (vai para todos os clientes, e por e-mail):
   `publicarNovidades`. */
adminRouter.get("/novidades", requirePermissaoAdmin("verNovidades"), async (_req, res) => {
  try {
    const todas = await prisma.novidade.findMany({ orderBy: { chave: "desc" } });
    return res.json({ novidades: todas.map(resumoDaNovidade) });
  } catch (err) {
    console.error("[GET /admin/novidades]", err);
    return res.status(500).json({ error: "Erro ao listar as novidades." });
  }
});

adminRouter.get("/novidades/:chave", requirePermissaoAdmin("verNovidades"), async (req, res) => {
  try {
    const n = await prisma.novidade.findUnique({ where: { chave: req.params.chave } });
    if (!n) return res.status(404).json({ error: "Novidade não encontrada." });
    return res.json({ ...resumoDaNovidade(n), conteudo: n.conteudo });
  } catch (err) {
    console.error("[GET /admin/novidades/:chave]", err);
    return res.status(500).json({ error: "Erro ao abrir a novidade." });
  }
});

/* Grava a revisão. Vale também numa publicada: corrigir um erro de digitação
   não pode exigir despublicar. Só EDITA: a semana nasce da rotina — um
   rascunho criado aqui ficava preso à semana errada, sem como sair. */
adminRouter.put("/novidades/:chave", requirePermissaoAdmin("verNovidades"), async (req, res) => {
  const { chave } = req.params;
  if (!chaveValida(chave)) return res.status(400).json({ error: "A chave é a terça da semana, em AAAA-MM-DD." });
  try {
    const conteudo = normalizarNovidade(req.body?.conteudo, chave);
    const n = await prisma.novidade.update({
      where: { chave },
      data: { conteudo, atualizadoPor: req.superAdmin.nome || req.superAdmin.email },
    });
    return res.json({ ...resumoDaNovidade(n), conteudo: n.conteudo });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    if (err.code === "P2025") return res.status(404).json({ error: "Esta semana ainda não chegou da rotina." });
    console.error("[PUT /admin/novidades/:chave]", err);
    return res.status(500).json({ error: "Erro ao salvar a novidade." });
  }
});

adminRouter.post("/novidades/:chave/publicar", requirePermissaoAdmin("publicarNovidades"), async (req, res) => {
  try {
    const r = await publicarNovidade(prisma, plataforma, req.params.chave, {
      quem: req.superAdmin.nome || req.superAdmin.email,
      email: Boolean(req.body?.email),
    });
    if (!r) return res.status(404).json({ error: "Novidade não encontrada." });
    return res.json({ ...resumoDaNovidade(r.novidade), email: r.email });
  } catch (err) {
    console.error("[POST /admin/novidades/:chave/publicar]", err);
    return res.status(500).json({ error: "Erro ao publicar." });
  }
});

/* A PUBLICAÇÃO AUTOMÁTICA: ligada, o rascunho que a rotina entrega na terça já
   sai publicado (e por e-mail, com `comEmail`), sem revisão. Ler é de quem vê
   a aba; mudar, de quem pode publicar — ligar é publicar por antecipação. */
adminRouter.get("/novidades-config", requirePermissaoAdmin("verNovidades"), async (_req, res) => {
  try {
    return res.json(await configDasNovidades(prisma));
  } catch (err) {
    console.error("[GET /admin/novidades-config]", err);
    return res.status(500).json({ error: "Erro ao ler a configuração." });
  }
});

adminRouter.put("/novidades-config", requirePermissaoAdmin("publicarNovidades"), async (req, res) => {
  try {
    const dados = {
      automatica: Boolean(req.body?.automatica),
      comEmail: req.body?.comEmail !== false,
      atualizadoPor: req.superAdmin.nome || req.superAdmin.email,
    };
    const c = await prisma.novidadeConfig.upsert({ where: { id: 1 }, update: dados, create: { id: 1, ...dados } });
    return res.json(c);
  } catch (err) {
    console.error("[PUT /admin/novidades-config]", err);
    return res.status(500).json({ error: "Erro ao salvar a configuração." });
  }
});

/* Volta a rascunho: some do comunicado e de Notas de versão. Quem já viu
   continua contado. */
adminRouter.post("/novidades/:chave/despublicar", requirePermissaoAdmin("publicarNovidades"), async (req, res) => {
  try {
    const n = await prisma.novidade.update({ where: { chave: req.params.chave }, data: { status: "RASCUNHO" } });
    return res.json(resumoDaNovidade(n));
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Novidade não encontrada." });
    console.error("[POST /admin/novidades/:chave/despublicar]", err);
    return res.status(500).json({ error: "Erro ao despublicar." });
  }
});

/* QUEM VIU: uma linha por pessoa, juntando as aberturas — primeira e última
   vez, quantas vezes, até onde foi, quanto tempo ficou e em que aparelho. */
adminRouter.get("/novidades/:chave/vistos", requirePermissaoAdmin("verNovidades"), async (req, res) => {
  try {
    const linhas = await prisma.novidadeVisto.findMany({
      where: { chave: req.params.chave, ...(req.query.tenantId ? { tenantId: String(req.query.tenantId) } : {}) },
      include: { tenant: { select: { name: true, slug: true } } },
      orderBy: { abertoEm: "asc" },
    });
    const porPessoa = new Map();
    for (const l of linhas) {
      const p = porPessoa.get(l.usuarioId) || {
        usuarioId: l.usuarioId, usuarioNome: l.usuarioNome, tenant: l.tenant,
        primeiraEm: l.abertoEm, ultimaEm: l.ultimoEm, vezes: 0, slideMax: 0, totalSlides: 0,
        chegouAoFim: false, segundos: 0, dispositivos: [], origens: [],
      };
      p.vezes += 1;
      p.ultimaEm = l.ultimoEm > p.ultimaEm ? l.ultimoEm : p.ultimaEm;
      p.slideMax = Math.max(p.slideMax, l.slideMax);
      p.totalSlides = Math.max(p.totalSlides, l.totalSlides);
      p.chegouAoFim ||= l.chegouAoFim;
      p.segundos += Math.max(0, Math.round(((l.fechadoEm || l.ultimoEm) - l.abertoEm) / 1000));
      if (l.dispositivo && !p.dispositivos.includes(l.dispositivo)) p.dispositivos.push(l.dispositivo);
      if (l.origem && !p.origens.includes(l.origem)) p.origens.push(l.origem);
      porPessoa.set(l.usuarioId, p);
    }
    const pessoas = [...porPessoa.values()].sort((a, b) => b.ultimaEm - a.ultimaEm);
    return res.json({ pessoas, total: pessoas.length });
  } catch (err) {
    console.error("[GET /admin/novidades/:chave/vistos]", err);
    return res.status(500).json({ error: "Erro ao ler quem viu." });
  }
});

/* ─── Controle de Uso ─────────────────────────────────────────────────────────
   Quem usa, quem esfriou e quem parou — tirado da trilha de auditoria, sem
   rastreamento novo. A régua mora em `services/controleDeUso.js`. */
adminRouter.get("/uso", requirePermissaoAdmin("verUso"), async (_req, res) => {
  try {
    return res.json(await controleDeUso(prisma));
  } catch (err) {
    console.error("[GET /admin/uso]", err);
    return res.status(500).json({ error: "Erro ao medir o uso." });
  }
});

/* ─── Interessados da landing ─────────────────────────────────────────────────
   Quem pediu contato comercial pelo site (`POST /public/interesse`), com o
   resultado do e-mail ao comercial — um envio que falhou aparece aqui, em vez
   de se perder. "Atendido" é a marcação de quem já ligou para a pessoa. */
adminRouter.get("/interessados", requirePermissaoAdmin("verInteressados"), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 40));
    const where = req.query.pendentes === "1" ? { atendidoEm: null } : {};
    const [interessados, total, pendentes] = await Promise.all([
      prisma.interesseComercial.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.interesseComercial.count({ where }),
      prisma.interesseComercial.count({ where: { atendidoEm: null } }),
    ]);
    return res.json({ interessados, total, pendentes, page, limit });
  } catch (err) {
    console.error("[GET /admin/interessados]", err);
    return res.status(500).json({ error: "Erro ao listar os interessados." });
  }
});

adminRouter.post("/interessados/:id/atendido", requirePermissaoAdmin("verInteressados"), async (req, res) => {
  try {
    const atendido = req.body?.atendido !== false;
    const i = await prisma.interesseComercial.update({
      where: { id: req.params.id },
      data: atendido
        ? { atendidoEm: new Date(), atendidoPor: req.superAdmin.nome || req.superAdmin.email }
        : { atendidoEm: null, atendidoPor: null },
    });
    return res.json(i);
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Interessado não encontrado." });
    console.error("[POST /admin/interessados/:id/atendido]", err);
    return res.status(500).json({ error: "Erro ao marcar como atendido." });
  }
});

/* ─── Comunicados avulsos ─────────────────────────────────────────────────────
   O aviso que não é novidade de produto, para um cliente ou para todos
   (`comunicadoRoutes`). Ver e mandar: `verComunicados`. Não se edita: um
   aviso já visto por metade da equipe não pode mudar por baixo da outra
   metade — encerra-se e manda-se outro. */
const nomesDosTenants = async (ids) =>
  new Map((await prisma.tenant.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, slug: true } })).map((t) => [t.id, t]));

adminRouter.get("/comunicados", requirePermissaoAdmin("verComunicados"), async (_req, res) => {
  try {
    const lista = await prisma.comunicado.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { _count: { select: { vistos: true } } },
    });
    const tenants = await nomesDosTenants(lista.map((c) => c.tenantId).filter(Boolean));
    return res.json({
      comunicados: lista.map(({ _count, ...c }) => ({
        ...c,
        vistos: _count.vistos,
        tenant: c.tenantId ? tenants.get(c.tenantId) || { id: c.tenantId, name: "(imobiliária removida)", slug: "" } : null,
        valendo: c.ativo && (!c.expiraEm || c.expiraEm > new Date()),
      })),
    });
  } catch (err) {
    console.error("[GET /admin/comunicados]", err);
    return res.status(500).json({ error: "Erro ao listar os comunicados." });
  }
});

adminRouter.post("/comunicados", requirePermissaoAdmin("verComunicados"), async (req, res) => {
  try {
    const titulo = String(req.body?.titulo || "").trim();
    const texto = String(req.body?.texto || "").trim();
    if (!titulo || titulo.length > 80) return res.status(400).json({ error: "O título tem de 1 a 80 caracteres." });
    if (!texto || texto.length > 1500) return res.status(400).json({ error: "O texto tem de 1 a 1500 caracteres." });
    const tenantId = req.body?.tenantId ? String(req.body.tenantId) : null;
    if (tenantId && !(await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }))) {
      return res.status(400).json({ error: "Imobiliária não encontrada." });
    }
    const expiraEm = req.body?.expiraEm ? new Date(req.body.expiraEm) : null;
    if (expiraEm && (Number.isNaN(expiraEm.getTime()) || expiraEm <= new Date())) {
      return res.status(400).json({ error: "O prazo precisa ser uma data futura." });
    }
    const c = await prisma.comunicado.create({
      data: { titulo, texto, tenantId, expiraEm, criadoPor: req.superAdmin.nome || req.superAdmin.email },
    });
    return res.status(201).json(c);
  } catch (err) {
    console.error("[POST /admin/comunicados]", err);
    return res.status(500).json({ error: "Erro ao mandar o comunicado." });
  }
});

adminRouter.post("/comunicados/:id/encerrar", requirePermissaoAdmin("verComunicados"), async (req, res) => {
  try {
    const c = await prisma.comunicado.update({ where: { id: req.params.id }, data: { ativo: false } });
    return res.json(c);
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Comunicado não encontrado." });
    console.error("[POST /admin/comunicados/:id/encerrar]", err);
    return res.status(500).json({ error: "Erro ao encerrar o comunicado." });
  }
});

/* ─── E-mails dos usuários ────────────────────────────────────────────────────
   De todos os clientes juntos: quem tem e-mail e quem usa o painel SEM ter —
   é para o e-mail que vão as Novidades e a recuperação de senha. "Usando" é
   ter sessão nos últimos 30 dias (`SessaoUsuario`). Só leitura: corrigir o
   e-mail é do administrador da imobiliária, ou da própria pessoa pelo pedido
   de e-mail do painel. */
adminRouter.get("/emails", requirePermissaoAdmin("verEmails"), async (req, res) => {
  try {
    const desde = new Date(Date.now() - 30 * 864e5);
    const where = { ativo: true, tenant: { ativo: true }, ...(req.query.tenantId ? { tenantId: String(req.query.tenantId) } : {}) };
    const [usuarios, uso] = await Promise.all([
      prisma.usuario.findMany({
        where,
        select: { id: true, nome: true, login: true, email: true, tenantId: true, cargo: { select: { descricao: true } }, tenant: { select: { name: true, slug: true } } },
        orderBy: { nome: "asc" },
      }),
      prisma.sessaoUsuario.groupBy({ by: ["usuarioId"], where: { ultimoUsoEm: { gte: desde } }, _max: { ultimoUsoEm: true } }),
    ]);
    const ultimoUso = new Map(uso.map((u) => [u.usuarioId, u._max.ultimoUsoEm]));
    const semEmail = usuarios
      .filter((u) => !u.email)
      .map((u) => ({ ...u, cargo: u.cargo?.descricao || null, ultimoUsoEm: ultimoUso.get(u.id) || null }))
      // Quem usa sem e-mail primeiro: é a pessoa que mais perde.
      .sort((a, b) => (b.ultimoUsoEm ? +new Date(b.ultimoUsoEm) : 0) - (a.ultimoUsoEm ? +new Date(a.ultimoUsoEm) : 0));
    return res.json({
      resumo: {
        usuarios: usuarios.length,
        comEmail: usuarios.length - semEmail.length,
        semEmail: semEmail.length,
        usandoSemEmail: semEmail.filter((u) => u.ultimoUsoEm).length,
      },
      semEmail,
    });
  } catch (err) {
    console.error("[GET /admin/emails]", err);
    return res.status(500).json({ error: "Erro ao listar os e-mails." });
  }
});

/* ─── Contas e acesso ─────────────────────────────────────────────────────────
   As sessões abertas (registradas no primeiro uso, `services/sessoes.js`),
   quem ainda não ativou a conta pelo convite e quem entra com o Google.
   Encerrar uma sessão é gravar o jti em `SessaoRevogada` — o mesmo "sair" do
   painel —, e a pessoa cai no login na requisição seguinte: `encerrarSessoes`. */
adminRouter.get("/acessos", requirePermissaoAdmin("verAcessos"), async (req, res) => {
  try {
    const agora = new Date();
    const doTenant = req.query.tenantId ? { tenantId: String(req.query.tenantId) } : {};
    const [sessoes, convites, google] = await Promise.all([
      prisma.sessaoUsuario.findMany({
        where: { ...doTenant, expiraEm: { gt: agora } },
        orderBy: { ultimoUsoEm: "desc" },
        take: 300,
        include: {
          usuario: { select: { nome: true, login: true, sessoesRevogadas: { select: { jti: true } } } },
          tenant: { select: { name: true, slug: true } },
        },
      }),
      prisma.usuario.findMany({
        where: { ...doTenant, ativo: true, senha: "" },
        select: { id: true, nome: true, email: true, createdAt: true, tenant: { select: { name: true, slug: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.usuario.count({ where: { ...doTenant, ativo: true, googleId: { not: null } } }),
    ]);
    const ativas = sessoes
      .filter((s) => !s.usuario.sessoesRevogadas.some((r) => r.jti === s.jti))
      .map(({ usuario, userAgent, ...s }) => ({
        ...s,
        dispositivo: dispositivoDe(userAgent),
        usuario: { id: s.usuarioId, nome: usuario.nome, login: usuario.login },
      }));
    return res.json({
      resumo: {
        sessoes: ativas.length,
        pessoas: new Set(ativas.map((s) => s.usuarioId)).size,
        convitesPendentes: convites.length,
        comGoogle: google,
      },
      sessoes: ativas,
      convites,
    });
  } catch (err) {
    console.error("[GET /admin/acessos]", err);
    return res.status(500).json({ error: "Erro ao listar os acessos." });
  }
});

adminRouter.post("/acessos/:jti/encerrar", requirePermissaoAdmin("encerrarSessoes"), async (req, res) => {
  try {
    const sessao = await prisma.sessaoUsuario.findUnique({ where: { jti: req.params.jti } });
    if (!sessao) return res.status(404).json({ error: "Sessão não encontrada." });
    await prisma.sessaoRevogada.upsert({
      where: { usuarioId_jti: { usuarioId: sessao.usuarioId, jti: sessao.jti } },
      update: {},
      create: { usuarioId: sessao.usuarioId, jti: sessao.jti, expiraEm: sessao.expiraEm },
    });
    return res.json({ encerrada: true });
  } catch (err) {
    console.error("[POST /admin/acessos/:jti/encerrar]", err);
    return res.status(500).json({ error: "Erro ao encerrar a sessão." });
  }
});
