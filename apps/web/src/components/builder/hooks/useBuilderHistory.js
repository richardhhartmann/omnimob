import { useCallback, useEffect, useRef, useState } from "react";

/* ────────────────────────────────────────────────────────────────────────────
   Desfazer / refazer.

   Duas pilhas e um instantâneo em JSON do formulário inteiro. Simples de
   propósito: o estado do editor é um objeto serializável, e qualquer coisa mais
   esperta (patches, diffs) exigiria manter um registro de operações que hoje
   não existe.

   A regra que importa: um GESTO gera UMA entrada. `registrar()` é chamado no
   começo do arrasto, não a cada quadro — senão soltar o mouse deixaria
   trezentos passos de undo para percorrer.
   ──────────────────────────────────────────────────────────────────────────── */

const LIMITE = 50;

export function useBuilderHistory(estadoRef, aplicarEstado) {
  const desfazerRef = useRef([]);
  const refazerRef = useRef([]);
  const [podeDesfazer, setPodeDesfazer] = useState(false);
  const [podeRefazer, setPodeRefazer] = useState(false);

  const registrar = useCallback(() => {
    const atual = estadoRef.current;
    if (!atual) return;
    desfazerRef.current.push(JSON.stringify(atual));
    if (desfazerRef.current.length > LIMITE) desfazerRef.current.shift();
    refazerRef.current = [];
    setPodeDesfazer(true);
    setPodeRefazer(false);
  }, [estadoRef]);

  const desfazer = useCallback(() => {
    if (desfazerRef.current.length === 0) return;
    refazerRef.current.unshift(JSON.stringify(estadoRef.current));
    if (refazerRef.current.length > LIMITE) refazerRef.current.pop();
    const anterior = desfazerRef.current.pop();
    try {
      aplicarEstado(JSON.parse(anterior));
    } catch {
      /* instantâneo corrompido: melhor não fazer nada do que zerar a tela */
    }
    setPodeDesfazer(desfazerRef.current.length > 0);
    setPodeRefazer(true);
  }, [estadoRef, aplicarEstado]);

  const refazer = useCallback(() => {
    if (refazerRef.current.length === 0) return;
    desfazerRef.current.push(JSON.stringify(estadoRef.current));
    if (desfazerRef.current.length > LIMITE) desfazerRef.current.shift();
    const proximo = refazerRef.current.shift();
    try {
      aplicarEstado(JSON.parse(proximo));
    } catch {}
    setPodeDesfazer(true);
    setPodeRefazer(refazerRef.current.length > 0);
  }, [estadoRef, aplicarEstado]);

  /* As funções vão para refs antes de virarem atalho de teclado: o listener é
     registrado uma vez só, e sem isso ele capturaria a versão delas do primeiro
     render — o clássico stale closure, que aqui apareceria como "Ctrl+Z
     desfazendo para um estado antigo". */
  const desfazerFnRef = useRef(desfazer);
  const refazerFnRef = useRef(refazer);
  desfazerFnRef.current = desfazer;
  refazerFnRef.current = refazer;

  useEffect(() => {
    function aoTeclar(e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      const tecla = e.key.toLowerCase();
      if (tecla === "z" && !e.shiftKey) {
        e.preventDefault();
        desfazerFnRef.current?.();
      } else if (tecla === "y" || (tecla === "z" && e.shiftKey)) {
        e.preventDefault();
        refazerFnRef.current?.();
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  return { registrar, desfazer, refazer, podeDesfazer, podeRefazer };
}
