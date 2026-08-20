import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermissao } from "../middlewares/permissaoMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { limparCacheDaVitrine } from "../services/dadosDaVitrine.js";

export const usuarioRouter = Router();
usuarioRouter.use(requireAuth);
usuarioRouter.use(requireTenant);
usuarioRouter.use(requirePermissao("gerenciarUsuarios"));

usuarioRouter.get("/", async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      where: { tenantId: req.tenant.id },
      include: { cargo: true },
      orderBy: { nome: "asc" },
    });
    return res.json(usuarios);
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

usuarioRouter.post("/", async (req, res) => {
  try {
    const { nome, senha, cargoCodigo, email } = req.body;
    // Só na criação. Aplicar isto na edição renomearia logins anteriores à
    // regra (o `admin` do seed, por exemplo) e tiraria a pessoa do ar.
    const login = comSufixoDoTenant(req.body.login || "", req.tenant.slug);
    if (!nome || !login || !cargoCodigo) {
      return res.status(400).json({ error: "Nome, login e cargo são obrigatórios." });
    }
    if (!await cargoDoTenant(cargoCodigo, req.tenant.id)) {
      return res.status(400).json({ error: "Cargo não encontrado nesta imobiliária." });
    }
    // Senha é opcional na criação. Se vier, é apenas uma senha provisória; de
    // qualquer forma o usuário é obrigado a definir uma no primeiro acesso.
    const senhaHash = senha ? await bcrypt.hash(String(senha), 10) : "";
    const usuario = await prisma.usuario.create({
      data: {
        tenantId: req.tenant.id,
        nome,
        login,
        // Normaliza para null: string vazia faria a busca da recuperação de
        // senha casar dois usuários "sem e-mail" como se fossem o mesmo.
        email: String(email || "").trim().toLowerCase() || null,
        senha: senhaHash,
        cargoCodigo: Number(cargoCodigo),
        forcaAlterarSenha: true, // novos usuários sempre trocam a senha no 1º acesso
        ativo: true,
        ...camposDeVitrine(req.body),
      },
      include: { cargo: true },
    });
    limparCacheDaVitrine(req.tenant.id);
    return res.status(201).json(usuario);
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
      include: { cargo: true },
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
usuarioRouter.delete("/:id", async (req, res) => {
  try {
    const current = await prisma.usuario.findFirst({
      where: { id: req.params.id, tenantId: req.tenant.id },
    });
    if (!current) return res.status(404).json({ error: "Usuário não encontrado." });
    if (current.id === req.authUserId) {
      return res.status(400).json({ error: "Você não pode desativar o seu próprio usuário." });
    }
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
      include: { cargo: { select: { gerenciarUsuarios: true } } },
    });
    if (!alvo) return res.status(404).json({ error: "Usuário não encontrado." });

    if (alvo.id === req.authUserId) {
      return res.status(400).json({ error: "Você não pode excluir o seu próprio usuário." });
    }

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
