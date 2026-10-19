/* ────────────────────────────────────────────────────────────────────────────
   PÔR DUAS PEÇAS LADO A LADO — E DESFAZER.

   O editor de coordenadas resolvia isso com um arrasto: bastava encostar uma
   peça na outra. A árvore do Puck não tem esse gesto, e não é falta de recurso
   da biblioteca — é a natureza dela. Cada zona de soltura é uma LISTA, então
   soltar significa sempre "antes ou depois de", nunca "à direita de, virando
   duas colunas". Não existe destino que represente isso.

   Então lado a lado vira uma AÇÃO, e não um gesto: seleciona-se a peça e pede-se
   para ela subir para junto da de cima. As duas viram uma `Secao` de duas
   colunas — a mesma que a tradução cria quando encontra peças lado a lado no
   formato antigo, para haver uma estrutura só na página e não duas.

   ── FUNÇÕES PURAS SOBRE O DOCUMENTO ──

   Nada aqui toca no Puck. Recebem a lista de itens e devolvem outra, o que
   permite testá-las sem montar editor nenhum — e é o que vai permitir, se um dia
   o agrupamento por arrasto for construído, reusar exatamente esta regra em vez
   de escrever uma segunda que divirja.

   ── A RECURSÃO É OBRIGATÓRIA ──

   A peça pode estar na raiz ou dentro de uma seção, e o caminho não é conhecido
   por quem chama — o Puck entrega um id, não um endereço. Por isso toda
   travessia desce pelos `slot`, que são as props que carregam listas de itens.
   ──────────────────────────────────────────────────────────────────────────── */

const MAXIMO_DE_COLUNAS = 4;

/** As props que carregam uma lista de peças — os `slot` do Puck. */
function listasDe(item) {
  return Object.entries(item?.props || {}).filter(([, v]) =>
    Array.isArray(v) && v.every((x) => x && typeof x === "object" && x.type && x.props));
}

function novoId(tipo) {
  const sufixo = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return `${tipo}-${sufixo}`;
}

function secaoCom(itens) {
  return {
    type: "Secao",
    props: {
      id: novoId("Secao"),
      colunas: Math.min(MAXIMO_DE_COLUNAS, itens.length),
      conteudo: itens,
    },
  };
}

/** Aplica `transformar` na lista que contém `id`, descendo pelos slots. */
function naListaDe(lista, id, transformar) {
  const i = (lista || []).findIndex((item) => item?.props?.id === id);
  if (i >= 0) return transformar(lista, i);

  let mudou = false;
  const saida = (lista || []).map((item) => {
    if (mudou) return item;
    let props = item.props;
    for (const [chave, dentro] of listasDe(item)) {
      const nova = naListaDe(dentro, id, transformar);
      if (nova) { props = { ...props, [chave]: nova }; mudou = true; break; }
    }
    return props === item.props ? item : { ...item, props };
  });
  return mudou ? saida : null;
}

/**
 * Junta a peça com a de cima, numa seção de colunas.
 *
 * Se a de cima JÁ é uma seção, a peça entra nela em vez de criar outra —
 * senão pedir três vezes produziria seções aninhadas em vez de três colunas,
 * que é o oposto do que se pediu.
 *
 * @returns {Array|null} a lista nova, ou `null` quando não há o que fazer
 *   (peça não encontrada, ou já é a primeira da lista).
 */
export function agruparComAnterior(conteudo, id) {
  return naListaDe(conteudo, id, (lista, i) => {
    if (i === 0) return null;
    const peca = lista[i];
    const anterior = lista[i - 1];

    if (anterior.type === "Secao") {
      const dentro = [...(anterior.props.conteudo || []), peca];
      if (dentro.length > MAXIMO_DE_COLUNAS) return null;
      const juntos = {
        ...anterior,
        props: { ...anterior.props, colunas: dentro.length, conteudo: dentro },
      };
      return [...lista.slice(0, i - 1), juntos, ...lista.slice(i + 1)];
    }

    return [...lista.slice(0, i - 1), secaoCom([anterior, peca]), ...lista.slice(i + 1)];
  });
}

