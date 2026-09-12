import {
  Eye,
  EyeSlash,
  LockSimple,
  LockSimpleOpen,
  PencilSimple,
  Database,
  Moon,
  Sun,
  Rows,
  Square,
  ArrowsInLineHorizontal,
  ArrowsOutLineHorizontal,
} from "@phosphor-icons/react";

/* ────────────────────────────────────────────────────────────────────────────
   AS ESCOLHAS DE DUAS VIAS, COM CARA DE COISA.

   Três campos do inspetor são a mesma pergunta em formas diferentes: mostrar ou
   esconder, travar ou soltar, dado do sistema ou texto à mão. Como `radio` do
   Puck eles saíam crus — um rótulo e duas palavras soltas, sem nada que diga o
   que cada lado FAZ.

   Aqui viram o alternador segmentado que o editor clássico usa na barra
   superior (`.editor-segmented`), com ícone em cada lado. A classe é a mesma de
   propósito: o desenho, o estado ativo e as duas paletas vêm de graça, e o
   inspetor novo se parece com o resto do produto sem uma segunda folha de
   estilo para manter.

   ── O ÍCONE NÃO É ENFEITE ──

   Olho aberto e olho cortado, cadeado aberto e fechado: é o vocabulário que o
   editor clássico já usava nas Camadas, e que qualquer pessoa que mexeu num
   editor de imagem reconhece antes de ler. A palavra fica junto porque ícone
   sozinho é adivinhação — quem nunca viu o par não sabe qual é qual.

   ── E A LINHA DE APOIO ──

   Cada campo diz o que o estado ESCOLHIDO significa, não o que o botão faria.
   "Escondida da página" informa; "clique para esconder" só repete o botão.
   ──────────────────────────────────────────────────────────────────────────── */

function Alternador({ rotulo, valor, onChange, readOnly, opcoes, apoio, padrao }) {
  /* Ausência conta como o PADRÃO. Peça vinda da tradução não traz `oculto` nem
     `travado` — `defaultProps` só vale para peça inserida pela gaveta —, e sem
     isto os dois lados ficavam apagados. Alternador com nenhum lado aceso lê
     como controle quebrado, e a pessoa clica só para descobrir onde estava. */
  const atual = valor === undefined || valor === null ? padrao : valor;
  return (
    <div className="editor-field puck-alternador">
      {/* O título do campo. O Puck não o desenha para campo `custom`, e três
          alternadores empilhados sem nome viravam uma adivinhação: "Ligadas"
          de quê? */}
      {rotulo ? <span className="puck-alternador__rotulo">{rotulo}</span> : null}
      <div className="editor-segmented is-compact" role="group" aria-label={rotulo}>
        {opcoes.map((o) => {
          const ativo = atual === o.valor;
          return (
            <button
              key={String(o.valor)}
              type="button"
              className={ativo ? "is-active" : ""}
              aria-pressed={ativo}
              disabled={readOnly}
              onClick={() => onChange(o.valor)}
            >
              <o.Icone size={15} weight={ativo ? "fill" : "regular"} />
              {o.rotulo}
            </button>
          );
        })}
      </div>
      {apoio ? <p className="puck-alternador__apoio">{apoio(atual)}</p> : null}
    </div>
  );
}

function campo(rotulo, opcoes, apoio, padrao) {
  return {
    type: "custom",
    label: rotulo,
    render: ({ value, onChange, readOnly }) => (
      <Alternador rotulo={rotulo} valor={value} onChange={onChange} readOnly={readOnly} opcoes={opcoes} apoio={apoio} padrao={padrao} />
    ),
  };
}

/** Mostrar ou esconder a peça. `true` quer dizer OCULTA — o campo se chama `oculto`. */
export const campoOculto = campo(
  "Visibilidade",
  [
    { valor: false, rotulo: "Mostrar", Icone: Eye },
    { valor: true, rotulo: "Esconder", Icone: EyeSlash },
  ],
  (v) => (v
    ? "Escondida da página. Continua aqui, na Estrutura, para você trazer de volta."
    : "Aparece na vitrine publicada."),
  false,
);

