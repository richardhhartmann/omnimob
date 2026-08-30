import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Trilha } from "./Trilha.jsx";
import { degrausAte } from "../utils/trilhaDoPainel";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { CartaoDeMenu } from "./CartaoDeMenu.jsx";
import { tourAtivo } from "../utils/tourAtivo";

/* ── A grade dos índices do painel ───────────────────────────────────────────

   Quatro telas do produto fazem a mesma pergunta — "para onde vou daqui?" — e
   agora respondem com a mesma cara: Dashboard, Gerenciar Imóveis, Relatórios e
   Configurações. O cartão já era compartilhado entre três delas; a GRADE não
   era, e é ela que decide espaçamento, largura mínima da coluna e — desde
   agora — o que acontece quando os cartões passam de nove.

   ── POR QUE NOVE ──

   É o teclado. Os atalhos das telas de índice são as teclas 1 a 9, e uma décima
   opção não teria como ser alcançada — ou pior, roubaria a tecla de outra. Com
   a paginação, cada página tem no máximo nove e a numeração recomeça: o "1" da
   segunda página é o décimo cartão, não o primeiro.

   ── O ATALHO MUDA DE NATUREZA QUANDO PAGINA ──

   Sem paginação, cada cartão mostra a tecla CONFIGURADA para a ação dele (ver
   `ACOES`, em `utils/atalhos.js`) — que a pessoa pode ter trocado. É o
   comportamento de sempre, e ele fica intacto para quem tem nove ou menos.

   Com paginação, a tecla passa a ser POSICIONAL: ela pertence ao lugar na
   página, não à ação. Tinha de ser assim — uma tecla fixa por ação não teria
   como recomeçar na página seguinte, que é exatamente o que se pede dela.

   Nesse modo a grade escuta as teclas ela mesma, na fase de CAPTURA, e marca o
   evento como tratado. O ouvinte global (`useAtalhos`) respeita essa marca e
   não age em cima — senão "1" navegaria para dois lugares ao mesmo tempo.

   ── A PASSAGEM TEM DIREÇÃO ──

   Trocar de página trocava os nove cartões no mesmo quadro, sem nada dizendo o
   que aconteceu — a tela pisca e a pessoa não sabe se avançou, voltou ou se os
   cartões só mudaram de nome. A grade entra deslizando DO LADO de onde veio:
   avançou, ela vem da direita; voltou, da esquerda. É a mesma informação que o
   gesto de virar página dá no papel.

   Quem replica a animação é a `key` na grade: mudar de página remonta o nó e a
   entrada roda de novo. Mesmo truque que a `RelatoriosPage` usa com `key={view}`
   — sem ele, o CSS anima uma vez e nunca mais.

   `direcao` começa em ZERO, e é isso que evita a grade deslizar sozinha na
   primeira pintura: sem clique não há de onde vir, e a tela já entra pela
   animação da página inteira.

   ── A GRADE GUARDA O LUGAR DA PÁGINA CHEIA ──

   A última página quase nunca tem nove cartões, e com a grade encolhendo junto
   os controles subiam meia tela: a pessoa clicava na seta e a própria seta
   fugia de debaixo do dedo. Duas passadas e o ponteiro já não estava mais em
   cima de nada.

   A grade reserva SEMPRE a altura de uma página cheia, e a reserva são CARTÕES
   DE VERDADE, invisíveis, ocupando os lugares que sobraram. Nada de medir.

   A primeira tentativa mediu, e errou: colunas do `gridTemplateColumns`, altura
   da linha do cartão mais alto NA TELA, e o resto por aritmética. O furo é o
   "na tela" — a última página só tem os cartões dela, todos podendo ser mais
   baixos que os da primeira (descrição de uma linha contra duas). A conta dava
   três linhas curtas onde a página cheia tinha três linhas altas, e a barra
   continuava subindo, só que menos.

   Com cartões ocupando os lugares, a pergunta "qual a altura de nove destes?"
   é respondida por quem já sabe respondê-la: o próprio grid. Sai de graça em
   qualquer largura de tela — três colunas ou uma, a reserva acompanha, porque
   é o mesmo cálculo que desenha a página cheia.

   Quais cartões: os que ESTARIAM naquele lugar numa página cheia
   (`itens[i]` para o lugar `i`). Repetir os primeiros da lista seria mais
   simples e deslocaria as linhas — o lugar 4 ganharia a altura do cartão 1, e
   as três linhas dariam outro total.
   ────────────────────────────────────────────────────────────────────────── */

