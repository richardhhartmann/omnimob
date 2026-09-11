import test from "node:test";
import assert from "node:assert/strict";
import { agruparEmFileiras, traduzirParaPuck } from "../src/puck/traduzirConfig.js";

/* ── O que esta suíte guarda ─────────────────────────────────────────────────

   A tradução de coordenadas para árvore, que é o coração da migração para o
   Puck. É função pura sobre o documento, então não toca no banco — como
   `normalizacao.test.js`.

   O risco aqui não é quebrar a tela: é **perder a página de um cliente em
   silêncio**. Uma peça que some, uma fileira que vira pilha, uma ordem trocada
   — nada disso lança erro, e o sintoma só aparece quando a vitrine já foi
   republicada. Por isso o que se verifica aqui é INTENÇÃO preservada, não
   formato bem montado.
   ────────────────────────────────────────────────────────────────────────── */

/** Uma peça no formato que `toPieces` produz. */
function peca(id, x, y, w = 50, h = 200) {
  return { id, kind: "widget", key: id, x, y, w, h, hidden: false };
}

test("a ordem de leitura manda: de cima para baixo", () => {
  const fileiras = agruparEmFileiras([peca("c", 0, 900), peca("a", 0, 100), peca("b", 0, 500)]);
  assert.deepEqual(fileiras.map((f) => f[0].id), ["a", "b", "c"]);
});

test("peças lado a lado viram UMA fileira, na ordem horizontal", () => {
  // Duas metades na mesma altura: era uma fileira de duas colunas.
  const fileiras = agruparEmFileiras([peca("direita", 50, 300), peca("esquerda", 0, 300)]);
  assert.equal(fileiras.length, 1);
  assert.deepEqual(fileiras[0].map((p) => p.id), ["esquerda", "direita"]);
});

test("alguns pixels de diferença no topo ainda são a mesma fileira", () => {
  /* Coordenada feita à mão nunca é exata. Sem tolerância, dois cartões
     "alinhados" a 12px de diferença viravam duas seções empilhadas — e a página
     traduzida ficava com o dobro da altura. */
  const fileiras = agruparEmFileiras([peca("a", 0, 300), peca("b", 50, 312)]);
  assert.equal(fileiras.length, 1);
});

test("peças EMPILHADAS não viram colunas", () => {
  // Mesma coluna, alturas distantes: são duas seções, não duas colunas.
  const fileiras = agruparEmFileiras([peca("a", 0, 100), peca("b", 0, 600)]);
  assert.equal(fileiras.length, 2);
});

test("peças sobrepostas não viram colunas", () => {
  /* Sobreposição existe no formato antigo e não tem equivalente no Puck.
     O que NÃO se pode fazer é fingir que eram lado a lado: elas empilham, e o
     resultado é conferível. */
  const fileiras = agruparEmFileiras([peca("a", 0, 300, 60), peca("b", 40, 305, 60)]);
  assert.equal(fileiras.length, 2);
});

test("uma fileira de duas peças vira uma Secao de duas colunas", () => {
  const { data } = traduzirParaPuck({
    widgets: [
      { id: "w1", type: "text", title: "A", x: 0, y: 300, w: 50, h: 200 },
      { id: "w2", type: "text", title: "B", x: 50, y: 300, w: 50, h: 200 },
    ],
    hiddenBlocks: ["header", "title", "highlights", "properties", "footer"],
  });
  const secao = data.content.find((i) => i.type === "Secao");
  assert.ok(secao, "a fileira não virou seção");
  assert.equal(secao.props.colunas, 2);
  assert.equal(secao.props.conteudo.length, 2);
  // O widget viaja INTEIRO: é o que faz o `ShowcaseWidget` continuar servindo.
  assert.equal(secao.props.conteudo[0].props.widget.title, "A");
  /* E vira o componente do PRÓPRIO tipo, não o genérico: é o que dá nome à peça
     na estrutura e campos no inspetor. Uma página migrada com catorze peças
     chamadas "Peça da vitrine" e sem opção nenhuma foi o defeito que isto
     fecha. */
  assert.equal(secao.props.conteudo[0].type, "Widget_text");
});

