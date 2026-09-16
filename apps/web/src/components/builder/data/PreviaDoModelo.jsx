import { useEffect, useState } from "react";

/* ────────────────────────────────────────────────────────────────────────────
   A prévia de um modelo de vitrine — desenhada a partir do `config` dele.

   Era uma miniatura em formato de celular, igual para todos os modelos a menos
   de duas barrinhas. Aqui a prévia é a PÁGINA em miniatura: cabeçalho, título,
   destaques, grade de imóveis e, embaixo, cada widget do modelo com um glifo
   do próprio tipo (busca é uma barra com botão, números são três numerais,
   depoimento tem estrelas, mapa tem alfinete…), nas colunas em que o modelo os
   põe. Dois modelos diferentes ficam diferentes de relance.

   ── DESKTOP POR PADRÃO, CELULAR AO PASSAR O MOUSE ──
   O quadro nasce largo (é como a maioria vê a vitrine). Com o mouse em cima
   ele alterna com o quadro de celular a cada 1,3 s: a pessoa vê as duas sem
   clicar em nada. No celular os widgets empilham em coluna, que é o que a
   vitrine faz abaixo do ponto de quebra.

   Os DOIS quadros ficam montados, sobrepostos, e a troca é um esmaecimento
   cruzado (`opacity` com transição). Trocar o elemento de vez, como era,
   dava um corte seco a cada 1,3 s — e um piscar quando o mouse entrava.

   Um componente só para as três telas que mostram modelos (o assistente de
   boas-vindas, a gaveta "Modelos de página" do editor e o painel do editor
   clássico): três miniaturas divergiriam no primeiro widget novo.
   ──────────────────────────────────────────────────────────────────────────── */

const INTERVALO_MS = 1300;
const ZOOM = 0.75;
const FADE_MS = 380;

/* Os widgets do modelo em linhas, pela posição do desktop: mesma faixa de `y`
   (com folga) é a mesma linha; dentro da linha, ordenados por `x`. */
function linhasDosWidgets(widgets) {
  const lista = (widgets || [])
    .filter((w) => !w.hidden)
    .map((w) => ({ ...w, pos: w.layout?.desktop || { x: w.x, y: w.y, w: w.w, h: w.h } }))
    .sort((a, b) => (a.pos.y || 0) - (b.pos.y || 0) || (a.pos.x || 0) - (b.pos.x || 0));
  const linhas = [];
  for (const w of lista) {
    const ultima = linhas[linhas.length - 1];
    if (ultima && Math.abs((w.pos.y || 0) - ultima.y) < 40) ultima.itens.push(w);
    else linhas.push({ y: w.pos.y || 0, itens: [w] });
  }
  return linhas.map((l) => l.itens.sort((a, b) => (a.pos.x || 0) - (b.pos.x || 0)));
}

/* O glifo de cada tipo, em miniatura. `c` traz as cores do modelo. */
function Glifo({ tipo, c, mobile }) {
  const barra = (w, h = 3, cor = c.linha, extra = {}) => <span style={{ display: "block", width: w, height: h, borderRadius: 2, background: cor, ...extra }} />;
  const titulo = barra("58%", 3, c.forte);
  const linhas = (n, w = "90%") => Array.from({ length: n }, (_, i) => <span key={i} style={{ display: "block", width: i === n - 1 ? "62%" : w, height: 2, borderRadius: 1, background: c.linha }} />);
  const caixa = { display: "flex", flexDirection: "column", gap: 3, padding: mobile ? 4 : 5, borderRadius: 4, background: c.superficie, border: `1px solid ${c.borda}`, minHeight: mobile ? 22 : 26, boxSizing: "border-box" };

  switch (tipo) {
    case "property-search":
      return <div style={{ ...caixa, flexDirection: "row", alignItems: "center", gap: 3 }}>{barra("40%", 6, c.campo)}{barra("22%", 6, c.campo)}{barra("22%", 6, c.campo)}{barra("14%", 6, c.primaria, { marginLeft: "auto" })}</div>;
    case "stats":
      return <div style={{ ...caixa, flexDirection: "row", justifyContent: "space-around", alignItems: "flex-end" }}>{[0, 1, 2].map((i) => <span key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>{barra(10, 6, c.primaria)}{barra(14, 2)}</span>)}</div>;
    case "testimonial":
      return <div style={caixa}><span style={{ display: "flex", gap: 1 }}>{[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ width: 3, height: 3, borderRadius: 1, background: "#f5b301" }} />)}</span>{linhas(2)}</div>;
    case "hours":
      return <div style={caixa}>{titulo}{[0, 1].map((i) => <span key={i} style={{ display: "flex", justifyContent: "space-between" }}>{barra("40%", 2)}{barra("26%", 2, c.forte)}</span>)}</div>;
    case "map":
      return <div style={{ ...caixa, alignItems: "center", justifyContent: "center", background: c.mapa, minHeight: mobile ? 26 : 34 }}><span style={{ width: 6, height: 6, borderRadius: "50% 50% 50% 0", background: c.primaria, transform: "rotate(-45deg)" }} /></div>;
    case "regions":
      return <div style={caixa}>{titulo}<span style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>{[16, 22, 14, 20, 12].map((w, i) => barra(w, 5, c.campo, { key: i, borderRadius: 3 }))}</span></div>;
    case "faq":
      return <div style={caixa}>{[0, 1, 2].map((i) => <span key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>{barra("70%", 2, i === 0 ? c.forte : c.linha)}<span style={{ fontSize: 6, lineHeight: 1, color: c.linha }}>+</span></span>)}</div>;
    case "steps":
      return <div style={{ ...caixa, flexDirection: "row", gap: 4 }}>{[1, 2, 3].map((n) => <span key={n} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, alignItems: "center" }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: c.primaria }} />{barra("80%", 2)}</span>)}</div>;
    case "team":
      return <div style={{ ...caixa, flexDirection: "row", justifyContent: "center", gap: 4 }}>{[0, 1, 2].map((i) => <span key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: i === 1 ? c.primaria : c.campo }} />)}</div>;
    case "finance":
      return <div style={caixa}>{titulo}{barra("100%", 2, c.campo)}<span style={{ display: "flex", justifyContent: "space-between" }}>{barra("30%", 2)}{barra(18, 5, c.primaria)}</span></div>;
    case "cta":
      return <div style={{ ...caixa, alignItems: "center", background: c.ctaFundo }}>{barra("50%", 3, c.forte)}{barra("36%", 6, "#25D366", { borderRadius: 3 })}</div>;
    case "social":
      return <div style={{ ...caixa, flexDirection: "row", justifyContent: "center", gap: 3 }}>{[0, 1, 2, 3].map((i) => <span key={i} style={{ width: 6, height: 6, borderRadius: 2, background: c.campo }} />)}</div>;
    case "notice":
      return <div style={{ ...caixa, borderLeft: `2px solid ${c.secundaria}` }}>{barra("40%", 2, c.forte)}{linhas(1)}</div>;
    default:
      return <div style={caixa}>{titulo}{linhas(2)}</div>;
  }
}