/**
 * Tira a peça da seção e devolve para a lista de fora, logo abaixo dela.
 *
 * Seção que fica com uma peça só se DISSOLVE: uma "seção de uma coluna" é um
 * invólucro sem função que só atrapalha quem lê a Estrutura.
 *
 * @returns {Array|null} a lista nova, ou `null` se a peça não está numa seção.
 */
export function desagrupar(conteudo, id) {
  const varrer = (lista) => {
    let mudou = false;
    const saida = [];

    for (const item of lista || []) {
      if (mudou) { saida.push(item); continue; }

      if (item.type === "Secao") {
        const dentro = item.props.conteudo || [];
        const i = dentro.findIndex((f) => f?.props?.id === id);
        if (i >= 0) {
          const solta = dentro[i];
          const restam = dentro.filter((_, k) => k !== i);
          if (restam.length >= 2) {
            saida.push({ ...item, props: { ...item.props, colunas: restam.length, conteudo: restam } });
          } else if (restam.length === 1) {
            saida.push(restam[0]);
          }
          saida.push(solta);
          mudou = true;
          continue;
        }
      }

      let props = item.props;
      for (const [chave, lista2] of listasDe(item)) {
        const nova = varrer(lista2);
        if (nova) { props = { ...props, [chave]: nova }; mudou = true; break; }
      }
      saida.push(props === item.props ? item : { ...item, props });
    }
    return mudou ? saida : null;
  };

  return varrer(conteudo);
}

/** A peça está dentro de uma seção? É o que decide qual das duas ações oferecer. */
export function estaAgrupada(conteudo, id) {
  for (const item of conteudo || []) {
    if (item.type === "Secao" && (item.props.conteudo || []).some((f) => f?.props?.id === id)) return true;
    for (const [, dentro] of listasDe(item)) {
      if (estaAgrupada(dentro, id)) return true;
    }
  }
  return false;
}

/** Existe peça acima dela na mesma lista? Sem isso, agrupar não tem com quem. */
export function temAnterior(conteudo, id) {
  const achou = naListaDe(conteudo, id, (lista, i) => (i > 0 ? lista : null));
  return Boolean(achou);
}

/**
 * Junta a peça com OUTRA peça qualquer da mesma lista, de um lado escolhido.
 *
 * É a versão que o agrupamento por arrasto usa: ali o alvo não é "a de cima",
 * é aquela sobre a qual o ponteiro parou, e o lado importa — soltar pela
 * esquerda tem de pôr a peça na primeira coluna.
 *
 * `agruparComAnterior` continua existindo porque a AÇÃO da barra é outra
 * pergunta ("junte com a de cima"), e resolvê-la por aqui exigiria descobrir o
 * id do vizinho antes de chamar. Duas portas, uma regra: as duas terminam numa
 * `Secao` montada do mesmo jeito.
 *
 * @param {string} lado  "direita" ou "esquerda", em relação ao ALVO
 * @returns {Array|null} a lista nova, ou `null` quando não há o que fazer
 */
