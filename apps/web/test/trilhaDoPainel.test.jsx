import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { TELAS_DO_PAINEL, degrausAte } from "../src/utils/trilhaDoPainel";

/* ────────────────────────────────────────────────────────────────────────────
   A trilha e a barra lateral dizem os mesmos nomes.

   `TELAS_DO_PAINEL` é uma CÓPIA dos rótulos da navegação — e o porquê está no
   cabeçalho daquele arquivo: na barra o destino de cada item mora dentro de um
   `onClick`, então descobrir a rota exigiria EXECUTAR o clique, o que não se faz
   a cada render só para desenhar uma linha de texto.

   O que este arquivo impede é a divergência. "Categoria de Imóvel" na barra e
   "Tipos de Imóvel" na trilha seriam dois nomes para a mesma tela, e quem lê não
   tem como saber que são a mesma.

   ── POR QUE PELO TEXTO, E NÃO IMPORTANDO A BARRA ──

   `navegacaoDoPainel.jsx` puxa `api.js`, que lê `import.meta.env` — coisa que o
   Vite define e o Node não. Importá-la aqui obrigaria a mexer no carregador que
   as outras dezessete suítes usam, para conferir uma tabela de strings. Ler o
   arquivo é o mesmo caminho de `cargosRisco.test.jsx`.
   ────────────────────────────────────────────────────────────────────────── */

/* Sem comentários: este arquivo cita rótulos em prosa, e um verificador que lê
   comentário acusa a documentação em vez do código. */
const barra = fs.readFileSync("src/components/navegacaoDoPainel.jsx", "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\/\/[^\n]*/g, " ");

/** `rota → rótulo`, lido dos itens da barra.
 *
 *  Cada item começa em `{ key:` — inclusive os subitens, que por isso saem
 *  soltos e não embutidos no pai. Item sem `navigate` é link externo (Ver
 *  Página) ou destino fora do painel, e não tem trilha. */
function rotasDaBarra() {
  const achadas = new Map();
  for (const pedaco of barra.split(/\{\s*key:/).slice(1)) {
    const rotulo = pedaco.match(/label:\s*"([^"]+)"/);
    const rota = pedaco.match(/navigate\("([^"]+)"\)/);
    if (rotulo && rota) achadas.set(rota[1], rotulo[1]);
  }
  return achadas;
}

test("toda tela da barra tem rótulo igual na trilha", () => {
  const daBarra = rotasDaBarra();
  assert.ok(daBarra.size > 15, `a barra devolveu poucas rotas (${daBarra.size}) — a leitura quebrou`);

  const ausentes = [];
  const divergentes = [];
  for (const [rota, rotulo] of daBarra) {
    const tela = TELAS_DO_PAINEL[rota];
    if (!tela) { ausentes.push(`${rota} ("${rotulo}")`); continue; }
    if (tela.rotulo !== rotulo) divergentes.push(`${rota}: barra "${rotulo}" x trilha "${tela.rotulo}"`);
  }

  assert.deepEqual(ausentes, [], "rota na barra sem entrada em TELAS_DO_PAINEL");
  assert.deepEqual(divergentes, [], "o mesmo lugar com dois nomes");
});

test("nenhuma entrada aponta para um pai que não existe", () => {
  for (const [rota, tela] of Object.entries(TELAS_DO_PAINEL)) {
    if (!tela.pai) continue;
    assert.ok(TELAS_DO_PAINEL[tela.pai], `${rota} desce de ${tela.pai}, que não está no catálogo`);
  }
});

test("a cadeia sobe até o topo, na ordem em que se desceu", () => {
  /* Categoria de Imóvel é o caso que justifica o campo `pai`: o endereço dela é
     de primeiro nível, mas na barra ela é subitem de Gerenciar Imóveis. */
  assert.deepEqual(
    degrausAte("/tipos-imovel", () => {}).map((d) => d.rotulo),
    ["Dashboard", "Gerenciar Imóveis", "Categoria de Imóvel"],
  );
  /* Nenhuma tela do painel dá um degrau só: toda uma desce de um Dashboard, e
     é isso que faz a trilha ser um caminho e não um título repetido. */
  assert.deepEqual(
    degrausAte("/usuarios", () => {}).map((d) => d.rotulo),
    ["Dashboard", "Usuários"],
  );
  /* O Flow sobe DENTRO do Flow: quem está no funil não desceu do Hub. */
  assert.deepEqual(
    degrausAte("/flow/funil", () => {}).map((d) => d.rotulo),
    ["Dashboard", "Funil de Vendas"],
  );
  assert.equal(degrausAte("/flow/funil", () => {})[0].chave, "/flow");

  assert.deepEqual(degrausAte("/rota-que-nao-existe", () => {}), []);
});

test("toda tela chega ao Dashboard do próprio módulo", () => {
  for (const rota of Object.keys(TELAS_DO_PAINEL)) {
    const primeiro = degrausAte(rota, () => {})[0];
    const raiz = rota.startsWith("/flow") ? "/flow" : "/";
    assert.equal(primeiro.chave, raiz, `${rota} não sobe até ${raiz}`);
  }
});

test("o último degrau pode ter o clique trocado", () => {
  /* Numa tela que troca de vista por estado, navegar para o próprio endereço não
     faz nada — o roteador já está nele. Quem chama diz o que "voltar" significa. */
  let voltou = false;
  const degraus = degrausAte("/clientes", () => {}, () => { voltou = true; });
  degraus.at(-1).aoIr();
  assert.equal(voltou, true);
});

test("todo degrau leva a algum lugar", () => {
  /* Degrau sem `aoIr` é desenhado apagado — e um caminho com metade dos degraus
     mortos é pior do que não ter trilha. */
  const ir = () => {};
  for (const rota of Object.keys(TELAS_DO_PAINEL)) {
    for (const degrau of degrausAte(rota, ir)) {
      assert.ok(typeof degrau.aoIr === "function", `${rota}: degrau "${degrau.rotulo}" sem destino`);
      assert.ok(degrau.rotulo && degrau.Icone, `${rota}: degrau incompleto`);
    }
  }
});
