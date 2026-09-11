import { WIDGET_LIBRARY } from "../components/builder/data/biblioteca.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   OS CARTÕES DA GAVETA MOSTRAM A PEÇA, E NÃO SÓ O NOME DELA.

   A gaveta do Puck desenha uma lista de rótulos: "Texto", "Aviso", "Como
   funciona", "Números"… Vinte e uma linhas iguais, em que a única diferença é a
   palavra — e várias das palavras não dizem o que a peça é ("Aviso" desenha o
   quê? uma faixa? um balão?). Escolher virava tentativa e erro: arrasta, olha,
   desfaz.

   O editor clássico já resolvia isso, e a miniatura DELE é a que entra aqui:
   `WIDGET_LIBRARY` guarda um `preview` por tipo, e é de lá que este arquivo lê.
   Nada é redesenhado — uma segunda miniatura para o mesmo widget divergiria no
   primeiro retoque, e o catálogo é justamente o lugar onde a equipe já mexe
   quando inventa um widget novo.

   ── O NOME FICA ──

   Miniatura sozinha é adivinhação de outro tipo: dois retângulos empilhados
   podem ser "Texto" ou "Aviso". O cartão mostra os dois, como no clássico.

   ── E O ARRASTO GANHA DE GRAÇA ──

   O fantasma que acompanha o ponteiro é um CLONE do cartão, feito pelo próprio
   Puck. Trocar o conteúdo do cartão troca o fantasma junto — não há um segundo
   lugar para manter.
   ──────────────────────────────────────────────────────────────────────────── */

/* Os traços de que as miniaturas dos blocos são feitas. Os widgets trazem as
   deles do catálogo; estes cinco são a estrutura fixa da página, que não vive
   no catálogo porque não é peça de biblioteca. */
const barra = (largura, opacidade = 0.55, altura = 6) => ({
  width: largura,
  height: altura,
  borderRadius: 3,
  background: "currentColor",
  opacity: opacidade,
});

const PREVIAS_FIXAS = {
  BlocoCabecalho: (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{ ...barra(18, 0.55, 10), borderRadius: 4 }} />
      <div style={{ flex: 1 }} />
      <div style={barra(14, 0.3)} />
      <div style={barra(14, 0.3)} />
      <div style={{ ...barra(22, 0.55, 10), borderRadius: 999 }} />
    </div>
  ),
  BlocoTitulo: (
    <div style={{ display: "grid", gap: 5, justifyItems: "center" }}>
      <div style={barra("78%", 0.6, 9)} />
      <div style={barra("52%", 0.3)} />
    </div>
  ),
  BlocoDestaques: (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ height: 24, borderRadius: 4, border: "1px solid currentColor", opacity: 0.4 }} />
      ))}
    </div>
  ),
  BlocoImoveis: (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
      {[0, 1].map((i) => (
        <div key={i} style={{ display: "grid", gap: 3 }}>
          <div style={{ height: 14, borderRadius: 3, background: "currentColor", opacity: 0.22 }} />
          <div style={barra("70%", 0.4, 4)} />
        </div>
      ))}
    </div>
  ),
  BlocoRodape: (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ height: 1, background: "currentColor", opacity: 0.35 }} />
      <div style={{ display: "flex", gap: 4 }}>
        <div style={barra(18, 0.3, 5)} />
        <div style={barra(24, 0.3, 5)} />
        <div style={barra(14, 0.3, 5)} />
      </div>
    </div>
  ),
  /* A seção é a única cuja miniatura mostra o VAZIO de propósito: ela não traz
     conteúdo nenhum, ela reparte a largura. Duas colunas pontilhadas é o que
     ela faz. */
  Secao: (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
      {[0, 1].map((i) => (
        <div key={i} style={{ height: 26, borderRadius: 4, border: "1px dashed currentColor", opacity: 0.45 }} />
      ))}
    </div>
  ),
  /* A "Peça da vitrine" genérica não tem forma: ela é o invólucro que recebe
     qualquer widget traduzido do editor antigo. Um ponto de interrogação seria
     honesto e feio; três linhas neutras dizem "conteúdo", que é o que ela é. */
  Widget: (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={barra("100%", 0.45)} />
      <div style={barra("72%", 0.28)} />
    </div>
  ),
};

/* `Widget_<tipo>` é como `widgetsDaBiblioteca` batiza cada componente do
   catálogo. O prefixo mora nos dois lugares, e é o que liga a gaveta do Puck à
   miniatura do clássico. */
const PREFIXO_WIDGET = "Widget_";

export function previaDoComponente(nome) {
  if (PREVIAS_FIXAS[nome]) return PREVIAS_FIXAS[nome];
  if (!nome?.startsWith(PREFIXO_WIDGET)) return null;
  const tipo = nome.slice(PREFIXO_WIDGET.length);
  return WIDGET_LIBRARY.find((m) => m.type === tipo)?.preview || null;
}

/**
 * O cartão da gaveta. `children` é o que o Puck desenhava — o nome e a alça —,
 * e ele CONTINUA sendo desenhado embaixo da miniatura: é dele que vem o
 * comportamento de arrasto, e substituí-lo por marcação nossa tiraria o gesto
 * junto.
 */
export function CartaoDaGaveta({ children, name }) {
  const previa = previaDoComponente(name);
  if (!previa) return children;
  return (
    <div className="puck-cartao">
      <span className="puck-cartao__previa" aria-hidden="true">{previa}</span>
      {children}
    </div>
  );
}