export function agruparCom(conteudo, id, alvoId, lado = "direita") {
  if (!id || !alvoId || id === alvoId) return null;

  /* ── UMA PEÇA AO LADO DE OUTRA É SEMPRE POSSÍVEL ─────────────────────────

     Esta função já recusou dois casos por motivo de ESTRUTURA: a peça estava
     dentro de uma seção, ou o alvo estava. A recusa era coerente com a árvore e
     errada como produto — quem arrasta uma peça para a lateral de outra está
     pedindo uma coisa só, "põe esta ao lado daquela", e a resposta "não dá
     porque uma delas está dentro de uma seção" devolve à pessoa um problema de
     modelagem que a ferramenta sabe resolver sozinha.

     Ninguém arrasta para o LADO querendo aninhar. Então o gesto passou a ter uma
     leitura só, e ela vale de qualquer lugar para qualquer lugar:

       1. a peça SAI de onde estiver (`removerPeca`);
       2. se o alvo mora dentro de uma seção, ela entra NAQUELA seção, encostada
          no alvo — que é literalmente "ao lado dele";
       3. senão, alvo e peça viram uma seção nova, no lugar onde o alvo estava.

     Sobra uma recusa, e ela é de CAPACIDADE e não de estrutura: seção cheia. Ver
     `motivoParaNaoAgrupar`, que precisa concordar com isto — se as duas
     discordarem, a mira promete o que o drop não entrega.
     ────────────────────────────────────────────────────────────────────────── */
  const peca = acharPeca(conteudo, id);
  const alvo = acharPeca(conteudo, alvoId);
  if (!peca || !alvo) return null;

  /* Soltar na lateral da própria casa não move nada — e o passo 1 esvaziaria a
     seção antes de o passo 2 devolver a peça a ela. */
  if (alvo.type === "Secao" && (alvo.props?.conteudo || []).some((x) => x?.props?.id === id)) return null;

  /* ── A CASA QUE A PEÇA DEIXA, SE FICAR COM UMA SÓ, SE DISSOLVE ──────────
     Seção de uma coluna é a peça sozinha com uma casca em volta: ela desenha o
     mesmo e ainda aparece na Estrutura como um nível a mais. Tirar a segunda
     peça de uma seção de duas é, na cabeça de quem edita, desfazer a seção.

     A regra é ANTIGA — vinha do `desagrupar` — e some se ninguém a escrever
     aqui: a passagem por `desagrupar` deixou de existir quando este gesto parou
     de recusar por estrutura. */
  const origem = (lista) => {
    for (const item of lista || []) {
      if (item.type === "Secao" && (item.props?.conteudo || []).some((x) => x?.props?.id === id)) return item;
      for (const [, dentro] of listasDe(item)) {
        const achado = origem(dentro);
        if (achado) return achado;
      }
    }
    return null;
  };
  const casaDeOrigem = origem(conteudo);

  let semAPeca = removerPeca(conteudo, id) || conteudo;

  if (casaDeOrigem && (casaDeOrigem.props.conteudo || []).length === 2) {
    const sobrou = (casaDeOrigem.props.conteudo || []).find((x) => x?.props?.id !== id);
    if (sobrou) {
      semAPeca = naListaDe(semAPeca, casaDeOrigem.props.id, (lista, i) => [
        ...lista.slice(0, i),
        sobrou,
        ...lista.slice(i + 1),
      ]) || semAPeca;
    }
  }

  /* Quem CONTÉM o alvo, se for uma seção. É a diferença entre "entra nesta
     linha" e "cria uma linha nova". */
  const secaoDoAlvo = (lista) => {
    for (const item of lista || []) {
      if (item.type === "Secao" && (item.props?.conteudo || []).some((x) => x?.props?.id === alvoId)) return item;
      for (const [, dentro] of listasDe(item)) {
        const achado = secaoDoAlvo(dentro);
        if (achado) return achado;
      }
    }
    return null;
  };

  const casa = secaoDoAlvo(semAPeca);

  if (casa) {
    const dentro = [...(casa.props.conteudo || [])];
    if (dentro.length + 1 > MAXIMO_DE_COLUNAS) return null;
    const k = dentro.findIndex((x) => x?.props?.id === alvoId);
    dentro.splice(lado === "esquerda" ? k : k + 1, 0, peca);
    return naListaDe(semAPeca, casa.props.id, (lista, i) => [
      ...lista.slice(0, i),
      { ...casa, props: { ...casa.props, colunas: dentro.length, conteudo: dentro } },
      ...lista.slice(i + 1),
    ]);
  }

  /* O alvo é a seção inteira: "ao lado dela" quer dizer entrar nela. */
  if (alvo.type === "Secao") {
    const dentro = [...(alvo.props.conteudo || [])];
    if (dentro.length + 1 > MAXIMO_DE_COLUNAS) return null;
    if (lado === "esquerda") dentro.unshift(peca); else dentro.push(peca);
    return naListaDe(semAPeca, alvoId, (lista, i) => [
      ...lista.slice(0, i),
      { ...alvo, props: { ...alvo.props, colunas: dentro.length, conteudo: dentro } },
      ...lista.slice(i + 1),
    ]);
  }

  const par = lado === "esquerda" ? [peca, alvo] : [alvo, peca];
  return naListaDe(semAPeca, alvoId, (lista, i) => [
    ...lista.slice(0, i),
    secaoCom(par),
    ...lista.slice(i + 1),
  ]);
}

