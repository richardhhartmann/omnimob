import { useMemo, useState } from "react";
import { ShowcaseWidget } from "../components/showcase/ShowcaseWidget.jsx";
import { ShowcaseHighlights } from "../components/showcase/ShowcaseHighlights.jsx";
import { ShowcaseHeader } from "../components/showcase/ShowcaseHeader.jsx";
import { ShowcaseHero } from "../components/showcase/ShowcaseHero.jsx";
import { ShowcaseFooter } from "../components/showcase/ShowcaseFooter.jsx";
import { ShowcasePropertyGrid, estiloDaGrade } from "../components/showcase/ShowcasePropertyGrid.jsx";
import { VitrineProvider } from "../components/showcase/contexto.jsx";
import { WIDGET_LIBRARY } from "../components/builder/data/biblioteca.jsx";
import { FONTES_REAIS } from "../components/builder/data/fontesReais.js";
import { FONT_OPTIONS } from "../components/builder/data/temas";
import { classeDeAparencia, estiloDoTema } from "../components/showcase/tema.js";
import { ProvedorDaPagina, usarPagina } from "./contextoDaPagina.jsx";
import { PonteDeEdicao } from "./PonteDeEdicao.jsx";
import { campoDeCor } from "./CampoDeCor.jsx";
import { campoFonteDoConteudo, campoLarguraDaPagina, campoLarguraDaPeca, campoOculto, campoTema, campoTravado, campoZebrado } from "./CampoDeAlternar.jsx";
import { campoBrilho, campoEscurecer, campoEspacoExterno, campoEspacoInterno, campoLargura, campoLarguraGlobal } from "./CampoDeslizante.jsx";
import { ComBanner, useSobBanner } from "./ComBanner.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   PROVA DE CONCEITO — a vitrine no Puck.

   Isto NÃO substitui nada ainda. O editor atual (`ShowcaseEditorPage`) continua
   inteiro e intocado; esta config vive numa rota própria para a gente ver o
   Puck com os nossos componentes antes de destruir o que funciona.

   ── O QUE ESTA FASE PRECISA RESPONDER ──

   Três perguntas, uma por componente aqui dentro:

     1. A edição no lugar sobrevive?  → `Texto`, com `contentEditable: true`.
        Era a minha maior dúvida, e a resposta é sim: o Puck troca o valor da
        prop por um nó editável quando está no editor, e o `render` continua
        sendo um só. É mais simples do que o nosso `ShowcaseTexto`, que precisa
        do modo pelo contexto.

     2. Dado real do banco funciona?  → `Equipe`, por `resolveData`, que aceita
        chamada assíncrona. Hoje isso é `useDadosDaVitrine` mais o payload de
        `GET /public/:slug`; ali passaria a ser resolvido na hora da edição e
        congelado nos dados salvos — o que é uma DIFERENÇA a discutir, não um
        detalhe: a equipe deixaria de se atualizar sozinha quando o cadastro
        muda, a menos que o `<Render>` resolva de novo na leitura.

     3. Layout composto sem coordenadas?  → `Secao`, com campos `slot`, que é
        como o Puck faz coluna e aninhamento desde que o `<DropZone>` começou a
        ser aposentado.

   ── O QUE ELA NÃO RESPONDE ──

   Migração dos documentos já publicados, o `<Render>` no lugar da vitrine
   pública, e o que fazer com a engine. Isso é fase 2 em diante.

   ── AS CLASSES SÃO AS NOSSAS ──

   De propósito. Reusar `.widget-team__grid`, `.widget-card` e companhia prova a
   parte que mais importa: os widgets sobrevivem à troca de editor. Se para
   entrar no Puck fosse preciso reescrever o CSS da vitrine, a conta da migração
   seria outra.
   ──────────────────────────────────────────────────────────────────────────── */

/* ── FASE 3: OS BLOCOS FIXOS DESENHAM DE VERDADE ────────────────────────────

   Na fase 2 estes quatro eram marcadores tracejados. Agora são os componentes
   de sempre — `ShowcaseHeader`, `ShowcaseHero`, `ShowcasePropertyGrid`,
   `ShowcaseFooter` —, os MESMOS que a vitrine publicada usa hoje.

   O que cada um recebe vem de dois lugares distintos, e a divisão é a decisão
   central desta fase:

     do DOCUMENTO   o estilo do bloco (cor de fundo, cor do texto, banner) e o
                    texto que a pessoa escreveu. Isso é dela, e é gravado.
     do CONTEXTO    a imobiliária, o acervo, o link do WhatsApp. Isso muda
                    sozinho, e gravar seria congelar (ver `contextoDaPagina`).

   O `blockStyles` chega como UM estilo e é reembrulhado no mapa de uma chave só
   que os componentes esperam. Parece rodeio e não é: a alternativa era mudar a
   assinatura dos quatro componentes, e eles são compartilhados com a vitrine
   atual — que continua no ar enquanto esta migração não termina. */
function comEstilo(chave, estilo) {
  return { [chave]: estilo || {} };
}

