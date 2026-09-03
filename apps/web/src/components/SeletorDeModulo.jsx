import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CaretUpDown, Check } from "@phosphor-icons/react";
import { MenuFluido } from "./MenuFluido.jsx";
import { MODULOS, SIMBOLO_OMNIMOB, moduloInfo } from "../utils/modulos";

/* ────────────────────────────────────────────────────────────────────────────
   O SELETOR DE MÓDULO — a peça mais alta da barra lateral.

   Fica ACIMA do `ds-head` (a marca da imobiliária) e a ordem diz o que cada um
   responde: primeiro "em que produto eu estou", depois "de quem é esta conta".
   Invertida, a marca da imobiliária pareceria o título do módulo.

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

   ── DUAS FORMAS, CONFORME A BARRA ──

   ABERTA: só o wordmark. O ladrilho do símbolo some — ele repetiria o
   prédio que já está dentro da arte, e dois prédios lado a lado
   na mesma linha leem como erro de montagem.

   RECOLHIDA (64px): só o ladrilho do símbolo. A logo é larga demais e sairia
   ilegível; quem diz qual módulo é, ali, é o anel na cor do acento.

   Os dois ficam SEMPRE no DOM e quem esconde é o CSS, como o resto da barra: o
   React não sabe que o ponteiro entrou, e um estado só para isso traria de
   volta o re-render que a expansão por CSS existe para evitar.

   ── O DROPDOWN SAI PELA DIREITA, E POR PORTAL ──

   Mesmo gesto e mesmo desenho do submenu do menu do perfil: a lista brota ao
   LADO da barra, e não empurrando o conteúdo dela para baixo. Empurrar a
   navegação inteira dois centímetros para baixo a cada passada de mouse no topo
   é um sobressalto por um gesto que quase sempre é acidental.

   ⚠ E ele PRECISA sair por portal. `.ds-side__interno` tem `overflow-x: hidden`
   — é o que impede o conteúdo de vazar enquanto a barra está em 64px — e isso
   RECORTA qualquer filho posicionado para fora, inclusive um `position:
   absolute` com `left: 100%`. O balão media certo no `getBoundingClientRect` e
   simplesmente não aparecia; foi preciso uma captura de tela para ver, porque a
   geometria estava toda correta.

   Por isso ele vai para o `document.body` com coordenadas de tela, calculadas a
   partir do gatilho. É o que `MenuDoPerfil` faz com o `mp-balao`, pelo mesmo
   motivo.

   Quem abre é o CARET, e não a faixa inteira: a faixa é onde o ponteiro passa
   de raspão; o chevron é onde ele para de propósito.
   ──────────────────────────────────────────────────────────────────────────── */

/* O ponteiro (ou o foco) saiu do conjunto gatilho + balão?

   Os dois são um controle só para quem usa e dois lugares distantes no DOM para
   o navegador — o balão sai por portal para o `body`. Sem esta função, cada
   caminho (mouse e teclado) precisaria da sua própria versão da mesma conta, e
   as duas já divergiram uma vez.

   `relatedTarget` nulo é sair de verdade: acontece ao clicar fora, ao trocar de
   janela, ao mandar o foco para o `body`. */
function saiuDeVerdade(e) {
  const destino = e.relatedTarget;
  if (!destino || typeof destino.closest !== "function") return true;
  return !destino.closest(".ds-mod__gatilho") && !destino.closest(".ds-mod__balao");
}

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
 *  do CONJUNTO, e é ele que o leitor de tela anuncia. */
function LogoModulo({ modulo, className = "" }) {
  return (
    <span className={`ds-mod__logo ${className}`.trim()} role="img" aria-label={modulo.nome}>
      <img className="ds-mod__tipo" src={modulo.logo} alt="" aria-hidden="true" />
    </span>
  );
}

