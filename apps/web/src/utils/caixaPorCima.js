/* ────────────────────────────────────────────────────────────────────────────
   Há uma caixa modal aberta por cima?

   O sinal é a rolagem do corpo travada: TODA caixa do painel faz isso enquanto
   está no ar — a confirmação, o aviso de permissão de risco, o modal de
   assinatura, a paleta de busca. É um sinal fraco de propósito. A alternativa
   seria um registro central de caixas abertas, e ele só funcionaria enquanto
   toda caixa nova lembrasse de se cadastrar nele; a trava de rolagem, ao
   contrário, é feita porque a caixa PRECISA dela para funcionar, não porque
   alguém lembrou.

   Esta função morava dentro de `useSaidaDaTela` e passou a ser lida também pelo
   `useAtalhos` — o Esc global do painel. É a mesma pergunta feita nos dois
   lugares, e ela precisa ter uma resposta só: enquanto cada um tinha a sua (ou
   nenhuma, no caso do global), a mesma tecla fazia duas coisas ao mesmo tempo.
   ──────────────────────────────────────────────────────────────────────────── */

export function temCaixaPorCima() {
  if (typeof document === "undefined") return false;
  return document.body.style.overflow === "hidden";
}
