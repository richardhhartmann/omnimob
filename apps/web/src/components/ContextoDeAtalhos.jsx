import { createContext, useContext, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { mapaDeAtalhos, telaDosAtalhos, rotuloDaTecla } from "../utils/atalhos";

/* ────────────────────────────────────────────────────────────────────────────
   Qual tecla este botão tem — e se ele tem alguma.

   ── POR QUE UM CONTEXTO, NUMA BASE QUE NÃO USA CONTEXTO ──

   A convenção do projeto é estado por props (ver `CLAUDE.md`). A exceção aqui é
   deliberada e vale ser justificada: o selo da tecla aparece em botões
   espalhados por seis telas, e o dado que ele precisa — cargo, configuração da
   imobiliária, configuração da pessoa, tela atual e o interruptor mestre — mora
   todo na sessão, três a cinco níveis acima.

   Passar isso de mão em mão significaria que cada botão novo com atalho exige
   tocar em todos os componentes do caminho, e que esquecer um deles falha em
   silêncio: o selo simplesmente não aparece, e ninguém descobre.

   A alternativa que a base já usa em outros pontos — `loadSession()` dentro do
   componente — não serve: ela lê do `localStorage` e não re-renderiza quando a
   pessoa troca uma tecla. Com o salvamento automático do editor, o selo ficaria
   mostrando a tecla antiga até a próxima navegação.

   ── O INTERRUPTOR MESTRE ──

   Desligado, o mapa sai VAZIO. Não é só o selo que some: `useAtalhos` lê o mesmo
   mapa, então nenhuma tecla dispara. Um lugar só decide as duas coisas, e é o
   que impede a tela de desenhar um selo para uma tecla que não funciona mais.
   ──────────────────────────────────────────────────────────────────────────── */

const Contexto = createContext({ mapa: new Map(), ativos: false });

export function ProvedorDeAtalhos({ session, children }) {
  const { pathname } = useLocation();

  const valor = useMemo(() => {
    const ativos = session?.tenant?.atalhosAtivos !== false;
    if (!ativos) return { mapa: new Map(), ativos: false };

    const mapa = mapaDeAtalhos({
      tela: telaDosAtalhos(pathname),
      cargo: session?.usuario?.cargo,
      doTenant: session?.tenant?.atalhos || undefined,
      doUsuario: session?.usuario?.atalhos || undefined,
    });
    return { mapa, ativos: true };
  }, [
    pathname,
    session?.tenant?.atalhosAtivos,
    session?.usuario?.cargo,
    session?.tenant?.atalhos,
    session?.usuario?.atalhos,
  ]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** A tecla desta ação NA TELA ATUAL, ou `null`. */
export function useTeclaDe(acaoId) {
  const { mapa } = useContext(Contexto);
  for (const [tecla, acao] of mapa) if (acao.id === acaoId) return tecla;
  return null;
}

/**
 * O selo desenhado ao lado do botão.
 *
 * Devolve `null` quando não há tecla — porque o interruptor está desligado,
 * porque o cargo não alcança aquela tela, ou porque a pessoa desligou aquele
 * atalho. O botão continua igual, sem buraco no lugar.
 *
 * `aria-hidden`: para quem usa leitor de tela, o selo é ruído — o nome do botão
 * já foi lido, e "um" logo depois não ajuda ninguém. Quem navega por teclado
 * com leitor usa Tab, não a tecla.
 */
export function TeclaDeAtalho({ acao, className = "" }) {
  const tecla = useTeclaDe(acao);
  if (!tecla) return null;
  return (
    <kbd className={`tecla-atalho ${className}`.trim()} aria-hidden="true">
      {rotuloDaTecla(tecla)}
    </kbd>
  );
}
