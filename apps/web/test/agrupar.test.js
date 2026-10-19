import test from "node:test";
import assert from "node:assert/strict";
import { agruparCom, agruparComAnterior, arrumarColunas, cabeAoLado, comPropsNasPecasDaSecao, desagrupar, levarParaOFim, pecasDaSecao, estaAgrupada, motivoParaNaoAgrupar, moverJunto, ordemDasPecas, podarSecoesVazias, removerPeca, temAnterior } from "../src/puck/agrupar.js";

/* ── O que esta suíte guarda ─────────────────────────────────────────────────

   Pôr duas peças lado a lado e desfazer — a operação que substitui, na árvore, o
   gesto que o editor de coordenadas fazia com um arrasto.

   O risco aqui é o mesmo do tradutor: PERDER uma peça em silêncio. Uma
   transformação de árvore que erra o índice não lança erro nenhum; ela devolve
   um documento válido com um widget a menos, e a pessoa só descobre quando
   procura por ele.
   ────────────────────────────────────────────────────────────────────────── */

const p = (id, type = "Widget_text") => ({ type, props: { id } });
const secao = (id, filhos) => ({ type: "Secao", props: { id, colunas: filhos.length, conteudo: filhos } });

const ids = (lista) => (lista || []).map((i) => i.props.id);

test("duas peças soltas viram uma seção de duas colunas", () => {
  const novo = agruparComAnterior([p("a"), p("b"), p("c")], "b");
  assert.equal(novo.length, 2);
  assert.equal(novo[0].type, "Secao");
  assert.equal(novo[0].props.colunas, 2);
  assert.deepEqual(ids(novo[0].props.conteudo), ["a", "b"]);
  assert.deepEqual(ids(novo.slice(1)), ["c"]);
});

test("nenhuma peça se perde no caminho", () => {
  /* A conta que importa: quantas peças existiam antes, quantas depois. Um
     índice errado devolve documento válido com um widget a menos. */
  const antes = [p("a"), p("b"), p("c"), p("d")];
  const novo = agruparComAnterior(antes, "c");
  const contar = (lista) => (lista || []).reduce(
    (n, i) => n + (i.type === "Secao" ? contar(i.props.conteudo) : 1), 0);
  assert.equal(contar(novo), 4);
});

test("agrupar de novo entra na MESMA seção, e não cria uma dentro da outra", () => {
  /* Pedir três vezes tem de dar três colunas. Aninhar seções seria o oposto do
     que se pediu, e a Estrutura viraria uma escada. */
  const novo = agruparComAnterior([secao("s1", [p("a"), p("b")]), p("c")], "c");
  assert.equal(novo.length, 1);
  assert.equal(novo[0].props.colunas, 3);
  assert.deepEqual(ids(novo[0].props.conteudo), ["a", "b", "c"]);
});

test("a primeira peça da lista não tem com quem agrupar", () => {
  assert.equal(agruparComAnterior([p("a"), p("b")], "a"), null);
  assert.equal(temAnterior([p("a"), p("b")], "a"), false);
  assert.equal(temAnterior([p("a"), p("b")], "b"), true);
});

test("acima de quatro colunas a seção recusa", () => {
  // Quatro é o teto da `Secao`. Aceitar a quinta produziria colunas ilegíveis.
  const cheia = secao("s1", [p("a"), p("b"), p("c"), p("d")]);
  assert.equal(agruparComAnterior([cheia, p("e")], "e"), null);
});

test("desagrupar tira a peça da seção e a põe logo abaixo", () => {
  const novo = desagrupar([secao("s1", [p("a"), p("b"), p("c")]), p("z")], "b");
  assert.deepEqual(ids(novo), ["s1", "b", "z"]);
  assert.deepEqual(ids(novo[0].props.conteudo), ["a", "c"]);
  assert.equal(novo[0].props.colunas, 2);
});

test("seção que ficaria com uma peça só se DISSOLVE", () => {
  /* "Seção de uma coluna" é invólucro sem função: não muda o desenho e polui a
     Estrutura com um nível a mais. */
  const novo = desagrupar([secao("s1", [p("a"), p("b")])], "b");
  assert.deepEqual(ids(novo), ["a", "b"]);
  assert.ok(novo.every((i) => i.type !== "Secao"));
});

