import { useEffect, useRef, useState } from "react";

/* ────────────────────────────────────────────────────────────────────────────
   Splash de abertura da landing.

   Roteiro (≈2,8 s):
     1. o símbolo dourado aparece sozinho, grande e centralizado;
     2. o contorno do D é desenhado dentro do vão que a marca deixa vago;
     3. o D voa para a direita enquanto o símbolo desliza para a esquerda, e ao
        mesmo tempo a marca troca para a versão sem o vão — o buraco se fecha
        atrás do D que acabou de sair;
     4. O, M, U e S saem de trás do D, em cascata;
     5. o lockup inteiro viaja até o logo do cabeçalho e esmaece em cima dele.

   A troca do símbolo é sobreposição, não travessia: a arte original fica opaca
   embaixo e a alternativa aparece por cima. Se as duas cruzassem em opacidade
   parcial, o fundo escuro vazaria pelas duas no meio do caminho.

   Por que SVG e não GIF/WebP animado: o traço do D só existe de verdade com
   `stroke-dashoffset` sobre um caminho vetorial, e a marca precisa ficar nítida
   em qualquer densidade de tela. O arquivo todo pesa menos que um frame do GIF.

   As letras são caminhos monoline extraídos do próprio `tipo_header.png` — o
   eixo médio de cada letra, com traço de 31 unidades, que é a espessura medida
   no arquivo original. Coordenadas no espaço do PNG (2485 × 603), então o
   símbolo (que continua sendo bitmap, por causa dos degradês) e as letras se
   encaixam sem ajuste.
   ──────────────────────────────────────────────────────────────────────────── */

// ── Geometria ───────────────────────────────────────────────────────────────

const SIMBOLO_SRC = "/marca-simbolo.webp";
const SIMBOLO_ALT_SRC = "/logo_alt.webp";

// Traço do D: sobe a haste, contorna o ombro e fecha na base. Um caminho só,
// para o desenho sair contínuo, como se fosse escrito à mão.
const D_PATH =
  "M819 402V214.5H880C940 214.5 978.5 250 978.5 300.5C978.5 351 940 386.5 880 386.5H819";

// O vão da marca (x 160→357, y 318→558) contra o centro geométrico do D
// (898,75; 300,5). É daí que saem o deslocamento e a escala iniciais.
const D_NO_VAO = { x: -640.25, y: 137.5, escala: 0.72 };

const LETRAS = [
  { id: "o", d: "M1317 300.5A92 87.5 0 1 1 1133 300.5A92 87.5 0 1 1 1317 300.5Z", de: -343 },
  // As diagonais sobem além da linha de topo e são cortadas em y=199: paradas
  // no 199 elas terminariam em bisel, deixando um degrau visível no encontro
  // com as hastes. Emendar tudo num caminho só não serve — a virada é aguda
  // demais e o miter viraria uma farpa acima da letra.
  {
    id: "m",
    d: "M1482.5 199V402M1670 199V402M1466.4 173.7L1576 346L1686.2 173.7",
    recorte: "ds-topo-m",
    de: -695,
  },
  { id: "u", d: "M1846.5 198V318.75A70.25 70.25 0 0 0 1987 318.75V198", de: -1013 },
  {
    id: "s",
    d:
      "M2137.9 372.7C2146.1 375.1 2175.3 384.4 2187 387.2C2198.7 390 2200.7 390.1 2208 389.6" +
      "C2215.3 389 2224.1 386.8 2230.8 384C2237.4 381.2 2244 376.3 2247.9 372.7" +
      "C2251.7 369.1 2252.4 366.3 2253.9 362.4C2255.3 358.6 2256.4 354 2256.6 349.7" +
      "C2256.7 345.3 2255.9 340.3 2254.7 336.2C2253.5 332.1 2252.3 328.8 2249.3 325.1" +
      "C2246.4 321.4 2250.2 321.8 2237 314.2C2223.8 306.7 2182.9 287.9 2170.1 279.9" +
      "C2157.3 271.8 2162.1 271 2160 265.9C2157.9 260.8 2157.3 254.1 2157.4 249.1" +
      "C2157.6 244.1 2159.3 239.7 2161 235.9C2162.7 232 2165 228.8 2167.7 226" +
      "C2170.4 223.2 2173.1 221.2 2177.1 219.1C2181.1 217.1 2183.3 214.7 2191.4 213.7" +
      "C2199.6 212.6 2213.8 211.2 2226 212.7C2238.2 214.1 2258 220.7 2264.4 222.3",
    de: -1286,
  },
];

