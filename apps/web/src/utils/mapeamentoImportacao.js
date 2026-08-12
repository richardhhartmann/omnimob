import { normalizarTexto } from "./planilha";

/* ────────────────────────────────────────────────────────────────────────────
   O que a planilha da outra plataforma vira aqui dentro.

   Cada campo lista APELIDOS: os nomes de coluna que os sistemas por aí usam
   para a mesma coisa. Eles existem para o palpite automático — a tela chuta o
   pareamento, a pessoa confere e corrige. Chutar errado custa um clique;
   obrigar a parear quarenta colunas na mão custa a importação inteira.

   Os apelidos são comparados já normalizados (sem acento, sem maiúscula, sem
   pontuação), então "Nº de Quartos", "num quartos" e "QUARTOS" caem todos no
   mesmo lugar sem precisar de uma entrada para cada grafia.
   ──────────────────────────────────────────────────────────────────────────── */

/* `chave` casa com o nome que o `importacaoService` espera receber no JSON —
   por isso alguns estão em inglês: são os campos do modelo Property, que nasceu
   assim. Renomear lá para o português é limpeza que vale a pena um dia, mas não
   no meio de uma feature. */
export const CAMPOS = {
  clientes: [
    { chave: "nome", rotulo: "Nome", obrigatorio: true, apelidos: ["nome", "nome completo", "cliente", "razao social", "nome cliente", "name"] },
    { chave: "cpf", rotulo: "CPF", chaveDeIdentidade: true, apelidos: ["cpf", "cpf cnpj", "documento", "doc", "cnpj"] },
    { chave: "email", rotulo: "E-mail", apelidos: ["email", "e mail", "correio eletronico", "mail"] },
    { chave: "telefone", rotulo: "Telefone", apelidos: ["telefone", "fone", "tel", "celular", "contato", "phone"] },
    { chave: "whatsapp", rotulo: "WhatsApp", apelidos: ["whatsapp", "whats", "zap", "wpp"] },
    { chave: "observacoes", rotulo: "Observações", apelidos: ["observacoes", "observacao", "obs", "anotacoes", "comentarios", "notas"] },
    { chave: "origemExterna", rotulo: "Código no sistema antigo", identificador: true, apelidos: ["id", "codigo", "cod", "referencia", "ref", "codigo cliente", "id cliente"] },
  ],

  imoveis: [
    { chave: "title", rotulo: "Título", obrigatorio: true, apelidos: ["titulo", "nome", "descricao curta", "anuncio", "title", "imovel"] },
    { chave: "price", rotulo: "Preço", obrigatorio: true, apelidos: ["preco", "valor", "valor venda", "preco venda", "valor imovel", "price"] },
    { chave: "tipoImovel", rotulo: "Tipo", apelidos: ["tipo", "tipo imovel", "categoria", "finalidade"] },
    { chave: "description", rotulo: "Descrição", apelidos: ["descricao", "descricao completa", "detalhes", "texto", "observacao", "description"] },
    { chave: "address", rotulo: "Endereço", apelidos: ["endereco", "logradouro", "rua", "endereco completo", "address"] },
    { chave: "neighborhood", rotulo: "Bairro", apelidos: ["bairro", "regiao", "neighborhood"] },
    { chave: "city", rotulo: "Cidade", apelidos: ["cidade", "municipio", "city"] },
    { chave: "state", rotulo: "Estado (UF)", apelidos: ["estado", "uf", "state"] },
    { chave: "bedrooms", rotulo: "Quartos", apelidos: ["quartos", "dormitorios", "num quartos", "qtd quartos", "n quartos", "bedrooms", "suites"] },
    { chave: "fotos", rotulo: "Fotos (URL)", multiplas: true, apelidos: ["foto", "fotos", "imagem", "imagens", "url foto", "link foto", "galeria", "photo", "photos", "image"] },
    { chave: "origemExterna", rotulo: "Código no sistema antigo", identificador: true, apelidos: ["id", "codigo", "cod", "referencia", "ref", "codigo imovel", "id imovel"] },
  ],

  usuarios: [
    { chave: "nome", rotulo: "Nome", obrigatorio: true, apelidos: ["nome", "nome completo", "usuario", "corretor", "name"] },
    { chave: "login", rotulo: "Login", apelidos: ["login", "usuario", "user", "username", "acesso"] },
    { chave: "email", rotulo: "E-mail", apelidos: ["email", "e mail", "mail"] },
    { chave: "cargo", rotulo: "Cargo", apelidos: ["cargo", "funcao", "perfil", "papel", "role", "tipo"] },
    { chave: "origemExterna", rotulo: "Código no sistema antigo", identificador: true, apelidos: ["id", "codigo", "cod", "referencia", "ref"] },
  ],
};

export const ROTULO_ENTIDADE = {
  clientes: "Clientes",
  imoveis: "Imóveis",
  usuarios: "Usuários",
};

