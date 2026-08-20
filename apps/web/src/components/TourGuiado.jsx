import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";

/* ────────────────────────────────────────────────────────────────────────────
   Motor do tour guiado — holofote em quatro painéis + cartão flutuante.

   O recorte é feito com QUATRO retângulos escuros (acima, abaixo, esquerda,
   direita do alvo) em vez de um véu com `clip-path` ou um buraco em box-shadow.
   Parece rebuscado e é o contrário: os quatro painéis engolem o clique do que
   está escurecido e deixam o alvo REALMENTE clicável no meio, sem gambiarra de
   pointer-events. Um véu único obrigaria a escolher entre bloquear tudo ou
   nada.

   Diferença para a origem desta ideia (o wizard do nxc-webjs): lá cada página
   era um documento novo, e o tour precisava de trava de transição, sessão e
   remontagem a cada salto. Aqui é SPA — o tour é um componente só que
   atravessa as rotas vivo, guardando o índice em estado. Toda aquela
   maquinaria de transição some.
   ──────────────────────────────────────────────────────────────────────────── */

// Quanto esperamos um alvo aparecer antes de desistir do passo. A tela pode
// estar montando, buscando na API ou animando a entrada de rota.
const ESPERA_ALVO_MS = 3500;
const RESPIRO_PADRAO = 12;
const ORDEM_PADRAO = ["bottom", "top", "right", "left", "centro"];

/* O símbolo da marca no lugar do antigo ícone genérico de informação. É o mesmo
   arquivo do splash — o .webp, não o .png: a arte é idêntica e pesa 16 KB
   contra 198 KB, e este selo aparece em todo passo de todo tour. */
const SELO_SRC = "/logo_alt.webp";

/* Campos de TEXTO LIVRE — os únicos que ganham o cursor sozinhos quando o
   holofote para em cima deles.

   A lista é branca, não negra, e de propósito: um `input:not([type=checkbox])`
   varreria junto date, color, range e file, onde "focar" não adianta nada (a
   pessoa ainda precisa abrir o seletor) e ainda tira o foco de onde ele estava.
   Combo do projeto é <button>, então também fica de fora — e bem: um botão
   focado engole o Espaço e o Enter que pertencem ao tour. */
const CAMPO_DE_TEXTO = [
  "textarea",
  'input:not([type])',
  'input[type="text"]',
  'input[type="search"]',
  'input[type="email"]',
  'input[type="tel"]',
  'input[type="url"]',
  'input[type="password"]',
  'input[type="number"]',
]
  .map((s) => `${s}:not([disabled]):not([readonly])`)
  .join(", ");

function semMovimento() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function prender(valor, min, max) {
  return Math.min(max, Math.max(min, valor));
}

/**
 * @param {Array} fluxo         etapas vindas de utils/tourFluxo.js
 * @param {Function} aoRegistrar (chave, status, passoParou, totalPassos)
 * @param {Function} aoTerminar  (motivo: "concluiu" | "pulou")
 */
