/* ────────────────────────────────────────────────────────────────────────────
   Pedido de visita — "quero ver este imóvel dia X, de tarde".

   Não é uma agenda: ninguém marca horário em calendário nenhum. É um LEAD com
   uma pergunta a mais, e é assim de propósito. O que o interessado quer é que
   alguém ligue confirmando; o que o corretor quer é saber que este contato já
   tem dia na cabeça. Uma agenda de verdade (conflito de horário, corretor
   disponível, lembrete) continua no "não existe ainda" — e quando existir, o
   pedido daqui é o que vai alimentá-la.

   O pedido vira: `source = "visita"`, o prefixo "[Visita: 15/09/2026, à
   tarde]" na mensagem (é o que o painel e o e-mail mostram) e o texto no
   evento de criação. Data no passado ou longe demais é recusada — um pedido
   para "ontem" é erro de digitação, e para daqui a um ano é lixo.
   ──────────────────────────────────────────────────────────────────────────── */

export const PERIODOS = { manha: "de manhã", tarde: "à tarde", noite: "à noite" };
const DIAS_MAX = 90;

/** A data-calendário de hoje em São Paulo, "AAAA-MM-DD". */
function hojeSP(agora) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

/**
 * Lê e valida o pedido. Devolve `{ ok: true, data, periodo, texto }` ou
 * `{ ok: false, erro }`. `null` quando não há pedido (formulário comum).
 */
export function lerPedidoDeVisita(bruto, agora = new Date()) {
  if (!bruto || typeof bruto !== "object") return null;
  const data = String(bruto.data || "").trim();
  const periodo = String(bruto.periodo || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { ok: false, erro: "Escolha a data da visita." };
  if (!PERIODOS[periodo]) return { ok: false, erro: "Escolha o período da visita." };

  const hoje = hojeSP(agora);
  if (data < hoje) return { ok: false, erro: "A data da visita já passou." };
  const limite = new Date(agora.getTime() + DIAS_MAX * 86_400_000);
  if (data > hojeSP(limite)) return { ok: false, erro: `Escolha uma data nos próximos ${DIAS_MAX} dias.` };

  const [a, m, d] = data.split("-");
  const texto = `Visita: ${d}/${m}/${a}, ${PERIODOS[periodo]}`;
  return { ok: true, data, periodo, texto };
}
