import { Trilha } from "./Trilha.jsx";
import { useDegrausDoPainel } from "../utils/contextoDeCabecalho.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   A trilha, agora dentro do conteúdo.

   Ela morava no cabeçalho, acima do título. Desceu para o `<main>` por uma
   razão de leitura: o cabeçalho é STICKY e acompanha a rolagem, então a trilha
   ficava permanentemente na tela repetindo o caminho de uma página que a pessoa
   já está lendo. Aqui ela é a primeira linha do conteúdo — some ao rolar, como
   o resto da página, e volta quando se sobe.

   Os degraus saem do mesmo `useDegrausDoPainel` que dá o título de reserva ao
   cabeçalho: uma lista só, dois lugares que a leem.

   Continua valendo a regra de antes: só a partir de DOIS degraus. Um degrau é a
   própria tela, e repetir o nome dela logo acima do conteúdo é ruído.
   ──────────────────────────────────────────────────────────────────────────── */

export function TrilhaDoConteudo() {
  const degraus = useDegrausDoPainel();
  if (degraus.length <= 1) return null;
  return (
    <div className="ds-trilha-conteudo">
      <Trilha itens={degraus} />
    </div>
  );
}
