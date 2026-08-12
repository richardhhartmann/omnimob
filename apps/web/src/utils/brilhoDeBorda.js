import { useEffect } from "react";

/* ────────────────────────────────────────────────────────────────────────────
   Brilho de borda direcional nos botões do painel.

   A técnica é a do BorderGlow (React Bits): o ponteiro alimenta duas variáveis
   CSS — o ÂNGULO em que ele está em relação ao centro do elemento e o quanto
   ele se aproximou da BORDA — e o CSS usa esse ângulo para mascarar um brilho
   em cone, que assim parece seguir o cursor.

   O QUE MUDOU EM RELAÇÃO AO COMPONENTE ORIGINAL, e por quê:

   · Ele é um componente de CARTÃO: envolve o conteúdo num `div` com grid, fundo
     próprio, borda e seis camadas de sombra. Envolver os 168 botões do painel
     nisso mudaria o box model de toda barra e todo formulário — e o
     `styles.css` já dá `width: 100%` aos botões.

   · Ele instala um `pointermove` POR INSTÂNCIA. Aqui é um só, delegado na raiz
     do painel: o botão sob o cursor é encontrado por `closest()`. Um listener
     no lugar de 168.

   · No original a opacidade sai da proximidade da borda. Num botão de 44px de
     altura todo ponto está perto de uma borda, então isso deixaria o brilho
     sempre aceso e sem graça. Aqui quem liga e desliga é o `:hover` do CSS, e
     a proximidade fica como modulação fina da intensidade.

   As leituras de geometria são agrupadas num quadro (`requestAnimationFrame`):
   `getBoundingClientRect` a cada `pointermove` é leitura de layout, e o mouse
   dispara muito mais eventos do que a tela desenha.
   ──────────────────────────────────────────────────────────────────────────── */

const ALVOS = "button, .link-button";

/**
 * @param {import("react").RefObject<HTMLElement>} raizRef  raiz do painel
 */
export function useBrilhoDeBorda(raizRef) {
  useEffect(() => {
    const raiz = raizRef?.current;
    if (!raiz) return undefined;

    // Sem ponteiro fino não há para onde apontar o cone: em tela de toque o
    // efeito só acenderia depois do toque e ficaria grudado.
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    let alvoAtual = null;
    let quadro = 0;
    let pendente = null;

    const limpar = (el) => {
      if (!el) return;
      el.style.removeProperty("--cursor-angle");
      el.style.removeProperty("--edge-proximity");
    };

    const aplicar = () => {
      quadro = 0;
      if (!pendente) return;
      const { alvo, x, y } = pendente;
      pendente = null;
      if (!alvo.isConnected) return;

      const r = alvo.getBoundingClientRect();
      if (!r.width || !r.height) return;

      const cx = r.width / 2;
      const cy = r.height / 2;
      const dx = x - r.left - cx;
      const dy = y - r.top - cy;

      /* Proximidade da borda: 0 no centro, 1 encostando na moldura. É a razão
         entre onde o ponteiro está e onde ficaria a borda naquela direção —
         por isso as duas divisões e o menor dos dois. */
      const kx = dx === 0 ? Infinity : cx / Math.abs(dx);
      const ky = dy === 0 ? Infinity : cy / Math.abs(dy);
      const borda = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);

      // +90° para 0 apontar para cima, que é como o cone do CSS é escrito.
      let angulo = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
      if (angulo < 0) angulo += 360;

      alvo.style.setProperty("--cursor-angle", `${angulo.toFixed(1)}deg`);
      alvo.style.setProperty("--edge-proximity", (borda * 100).toFixed(1));
    };

    const aoMover = (e) => {
      const alvo = e.target?.closest?.(ALVOS);

      if (alvo !== alvoAtual) {
        limpar(alvoAtual);
        alvoAtual = alvo || null;
      }
      if (!alvo) return;

      pendente = { alvo, x: e.clientX, y: e.clientY };
      if (!quadro) quadro = requestAnimationFrame(aplicar);
    };

    const aoSair = () => {
      limpar(alvoAtual);
      alvoAtual = null;
      pendente = null;
    };

    raiz.addEventListener("pointermove", aoMover, { passive: true });
    raiz.addEventListener("pointerleave", aoSair);

    return () => {
      raiz.removeEventListener("pointermove", aoMover);
      raiz.removeEventListener("pointerleave", aoSair);
      if (quadro) cancelAnimationFrame(quadro);
      limpar(alvoAtual);
    };
  }, [raizRef]);
}