/* Uma coluna só é sugerida quando o nome dela é igual a um apelido, ou quando
   um contém o outro inteiro. Nada de similaridade por letra: "cidade" e
   "unidade" são parecidos demais para um palpite e diferentes demais para um
   acerto, e um pareamento errado que passa despercebido é pior que nenhum. */
function pontuar(coluna, campo) {
  const nome = coluna.normalizado;
  if (!nome) return 0;

  /* Duas colunas podem casar exatamente com o MESMO campo — "Telefone" e
     "Celular" são as duas apelido de telefone. Aí vale a ordem da lista: o
     primeiro apelido é o nome canônico do campo, e é ele que deve ganhar.
     Sem esse desempate a escolha sai por ordem de coluna na planilha, que é
     acaso, e "Celular" acaba levando o lugar de "Telefone". */
  for (const [posicao, apelido] of campo.apelidos.entries()) {
    if (nome === apelido) return 100 - posicao;
    if (nome.startsWith(`${apelido} `) || nome.endsWith(` ${apelido}`)) return 70 - posicao;
    if (nome.includes(apelido) && apelido.length >= 4) return 50 - posicao;
  }
  return 0;
}

/**
 * Chuta o pareamento. Devolve `{ [chaveDoCampo]: chaveDaColuna | chaveDaColuna[] }`.
 *
 * Campo de `fotos` aceita várias colunas de uma vez, porque exportação costuma
 * vir como "Foto 1", "Foto 2", "Foto 3" em vez de uma coluna com tudo junto.
 * Os demais são um para um — e uma coluna não pode servir a dois campos, senão
 * "Contato" viraria telefone e WhatsApp ao mesmo tempo sem ninguém perceber.
 */
export function palpitarMapeamento(entidade, colunas) {
  const campos = CAMPOS[entidade] || [];
  const mapa = {};
  const usadas = new Set();

  for (const campo of campos) {
    if (campo.multiplas) {
      const todas = colunas
        .filter((c) => !usadas.has(c.chave) && pontuar(c, campo) > 0)
        .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR", { numeric: true }));
      if (todas.length) {
        mapa[campo.chave] = todas.map((c) => c.chave);
        todas.forEach((c) => usadas.add(c.chave));
      }
      continue;
    }

    let melhor = null;
    let melhorNota = 0;
    for (const coluna of colunas) {
      if (usadas.has(coluna.chave)) continue;
      const nota = pontuar(coluna, campo);
      if (nota > melhorNota) { melhor = coluna; melhorNota = nota; }
    }
    if (melhor) { mapa[campo.chave] = melhor.chave; usadas.add(melhor.chave); }
  }

  return mapa;
}

/* Uma célula de fotos pode trazer várias URLs empilhadas. Quebramos em vírgula,
   ponto e vírgula, barra vertical e quebra de linha — mas nunca em espaço: URL
   não tem espaço, e quebrar por ele estilhaçaria qualquer link que tivesse um
   por descuido. */
export function separarUrls(valor) {
  return String(valor ?? "")
    .split(/[,;|\n\r]+/)
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//i.test(u));
}

/**
 * Aplica o mapeamento e devolve as linhas no formato que a API espera.
 * `__linha` viaja junto para que um erro volte apontando a linha do Excel.
 */
export function aplicarMapeamento(entidade, linhas, mapa) {
  const campos = CAMPOS[entidade] || [];
  return linhas.map((linha) => {
    const saida = { __linha: linha.__linha };
    for (const campo of campos) {
      const origem = mapa[campo.chave];
      if (!origem) continue;

      if (campo.multiplas) {
        const colunas = Array.isArray(origem) ? origem : [origem];
        saida[campo.chave] = colunas.flatMap((c) => separarUrls(linha[c]));
        continue;
      }

      const valor = linha[origem];
      saida[campo.chave] = typeof valor === "string" ? valor.trim() : valor;
    }
    return saida;
  });
}

/**
 * Problemas que dá para ver ANTES de mandar qualquer coisa para o servidor.
 * Só o que é barato conferir aqui: campo obrigatório em branco e preço
 * ilegível. O resto (tipo que não existe, cargo que não casa) o servidor
 * responde, porque depende do que está cadastrado nesta imobiliária.
 */
export function conferirLinhas(entidade, linhasMapeadas) {
  const campos = CAMPOS[entidade] || [];
  const obrigatorios = campos.filter((c) => c.obrigatorio);
  const problemas = [];

  for (const linha of linhasMapeadas) {
    for (const campo of obrigatorios) {
      const valor = linha[campo.chave];
      if (valor == null || String(valor).trim() === "") {
        problemas.push({ linha: linha.__linha, motivo: `${campo.rotulo} está em branco.` });
      }
    }
  }
  return problemas;
}
