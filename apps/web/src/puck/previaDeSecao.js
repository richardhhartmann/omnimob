/* ────────────────────────────────────────────────────────────────────────────
   A PRÉVIA DO QUE VAI ACONTECER AO SOLTAR.

   A primeira versão era uma barra vertical na borda do alvo. Ela dizia ONDE a
   peça entraria, e não O QUE ia acontecer — quem arrastava só descobria depois
   de soltar. Um gesto que só se confirma no resultado é um gesto que a pessoa
   testa duas ou três vezes antes de confiar.

   São três respostas possíveis, e a prévia dá uma cara para cada:

     colunas   a página se REORGANIZA ao vivo: o alvo encolhe para metade da
               largura deslizando para um lado, e a peça arrastada pula do
               ponteiro para o espaço que abriu, translúcida. É a seção
               acontecendo antes de existir, e não um desenho dela.
     empilhar  a página ABRE ESPAÇO: o alvo desliza (margem animada) e a peça
               arrastada pula para a vaga, translúcida, em cima ou embaixo dele
               conforme a metade em que o ponteiro está. É o mesmo desenho das
               colunas, na vertical — a pessoa vê a ordem nova antes de soltar.
               (Houve uma versão que só contornava o alvo; cobria a peça e
               disputava com a linha do Puck. Esta não cobre nada: abre.)
     recusa    uma moldura em tom de aviso, com o MOTIVO. Soltar e nada mudar é
               indistinguível de defeito: a pessoa repete o gesto e nunca
               descobre que o limite era de quatro colunas.

   ── ENCOLHE POR `transform`, E NUNCA POR `width` ──

   A primeira versão desta prévia mudava a LARGURA do alvo para 50%, e na tela
   deu errado de três jeitos ao mesmo tempo:

     · o conteúdo do alvo REFLUIU — o bloco de Destaques, com três cartões numa
       linha, quebrou em duas e jogou um cartão para fora da folha;
     · a página abaixo dele andou, porque a altura mudou junto;
     · o layout mexendo por baixo do gesto realimentava o teste de acerto, e a
       prévia piscava. Era o laço que o comentário antigo daqui temia.

   A saída foi `transform: scale(.5)`, que não participa do layout. Ela resolveu
   os três — e mentiu: as duas peças apareciam com METADE DA FONTE, e o que
   acontece ao soltar é outra coisa (a coluna estreita, o texto reflui, a altura
   cresce). Quem olhava via um tamanho que não ia existir.

   Hoje é largura de novo, e reflui igual ao resultado. O que tornou isso
   possível foi a trava da decisão — ver `mira`, em `PonteDeEdicao`: com o alvo
   e a caixa dele congelados ANTES de encolher, o reflow não tem como
   realimentar o teste de acerto. Era esse laço, e não a largura em si, que
   fazia a prévia piscar.

   E o que se mexe é CLASSE e ESTILO, nunca documento: nenhum `dispatch`,
   nenhuma prop, nada que o autosave enxergue. Ao soltar — ou ao desistir —
   tudo cai e a página volta exatamente ao que era.

   ── A PEÇA ARRASTADA QUE PULA É UM CLONE ──

   Ela não sai do lugar de verdade: sair deixaria um buraco no meio da página e
   empurraria tudo que vem depois, que é o oposto de uma prévia. O que pula para
   o espaço aberto é uma CÓPIA dela, translúcida e surda ao ponteiro; a original
   fica onde está, apagada, para o olho entender de onde a cópia veio.

   Vinda da gaveta não há o que copiar — a peça ainda não existe na página —, e
   aí o clone mostra o nome dela, que é o que se sabe dizer naquele momento.
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Cria a sobreposição da prévia, já anexada.
 *
 * @param {HTMLElement} raiz  onde a prévia é pendurada — e a referência de
 *   posição, para as contas serem relativas a ela.
 */
