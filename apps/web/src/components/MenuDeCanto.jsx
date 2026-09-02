import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DotsThreeVertical } from "@phosphor-icons/react";

/* ────────────────────────────────────────────────────────────────────────────
   OS TRÊS PONTINHOS — o que um item do painel guarda além do próprio destino.

   "Gerenciar Imóveis" é um destino, e ele leva a um lugar só. Mas há coisas que
   PERTENCEM a ele sem serem esse lugar: os cadastros que ficaram pela metade,
   por exemplo. Como item de menu elas competiriam com o destino principal; como
   tela nova exigiriam navegação para uma pergunta que se responde de relance.

   Este componente é a terceira saída: um "⋮" que aparece no hover do item, e um
   balão que sobe dali com o que faltava.

   ── UM SÓ, PARA OS DOIS LUGARES ──

   O mesmo item existe duas vezes no produto — na barra lateral do
   `AdminLayout` e como cartão na tela inicial (`CartaoDeMenu`) —, e a mesma
   afordância precisa aparecer nos dois com a mesma cara. Duas implementações
   divergem na primeira opção nova; é o defeito que o editor de vitrine já teve
   duas vezes.

   ── POR QUE PORTAL, E POR QUE ELE É SEMPRE ESCURO ──

   Os dois donos recortam: a barra tem `overflow-y: auto` (precisa, para rolar),
   e o cartão tem `overflow: hidden` por causa da onda do clique. Um balão que
   nasce dentro deles aparece pela metade. Portal tira o balão da árvore e a
   posição passa a ser calculada da ÂNCORA, em coordenadas de tela.

   Escuro nos dois temas, pela mesma razão do menu do perfil: ele é um balão
   flutuante e curto, irmão daquele, e alternar a cor faria dois menus da mesma
   moldura parecerem de programas diferentes.

   ── O BOTÃO É IRMÃO DO ITEM, NUNCA FILHO ──

   Os dois donos são `<button>`, e botão dentro de botão é HTML inválido — o
   navegador desmonta a árvore e o clique de dentro nunca chega. Por isso quem
   usa este componente envolve o próprio botão numa caixa `position: relative` e
   põe o "⋮" ao lado, absoluto. As classes `.mkb-caixa` e `.mkb` fazem isso.
   ────────────────────────────────────────────────────────────────────────── */

/* A largura do balão, aqui e no CSS. Fixa de propósito: é ela que permite
   decidir a posição ANTES da primeira pintura — ver o cálculo de `esquerda`. */
const LARGURA_DO_BALAO = 260;

/**
 * @param {Array<{key, Icone?, rotulo, detalhe?, badge?, aoClicar}>} itens
 * @param {string} [rotulo]  o que o leitor de tela anuncia no botão
 * @param {string} [className] classe extra na caixa do botão (posicionamento)
 * @param {number} [badge]  contador no próprio "⋮", para o item ser notado sem hover
 */
