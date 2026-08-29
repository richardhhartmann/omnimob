/* ── Quem responde ao "N" ────────────────────────────────────────────────────

   `global.novo` é o único atalho que vale em TODA tela e não tem destino fixo:
   o significado é sempre o mesmo — "criar o que esta tela cria" — mas quem sabe
   fazer isso é a tela aberta. O ouvinte (`useAtalhos`) precisava de alguém para
   chamar, e não tinha ninguém: `aoNovo` nunca foi passado, então a tecla não
   fazia nada em lugar nenhum desde que foi criada.

   ── POR QUE UM REGISTRO DE MÓDULO, E NÃO CONTEXTO ──

   O ouvinte mora no `AdminLayout`, e o `ProvedorDeAtalhos` é DESCENDENTE dele —
   um contexto criado lá dentro não alcança quem está acima. Lifting exigiria
   remontar o layout inteiro por causa de uma tecla.

   Existe exatamente uma tela aberta por vez, então um registro de módulo diz a
   verdade sobre o estado do aplicativo. É o mesmo arranjo da barra de progresso,
   que também guarda estado fora do React porque a pergunta é global.

   ── PILHA, E NÃO UMA VARIÁVEL ──

   Uma tela pode ter dois botões de novo — Tipos de Imóvel tem "Novo Tipo" e,
   dentro dele, "Novo Atributo". O último a montar é o mais específico e assume;
   ao desmontar, o de baixo volta a valer. Com uma variável só, sair da subtela
   deixaria o "N" apontando para um botão que não existe mais.
   ────────────────────────────────────────────────────────────────────────── */

const pilha = [];

/** Registra a ação de "novo" desta tela. Devolve a função que a remove. */
export function registrarNovo(fn) {
  if (typeof fn !== "function") return () => {};
  pilha.push(fn);
  return () => {
    const i = pilha.lastIndexOf(fn);
    if (i >= 0) pilha.splice(i, 1);
  };
}

/** Chama o "novo" da tela atual. Silencioso quando não há nenhum registrado —
 *  numa tela sem criação, a tecla simplesmente não faz nada. */
export function criarNovo() {
  const fn = pilha[pilha.length - 1];
  if (fn) fn();
}

/** Há um "novo" nesta tela? É o que decide se o selo da tecla aparece. */
export function temNovo() {
  return pilha.length > 0;
}
