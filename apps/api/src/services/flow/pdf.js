/* ────────────────────────────────────────────────────────────────────────────
   TEXTO → PDF, escrito à mão.

   ── POR QUE NÃO UMA BIBLIOTECA ──

   Porque o que precisamos é a fatia mais estreita de um formato enorme: um
   contrato é texto corrido, uma fonte só, sem imagem, sem tabela, sem cor. O
   `pdfkit` traz 2 MB e um motor de layout para resolver isso; o headless Chrome
   traz um navegador inteiro. Nenhum dos dois cabe num serviço que hoje sobe em
   segundos no Render.

   E, ao contrário do XML do VRSync ou da minuta, aqui não há ambiguidade de
   INTERPRETAÇÃO: a especificação do PDF diz onde cada byte vai, e ou o arquivo
   abre ou não abre.

   ── POR QUE COURIER, E NÃO TIMES ──

   Porque o bloco de assinaturas do `MODELO_INICIAL` é alinhado por COLUNAS DE
   ESPAÇOS:

       _______________________________        _______________________________
       Fulano de Tal                          Sicrano de Tal
       VENDEDOR                               COMPRADOR

   Em fonte proporcional, "Fulano de Tal" e "Sicrano de Tal" têm larguras
   diferentes e as duas colunas deixam de existir — o nome do comprador
   escorrega para debaixo da linha do vendedor. O HTML que este arquivo
   substituiu usava `<pre>` com Times New Roman e tinha exatamente esse defeito,
   latente, esperando o primeiro contrato de verdade.

   Monospace resolve o alinhamento e, de quebra, torna a quebra de linha EXATA:
   toda glifa da Courier mede 600/1000 do corpo, então largura é contagem de
   caracteres e não há tabela de métricas para manter.

   Se um dia o corpo ganhar formatação de verdade (negrito, títulos), a conversa
   muda e aí sim entra uma biblioteca — mas aí o `minutas.js` também muda, e é
   ele quem decide.
   ──────────────────────────────────────────────────────────────────────────── */

/* A4 em pontos (1 pt = 1/72 pol). */
const LARGURA_PAGINA = 595.28;
const ALTURA_PAGINA = 841.89;
const MARGEM_X = 56.7;   // 2 cm
const MARGEM_Y = 70.9;   // 2,5 cm
const CORPO = 10;        // pt
const ENTRELINHA = 14;   // pt

/* Courier: toda glifa mede 0,6 em. Daí a largura utilizável virar um número
   inteiro de colunas, e a quebra de linha ser contagem de caractere. */
const LARGURA_GLIFA = CORPO * 0.6;
const COLUNAS = Math.floor((LARGURA_PAGINA - 2 * MARGEM_X) / LARGURA_GLIFA);
const LINHAS_POR_PAGINA = Math.floor((ALTURA_PAGINA - 2 * MARGEM_Y) / ENTRELINHA);

/* ── WinAnsi (cp1252) ────────────────────────────────────────────────────────
   As 14 fontes-padrão não carregam Unicode: o texto vai byte a byte e a fonte é
   declarada com `/Encoding /WinAnsiEncoding`. De 0xA0 a 0xFF o cp1252 coincide
   com o latin-1, então acento português passa direto; o que NÃO passa é a faixa
   0x80–0x9F, e é justamente onde mora o travessão do "CLÁUSULA 1ª — DO OBJETO"
   e as aspas curvas que vêm de qualquer texto colado do Word. Sem esta tabela
   eles virariam "?" no contrato assinado. */
const CP1252 = new Map(Object.entries({
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85,
  "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89, "Š": 0x8a,
  "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91, "’": 0x92,
  "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97,
  "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c,
  "ž": 0x9e, "Ÿ": 0x9f,
}));