test("peça oculta não é trazida — e a tradução AVISA", () => {
  const { data, avisos } = traduzirParaPuck({
    widgets: [
      { id: "w1", type: "text", title: "Visível", x: 0, y: 300, w: 100, h: 200 },
      { id: "w2", type: "text", title: "Oculta", x: 0, y: 700, w: 100, h: 200, hidden: true },
    ],
    hiddenBlocks: ["header", "title", "highlights", "properties", "footer"],
  });
  const titulos = JSON.stringify(data);
  assert.ok(titulos.includes("Visível"));
  assert.ok(!titulos.includes("Oculta"));
  /* O aviso importa tanto quanto o corte: migração que descarta em silêncio é
     como a pessoa descobre, semanas depois, que a página perdeu um pedaço. */
  assert.ok(avisos.some((a) => /oculta/i.test(a)), `avisos: ${JSON.stringify(avisos)}`);
});

test("o descarte do layout mobile é anunciado", () => {
  const { avisos } = traduzirParaPuck({ widgets: [] });
  assert.ok(
    avisos.some((a) => /mobile/i.test(a)),
    "o mobile sumiu sem avisar — é a perda mais fácil de não perceber",
  );
});

test("os blocos fixos viram componentes de nome próprio", () => {
  const { data } = traduzirParaPuck({ widgets: [] });
  const tipos = data.content.map((i) => i.type);
  for (const esperado of ["BlocoCabecalho", "BlocoTitulo", "BlocoDestaques", "BlocoImoveis", "BlocoRodape"]) {
    assert.ok(tipos.includes(esperado) || JSON.stringify(data).includes(esperado), `faltou ${esperado}`);
  }
});

test("todo item traduzido tem id — o Puck exige", () => {
  const { data } = traduzirParaPuck({
    widgets: [{ id: "w1", type: "text", title: "A", x: 0, y: 300, w: 50, h: 200 }],
  });
  const semId = [];
  const varrer = (itens) => {
    for (const item of itens || []) {
      if (!item.props?.id) semId.push(item.type);
      if (Array.isArray(item.props?.conteudo)) varrer(item.props.conteudo);
    }
  };
  varrer(data.content);
  assert.deepEqual(semId, [], "item sem id não é montável pelo Puck");
});

test("cada bloco fixo leva o próprio estilo, e as cores em campos editáveis", () => {
  const { data } = traduzirParaPuck({
    blockStyles: {
      header: { backgroundColor: "#101828", color: "#fff", backgroundImage: "https://x/y.jpg" },
      footer: { backgroundColor: "#000000" },
    },
    footerTitle: "Fale com a gente",
    widgets: [],
  });
  const cabecalho = data.content.find((i) => i.type === "BlocoCabecalho");
  assert.equal(cabecalho.props.backgroundColor, "#101828");
  assert.equal(cabecalho.props.color, "#fff");
  /* O banner virou campo do inspetor, e por isso sai para prop própria — mas o
     objeto inteiro continua viajando em `estilo`. É o que faz um campo novo no
     `blockStyles` sobreviver a um Publish antes de ganhar controle aqui; sem
     isso ele se perderia em silêncio, que é o modo de falhar que esta migração
     não pode ter. */
  assert.equal(cabecalho.props.backgroundImage, "https://x/y.jpg");
  assert.equal(cabecalho.props.estilo.backgroundImage, "https://x/y.jpg");

  const rodape = data.content.find((i) => i.type === "BlocoRodape");
  assert.equal(rodape.props.footerTitle, "Fale com a gente");
});

test("tipo de widget desconhecido cai no genérico em vez de sumir", () => {
  /* Acontece com widget gravado por uma versão que tinha um tipo aposentado.
     Perder a peça em silêncio seria pior que mostrá-la sem nome próprio. */
  const { data } = traduzirParaPuck({
    widgets: [{ id: "w1", type: "coisa-que-nao-existe", title: "Antiga", x: 0, y: 300, w: 100, h: 200 }],
    hiddenBlocks: ["header", "title", "highlights", "properties", "footer"],
  });
  const item = data.content.find((i) => String(i.type).startsWith("Widget"));
  assert.equal(item.type, "Widget");
  assert.equal(item.props.widget.title, "Antiga");
});
