import { createContext, useContext, useMemo } from "react";
import { COMPLETO, LEVE, MINIMO, useCapacidade } from "../utils/capacidadeDaMaquina";

/* ────────────────────────────────────────────────────────────────────────────
   O orçamento de efeitos da landing, disponível para quem estiver dentro dela.

   Contexto, e não props, porque a página é uma árvore funda: o botão especular
   está a seis níveis do topo e não tem nada a ver com detecção de hardware. O
   projeto evita contexto por padrão — mas este é o mesmo caso do
   `showcase/contexto.jsx`: um valor que TODA a árvore consulta e nenhum nível
   intermediário deveria conhecer.

   ── COMO LER ──

   Não pergunte o nível. Pergunte a CAPACIDADE:

     const { podeWebGL, podeQuadroAQuadro } = useEfeitos();

   Assim um efeito novo declara o que precisa, em vez de repetir a regra
   `nivel === "completo" || nivel === "leve"` em cada arquivo — que é como um
   nível novo, no dia em que existir, deixaria metade dos efeitos para trás.
   ──────────────────────────────────────────────────────────────────────────── */

const Contexto = createContext(null);

/* O padrão para quem estiver fora do provedor (o painel, a vitrine, um teste).
   Tudo ligado: essas telas não têm shader nenhum, e desligar por engano custaria
   animação de interface que sempre funcionou. */
const PADRAO = {
  nivel: COMPLETO,
  podeWebGL: true,
  podeQuadroAQuadro: true,
  podeTransicao: true,
  medido: null,
  manual: null,
  definir: () => {},
};

export function EfeitosProvider({ children }) {
  const { nivel, medido, manual, definir } = useCapacidade();

  const valor = useMemo(() => ({
    nivel,
    /* Shader de tela cheia (Vanta FOG/WAVES). Só no completo: é o mais caro de
       todos e o único que precisa baixar o three.js. */
    podeWebGL: nivel === COMPLETO,
    /* Laço de requestAnimationFrame — cursor fantasma, borda elétrica, parede
       à deriva. Sobrevive no leve porque cada um custa pouco sozinho; some no
       mínimo, onde a soma deles é o problema. */
    podeQuadroAQuadro: nivel !== MINIMO,
    /* Transição de CSS. Fica até no mínimo — o navegador resolve na composição,
       fora da linha principal. O que a desliga é `prefers-reduced-motion`, e o
       próprio CSS já cuida disso. */
    podeTransicao: true,
    medido,
    manual,
    definir,
  }), [nivel, medido, manual, definir]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useEfeitos() {
  return useContext(Contexto) || PADRAO;
}

/* ── O controle visível ──────────────────────────────────────────────────────
   Detecção automática erra, e erra dos dois lados. Sem um jeito de discordar,
   quem tem máquina boa e caiu no leve não tem recurso — e quem tem máquina ruim
   e passou no completo também não.

   Mora no rodapé porque não é decisão de entrada: a pessoa só procura isso
   depois de sentir que a página está pesada.
   ────────────────────────────────────────────────────────────────────────── */

const ROTULOS = [
  { valor: COMPLETO, rotulo: "Completas" },
  { valor: LEVE, rotulo: "Leves" },
  { valor: MINIMO, rotulo: "Nenhuma" },
];

export function SeletorDeEfeitos() {
  const { nivel, manual, medido, definir } = useEfeitos();

  return (
    <div className="dl-efeitos">
      <span className="dl-efeitos__rotulo">Animações</span>
      <div className="dl-efeitos__grupo" role="group" aria-label="Nível de animações da página">
        {ROTULOS.map((o) => (
          <button
            key={o.valor}
            type="button"
            className={`dl-efeitos__opcao${nivel === o.valor ? " is-ativo" : ""}`}
            aria-pressed={nivel === o.valor}
            onClick={() => definir(o.valor)}
          >
            {o.rotulo}
          </button>
        ))}
        {manual ? (
          <button type="button" className="dl-efeitos__auto" onClick={() => definir(null)}>
            Automático
          </button>
        ) : null}
      </div>
      <span className="dl-efeitos__nota">
        {manual
          ? "Escolha sua, guardada neste navegador."
          : medido
            ? `Ajustado sozinho ao seu aparelho (${Math.round(1000 / medido)} quadros por segundo aqui).`
            : "Ajustado sozinho ao seu aparelho."}
      </span>
    </div>
  );
}
