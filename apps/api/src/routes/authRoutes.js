import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { prisma } from "../db.js";
import { sendEmail } from "../services/notificationService.js";
import { emailRecuperarSenha } from "../services/emailTemplates.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { loginSchema } from "../validators/authValidators.js";
import { PERMISSOES } from "../services/cargosPadrao.js";

const JWT_SECRET = process.env.JWT_SECRET || "omnimob-dev-secret";

export const authRouter = Router();

/* O cargo que vai para a sessão, num lugar só.

   Existia escrito à mão em DOIS pontos deste arquivo (login e `/me`), e as duas
   cópias precisavam ser lembradas a cada permissão nova. Não foram: quando
   `verConfiguracoes` nasceu, ela ficou de fora das duas — o banco dizia que o
   Administrador podia ver Configurações, a sessão não carregava o campo, e o
   menu sumia. Pior, o sintoma se resolvia sozinho ao editar o cargo na tela
   (aquele caminho grava o cargo inteiro na sessão), o que faz o bug parecer
   intermitente em vez de sistemático.

   `PERMISSOES` é a mesma lista do catálogo de cargos: uma permissão nova entra
   na sessão sem ninguém precisar lembrar deste arquivo. */
function cargoDaSessao(cargo) {
  const saida = { id: cargo.id, descricao: cargo.descricao };
  for (const p of PERMISSOES) saida[p] = Boolean(cargo[p]);
  return saida;
}

// Monta o payload de sessão (token + usuario + tenant) devolvido no login e ao
// definir a senha. `usuario` deve vir com include { tenant, cargo }.
function montarSessao(usuario) {
  const token = jwt.sign(
    { userId: usuario.id, tenantId: usuario.tenantId, cargoCodigo: usuario.cargoCodigo },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  return {
    token,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      login: usuario.login,
      cargo: cargoDaSessao(usuario.cargo),
    },
    tenant: {
      id: usuario.tenant.id,
      name: usuario.tenant.name,
      slug: usuario.tenant.slug,
      whatsapp: usuario.tenant.whatsapp,
      email: usuario.tenant.email,
      description: usuario.tenant.description,
      slogan: usuario.tenant.slogan,
      logoUrl: usuario.tenant.logoUrl,
      primaryColor: usuario.tenant.primaryColor,
      secondaryColor: usuario.tenant.secondaryColor,
      showcaseHeadline: usuario.tenant.showcaseHeadline,
      showcaseSubheadline: usuario.tenant.showcaseSubheadline,
      showcaseConfig: usuario.tenant.showcaseConfig,
      plano: (usuario.tenant.plano || "BASICO").toUpperCase(),
      autoGerarIA: usuario.tenant.autoGerarIA,
      /* Endereço público da vitrine. Vai na sessão porque TODO link para ela —
         "Ver página", copiar link, o que vai no post de divulgação — precisa
         apontar para o domínio da imobiliária quando ele existe. Sem isto cada
         tela teria de buscar o domínio por conta própria, e alguma esqueceria. */
      dominioProprio: usuario.tenant.dominioProprio,
      dominioStatus: usuario.tenant.dominioStatus,
    },
  };
}

authRouter.post("/login", async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Dados invalidos para login.", details: parsed.error.flatten() });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { login: parsed.data.login },
      include: { tenant: true, cargo: true },
    });

    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ error: "Usuario ou senha invalidos." });
    }

    // Usuário recém-criado ainda pode não ter senha definida. Nesse caso o
    // primeiro acesso não valida senha: cai direto na tela de definir senha.
    const temSenha = Boolean(usuario.senha);
    if (temSenha) {
      const passwordMatch = await bcrypt.compare(parsed.data.senha, usuario.senha);
      if (!passwordMatch) {
        return res.status(401).json({ error: "Usuario ou senha invalidos." });
      }
    }

    // Sem senha (ativação) OU marcado para trocar → exige definir nova senha.
    if (!temSenha || usuario.forcaAlterarSenha) {
      return res.status(403).json({
        error: "Defina sua senha para continuar.",
        forcaAlterarSenha: true,
        login: usuario.login,
      });
    }

    return res.json(montarSessao(usuario));
  } catch (err) {
    console.error("[POST /auth/login]", err);
    return res.status(500).json({ error: "Erro interno no servidor.", detail: err.message });
  }
});

