/* ────────────────────────────────────────────────────────────────────────────
   Atalhos de teclado — a validação do servidor.

   O catálogo de AÇÕES mora no cliente (`apps/web/src/utils/atalhos.js`), junto
   das telas que elas abrem, e é lá que ele deve morar: quem sabe que existe um
   botão "Portfólio ativo" é a tela que o desenha.

   O que o servidor precisa saber é menos que isso, e é de propósito. Ele guarda
   um objeto `{ id: tecla }` e cobra só o FORMATO:

     · o id parece um id de ação (`grupo.acao`)
     · a tecla é uma letra, um dígito, ou vazio

   Validar contra a lista de ações exigiria uma CÓPIA do catálogo aqui — e a
   cópia divergiria na primeira ação nova, recusando em silêncio um atalho que a
   tela oferece. O preço de não validar é uma chave órfã no JSON, que a tela
   ignora sozinha porque só lê os ids que conhece. É o lado barato de errar.

   ── VAZIO É UMA ESCOLHA ──

   `""` significa "não quero atalho para isto". Recusá-lo tiraria da pessoa a
   única forma de desligar um atalho que atrapalha.
   ──────────────────────────────────────────────────────────────────────────── */

const ID_VALIDO = /^[a-z][a-zA-Z0-9]*\.[a-zA-Z0-9]+$/;
const TECLA_VALIDA = /^[a-zA-Z0-9]$/;

/* Teto de chaves. Não é defesa contra o cliente — é contra um JSON crescendo
   sem limite numa coluna que ninguém olha. */
const MAXIMO = 200;

/**
 * Devolve o objeto pronto para gravar, ou `null` quando o corpo não presta.
 * `null` é recusa; `{}` é "sem nenhum atalho personalizado", que é válido e é
 * como se volta ao padrão da imobiliária.
 */
export function normalizarAtalhos(bruto) {
  if (bruto === null || bruto === undefined) return {};
  if (typeof bruto !== "object" || Array.isArray(bruto)) return null;

  const entradas = Object.entries(bruto);
  if (entradas.length > MAXIMO) return null;

  const saida = {};
  for (const [id, tecla] of entradas) {
    if (!ID_VALIDO.test(id)) return null;
    if (tecla === "" || tecla === null) { saida[id] = ""; continue; }
    if (typeof tecla !== "string" || !TECLA_VALIDA.test(tecla)) return null;
    saida[id] = tecla;
  }
  return saida;
}
