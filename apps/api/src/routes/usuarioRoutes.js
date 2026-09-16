import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermissao } from "../middlewares/permissaoMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { CARGO_ADMIN } from "../services/cargosPadrao.js";
import { limparCacheDaVitrine } from "../services/dadosDaVitrine.js";
import { isEmailEnabled, sendEmail } from "../services/notificationService.js";
import { emailConviteUsuario } from "../services/emailTemplates.js";
import { assinarTokenRecuperacao } from "./authRoutes.js";

/* ────────────────────────────────────────────────────────────────────────────
   O QUE UM USUÁRIO MOSTRA — E O QUE NUNCA SAI

   Estas rotas devolviam a LINHA INTEIRA do banco (`include: { cargo: true }`,
   sem `select`), e junto com ela ia o campo `senha`: o hash bcrypt de todo
   mundo da imobiliária, em `GET /api/usuarios`, para qualquer pessoa com
   "Gerenciar Usuários".

   Hash não é senha, mas é a matéria-prima dela: bcrypt sai da máquina do
   atacante para ser quebrado offline, sem limite de tentativas, sem rate limit
   e sem ninguém perceber. E senha de painel é reaproveitada em outros lugares.

   Iam junto os campos `google*` — identificador de outra plataforma, que não
   tem uso nenhum nesta tela.

   ── LISTA FECHADA, E NÃO UMA LISTA DE EXCLUSÃO ──

   `select` e não `omit`: com uma lista de exclusão, a próxima coluna sensível
   que alguém acrescentar ao schema (um segredo de MFA, um token de convite)
   vaza por padrão, e o vazamento é silencioso. Com lista fechada, o padrão é
   NÃO sair — e o campo novo só aparece quando alguém escreve o nome dele aqui.

   Uma projeção só para as três rotas: listar, criar e atualizar precisam
   devolver a mesma forma, senão a tela recebe um usuário com campos a mais
   numa e a menos noutra. */
const USUARIO_VISIVEL = {
  id: true,
  tenantId: true,
  cargoCodigo: true,
  nome: true,
  login: true,
  email: true,
  ativo: true,
  forcaAlterarSenha: true,
  temaPainel: true,
  foto: true,
  creci: true,
  whatsapp: true,
  exibirNaVitrine: true,
  cargoVitrine: true,
  createdAt: true,
  updatedAt: true,
  origemExterna: true,
  /* O vínculo com o Google vira um BOOLEANO. Quem administra precisa saber que
     a pessoa entra pelo Google (para não ficar procurando por que ela nunca
     define senha); o identificador, o e-mail e a foto de lá não têm uso nesta
     tela e são dado de outra plataforma. */
  googleVinculadoEm: true,
  cargo: true,
};

export const usuarioRouter = Router();
usuarioRouter.use(requireAuth);
usuarioRouter.use(requireTenant);
usuarioRouter.use(requirePermissao("gerenciarUsuarios"));

usuarioRouter.get("/", async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      where: { tenantId: req.tenant.id },
      select: { ...USUARIO_VISIVEL, senha: true },
      orderBy: { nome: "asc" },
    });
    /* `semSenha` é o que a tela usa para oferecer "Reenviar convite": conta
       que ainda não foi ativada. O hash em si nunca sai. */
    return res.json(usuarios.map(({ senha, ...u }) => ({ ...u, semSenha: !senha })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao listar usuários." });
  }
});

/* O login é único no sistema INTEIRO, não por tenant: a tela de acesso é a
   mesma para todos os clientes, e sem o sufixo o "joao" da primeira imobiliária
   impediria o "joao" da segunda de existir. Por isso todo login novo sai como
   `joao-slug-da-imobiliaria`.

   A composição também é feita no painel (que mostra o sufixo ao lado do campo),
   mas a regra vive aqui: um cadastro por fora da tela não pode furá-la. Idempo-
   tente de propósito — se o cliente já mandou o sufixo, não empilhamos outro. */
