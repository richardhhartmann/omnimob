import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";

/* ────────────────────────────────────────────────────────────────────────────
   O modal do painel. Um só.

   ── POR QUE ELE PRECISA SER UM COMPONENTE, E NÃO UMA CONVENÇÃO ──

   Cada modal desta base montava o próprio véu com `position: fixed`. Isso
   FUNCIONA em quase toda tela, e falha em silêncio nas que importam — o
   `AdminLayout` embrulha o `<Outlet/>` numa `<div>` com a animação
   `chicEntrance`, que termina em `matrix` identidade. Invisível a olho nu, e
   suficiente para a div virar BLOCO DE CONTENÇÃO.

   A partir daí `position: fixed` deixa de medir pela JANELA e passa a medir por
   ela. O véu cobre só o pedaço da página onde o conteúdo está, o resto segue
   claro e clicável, e o modal parece "meio quebrado" — que foi exatamente o
   sintoma na exclusão de imóvel.

   É a armadilha recorrente daqui: o fantasma do arrasto na biblioteca do editor
   caiu nela primeiro (ver o comentário em `ShowcaseEditorPage`). A única defesa
   confiável é sair do `transform` — `createPortal` para o `<body>`, sempre.
   Modal novo que monte o próprio `fixed` volta a cair.

   ── FECHAR É EXPLÍCITO ──

   Sai pelo X ou pelo Esc. Clicar no véu NÃO fecha, de propósito: estes modais
   carregam decisão (excluir imóvel, remover anúncio de portal), e um clique
   torto perdendo o que a pessoa já marcou é pior que um clique a mais para
   sair. `aoFecharPeloFundo` existe para quem quiser o contrário em modal
   puramente informativo.
   ──────────────────────────────────────────────────────────────────────────── */

export function Modal({
  aberto = true,
  aoFechar,
  titulo,
  subtitulo,
  /* Enfeite à esquerda do título — o triângulo de perigo, um ícone de rede. */
  adorno,
  largura = 480,
  /* Rodapé de ações. Fica fora do corpo rolável, então os botões continuam
     visíveis num modal alto. */
  acoes,
  /* Trava o X e o Esc enquanto uma operação está em curso: fechar no meio de um
     DELETE deixaria a pessoa sem saber se ele aconteceu. */
  ocupado = false,
  aoFecharPeloFundo = false,
  children,
}) {
  /* A rolagem do fundo trava enquanto o modal está aberto. Sem isto, a roda do
     mouse sobre o véu rola a página atrás dele. */
  useEffect(() => {
    if (!aberto) return undefined;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = anterior; };
  }, [aberto]);

  useEffect(() => {
    if (!aberto || ocupado) return undefined;
    const aoTeclar = (e) => { if (e.key === "Escape") aoFechar?.(); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto, ocupado, aoFechar]);

  if (!aberto) return null;

  return createPortal(
    <div className="mdl-raiz" role="dialog" aria-modal="true" aria-label={titulo}>
      {/* O véu desfoca E captura o clique. Sem ele, clicar ao lado do cartão
          acertaria o que estivesse embaixo e a página podia navegar. */}
      <div
        className="mdl-veu"
        onClick={aoFecharPeloFundo && !ocupado ? aoFechar : undefined}
        aria-hidden="true"
      />

      <div className="mdl-cartao modal-cartao" style={{ maxWidth: `${largura}px` }}>
        {aoFechar ? (
          <button
            type="button"
            className="mdl-x"
            onClick={aoFechar}
            disabled={ocupado}
            aria-label="Fechar"
          >
            <X size={16} weight="bold" />
          </button>
        ) : null}

        {titulo ? (
          <header className="mdl-topo">
            {adorno ? <div className="mdl-adorno">{adorno}</div> : null}
            <div className="mdl-titulos">
              <h3>{titulo}</h3>
              {subtitulo ? <p>{subtitulo}</p> : null}
            </div>
          </header>
        ) : null}

        <div className="mdl-corpo">{children}</div>

        {acoes ? <footer className="mdl-acoes">{acoes}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
