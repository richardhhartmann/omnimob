import fs from "node:fs";
import path from "node:path";
import { problemasDeOrdem } from "./ordemDeDeclaracao.mjs";

/**
 * ─── Todo import nomeado aponta para um export que existe? ───────────────────
 *
 *   node scripts/conferir-imports.mjs
 *
 * ── POR QUE ISTO PRECISOU EXISTIR ──
 *
 * Duas vezes seguidas um refactor moveu uma função de arquivo e deixou para
 * trás um `import { algo }` apontando para o vazio. Nas duas, `npm test` e
 * `vite build` passaram — e a tela quebrou no navegador com
 * "does not provide an export named".
 *
 * O motivo de nada pegar: teste só carrega o que ele importa, e o bundler
 * resolve o grafo mas nem sempre trata export ausente como erro fatal. O
 * defeito só aparece quando o MÓDULO É CARREGADO — e num app com rotas
 * preguiçosas isso pode ser numa tela que ninguém abriu ainda.
 *
 * ── O QUE ELE NÃO FAZ ──
 *
 * Não é um analisador de verdade: lê os arquivos com expressão regular e olha
 * só imports RELATIVOS (os de pacote não são problema nosso). Reexport com
 * `export * from` é seguido um nível. Se um dia a checagem apertar demais e
 * apontar falso positivo, o caminho é olhar o caso — não afrouxar a regra.
 */

const RAIZ = process.argv[2] || "src";

function arquivos(dir, saida = []) {
  for (const nome of fs.readdirSync(dir)) {
    const p = path.join(dir, nome);
    if (fs.statSync(p).isDirectory()) arquivos(p, saida);
    else if (/\.(jsx?|mjs)$/.test(nome)) saida.push(p);
  }
  return saida;
}

function resolver(deQuem, especificador) {
  const base = path.resolve(path.dirname(deQuem), especificador);
  const tentativas = [base, `${base}.js`, `${base}.jsx`, path.join(base, "index.js"), path.join(base, "index.jsx")];
  return tentativas.find((t) => fs.existsSync(t) && fs.statSync(t).isFile()) || null;
}

/* Os nomes que um arquivo exporta. Cobre as formas que este projeto usa:
   `export function`, `export const`, `export class`, `export { a, b }` e
   `export { x } from "..."`. */
function exportsDe(arquivo, profundidade = 0) {
  const s = fs.readFileSync(arquivo, "utf8");
  const nomes = new Set();

  for (const m of s.matchAll(/export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g)) {
    nomes.add(m[1]);
  }
  for (const m of s.matchAll(/export\s*\{([^}]*)\}(?:\s*from\s*["']([^"']+)["'])?/g)) {
    for (const parte of m[1].split(",")) {
      const nome = parte.trim().split(/\s+as\s+/).pop().trim();
      if (nome) nomes.add(nome);
    }
  }
  // `export * from "..."`: segue um nível, o bastante para reexport simples.
  if (profundidade < 1) {
    for (const m of s.matchAll(/export\s*\*\s*from\s*["'](\.[^"']+)["']/g)) {
      const alvo = resolver(arquivo, m[1]);
      if (alvo) for (const n of exportsDe(alvo, profundidade + 1)) nomes.add(n);
    }
  }
  if (/export\s+default/.test(s)) nomes.add("default");
  return nomes;
}

const problemas = [];

/* ── Reexport que o próprio arquivo USA ──────────────────────────────────────

   `export { X } from "./y"` disponibiliza X para quem IMPORTA este arquivo —
   e não para o arquivo. Quem escreve isso e usa X logo abaixo recebe
   "X is not defined" no navegador, em tempo de execução.

   Aconteceu de verdade: um ícone foi movido para um módulo comum, o arquivo
   antigo ficou com o reexport para não quebrar quem importava dele, e a tela
   que desenhava o ícone morreu no primeiro render.

   O verificador de imports não pega: não há `import` para conferir. Esta
   regra pega. */
const REEXPORT = /export\s*\{([^}]*)\}\s*from\s*["'][^"']+["'];?/g;

function conferirReexports(arquivo, s) {
  for (const m of s.matchAll(REEXPORT)) {
    const declaracao = m[0];
    for (const parte of m[1].split(",")) {
      const nome = parte.trim().split(/\s+as\s+/).pop().trim();
      if (!/^[A-Za-z_$][\w$]*$/.test(nome)) continue;
      const resto = s.replace(declaracao, "");
      const usa = new RegExp(`\\b${nome}\\b`);
      if (usa.test(resto)) {
        problemas.push(
          `${arquivo}: reexporta "${nome}" e o usa aqui dentro — reexport não põe o nome no escopo do arquivo; acrescente um import.`,
        );
      }
    }
  }
}

