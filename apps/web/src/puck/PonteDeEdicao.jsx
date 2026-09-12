import { useCallback, useEffect, useRef } from "react";
import { registerOverlayPortal, useGetPuck } from "@puckeditor/core";
import { VitrineProvider } from "../components/showcase/contexto.jsx";
import { aplicarEdicaoNoWidget } from "../utils/edicaoDeWidget.js";
import { agruparCom, motivoParaNaoAgrupar } from "./agrupar.js";
import { criarPreviaDeSecao } from "./previaDeSecao.js";
import { anotarIntencao, consumirIntencao, ladoDoPonteiro, limparIntencao } from "./intencaoDeAgrupar.js";
import { moverJunto, ordemDasPecas, removerPeca } from "./agrupar.js";
import {
  alternarNaSelecao,
  definirSelecao,
  idsSelecionados,
  limparSelecao,
  observarSelecao,
  selecionarIntervalo,
} from "./selecaoMultipla.js";

/* ────────────────────────────────────────────────────────────────────────────
   EDIÇÃO NO LUGAR, DENTRO DO PUCK.

   Os textos da vitrine já sabem se editar: cada um declara o próprio endereço
   (`widget|<id>|title`, `highlight|2|description`) e chama `aoEditar` quando
   perde o foco. Era assim que o editor antigo funcionava, e é assim que este
   funciona — o que muda é só para ONDE a alteração vai.

     editor antigo   `aoEditar` escreve no `showcaseConfig`
     editor novo     `aoEditar` despacha para o documento do Puck

   Nenhum widget sabe da diferença, e é esse o ponto: se para entrar no Puck os
   catorze widgets precisassem de uma segunda forma de editar texto, a conta da
   migração seria outra — e as duas formas divergiriam, como já divergiram o
   cartão de imóvel, o bloco de números e o CTA quando havia duas de tudo.

   ── POR QUE UM COMPONENTE SÓ PARA ISSO ──

   `useGetPuck` só existe dentro do editor. A vitrine pública renderiza pelo
   `<Render>`, onde não há loja nenhuma para ler — e hook não pode ser
   condicional. Então o ramo é de COMPONENTE: a raiz monta este aqui quando está
   editando, e o provedor simples quando não está.

   ── NEM TUDO QUE SE EDITA NA PÁGINA É DOCUMENTO ──

   Três destinos, e confundi-los é o erro fácil aqui:

     widget|…, highlight|…, estiloDestaque|…   documento do Puck
     footerTitle                                documento, mas prop de um bloco
     form|<campo>                               o CADASTRO da imobiliária

   O último é o que não parece. A manchete da vitrine, o e-mail e o WhatsApp do
   rodapé são colunas do `Tenant` — a mesma informação que aparece nas
   Configurações e no feed dos portais. Gravá-los dentro do documento faria a
   página publicada guardar uma cópia do telefone que deixaria de acompanhar o
   cadastro no dia em que a imobiliária trocasse de número.

   Por isso `form|` sai por outra porta (`aoEditarCadastro`), que a página
   entrega. A ponte não decide o destino: ela lê o endereço que o próprio
   componente declarou e entrega a quem cuida daquilo.
   ──────────────────────────────────────────────────────────────────────────── */

/* Percorre o documento inteiro, incluindo o que estiver dentro de `slot`.
   Seção com colunas guarda peças em `props.conteudo`, e um widget lá dentro
   precisa ser alcançável — senão editar texto funcionaria na primeira metade da
   página e falharia em silêncio na segunda. */
function mapearItens(itens, transformar) {
  return (itens || []).map((item) => {
    const trocado = transformar(item) || item;
    let props = trocado.props;

    for (const [chave, valor] of Object.entries(props || {})) {
      if (Array.isArray(valor) && valor.some((v) => v && typeof v === "object" && v.type && v.props)) {
        const dentro = mapearItens(valor, transformar);
        if (dentro !== valor) props = { ...props, [chave]: dentro };
      }
    }
    return props === trocado.props ? trocado : { ...trocado, props };
  });
}

export function PonteDeEdicao({ tenantSlug, dados, aoEditarCadastro, children }) {
  const pegarPuck = useGetPuck();

  const aoEditar = useCallback((campo, valor) => {
    const partes = String(campo || "").split("|");

    /* O cadastro da imobiliária, e não o documento: manchete, descrição, e-mail
       e WhatsApp são colunas do `Tenant`. Ver o cabeçalho. */
    if (partes[0] === "form" && partes[1]) {
      aoEditarCadastro?.(partes[1], valor);
      return;
    }

    const { dispatch } = pegarPuck();

    /* `footerTitle` é documento, mas não é do widget nem do destaque: ele é uma
       prop do bloco de Rodapé. Um caminho próprio, curto, em vez de um caso
       especial dentro do laço abaixo. */
    if (partes[0] === "footerTitle") {
      dispatch({
        type: "setData",
        data: (anterior) => ({
          ...anterior,
          content: mapearItens(anterior.content, (item) => (
            item.type === "BlocoRodape"
              ? { ...item, props: { ...item.props, footerTitle: valor } }
              : item
          )),
        }),
      });
      return;
    }

    /* `highlights|adicionar` e `highlights|remover|<i>` mexem no TAMANHO da
       lista, e por isso não cabem no laço de baixo, que troca campo de um item
       existente. Faltavam: o "+" de novo destaque e o "×" de cada cartão eram
       botões que não faziam nada — e um botão inerte é pior que botão nenhum,
       porque a pessoa clica de novo achando que errou a mira.

       A regra é a mesma do editor antigo, inclusive o piso de um cartão: uma
       faixa de destaques vazia vira uma fatia de fundo colorido que ninguém
       sabe o que é nem como tirar. */
    if (partes[0] === "highlights") {
      const acao = partes[1];
      if (acao !== "adicionar" && acao !== "remover") return;
      const indice = parseInt(partes[2], 10);

      dispatch({
        type: "setData",
        data: (anterior) => ({
          ...anterior,
          content: mapearItens(anterior.content, (item) => {
            if (item.type !== "BlocoDestaques") return item;
            const textos = item.props.highlights || [];
            const estilos = item.props.highlightStyles || [];

            if (acao === "adicionar") {
              return { ...item, props: { ...item.props,
                highlights: [...textos, { title: "Novo destaque", description: "Descreva o benefício aqui." }],
                highlightStyles: [...estilos, { backgroundColor: "", color: "" }] } };
            }
            if (textos.length <= 1 || !Number.isFinite(indice)) return item;
            return { ...item, props: { ...item.props,
              highlights: textos.filter((_, i) => i !== indice),
              highlightStyles: estilos.filter((_, i) => i !== indice) } };
          }),
        }),
      });
      return;
    }

    if (partes.length < 2) return;

    dispatch({
      type: "setData",
      data: (anterior) => ({
        ...anterior,
        content: mapearItens(anterior.content, (item) => {
          /* Um widget: o endereço traz o id, e a peça que o carrega é quem
             recebe a alteração. A regra do que fazer com ele é a mesma do
             editor antigo — ver `utils/edicaoDeWidget`. */
          if (partes[0] === "widget" && item.props?.widget?.id === partes[1]) {
            return { ...item, props: { ...item.props, widget: aplicarEdicaoNoWidget(item.props.widget, partes.slice(2), valor) } };
          }

          /* Um destaque: eles são props do bloco de Destaques, e o endereço traz
             o índice do cartão. `highlight|` escreve o TEXTO e
             `estiloDestaque|` a APARÊNCIA — duas listas separadas no documento,
             como sempre foram. Misturá-las faria a cor entrar como parágrafo. */
          if (item.type === "BlocoDestaques" && (partes[0] === "highlight" || partes[0] === "estiloDestaque")) {
            const indice = parseInt(partes[1], 10);
            if (!Number.isFinite(indice)) return item;

            if (partes[0] === "highlight") {
              const lista = (item.props.highlights || []).map((h, i) => (i === indice ? { ...h, [partes[2]]: valor } : h));
              return { ...item, props: { ...item.props, highlights: lista } };
            }
            /* `__tudo` cola o estilo inteiro de outro cartão, numa gravação só:
               três chamadas seguidas fariam o desfazer devolver a cor sem a
               opacidade, e a pessoa veria um estado que nunca existiu. */
            const estilos = (item.props.highlightStyles || []).map((row, i) => {
              if (i !== indice) return row;
              return partes[2] === "__tudo" ? { ...row, ...(valor || {}) } : { ...row, [partes[2]]: valor };
            });
            return { ...item, props: { ...item.props, highlightStyles: estilos } };
          }

          return item;
        }),
      }),
    });
  }, [pegarPuck, aoEditarCadastro]);

  const raiz = useLiberarInterativos();
  useSelecionarAoClicar(raiz, pegarPuck);
  /* Antes do `useArrastarAoLado`: os dois escutam `pointerdown` na captura, e
     quem chega primeiro decide. Clique com modificador é seleção e não pode
     acordar a mira de agrupamento. */
  useSelecaoMultipla(raiz, pegarPuck);
  useArrastarAoLado(raiz, pegarPuck);
  useTeclasDeTexto(raiz);
  useAcenderNaGaveta(raiz, pegarPuck);
  useAcenderNaEstrutura(raiz);

  return (
    <VitrineProvider modo="editor" aoEditar={aoEditar} tenantSlug={tenantSlug} dados={dados}>
      {/* `puck-ponte` só declara `position: relative`. É o bloco de contenção da
          cópia que a prévia desenha: sem ele, `position: absolute` sobe até
          achar qualquer ancestral posicionado, e a cópia ia parar fora da
          folha. Ver `previaDeSecao`. */}
      <div ref={raiz} className="puck-ponte">{children}</div>
    </VitrineProvider>
  );
}