/* A versão com memória, para quem desenha dentro de um render.

   `ShowcasePropertyGrid` é `memo`, e um mapa de estilo novo a cada render
   anulava isso: a grade inteira — trinta cartões com imagem e carrossel — se
   reconstruía a cada movimento do ponteiro. O mesmo objeto instável alimentava
   o pisca-pisca das seções em colunas. */
function useEstiloDoBloco(chave, props) {
  const { estilo, backgroundColor, color, backgroundImage, backgroundOverlay, backgroundBrightness } = props;
  return useMemo(
    /* `estilo` primeiro, os campos depois: o que tem controle no inspetor
       vence, e o que ainda não tem — se um dia houver — sobrevive em vez de
       ser descartado no caminho. */
    () => comEstilo(chave, { ...estilo, backgroundColor, color, backgroundImage, backgroundOverlay, backgroundBrightness }),
    [chave, estilo, backgroundColor, color, backgroundImage, backgroundOverlay, backgroundBrightness],
  );
}

/* A grade guarda o carrossel de fotos por conta própria.

   Na vitrine de hoje esse estado mora na página, que o passa por prop até o
   cartão. Aqui não pode: o estado subiria para o `metadata` do Puck, e cada
   clique numa seta invalidaria a identidade do metadata — o que faria o Puck
   re-resolver os dados de TODOS os componentes a cada foto virada. */
function GradeComCarrossel(props) {
  const { properties, tenantSlug, carregando, erro } = usarPagina();
  const [indices, setIndices] = useState({});
  const mapa = useEstiloDoBloco("properties", props);
  const estiloFinal = useMemo(() => estiloDaGrade(mapa), [mapa]);

  const proxima = (id, total) =>
    setIndices((antes) => ({ ...antes, [id]: ((antes[id] || 0) + 1) % total }));
  const anterior = (id, total) =>
    setIndices((antes) => ({ ...antes, [id]: ((antes[id] || 0) - 1 + total) % total }));

  return (
    <ShowcasePropertyGrid
      properties={properties || []}
      tenantSlug={tenantSlug}
      carouselIndexes={indices}
      onProxima={proxima}
      onAnterior={anterior}
      estilo={estiloFinal}
      carregando={carregando}
      erro={erro}
    />
  );
}

/* ── A SEÇÃO EM COLUNAS ────────────────────────────────────────────────────

   Era uma função de render solta, e piscava sem parar: passar o mouse por
   dentro de uma seção de duas colunas fazia os blocos tremerem em laço.

   A causa é o objeto de `style`. O slot do Puck é uma FUNÇÃO de componente, e
   um estilo literal ali dentro nasce com identidade nova a cada render — o que
   basta para o Puck refazer a zona de arrasto, o que provoca outro render, que
   cria outro estilo. Com o ponteiro dentro, a sobreposição de hover entra no
   ciclo e ele não para mais.

   Virou componente para poder ter `useMemo`: mesmas colunas, mesmo objeto,
   laço interrompido. É o motivo de ela existir separada. */
function SecaoEmColunas({ colunas, conteudo: Conteudo }) {
  const estilo = useMemo(() => ({
    display: "grid",
    gridTemplateColumns: `repeat(${Math.min(4, Math.max(1, colunas || 1))}, minmax(0, 1fr))`,
    gap: 16,
  }), [colunas]);

  return (
    <section style={{ padding: "8px 0" }}>
      {/* O estilo vai NA função do slot, e não num invólucro nosso — é assim
          que o Puck deixa o arrasto funcionar dentro de grid e flex.

          `collisionAxis="x"`: a seção é um grid horizontal, e sem isso o Puck
          calculava o encaixe como se as colunas fossem uma lista vertical —
          arrastar uma coluna para a direita da vizinha lia como "para baixo
          dela", e o indicador de soltura apontava para o lugar errado. */}
      <Conteudo style={estilo} collisionAxis="x" />
    </section>
  );
}

/* Os dois campos de cor que todo bloco fixo tem. Ficam aqui porque repetir o
   par em quatro lugares é como as duas metades divergem. */
const CAMPOS_DE_COR = {
  backgroundColor: campoDeCor("Cor de fundo", "#0f172a"),
  color: campoDeCor("Cor do texto", "#e6e8ee"),
};

/* ── O BANNER, QUE VOLTOU DO EDITOR CLÁSSICO ───────────────────────────────

   Imagem de fundo, escurecimento e brilho. Os três já viajavam no documento
   dentro de `estilo` — nada se perdia —, mas não havia campo: quem tinha
   banner ficava com ele e não conseguia trocar. Uma configuração que existe e
   não se alcança é pior que uma que não existe, porque a pessoa sabe que ela
   está lá e procura.

   Vale para TODA peça — bloco fixo, widget e a seção em colunas. A primeira
   versão restringiu o campo aos blocos com o argumento de que
   `mergeBlockWrapperStyle` é função de bloco, e o argumento era sobre a função
   errada: quem desenha o banner é o invólucro do `ComBanner`. */
const CAMPOS_DE_BANNER = {
  backgroundImage: { type: "text", label: "Banner (URL da imagem)" },
  backgroundOverlay: campoEscurecer,
  backgroundBrightness: campoBrilho,
};