/* ── Só o código, sem strings, comentários nem texto de tela ─────────────────

   Isto começou como uma pilha de `.replace()` e estava ERRADO de um jeito que
   não aparecia: a regra de comentário de linha (`//…`) casava com o `//` de
   dentro de `"https://graph.facebook.com"`. A partir dali as aspas ficavam
   desbalanceadas e o resto do arquivo virava ruído — que era exatamente o que
   produzia os avisos falsos em `pagamentoService` e `canaisRoutes`.

   Regex não distingue contexto. Um percurso caractere a caractere distingue,
   e cabe em quarenta linhas. */

function soCodigo(s) {
  let saida = "";
  let i = 0;
  /* Para saber se uma `/` abre uma expressão regular ou é divisão: depois de
     valor (identificador, `)`, `]`, número) é divisão; depois de operador ou
     abre-parênteses é expressão regular. */
  let anterior = "";

  const guardar = (c) => { saida += c; if (!/\s/.test(c)) anterior = c; };

  while (i < s.length) {
    const c = s[i];
    const d = s[i + 1];

    if (c === "/" && d === "/") {            // comentário de linha
      while (i < s.length && s[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && d === "*") {            // comentário de bloco
      i += 2;
      while (i < s.length && !(s[i] === "*" && s[i + 1] === "/")) i++;
      i += 2;
      saida += " ";
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { // string ou template
      const aspa = c;
      i++;
      while (i < s.length) {
        if (s[i] === "\\") { i += 2; continue; }
        if (s[i] === aspa) { i++; break; }
        /* Interpolação de template: `${…}` É código, e pode conter a constante
           que estamos procurando. Volta para o percurso normal. */
        if (aspa === "`" && s[i] === "$" && s[i + 1] === "{") {
          let nivel = 1;
          i += 2;
          const inicio = i;
          while (i < s.length && nivel > 0) {
            if (s[i] === "{") nivel++;
            else if (s[i] === "}") nivel--;
            if (nivel > 0) i++;
          }
          saida += " " + soCodigo(s.slice(inicio, i)) + " ";
          i++;
          continue;
        }
        i++;
      }
      guardar("0"); // um valor qualquer, para a heurística da `/` seguinte
      continue;
    }
    if (c === "/" && !/[\w$)\]]/.test(anterior)) { // expressão regular literal
      i++;
      let emClasse = false;
      while (i < s.length) {
        if (s[i] === "\\") { i += 2; continue; }
        if (s[i] === "[") emClasse = true;
        else if (s[i] === "]") emClasse = false;
        else if (s[i] === "/" && !emClasse) { i++; break; }
        else if (s[i] === "\n") break;
        i++;
      }
      while (i < s.length && /[gimsuyd]/.test(s[i])) i++;
      guardar("0");
      continue;
    }

    guardar(c);
    i++;
  }

  return saida
    .replace(/\.\s*[A-Z][A-Z0-9_]*\b/g, ".")     // acesso a propriedade
    .replace(/\[\s*[A-Z][A-Z0-9_]*\s*\]/g, "[]") // chave computada
    .replace(/\b[A-Z][A-Z0-9_]*\s*:/g, ":")      // chave de objeto e rótulo de case
    /* Texto JSX: o que está entre `>` e `<` sem chaves é o que a pessoa LÊ na
       tela, não código — é onde moram as instruções do tipo
       `<code>VITE_ALGO</code>`, nomes de variável escritos para o usuário ver.

       O preço: uma comparação como `if (x > MAX_ITENS && y < z)` tem o mesmo
       desenho e some junto. Aceito de propósito — vira falso NEGATIVO, e uma
       constante que só aparece dentro de uma comparação é rara o bastante para
       não valer o ruído de tratar o caso. Silêncio errado é melhor que alarme
       errado num verificador que precisa ser rodado sempre. */
    .replace(/>[^<>{}]*</g, "><");
}

/* ── Constante usada e nunca declarada ───────────────────────────────────────

   O caso: um refactor tira um bloco de constantes de um arquivo para um módulo
   comum, leva junto uma que NÃO era compartilhada, e o arquivo antigo continua
   usando o nome. Não há import quebrado para conferir — o nome simplesmente
   não existe mais em lugar nenhum.

   Aconteceu duas vezes no mesmo commit (`LOCKED_NO_PROPRIO_CARGO` e
   `PERMISSAO_DE_RISCO`, em CargosPage). O `vite build` passou: bundler não faz
   análise de escopo, e `ReferenceError` é de execução. A tela só morreu quando
   alguém clicou em Cargos.

   ── POR QUE SÓ MAIÚSCULAS ──

   Análise de escopo de verdade (parâmetros, desestruturação, closures, hoisting)
   é um projeto à parte, e um verificador com falso positivo vira um que ninguém
   roda. `NOME_ASSIM` é, neste código, sempre constante de módulo — o que dá uma
   regra estreita, barata e sem ruído, que pega exatamente a forma do defeito
   que já apareceu. */

const CAPS = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g;

/* Maiúsculas que o navegador ou o próprio JS já fornecem. */
const GLOBAIS = new Set([
  "NaN", "Infinity", "URL", "URLSearchParams", "JSON", "Math", "Intl",
  "DOCUMENT_NODE", "ELEMENT_NODE", "TEXT_NODE",
]);

function conferirConstantes(arquivo, s) {
  const declarados = new Set();

  // declaração local, em qualquer nível
  for (const m of s.matchAll(/(?:const|let|var|function|class)\s+([A-Z][A-Z0-9_]*)\b/g)) declarados.add(m[1]);
  // vindo por import — nomeado, default ou namespace
  for (const m of s.matchAll(/import\s*\{([^}]*)\}\s*from/g)) {
    for (const parte of m[1].split(",")) {
      const nome = parte.trim().split(/\s+as\s+/).pop().trim();
      if (nome) declarados.add(nome);
    }
  }
  for (const m of s.matchAll(/import\s+(?:\*\s+as\s+)?([A-Za-z_$][\w$]*)\s*(?:,|from)/g)) declarados.add(m[1]);
  // desestruturação: `const { A, B } = algo`
  for (const m of s.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=/g)) {
    for (const parte of m[1].split(",")) {
      const nome = parte.trim().split(":").pop().trim();
      if (nome) declarados.add(nome);
    }
  }
  /* O texto tem que ficar só com CÓDIGO antes da varredura. `"MERCADO_LIVRE"`
     dentro de uma string, `EM_ANDAMENTO:` como chave de objeto e
     `env.VITE_ALGO` como propriedade são o mesmo desenho de letras, e nenhum
     dos três é um identificador. Sem esta limpeza a regra devolve quarenta
     avisos falsos — e um verificador barulhento é um verificador desligado. */
  /* As próprias declarações de import/export saem da varredura: ali o nome está
     sendo DECLARADO, não usado. Sem isto, `import { CORES_EMAIL as COR }` é
     acusado — o que entra no escopo é `COR`, e `CORES_EMAIL` aparece uma única
     vez, na linha que o traz. */
  const codigo = soCodigo(s)
    .replace(/\bimport\s*\{[^}]*\}/g, "import")
    .replace(/\bexport\s*\{[^}]*\}/g, "export");

  const vistos = new Set();
  for (const m of codigo.matchAll(CAPS)) {
    const nome = m[0];
    if (vistos.has(nome) || declarados.has(nome) || GLOBAIS.has(nome)) continue;
    vistos.add(nome);
    problemas.push(`${arquivo}: usa "${nome}", que não é declarado nem importado aqui — refactor deixou o nome para trás?`);
  }
}