function comSufixoDoTenant(login, slug) {
  const limpo = String(login).trim();
  if (!slug) return limpo;
  const sufixo = `-${slug}`;
  return limpo.endsWith(sufixo) ? limpo : `${limpo}${sufixo}`.slice(0, 60);
}

/* O cargo tem de ser da MESMA imobiliária do usuário.

   Antes de `tb_cargo` ter dono isso nem era uma pergunta possível — os cargos
   eram de todo mundo. Agora é: um `cargoCodigo` de outra empresa criaria um
   usuário governado por permissões que esta imobiliária não vê nem controla, e
   o banco aceitaria calado, porque a chave estrangeira só olha para o cargo. */
async function cargoDoTenant(cargoCodigo, tenantId) {
  const id = Number(cargoCodigo);
  if (!Number.isInteger(id)) return null;
  return prisma.cargo.findFirst({ where: { id, tenantId }, select: { id: true } });
}

/* ── O que este usuário mostra na vitrine ────────────────────────────────────
   Os cinco campos que o widget "Equipe" lê. Normalizados aqui, e não em dois
   lugares: criar e editar precisam da MESMA regra, e a primeira divergência
   seria um WhatsApp gravado com máscara na edição e sem máscara na criação —
   o que dá dois links, um deles quebrado.

   Só entra no `data` o que veio no corpo. `undefined` é "não mexeu"; string
   vazia é "apagou", e as duas coisas precisam continuar diferentes para a
   edição parcial da tela de Usuários funcionar. */
function camposDeVitrine(corpo) {
  const data = {};
  if (corpo.foto !== undefined) data.foto = String(corpo.foto || "").trim() || null;
  if (corpo.creci !== undefined) data.creci = String(corpo.creci || "").trim() || null;
  // Só dígitos: é o que o `wa.me` aceita, e guardar "(11) 99999-9999" obrigaria
  // cada leitor a limpar de novo — um deles esqueceria.
  if (corpo.whatsapp !== undefined) data.whatsapp = String(corpo.whatsapp || "").replace(/\D/g, "");
  if (corpo.cargoVitrine !== undefined) data.cargoVitrine = String(corpo.cargoVitrine || "").trim() || null;
  if (corpo.exibirNaVitrine !== undefined) data.exibirNaVitrine = Boolean(corpo.exibirNaVitrine);
  return data;
}

/* ── O CONVITE ───────────────────────────────────────────────────────────────
   Usuário novo nasce SEM senha, e a senha só nasce pelo link deste e-mail. É
   a mesma mecânica do "esqueci a senha" (token de uso único com a impressão
   digital da senha atual — que aqui é vazia) e do convite do super-admin.

   Por que por e-mail, e não "define no primeiro acesso": o primeiro acesso
   sem senha aceitava a senha de QUEM CHEGASSE PRIMEIRO com o login — e o
   login é previsível (nome + slug). O link só chega ao dono do endereço.

   Sem transporte de e-mail (dev), o link volta na resposta para a tela
   mostrar; com transporte, NUNCA volta — quem cadastra não pode escolher a
   senha da outra pessoa. */
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function enviarConvite(usuario, { tenant, convidadoPor }) {
  const token = assinarTokenRecuperacao(usuario, { validade: "24h" });
  const base = (process.env.APP_URL || "").trim().replace(/\/+$/, "") || "https://omnimob.app";
  const link = `${base}/redefinir-senha?token=${encodeURIComponent(token)}&convite=1`;

  if (!isEmailEnabled()) {
    console.warn(`[usuarios/convite] sem transporte de e-mail; link para ${usuario.email}: ${link}`);
    return { enviado: false, link };
  }
  const modelo = emailConviteUsuario({
    nome: usuario.nome,
    link,
    convidadoPor,
    imobiliaria: tenant.name,
    cargo: usuario.cargo?.descricao || "",
  });
  // Disparado e esquecido: o transporte tem teto de 10 s, e prender a criação
  // do usuário por isso deixaria a tela travada. Falha vai para o log.
  sendEmail({ to: usuario.email, subject: modelo.subject, body: modelo.body, html: modelo.html })
    .catch((e) => console.error("[usuarios/convite] falha ao enviar:", e.message));
  return { enviado: true, link: null };
}

