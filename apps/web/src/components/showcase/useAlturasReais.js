import { useCallback, useEffect, useRef } from "react";

/* ────────────────────────────────────────────────────────────────────────────
   Alturas reais das peças, por ResizeObserver.

   O `h` do layout entra no CSS como `min-height`. O conteúdo passa disso e
   passa muito: o bloco de imóveis declara 640px e desenha 1051 dependendo do
   acervo; um widget com texto editável cresce enquanto a pessoa digita. A
   física trabalha sobre a caixa guardada, então sem medir a caixa DESENHADA as
   peças aparecem encaixadas na tela mesmo estando separadas nos números.

   Antes isso era um `querySelectorAll` + `getBoundingClientRect()` disparado à
   mão em pontos espalhados (um `useLayoutEffect` sem dependências que rodava a
   cada render, um `setTimeout(420)` depois de trocar de modo, um rAF duplo
   depois de resetar). O observador troca os três por um só caminho:

     conteúdo muda → observer → altura nova → reflow só se precisar

   Duas defesas contra laço de render:

     · a altura medida é a do BORDER-BOX pelo próprio observador, que ignora o
       `transform: scale()` do zoom — medir com `getBoundingClientRect()` dava
       altura multiplicada pelo zoom, e o layout engordava a cada aproximação;
     · o flush é agendado por rAF e coalescido. Como crescer o `h` só aumenta o
       `min-height`, a medição seguinte devolve o mesmo número e o ciclo para.
   ──────────────────────────────────────────────────────────────────────────── */

export function useAlturasReais({ aoMedir, pausado = false }) {
  const alturasRef = useRef({});
  const elementosRef = useRef(new Map());
  const observerRef = useRef(null);
  const frameRef = useRef(null);
  const pausadoRef = useRef(pausado);
  const aoMedirRef = useRef(aoMedir);
  pausadoRef.current = pausado;
  aoMedirRef.current = aoMedir;

  const agendarFlush = useCallback(() => {
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      if (pausadoRef.current) return;
      aoMedirRef.current?.({ ...alturasRef.current });
    });
  }, []);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return undefined;

    const observer = new ResizeObserver((entradas) => {
      let mudou = false;
      for (const entrada of entradas) {
        const pieceId = entrada.target.getAttribute("data-piece-id");
        if (!pieceId) continue;
        const caixa = Array.isArray(entrada.borderBoxSize)
          ? entrada.borderBoxSize[0]
          : entrada.borderBoxSize;
        const altura = Math.ceil(caixa?.blockSize ?? entrada.target.offsetHeight ?? 0);
        if (altura > 0 && alturasRef.current[pieceId] !== altura) {
          alturasRef.current[pieceId] = altura;
          mudou = true;
        }
      }
      if (mudou) agendarFlush();
    });

    observerRef.current = observer;
    for (const el of elementosRef.current.values()) observer.observe(el);

    return () => {
      observer.disconnect();
      observerRef.current = null;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [agendarFlush]);

  /* Ref de callback por peça — MEMOIZADA por id, e isso não é economia.

     Devolver uma função nova a cada render faz o React desmontar a ref antiga
     (chamando-a com `null`) e montar a nova em TODO render. Ou seja: parar de
     observar, apagar a altura guardada, voltar a observar, o observador
     disparar de novo, o reflow escrever estado, e render outra vez. O laço se
     fecha sozinho. Com a identidade estável, o React não mexe na ref enquanto a
     peça continuar sendo a mesma. */
  const callbacksRef = useRef(new Map());

  const registrarPeca = useCallback((pieceId) => {
    const existente = callbacksRef.current.get(pieceId);
    if (existente) return existente;

    const cb = (el) => {
      const anterior = elementosRef.current.get(pieceId);
      if (anterior && anterior !== el) observerRef.current?.unobserve(anterior);
      if (!el) {
        elementosRef.current.delete(pieceId);
        delete alturasRef.current[pieceId];
        callbacksRef.current.delete(pieceId);
        return;
      }
      elementosRef.current.set(pieceId, el);
      observerRef.current?.observe(el);
    };

    callbacksRef.current.set(pieceId, cb);
    return cb;
  }, []);

  /** Leitura síncrona, para ações que precisam das alturas AGORA (reset). */
  const medirAgora = useCallback(() => {
    const alturas = {};
    for (const [pieceId, el] of elementosRef.current.entries()) {
      const altura = Math.ceil(el.offsetHeight || 0);
      if (altura > 0) alturas[pieceId] = altura;
    }
    alturasRef.current = { ...alturasRef.current, ...alturas };
    return alturas;
  }, []);

  return { registrarPeca, alturasRef, medirAgora };
}