/** Travar a peça contra arrastar, duplicar e excluir. */
export const campoTravado = campo(
  "Posição",
  [
    { valor: false, rotulo: "Livre", Icone: LockSimpleOpen },
    { valor: true, rotulo: "Travada", Icone: LockSimple },
  ],
  (v) => (v
    ? "Travada: não sai do lugar, não duplica e não apaga sem destravar antes."
    : "Pode ser arrastada, duplicada e excluída."),
  false,
);

/** Dado do cadastro ou texto escrito à mão. */
export function campoFonteDoConteudo(fonte) {
  return campo(
    "Conteúdo",
    [
      { valor: true, rotulo: fonte.rotulo, Icone: Database },
      { valor: false, rotulo: "À mão", Icone: PencilSimple },
    ],
    (v) => (v
      ? `Vem de ${fonte.onde} e se atualiza sozinho.`
      : "Você está escrevendo à mão. Volte para o dado do sistema quando quiser."),
    true,
  );
}

/* O tema da vitrine — escuro ou claro. Não é da peça, é da PÁGINA, mas é a
   mesma pergunta de duas vias e merece a mesma cara. */
export const campoTema = campo(
  "Tema da vitrine",
  [
    { valor: "dark", rotulo: "Escuro", Icone: Moon },
    { valor: "light", rotulo: "Claro", Icone: Sun },
  ],
  (v) => (v === "light"
    ? "Fundo claro, tinta escura."
    : "Fundo escuro, tinta clara — é o padrão da vitrine."),
  "dark",
);

/* As seções zebradas: fundo alternado entre uma seção e a seguinte, para a
   página não virar um bloco só. "Seção" aqui é cada divisão da página —
   cabeçalho, título, uma seção em colunas, um widget solto —, e não só o
   agrupamento em colunas. Ligado por padrão; a cor é a do tema (ver
   `.is-zebrada` em styles.css), então claro e escuro ganham a alternância
   certa sem uma segunda opção. */
export const campoZebrado = campo(
  "Seções zebradas",
  [
    { valor: "sim", rotulo: "Ligadas", Icone: Rows },
    { valor: "nao", rotulo: "Desligadas", Icone: Square },
  ],
  (v) => (v === "nao"
    ? "Todas as seções no mesmo fundo."
    : "Uma seção sim, outra não, com fundo levemente diferente — vale também na página do imóvel."),
  "sim",
);

/* A largura da página: travada em 1400px (o padrão de sempre — a folha que o
   editor e a vitrine compartilham) ou livre, ocupando a tela inteira. Livre,
   cada peça ganha um controle "Largura" no inspetor para usar as laterais que
   num monitor largo ficavam vazias. */
export const campoLarguraDaPagina = campo(
  "Largura da página",
  [
    { valor: "travada", rotulo: "Travada", Icone: ArrowsInLineHorizontal },
    { valor: "livre", rotulo: "Livre", Icone: ArrowsOutLineHorizontal },
  ],
  (v) => (v === "livre"
    ? "A página usa a tela inteira, e cada peça ganha um controle de largura."
    : "Conteúdo centrado em até 1400px — o padrão."),
  "travada",
);

/* O mesmo par, por PEÇA: uma peça livre sangra até as bordas do monitor mesmo
   com a página travada em 1400px — é como se faz um banner de ponta a ponta
   no meio de uma página centrada. */
export const campoLarguraDaPeca = campo(
  "Largura da peça",
  [
    { valor: "travada", rotulo: "Travada", Icone: ArrowsInLineHorizontal },
    { valor: "livre", rotulo: "Livre", Icone: ArrowsOutLineHorizontal },
  ],
  (v) => (v === "livre"
    ? "A peça usa a tela inteira, de borda a borda, e ganha o controle de largura."
    : "A peça acompanha a largura da página."),
  "travada",
);
