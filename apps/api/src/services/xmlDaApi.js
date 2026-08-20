import { xmlEscape } from "./feedPortais.js";

/* ────────────────────────────────────────────────────────────────────────────
   O XML que a API da imobiliária devolve.

   Não é VRSync, e a diferença é de propósito. O VRSync existe para ANUNCIAR:
   ele descreve um imóvel do jeito que um portal precisa exibi-lo, e não tem
   onde pôr cliente, corretor nem código interno. Continua servido em
   `/public/:slug/feed.xml`, que é o que os portais consomem.

   Este aqui existe para MOVER DADO. As tags são os nossos campos, com os nossos
   nomes, e por isso ele é simétrico: o que sai por aqui volta pela importação
   sem conversão nenhuma. Uma imobiliária que troque de conta, ou que queira uma
   cópia do que é dela, faz o caminho inteiro sem escrever código.

   `xmlEscape` vem do feed dos portais porque o problema é idêntico — texto de
   cliente com `&` no meio, descrição colada do Word com caracteres de controle
   que derrubam o parser do outro lado sem dizer onde. Uma implementação só.
   ──────────────────────────────────────────────────────────────────────────── */

/* Valor ausente vira tag ausente, não tag vazia. `<cpf></cpf>` e `<cpf/>` são
   lidos por metade dos parsers como string vazia e pela outra metade como
   objeto — e a importação do outro lado gravaria "" onde não havia dado. */
function tag(nome, valor, recuo) {
  if (valor === null || valor === undefined || valor === "") return "";
  return `${recuo}<${nome}>${xmlEscape(valor)}</${nome}>`;
}

function objetoParaXml(nome, objeto, recuo = "    ") {
  const dentro = `${recuo}  `;
  const linhas = [];
  for (const [chave, valor] of Object.entries(objeto)) {
    if (Array.isArray(valor)) {
      if (!valor.length) continue;
      /* Lista com um invólucro nomeado: `<fotos><foto>…</foto></fotos>`. Sem o
         invólucro, uma lista de um item vira indistinguível de um campo
         simples — e o leitor do outro lado erra justamente no caso de borda. */
      const singular = chave.replace(/s$/, "");
      linhas.push(`${dentro}<${chave}>`);
      for (const item of valor) linhas.push(tag(singular, item, `${dentro}  `));
      linhas.push(`${dentro}</${chave}>`);
      continue;
    }
    const linha = tag(chave, valor, dentro);
    if (linha) linhas.push(linha);
  }
  return `${recuo}<${nome}>\n${linhas.filter(Boolean).join("\n")}\n${recuo}</${nome}>`;
}

const SINGULAR = { imoveis: "imovel", clientes: "cliente", usuarios: "usuario", leads: "lead" };

/**
 * Envelope da resposta em XML.
 * @param {string} entidade  "imoveis" | "clientes" | "usuarios" | "leads"
 * @param {Array<object>} itens  já no formato público (sem campo sensível)
 * @param {object} meta  { total, pagina, porPagina }
 */
export function montarXmlOmnimob(entidade, itens, meta = {}) {
  const singular = SINGULAR[entidade] || "item";
  const corpo = itens.map((item) => objetoParaXml(singular, item)).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<omnimob>
  <meta>
    <entidade>${xmlEscape(entidade)}</entidade>
    ${tag("total", meta.total, "")}
    ${tag("pagina", meta.pagina, "")}
    ${tag("porPagina", meta.porPagina, "")}
    <geradoEm>${new Date().toISOString()}</geradoEm>
  </meta>
  <${entidade}>
${corpo}
  </${entidade}>
</omnimob>
`;
}
