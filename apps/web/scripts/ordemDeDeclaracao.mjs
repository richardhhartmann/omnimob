/* ── Uso antes da declaração, no mesmo nível de statement ────────────────────

   O caso: um refactor insere `const b = f(a)` ANTES de `const a = …`. Em
   JavaScript isso não é hoisting benigno — `const` tem zona morta temporal, e o
   resultado é `Cannot access 'a' before initialization` no primeiro render.

   Aconteceu duas vezes no mesmo dia, e nenhuma das redes pegou: `vite build`
   compila (é erro de execução), os testes não renderizavam aquele componente, e
   `conferir-nomes` só olhava constantes MAIÚSCULAS.

   ── A REGRA TRABALHA POR STATEMENT, E NÃO POR LINHA ──

   A primeira versão comparava LINHAS de mesma indentação, e por isso não pegou
   o bug que a motivou:

     const destino = !podeEntrar
       ? caminhoPublico          ← o uso está aqui, indentado mais fundo
       : "/inicio";
     const caminhoPublico = …    ← e a declaração vem depois

   O uso mora numa linha de continuação. Só olhando o STATEMENT inteiro — da
   linha que o abre até a próxima de indentação igual ou menor — o par aparece.

   ── O QUE FICA DE FORA, DE PROPÓSITO ──

   Statement cujo valor é uma FUNÇÃO (`=>` ou `function`). Ali a ordem não
   importa: a closure só roda depois de tudo estar inicializado, e
   `const proximo = () => usa(x)` escrito antes de `x` é perfeitamente válido.

   O preço é um falso negativo conhecido: `useMemo(() => y, [y])` avalia a lista
   de dependências na hora, então uma declaração posterior de `y` ainda
   estouraria. Aceito de propósito — falso negativo é silêncio, falso positivo é
   um verificador que ninguém roda.
   ────────────────────────────────────────────────────────────────────────── */

/* Comentários fora, LINHAS preservadas.

   O `soCodigo` do verificador de constantes não serve aqui: ele colapsa um
   comentário de bloco num espaço, e com isso a contagem de linhas muda — a
   declaração e o uso podem acabar na mesma linha, e o número reportado
   apontaria para outro lugar do arquivo. Aqui cada linha some do conteúdo mas
   permanece como linha, com a indentação original intacta: é ela que diz o
   nível do statement, e é nisso que a regra inteira se apoia. */
export function semComentarios(codigo) {
  let dentroDeBloco = false;
  return codigo.split("\n").map((linha) => {
    let fora = "";
    for (let i = 0; i < linha.length; i += 1) {
      if (dentroDeBloco) {
        if (linha[i] === "*" && linha[i + 1] === "/") { dentroDeBloco = false; i += 1; }
        continue;
      }
      if (linha[i] === "/" && linha[i + 1] === "*") { dentroDeBloco = true; i += 1; continue; }
      if (linha[i] === "/" && linha[i + 1] === "/") break;
      fora += linha[i];
    }
    const recuo = linha.length - linha.trimStart().length;
    return fora.trim() ? " ".repeat(recuo) + fora.trim() : "";
  }).join("\n");
}

/* O texto de um statement, reduzido ao que são NOMES DE VARIÁVEL de verdade.

   Sem isto a regra acusa duas coisas que só PARECEM uso:

     `session?.usuario?.cargo?.descricao`  →  `.cargo` é propriedade
     `{ left: [...], right: [...] }`       →  `left` é chave de objeto

   Foram 63 avisos falsos na primeira execução, quase todos desses dois moldes.
   É o mesmo tratamento que `soCodigo` faz no verificador de constantes — aqui
   aplicado por statement, e não no arquivo inteiro, porque as linhas precisam
   sobreviver. */