/**
 * Por que estas duas peças NÃO podem virar colunas — ou `null` se podem.
 *
 * Existe para a prévia do arrasto poder EXPLICAR a recusa em vez de só não
 * acontecer. Soltar e nada mudar é indistinguível de defeito: a pessoa repete
 * o gesto, conclui que a ferramenta falhou, e nunca descobre que o limite era
 * de quatro colunas.
 *
 * A mesma regra que decide aqui é a que `agruparCom` aplica — se as duas
 * discordarem, a prévia promete o que o drop não entrega.
 */
export function motivoParaNaoAgrupar(conteudo, id, alvoId) {
  if (!id || !alvoId || id === alvoId) return "Solte sobre outra peça.";

  const peca = acharPeca(conteudo, id);
  const alvo = acharPeca(conteudo, alvoId);
  if (!peca || !alvo) return "Solte sobre outra peça.";

  if (alvo.type === "Secao" && (alvo.props?.conteudo || []).some((x) => x?.props?.id === id)) {
    return "Esta peça já está nesta seção.";
  }

  /* A ÚNICA recusa que sobrou é de CAPACIDADE. Estrutura deixou de recusar — ver
     o cabeçalho de `agruparCom`. A mensagem sobre "peça dentro de outra seção"
     foi embora junto com a regra que a produzia: ela dizia à pessoa que um gesto
     natural era proibido quando o que atrapalhava era só a árvore. */
  const cheia = (secao) => (secao?.props?.conteudo || []).length >= MAXIMO_DE_COLUNAS;

  const secaoDoAlvo = (lista) => {
    for (const item of lista || []) {
      if (item.type === "Secao" && (item.props?.conteudo || []).some((x) => x?.props?.id === alvoId)) return item;
      for (const [, dentro] of listasDe(item)) {
        const achado = secaoDoAlvo(dentro);
        if (achado) return achado;
      }
    }
    return null;
  };

  /* Peça que já mora na mesma seção do alvo não a faz crescer: ela só troca de
     lugar lá dentro. Sem esta conta, mover a terceira coluna para a ponta da
     linha seria recusado como se fosse uma quinta. */
  const casa = secaoDoAlvo(conteudo);
  const jaEstaNaCasa = Boolean(casa) && (casa.props.conteudo || []).some((x) => x?.props?.id === id);
  if (casa && !jaEstaNaCasa && cheia(casa)) return `Esta seção já tem ${MAXIMO_DE_COLUNAS} colunas.`;
  if (!casa && alvo.type === "Secao" && cheia(alvo)) return `Esta seção já tem ${MAXIMO_DE_COLUNAS} colunas.`;

  return null;
}

/**
 * Troca campos de UMA peça, onde quer que ela esteja na árvore.
 *
 * Existe aqui, junto das outras travessias, porque o problema é o mesmo: o
 * Puck entrega um id, não um endereço, e a peça pode estar dentro de uma
 * seção. Uma segunda travessia escrita noutro arquivo divergiria na primeira
 * estrutura aninhada nova.
 */
export function comProps(conteudo, id, novas) {
  return naListaDe(conteudo, id, (lista, i) => [
    ...lista.slice(0, i),
    { ...lista[i], props: { ...lista[i].props, ...novas } },
    ...lista.slice(i + 1),
  ]) || conteudo;
}

