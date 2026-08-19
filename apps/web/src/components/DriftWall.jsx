import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "./DriftWall.css";

/* ────────────────────────────────────────────────────────────────────────────
   DriftWall — parede de peças em perspectiva, com colunas à deriva.

   Vem do React Bits (reactbits.dev). Três desvios do original, todos por
   necessidade desta página:

   1. PEÇA COM CONTEÚDO, e não só imagem. O original monta `<img src={item.image}>`.
      Aqui as peças são os cartões de destaque da landing, que são texto. Um item
      pode trazer `content` (qualquer JSX) em vez de `image`; a imagem continua
      funcionando para quem passar `image`.

   2. MODO DECORATIVO (`interactive={false}`). O original põe `tabIndex={0}` e
      `role="button"` em toda peça — e a parede repete a lista várias vezes para
      o laço fechar, então uma parede de fundo criaria dezenas de paradas de
      teclado anunciando "tile" antes de a pessoa chegar ao próximo link de
      verdade. Como fundo, ela sai da árvore de acessibilidade inteira.

   3. PAUSA FORA DA TELA. O original roda `requestAnimationFrame` para sempre,
      mesmo com a seção fora da janela. Numa landing longa isso é a maior parte
      do tempo. Um IntersectionObserver desliga o laço quando ninguém está
      vendo — e, junto com ele, a chamada de repintura da GPU.
   ──────────────────────────────────────────────────────────────────────────── */

const DEFAULT_ITEMS = Array.from({ length: 15 }, (_, i) => {
  const ids = [1015, 1025, 1039, 1043, 1044, 1050, 1062, 1069, 1074, 1080, 1084, 106, 110, 133, 164];
  return { image: `https://picsum.photos/id/${ids[i % ids.length]}/600/400`, title: `Tile ${i + 1}` };
});

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Espalha as velocidades sem sortear: o número áureo distribui os fatores de
   forma quase uniforme, e sendo determinístico a parede fica igual a cada
   render — sorteio faria as colunas trocarem de ritmo a cada remontagem. */
const columnFactor = (index, variance) => {
  const pseudo = ((index * 0.6180339887 + 0.35) % 1) * 2 - 1;
  return 1 + variance * pseudo;
};

/* Sorteio COM SEMENTE. Precisa parecer aleatório e ser sempre o mesmo: com
   `Math.random` a parede se reorganizaria a cada render do pai — as peças
   trocariam de coluna no meio da animação, à vista de quem está lendo. */