test("peça fora de seção não tem o que desagrupar", () => {
  assert.equal(desagrupar([p("a"), p("b")], "a"), null);
  assert.equal(estaAgrupada([p("a")], "a"), false);
  assert.equal(estaAgrupada([secao("s1", [p("a"), p("b")])], "a"), true);
});

test("a peça é encontrada mesmo aninhada — o Puck entrega id, não endereço", () => {
  const doc = [p("topo"), secao("s1", [p("x"), p("y")]), p("fim")];
  assert.equal(temAnterior(doc, "y"), true);
  const novo = agruparComAnterior(doc, "fim");
  assert.equal(novo[1].type, "Secao");
  assert.deepEqual(ids(novo[1].props.conteudo), ["x", "y", "fim"]);
});

/* ── Agrupar com um alvo escolhido ─────────────────────────────────────────
   É o que o arrasto usa: o alvo não é "a de cima", é aquela sobre a qual o
   ponteiro parou — e o lado importa, porque soltar pela esquerda tem de pôr a
   peça na primeira coluna. */

test("soltar à direita põe a peça DEPOIS do alvo", () => {
  const novo = agruparCom([p("a"), p("b"), p("c")], "c", "a", "direita");
  assert.equal(novo[0].type, "Secao");
  assert.deepEqual(ids(novo[0].props.conteudo), ["a", "c"]);
  assert.deepEqual(ids(novo.slice(1)), ["b"]);
});

test("soltar à esquerda põe a peça ANTES do alvo", () => {
  const novo = agruparCom([p("a"), p("b"), p("c")], "c", "a", "esquerda");
  assert.deepEqual(ids(novo[0].props.conteudo), ["c", "a"]);
});

test("a seção nasce no lugar do ALVO, não no da peça arrastada", () => {
  /* Quem se mudou foi a peça; o lugar na página continua sendo o do alvo.
     Trocar isso faria a página inteira pular de posição num arrasto curto. */
  const novo = agruparCom([p("x"), p("alvo"), p("y"), p("arrastada")], "arrastada", "alvo");
  assert.deepEqual(novo.map((i) => (i.type === "Secao" ? "SEC" : i.props.id)), ["x", "SEC", "y"]);
});

test("soltar sobre uma seção entra nela, do lado certo", () => {
  const novo = agruparCom([secao("s1", [p("a"), p("b")]), p("c")], "c", "s1", "esquerda");
  assert.equal(novo.length, 1);
  assert.deepEqual(ids(novo[0].props.conteudo), ["c", "a", "b"]);
  assert.equal(novo[0].props.colunas, 3);
});

test("soltar sobre si mesma não faz nada", () => {
  assert.equal(agruparCom([p("a"), p("b")], "a", "a"), null);
});

test("a peça SAI da seção sozinha para juntar com uma de fora", () => {
  /* Antes isto recusava, e a recusa era tecnicamente correta e errada como
     produto: quem arrasta um widget de dentro de uma seção para o lado de outro
     está pedindo que ele saia de lá. Mandar "tire da seção antes" devolve ao
     usuário um trabalho que a ferramenta sabe fazer. */
  const doc = [secao("s1", [p("a"), p("b"), p("c")]), p("z")];
  const novo = agruparCom(doc, "a", "z");
  assert.ok(novo, "recusou o que devia resolver sozinho");

  const secaoRestante = novo.find((i) => i.type === "Secao" && i.props.conteudo.some((f) => f.props.id === "b"));
  assert.deepEqual(ids(secaoRestante.props.conteudo), ["b", "c"], "a peça não saiu da seção de origem");

  const nova = novo.find((i) => i.type === "Secao" && i.props.conteudo.some((f) => f.props.id === "z"));
  assert.deepEqual(ids(nova.props.conteudo), ["z", "a"]);
});