/* ── Uso antes da declaração, no mesmo nível de statement ────────────────────

   O caso: um refactor insere `const b = f(a)` ANTES de `const a = …`. Em
   JavaScript isso não é hoisting benigno — `const` tem zona morta temporal, e o
   resultado é `Cannot access 'a' before initialization` no primeiro render.

   Aconteceu duas vezes no mesmo dia, e nenhuma das redes pegou: `vite build`
   compila (é erro de execução), os testes não renderizavam aquele componente, e
   `conferir-nomes` só olhava MAIÚSCULAS.

   ── POR QUE SÓ O NÍVEL DE STATEMENT ──

   A regra compara declarações e usos com a MESMA indentação, dentro do mesmo
   arquivo. Ali a ordem importa de verdade: são statements executados de cima
   para baixo.

   Dentro de callback, função aninhada ou JSX, a ordem NÃO importa — a closure
   só roda depois de tudo estar inicializado, e `const proximo = () => usa(x)`
   escrito antes de `x` é perfeitamente válido. Incluir esses casos encheria a
   saída de falso positivo, e um verificador barulhento é um verificador
   desligado. */

for (const arquivo of arquivos(RAIZ)) {
  const s = fs.readFileSync(arquivo, "utf8");
  conferirReexports(arquivo, s);
  conferirConstantes(arquivo, s);
  problemas.push(...problemasDeOrdem(arquivo, s));
  for (const m of s.matchAll(/import\s*\{([^}]*)\}\s*from\s*["'](\.[^"']+)["']/g)) {
    const alvo = resolver(arquivo, m[2]);
    if (!alvo) {
      problemas.push(`${arquivo}: não achei o arquivo "${m[2]}"`);
      continue;
    }
    const disponiveis = exportsDe(alvo);
    for (const parte of m[1].split(",")) {
      const nome = parte.trim().split(/\s+as\s+/)[0].trim();
      if (!nome || nome.startsWith("type ")) continue;
      if (!disponiveis.has(nome)) {
        problemas.push(`${arquivo}: importa "${nome}" de ${m[2]}, que não exporta esse nome`);
      }
    }
  }
}

if (problemas.length) {
  console.error(`${problemas.length} problema(s) de nome:\n`);
  for (const p of problemas) console.error("  " + p);
  process.exit(1);
}
console.log("nomes conferidos: imports resolvem e nada é usado sem existir");