function baralhoComSemente(semente) {
  let estado = semente >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function embaralhar(lista, semente) {
  const sorteio = baralhoComSemente(semente);
  const saida = [...lista];
  for (let i = saida.length - 1; i > 0; i -= 1) {
    const j = Math.floor(sorteio() * (i + 1));
    [saida[i], saida[j]] = [saida[j], saida[i]];
  }
  return saida;
}

const DriftWall = ({
  items = DEFAULT_ITEMS,
  /** Número de colunas, ou "auto" para encher a largura medida do contêiner. */
  columns = 5,
  tileWidth = 200,
  tileHeight = 132,
  gap = 18,
  radius = 14,
  tilt = 16,
  turn = -14,
  roll = 0,
  perspective = 1200,
  depth = 120,
  speed = 42,
  direction = "up",
  variance = 0.45,
  parallax = 0.6,
  pauseOnHover = false,
  lift = 64,
  fade = 0.6,
  dim = 0.55,
  grayscale = false,
  overlayColor = "#060010",
  /** false = fundo decorativo: sem foco, sem leitor de tela, sem cursor. */
  interactive = true,
  /** Congela a deriva sem desmontar nada — as peças ficam onde estão e
   *  continuam clicáveis. Vem do orçamento de efeitos da landing
   *  (`components/Efeitos.jsx`): em máquina fraca o movimento sai e o
   *  conteúdo fica. */
  paused = false,
  /** Chamado com o item ao clicar numa peça. Liga o clique mesmo sem foco. */
  onItemClick,
  className = "",
  style,
}) => {
  const containerRef = useRef(null);
  const planeRef = useRef(null);
  const trackRefs = useRef([]);
  const rafRef = useRef(null);

  const offsetsRef = useRef([]);
  const velocitiesRef = useRef([]);
  const hoveredColRef = useRef(-1);
  const wallHoveredRef = useRef(false);
  const pointerRef = useRef({ x: 0, y: 0 });
  const pointerDampedRef = useRef({ x: 0, y: 0 });
  const lastTsRef = useRef(null);

  const [containerHeight, setContainerHeight] = useState(600);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [activeId, setActiveId] = useState(null);
  const activeIdRef = useRef(null);
  const [prefereReduzir, setPrefereReduzir] = useState(false);
  const [naTela, setNaTela] = useState(true);
  /* Duas origens, um efeito: a preferência declarada no sistema e o orçamento
     medido da máquina. Derivar aqui evita repetir o "ou" nos seis lugares que
     consultam isto abaixo — e é ali que um deles seria esquecido. */
  const reduced = prefereReduzir || paused;

  useEffect(() => {
    setPrefereReduzir(prefersReducedMotion());
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e) => setPrefereReduzir(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  /* Margem generosa: a parede volta a andar um pouco ANTES de aparecer, senão
     ela entra na tela parada e arranca na frente de quem está rolando. */
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(
      ([entrada]) => setNaTela(entrada.isIntersecting),
      { rootMargin: "200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* Quantas colunas cabem de verdade.

     Com número fixo, uma tela larga sobrava: cinco colunas de 268px dão ~1430px,
     e num monitor de 2560 as laterais ficavam vazias — a parede virava uma
     faixa central. `columns="auto"` mede o contêiner e enche.

     O fator 1.45 cobre o que a perspectiva rouba: o plano é girado em Y e
     escalado, então ele precisa ser mais largo que a caixa para as bordas não
     aparecerem. */
  const colunasEfetivas = useMemo(() => {
    if (columns !== "auto") return Math.max(1, columns);
    const passo = tileWidth + gap;
    return Math.max(3, Math.ceil((containerWidth * 1.3) / passo));
  }, [columns, containerWidth, tileWidth, gap]);

  /* Quanto da caixa a parede precisa cobrir, no espaço do plano.

     O plano é escalado (1.18) e girado em X e Y, então a faixa a preencher é
     mais alta que a caixa.

     Esteve em 2.6 por um diagnóstico errado meu: 1.9 abria vão, e eu culpei a
     estimativa. O vão vinha do deslocamento assimétrico, que comia uma cópia
     inteira da folga de baixo. Com ele centrado, 2.0 cobre — e foi medido ao
     longo do ciclo inteiro, não num instante. */
  const alturaACobrir = containerHeight * (1.0 + 0.02 * colunasEfetivas);

  /* Cada coluna recebe o ACERVO INTEIRO, em ordem própria.

     O rodízio do original (`items[i % colunas]`) reparte a lista entre as
     colunas, e isso quebra de duas formas assim que há mais colunas que peças —
     que é o caso normal com `columns="auto"` numa tela larga: treze colunas para
     oito cartões deixam cinco colunas com NENHUM item, e o fallback punha o
     mesmo item sozinho na coluna. Uma coluna de um item só é um item empilhado
     contra ele mesmo, para sempre, porque a coluna é repetida em cópias para o
     laço fechar.

     Dando a lista inteira a cada coluna, nada se repete dentro de uma volta e a
     emenda entre cópias cai sempre entre peças diferentes. A variedade vem da
     ORDEM, não da repartição — semente por coluna, então duas vizinhas nunca
     descem na mesma sequência. */
  const columnItems = useMemo(() => {
    const acervo = items.length ? items : DEFAULT_ITEMS;

    /* QUANTAS peças por coluna — e é aqui que mora o peso da parede.

       Dar o acervo inteiro a cada coluna deixava o ciclo com 12 peças (2352px)
       para uma faixa visível de 619px: quatro vezes mais alto que o necessário,
       multiplicado por três cópias e por treze colunas. Quase quinhentas peças
       no DOM, cada uma numa camada 3D, para mostrar umas trinta.

       O ciclo só precisa ser um pouco MAIOR que o que se vê: assim que ele
       passa disso, duas cópias bastam para o laço fechar e o resto é peça
       renderizada fora da tela para sempre. Cada coluna leva um recorte
       diferente do acervo (o embaralhamento vem antes do corte), então cortar
       não empobrece a variedade — só para de repetir o que ninguém vê. */
    /* O ciclo serve à VARIEDADE, não à cobertura.

       Ele saía de `ceil(cobertura / unidade)`, o que amarrava as duas coisas:
       cada peça a mais no ciclo era multiplicada pelas cópias, e a coluna
       chegava a 30 peças para mostrar 3.

       Com o deslocamento centrado, o total por coluna é
       `visível/unidade + porColuna` — a cobertura entra UMA vez, somada, e o
       ciclo entra sozinho. Então ele deve ser o menor que ainda não deixe o olho
       pegar a repetição: cinco peças distintas descendo, em ordem própria por
       coluna, já não lê como padrão. */
    const unidade = tileHeight + gap;
    const porColuna = Math.min(acervo.length, 3);

    const cols = Array.from({ length: colunasEfetivas }, (_, c) =>
      embaralhar(acervo, c * 2654435761 + 0x9e3779b9).slice(0, porColuna));

    /* Retoque final: se duas colunas vizinhas começam pela mesma peça, elas
       entram na tela lado a lado com o mesmo cartão. Uma rotação de um item
       desfaz a coincidência sem desmontar a ordem sorteada. */
    for (let c = 1; c < cols.length; c += 1) {
      if (cols[c].length > 1 && cols[c][0] === cols[c - 1][0]) {
        cols[c] = [...cols[c].slice(1), cols[c][0]];
      }
    }
    return cols;
  }, [items, colunasEfetivas, tileHeight, gap, alturaACobrir]);

  /* Quantas cópias da lista ficam no trilho.

     O original usava `containerHeight * 1.6`, e isso deixava buraco: o plano é
     escalado (1.18) e girado em X e Y, então a faixa visível é bem mais alta que
     a caixa — e o trilho ainda é deslocado em até UMA cópia inteira pelo laço.
     Quando o deslocamento chegava perto do fim da cópia, a ponta do trilho
     entrava na tela e aparecia o vão, preenchido de repente na virada.

     A conta agora é explícita: cobrir a altura visível MAIS uma cópia de folga
     (o alcance do deslocamento), com margem para a perspectiva. Cópia a mais é
     barata — são nós de DOM parados; vão é buraco à vista. */
  /* Quantas cópias da lista ficam no trilho.

     A CONTA QUE EU TINHA ERRADO: o trilho não é ancorado no topo, é CENTRADO —
     o plano usa `top: 50%` com `translate(-50%, -50%)`. Então ele se estende
     metade para cima e metade para baixo do centro da caixa, e o deslocamento
     do laço (que vai de 0 a uma cópia inteira) só puxa para CIMA.

     O efeito disso é assimétrico: em cima sempre sobra folga, e embaixo a
     folga é consumida. Com o trilho centrado, a borda de baixo fica em
     `total/2 - deslocamento`, e ela precisa continuar além de `visível/2` mesmo
     no pior deslocamento:

         total/2 - ciclo  >=  visível/2      →      total >= visível + 2·ciclo

     Eu tinha usado `visível + 1·ciclo`, que é a conta de um trilho ancorado no
     topo. Daí o vão reaparecer sempre no fim do ciclo, e só embaixo — que é
     exatamente o sintoma. */
  /* Cobertura POR COLUNA, e não uma só para todas.

     O plano é girado em Y: as colunas das pontas ficam mais perto ou mais longe
     do olho que as do meio, e a perspectiva as estica na vertical. Com um valor
     único, ou o meio recebia sobra inútil (o caso antigo, que inchava o plano)
     ou as pontas abriam vão — foi o que apareceu em 2560×1080, onde há doze
     colunas e as extremas são as mais deformadas.

     O acréscimo cresce com a distância ao centro. `+1` de cópia, e não `+2`,
     porque o deslocamento centrado já reparte o consumo entre as duas pontas. */
  const columnMeta = useMemo(() => {
    const unit = tileHeight + gap;
    const meio = Math.max(1, (columnItems.length - 1) / 2);
    return columnItems.map((col, c) => {
      const distancia = Math.abs(c - meio) / meio;
      const precisa = alturaACobrir * (1 + 0.5 * distancia);
      const copyHeight = Math.max(unit, col.length * unit);
      const copies = Math.max(2, Math.ceil(alturaACobrir / copyHeight));
      return { copyHeight, copies };
    });
  }, [columnItems, tileHeight, gap, alturaACobrir]);

  useLayoutEffect(() => {
    if (!containerRef.current) return undefined;
    const ro = new ResizeObserver(([entry]) => {
      setContainerHeight(entry.contentRect.height || 600);
      setContainerWidth(entry.contentRect.width || 1200);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const baseVelocities = useMemo(() => {
    const dirSign = direction === "up" ? 1 : -1;
    return columnItems.map((_, c) => {
      const altSign = c % 2 === 0 ? 1 : -1;
      return speed * columnFactor(c, variance) * dirSign * altSign;
    });
  }, [columnItems, speed, direction, variance]);

  useEffect(() => {
    offsetsRef.current = columnMeta.map((meta, c) => meta.copyHeight * ((c * 0.37) % 1));
    velocitiesRef.current = columnItems.map(() => 0);
  }, [columnMeta, columnItems]);

  const applyPlaneTransform = useCallback(
    (px, py) => {
      const plane = planeRef.current;
      if (!plane) return;
      plane.style.transform =
        "translate(-50%, -50%) scale(1.18) " +
        `rotateX(${tilt + py}deg) rotateY(${turn + px}deg) rotateZ(${roll}deg) ` +
        `translateZ(${-depth}px)`;
    },
    [tilt, turn, roll, depth],
  );

  useEffect(() => {
    /* Fora da tela o laço nem começa — mas a posição fica onde estava, então a
       parede não "salta" ao voltar: ela continua de onde parou. */
    if (!naTela) {
      applyPlaneTransform(pointerDampedRef.current.x, pointerDampedRef.current.y);
      return undefined;
    }

    const animate = (ts) => {
      if (lastTsRef.current === null) lastTsRef.current = ts;
      // Teto no delta: uma aba em segundo plano volta com centenas de ms
      // acumulados, e sem o teto a parede daria um salto na volta.
      const dt = Math.min(0.05, Math.max(0, ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;

      const maxTilt = parallax * 8;
      const targetX = pointerRef.current.x * maxTilt;
      const targetY = -pointerRef.current.y * maxTilt;
      const damp = 1 - Math.exp(-dt / 0.12);
      pointerDampedRef.current.x += (targetX - pointerDampedRef.current.x) * damp;
      pointerDampedRef.current.y += (targetY - pointerDampedRef.current.y) * damp;
      applyPlaneTransform(pointerDampedRef.current.x, pointerDampedRef.current.y);

      if (!reduced) {
        for (let c = 0; c < trackRefs.current.length; c += 1) {
          const meta = columnMeta[c];
          if (!meta) continue;
          const paused = wallHoveredRef.current && pauseOnHover;
          const factor = paused || hoveredColRef.current === c ? 0 : 1;
          const target = baseVelocities[c] * factor;

          const ease = 1 - Math.exp(-dt / (target === 0 ? 0.16 : 0.28));
          velocitiesRef.current[c] += (target - velocitiesRef.current[c]) * ease;
          let next = (offsetsRef.current[c] ?? 0) + velocitiesRef.current[c] * dt;
          next = ((next % meta.copyHeight) + meta.copyHeight) % meta.copyHeight;
          offsetsRef.current[c] = next;

          /* O deslocamento é CENTRADO em zero antes de virar transform.

             Ele nasce em [0, ciclo) e só puxa o trilho para cima, então a folga
             de baixo era consumida sozinha enquanto a de cima nunca era usada —
             e o trilho precisava de uma cópia inteira a mais só para cobrir esse
             desequilíbrio. Deslocando meio ciclo, o consumo se reparte entre os
             dois lados e a exigência cai de `visível + 2·ciclo` para
             `visível + 1·ciclo`: uma cópia a menos POR COLUNA, sem nada mudar na
             tela (o trilho é um laço; onde ele começa não se vê). */
          const centrado = next - meta.copyHeight / 2;

          const el = trackRefs.current[c];
          if (el) el.style.transform = `translate3d(0, ${-centrado}px, 0)`;
        }
      } else {
        for (let c = 0; c < trackRefs.current.length; c += 1) {
          const el = trackRefs.current[c];
          const meta = columnMeta[c];
          if (el && meta) {
            const centrado = (offsetsRef.current[c] ?? 0) - meta.copyHeight / 2;
            el.style.transform = `translate3d(0, ${-centrado}px, 0)`;
          }
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      // Zerado para o próximo início não calcular um dt gigante contra o
      // timestamp de antes da pausa.
      lastTsRef.current = null;
    };
  }, [baseVelocities, columnMeta, pauseOnHover, parallax, reduced, naTela, applyPlaneTransform]);

  const activate = useCallback((id, index) => {
    activeIdRef.current = id;
    hoveredColRef.current = index;
    setActiveId(id);
  }, []);

  const release = useCallback(() => {
    activeIdRef.current = null;
    hoveredColRef.current = -1;
    setActiveId(null);
  }, []);

  const handlePointerMove = useCallback(
    (e) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (parallax > 0 && !reduced) {
        pointerRef.current = {
          x: (e.clientX - rect.left) / rect.width - 0.5,
          y: (e.clientY - rect.top) / rect.height - 0.5,
        };
      }
      // Sem clique nem foco não há peça ativa para rastrear — só a paralaxe.
      if (!interactive && !onItemClick) return;
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const tile = hit && hit.closest ? hit.closest("[data-tile-id]") : null;
      if (!tile) return;
      const id = tile.dataset.tileId;
      if (id === activeIdRef.current) return;
      activeIdRef.current = id;
      hoveredColRef.current = Number(tile.dataset.col);
      setActiveId(id);
    },
    [parallax, reduced, interactive],
  );

  /* Clique tolerante.

     Medindo, só metade dos cliques acertava uma peça: com o plano em
     perspectiva, o ponto cai muitas vezes no trilho ou entre colunas sem tocar
     nenhuma — e para quem clica isso é simplesmente "não funcionou".

     Então o acerto exato é só o primeiro caminho. Falhando, procuramos a peça
     de centro mais próximo do ponteiro. É uma varredura por clique (não por
     movimento), sobre elementos que já estão no DOM — barata, e transforma o
     "às vezes abre" em "abre". */
  const handleClick = useCallback(
    (e) => {
      if (!onItemClick) return;

      const direto = document.elementFromPoint(e.clientX, e.clientY)?.closest?.("[data-tile-id]");
      const escolher = (el) => {
        const idx = Number(el?.dataset?.itemIdx);
        if (Number.isInteger(idx) && items[idx]) onItemClick(items[idx]);
      };
      if (direto) { escolher(direto); return; }

      const pecas = containerRef.current?.querySelectorAll("[data-tile-id]");
      if (!pecas?.length) return;

      let melhor = null;
      let menor = Infinity;
      pecas.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        // Fora da caixa visível não conta: a máscara já apagou aquela peça, e
        // abrir o painel de algo que a pessoa não vê seria pior que não abrir.
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const d = dx * dx + dy * dy;
        if (d < menor) { menor = d; melhor = el; }
      });
      if (melhor) escolher(melhor);
    },
    [onItemClick, items],
  );

  const handlePointerLeaveWall = useCallback(() => {
    wallHoveredRef.current = false;
    pointerRef.current = { x: 0, y: 0 };
    release();
  }, [release]);

  const cssVars = useMemo(
    () => ({
      "--dw-tile-w": `${tileWidth}px`,
      "--dw-tile-h": `${tileHeight}px`,
      "--dw-gap": `${gap}px`,
      "--dw-radius": `${radius}px`,
      "--dw-perspective": `${perspective}px`,
      "--dw-lift": `${lift}px`,
      "--dw-dim": dim,
      "--dw-gray": grayscale ? 1 : 0,
      "--dw-overlay": overlayColor,
      "--dw-edge": `${Math.max(0, (1 - fade) * 100)}%`,
      ...style,
    }),
    [tileWidth, tileHeight, gap, radius, perspective, lift, dim, grayscale, overlayColor, fade, style],
  );

  /* Índice do item no acervo, carimbado na peça: é como o clique por
     proximidade descobre QUAL destaque abrir a partir de um elemento do DOM. */
  const indiceDoItem = useCallback((item) => items.indexOf(item), [items]);

  const renderTile = (item, id, colIndex) => {
    const itemIdx = indiceDoItem(item);
    const inner = (
      <span className="drift-wall__inner">
        {item.content ?? (
          <img src={item.image} alt={item.title ?? ""} loading="lazy" decoding="async" draggable={false} />
        )}
        <span className="drift-wall__overlay" aria-hidden="true" />
      </span>
    );

    /* Decorativa: fora da árvore de acessibilidade e fora do Tab.

       Com `onItemClick` ela ainda CLICA. Parece contraditório, mas não é: a
       parede repete a mesma lista várias vezes para o laço fechar, então torná-la
       focável criaria dezenas de paradas de teclado repetindo o mesmo conteúdo.
       O clique é um atalho a mais para quem usa mouse; quem usa teclado ou
       leitor de tela chega pela lista real da seção, que não é repetida. */
    if (!interactive) {
      return (
        <div
          key={id}
          className={`drift-wall__tile${activeId === id ? " is-active" : ""}`}
          data-tile-id={id}
          data-col={colIndex}
          data-item-idx={itemIdx}
          aria-hidden="true"
        >
          {inner}
        </div>
      );
    }

    const commonProps = {
      className: `drift-wall__tile${activeId === id ? " is-active" : ""}`,
      "data-tile-id": id,
      "data-col": colIndex,
      "data-item-idx": itemIdx,
      onFocus: () => activate(id, colIndex),
      onBlur: release,
    };

    if (item.href) {
      return (
        <a key={id} href={item.href} target="_blank" rel="noreferrer noopener" {...commonProps}>
          {inner}
        </a>
      );
    }
    return (
      <div key={id} tabIndex={0} role="button" aria-label={item.title ?? "tile"} {...commonProps}>
        {inner}
      </div>
    );
  };

  const rootClass = [
    "drift-wall",
    reduced ? "drift-wall--reduced" : "",
    interactive ? "" : "drift-wall--decorativa",
    !interactive && onItemClick ? "drift-wall--clicavel" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <div
      ref={containerRef}
      className={rootClass}
      style={cssVars}
      onPointerMove={handlePointerMove}
      onClick={onItemClick ? handleClick : undefined}
      onPointerEnter={() => { wallHoveredRef.current = true; }}
      onPointerLeave={handlePointerLeaveWall}
      {...(interactive ? { role: "group", "aria-label": "Parede de destaques" } : { "aria-hidden": "true" })}
    >
      <div ref={planeRef} className="drift-wall__plane">
        {columnItems.map((col, c) => {
          const meta = columnMeta[c];
          const copies = Array.from({ length: meta.copies });
          return (
            <div className="drift-wall__col" key={`col-${c}`}>
              <div className="drift-wall__track" ref={(el) => { trackRefs.current[c] = el; }}>
                {copies.map((_, copyIndex) =>
                  col.map((item, itemIndex) => renderTile(item, `${c}-${copyIndex}-${itemIndex}`, c)))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DriftWall;