function paraWinAnsi(texto) {
  const bytes = [];
  for (const ch of String(texto)) {
    const cp = ch.codePointAt(0);
    if (cp === 0x0a || cp === 0x0d) continue;
    if (cp >= 0x20 && cp <= 0x7e) { bytes.push(cp); continue; }
    if (cp >= 0xa0 && cp <= 0xff) { bytes.push(cp); continue; }
    const mapeado = CP1252.get(ch);
    /* Fora do cp1252 (emoji, alfabeto não-latino). Ponto de interrogação é
       feio, mas um byte inválido faria o leitor recusar o arquivo INTEIRO — e
       um contrato que não abre é pior que um contrato com "?". */
    bytes.push(mapeado ?? 0x3f);
  }
  return Buffer.from(bytes);
}

/* `(`, `)` e `\` delimitam string literal no PDF; soltos, quebram o objeto. */
function escaparPdf(buf) {
  const saida = [];
  for (const b of buf) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) saida.push(0x5c);
    saida.push(b);
  }
  return Buffer.from(saida);
}

/* ── Quebra de linha ─────────────────────────────────────────────────────────
   Gulosa, por palavra, preservando a indentação da linha original nas
   continuações — sem isso um item recuado volta para a margem no meio da frase
   e deixa de parecer um item. Palavra maior que a linha inteira (uma URL, uma
   matrícula sem espaço) é partida na força: a alternativa seria deixá-la vazar
   para fora da margem direita, onde a impressora corta. */