/* ── DEVOLVER O CLIQUE ÀS PEÇAS ─────────────────────────────────────────────

   No Puck, cada peça da prancheta é alvo de arrasto: uma sobreposição a cobre e
   come o ponteiro. É o que faz arrastar funcionar — e é também o que impedia
   editar QUALQUER COISA no lugar. `registerOverlayPortal` abre um furo nessa
   sobreposição, e quem chama é a ponte: fazer o widget saber que existe um Puck
   é o acoplamento que a migração inteira evitou.

   UM furo por peça — o filho direto de cada `[data-puck-component]` —, e não um
   por texto. Com dezenas de furinhos a sobreposição virava peneira e o ponteiro
   cruzava borda a cada milímetro; com um só, o interior inteiro fica clicável e
   não há borda interna para atravessar.

   ── O QUE ISSO CUSTA, E COMO FOI PAGO ──

   Dentro de um furo o Puck não enxerga a peça: enxerga a ZONA que a contém. E a
   zona, quando apontada, pintava a seção inteira de cinza. Andando com o mouse,
   isso ligava e desligava várias vezes por segundo — era o pisca-pisca.

   A correção não foi tirar os furos (sem eles não se edita nada): foi apagar a
   PINTURA da zona no hover, no `styles.css`. Ver o bloco "A ZONA DE ARRASTO NÃO
   PINTA POR CIMA DA PÁGINA" lá.

   O observador existe porque a prancheta se redesenha o tempo todo: registrar
   só na montagem cobriria a página inicial e nada do que viesse depois. */
const SELETOR_INTERATIVO = "[data-puck-component] > *";

function useLiberarInterativos() {
  const raiz = useRef(null);

  useEffect(() => {
    const alvo = raiz.current;
    if (!alvo) return undefined;

    const registrados = new WeakSet();
    const varrer = () => {
      for (const el of alvo.querySelectorAll(SELETOR_INTERATIVO)) {
        if (registrados.has(el)) continue;
        registrados.add(el);
        registerOverlayPortal(el, { disableDragOnFocus: true });
      }
    };
    varrer();

    const observador = new MutationObserver(varrer);
    observador.observe(alvo, { childList: true, subtree: true });
    return () => observador.disconnect();
  }, []);

  return raiz;
}

/* ── CLICAR DENTRO DE UMA PEÇA SELECIONA A PEÇA ─────────────────────────────

   Sem isto, clicar no meio de um widget desselecionava tudo e o inspetor
   voltava para "Página" — só as BORDAS respondiam. O sintoma parecia aleatório
   e não era: o canvas do Puck limpa a seleção em qualquer clique cujo alvo não
   seja o nó raiz de uma peça nem uma zona de arrasto, e os furos que a ponte
   abre na sobreposição fazem justamente o clique chegar ao conteúdo interno.

   Ou seja: é consequência direta da edição no lugar. Quanto melhor o furo
   funciona, mais fundo o clique cai — e mais longe do nó que o Puck reconhece.

   A correção fica na fase de CAPTURA, antes de o canvas ver o evento: acha a
   peça que contém o alvo, seleciona-a e interrompe a propagação. O clique segue
   servindo para pôr o cursor no texto, porque o `contentEditable` reage no
   próprio elemento.

   `getSelectorForId` é a API pública do Puck para isso — o seletor é
   {zona, índice}, e montá-lo à mão exigiria repetir a travessia do documento
   que a biblioteca já faz. */
