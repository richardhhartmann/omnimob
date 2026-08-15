/* ────────────────────────────────────────────────────────────────────────────
   Colisão e cascata — o motor de física, sem DOM e sem React.

   Recebe e devolve arrays de peças ({ id, x, y, w, h }) e nada mais. É o que
   torna o comportamento testável e o que permitiu blocos e widgets passarem a
   dividir a mesma regra: para cá tudo é retângulo.

   As unidades são as do produto: `x` e `w` em porcentagem da largura do canvas,
   `y` e `h` em pixels. A engine não converte nada — a conversão mora na camada
   de interação, que é quem conhece o ponteiro e o zoom.
   ──────────────────────────────────────────────────────────────────────────── */

/** Folga para tratar bordas coladas como "sem sobreposição". */
const EPS = 0.5;

/** Distância em que duas bordas contam como encostadas (e acendem o realce). */
export const TOLERANCIA_CONTATO = 1.5;

/** As duas peças dividem alguma faixa horizontal? */
export function cruzaHorizontal(a, b) {
  return !(a.x + a.w <= b.x + EPS || b.x + b.w <= a.x + EPS);
}

/** As duas peças dividem alguma faixa vertical? */
export function cruzaVertical(a, b) {
  return a.y < b.y + b.h - EPS && b.y < a.y + a.h - EPS;
}

export function sobrepoe(a, b) {
  return cruzaHorizontal(a, b) && cruzaVertical(a, b);
}

/**
 * Encosta a ÂNCORA na borda da peça que ela mais invadiu.
 *
 * A peça que a pessoa segura não é empurrada pela cascata — senão ela fugiria
 * do ponteiro. Só que a cascata empurra numa direção só, para baixo: arrastando
 * para CIMA contra outra peça não havia nada a deslocar e a âncora atravessava.
 *
 * Escolher o lado pela MENOR distância é o que faz o encontro parecer encosto e
 * não teleporte: a peça para na borda que ela encontrou.
 *
 * ── POR QUE UM PASSE SÓ, E CONTRA A MAIOR INVASÃO ──
 *
 * Isto já foi um laço "corrige até não sobrar sobreposição". Entre duas peças
 * COLADAS ele oscilava: sair de A punha a âncora dentro de B, sair de B punha
 * de volta dentro de A, e o laço terminava por esgotar as tentativas — deixando
 * a sobreposição que ele existia para impedir. Era o "forçando um pouco, entram
 * uma na outra" na sua forma mais teimosa.
 *
 * Um passe resolve o caso comum (um vizinho só) com o encosto certo, e o que
 * sobrar é resolvido por `afastarDaAncora`, movendo as OUTRAS peças — que é o
 * que a pessoa espera quando larga uma peça no meio de uma pilha.
 *
 * Muta o array recebido (já é cópia de trabalho).
 */
export function expulsarAncora(pecas, ancoraId, encostadas = new Set()) {
  const alvo = pecas.find((p) => p.id === ancoraId);
  if (!alvo) return encostadas;

  let dominante = null;
  let maiorInvasao = 0;
  for (const outra of pecas) {
    if (outra.id === alvo.id) continue;
    if (!cruzaHorizontal(alvo, outra) || !cruzaVertical(alvo, outra)) continue;
    const invasao = Math.min(alvo.y + alvo.h, outra.y + outra.h) - Math.max(alvo.y, outra.y);
    if (invasao > maiorInvasao) {
      maiorInvasao = invasao;
      dominante = outra;
    }
  }
  if (!dominante) return encostadas;

  const paraBaixo = dominante.y + dominante.h - alvo.y; // falta para passar por baixo
  const paraCima = alvo.y + alvo.h - dominante.y;       // falta para passar por cima
  alvo.y = paraBaixo <= paraCima ? dominante.y + dominante.h : Math.max(0, dominante.y - alvo.h);
  encostadas.add(alvo.id);
  encostadas.add(dominante.id);

  return encostadas;
}

/**
 * A cascata: quem está mais acima empurra quem está abaixo, e só quando os dois
 * se cruzam na horizontal. Roda em passes até ninguém mais se mexer.
 *
 * `ancoraId` marca a peça que a pessoa segura: ela não cede lugar na cascata,
 * mas encostar ela encosta — o realce precisa acender dos dois lados.
 *
 * Muta o array. Devolve se alguma coisa mudou de lugar.
 */
