import { useEffect, useRef, useState } from "react";
import { renderizarBotaoGoogle } from "../utils/google";

/* ────────────────────────────────────────────────────────────────────────────
   O botão do Google, onde quer que ele apareça.

   Existe porque o botão é DESENHADO pelo Google dentro de um elemento nosso —
   não é um `<button>` que a gente estiliza. Isso muda a forma de usá-lo em
   React: precisa de uma referência, de um efeito para desenhar, e de cuidado
   para não desenhar duas vezes quando o componente re-renderiza.

   Envolver isso uma vez é melhor que repetir o mesmo ritual na tela de login e
   no menu do perfil — que foi o que fez a primeira versão errar nos dois
   lugares ao mesmo tempo.
   ──────────────────────────────────────────────────────────────────────────── */

export function BotaoGoogle({ clientId, aoReceber, largura, aoFalhar }) {
  const caixa = useRef(null);
  const [erro, setErro] = useState("");
  /* O que o Google desenha não é gerido pelo React. Sem esta trava, cada
     re-render acrescentaria um botão ao lado do anterior. */
  const desenhado = useRef(false);

  useEffect(() => {
    if (!clientId || !caixa.current || desenhado.current) return;
    desenhado.current = true;

    renderizarBotaoGoogle(caixa.current, {
      clientId,
      largura,
      aoReceber,
      aoFalhar: (e) => { setErro(e.message); aoFalhar?.(e); },
    }).catch((e) => {
      desenhado.current = false;
      setErro(e.message || "Não consegui carregar o botão do Google.");
      aoFalhar?.(e);
    });
  }, [clientId, largura, aoReceber, aoFalhar]);

  return (
    <div className="bg-caixa">
      <div ref={caixa} />
      {erro ? <p className="bg-erro">{erro}</p> : null}
    </div>
  );
}
