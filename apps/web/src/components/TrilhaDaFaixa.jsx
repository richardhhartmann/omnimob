import { Trilha } from "./Trilha.jsx";
import { useDegrausDoPainel } from "../utils/contextoDeCabecalho.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   A trilha, na faixa do topo.

   Ela já morou em dois lugares. No cabeçalho da tela, acima do título — e o
   cabeçalho é STICKY, então ela ficava permanentemente na tela repetindo o
   caminho de uma página que a pessoa já estava lendo. Desceu para o `<main>`
   como primeira linha do conteúdo, e ali o problema era o inverso: sumia na
   primeira rolagem, e quem descia numa lista longa perdia a referência de
   onde estava.

   Na `.ds-topbar` ela é MOLDURA, como a busca e o seletor de módulo: fica
   sempre à vista, ao lado do wordmark, e não custa uma linha da página. É o
   mesmo argumento que levou a busca para lá — o que serve a todas as telas
   pertence à moldura, não à tela.

   Os degraus saem do mesmo `useDegrausDoPainel` que dá o título de reserva ao
   cabeçalho: uma lista só, dois lugares que a leem. Por isso o
   `ProvedorDeCabecalho` envolve a faixa e não só a coluna do conteúdo.

   Continua valendo a regra de antes: só a partir de DOIS degraus. Um degrau é a
   própria tela, e o nome dela já está no cabeçalho logo abaixo.
   ──────────────────────────────────────────────────────────────────────────── */

export function TrilhaDaFaixa() {
  const degraus = useDegrausDoPainel();
  if (degraus.length <= 1) return null;
  return (
    <div className="ds-topbar__trilha">
      <Trilha itens={degraus} />
    </div>
  );
}