/* ── OCULTAR E TRAVAR, QUE O EDITOR ANTIGO TINHA ────────────────────────────

   As Camadas do editor clássico traziam 👁 e 🔒 em cada peça, e o config guarda
   `hiddenBlocks`/`lockedBlocks` desde sempre. No Puck só havia EXCLUIR — e a
   diferença não é de conforto: esconder o rodapé por uma semana virava apagá-lo,
   que é irreversível, enquanto travar não tinha equivalente nenhum.

   Ocultar é campo do documento; travar vira PERMISSÃO, que é como o Puck
   entende "não arraste, não duplique, não apague".

   ── A GRADE DE IMÓVEIS NÃO PODE SER APAGADA ──

   Regra que já existia e que se perdeu na migração: `services/vitrineIA.js`
   peneira qualquer plano que remova ou oculte `b:properties`. É a única peça
   sem a qual a vitrine deixa de ser uma vitrine — e apagá-la publica uma página
   de imobiliária sem imóvel nenhum, em silêncio.

   Aqui ela volta como permissão negada: some do menu da peça e do atalho de
   excluir, em vez de aparecer e falhar. */
const CAMPOS_DA_PECA = {
  oculto: campoOculto,
  travado: campoTravado,
  larguraDaPeca: campoLarguraDaPeca,
  /* Só aparece com a página OU a peça em largura livre — ver `semLarguraSePaginaTravada`. */
  largura: campoLargura,
  espacoInterno: campoEspacoInterno,
  espacoExterno: campoEspacoExterno,
};

/* Com a página travada em 1400px, "Largura da peça" seria um controle que a
   pessoa mexe e que não faz nada de útil — a folha já é o teto. O campo some;
   o valor fica no documento e volta a valer quando a página for liberada. */
function semLarguraSePaginaTravada(campos, params, dados) {
  const raiz = params?.appState?.data?.root?.props || {};
  if (raiz.larguraDaPagina === "livre" || dados?.props?.larguraDaPeca === "livre") return campos;
  const { largura, ...resto } = campos;
  return resto;
}

/* Peça oculta: nada na página publicada, e uma tarja discreta no editor.

   Sumir por completo também no editor foi a primeira ideia, e é o que o
   clássico fazia — mas ali as Camadas eram a única lista e ficavam sempre à
   vista. Aqui a Estrutura é uma aba entre duas, e uma peça que evapora sem
   deixar marca é uma peça que a pessoa dá por perdida. A tarja é aparato de
   edição, como a etiqueta de seleção: não existe no ar. */
function PecaOculta({ rotulo }) {
  return (
    <div className="puck-oculta">
      <strong>{rotulo}</strong>
      <span>Escondida da página. Para trazer de volta, marque "Mostrar na página".</span>
    </div>
  );
}

/* O estilo de banner de uma peça: os três campos do inspetor, com o `estilo`
   guardado por baixo — igual ao que `useEstiloDoBloco` faz para as cores. */
function bannerDe(props) {
  return {
    ...(props.estilo || {}),
    backgroundImage: props.backgroundImage,
    backgroundOverlay: props.backgroundOverlay,
    backgroundBrightness: props.backgroundBrightness,
    color: props.color,
  };
}

/* ── O FUNDO DA SEÇÃO VENCE O FUNDO DA PEÇA ─────────────────────────────────

   Quando uma seção em colunas tem banner, as peças dentro dela abrem mão do
   próprio fundo. É a regra que a pessoa espera: fundo de seção é fundo de
   seção. Sem isto, dois widgets com cor de fundo cobririam a imagem em
   retalhos e a foto apareceria só nas frestas — que é indistinguível de
   defeito, porque a URL foi aceita e o resultado não parece um banner.

   Só o FUNDO. A cor do texto continua de cada peça: sobre uma foto escura,
   quem escolheu texto claro num widget quer o texto claro.

   O que a peça guarda não é apagado — nada é gravado aqui. Tirar o banner da
   seção devolve a cada widget o fundo que ele sempre teve. */
const SEM_FUNDO = {
  backgroundColor: "",
  backgroundImage: "",
  backgroundOverlay: undefined,
  backgroundBrightness: undefined,
};

function estiloSemFundo(estilo) {
  if (!estilo) return estilo;
  const { backgroundColor, backgroundImage, backgroundOverlay, backgroundBrightness, ...resto } = estilo;
  return resto;
}

/* O render original vira um COMPONENTE de verdade, em vez de uma chamada de
   função dentro de outro.

   Os widgets usam `useMemo` no próprio render, e uma chamada direta faria esses
   hooks pertencerem à peça de fora. Marcar "Escondida da página" sai ANTES de
   chamá-lo — a contagem de hooks mudaria no meio da vida do componente, que é
   erro fatal no React. Como componente, o miolo simplesmente desmonta. */
function MioloDaPeca({ render, props }) {
  return render(props);
}

