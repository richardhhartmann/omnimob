import { useEffect, useMemo, useRef } from "react";
import { gsap } from "gsap";
import "./BounceCards.css";

/* ────────────────────────────────────────────────────────────────────────────
   BounceCards — baralho aberto em leque, com entrada elástica.

   Do React Bits. Três desvios do original:

   1. PEÇA COM CONTEÚDO, não só imagem. O original monta `<img src={...}>`. Aqui
      as peças são os canais aos quais a Omnimob se conecta — ícone de marca,
      nome e categoria —, então cada item traz `content` (JSX). `images`
      continua funcionando para quem passar URLs.

   2. LEQUE CALCULADO. O original recebe `transformStyles`, um array paralelo
      com uma transformação por cartão — e ele vem com CINCO. Adicionar um sexto
      canal sem lembrar de editar esse array empilharia o novo cartão em cima do
      último, sem erro nenhum. Aqui o leque é derivado da QUANTIDADE: o passo
      lateral e a inclinação saem do número de peças e da largura disponível.
      Passar `transformStyles` continua possível e vence o cálculo.

   3. RESPEITA "reduzir movimento". Sem a entrada elástica e sem o empurrão dos
      vizinhos — as peças aparecem já posicionadas.
   ──────────────────────────────────────────────────────────────────────────── */

/* Leque a partir da contagem.

   O passo é a largura útil dividida pelos intervalos, com teto: passados uns
   130px os cartões deixam de se sobrepor e o leque vira uma fileira, que é
   outro desenho. A inclinação vai de uma ponta à outra passando por zero no
   meio, e é o que faz o conjunto ler como baralho aberto na mão. */
function leque(quantidade, larguraUtil, inclinacaoMax) {
  if (quantidade <= 0) return [];
  if (quantidade === 1) return ["rotate(0deg)"];

  const intervalos = quantidade - 1;
  const passo = Math.min(larguraUtil / intervalos, 130);
  const meio = intervalos / 2;

  return Array.from({ length: quantidade }, (_, i) => {
    const desloc = (i - meio) * passo;
    const giro = ((i - meio) / meio) * inclinacaoMax;
    return `rotate(${giro.toFixed(1)}deg) translate(${desloc.toFixed(0)}px)`;
  });
}

export default function BounceCards({
  className = "",
  images = [],
  items = null,
  containerWidth = 400,
  containerHeight = 400,
  animationDelay = 0.5,
  animationStagger = 0.06,
  easeType = "elastic.out(1, 0.8)",
  transformStyles = null,
  inclinacao = 9,
  enableHover = true,
}) {
  const containerRef = useRef(null);

  const pecas = useMemo(
    () => (items?.length ? items : images.map((src, i) => ({ image: src, key: i }))),
    [items, images],
  );

  /* Sobra para o leque respirar dentro do contêiner. Sem ela as pontas do
     baralho encostam na borda e o giro corta o canto do primeiro e do último. */
  const posicoes = useMemo(
    () => transformStyles ?? leque(pecas.length, containerWidth - 220, inclinacao),
    [transformStyles, pecas.length, containerWidth, inclinacao],
  );

  const reduzido =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (reduzido) return undefined;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".bc-card",
        { scale: 0 },
        { scale: 1, stagger: animationStagger, ease: easeType, delay: animationDelay },
      );
    }, containerRef);
    return () => ctx.revert();
  }, [animationStagger, easeType, animationDelay, reduzido, pecas.length]);

  const semGiro = (t) => {
    if (/rotate\([\s\S]*?\)/.test(t)) return t.replace(/rotate\([\s\S]*?\)/, "rotate(0deg)");
    return t === "none" ? "rotate(0deg)" : `${t} rotate(0deg)`;
  };

  const empurrado = (base, dx) => {
    const re = /translate\(([-0-9.]+)px\)/;
    const m = base.match(re);
    if (m) return base.replace(re, `translate(${parseFloat(m[1]) + dx}px)`);
    return base === "none" ? `translate(${dx}px)` : `${base} translate(${dx}px)`;
  };

  /* O empurrão sai do passo do leque, não de um 160 fixo como no original: com
     oito peças num passo de 90px, empurrar 160 jogaria o vizinho para além do
     seguinte e o baralho se desmontaria em vez de abrir espaço. */
  const empurrao = useMemo(() => {
    const m = String(posicoes[1] ?? "").match(/translate\(([-0-9.]+)px\)/);
    const p0 = String(posicoes[0] ?? "").match(/translate\(([-0-9.]+)px\)/);
    const passo = m && p0 ? Math.abs(parseFloat(m[1]) - parseFloat(p0[1])) : 90;
    return Math.max(40, passo * 0.9);
  }, [posicoes]);

  const afastarVizinhos = (idx) => {
    if (!enableHover || reduzido || !containerRef.current) return;
    const q = gsap.utils.selector(containerRef);

    pecas.forEach((_, i) => {
      const alvo = q(`.bc-card-${i}`);
      gsap.killTweensOf(alvo);
      const base = posicoes[i] || "none";

      if (i === idx) {
        gsap.to(alvo, { transform: semGiro(base), duration: 0.4, ease: "back.out(1.4)", overwrite: "auto" });
      } else {
        const dx = i < idx ? -empurrao : empurrao;
        gsap.to(alvo, {
          transform: empurrado(base, dx),
          duration: 0.4,
          ease: "back.out(1.4)",
          delay: Math.abs(idx - i) * 0.05,
          overwrite: "auto",
        });
      }
    });
  };

  const recompor = () => {
    if (!enableHover || reduzido || !containerRef.current) return;
    const q = gsap.utils.selector(containerRef);
    pecas.forEach((_, i) => {
      const alvo = q(`.bc-card-${i}`);
      gsap.killTweensOf(alvo);
      gsap.to(alvo, { transform: posicoes[i] || "none", duration: 0.4, ease: "back.out(1.4)", overwrite: "auto" });
    });
  };

  return (
    <div
      className={`bc-container ${className}`}
      ref={containerRef}
      style={{ width: containerWidth, height: containerHeight }}
      onMouseLeave={recompor}
    >
      {pecas.map((peca, idx) => (
        <div
          key={peca.key ?? idx}
          className={`bc-card bc-card-${idx}`}
          style={{ transform: posicoes[idx] ?? "none", zIndex: idx }}
          onMouseEnter={() => afastarVizinhos(idx)}
        >
          {peca.content ?? <img className="bc-image" src={peca.image} alt={peca.alt ?? ""} />}
        </div>
      ))}
    </div>
  );
}