function cascata(pecas, ancoraId, encostadas) {
  let mexeu = false;
  const maxPasses = pecas.length + 2;

  for (let passe = 0; passe < maxPasses; passe++) {
    /* Empate em `y` é desempatado pela âncora primeiro. Não é detalhe: com a
       peça segurada exatamente na borda de outra, quem viesse primeiro na
       ordenação decidia o resultado — e a ordem de empate é a ordem de
       inserção, ou seja, bloco antes de widget. O mesmo gesto dava resultados
       diferentes dependendo do TIPO da peça que estava no caminho. */
    const ordenadas = [...pecas].sort(
      (a, b) => a.y - b.y || (a.id === ancoraId ? -1 : 0) - (b.id === ancoraId ? -1 : 0)
    );
    let mudou = false;

    for (let i = 0; i < ordenadas.length; i++) {
      const a = ordenadas[i];
      for (let j = i + 1; j < ordenadas.length; j++) {
        const b = ordenadas[j];
        if (!cruzaHorizontal(a, b)) continue;

        const baseDeA = a.y + a.h;

        if (b.id === ancoraId) {
          if (Math.abs(baseDeA - b.y) <= TOLERANCIA_CONTATO || baseDeA > b.y + EPS) {
            encostadas.add(a.id);
            encostadas.add(b.id);
          }
          continue;
        }

        if (baseDeA > b.y + EPS) {
          b.y = baseDeA;
          mudou = true;
          encostadas.add(a.id);
          encostadas.add(b.id);
        } else if (Math.abs(baseDeA - b.y) <= TOLERANCIA_CONTATO) {
          // Já estavam coladas: contato sem empurrão, e vale acender igual.
          encostadas.add(a.id);
          encostadas.add(b.id);
        }
      }
    }
    mexeu = mexeu || mudou;
    if (!mudou) break;
  }

  return mexeu;
}

/* ── A garantia de que nada termina sobreposto ────────────────────────────────
   `expulsarAncora` tira a peça segurada de dentro das outras indo para o lado
   mais próximo. Entre duas peças coladas isso pode OSCILAR: sai de A para
   dentro de B, sai de B para dentro de A, e o laço acaba por esgotar as
   tentativas em vez de por ter resolvido.

   A cascata que vem depois também não fecha o buraco sozinha, porque ela só
   empurra para BAIXO: uma peça que ficou por cima da âncora, com a base dentro
   dela, não tem para onde ser empurrada.

   Aqui a conta se inverte. Quem se mexe é a OUTRA peça, não a âncora — que é o
   que a pessoa espera de um gesto: a peça que ela segura fica onde ela pôs, e o
   resto abre caminho. */
function afastarDaAncora(pecas, ancoraId, encostadas) {
  const ancora = pecas.find((p) => p.id === ancoraId);
  if (!ancora) return false;
  let mudou = false;

  for (const outra of pecas) {
    if (outra.id === ancoraId) continue;
    if (!sobrepoe(ancora, outra)) continue;

    /* Sempre para BAIXO, nunca para cima.

       Mandar a peça para cima parece mais gentil e é uma armadilha: lá em cima
       ela colide com outra, a cascata — que só empurra para baixo — a devolve
       para dentro da âncora, e o par fica trocando de lugar até o teto de
       rodadas acabar. Com um fuzzer de vinte mil tabuleiros isso aparece em
       segundos; na tela, aparece como duas peças piscando sob o cursor.

       Descendo, o sistema inteiro passa a ter uma direção só: nenhum `y`
       diminui, então cada rodada avança para um estado que não se repete e o
       laço termina. É a mesma regra da cascata — quem está acima manda —
       aplicada à peça que a pessoa segura. */
    outra.y = ancora.y + ancora.h;

    encostadas.add(ancora.id);
    encostadas.add(outra.id);
    mudou = true;
  }

  return mudou;
}

/**
 * Resolve o tabuleiro inteiro. Devolve peças novas (não muta a entrada) e o
 * conjunto de ids que terminaram encostados — o que a interface acende.
 */
export function resolverColisoes(pecasEntrada, ancoraId = null) {
  const pecas = pecasEntrada.map((p) => ({ ...p }));
  const encostadas = new Set();

  if (ancoraId) expulsarAncora(pecas, ancoraId, encostadas);

  /* Alterna cascata e afastamento até assentar. Converge porque as duas fases
     só aumentam `y`: nenhum estado se repete, e cada peça é deslocada um número
     finito de vezes. O teto é a rede de segurança para nenhum layout
     patológico segurar um quadro. */
  for (let rodada = 0; rodada < pecas.length + 4; rodada++) {
    cascata(pecas, ancoraId, encostadas);
    if (!ancoraId) break;
    if (!afastarDaAncora(pecas, ancoraId, encostadas)) break;
  }

  return { pecas, encostadas };
}

/**
 * Redimensionar não empurra ninguém: ele PARA na primeira peça encontrada.
 * Empurrar aqui faria a página inteira sanfonar enquanto a pessoa ajusta um
 * canto, que é o oposto de precisão.
 *
 * Testa largura e altura separadamente para que travar num eixo não trave o
 * outro — arrastar a alça na diagonal contra um vizinho lateral ainda deixa
 * crescer para baixo.
 */
export function limitarResize(alvo, outras, { w, h }, minW = 15, minH = 80) {
  const larguraMax = Math.max(minW, 100 - alvo.x);
  const desejadaW = Math.min(Math.max(w, minW), larguraMax);
  const desejadaH = Math.max(minH, h);

  const colide = (rect) => outras.some((o) => sobrepoe(rect, o));

  let finalW = alvo.w;
  let finalH = alvo.h;

  if (!colide({ x: alvo.x, y: alvo.y, w: desejadaW, h: finalH })) finalW = desejadaW;
  if (!colide({ x: alvo.x, y: alvo.y, w: finalW, h: desejadaH })) finalH = desejadaH;

  return { w: finalW, h: finalH };
}
