import { Prisma } from "@prisma/client";

/* ────────────────────────────────────────────────────────────────────────────
   O SPLIT DE COMISSÃO.

   ── QUANDO ELE ACONTECE ──

   No instante em que o negócio entra em GANHO — que, pela trava do funil, só
   acontece com jurídico e financeiro validados e contrato assinado. Não é um
   botão "calcular comissão": um cálculo que depende de alguém lembrar de
   apertar é um cálculo que vai faltar no fechamento do mês.

   ── POR QUE OS VALORES SÃO GRAVADOS E NÃO CALCULADOS NA LEITURA ──

   Porque a política muda. A imobiliária passa de 6% para 5% em janeiro e o
   negócio fechado em novembro não pode mudar junto — quem recebeu já recebeu, e
   um relatório de comissão que reescreve o passado é pior que relatório nenhum:
   ele faz a conta do corretor não bater com o contracheque dele, e ninguém
   descobre por quê.

   Por isso os PERCENTUAIS também são copiados. Guardar só os valores em reais
   deixaria a conta sem memória de como foi feita, e a primeira contestação
   ("por que eu recebi isso?") não teria resposta.

   ── ARITMÉTICA EM DECIMAL, NÃO EM FLOAT ──

   `Prisma.Decimal` do começo ao fim. Comissão de 6% sobre R$ 847.300,00 em
   ponto flutuante dá 50838.000000000007, e a diferença aparece no relatório
   como um centavo que não fecha. Aqui não é preciosismo: é dinheiro de outra
   pessoa, e a soma das partes tem que dar exatamente o total.

   O arredondamento é feito UMA vez, no fim de cada parcela, e a parcela da
   imobiliária é o RESTO — nunca um segundo arredondamento. Arredondar as duas
   independentemente faz `imobiliaria + corretor` estourar o total em um centavo
   com frequência incômoda.
   ──────────────────────────────────────────────────────────────────────────── */

/* ── Decimal tolerante ────────────────────────────────────────────────────────
   `new Prisma.Decimal("")` LANÇA `[DecimalError] Invalid argument`, e string
   vazia é exatamente o que chega de um campo de formulário deixado em branco —
   `valorProposta: ""` é o caso mais comum do módulo, não uma borda exótica.

   Também cobre o que não é número ("abc", NaN, objeto): tudo vira zero. Numa
   função de dinheiro, um valor ilegível é "não há valor", e não uma exceção que
   derruba o fechamento do negócio no meio. Quem valida a entrada é o Zod da
   rota; aqui a regra é nunca explodir. */
const D = (v) => {
  if (v === null || v === undefined || v === "") return new Prisma.Decimal(0);
  try {
    const d = new Prisma.Decimal(v);
    return d.isNaN() ? new Prisma.Decimal(0) : d;
  } catch {
    return new Prisma.Decimal(0);
  }
};
const CEM = new Prisma.Decimal(100);

/** Percentual padrão do mercado brasileiro, e o que o schema já usa de default.
 *  Vive aqui também porque um negócio pode nascer antes de alguém abrir
 *  Configurações, e cair em zero produziria comissão zero em silêncio. */
export const PADRAO_COMISSAO = 6;
export const PADRAO_CORRETOR = 50;

/**
 * Calcula o split. Função PURA: não lê o banco, não escreve nada, e por isso é
 * a mesma conta que a tela usa para pré-visualizar antes de fechar.
 *
 * @param {object} entrada
 * @param {number|string} entrada.valor            valor fechado do negócio
 * @param {number|string} entrada.percentual       % de comissão sobre o valor
 * @param {number|string} entrada.percentualCorretor % DA COMISSÃO que vai ao corretor
 * @returns {{ total, imobiliaria, corretor, percentual, percentualCorretor }} tudo Decimal
 */
export function calcularSplit({ valor, percentual, percentualCorretor }) {
  const base = D(valor);
  const perc = D(percentual ?? PADRAO_COMISSAO);
  const percCorretor = D(percentualCorretor ?? PADRAO_CORRETOR);

  /* Valor negativo ou zero não é erro de digitação a ser corrigido aqui — é
     negócio sem valor fechado, e a resposta certa é comissão zerada em vez de
     um número negativo entrando no relatório da equipe. */
  if (base.lte(0)) {
    return {
      total: D(0), imobiliaria: D(0), corretor: D(0),
      percentual: perc, percentualCorretor: percCorretor,
    };
  }

  const total = base.mul(perc).div(CEM).toDecimalPlaces(2);
  const corretor = total.mul(percCorretor).div(CEM).toDecimalPlaces(2);
  /* O RESTO, e não um segundo arredondamento. É o que garante
     `imobiliaria + corretor === total`, sempre, sem o centavo fantasma. */
  const imobiliaria = total.sub(corretor);

  return { total, imobiliaria, corretor, percentual: perc, percentualCorretor: percCorretor };
}

/**
 * O `data` do update que congela o split no negócio.
 *
 * Recebe o negócio e o tenant e resolve a precedência num lugar só: o
 * percentual DO NEGÓCIO ganha do padrão da casa, e o padrão da casa ganha da
 * constante. Um negócio pode ter combinado 4% com o proprietário, e a tela
 * permite digitar isso — sem esta precedência, o cálculo automático apagaria a
 * combinação na hora de fechar.
 */
export function dadosDoSplit(negocio, tenant) {
  const percentual = negocio.comissaoPercentual ?? tenant?.comissaoPercentual ?? PADRAO_COMISSAO;
  const percentualCorretor =
    negocio.comissaoCorretorPerc ?? tenant?.comissaoCorretorPerc ?? PADRAO_CORRETOR;

  const split = calcularSplit({
    valor: negocio.valorFechado ?? negocio.valorProposta,
    percentual,
    percentualCorretor,
  });

  return {
    comissaoPercentual: split.percentual,
    comissaoCorretorPerc: split.percentualCorretor,
    comissaoTotal: split.total,
    comissaoImobiliaria: split.imobiliaria,
    comissaoCorretor: split.corretor,
    comissaoCalculadaEm: new Date(),
  };
}

/** Para o texto do evento no histórico. Reais em pt-BR, sem depender de
 *  Intl com locale do servidor — que em produção é o do Render, não o do
 *  cliente. */
export function emReais(decimal) {
  const n = Number(decimal ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