function useSelecionarAoClicar(raiz, pegarPuck) {
  useEffect(() => {
    const alvo = raiz.current;
    if (!alvo) return undefined;

    const aoClicar = (evento) => {
      const peca = evento.target?.closest?.("[data-puck-component]");
      if (!peca) return;
      /* Clique no próprio nó raiz já é entendido pelo canvas; interferir ali
         seria fazer duas seleções para o mesmo gesto. */
      if (evento.target === peca) return;

      const { getSelectorForId, dispatch } = pegarPuck();
      const seletor = getSelectorForId(peca.getAttribute("data-puck-component"));
      if (!seletor) return;

      /* ── BOTÃO DENTRO DA PEÇA PRECISA CONTINUAR SENDO BOTÃO ──────────────
         Este ouvinte está na CAPTURA, acima do nó raiz do React dentro do
         iframe; um `stopPropagation` aqui mata o evento antes de ele chegar ao
         `onClick` do React. Era isso que deixava "+ Etapa", "+ Região",
         "+ Destaque" e os "×" inertes: o clique selecionava a peça e morria.

         Para alvo interativo o clique segue vivo, e a seleção é adiada para
         depois de o canvas do Puck reagir — ele limpa a seleção no mesmo
         gesto, e selecionar antes seria selecionar para nada. Para texto e
         fundo, o comportamento de sempre: seleciona e interrompe. */
      const interativo = evento.target?.closest?.("button, a, input, textarea, select, label, [role='button']");
      if (interativo) {
        setTimeout(() => dispatch({ type: "setUi", ui: { itemSelector: seletor } }), 0);
        return;
      }

      dispatch({ type: "setUi", ui: { itemSelector: seletor } });
      evento.stopPropagation();
    };

    alvo.addEventListener("click", aoClicar, true);
    return () => alvo.removeEventListener("click", aoClicar, true);
  }, [raiz, pegarPuck]);
}

/* ── ARRASTAR "AO LADO" E VIRAR UMA SEÇÃO ───────────────────────────────────

   O arrasto do Puck só sabe reordenar: cada zona é uma lista, então soltar
   significa "acima ou abaixo de". Este hook acrescenta o gesto que faltava —
   soltar na faixa LATERAL de outra peça põe as duas lado a lado, numa seção.

   Ele mora na ponte, e não na página, por uma razão prática: aqui há
   `useGetPuck` (para despachar) e há o ponteiro dentro do iframe (para saber
   onde ele está). A página tem o `onAction`, mas não tem nem um nem outro.

   ── A ORDEM É: DEIXAR ACONTECER, DEPOIS CORRIGIR ──

   Ao soltar, o Puck já moveu a peça para acima ou abaixo do alvo. Impedir isso
   exigiria interceptar o arrasto por dentro da biblioteca; deixar acontecer e
   agrupar em seguida usa só API pública. O resultado é o mesmo, e o adiamento
   de um quadro é o que garante que a lista já esteja atualizada quando a
   transformação roda.

   ── OS DOIS FALSOS POSITIVOS QUE ISTO EVITA ──

   1. CLIQUE COM TREMIDA. Um clique na faixa lateral, com dois pixels de
      deslize, é um clique — não um arrasto. Por isso há distância mínima, maior
      que o limiar de ativação da biblioteca.

   2. SELECIONAR TEXTO. Arrastar dentro de um widget para selecionar uma frase
      também é ponteiro pressionado em movimento. A diferença é onde o gesto
      COMEÇOU: dentro de um furo da sobreposição (texto, botões do widget) o
      arrasto é da pessoa com o conteúdo, não da peça com a página.

   Sem os dois, o editor agruparia peças sozinho enquanto alguém escreve — o
   pior tipo de defeito, porque parece que a ferramenta tem vontade própria.
   ───────────────────────────────────────────────────────────────────────── */
const DISTANCIA_MINIMA = 12;

