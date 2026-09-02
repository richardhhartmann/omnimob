import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { EditorDeAtalhos } from "../src/components/EditorDeAtalhos.jsx";
import { CartaoDePublicacao } from "../src/components/PublicandoImovel.jsx";
import { CascaDeRelatorio } from "../src/components/CascaDeRelatorio.jsx";
import { GradeDePermissoes } from "../src/components/GradeDePermissoes.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   Os componentes RENDERIZAM.

   ── POR QUE ISTO PRECISOU EXISTIR ──

   Um refactor tirou uma variável derivada do editor de atalhos e deixou o uso
   dela lá embaixo. `vite build` passou — bundler não faz análise de escopo, e
   `ReferenceError` é de execução. Os 119 testes passaram — nenhum renderizava
   aquele componente. A tela morreu no primeiro clique em Configurações.

   `conferir-nomes` também não pegou, e é por construção: a regra dele é
   estreita de propósito — só constantes MAIÚSCULAS, porque análise de escopo de
   verdade (parâmetros, desestruturação, closures) é um projeto à parte e um
   verificador com falso positivo vira um que ninguém roda. `idsEmConflito` é
   camelCase e passou por baixo dela.

   A rede certa para esse buraco não é um analisador melhor: é RENDERIZAR. Um
   componente que monta sem estourar já elimina a classe inteira de "nome que
   sobrou depois do refactor", e custa três linhas por componente.

   Cada componente novo com lógica derivada entra aqui.
   ──────────────────────────────────────────────────────────────────────────── */

const CARGO = {
  acessarPainel: true, gerenciarImoveis: true, verRelatorios: true, gerenciarClientes: true,
  gerenciarUsuarios: true, gerenciarCargos: true, editarPagina: true, verConfiguracoes: true,
  verAuditoria: true, publicarRedes: true, verPainelGestor: true,
};

test("EditorDeAtalhos monta vazio", () => {
  const html = renderToStaticMarkup(
    <EditorDeAtalhos cargo={CARGO} valor={{}} aoMudar={() => {}} />,
  );
  assert.match(html, /Gerenciar imóveis/);
  /* A maquete: cada grupo é o quadro de uma tela, e cada ação é um cartão com o
     selo da tecla no canto. Ver o cabeçalho de `EditorDeAtalhos.jsx`. */
  assert.match(html, /ea-tela__palco/, "os grupos viram quadros de tela");
  assert.match(html, /ea-cartao__tecla/, "cada cartão carrega o selo da tecla");
  /* O ícone vem de `faceDaAcao`, que cruza três catálogos. Um `id` que deixe de
     casar devolve o interrogatão cinza em vez de estourar — mas se a função
     inteira quebrar, é aqui que aparece. */
  assert.match(html, /ea-cartao__icone/, "o cartão tem o rosto da ação");
  assert.match(html, /\/relatorios/, "a barra do quadro diz onde a tecla vale");
});

test("EditorDeAtalhos monta com escolha, herdado e conflito", () => {
  /* O caso que quebrou: a marca de conflito depende de um derivado, e o
     derivado tinha sumido no refactor. */
  const html = renderToStaticMarkup(
    <EditorDeAtalhos
      cargo={CARGO}
      herdados={{ "dashboard.imoveis": "q" }}
      valor={{ "dashboard.portfolio": "q", "dashboard.clientes": "" }}
      aoMudar={() => {}}
      estado="Salvo."
    />,
  );
  assert.match(html, /is-conflito/, "a colisão herdada precisa aparecer marcada");
  assert.match(html, /is-vazio/, "atalho desligado tem marca própria, não selo em branco");
  assert.match(html, /Salvo\./);
});

test("EditorDeAtalhos com cargo mínimo não quebra nem oferece o que ele não abre", () => {
  const html = renderToStaticMarkup(
    <EditorDeAtalhos cargo={{ acessarPainel: true }} valor={{}} aoMudar={() => {}} />,
  );
  assert.ok(!/Gerenciar imóveis/.test(html), "não oferece atalho para tela fechada");
  assert.match(html, /Novo registro/, "o global continua valendo");
});

test("CartaoDePublicacao monta nos três estados", () => {
  for (const progresso of [
    { etapa: "salvando" },
    { etapa: "fotos", feito: 2, total: 5 },
    { etapa: "divulgando" },
  ]) {
    const html = renderToStaticMarkup(<CartaoDePublicacao progresso={progresso} />);
    assert.match(html, /pub-caixa/);
  }
});

test("CascaDeRelatorio monta com e sem métricas", () => {
  /* O título não entra mais no HTML da casca: ele é declarado e desenhado na
     faixa do painel. Ver `cascaDeRelatorio.test.jsx` para o porquê. */
  const semNada = renderToStaticMarkup(<CascaDeRelatorio titulo="X"><p>c</p></CascaDeRelatorio>);
  assert.match(semNada, /<p>c<\/p>/);

  const cheia = renderToStaticMarkup(
    <CascaDeRelatorio
      titulo="Y"
      subtitulo="sub"
      metricas={[{ label: "A", value: 1, accent: "#000", icon: null }]}
      filtros={<span>f</span>}
      erro="e"
    >
      <p>c</p>
    </CascaDeRelatorio>,
  );
  assert.match(cheia, /f<\/span>/);   // os filtros
  assert.match(cheia, /stat-card|A</);  // a faixa de métricas
});

test("GradeDePermissoes monta com e sem travadas", () => {
  const simples = renderToStaticMarkup(
    <GradeDePermissoes plano="PREMIUM" valores={{}} aoAlternar={() => {}} />,
  );
  assert.match(simples, /perm-item/);

  const travada = renderToStaticMarkup(
    <GradeDePermissoes
      plano="PREMIUM"
      valores={{}}
      travadas={["gerenciarCargos"]}
      motivoTravada="m"
      aoAlternar={() => {}}
    />,
  );
  assert.match(travada, /is-travada/);
});