function paleta(tpl) {
  const escuro = tpl.config?.appearanceMode !== "light";
  return {
    escuro,
    fundo: escuro ? "#0f172a" : "#f3f5f8",
    superficie: escuro ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)",
    borda: escuro ? "rgba(255,255,255,0.09)" : "rgba(15,23,42,0.08)",
    linha: escuro ? "rgba(255,255,255,0.22)" : "rgba(15,23,42,0.2)",
    forte: escuro ? "rgba(255,255,255,0.75)" : "rgba(15,23,42,0.75)",
    campo: escuro ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.1)",
    mapa: escuro ? "#1f2a3d" : "#dfe6ee",
    ctaFundo: escuro ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.03)",
    zebra: escuro ? "rgba(255,255,255,0.045)" : "rgba(15,23,42,0.05)",
    primaria: tpl.primaryColor || "#6366f1",
    secundaria: tpl.secondaryColor || "#d4af37",
  };
}

/** A página em miniatura, num dos dois quadros. */
function Pagina({ tpl, mobile }) {
  const c = paleta(tpl);
  const cfg = tpl.config || {};
  const ocultos = new Set(cfg.hiddenBlocks || []);
  const linhas = linhasDosWidgets(cfg.widgets);
  const barra = (w, h, cor, extra = {}) => <span style={{ display: "block", width: w, height: h, borderRadius: 2, background: cor, ...extra }} />;
  // O respiro do modelo: espaçamento externo grande abre as linhas.
  const g = (mobile ? 4 : 6) + Math.min(6, Math.round((Number(cfg.espacamento?.externo) || 0) / 6));

  return (
    /* `overflow: hidden` e filhos sem encolher: o que não couber é cortado
       embaixo, em vez de esmagar o cabeçalho e a grade para caber tudo. */
    <div className="previa-modelo__pagina" style={{ background: c.fundo, color: c.forte, padding: g, display: "flex", flexDirection: "column", gap: g, height: "100%", boxSizing: "border-box", fontSize: 0, overflow: "hidden" }}>
      {/* Cabeçalho: marca, links (só no desktop) e o botão. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>{barra(7, 7, c.secundaria, { borderRadius: 2 })}{barra(18, 3, c.forte)}</span>
        {mobile ? barra(8, 5, c.linha) : <span style={{ display: "flex", gap: 4 }}>{barra(12, 2, c.linha)}{barra(12, 2, c.linha)}{barra(12, 2, c.linha)}</span>}
        {barra(mobile ? 14 : 20, 6, c.primaria, { borderRadius: 3 })}
      </div>
      {/* Título */}
      {!ocultos.has("title") ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: `${g}px 0` }}>
          {barra(mobile ? "84%" : "56%", 5, c.forte)}{barra(mobile ? "60%" : "40%", 3, c.linha)}
        </div>
      ) : null}
      {/* Destaques */}
      {!ocultos.has("highlights") ? (
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr", gap: 3 }}>
          {[0, 1, 2].slice(0, mobile ? 2 : 3).map((i) => <span key={i} style={{ height: mobile ? 8 : 10, borderRadius: 3, background: c.superficie, border: `1px solid ${c.borda}` }} />)}
        </div>
      ) : null}
      {/* Grade de imóveis */}
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr", gap: 3 }}>
        {[0, 1, 2].slice(0, mobile ? 1 : 3).map((i) => (
          <span key={i} style={{ display: "flex", flexDirection: "column", gap: 2, borderRadius: 3, overflow: "hidden", background: c.superficie, border: `1px solid ${c.borda}` }}>
            <span style={{ height: mobile ? 16 : 14, background: `linear-gradient(135deg, ${c.primaria}88, ${c.secundaria}55)` }} />
            <span style={{ padding: 3, display: "flex", flexDirection: "column", gap: 2 }}>{barra("70%", 2, c.forte)}{barra("45%", 2, c.linha)}</span>
          </span>
        ))}
      </div>
      {/* Widgets, nas colunas do modelo (desktop) ou empilhados (celular) */}
      {/* A identidade de layout do modelo aparece aqui: zebra (faixa a cada
          linha ímpar) e o respiro (gap maior quando o modelo é arejado). */}
      {linhas.map((itens, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : itens.map((w) => `${Math.max(1, Math.round(w.pos.w || 100))}fr`).join(" "), gap: 3, padding: cfg.zebrado !== false && i % 2 === 1 ? 3 : 0, margin: cfg.zebrado !== false && i % 2 === 1 ? -3 : 0, borderRadius: 3, background: cfg.zebrado !== false && i % 2 === 1 ? c.zebra : "transparent" }}>
          {itens.map((w) => <Glifo key={w.id} tipo={w.type} c={c} mobile={mobile} />)}
        </div>
      ))}
      {/* Rodapé */}
      <div style={{ marginTop: "auto", display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr 1fr", gap: 3, paddingTop: g, borderTop: `1px solid ${c.borda}` }}>
        {[0, 1, 2].slice(0, mobile ? 1 : 3).map((i) => <span key={i} style={{ display: "flex", flexDirection: "column", gap: 2 }}>{barra("50%", 2, c.forte)}{barra("70%", 2, c.linha)}</span>)}
      </div>
    </div>
  );
}

