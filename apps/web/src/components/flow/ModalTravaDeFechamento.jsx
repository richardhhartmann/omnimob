import { LockKey } from "@phosphor-icons/react";
import { Modal } from "../Modal.jsx";
import { ListaDePendencias } from "./ListaDePendencias.jsx";

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

   ── POR QUE ELE USA O `Modal`, E NÃO UM VÉU PRÓPRIO ──

   Ele montava o próprio `position: fixed`. Isso funciona em quase toda tela e
   falha justamente aqui: o `AdminLayout` embrulha o `<Outlet/>` numa `<div>`
   com a animação `chicEntrance`, que termina em `matrix` identidade —
   invisível, e suficiente para a div virar BLOCO DE CONTENÇÃO. A partir daí o
   `fixed` deixa de medir pela JANELA e passa a medir por ela: o véu cobria só
   o pedaço da página com conteúdo, o resto seguia claro e clicável, e o cartão
   aparecia deslocado, sem desfoque e por baixo do que devia cobrir.

   `Modal` sai por portal para o `<body>`, que é a única defesa confiável — e
   traz junto o desfoque, o `z-index`, os tokens de tema e o Esc. É o mesmo
   conserto que a exclusão de imóvel já tinha recebido; ver o cabeçalho de
   `components/Modal.jsx`.
   ──────────────────────────────────────────────────────────────────────────── */

export function ModalTravaDeFechamento({ aberto, negocio, pendencias, motivos, aoFechar, aoAbrirNegocio }) {
  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      aoFecharPeloFundo
      titulo="Falta um passo para fechar"
      adorno={<LockKey size={20} weight="fill" />}
      largura={460}
      acoes={
        <>
          <button type="button" className="flow-btn-fantasma" onClick={aoFechar}>
            Deixar como está
          </button>
          <button type="button" className="btn-primary" onClick={aoAbrirNegocio}>
            Abrir o negócio
          </button>
        </>
      }
    >
      <p className="flow-modal__texto">
        {negocio ? <>O negócio <strong>#{negocio.codigo}</strong> </> : "Este negócio "}
        ainda não pode ir para <strong>Ganho</strong>. A conferência antes do fechamento é uma
        regra desta imobiliária, e ela é o que impede um contrato sair com pendência.
      </p>

      {/* A MESMA lista da ficha do negócio. Ver `ListaDePendencias`: dois
          momentos do mesmo assunto, desenhados num lugar só. */}
      <ListaDePendencias itens={pendencias || motivos} />
    </Modal>
  );
}
