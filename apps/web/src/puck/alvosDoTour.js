/* ────────────────────────────────────────────────────────────────────────────
   ONDE O TOUR ENCOSTA NO PUCK.

   O tour desta tela aponta para `[data-tour="..."]`, como o das outras onze.
   Só que o editor de vitrine deixou de ser nosso: quem desenha a barra, a
   prancheta e os painéis agora é o Puck, e não há onde pôr o atributo.

   Então ele é CARIMBADO aqui, uma vez, quando a tela monta.

   ── POR QUE NUM ARQUIVO SÓ ──

   As classes do Puck têm hash no nome (`_PuckCanvas_zw9iy_1`), e o hash muda a
   cada versão da biblioteca. Espalhar `[class*="PuckCanvas"]` pelo tour
   significaria caçar cinco lugares no dia em que a dependência subir de versão.
   Aqui é um mapa de cinco linhas: o tour continua falando a língua dele, e o
   conhecimento sobre o Puck mora num ponto só — o mesmo motivo pelo qual a
   ponte de edição concentra o que sabe sobre a biblioteca.

   Se um alvo não for encontrado, o passo correspondente simplesmente não
   aparece; é assim que o tour já trata alvo ausente. Melhor perder um passo do
   que travar o tour inteiro.
   ──────────────────────────────────────────────────────────────────────────── */

const MAPA = {
  /* A prancheta: a folha da vitrine dentro do iframe de prévia. */
  "vitrine-canvas": "[class*='PuckCanvas-inner']",
  /* O inspetor da direita — o que muda conforme a seleção. */
  "vitrine-painel": "[class*='PuckLayout'] [class*='SidebarSection']",
  /* Os tamanhos de tela, no alto da prancheta. */
  "vitrine-modo": "[class*='PuckCanvas-controls']",
  /* A gaveta da esquerda: Peças e Estrutura. */
  "vitrine-biblioteca": "[class*='Nav-list']",
  /* A barra do topo, onde fica o Publicar. */
  "vitrine-acoes": "[class*='PuckHeader']",
};

/**
 * Carimba os alvos do tour na interface do Puck.
 *
 * @returns {() => void} desfaz os carimbos — importa porque a mesma marcação
 *   pode ser remontada numa segunda visita à tela, e atributo esquecido em nó
 *   morto faria o tour mirar em algo que saiu do fluxo.
 */
export function marcarAlvosDoTour(raiz = document) {
  const marcados = [];

  for (const [nome, seletor] of Object.entries(MAPA)) {
    const el = raiz.querySelector(seletor);
    /* Não sobrescreve: se algo já se identificou, quem chegou primeiro manda. */
    if (!el || el.hasAttribute("data-tour")) continue;
    el.setAttribute("data-tour", nome);
    marcados.push(el);
  }

  return () => {
    for (const el of marcados) el.removeAttribute("data-tour");
  };
}