/* ── Versão empilhada (telas pequenas) ───────────────────────────────────────
   No celular não cabe o lockup deitado: a 92vw o símbolo fica do tamanho de uma
   unha e a palavra encosta nas duas bordas. Abaixo deste ponto a marca se monta
   em coluna — símbolo em cima, DOMUS embaixo, tudo centralizado — e o conjunto
   pode crescer, porque agora quem manda na largura é só a palavra.

   As medidas estão no espaço do viewBox (2485 × 603), o mesmo dos caminhos das
   letras, e valem para o grupo inteiro da palavra (D + O + M + U + S):

     a palavra ocupa x 803,5 → 2280   (centro 1541,75) e y 183,5 → 417,5
     o símbolo ocupa x 0 → 500        (centro 250)

   Levar a palavra para debaixo do símbolo é, então, alinhar os dois centros em
   x e empurrar a palavra para baixo do rodapé do símbolo (603) com um respiro. */
const EMPILHADO = "(max-width: 640px)";
const RESPIRO_COLUNA = 175;                    // vão entre o pé do símbolo e o topo da palavra
const PALAVRA_DX = 250 - 1541.75;              // centro da palavra sob o centro do símbolo
const PALAVRA_DY = 603 + RESPIRO_COLUNA + 117 - 300.5; // topo da palavra logo abaixo do símbolo
const ALTURA_COLUNA = 603 + RESPIRO_COLUNA + 234;      // símbolo + vão + palavra

/* Empilhada, a marca ocupa metade da largura que ocupava deitada — e ficaria
   pequena demais. A ampliação acontece DENTRO do SVG (que tem overflow
   visível), não na caixa do palco: caixa maior que a tela vira item de grid
   que estoura só para um lado, porque alinhamento não produz deslocamento
   negativo. Assim a caixa continua cabendo e só o desenho cresce.

   O ponto fixo da ampliação é o centro do símbolo (x 250 · y 301,5 = 10,06% ·
   50% da caixa), que é justamente onde o palco já centraliza a marca. */
const ESCALA_COLUNA = 1.44;
const ORIGEM_COLUNA = `${((250 / 2485) * 100).toFixed(2)}% 50%`;

/* Com a palavra embaixo, o conjunto passa a ser bem mais alto que a caixa de
   603 — e a ampliação estica isso mais ainda. O palco sobe a diferença entre o
   centro do conjunto e o centro da caixa, e o todo volta ao meio da tela. */
const PALCO_SUBIDA = `${(-(ALTURA_COLUNA / 603 / 2 - 0.5) * ESCALA_COLUNA * 100).toFixed(2)}%`;

// Fim da animação (ver CSS). O overlay só sai depois disso E depois da página
// estar pronta, para o traço nunca ser cortado no meio.
const DURACAO_MS = 2860;
const SAIDA_MS = 720;
const CHAVE_SESSAO = "domus:splash-visto";

// Logo do cabeçalho da landing: é para lá que o lockup voa na saída.
const ALVO = ".dl-header__tipo";

/* O alvo usa o mesmo `tipo_header.png` que deu origem a este SVG, então tem a
   mesma proporção do viewBox — mapear um no outro é só escala uniforme mais
   translação, sem deformar nada. Com transform-origin em 0 0, basta alinhar os
   cantos superiores esquerdos. Devolve null quando não há alvo (aí a saída é
   só o esmaecimento). */
