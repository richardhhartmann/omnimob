/* ────────────────────────────────────────────────────────────────────────────
   O id que vem da URL é SEMPRE texto.

   `useParams()` devolve pedaços do endereço, e endereço é string — não existe
   `/cargos/64` que chegue como número. Metade das entidades deste banco tem id
   de texto (`cuid`), e a outra metade tem id INTEIRO:

     texto     Usuario, Cliente, Property, Tenant…
     inteiro   Cargo (`crg_codigo`), TipoImovel (`tip_id`), Atributo (`atr_id`),
               Chamado (`cha_numero`)

   Com `===`, comparar o id da URL com o da lista funciona na primeira metade e
   falha SILENCIOSAMENTE na segunda: `64 === "64"` é falso. O sintoma não parece
   um erro de tipo — a tela diz "não encontrei este cargo" e devolve a pessoa
   para a lista, como se o registro tivesse sumido. Foi assim que editar cargo e
   tipo de imóvel parou de funcionar sem que nenhuma requisição falhasse: o
   servidor respondia certo, e a comparação é que descartava a resposta.

   Por que uma função e não `String(a) === String(b)` espalhado: porque o erro
   volta na próxima entidade de id inteiro, e o próximo a escrever a linha não
   tem como saber de cabeça qual metade da lista acima ele está usando.

   `==` resolveria a mesma coisa em menos letras e está proibido por bons
   motivos — ele também casa `null` com `undefined` e `0` com `""`, e aqui isso
   faria "sem id" achar o primeiro registro sem id da lista.
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Os dois identificam o mesmo registro?
 *
 * `null`/`undefined`/`""` nunca casam com nada — nem entre si: "não tenho id"
 * não é um id, e tratá-lo como um é o que faria a tela abrir um registro
 * qualquer no lugar de nenhum.
 */
export function mesmoId(a, b) {
  if (a === null || a === undefined || a === "") return false;
  if (b === null || b === undefined || b === "") return false;
  return String(a) === String(b);
}