/* Reenviar o convite: para quem perdeu o e-mail ou deixou o link vencer. Só
   para conta ainda SEM senha — para quem já tem, o caminho é o "esqueci a
   senha", que a própria pessoa aciona. Gera um link novo; o antigo, se ainda
   valia, continua valendo até a senha nascer (a impressão é da senha vazia). */
usuarioRouter.post("/:id/convite", async (req, res) => {
  try {
    const usuario = await prisma.usuario.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      select: { ...USUARIO_VISIVEL, senha: true, cargo: { select: { descricao: true } } },
    });
    if (!usuario) return res.status(404).json({ error: "Usuário não encontrado." });
    if (!usuario.ativo) return res.status(400).json({ error: "Reative o usuário antes de reenviar o convite." });
    if (usuario.senha) return res.status(400).json({ error: "Esta conta já tem senha. Quem esqueceu usa o \"esqueci a senha\" na tela de entrada." });
    if (!usuario.email) return res.status(400).json({ error: "Este usuário não tem e-mail. Preencha o e-mail e tente de novo." });
    const convite = await enviarConvite(usuario, { tenant: req.tenant, convidadoPor: req.authUserNome || "O administrador" });
    return res.json({ convite });
  } catch (err) {
    console.error("[POST /usuarios/:id/convite]", err);
    return res.status(500).json({ error: "Erro ao reenviar o convite." });
  }
});

usuarioRouter.post("/", async (req, res) => {
  try {
    const { nome, cargoCodigo } = req.body;
    const email = String(req.body.email || "").trim().toLowerCase();
    // Só na criação. Aplicar isto na edição renomearia logins anteriores à
    // regra (o `admin` do seed, por exemplo) e tiraria a pessoa do ar.
    const login = comSufixoDoTenant(req.body.login || "", req.tenant.slug);
    if (!nome || !login || !cargoCodigo) {
      return res.status(400).json({ error: "Nome, login e cargo são obrigatórios." });
    }
    /* Obrigatório porque é por ele que a conta é ATIVADA. Sem e-mail não há
       como a pessoa criar a senha — e não há outro caminho de propósito. */
    if (!EMAIL_VALIDO.test(email)) {
      return res.status(400).json({ error: "Informe um e-mail válido: é por ele que a pessoa cria a senha e entra." });
    }
    if (!await cargoDoTenant(cargoCodigo, req.tenant.id)) {
      return res.status(400).json({ error: "Cargo não encontrado nesta imobiliária." });
    }
    const usuario = await prisma.usuario.create({
      data: {
        tenantId: req.tenant.id,
        nome,
        login,
        email,
        senha: "", // nasce sem senha; ver `enviarConvite`
        cargoCodigo: Number(cargoCodigo),
        forcaAlterarSenha: false, // a senha que o link cria já é a definitiva
        ativo: true,
        ...camposDeVitrine(req.body),
      },
      select: { ...USUARIO_VISIVEL, senha: true, cargo: { select: { descricao: true } } },
    });
    limparCacheDaVitrine(req.tenant.id);
    const convite = await enviarConvite(usuario, { tenant: req.tenant, convidadoPor: req.authUserNome || "O administrador" });
    const { senha: _senha, cargo: _cargo, ...visivel } = usuario;
    return res.status(201).json({ ...visivel, semSenha: true, convite });
  } catch (err) {
    if (err.code === "P2002") return res.status(400).json({ error: "Login já está em uso." });
    console.error(err);
    return res.status(500).json({ error: "Erro ao criar usuário." });
  }
});