export function quebrarLinhas(texto, colunas = COLUNAS) {
  const saida = [];
  for (const linha of String(texto ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    if (!linha.trim()) { saida.push(""); continue; }
    if (linha.length <= colunas) { saida.push(linha); continue; }

    const recuo = (linha.match(/^[ \t]*/) || [""])[0].slice(0, Math.max(0, colunas - 10));
    let atual = "";
    for (let palavra of linha.trim().split(/\s+/)) {
      /* Palavra que não cabe nem numa linha vazia: parte no limite. */
      while (recuo.length + palavra.length > colunas) {
        const usado = atual ? atual.length + 1 : recuo.length;
        const cabe = colunas - usado;
        if (cabe > 0) {
          atual = (atual ? `${atual} ` : recuo) + palavra.slice(0, cabe);
          palavra = palavra.slice(cabe);
        }
        saida.push(atual);
        atual = "";
      }
      const candidata = atual ? `${atual} ${palavra}` : recuo + palavra;
      if (candidata.length > colunas) { saida.push(atual); atual = recuo + palavra; }
      else atual = candidata;
    }
    if (atual) saida.push(atual);
  }
  return saida;
}

/**
 * O contrato como PDF/A4, pronto para subir a qualquer provedor de assinatura.
 * Devolve um Buffer — quem chama decide se vira base64, arquivo ou resposta.
 */
export function textoParaPdf(titulo, corpo) {
  const linhas = quebrarLinhas(corpo);

  /* Paginação. Uma lista vazia produziria zero páginas e um /Kids vazio, que o
     leitor recusa; daí o mínimo de uma. */
  const paginas = [];
  for (let i = 0; i < Math.max(linhas.length, 1); i += LINHAS_POR_PAGINA) {
    paginas.push(linhas.slice(i, i + LINHAS_POR_PAGINA));
  }

  /* Layout dos ids: 1 catálogo, 2 árvore de páginas, 3 fonte, 4 info, e daí em
     diante um PAR (página, conteúdo) por página. */
  const ID_CATALOGO = 1;
  const ID_PAGINAS = 2;
  const ID_FONTE = 3;
  const ID_INFO = 4;
  const PRIMEIRA_PAGINA = 5;

  const objetos = [];
  const idsDePagina = paginas.map((_, i) => PRIMEIRA_PAGINA + i * 2);

  objetos[ID_CATALOGO] = Buffer.from(`<< /Type /Catalog /Pages ${ID_PAGINAS} 0 R >>`, "latin1");
  objetos[ID_PAGINAS] = Buffer.from(
    `<< /Type /Pages /Kids [${idsDePagina.map((id) => `${id} 0 R`).join(" ")}] /Count ${paginas.length} >>`,
    "latin1",
  );
  objetos[ID_FONTE] = Buffer.from(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
    "latin1",
  );
  objetos[ID_INFO] = Buffer.concat([
    Buffer.from("<< /Title (", "latin1"),
    escaparPdf(paraWinAnsi(titulo || "Contrato")),
    Buffer.from(") /Producer (Omniflow) >>", "latin1"),
  ]);

  paginas.forEach((linhasDaPagina, i) => {
    const idPagina = idsDePagina[i];
    const idConteudo = idPagina + 1;

    /* O texto começa na linha de base da PRIMEIRA linha, que fica uma
       entrelinha abaixo do topo da área útil — senão ela nasce colada na borda
       de cima. */
    const topo = ALTURA_PAGINA - MARGEM_Y - ENTRELINHA;
    const partes = [
      Buffer.from(
        `BT /F1 ${CORPO} Tf ${ENTRELINHA} TL 1 0 0 1 ${MARGEM_X.toFixed(2)} ${topo.toFixed(2)} Tm\n`,
        "latin1",
      ),
    ];
    for (const linha of linhasDaPagina) {
      if (linha) {
        partes.push(
          Buffer.from("(", "latin1"),
          escaparPdf(paraWinAnsi(linha)),
          Buffer.from(") Tj\n", "latin1"),
        );
      }
      partes.push(Buffer.from("T*\n", "latin1"));   // desce uma entrelinha
    }
    partes.push(Buffer.from("ET", "latin1"));
    const fluxo = Buffer.concat(partes);

    objetos[idPagina] = Buffer.from(
      `<< /Type /Page /Parent ${ID_PAGINAS} 0 R /MediaBox [0 0 ${LARGURA_PAGINA} ${ALTURA_PAGINA}] ` +
      `/Resources << /Font << /F1 ${ID_FONTE} 0 R >> >> /Contents ${idConteudo} 0 R >>`,
      "latin1",
    );
    objetos[idConteudo] = Buffer.concat([
      Buffer.from(`<< /Length ${fluxo.length} >>\nstream\n`, "latin1"),
      fluxo,
      Buffer.from("\nendstream", "latin1"),
    ]);
  });

  /* ── Montagem ──────────────────────────────────────────────────────────────
     A tabela xref guarda o deslocamento em BYTES de cada objeto desde o início
     do arquivo, em campos de largura fixa. Por isso a montagem é feita com
     Buffer e não com string: o corpo tem acento em cp1252, e contar caractere
     em vez de byte deslocaria a tabela inteira — o sintoma seria um PDF que
     abre em alguns leitores e não em outros. */
  const cabecalho = Buffer.concat([
    Buffer.from("%PDF-1.4\n", "latin1"),
    /* Comentário binário: marca o arquivo como não-texto para que servidores e
       clientes de e-mail não o transfiram em modo ASCII e o corrompam. */
    Buffer.from([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]),
  ]);

  const pedacos = [cabecalho];
  let deslocamento = cabecalho.length;
  const offsets = [];

  for (let id = 1; id < objetos.length; id += 1) {
    if (!objetos[id]) continue;
    const bloco = Buffer.concat([
      Buffer.from(`${id} 0 obj\n`, "latin1"),
      objetos[id],
      Buffer.from("\nendobj\n", "latin1"),
    ]);
    offsets[id] = deslocamento;
    pedacos.push(bloco);
    deslocamento += bloco.length;
  }

  const total = objetos.length;
  let xref = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let id = 1; id < total; id += 1) {
    xref += `${String(offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${total} /Root ${ID_CATALOGO} 0 R /Info ${ID_INFO} 0 R >>\n`;
  xref += `startxref\n${deslocamento}\n%%EOF\n`;
  pedacos.push(Buffer.from(xref, "latin1"));

  return Buffer.concat(pedacos);
}

export const _internos = { paraWinAnsi, escaparPdf, COLUNAS, LINHAS_POR_PAGINA };
