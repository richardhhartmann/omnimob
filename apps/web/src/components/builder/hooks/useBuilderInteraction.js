import { useCallback, useRef } from "react";
import { moverPeca, redimensionarPeca } from "../../showcase/engine/layoutEngine.js";
import { pieceRect, toPieces } from "../../showcase/engine/pieces.js";

/* ────────────────────────────────────────────────────────────────────────────
   A infraestrutura ÚNICA de gesto — arrastar e redimensionar, bloco e widget.

   Antes havia três caminhos quase iguais: o arrasto de bloco (dnd-kit), o
   arrasto de widget (`window.addEventListener("pointermove")`) e o resize de
   ambos (mais pointermove). Três lugares para corrigir a mesma coisa, e foi
   assim que o widget acabou sem colisão contra bloco por meses.

   Agora existe um ciclo só:

     iniciar(pieceId, tipo) → mover(dxPx, dyPx) → terminar()

   Quem chama esse ciclo é que muda:

     · arrastar  — o dnd-kit, que entrega `operation.transform` em pixels e traz
       de graça o que não queremos reescrever: toque, TECLADO, limiar de
       ativação e cancelamento por Esc;
     · redimensionar — nosso, porque o dnd-kit não faz resize e não finge que
       faz. São dois listeners de ponteiro num lugar só, alimentando as mesmas
       funções da engine.

   ── ESTADO TRANSITÓRIO ──

   O gesto NÃO escreve no formulário. Cada quadro recalcula o layout a partir do
   config congelado no início do gesto e entrega o resultado por `aoPrever` —
   que a página guarda num estado leve, separado do `form`. Só ao soltar é que
   `aoConfirmar` grava uma vez.

   Isso é o que impede a cadeia que travava o editor: pointermove → setForm
   gigante → normalize → render de dezenas de cartões de imóvel → autosave
   reagendado. Sessenta vezes por segundo.
   ──────────────────────────────────────────────────────────────────────────── */

export function useBuilderInteraction({
  configRef,
  modeRef,
  canvasRef,
  zoomRef,
  aoRegistrarHistorico,
  aoPrever,
  aoConfirmar,
}) {
  const gestoRef = useRef(null);

  const emGesto = useCallback(() => gestoRef.current !== null, []);

  const iniciar = useCallback(
    (pieceId, tipo) => {
      const cfg = configRef.current;
      const mode = modeRef.current;
      if (!cfg || !canvasRef.current) return false;

      const peca = toPieces(cfg, mode).find((p) => p.id === pieceId);
      // Peça travada não se move nem se estica — é para isso que serve o cadeado.
      if (!peca || peca.locked) return false;

      const rect = pieceRect(cfg, mode, pieceId);
      if (!rect) return false;

      const caixa = canvasRef.current.getBoundingClientRect();
      gestoRef.current = {
        pieceId,
        tipo,
        mode,
        base: cfg,
        rect,
        // Largura JÁ escalada pelo zoom: o delta do ponteiro também vem em
        // pixels de tela, então a divisão devolve a porcentagem certa.
        larguraCanvas: Math.max(caixa.width, 1),
        zoom: mode === "mobile" ? 1 : zoomRef.current || 1,
      };

      // Um gesto = uma entrada de histórico. Aqui, e não a cada quadro.
      aoRegistrarHistorico?.();
      return true;
    },
    [configRef, modeRef, canvasRef, zoomRef, aoRegistrarHistorico]
  );

  const mover = useCallback(
    (dxPx, dyPx) => {
      const g = gestoRef.current;
      if (!g) return;

      const dxPercent = (dxPx / g.larguraCanvas) * 100;
      const dyLayout = dyPx / g.zoom;

      if (g.tipo === "resize") {
        const { config } = redimensionarPeca(g.base, g.mode, g.pieceId, {
          w: g.rect.w + dxPercent,
          h: g.rect.h + dyLayout,
        });
        g.ultimo = config;
        aoPrever?.({ config, encostadas: null, guias: { x: null, y: null } });
        return;
      }

      const { config, encostadas, guias } = moverPeca(
        g.base,
        g.mode,
        g.pieceId,
        { x: g.rect.x + dxPercent, y: g.rect.y + dyLayout },
        { larguraCanvas: g.larguraCanvas }
      );
      g.ultimo = config;
      aoPrever?.({ config, encostadas, guias });
    },
    [aoPrever]
  );

  const terminar = useCallback(() => {
    const g = gestoRef.current;
    gestoRef.current = null;
    if (!g) return;
    // Sem movimento nenhum não há o que gravar: foi um clique de seleção.
    if (g.ultimo) aoConfirmar?.(g.ultimo);
    else aoPrever?.(null);
  }, [aoConfirmar, aoPrever]);

  const cancelar = useCallback(() => {
    gestoRef.current = null;
    aoPrever?.(null);
  }, [aoPrever]);

  /**
   * O `onPointerDown` da alça de redimensionar. Devolvido pronto para o JSX,
   * para que nenhum componente do canvas precise conhecer `pointermove`.
   */
  const aoPegarAlcaDeResize = useCallback(
    (pieceId) => (event) => {
      if (event.button != null && event.button !== 0) return;
      if (!iniciar(pieceId, "resize")) return;
      event.preventDefault();
      event.stopPropagation();

      const inicioX = event.clientX;
      const inicioY = event.clientY;

      const aoMover = (e) => mover(e.clientX - inicioX, e.clientY - inicioY);
      const aoSoltar = () => {
        window.removeEventListener("pointermove", aoMover);
        window.removeEventListener("pointerup", aoSoltar);
        window.removeEventListener("pointercancel", aoCancelar);
        terminar();
      };
      const aoCancelar = () => {
        window.removeEventListener("pointermove", aoMover);
        window.removeEventListener("pointerup", aoSoltar);
        window.removeEventListener("pointercancel", aoCancelar);
        cancelar();
      };

      window.addEventListener("pointermove", aoMover);
      window.addEventListener("pointerup", aoSoltar);
      window.addEventListener("pointercancel", aoCancelar);
    },
    [iniciar, mover, terminar, cancelar]
  );

  return { iniciar, mover, terminar, cancelar, emGesto, aoPegarAlcaDeResize };
}
