/* Os nomes das entidades que a importação traz, em português.

   Este arquivo é o que sobrou de `mapeamentoImportacao.js`. Aquele existia para
   a importação por PLANILHA: ele guardava, para cada campo, uma lista de
   apelidos de coluna ("valor", "preco venda", "price") e a heurística que
   palpitava qual coluna era qual.

   Nada disso sobrevive à troca para feed e API. Num XML VRSync ou num JSON, o
   nome do campo JÁ É o campo — não há palpite a dar nem pareamento a conferir.
   O que restou é o rótulo, que a tela usa para escrever "12 imóveis
   encontrados" sem um segundo dicionário. */
export const ROTULO_ENTIDADE = {
  clientes: "Clientes",
  imoveis: "Imóveis",
  usuarios: "Usuários",
};