usuarioRouter.put("/:id", async (req, res) => {
  try {
    const current = await prisma.usuario.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
    });
    if (!current) return res.status(404).json({ error: "Usuário não encontrado." });

    // A senha NÃO pode ser alterada diretamente pelo painel. Para forçar uma
    // troca, use a flag forcaAlterarSenha (o usuário define a nova no acesso).
    const { nome, login, cargoCodigo, ativo, forcaAlterarSenha, email } = req.body;

    // Desativar a si mesmo é a única forma de um tenant ficar sem ninguém que
    // consiga entrar. O painel já esconde o campo; aqui é a trava de verdade.
    if (ativo === false && current.id === req.authUserId) {
      return res.status(400).json({ error: "Você não pode desativar o seu próprio usuário." });
    }

    if (cargoCodigo !== undefined && !await cargoDoTenant(cargoCodigo, req.tenant.id)) {
      return res.status(400).json({ error: "Cargo não encontrado nesta imobiliária." });
    }

    const data = {};
    if (nome !== undefined) data.nome = nome;
    if (login !== undefined) data.login = login;
    if (email !== undefined) data.email = String(email || "").trim().toLowerCase() || null;
    if (cargoCodigo !== undefined) data.cargoCodigo = Number(cargoCodigo);
    if (ativo !== undefined) data.ativo = Boolean(ativo);
    if (forcaAlterarSenha !== undefined) data.forcaAlterarSenha = Boolean(forcaAlterarSenha);
    Object.assign(data, camposDeVitrine(req.body));

    const usuario = await prisma.usuario.update({
      where: { id: req.params.id },
      data,
      select: USUARIO_VISIVEL,
    });
    limparCacheDaVitrine(req.tenant.id);
    return res.json(usuario);
  } catch (err) {
    if (err.code === "P2002") return res.status(400).json({ error: "Login já está em uso." });
    console.error(err);
    return res.status(500).json({ error: "Erro ao atualizar usuário." });
  }
});

/* DESATIVAR — o caminho reversível, e o que o painel oferece primeiro.
   Mantido em DELETE /:id por já ser o contrato usado pelo front. */

/* ── A CONTA NÃO PODE FICAR SEM ADMINISTRADOR ────────────────────────────────

   Duas recusas, e as duas existem porque o estrago é do tipo que só se descobre
   do lado de fora da porta trancada.

   1. O ÚLTIMO Administrador ativo. Sem ninguém nesse cargo some o acesso a
      Configurações e à gestão de cargos — e `verConfiguracoes` é DERIVADA do
      nome do cargo, então não há como devolvê-la pela interface. A checagem que
      já existia aqui olhava `gerenciarUsuarios`, e ela não fecha o buraco: o
      cargo Gerente também tem essa permissão, então dava para apagar o último
      Administrador e continuar com "um gestor" — sem Configurações para
      ninguém.

   2. O PRIMEIRO Administrador, a conta que nasceu com a imobiliária. É a conta
      que responde pelo tenant: a que recebe a cobrança, a que o suporte reemite
      senha, a que o super-admin usa para entrar. Outro administrador apagá-la,
      por engano ou não, é o cenário que o pedido descreve.

      Reconhecida pela mais antiga com o cargo Administrador — não há coluna
      marcando-a, e criar uma exigiria migração para uma regra que a data já
      responde. Quem quiser reaproveitar a conta troca nome, login e senha; o
      que não dá é apagá-la.
   ────────────────────────────────────────────────────────────────────────── */
