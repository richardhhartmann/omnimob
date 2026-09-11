import { useEffect } from "react";
import { usePuck } from "@puckeditor/core";
import { arrumarColunas, podarSecoesVazias } from "./agrupar.js";

/* ────────────────────────────────────────────────────────────────────────────
   O VIGIA DAS SEÇÕES: as vazias somem, e as que sobram contam certo.

   Duas arrumações que o documento não faz sozinho, feitas no mesmo lugar porque
   as duas respondem à mesma coisa — o número de peças dentro de uma seção
   mudou:

     · zerou    → a seção deixa de existir;
     · mudou    → `colunas` volta a bater com quantas peças há lá dentro.

   O segundo caso aparecia assim: pôr uma quarta peça numa seção de três
   atualizava o número, mas ARRASTAR uma para fora não. A seção ficava com três
   colunas e duas peças, e a faixa que sobrava virava um vão sem explicação.

   ── SEÇÃO SEM PEÇA DENTRO DEIXA DE EXISTIR ──

   Uma seção responde "estas peças formam uma linha". Vazia, ela não responde
   nada — e continua ocupando lugar: aparece na Estrutura, recebe o contorno de
   seleção, e engole peças que a pessoa tentou soltar ao lado dela.

   Tirar a última peça de dentro é, para quem edita, desfazer a seção. Antes
   disto era preciso um segundo gesto: achar a casca vazia e excluí-la à mão.

   ── POR QUE UM COMPONENTE, E NÃO O `onChange` DA PÁGINA ──

   Podar é ESCREVER no documento, e escrever exige o `dispatch` — que só existe
   dentro do provedor do Puck. O `onChange` da página recebe os dados e não tem
   como devolvê-los.

   Ele não desenha nada. Mora no cabeçalho porque é lá que a página já monta
   coisa dela dentro do provedor (ver `renderHeaderActions`), e porque no
   cabeçalho ele vive no documento de FORA: dentro do iframe da prévia, ele
   remontaria a cada troca de viewport.

   ── POR QUE ISTO NÃO ENTRA EM LAÇO ──

   A poda só dispara quando encontra algo a podar, e o resultado dela não tem
   seção vazia nenhuma. A gravação seguinte chega num documento já limpo,
   `podarSecoesVazias` devolve `null`, e o efeito não faz nada. Cada rodada
   diminui o número de seções vazias, e zero é o fundo.
   ──────────────────────────────────────────────────────────────────────────── */
export function PodarSecoesVazias() {
  /* SEM seletor. Esta versão do Puck expõe `usePuck()` devolvendo a loja
     inteira — o argumento é simplesmente ignorado, e `usePuck((s) => …)`
     devolvia a própria loja no lugar do conteúdo. O sintoma foi um
     `reduce is not a function` no carregamento, porque a loja não é lista.
     A versão com seletor é `createUsePuck()`, que é outra função. */
  const { appState, dispatch: despachar } = usePuck();
  const conteudo = appState?.data?.content;
  /* ── A SEÇÃO EM QUE A PESSOA ESTÁ MEXENDO NÃO É PODADA ───────────────────
     A gaveta oferece "Seção (colunas)", e ela nasce VAZIA — é assim que se monta
     uma linha antes de ter o que pôr nela. Sem esta exceção o vigia a apagava no
     mesmo quadro em que ela era solta, e a peça simplesmente não existia: a
     pessoa arrastava, via aparecer e sumir.

     A seleção é o sinal certo de "estou usando isto". Quando o foco muda, a
     seção vazia que ficou para trás some — que é o comportamento pedido. */
  const emUso = appState?.ui?.itemSelector
    ? conteudo?.[appState.ui.itemSelector.index]?.props?.id
    : null;

  useEffect(() => {
    if (!Array.isArray(conteudo)) return;
    /* Poda primeiro, conta depois: apagar uma seção vazia pode esvaziar a de
       fora, e contar antes deixaria o número da externa errado por uma rodada. */
    if (!podarSecoesVazias(conteudo, emUso) && !arrumarColunas(conteudo)) return;
    despachar({
      type: "setData",
      data: (atual) => {
        const podado = podarSecoesVazias(atual.content, emUso) || atual.content;
        const arrumado = arrumarColunas(podado) || podado;
        return arrumado === atual.content ? atual : { ...atual, content: arrumado };
      },
    });
  }, [conteudo, emUso, despachar]);

  return null;
}
