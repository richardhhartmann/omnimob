import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermissao } from "../middlewares/permissaoMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { PERMISSOES, alcancaOHub, CHAVES_DA_CASA } from "../services/cargosPadrao.js";

export const cargoRouter = Router();
cargoRouter.use(requireAuth);
cargoRouter.use(requireTenant);
cargoRouter.use(requirePermissao("gerenciarUsuarios", "gerenciarCargos"));

/* A lista vem de `cargosPadrao.js`, que é a canônica — a mesma que o seed usa
   para criar os cargos e que `cargoDaSessao` percorre para montar a sessão.

   Aqui havia uma CÓPIA escrita à mão, e ela ficou para trás: `verAuditoria`
   entrou na lista canônica e nunca chegou nesta. O efeito era o pior tipo de
   defeito silencioso — a tela mostrava a caixa, o clique ia para o servidor, o
   servidor respondia 200, e o laço abaixo simplesmente não tinha aquele nome
   para copiar. A permissão voltava marcada, sem erro em lugar nenhum.

   Na criação era pior ainda: `data[p] = Boolean(perms[p])` para cada nome da
   lista significa que um cargo novo nascia SEM a permissão, qualquer que fosse
   a caixa marcada na tela.

   Por isso não existe mais lista local. Permissão nova entra num lugar só. */

/* ─── O cargo que administra a casa ──────────────────────────────────────────
   Reconhecido pelo nome, e é a parte frágil desta regra: `descricao` é editável
   na tela, então renomear o cargo faz ele deixar de ser o Administrador aos
   olhos daqui. Preferi isso a uma coluna nova só para marcá-lo — mas se um dia
   o rename virar problema real, é aqui que entra a flag.

   `verConfiguracoes` não é escolha de ninguém: ela É ser o Administrador.
   Configurações reúne plano, cobrança, domínio e o cancelamento da assinatura —
   quem administra a casa precisa, e mais ninguém recebe. Por isso o campo não
   aparece na tela e o valor enviado pelo cliente é ignorado: toda gravação
   recalcula a partir do nome do cargo, o que também conserta sozinho qualquer
   linha que tenha ficado torta. */
const CARGO_ADMIN = "Administrador";
const ehAdministrador = (cargo) => cargo?.descricao === CARGO_ADMIN;

/* `acessarPainel` é derivada, e a regra mora em `cargosPadrao.js` — junto do
   catálogo, porque cargo nasce por DOIS caminhos: por esta tela e pelo
   provisionamento de uma imobiliária nova. Uma cópia aqui já custou uma
   regressão em que todo tenant novo nascia sem a porta do Hub. Ver
   `alcancaOHub`. */

/* Permissões que ninguém tira do PRÓPRIO cargo — seria se trancar do lado de
   fora, e sem ninguém com acesso para reabrir. */
const NAO_REMOVIVEIS_DO_PROPRIO = {
  acessarPainel: "Acessar Painel",
  gerenciarCargos: "Gerenciar Cargos",
};