// Define uma nova senha (primeiro acesso ou troca obrigatória) e já autentica.
// Se o usuário já tiver senha, exige a senha atual; se não tiver (ativação), não.
authRouter.post("/definir-senha", async (req, res) => {
  try {
    const { login, senhaAtual, novaSenha } = req.body || {};
    if (!login || !novaSenha) {
      return res.status(400).json({ error: "Login e nova senha são obrigatórios." });
    }
    if (String(novaSenha).length < 6) {
      return res.status(400).json({ error: "A nova senha deve ter ao menos 6 caracteres." });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { login: String(login) },
      include: { tenant: true, cargo: true },
    });
    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ error: "Usuário inválido." });
    }

    // Se já existe senha, a senha atual precisa conferir (evita troca por terceiros).
    if (usuario.senha) {
      const ok = await bcrypt.compare(String(senhaAtual || ""), usuario.senha);
      if (!ok) return res.status(401).json({ error: "Senha atual incorreta." });
    }

    const senhaHash = await bcrypt.hash(String(novaSenha), 10);
    const atualizado = await prisma.usuario.update({
      where: { id: usuario.id },
      data: { senha: senhaHash, forcaAlterarSenha: false },
      include: { tenant: true, cargo: true },
    });

    return res.json(montarSessao(atualizado));
  } catch (err) {
    console.error("[POST /auth/definir-senha]", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});

authRouter.get("/me", requireAuth, requireTenant, async (req, res) => {
  try {
    const usuario = await prisma.usuario.findFirst({
      where: { id: req.authUserId, tenantId: req.tenant.id },
      include: { cargo: true },
    });
    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ error: "Sessão inválida." });
    }
    return res.json({
      id: usuario.id,
      nome: usuario.nome,
      login: usuario.login,
      cargo: cargoDaSessao(usuario.cargo),
    });
  } catch (err) {
    console.error("[GET /auth/me]", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
});

/* ─── Recuperação de senha ───────────────────────────────────────────────────
   Duas rotas: pedir o link e usar o link.

   TOKEN SEM TABELA. O link carrega um JWT curto contendo o id do usuário e uma
   IMPRESSÃO DIGITAL da senha atual. Ao redefinir, a senha muda, a impressão
   muda, e o token que sobrou no e-mail para de valer — uso único sem precisar
   guardar nada. Um link vazado depois do uso não abre nada; um link antigo
   deixa de valer assim que um novo é pedido e usado.

   Vale 1 hora. O convite de trial vale 30 minutos, mas ali a pessoa está no
   meio de um cadastro; aqui ela pode estar longe do computador.

   NÃO DIZEMOS SE A CONTA EXISTE. A resposta é a mesma para login conhecido,
   login inexistente e conta sem e-mail. Uma tela que responde "usuário não
   encontrado" é um verificador de logins válidos para quem quiser testar
   uma lista — e o login aqui é derivado do nome da imobiliária, que é público
   na vitrine. */
const VALIDADE_RECUPERACAO = "1h";
const PROPOSITO_RECUPERACAO = "recuperar-senha";

/* Deriva a impressão digital do hash da senha. É o hash de um hash: o valor não
   volta a ser a senha nem em teoria, e ainda assim muda a cada troca — que é a
   única propriedade de que precisamos. */
function impressaoDaSenha(senhaHash) {
  return crypto.createHash("sha256").update(String(senhaHash || "")).digest("hex").slice(0, 16);
}

function assinarTokenRecuperacao(usuario) {
  return jwt.sign(
    { userId: usuario.id, proposito: PROPOSITO_RECUPERACAO, fp: impressaoDaSenha(usuario.senha) },
    JWT_SECRET,
    { expiresIn: VALIDADE_RECUPERACAO },
  );
}

/**
 * Devolve o usuário do token, ou lança com `.code` explicando o motivo.
 * Um token já usado cai em TOKEN_USADO — mensagem diferente de "expirou",
 * porque a ação que a pessoa precisa tomar é outra (pedir um novo, não esperar).
 */
async function usuarioDoTokenRecuperacao(token) {
  let dados;
  try {
    dados = jwt.verify(String(token || ""), JWT_SECRET);
  } catch (erro) {
    const e = new Error(
      erro.name === "TokenExpiredError"
        ? "Este link expirou. Peça um novo."
        : "Link inválido. Peça um novo.",
    );
    e.code = erro.name === "TokenExpiredError" ? "TOKEN_EXPIRADO" : "TOKEN_INVALIDO";
    throw e;
  }

  if (dados.proposito !== PROPOSITO_RECUPERACAO) {
    const e = new Error("Link inválido. Peça um novo.");
    e.code = "TOKEN_INVALIDO";
    throw e;
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: String(dados.userId || "") },
    include: { tenant: true, cargo: true },
  });
  if (!usuario || !usuario.ativo) {
    const e = new Error("Link inválido. Peça um novo.");
    e.code = "TOKEN_INVALIDO";
    throw e;
  }

  if (dados.fp !== impressaoDaSenha(usuario.senha)) {
    const e = new Error("Este link já foi usado. Peça um novo.");
    e.code = "TOKEN_USADO";
    throw e;
  }

  return usuario;
}

