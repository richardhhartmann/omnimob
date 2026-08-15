import { blockHasBackgroundImage, sectionSurfaceStyle, widgetRect } from "../../utils/showcaseConfig";
import { BLOCK_KEYS, BLOCK_LABELS, blockPieceId, blockRect, widgetPieceId } from "./engine/pieces.js";
import { ShowcaseFooter } from "./ShowcaseFooter.jsx";
import { ShowcaseHeader } from "./ShowcaseHeader.jsx";
import { ShowcaseHero } from "./ShowcaseHero.jsx";
import { ShowcaseHighlights } from "./ShowcaseHighlights.jsx";
import { ShowcasePropertyGrid, estiloDaGrade } from "./ShowcasePropertyGrid.jsx";
import { ShowcaseWidget } from "./ShowcaseWidget.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   O renderizador da vitrine — a fonte de verdade visual.

   Ele conhece a ORDEM das peças, o CONTEÚDO de cada uma e a POSIÇÃO que cada
   uma ocupa. O que ele não conhece é o invólucro: quem chama entrega uma função
   `envolverPeca`, e é ela que decide se aquela caixa é uma `<section>` simples
   (vitrine) ou uma peça do construtor com contorno, etiqueta e alças (editor).

   É essa fronteira que torna a divergência difícil de criar por acidente. Para
   o editor mostrar algo diferente da página publicada, alguém precisaria
   escrever um segundo renderizador — e não existe mais um lugar onde isso
   pareça natural.

   ── A SANGRIA ──

   Blocos com banner (e o cabeçalho, sempre) vazam para além da coluna de
   conteúdo. Na vitrine isso é a largura da JANELA; no editor, a largura da
   PRANCHETA. As duas usam a mesma declaração e mudam só a variável CSS
   `--sangria-*`, definida no contêiner de cada ambiente — sem isso, o editor
   precisaria de um cálculo próprio e voltaríamos a ter duas regras.
   ──────────────────────────────────────────────────────────────────────────── */

const Z_CABECALHO = 9999;

function estiloDePosicao(rect, { sangra, z }) {
  const base = {
    position: "absolute",
    top: `${rect.y}px`,
    minHeight: `${rect.h}px`,
    boxSizing: "border-box",
    zIndex: z,
  };
  if (sangra) {
    return { ...base, left: "var(--sangria-x)", width: "var(--sangria-w)", maxWidth: "var(--sangria-w)" };
  }
  return { ...base, left: `${rect.x}%`, width: `${rect.w}%` };
}

export function ShowcaseRenderer({
  config,
  mode,
  tenant,
  tenantSlug,
  properties = [],
  carouselIndexes = {},
  onProxima,
  onAnterior,
  carregando = false,
  erro = "",
  whatsappHref,
  envolverPeca,
}) {
  const blockStyles = config.blockStyles;
  const ocultos = config.hiddenBlocks || [];
  const isMobile = mode === "mobile";

  function bloco(key, conteudo) {
    if (ocultos.includes(key)) return null;

    const temBanner = blockHasBackgroundImage(blockStyles[key]);
    // O cabeçalho sangra sempre: ele é a faixa do topo da página, com ou sem
    // imagem de fundo. Os demais só quando ganham banner.
    const sangra = key === "header" || temBanner;
    const rect = blockRect(config, mode, key);

    const estilo = {
      ...estiloDePosicao(rect, { sangra, z: key === "header" ? Z_CABECALHO : temBanner ? 0 : 10 }),
      ...(temBanner ? { ...sectionSurfaceStyle(blockStyles[key]), backgroundPosition: "top center" } : {}),
    };

    return envolverPeca({
      pieceId: blockPieceId(key),
      rotulo: BLOCK_LABELS[key],
      rect,
      temBanner,
      estilo,
      children: conteudo,
    });
  }

  return (
    <>
      {bloco("header", (
        <ShowcaseHeader
          tenant={tenant}
          tenantSlug={tenantSlug}
          blockStyles={blockStyles}
          isMobileViewport={isMobile}
          whatsappHref={whatsappHref}
        />
      ))}

      {bloco("title", <ShowcaseHero tenant={tenant} blockStyles={blockStyles} />)}

      {bloco("highlights", <ShowcaseHighlights config={config} blockStyles={blockStyles} />)}

      {bloco("properties", (
        <ShowcasePropertyGrid
          properties={properties}
          tenantSlug={tenantSlug}
          carouselIndexes={carouselIndexes}
          onProxima={onProxima}
          onAnterior={onAnterior}
          estilo={estiloDaGrade(blockStyles)}
          carregando={carregando}
          erro={erro}
        />
      ))}

      {(config.widgets || []).filter((w) => !w.hidden).map((widget) => {
        const rect = widgetRect(widget, mode);
        return envolverPeca({
          pieceId: widgetPieceId(widget.id),
          rotulo: (widget.title || "Widget").replace(/<[^>]*>/g, "").slice(0, 28) || "Widget",
          rect,
          temBanner: false,
          widget,
          estilo: estiloDePosicao(rect, { sangra: false, z: 10 }),
          children: <ShowcaseWidget widget={widget} />,
        });
      })}

      {bloco("footer", (
        <ShowcaseFooter tenant={tenant} config={config} blockStyles={blockStyles} whatsappHref={whatsappHref} />
      ))}
    </>
  );
}

export { BLOCK_KEYS };
