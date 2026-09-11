import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

import { configVitrine } from "../src/puck/configVitrine.jsx";
import { ComBanner } from "../src/puck/ComBanner.jsx";
import { VitrineProvider } from "../src/components/showcase/contexto.jsx";
import { FONTES_REAIS } from "../src/components/builder/data/fontesReais.js";
import { WIDGET_LIBRARY } from "../src/components/builder/data/biblioteca.jsx";

/* ── O que esta suíte guarda ─────────────────────────────────────────────────

   As afordâncias que o editor clássico tinha e que precisaram ser reconstruídas
   no Puck: ocultar, travar, a trava de exclusão da grade de imóveis e a escolha
   entre dado real e texto à mão.

   O modo de falhar aqui é sempre o mesmo e é sempre silencioso: alguém
   acrescenta uma peça nova à config e esquece de envolvê-la, e aquela peça
   nasce sem os controles — sem erro, sem aviso, e ninguém percebe até um
   cliente perguntar por que só um bloco não trava.
   ────────────────────────────────────────────────────────────────────────── */

const PECAS = Object.entries(configVitrine.components);

/** Desenha um pedaço da vitrine com o contexto que os widgets exigem. */
function desenharNaVitrine(no) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <VitrineProvider modo="public" aoEditar={() => {}} tenantSlug="imobiliaria-teste">
        {no}
      </VitrineProvider>
    </MemoryRouter>,
  );
}

test("toda peça oferece ocultar e travar", () => {
  const faltando = PECAS
    .filter(([, c]) => !c.fields?.oculto || !c.fields?.travado)
    .map(([nome]) => nome);
  assert.deepEqual(faltando, [], "peça sem os controles que o editor antigo tinha");
});

test("travar uma peça tira arrastar, duplicar e excluir", () => {
  const [, cabecalho] = PECAS.find(([n]) => n === "BlocoCabecalho");
  const solta = cabecalho.resolvePermissions({ props: { travado: false } });
  const presa = cabecalho.resolvePermissions({ props: { travado: true } });

  assert.equal(solta.drag, true);
  assert.equal(presa.drag, false);
  assert.equal(presa.duplicate, false);
  assert.equal(presa.delete, false);
});

test("a grade de imóveis NÃO pode ser apagada, travada ou não", () => {
  /* Regra que já existia e se perdeu na migração: `services/vitrineIA.js`
     recusa qualquer plano que remova ou oculte `b:properties`. É a única peça
     sem a qual a vitrine deixa de ser uma vitrine, e apagá-la publica uma
     imobiliária sem imóvel nenhum — em silêncio. */
  const [, imoveis] = PECAS.find(([n]) => n === "BlocoImoveis");
  assert.equal(imoveis.resolvePermissions({ props: {} }).delete, false);
  assert.equal(imoveis.resolvePermissions({ props: { travado: true } }).delete, false);

  // E as outras continuam apagáveis — a exceção precisa ser exceção.
  const [, rodape] = PECAS.find(([n]) => n === "BlocoRodape");
  assert.equal(rodape.resolvePermissions({ props: {} }).delete, true);
});

test("os sete widgets que leem o cadastro deixam escolher a fonte", () => {
  for (const tipo of Object.keys(FONTES_REAIS)) {
    const peca = configVitrine.components[`Widget_${tipo}`];
    assert.ok(peca, `faltou o componente do widget ${tipo}`);
    assert.ok(peca.fields.usarDadosReais, `${tipo} não deixa escolher entre dado real e texto à mão`);
    /* Ligado por omissão: ausência conta como ligado em
       `normalizeShowcaseConfig`, e a estreia da peça precisa concordar. */
    assert.equal(peca.defaultProps.usarDadosReais, true);
  }
});

test("widget sem fonte real não ganha um controle que não faz nada", () => {
  const semFonte = WIDGET_LIBRARY.map((m) => m.type).filter((t) => !FONTES_REAIS[t]);
  assert.ok(semFonte.length, "o cenário precisa existir para o teste valer");
  for (const tipo of semFonte) {
    assert.equal(
      configVitrine.components[`Widget_${tipo}`].fields.usarDadosReais,
      undefined,
      `${tipo} não lê cadastro nenhum e mesmo assim oferece a escolha`,
    );
  }
});

test("a biblioteca inteira virou peça do Puck", () => {
  const faltando = WIDGET_LIBRARY
    .map((m) => m.type)
    .filter((t) => !configVitrine.components[`Widget_${t}`]);
  assert.deepEqual(faltando, [], "widget do catálogo sem componente correspondente");
});

test("toda peça aceita banner — inclusive a seção em colunas", () => {
  /* O campo já esteve restrito aos blocos fixos, com o argumento de que
     `mergeBlockWrapperStyle` é função de bloco. O argumento era sobre a função
     errada: quem desenha o banner é o invólucro do `ComBanner`, e ele serve a
     qualquer peça. Uma peça nova que nasça sem o campo é o modo silencioso de
     a restrição voltar. */
  const faltando = PECAS
    .filter(([, c]) => !c.fields?.backgroundImage)
    .map(([nome]) => nome);
  assert.deepEqual(faltando, [], "peça sem campo de banner");
});

test("o banner da seção apaga o fundo das peças de dentro", () => {
  /* A regra que a pessoa espera de qualquer editor: fundo de seção é fundo de
     seção. Sem isto, dois widgets com cor de fundo cobrem a imagem em retalhos
     e a foto aparece só nas frestas — indistinguível de defeito, porque a URL
     foi aceita e o resultado não parece um banner.

     O teste renderiza o MESMO widget nos dois contextos: solto, ele pinta o
     próprio fundo; debaixo de um banner, não. */
  const texto = configVitrine.components.Widget_text;
  const props = {
    backgroundColor: "#ff0000",
    widget: { id: "w1", type: "text", title: "Aviso", content: "Olá" },
    puck: { isEditing: false },
  };

  const solto = desenharNaVitrine(texto.render(props));
  assert.ok(/#ff0000|rgb\(255, ?0, ?0\)/.test(solto), "solto, o widget devia pintar o próprio fundo");

  const sob = desenharNaVitrine(
    <ComBanner estilo={{ backgroundImage: "https://exemplo/foto.jpg" }}>
      {texto.render(props)}
    </ComBanner>,
  );
  assert.ok(!/#ff0000|rgb\(255, ?0, ?0\)/.test(sob), "sob o banner, o fundo do widget devia sumir");
  assert.ok(/showcase-section-has-bg/.test(sob), "o invólucro do banner devia estar lá");
});
