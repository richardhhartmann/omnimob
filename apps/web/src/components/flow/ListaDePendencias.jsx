import { Scales, Coins, Signature, LockKey } from "@phosphor-icons/react";

/* ────────────────────────────────────────────────────────────────────────────
   O QUE FALTA PARA FECHAR — desenhado num lugar só.

   A mesma lista aparece duas vezes: na ficha do negócio (`flow-pendencias`,
   sempre visível enquanto houver pendência) e no modal que recusa o arrasto
   até Ganho. São dois momentos do mesmo assunto, e desenhá-los em dois arquivos
   era garantir que divergissem — é o defeito que a vitrine deste projeto já
   teve duas vezes.

   ── O ÍCONE VEM DA CHAVE, NUNCA DO TEXTO ──

   `podeFechar`, no servidor, devolve `{ chave, texto }` justamente para isto.
   A alternativa seria a tela adivinhar pela frase ("se contém 'jurídico'…"), e
   isso quebra calado no dia em que alguém melhorar a redação — a lista voltaria
   ao cadeado genérico sem nenhum erro em lugar nenhum.

   O cadeado é o padrão de quem não tem chave conhecida: pendência nova nasce
   legível, com o ícone que diz "isto trava", em vez de um buraco no lugar do
   ícone.

   ── POR QUE ÍCONE, E NÃO BULLET ──

   As três pendências vão para setores DIFERENTES: jurídico, financeiro e a
   assinatura. Numa lista de bolinhas, descobrir qual é qual exige ler as três
   frases inteiras; com o ícone, o olho separa antes de ler — e quem já conhece
   as três reconhece pela forma qual ainda está aberta.
   ────────────────────────────────────────────────────────────────────────── */

const ICONES = {
  juridico: Scales,
  financeiro: Coins,
  contrato: Signature,
};

/** Aceita as duas formas: `[{ chave, texto }]` (o que o servidor manda hoje) e
 *  `["frase"]` (o que ele mandava antes). A tolerância existe porque uma aba
 *  aberta durante o deploy continua com o JS antigo pedindo à API nova, e o
 *  contrário também — e uma lista de pendências quebrando a tela do negócio
 *  seria um preço alto por um intervalo de minutos. */
function normalizar(itens) {
  return (itens || []).map((item, i) =>
    typeof item === "string"
      ? { chave: `t${i}`, texto: item }
      : { chave: item?.chave || `t${i}`, texto: item?.texto || "" },
  ).filter((p) => p.texto);
}

export function ListaDePendencias({ itens, className = "flow-pendencias__lista" }) {
  const pendencias = normalizar(itens);
  if (!pendencias.length) return null;

  return (
    <ul className={className}>
      {pendencias.map((p) => {
        const Icone = ICONES[p.chave] || LockKey;
        return (
          <li key={p.chave}>
            <span className="flow-pend__icone" aria-hidden="true">
              <Icone size={15} weight="fill" />
            </span>
            <span>{p.texto}</span>
          </li>
        );
      })}
    </ul>
  );
}
