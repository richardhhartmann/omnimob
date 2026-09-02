import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MagnifyingGlass, ArrowElbowDownLeft } from "@phosphor-icons/react";

/* ────────────────────────────────────────────────────────────────────────────
   A BUSCA DE ATALHOS — chegar a qualquer tela sem procurá-la.

   O painel tem duas dezenas de destinos, e vários moram DENTRO de outra tela:
   as cinco abas de Configurações, os quatro relatórios, as seis telas do Flow.
   Para abrir "Cobrança e pagamentos" a pessoa precisa saber que ela é uma aba
   de Configurações — e quem não sabe procura na barra, não acha, e conclui que
   o recurso não existe.

   Aqui ela digita "cobran" e chega. É a mesma ideia do Ctrl+K que qualquer
   ferramenta de trabalho tem hoje, e a razão de existir é a mesma: navegação em
   árvore é ótima para APRENDER onde as coisas estão e péssima para ir até elas
   pela quinquagésima vez.

   ── DE ONDE VÊM OS DESTINOS ──

   Da MESMA lista que desenha a barra lateral (`gruposDoModulo`), inclusive os
   subitens. Não é economia de código: aquela lista já passou pelo filtro de
   PERMISSÃO e de PLANO. Uma segunda lista aqui ofereceria à recepcionista um
   caminho para a tela de Cargos que o cargo dela não abre — e a busca viraria
   um gerador de "acesso negado".

   Pelo mesmo motivo ela troca junto com o MÓDULO: quem está no Flow busca entre
   as telas do Flow. Os dois módulos na mesma lista fariam "contratos" devolver
   resultado numa conta que não contratou o Flow.

   ── A FILTRAGEM É POR PEDAÇO, NÃO POR PREFIXO ──

   "pag" acha "Cobrança e pagamentos", e "ver pag" também — os termos são
   testados um a um contra o texto inteiro (nome do destino + nome do pai), em
   qualquer ordem. Casar só o começo obrigaria a pessoa a saber como o item se
   chama antes de procurá-lo, que é exatamente o problema que a busca resolve.

   Sem acento na comparação: quem digita rápido não digita "Relatórios" com til.

   ── POR QUE PORTAL, E POR QUE TECLADO PRIMEIRO ──

   Portal pelo motivo de sempre nesta base: o `<Outlet>` do AdminLayout tem um
   `transform` residual da animação de entrada, e isso quebra `position: fixed`
   lá dentro (ver o cabeçalho de `Modal.jsx`).

   Teclado porque quem usa uma paleta de comandos não tira a mão do teclado: ↑↓
   andam, Enter abre, Esc fecha. O mouse funciona, mas ele não é o caso de uso.
   ────────────────────────────────────────────────────────────────────────── */