export function MenuDeCanto({ itens, rotulo = "Mais opções", className = "", badge = 0, aoAlternarAberto }) {
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState(null);
  const botaoRef = useRef(null);
  const balaoRef = useRef(null);

  const opcoes = (itens || []).filter(Boolean);

  /* Mede a âncora e prende o balão em coordenadas de tela. `useLayoutEffect` e
     não `useEffect`: com este, o balão chega a pintar no canto superior
     esquerdo antes de saltar para o lugar. */
  useLayoutEffect(() => {
    if (!aberto) return undefined;
    function medir() {
      const r = botaoRef.current?.getBoundingClientRect();
      if (!r) return;
      /* Sobe por padrão — é o gesto que se pediu, e o item costuma estar na
         metade de baixo da barra. Mas "sobe" não pode virar "sai pela borda":
         com pouco espaço acima, o balão desce em vez de ficar cortado. Uma
         altura estimada basta, porque o erro só decide o LADO. */
      const alturaEstimada = 22 + opcoes.length * 46;
      const cabeAcima = r.top > alturaEstimada + 16;

      /* ── POR QUE `left` CALCULADO, E NÃO `right: innerWidth - r.right` ─────
         O alinhamento pela direita é o certo — o balão nasce sob o "⋮" —, mas
         escrito como `right` ele não tem como ser contido: na barra lateral o
         gatilho está a ~230px da esquerda, e o balão de 260px começava em -30.
         Metade dele ficava fora da tela, e a parte de fora é a que tem os
         rótulos.

         Com `left`, o mesmo alinhamento vira uma conta que se limita nas duas
         pontas: encosta na borda esquerda em vez de atravessá-la, e não passa
         da direita em tela estreita. A largura é FIXA (e não `min`/`max`)
         justamente para esta conta existir antes de o balão pintar — medir
         depois custaria um quadro na posição errada. */
      const esquerda = Math.min(
        Math.max(8, r.right - LARGURA_DO_BALAO),
        Math.max(8, window.innerWidth - LARGURA_DO_BALAO - 8),
      );

      setPosicao({
        esquerda,
        ...(cabeAcima
          ? { base: window.innerHeight - r.top + 8 }
          : { topo: r.bottom + 8 }),
      });
    }
    medir();
    /* Rolar e redimensionar movem a âncora sem avisar o React. Remedir é mais
       barato (e mais honesto) que fechar o menu na cara de quem rolou um
       pixel. */
    window.addEventListener("scroll", medir, true);
    window.addEventListener("resize", medir);
    return () => {
      window.removeEventListener("scroll", medir, true);
      window.removeEventListener("resize", medir);
    };
  }, [aberto, opcoes.length]);

  /* ── QUEM HOSPEDA PRECISA SABER QUE O BALÃO ESTÁ NO AR ───────────────────
     O balão sai por PORTAL, então mover o ponteiro até ele é SAIR do elemento
     que o abriu. Na barra lateral isso é fatal: ela expande por `:hover`, e
     recolhia no meio do gesto — o menu continuava aberto, pendurado ao lado de
     uma barra de 64px.

     Avisar em vez de resolver aqui: o componente não sabe (nem deve saber) o
     que o dono faz com a informação. A barra usa para se segurar aberta, que é
     exatamente o que o seletor de módulo já fazia com `seletorAberto`. O
     cartão da tela inicial não passa a função, porque lá não há nada a segurar.

     O aviso mora num efeito, e não dentro do `onClick`, para o desmonte contar
     como fechamento: navegar a partir de um item do menu tira o componente da
     árvore sem passar por nenhum clique de fechar, e sem isto a barra ficaria
     presa aberta para sempre. */
  useEffect(() => {
    aoAlternarAberto?.(aberto);
    return () => aoAlternarAberto?.(false);
  }, [aberto, aoAlternarAberto]);

  useEffect(() => {
    if (!aberto) return undefined;
    function noDocumento(e) {
      if (balaoRef.current?.contains(e.target)) return;
      if (botaoRef.current?.contains(e.target)) return;
      setAberto(false);
    }
    function naTecla(e) {
      if (e.key === "Escape") {
        setAberto(false);
        botaoRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", noDocumento);
    document.addEventListener("keydown", naTecla);
    return () => {
      document.removeEventListener("mousedown", noDocumento);
      document.removeEventListener("keydown", naTecla);
    };
  }, [aberto]);

  if (!opcoes.length) return null;

  return (
    <span className={`mkb-caixa${className ? ` ${className}` : ""}`}>
      <button
        type="button"
        ref={botaoRef}
        className={`mkb${aberto ? " is-aberto" : ""}${badge > 0 ? " tem-badge" : ""}`}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={rotulo}
        title={rotulo}
        /* O item de baixo também é clicável, e nos dois donos ele NAVEGA. Sem
           parar a propagação aqui, abrir o menu trocaria de tela junto — e o
           balão apareceria já desmontado. */
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAberto((v) => !v); }}
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
      >
        <DotsThreeVertical size={16} weight="bold" />
        {badge > 0 ? <span className="mkb__pip" aria-hidden="true" /> : null}
      </button>

      {aberto && posicao
        ? createPortal(
            <div
              ref={balaoRef}
              className="mkb-balao"
              role="menu"
              style={{
                left: `${posicao.esquerda}px`,
                ...(posicao.base !== undefined
                  ? { bottom: `${posicao.base}px` }
                  : { top: `${posicao.topo}px` }),
              }}
            >
              {opcoes.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  role="menuitem"
                  className="mkb-linha"
                  disabled={o.desabilitado}
                  onClick={() => { setAberto(false); o.aoClicar?.(); }}
                >
                  {o.Icone ? <span className="mkb-linha__icone"><o.Icone size={17} /></span> : null}
                  <span className="mkb-linha__texto">
                    {o.rotulo}
                    {o.detalhe ? <small>{o.detalhe}</small> : null}
                  </span>
                  {o.badge > 0 ? (
                    <span className="mkb-linha__badge">{o.badge > 99 ? "99+" : o.badge}</span>
                  ) : null}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
