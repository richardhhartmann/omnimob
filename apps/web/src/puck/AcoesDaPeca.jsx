import { ActionBar, useGetPuck } from "@puckeditor/core";
import { ColumnsPlusRight, Rows, Copy, ClipboardText } from "@phosphor-icons/react";
import { agruparComAnterior, comProps, desagrupar, estaAgrupada, temAnterior } from "./agrupar.js";
import { useSyncExternalStore } from "react";
import { assinarEstiloCopiado, colarEstilo, copiarEstilo, temEstiloCopiado } from "./estiloCopiado.js";

/* ────────────────────────────────────────────────────────────────────────────
   LADO A LADO, NA BARRA DA PEÇA.

   A barra que aparece sobre a peça selecionada é do Puck e traz duplicar e
   excluir. Este `override` acrescenta duas ações ao lado delas, sem substituir
   nada: quem desenha o resto continua sendo a biblioteca, e é ela que decide
   posição, tamanho e o que fazer quando a peça está travada.

   ── POR QUE AÇÃO E NÃO ARRASTO ──

   Está no cabeçalho de `agrupar.js`: cada zona de soltura do Puck é uma lista,
   então "à direita de" não é um destino que o arrasto saiba representar. Pôr as
   duas peças lado a lado é uma operação sobre a ÁRVORE, e operação sobre a
   árvore tem lugar próprio — o mesmo raciocínio que pôs alinhar e distribuir no
   inspetor do editor clássico, em vez de tentar adivinhá-los pelo gesto.

   ── AS DUAS SÓ APARECEM QUANDO FAZEM SENTIDO ──

   Agrupar exige uma peça acima na mesma lista; desagrupar exige estar dentro de
   uma seção. Botão que aparece e não faz nada é o defeito que o "+ Destaque"
   teve, e não vale repetir.
   ──────────────────────────────────────────────────────────────────────────── */

export function BarraDaPeca({ label, children, parentAction }) {
  const pegarPuck = useGetPuck();
  const { selectedItem, appState, dispatch, config } = pegarPuck();
  /* Assinatura da área de transferência: o "colar" aparece no MESMO clique do
     "copiar", e não só quando a barra se redesenha por outro motivo. */
  const haEstiloCopiado = useSyncExternalStore(assinarEstiloCopiado, temEstiloCopiado);
  /* Os campos que o componente aceita, lidos da config — é por eles que o
     copiar e o colar peneiram (ver o cabeçalho de `estiloCopiado.js`). */
  const camposDe = (item) => Object.keys(config?.components?.[item?.type]?.fields || {});

  const selecionado = selectedItem;
  const id = selectedItem?.props?.id;
  const conteudo = appState?.data?.content || [];
  const podeAgrupar = Boolean(id) && temAnterior(conteudo, id);
  const podeDesagrupar = Boolean(id) && estaAgrupada(conteudo, id);

  const aplicar = (transformar) => {
    dispatch({
      type: "setData",
      data: (anterior) => {
        const novo = transformar(anterior.content, id);
        return novo ? { ...anterior, content: novo } : anterior;
      },
    });

    /* A peça continua selecionada depois da operação.

       Sem isto a barra sumia no ato: a seleção do Puck é um ENDEREÇO
       ({zona, índice}), e agrupar move a peça para dentro de uma seção nova —
       o endereço antigo deixa de existir e a seleção fica pendurada no vazio.
       Quem acabou de agrupar perdia a barra e tinha de clicar na peça de novo
       para desagrupar.

       O adiamento é obrigatório: `getSelectorForId` precisa do documento já
       atualizado, e o despacho acima só se aplica ao fim deste ciclo. */
    setTimeout(() => {
      const { getSelectorForId, dispatch: despachar } = pegarPuck();
      const seletor = getSelectorForId(id);
      if (seletor) despachar({ type: "setUi", ui: { itemSelector: seletor } });
    }, 0);
  };

  /* Escreve props na peça selecionada. Separado de `aplicar` porque aquele
     transforma a LISTA (move peças de lugar) e este só troca campos de uma. */
  const trocarProps = (novas) => {
    dispatch({
      type: "setData",
      data: (anterior) => ({
        ...anterior,
        content: comProps(anterior.content, id, novas),
      }),
    });
  };

  return (
    /* A seção com nome mostra o nome também na etiqueta sobre ela — é o
       terceiro lugar onde a pessoa lê "que peça é esta". */
    <ActionBar label={(selecionado?.type === "Secao" && selecionado.props?.nome?.trim()) || label}>
      {parentAction}
      {podeAgrupar ? (
        <ActionBar.Action
          label="Colocar lado a lado com a peça de cima"
          onClick={() => aplicar(agruparComAnterior)}
        >
          <ColumnsPlusRight size={16} />
        </ActionBar.Action>
      ) : null}
      {podeDesagrupar ? (
        <ActionBar.Action
          label="Tirar da seção e empilhar"
          onClick={() => aplicar(desagrupar)}
        >
          <Rows size={16} />
        </ActionBar.Action>
      ) : null}
      <ActionBar.Action
        label="Copiar a aparência desta peça"
        onClick={() => copiarEstilo(selecionado?.props, camposDe(selecionado))}
      >
        <Copy size={16} />
      </ActionBar.Action>
      {haEstiloCopiado ? (
        <ActionBar.Action
          label="Colar a aparência copiada"
          onClick={() => {
            const novas = colarEstilo(camposDe(selecionado));
            if (novas) trocarProps(novas);
          }}
        >
          <ClipboardText size={16} />
        </ActionBar.Action>
      ) : null}
      {children}
    </ActionBar>
  );
}
