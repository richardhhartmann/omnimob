/* ────────────────────────────────────────────────────────────────────────────
   Trilha de navegação — no lugar do botão "voltar".

   ── O QUE MUDA EM RELAÇÃO AO BOTÃO ──

   O botão de voltar respondia uma pergunta só ("como saio daqui?") e escondia
   as outras duas que a pessoa faz ao chegar numa sub-página: onde estou, e o
   que mais existe ao lado disto. Ele também mentia por omissão — parecia o
   Voltar do navegador, mas ia para o índice, que nem sempre é de onde a pessoa
   veio. Quem chegou em Funil de Vendas pelo submenu da barra lateral nunca
   passou pelo índice de Relatórios; o botão a mandava para um lugar novo
   dizendo "voltar".

   A trilha diz a verdade: é a POSIÇÃO, não o histórico. "Relatórios → Funil de
   vendas" descreve onde a página mora, e cada degrau leva ao seu lugar.

   ── TODOS OS DEGRAUS SÃO CLICÁVEIS ──

   Inclusive o último, que é a página atual. Convenção de mercado costuma
   deixá-lo inerte, e o argumento é bom (clicar não leva a lugar nenhum). Mas
   inerte ele vira um rótulo no meio de links, e a pessoa que tenta clicar não
   descobre que "não é clicável" — descobre que "não funcionou". Clicar nele
   reencena o próprio endereço, que é inofensivo, e o `aria-current="page"`
   conta a quem usa leitor de tela o que a cor já conta a quem enxerga.

   ── TODOS OS DEGRAUS TÊM O MESMO PESO ──

   Nenhum degrau é maior, mais escuro ou em negrito. A trilha é um caminho, e
   caminho não tem parte mais importante: hierarquizar o último transformava a
   linha num título com um link colado na frente, que é outra coisa.

   O atual se distingue só pelo que não é enfeite — `aria-current="page"` para
   quem usa leitor de tela, e o fundo do hover que não promete navegação.
   ──────────────────────────────────────────────────────────────────────────── */

function Degrau({ item, atual }) {
  const { rotulo, Icone, aoIr } = item;

  const conteudo = (
    <>
      {Icone ? (
        <span className="trilha__icone" aria-hidden="true">
          <Icone size={15} weight="regular" />
        </span>
      ) : null}
      <span className="trilha__texto">{rotulo}</span>
    </>
  );

  return (
    <button
      type="button"
      className={`trilha__degrau${atual ? " is-atual" : ""}`}
      onClick={aoIr}
      aria-current={atual ? "page" : undefined}
      /* Sem destino o degrau ainda existe e ainda se lê — ele só deixa de
         responder ao clique. É o caso de um nível intermediário que não tem
         página própria; melhor mostrá-lo apagado do que sumir com ele e
         quebrar a leitura do caminho. */
      disabled={!aoIr}
    >
      {conteudo}
    </button>
  );
}

export function Trilha({ itens = [] }) {
  const visiveis = itens.filter(Boolean);
  if (!visiveis.length) return null;

  return (
    <nav className="trilha" aria-label="Trilha de navegação">
      {visiveis.map((item, i) => {
        const ultimo = i === visiveis.length - 1;
        return (
          <span className="trilha__par" key={item.chave || item.rotulo}>
            <Degrau item={item} atual={ultimo} />
            {/* A seta é decoração: quem usa leitor de tela recebe a estrutura
                pela navegação e pelo `aria-current`, e ouvir "seta para a
                direita" entre cada nome só atrapalharia. */}
            {!ultimo ? <span className="trilha__seta" aria-hidden="true">›</span> : null}
          </span>
        );
      })}
    </nav>
  );
}