test("a seção de origem se DISSOLVE se ficar com uma peça", () => {
  const doc = [secao("s1", [p("a"), p("b")]), p("z")];
  const novo = agruparCom(doc, "a", "z");
  const contar = (lista) => (lista || []).reduce(
    (n, i) => n + (i.type === "Secao" ? contar(i.props.conteudo) : 1), 0);
  assert.equal(contar(novo), 3, "peça perdida ao dissolver");
  // Sobrou UMA seção: a nova. A antiga virou a peça solta que restava.
  const secoes = novo.filter((i) => i.type === "Secao");
  assert.equal(secoes.length, 1);
});

test("agrupar por arrasto também não perde peça", () => {
  const antes = [p("a"), p("b"), p("c"), p("d")];
  const novo = agruparCom(antes, "d", "b");
  const contar = (lista) => (lista || []).reduce(
    (n, i) => n + (i.type === "Secao" ? contar(i.props.conteudo) : 1), 0);
  assert.equal(contar(novo), 4);
});

/* ── Por que a recusa precisa ter motivo ───────────────────────────────────
   Soltar e nada mudar é indistinguível de defeito: a pessoa repete o gesto,
   conclui que a ferramenta falhou, e nunca descobre qual era o limite. Estes
   casos garantem que a prévia do arrasto tem o que dizer em cada recusa — e
   que ela concorda com `agruparCom`, que é quem de fato recusa. */

test("seção cheia recusa, e diz que está cheia", () => {
  const cheia = secao("s1", [p("a"), p("b"), p("c"), p("d")]);
  const doc = [cheia, p("e")];
  const motivo = motivoParaNaoAgrupar(doc, "e", "s1");
  assert.match(motivo, /4 colunas/);
  // A prévia e a transformação têm de concordar.
  assert.equal(agruparCom(doc, "e", "s1"), null);
});

test("níveis diferentes NÃO recusam mais — a peça sai da seção", () => {
  const doc = [secao("s1", [p("a"), p("b")]), p("z")];
  assert.equal(motivoParaNaoAgrupar(doc, "a", "z"), null);
  assert.ok(agruparCom(doc, "a", "z"));
});

test("soltar sobre si mesma recusa", () => {
  assert.ok(motivoParaNaoAgrupar([p("a"), p("b")], "a", "a"));
});

test("quando dá, não há motivo nenhum", () => {
  const doc = [p("a"), p("b")];
  assert.equal(motivoParaNaoAgrupar(doc, "b", "a"), null);
  assert.ok(agruparCom(doc, "b", "a"));
});

test("seção com três colunas ainda aceita a quarta", () => {
  // O limite é quatro; recusar na terceira seria inventar um teto que não existe.
  const doc = [secao("s1", [p("a"), p("b"), p("c")]), p("d")];
  assert.equal(motivoParaNaoAgrupar(doc, "d", "s1"), null);
  assert.equal(agruparCom(doc, "d", "s1")[0].props.colunas, 4);
});

/* ── Seção vazia, e mover várias de uma vez ──────────────────────────────────

   As duas operações que a seleção múltipla trouxe. O risco delas é o mesmo do
   resto desta suíte, e por isso os testes contam peças: uma transformação que
   erra o índice devolve um documento válido com uma peça a menos.
   ────────────────────────────────────────────────────────────────────────── */

const contarTudo = (lista) => (lista || []).reduce(
  (n, i) => n + 1 + (i.props?.conteudo ? contarTudo(i.props.conteudo) : 0), 0);

test("seção que ficou sem peça dentro deixa de existir", () => {
  const doc = [p("a"), secao("s", [])];
  const podado = podarSecoesVazias(doc);
  assert.deepEqual(ids(podado), ["a"]);
});

test("seção com peça dentro fica onde está", () => {
  assert.equal(podarSecoesVazias([p("a"), secao("s", [p("b")])]), null);
});

test("seção que só continha outra seção vazia some junto", () => {
  /* Descer primeiro e decidir depois: uma varredura de um nível só deixaria a
     casca de fora — o mesmo defeito, um nível acima. */
  const podado = podarSecoesVazias([p("a"), secao("fora", [secao("dentro", [])])]);
  assert.deepEqual(ids(podado), ["a"]);
});

