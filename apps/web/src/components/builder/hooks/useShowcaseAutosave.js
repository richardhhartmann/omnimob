import { useEffect, useRef, useState } from "react";

/* ────────────────────────────────────────────────────────────────────────────
   Autosave.

   Debounce de 1s sobre o formulário. O estado devolvido é o que a barra
   superior mostra — três palavras e nenhum alerta:

     ocioso → salvando → salvo → (erro)

   `ativo` existe para o gesto: durante um arrasto o layout muda a cada quadro,
   e sem essa trava o timer seria reagendado sessenta vezes por segundo (não
   salva, mas recalcula) e um gesto longo poderia acabar disparando gravação com
   o mouse ainda apertado.
   ──────────────────────────────────────────────────────────────────────────── */

export function useShowcaseAutosave({ valor, ativo, salvar, aoSalvar, atraso = 1000 }) {
  const [estado, setEstado] = useState("ocioso");
  const [erro, setErro] = useState("");
  const timerRef = useRef(null);
  const salvarRef = useRef(salvar);
  const aoSalvarRef = useRef(aoSalvar);
  salvarRef.current = salvar;
  aoSalvarRef.current = aoSalvar;

  useEffect(() => {
    if (!ativo) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      setEstado("salvando");
      setErro("");
      try {
        const resultado = await salvarRef.current(valor);
        aoSalvarRef.current?.(resultado, valor);
        setEstado("salvo");
      } catch (err) {
        setErro(err?.message || "Não foi possível salvar.");
        setEstado("erro");
      }
    }, atraso);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [valor, ativo, atraso]);

  // "Salvo" é uma confirmação, não um rótulo permanente: some sozinho.
  useEffect(() => {
    if (estado !== "salvo") return;
    const t = setTimeout(() => setEstado("ocioso"), 2600);
    return () => clearTimeout(t);
  }, [estado]);

  return { estado, erro };
}
