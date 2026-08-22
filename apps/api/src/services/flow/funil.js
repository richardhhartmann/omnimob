/* ────────────────────────────────────────────────────────────────────────────
   O FUNIL DO FLOW — a regra de para onde um negócio pode ir.

   ── POR QUE ISTO É UM SERVIÇO, E NÃO UM `if` NA ROTA ──

   Porque a trava do fechamento é a razão de o módulo existir. "Não muda para
   GANHO sem jurídico e financeiro" precisa valer para a tela do funil (arrastar
   o cartão), para a tela do negócio (o seletor de estágio), para a API pública
   da imobiliária e para a rota que ainda não foi escrita. Três cópias da regra
   viram três regras diferentes na primeira vez que uma delas muda — e a que vai
   ficar desatualizada é sempre a que ninguém lembra que existe.

   ── O QUE TRAVA E O QUE NÃO TRAVA ──

   Só a entrada em GANHO é travada. O resto do funil é LIVRE, nos dois sentidos:
   negócio volta de PROPOSTA para CONTATO o tempo todo (o cliente sumiu, voltou,
   pediu outro imóvel), e um funil que só anda para a frente obriga o corretor a
   mentir sobre onde o negócio está. Dado errado por rigidez é pior que dado
   impreciso — o segundo a imobiliária sabe interpretar.

   PERDIDO é alcançável de qualquer lugar e sem cerimônia. Dificultar registrar
   uma perda é a forma mais barata de não ter nenhuma perda registrada.
   ──────────────────────────────────────────────────────────────────────────── */

export const ESTAGIOS = [
  "LEAD",
  "CONTATO",
  "VISITA",
  "PROPOSTA",
  "NEGOCIACAO",
  "APROVACAO",
  "GANHO",
];

/** Fora da sequência de propósito — ver o cabeçalho. */
export const ESTAGIO_PERDIDO = "PERDIDO";

export const TODOS_OS_ESTAGIOS = [...ESTAGIOS, ESTAGIO_PERDIDO];

export const ROTULO_ESTAGIO = {
  LEAD: "Lead",
  CONTATO: "Contato",
  VISITA: "Visita",
  PROPOSTA: "Proposta",
  NEGOCIACAO: "Negociação",
  APROVACAO: "Aprovação",
  GANHO: "Ganho",
  PERDIDO: "Perdido",
};

/** Estágio a partir do qual o negócio conta como "em fechamento": é daqui que a
 *  conferência documental começa a fazer sentido, e é o que a fila de validação
 *  lista. Antes de PROPOSTA não há o que conferir — não existe negócio ainda. */
export const ESTAGIOS_EM_FECHAMENTO = ["PROPOSTA", "NEGOCIACAO", "APROVACAO"];

export function ehEstagioValido(e) {
  return TODOS_OS_ESTAGIOS.includes(e);
}

/** Negócio encerrado não anda mais sozinho — nem por engano de arrastar. */
export function estaEncerrado(estagio) {
  return estagio === "GANHO" || estagio === ESTAGIO_PERDIDO;
}

/* ── A TRAVA ──────────────────────────────────────────────────────────────────

   Devolve `{ pode, motivos[] }`, e nunca um booleano solto. O motivo é a metade
   útil da resposta: "não pode" sem dizer o que falta manda a pessoa procurar em
   quatro telas. A tela do funil mostra os motivos no próprio cartão quando o
   arrasto é recusado.

   ── AS TRÊS CONDIÇÕES ──

   1. `juridicoOk` — alguém com `validarJuridico` conferiu a documentação.
   2. `financeiroOk` — alguém com `validarFinanceiro` conferiu o pagamento.
   3. Um contrato ASSINADO. Não basta existir contrato: um enviado e não
      assinado é exatamente o estado em que o negócio NÃO está ganho.

   A terceira só é cobrada quando o plano inclui assinatura digital. No Básico o
   contrato é feito fora do sistema, e exigir um documento que aquele plano não
   consegue produzir travaria o negócio para sempre — a trava viraria um defeito
   em vez de um controle. As duas validações humanas continuam valendo em todos
   os planos: elas não dependem de integração nenhuma.

   `contratoAssinado` chega pronto de quem chama, e não é lido aqui: esta função
   não toca no banco de propósito. É o que permite testá-la sem subir nada e o
   que a mantém utilizável em cima de um negócio que ainda não foi gravado. */
export function podeFechar(negocio, { exigeContrato = true, contratoAssinado = false } = {}) {
  const motivos = [];

  if (!negocio?.juridicoOk) {
    motivos.push("O setor jurídico ainda não validou a documentação deste negócio.");
  }
  if (!negocio?.financeiroOk) {
    motivos.push("O setor financeiro ainda não validou este negócio.");
  }
  if (exigeContrato && !contratoAssinado) {
    motivos.push("Nenhum contrato deste negócio foi assinado por todas as partes.");
  }

  return { pode: motivos.length === 0, motivos };
}

/* ── A transição ──────────────────────────────────────────────────────────────

   O único lugar que decide se um negócio muda de estágio. Devolve
   `{ ok, erro?, motivos? }`.

   `PERDIDO` passa sempre, inclusive vindo de GANHO: negócio que fechou e caiu
   depois (financiamento negado, distrato) existe, e não poder registrá-lo
   deixaria o número de vendas da imobiliária permanentemente errado para cima. */
export function podeMover(negocio, destino, opcoes = {}) {
  if (!ehEstagioValido(destino)) {
    return { ok: false, erro: "Estágio desconhecido." };
  }
  if (negocio.estagio === destino) {
    return { ok: true, semMudanca: true };
  }
  if (destino === ESTAGIO_PERDIDO) {
    return { ok: true };
  }
  if (destino === "GANHO") {
    const { pode, motivos } = podeFechar(negocio, opcoes);
    if (!pode) {
      return {
        ok: false,
        erro: "Este negócio ainda não pode ser fechado.",
        motivos,
      };
    }
  }
  return { ok: true };
}

/** O que falta para fechar, para a tela poder mostrar a lista ANTES de a pessoa
 *  tentar arrastar. Mesma função da trava — se fossem duas, a tela prometeria
 *  uma coisa e o servidor recusaria por outra. */
export function pendenciasParaFechar(negocio, opcoes = {}) {
  return podeFechar(negocio, opcoes).motivos;
}