function PecaDaVitrine({ desenhar, rotulo, props }) {
  const sobBanner = useSobBanner();
  const { estilo } = props;

  /* Memoizado pelo `estilo` de origem, e não pelo objeto de props: o que os
     renders internos comparam são os CAMPOS (ver `useEstiloDoBloco`), e um
     objeto de estilo novo a cada quadro é exatamente o que fazia a grade de
     imóveis se reconstruir e as seções piscarem mais cedo nesta migração. */
  const semFundo = useMemo(() => (sobBanner ? estiloSemFundo(estilo) : null), [sobBanner, estilo]);
  const finais = sobBanner ? { ...props, ...SEM_FUNDO, estilo: semFundo } : props;

  if (props.oculto) return props.puck?.isEditing ? <PecaOculta rotulo={rotulo} /> : null;

  /* O banner mora AQUI, e não em cada peça, porque é a mesma resposta para as
     vinte e uma: quem tem imagem de fundo ganha o invólucro que a desenha. Ver
     `ComBanner` para por que ele é preciso. */
  const miolo = (
    <ComBanner estilo={bannerDe(finais)}>
      <MioloDaPeca render={desenhar} props={finais} />
    </ComBanner>
  );

  /* Largura (página em largura livre) e espaçamentos por peça. Só existe
     invólucro quando algum deles saiu do padrão: a 100% e zero a árvore é a de
     sempre. Peça mais estreita fica centrada — encostada à esquerda leria como
     quebrada. */
  const largura = Number(props.largura);
  const interno = Number(props.espacoInterno) || 0;
  const externo = Number(props.espacoExterno) || 0;
  const estreita = Number.isFinite(largura) && largura > 0 && largura < 100;
  /* O invólucro existe sempre: é ele que lê o espaçamento GLOBAL da página
     (`--peca-interno` / `--peca-externo`, na raiz) quando a peça não tem o
     seu. Sem valor nenhum, padding e margem resolvem para zero e a caixa não
     muda nada. */
  /* Peça LIVRE: sangra até as bordas do monitor mesmo com a página travada.
     A conta é a do cabeçalho (meia janela para cada lado); a largura em %
     passa a ser da JANELA, e a peça fica centrada nela. */
  const livre = props.larguraDaPeca === "livre";
  const pct = estreita ? largura : 100;
  const sangria = livre
    ? { width: `${pct}vw`, marginLeft: `calc(50% - ${pct / 2}vw)`, marginRight: 0 }
    : { width: estreita ? `${largura}%` : "var(--peca-largura, 100%)", marginInline: "auto" };
  return (
    <div
      className={`puck-envolucro${livre ? " puck-envolucro--livre" : ""}`}
      style={{
        /* Largura própria vence; sem ela, a global da página (variável). */
        ...sangria,
        padding: interno > 0 ? `${interno}px` : "var(--peca-interno, 0px)",
        marginBlock: externo > 0 ? `${externo}px` : "var(--peca-externo, 0px)",
      }}
    >
      {miolo}
    </div>
  );
}

/* ── OS AJUSTES DO BANNER SÓ EXISTEM QUANDO HÁ BANNER ───────────────────────

   "Escurecer o banner" e "Brilho do banner" ficavam no inspetor de toda peça,
   sempre — inclusive nas que não têm imagem nenhuma. Ali eles não são um ajuste
   fino: são dois controles que a pessoa mexe e que não fazem NADA, porque o
   escurecimento e o brilho são pseudo-elementos da imagem (ver `ComBanner`).
   Sem imagem não há o que escurecer.

   Some o CONTROLE, e não o valor: quem já tinha um banner com 40% de
   escurecimento e apaga a URL não perde o 40% — ele continua no documento e
   volta a valer assim que outra imagem entrar. Apagar o dado junto seria a
   pessoa perder um ajuste por ter trocado de foto.

   `resolveFields` roda a cada mudança de prop, então o par aparece no mesmo
   gesto em que a URL é colada. */
function semAjustesDeBannerVazio(campos, dados) {
  if (dados?.props?.backgroundImage) return campos;
  const { backgroundOverlay, backgroundBrightness, ...resto } = campos;
  return resto;
}

/** Acrescenta ocultar/travar a uma peça — e a trava de exclusão, quando pedida. */
function comAfordancias(config, { rotulo, naoApagar = false } = {}) {
  return {
    ...config,
    fields: { ...CAMPOS_DA_PECA, ...(config.fields || {}) },
    /* Encadeado, e não substituído: se um dia uma peça trouxer o próprio
       `resolveFields`, ele continua valendo e o banner entra por cima. */
    resolveFields: async (dados, params) => {
      const base = config.resolveFields
        ? await config.resolveFields(dados, params)
        : params.fields;
      return semLarguraSePaginaTravada(semAjustesDeBannerVazio(base, dados), params, dados);
    },
    defaultProps: { oculto: false, travado: false, larguraDaPeca: "travada", largura: 100, espacoInterno: 0, espacoExterno: 0, ...(config.defaultProps || {}) },
    resolvePermissions: (data) => {
      const travado = Boolean(data?.props?.travado);
      return {
        drag: !travado,
        duplicate: !travado,
        delete: !travado && !naoApagar,
      };
    },
    render: (props) => (
      <PecaDaVitrine desenhar={config.render} rotulo={rotulo || "Peça"} props={props} />
    ),
  };
}

