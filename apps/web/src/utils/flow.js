/* ────────────────────────────────────────────────────────────────────────────
   O vocabulário do Flow, do lado da tela.

   Espelho de `apps/api/src/services/flow/funil.js`. A ordem dos estágios, os
   rótulos e as cores vivem aqui porque quatro telas os desenham (funil, lista,
   negócio, validação) e uma cópia por tela é como a grade de imóveis e o cartão
   do editor divergiram — o mesmo defeito, em outro canto do produto.

   A REGRA continua sendo do servidor: o que pode virar GANHO é decidido lá, e
   esta lista não sabe nada sobre isso. Aqui é só desenho e ordem.
   ──────────────────────────────────────────────────────────────────────────── */

/* ── A cor de cada estágio ────────────────────────────────────────────────────

   Uma rampa fria→quente ao longo do funil, e não sete cores decorativas. Ela
   carrega informação: quanto mais quente, mais perto de fechar. Um funil
   colorido por gosto obriga a ler os títulos para saber a ordem, e a leitura de
   relance é o que um kanban existe para dar.

   GANHO em verde e PERDIDO em cinza (e não vermelho): perda é desfecho normal
   da operação, não erro. Vermelho num terço dos cartões faz a tela parecer um
   painel de alarmes e ensina a ignorar o vermelho de verdade. */
export const ESTAGIOS_FLOW = [
  { key: "LEAD", rotulo: "Lead", cor: "#64748b", descricao: "Chegou e ainda não foi atendido." },
  { key: "CONTATO", rotulo: "Contato", cor: "#0ea5e9", descricao: "Alguém já falou com a pessoa." },
  { key: "VISITA", rotulo: "Visita", cor: "#6366f1", descricao: "Visita marcada ou feita." },
  { key: "PROPOSTA", rotulo: "Proposta", cor: "#8b5cf6", descricao: "Há um valor na mesa." },
  { key: "NEGOCIACAO", rotulo: "Negociação", cor: "#d946ef", descricao: "As partes estão ajustando." },
  { key: "APROVACAO", rotulo: "Aprovação", cor: "#f59e0b", descricao: "Documentação em conferência." },
  { key: "GANHO", rotulo: "Ganho", cor: "#10b981", descricao: "Fechado e comissionado." },
];

export const ESTAGIO_PERDIDO = {
  key: "PERDIDO", rotulo: "Perdido", cor: "#475569", descricao: "Não avançou.",
};

/** Todos, com o PERDIDO no fim. Ele fica fora do array principal porque o funil
 *  não o desenha como coluna: ele é um destino, não uma etapa. */
export const TODOS_ESTAGIOS_FLOW = [...ESTAGIOS_FLOW, ESTAGIO_PERDIDO];

export function estagioInfo(key) {
  return TODOS_ESTAGIOS_FLOW.find((e) => e.key === key) || ESTAGIOS_FLOW[0];
}

/** Estágios em que a conferência documental faz sentido. Espelho de
 *  `ESTAGIOS_EM_FECHAMENTO` no servidor. */
export const EM_FECHAMENTO = ["PROPOSTA", "NEGOCIACAO", "APROVACAO"];

export const CANAIS_FLOW = [
  { key: "ZAP", rotulo: "ZAP Imóveis" },
  { key: "VIVAREAL", rotulo: "VivaReal" },
  { key: "OLX", rotulo: "OLX Imóveis" },
  { key: "MERCADOLIVRE", rotulo: "Mercado Livre" },
  { key: "FACEBOOK", rotulo: "Facebook" },
  { key: "INSTAGRAM", rotulo: "Instagram" },
  { key: "WHATSAPP", rotulo: "WhatsApp" },
  { key: "SITE", rotulo: "Site / Vitrine" },
  { key: "INDICACAO", rotulo: "Indicação" },
  { key: "OUTRO", rotulo: "Outro" },
];

export function canalRotulo(key) {
  return CANAIS_FLOW.find((c) => c.key === key)?.rotulo || key || "—";
}

export const TIPOS_DOCUMENTO = [
  { key: "RG", rotulo: "RG" },
  { key: "CPF", rotulo: "CPF" },
  { key: "CNPJ", rotulo: "CNPJ" },
  { key: "COMPROVANTE_RENDA", rotulo: "Comprovante de renda" },
  { key: "COMPROVANTE_RESIDENCIA", rotulo: "Comprovante de residência" },
  { key: "CERTIDAO_ESTADO_CIVIL", rotulo: "Certidão de estado civil" },
  { key: "MATRICULA_IMOVEL", rotulo: "Matrícula do imóvel" },
  { key: "IPTU", rotulo: "IPTU" },
  { key: "CONTRATO_SOCIAL", rotulo: "Contrato social" },
  { key: "PROCURACAO", rotulo: "Procuração" },
  { key: "OUTRO", rotulo: "Outro" },
];

export const PAPEIS_SIGNATARIO = [
  { key: "COMPRADOR", rotulo: "Comprador" },
  { key: "VENDEDOR", rotulo: "Vendedor" },
  { key: "IMOBILIARIA", rotulo: "Imobiliária" },
  { key: "TESTEMUNHA", rotulo: "Testemunha" },
  { key: "FIADOR", rotulo: "Fiador" },
  { key: "PROCURADOR", rotulo: "Procurador" },
];

export const STATUS_CONTRATO = {
  RASCUNHO: { rotulo: "Rascunho", cor: "#64748b" },
  ENVIADO: { rotulo: "Aguardando assinatura", cor: "#f59e0b" },
  PARCIAL: { rotulo: "Parcialmente assinado", cor: "#0ea5e9" },
  ASSINADO: { rotulo: "Assinado", cor: "#10b981" },
  RECUSADO: { rotulo: "Recusado", cor: "#ef4444" },
  CANCELADO: { rotulo: "Cancelado", cor: "#475569" },
  EXPIRADO: { rotulo: "Expirado", cor: "#475569" },
};

/* ── Dinheiro na tela ─────────────────────────────────────────────────────────
   `Intl` com locale cravado em pt-BR e não o do navegador: o valor de um
   negócio brasileiro não muda de formato porque a pessoa está com o Windows em
   inglês. Nulo vira travessão — número que não existe não é zero, que é a mesma
   regra de `dadosDaVitrine.js`. */
export function reais(v, { curto = false } = {}) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  if (curto && Math.abs(n) >= 1000) {
    /* Em cartão de kanban não cabe "R$ 1.250.000,00". `1,25 mi` cabe e diz a
       mesma coisa para quem está varrendo a coluna com o olho. */
    if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
    return `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  }
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function dataCurta(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

/** "há 3 dias". O tempo desde o último toque é o que denuncia negócio
 *  esquecido, e "12/08/26" não denuncia nada — ninguém faz a subtração de
 *  cabeça enquanto varre uma coluna. */
export function desdeQuando(d) {
  if (!d) return null;
  const dias = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? "há 1 mês" : `há ${meses} meses`;
}
