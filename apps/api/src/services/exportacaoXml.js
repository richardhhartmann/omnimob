/* ────────────────────────────────────────────────────────────────────────────
   A MESMA EXPORTAÇÃO, EM XML.

   ── POR QUE EXISTE ──

   O JSON responde a quem vai programar. O XML responde a quem vai MIGRAR: é o
   formato que os sistemas imobiliários brasileiros falam, e é o que a
   imobiliária consegue entregar ao fornecedor novo sem intermediário. Pedir a
   um concorrente que aceite JSON é transformar portabilidade em negociação.

   ── A REGRA QUE DECIDE O FORMATO ──

   O XML gerado aqui é EXATAMENTE o que `formatosImportacao.js` lê de volta:
   `<omnimob><imoveis><imovel>…`, com as fotos em `<fotos><foto>`. Isso não é
   simetria por elegância — é o teste de que a portabilidade funciona. Um
   arquivo de saída que o nosso próprio importador recusa não prova nada sobre
   levar os dados a lugar nenhum.

   Por isso os nomes das tags são os nomes dos nossos campos, sem tradução: o
   `doXmlOmnimob` copia chave por chave, e qualquer apelido aqui viraria um
   campo perdido na volta.

   ── DUAS DECISÕES QUE PARECEM DETALHE ──

   CAMPO VAZIO NÃO VIRA TAG VAZIA, VIRA AUSÊNCIA. `<creci></creci>` é lido como
   string vazia e, numa reimportação, SOBRESCREVE um CRECI preenchido do outro
   lado com nada. Ausência é a única forma de dizer "não sei", e é a que não
   destrói dado alheio.

   CARACTERE DE CONTROLE É REMOVIDO, NÃO ESCAPADO. O XML 1.0 proíbe quase todos,
   e não existe entidade que os represente — um byte de controle que entrou por
   colagem numa descrição tornaria o arquivo INTEIRO impossível de abrir. Um
   acervo de trezentos imóveis não pode ficar ilegível por causa de um caractere
   invisível em um deles.
   ──────────────────────────────────────────────────────────────────────────── */

/* O que o XML 1.0 aceita: tabulação, quebra de linha, retorno de carro, e do
   espaço para cima. O resto sai — ver o cabeçalho. A faixa é montada por CÓDIGO
   e não escrita com os caracteres em si: um byte de controle no meio do fonte é
   invisível para quem for ler este arquivo depois, e some numa colagem. */
const codigo = (n) => String.fromCharCode(n);
const CONTROLES_PROIBIDOS = new RegExp(
  `[^${codigo(9)}${codigo(10)}${codigo(13)}${codigo(32)}-${codigo(0xD7FF)}`
  + `${codigo(0xE000)}-${codigo(0xFFFD)}]`,
  "g",
);

function esc(valor) {
  return String(valor)
    .replace(CONTROLES_PROIBIDOS, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/* Nome de tag válido a partir de uma chave nossa. Na prática todas já são
   identificadores camelCase, mas a exportação carrega campos vindos de `Json`
   do cliente (`showcaseConfig`, `horarioAtendimento`), e ali a chave é o que a
   pessoa digitou. Uma chave com espaço ou acento geraria XML quebrado. */
function nomeDeTag(chave) {
  const limpo = String(chave).replace(/[^A-Za-z0-9_.-]/g, "_");
  return /^[A-Za-z_]/.test(limpo) ? limpo : `campo_${limpo}`;
}

/* O singular de cada lista, para o nó de dentro. Os três primeiros são os que o
   `formatosImportacao.js` procura pelo nome — mexer neles quebra a releitura. */
const SINGULAR = {
  imoveis: "imovel", clientes: "cliente", usuarios: "usuario",
  leads: "lead", vendas: "venda", perfis: "perfil",
  tipos: "tipo", cargos: "cargo", fotos: "foto", atributos: "atributo",
  eventos: "evento", images: "image",
};

const singularDe = (chave) => SINGULAR[chave] || "item";

function serializar(chave, valor, recuo) {
  /* Ausência, não tag vazia — ver o cabeçalho. `false` e `0` NÃO são ausência e
     precisam sair, senão "aceita permuta: não" viraria "não informado". */
  if (valor === null || valor === undefined || valor === "") return "";

  const tag = nomeDeTag(chave);
  const espaco = "  ".repeat(recuo);

  if (Array.isArray(valor)) {
    /* Lista vazia sai como tag vazia, e é a única exceção à regra acima:
       `<fotos/>` diz "este imóvel não tem foto", que é informação. */
    if (!valor.length) return `${espaco}<${tag}/>\n`;
    const dentro = singularDe(chave);
    const filhos = valor.map((item) => serializar(dentro, item, recuo + 1)).join("");
    return `${espaco}<${tag}>\n${filhos}${espaco}</${tag}>\n`;
  }

  if (valor instanceof Date) {
    return `${espaco}<${tag}>${esc(valor.toISOString())}</${tag}>\n`;
  }

  if (typeof valor === "object") {
    const filhos = Object.entries(valor)
      .map(([k, v]) => serializar(k, v, recuo + 1))
      .join("");
    /* Objeto cujos campos eram todos vazios não vira nó oco. */
    if (!filhos) return "";
    return `${espaco}<${tag}>\n${filhos}${espaco}</${tag}>\n`;
  }

  const texto = typeof valor === "boolean" ? (valor ? "true" : "false") : valor;
  return `${espaco}<${tag}>${esc(texto)}</${tag}>\n`;
}

/**
 * Converte o objeto de `exportarTudo` no XML da Omnimob.
 *
 * @param {object} dados  o que `exportarTudo` devolveu
 * @returns {string} documento XML completo, com declaração
 */
export function exportacaoParaXml(dados) {
  const corpo = Object.entries(dados || {})
    .map(([chave, valor]) => serializar(chave, valor, 1))
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<omnimob>\n${corpo}</omnimob>\n`;
}
