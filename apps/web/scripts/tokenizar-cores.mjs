import fs from "node:fs";
import path from "node:path";

/**
 * ─── Cor inline → token de tema ──────────────────────────────────────────────
 *
 *   node scripts/tokenizar-cores.mjs            → ensaio
 *   node scripts/tokenizar-cores.mjs --aplicar  → grava
 *
 * ── O PROBLEMA QUE ELE RESOLVE ──
 *
 * O painel escrevia cor em ESTILO INLINE, e estilo inline vence folha de
 * estilo. Cada tela quebrada no tema claro exigia caçar o seletor certo e
 * escrever um `!important`; a próxima tela quebrava igual, porque a causa nunca
 * era tratada. Foram cinco passadas manuais antes disto existir.
 *
 * Aqui os literais `rgba(255,255,255,α)` viram `var(--token, rgba(...))`. O
 * valor de reserva é o de antes, então o tema ESCURO não muda um pixel — o que
 * torna a migração segura de rodar sem revisar tela por tela.
 *
 * ── AS TRÊS FAMÍLIAS ──
 *
 * O nome sai da PROPRIEDADE, não da opacidade, e é essa decisão que faz o
 * esquema funcionar: o mesmo `0.08` é fundo num lugar e borda em outro, e no
 * claro os dois querem coisas opostas — o fundo quase some, a borda precisa
 * aparecer MAIS. Um token por opacidade devolveria o mesmo problema com outro
 * nome. Os valores do claro estão no `styles.css`.
 *
 * ── IDEMPOTENTE ──
 *
 * Rodar de novo não faz nada: o literal já está dentro do fallback de um
 * `var()`, e a guarda pula. Script de migração que não pode rodar duas vezes é
 * script que ninguém confia em rodar.
 */

const RAIZ = process.argv[2] || "src";
const aplicar = process.argv.includes("--aplicar");

/* Fora: telas escuras POR DECISÃO, não por falta de tema.
 *
 * A vitrine e o editor têm tema próprio (o do cliente). Landing e login são a
 * moldura escura do produto. A barra lateral e a dica dela são escuras nos dois
 * temas, para o painel claro não perder a âncora visual. Controles sobre foto
 * panorâmica são brancos em qualquer tema. E a aparência do Payment Element
 * vive num iframe do Stripe, com documento próprio — variável nossa não
 * atravessa a fronteira. */
const FORA = [
  "components/showcase/", "components/builder/", "pages/publicas/",
  "OmnimobLandingPage", "omnimobKit", "StaggeredMenu", "Efeitos",
  "ShowcasePage", "ShowcasePropertyPage", "ShowcaseEditorPage",
  "ContaSuspensaPage", "LoginPage", "SuperAdmin",
  "utils/stripe", "Panorama360", "AdminLayout",
];

const FAMILIA = {
  background: "sup", backgroundColor: "sup", backgroundImage: "sup",
  "background-color": "sup", "background-image": "sup",
  border: "linha", borderColor: "linha", borderTop: "linha", borderBottom: "linha",
  borderLeft: "linha", borderRight: "linha", outline: "linha",
  "border-color": "linha", "border-top": "linha", "border-bottom": "linha",
  "border-left": "linha", "border-right": "linha",
  color: "tinta", fill: "tinta", stroke: "tinta",
};

function arquivos(dir, saida = []) {
  for (const nome of fs.readdirSync(dir)) {
    const p = path.join(dir, nome);
    if (fs.statSync(p).isDirectory()) arquivos(p, saida);
    else if (/\.jsx?$/.test(nome)) saida.push(p);
  }
  return saida;
}

const conta = {};
let total = 0;
const tocados = [];

for (const arquivo of arquivos(RAIZ)) {
  const rel = arquivo.split(path.sep).join("/");
  if (FORA.some((f) => rel.includes(f))) continue;

  const antes = fs.readFileSync(arquivo, "utf8");
  let n = 0;

  /* A propriedade é procurada PARA TRÁS, e não colada nas aspas. É o que faz o
     script enxergar os três jeitos de escrever cor neste projeto:
       background: "rgba(…)"                    estilo inline
       background: rgba(…);                     CSS em template literal
       background: cond ? `…` : "rgba(…)"       ternário
     Os dois últimos não têm a propriedade grudada no valor, e uma versão
     anterior deste script simplesmente não os via. */
  const depois = antes.replace(
    /rgba\(255,\s*255,\s*255,\s*(0?\.\d+)\)/g,
    (inteiro, alfa, posicao, texto) => {
      const antesDisso = texto.slice(Math.max(0, posicao - 140), posicao);
      if (/var\(--[\w-]+,\s*$/.test(antesDisso)) return inteiro; // já tokenizado
      const nomes = [...antesDisso.matchAll(/([a-zA-Z][\w-]*)\s*:/g)];
      const prop = nomes.length ? nomes[nomes.length - 1][1] : null;
      const familia = prop && FAMILIA[prop];
      if (!familia) return inteiro;
      const passo = String(Math.round(parseFloat(alfa) * 100)).padStart(2, "0");
      const token = `--${familia}-${passo}`;
      conta[token] = (conta[token] || 0) + 1;
      total += 1;
      n += 1;
      return `var(${token}, ${inteiro})`;
    },
  );

  if (n) {
    tocados.push(`${rel.split("/src/")[1] || rel} (${n})`);
    if (aplicar) fs.writeFileSync(arquivo, depois);
  }
}

console.log(aplicar ? "APLICADO" : "ENSAIO — nada gravado");
console.log(`${total} literais em ${tocados.length} arquivos\n`);
if (tocados.length) console.log(tocados.join("\n"));

const novos = Object.keys(conta).filter((t) => {
  const css = fs.readFileSync(path.join(RAIZ, "styles.css"), "utf8");
  return !new RegExp(`\\s${t}:`).test(css);
});
if (novos.length) {
  console.log(`\n!  Sem valor de tema claro no styles.css: ${novos.join(", ")}`);
  console.log("   Sem isso eles caem no fallback ESCURO e a tela quebra no claro.");
}