function useArrastarAoLado(raiz, pegarPuck) {
  useEffect(() => {
    const alvo = raiz.current;
    if (!alvo) return undefined;
    const doc = alvo.ownerDocument;
    /* O documento de FORA. A prévia mora no iframe, mas o arrasto que vem da
       gaveta de peças começa lá — e, com o ponteiro capturado por quem iniciou
       o gesto, os eventos nunca chegam aqui dentro. Observar os dois é o que
       faz a gaveta se comportar como o canvas. */
    const hospedeiro = doc.defaultView?.parent?.document || null;

    const previa = criarPreviaDeSecao(alvo);
    let gesto = null;

    /* ── A DECISÃO CONGELA QUANDO A PRÉVIA ACENDE ─────────────────────────────

       A prévia reorganiza a página de verdade: o alvo encolhe para metade. Isso
       MUDA o layout — e o teste de acerto lê o layout. Sem esta trava o gesto
       entrava em laço: encolhe, a peça sob o ponteiro passa a ser outra, a
       prévia cai, o layout volta, o ponteiro está de novo sobre o alvo, encolhe
       outra vez. Na tela isso aparece como piscação, e é exatamente o laço que
       o comentário antigo de `previaDeSecao` temia.

       `mira` guarda o alvo e a caixa dele MEDIDA ANTES de encolher. Enquanto o
       ponteiro estiver dentro dessa caixa congelada, ninguém refaz o teste de
       acerto: só o LADO é reavaliado, contra a mesma caixa. A decisão deixa de
       depender do que ela própria causou.

       Sair da caixa congelada é o que solta a trava — e aí o teste de acerto
       roda de novo, sobre o layout já restaurado. */
    let mira = null;

    /* ── ESCONDER A MIRA NÃO É DESISTIR DE AGRUPAR ───────────────────────────

       As duas coisas andavam juntas, e era esse o defeito: soltar no terço
       lateral de uma peça reordenava em vez de virar duas colunas, e a mira
       tinha ACENDIDO durante o gesto.

       O que acontece é que o Puck reordena AO VIVO enquanto se arrasta. No meio
       do voo, a peça arrastada passa a ocupar o lugar para onde ela está indo —
       e o teste de acerto, que ignora a própria arrastada de propósito, fica um
       quadro sem encontrar alvo nenhum. Esse "não achei" durava o suficiente
       para apagar a anotação, e o `pointerup` chegava logo depois num estado
       limpo.

       Agora `esconder` só apaga a MIRA. A anotação é apagada por quem sabe que
       a pessoa mudou de ideia — ver `desistir`, abaixo. O resto conta com a
       validade de meio segundo que o módulo já tinha: uma anotação órfã morre
       sozinha antes de alcançar o gesto seguinte. */
    const esconder = () => { previa.esconder(); mira = null; };

    /* Mudou de ideia DE VERDADE: o ponteiro está sobre uma peça e fora das
       faixas laterais, ou o par foi recusado. Aí sim a anotação morre — sem
       isto, arrastar para o terço lateral, corrigir para o meio e soltar
       agruparia mesmo assim, contra o que a pessoa acabou de fazer. */
    const desistir = () => { previa.esconder(); limparIntencao(); mira = null; };

    function nomeDaPeca(id) {
      const puck = pegarPuck();
      const item = puck.getItemById?.(id);
      return puck.config?.components?.[item?.type]?.label || "esta peça";
    }

    /* Coordenadas do hospedeiro viram coordenadas do iframe. O canvas do Puck
       trabalha com zoom, então não basta subtrair a origem: divide-se pela
       escala, senão o ponteiro cai longe do que a pessoa está apontando. */
    const paraDentro = (x, y) => {
      const quadro = hospedeiro?.querySelector("iframe");
      if (!quadro) return null;
      const r = quadro.getBoundingClientRect();
      const escala = r.width / (quadro.contentWindow?.innerWidth || r.width);
      return { x: (x - r.x) / escala, y: (y - r.y) / escala };
    };

    /* Todo id de peça que existe agora. Serve para descobrir, depois do drop,
       QUAL peça a gaveta acabou de criar — o Puck escolhe o id, e nenhum evento
       nos conta antes. */
    const idsAgora = () => new Set(
      [...doc.querySelectorAll("[data-puck-component]")].map((e) => e.getAttribute("data-puck-component")),
    );

    /* ── A CÓPIA É TIRADA ANTES DE O ARRASTO COMEÇAR ─────────────────────────

       A prévia desenha a peça arrastada dentro do espaço que abriu, e essa
       cópia sai daqui — do `pointerdown`, com a peça ainda intacta.

       Copiá-la DURANTE o gesto não funcionava, e custou três medições para
       entender por quê: o dnd-kit levanta a peça de verdade (`position: fixed`,
       z-index no teto, translação seguindo o ponteiro, variáveis `--dnd-*`) e,
       em algumas peças, esconde o miolo dela. `cloneNode` trazia tudo isso
       junto: a cópia saía fora do fluxo, ou com `display: none` por dentro, e a
       moldura ficava com altura zero.

       Aqui nada disso existe ainda. O que se copia é a peça como ela está na
       página — que é exatamente o que a prévia precisa mostrar. */
    const copiaLimpa = (id) => {
      const el = doc.querySelector(`[data-puck-component="${id}"]`);
      if (!el) return null;
      const copia = el.cloneNode(true);
      /* Sem o atributo: com ele, a cópia entraria nos testes de acerto do
         arrasto e a mira passaria a mirar a si mesma. */
      copia.removeAttribute("data-puck-component");
      copia.classList.remove("puck-fantasma", "puck-multi", "puck-encolhe", "is-esquerda", "is-direita");
      copia.style.setProperty("width", "100%", "important");
      return copia;
    };

    const aoDescer = (evento, deFora) => {
      /* Gesto novo começa sem herança. É isto que substitui o prazo de 500ms que
         a anotação tinha: ela vale do último movimento até o `pointerup` deste
         gesto, e o que a encerra é o próximo `pointerdown` — não um relógio
         correndo contra a mão de quem está conferindo a mira. Ver
         `intencaoDeAgrupar`. */
      limparIntencao();

      const sob = evento.target;
      if (!sob || !sob.closest) { gesto = null; return; }

      if (deFora) {
        /* ── ARRASTAR PELA ESTRUTURA NÃO É PEÇA NOVA ──────────────────────
           A Estrutura mora no mesmo documento da gaveta, e a busca por
           `[class*='Drawer']` alcançava as duas: um arrasto começado na lista
           era lido como "peça nova saindo da gaveta". O efeito era um só e
           enganava — como peça nova, ela não tem id, e sem id não há par para
           conferir: a mira acendia prometendo colunas mesmo sobre uma seção
           cheia, e soltar não fazia nada.

           A linha da Estrutura carrega o id da peça (`data-puck-layer-tree-id`,
           do próprio Puck). Com ele o gesto é o mesmo de arrastar no canvas — a
           peça EXISTE —, e todas as conferências voltam a valer. */
        const naEstrutura = sob.closest("[data-puck-layer-tree-id]");
        if (naEstrutura) {
          const id = naEstrutura.getAttribute("data-puck-layer-tree-id");
          gesto = {
            origem: "estrutura",
            id,
            copia: copiaLimpa(id),
            deFora: true,
            x: evento.clientX,
            y: evento.clientY,
            altura: 0,
          };
          return;
        }

        /* Só interessa o que sai da gaveta de peças. Clique na barra ou no
           inspetor não é arrasto de peça nova. */
        const item = sob.closest("[class*='Drawer']");
        /* O NOME sai do próprio cartão da gaveta, agora e não depois: a peça
           ainda não existe no documento, então não há id para consultar — e a
           mira dizia "a peça nova", que é o nome de nada. O cartão tem o rótulo
           do componente escrito nele, que é exatamente o mesmo `label` do
           `configVitrine`. */
        gesto = item
          ? {
              origem: "gaveta",
              deFora: true,
              rotulo: (item.textContent || "").trim() || "a peça nova",
              x: evento.clientX,
              y: evento.clientY,
              antes: idsAgora(),
            }
          : null;
        return;
      }

      /* A primeira versão descartava todo gesto iniciado dentro de um furo da
         sobreposição, para não confundir arrasto de peça com seleção de texto.
         Só que o furo cobre o INTERIOR INTEIRO de cada peça — a regra excluía
         todos os gestos, e a mira nunca aparecia.

         A distinção certa é a que o próprio Puck faz com "disableDragOnFocus":
         texto EM EDIÇÃO não arrasta; texto parado, sim. */
      /* Clique com modificador é SELEÇÃO, não arrasto — quem cuida dele é
         `useSelecaoMultipla`. Sem esta saída, ctrl+clique começaria uma mira de
         agrupamento por baixo da seleção que a pessoa está montando. */
      if (evento.ctrlKey || evento.metaKey || evento.shiftKey) { gesto = null; return; }

      const editavel = sob.closest("[contenteditable='true']");
      if (editavel && doc.activeElement === editavel) { gesto = null; return; }
      if (sob.closest("button, input, select, textarea, a")) { gesto = null; return; }

      /* Sem peça sob o ponteiro, o gesto começou na etiqueta — que é a alça de
         arrasto do Puck e vive FORA do nó da peça. Nesse caso quem está sendo
         arrastada é a selecionada, porque agarrar a etiqueta seleciona. */
      const peca = sob.closest("[data-puck-component]");
      const id = peca
        ? peca.getAttribute("data-puck-component")
        : pegarPuck().selectedItem?.props?.id || null;
      gesto = id
        ? { origem: "canvas", id, copia: copiaLimpa(id), deFora: false, x: evento.clientX, y: evento.clientY,
            altura: doc.querySelector(`[data-puck-component="${id}"]`)?.getBoundingClientRect().height || 0 }
        : null;
    };

    const aoMover = (evento, deFora) => {
      /* ── A DONA DO GESTO É QUEM DECIDE, E ESTA CHECAGEM VEM PRIMEIRO ────────
         Cada documento cuida do gesto que nasceu nele. Isto já estava aqui —
         mas EMBAIXO da checagem de botão, e a ordem era o defeito.

         Com o ponteiro capturado dentro do quadro, o documento hospedeiro
         continua recebendo `pointermove` com `buttons: 0`. Cada um deles caía na
         linha de baixo e escondia a mira do arrasto que estava acontecendo no
         canvas — intercalado com os movimentos de verdade. O resultado era uma
         mira que piscava e, na prática, não aparecia: a peça ia para o lado e
         virava seção, sem nunca ter mostrado que ia.

         Trocando a ordem, o movimento do documento errado é descartado antes de
         poder apagar coisa nenhuma. */
      if (gesto && deFora !== gesto.deFora) return;

      if (!evento.buttons || !gesto) { esconder(); return; }

      const andou = Math.hypot(evento.clientX - gesto.x, evento.clientY - gesto.y);
      if (andou < DISTANCIA_MINIMA) { esconder(); return; }

      const ponto = gesto.deFora
        ? paraDentro(evento.clientX, evento.clientY)
        : { x: evento.clientX, y: evento.clientY };
      if (!ponto) { esconder(); return; }

      /* Com a prévia no ar, a caixa congelada manda. Ver o comentário de
         `mira`, acima: refazer o teste de acerto aqui é o laço. */
      if (mira) {
        const r = mira.rect;
        const dentro = ponto.x >= r.left && ponto.x <= r.right && ponto.y >= r.top && ponto.y <= r.bottom;
        if (dentro) {
          const ladoAgora = ladoDoPonteiro(r, ponto.x);
          if (mira.modo === "empilhar") {
            /* Foi para a faixa lateral: vira colunas — solta a trava e deixa
               o teste de acerto abaixo montar a outra prévia. */
            if (ladoAgora) { desistir(); }
            else {
              const posicaoAgora = ponto.y < r.top + r.height / 2 ? "antes" : "depois";
              if (posicaoAgora !== mira.posicao) {
                mira.posicao = posicaoAgora;
                previa.empilhar(mira.el, posicaoAgora, mira.arrastadaEl, mira.nome, mira.rect, mira.copia, mira.altura);
              }
              return;
            }
          } else {
            /* Foi para o MEIO da peça: a pessoa desistiu de pôr ao lado. */
            if (!ladoAgora) { desistir(); }
            else {
              if (ladoAgora !== mira.lado) {
                mira.lado = ladoAgora;
                anotarIntencao(mira.alvoId, ladoAgora);
                previa.colunas(mira.el, ladoAgora, mira.arrastadaEl, mira.nome, mira.rect, mira.copia);
              }
              return;
            }
          }
        } else {
          /* Saiu da caixa: solta a trava e deixa o teste de acerto decidir de
             novo, já com o layout de volta ao normal. */
          desistir();
        }
      }

      /* ── QUEM ESTÁ SOB O PONTEIRO, POR GEOMETRIA E NÃO POR TESTE DE ACERTO ──

         Isto era um `elementsFromPoint` percorrendo a pilha. E era o defeito:
         durante o arrasto o Puck cobre a prancheta com a própria sobreposição,
         então a pilha vinha cheia de elementos dele e NENHUM `[data-puck-
         component]`. O gesto passava quase inteiro respondendo "não há alvo",
         a mira não acendia, e soltar no terço lateral só reordenava.

         Medir as caixas resolve porque não depende de quem está por cima. A
         MENOR que contém o ponto é a resposta certa: uma peça dentro de uma
         seção também tem a seção contendo o mesmo ponto, e agrupar com a seção
         inteira não é o que a pessoa mirou.

         A arrastada fica de fora — o Puck a leva junto do ponteiro, e ela seria
         sempre a resposta. */
      let peca = null;
      let menorArea = Infinity;
      for (const el of doc.querySelectorAll("[data-puck-component]")) {
        if (el.getAttribute("data-puck-component") === gesto.id) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (ponto.x < r.left || ponto.x > r.right || ponto.y < r.top || ponto.y > r.bottom) continue;
        const area = r.width * r.height;
        if (area < menorArea) { menorArea = area; peca = el; }
      }
      const alvoId = peca?.getAttribute("data-puck-component");
      if (!alvoId) { esconder(); return; }

      const rect = peca.getBoundingClientRect();
      const lado = ladoDoPonteiro(rect, ponto.x);

      /* Fora da faixa lateral: vai EMPILHAR. A prévia abre a vaga acima ou
         abaixo do alvo e põe a cópia da arrastada nela — a ordem nova, antes
         de soltar. Quem grava a ordem continua sendo o Puck: aqui só se
         mostra. (A versão antiga contornava o alvo e cobria a linha dele; esta
         não cobre nada, abre espaço.)

         A arrastada de dentro da mesma pilha, mirando o vizinho imediato do
         lado de onde ela já está, seria uma vaga que não muda nada — pula. */
      if (!lado) {
        limparIntencao();
        const posicao = ponto.y < rect.top + rect.height / 2 ? "antes" : "depois";
        const arrastadaEl = gesto.origem === "gaveta" ? null : doc.querySelector(`[data-puck-component="${gesto.id}"]`);
        const vizinho = arrastadaEl && (posicao === "antes" ? peca.previousElementSibling : peca.nextElementSibling);
        if (vizinho === arrastadaEl) { desistir(); return; }
        const nome = gesto.origem === "gaveta" ? gesto.rotulo : nomeDaPeca(gesto.id);
        const altura = gesto.altura || 120;
        mira = { modo: "empilhar", alvoId, posicao, rect, el: peca, arrastadaEl, nome, copia: gesto.copia, altura };
        previa.empilhar(peca, posicao, arrastadaEl, nome, rect, gesto.copia, altura);
        return;
      }

      /* Peça vinda da gaveta ainda não existe no documento: não há par para
         conferir, e a única recusa possível é a seção cheia — que a própria
         transformação aplica ao inserir. */
      /* Só a peça vinda da GAVETA escapa da conferência, e por um motivo
         literal: ela ainda não existe no documento, então não há par para
         comparar. Vinda da Estrutura ou do canvas, a peça existe e a regra é a
         mesma — foi o que consertou a mira que prometia colunas numa seção
         cheia. */
      const motivo = gesto.origem === "gaveta"
        ? null
        : motivoParaNaoAgrupar(pegarPuck().appState.data.content, gesto.id, alvoId);
      if (motivo) { limparIntencao(); previa.recusa(rect, motivo); return; }


      anotarIntencao(alvoId, lado);
      /* Os ELEMENTOS, e não as caixas: a prévia agora reorganiza a página de
         verdade — o alvo encolhe e a arrastada pula para o espaço. Ver
         `previaDeSecao`. */
      const arrastadaEl = gesto.origem === "gaveta"
        ? null
        : doc.querySelector(`[data-puck-component="${gesto.id}"]`);
      const nome = gesto.origem === "gaveta" ? gesto.rotulo : nomeDaPeca(gesto.id);

      /* A caixa é guardada AGORA, antes de encolher: é ela que vai responder
         "o ponteiro ainda está sobre o alvo?" pelo resto do gesto. */
      mira = { modo: "colunas", alvoId, lado, rect, el: peca, arrastadaEl, nome, copia: gesto.copia };
      previa.colunas(peca, lado, arrastadaEl, nome, rect, gesto.copia);
    };

    /* O ponteiro está sobre a prancheta? Só vale perguntar para o gesto que veio
       da gaveta, e a resposta é a caixa do quadro no documento hospedeiro. */
    const soltouNaPrancheta = (evento) => {
      const quadro = hospedeiro?.querySelector("iframe");
      if (!quadro) return true;
      const r = quadro.getBoundingClientRect();
      return evento.clientX >= r.left && evento.clientX <= r.right
        && evento.clientY >= r.top && evento.clientY <= r.bottom;
    };

    const aoSoltar = (evento, deFora) => {
      previa.esconder();
      mira = null;
      const intencao = consumirIntencao();
      const solto = gesto;
      gesto = null;
      if (!solto) return;

      /* ── DESISTIR NO MEIO DO CAMINHO TEM DE DESISTIR DE VERDADE ────────────

         Arrastar uma peça da gaveta, mudar de ideia e soltar fora da prancheta
         acrescentava a peça assim mesmo. O Puck cancela quando a soltura é sobre
         a PRÓPRIA gaveta, e só ali: solta na tira de módulos, na barra do topo
         ou em qualquer canto que não seja zona de queda, ele mantém a última
         zona válida por onde o ponteiro passou e insere.

         Do lado de quem usa, isso é a pior forma de erro: a pessoa desistiu, viu
         a peça sumir da mão, e ela apareceu na página. Desfazer existe, mas
         exige perceber o que aconteceu.

         Aqui a peça nova é encontrada pela mesma comparação que o agrupamento
         usa — o id que não existia antes — e é retirada. Só a que ACABOU de
         entrar: nada mais na árvore é tocado.

         `deFora` é o documento que disparou a soltura. Vindo de dentro do
         quadro, a soltura foi na prancheta por definição e não há o que
         cancelar. */
      if (solto.origem === "gaveta" && deFora && evento && !soltouNaPrancheta(evento)) {
        /* A peça só existe depois de o Puck aplicar a inserção, e ela passa por
           um render a mais que um movimento dentro do canvas. Uma tentativa por
           quadro, com um teto: fixar um atraso único acertava numa máquina e
           errava na outra — e errar aqui é deixar a peça que a pessoa recusou. */
        let tentativas = 0;
        const retirar = () => {
          const nova = [...idsAgora()].find((x) => !solto.antes.has(x));
          if (!nova) {
            if (tentativas++ < 20) requestAnimationFrame(retirar);
            return;
          }
          const { dispatch } = pegarPuck();
          dispatch({
            type: "setData",
            data: (atual) => {
              const podado = removerPeca(atual.content, nova);
              return podado ? { ...atual, content: podado } : atual;
            },
          });
        };
        requestAnimationFrame(retirar);
        return;
      }

      /* ── ARRASTAR UMA DA SELEÇÃO LEVA TODAS ────────────────────────────
         O Puck moveu a peça que estava sob o ponteiro. As outras da seleção vêm
         atrás, encostadas nela e na ordem em que apareciam na página. Ver
         `moverJunto`: é depois do gesto de propósito, porque durante ele o
         documento é da biblioteca. */
      const selecao = idsSelecionados();
      if (solto.origem !== "gaveta" && selecao.length > 1 && selecao.includes(solto.id)) {
        setTimeout(() => {
          const { dispatch } = pegarPuck();
          dispatch({
            type: "setData",
            data: (atual) => {
              const junto = moverJunto(atual.content, selecao, solto.id);
              return junto ? { ...atual, content: junto } : atual;
            },
          });
        }, 60);
        if (!intencao) return;
      }

      if (!intencao) return;

      /* Uma folga antes de agir: o Puck aplica o movimento (ou a inserção) no
         fim deste gesto, e agrupar antes disso trabalharia sobre a lista
         antiga. Sessenta milissegundos porque a inserção da gaveta passa por um
         render a mais que o movimento dentro do canvas. */
      setTimeout(() => {
        /* Vinda da gaveta, a peça nova é a única cujo id não existia antes. É
           assim, e não pela ação do Puck, porque nem toda inserção anuncia o
           id — e comparar o antes com o depois não depende do formato dela. */
        const id = solto.origem === "gaveta"
          ? [...idsAgora()].find((x) => !solto.antes.has(x))
          : solto.id;
        if (!id) return;

        const { dispatch, getSelectorForId } = pegarPuck();
        dispatch({
          type: "setData",
          data: (atual) => {
            const novo = agruparCom(atual.content, id, intencao.alvoId, intencao.lado);
            return novo ? { ...atual, content: novo } : atual;
          },
        });
        /* Mantém a peça selecionada, como a ação da barra faz — agrupar troca o
           endereço dela na árvore. */
        setTimeout(() => {
          const seletor = getSelectorForId(id);
          if (seletor) dispatch({ type: "setUi", ui: { itemSelector: seletor } });
        }, 0);
      }, 60);
    };

    const dentro = { down: (e) => aoDescer(e, false), move: (e) => aoMover(e, false), up: (e) => aoSoltar(e, false) };
    const fora = { down: (e) => aoDescer(e, true), move: (e) => aoMover(e, true), up: (e) => aoSoltar(e, true) };

    doc.addEventListener("pointerdown", dentro.down, true);
    doc.addEventListener("pointermove", dentro.move, true);
    doc.addEventListener("pointerup", dentro.up, true);
    doc.addEventListener("pointercancel", esconder, true);

    if (hospedeiro) {
      hospedeiro.addEventListener("pointerdown", fora.down, true);
      hospedeiro.addEventListener("pointermove", fora.move, true);
      hospedeiro.addEventListener("pointerup", fora.up, true);
      hospedeiro.addEventListener("pointercancel", esconder, true);
    }

    return () => {
      doc.removeEventListener("pointerdown", dentro.down, true);
      doc.removeEventListener("pointermove", dentro.move, true);
      doc.removeEventListener("pointerup", dentro.up, true);
      doc.removeEventListener("pointercancel", esconder, true);
      if (hospedeiro) {
        hospedeiro.removeEventListener("pointerdown", fora.down, true);
        hospedeiro.removeEventListener("pointermove", fora.move, true);
        hospedeiro.removeEventListener("pointerup", fora.up, true);
        hospedeiro.removeEventListener("pointercancel", esconder, true);
      }
      previa.remover();
    };
  }, [raiz, pegarPuck]);
}