/* ── TIRAR UMA PEÇA DA ÁRVORE, ONDE QUER QUE ELA ESTEJA ─────────────────────
   O Puck já sabe excluir pelo menu da peça. Isto existe para o caso em que a
   peça precisa sumir sem que ninguém tenha pedido: a inserção que veio da
   gaveta e foi solta fora da prancheta. Ver `PonteDeEdicao`.

   Devolve `null` quando não achou — o chamador usa isso para não gravar
   documento igual ao que já tinha. */
export function removerPeca(conteudo, id) {
  return naListaDe(conteudo, id, (lista, i) => [...lista.slice(0, i), ...lista.slice(i + 1)]);
}

/* ── SEÇÃO SEM NADA DENTRO DEIXA DE EXISTIR ─────────────────────────────────

   Uma seção é a resposta a "estas peças formam uma linha". Sem peça nenhuma ela
   não responde nada: vira uma faixa invisível que continua ocupando lugar na
   estrutura, aparecendo no contorno de seleção e recebendo peças por engano.

   Tirar a última peça de dentro dela é, na cabeça de quem edita, desfazer a
   seção — e era preciso um segundo gesto (achar a casca e excluí-la) para o
   resultado bater com a intenção.

   ── POR QUE PODA RECURSIVA, E DE BAIXO PARA CIMA ──

   Seção pode conter seção. Apagar a de dentro esvazia a de fora, e uma varredura
   de um nível só deixaria a casca externa para trás — o mesmo defeito, um nível
   acima. Descer primeiro e decidir depois resolve as duas na mesma passada.

   ── E POR QUE SÓ `Secao` ──

   Outros componentes também têm slot (a lista de conteúdo de um widget, um dia).
   Vazio, ali, é um estado legítimo: um widget sem filhos continua desenhando o
   que ele é. Seção vazia não desenha nada. A regra é do componente, não do
   formato.

   Devolve `null` quando não havia o que podar. */
export function podarSecoesVazias(conteudo, pouparId = null) {
  let mudou = false;

  const podar = (lista) => (lista || []).reduce((saida, item) => {
    let props = item.props;
    for (const [chave, dentro] of listasDe(item)) {
      const nova = podar(dentro);
      if (nova.length !== dentro.length) { props = { ...props, [chave]: nova }; mudou = true; }
    }
    const atual = props === item.props ? item : { ...item, props };
    /* `pouparId` é a seção que está selecionada. Uma seção nova nasce vazia, e
       sem esta exceção ela seria apagada no mesmo quadro em que foi solta. Ver
       `PodarSecoesVazias`. */
    if (atual.type === "Secao" && !(atual.props?.conteudo || []).length && atual.props?.id !== pouparId) {
      mudou = true;
      return saida;
    }
    saida.push(atual);
    return saida;
  }, []);

  const saida = podar(conteudo);
  return mudou ? saida : null;
}

/* ── A ORDEM EM QUE AS PEÇAS APARECEM NA PÁGINA ────────────────────────────
   Achatada, e de cima para baixo: o que está dentro de uma seção vem logo
   depois dela. É a ordem que o shift+clique usa para recortar um intervalo — e
   ela precisa bater com o que o olho vê, e não com a estrutura do JSON. */
export function ordemDasPecas(conteudo) {
  const saida = [];
  const descer = (lista) => {
    for (const item of lista || []) {
      if (item?.props?.id) saida.push(item.props.id);
      for (const [, dentro] of listasDe(item)) descer(dentro);
    }
  };
  descer(conteudo);
  return saida;
}

/** A peça inteira, onde quer que ela esteja. `null` se não existe. */
export function acharPeca(conteudo, id) {
  for (const item of conteudo || []) {
    if (item?.props?.id === id) return item;
    for (const [, dentro] of listasDe(item)) {
      const achado = acharPeca(dentro, id);
      if (achado) return achado;
    }
  }
  return null;
}

