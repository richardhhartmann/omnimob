import { SIMBOLO_OMNIMOB, moduloInfo } from "../utils/modulos";

/* ────────────────────────────────────────────────────────────────────────────
   A MARCA DO MÓDULO — hoje na faixa do topo, e sem o seletor.

   Ela responde DUAS perguntas no mesmo lugar — "em que produto eu estou" e "de
   quem é esta conta" — e o `ds-head` que respondia a segunda deixou de existir.

   ⚠ O NOME DO ARQUIVO É HISTÓRIA, não descrição. Ele já teve um chevron que
   abria a lista de módulos; a troca virou um item da navegação, no fim da barra
   lateral (ver `.ds-modulos` no `AdminLayout`). O que sobrou aqui é a marca mais
   a porta do Painel do Gestor. Renomear custa um import — ficou para quando
   alguém mexer aqui de novo, em vez de virar ruído no meio de outra mudança.

   ── O ROLO ──

   Parado, a faixa é o wordmark do módulo. Ao passar o ponteiro, ela ROLA para
   cima e a segunda face entra: a marca da imobiliária, o nome e o slug. Clicar
   leva ao Painel do Gestor.

   Duas peças eram uma repetição: o antigo `ds-head` ocupava mais 56px logo
   abaixo para mostrar a mesma marca, e as duas juntas comiam 108px do topo da
   barra antes do primeiro item de menu. A informação não sumiu, mudou de
   estado — ela está a um gesto de distância em vez de permanentemente ocupando
   espaço.

   Duas coisas que o rolo NÃO faz:

   1. **Não promete clique para quem não pode clicar.** Sem `verPainelGestor` o
      rolo é uma `<div>`: a informação aparece igual — saber de que imobiliária
      é o painel interessa a todo mundo —, mas sem cursor de mão e sem destino.
      Um botão desabilitado prometeria uma tela que aquela pessoa nunca verá.
   2. **Não rola sozinho na tela do Painel do Gestor.** Ali ele fica travado na
      segunda face: é onde a pessoa está, e a face que diz isso é a da casa.

   ── UM WORDMARK FECHADO POR MÓDULO ──

   Uma imagem inteira por módulo, vinda de `modulo.logo`: `tipo_header_alt.png`
   no Omnimob, `omnimob_flow.png` no Omniflow.

   Era composta — a metade "OMNIMOB" mais a palavra do módulo à direita —, para
   não reexportar a metade comum a cada retoque da marca. A composição morreu
   com os nomes novos: "Omnimob" não tem palavra para acrescentar, e "Omniflow"
   é uma palavra só, em que "Omni" e "flow" se emendam. Cortá-la em duas
   imagens partiria uma letra no meio.

   O que a composição custava era o alinhamento entre as duas peças, resolvido
   no CSS por altura relativa e um deslocamento medido na arte. Isso saiu
   junto: as duas artes têm o mesmo quadro (2852×603) e o símbolo na mesma
   posição, então uma altura só serve para as duas.

   ── ONDE ELA MORA ──

   Na `.ds-topbar`, a faixa que atravessa o topo da tela, ao lado do hambúrguer.
   Nasceu no alto da barra LATERAL, e é de lá que vem quase todo o desenho — o
   que a faixa muda (altura, fundo, o ladrilho por tema) está no bloco
   `.ds-topbar` do `AdminLayout`.

   O ladrilho do símbolo aparece só no tema CLARO, e a razão está em
   `NomeDoModulo`, logo abaixo: é ali que a arte do wordmark dá lugar ao texto, e
   sem o ladrilho a faixa ficaria sem marca. No escuro a arte já traz o prédio, e
   dois prédios na mesma linha leem como erro de montagem.
   ──────────────────────────────────────────────────────────────────────────── */

/** O símbolo sozinho, tintado pelo acento. É o que sobra na barra recolhida. */
function SimboloModulo({ modulo }) {
  return (
    <span
      className="ds-mod__marca"
      style={{ "--acento": modulo.acento }}
      aria-hidden="true"
    >
      <img src={SIMBOLO_OMNIMOB} alt="" />
    </span>
  );
}