test("tirar a última peça de uma seção leva a seção junto", () => {
  const doc = [p("a"), secao("s", [p("b")])];
  const podado = podarSecoesVazias(removerPeca(doc, "b"));
  assert.deepEqual(ids(podado), ["a"]);
});

test("a ordem das peças é a da PÁGINA, e o que está dentro vem depois de quem contém", () => {
  const doc = [p("a"), secao("s", [p("b"), p("c")]), p("d")];
  assert.deepEqual(ordemDasPecas(doc), ["a", "s", "b", "c", "d"]);
});

test("mover várias junta as outras logo depois da âncora", () => {
  const doc = [p("a"), p("b"), p("c"), p("d")];
  const novo = moverJunto(doc, ["a", "c"], "a");
  assert.deepEqual(ids(novo), ["a", "c", "b", "d"]);
});

test("mover várias preserva a ordem da página, e não a ordem em que foram clicadas", () => {
  /* Selecionar de baixo para cima e arrastar não pode inverter a página. */
  const doc = [p("a"), p("b"), p("c"), p("d")];
  assert.deepEqual(ids(moverJunto(doc, ["d", "b", "a"], "a")), ["a", "b", "d", "c"]);
});

test("mover várias tira as outras de dentro de seções, e nenhuma se perde", () => {
  const doc = [p("a"), secao("s", [p("b"), p("c")]), p("d")];
  const novo = moverJunto(doc, ["d", "b"], "d");
  assert.equal(contarTudo(novo), contarTudo(doc));
  assert.deepEqual(ids(novo), ["a", "s", "d", "b"]);
  assert.deepEqual(ids(novo[1].props.conteudo), ["c"]);
});

test("mover com só a âncora selecionada não mexe em nada", () => {
  assert.equal(moverJunto([p("a"), p("b")], ["a"], "a"), null);
});

/* ── "Ao lado" nunca é recusado por estrutura ───────────────────────────────

   A recusa "esta peça não pode ser juntada com a de dentro de outra seção" era
   coerente com a árvore e errada como produto: ninguém arrasta para a lateral
   querendo aninhar. Estes testes seguram a regra nova — sobra uma recusa só, e
   ela é de capacidade.
   ────────────────────────────────────────────────────────────────────────── */

test("peça de uma seção entra na seção do alvo, e não é recusada", () => {
  const doc = [secao("s1", [p("a"), p("b")]), secao("s2", [p("c"), p("d")])];
  assert.equal(motivoParaNaoAgrupar(doc, "a", "c"), null);
  const novo = agruparCom(doc, "a", "c");
  const alvo = novo.find((i) => i.props.id === "s2");
  assert.deepEqual(ids(alvo.props.conteudo), ["c", "a", "d"]);
});

test("a seção que perdeu a peça e ficou com uma se dissolve", () => {
  const doc = [secao("s1", [p("a"), p("b")]), secao("s2", [p("c"), p("d")])];
  const novo = agruparCom(doc, "a", "c");
  assert.equal(novo.filter((i) => i.type === "Secao").length, 1);
  assert.ok(ids(novo).includes("b"), "a peça que sobrou volta para a lista de fora");
});

test("a única recusa que sobra é de capacidade", () => {
  const cheia = [p("x"), secao("s", [p("1"), p("2"), p("3"), p("4")])];
  assert.match(motivoParaNaoAgrupar(cheia, "x", "1"), /4 colunas/);
  assert.equal(agruparCom(cheia, "x", "1"), null);
});

test("mover de lugar DENTRO de uma seção cheia continua valendo", () => {
  /* Ela não cresce: a peça já morava lá. Sem esta conta, arrastar a quarta
     coluna para a ponta da linha seria recusado como se fosse uma quinta. */
  const cheia = [p("x"), secao("s", [p("1"), p("2"), p("3"), p("4")])];
  assert.equal(motivoParaNaoAgrupar(cheia, "4", "1"), null);
  const novo = agruparCom(cheia, "4", "1", "esquerda");
  assert.deepEqual(ids(novo.find((i) => i.type === "Secao").props.conteudo), ["4", "1", "2", "3"]);
});

