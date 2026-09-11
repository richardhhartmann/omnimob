/* ────────────────────────────────────────────────────────────────────────────
   As opções de um seletor, editadas como fichas.

   ── POR QUE ESTE É O ÚNICO CASO QUE AINDA PRECISA DE UM EDITOR À PARTE ──

   A regra da vitrine é editar o item ONDE ele aparece: o chip de região é o
   próprio campo, a etapa de "Como funciona" é o próprio campo, a pergunta do
   FAQ também. Some o × no item, e um `+` no fim da fila para o próximo.

   Aqui não dá, e o motivo é o `<select>`: as opções não existem como elemento
   na tela — elas estão dentro de uma lista que o navegador só abre no clique, e
   não há nada em que clicar para renomear "Apartamento". Esconder o seletor no
   editor e mostrar as fichas no lugar dele resolveria a edição e quebraria o
   WYSIWYG, que é a regra mais forte deste construtor.

   Então as fichas ficam LOGO ABAIXO do seletor que elas alimentam, com a mesma
   gramática dos outros: texto editável na ficha, × para tirar, `+` no fim.
   ──────────────────────────────────────────────────────────────────────────── */

export function ListaEditavel({ rotulo, itens, aoMudar, limite = 16 }) {
  const lista = Array.isArray(itens) ? itens : [];

  const trocar = (i, valor) => aoMudar(lista.map((item, j) => (j === i ? valor : item)));
  const tirar = (i) => aoMudar(lista.filter((_, j) => j !== i));

  return (
    <div className="widget-editor-apenas lista-editavel" aria-label={`Opções de ${rotulo}`}>
      {lista.map((item, i) => (
        // Índice como chave: o texto muda a cada tecla, e usá-lo como
        // identidade remontaria o campo e tiraria o cursor dele.
        <span className="lista-editavel__ficha" key={i}>
          <input
            className="lista-editavel__campo"
            value={item}
            onChange={(e) => trocar(i, e.target.value)}
            placeholder="Opção"
            aria-label={`${rotulo}: opção ${i + 1}`}
            /* A ficha acompanha o que foi digitado em vez de ter largura fixa:
               "Comercial" e "Cobertura duplex" não pedem o mesmo espaço, e uma
               fila de caixas do mesmo tamanho não parece a lista que ela é. */
            size={Math.max(6, String(item || "").length + 1)}
          />
          <button
            type="button"
            className="lista-editavel__tirar"
            onClick={() => tirar(i)}
            title="Remover esta opção"
          >
            ×
          </button>
        </span>
      ))}
      {lista.length < limite ? (
        <button
          type="button"
          className="lista-editavel__mais"
          onClick={() => aoMudar([...lista, ""])}
          title={`Acrescentar em ${rotulo}`}
        >
          +
        </button>
      ) : null}
    </div>
  );
}