/**
 * @param {{ tpl: object, altura?: number, alternar?: boolean }} p
 *   `alternar` (padrão true): alterna desktop ↔ celular com o mouse em cima.
 */
export function PreviaDoModelo({ tpl, altura = 150, alternar = true }) {
  const [mouse, setMouse] = useState(false);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    if (!mouse || !alternar) { setMobile(false); return undefined; }
    setMobile(true);
    const id = setInterval(() => setMobile((m) => !m), INTERVALO_MS);
    return () => clearInterval(id);
  }, [mouse, alternar]);

  const c = paleta(tpl);
  /* Cada quadro cobre o espaço inteiro e só a opacidade muda entre eles. O
     que está escondido não recebe o ponteiro nem é lido pelo leitor de tela. */
  const camada = (visivel) => ({
    position: "absolute", inset: 0, display: "flex", justifyContent: "center",
    opacity: visivel ? 1 : 0, transition: `opacity ${FADE_MS}ms ease`,
    pointerEvents: visivel ? "auto" : "none",
  });
  return (
    <div
      className="previa-modelo"
      onMouseEnter={() => setMouse(true)}
      onMouseLeave={() => setMouse(false)}
      style={{ height: altura, borderRadius: 8, overflow: "hidden", background: c.escuro ? "#0b1020" : "#e6e9ef", border: `1px solid ${c.borda}`, position: "relative" }}
      aria-label={`Prévia do modelo ${tpl.name || ""}${mobile ? " (celular)" : " (computador)"}`}
    >
      {/* Reduzida por `zoom` para a página INTEIRA caber no quadro: o que
          distingue um modelo do outro são os widgets, e eles ficam embaixo. */}
      <div style={{ ...camada(!mobile), alignItems: "flex-start" }} aria-hidden={mobile}>
        <div style={{ width: `calc(100% / ${ZOOM})`, height: `calc(100% / ${ZOOM})`, zoom: ZOOM, overflow: "hidden" }}><Pagina tpl={tpl} mobile={false} /></div>
      </div>
      {/* O celular: quadro estreito, com moldura, centrado no mesmo espaço. */}
      <div style={{ ...camada(mobile), alignItems: "center" }} aria-hidden={!mobile}>
        <div style={{ width: Math.round(altura * 0.46), height: altura - 12, borderRadius: 8, border: `2px solid ${c.escuro ? "#334155" : "#94a3b8"}`, overflow: "hidden", boxSizing: "border-box" }}>
          <div style={{ width: `calc(100% / ${ZOOM})`, height: `calc(100% / ${ZOOM})`, zoom: ZOOM }}><Pagina tpl={tpl} mobile /></div>
        </div>
      </div>
      <span style={{ position: "absolute", right: 6, bottom: 5, fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", color: c.escuro ? "rgba(255,255,255,0.45)" : "rgba(15,23,42,0.45)", background: c.escuro ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.6)", padding: "1px 5px", borderRadius: 999 }}>
        {mobile ? "CELULAR" : "DESKTOP"}
      </span>
    </div>
  );
}
