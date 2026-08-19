import { useCallback, useRef, useState } from "react";
import { api } from "../../../api";
import { toPieces, pieceLabel } from "../../showcase/engine/pieces";
import { WIDGET_LIBRARY } from "../data/biblioteca.jsx";
import { FONT_OPTIONS } from "../data/temas";
import {
  aplicarOperacao,
  alvoDaOperacao,
  temaDoPerfil,
  textoDoPerfil,
  PAUSA_ENTRE_PASSOS,
} from "./aplicarOperacoes";

/* ────────────────────────────────────────────────────────────────────────────
   O maquinário do assistente: pedir o plano e executá-lo passo a passo.

   Separado do painel de propósito. O painel desenha caixa de texto e lista de
   passos; aqui mora o que é difícil — o estado da execução, a possibilidade de
   parar no meio e a garantia de que UM gesto de IA é UMA entrada no histórico.

   ── UMA ENTRADA NO HISTÓRICO PARA O PLANO INTEIRO ──

   `registrar()` é chamado uma vez, antes do primeiro passo. Se fosse por
   operação, desfazer uma reorganização de dez passos exigiria dez Ctrl+Z — e
   quem desfaz não está desfazendo "o quarto movimento", está desfazendo "o que
   a IA fez". O gesto que a pessoa percebe é o plano.
   ──────────────────────────────────────────────────────────────────────────── */

/* Descrição do widget para o modelo. Fica aqui e não na biblioteca porque é
   linguagem de PROMPT, não de interface: a gaveta de peças mostra "Depoimento"
   e um desenho; o modelo precisa saber quando usar um. */
const PARA_QUE = {
  text: "parágrafo livre para diferenciais, condições ou avisos.",
  divider: "separador entre seções, com um título curto no meio.",
  note: "aviso destacado, tipo observação legal ou condição.",
  steps: "passo a passo de como funciona o atendimento.",
  stats: "números da imobiliária (anos de mercado, imóveis vendidos).",
  testimonial: "depoimento de cliente, com nome e foto.",
  hours: "horário de atendimento.",
  map: "mapa da localização do escritório.",
  social: "links das redes sociais.",
  regions: "bairros e regiões onde a imobiliária atua.",
  team: "equipe de corretores.",
  "property-search": "busca de imóveis por filtros dentro da vitrine.",
  faq: "perguntas frequentes.",
  finance: "simulação de financiamento.",
  cta: "chamada para ação com botão — falar no WhatsApp, agendar visita.",
};

const catalogoParaIA = () =>
  WIDGET_LIBRARY.map((w) => ({
    tipo: w.type,
    nome: w.nome,
    paraQue: PARA_QUE[w.type] || w.title || "",
    w: w.tamanho?.w ?? 50,
    h: w.tamanho?.h ?? 220,
  }));

/* O estado da vitrine em texto curto. É o que o modelo lê para saber o que
   existe — e o que ele NÃO recebe é tão importante: nada de fotos, nada de
   dados de cliente, nada de id de imóvel. */
function retratoDaVitrine(cfg, modo, form, imoveis) {
  const pecas = toPieces(cfg, modo, { includeHidden: true }).map((p) => {
    const widget = p.kind === "w" ? cfg.widgets.find((w) => w.id === p.key) : null;
    return {
      id: p.id,
      nome: pieceLabel(cfg, p.id),
      tipo: widget?.type || null,
      x: p.x, y: p.y, w: p.w, h: p.h,
      oculta: p.hidden || undefined,
      backgroundColor: widget?.backgroundColor || cfg.blockStyles?.[p.key]?.backgroundColor || undefined,
      title: widget?.title || undefined,
    };
  });

  return {
    nome: form?.name || undefined,
    appearanceMode: cfg.appearanceMode || "dark",
    globalFont: cfg.globalFont || undefined,
    primaryColor: form?.primaryColor,
    secondaryColor: form?.secondaryColor,
    imoveis: imoveis ?? undefined,
    pecas,
  };
}

let contador = 0;
const novoIdDeWidget = () => `ia-${Date.now().toString(36)}-${(contador += 1)}`;