async function recusaPorSerAdministrador(tenantId, alvo) {
  const ehAdmin = alvo?.cargo?.descricao === CARGO_ADMIN;
  if (!ehAdmin) return null;

  const primeiro = await prisma.usuario.findFirst({
    where: { tenantId, cargo: { descricao: CARGO_ADMIN } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (primeiro?.id === alvo.id) {
    return (
      "Esta é a conta de Administrador que nasceu com a imobiliária, e ela não pode ser " +
      "removida. Se ela mudou de dono, troque o nome, o login e a senha em vez de excluí-la."
    );
  }

  const outros = await prisma.usuario.count({
    where: { tenantId, ativo: true, id: { not: alvo.id }, cargo: { descricao: CARGO_ADMIN } },
  });
  if (outros === 0) {
    return (
      "Este é o único Administrador ativo. Sem ele, ninguém alcança Configurações nem a " +
      "gestão de cargos — e não há como devolver esse acesso pela interface. Promova outra " +
      "pessoa a Administrador antes."
    );
  }
  return null;
}

usuarioRouter.delete("/:id", async (req, res) => {
  try {
    const current = await prisma.usuario.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      include: { cargo: { select: { descricao: true } } },
    });
    if (!current) return res.status(404).json({ error: "Usuário não encontrado." });
    if (current.id === req.authUserId) {
      return res.status(400).json({ error: "Você não pode desativar o seu próprio usuário." });
    }
    /* Desativar tranca a porta do mesmo jeito que excluir: quem está inativo
       não entra, e a conta continua sem Administrador. */
    const recusa = await recusaPorSerAdministrador(req.tenant.id, current);
    if (recusa) return res.status(400).json({ error: recusa });
    await prisma.usuario.update({ where: { id: req.params.id }, data: { ativo: false } });
    // Desativado sai da vitrine junto: a consulta da equipe filtra por `ativo`.
    limparCacheDaVitrine(req.tenant.id);
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao desativar usuário." });
  }
});

/* EXCLUIR de vez — apaga a linha. Rota própria, e não um parâmetro do DELETE
   acima, porque as duas ações têm consequências diferentes demais para
   dependerem de alguém lembrar de mandar uma flag.

   Três recusas, todas por motivo concreto:

   1. Você mesmo. Mesma regra da desativação — sem volta, e ainda pior.

   2. O último acesso de gestão. Apagar o único usuário que administra o tenant
      deixa a imobiliária sem ninguém capaz de criar outro. É o tipo de porta
      que só se descobre trancada do lado de fora.

   3. Histórico. `Venda.usuario` é onDelete: Restrict de propósito — venda
      registrada guarda QUEM vendeu, e apagar o corretor faria a comissão dele
      apontar para o vazio. Aqui o banco recusaria de qualquer forma (P2003);
      checar antes é só para devolver uma frase que explica em vez de um 500. */
usuarioRouter.delete("/:id/permanente", async (req, res) => {
  try {
    const alvo = await prisma.usuario.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
      include: { cargo: { select: { gerenciarUsuarios: true, descricao: true } } },
    });
    if (!alvo) return res.status(404).json({ error: "Usuário não encontrado." });

    if (alvo.id === req.authUserId) {
      return res.status(400).json({ error: "Você não pode excluir o seu próprio usuário." });
    }

    const recusaAdmin = await recusaPorSerAdministrador(req.tenant.id, alvo);
    if (recusaAdmin) return res.status(400).json({ error: recusaAdmin });

    if (alvo.cargo?.gerenciarUsuarios) {
      const outrosGestores = await prisma.usuario.count({
        where: {
          tenantId: req.tenant.id,
          ativo: true,
          id: { not: alvo.id },
          cargo: { gerenciarUsuarios: true },
        },
      });
      if (outrosGestores === 0) {
        return res.status(400).json({
          error: "Este é o único usuário que pode gerenciar a equipe. Promova outra pessoa antes de excluí-lo.",
        });
      }
    }

    const vendas = await prisma.venda.count({ where: { usuarioId: alvo.id } });
    if (vendas > 0) {
      return res.status(409).json({
        error: `Este usuário tem ${vendas} ${vendas === 1 ? "venda registrada" : "vendas registradas"} no histórico e não pode ser excluído. Desative-o: ele perde o acesso e o histórico continua de pé.`,
        code: "TEM_HISTORICO",
      });
    }

    await prisma.usuario.delete({ where: { id: alvo.id } });
    limparCacheDaVitrine(req.tenant.id);
    return res.status(204).send();
  } catch (err) {
    // Rede de segurança para qualquer vínculo que venha a existir depois desta
    // rota ter sido escrita: melhor a frase certa que um 500 sem explicação.
    if (err.code === "P2003") {
      return res.status(409).json({
        error: "Este usuário tem registros vinculados e não pode ser excluído. Desative-o em vez disso.",
        code: "TEM_HISTORICO",
      });
    }
    console.error(err);
    return res.status(500).json({ error: "Erro ao excluir usuário." });
  }
});
