import { VitrineProvider } from "../../showcase/contexto.jsx";
import { ShowcaseRenderer } from "../../showcase/ShowcaseRenderer.jsx";
import { BuilderPiece } from "./BuilderPiece";
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
  carouselIndexes,
  onProxima,
  onAnterior,
  whatsappHref,
  selecionada,
  multiSelecao,
  encostados,
  guias,
  novaPecaId,
  registrarPeca,
  aoSelecionar,
  aoIniciarResize,
  aoEditarTexto,
  acoes,
  altura,
}) {
  const travados = config.lockedBlocks || [];

  return (
    <div
      ref={canvasRef}
      data-tour="vitrine-canvas"
      className={`showcase-container showcase-builder-canvas showcase-palco editor-canvas-surface ${
        config.appearanceMode === "light" ? "showcase-theme-light" : ""
      }`}
      /* A fonte vem por herança do palco, que já recebeu `estiloDoTema` — a
         mesma função que a vitrine publicada usa. Declará-la aqui de novo seria
         a terceira cópia da mesma regra. */
      style={{ minHeight: `${altura}px` }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) aoSelecionar(null, e); }}
    >
      <SnapGuides guias={guias} />

      <VitrineProvider modo="editor" aoEditar={aoEditarTexto} tenantSlug={tenantSlug}>
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
                encostada={encostados.has(pieceId)}
                novaPeca={ehWidget && novaPecaId === widget.id}
                className={temBanner ? "showcase-section-has-bg" : ""}
                registrarRef={registrarPeca(pieceId)}
                onSelecionar={aoSelecionar}
                onResizeStart={aoIniciarResize(pieceId)}
                acoes={{
                  duplicar: ehWidget ? () => acoes.duplicar(pieceId) : undefined,
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
