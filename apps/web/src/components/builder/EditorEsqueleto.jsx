import { Skeleton } from "../Skeleton.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   O editor enquanto a vitrine ainda não chegou.

   ── POR QUE NÃO É SÓ UM "Carregando…" ──

   Antes, a casca do editor aparecia INTEIRA e vazia: rail, prancheta em branco
   e inspetor, todos clicáveis. Dava para arrastar uma peça, aplicar um template
   ou apertar Ctrl+Z sobre um documento que ainda não existia — e o `config`
   chegava logo depois e passava por cima. O aviso de "Carregando…" ficava num
   canto da barra, onde ninguém olha enquanto tenta clicar.

   Aqui a regra é a mesma da vitrine: mostrar a FORMA do que vem, não uma tela
   vazia. As três colunas ficam onde vão ficar, com o mesmo peso, então nada
   pula de lugar quando o conteúdo real entra.

   ── É DECORATIVO, E ISSO É PROPOSITAL ──

   Nenhum elemento daqui responde a clique, e a casca inteira vai com `inert`
   enquanto carrega — que bloqueia ponteiro, teclado E leitor de tela de uma vez
   só. `pointer-events: none` sozinho deixaria o Tab passear pelos botões
   invisíveis por baixo.

   `aria-hidden` + `aria-busy` na região: quem usa leitor de tela ouve "ocupado"
   em vez de uma lista de caixas sem nome.
   ──────────────────────────────────────────────────────────────────────────── */

/* O shimmer é o `.skeleton-block` do resto do painel — mesma animação, uma
   definição só. O que muda no editor é a COR, e ela vem por token dentro de
   `.ed-esq` (o editor tem a própria paleta, sempre escura). */
function Bloco({ w = "100%", h = 14, r = 8, style }) {
  return <Skeleton width={w} height={h} radius={r} style={style} />;
}

export function EditorEsqueleto() {
  return (
    <div className="editor-workspace ed-esq" aria-busy="true" aria-label="Carregando o editor da vitrine">
      {/* Rail da esquerda: as abas e a biblioteca de peças. */}
      <div className="ed-esq__rail" aria-hidden="true">
        <div className="ed-esq__abas">
          <Bloco w="32%" h={28} r={9} />
          <Bloco w="32%" h={28} r={9} />
          <Bloco w="32%" h={28} r={9} />
        </div>
        <Bloco w="55%" h={11} style={{ marginTop: 18, marginBottom: 10 }} />
        <div className="ed-esq__biblioteca">
          {Array.from({ length: 8 }, (_, i) => <Bloco key={i} h={62} r={10} />)}
        </div>
      </div>

      {/* Prancheta: a folha centrada, com a silhueta dos blocos fixos da
          vitrine — cabeçalho, título, destaques, grade de imóveis, rodapé. */}
      <div className="ed-esq__palco" aria-hidden="true">
        <div className="ed-esq__folha">
          <Bloco h={72} r={0} />
          <div className="ed-esq__miolo">
            <Bloco w="45%" h={26} />
            <Bloco w="70%" h={13} style={{ marginTop: 10 }} />
            <div className="ed-esq__destaques">
              {Array.from({ length: 3 }, (_, i) => <Bloco key={i} h={84} r={12} />)}
            </div>
            <div className="ed-esq__imoveis">
              {Array.from({ length: 6 }, (_, i) => <Bloco key={i} h={188} r={12} />)}
            </div>
          </div>
          <Bloco h={92} r={0} />
        </div>
      </div>

      {/* Inspetor da direita: as seções recolhíveis. */}
      <div className="ed-esq__inspetor" aria-hidden="true">
        <Bloco w="60%" h={13} style={{ marginBottom: 14 }} />
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="ed-esq__secao">
            <Bloco w="45%" h={11} />
            <Bloco h={34} r={9} style={{ marginTop: 9 }} />
            <Bloco h={34} r={9} style={{ marginTop: 7 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