function soNomes(texto) {
  return texto
    /* Strings primeiro: um nome dentro de aspas é texto, não uso. O template
       literal entra inteiro, com a interpolação junto — `` `script[src=…]` ``
       tinha a palavra `script` num SELETOR CSS e era acusada de usar a variável
       de mesmo nome. Perder o que está dentro de `${…}` é um falso negativo
       aceito: ali quase sempre é uma variável já declarada acima. */
    .replace(/`[^`]*`/g, "``")
    .replace(/"[^"]*"/g, '""')
    .replace(/'[^']*'/g, "''")
    .replace(/\.\s*[A-Za-z_$][\w$]*/g, ".")
    /* Chave de objeto — e SÓ ela. A primeira versão era `nome\s*:`, e isso
       come também o meio de um ternário:

         const destino = !podeEntrar
           ? caminhoPublico     ← `caminhoPublico` seguido de `\n    :`
           : "/inicio";

       Era exatamente o uso que a regra existia para pegar, apagado antes de ser
       procurado. Chave de objeto vem depois de `{`, de `,` ou de início de
       linha; o ramo de um ternário, não. */
    .replace(/([{,\n]\s*)[A-Za-z_$][\w$]*\s*:/g, "$1:");
}

const DECLARACAO = /^(\s*)(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/;

const recuoDe = (linha) => linha.length - linha.trimStart().length;

/* Os dois pontos estão no mesmo bloco? Se alguma linha entre eles tem recuo
   menor, um bloco fechou no caminho — e aí as duas declarações vivem em escopos
   diferentes, onde a ordem entre elas não significa nada. */
function mesmoBloco(linhas, de, ate, recuo) {
  for (let k = de + 1; k < ate; k += 1) {
    if (!linhas[k].trim()) continue;
    if (recuoDe(linhas[k]) < recuo) return false;
  }
  return true;
}

export function problemasDeOrdem(arquivo, codigo) {
  const linhas = semComentarios(codigo).split("\n");
  const achados = [];

  /* Cada `const`/`let` com o statement inteiro que ele ocupa. */
  const statements = [];
  linhas.forEach((linha, i) => {
    const m = linha.match(DECLARACAO);
    if (!m) return;
    const recuo = m[1].length;

    let fim = i;
    for (let k = i + 1; k < linhas.length; k += 1) {
      if (!linhas[k].trim()) continue;
      if (recuoDe(linhas[k]) <= recuo) break;
      fim = k;
    }
    const bruto = linhas.slice(i, fim + 1).join("\n");
    statements.push({ nome: m[2], recuo, inicio: i, fim, texto: bruto, usos: soNomes(bruto) });
  });

  /* Onde cada nome nasce. O primeiro vence: redeclarar em escopo aninhado é
     outra variável, e tratá-la como a mesma daria aviso falso. */
  const nasce = new Map();
  for (const s of statements) if (!nasce.has(s.nome)) nasce.set(s.nome, s);

  for (const s of statements) {
    // Função: a ordem não importa, a closure roda depois.
    if (/=>|\bfunction\b/.test(s.texto)) continue;

    for (const [nome, dono] of nasce) {
      if (nome === s.nome) continue;
      if (dono.recuo !== s.recuo) continue;   // outro nível, outro escopo
      if (dono.inicio <= s.fim) continue;     // já existia quando este rodou
      if (!new RegExp(`\\b${nome}\\b`).test(s.usos)) continue;
      /* MESMO BLOCO. Sem isto, dois `const` no mesmo recuo mas em FUNÇÕES
         diferentes eram comparados como se um pudesse ver o outro — foram 30
         avisos falsos, todos deste molde.

         O teste é barato e não precisa de análise de escopo: se entre os dois
         existe alguma linha com recuo MENOR, então o bloco de um fechou antes
         de o outro abrir. É o `}` da função anterior. */
      if (!mesmoBloco(linhas, s.fim, dono.inicio, s.recuo)) continue;

      achados.push(
        `${arquivo}:${s.inicio + 1}: "${s.nome}" usa "${nome}", declarado só na linha ${dono.inicio + 1} — zona morta de const`,
      );
    }
  }

  return achados;
}
