import { useEffect, useRef, useState } from "react";

/* ────────────────────────────────────────────────────────────────────────────
   Splash de abertura da landing.

   Roteiro (≈2,9 s):
     1. o símbolo dourado aparece sozinho, grande e centralizado;
     2. o contorno do O é desenhado dentro do vão que a marca deixa vago;
     3. o O voa para a direita enquanto o símbolo desliza para a esquerda, e ao
        mesmo tempo a marca troca para a versão sem o vão — o buraco se fecha
        atrás do O que acabou de sair;
     4. M, N, I, M, O e B saem de trás do O, em cascata;
     5. o lockup inteiro viaja até o logo do cabeçalho e esmaece em cima dele.

   O vão do símbolo é o berço da primeira letra, e desde a marca nova ele é um
   CÍRCULO — antes era um D, herança do nome antigo. Isso simplificou o encaixe:
   o O entra concêntrico ao vão, sem a correção óptica que o formato de D pedia.

   A troca do símbolo é sobreposição, não travessia: a arte original fica opaca
   embaixo e a alternativa aparece por cima. Se as duas cruzassem em opacidade
   parcial, o fundo escuro vazaria pelas duas no meio do caminho.

   Por que SVG e não GIF/WebP animado: o traço do O só existe de verdade com
   `stroke-dashoffset` sobre um caminho vetorial, e a marca precisa ficar nítida
   em qualquer densidade de tela. O arquivo todo pesa menos que um frame do GIF.

   As letras são caminhos monoline, traço de 31 unidades, na mesma construção
   geométrica do lockup antigo: banda de maiúscula em y 199→402, eixo médio das
   letras retas em y 214,5→386,5, redondas transbordando ~1,5 nas duas pontas.
   O e M vêm inteiros do lockup anterior; N, I e B foram desenhados no mesmo
   sistema. Coordenadas no espaço do lockup (2852 × 603), então o símbolo (que
   continua sendo bitmap, por causa dos degradês) e as letras se encaixam sem
   ajuste.
   ──────────────────────────────────────────────────────────────────────────── */

// ── Geometria ───────────────────────────────────────────────────────────────

const SIMBOLO_SRC = "/marca-simbolo.webp";
const SIMBOLO_ALT_SRC = "/logo_alt.webp";

/* Traço do O: começa às 12 h e fecha dando a volta pela direita, em duas
   meias-elipses. Um caminho só, e começando pelo topo, para o desenho sair
   contínuo e na direção em que a mão escreveria. */
const O_PATH = "M911 213A92 87.5 0 0 1 911 388A92 87.5 0 0 1 911 213Z";

/* Onde o O nasce. O vão da marca é um círculo de centro (250; 422) e raio 109
   no espaço da arte (499 × 603) — medido no próprio `logo.png`, não estimado —
   e a arte entra no lockup esticada para 500 de largura, o que põe o centro em
   x 250,5. O deslocamento leva o centro do O no lockup (911; 300,5) até lá.

   A escala é o quanto do vão o O ocupa: em 0,82 o diâmetro externo dele (215)
   vira 176 dentro de um vão de 219, deixando um anel escuro de ~21 de cada
   lado. Mais que isso o anel some e a letra encosta na borda; menos, ela boia. */
const O_NO_VAO = { x: 250.5 - 911, y: 422 - 300.5, escala: 0.82 };

/* Borda direita do O no lockup. É onde o recorte começa: as outras letras
   nascem atrás dele e só aparecem depois de passar dessa linha. */
const BORDA_DO_O = 1018.5;

/* Cada letra parte com a própria borda direita logo atrás do recorte, para
   sair de trás do O já inteira. Daí `de` ser sempre (recorte − 4) − borda. */
const partida = (bordaDireita) => Math.round((BORDA_DO_O - 4 - bordaDireita) * 10) / 10;