/** Sem acento e em minúsculas, para a comparação. */
function chao(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Achata os grupos da barra numa lista de destinos, pais e filhos juntos.
 *
 *  EXPORTADA para o teste. `test/buscaDeAtalhos.test.jsx` monta os grupos com
 *  cargos, planos e módulos diferentes e confere que nada aparece aqui que a
 *  barra não mostraria — é a trava dos TRÊS filtros que a paleta herda e nunca
 *  pode reimplementar. */
export function destinosDe(grupos) {
  const saida = [];
  for (const grupo of grupos || []) {
    for (const item of grupo.itens || []) {
      if (!item) continue;
      saida.push({
        chave: item.key,
        rotulo: item.label,
        Icone: item.Icon,
        onde: grupo.label || null,
        bloqueado: item.bloqueado || null,
        ir: item.onClick,
        href: item.href,
        externo: item.external,
      });
      for (const sub of item.subitens || []) {
        saida.push({
          chave: sub.key,
          rotulo: sub.label,
          Icone: sub.Icon,
          /* O pai vira o "onde": é ele que explica por que "Aparência" é uma
             tela — e é ele que a pessoa vai procurar da próxima vez. */
          onde: item.label,
          ir: sub.onClick,
        });
      }
    }
  }
  return saida;
}

export function BuscaDeAtalhos({ aberta, aoFechar, grupos, modulo }) {
  const [busca, setBusca] = useState("");
  const [marcado, setMarcado] = useState(0);
  const campoRef = useRef(null);
  const listaRef = useRef(null);

  const destinos = useMemo(() => destinosDe(grupos), [grupos]);

  const achados = useMemo(() => {
    const termos = chao(busca).split(/\s+/).filter(Boolean);
    if (!termos.length) return destinos.slice(0, 8);
    return destinos
      .filter((d) => {
        const alvo = chao(`${d.rotulo} ${d.onde || ""}`);
        return termos.every((t) => alvo.includes(t));
      })
      .slice(0, 12);
  }, [destinos, busca]);

  /* A cada busca nova o destaque volta ao primeiro: sem isto, apagar uma letra
     podia deixar o destaque num índice que a lista nova não tem, e o Enter não
     abriria nada. */
  useEffect(() => { setMarcado(0); }, [busca]);

  useEffect(() => {
    if (!aberta) { setBusca(""); return undefined; }
    /* O foco espera um quadro: o campo acabou de entrar no DOM pelo portal, e
       focá-lo no mesmo ciclo às vezes não pega no Safari. */
    const t = setTimeout(() => campoRef.current?.focus(), 20);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { clearTimeout(t); document.body.style.overflow = anterior; };
  }, [aberta]);

  /* Mantém o item destacado à vista quando o teclado passa do fim da janela. */
  useEffect(() => {
    if (!aberta) return;
    const el = listaRef.current?.querySelector(`[data-i="${marcado}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [marcado, aberta]);

  if (!aberta) return null;

  function abrir(d) {
    aoFechar();
    if (d.href) {
      window.open(d.href, d.externo ? "_blank" : "_self");
      return;
    }
    d.ir?.();
  }

  function naTecla(e) {
    if (e.key === "Escape") { e.preventDefault(); aoFechar(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMarcado((i) => (achados.length ? (i + 1) % achados.length : 0));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setMarcado((i) => (achados.length ? (i - 1 + achados.length) % achados.length : 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const alvo = achados[marcado];
      if (alvo) abrir(alvo);
    }
  }

  return createPortal(
    <div className="bat-raiz" role="dialog" aria-modal="true" aria-label="Buscar no painel">
      <div className="bat-veu" onClick={aoFechar} aria-hidden="true" />

      <div className="bat-caixa" data-modulo={modulo}>
        <div className="bat-campo">
          <MagnifyingGlass size={17} weight="bold" />
          <input
            ref={campoRef}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={naTecla}
            placeholder="Buscar telas do painel…"
            aria-label="Buscar telas do painel"
            aria-controls="bat-lista"
            autoComplete="off"
          />
          <kbd>Esc</kbd>
        </div>

        <div className="bat-lista" id="bat-lista" role="listbox" ref={listaRef}>
          {achados.length === 0 ? (
            <p className="bat-vazio">
              Nada com esse nome. A busca alcança as telas que o seu cargo abre neste módulo.
            </p>
          ) : (
            <>
              {!busca ? <span className="bat-titulo">Ir para</span> : null}
              {achados.map((d, i) => (
                <button
                  key={`${d.chave}-${i}`}
                  type="button"
                  role="option"
                  aria-selected={i === marcado}
                  data-i={i}
                  className={`bat-item${i === marcado ? " is-marcado" : ""}`}
                  /* `onMouseMove` e não `onMouseEnter`: com a lista rolando sob
                     um ponteiro parado, o `enter` dispara sozinho e rouba o
                     destaque de quem está navegando pelo teclado. */
                  onMouseMove={() => setMarcado(i)}
                  onClick={() => abrir(d)}
                >
                  {d.Icone ? <span className="bat-item__icone"><d.Icone size={16} /></span> : null}
                  <span className="bat-item__texto">
                    {d.rotulo}
                    {d.onde ? <small>{d.onde}</small> : null}
                  </span>
                  {d.bloqueado ? <span className="bat-item__selo">{d.bloqueado}</span> : null}
                  {i === marcado ? (
                    <span className="bat-item__enter" aria-hidden="true"><ArrowElbowDownLeft size={13} weight="bold" /></span>
                  ) : null}
                </button>
              ))}
            </>
          )}
        </div>

        <div className="bat-rodape">
          <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
          <span><kbd>Enter</kbd> abrir</span>
          <span><kbd>Esc</kbd> fechar</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
