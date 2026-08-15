import { useCallback, useEffect, useRef, useState } from "react";

/* Zoom da prancheta.

   Ctrl/Cmd + roda dá zoom no canvas e SÓ no canvas — o listener é registrado no
   contêiner, não na janela, e só cancela o evento quando o modificador está
   pressionado. Rolar normalmente continua rolando a página, e o zoom do
   navegador continua funcionando em qualquer outro lugar da tela. */

export const ZOOM_MIN = 0.35;
export const ZOOM_MAX = 1.6;

const clamp = (v) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v));

export function useCanvasZoom(containerRef, { larguraCanvasPx = 1280 } = {}) {
  const [zoom, setZoomState] = useState(1);
  const zoomRef = useRef(1);

  const setZoom = useCallback((valor) => {
    setZoomState((anterior) => {
      const proximo = clamp(typeof valor === "function" ? valor(anterior) : valor);
      zoomRef.current = proximo;
      return proximo;
    });
  }, []);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  /* Encaixa a prancheta na largura disponível, com uma margem de respiro.
     Nunca amplia acima de 100%: um canvas de 1280px esticado numa tela larga
     ficaria borrado e desalinhado do que o visitante vai ver. */
  const ajustarALargura = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const disponivel = el.clientWidth - 64;
    if (disponivel <= 0) return;
    setZoom(Math.min(1, disponivel / larguraCanvasPx));
  }, [containerRef, larguraCanvasPx, setZoom]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const aoRodar = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoom((anterior) => anterior - e.deltaY * 0.0015);
    };
    // passive:false porque precisamos poder cancelar o zoom nativo da página.
    container.addEventListener("wheel", aoRodar, { passive: false });
    return () => container.removeEventListener("wheel", aoRodar);
  }, [containerRef, setZoom]);

  useEffect(() => {
    const aoTeclar = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "0") {
        e.preventDefault();
        setZoom(1);
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [setZoom]);

  return { zoom, zoomRef, setZoom, ajustarALargura };
}
