/* A situação das Novidades no super-admin: o rascunho chega na terça às 15h e
   tem PRAZO_EM_DIAS para ser revisado e publicado. Os dias são os de São
   Paulo, em texto AAAA-MM-DD. Porte do `situacao.ts` do VYA. */

export const PRAZO_EM_DIAS = 7;

const SP = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
export const diaEmSaoPaulo = (d) => SP.format(new Date(d));

const somarDias = (dia, n) => {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const diasEntre = (de, ate) => Math.round((Date.parse(ate) - Date.parse(de)) / 864e5);
const br = (dia) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

/** A terça mais recente até `hoje`: a chave da semana que deveria estar no painel. */
export function tercaDaSemana(hoje) {
  const d = new Date(`${hoje}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() - 2 + 7) % 7));
  return d.toISOString().slice(0, 10);
}
export const prazoDa = (chave) => somarDias(chave, PRAZO_EM_DIAS);

/** `r` nulo = o rascunho da semana ainda não está no painel. `tom`: neutro | verde | ambar | rosa | azul. */
export function situacaoDa(chave, r, hoje) {
  const prazo = prazoDa(chave);
  if (!r) {
    // Semana sem nada para o cliente não gera rascunho, então a falta não é alarme.
    return hoje <= chave
      ? { rotulo: "Aguardando", tom: "neutro", detalhe: `O rascunho chega em ${br(chave)}, às 15h.` }
      : { rotulo: "Sem apresentação", tom: "neutro", detalhe: `Nada chegou em ${br(chave)}: a semana não teve novidade para o cliente, ou a rotina falhou.` };
  }
  if (r.status === "PUBLICADO") {
    const em = r.publicadoEm ? diaEmSaoPaulo(r.publicadoEm) : prazo;
    return em <= prazo
      ? { rotulo: "Publicado em dia", tom: "verde", detalhe: `Publicado em ${br(em)}.` }
      : { rotulo: "Publicado com atraso", tom: "ambar", detalhe: `Publicado em ${br(em)}; o prazo era ${br(prazo)}.` };
  }
  const faltam = diasEntre(hoje, prazo);
  if (faltam < 0) return { rotulo: "Atrasado", tom: "rosa", detalhe: `O prazo para publicar era ${br(prazo)} (${-faltam} ${faltam === -1 ? "dia" : "dias"} atrás).` };
  const quando = faltam === 0 ? "hoje" : `até ${br(prazo)} (${faltam === 1 ? "falta 1 dia" : `faltam ${faltam} dias`})`;
  return { rotulo: "Em dia", tom: "azul", detalhe: `Para revisar e publicar ${quando}.` };
}
