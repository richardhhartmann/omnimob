import { useEffect } from "react";
import { LockKey } from "@phosphor-icons/react";

/* ────────────────────────────────────────────────────────────────────────────
   A RECUSA DO FECHAMENTO, EXPLICADA.

   Quando o servidor recusa mover um negócio para Ganho, ele devolve 422 com
   `motivos` — uma lista. Um toast vermelho a engoliria: são até três frases, e
   cada uma aponta para uma tela diferente.

   ── POR QUE A RECUSA NÃO É UM ERRO ──

   O tom aqui é deliberado. Isto não é "algo deu errado": é o controle
   funcionando. A imobiliária pediu que jurídico e financeiro conferissem antes
   de fechar, e é exatamente isso que está acontecendo. Um modal vermelho com
   ícone de alerta ensinaria a equipe a odiar a trava e a procurar como
   contorná-la; um cadeado âmbar diz "falta um passo" — que é o que é.

   Sem botão de "fechar mesmo assim". Ele existiria em duas semanas se este
   modal fosse hostil, e aí a trava inteira teria sido teatro.
   ──────────────────────────────────────────────────────────────────────────── */

export function ModalTravaDeFechamento({ aberto, negocio, motivos, aoFechar, aoAbrirNegocio }) {
  useEffect(() => {
    if (!aberto) return undefined;
    function aoTeclar(e) { if (e.key === "Escape") aoFechar(); }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  return (
    <div className="flow-modal-veu" onClick={aoFechar}>
      <div
        className="flow-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trava-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="flow-modal__selo"><LockKey size={22} weight="fill" /></span>
        <h2 id="trava-titulo" className="flow-modal__titulo">
          Falta um passo para fechar
        </h2>
        <p className="flow-modal__texto">
          {negocio ? <>O negócio <strong>#{negocio.codigo}</strong> </> : "Este negócio "}
          ainda não pode ir para <strong>Ganho</strong>. A conferência antes do fechamento é uma
          regra desta imobiliária, e ela é o que impede um contrato sair com pendência.
        </p>

        <ul className="flow-modal__lista">
          {motivos.map((m) => <li key={m}>{m}</li>)}
        </ul>

        <div className="flow-modal__acoes">
          <button type="button" className="btn-primary" onClick={aoAbrirNegocio}>
            Abrir o negócio
          </button>
          <button type="button" className="flow-btn-fantasma" onClick={aoFechar}>
            Deixar como está
          </button>
        </div>
      </div>
    </div>
  );
}