/* ── A BIBLIOTECA, GERADA DO MESMO CATÁLOGO DO EDITOR ANTIGO ────────────────

   Um componente do Puck por tipo de widget, saído de `WIDGET_LIBRARY`. Nada é
   redigitado aqui: nome, título de estreia e conteúdo padrão vêm de lá, que é
   onde a equipe já mexe quando inventa um widget novo. Uma segunda lista
   divergiria no primeiro tipo acrescentado — foi por isso que o assistente de
   IA também lê o vocabulário do cliente em vez de guardar uma cópia na API.

   Os widgets NÃO ganham campos no inspetor, e isso é decisão tomada: conteúdo
   de widget se edita dentro do widget, na prancheta. O inspetor fica com
   layout, aparência e ações. Repetir a lista de perguntas do FAQ numa coluna
   lateral foi a primeira tentativa e estava errada.

   O `id` é mintado no `resolveData` porque `defaultProps` é estático: sem isso,
   dois widgets do mesmo tipo nasceriam com o mesmo id, e uma edição num
   atingiria os dois — a ponte encontra a peça justamente pelo id. */
function widgetsDaBiblioteca() {
  const saida = {};
  for (const modelo of WIDGET_LIBRARY) {
    const fonte = FONTES_REAIS[modelo.type];
    // Tem botão de chamada (CTA, busca, regiões, equipe): ganha o campo do endereço.
    const temCta = modelo.ctaUrl !== undefined || Boolean(modelo.ctaLabel);

    saida[`Widget_${modelo.type}`] = comAfordancias({
      label: modelo.nome,
      /* Cor de fundo, cor do texto e — para os sete que sabem — a FONTE do
         conteúdo. O resto continua sendo editado dentro da peça, na prancheta:
         repetir a lista de perguntas do FAQ numa coluna lateral foi a primeira
         tentativa e estava errada. O que o inspetor ganha é o que não tem como
         ser desenhado no lugar. */
      fields: {
        ...CAMPOS_DE_COR,
        /* Widget também tem banner. A primeira versão o deu só aos blocos, com
           o argumento de que `mergeBlockWrapperStyle` é função de bloco — e o
           argumento era sobre a função errada: quem desenha o banner é o
           invólucro do `ComBanner`, e ele serve a qualquer peça. */
        ...CAMPOS_DE_BANNER,
        ...(fonte ? { usarDadosReais: campoFonteDoConteudo(fonte) } : {}),
        /* O endereço do botão, para as peças que têm um. Vazio = o WhatsApp
           da imobiliária, lido do cadastro — é o que os modelos trazem e o que
           a maioria quer. Um link próprio (formulário, página, outro número)
           entra aqui; ele não aparece na prancheta porque não é texto da
           página, é configuração. */
        ...(temCta ? { ctaUrl: { type: "text", label: "Endereço do botão (vazio = WhatsApp da imobiliária)" } } : {}),
      },
      defaultProps: {
        backgroundColor: "",
        color: "",
        ...(fonte ? { usarDadosReais: true } : {}),
        ...(temCta ? { ctaUrl: "" } : {}),
        widget: {
          id: "",
          type: modelo.type,
          title: modelo.title,
          content: modelo.content,
          ctaLabel: modelo.ctaLabel || "",
          ctaUrl: modelo.ctaUrl || "",
        },
      },
      render: ({ widget, backgroundColor, color, usarDadosReais, ctaUrl }) => {
        /* As cores e a fonte do inspetor entram no objeto do widget na hora de
           desenhar, e não são gravadas dentro dele. Duas fontes para o mesmo
           dado é como uma delas envelhece: quem manda é o campo, sempre.

           `usarDadosReais` só vira `false` quando a pessoa desligou — ausência
           conta como ligado, que é o que `normalizeShowcaseConfig` já decidiu.
           Gravar `true` em toda peça diria que houve escolha onde não houve. */
        const peca = useMemo(() => {
          if (!widget) return null;
          const p = { ...widget, backgroundColor, color };
          if (usarDadosReais === false) p.usarDadosReais = false;
          // O campo do inspetor vence o que veio dentro do widget.
          if (typeof ctaUrl === "string" && ctaUrl.trim()) p.ctaUrl = ctaUrl.trim();
          return p;
        }, [widget, backgroundColor, color, usarDadosReais, ctaUrl]);
        return peca ? <ShowcaseWidget widget={peca} /> : null;
      },
    }, { rotulo: modelo.nome });
  }
  return saida;
}

