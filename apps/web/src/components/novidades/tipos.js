/* O conteúdo das Novidades: o mesmo de `docs/novidades/exemplo/conteudo.json`,
   validado no servidor por `api/services/novidades.js`. A chave (`mes`) é a
   terça em que a semana fecha (AAAA-MM-DD). */

/** novo e melhoria têm página própria; correcao e mudanca entram em listas no fim. */
export const ROTULO_DO_TIPO = { novo: "Novo", melhoria: "Melhorou", correcao: "Corrigido", mudanca: "Mudou de lugar" };
export const temPagina = (i) => (i.tipo ?? "novo") === "novo" || i.tipo === "melhoria";
export const printsDe = (i) => (Array.isArray(i.print) ? i.print : i.print ? [i.print] : []);

const br = (dia) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const semanaAntes = (dia) => {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
};
/** "semana de 27/10 a 03/11". */
export const rotuloDaSemana = (chave) => `semana de ${br(semanaAntes(chave))} a ${br(chave)}`;
/** Os textos do período no slide e no PPTX. */
export const rotulosDoPeriodo = (chave) => ({ de: `da ${rotuloDaSemana(chave)}`, quando: "nesta semana", capa: "NOVIDADES DA SEMANA" });