/* ────────────────────────────────────────────────────────────────────────────
   CTRL E SHIFT SELECIONAM VÁRIAS PEÇAS.

   O Puck seleciona UMA — `itemSelector` é um endereço só, e é ele que o inspetor
   lê. A seleção múltipla vive ao lado (ver `selecaoMultipla.js`); o que este
   hook faz é escutar o clique nos DOIS lugares onde ele acontece e traduzir o
   modificador em operação de lista.

   ── OS DOIS LUGARES ──

   A prancheta vive no iframe e a Estrutura vive fora dele. São dois documentos,
   e o mesmo gesto tem de valer nos dois — quem monta uma seleção pela lista
   espera arrastá-la no canvas, e vice-versa. Cada um identifica a peça por um
   atributo próprio: `data-puck-component` na prancheta,
   `data-puck-layer-tree-id` na Estrutura (os dois são do Puck).

   ── POR QUE NA CAPTURA, E COM `stopPropagation` ──

   O clique é do Puck: ele seleciona a peça e limpa o resto. Deixar o evento
   seguir faria a seleção múltipla existir por um quadro e ser desfeita no
   seguinte. Interceptar na captura é o mesmo remédio que a tecla de apagar já
   usava neste arquivo.

   Só o clique COM modificador é interceptado. O clique simples continua sendo
   dele — e limpa a seleção múltipla, que é o que qualquer editor faz.
   ────────────────────────────────────────────────────────────────────────── */