/* ── MOVER VÁRIAS PEÇAS COMO UMA SÓ ─────────────────────────────────────────

   O arrasto do Puck move UMA peça: ele reordena a lista e pronto. Para levar
   várias juntas não há como pedir isso a ele — o que dá para fazer é deixá-lo
   mover a peça que está sob o ponteiro (a ÂNCORA) e, depois que ele terminou,
   trazer as outras para junto dela.

   O resultado é o que a pessoa pediu: as peças selecionadas terminam
   encostadas, na ordem em que estavam, no lugar onde ela soltou.

   ── POR QUE DEPOIS, E NÃO DURANTE ──

   Durante o gesto o documento é do Puck: ele reordena ao vivo e reescreve a
   lista a cada quadro. Mexer no meio disso é disputar a mesma estrutura com a
   biblioteca — e perder, porque o próximo quadro dela apaga o que fizemos.

   ── A ORDEM RELATIVA É PRESERVADA ──

   As outras entram na ordem em que apareciam na página, e não na ordem em que
   foram clicadas: selecionar de baixo para cima e arrastar não pode inverter a
   página. Por isso a lista de entrada é reordenada por `ordemDasPecas` antes.

   @returns {Array|null} a lista nova, ou `null` quando não há o que mover.
*/
export function moverJunto(conteudo, ids, ancoraId) {
  const outros = ordemDasPecas(conteudo).filter((x) => ids.includes(x) && x !== ancoraId);
  if (!outros.length) return null;

  /* Guarda as peças antes de arrancá-las: depois de removidas, não há onde
     procurá-las. */
  const pecas = outros.map((id) => acharPeca(conteudo, id)).filter(Boolean);
  if (!pecas.length) return null;

  let saida = conteudo;
  for (const id of outros) {
    const sem = removerPeca(saida, id);
    if (sem) saida = sem;
  }

  /* A âncora pode ter mudado de nível durante o arrasto (entrou numa seção, por
     exemplo). Procurar de novo, na lista já sem as outras, é o que faz o grupo
     pousar ONDE ela pousou — e não onde ela estava quando o gesto começou. */
  const comAsOutras = naListaDe(saida, ancoraId, (lista, i) => [
    ...lista.slice(0, i + 1),
    ...pecas,
    ...lista.slice(i + 1),
  ]);
  return comAsOutras || saida;
}

/* ── O NÚMERO DE COLUNAS É CONSEQUÊNCIA, NÃO CONFIGURAÇÃO ───────────────────

   `colunas` dizia quantas faixas a seção desenha, e era gravado por quem a
   criava. Só que ele parava de bater com a realidade no primeiro gesto: pôr uma
   quarta peça numa seção de três atualizava o número, mas ARRASTAR uma para
   fora não — a seção ficava com três colunas e duas peças, e a faixa que sobrava
   virava um vão que ninguém sabia de onde tinha vindo.

   A conta certa é uma só: a seção tem tantas colunas quantas peças ela contém.
   Derivar em vez de guardar acaba com a divergência por construção — não há dois
   números para manter iguais.

   O teto de quatro continua, e é o mesmo de `agruparCom`.

   Devolve `null` quando já estava tudo certo: o vigia usa isso para não gravar
   um documento igual ao que já tinha.
   ────────────────────────────────────────────────────────────────────────── */
export function arrumarColunas(conteudo) {
  let mudou = false;

  const arrumar = (lista) => (lista || []).map((item) => {
    let props = item.props;
    for (const [chave, dentro] of listasDe(item)) {
      const nova = arrumar(dentro);
      /* Item a item, e não `nova !== dentro`: `map` devolve SEMPRE um array
         novo, então a comparação por identidade dava "mudou" em toda varredura
         — e o vigia gravaria o mesmo documento sem parar. */
      if (nova.some((x, k) => x !== dentro[k])) { props = { ...props, [chave]: nova }; mudou = true; }
    }
    if (item.type === "Secao") {
      const quantas = Math.min(MAXIMO_DE_COLUNAS, (props.conteudo || []).length);
      if (quantas && props.colunas !== quantas) { props = { ...props, colunas: quantas }; mudou = true; }
    }
    return props === item.props ? item : { ...item, props };
  });

  const saida = arrumar(conteudo);
  return mudou ? saida : null;
}

