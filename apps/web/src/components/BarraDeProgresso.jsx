import { lazy, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";

/* ────────────────────────────────────────────────────────────────────────────
   A BARRA DE PROGRESSO DO TOPO.

   Dois pixels de altura na borda de cima da janela, que enchem da esquerda para
   a direita enquanto a próxima tela vem.

   ── POR QUE ELA EXISTE ──

   Metade das telas deste app é carregada sob demanda (`lazy` no `App.jsx`): a
   landing, o editor de vitrine, o super-admin, as dez telas do Flow e as cinco
   páginas institucionais. Numa conexão comum o pedaço desce em 200 ms e ninguém
   repara. Em 3G, ou no primeiro acesso depois de um deploy, demora — e durante
   essa espera a tela ANTERIOR fica parada, sem nada indicando que o clique foi
   registrado. A pessoa clica de novo.

   ── COMO ELA SABE QUE ALGO ESTÁ CARREGANDO ──

   Esta parte custou uma medição no navegador para acertar, e as duas primeiras
   respostas estavam erradas:

   1. "Um `useEffect` na rota." Não: o efeito roda depois que a árvore nova
      entrou, ou seja, DEPOIS que a espera acabou.

   2. "O fallback do `Suspense` avisa ao montar." Também não, e este é o
      contraintuitivo. O React Router envolve a navegação num `startTransition`,
      e o propósito de uma transição é justamente NÃO mostrar o fallback: o
      React segura a tela antiga de pé até a nova estar pronta. Medindo com o
      pedaço de `/termos` atrasado em 3 s, o fallback nunca apareceu e o
      `useLocation()` desta barra só mudou no fim — a barra ficava imóvel
      exatamente durante os três segundos que existe para cobrir.

   O que funciona é medir o DOWNLOAD, que é o fato de verdade: `telaTardia()`
   envolve cada `lazy()` e marca a espera enquanto a promessa do `import()` não
   resolve. Isso independe de transição, de fallback e de como o roteador
   agenda a atualização.

   O fallback continua avisando também (`useEsperaDeTela`), porque há um caso em
   que ele aparece de verdade: a primeira pintura, quando não existe tela
   anterior para segurar.

   ── POR QUE CSS PRÓPRIO, E NÃO AS UTILITÁRIAS ──

   O desenho pedido veio em classes do Tailwind (`fixed inset-x-0 top-0
   z-[9999] h-0.5`, `bg-gradient-to-r from-primary via-accent to-primary`,
   `transition-[width,opacity] duration-200 ease-out`), e o Tailwind ESTÁ
   ligado aqui — `@tailwindcss/vite` no `vite.config.js`, `@import
   "tailwindcss"` no `index.css`. Elas funcionariam.

   A escolha é de vizinhança, não de disponibilidade: quase todo o estilo deste
   app mora em `styles.css` (200 kB de classes próprias), e as utilitárias
   aparecem em meia dúzia de componentes portados de fora. Uma barra descrita
   por doze utilitárias no meio do JSX seria o único trecho do painel que não se
   lê no arquivo de estilo — e `from-primary`/`via-accent` apontam para tokens
   que este projeto não define, então as cores teriam de ser escritas cruas no
   markup de qualquer jeito.

   `.brp` e `.brp__traco` em `styles.css` guardam os mesmos valores, conferidos
   no navegador: 2px, z-index 9999, o gradiente índigo → coral → índigo, a
   transição de 200 ms em `width` e `opacity` e o brilho de duas camadas.
   ──────────────────────────────────────────────────────────────────────────── */

/* ── A loja ──────────────────────────────────────────────────────────────────

   Módulo, e não Context: a convenção do projeto é estado local ou props, e um
   provider só para contar esperas obrigaria a envolver a árvore inteira num
   componente novo — justamente acima do `LimiteDeErro`, que é o ponto mais
   sensível do `App.jsx`.

   CONTADOR, e não booleano. Duas esperas podem se sobrepor (a rota chega, o
   pedaço ainda desce, alguém clica noutro link), e um booleano faria a segunda
   fechar a barra da primeira. */
let esperas = 0;
const ouvintes = new Set();

const avisar = () => ouvintes.forEach((fn) => fn());

export function abrirEspera() {
  esperas += 1;
  avisar();
}

export function fecharEspera() {
  esperas = Math.max(0, esperas - 1);
  avisar();
}

function assinar(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

const lerEsperas = () => esperas;

/**
 * `lazy()` com a barra em volta.
 *
 * Substitui `lazy()` nas telas tardias do `App.jsx`. A espera abre quando o
 * `import()` começa e fecha quando ele termina — inclusive quando FALHA, e o
 * `finally` está aí por isso: deploy com a aba aberta troca o hash do arquivo
 * e a promessa rejeita (é o caso que o `LimiteDeErro` trata). Sem o `finally`,
 * a barra ficaria correndo para sempre por cima da tela de erro.
 *
 * O `lazy` chama a fábrica UMA vez e guarda o módulo. Então a espera acontece
 * na primeira visita à tela, e as seguintes são instantâneas — que é
 * exatamente o que se quer indicar.
 */
export function telaTardia(carregar) {
  return lazy(() => {
    abrirEspera();
    return carregar().finally(fecharEspera);
  });
}

/**
 * Marca uma espera enquanto estiver montado. É o que o fallback do `Suspense`
 * usa — ver o cabeçalho: ele aparece na primeira pintura, quando não há tela
 * anterior para a transição segurar.
 */
export function useEsperaDeTela() {
  useEffect(() => {
    abrirEspera();
    return fecharEspera;
  }, []);
}

/* ── Os tempos ───────────────────────────────────────────────────────────────

   `INICIO` é onde a barra aparece: 12%, o mesmo valor do desenho pedido. Não é
   zero porque uma barra que começa em zero parece não ter começado.

   `TETO` é onde ela para sozinha. Nunca 100% enquanto se espera: chegar ao fim
   e ficar lá promete uma tela que ainda não veio, e o que a pessoa lê é
   "travou no fim" — pior do que não ter barra nenhuma.

   O avanço DESACELERA (anda uma fração do que falta, não um passo fixo). Uma
   espera de meio segundo e outra de oito segundos usam a mesma curva, e nenhuma
   das duas bate no teto cedo demais. */
const INICIO = 12;
const TETO = 88;
const PASSO_MS = 220;
const SUMICO_MS = 260;

/* O tempo MÍNIMO na tela, mesmo quando não houve espera nenhuma. A primeira
   versão fechava 120 ms depois de abrir, e a medição no navegador mostrou o que
   isso significa: a largura ia de 0 a 100% sem passar por nenhum valor
   intermediário visível. O olho não lia uma barra enchendo, lia um piscar no
   topo da janela — que é ruído, não informação. Com 360 ms cabe um passo do
   avanço, e o traço se move. */
const MIN_VISIVEL = 360;

export function BarraDeProgresso() {
  const carregando = useSyncExternalStore(assinar, lerEsperas, lerEsperas) > 0;
  const { pathname } = useLocation();

  const [largura, setLargura] = useState(0);
  const [visivel, setVisivel] = useState(false);
  const [correndo, setCorrendo] = useState(false);

  /* Os dois temporizadores são SEPARADOS, e a primeira versão os misturava numa
     lista só. O avanço é um `setInterval` que só pode parar quando o traço
     fecha; o fecho são `setTimeout` encadeados. Guardados juntos, o fecho
     terminava e o intervalo continuava vivo — a barra ficava invisível e a
     largura voltava a subir sozinha, indefinidamente, num temporizador a cada
     220 ms pelo resto da sessão. Só apareceu porque a sondagem no navegador leu
     a largura DEPOIS de a barra sumir. */
  const avanco = useRef(null);
  const abertoEm = useRef(0);

  const pararAvanco = () => {
    if (avanco.current) clearInterval(avanco.current);
    avanco.current = null;
  };

  /* Abre o pulso, ou o mantém aberto. Chamado pelos DOIS gatilhos: a troca de
     rota e o início de uma espera de download. Se já estiver correndo, não
     reinicia a largura — a barra voltar para 12% no meio do caminho pareceria
     um recomeço, e nada recomeçou. */
  const comecar = useCallback(() => {
    setCorrendo(true);
    setVisivel(true);
    if (avanco.current) return;

    abertoEm.current = Date.now();
    setLargura(INICIO);
    avanco.current = setInterval(() => {
      setLargura((atual) => (atual >= TETO ? atual : atual + (TETO - atual) * 0.18));
    }, PASSO_MS);
  }, []);

  /* ── Gatilho 1: a rota mudou ──────────────────────────────────────────────
     Toda troca de tela mostra a barra, inclusive as instantâneas — as telas do
     painel que já estão no pacote principal trocam em milissegundos, e sem o
     pulso a barra apareceria só nas lentas. Um retorno que aparece às vezes é
     lido como defeito, não como informação. */
  useEffect(() => {
    comecar();
  }, [pathname, comecar]);

  /* ── Gatilho 2: um pedaço começou a descer ────────────────────────────────
     Este é o que cobre a espera de verdade, e o que a versão anterior não
     tinha: numa navegação com transição, o `pathname` daqui só muda no FIM. */
  useEffect(() => {
    if (carregando) comecar();
  }, [carregando, comecar]);

  /* ── O fecho ──────────────────────────────────────────────────────────────
     Chega a 100% e só então some. Cortar em 70% deixa a impressão de que algo
     foi interrompido; o traço precisa chegar ao fim para que o fim signifique
     alguma coisa. */
  useEffect(() => {
    if (!correndo || carregando) return undefined;

    /* Espera o que faltar do mínimo visível — nunca menos de 90 ms, para o
       fecho não cair no mesmo quadro em que a tela nova entrou. Numa espera
       longa o mínimo já passou havia muito, e o fecho sai quase imediato. */
    const resta = Math.max(90, MIN_VISIVEL - (Date.now() - abertoEm.current));

    const relogio = setTimeout(() => {
      /* PRIMEIRA linha: sem parar o avanço aqui, o intervalo continua correndo
         depois do fecho e recomeça a encher a barra a partir do zero que a
         última etapa grava. */
      pararAvanco();
      setLargura(100);
      setCorrendo(false);
    }, resta);

    return () => clearTimeout(relogio);
  }, [correndo, carregando]);

  /* ── O sumiço ─────────────────────────────────────────────────────────────
     Efeito separado, e é o que conserta o defeito que a medição no navegador
     mostrou: numa primeira versão os relógios do fecho moravam todos numa lista
     compartilhada (`fechos.current`), que `comecar()` esvaziava. Bastava
     qualquer reabertura para o fecho pendente ser cancelado — a barra subia
     até o teto de 88% e ficava lá, para sempre, com a tela nova já desenhada
     embaixo.

     Agora cada efeito é dono dos seus temporizadores e os cancela na própria
     limpeza. Nada de fora alcança o relógio de ninguém. */
  useEffect(() => {
    if (correndo || largura !== 100) return undefined;

    const some = setTimeout(() => setVisivel(false), SUMICO_MS);
    /* Volta a zero só DEPOIS de invisível, senão a viagem de 100% a 0% seria
       desenhada — a barra correria de volta para a esquerda à vista. */
    const zera = setTimeout(() => setLargura(0), SUMICO_MS + 240);

    return () => {
      clearTimeout(some);
      clearTimeout(zera);
    };
  }, [correndo, largura]);

  useEffect(() => pararAvanco, []);

  return (
    /* `aria-hidden`: é decoração de espera, e o leitor de tela já anuncia a
       troca de página pelo título e pelo foco. Uma barra que se narrasse
       repetiria cada navegação em voz alta sem acrescentar nada. */
    <div className="brp" aria-hidden="true">
      <div className="brp__traco" style={{ width: `${largura}%`, opacity: visivel ? 1 : 0 }} />
    </div>
  );
}
