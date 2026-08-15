import { AlcaDeArrasto } from "../AlcaDeArrasto";
import {
  IconeCadeado,
  IconeCadeadoAberto,
  IconeDuplicar,
  IconeGrip,
  IconeOlhoCortado,
} from "../iconesEditor";

/* ────────────────────────────────────────────────────────────────────────────
   A moldura de uma peça no canvas — bloco fixo ou widget, sem distinção.

   Antes cada bloco carregava, no meio do JSX da página, a sua própria alça, os
   seus dois ou três botões posicionados com `right` na mão e a sua alça de
   resize. Cinco cópias quase iguais, mais uma sexta para os widgets. Trocar o
   visual da seleção significava editar seis lugares — e foi por isso que os
   ícones dos widgets acabaram se sobrepondo: eram os únicos com três botões, e
   as contas de `right` foram feitas pensando em dois.

   ── A GRAMÁTICA VISUAL ──

   · repouso     — nada. A peça é a página, não um formulário.
   · hover       — contorno fino e discreto, e a etiqueta com o nome aparece.
   · selecionada — contorno no accent, etiqueta sólida, alças de canto e a barra
                   contextual de ações.
   · travada     — cadeado na etiqueta; nem arrasto nem alça.
   · encostada   — a borda ACENDE no ponto do encontro, em vez de desenhar uma
                   segunda linha por cima.

   A etiqueta é a alça de arrasto. Isso é deliberado: o corpo da peça é texto
   editável, e peça inteira arrastável significa não conseguir selecionar uma
   palavra sem mover a página.
   ──────────────────────────────────────────────────────────────────────────── */

export function BuilderPiece({
  pieceId,
  rect,
  rotulo,
  travada,
  selecionada,
  emMultiSelecao,
  encostada,
  novaPeca,
  className = "",
  /* A posição vem PRONTA do `ShowcaseRenderer` — a mesma que a vitrine pública
     aplica na mesma peça. Calcular `left`/`top`/`width` aqui seria a segunda
     implementação da mesma conta, e a primeira a divergir no dia em que alguém
     mexesse na sangria dos blocos com banner. */
  estilo,
  registrarRef,
  onSelecionar,
  onResizeStart,
  acoes,
  children,
}) {
  const classes = [
    "builder-piece",
    className,
    selecionada ? "is-selected" : "",
    emMultiSelecao && !selecionada ? "is-multi" : "",
    encostada ? "is-encostado" : "",
    travada ? "is-locked" : "",
    novaPeca ? "piece-entering" : "",
  ].filter(Boolean).join(" ");

  // Etiqueta acima da borda, como num editor de design. Só quando a peça está
  // colada no topo do canvas ela vai para dentro, senão seria cortada.
  const etiquetaDentro = (rect.y ?? 0) < 26;

  return (
    <section
      ref={registrarRef}
      data-piece-id={pieceId}
      className={classes}
      /* A peça selecionada sobe acima das vizinhas para o contorno e a etiqueta
         não ficarem por baixo de quem está ao lado.

         SUBIR, nunca descer: o cabeçalho vem do renderizador com z-index 9999
         (ele sobrepõe a página, como na vitrine). Cravar 60 aqui derrubava o
         cabeçalho para trás dos outros blocos no instante em que ele era
         selecionado — clicar nele o fazia sumir por baixo do hero. */
      style={selecionada ? { ...estilo, zIndex: Math.max(Number(estilo?.zIndex) || 0, 60) } : estilo}
      onPointerDown={(e) => onSelecionar?.(pieceId, e)}
    >
      <div className={`builder-piece-chrome ${etiquetaDentro ? "is-inside" : ""}`}>
        <AlcaDeArrasto
          id={pieceId}
          travado={travada}
          className="builder-piece-label"
          title={travada ? "Peça travada" : "Arraste para mover"}
        >
          {travada ? <IconeCadeado size={11} /> : <IconeGrip size={11} />}
          <span>{rotulo}</span>
        </AlcaDeArrasto>

        {selecionada && acoes ? (
          <div className="builder-piece-actions" onPointerDown={(e) => e.stopPropagation()}>
            {acoes.duplicar ? (
              <button type="button" className="editor-icon-button" title="Duplicar" onClick={acoes.duplicar}>
                <IconeDuplicar size={13} />
              </button>
            ) : null}
            <button
              type="button"
              className="editor-icon-button"
              title={travada ? "Destravar" : "Travar posição"}
              onClick={acoes.alternarTrava}
            >
              {travada ? <IconeCadeado size={13} /> : <IconeCadeadoAberto size={13} />}
            </button>
            <button type="button" className="editor-icon-button is-danger" title="Ocultar" onClick={acoes.ocultar}>
              <IconeOlhoCortado size={13} />
            </button>
          </div>
        ) : null}
      </div>

      {children}

      {travada ? (
        /* Peça travada precisa dizer isso PARADA. O cadeado só aparecia na
           etiqueta, que por sua vez só aparece no hover — então, em repouso,
           uma peça travada era indistinguível de uma solta, e a pessoa
           descobria o cadeado tentando arrastar e não conseguindo. */
        <span className="builder-piece-lock" aria-hidden>
          <IconeCadeado size={12} />
        </span>
      ) : (
        <>
          {/* Selecionar ANTES de redimensionar: o gesto de resize interrompe a
              propagação do evento (senão o dnd-kit tentaria arrastar junto), e
              sem esta chamada explícita puxar a alça deixaria o inspetor
              apontando para outra peça. */}
          <span
            className="builder-piece-handle is-se"
            title="Redimensionar"
            onPointerDown={(e) => { onSelecionar?.(pieceId, e); onResizeStart?.(e); }}
          />
          {/* Os outros três cantos são MARCA de seleção, não alça — só o canto
              inferior direito redimensiona. Desenhados iguais ao que funciona,
              eles prometiam um gesto que não existe: a pessoa puxava o canto
              superior esquerdo e nada acontecia. Agora são pontos menores e
              apagados, que leem como quina e não como pega. */}
          <span className="builder-piece-handle is-passive is-ne" aria-hidden />
          <span className="builder-piece-handle is-passive is-nw" aria-hidden />
          <span className="builder-piece-handle is-passive is-sw" aria-hidden />
        </>
      )}
    </section>
  );
}