const POR_PAGINA = 9;

/**
 * @param {string} [titulo]      O nome da tela, à esquerda e sem moldura.
 * @param {string} [subtitulo]   Uma linha dizendo o que se escolhe aqui.
 *
 * O CABEÇALHO vem junto porque ele é parte do mesmo desenho: as três telas de
 * índice tinham um painel de vidro com título centralizado, e o Dashboard não —
 * a mesma pergunta, dois enquadramentos. Ficou o do Dashboard: sem moldura, o
 * conteúdo começa onde o olho já está, e os cartões ganham a largura inteira em
 * vez de caberem num painel estreito no meio da tela.
 */
export function GradeDeMenu({ cards, tourId, titulo, subtitulo, tourCabecalho, colunaMinima = 280 }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const degraus = degrausAte(pathname, navigate);
  const itens = useMemo(() => (cards || []).filter(Boolean), [cards]);
  const paginas = Math.ceil(itens.length / POR_PAGINA) || 1;
  const [pagina, setPagina] = useState(0);
  // -1 veio da esquerda · 0 sem passagem (primeira pintura) · 1 veio da direita
  const [direcao, setDirecao] = useState(0);

  /* Uma porta só para trocar de página — setas, bolinhas e o que vier depois.
     A direção é decidida AQUI, e não dentro do updater do `setPagina`: updater
     tem de ser função pura, e o StrictMode o executa duas vezes. */
  function irPara(proxima) {
    const alvo = Math.max(0, Math.min(paginas - 1, proxima));
    if (alvo === pagina) return;
    setDirecao(alvo > pagina ? 1 : -1);
    setPagina(alvo);
  }

  /* A página volta ao começo quando a LISTA muda de tamanho: um cargo que
     perde permissão, ou uma tela que carrega os cartões depois dos dados,
     deixaria a pessoa numa página que não existe mais — e a grade apareceria
     vazia, sem explicação. */
  useEffect(() => { setPagina((p) => Math.min(p, paginas - 1)); }, [paginas]);

  const paginado = paginas > 1;
  const visiveis = paginado ? itens.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA) : itens;

  /* Os lugares que sobraram nesta página, preenchidos pelos cartões que
     estariam neles se ela estivesse cheia. Vazio na página cheia. */
  const reserva = paginado ? itens.slice(visiveis.length, POR_PAGINA) : [];

  /* As teclas posicionais. Só existem no modo paginado — ver o cabeçalho. */
  useEffect(() => {
    if (!paginado) return undefined;

    function aoTeclar(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      /* Tour aberto, a grade não responde. Estas teclas escapam do ouvinte
         global de propósito (fase de captura), então a trava de lá não as
         alcança — sem esta linha o "3" continuaria trocando de tela com o
         holofote apontando para a anterior. Ver `utils/tourAtivo.js`. */
      if (tourAtivo()) return;
      /* Digitando num campo, número é número. Mesma guarda do ouvinte global. */
      const alvo = e.target;
      const tag = alvo?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || alvo?.isContentEditable) return;

      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > visiveis.length) return;

      /* `preventDefault` aqui é o que avisa o ouvinte global para não agir: ele
         checa `defaultPrevented`. Sem isso, a mesma tecla navegaria duas vezes,
         para lugares diferentes. */
      e.preventDefault();
      visiveis[n - 1]?.onClick?.();
    }

    window.addEventListener("keydown", aoTeclar, true);
    return () => window.removeEventListener("keydown", aoTeclar, true);
  }, [paginado, visiveis]);

  return (
    <>
      {titulo ? (
        <div data-tour={tourCabecalho} style={{ marginBottom: "24px", padding: "32px 0" }}>
          {/* A trilha dos três índices — Imóveis, Relatórios e Configurações —
              sai daqui pelo mesmo motivo que a do Flow sai do `PageHeader`: um
              índice novo nasce com ela, e ninguém precisa lembrar. */}
          {degraus.length > 1 ? (
            <div style={{ marginBottom: "12px" }}><Trilha itens={degraus} /></div>
          ) : null}
          <h2 style={{ margin: "0 0 6px", fontSize: "26px", fontWeight: 700 }}>{titulo}</h2>
          {subtitulo ? (
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "15px" }}>{subtitulo}</p>
          ) : null}
        </div>
      ) : null}

      <div
        /* A `key` é a página: trocá-la remonta a grade e a entrada roda de
           novo. Sem ela o CSS animaria uma vez, na primeira pintura, e as
           passagens seguintes seriam saltos secos. */
        key={pagina}
        data-tour={tourId}
        className={direcao === 0 ? undefined : `menu-grade--vem-da-${direcao > 0 ? "direita" : "esquerda"}`}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fill, minmax(${colunaMinima}px, 1fr))`,
          gap: "20px",
        }}
      >
        {visiveis.map((card, i) => (
          <CartaoDeMenu
            key={card.title}
            {...card}
            /* No modo paginado a tecla é o LUGAR; fora dele, a ação manda. */
            tecla={paginado ? String(i + 1) : undefined}
            acao={paginado ? undefined : card.acao}
          />
        ))}

        {/* A reserva. `visibility: hidden` e não `opacity: 0`: além de sumir,
            ele tira o cartão da ordem do Tab e da árvore de acessibilidade — a
            página não ganha oito destinos fantasmas para quem navega por
            teclado ou ouve a tela.

            O invólucro existe para o `aria-hidden` e a classe não precisarem
            entrar no `CartaoDeMenu`, que não tem nada com isto. Ele é a célula
            da grade; a altura continua sendo a do cartão lá dentro. */}
        {reserva.map((card, i) => (
          <div key={`reserva-${i}`} className="menu-grade__reserva" aria-hidden="true">
            <CartaoDeMenu {...card} tecla={undefined} acao={undefined} />
          </div>
        ))}
      </div>

      {paginado ? (
        <nav className="menu-paginas" aria-label="Páginas de atalhos">
          {/* Os controles numa linha só, centralizados sobre a grade — é o eixo
              do que eles comandam. A nota vai embaixo: alinhada à direita da
              mesma linha, ela empurrava as setas para a esquerda e desfazia a
              centralização. */}
          <span className="menu-paginas__linha">
            <button
              type="button"
              className="menu-paginas__seta"
              onClick={() => irPara(pagina - 1)}
              disabled={pagina === 0}
              aria-label="Página anterior"
            >
              <CaretLeft size={15} weight="bold" />
            </button>

            {/* Bolinhas e não "1 de 3": são poucas páginas, e o ponto aceso diz
                onde se está sem obrigar a ler. Cada uma é clicável — pular da
                primeira para a terceira não pode exigir duas passadas. */}
            <span className="menu-paginas__pontos">
              {Array.from({ length: paginas }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`menu-paginas__ponto${i === pagina ? " is-on" : ""}`}
                  onClick={() => irPara(i)}
                  aria-label={`Página ${i + 1}`}
                  aria-current={i === pagina ? "page" : undefined}
                >
                  {/* O ponto é um elemento, não um `::after`: dentro do painel
                      o pseudo perde para o brilho global dos botões. */}
                  <span />
                </button>
              ))}
            </span>

            <button
              type="button"
              className="menu-paginas__seta"
              onClick={() => irPara(pagina + 1)}
              disabled={pagina === paginas - 1}
              aria-label="Próxima página"
            >
              <CaretRight size={15} weight="bold" />
            </button>
          </span>
        </nav>
      ) : null}
    </>
  );
}
