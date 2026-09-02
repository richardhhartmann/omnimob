import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/* ────────────────────────────────────────────────────────────────────────────
   QUEM DIZ O NOME DA TELA.

   O título saiu de dentro do conteúdo e subiu para a moldura. A razão não é
   estética: ele estava desenhado de quatro jeitos diferentes (o `<h1>` de 28px
   das telas de equipe, o `<h2>` de 26px da grade de índices, o `PageHeader` de
   22px do Flow, e as telas que simplesmente não tinham título), e a pessoa
   atravessava três deles na mesma sessão. Uma coisa que aparece em toda tela
   pertence à moldura, como o cabeçalho da barra lateral já era.

   ── DUAS FONTES, E A ORDEM É A REGRA ──

   1. A ROTA responde por padrão. `trilhaDoPainel` já sabe o nome de cada tela
      do painel — é a mesma tabela que desenha a trilha, e um teste garante que
      ela cobre tudo que está na barra. Tela nova entra com título de graça.

   2. A TELA sobrescreve quando tem algo mais específico a dizer. "Negócio #412"
      é melhor que "Negócios"; "Bom dia, Ana" é melhor que "Dashboard". Só quem
      sabe isso é a tela.

   Sem a fonte 1, cada página nova nasceria sem título até alguém lembrar de
   registrá-lo. Sem a fonte 2, o cabeçalho seria uma placa fixa e o detalhe do
   registro aberto não teria onde aparecer.

   ── POR QUE O `acao` VEM JUNTO ──

   Porque o botão primário da tela ("Novo Cliente", "Nova fonte") mora ao lado
   do título desde sempre, e deixá-lo para trás no conteúdo o transformaria num
   botão solto no alto de uma lista, sem nada que o explicasse.
   ────────────────────────────────────────────────────────────────────────── */

const Contexto = createContext(null);

export function ProvedorDeCabecalho({ children }) {
  const [conteudo, setConteudo] = useState(null);

  /* `useCallback` sem dependência: a função precisa ser estável, senão o efeito
     que a chama (em `useTituloDaTela`) rodaria em todo render e o cabeçalho
     entraria em laço. */
  const definir = useCallback((valor) => setConteudo(valor), []);

  const valor = useMemo(() => ({ conteudo, definir }), [conteudo, definir]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** O que o cabeçalho deve desenhar agora, ou `null` para ele usar a rota. */
export function useCabecalho() {
  return useContext(Contexto)?.conteudo ?? null;
}

/**
 * A tela declara o próprio título.
 *
 * `titulo` e `subtitulo` são texto; `acao` é JSX e muda de identidade a cada
 * render da página — por isso ele NÃO entra na lista de dependências do efeito.
 * Entrasse, toda página com um botão no cabeçalho gravaria estado a cada quadro
 * e o painel inteiro re-renderizaria em laço.
 *
 * O preço é conhecido e aceitável: um botão que troca de rótulo sem que título
 * ou subtítulo mudem só aparece no próximo. Nenhuma tela faz isso hoje, e
 * quando fizer basta mexer no título junto.
 */
export function useTituloDaTela({ titulo, subtitulo, acao } = {}) {
  const ctx = useContext(Contexto);
  const definir = ctx?.definir;

  useEffect(() => {
    if (!definir) return undefined;
    definir({ titulo, subtitulo, acao });
    /* Limpa ao sair. Sem isto, navegar de "Negócio #412" para uma tela que não
       declara nada deixaria o título antigo no ar — e ele estaria mentindo. */
    return () => definir(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definir, titulo, subtitulo]);
}