test("colunas acompanham quantas peças a seção tem", () => {
  const doc = [secao("s", [p("a")])];
  doc[0].props.colunas = 3;
  assert.equal(arrumarColunas(doc)[0].props.colunas, 1);
});

test("colunas já certas não geram gravação", () => {
  assert.equal(arrumarColunas([secao("s", [p("a"), p("b")])]), null);
});

test("a seção em uso não é podada, mesmo vazia", () => {
  /* A da gaveta nasce vazia: sem esta exceção ela some no quadro em que é
     solta. */
  const doc = [p("a"), secao("nova", [])];
  assert.equal(podarSecoesVazias(doc, "nova"), null);
  assert.deepEqual(ids(podarSecoesVazias(doc)), ["a"]);
});

/* ── A seção repassa às peças de dentro ─────────────────────────────────────
   Arredondar ou colar estilo numa seção vale para os widgets que ela contém,
   inclusive os de uma seção aninhada — e nunca para a própria seção. */
test("pecasDaSecao: as folhas, descendo pelas seções aninhadas", () => {
  const doc = [p("cab"), secao("s1", [p("a"), secao("s2", [p("b"), p("c")])]), p("fora")];
  assert.deepEqual(ids(pecasDaSecao(doc, "s1")), ["a", "b", "c"]);
  assert.deepEqual(ids(pecasDaSecao(doc, "s2")), ["b", "c"]);
  assert.deepEqual(pecasDaSecao(doc, "nao-existe"), []);
});

test("comPropsNasPecasDaSecao: escreve nas peças, não na seção, e respeita o null", () => {
  const doc = [secao("s1", [p("a"), p("b", "BlocoTitulo")]), p("fora")];
  const novo = comPropsNasPecasDaSecao(doc, "s1", (peca) => (peca.type === "BlocoTitulo" ? null : { arredondamento: 30 }));
  const [s1] = novo;
  assert.equal(s1.props.arredondamento, undefined, "a seção não recebe");
  assert.equal(s1.props.conteudo[0].props.arredondamento, 30);
  assert.equal(s1.props.conteudo[1].props.arredondamento, undefined, "null deixa a peça como está");
  assert.equal(novo[1], doc[1], "o que está fora da seção não é tocado");
  assert.equal(comPropsNasPecasDaSecao(doc, "s1", () => null), null, "nada a mudar → null");
});

/* ── "Depois da seção", na Estrutura ── */
test("levarParaOFim: tira de onde estiver e põe por último, sem perder nada", () => {
  const doc = [p("cab"), p("rodape"), secao("s1", [p("a"), p("b")])];
  assert.deepEqual(ids(levarParaOFim(doc, "rodape")), ["cab", "s1", "rodape"]);
  const deDentro = levarParaOFim(doc, "b");
  assert.deepEqual(ids(deDentro), ["cab", "rodape", "s1", "b"]);
  assert.deepEqual(ids(deDentro[2].props.conteudo), ["a"]);
  assert.equal(levarParaOFim(doc, "s1"), null, "já é a última");
  assert.equal(levarParaOFim(doc, "nao-existe"), null);
});

/* ── A peça nova, colocada com um clique, ao lado de outra ──
   Ela ainda não tem id, então a pergunta é só de capacidade: a seção do alvo
   (ou o alvo, sendo seção) tem lugar para mais uma coluna? */
test("cabeAoLado: recusa só a seção cheia", () => {
  const doc = [p("a"), secao("s", [p("b"), p("c")]), secao("cheia", [p("d"), p("e"), p("f"), p("g")])];
  assert.equal(cabeAoLado(doc, "a"), true, "peça solta vira seção nova");
  assert.equal(cabeAoLado(doc, "b"), true, "seção de duas recebe a terceira");
  assert.equal(cabeAoLado(doc, "s"), true);
  assert.equal(cabeAoLado(doc, "d"), false, "seção de quatro não recebe a quinta");
  assert.equal(cabeAoLado(doc, "cheia"), false);
  assert.equal(cabeAoLado(doc, "nao-existe"), false);
});
