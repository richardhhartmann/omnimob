import { useCallback, useEffect, useRef, useState } from "react";
import { ajustarAlturasMedidas } from "./engine/layoutEngine.js";
import { useAlturasReais } from "./useAlturasReais.js";

/* ────────────────────────────────────────────────────────────────────────────
   Layout resolvido para quem só EXIBE a vitrine.

   O editor faz isto e grava o resultado no documento — as alturas medidas viram
   parte do layout salvo. A página pública precisa do mesmo cálculo, mas não
   pode gravar nada: ela recebe o config do banco, mede o que o navegador
   realmente desenhou e guarda o resultado só para renderizar.

   O que estava aqui antes era uma SEGUNDA engine: a `ShowcasePage` tinha o seu
   próprio `useLayoutEffect` com `document.querySelector`, um deslocamento
   especial só para o bloco de imóveis (`propsShift`) e um empilhamento em
   coluna única no celular (`mobileStack`) que ignorava as posições salvas. Três
   regras que o editor não conhecia — e por isso mesmo três fontes de
   divergência entre o que se montava e o que se publicava.

   Agora as duas telas chamam `ajustarAlturasMedidas`, a mesma função pura: ela
   faz a caixa guardada crescer até a altura real e roda a cascata. O que muda é
   só o destino do resultado.
   ──────────────────────────────────────────────────────────────────────────── */

export function useLayoutResolvido({ config, mode }) {
  const [layout, setLayout] = useState(config);
  const layoutRef = useRef(config);

  /* Config novo (outra imobiliária, outro payload) ou troca de modo zeram a
     resolução. Sem isto as alturas medidas numa largura seriam aplicadas sobre
     as posições da outra, e o acúmulo apareceria como vãos crescentes. */
  useEffect(() => {
    layoutRef.current = config;
    setLayout(config);
  }, [config, mode]);

  const aoMedir = useCallback((alturas) => {
    const proximo = ajustarAlturasMedidas(layoutRef.current, mode, alturas);
    if (!proximo) return;
    layoutRef.current = proximo;
    setLayout(proximo);
  }, [mode]);

  const { registrarPeca } = useAlturasReais({ aoMedir });

  return { layout, registrarPeca };
}
