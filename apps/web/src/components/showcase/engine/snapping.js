/* ────────────────────────────────────────────────────────────────────────────
   Encaixe (snapping).

   Duas famílias de guia, com unidades diferentes porque o layout tem unidades
   diferentes:

     · horizontal — em % da largura do canvas: bordas, terços, e o centro da
       peça contra o centro da página;
     · vertical — em px: o topo do canvas e as bordas (topo e base) das outras
       peças, que é o que permite alinhar uma fileira sem mirar no olho.

   Devolve, além da coordenada corrigida, a GUIA que causou o encaixe — a linha
   que a interface desenha. Sem isso o encaixe acontece e ninguém entende por
   quê; com isso ele vira uma afirmação visível.
   ──────────────────────────────────────────────────────────────────────────── */

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

/** Limiar em % equivalente a `px` pixels na largura atual do canvas. */
export function limiarPct(px, larguraCanvas) {
  return (px / Math.max(larguraCanvas || 1, 1)) * 100;
}

/**
 * Encaixe no eixo X. Prioriza o centro da página: é o alinhamento que as
 * pessoas realmente procuram, e disputá-lo com "borda esquerda" faz uma peça
 * larga oscilar entre os dois.
 *
 * `outras` entra para alinhar peça com peça (bordas esquerda e direita).
 */
export function encaixarX(x, largura, outras, larguraCanvas) {
  const limite = limiarPct(10, larguraCanvas);
  const maxX = Math.max(0, 100 - largura);
  const centro = x + largura / 2;

  if (Math.abs(centro - 50) <= limite) {
    return { x: clamp(50 - largura / 2, 0, maxX), guia: { tipo: "centro", pos: 50 } };
  }

  for (const alvo of [0, 25, 75, maxX]) {
    if (Math.abs(x - alvo) <= limite * 1.4) {
      return { x: clamp(alvo, 0, maxX), guia: { tipo: "borda", pos: alvo } };
    }
  }

  for (const o of outras) {
    if (Math.abs(x - o.x) <= limite) {
      return { x: clamp(o.x, 0, maxX), guia: { tipo: "peca", pos: o.x } };
    }
    const direita = o.x + o.w;
    if (Math.abs(x + largura - direita) <= limite) {
      return { x: clamp(direita - largura, 0, maxX), guia: { tipo: "peca", pos: direita } };
    }
  }

  return { x: clamp(x, 0, maxX), guia: null };
}

/**
 * Encaixe no eixo Y contra o topo do canvas e as bordas das outras peças.
 * O limiar é em pixels puros: aqui não há proporção a respeitar, e 14px é a
 * distância em que a mão já "quis" encostar.
 */
export function encaixarY(y, outras) {
  if (y <= 15) return { y: 0, guia: { tipo: "topo", pos: 0 }, noTopo: true };

  for (const o of outras) {
    if (Math.abs(y - o.y) <= 14) return { y: o.y, guia: { tipo: "peca", pos: o.y }, noTopo: false };
    const base = o.y + o.h;
    if (Math.abs(y - base) <= 14) return { y: base, guia: { tipo: "peca", pos: base }, noTopo: false };
  }

  return { y: Math.max(0, y), guia: null, noTopo: false };
}
