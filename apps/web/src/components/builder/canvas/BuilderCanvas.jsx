import { VitrineProvider } from "../../showcase/contexto.jsx";
import { ShowcaseRenderer } from "../../showcase/ShowcaseRenderer.jsx";
import { BuilderPiece } from "./BuilderPiece";
import { BuilderMultiToolbar } from "./BuilderMultiToolbar";
import { BuilderPseudoSections } from "./BuilderPseudoSections";
import { SnapGuides } from "./SnapGuides";

/* ────────────────────────────────────────────────────────────────────────────
   A prancheta.

   Ela não desenha a vitrine — quem desenha é o `ShowcaseRenderer`, o MESMO que
   a página pública usa. O que o canvas faz é envolver cada peça com o aparato
   de edição: contorno, etiqueta, alças, realce de contato, seleção.

   Essa é a regra: o construtor põe controles EM VOLTA do conteúdo, nunca no
   lugar dele. Antes este arquivo tinha a sua própria versão de cabeçalho,
   título, destaques, grade e widgets — e era ali que a divergência nascia, uma
   linha por vez, cada vez que alguém ajustava um padding de um lado só.
   ──────────────────────────────────────────────────────────────────────────── */

export function BuilderCanvas({
  canvasRef,
  mode,
  config,
  tenant,
  tenantSlug,
  properties,
  /* Os mesmos dados reais que a vitrine pública recebe. Sem eles aqui, o
     editor desenharia a equipe de exemplo e a página publicada mostraria a de
     verdade — a divergência que a regra WYSIWYG existe para impedir. */
  dadosDaVitrine,
  carouselIndexes,
  onProxima,
  onAnterior,
  whatsappHref,
  selecionada,
  multiSelecao,
  encostados,
  guias,
  gesto,
  /* A IA está executando um plano? Muda a animação das peças e acende a
     folha — ver `builder/ia/`. */
  iaTrabalhando = false,
  novaPecaId,
  registrarPeca,
  aoSelecionar,
  aoIniciarResize,
  aoEditarTexto,
  acoes,
  acoesMulti,
  aoIniciarPseudoSecao,
  zoom = 1,
  altura,
}) {
  const travados = config.lockedBlocks || [];

  return (
    <div
      ref={canvasRef}
      data-tour="vitrine-canvas"
      className={`showcase-container showcase-builder-canvas showcase-palco editor-canvas-surface ${
        config.appearanceMode === "light" ? "showcase-theme-light" : ""
      } ${iaTrabalhando ? "is-ia-trabalhando" : ""}`}
      /* A fonte vem por herança do palco, que já recebeu `estiloDoTema` — a
         mesma função que a vitrine publicada usa. Declará-la aqui de novo seria
         a terceira cópia da mesma regra. */
      style={{ minHeight: `${altura}px` }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) aoSelecionar(null, e); }}
    >
      <SnapGuides guias={guias} />
      <BuilderPseudoSections
        config={config}
        mode={mode}
        selecionados={multiSelecao}
        gesto={gesto}
        zoom={zoom}
        onIniciarArrasto={aoIniciarPseudoSecao}
      />
      {!gesto ? (
        <BuilderMultiToolbar
          config={config}
          mode={mode}
          selecionados={multiSelecao}
          zoom={zoom}
          onAlinhar={acoesMulti?.alinhar}
          onDistribuir={acoesMulti?.distribuir}
        />
      ) : null}

      <VitrineProvider modo="editor" aoEditar={aoEditarTexto} tenantSlug={tenantSlug} dados={dadosDaVitrine}>
        <ShowcaseRenderer
          config={config}
          mode={mode}
          tenant={tenant}
          tenantSlug={tenantSlug}
          properties={properties}
          carouselIndexes={carouselIndexes}
          onProxima={onProxima}
          onAnterior={onAnterior}
          whatsappHref={whatsappHref}
          envolverPeca={({ pieceId, rotulo, rect, temBanner, estilo, widget, children }) => {
            const ehWidget = Boolean(widget);
            const travada = ehWidget ? widget.locked === true : travados.includes(pieceId.slice(2));

            return (
              <BuilderPiece
                key={pieceId}
                pieceId={pieceId}
                rect={rect}
                estilo={estilo}
                rotulo={rotulo}
                travada={travada}
                selecionada={selecionada === pieceId}
                emMultiSelecao={multiSelecao.has(pieceId)}
                selecaoMultiplaAtiva={multiSelecao.size > 1}
                encostada={encostados.has(pieceId)}
                novaPeca={ehWidget && novaPecaId === widget.id}
                /* Durante a execução da IA TODAS as peças animam, inclusive
                   a que está sendo mexida — o oposto do arrasto, onde a peça na
                   mão precisa acompanhar o ponteiro sem atraso. Aqui não há
                   ponteiro: o movimento É o que se quer ver. */
                animarLayout={iaTrabalhando || (Boolean(gesto) && gesto?.tipo !== "resize")}
                emArrasto={
                  gesto?.pieceId === pieceId ||
                  (gesto?.tipo === "section" && (gesto?.pieceIds || []).includes(pieceId))
                }
                magnetizada={
                  gesto?.pieceId === pieceId &&
                  gesto?.magnetico === true &&
                  (gesto?.grade?.colunas || 1) > 1
                }
                linhaSolo={
                  gesto?.pieceId === pieceId &&
                  gesto?.magnetico === true &&
                  gesto?.grade?.colunas === 1
                }
                previewInsercao={gesto?.pieceId === pieceId && gesto?.tipo === "insert"}
                className={temBanner ? "showcase-section-has-bg" : ""}
                registrarRef={registrarPeca(pieceId)}
                onSelecionar={aoSelecionar}
                onResizeStart={aoIniciarResize(pieceId)}
                acoes={{
                  alternarTrava: () => acoes.alternarTrava(pieceId),
                  ocultar: () => acoes.ocultar(pieceId),
                }}
              >
                {children}
              </BuilderPiece>
            );
          }}
        />
      </VitrineProvider>
    </div>
  );
}
