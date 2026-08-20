import jwt from "jsonwebtoken";
import { prisma } from "../db.js";
import { preencherContexto } from "../services/auditoria.js";

const JWT_SECRET = process.env.JWT_SECRET || "omnimob-dev-secret";

/* ────────────────────────────────────────────────────────────────────────────
   Autenticação: o token diz QUEM, o banco diz SE AINDA VALE.

   Antes este middleware lia tudo do próprio token — inclusive o cargo — e nunca
   consultava o banco. O token dura sete dias, e o efeito prático era este:

     • desativar um usuário não tirava o acesso dele;
     • rebaixar o cargo de Administrador para Corretor não tirava nada;
     • desligar a imobiliária inteira também não.

   Tudo isso continuava valendo até o token vencer sozinho — até uma semana
   depois de a decisão ter sido tomada. A permissão do CARGO já era relida do
   banco a cada requisição (`permissaoMiddleware`), o que tornava o buraco
   difícil de enxergar: mexer nas caixinhas de um cargo funcionava na hora, mas
   mover a PESSOA de um cargo para outro não.

   Agora o token serve só para provar identidade — dizer "sou o usuário X" com
   assinatura. Tudo que pode mudar depois da emissão (estar ativo, qual cargo,
   de qual imobiliária) vem do banco, sempre.

   ── SOBRE O CUSTO ──

   É uma consulta por requisição, pela chave primária. E ela não é somada às que
   já existiam: o cargo vem junto no mesmo `include`, e `requirePermissao` passa
   a reaproveitá-lo em vez de buscar de novo. Nas rotas com permissão — a
   maioria — o número de consultas continua o mesmo de antes.
   ──────────────────────────────────────────────────────────────────────────── */

/* ── O token de REATIVAÇÃO ───────────────────────────────────────────────────
   Conta vencida perde o painel, e é para perder mesmo. Só que o pagamento mora
   DENTRO do painel — então bloquear o login por completo trancava a pessoa do
   lado de fora justamente da tela que resolveria o problema. O e-mail de
   vencimento mandava para `/login`, e o login recusava.

   A saída é uma sessão de escopo reduzido: entra, mas só alcança duas rotas —
   ver a situação da conta e assinar. Qualquer outra recusa aqui, antes de
   chegar na regra de permissão, então nenhuma rota nova nasce alcançável por
   engano: para abrir uma para este escopo é preciso dizer isso explicitamente.
   ────────────────────────────────────────────────────────────────────────── */
export const ESCOPO_REATIVACAO = "reativar";

function autenticar({ aceitaReativacao = false } = {}) {
  return async function middlewareDeAutenticacao(req, res, next) {
    if (!aceitaReativacao) {
      const cru = req.headers.authorization?.replace("Bearer ", "");
      let escopo = null;
      try { escopo = cru ? jwt.verify(cru, JWT_SECRET).escopo : null; } catch { escopo = null; }
      if (escopo === ESCOPO_REATIVACAO) {
        return res.status(403).json({
          error: "Esta conta está suspensa. Assine um plano para voltar a usar o painel.",
          code: "SOMENTE_REATIVACAO",
        });
      }
    }
    return autenticarBase(req, res, next);
  };
}

export const requireAuth = autenticar();
/** Aceita também a sessão de escopo reduzido de uma conta vencida. */
export const requireAuthOuReativacao = autenticar({ aceitaReativacao: true });

async function autenticarBase(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "Autenticacao necessaria." });
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Token invalido ou expirado." });
  }

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: payload.userId },
      select: { id: true, nome: true, ativo: true, tenantId: true, cargoCodigo: true, cargo: true },
    });

    /* `sessaoEncerrada` no corpo, e não só o 401: o front distingue "sua sessão
       acabou" (deslogar em silêncio, é rotina) de "seu acesso foi retirado"
       (deslogar avisando). Sem a marca, quem fosse desativado no meio do dia
       veria a tela de login sem entender por quê. */
    if (!usuario || !usuario.ativo) {
      return res.status(401).json({
        error: "Seu acesso foi encerrado. Fale com o administrador da sua imobiliária.",
        sessaoEncerrada: true,
      });
    }

    /* O usuário mudou de imobiliária depois de o token sair. Raro, mas o token
       carrega o tenant antigo e todo o filtro multi-tenant sai dele. */
    if (usuario.tenantId !== payload.tenantId) {
      return res.status(401).json({ error: "Token invalido ou expirado.", sessaoEncerrada: true });
    }

    req.authUserId = usuario.id;
    req.authUserNome = usuario.nome;
    req.authTenantId = usuario.tenantId;
    // Do BANCO, não do token — é este o conserto.
    req.authCargoCodigo = usuario.cargoCodigo;
    req.authCargo = usuario.cargo;

    /* O "quem" da trilha de auditoria. Só agora se sabe — o contexto nasce
       antes de existir autenticação. Ver `services/auditoria.js`. */
    return preencherContexto(
      req,
      { usuarioId: usuario.id, usuarioNome: usuario.nome, tenantId: usuario.tenantId },
      next,
    );
  } catch (erro) {
    console.error("[requireAuth]", erro);
    return res.status(500).json({ error: "Erro ao validar a sessao." });
  }
}
