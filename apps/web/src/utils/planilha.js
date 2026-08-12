/* ────────────────────────────────────────────────────────────────────────────
   Leitura de planilha no navegador.

   O arquivo nunca sai da máquina de quem importa. Ele já está lá; mandá-lo para
   o servidor só para ser lido de volta gastaria banda e memória à toa, e o
   mapeamento ("esta coluna é o preço?") é conversa de ida e volta, que exigiria
   guardar o arquivo entre requisições. Ver o cabeçalho de `importacaoService.js`.

   A SheetJS entra por `import()` dinâmico: ela sozinha passa de 400 KB, e o
   bundle principal já está grande demais. Assim ela só é baixada por quem
   realmente abre a tela de importação e escolhe um arquivo — o resto do painel
   nem sabe que ela existe.
   ──────────────────────────────────────────────────────────────────────────── */

/** Acima disto o navegador engasga ao montar a prévia. */
export const TAMANHO_MAXIMO_MB = 20;

export const EXTENSOES_ACEITAS = ".xlsx,.xls,.xlsm,.csv,.ods";

let sheetjs = null;

async function carregarSheetJS() {
  if (!sheetjs) sheetjs = await import("xlsx");
  return sheetjs;
}

/* Cabeçalho de planilha real vem sujo: espaço sobrando, acento, maiúscula
   aleatória, coluna sem nome no meio. Normalizamos só para COMPARAR (no palpite
   automático); o nome exibido continua sendo o que a pessoa vê no Excel, senão
   ela não reconhece a própria planilha. */
export function normalizarTexto(valor) {
  return String(valor ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Lê o arquivo e devolve `{ abas, aba, colunas, linhas }`.
 *
 * `linhas` são objetos indexados pelo NOME da coluna, mais `__linha` — o número
 * da linha no Excel, contando o cabeçalho. É esse número que aparece quando uma
 * linha é recusada, para a pessoa achar o erro na planilha dela em vez de num
 * índice que só existe aqui dentro.
 */
export async function lerPlanilha(arquivo, { aba } = {}) {
  if (arquivo.size > TAMANHO_MAXIMO_MB * 1024 * 1024) {
    throw new Error(`Arquivo grande demais (máximo ${TAMANHO_MAXIMO_MB} MB).`);
  }

  const XLSX = await carregarSheetJS();
  const buffer = await arquivo.arrayBuffer();

  /* `cellDates` converte data de verdade em Date em vez do número de série do
     Excel (45000 e afins). `cellFormula: false` descarta as fórmulas e mantém
     só o valor calculado — é o valor que importa, e guardar fórmula de planilha
     alheia é peso morto. */
  const pasta = XLSX.read(buffer, { cellDates: true, cellFormula: false });

  const abas = pasta.SheetNames;
  const abaEscolhida = aba && abas.includes(aba) ? aba : abas[0];
  if (!abaEscolhida) throw new Error("A planilha não tem nenhuma aba.");

  /* `header: 1` devolve array de arrays: assim controlamos o cabeçalho na mão.
     Com o modo de objeto a SheetJS renomeia coluna repetida sozinha e some com
     a vazia, e aí o que aparece na tela deixa de bater com o Excel. */
  const matriz = XLSX.utils.sheet_to_json(pasta.Sheets[abaEscolhida], {
    header: 1,
    raw: true,
    defval: "",
    blankrows: false,
  });

  if (!matriz.length) throw new Error("A aba escolhida está vazia.");

  const [cabecalho, ...corpo] = matriz;
  const colunas = montarColunas(cabecalho);

  const linhas = corpo
    .map((celulas, i) => {
      const linha = { __linha: i + 2 }; // +2: o cabeçalho é a linha 1
      colunas.forEach((coluna, c) => {
        linha[coluna.chave] = valorDaCelula(celulas[c]);
      });
      return linha;
    })
    // Linha totalmente vazia no meio da planilha é separador visual, não dado.
    .filter((linha) => colunas.some((c) => String(linha[c.chave] ?? "").trim() !== ""));

  return { abas, aba: abaEscolhida, colunas, linhas };
}

/* Cada coluna ganha uma CHAVE estável e um RÓTULO. Eles se separam porque
   planilha de verdade repete cabeçalho ("Telefone", "Telefone") e deixa coluna
   sem título. A chave carrega a posição para nunca colidir; o rótulo é o que a
   pessoa lê. */
function montarColunas(cabecalho = []) {
  return cabecalho.map((bruto, i) => {
    const rotulo = String(bruto ?? "").trim();
    return {
      chave: `c${i}`,
      rotulo: rotulo || `Coluna ${letraDaColuna(i)}`,
      semTitulo: !rotulo,
      normalizado: normalizarTexto(rotulo),
    };
  });
}

/** 0 → A, 25 → Z, 26 → AA. Para nomear coluna sem título como o Excel nomeia. */
function letraDaColuna(indice) {
  let n = indice;
  let saida = "";
  do {
    saida = String.fromCharCode(65 + (n % 26)) + saida;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return saida;
}

function valorDaCelula(valor) {
  if (valor == null) return "";
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return valor;
}