function calcularVoo(palco) {
  const alvo = document.querySelector(ALVO);
  if (!palco || !alvo) return null;
  /* Empilhado, a marca não preenche mais a caixa do palco: o símbolo fica no
     meio dela e a palavra desce para fora, embaixo. Mapear caixa → logo do
     cabeçalho, que é o que este cálculo faz, mandaria o conjunto para um lugar
     que não corresponde ao que se vê. No celular a marca termina onde ela está,
     centralizada, e só esmaece — que é justamente o fecho que a versão em
     coluna pede. */
  if (window.matchMedia(EMPILHADO).matches) return null;
  const a = alvo.getBoundingClientRect();
  const p = palco.getBoundingClientRect();
  if (!a.width || !p.width) return null;
  return { dx: a.left - p.left, dy: a.top - p.top, escala: a.width / p.width };
}

// ── Componente ──────────────────────────────────────────────────────────────

export function DomusSplash() {
  // Já rodou nesta aba? Então nem monta — voltar do painel para a landing não
  // deve prender o usuário em 3 s de animação de novo.
  const [ativo, setAtivo] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return !sessionStorage.getItem(CHAVE_SESSAO);
    } catch {
      return true; // sessionStorage bloqueado (modo privado): mostra mesmo assim
    }
  });
  const [saindo, setSaindo] = useState(false);
  const [voo, setVoo] = useState(null);
  const palcoRef = useRef(null);

  useEffect(() => {
    if (!ativo) return undefined;

    const semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const espera = semMovimento ? 500 : DURACAO_MS;

    // Trava a rolagem enquanto o splash está na frente. A classe some com o
    // cabeçalho: ele só aparece quando o lockup pousa em cima dele.
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("ds-com-splash");

    // Roteiro cronometrado x página pronta: sai quando os dois acontecerem.
    const relogio = new Promise((ok) => setTimeout(ok, espera));
    const pagina =
      document.readyState === "complete"
        ? Promise.resolve()
        : new Promise((ok) => window.addEventListener("load", ok, { once: true }));

    let timerSaida;
    let cancelado = false;
    Promise.all([relogio, pagina]).then(() => {
      if (cancelado) return;
      // Medido só agora: o cabeçalho já está montado atrás do overlay, e a
      // rolagem continua travada, então o alvo não sai do lugar durante o voo.
      setVoo(calcularVoo(palcoRef.current));
      document.body.classList.add("ds-com-splash-saindo");
      setSaindo(true);
      timerSaida = setTimeout(() => {
        if (cancelado) return;
        setAtivo(false);
        try {
          sessionStorage.setItem(CHAVE_SESSAO, "1");
        } catch {
          /* sem sessionStorage o splash reaparece — aceitável */
        }
      }, SAIDA_MS);
    });

    return () => {
      cancelado = true;
      clearTimeout(timerSaida);
      document.body.style.overflow = overflowAnterior;
      document.body.classList.remove("ds-com-splash", "ds-com-splash-saindo");
    };
  }, [ativo]);

  if (!ativo) return null;

  return (
    <div className={`ds-overlay${saindo ? " is-saindo" : ""}`} role="status" aria-label="Carregando">
      <style>{CSS}</style>

      <div
        className="ds-voar"
        ref={palcoRef}
        style={voo ? { transform: `translate(${voo.dx}px, ${voo.dy}px) scale(${voo.escala})` } : undefined}
      >
        <div className="ds-stage" aria-hidden="true">
          <svg viewBox="0 0 2485 603" className="ds-svg">
            <defs>
              {/* Recorta as letras na borda direita do D: elas nascem atrás dele. */}
              <clipPath id="ds-atras-do-d">
                <rect x="994" y="-300" width="1700" height="1200" />
              </clipPath>
              {/* Linha de topo e base do M (o recorte acompanha a letra, porque
                  anda junto com o transform dela). */}
              <clipPath id="ds-topo-m">
                <rect x="1440" y="199" width="280" height="203.2" />
              </clipPath>
            </defs>

            <image className="ds-simbolo" href={SIMBOLO_SRC} x="0" y="0" width="500" height="603" />
            <image className="ds-simbolo-alt" href={SIMBOLO_ALT_SRC} x="0" y="0" width="500" height="603" />

            {/* A palavra inteira num grupo só. No desktop ele não faz nada (a
                marca já nasce deitada); no celular é ele que leva D, O, M, U e S
                para baixo do símbolo, sem que nenhuma peça precise saber disso —
                inclusive o recorte "atrás do D", que continua valendo no espaço
                interno do grupo e viaja junto. */}
            <g className="ds-palavra">
              <g className="ds-letras" clipPath="url(#ds-atras-do-d)">
                {LETRAS.map((l, i) => (
                  <path
                    key={l.id}
                    className={`ds-letra ds-letra--${l.id}`}
                    d={l.d}
                    clipPath={l.recorte ? `url(#${l.recorte})` : undefined}
                    style={{ "--de": `${l.de}px`, "--atraso": `${i * 120}ms` }}
                  />
                ))}
              </g>

              {/* O D fica por cima de tudo: é ele que esconde as letras na
                  largada. A ponta luminosa vai no mesmo grupo para herdar o voo
                  — solta, ela correria pelo caminho na posição do lockup, longe
                  do símbolo. */}
              <g className="ds-grupo-d">
                <path className="ds-d" d={D_PATH} pathLength="1" />
                <circle className="ds-ponta" r="13" />
              </g>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

// ── CSS ─────────────────────────────────────────────────────────────────────
/* Marcos: 0,45 s símbolo · 0,38→1,43 s traço · 1,43→2,10 s voo ·
   1,43→1,92 s troca do símbolo · 1,92 s→ letras. O traço termina em 1,43 s, que
   é onde o voo e a troca começam — mexer num pede conferir os outros, e o total
   pede mexer em DURACAO_MS. */

const CSS = `
.ds-overlay {
  position: fixed; inset: 0; z-index: 2000; /* acima do cabeçalho fixo (1000) */
  display: grid; place-items: center;
  overflow: hidden;
  background-color: #0a0a0b;
  transition: background-color 460ms ease;
}
/* Na saída some o FUNDO, não o conteúdo: o lockup precisa continuar visível
   enquanto viaja até o cabeçalho. */
.ds-overlay.is-saindo { background-color: transparent; pointer-events: none; }
.ds-overlay.is-saindo::before { animation: ds-apagar 380ms ease both; }

/* Brilho quente atrás da marca, só para o fundo não ser um preto chapado. */
.ds-overlay::before {
  content: ""; position: absolute; width: 900px; height: 900px; max-width: 150vw;
  background: radial-gradient(closest-side, rgba(212,175,55,0.13), transparent 70%);
  animation: ds-brilho 2.2s ease-out both;
}

/* Cabeçalho: sumido durante todo o roteiro, aparece só quando o lockup pousa.
   Fica em opacity (não em display) de propósito — o alvo do voo é medido pelo
   getBoundingClientRect do logo dele, e sem layout não haveria o que medir.
   A revelação usa o mesmo tempo do esmaecimento do lockup, então um troca pelo
   outro no mesmo lugar. A regra de saída vem depois para vencer no empate. */
body.ds-com-splash .dl-header { opacity: 0; pointer-events: none; }
body.ds-com-splash-saindo .dl-header {
  opacity: 1;
  transition: opacity 200ms ease ${SAIDA_MS - 240}ms;
}

/* Transposição para o cabeçalho. O transform vem do JS (medido na hora da
   saída); com a origem em 0 0 ele é só "alinhe o canto e encolha até caber".
   No último trecho o lockup esmaece por cima do logo real do cabeçalho, que já
   está ali embaixo — um encobre o outro, então a troca não aparece. */
.ds-voar {
  transform-origin: 0 0;
  transition: transform ${SAIDA_MS - 80}ms cubic-bezier(0.6, 0, 0.2, 1);
  will-change: transform;
}
.ds-overlay.is-saindo .ds-voar {
  opacity: 0;
  transition:
    transform ${SAIDA_MS - 80}ms cubic-bezier(0.6, 0, 0.2, 1),
    opacity 200ms ease ${SAIDA_MS - 240}ms;
}

/* O símbolo não muda de tamanho: o palco só desliza para a esquerda, e a origem
   em cima do símbolo (10,06% = x 250 de 2485) mantém ele como eixo do movimento.
   Como a escala é a mesma do começo ao fim, é a largura do palco que define o
   tamanho do símbolo na abertura — daí ela ser bem maior que a do lockup usual.
   A variável --ds-zoom fica como regulagem: acima de 1 o símbolo entra
   ampliado e encolhe até o lockup, como era antes. */
.ds-stage {
  --ds-zoom: 1;
  position: relative; width: min(1040px, 92vw);
  transform-origin: 10.06% 50%;
  animation: ds-palco 0.67s cubic-bezier(0.16, 1, 0.3, 1) 1.43s both;
}
.ds-svg { display: block; width: 100%; height: auto; overflow: visible; }

.ds-simbolo { animation: ds-simbolo 0.45s ease-out both; }

.ds-simbolo-alt {
  opacity: 0;
  animation: ds-simbolo-alt-fade 0.49s ease-out 1.43s both;
}

@keyframes ds-simbolo-alt-fade {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* O voo fica no grupo (traço + ponta). Como o viewBox começa em 0 0, a origem
   em unidades de usuário é o próprio centro geométrico do D. */
.ds-grupo-d {
  transform-origin: 898.75px 300.5px;
  animation: ds-voo 0.67s cubic-bezier(0.16, 1, 0.3, 1) 1.43s both;
}

.ds-d {
  fill: none; stroke: #d4af37; stroke-width: 31;
  stroke-linecap: butt; stroke-linejoin: miter;
  stroke-dasharray: 1;
  animation:
    ds-traco 1.05s cubic-bezier(0.65, 0, 0.35, 1) 0.38s both,
    ds-cor 0.67s cubic-bezier(0.16, 1, 0.3, 1) 1.43s both;
}

/* Ponta luminosa que corre junto com o traço. Puramente decorativa: se o
   navegador ignorar offset-path, some sem deixar buraco no roteiro. */
.ds-ponta {
  fill: #ffe9a8; opacity: 0;
  filter: drop-shadow(0 0 16px rgba(255,214,110,0.95));
  offset-path: path("${D_PATH}");
  offset-rotate: 0deg;
  /* offset-anchor herda de transform-origin: sem isto a ponta corre deslocada */
  transform-box: fill-box; transform-origin: center;
  animation: ds-ponta 1.05s cubic-bezier(0.65, 0, 0.35, 1) 0.38s both;
}

.ds-letra {
  fill: none; stroke: #ffffff; stroke-width: 31;
  stroke-linecap: butt; stroke-linejoin: miter;
  animation: ds-letra 0.55s cubic-bezier(0.16, 1, 0.3, 1) calc(1.92s + var(--atraso)) both;
}

@keyframes ds-brilho {
  from { opacity: 0; transform: scale(0.7); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes ds-apagar {
  to { opacity: 0; }
}
@keyframes ds-simbolo {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes ds-palco {
  from { transform: translateX(39.94%) scale(var(--ds-zoom)); }
  to   { transform: translateX(0) scale(1); }
}
@keyframes ds-traco {
  from { stroke-dashoffset: 1; }
  to   { stroke-dashoffset: 0; }
}
@keyframes ds-voo {
  from { transform: translate(${D_NO_VAO.x}px, ${D_NO_VAO.y}px) scale(${D_NO_VAO.escala}); }
  to   { transform: translate(0, 0) scale(1); }
}
/* O D nasce dourado dentro do vão e chega branco no lockup, junto das letras. */
@keyframes ds-cor {
  from {
    stroke: #d4af37;
    filter: drop-shadow(0 0 10px rgba(212,175,55,0.55));
  }
  60% { stroke: #f0dda0; }
  to {
    stroke: #ffffff;
    filter: drop-shadow(0 0 0 rgba(212,175,55,0));
  }
}
@keyframes ds-ponta {
  0%   { opacity: 0; offset-distance: 0%; }
  8%   { opacity: 1; }
  85%  { opacity: 1; }
  100% { opacity: 0; offset-distance: 100%; }
}
@keyframes ds-letra {
  from { opacity: 0; transform: translateX(var(--de)); }
  to   { opacity: 1; transform: translateX(0); }
}

/* ── Celular: a marca se monta em coluna ────────────────────────────────────
   Duas mudanças, e as duas no mesmo instante em que o D sai do vão (1,43 s),
   para o roteiro continuar sendo um movimento só:

     · a palavra desce para debaixo do símbolo em vez de o palco deslizar para
       a esquerda — o D já sai do vão rumo ao lugar novo, e O, M, U e S saem de
       trás dele exatamente como antes;
     · o palco sobe o que a coluna cresceu para baixo, e o conjunto termina
       centralizado na tela.

   O desenho ainda cresce junto: deitada, a marca tinha de caber símbolo +
   palavra lado a lado na mesma largura; em coluna, quem mede é só a palavra, e
   sem a ampliação a marca terminaria ocupando metade da tela. */
@media ${EMPILHADO} {
  .ds-svg { transform: scale(${ESCALA_COLUNA}); transform-origin: ${ORIGEM_COLUNA}; }
  .ds-stage { animation-name: ds-palco-coluna; }
  .ds-palavra { animation: ds-palavra 0.67s cubic-bezier(0.16, 1, 0.3, 1) 1.43s both; }
}
@keyframes ds-palco-coluna {
  from { transform: translate(39.94%, 0) scale(var(--ds-zoom)); }
  to   { transform: translate(39.94%, ${PALCO_SUBIDA}) scale(1); }
}
@keyframes ds-palavra {
  from { transform: translate(0, 0); }
  to   { transform: translate(${PALAVRA_DX}px, ${PALAVRA_DY}px); }
}

/* Sem movimento: o lockup já aparece montado e o overlay só desaparece. */
@media (prefers-reduced-motion: reduce) {
  .ds-overlay::before, .ds-stage, .ds-simbolo, .ds-simbolo-alt, .ds-grupo-d, .ds-d, .ds-letra { animation: none; }
  .ds-simbolo { opacity: 0; }
  .ds-simbolo-alt { opacity: 1; }
  /* Sem percurso até o cabeçalho: o lockup só esmaece onde está. E o cabeçalho
     entra junto, sem a espera que existia para casar com o pouso. */
  .ds-voar, .ds-overlay.is-saindo .ds-voar { transition: opacity 200ms ease; transform: none !important; }
  body.ds-com-splash-saindo .dl-header { transition: opacity 200ms ease; }
  .ds-ponta { display: none; }
  .ds-d { stroke: #ffffff; stroke-dasharray: none; }
  .ds-overlay { animation: ds-simbolo 0.3s ease-out both; }
  .ds-palavra { animation: none; }
}

/* Sem movimento E em coluna: a marca precisa nascer já montada no arranjo
   empilhado. Sem isto ela apareceria deitada dentro de uma caixa de 146vw —
   larga demais para a tela, porque essa largura só existe por causa da
   coluna. Vem por último para vencer o bloco acima, que zera as animações mas
   não diz onde cada peça para. */
@media ${EMPILHADO} and (prefers-reduced-motion: reduce) {
  .ds-stage { transform: translate(39.94%, ${PALCO_SUBIDA}); }
  .ds-palavra { transform: translate(${PALAVRA_DX}px, ${PALAVRA_DY}px); }
}
`;

export default DomusSplash;