const LETRAS = [
  // As diagonais do M sobem além da linha de topo e são cortadas em y=199:
  // paradas no 199 elas terminariam em bisel, deixando um degrau visível no
  // encontro com as hastes. Emendar tudo num caminho só não serve — a virada é
  // aguda demais e o miter viraria uma farpa acima da letra. O N usa o mesmo
  // recurso, com uma diagonal só.
  {
    id: "m1",
    d: "M1165 199V402M1352.5 199V402M1148.9 173.7L1258.5 346L1368.7 173.7",
    recorte: "ds-topo-m1",
    de: partida(1368),
  },
  {
    id: "n",
    d: "M1514.5 199V402M1669.5 199V402M1491.6 169L1692.4 432",
    recorte: "ds-topo-n",
    de: partida(1685),
  },
  { id: "i", d: "M1831.5 199V402", de: partida(1847) },
  {
    id: "m2",
    d: "M1993.5 199V402M2181 199V402M1977.4 173.7L2087 346L2197.2 173.7",
    recorte: "ds-topo-m2",
    de: partida(2196.5),
  },
  { id: "o2", d: "M2527 300.5A92 87.5 0 1 1 2343 300.5A92 87.5 0 1 1 2527 300.5Z", de: partida(2542.5) },
  {
    id: "b",
    d:
      "M2689 402V214.5H2743C2790 214.5 2820 232 2820 257.5C2820 283 2790 300.5 2743 300.5H2689" +
      "M2689 300.5H2755C2804 300.5 2836 318 2836 343.5C2836 369 2804 386.5 2755 386.5H2689",
    de: partida(2851.5),
  },
];

/* Recortes que estabelecem a linha de topo e a base das letras com diagonal.
   Ficam em coordenadas absolutas, e é por isso que há um por letra: o recorte
   viaja junto com o transform de quem o usa, então precisa nascer em cima dela. */
const RECORTES = [
  { id: "ds-topo-m1", x: 1122.5, largura: 280 },
  { id: "ds-topo-n", x: 1472, largura: 250 },
  { id: "ds-topo-m2", x: 1951, largura: 280 },
];

/* ── Versão empilhada (telas pequenas) ───────────────────────────────────────
   No celular não cabe o lockup deitado: a 94vw o símbolo fica do tamanho de uma
   unha e a palavra encosta nas duas bordas. Abaixo deste ponto a marca se monta
   em coluna — símbolo em cima, OMNIMOB embaixo, tudo centralizado — e o conjunto
   pode crescer, porque agora quem manda na largura é só a palavra.

   As medidas estão no espaço do viewBox (2852 × 603), o mesmo dos caminhos das
   letras, e valem para o grupo inteiro da palavra (O + M + N + I + M + O + B):

     a palavra ocupa x 803,5 → 2851,5 (centro 1827,75) e y 183,5 → 417,5
     o símbolo ocupa x 0 → 500        (centro 250)

   Levar a palavra para debaixo do símbolo é, então, alinhar os dois centros em
   x e empurrar a palavra para baixo do rodapé do símbolo (603) com um respiro. */
const EMPILHADO = "(max-width: 640px)";
const RESPIRO_COLUNA = 175;                    // vão entre o pé do símbolo e o topo da palavra
const PALAVRA_DX = 250 - 1827.5;               // centro da palavra sob o centro do símbolo
const PALAVRA_DY = 603 + RESPIRO_COLUNA + 117 - 300.5; // topo da palavra logo abaixo do símbolo
const ALTURA_COLUNA = 603 + RESPIRO_COLUNA + 234;      // símbolo + vão + palavra

/* Empilhada, a marca ocupa ~72% da largura que ocupava deitada — e ficaria
   pequena demais. A ampliação acontece DENTRO do SVG (que tem overflow
   visível), não na caixa do palco: caixa maior que a tela vira item de grid
   que estoura só para um lado, porque alinhamento não produz deslocamento
   negativo. Assim a caixa continua cabendo e só o desenho cresce.

   Com sete letras a palavra já é quase toda a largura do lockup, então sobra
   bem menos para ampliar do que sobrava com cinco — daí 1,26 e não 1,44. Acima
   disso a palavra encosta nas bordas do celular.

   O ponto fixo da ampliação é o centro do símbolo (x 250 · y 301,5 = 8,77% ·
   50% da caixa), que é justamente onde o palco já centraliza a marca. */
const ESCALA_COLUNA = 1.26;
const ORIGEM_COLUNA = `${((250 / 2852) * 100).toFixed(2)}% 50%`;

/* Com a palavra embaixo, o conjunto passa a ser bem mais alto que a caixa de
   603 — e a ampliação estica isso mais ainda. O palco sobe a diferença entre o
   centro do conjunto e o centro da caixa, e o todo volta ao meio da tela. */
const PALCO_SUBIDA = `${(-(ALTURA_COLUNA / 603 / 2 - 0.5) * ESCALA_COLUNA * 100).toFixed(2)}%`;

/* Deslocamento que põe o símbolo no centro do palco na abertura: a distância do
   centro do símbolo (250) até o centro da caixa (2852/2), em % da caixa. */
const PALCO_ENTRADA = `${(((2852 / 2 - 250) / 2852) * 100).toFixed(2)}%`;