export function SeletorDeModulo({ atual, disponiveis, aoTrocar, aoAlternarAberto }) {
  const info = moduloInfo(atual);
  const opcoes = MODULOS.filter((m) => disponiveis.includes(m.key));
  const [aberto, setAberto] = useState(false);
  const gatilhoRef = useRef(null);
  const [caixa, setCaixa] = useState(null); // { left, top } em coordenadas de tela

  useEffect(() => {
    if (!aberto) return undefined;
    function aoTeclar(e) { if (e.key === "Escape") setAberto(false); }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  /* Onde o balão nasce. `useLayoutEffect` e não `useEffect`: medido depois da
     pintura, ele apareceria por um quadro no canto superior esquerdo e saltaria
     para o lugar. */
  useLayoutEffect(() => {
    if (!aberto || !gatilhoRef.current) return;
    const r = gatilhoRef.current.getBoundingClientRect();
    setCaixa({ left: r.right + 12, top: Math.max(8, r.top - 10) });
  }, [aberto]);

  /* ── A BARRA PRECISA FICAR ABERTA ENQUANTO O BALÃO ESTIVER NO AR ───────────

     O balão vive no `body`, então mover o ponteiro para ele é SAIR da barra — e
     a barra, que abre por `:hover`, recolhe no meio do caminho. O resultado era
     absurdo de usar: a lista aparecia, a pessoa ia clicar numa opção e a barra
     encolhia por baixo, tirando o balão de posição.

     Do ponto de vista de quem usa, o balão é uma extensão da barra, e é isso
     que o layout precisa saber. Ele põe `is-mod-aberto` no `.ds-side`, e o CSS
     trata essa classe como mais um motivo para a barra estar aberta — ao lado
     de `:hover` e `:focus-within`. */
  useEffect(() => {
    aoAlternarAberto?.(aberto);
  }, [aberto, aoAlternarAberto]);

  // Sem para onde ir: faixa de identidade, e nada mais.
  if (opcoes.length < 2) {
    return (
      <div className="ds-mod is-solo" data-tour="seletor-modulo">
        <SimboloModulo modulo={info} />
        <LogoModulo modulo={info} />
      </div>
    );
  }

  return (
    <div className="ds-mod" data-tour="seletor-modulo">
      <div className="ds-mod__atual">
        <SimboloModulo modulo={info} />
        <LogoModulo modulo={info} />

        {/* ── O gatilho ────────────────────────────────────────────────────
            O invólucro é quem escuta o ponteiro, e não o botão: com o listener
            no botão, sair dele em direção ao balão fecharia a lista antes de o
            ponteiro chegar lá. É a mesma montagem de `mp-linha-caixa`. */}
        <div
          className="ds-mod__gatilho"
          ref={gatilhoRef}
          onMouseEnter={() => setAberto(true)}
          /* ── O PORTAL QUEBRA AS DUAS CHECAGENS DE "SAIU DAQUI" ──────────
             O balão vive no `body`, então ele NÃO é descendente do gatilho.
             Isso derruba tanto o `contains` do blur quanto a leitura ingênua do
             mouseleave: ir do chevron até a lista conta como sair de tudo.

             O sintoma era diferente em cada caminho, e os dois apareceram:
             com o mouse a barra recolhia por baixo do balão no meio do gesto;
             com o teclado, dar Tab para dentro da lista a fechava antes de a
             primeira opção receber o foco.

             `saiuDeVerdade` responde a pergunta certa — "o destino está no
             gatilho OU no balão?" — e é usada nos dois. */
          onMouseLeave={(e) => { if (saiuDeVerdade(e)) setAberto(false); }}
          onBlur={(e) => { if (saiuDeVerdade(e)) setAberto(false); }}
        >
          <button
            type="button"
            className={`ds-mod__caret${aberto ? " is-aberto" : ""}`}
            onClick={() => setAberto((a) => !a)}
            onFocus={() => setAberto(true)}
            aria-haspopup="listbox"
            aria-expanded={aberto}
            aria-label={`Módulo atual: ${info.nome}. Trocar de módulo`}
          >
            <CaretUpDown size={14} weight="bold" />
          </button>

          {/* Fora do DOM quando fechado, ao contrário do submenu do perfil.
              Ali o balão anima a entrada e precisa existir antes; aqui ele é
              posicionado por CSS e montar/desmontar é mais barato que manter
              dois botões invisíveis na ordem do Tab. */}
          {aberto && caixa ? createPortal(
            <div
              className="ds-mod__balao"
              role="listbox"
              aria-label="Módulos disponíveis"
              style={{ left: caixa.left, top: caixa.top }}
              onMouseEnter={() => setAberto(true)}
              /* Mesma pergunta do outro lado: voltar do balão para o chevron
                 não é sair. */
              onMouseLeave={(e) => { if (saiuDeVerdade(e)) setAberto(false); }}
              onBlur={(e) => { if (saiuDeVerdade(e)) setAberto(false); }}
            >
              {/* ── As opções agora são o MENU FLUIDO ─────────────────────
                  Ao passar o ponteiro, uma faixa entra pela borda mais próxima
                  do cursor com o nome do módulo correndo, tingida do acento
                  dele. O efeito é do React Bits (`FlowingMenu`), adaptado à
                  escala do balão — ver `MenuFluido.jsx`, que lista o que mudou
                  e por quê.

                  A face parada continua sendo o que estava aqui: a logo e a
                  tagline. Ela não foi substituída pelo efeito, ficou POR BAIXO
                  dele — quem não passa o mouse vê exatamente a lista de antes,
                  e o balão continua legível de relance. */}
              <MenuFluido
                aoEscolher={aoTrocar}
                itens={opcoes.map((m) => ({
                  chave: m.key,
                  texto: m.nome,
                  imagem: SIMBOLO_OMNIMOB,
                  acento: m.acento,
                  acentoSuave: m.acentoSuave,
                  tinta: m.tinta,
                  atual: m.key === atual,
                  conteudo: (
                    <>
                      {/* O atual entra na lista também, marcado. Um seletor que
                          mostra só as opções NÃO escolhidas obriga a pessoa a
                          lembrar onde estava para saber o que o clique faz. */}
                      <LogoModulo modulo={m} className="is-na-lista" />
                      <span className="ds-mod__tagline">{m.tagline}</span>
                      {m.key === atual ? <Check size={13} weight="bold" className="ds-mod__check" /> : null}
                    </>
                  ),
                }))}
              />
            </div>,
            document.body,
          ) : null}
        </div>
      </div>
    </div>
  );
}
