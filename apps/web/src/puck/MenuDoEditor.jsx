import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DotsThree, LinkSimple, ClockCounterClockwise, Layout, ArrowCounterClockwise } from "@phosphor-icons/react";

/* ────────────────────────────────────────────────────────────────────────────
   O MENU DE AÇÕES RARAS.

   Modelos, histórico de versões, copiar o link da vitrine e recomeçar do zero.
   Quatro coisas que o editor clássico tinha no "•••" da barra superior.

   Elas ficam num menu, e não soltas na barra, pelo mesmo motivo de lá: são
   raras, e duas são DESTRUTIVAS. "Recomeçar" ao lado de "Publicar" seria o pior
   vizinho possível.

   ── A LISTA SAI DA ÁRVORE, E ISSO NÃO É CAPRICHO ──

   A primeira versão desenhava a lista logo abaixo do botão, com `z-index` alto.
   Ela aparecia ATRÁS da prancheta, e nenhum valor de `z-index` resolvia.

   O motivo, medido na cadeia de ancestrais: a barra de menu do Puck tem
   `z-index: 2` e, com isso, cria um CONTEXTO DE EMPILHAMENTO. Dentro de um
   contexto, o `z-index` dos filhos só compete entre irmãos — o `120` da lista
   disputava com os outros itens da barra, nunca com o painel lateral, que vive
   noutro ramo. E dois níveis acima há um `overflow: hidden` que recortaria o
   que sobrasse.

   Portal para o `body` resolve os dois de uma vez: fora de todo contexto e de
   todo recorte. O preço é posicionar à mão, e é por isso que a posição é
   MEDIDA a partir do botão a cada abertura, em vez de escrita no CSS.
   ──────────────────────────────────────────────────────────────────────────── */

export function MenuDoEditor({ itens }) {
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState(null);
  const botao = useRef(null);
  const lista = useRef(null);

  /* Antes de pintar, e não depois: medir num `useEffect` deixaria a lista
     aparecer um quadro no canto errado. */
  useLayoutEffect(() => {
    if (!aberto || !botao.current) return;
    const r = botao.current.getBoundingClientRect();
    setPosicao({ top: Math.round(r.bottom + 8), right: Math.round(window.innerWidth - r.right) });
  }, [aberto]);

  /* Fecha ao clicar fora e no Esc — as duas saídas que qualquer menu precisa
     ter, e cuja ausência faz a pessoa clicar em algo só para poder sair.
     Rolar ou redimensionar também fecha: a posição foi medida uma vez, e um
     menu ancorado no lugar errado é pior que um menu fechado. */
  useEffect(() => {
    if (!aberto) return undefined;
    const foraDaqui = (e) => {
      if (botao.current?.contains(e.target) || lista.current?.contains(e.target)) return;
      setAberto(false);
    };
    const aoTeclar = (e) => { if (e.key === "Escape") setAberto(false); };
    const fechar = () => setAberto(false);

    document.addEventListener("pointerdown", foraDaqui, true);
    document.addEventListener("keydown", aoTeclar);
    window.addEventListener("resize", fechar);
    window.addEventListener("scroll", fechar, true);
    return () => {
      document.removeEventListener("pointerdown", foraDaqui, true);
      document.removeEventListener("keydown", aoTeclar);
      window.removeEventListener("resize", fechar);
      window.removeEventListener("scroll", fechar, true);
    };
  }, [aberto]);

  return (
    <div className="puck-menu">
      <button
        ref={botao}
        type="button"
        className="puck-menu__abrir"
        aria-haspopup="menu"
        aria-expanded={aberto}
        title="Mais ações"
        onClick={() => setAberto((v) => !v)}
      >
        <DotsThree size={20} weight="bold" />
      </button>

      {aberto && posicao
        ? createPortal(
            <div className="puck-menu__lista" role="menu" ref={lista} style={posicao}>
              {itens.map((item) => (
                <button
                  key={item.rotulo}
                  type="button"
                  role="menuitem"
                  className={item.perigo ? "is-perigo" : ""}
                  disabled={item.desativado}
                  onClick={() => { setAberto(false); item.acao(); }}
                >
                  <item.Icone size={16} />
                  <span>
                    <strong>{item.rotulo}</strong>
                    {item.ajuda ? <em>{item.ajuda}</em> : null}
                  </span>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export const ICONES = { LinkSimple, ClockCounterClockwise, Layout, ArrowCounterClockwise };