export function useAssistenteIA({
  tenantSlug,
  configRef,
  formRef,
  modeRef,
  atualizarConfig,
  atualizarCampo,
  registrar,
  aoSelecionar,
  aoCompactar,
  imoveis,
}) {
  const [estado, setEstado] = useState("parado"); // parado | pensando | executando
  const [erro, setErro] = useState("");
  const [plano, setPlano] = useState(null);        // { resumo, operacoes }
  const [passo, setPasso] = useState(-1);          // índice em execução
  const [feitos, setFeitos] = useState([]);        // motivos já aplicados
  const pararRef = useRef(false);

  const executar = useCallback(async (operacoes) => {
    setEstado("executando");
    setFeitos([]);
    pararRef.current = false;

    // Uma entrada só no histórico para o plano inteiro. Ver o topo do arquivo.
    registrar();

    for (let i = 0; i < operacoes.length; i += 1) {
      if (pararRef.current) break;
      const op = operacoes[i];
      setPasso(i);

      const novoId = op.acao === "adicionar" ? novoIdDeWidget() : null;

      // Acende a peça ANTES de mexer: o olho precisa saber onde olhar.
      const alvo = alvoDaOperacao(op, novoId);
      if (alvo && op.acao !== "adicionar") aoSelecionar?.(alvo);

      atualizarConfig((cfg) => aplicarOperacao(cfg, modeRef.current, op, { novoId }));

      /* Duas coisas moram no PERFIL da imobiliária e não no config da vitrine:
         as cores da marca e o texto da chamada principal. Escrevê-las pelo
         `atualizarCampo` é o que faz o passo realmente acontecer — sem isto o
         motivo aparecia na lista como concluído e a tela não mudava. */
      for (const mapa of [temaDoPerfil(op), textoDoPerfil(op)]) {
        if (!mapa) continue;
        for (const [campo, valor] of Object.entries(mapa)) atualizarCampo(campo, valor);
      }

      if (op.acao === "adicionar" && alvo) aoSelecionar?.(alvo);

      setFeitos((f) => [...f, op.motivo || op.acao]);
      await new Promise((r) => setTimeout(r, PAUSA_ENTRE_PASSOS));
    }

    setPasso(-1);
    setEstado("parado");
    aoSelecionar?.(null);

    /* Fecha os vãos no fim, e só quando o plano MEXEU no layout.
       As operações são aplicadas em sequência, e cada uma passa pela cascata: a
       peça que a IA manda para y=640 empurra para baixo quem já estava lá, e a
       seguinte empurra de novo. Ao fim de dez passos a grade de imóveis tinha
       descido de 770px para 2694px — vãos enormes no meio da página, que é o
       oposto de "organize isto aqui".

       Recolocar cada peça na altura do próprio conteúdo desfaz o acúmulo sem
       desfazer a INTENÇÃO: a ordem vertical e as larguras que a IA escolheu
       continuam de pé, só o espaço morto some.

       Não roda quando o pedido era só de cor ou de texto — reempilhar a página
       de quem pediu "deixe o rodapé azul" seria mexer no que ninguém pediu. */
    const mexeuNoLayout = operacoes.some((o) =>
      ["mover", "redimensionar", "adicionar", "remover", "ocultar", "mostrar"].includes(o.acao)
    );
    if (mexeuNoLayout) aoCompactar?.();
  }, [registrar, atualizarConfig, atualizarCampo, modeRef, aoSelecionar, aoCompactar]);

  const pedir = useCallback(async (instrucao) => {
    setErro("");
    setPlano(null);
    setEstado("pensando");
    try {
      const resposta = await api.planejarVitrineIA(tenantSlug, {
        instrucao,
        vitrine: retratoDaVitrine(configRef.current, modeRef.current, formRef.current, imoveis),
        catalogo: catalogoParaIA(),
        /* As fontes que o seletor do inspetor sabe desenhar. Sem esta lista o
           modelo escolhe qualquer nome ("serif", "elegante") e grava um valor
           que a interface não consegue mostrar de volta. */
        fontes: FONT_OPTIONS.map((f) => f.value),
      });
      setPlano(resposta);
      if (!resposta.operacoes?.length) {
        setEstado("parado");
        return resposta;
      }
      await executar(resposta.operacoes);
      return resposta;
    } catch (e) {
      setErro(e.message || "Não consegui falar com a IA agora.");
      setEstado("parado");
      return null;
    }
  }, [tenantSlug, configRef, formRef, modeRef, imoveis, executar]);

  /* Parar no meio deixa o que já foi aplicado. É deliberado: metade de uma
     reorganização ainda é um estado válido do documento (a engine garante), e
     desfazer devolve tudo de uma vez porque o histórico tem uma entrada só. */
  const parar = useCallback(() => { pararRef.current = true; }, []);

  return { estado, erro, plano, passo, feitos, pedir, parar };
}