/* ── O QUE SE FAZ NA SEÇÃO VALE PARA AS PEÇAS DE DENTRO ─────────────────────

   A seção só agrupa: ela não tem borda nem cartão. Arredondar uma seção, ou
   colar nela a aparência copiada, é pedir isso para cada widget que ela
   contém — mexer na seção em si seria um ajuste que a página não mostra
   (arredondar uma caixa sem fundo) ou que pinta uma faixa por trás das
   colunas que ninguém pediu.

   "Peças da seção" são as FOLHAS: uma seção dentro de outra é atravessada, e
   as peças dela entram também — a resposta para quem arredonda a de fora é
   "todos os cartões que eu vejo aqui dentro". */

/** As peças de dentro da seção `secaoId`, descendo pelas seções aninhadas. */
export function pecasDaSecao(conteudo, secaoId) {
  const secao = acharPeca(conteudo, secaoId);
  const saida = [];
  const descer = (item) => {
    for (const [, dentro] of listasDe(item)) {
      for (const filho of dentro) {
        if (filho.type === "Secao") descer(filho);
        else saida.push(filho);
      }
    }
  };
  if (secao) descer(secao);
  return saida;
}

/**
 * Troca campos de cada peça de dentro da seção. `propsDe(peca)` devolve as
 * props novas daquela peça, ou `null` para deixá-la como está.
 *
 * @returns {Array|null} a lista nova, ou `null` quando nada mudou.
 */
export function comPropsNasPecasDaSecao(conteudo, secaoId, propsDe) {
  let saida = conteudo;
  for (const peca of pecasDaSecao(conteudo, secaoId)) {
    const novas = propsDe(peca);
    if (novas) saida = comProps(saida, peca.props.id, novas);
  }
  return saida === conteudo ? null : saida;
}

/* ── LEVAR UMA PEÇA PARA O FIM DA PÁGINA ────────────────────────────────────
   O destino que a Estrutura do Puck não oferece quando a última peça da
   página é uma seção aberta: ali, tudo abaixo dela é "dentro da seção". Ver
   `ArrastoNaEstrutura`. Devolve `null` quando não há o que mover (peça
   inexistente, ou já é a última da página). */
export function levarParaOFim(conteudo, id) {
  const lista = conteudo || [];
  if (lista[lista.length - 1]?.props?.id === id) return null;
  const peca = acharPeca(lista, id);
  if (!peca) return null;
  const sem = removerPeca(lista, id);
  return sem ? [...sem, peca] : null;
}

/**
 * Cabe mais uma peça AO LADO deste alvo? Não cabe quando a seção em que ele
 * mora — ou ele mesmo, sendo seção — já tem o máximo de colunas.
 *
 * É a pergunta que `motivoParaNaoAgrupar` faz para uma peça que já existe,
 * feita para a peça NOVA da gaveta (colocada com um clique), que ainda não
 * tem id para conferir.
 */
export function cabeAoLado(conteudo, alvoId) {
  const alvo = acharPeca(conteudo, alvoId);
  if (!alvo) return false;
  const casaDoAlvo = (lista) => {
    for (const item of lista || []) {
      if (item.type === "Secao" && (item.props?.conteudo || []).some((x) => x?.props?.id === alvoId)) return item;
      for (const [, dentro] of listasDe(item)) {
        const achado = casaDoAlvo(dentro);
        if (achado) return achado;
      }
    }
    return null;
  };
  const casa = casaDoAlvo(conteudo) || (alvo.type === "Secao" ? alvo : null);
  return !casa || (casa.props?.conteudo || []).length < MAXIMO_DE_COLUNAS;
}
