import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import { CartaoDePublicacao, PublicandoImovel } from "../src/components/PublicandoImovel.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   Três defeitos que já aconteceram, e o que os impede de voltar.

   1. Véu cobrindo só um pedaço da página. Causa: `position: fixed` dentro de um
      ancestral com `transform` — o `AdminLayout` embrulha o conteúdo numa div
      animada. A defesa é sair pelo portal, e é isso que o primeiro bloco checa.

   2. Esqueleto de IA sumindo. Causa: um `useState` guardando UM campo.

   3. Publicar sem sinal de vida. O progresso precisa vir do laço de fotos, e
      não de um temporizador.
   ──────────────────────────────────────────────────────────────────────────── */

// ─── 1. Todo modal sai pelo portal ──────────────────────────────────────────

const COM_VEU = [
  "src/components/Modal.jsx",
  "src/components/PublicandoImovel.jsx",
  "src/components/ExcluirImovel.jsx",
];

for (const arquivo of COM_VEU) {
  test(`${arquivo} não monta véu próprio fora do portal`, () => {
    /* Sem os comentários: este arquivo EXPLICA a armadilha em prosa, e um
       detector que lê comentário acusa a própria documentação. */
    const codigo = fs.readFileSync(arquivo, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ");
    const temVeuProprio = /position:\s*["']?fixed/.test(codigo)
      || /className="[^"]*(veu|backdrop)/.test(codigo);
    if (!temVeuProprio) return; // delega a casca a outro componente
    assert.match(codigo, /createPortal\([\s\S]*document\.body/, "véu próprio exige portal para o body");
  });
}

test("ExcluirImovel delega a casca ao Modal em vez de montar a sua", () => {
  const s = fs.readFileSync("src/components/ExcluirImovel.jsx", "utf8");
  assert.match(s, /<Modal/, "deveria usar o modal compartilhado");
  assert.ok(!/exi-fundo|exi-caixa/.test(s), "voltou a montar o próprio véu");
});

// ─── 2. Esqueletos de IA em paralelo ────────────────────────────────────────

test("o estado da IA guarda um CONJUNTO de campos, não um só", () => {
  const s = fs.readFileSync("src/components/PropertyForm.jsx", "utf8");
  assert.match(s, /const \[gerandoCampos, setGerandoCampos\] = useState\(\(\) => new Set\(\)\)/);
  /* Um `setGerandoCampos(new Set([campo]))` substituiria o conjunto e traria o
     defeito de volta — o certo é derivar do anterior. */
  assert.match(s, /setGerandoCampos\(\(atuais\) => new Set\(atuais\)\.add\(campo\)\)/);
  assert.ok(!/\bgerandoCampo\b(?!s)/.test(s), "sobrou leitura do estado antigo de um campo só");
});

// ─── 3. A tela de publicação ────────────────────────────────────────────────

test("sem contagem, a tela não inventa porcentagem", () => {
  const html = renderToStaticMarkup(<CartaoDePublicacao progresso={{ etapa: "salvando" }} />);
  assert.match(html, /Publicando seu imóvel/);
  assert.ok(!/%/.test(html.replace(/--pub-pct[^;"]*/g, "")), "etapa sem total não pode mostrar porcentagem");
  assert.match(html, /pub-pontos/, "mostra atividade, sem número");
});

test("com contagem, a porcentagem é a real", () => {
  const html = renderToStaticMarkup(
    <CartaoDePublicacao progresso={{ etapa: "fotos", feito: 3, total: 4 }} />,
  );
  assert.match(html, /75%/);
  assert.match(html, /Foto 4 de 4/);
});

test("etapas anteriores aparecem como concluídas", () => {
  const html = renderToStaticMarkup(<CartaoDePublicacao progresso={{ etapa: "divulgando" }} />);
  const feitas = html.match(/pub-etapa is-feita/g) || [];
  assert.equal(feitas.length, 2, "salvar e fotos já passaram");
});

test("sem progresso, nada é desenhado", () => {
  /* `PublicandoImovel` sai por portal e precisa de `document`; o que importa
     aqui é a guarda, e ela é a primeira linha da função. */
  assert.equal(PublicandoImovel({ progresso: null }), null);
});

test("o progresso vem do laço de fotos, não de um temporizador", () => {
  const s = fs.readFileSync("src/pages/DashboardPage.jsx", "utf8");
  assert.match(s, /relatar\(\{ etapa: "fotos", feito: i \+ 1, total: imageFiles\.length \}\)/);
  assert.ok(!/setInterval[\s\S]{0,200}relatar/.test(s), "progresso não pode ser cronometrado");
});
