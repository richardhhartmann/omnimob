import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

/* ────────────────────────────────────────────────────────────────────────────
   MENU FLUIDO — as opções do seletor de módulo.

   Porte do `FlowingMenu` do React Bits: ao passar o ponteiro, uma faixa entra
   pela borda MAIS PRÓXIMA do cursor e corre com o nome do item repetido. É um
   efeito bonito e, aqui, também informativo: a faixa entra tingida com o acento
   do módulo, então o gesto já diz para onde se está indo.

   ── O DESCOMPASSO DE ESCALA, E O QUE FOI FEITO COM ELE ──

   O original foi desenhado para um menu de TELA CHEIA: `font-size: 4vh`
   (~38px), imagens de 200px de largura, e o número de repetições calculado a
   partir de `window.innerWidth`. Aqui ele vive num balão de 228px, com duas
   opções.

   Nada disso cabia, e a adaptação não é cosmética:

   1. As medidas saíram de `vh` para `px`. Num balão de altura fixa, `4vh`
      variava com o tamanho da JANELA — a mesma lista ficava com letras de 30px
      num laptop e 50px num monitor grande, dentro de uma caixa que não muda.

   2. A imagem da faixa é o SÍMBOLO do módulo, em 26px. Os 200px do original
      ocupariam a largura inteira do balão sozinhos.

   3. As repetições são calculadas sobre a largura do BALÃO, e não da janela. O
      original faria `1440 / 120 = 14` cópias para preencher uma faixa de 228px
      — treze delas fora da tela, todas animadas a cada quadro.

   ── OS DESVIOS DE COMPORTAMENTO ──

   4. `<button>` no lugar de `<a href>`. Trocar de módulo é uma ação do
      roteador; um `href` de verdade recarregaria a aplicação, e um `href="#"`
      faria a página saltar para o topo. O papel de `option` e o
      `aria-selected` vêm do seletor, que é um `listbox`.

   5. Respeita `prefers-reduced-motion`: sem a corrida da faixa, e sem a
      entrada por gsap. O realce continua, por CSS.
   ──────────────────────────────────────────────────────────────────────────── */

const ENTRADA = { duration: 0.55, ease: "expo" };

/** Qual borda está mais perto do ponteiro — é por ela que a faixa entra. */
function bordaMaisProxima(x, y, largura, altura) {
  const dist = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;
  return dist(x, y, largura / 2, 0) < dist(x, y, largura / 2, altura) ? "topo" : "base";
}

const semMovimento = () =>
  typeof window !== "undefined"
  && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * @param {object} p
 * @param {Array<{chave, texto, imagem, acento, acentoSuave, atual, tagline}>} p.itens
 * @param {(chave: string) => void} p.aoEscolher
 * @param {number} p.segundos  duração de uma volta da faixa
 */
export function MenuFluido({ itens = [], aoEscolher, segundos = 9 }) {
  return (
    <>
      {itens.map((item) => (
        <ItemFluido key={item.chave} item={item} aoEscolher={aoEscolher} segundos={segundos} />
      ))}
    </>
  );
}

function ItemFluido({ item, aoEscolher, segundos }) {
  const itemRef = useRef(null);
  const faixaRef = useRef(null);
  const trilhoRef = useRef(null);
  const animacaoRef = useRef(null);
  const [copias, setCopias] = useState(3);

  /* Quantas cópias enchem a faixa. Sobre a largura do BALÃO — ver o desvio 3.
     Duas de folga: a corrida desloca exatamente uma largura de conteúdo, e sem
     sobra o fim da última cópia apareceria como um vão no meio do laço. */
  useEffect(() => {
    const contar = () => {
      const trilho = trilhoRef.current;
      const uma = trilho?.querySelector(".mf-parte");
      const caixa = itemRef.current;
      if (!uma || !caixa) return;
      const largura = uma.offsetWidth;
      if (!largura) return;
      setCopias(Math.max(3, Math.ceil(caixa.offsetWidth / largura) + 2));
    };
    contar();
    /* `ResizeObserver` e não o `resize` da janela: o balão tem largura própria e
       não acompanha a janela. O original escutava a janela porque era um menu
       de tela cheia. */
    if (typeof ResizeObserver === "undefined") return undefined;
    const obs = new ResizeObserver(contar);
    if (itemRef.current) obs.observe(itemRef.current);
    return () => obs.disconnect();
  }, [item.texto]);

  // A corrida da faixa. Desloca UMA largura de conteúdo: é o que fecha o laço.
  useEffect(() => {
    if (semMovimento()) return undefined;
    const relogio = setTimeout(() => {
      const trilho = trilhoRef.current;
      const uma = trilho?.querySelector(".mf-parte");
      if (!trilho || !uma?.offsetWidth) return;
      animacaoRef.current?.kill();
      animacaoRef.current = gsap.to(trilho, {
        x: -uma.offsetWidth,
        duration: segundos,
        ease: "none",
        repeat: -1,
      });
    }, 50);
    return () => {
      clearTimeout(relogio);
      animacaoRef.current?.kill();
      animacaoRef.current = null;
    };
  }, [item.texto, copias, segundos]);

  function mover(e, entrando) {
    if (semMovimento() || !itemRef.current || !faixaRef.current || !trilhoRef.current) return;
    const r = itemRef.current.getBoundingClientRect();
    const borda = bordaMaisProxima(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
    const fora = borda === "topo" ? "-101%" : "101%";
    const dentro = borda === "topo" ? "101%" : "-101%";

    const linha = gsap.timeline({ defaults: ENTRADA });
    if (entrando) {
      linha
        .set(faixaRef.current, { y: fora }, 0)
        .set(trilhoRef.current, { y: dentro }, 0)
        .to([faixaRef.current, trilhoRef.current], { y: "0%" }, 0);
    } else {
      linha
        .to(faixaRef.current, { y: fora }, 0)
        .to(trilhoRef.current, { y: dentro }, 0);
    }
  }

  return (
    <button
      type="button"
      role="option"
      aria-selected={item.atual}
      ref={itemRef}
      className={`mf-item${item.atual ? " is-atual" : ""}`}
      style={{ "--acento": item.acento, "--acento-suave": item.acentoSuave }}
      onMouseEnter={(e) => mover(e, true)}
      onMouseLeave={(e) => mover(e, false)}
      onClick={() => { if (!item.atual) aoEscolher?.(item.chave); }}
    >
      <span className="mf-face">{item.conteudo}</span>

      {/* A faixa. `aria-hidden` porque ela repete o nome que o botão já diz —
          um leitor de tela anunciaria "Flow Flow Flow Flow". */}
      <span className="mf-faixa" ref={faixaRef} aria-hidden="true">
        <span className="mf-trilho" ref={trilhoRef}>
          {Array.from({ length: copias }, (_, i) => (
            <span className="mf-parte" key={i}>
              <span className="mf-texto">{item.texto}</span>
              {item.imagem ? <img className="mf-img" src={item.imagem} alt="" /> : null}
            </span>
          ))}
        </span>
      </span>
    </button>
  );
}