function useSelecaoMultipla(raiz, pegarPuck) {
  useEffect(() => {
    const alvo = raiz.current;
    if (!alvo) return undefined;
    const doc = alvo.ownerDocument;
    const hospedeiro = doc.defaultView?.parent?.document || null;

    const idDoEvento = (evento) => {
      const naPrancheta = evento.target?.closest?.("[data-puck-component]");
      if (naPrancheta) return naPrancheta.getAttribute("data-puck-component");
      const naEstrutura = evento.target?.closest?.("[data-puck-layer-tree-id]");
      return naEstrutura ? naEstrutura.getAttribute("data-puck-layer-tree-id") : null;
    };

    const aoDescer = (evento) => {
      const modificador = evento.ctrlKey || evento.metaKey || evento.shiftKey;
      const id = idDoEvento(evento);

      if (!modificador) {
        /* ── PEGAR UMA DA SELEÇÃO NÃO DESFAZ A SELEÇÃO ───────────────────────
           Este é o `pointerdown` que também COMEÇA um arrasto. Zerar a lista
           aqui matava o movimento em bloco antes de ele existir: a mão descia
           sobre uma das escolhidas, a lista virava só ela, e ao soltar não havia
           mais grupo para levar junto.

           É a regra de qualquer editor de design: a mão sobre algo que já está
           selecionado age sobre o conjunto; a mão sobre outra coisa recomeça.

           O preço é que clicar numa peça já selecionada não encolhe a seleção
           para ela. Sai-se pelo Esc, pelo ✕ da barra ou clicando no vazio — e
           os três estão à mão. */
        const selecao = idsSelecionados();
        if (id && selecao.length > 1 && selecao.includes(id)) return;

        /* ── O CLIQUE SIMPLES NÃO LIMPA: ELE RECOMEÇA ────────────────────────
           A primeira versão zerava a lista, e o efeito era um gesto a mais para
           a pessoa: clicar em A não punha A em lugar nenhum, então ctrl+clicar
           em B dava UMA peça selecionada em vez de duas. Quem clica e depois
           ctrl+clica está dizendo "estas duas".

           Numa peça, a lista passa a ser ela — e ela vira a âncora do próximo
           shift. Fora de qualquer peça, a lista acaba. */
        if (id) definirSelecao([id], id); else limparSelecao();
        return;
      }
      if (!id) return;

      evento.preventDefault();
      evento.stopPropagation();

      if (evento.shiftKey) {
        selecionarIntervalo(id, ordemDasPecas(pegarPuck().appState.data.content));
        return;
      }
      alternarNaSelecao(id);
    };

    /* Esc desfaz a seleção — nos dois documentos, porque o foco pode estar em
       qualquer um dos dois e uma saída que só funciona de um lado é uma saída
       que a pessoa não encontra. */
    const aoTeclar = (evento) => { if (evento.key === "Escape") limparSelecao(); };

    doc.addEventListener("pointerdown", aoDescer, true);
    doc.addEventListener("keydown", aoTeclar, true);
    hospedeiro?.addEventListener("pointerdown", aoDescer, true);
    hospedeiro?.addEventListener("keydown", aoTeclar, true);

    /* O realce. Imperativo porque as peças são desenhadas pelo Puck: não há
       props nossas para carregar um "está selecionada" até elas. */
    const pintar = (ids) => {
      /* Uma peça só não ganha realce nosso: quem a marca é o Puck, e dois
         contornos na mesma peça leem como defeito. A lista continua com ela
         dentro — é dela que o ctrl e o shift seguintes partem. */
      const visiveis = ids.length > 1 ? ids : [];
      const marcar = (documento, atributo) => {
        for (const el of documento.querySelectorAll(`[${atributo}]`)) {
          el.classList.toggle("puck-multi", visiveis.includes(el.getAttribute(atributo)));
        }
      };
      marcar(doc, "data-puck-component");
      if (hospedeiro) marcar(hospedeiro, "data-puck-layer-tree-id");
    };
    const parar = observarSelecao(pintar);

    /* A árvore muda enquanto a seleção existe (a pessoa apaga, agrupa, arrasta).
       Repintar a cada mudança do DOM é o que impede a peça nova de nascer com o
       realce de outra que ocupava aquele lugar. */
    const observador = new MutationObserver(() => pintar(idsSelecionados()));
    observador.observe(doc.body, { childList: true, subtree: true });

    return () => {
      doc.removeEventListener("pointerdown", aoDescer, true);
      doc.removeEventListener("keydown", aoTeclar, true);
      hospedeiro?.removeEventListener("pointerdown", aoDescer, true);
      hospedeiro?.removeEventListener("keydown", aoTeclar, true);
      observador.disconnect();
      parar();
      pintar([]);
    };
  }, [raiz, pegarPuck]);
}

