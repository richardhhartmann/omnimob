import { motion, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";
import "./Counter.css";

/* ────────────────────────────────────────────────────────────────────────────
   Counter — números que rolam como um marcador mecânico.

   Do React Bits. Cada casa decimal é uma coluna com os dez algarismos
   empilhados; o que anima é o deslocamento vertical da coluna, e não o texto.
   Daí a rolagem parecer física em vez de um número trocando de valor.

   Um desvio do original: RESPEITA "reduzir movimento". Com a preferência
   ligada, a mola vira um salto — o número aparece certo, sem giro. O original
   rola sempre.
   ──────────────────────────────────────────────────────────────────────────── */

const reduzido = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Number({ mv, number, height }) {
  /* O deslocamento é circular: em vez de percorrer 7→0 passando por todos, a
     coluna escolhe o caminho curto (uma volta para trás), o que é o que faz o
     marcador parecer um cilindro e não uma lista rolando. */
  const y = useTransform(mv, (latest) => {
    const placeValue = latest % 10;
    const offset = (10 + number - placeValue) % 10;
    let memo = offset * height;
    if (offset > 5) memo -= 10 * height;
    return memo;
  });
  return (
    <motion.span className="counter-number" style={{ y }}>
      {number}
    </motion.span>
  );
}

function normalizeNearInteger(num) {
  const nearest = Math.round(num);
  const tolerance = 1e-9 * Math.max(1, Math.abs(num));
  return Math.abs(num - nearest) < tolerance ? nearest : num;
}

function getValueRoundedToPlace(value, place) {
  return Math.floor(normalizeNearInteger(value / place));
}

function Digit({ place, value, height, digitStyle }) {
  const isDecimal = place === ".";
  const valueRoundedToPlace = isDecimal ? 0 : getValueRoundedToPlace(value, place);
  const animatedValue = useSpring(valueRoundedToPlace, reduzido() ? { duration: 0 } : undefined);

  useEffect(() => {
    if (!isDecimal) animatedValue.set(valueRoundedToPlace);
  }, [animatedValue, valueRoundedToPlace, isDecimal]);

  if (isDecimal) {
    return (
      <span className="counter-digit" style={{ height, ...digitStyle, width: "fit-content" }}>
        .
      </span>
    );
  }

  return (
    <span className="counter-digit" style={{ height, ...digitStyle }}>
      {Array.from({ length: 10 }, (_, i) => (
        <Number key={i} mv={animatedValue} number={i} height={height} />
      ))}
    </span>
  );
}

export default function Counter({
  value,
  fontSize = 100,
  padding = 0,
  places,
  gap = 8,
  borderRadius = 4,
  horizontalPadding = 8,
  textColor = "inherit",
  fontWeight = "inherit",
  containerStyle,
  counterStyle,
  digitStyle,
  gradientHeight = 16,
  gradientFrom = "black",
  gradientTo = "transparent",
  topGradientStyle,
  bottomGradientStyle,
}) {
  /* As casas saem do VALOR quando não são informadas.

     No original isso era um default de parâmetro que lia `value.toString()` —
     e um default é avaliado a cada render, então o número de colunas mudava
     junto com o valor. Contando 1 → 1.200, o marcador ganhava casas no meio da
     animação e a largura pulava. Aqui elas são fixadas por quem usa (ver a
     landing, que passa as casas do valor FINAL). */
  const casas = places?.length
    ? places
    : [...String(Math.trunc(Math.abs(value) || 0))].map((_, i, a) => 10 ** (a.length - i - 1));

  const height = fontSize + padding;

  const defaultCounterStyle = {
    fontSize,
    gap,
    borderRadius,
    paddingLeft: horizontalPadding,
    paddingRight: horizontalPadding,
    color: textColor,
    fontWeight,
    direction: "ltr",
  };
  const defaultTopGradientStyle = {
    height: gradientHeight,
    background: `linear-gradient(to bottom, ${gradientFrom}, ${gradientTo})`,
  };
  const defaultBottomGradientStyle = {
    height: gradientHeight,
    background: `linear-gradient(to top, ${gradientFrom}, ${gradientTo})`,
  };

  return (
    <span className="counter-container" style={containerStyle}>
      <span className="counter-counter" style={{ ...defaultCounterStyle, ...counterStyle }}>
        {casas.map((place, i) => (
          <Digit key={`${place}-${i}`} place={place} value={value} height={height} digitStyle={digitStyle} />
        ))}
      </span>
      <span className="gradient-container" aria-hidden="true">
        <span className="top-gradient" style={topGradientStyle || defaultTopGradientStyle} />
        <span className="bottom-gradient" style={bottomGradientStyle || defaultBottomGradientStyle} />
      </span>
    </span>
  );
}