/** O wordmark do módulo.
 *
 *  O `alt` continua no invólucro, e não na imagem: o nome do módulo é o rótulo
 *  do CONJUNTO, e é ele que o leitor de tela anuncia — e é por isso que as duas
 *  artes entram com `aria-hidden`. São duas renderizações de UM nome, não duas
 *  informações; quem escolhe entre elas é o tema, no CSS, como o resto desta
 *  barra faz.
 *
 *  A segunda arte (`logoClaro`, letras pretas) é OPCIONAL: só o Omnimob a tem.
 *  Sem ela o módulo cai no nome em texto — ver `NomeDoModulo`, logo abaixo. */
function LogoModulo({ modulo, className = "" }) {
  return (
    <span className={`ds-mod__logo ${className}`.trim()} role="img" aria-label={modulo.nome}>
      <img className="ds-mod__tipo" src={modulo.logo} alt="" aria-hidden="true" />
      {modulo.logoClaro ? (
        <img className="ds-mod__tipo ds-mod__tipo--claro" src={modulo.logoClaro} alt="" aria-hidden="true" />
      ) : null}
    </span>
  );
}

/** ── O nome do módulo em TEXTO, para superfície clara ────────────────────────
 *
 *  A arte do wordmark (`modulo.logo`) tem as letras BRANCAS — as duas, tanto o
 *  `tipo_header_alt` quanto o `omnimob_flow`, e não existe versão escura no
 *  `public/`. Sobre a faixa clara do painel ela simplesmente desaparecia: a
 *  captura mostrava "OMNIMOB" quase invisível ao lado da marca.
 *
 *  Filtro não resolve. `brightness(0)` escurece tudo e mata o ROSA do "flow",
 *  que é justamente o sinal do módulo — a cor que diz de relance em que metade
 *  do sistema a pessoa está; e `invert()` transforma o dourado do prédio em
 *  azul. Filtro age na imagem inteira, e aqui as duas metades precisam de
 *  tratamentos opostos.
 *
 *  Texto resolve os dois: ele lê o `--modulo-acento` (índigo no Omnimob, rosa
 *  no Omniflow) e nasce legível nos dois temas. A fonte é a do produto, e o
 *  nome sai de `modulo.nome` — a MESMA fonte de verdade que o `alt` da arte
 *  usa, então as duas formas nunca discordam.
 *
 *  ── HOJE ELE É O PLANO B ──
 *
 *  Existe uma segunda arte com as letras pretas (`modulo.logoClaro`), e o
 *  módulo que a tiver mostra a TIPOGRAFIA no claro, e não a palavra. O texto
 *  ficou para quem não tem: hoje o Omniflow, amanhã um módulo novo cuja arte
 *  clara ainda não foi desenhada. Apagá-lo faria esse caso aparecer sem marca
 *  nenhuma — é ele que garante que faltar um arquivo degrade em vez de quebrar.
 *
 *  As duas formas ficam SEMPRE no DOM e quem esconde uma é o CSS, pelo tema do
 *  shell — o mesmo arranjo que o resto desta barra usa. Não são duas versões do
 *  mesmo componente: são duas renderizações de UM nome, e o nome tem uma fonte
 *  só. No tema escuro vale a arte, no claro vale a palavra.
 *
 *  A arte era a única forma na lista do balão de módulos, que era uma superfície
 *  escura de propósito. O balão foi embora com o chevron — ver o comentário do
 *  componente, no fim do arquivo. */
function NomeDoModulo({ modulo }) {
  return <span className="ds-mod__palavra">{modulo.nome}</span>;
}

/* ── O SELO DO PLANO SAIU DAQUI ──────────────────────────────────────────────

   Ele era a terceira coisa da face da imobiliária, ao lado do nome e do slug, e
   funcionou enquanto o rolo tinha a largura de uma barra lateral aberta. Quando
   o seletor mudou para a faixa do topo, o rolo passou a viver em ~146px: a
   pílula é a única peça de largura fixa ali (`flex-shrink: 0`, para não virar
   "Premi…"), então quem encolheu foram as outras duas. O resultado na tela era
   `P…` de nome e `pap…` de slug ao lado de um PREMIUM inteiro — o selo comeu
   justamente a informação que a face existe para dar.

   A pergunta que ele responde continua valendo ("que Omnimob é esta?", e por
   que metade das telas esconde recurso). Ela agora é respondida no MENU DO
   PERFIL, onde a linha tem 232px e o plano fica ao lado do nome da imobiliária,
   a um clique de Configurações › Plano. Ver `MenuDoPerfil`.

   O CSS `.ds-plano` continua na folha do `AdminLayout`: é lá que vive o resto
   da moldura, e o menu do perfil já lê de lá.
   ────────────────────────────────────────────────────────────────────────────── */