/* Fim da animação (ver CSS). O overlay só sai depois disso E depois da página
   estar pronta, para o traço nunca ser cortado no meio.

   A última letra pousa em 2,92 s (1,92 + 5 × 90 ms de atraso + 550 ms). Os
   ~260 ms a mais existem para o lockup COMPLETO ficar parado um instante antes
   de voar: sem essa pausa a marca começava a sair no quadro em que o B chegava,
   e o desenho nunca era visto inteiro. */
const DURACAO_MS = 3180;
const SAIDA_MS = 720;
const CHAVE_SESSAO = "omnimob:splash-visto";

// Logo do cabeçalho da landing: é para lá que o lockup voa na saída.
const ALVO = ".dl-header__tipo";

/* O alvo (`tipo_header_alt.png`) é gerado a partir desta mesma geometria, então
   tem a proporção do viewBox — mapear um no outro é só escala uniforme mais
   translação, sem deformar nada. Trocar um dos dois pede regerar o outro. Com
   transform-origin em 0 0, basta alinhar os cantos superiores esquerdos.
   Devolve null quando não há alvo (aí a saída é só o esmaecimento). */
function calcularVoo(palco) {
  const alvo = document.querySelector(ALVO);
  if (!palco || !alvo) return null;
  /* A conta mapeia a CAIXA do palco no logo do cabeçalho, e ela vale nos dois
     formatos porque a caixa é sempre a mesma: o empilhamento do celular é feito
     só por transform (o palco desliza, a palavra desce, o SVG amplia), e
     transform não mexe em layout.

     O que o celular precisa é desmanchar esse empilhamento na saída, senão o
     conjunto viajaria em coluna até um logo que é deitado. Quem faz isso é o
     bloco "Celular: desmonte na saída" no CSS, no mesmo tempo e na mesma curva
     deste voo — a marca se deita e pousa no cabeçalho num movimento só. */
  const a = alvo.getBoundingClientRect();
  const p = palco.getBoundingClientRect();
  if (!a.width || !p.width) return null;
  return { dx: a.left - p.left, dy: a.top - p.top, escala: a.width / p.width };
}

// ── Componente ──────────────────────────────────────────────────────────────