authRouter.post("/recuperar-senha", async (req, res) => {
  /* Resposta única, montada antes de qualquer consulta: é o que garante que
     nenhum caminho de erro escape com uma mensagem diferente e entregue, pela
     diferença, a informação que a rota se recusa a dar. */
  const resposta = {
    ok: true,
    mensagem: "Se houver uma conta com esse acesso, enviamos um link para o e-mail cadastrado.",
  };

  try {
    const identificador = String(req.body?.identificador || "").trim();
    if (!identificador) return res.json(resposta);

    /* Aceita login ou e-mail: quem esqueceu a senha costuma não lembrar do
       login com sufixo da imobiliária ("joao-imobiliaria-centro"), e o e-mail
       é o que a pessoa sabe de cor. */
    const usuario = await prisma.usuario.findFirst({
      where: {
        ativo: true,
        OR: [
          { login: identificador },
          { email: { equals: identificador, mode: "insensitive" } },
        ],
      },
      include: { tenant: true },
    });

    if (!usuario?.email) {
      /* Sem e-mail não há para onde mandar. Fica registrado porque é acionável:
         o administrador da imobiliária precisa preencher o e-mail da pessoa na
         tela de Usuários, e sem este log ninguém fica sabendo que alguém
         tentou e não conseguiu. */
      if (usuario) {
        console.warn(`[recuperar-senha] ${usuario.login} não tem e-mail cadastrado; link não enviado.`);
      }
      return res.json(resposta);
    }

    const token = assinarTokenRecuperacao(usuario);
    const base = (process.env.APP_URL || "").trim().replace(/\/+$/, "") || "https://omnimob.app";
    const link = `${base}/redefinir-senha?token=${encodeURIComponent(token)}`;

    const modelo = emailRecuperarSenha({
      nome: usuario.nome,
      link,
      imobiliaria: usuario.tenant?.name || "",
    });

    /* O envio NÃO é aguardado antes de responder. O transporte tem teto de 10s
       por tentativa, e prender a requisição por isso faria a tela parecer
       travada — além de transformar a demora num sinal de que a conta existe. */
    sendEmail({ to: usuario.email, subject: modelo.subject, body: modelo.body, html: modelo.html })
      .catch((e) => console.error("[recuperar-senha] falha ao enviar:", e.message));

    return res.json(resposta);
  } catch (err) {
    console.error("[POST /auth/recuperar-senha]", err);
    // Mesmo em erro interno a resposta é a mesma. Ver o comentário de `resposta`.
    return res.json(resposta);
  }
});

/* Confere o link ANTES de a pessoa digitar a senha nova.
   Sem isto, ela escreveria a senha duas vezes para só então descobrir que o
   link expirou — e teria de escrever tudo de novo depois de pedir outro. */
authRouter.get("/redefinir-senha/:token", async (req, res) => {
  try {
    const usuario = await usuarioDoTokenRecuperacao(req.params.token);
    return res.json({ valido: true, nome: usuario.nome, login: usuario.login });
  } catch (err) {
    return res.status(400).json({ valido: false, error: err.message, code: err.code });
  }
});

authRouter.post("/redefinir-senha", async (req, res) => {
  try {
    const { token, novaSenha } = req.body || {};
    if (String(novaSenha || "").length < 6) {
      return res.status(400).json({ error: "A nova senha deve ter ao menos 6 caracteres." });
    }

    const usuario = await usuarioDoTokenRecuperacao(token);

    const senhaHash = await bcrypt.hash(String(novaSenha), 10);
    const atualizado = await prisma.usuario.update({
      where: { id: usuario.id },
      /* `forcaAlterarSenha: false` porque a pessoa ACABOU de escolher a senha.
         Deixar a marca de pé mandaria ela para a tela de trocar senha logo após
         ter trocado — que é o tipo de laço que faz alguém desistir de entrar. */
      data: { senha: senhaHash, forcaAlterarSenha: false },
      include: { tenant: true, cargo: true },
    });

    // Já devolve a sessão: quem redefiniu entra direto, sem passar pelo login.
    return res.json(montarSessao(atualizado));
  } catch (err) {
    if (err.code) return res.status(400).json({ error: err.message, code: err.code });
    console.error("[POST /auth/redefinir-senha]", err);
    return res.status(500).json({ error: "Erro ao redefinir a senha." });
  }
});