/* As duas faces do rolo. A de baixo é a imobiliária — logo, nome e slug juntos,
   que é o que o `ds-head` mostrava em alturas separadas. O selo do plano era a
   quarta peça e mudou de casa: ver a nota acima. */
function RoloDaMarca({ modulo, imobiliaria, podeVerPainel, painelAtivo, aoAbrirPainel }) {
  const nome = imobiliaria?.nome || "Minha imobiliária";
  const Tag = podeVerPainel ? "button" : "div";

  return (
    <Tag
      type={podeVerPainel ? "button" : undefined}
      className={`ds-mod__rolo${podeVerPainel ? " is-link" : ""}${painelAtivo ? " is-ativo" : ""}`}
      onClick={podeVerPainel ? aoAbrirPainel : undefined}
      title={podeVerPainel ? "Painel do Gestor" : undefined}
      aria-current={painelAtivo ? "page" : undefined}
    >
      <span className="ds-mod__trilho">
        {/* As DUAS formas do nome do módulo, e quem escolhe é o tema — no CSS,
            como o resto desta barra faz. Ver `NomeDoModulo`. */}
        <span className="ds-mod__face">
          <LogoModulo modulo={modulo} />
          <NomeDoModulo modulo={modulo} />
        </span>

        <span className="ds-mod__face ds-mod__face--casa">
          <span className={`ds-mark${imobiliaria?.logoUrl ? " has-logo" : ""}`}>
            {imobiliaria?.logoUrl
              ? <img src={imobiliaria.logoUrl} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />
              : nome.charAt(0).toUpperCase()}
          </span>
          <span className="ds-mod__casa">
            <span className="ds-mod__nome">{nome}</span>
            {imobiliaria?.slug ? <span className="ds-mod__slug">{imobiliaria.slug}</span> : null}
          </span>
        </span>
      </span>
    </Tag>
  );
}

export function SeletorDeModulo({
  atual,
  imobiliaria,
  podeVerPainel = false,
  painelAtivo = false,
  aoAbrirPainel,
}) {
  const info = moduloInfo(atual);

  /* ── ELE NAO SELECIONA MAIS: A TROCA MUDOU DE LUGAR ────────────────────────

     Havia um chevron (`.ds-mod__gatilho`) ao lado do wordmark, e clicar nele
     abria um balao por portal com os modulos disponiveis. Ele foi embora, e com
     ele o estado de aberto, o posicionamento por coordenadas de tela, a ponte
     invisivel contra o vao do ponteiro e o `MenuFluido`.

     A troca agora e um ITEM DA NAVEGACAO, no fim da barra lateral — do jeito
     que o YouTube oferece os outros produtos dele. Ver `.ds-modulos` no
     `AdminLayout`. O motivo e que o chevron era um controle escondido dentro
     da marca: quem nunca clicou nele nao sabia que existia outro modulo, e o
     Flow e justamente o que a imobiliaria pode nao ter descoberto ainda. Um
     item com nome, na lista que a pessoa le todo dia, se anuncia sozinho.

     O nome do arquivo ficou. Ele descreve o que a peca FOI, e nao o que ela e
     — hoje ela e a marca do modulo mais a porta do Painel do Gestor. Renomear
     custa um import e nada mais; ficou para quando alguem mexer aqui de novo,
     em vez de virar ruido no meio de uma mudanca de layout.
     ────────────────────────────────────────────────────────────────────────── */
  return (
    /* `ds-mod--arte-clara` diz ao CSS que este módulo tem a segunda arte, e com
       isso o tema claro troca a IMAGEM em vez de cair no texto. Modificador na
       raiz, e não `:has()`: quem sabe da arte é o catálogo, e daqui o CSS
       alcança tanto o wordmark quanto o ladrilho do símbolo — que precisa sumir
       de novo, porque a arte já traz o prédio dentro dela. */
    <div
      className={`ds-mod is-solo${info.logoClaro ? " ds-mod--arte-clara" : ""}`}
      data-tour="seletor-modulo"
    >
      <SimboloModulo modulo={info} />
      <RoloDaMarca
        modulo={info}
        imobiliaria={imobiliaria}
        podeVerPainel={podeVerPainel}
        painelAtivo={painelAtivo}
        aoAbrirPainel={aoAbrirPainel}
      />
    </div>
  );
}