export function criarPreviaDeSecao(raiz) {
  const doc = raiz.ownerDocument;

  const caixa = doc.createElement("div");
  caixa.className = "puck-previa";
  caixa.hidden = true;

  const colunaAlvo = doc.createElement("div");
  colunaAlvo.className = "puck-previa__col puck-previa__col--alvo";

  const colunaNova = doc.createElement("div");
  colunaNova.className = "puck-previa__col puck-previa__col--nova";
  const rotulo = doc.createElement("span");
  colunaNova.appendChild(rotulo);

  caixa.append(colunaAlvo, colunaNova);
  raiz.appendChild(caixa);

  /* Quem está vestido de quê. Guardado para poder desfazer: a prévia não pode
     deixar rastro no DOM que o React governa. */
  let clone = null;
  let alvoVestido = null;
  let arrastadaApagada = null;
  let fantasmaDoPonteiro = null;

  /* ── O QUE SEGUE O PONTEIRO SOME QUANDO A PRÉVIA ENCAIXA ──────────────────

     Arrastando da gaveta, o Puck leva um cartão colado no cursor. Enquanto a
     peça está "no ar" ele é a única pista do que está sendo carregado — mas no
     instante em que a prévia encaixa, ele passa a ser uma segunda resposta para
     a mesma pergunta, e a errada: a peça já está desenhada no lugar onde vai
     cair, e o cartão continua dizendo que ela está na mão.

     Achado por medição e não por nome de classe: o cartão flutuante é o único
     `DrawerItem` posicionado — os da lista são estáticos. As classes do Puck
     têm sufixo de build, então casar pelo pedaço estável do nome e conferir a
     posição é o que sobrevive à próxima versão dele.

     Arrasto começado no CANVAS não tem cartão nenhum (o `dnd` está em
     `behavior: "static"`, e a peça fica onde está) — aqui a busca simplesmente
     não acha nada. */
  const esconderFantasmaDoPonteiro = () => {
    if (fantasmaDoPonteiro) return;
    const hospedeiro = doc.defaultView?.parent?.document;
    if (!hospedeiro) return;
    for (const el of hospedeiro.querySelectorAll("[class*='DrawerItem']")) {
      const pos = hospedeiro.defaultView.getComputedStyle(el).position;
      if (pos === "fixed" || pos === "absolute") {
        fantasmaDoPonteiro = el;
        el.style.setProperty("opacity", "0", "important");
        return;
      }
    }
  };

  const desvestir = () => {
    if (fantasmaDoPonteiro) {
      fantasmaDoPonteiro.style.removeProperty("opacity");
      fantasmaDoPonteiro = null;
    }
    if (clone) { clone.remove(); clone = null; }
    if (alvoVestido) {
      alvoVestido.classList.remove("puck-encolhe", "is-esquerda", "is-direita", "puck-abre", "is-antes", "is-depois");
      alvoVestido.style.removeProperty("--abre");
      alvoVestido = null;
    }
    if (arrastadaApagada) {
      arrastadaApagada.classList.remove("puck-fantasma");
      arrastadaApagada.style.removeProperty("opacity");
      arrastadaApagada = null;
    }
  };

  /** Põe a moldura sobre a peça-alvo. Só a recusa usa. */
  function posicionar(rect) {
    const base = raiz.getBoundingClientRect();
    caixa.hidden = false;
    caixa.style.top = `${rect.top - base.top}px`;
    caixa.style.left = `${rect.left - base.left}px`;
    caixa.style.width = `${rect.width}px`;
    caixa.style.height = `${rect.height}px`;
  }

  return {
    /**
     * A seção acontecendo: o alvo encolhe para um lado e a arrastada pula para
     * o outro.
     *
     * @param {HTMLElement} alvo            a peça que vai dividir a linha
     * @param {"esquerda"|"direita"} lado   onde a arrastada entra
     * @param {HTMLElement|null} arrastada  a peça na mão, quando ela já existe
     * @param {string} nome                 como chamá-la quando ela não existe
     * @param {DOMRect} caixa               a caixa do alvo ANTES de encolher —
     *   medi-la depois devolve a caixa já transformada, e o clone nasceria com
     *   metade do tamanho que devia (e depois escalado outra vez pela metade).
     */
    colunas(alvo, lado, arrastada, nome, caixaDoAlvo, copiaPronta) {
      /* `caixaDoAlvo`, e não `caixa`: o nome curto SOMBREAVA a sobreposição da
         recusa, que se chama `caixa` neste escopo — e `caixa.hidden = true`
         passou a marcar um DOMRect em vez de esconder a moldura. */
      caixa.hidden = true;

      /* Trocar de alvo no meio do gesto: o anterior volta ao normal ANTES de o
         novo encolher, senão dois ficariam pela metade ao mesmo tempo. */
      if (alvoVestido && alvoVestido !== alvo) desvestir();

      if (alvoVestido !== alvo) {
        alvo.classList.add("puck-encolhe");
        alvoVestido = alvo;
      }
      /* A peça entra pela ESQUERDA? Então quem anda para a direita é o alvo. */
      alvo.classList.toggle("is-esquerda", lado === "esquerda");
      alvo.classList.toggle("is-direita", lado !== "esquerda");

      esconderFantasmaDoPonteiro();

      if (arrastada && arrastadaApagada !== arrastada) {
        if (arrastadaApagada) {
          arrastadaApagada.classList.remove("puck-fantasma");
          arrastadaApagada.style.removeProperty("opacity");
        }
        arrastada.classList.add("puck-fantasma");
        /* ── A PEÇA NO AR SOME POR COMPLETO ──────────────────────────────────

           Descobri medindo que não existe "original parada" para apagar: o
           dnd-kit LEVANTA a própria peça — `position: fixed`, z-index no teto e
           uma translação que segue o ponteiro. Ela é o que está grudado na mão.

           Enquanto ela estava a 0.25 sobrava um rastro pálido atrás do cursor,
           e a pergunta "onde a peça vai cair?" tinha duas respostas na tela: o
           rastro e a cópia encaixada. Some inteira, e fica uma.

           Inline com `important` porque o dnd-kit também escreve opacidade ali;
           sai junto com a classe. */
        arrastada.style.setProperty("opacity", "0", "important");
        arrastadaApagada = arrastada;
      }

      if (!clone) {
        clone = doc.createElement("div");
        clone.className = "puck-clone";
        /* ── DENTRO DO INVÓLUCRO DA PONTE, E NÃO NO `body` ──────────────────
           A cópia PRECISA herdar as variáveis de tema da vitrine — cor
           primária, tinta, fonte. No `body` ela ficava fora delas e o widget
           saía sem cor nenhuma: o que aparecia era só a moldura da prévia, e
           não a peça.

           Ficar aqui exige que o invólucro seja bloco de contenção, e é o que a
           classe `puck-ponte` faz. Sem ela o clone ia parar fora da folha —
           `absolute` sobe até achar um ancestral posicionado, e achava qualquer
           um. */
        raiz.appendChild(clone);
      }

      /* O conteúdo é copiado UMA vez por peça arrastada. Refazer a cópia a cada
         movimento do ponteiro seria clonar uma árvore inteira sessenta vezes
         por segundo — e a peça não muda no meio do gesto. */
      /* A cópia vem PRONTA de quem escutou o `pointerdown` — feita antes de o
         dnd-kit encostar na peça. Ver `copiaLimpa`, em `PonteDeEdicao`: copiar
         durante o gesto trazia `position: fixed`, a translação do ponteiro e, em
         algumas peças, o miolo escondido. É trocada uma vez por peça arrastada:
         refazê-la a cada movimento clonaria uma árvore inteira sessenta vezes
         por segundo, e a peça não muda no meio do gesto. */
      const assinatura = arrastada ? arrastada.getAttribute("data-puck-component") : `nome:${nome}`;
      if (clone.dataset.de !== assinatura) {
        clone.dataset.de = assinatura;
        clone.innerHTML = "";
        if (copiaPronta) {
          clone.appendChild(copiaPronta.cloneNode(true));
        } else {
          const etiqueta = doc.createElement("span");
          etiqueta.className = "puck-clone__nome";
          etiqueta.textContent = nome || "a peça nova";
          clone.appendChild(etiqueta);
        }
      }

      /* ── ONDE O CLONE POUSA ─────────────────────────────────────────────
         Na caixa do ALVO, do tamanho dela, encolhido pela metade a partir do
         canto OPOSTO ao dele: as duas metades da caixa ficam ocupadas, uma por
         cada peça, e nenhuma das duas muda de tamanho no layout.

         Coordenadas de DOCUMENTO (rect + rolagem), porque agora ele mora no
         `body` do quadro. Ler a caixa no quadro seguinte é obrigatório: o
         `transform` do alvo só entra depois de o navegador aplicar a classe. */
      const desenhar = () => {
        if (!clone || alvoVestido !== alvo) return;
        const base = raiz.getBoundingClientRect();
        /* ── A METADE LIVRE, NO TAMANHO FINAL ───────────────────────────────
           Metade da caixa do alvo, do lado em que a peca entra. Sem escala: o
           conteudo reflui nessa largura exatamente como vai refluir depois de
           soltar. A altura fica por conta do conteudo — a linha resultante tem
           a altura da peca mais alta, e cravar a do alvo cortava a copia. */
        const metade = caixaDoAlvo.width / 2;
        clone.style.top = `${caixaDoAlvo.top - base.top}px`;
        clone.style.left = `${caixaDoAlvo.left - base.left + (lado === "esquerda" ? 0 : metade)}px`;
        clone.style.width = `${metade}px`;
        clone.style.height = "auto";
        clone.classList.add("is-posto");
      };
      requestAnimationFrame(desenhar);
    },

    /**
     * A pilha acontecendo: o alvo desliza para abrir a vaga, e a arrastada pula
     * para ela.
     *
     * @param {HTMLElement} alvo             a peça acima/abaixo da qual a arrastada entra
     * @param {"antes"|"depois"} posicao     onde a vaga abre
     * @param {HTMLElement|null} arrastada   a peça na mão, quando já existe
     * @param {string} nome                  como chamá-la quando não existe
     * @param {DOMRect} caixaDoAlvo          a caixa do alvo ANTES de deslizar
     * @param {number} altura                a altura da vaga (a da arrastada)
     */
    empilhar(alvo, posicao, arrastada, nome, caixaDoAlvo, copiaPronta, altura) {
      caixa.hidden = true;
      if (alvoVestido && alvoVestido !== alvo) desvestir();
      const vaga = Math.max(48, Math.round(altura || 0));
      if (alvoVestido !== alvo) {
        alvo.classList.add("puck-abre");
        alvoVestido = alvo;
      }
      alvo.style.setProperty("--abre", `${vaga}px`);
      alvo.classList.toggle("is-antes", posicao === "antes");
      alvo.classList.toggle("is-depois", posicao !== "antes");

      esconderFantasmaDoPonteiro();

      if (arrastada && arrastadaApagada !== arrastada) {
        if (arrastadaApagada) {
          arrastadaApagada.classList.remove("puck-fantasma");
          arrastadaApagada.style.removeProperty("opacity");
        }
        arrastada.classList.add("puck-fantasma");
        arrastada.style.setProperty("opacity", "0", "important");
        arrastadaApagada = arrastada;
      }

      if (!clone) {
        clone = doc.createElement("div");
        clone.className = "puck-clone";
        raiz.appendChild(clone);
      }
      const assinatura = arrastada ? arrastada.getAttribute("data-puck-component") : `nome:${nome}`;
      if (clone.dataset.de !== assinatura) {
        clone.dataset.de = assinatura;
        clone.innerHTML = "";
        if (copiaPronta) clone.appendChild(copiaPronta.cloneNode(true));
        else {
          const etiqueta = doc.createElement("span");
          etiqueta.className = "puck-clone__nome";
          etiqueta.textContent = nome || "a peça nova";
          clone.appendChild(etiqueta);
        }
      }

      /* A vaga: em cima, ela fica onde o alvo ESTAVA (ele desce); embaixo,
         logo depois dele. Largura do alvo, altura da arrastada. */
      const desenhar = () => {
        if (!clone || alvoVestido !== alvo) return;
        const base = raiz.getBoundingClientRect();
        clone.style.left = `${caixaDoAlvo.left - base.left}px`;
        clone.style.width = `${caixaDoAlvo.width}px`;
        clone.style.top = `${(posicao === "antes" ? caixaDoAlvo.top : caixaDoAlvo.bottom) - base.top}px`;
        clone.style.height = `${vaga}px`;
        clone.classList.add("is-posto");
      };
      requestAnimationFrame(desenhar);
    },

    /** Não dá para juntar, e o motivo aparece na etiqueta. */
    recusa(rect, motivo) {
      desvestir();
      posicionar(rect);
      caixa.dataset.modo = "recusa";
      caixa.style.flexDirection = "row";
      rotulo.textContent = motivo;
    },

    esconder() {
      caixa.hidden = true;
      desvestir();
    },

    remover() {
      desvestir();
      caixa.remove();
    },
  };
}