export const configVitrine = {
  /* ── A RAIZ ENVOLVE TUDO NO CONTEXTO DA VITRINE ───────────────────────────
     Os widgets de verdade leem `useVitrine` e `useDadosDaVitrine`. Sem este
     invólucro cada um deles teria de receber o contexto por prop — e aí não
     seriam mais os mesmos componentes, que é justamente o que a migração não
     pode custar.

     `modo="public"` de propósito: dentro do Puck quem cuida de selecionar,
     arrastar e editar é o Puck. Ligar o modo editor aqui empilharia dois
     aparatos de edição na mesma peça. */
  root: {
    /* ── AS OPÇÕES DA PÁGINA ──────────────────────────────────────────────
       Sem seleção, o inspetor da direita edita a PÁGINA — tema, fonte e cores.
       É o que o editor antigo mostrava ao clicar num lugar vazio da prancheta,
       e some-lo foi um erro meu: eu tinha esvaziado a raiz só para tirar o
       campo "title" que o Puck oferece por omissão (em inglês, e sem lugar
       nenhum na vitrine).

       Estes quatro não são do documento do Puck — são campos do
       `showcaseConfig` de sempre (`appearanceMode`, `globalFont`, `corPrimaria`,
       `corSecundaria`), lidos pela vitrine pública por `classeDeAparencia` e
       `estiloDoTema`. Eles viajam pela raiz do documento e a página os devolve
       ao lugar certo ao salvar. Guardá-los DENTRO do documento faria a vitrine
       publicada parar de responder ao tema, que é lido de fora dele. */
    fields: {
      appearanceMode: campoTema,
      zebrado: campoZebrado,
      larguraDaPagina: campoLarguraDaPagina,
      /* Largura de TODAS as peças — só aparece com a página livre (ver o
         `resolveFields` da raiz). A peça com largura própria vence. */
      larguraDasPecas: campoLarguraGlobal,
      /* Espaçamento de TODAS as peças, de uma vez. O valor da peça (inspetor
         dela) vence quando é maior que zero — ver `PecaDaVitrine`. */
      espacoInterno: campoEspacoInterno,
      espacoExterno: campoEspacoExterno,
      globalFont: {
        type: "select",
        label: "Fonte",
        options: FONT_OPTIONS.map((f) => ({ label: f.label, value: f.value })),
      },
      corPrimaria: campoDeCor("Cor principal", "#6366f1"),
      corSecundaria: campoDeCor("Cor de apoio", "#d4af37"),

      /* ── O CADASTRO DA IMOBILIÁRIA ──────────────────────────────────
         Estes cinco não são do documento: são colunas do `Tenant`, as mesmas
         que alimentam as Configurações e o feed dos portais. Viajam pela raiz
         só como veículo, e a página os devolve ao cadastro ao salvar.

         Descrição, WhatsApp e e-mail também se editam na prancheta, porque o
         rodapé os desenha. Logo e slogan não aparecem como texto em lugar
         nenhum — sem estes campos, não havia por onde mexer neles. */
      logoUrl: { type: "text", label: "Logotipo (URL da imagem)" },
      slogan: { type: "text", label: "Slogan" },
      description: { type: "textarea", label: "Descrição da imobiliária" },
      whatsapp: { type: "text", label: "WhatsApp" },
      email: { type: "text", label: "E-mail" },
    },
    resolveFields: (dados, { fields }) => {
      if (dados?.props?.larguraDaPagina === "livre") return fields;
      const { larguraDasPecas, ...resto } = fields;
      return resto;
    },
    render: ({ children, puck, appearanceMode, zebrado, larguraDaPagina, larguraDasPecas, espacoInterno, espacoExterno, globalFont, corPrimaria, corSecundaria,
               logoUrl, slogan, description, whatsapp, email }) => {
      const meta = puck?.metadata || {};
      /* O provedor da fase 3: a imobiliária, o acervo e o link do WhatsApp. Ele
         fica AQUI, e não em volta do `<Puck>`/`<Render>` na página, porque
         `root.render` é o único ponto que as duas telas atravessam — e a prévia
         do editor vive dentro de um iframe. */
      /* A classe existe para o CSS ter onde se agarrar NAS DUAS TELAS.

         A primeira tentativa pendurou as correções em `.showcase-puck`, que é o
         contêiner da página pública — e por isso elas não chegavam ao editor,
         cuja prévia vive dentro de um iframe com estrutura própria. O cabeçalho
         continuava sobrepondo tudo lá, exatamente como antes.

         Aqui não tem esse problema: `root.render` é o único ponto que o editor
         e a vitrine publicada atravessam. */
      /* O tema, a fonte e as cores da PÁGINA valem aqui — é o que faz a
         prancheta mostrar a mesma página que vai ao ar. Sem isto, trocar o tema
         no inspetor mudava o documento e não mudava nada na tela, que é a
         forma mais rápida de a pessoa concluir que o controle está quebrado.

         Na vitrine publicada esta mesma marcação fica dentro do
         `showcase-body` da página, redeclarando as mesmas variáveis com os
         mesmos valores — inofensivo, e é o preço de haver UM lugar só que
         aplica o tema nas duas telas. */
      /* `herdarCoresDoPainel: false` quando há cor escolhida, e é ISSO que
         fazia os dois seletores de cor não surtirem efeito nenhum na prancheta:
         `coresDaVitrine` só olha `corPrimaria` quando a herança está desligada,
         e a ausência da chave conta como "herdar". A pessoa escolhia uma cor,
         nada mudava, e o motivo — uma decisão que ela nunca tomou — era
         invisível.

         A mesma regra está em `opcoesDaPagina`, do lado de quem grava. As duas
         precisam concordar: se divergirem, o editor mostra uma cor e a vitrine
         publica outra. */
      /* O cadastro que a raiz recebe sobrepõe o que veio do carregamento —
         é o que faz o logotipo trocar na prancheta no mesmo instante. Só o
         que foi realmente preenchido: string vazia aqui apagaria da tela um
         dado que continua no cadastro. */
      const cadastro = { logoUrl, slogan, description, whatsapp, email };
      const tenantVivo = { ...(meta.pagina?.tenant || {}) };
      for (const [chave, valor] of Object.entries(cadastro)) {
        if (typeof valor === "string" && valor !== "") tenantVivo[chave] = valor;
      }
      const paginaViva = meta.pagina ? { ...meta.pagina, tenant: tenantVivo } : meta.pagina;

      const pagina = {
        appearanceMode,
        globalFont,
        corPrimaria,
        corSecundaria,
        herdarCoresDoPainel: !(corPrimaria || corSecundaria),
      };
      /* Zebra ligada por omissão: documento antigo não tem a chave, e a
         ausência conta como "sim" — a mesma regra do inspetor e de
         `opcoesDaPagina`, na página. */
      const miolo = (
        <div
          className={`vitrine-puck showcase-body ${classeDeAparencia(pagina)}${zebrado === "nao" ? "" : " is-zebrada"}${larguraDaPagina === "livre" ? " is-larga" : ""}`}
          style={{
            ...estiloDoTema(tenantVivo, pagina),
            /* O espaçamento global viaja em variável: cada peça o lê quando
               não tem valor próprio. Zero some da declaração para não
               sobrescrever nada por engano. */
            ...(larguraDaPagina === "livre" && Number(larguraDasPecas) > 0 && Number(larguraDasPecas) < 100 ? { "--peca-largura": `${Number(larguraDasPecas)}%` } : {}),
            ...(Number(espacoInterno) > 0 ? { "--peca-interno": `${Number(espacoInterno)}px` } : {}),
            ...(Number(espacoExterno) > 0 ? { "--peca-externo": `${Number(espacoExterno)}px` } : {}),
          }}
        >
          <ProvedorDaPagina valor={paginaViva}>{children}</ProvedorDaPagina>
        </div>
      );

      /* ── O RAMO É DE COMPONENTE, E TEM DE SER ────────────────────────────
         Editando, os textos da vitrine precisam ficar editáveis e a alteração
         precisa achar o caminho de volta ao documento — é o que a ponte faz, e
         ela depende de um hook que só existe dentro do editor. Publicada, não
         há loja nenhuma para ler. Como hook não pode ser condicional, quem se
         ramifica é o componente. */
      if (puck?.isEditing) {
        return (
          <PonteDeEdicao tenantSlug={meta.tenantSlug} dados={meta.dadosDaVitrine || null} aoEditarCadastro={meta.aoEditarCadastro}>
            {miolo}
          </PonteDeEdicao>
        );
      }
      return (
        <VitrineProvider modo="public" tenantSlug={meta.tenantSlug} dados={meta.dadosDaVitrine || null}>
          {miolo}
        </VitrineProvider>
      );
    },
  },

  /* ── A GAVETA ────────────────────────────────────────────────────────────
     Dois grupos: os blocos fixos e as peças. O que não está em nenhum cai em
     `other`, que fica INVISÍVEL — é assim que a "Seção (colunas)" e a peça
     genérica saem da lista sem sair da config. A seção não pode ser oferecida
     porque não pode existir vazia (`PodarSecoesVazias` a apaga no mesmo
     instante); ela nasce só do gesto de arrastar uma peça ao lado da outra
     (`agrupar.js`). O componente continua existindo para os documentos que já
     a têm. */
  categories: {
    blocos: { title: "Blocos da página", components: ["BlocoCabecalho", "BlocoTitulo", "BlocoDestaques", "BlocoImoveis", "BlocoRodape"] },
    pecas: { title: "Peças", components: WIDGET_LIBRARY.map((m) => `Widget_${m.type}`), defaultExpanded: true },
    other: { visible: false },
  },

  components: {
    /* ── 0. A ponte: qualquer widget da vitrine, sem reescrever nenhum ─────
       Um componente só que recebe o objeto `widget` inteiro e delega ao
       `ShowcaseWidget`. É o que faz os catorze tipos existirem no Puck de uma
       vez — e a prova de que o investimento nos widgets sobrevive à troca de
       editor.

       O conteúdo é editado pelas peças de sempre — os tipos conhecidos ganham
       campos próprios em `widgetsDaBiblioteca`. O que sobra aqui é o BANNER, e
       ele fica porque funciona: quem desenha a imagem é o invólucro do
       `ComBanner`, que não precisa saber que peça está envolvendo. Cor de fundo
       NÃO entra: este render não a repassa, e campo que aceita valor sem efeito
       é a pior forma de não ter o recurso. */
    Widget: comAfordancias({
      label: "Peça da vitrine",
      fields: { ...CAMPOS_DE_BANNER },
      render: ({ widget }) => (widget ? <ShowcaseWidget widget={widget} /> : null),
    }, { rotulo: "Peça da vitrine" }),

    /* ── Os cinco blocos fixos, todos desenhando de verdade ───────────────── */

    BlocoCabecalho: comAfordancias({
      label: "Cabeçalho da vitrine",
      fields: { ...CAMPOS_DE_COR, ...CAMPOS_DE_BANNER },
      render: (props) => {
        const { tenant, tenantSlug, whatsappHref } = usarPagina();
        const blockStyles = useEstiloDoBloco("header", props);
        return (
          <ShowcaseHeader
            tenant={tenant}
            tenantSlug={tenantSlug}
            blockStyles={blockStyles}
            /* Falso fixo: a responsividade passa a ser do CSS, e não de um
               segundo documento por breakpoint. É a contrapartida combinada
               quando o layout mobile foi descartado na fase 2. */
            isMobileViewport={false}
            whatsappHref={whatsappHref}
          />
        );
      },
    }, { rotulo: "Cabeçalho da vitrine" }),

    BlocoTitulo: comAfordancias({
      label: "Título da página",
      fields: { ...CAMPOS_DE_COR, ...CAMPOS_DE_BANNER },
      render: (props) => {
        const { tenant } = usarPagina();
        const blockStyles = useEstiloDoBloco("title", props);
        return <ShowcaseHero tenant={tenant} blockStyles={blockStyles} />;
      },
    }, { rotulo: "Título da página" }),

    /* Destaques é o único bloco fixo que desenha só com o que está no
       documento — daí ele já ter funcionado na fase 2. */
    BlocoDestaques: comAfordancias({
      label: "Destaques",
      fields: { ...CAMPOS_DE_COR, ...CAMPOS_DE_BANNER },
      render: (props) => {
        const { highlights, highlightStyles } = props;
        const blockStyles = useEstiloDoBloco("highlights", props);
        const config = useMemo(
          () => ({ highlights: highlights || [], highlightStyles: highlightStyles || [] }),
          [highlights, highlightStyles],
        );
        return <ShowcaseHighlights config={config} blockStyles={blockStyles} />;
      },
    }, { rotulo: "Destaques" }),

    BlocoImoveis: comAfordancias({
      label: "Grade de imóveis",
      fields: { ...CAMPOS_DE_COR, ...CAMPOS_DE_BANNER },
      render: (props) => <GradeComCarrossel {...props} />,
    }, { rotulo: "Grade de imóveis", naoApagar: true }),

    BlocoRodape: comAfordancias({
      label: "Rodapé",
      fields: {
        ...CAMPOS_DE_COR,
        ...CAMPOS_DE_BANNER,
        footerTitle: { type: "text", label: "Título do rodapé" },
      },
      render: (props) => {
        const { footerTitle } = props;
        const { tenant, whatsappHref } = usarPagina();
        const blockStyles = useEstiloDoBloco("footer", props);
        return (
          <ShowcaseFooter
            tenant={tenant}
            config={{ footerTitle }}
            blockStyles={blockStyles}
            whatsappHref={whatsappHref}
          />
        );
      },
    }, { rotulo: "Rodapé" }),
    /* ── A biblioteca inteira, um componente por tipo de widget ───────────
       Catorze peças, geradas de WIDGET_LIBRARY. Foi o que faltava para este
       editor conseguir MONTAR uma página em vez de só rearrumar a que veio
       traduzida — na fase 3 a gaveta da esquerda tinha uma "Peça da vitrine"
       genérica e sem campos, que nascia vazia e não servia para nada. */
    ...widgetsDaBiblioteca(),

    /* ── 3. Seção com colunas ────────────────────────────────────────────── */
    Secao: comAfordancias({
      label: "Seção (colunas)",
      /* ── SEM CAMPO DE COLUNAS ────────────────────────────────────────────
         Havia um "Colunas" de 1 a 4 aqui, e ele passou a ser uma promessa que a
         tela desfazia: o número de colunas é DERIVADO de quantas peças a seção
         contém (ver `arrumarColunas`), então qualquer valor digitado voltava ao
         da contagem no gesto seguinte.

         Um campo que aceita valor e não faz efeito é a pior forma de não ter o
         recurso — a mesma frase que trouxe o banner de volta, aplicada ao
         contrário. Quem quer três colunas põe três peças. */
      fields: {
        /* O banner da seção cobre a área INTEIRA, colunas e frestas — e as
           peças de dentro abrem mão do próprio fundo enquanto ele existe (ver
           `PecaDaVitrine`). Sem isso, a foto apareceria só entre os widgets. */
        ...CAMPOS_DE_BANNER,
        conteudo: { type: "slot", label: "Conteúdo" },
      },
      defaultProps: { colunas: 2, conteudo: [] },
      render: (props) => <SecaoEmColunas {...props} />,
    }, { rotulo: "Seção (colunas)" }),
  },
};