/* ── APAGAR TEXTO NÃO PODE APAGAR A PEÇA ────────────────────────────────────

   O Puck usa Backspace e Delete como atalho para excluir a peça selecionada. E
   a peça continua selecionada enquanto se escreve dentro dela — é assim que o
   inspetor sabe o que mostrar. O resultado: apagar uma letra apagava o widget
   inteiro.

   É o custo da edição no lugar, e o mesmo custo que já apareceu duas vezes
   nesta migração: os furos que a ponte abre na sobreposição levam o gesto para
   dentro do conteúdo, e o Puck continua achando que ele é dele. Antes foi o
   clique, que desselecionava; agora a tecla.

   A correção é a mesma de lá: interceptar na CAPTURA, antes de o atalho ver o
   evento, e só quando há texto em edição. Fora de um campo, Backspace continua
   excluindo a peça — é atalho legítimo e quem já o conhece contaria com ele.

   `Escape` sai do texto de propósito: sem uma saída pelo teclado, quem está
   escrevendo precisa do mouse para poder usar o atalho de novo.
   ───────────────────────────────────────────────────────────────────────── */
function useTeclasDeTexto(raiz) {
  useEffect(() => {
    const alvo = raiz.current;
    if (!alvo) return undefined;
    const doc = alvo.ownerDocument;

    const escrevendo = () => {
      const foco = doc.activeElement;
      if (!foco) return false;
      if (foco.isContentEditable) return true;
      return /^(INPUT|TEXTAREA|SELECT)$/.test(foco.tagName);
    };

    const aoTeclar = (evento) => {
      if (!escrevendo()) return;

      if (evento.key === "Escape") {
        doc.activeElement.blur();
        return;
      }
      /* Só as teclas que o Puck reivindica. Deixar passar o resto é o que
         mantém Ctrl+Z, as setas e a digitação inteira funcionando. */
      if (evento.key === "Backspace" || evento.key === "Delete") {
        evento.stopPropagation();
      }
    };

    doc.addEventListener("keydown", aoTeclar, true);
    return () => doc.removeEventListener("keydown", aoTeclar, true);
  }, [raiz]);
}

