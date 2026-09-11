import { useEffect, useRef, useState } from "react";

/* ────────────────────────────────────────────────────────────────────────────
   De que TAMANHO este widget está — para o conteúdo mudar de forma junto.

   Redimensionar uma peça hoje só reflui o que já estava lá: a grade de seis
   corretores em 25% de largura vira seis colunas de 40px, cada uma com um
   retrato ilegível e um nome quebrado em quatro linhas. O widget cabe no
   espaço novo sem PERTENCER a ele.

   A ideia aqui é a da tela inicial do iPhone: o tamanho não é só uma caixa
   maior ou menor, é uma FORMA diferente de mostrar a mesma coisa. Pequeno
   mostra menos e mais denso; grande mostra mais e respira.

   ── POR QUE SÓ A LARGURA ──

   Esta é a decisão que sustenta o resto, e ela é sobre não criar um laço.

   A altura de um widget depende do conteúdo: `useAlturasReais` mede o que foi
   desenhado e a engine reflui a página quando a peça cresce. Se a FORMA do
   conteúdo passasse a depender da altura medida, teríamos um ciclo — a peça
   fica mais alta, muda de faixa, o conteúdo encolhe, a peça fica mais baixa,
   muda de faixa de volta. Um widget piscando entre dois desenhos para sempre.

   A largura não tem esse problema: ela vem do layout (`w` em % da folha) e
   nada do que o widget desenhe por dentro a altera. É uma entrada, nunca uma
   saída. Por isso a adaptação é por largura, e a altura continua sendo
   consequência — que é exatamente o que a engine já sabe tratar.

   ── AS FAIXAS ──

   Quatro, e os cortes são de LEITURA, não redondos: são as larguras em que um
   retrato de 56px, um número de estatística e um rótulo de duas palavras param
   de caber lado a lado.

     xs  até 260px   uma coluna, sem enfeite, só o essencial
     s   até 380px   uma coluna com folga, ou duas bem apertadas
     m   até 560px   duas colunas — a forma mais comum
     g   acima       três ou mais, com respiro

   ── O VALOR INICIAL ──

   `m`, e não `null`. O primeiro quadro acontece antes de o observador medir, e
   nascer sem faixa faria toda peça piscar de um desenho para outro na abertura
   da página. `m` é a forma mais comum; quando erra, corrige em um quadro.
   ──────────────────────────────────────────────────────────────────────────── */

const CORTES = [
  { chave: "xs", ate: 260 },
  { chave: "s", ate: 380 },
  { chave: "m", ate: 560 },
];

export function faixaDaLargura(largura) {
  for (const corte of CORTES) {
    if (largura <= corte.ate) return corte.chave;
  }
  return "g";
}

/**
 * @returns {[React.RefObject, "xs"|"s"|"m"|"g"]} a referência a pendurar no
 *   elemento medido, e a faixa em que ele está.
 */
export function useFaixaDoWidget() {
  const ref = useRef(null);
  const [faixa, setFaixa] = useState("m");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;

    const medir = () => {
      const largura = el.getBoundingClientRect().width;
      if (!largura) return;
      /* `setState` com o mesmo valor não re-renderiza — o React compara antes.
         É o que deixa este observador barato mesmo disparando a cada pixel do
         arrasto: só as quatro travessias de faixa custam alguma coisa. */
      setFaixa(faixaDaLargura(largura));
    };

    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, faixa];
}