cargoRouter.get("/", async (req, res) => {
  try {
    const cargos = await prisma.cargo.findMany({
      where: { tenantId: req.tenant.id },
      orderBy: { id: "asc" },
      include: { _count: { select: { usuarios: true } } },
    });
    /* `ehAdministrador` vai calculado, e não deduzido na tela: a regra de quem
       pode ter `verConfiguracoes` é decidida aqui, e a interface que esconde a
       caixa precisa concordar com quem recusa o PUT. Duas cópias da regra é
       exatamente como elas divergem. */
    return res.json(cargos.map((c) => ({ ...c, ehAdministrador: ehAdministrador(c) })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao listar cargos." });
  }
});

cargoRouter.post("/", async (req, res) => {
  try {
    const { descricao, ...perms } = req.body;
    if (!descricao) return res.status(400).json({ error: "Descrição é obrigatória." });

    const data = { descricao, tenantId: req.tenant.id };
    for (const p of PERMISSOES) data[p] = Boolean(perms[p]);
    /* As duas derivadas, nunca recebidas. `verConfiguracoes` vem do nome (ver
       `ehAdministrador`); `acessarPainel` é sempre true — existir como cargo já
       significa entrar no painel. */
    data.verConfiguracoes = ehAdministrador({ descricao });
    /* Na criação também: um cargo novo batizado de "Administrador" nasceria
       sem as chaves e a tela o desenharia com elas travadas e marcadas —
       mostrando um estado que o banco não tem. */
    if (ehAdministrador({ descricao })) {
      for (const chave of CHAVES_DA_CASA) data[chave] = true;
    }
    data.acessarPainel = alcancaOHub(data);

    const cargo = await prisma.cargo.create({ data });
    return res.status(201).json({ ...cargo, ehAdministrador: ehAdministrador(cargo) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao criar cargo." });
  }
});

cargoRouter.put("/:id", async (req, res) => {
  try {
    const cargoId = Number(req.params.id);

    /* `findFirst` com o tenant junto, e não `findUnique` pelo id: o id sozinho
       alcançava o cargo de QUALQUER imobiliária. Era o buraco que existia
       enquanto a tabela não tinha dono — quem soubesse um id editava permissão
       de gente de outra empresa. Fora do tenant, responde 404: não existe, para
       quem pergunta. */
    const cargo = await prisma.cargo.findFirst({
      where: { id: cargoId, tenantId: req.tenant.id },
    });
    if (!cargo) return res.status(404).json({ error: "Cargo não encontrado." });

    const { descricao, ...perms } = req.body;

    if (cargoId === req.authCargoCodigo) {
      for (const [chave, rotulo] of Object.entries(NAO_REMOVIVEIS_DO_PROPRIO)) {
        if (perms[chave] === false) {
          return res.status(400).json({
            error: `Você não pode remover a permissão '${rotulo}' do seu próprio cargo.`,
          });
        }
      }
    }

    const data = {};
    if (descricao !== undefined) data.descricao = descricao;
    for (const p of PERMISSOES) if (perms[p] !== undefined) data[p] = Boolean(perms[p]);

    /* Recalculada a cada gravação, ignorando o que veio no corpo — inclusive de
       um PUT feito à mão fora da tela. Usa o nome que a requisição está
       DEFININDO (renomear um cargo para "Administrador" o promove; renomear o
       Administrador para outra coisa o rebaixa), e não o nome antigo. */
    data.verConfiguracoes = ehAdministrador({ descricao: data.descricao ?? cargo.descricao });

    /* ── AS CHAVES DA CASA, DERIVADAS ────────────────────────────────

       Mesmo tratamento de `verConfiguracoes`, e pelo mesmo motivo: DERIVAR em
       vez de recusar. Recusar com 400 exigiria a tela adivinhar a regra para
       não mandar o que seria negado, e deixaria de pé qualquer linha que já
       tenha ficado torta. Derivando, toda gravação conserta a linha sozinha e a
       tela nunca mostra marcado o que o banco tem desmarcado.

       Vale sobre o nome RESULTANTE: renomear um cargo para "Administrador"
       entrega as chaves a ele, e renomear o Administrador para outra coisa as
       devolve. É a mesma fragilidade que o cabeçalho deste arquivo assume para
       `verConfiguracoes`, e não vale um segundo mecanismo. */
    if (ehAdministrador({ descricao: data.descricao ?? cargo.descricao })) {
      for (const chave of CHAVES_DA_CASA) data[chave] = true;
    }

    /* Derivada, e sobre o cargo INTEIRO — não só sobre o que veio no corpo.
       O PUT desta tela é parcial (um clique manda uma permissão), e olhar só o
       `data` faria um cargo perder o Hub ao desmarcar uma caixa qualquer,
       porque as outras permissões dele não estariam ali para contar.
       Ver `alcancaOHub`. */
    data.acessarPainel = alcancaOHub({ ...cargo, ...data });

    const updated = await prisma.cargo.update({ where: { id: cargoId }, data });
    return res.json({ ...updated, ehAdministrador: ehAdministrador(updated) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao atualizar cargo." });
  }
});

cargoRouter.delete("/:id", async (req, res) => {
  try {
    const cargo = await prisma.cargo.findFirst({
      where: { id: Number(req.params.id), tenantId: req.tenant.id },
      include: { _count: { select: { usuarios: true } } },
    });
    if (!cargo) return res.status(404).json({ error: "Cargo não encontrado." });

    // Sem o Administrador ninguém reabre a porta: some o acesso a Configurações
    // e à própria gestão de cargos, e não há por onde recriá-lo pela interface.
    if (ehAdministrador(cargo)) {
      return res.status(400).json({ error: "O cargo Administrador não pode ser excluído." });
    }
    if (cargo._count.usuarios > 0) {
      return res.status(400).json({ error: `Cargo está vinculado a ${cargo._count.usuarios} usuário(s). Reatribua-os antes de excluir.` });
    }
    await prisma.cargo.delete({ where: { id: cargo.id } });
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao excluir cargo." });
  }
});