/* ── APONTAR NA PÁGINA ACENDE A PEÇA NA GAVETA ──────────────────────────────

   O caminho inverso já existe: passar o mouse num item da gaveta destaca onde
   ele cairia. Faltava o de volta — apontar um widget na prancheta e descobrir
   de qual item da lista ele veio.

   Serve a duas perguntas que aparecem o tempo todo: "que peça é esta que já
   está na página?" e, logo depois, "onde acho outra igual para acrescentar?".
   Sem isso a resposta exige ler o inspetor e depois caçar o nome na gaveta.

   ── O PAREAMENTO É PELO RÓTULO ──

   A gaveta é desenhada pelo Puck, e os itens dela não carregam o tipo do
   componente em atributo nenhum. O que dá para casar é o texto: o rótulo do
   item é o mesmo `label` que a config declara. Frágil? Um pouco — mas o rótulo
   vem do NOSSO catálogo, num lugar só, e mudar um nome ali já muda os dois
   lados juntos.
   ───────────────────────────────────────────────────────────────────────── */
/* ────────────────────────────────────────────────────────────────────────────
   O CAMINHO DE VOLTA ENTRE A PRANCHETA E A ESTRUTURA.

   Passar o ponteiro numa linha da Estrutura já acende a peça na prancheta — é do
   Puck. O contrário não existia, e a falta era assimétrica de um jeito que se
   sente: dá para achar a peça a partir da lista, e não a lista a partir da peça.

   Numa página com vinte peças, "qual das linhas é esta caixa aqui?" é uma
   pergunta que se faz o tempo todo — para renomear, ocultar, travar ou arrastar
   pela lista. Sem a volta, a resposta era contar posições.

   ── O REALCE É NOSSO, E DE PROPÓSITO ──

   O do Puck é `:hover` em CSS, e `:hover` não se liga de fora — o ponteiro está
   na prancheta, dentro do iframe, e a linha está no documento de fora. Uma
   classe própria é o que atravessa essa fronteira. Ela imita o realce dele em
   vez de reusá-lo, e é a única duplicação aceitável aqui: a alternativa seria
   sintetizar eventos de ponteiro numa árvore que não recebeu ponteiro nenhum.

   ── A LISTA ROLA, MAS SÓ O NECESSÁRIO ──

   `block: "nearest"` não mexe em nada quando a linha já está visível. Sem isso,
   passar o mouse numa peça do fim da página acendia uma linha fora de vista — o
   realce existia e ninguém via. Só dispara quando a linha MUDA: a cada
   `pointerover` seria a lista pulando debaixo da mão.
   ────────────────────────────────────────────────────────────────────────── */
function useAcenderNaEstrutura(raiz) {
  useEffect(() => {
    const alvo = raiz.current;
    if (!alvo) return undefined;
    const doc = alvo.ownerDocument;
    const hospedeiro = doc.defaultView?.parent?.document || null;
    if (!hospedeiro) return undefined;

    let aceso = null;

    const apagar = () => {
      if (aceso) aceso.classList.remove("puck-estrutura-aceso");
      aceso = null;
    };

    const acender = (linha) => {
      if (linha === aceso) return;
      apagar();
      if (!linha) return;
      linha.classList.add("puck-estrutura-aceso");
      aceso = linha;
      linha.scrollIntoView({ block: "nearest" });
    };

    /* ── A LINHA MAIS FUNDA QUE EXISTE NA LISTA ───────────────────────────────

       A Estrutura desenha os filhos de uma seção só quando ela está ABERTA. Com
       ela recolhida — que é como as seções nascem —, passar o mouse num widget
       lá dentro procurava uma linha que não existe, não achava nada, e o realce
       simplesmente não acontecia. Era esse o "não funciona em cima de seção".

       A resposta certa não é desistir: é acender a linha que a pessoa CONSEGUE
       ver. Sobe pela árvore de peças a partir da que está sob o ponteiro e para
       na primeira que tem linha — a própria peça, quando a seção está aberta; a
       seção, quando não está.

       Sobe pelo DOM, e não pelo documento: a aninhagem visual é a mesma, e aqui
       já se tem o elemento na mão. */
    const linhaVisivelDe = (peca) => {
      let atual = peca;
      while (atual) {
        const id = atual.getAttribute("data-puck-component");
        const linha = id && hospedeiro.querySelector(`[data-puck-layer-tree-id="${id}"]`);
        if (linha) return linha;
        atual = atual.parentElement?.closest("[data-puck-component]") || null;
      }
      return null;
    };

    const aoEntrar = (evento) => {
      /* Durante um arrasto o realce só atrapalha — mesma razão do realce da
         gaveta, logo abaixo. */
      if (evento.buttons) { apagar(); return; }
      const peca = evento.target?.closest?.("[data-puck-component]");
      if (!peca) { apagar(); return; }
      acender(linhaVisivelDe(peca));
    };

    doc.addEventListener("pointerover", aoEntrar, true);
    doc.addEventListener("pointerleave", apagar, true);
    return () => {
      doc.removeEventListener("pointerover", aoEntrar, true);
      doc.removeEventListener("pointerleave", apagar, true);
      apagar();
    };
  }, [raiz]);
}

function useAcenderNaGaveta(raiz, pegarPuck) {
  useEffect(() => {
    const alvo = raiz.current;
    if (!alvo) return undefined;
    const doc = alvo.ownerDocument;
    const hospedeiro = doc.defaultView?.parent?.document || null;
    if (!hospedeiro) return undefined;

    let aceso = null;

    const apagar = () => {
      if (aceso) aceso.classList.remove("puck-gaveta-aceso");
      aceso = null;
    };

    const acender = (rotulo) => {
      const item = [...hospedeiro.querySelectorAll("[class*='Drawer'] *")]
        .find((e) => e.children.length === 0 && e.textContent.trim() === rotulo);
      const caixa = item?.closest("[class*='DrawerItem'], [class*='Drawer'] > *") || null;
      if (caixa === aceso) return;
      apagar();
      if (caixa) {
        caixa.classList.add("puck-gaveta-aceso");
        aceso = caixa;
      }
    };

    const aoEntrar = (evento) => {
      /* Durante um arrasto o realce só atrapalha: a atenção está na prancheta,
         e a gaveta piscando no canto rouba o olho do que importa. */
      if (evento.buttons) { apagar(); return; }

      const peca = evento.target?.closest?.("[data-puck-component]");
      if (!peca) { apagar(); return; }

      const puck = pegarPuck();
      const item = puck.getItemById?.(peca.getAttribute("data-puck-component"));
      const rotulo = puck.config?.components?.[item?.type]?.label;
      if (rotulo) acender(rotulo); else apagar();
    };

    doc.addEventListener("pointerover", aoEntrar, true);
    doc.addEventListener("pointerleave", apagar, true);
    return () => {
      doc.removeEventListener("pointerover", aoEntrar, true);
      doc.removeEventListener("pointerleave", apagar, true);
      apagar();
    };
  }, [raiz, pegarPuck]);
}