export function TourGuiado({ fluxo, aoRegistrar, aoTerminar }) {
  const navegar = useNavigate();
  const local = useLocation();

  const [pos, setPos] = useState({ etapa: 0, passo: 0 });
  const [retangulo, setRetangulo] = useState(null); // caixa do alvo, em viewport
  const [caixa, setCaixa] = useState(null);         // posição do cartão + seta
  const [trocando, setTrocando] = useState(false);
  // Passo que exige ação: "Próximo" fica trancado até a pessoa fazer o que foi
  // pedido. Começa liberado; o efeito de espera tranca quando for o caso.
  const [liberado, setLiberado] = useState(true);

  const cartaoRef = useRef(null);
  const rafRef = useRef(0);
  const etapasVistasRef = useRef(new Set());
  const encerradoRef = useRef(false);
  // Espelho do índice para os handlers lerem sem virar dependência (e sem
  // precisar de updater de estado, que precisa ser puro).
  const posRef = useRef(pos);
  posRef.current = pos;

  const etapa = fluxo[pos.etapa] || null;
  const passo = etapa?.passos?.[pos.passo] || null;
  const totalPassos = etapa?.passos?.length || 0;
  const ultimaEtapa = pos.etapa >= fluxo.length - 1;
  const ultimoPasso = pos.passo >= totalPassos - 1;

  /* ── Registro de progresso ──────────────────────────────────────────────── */

  // Uma etapa só é anunciada como "em andamento" na primeira vez que abre; sem
  // isto, voltar um passo reescreveria a linha a cada movimento.
  useEffect(() => {
    if (!etapa || encerradoRef.current) return;
    if (etapasVistasRef.current.has(etapa.chave)) return;
    etapasVistasRef.current.add(etapa.chave);
    aoRegistrar?.(etapa.chave, "EM_ANDAMENTO", pos.passo + 1, totalPassos);
  }, [etapa, pos.passo, totalPassos, aoRegistrar]);

  /* ── Trava de rolagem ───────────────────────────────────────────────────── */

  /* Trava a roda e o toque, e NÃO `overflow: hidden` no body: é justamente a
     rolagem do body que o `scrollIntoView` de cada passo usa para trazer o alvo
     ao centro. Com overflow travado, o tour apontaria para fora da tela.

     Em passo interativo a trava sai: quem está preenchendo um formulário longo
     precisa rolar para enxergar o que digita, e um campo que o teclado empurra
     para fora da tela sem deixar rolar é uma armadilha. */
  const interativo = Boolean(passo?.interativo);
  useEffect(() => {
    if (interativo) return undefined;
    const bloquear = (e) => e.preventDefault();
    document.addEventListener("wheel", bloquear, { passive: false });
    document.addEventListener("touchmove", bloquear, { passive: false });
    return () => {
      document.removeEventListener("wheel", bloquear);
      document.removeEventListener("touchmove", bloquear);
    };
  }, [interativo]);

  /* ── Navegação de rota entre etapas ─────────────────────────────────────── */

  /* UMA navegação por etapa, e ela leva ao endereço COMPLETO.

     As duas coisas nasceram do mesmo defeito. A etapa de Relatórios apontava
     para `/leads`, que hoje é um redirecionamento para `/relatorios`: o efeito
     navegava, o roteador desviava, o efeito via `pathname !== "/leads"` e
     navegava de novo — ping-pong sem fim, com o tour parado porque a busca do
     alvo abaixo só começa quando a rota bate. O alvo daquela etapa foi
     corrigido, mas a armadilha continuaria armada para a próxima rota que
     ganhasse um desvio.

     A comparação usa caminho + parâmetros porque telas de índice guardam a
     seção aberta em `?ver=`: quem estivesse em `/configuracoes?ver=plano`
     casava com a rota `/configuracoes` e o tour falava dos cartões apontando
     para um formulário.

     O ref guarda a etapa já levada ao destino. Ele não impede a pessoa de sair
     — impede o tour de brigar com o roteador, que é outra coisa. */
  const rotaLevadaRef = useRef(null);
  useEffect(() => {
    if (!etapa?.rota) return;
    if (rotaLevadaRef.current === etapa.chave) return;
    rotaLevadaRef.current = etapa.chave;
    if (`${local.pathname}${local.search}` === etapa.rota) return;
    navegar(etapa.rota);
  }, [etapa, local.pathname, local.search, navegar]);

  /* ── Localizar o alvo do passo ──────────────────────────────────────────── */

  useEffect(() => {
    if (!passo) return undefined;
    /* Etapa com rota própria só procura o alvo depois de chegar lá; procurar
       antes acharia um elemento de mesmo nome na tela anterior.

       Compara só o CAMINHO: a navegação acima já levou ao endereço completo, e
       exigir os parâmetros aqui deixaria o passo cego se a própria tela mexesse
       na barra depois (o retorno do OAuth em Configurações faz exatamente
       isso). */
    if (etapa?.rota && local.pathname !== etapa.rota.split("?")[0]) return undefined;

    let vivo = true;
    let timer = 0;
    const comecou = Date.now();
    setRetangulo(null);

    const procurar = () => {
      if (!vivo) return;

      /* `pularSe`: o passo já não faz sentido, pula NA HORA.

         Sem isto, um passo cujo alvo não existe só é abandonado depois de 3,5s
         de espera — e o preço é cumulativo. Quem entra em /imoveis/novo e clica
         em "Novo Imóvel" antes de o tour abrir deixa para trás o passo do menu;
         quem já preencheu meia tela deixa vários. O tour passa quase meio minuto
         procurando elementos que sumiram e reaparece lá no fim, apontando o
         botão de cadastrar, com cara de perdido — que é exatamente o que ele
         está. Com `pularSe` ele reconhece o que já passou e recomeça de onde a
         pessoa realmente está. */
      if (passo.pularSe && document.querySelector(passo.pularSe)) {
        avancar();
        return;
      }

      const el = passo.alvo ? document.querySelector(passo.alvo) : null;

      // Passo sem alvo: sem holofote, cartão no centro. Quem centraliza é o
      // efeito de posicionamento, que já trata `retangulo` nulo — mexer no
      // `caixa` aqui produziria um cartão visível sem coordenada.
      if (!passo.alvo) { setRetangulo(null); return; }

      if (el && el.getBoundingClientRect().width > 0) {
        // A rolagem está travada para o usuário, não para nós.
        el.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" });

        /* Espera a caixa PARAR de mudar antes de desenhar o holofote.

           As telas do painel entram animadas (`step-pane`, `omnimob-reveal`,
           `chicEntrance`), e medir no meio da animação devolve a posição de
           onde o elemento estava passando — um anel de 1px de altura, ou um
           retângulo no lugar errado. O laço de acompanhamento até corrige
           depois, mas o primeiro quadro já saiu torto, e é justamente o que a
           pessoa vê ao trocar de passo.

           Duas medições iguais seguidas bastam; o teto evita ficar esperando
           por algo que nunca assenta (um carrossel, um brilho em laço). */
        let anterior = null;
        let tentativas = 0;
        const assentar = () => {
          if (!vivo) return;
          const r = el.getBoundingClientRect();
          const agora = `${r.left}|${r.top}|${r.right}|${r.bottom}`;
          const estavel = agora === anterior;
          anterior = agora;
          tentativas += 1;

          /* Estável não basta — pode estar estavelmente errado:

             - Caixa de 1px. O invólucro do campo colapsa enquanto o combo lá
               dentro não tem layout; ele fica assim por vários quadros, então
               "duas medições iguais" aprovaria um anel de um pixel.
             - Fora da tela. O `scrollIntoView` acontece antes de a página
               terminar de crescer (um campo que aparece empurra o resto), e o
               alvo acaba abaixo da dobra. Rolamos de novo e seguimos medindo. */
          const temTamanho = r.width >= 8 && r.height >= 8;
          const naTela = r.top >= 0 && r.bottom <= window.innerHeight;
          if (!naTela && tentativas % 8 === 0) {
            el.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" });
          }

          if ((estavel && temTamanho && naTela) || tentativas > 40) {
            setRetangulo({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, el });
            return;
          }
          requestAnimationFrame(assentar);
        };
        requestAnimationFrame(assentar);
        return;
      }

      /* Alvo que não apareceu não trava o tour: a tela pode estar vazia, o item
         pode estar escondido por permissão ou a lista ainda carregando.

         `esperaAlvoMs` encurta essa desistência para passos OPCIONAIS, cujo
         alvo só existe em algumas configurações. Ali a ausência é o caso comum,
         não um atraso de carregamento — segurar 3,5s deixaria o tour parado
         olhando para o nada antes de seguir. */
      if (Date.now() - comecou > (passo.esperaAlvoMs ?? ESPERA_ALVO_MS)) {
        avancar();
        return;
      }
      timer = setTimeout(procurar, 120);
    };

    procurar();
    return () => { vivo = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.etapa, pos.passo, local.pathname]);

  /* ── Passos que esperam uma ação ────────────────────────────────────────── */

  /* Um tour de mão na massa não pode ser um slideshow: se "Próximo" continua
     clicável enquanto o campo está vazio, todo mundo atravessa lendo e não sai
     com o cadastro feito. `aguardar` tranca o botão até a ação acontecer.

       "preencher" — o alvo (input/textarea/combo) precisa ter valor
       "clique"    — o alvo precisa ser clicado; segue sozinho depois, porque o
                     clique já mudou a tela e ficar parado confunde
       "existir"   — `aguardarAlvo` precisa APARECER no DOM. É como se espera
                     uma transição de etapa: o que importa é ter chegado, não
                     ter clicado (o formulário pode recusar o avanço)
       "sumir"     — `aguardarAlvo` precisa DESAPARECER. Serve para o inverso:
                     a área de "arraste uma foto" some quando existe foto, e é
                     essa a forma honesta de perguntar "já tem foto?"

     A CONDIÇÃO É REAVALIADA O TEMPO TODO, nos dois sentidos. Antes isto só
     destravava, e destravado ficava: quem digitasse dez letras na descrição e
     apagasse tudo seguia com o botão liberado, e o tour dava por ensinado algo
     que não aconteceu. A trava tem que acompanhar o estado real da tela.
     Exceção deliberada: "clique" é um acontecimento, não um estado — depois de
     clicado não há como "desclicar". */
  useEffect(() => {
    const espera = passo?.aguardar;
    if (!espera) { setLiberado(true); return undefined; }

    setLiberado(false);
    let vivo = true;
    let observador = null;
    let alvoAtual = null;
    let ouvindo = [];
    let jaSeguiu = false;      // auto-avanço dispara uma vez só
    let ultimo = null;         // evita setState a cada mutação do DOM
    let nasceuPronto = null;   // a condição já valia quando o passo abriu?

    // Traduz o estado atual da tela em "pode seguir?".
    const avaliar = () => {
      if (espera === "existir") {
        return Boolean(passo.aguardarAlvo && document.querySelector(passo.aguardarAlvo));
      }
      if (espera === "sumir") {
        return Boolean(passo.aguardarAlvo && !document.querySelector(passo.aguardarAlvo));
      }

      const el = passo.alvo ? document.querySelector(passo.alvo) : null;
      if (!el) return false;

      if (espera === "preencher") {
        /* O alvo costuma ser o invólucro do campo (rótulo + controle), não o
           controle em si — o holofote precisa dos dois. Então procuramos o
           input lá dentro.

           Quando não há input nenhum, é um SelectCustom: no projeto o combo é
           um <button> cujo texto é a opção escolhida, ou o placeholder quando
           ninguém escolheu. Daí `vazioQuando` — o texto que significa "ainda
           não". Sem ele, o placeholder contaria como preenchido. */
        const proprio = el.matches?.("input, textarea, select");

        /* `todosCampos`: o alvo abriga MAIS DE UM controle e todos contam.
           Bairro e cidade moram na mesma grade de duas colunas, e um holofote
           só cobre as duas; sem isto, preencher o bairro liberaria o passo com
           a cidade em branco — e o formulário recusaria adiante, cobrando um
           campo que o tour deu por resolvido. */
        if (passo.todosCampos && !proprio) {
          const campos = [...el.querySelectorAll("input, textarea, select")];
          if (!campos.length) return false;
          return campos.every((c) => String(c.value || "").trim().length >= (passo.minimo || 1));
        }

        const campo = proprio ? el : el.querySelector("input, textarea, select");
        const bruto = campo ? String(campo.value || "") : (el.textContent || "");
        const limpo = bruto.trim();
        // `minimo` existe para campos onde uma letra solta não é resposta: uma
        // descrição de imóvel com "a" passaria numa checagem de "não vazio" e
        // deixaria a pessoa seguir sem ter escrito nada de útil.
        if (!limpo) return false;
        if (limpo.length < (passo.minimo || 1)) return false;
        if (passo.vazioQuando && limpo.includes(passo.vazioQuando)) return false;
        return true;
      }

      return false; // "clique" resolve pelo ouvinte, não por avaliação
    };

    const conferir = () => {
      if (!vivo) return;

      if (espera === "clique") {
        const el = passo.alvo ? document.querySelector(passo.alvo) : null;
        if (el && el !== alvoAtual) {
          alvoAtual = el;
          const aoClicar = () => {
            if (!vivo || jaSeguiu) return;
            jaSeguiu = true;
            setLiberado(true);
            setTimeout(() => { if (vivo) avancar(); }, 420);
          };
          el.addEventListener("click", aoClicar, { once: true });
          ouvindo.push([el, aoClicar]);
        }
        return;
      }

      const pode = avaliar();
      if (nasceuPronto === null) nasceuPronto = pode;
      if (pode !== ultimo) {
        ultimo = pode;
        setLiberado(pode);
      }

      /* `avancarSozinho` é PRÊMIO POR FAZER, não motivo para pular.

         Só dispara quando a condição VIRA verdadeira durante o passo. Se ela já
         valia na chegada, o passo fica aberto e liberado, esperando a leitura.
         Sem essa distinção, todo campo com valor padrão passava voando: a
         finalidade do imóvel nasce "Residencial", então o passo que explica a
         diferença entre residencial e comercial piscava e sumia antes de
         qualquer um conseguir ler. */
      if (pode && !nasceuPronto && passo.avancarSozinho && !jaSeguiu) {
        jaSeguiu = true;
        setTimeout(() => { if (vivo) avancar(); }, 520);
      }
    };

    if (espera === "preencher") {
      // Ouvir no invólucro pega os eventos do input por borbulhamento, sem
      // precisar achar o controle antes de ele existir.
      const el = passo.alvo ? document.querySelector(passo.alvo) : null;
      if (el) {
        ["input", "change", "blur"].forEach((ev) => {
          el.addEventListener(ev, conferir, true);
          ouvindo.push([el, conferir, ev, true]);
        });
      }
    }

    // O DOM muda por fora dos eventos que ouvimos (React repinta o combo, a
    // lista de fotos cresce), então um observador cobre o que escapar.
    observador = new MutationObserver(conferir);
    observador.observe(document.body, { childList: true, subtree: true, attributes: true });
    conferir();

    return () => {
      vivo = false;
      observador?.disconnect();
      ouvindo.forEach(([el, fn, ev, captura]) => el.removeEventListener(ev || "click", fn, captura));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.etapa, pos.passo]);

  /* ── Acompanhar o alvo enquanto ele se mexe ─────────────────────────────── */

  // Cartões que crescem no hover, listas que terminam de carregar, painéis que
  // abrem: sem este laço o holofote fica onde o elemento estava, não onde ele
  // está. Só re-renderiza quando a caixa muda de verdade.
  useEffect(() => {
    const el = retangulo?.el;
    if (!el) return undefined;
    let anterior = "";
    const laco = () => {
      const r = el.getBoundingClientRect();

      /* Ignora medição de elemento que está saindo de cena. Ao trocar de etapa
         do assistente, o React desmonta o painel inteiro: por alguns quadros o
         alvo antigo ainda está nesta closure, já solto da árvore, e devolve uma
         caixa degenerada. Aceitá-la colapsaria o holofote num ponto de 12px no
         canto da tela — o "anel que não ancora em lugar nenhum". Segurar a
         última posição boa é melhor: o passo seguinte remede tudo em seguida. */
      if (!el.isConnected || r.width < 8 || r.height < 8) {
        rafRef.current = requestAnimationFrame(laco);
        return;
      }

      const chave = `${r.left}|${r.top}|${r.right}|${r.bottom}`;
      if (chave !== anterior) {
        anterior = chave;
        setRetangulo((v) => (v?.el === el
          ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom, el }
          : v));
      }
      rafRef.current = requestAnimationFrame(laco);
    };
    rafRef.current = requestAnimationFrame(laco);
    return () => cancelAnimationFrame(rafRef.current);
  }, [retangulo?.el]);

  /* ── Cursor no campo, sem pedir clique ──────────────────────────────────── */

  /* O tour manda "escreva o título aqui", abre o furo na lâmina exatamente em
     cima do campo — e ainda assim exigia um clique para começar a digitar. O
     clique não ensinava nada: era só o pedágio entre ler e fazer.

     Três recusas, todas para não roubar o cursor de quem já o tem:

     - Só em passo INTERATIVO. Fora dele a lâmina bloqueia a tela inteira, e um
       campo focado atrás dela receberia o que fosse digitado sem que nada
       piscasse — o pior dos dois mundos.
     - Só se o foco ainda não estiver dentro do alvo, senão trocar de passo
       jogaria o cursor de volta ao começo do texto no meio de uma frase.
     - Uma vez por passo (`focadoRef`), porque o alvo é remedido a cada quadro:
       sem a trava, o campo seria refocado continuamente e a pessoa não
       conseguiria clicar em outro lugar dentro do próprio furo.

     Entre vários campos (bairro e cidade dividem um holofote só), vai para o
     primeiro AINDA VAZIO — que é onde a pessoa tem trabalho a fazer. */
  const focadoRef = useRef(null);
  useEffect(() => {
    const el = retangulo?.el;
    if (!el || !interativo || passo?.focarCampo === false) return;
    const marca = `${pos.etapa}:${pos.passo}`;
    if (focadoRef.current === marca) return;
    if (el.contains(document.activeElement)) { focadoRef.current = marca; return; }

    const campos = el.matches?.(CAMPO_DE_TEXTO) ? [el] : [...el.querySelectorAll(CAMPO_DE_TEXTO)];
    if (!campos.length) return;

    focadoRef.current = marca;
    const campo = campos.find((c) => !String(c.value || "").trim()) || campos[0];
    // `preventScroll` porque quem decide o enquadramento é o `scrollIntoView` do
    // passo; deixar o foco rolar de novo brigaria com ele e sacudiria a tela.
    campo.focus({ preventScroll: true });
    // Cursor no fim do que já existe, em vez de antes da primeira letra.
    try { campo.setSelectionRange(campo.value.length, campo.value.length); } catch { /* number não aceita */ }
  }, [retangulo?.el, interativo, pos.etapa, pos.passo, passo?.focarCampo]);

  /* ── Posicionar o cartão ────────────────────────────────────────────────── */

  useLayoutEffect(() => {
    const el = cartaoRef.current;
    if (!el) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cw = el.offsetWidth || 330;
    const ch = el.offsetHeight || 200;
    const vao = 16;

    if (!retangulo) {
      setCaixa({ top: (vh - ch) / 2, left: (vw - cw) / 2, seta: "none" });
      return;
    }

    const r = retangulo;
    const ordem = passo?.lado
      ? (Array.isArray(passo.lado) ? passo.lado : [passo.lado])
      : ORDEM_PADRAO;
    const tentativas = [...ordem, "centro"];

    for (const lado of tentativas) {
      if (lado === "bottom" && r.bottom + vao + ch + 8 <= vh) {
        setCaixa({
          top: r.bottom + vao,
          left: prender(r.left + (r.right - r.left) / 2 - cw / 2, 8, vw - cw - 8),
          seta: "top",
        });
        return;
      }
      if (lado === "top" && r.top - vao - ch >= 8) {
        setCaixa({
          top: r.top - vao - ch,
          left: prender(r.left + (r.right - r.left) / 2 - cw / 2, 8, vw - cw - 8),
          seta: "bottom",
        });
        return;
      }
      if (lado === "right" && r.right + vao + cw + 8 <= vw) {
        setCaixa({
          top: prender(r.top + (r.bottom - r.top) / 2 - ch / 2, 8, vh - ch - 8),
          left: r.right + vao,
          seta: "left",
        });
        return;
      }
      if (lado === "left" && r.left - vao - cw >= 8) {
        setCaixa({
          top: prender(r.top + (r.bottom - r.top) / 2 - ch / 2, 8, vh - ch - 8),
          left: r.left - vao - cw,
          seta: "right",
        });
        return;
      }
      if (lado === "centro") {
        // Nada coube ao redor: encosta num canto livre em vez de cobrir o alvo.
        const embaixo = r.bottom < vh / 2;
        setCaixa({
          top: embaixo ? vh - ch - 20 : 20,
          left: prender(vw - cw - 24, 8, vw - cw - 8),
          seta: "none",
        });
        return;
      }
    }
  }, [retangulo, pos.etapa, pos.passo, passo?.lado]);

  useEffect(() => {
    const aoRedimensionar = () => setRetangulo((v) => (v ? { ...v } : v));
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, []);

  /* ── Navegação entre passos ─────────────────────────────────────────────── */

  const encerrar = useCallback((motivo) => {
    if (encerradoRef.current) return;
    encerradoRef.current = true;
    aoTerminar?.(motivo, { chave: etapa?.chave, passo: pos.passo + 1, total: totalPassos });
  }, [aoTerminar, etapa, pos.passo, totalPassos]);

  /* Decide o próximo passo FORA do `setPos`. Um updater de estado tem que ser
     função pura: o StrictMode do React o executa duas vezes em dev, e gravar
     progresso lá dentro mandaria cada etapa concluída para a API em duplicata.
     Daí o espelho em ref — o mesmo padrão do `formRef` do editor de vitrine. */
  const avancar = useCallback(() => {
    if (encerradoRef.current) return;
    const atual = posRef.current;
    const et = fluxo[atual.etapa];
    if (!et) return;

    if (atual.passo < et.passos.length - 1) {
      setPos({ etapa: atual.etapa, passo: atual.passo + 1 });
    } else {
      aoRegistrar?.(et.chave, "FINALIZADO", et.passos.length, et.passos.length);
      if (atual.etapa < fluxo.length - 1) {
        setPos({ etapa: atual.etapa + 1, passo: 0 });
      } else {
        encerradoRef.current = true;
        aoTerminar?.("concluiu");
        return;
      }
    }

    if (!semMovimento()) {
      setTrocando(true);
      setTimeout(() => setTrocando(false), 220);
    }
  }, [fluxo, aoRegistrar, aoTerminar]);

  const voltar = useCallback(() => {
    setPos((atual) => {
      if (atual.passo > 0) return { etapa: atual.etapa, passo: atual.passo - 1 };
      if (atual.etapa > 0) {
        const anterior = fluxo[atual.etapa - 1];
        return { etapa: atual.etapa - 1, passo: Math.max(0, anterior.passos.length - 1) };
      }
      return atual;
    });
  }, [fluxo]);

  /* ── Teclado ────────────────────────────────────────────────────────────── */

  useEffect(() => {
    function aoTeclar(e) {
      if (e.key === "Escape") { e.preventDefault(); encerrar("pulou"); return; }

      /* TAB NÃO ATRAVESSA A LÂMINA.

         A lâmina barra o mouse, mas o Tab é outra porta: ele leva o foco para
         qualquer campo do aplicativo por baixo dela. Dava para tabular até um
         input escurecido, longe do holofote, e digitar lá — o tour explicando
         um campo e a pessoa preenchendo outro.

         O foco fica preso a duas regiões: o cartão do tour (sempre) e, em passo
         interativo, o alvo destacado (para tabular entre bairro e cidade, por
         exemplo). Fora disso o Tab circula de volta ao começo da lista. */
      if (e.key === "Tab") {
        const permitidos = [];
        const focavel = "a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])";
        if (interativo && retangulo?.el?.isConnected) {
          if (retangulo.el.matches?.(focavel)) permitidos.push(retangulo.el);
          permitidos.push(...retangulo.el.querySelectorAll(focavel));
        }
        if (cartaoRef.current) permitidos.push(...cartaoRef.current.querySelectorAll(focavel));
        if (!permitidos.length) { e.preventDefault(); return; }

        e.preventDefault();
        const atual = permitidos.indexOf(document.activeElement);
        const passoTab = e.shiftKey ? -1 : 1;
        // -1 (foco fora da lista) entra pelo primeiro item indo para frente.
        const proximo = atual === -1
          ? (e.shiftKey ? permitidos.length - 1 : 0)
          : (atual + passoTab + permitidos.length) % permitidos.length;
        permitidos[proximo]?.focus();
        return;
      }
      const noCartao = Boolean(e.target.closest?.(".tg-cartao"));

      /* ENTER NUNCA CHEGA AO FORMULÁRIO ENQUANTO O TOUR RODA.

         Num <input> dentro de <form>, Enter dispara o submit implícito do HTML.
         Durante o tour isso é desastre: no cadastro de cliente, um Enter depois
         do CPF salvava o cliente, a tela voltava para a listagem e o tour ficava
         apontando campos que não existiam mais.

         E o Enter tem significado óbvio aqui — "próximo" —, que é o que a pessoa
         espera. Então ele avança o tour, respeitando a mesma trava do botão: um
         passo que exige ação não pode ter porta dos fundos pelo teclado.

         Única exceção: <textarea>, onde Enter é quebra de linha e não comando. */
      if (e.key === "Enter") {
        if (!noCartao && e.target.tagName === "TEXTAREA") return;
        e.preventDefault();
        if (liberado) avancar();
        return;
      }

      // Setas pertencem ao campo enquanto se digita; fora daí, navegam o tour.
      if (interativo && !noCartao) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (liberado) avancar();
        return;
      }
      if (e.key === "ArrowLeft") { e.preventDefault(); voltar(); return; }
      // Espaço num elemento focado do fundo dispararia um clique por baixo do
      // holofote — a tecla só vale dentro do cartão.
      if ((e.key === " " || e.key === "Spacebar") && !e.target.closest?.(".tg-cartao")) {
        e.preventDefault();
      }
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [avancar, voltar, encerrar, liberado, interativo, retangulo?.el]);

  if (!etapa || !passo) return null;

  /* ── Geometria dos painéis ──────────────────────────────────────────────── */

  const respiro = passo.respiro ?? RESPIRO_PADRAO;
  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;

  const x1 = retangulo ? Math.max(0, retangulo.left - respiro) : 0;
  const y1 = retangulo ? Math.max(0, retangulo.top - respiro) : 0;
  const x2 = retangulo ? Math.min(vw, retangulo.right + respiro) : vw;
  const y2 = retangulo ? Math.min(vh, retangulo.bottom + respiro) : vh;

  // Os painéis agora são só pintura — quem engole os eventos é a lâmina
  // transparente logo abaixo, que cobre a tela inteira (o buraco inclusive).
  const painel = {
    position: "fixed", background: "rgba(4,6,12,0.66)", zIndex: 99990,
    pointerEvents: "none",
  };
  const paineis = retangulo
    ? [
        { ...painel, top: 0, left: 0, width: vw, height: y1 },
        { ...painel, top: y2, left: 0, width: vw, height: Math.max(0, vh - y2) },
        { ...painel, top: y1, left: 0, width: x1, height: y2 - y1 },
        { ...painel, top: y1, left: x2, width: Math.max(0, vw - x2), height: y2 - y1 },
      ]
    : [{ ...painel, top: 0, left: 0, width: vw, height: vh }];

  const rotuloProximo = ultimoPasso
    ? (ultimaEtapa ? "Finalizar ✓" : "Próxima página →")
    : "Próximo →";

  const passoGlobal = fluxo.slice(0, pos.etapa).reduce((n, e) => n + e.passos.length, 0) + pos.passo + 1;
  const totalGlobal = fluxo.reduce((n, e) => n + e.passos.length, 0);

  return createPortal(
    <>
      <style>{CSS}</style>

      {paineis.map((estilo, i) => (
        <div key={i} style={estilo} className="tg-painel" aria-hidden="true" />
      ))}

      {retangulo ? (
        <div
          className={`tg-anel${interativo ? " is-interativo" : ""}`}
          style={{ top: y1, left: x1, width: x2 - x1, height: y2 - y1 }}
          aria-hidden="true"
        />
      ) : null}

      {/* Lâmina de bloqueio. Enquanto o tour roda, nada do aplicativo recebe
          clique — o holofote ensina onde fica a coisa, não pede para usá-la.
          Sem isso, bastava alguém acertar o item de menu em destaque para o
          tour ser levado a outra rota no meio do roteiro.

          EXCEÇÃO: passo interativo. Aí a lâmina vira as MESMAS quatro faixas do
          holofote, só que transparentes — bloqueia tudo à volta e deixa passar
          exatamente o alvo. É o que permite o tour pedir "digite o título aqui"
          e a pessoa conseguir digitar, sem que ela possa sair clicando no resto
          da tela e se perder.

          `preventDefault` no pointerdown para o clique não mover o foco para
          trás da lâmina, de onde um Enter escaparia. Tudo ABAIXO do cartão. */}
      {(interativo && retangulo ? paineis : [{ position: "fixed", inset: 0 }]).map((geo, i) => (
        <div
          key={`lam-${i}`}
          className="tg-lamina"
          aria-hidden="true"
          style={{
            position: "fixed",
            top: geo.top ?? 0, left: geo.left ?? 0,
            width: geo.width ?? "100%", height: geo.height ?? "100%",
          }}
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
        />
      ))}

      <div
        ref={cartaoRef}
        className={`tg-cartao${trocando ? " is-trocando" : ""}`}
        data-seta={caixa?.seta || "none"}
        style={{
          top: caixa?.top ?? -9999,
          left: caixa?.left ?? -9999,
          visibility: caixa ? "visible" : "hidden",
        }}
        role="dialog"
        aria-live="polite"
        aria-label={`Tutorial: ${passo.titulo}`}
      >
        <div className="tg-topo">
          <span className="tg-selo" aria-hidden="true">
            <img src={SELO_SRC} alt="" />
          </span>
          <p className="tg-titulo">{passo.titulo}</p>
          <span className="tg-contador">{passoGlobal}/{totalGlobal}</span>
          {/* SVG e não o caractere "×": o glifo da multiplicação senta acima da
              linha de base e nenhuma centralização de caixa conserta isso — o
              que a grade centraliza é a caixa da fonte, não a tinta. Duas linhas
              desenhadas no meio do viewBox ficam onde deveriam. */}
          <button type="button" className="tg-fechar" onClick={() => encerrar("pulou")} aria-label="Encerrar tutorial">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" />
            </svg>
          </button>
        </div>

        <span className="tg-etapa">{etapa.titulo}</span>

        {/* O texto dos passos é constante do próprio código (tourFluxo.js), não
            conteúdo de usuário — o HTML aqui é o nosso, escrito à mão. */}
        <div className="tg-corpo" dangerouslySetInnerHTML={{ __html: passo.texto }} />

        <div className="tg-barra" aria-hidden="true">
          <span className="tg-barra__cheio" style={{ width: `${(passoGlobal / totalGlobal) * 100}%` }} />
        </div>

        <div className="tg-rodape">
          <button type="button" className="tg-pular" onClick={() => encerrar("pulou")}>
            Pular tour
          </button>
          <div className="tg-botoes">
            <button
              type="button"
              className="tg-voltar"
              onClick={voltar}
              disabled={pos.etapa === 0 && pos.passo === 0}
            >
              ← Voltar
            </button>
            <button
              type="button"
              className={`tg-proximo${liberado ? "" : " is-esperando"}`}
              onClick={() => avancar()}
              disabled={!liberado}
            >
              {liberado ? rotuloProximo : (passo.rotuloEspera || "Faça isso para seguir")}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

/* ── Estilos ─────────────────────────────────────────────────────────────────
   Paleta ROXO + DOURADO, a da marca. O índigo #6366f1/#818cf8 que estava aqui
   é o acento do painel, mas sozinho e em bloco ele lê como azul — e o tour é
   justamente a peça em que a Omnimob se apresenta. O violeta puxa para o roxo do
   símbolo e o dourado #d4af37 volta nos detalhes que a landing já usa assim:
   micro-label em mono, halo do holofote, fim da barra de progresso.

   Sem custom properties de propósito: estes nós são portados para o <body>,
   fora de qualquer raiz do kit, então declará-las aqui ou vazaria para o
   documento inteiro ou não seria herdada por ninguém.
   ────────────────────────────────────────────────────────────────────────── */

const CSS = `
.tg-painel { animation: tgVeu 260ms ease both; }
@keyframes tgVeu { from { opacity: 0; } to { opacity: 1; } }

/* Entre o anel (99992) e o cartão (99995): cobre tudo, aparece nada. O cursor
   de seta em cima do que está bloqueado evita a mãozinha que promete um clique
   que não vai acontecer. */
.tg-lamina { z-index: 99993; background: transparent; cursor: default; }

/* Anel pulsante em volta do alvo. Fica FORA dos painéis (sem eventos) para não
   roubar o clique do elemento que ele está destacando. O traço é roxo e o halo
   é dourado: os dois juntos separam o holofote de qualquer azul da interface
   por baixo — inclusive do item ativo da sidebar, que é índigo. */
.tg-anel {
  position: fixed; z-index: 99992; pointer-events: none; border-radius: 12px;
  box-shadow: 0 0 0 2px #a78bfa, 0 0 0 6px rgba(212,175,55,0.24);
  transition: top 240ms cubic-bezier(0.25,1,0.5,1), left 240ms cubic-bezier(0.25,1,0.5,1),
              width 240ms cubic-bezier(0.25,1,0.5,1), height 240ms cubic-bezier(0.25,1,0.5,1);
  animation: tgAnel 1.8s ease-in-out infinite;
}
@keyframes tgAnel {
  0%, 100% { box-shadow: 0 0 0 2px #a78bfa, 0 0 0 6px rgba(212,175,55,0.24); }
  50%      { box-shadow: 0 0 0 2px #a78bfa, 0 0 0 12px rgba(212,175,55,0.07); }
}

.tg-cartao {
  position: fixed; z-index: 99995; width: 336px; max-width: calc(100vw - 32px);
  padding: 16px 16px 14px; border-radius: 16px;
  /* O mesmo preto da landing (--bg) e a mesma hairline (--line). Opaco de
     propósito: com o fundo cheio, um backdrop-filter só cobraria GPU para
     desfocar algo que ninguém vê. */
  background: #0a0a0b;
  border: 1px solid #232326;
  box-shadow: 0 28px 64px -20px rgba(0,0,0,0.92), inset 0 1px 0 rgba(212,175,55,0.14);
  font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
  color: #e8e8ee;
  transition: top 240ms cubic-bezier(0.25,1,0.5,1), left 240ms cubic-bezier(0.25,1,0.5,1);
  animation: tgCartao 260ms cubic-bezier(0.34,1.56,0.64,1) both;
}
@keyframes tgCartao {
  from { opacity: 0; transform: scale(0.94) translateY(8px); }
  to   { opacity: 1; transform: none; }
}
.tg-cartao.is-trocando .tg-corpo, .tg-cartao.is-trocando .tg-titulo {
  animation: tgTroca 220ms ease both;
}
@keyframes tgTroca {
  0%   { opacity: 0; transform: translateY(5px); }
  100% { opacity: 1; transform: none; }
}

/* Bico apontando para o alvo. Herda fundo e borda do cartão, então acompanha
   qualquer mudança de paleta sem repetir cor. */
.tg-cartao::before {
  content: ""; position: absolute; width: 11px; height: 11px;
  background: inherit; border: inherit; border-right: none; border-bottom: none;
  border-radius: 3px 0 0 0;
}
.tg-cartao[data-seta="top"]::before    { top: -6px; left: 50%; transform: translateX(-50%) rotate(45deg); }
.tg-cartao[data-seta="bottom"]::before { bottom: -6px; left: 50%; transform: translateX(-50%) rotate(225deg); }
.tg-cartao[data-seta="left"]::before   { left: -6px; top: 26px; transform: rotate(-45deg); }
.tg-cartao[data-seta="right"]::before  { right: -6px; top: 26px; transform: rotate(135deg); }
.tg-cartao[data-seta="none"]::before   { display: none; }

.tg-topo { display: flex; align-items: flex-start; gap: 9px; margin-bottom: 4px; }
/* Sem ladrilho: o símbolo é dourado e vazado, e sobre o preto da landing ele se
   sustenta sozinho — a moldura só competia com ele. */
.tg-selo {
  width: 24px; height: 26px; flex-shrink: 0;
  display: grid; place-items: center;
}
.tg-selo img { width: 100%; height: 100%; object-fit: contain; display: block; }
.tg-titulo { margin: 3px 0 0; font-size: 14.5px; font-weight: 700; letter-spacing: -0.015em; color: #ffffff; flex: 1; }
.tg-contador {
  flex-shrink: 0; margin-top: 5px;
  font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 10px;
  color: #c4b5fd; background: rgba(139,92,246,0.18);
  border-radius: 999px; padding: 2px 7px;
}
.tg-cartao .tg-fechar {
  flex-shrink: 0; width: 22px; height: 22px; padding: 0; margin-top: 3px;
  display: inline-flex; align-items: center; justify-content: center; line-height: 0;
  border: none; border-radius: 999px; background: rgba(167,139,250,0.16);
  color: #cbc3e0; cursor: pointer;
  box-shadow: none; transform: none;
  transition: background 0.15s ease, color 0.15s ease;
}
.tg-cartao .tg-fechar svg { display: block; }
.tg-cartao .tg-fechar:hover { background: rgba(212,175,55,0.26); color: #f8fafc; box-shadow: none; transform: none; }

.tg-etapa {
  display: block; margin: 2px 0 8px 33px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 8.5px; letter-spacing: 0.16em; text-transform: uppercase; color: #d4af37;
}
/* Os mesmos --subtle / --default da landing. */
.tg-corpo { font-size: 12.8px; line-height: 1.65; color: #b6b6c2; margin-bottom: 12px; }
.tg-corpo strong { color: #e8e8ee; font-weight: 600; }
.tg-corpo em { color: #c4b5fd; }

.tg-barra { height: 3px; border-radius: 999px; background: rgba(167,139,250,0.16); overflow: hidden; margin-bottom: 12px; }
.tg-barra__cheio {
  display: block; height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, #8b5cf6, #d4af37);
  transition: width 280ms ease;
}

.tg-rodape { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.tg-botoes { display: flex; align-items: center; gap: 6px; }

.tg-cartao .tg-pular {
  width: auto; padding: 4px 0; border: none; background: none; box-shadow: none; transform: none;
  font-family: inherit; font-size: 11.5px; color: #7c748f; cursor: pointer;
  text-decoration: underline; text-underline-offset: 2px;
}
.tg-cartao .tg-pular:hover { color: #d4af37; background: none; box-shadow: none; transform: none; }

.tg-cartao .tg-voltar {
  width: auto; padding: 7px 12px; border-radius: 9px;
  border: 1px solid rgba(167,139,250,0.22); background: transparent; box-shadow: none; transform: none;
  font-family: inherit; font-size: 12.5px; font-weight: 600; color: #a9a3ba; cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.tg-cartao .tg-voltar:hover:not(:disabled) { background: rgba(139,92,246,0.16); color: #ede9f6; box-shadow: none; transform: none; }
.tg-cartao .tg-voltar:disabled { opacity: 0.35; cursor: default; }

/* Dourado com texto quase preto: sobre #0a0a0b é o maior contraste que a
   paleta tem, e o roxo fica para o holofote — duas peças, dois papéis. */
.tg-cartao .tg-proximo {
  width: auto; padding: 7px 14px; border-radius: 9px; border: none;
  background: #d4af37; color: #17130a; box-shadow: none; transform: none;
  font-family: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer;
  transition: filter 0.15s ease, background 0.15s ease;
}
.tg-cartao .tg-proximo:hover { background: #e5c158; filter: none; box-shadow: none; transform: none; }
.tg-cartao .tg-proximo:active { scale: 0.98; }

/* Esperando a ação: o botão fica apagado e correndo um brilho, para ler como
   "aguardando você" e não como "quebrado". */
.tg-cartao .tg-proximo.is-esperando {
  cursor: default; color: rgba(23,19,10,0.78);
  background: linear-gradient(90deg, #8a6d1f 0%, #d4af37 45%, #f2e2a8 55%, #8a6d1f 100%);
  background-size: 220% 100%;
  /*animation: tgEsperando 1.7s linear infinite;*/
}
.tg-cartao .tg-proximo.is-esperando:hover { filter: none; }
@keyframes tgEsperando {
  from { background-position: 220% center; }
  to   { background-position: -220% center; }
}

/* Passo interativo: o mesmo par roxo+dourado, com o halo pulsando mais largo e
   mais rápido. Já teve verde aqui — dizia "pode mexer", mas em cima de uma
   interface que não tem verde nenhum o que ele dizia mesmo era "outro sistema". */
.tg-anel.is-interativo {
  box-shadow: 0 0 0 2px #c4b5fd, 0 0 0 7px rgba(212,175,55,0.32);
  animation: tgAnelInterativo 1.25s ease-in-out infinite;
}
@keyframes tgAnelInterativo {
  0%, 100% { box-shadow: 0 0 0 2px #c4b5fd, 0 0 0 7px rgba(212,175,55,0.32); }
  50%      { box-shadow: 0 0 0 2px #c4b5fd, 0 0 0 16px rgba(212,175,55,0.05); }
}

@media (prefers-reduced-motion: reduce) {
  .tg-painel, .tg-cartao { animation: none; }
  .tg-anel { animation: none; transition: none; }
  .tg-cartao { transition: none; }
  .tg-cartao.is-trocando .tg-corpo, .tg-cartao.is-trocando .tg-titulo { animation: none; }
}
`;

export default TourGuiado;