export function OmnimobSplash() {
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
          <svg viewBox="0 0 2852 603" className="ds-svg">
            <defs>
              {/* Recorta as letras na borda direita do O: elas nascem atrás dele. */}
              <clipPath id="ds-atras-do-o">
                <rect x={BORDA_DO_O} y="-300" width="2100" height="1200" />
              </clipPath>
              {/* Linha de topo e base das letras com diagonal (cada recorte
                  acompanha a sua letra, porque anda junto com o transform dela). */}
              {RECORTES.map((r) => (
                <clipPath key={r.id} id={r.id}>
                  <rect x={r.x} y="199" width={r.largura} height="203.2" />
                </clipPath>
              ))}
            </defs>

            <image className="ds-simbolo" href={SIMBOLO_SRC} x="0" y="0" width="500" height="603" />
            <image className="ds-simbolo-alt" href={SIMBOLO_ALT_SRC} x="0" y="0" width="500" height="603" />

            {/* A palavra inteira num grupo só. No desktop ele não faz nada (a
                marca já nasce deitada); no celular é ele que leva as sete letras
                para baixo do símbolo, sem que nenhuma peça precise saber disso —
                inclusive o recorte "atrás do O", que continua valendo no espaço
                interno do grupo e viaja junto. */}
            <g className="ds-palavra">
              <g className="ds-letras" clipPath="url(#ds-atras-do-o)">
                {LETRAS.map((l, i) => (
                  <path
                    key={l.id}
                    className={`ds-letra ds-letra--${l.id}`}
                    d={l.d}
                    clipPath={l.recorte ? `url(#${l.recorte})` : undefined}
                    style={{ "--de": `${l.de}px`, "--atraso": `${i * 90}ms` }}
                  />
                ))}
              </g>

              {/* O O fica por cima de tudo: é ele que esconde as letras na
                  largada. A ponta luminosa vai no mesmo grupo para herdar o voo
                  — solta, ela correria pelo caminho na posição do lockup, longe
                  do símbolo. */}
              <g className="ds-grupo-o">
                <path className="ds-o" d={O_PATH} pathLength="1" />
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
   1,43→1,92 s troca do símbolo · 1,92 s→ letras (6 × 90 ms). O traço termina em
   1,43 s, que é onde o voo e a troca começam — mexer num pede conferir os
   outros, e o total pede mexer em DURACAO_MS. */

const CSS = `
.ds-overlay {
  /* Largura do palco: é ela que dimensiona a marca E o brilho de fundo, para os
     dois crescerem juntos em vez de o segundo ficar num tamanho fixo. Com sete
     letras o lockup é mais comprido que o antigo, então o palco cresceu junto —
     senão o símbolo, que é uma fração menor da caixa, entraria menor. */
  --ds-palco: min(1200px, 94vw);
  /* Diâmetro do brilho quando a marca está montada, e a fração dele que o
     brilho ocupa enquanto ainda é só o símbolo (ver ds-brilho). */
  --ds-brilho: calc(var(--ds-palco) * 1.45);
  --ds-brilho-ini: 0.42;

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

/* Brilho quente atrás da marca, só para o fundo não ser um preto chapado.

   Ele acompanha a marca em vez de ter tamanho próprio: nasce do tamanho do
   símbolo sozinho e abre até cobrir o lockup inteiro, no mesmo instante (1,43 s)
   e na mesma curva em que o O sai do vão e a palavra se monta.

   Fica centralizado na tela e não precisa se mover: o palco entra deslocado
   justamente para o símbolo cair no centro, e termina com o lockup no mesmo
   centro. Só o diâmetro muda. */
.ds-overlay::before {
  content: ""; position: absolute;
  width: var(--ds-brilho); height: var(--ds-brilho);
  background: radial-gradient(closest-side, rgba(212,175,55,0.13), transparent 70%);
  animation: ds-brilho 2.9s ease-out both;
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
   em cima do símbolo (8,77% = x 250 de 2852) mantém ele como eixo do movimento.
   Como a escala é a mesma do começo ao fim, é a largura do palco que define o
   tamanho do símbolo na abertura — daí ela ser bem maior que a do lockup usual.
   A variável --ds-zoom fica como regulagem: acima de 1 o símbolo entra
   ampliado e encolhe até o lockup. */
.ds-stage {
  --ds-zoom: 1;
  position: relative; width: var(--ds-palco);
  transform-origin: ${ORIGEM_COLUNA};
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
   em unidades de usuário é o próprio centro do O. */
.ds-grupo-o {
  transform-origin: 911px 300.5px;
  animation: ds-voo 0.67s cubic-bezier(0.16, 1, 0.3, 1) 1.43s both;
}

.ds-o {
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
  offset-path: path("${O_PATH}");
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

/* 0 → 0,45 s acende junto com o símbolo; segura enquanto o traço do O é
   desenhado (o desenho não muda de área nesse trecho, então o brilho também
   não); 1,43 s → 2,90 s abre até o tamanho cheio, terminando junto com a última
   letra da cascata. */
@keyframes ds-brilho {
  0%    { opacity: 0; transform: scale(calc(var(--ds-brilho-ini) * 0.72)); }
  15.5% { opacity: 1; transform: scale(var(--ds-brilho-ini)); }
  49.3% {
    opacity: 1; transform: scale(var(--ds-brilho-ini));
    animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
  }
  100%  { opacity: 1; transform: scale(1); }
}
@keyframes ds-apagar {
  to { opacity: 0; }
}
@keyframes ds-simbolo {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes ds-palco {
  from { transform: translateX(${PALCO_ENTRADA}) scale(var(--ds-zoom)); }
  to   { transform: translateX(0) scale(1); }
}
@keyframes ds-traco {
  from { stroke-dashoffset: 1; }
  to   { stroke-dashoffset: 0; }
}
@keyframes ds-voo {
  from { transform: translate(${O_NO_VAO.x}px, ${O_NO_VAO.y}px) scale(${O_NO_VAO.escala}); }
  to   { transform: translate(0, 0) scale(1); }
}
/* O O nasce dourado dentro do vão e chega branco no lockup, junto das letras. */
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
   Duas mudanças, e as duas no mesmo instante em que o O sai do vão (1,43 s),
   para o roteiro continuar sendo um movimento só:

     · a palavra desce para debaixo do símbolo em vez de o palco deslizar para
       a esquerda — o O já sai do vão rumo ao lugar novo, e M, N, I, M, O e B
       saem de trás dele exatamente como antes;
     · o palco sobe o que a coluna cresceu para baixo, e o conjunto termina
       centralizado na tela.

   O desenho ainda cresce junto: deitada, a marca tinha de caber símbolo +
   palavra lado a lado na mesma largura; em coluna, quem mede é só a palavra, e
   sem a ampliação a marca terminaria ocupando menos da tela do que devia. */
@media ${EMPILHADO} {
  .ds-svg { transform: scale(${ESCALA_COLUNA}); transform-origin: ${ORIGEM_COLUNA}; }
  .ds-stage { animation-name: ds-palco-coluna; }
  .ds-palavra { animation: ds-palavra 0.67s cubic-bezier(0.16, 1, 0.3, 1) 1.43s both; }
  /* Em coluna a marca é quase quadrada em vez de uma faixa deitada, e o desenho
     todo já entra ampliado em ${ESCALA_COLUNA}× — o brilho fecha um pouco e
     parte de mais perto, senão viraria um véu chapado do tamanho da tela.
     Também termina centrado: o palco sobe o que a coluna cresceu para baixo, e
     o conjunto para no meio da tela. */
  .ds-overlay { --ds-brilho: calc(var(--ds-palco) * 1.15); --ds-brilho-ini: 0.47; }
}
@keyframes ds-palco-coluna {
  from { transform: translate(${PALCO_ENTRADA}, 0) scale(var(--ds-zoom)); }
  to   { transform: translate(${PALCO_ENTRADA}, ${PALCO_SUBIDA}) scale(1); }
}
@keyframes ds-palavra {
  from { transform: translate(0, 0); }
  to   { transform: translate(${PALAVRA_DX}px, ${PALAVRA_DY}px); }
}

/* ── Celular: desmonte na saída ─────────────────────────────────────────────
   O voo até o cabeçalho existia só no desktop. No celular a marca esmaecia
   parada, e a abertura terminava sem o fecho que dá sentido a ela: a tipografia
   animava, mas não ia parar em lugar nenhum.

   Ela vai agora, e o caminho é o mesmo — o que muda é que primeiro ela precisa
   se deitar. As três peças do empilhamento (o palco subido, a palavra embaixo,
   o SVG ampliado) voltam ao arranjo deitado exatamente enquanto o conjunto
   viaja, na mesma duração e na mesma curva do .ds-voar: um movimento só, em que
   a marca se recompõe no caminho até o cabeçalho.

   Por que animação e não simplesmente apagar as do empilhamento: elas têm fill
   "both" e seguram o transform final. Tirá-las devolveria o valor de partida no
   mesmo quadro, sem percurso. Com o "from" escrito à mão, o percurso existe. */
@media ${EMPILHADO} {
  .ds-overlay.is-saindo .ds-stage {
    animation: ds-palco-deita ${SAIDA_MS - 80}ms cubic-bezier(0.6, 0, 0.2, 1) both;
  }
  .ds-overlay.is-saindo .ds-palavra {
    animation: ds-palavra-deita ${SAIDA_MS - 80}ms cubic-bezier(0.6, 0, 0.2, 1) both;
  }
  .ds-overlay.is-saindo .ds-svg {
    transform: scale(1);
    transition: transform ${SAIDA_MS - 80}ms cubic-bezier(0.6, 0, 0.2, 1);
  }
}
@keyframes ds-palco-deita {
  from { transform: translate(${PALCO_ENTRADA}, ${PALCO_SUBIDA}); }
  to   { transform: translate(0, 0); }
}
@keyframes ds-palavra-deita {
  from { transform: translate(${PALAVRA_DX}px, ${PALAVRA_DY}px); }
  to   { transform: translate(0, 0); }
}

/* Sem movimento: o lockup já aparece montado e o overlay só desaparece. */
@media (prefers-reduced-motion: reduce) {
  .ds-overlay::before, .ds-stage, .ds-simbolo, .ds-simbolo-alt, .ds-grupo-o, .ds-o, .ds-letra { animation: none; }
  .ds-simbolo { opacity: 0; }
  .ds-simbolo-alt { opacity: 1; }
  /* Sem percurso até o cabeçalho: o lockup só esmaece onde está. E o cabeçalho
     entra junto, sem a espera que existia para casar com o pouso. */
  .ds-voar, .ds-overlay.is-saindo .ds-voar { transition: opacity 200ms ease; transform: none !important; }
  body.ds-com-splash-saindo .dl-header { transition: opacity 200ms ease; }
  .ds-ponta { display: none; }
  .ds-o { stroke: #ffffff; stroke-dasharray: none; }
  .ds-overlay { animation: ds-simbolo 0.3s ease-out both; }
  .ds-palavra { animation: none; }
}

/* Sem movimento E em coluna: a marca precisa nascer já montada no arranjo
   empilhado. Sem isto ela apareceria deitada dentro de uma caixa larga demais
   para a tela, porque essa largura só existe por causa da coluna. Vem por
   último para vencer o bloco acima, que zera as animações mas não diz onde cada
   peça para. */
@media ${EMPILHADO} and (prefers-reduced-motion: reduce) {
  .ds-stage { transform: translate(${PALCO_ENTRADA}, ${PALCO_SUBIDA}); }
  .ds-palavra { transform: translate(${PALAVRA_DX}px, ${PALAVRA_DY}px); }
}
`;

export default OmnimobSplash;
