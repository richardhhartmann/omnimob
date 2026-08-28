import { prisma } from "../db.js";

/**
 * ─── O histórico de pagamento ────────────────────────────────────────────────
 *
 * Uma porta de entrada só, `registrarPagamento`, chamada dos TRÊS lugares onde
 * dinheiro entra hoje:
 *
 *   · o webhook do Stripe, quando uma fatura é paga;
 *   · a aprovação do Pix no Mercado Pago;
 *   · a ativação manual pelo super-admin.
 *
 * Uma função e não três porque a pergunta que a tela faz é uma só — "o que já
 * paguei?" — e três gravações diferentes divergiriam no primeiro campo novo. É
 * o mesmo motivo de `fidelizarTrial` ser a única definição de "conta em dia".
 *
 * ── IDEMPOTÊNCIA ──
 * `upsert` na chave `(provedor, externoId)`. Não é zelo: o webhook do Stripe
 * reenvia o mesmo evento por horas, e no Pix a tela consulta o pagamento em
 * paralelo com o aviso do provedor — os dois caminhos chegam aqui com o mesmo
 * id. Sem a chave, o cliente veria a mesma cobrança listada três vezes e
 * concluiria que foi cobrado três vezes.
 *
 * Ativação manual não tem id externo, e no Postgres nulos não colidem entre si:
 * duas cortesias para o mesmo tenant continuam sendo duas linhas, que é o certo.
 *
 * ── O QUE ESTA CAMADA NÃO FAZ ──
 * Não libera acesso. Quem vira a chave da conta continua sendo `fidelizarTrial`,
 * e quem decide o vencimento continua sendo quem chama. Aqui só se ANOTA — e a
 * anotação nunca pode derrubar o pagamento: por isso `registrarPagamento` engole
 * o próprio erro e devolve `null`. Um histórico incompleto é um problema de
 * relatório; uma exceção aqui seria um pagamento aprovado que não libera a
 * conta.
 */

export const PROVEDORES = ["STRIPE", "MERCADO_PAGO", "MANUAL"];
export const MEIOS = ["cartao", "boleto", "pix", "manual"];
export const STATUS = ["PAGO", "PENDENTE", "FALHOU", "ESTORNADO"];

/**
 * @param {{
 *   tenantId: string, provedor: string, meio?: string|null, status?: string,
 *   valor: number|string, plano?: string|null, periodo?: string|null,
 *   cobreDe?: Date|null, cobreAte?: Date|null, externoId?: string|null,
 *   reciboUrl?: string|null, descricao?: string|null, pagoEm?: Date|null,
 * }} dados
 * @returns {Promise<object|null>} a linha gravada, ou `null` se algo falhou.
 */
export async function registrarPagamento(dados) {
  try {
    if (!dados?.tenantId || !PROVEDORES.includes(dados.provedor)) return null;

    const valor = Number(dados.valor);
    /* Valor ilegível não vira zero. Zero é um número, e um histórico com
       "R$ 0,00" ao lado de um mês pago faz o cliente perguntar o que aconteceu
       — sem que ninguém consiga responder. */
    if (!Number.isFinite(valor) || valor <= 0) return null;

    const comum = {
      meio: MEIOS.includes(dados.meio) ? dados.meio : null,
      status: STATUS.includes(dados.status) ? dados.status : "PAGO",
      valor,
      plano: dados.plano || null,
      periodo: dados.periodo || null,
      cobreDe: dados.cobreDe ? new Date(dados.cobreDe) : null,
      cobreAte: dados.cobreAte ? new Date(dados.cobreAte) : null,
      reciboUrl: dados.reciboUrl || null,
      descricao: dados.descricao ? String(dados.descricao).slice(0, 300) : null,
      pagoEm: dados.pagoEm ? new Date(dados.pagoEm) : new Date(),
    };

    /* Sem id externo não há o que casar: `create` direto. Um `upsert` com
       `externoId: null` recairia na mesma linha para sempre, e a segunda
       cortesia sobrescreveria a primeira. */
    if (!dados.externoId) {
      return await prisma.pagamento.create({
        data: { tenantId: dados.tenantId, provedor: dados.provedor, externoId: null, ...comum },
      });
    }

    return await prisma.pagamento.upsert({
      where: { provedor_externoId: { provedor: dados.provedor, externoId: String(dados.externoId) } },
      /* O reenvio ATUALIZA em vez de ignorar: um pagamento pode mudar de estado
         depois (estorno, contestação), e a linha precisa acompanhar. O que não
         pode é virar uma segunda linha. */
      update: comum,
      create: {
        tenantId: dados.tenantId,
        provedor: dados.provedor,
        externoId: String(dados.externoId),
        ...comum,
      },
    });
  } catch (erro) {
    /* Ver o cabeçalho: anotar não pode derrubar o pagamento. Fica o rastro no
       log, que é onde alguém procura quando o histórico está com um buraco. */
    console.error(
      `[pagamentos] não consegui registrar o pagamento do tenant ${dados?.tenantId}:`,
      erro.message,
    );
    return null;
  }
}

/**
 * O histórico de UMA imobiliária, do mais recente para o mais antigo.
 *
 * `tenantId` é sempre o do contexto autenticado — nunca vem do cliente. É a
 * mesma disciplina do resto do sistema, e a razão de os três vazamentos que
 * este projeto teve morarem todos na junção rota + query.
 */
export async function historicoDoTenant(tenantId, { limite = 50 } = {}) {
  if (!tenantId) return [];
  return prisma.pagamento.findMany({
    where: { tenantId },
    orderBy: { pagoEm: "desc" },
    take: Math.min(Math.max(Number(limite) || 50, 1), 200),
  });
}

/**
 * O último pagamento liquidado — é dele que sai a etiqueta "última forma
 * usada". Sem coluna nova no `Tenant`: a informação já está aqui, e duplicá-la
 * lá seria mais um campo para sair de sincronia com a verdade.
 */
export async function ultimoPagamento(tenantId) {
  if (!tenantId) return null;
  return prisma.pagamento.findFirst({
    where: { tenantId, status: "PAGO" },
    orderBy: { pagoEm: "desc" },
  });
}

/**
 * Esta conta renova SOZINHA?
 *
 * Renova quem tem assinatura recorrente no provedor. Quem pagou por cobrança
 * avulsa (o Pix) precisa voltar e gerar outro código — Pix Automático não
 * existe para nós, e é a diferença que mais confunde quem recebe o aviso de
 * vencimento ou abre a tela de cobrança.
 *
 * Na dúvida — sem assinatura e sem cobrança registrada — a resposta é NÃO, ou
 * seja, "você precisa agir". Errar para esse lado faz alguém conferir uma
 * renovação que ia acontecer de qualquer jeito; errar para o outro faz a conta
 * cair calada.
 *
 * Vive aqui, e não em cada tela, porque três lugares perguntam: o e-mail de
 * vencimento, a seção de cobrança e (em breve) o botão de antecipar.
 */
export function renovaSozinho(tenant) {
  return Boolean(tenant?.assinaturaId) && !tenant?.cobrancaProvedor;
}
