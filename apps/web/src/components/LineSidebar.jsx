import { useRef, useState, useCallback, useEffect } from "react";
import "./LineSidebar.css";

/* ────────────────────────────────────────────────────────────────────────────
   LineSidebar — lista com resposta à proximidade do cursor.

   Do React Bits. Um item se acende, desliza e estica o próprio traço conforme o
   ponteiro se aproxima da linha dele — tudo derivado de um único valor
   `--effect` (0..1), interpolado em JS num laço de rAF.

   POR QUE UM LAÇO E NÃO TRANSIÇÕES DE CSS: cor, deslocamento e escala precisam
   andar juntos. Em transições separadas cada propriedade tem o próprio tempo, e
   o item chega ao destino em três momentos diferentes — o que se vê é o texto
   deslizando antes de acender.

   Dois desvios do original:

   1. CONTROLADO POR FORA. O original guarda o item ativo em estado interno.
      Aqui `activeIndex` pode vir por prop: no FAQ quem manda é a pergunta
      aberta, e a resposta exibida ao lado precisa ser a mesma que a lista
      destaca. Sem isso seriam duas fontes de verdade para o mesmo fato.

   2. RESPEITA "reduzir movimento" e ponteiro grosso. Sem cursor não há
      proximidade a medir: em tela de toque a lista fica estática e os itens
      seguem clicáveis.
   ──────────────────────────────────────────────────────────────────────────── */

const FALLOFF_CURVES = {
  linear: (p) => p,
  smooth: (p) => p * p * (3 - 2 * p),
  sharp: (p) => p * p * p,
};

const LineSidebar = ({
  items = [],
  accentColor = "#A855F7",
  textColor = "#c4c4c4",
  markerColor = "#6c6c6c",
  showIndex = true,
  showMarker = true,
  proximityRadius = 100,
  maxShift = 30,
  falloff = "smooth",
  markerLength = 60,
  markerGap = 0,
  tickScale = 0.5,
  scaleTick = true,
  itemGap = 20,
  fontSize = 1.1,
  smoothing = 100,
  defaultActive = null,
  /** Quando informado, o item ativo é ditado por quem usa (modo controlado). */
  activeIndex: activeControlado,
  onItemClick,
  className = "",
}) => {
  const listRef = useRef(null);
  const itemRefs = useRef([]);
  const targetsRef = useRef([]);
  const currentRef = useRef([]);
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  const activeRef = useRef(defaultActive);
  const smoothingRef = useRef(smoothing);
  const [activeInterno, setActiveInterno] = useState(defaultActive);

  const controlado = activeControlado !== undefined;
  const activeIndex = controlado ? activeControlado : activeInterno;

  activeRef.current = activeIndex;
  smoothingRef.current = smoothing;

  /* Um laço só, suavizando todo item na direção do alvo com passo exponencial
     independente da taxa de quadros — o `k` sai de `dt`, então a 30 e a 144 Hz
     o movimento leva o mesmo tempo de relógio. */
  const runFrame = useCallback((now) => {
    const dt = Math.min((now - lastRef.current) / 1000, 0.05);
    lastRef.current = now;
    const tau = Math.max(smoothingRef.current, 1) / 1000;
    const k = 1 - Math.exp(-dt / tau);

    let movendo = false;
    const els = itemRefs.current;
    for (let i = 0; i < els.length; i += 1) {
      const el = els[i];
      if (!el) continue;
      const alvo = Math.max(targetsRef.current[i] || 0, activeRef.current === i ? 1 : 0);
      const atual = currentRef.current[i] || 0;
      const proximo = atual + (alvo - atual) * k;
      const assentou = Math.abs(alvo - proximo) < 0.0015;
      const valor = assentou ? alvo : proximo;
      currentRef.current[i] = valor;
      el.style.setProperty("--effect", valor.toFixed(4));
      if (!assentou) movendo = true;
    }

    // Para quando tudo assentou: laço eterno para desenhar o que não muda é a
    // parte cara de um efeito barato.
    rafRef.current = movendo ? requestAnimationFrame(runFrame) : null;
  }, []);

  const startLoop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    lastRef.current = performance.now();
    rafRef.current = requestAnimationFrame(runFrame);
  }, [runFrame]);

  const handlePointerMove = useCallback(
    (e) => {
      const list = listRef.current;
      if (!list) return;
      const rect = list.getBoundingClientRect();
      const pointerY = e.clientY - rect.top;
      const ease = FALLOFF_CURVES[falloff] ?? FALLOFF_CURVES.linear;
      const els = itemRefs.current;
      for (let i = 0; i < els.length; i += 1) {
        const el = els[i];
        if (!el) continue;
        const centro = el.offsetTop + el.offsetHeight / 2;
        const distancia = Math.abs(pointerY - centro);
        targetsRef.current[i] = ease(Math.max(0, 1 - distancia / proximityRadius));
      }
      startLoop();
    },
    [falloff, proximityRadius, startLoop],
  );

  const handlePointerLeave = useCallback(() => {
    targetsRef.current = targetsRef.current.map(() => 0);
    startLoop();
  }, [startLoop]);

  const handleClick = useCallback(
    (index, label) => {
      if (!controlado) setActiveInterno(index);
      onItemClick?.(index, label);
    },
    [controlado, onItemClick],
  );

  useEffect(() => { startLoop(); }, [activeIndex, startLoop]);

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  return (
    <nav
      className={
        `line-sidebar${showMarker ? " line-sidebar--markers" : ""}` +
        `${scaleTick ? " line-sidebar--scale-tick" : ""}${className ? ` ${className}` : ""}`
      }
      style={{
        "--accent-color": accentColor,
        "--text-color": textColor,
        "--marker-color": markerColor,
        "--marker-length": `${markerLength}px`,
        "--marker-gap": `${markerGap}px`,
        "--tick-scale": tickScale,
        "--max-shift": `${maxShift}px`,
        "--item-gap": `${itemGap}px`,
        "--font-size": `${fontSize}rem`,
        "--smoothing": `${smoothing}ms`,
      }}
    >
      <ul
        ref={listRef}
        className="line-sidebar__list"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {items.map((label, index) => (
          <li
            key={`${label}-${index}`}
            ref={(el) => { itemRefs.current[index] = el; }}
            className="line-sidebar__item"
          >
            {showMarker && <span className="line-sidebar__marker" aria-hidden="true" />}
            {/* Botão de verdade, e não um <li> clicável como no original: a
                lista comanda o que aparece ao lado, então precisa de foco, Enter
                e Espaço — e de um estado que o leitor de tela consiga anunciar. */}
            <button
              type="button"
              className="line-sidebar__label"
              aria-current={activeIndex === index ? "true" : undefined}
              onClick={() => handleClick(index, label)}
            >
              {showIndex && <span className="line-sidebar__index">{String(index + 1).padStart(2, "0")}</span>}
              <span className="line-sidebar__text">{label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default LineSidebar;
