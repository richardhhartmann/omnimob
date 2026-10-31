import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Puck } from "@puckeditor/core";
/* Sem `import "@puckeditor/core/puck.css"`: da versão 0.22 em diante o Puck
   injeta o próprio estilo, e o import faz ele avisar no console que o pulou.
   Ficou aqui na primeira tentativa porque é o que a documentação antiga manda —
   foi o console da biblioteca que corrigiu. */
import { api } from "../api";
import { ESTILOS_DA_ZEBRA, normalizeShowcaseConfig } from "../utils/showcaseConfig";
import { linkWhatsApp } from "../components/showcase/tema.js";
import { loadShowcaseFonts } from "../utils/showcaseFonts";
import { configVitrine } from "../puck/configVitrine.jsx";
import { DICIONARIO_PT } from "../puck/idioma.js";
import { BarraDaPeca } from "../puck/AcoesDaPeca.jsx";
import { NomesDasSecoes } from "../puck/NomesDasSecoes.jsx";
import { ArrastoNaEstrutura } from "../puck/ArrastoNaEstrutura.jsx";
import { FotosDoAcervo } from "../puck/CampoImagemDoBanner.jsx";
import { traduzirParaPuck } from "../puck/traduzirConfig";
import { marcarAlvosDoTour } from "../puck/alvosDoTour.js";
import { ICONES, MenuDoEditor } from "../puck/MenuDoEditor.jsx";
import { PodarSecoesVazias } from "../puck/PodarSecoesVazias.jsx";
import { CartaoDaGaveta } from "../puck/PreviaDaPeca.jsx";
import { BarraDaSelecao } from "../puck/BarraDaSelecao.jsx";
import { documentoDaVersao, lerHistorico, quandoFoi } from "../puck/historicoDeVersoes.js";
import { criarAutosave } from "../puck/autosave.js";
import { BUILDER_TEMPLATES } from "../components/builder/data/templates";
import { PreviaDoModelo } from "../components/builder/data/PreviaDoModelo.jsx";
import { baseDaVitrine } from "../utils/enderecoVitrine";
import { EditorEsqueleto } from "../components/builder/EditorEsqueleto.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   O EDITOR DE VITRINE.

   É esta a tela de "editar página", para todo mundo — não há mais dois editores
   a escolher. Quem nunca migrou entra e vê a própria vitrine já TRADUZIDA de
   coordenadas para árvore, pronta para editar; quem já migrou vê o documento
   gravado. O editor clássico foi removido em 31/10/2026; `/editar/classico`
   redireciona para cá.

   ── A ABERTURA NÃO GRAVA ──

   A tradução acontece toda vez que a tela abre, e por isso o autosave tem uma
   trava explícita: sem ela, abrir o editor e não mexer em nada já migraria a
   imobiliária. Ver `aoMudar`.

   ── RASCUNHO E PUBLICAR (31/10/2026) ──

   O autosave grava um RASCUNHO (`/api/editor-vitrine/rascunho`), que a vitrine
   pública não lê. Só o botão "Publicar" leva ao ar. Antes, cada alteração ia ao
   ar um segundo depois: apagar a grade de imóveis para recolocá-la mais abaixo
   deixava o visitante vendo a página sem imóveis.

   Na publicação o SERVIDOR grava, com o que estiver no banco naquela hora:

     showcaseConfig.puck   o documento — peças, ordem, textos, estilos de bloco
     colunas do Tenant     manchete, descrição, e-mail, WhatsApp

   Dois editores abertos não se apagam mais: cada gravação leva a versão do
   rascunho em que se baseou, e a velha é recusada — a tela para de gravar e
   oferece recarregar. Ver `routes/editorVitrineRoutes.js` na API.

   Os segundos parecem documento e não são: são o cadastro da imobiliária, o
   mesmo que alimenta as Configurações e o feed dos portais. Ver o cabeçalho de
   `puck/PonteDeEdicao`.

   ── A VOLTA É REAL ──

   O formato antigo (`layout`, `mobileLayout`, `widgets`) fica gravado, intocado,
   ao lado do novo. Voltar a ele é apagar UMA chave (`puck`) — e a página de
   antes volta inteira, porque nunca chegou a sair. É operação do suporte:
   `npm run vitrines-classicas -- --slug=X --voltar --aplicar`, na API.

   Não há tradução de volta, e não vai haver: árvore não tem coordenada, e
   inventar posições para o caminho inverso produziria uma terceira página, que
   não é nem a antiga nem a nova. Por isso o que se guarda é o ORIGINAL, e não
   uma reconstrução dele.
   ──────────────────────────────────────────────────────────────────────────── */

/* ── AS COLUNAS DO TENANT QUE A PÁGINA EDITA ───────────────────────────────

   Logo, slogan, descrição, WhatsApp e e-mail são cadastro da imobiliária, e
   não documento: os mesmos campos alimentam as Configurações e o feed dos
   portais. Eles entram na raiz do documento como VEÍCULO — é o inspetor da
   Página que os edita — e voltam para o cadastro no salvamento.

   A lista existe num lugar só porque ela é lida em três: ao semear a raiz, ao
   salvar, e ao decidir o que não é opção de página. Três cópias divergiriam
   no primeiro campo novo, e o sintoma seria um dado que a pessoa edita e que
   nunca chega ao banco. */
const CAMPOS_DO_CADASTRO = ["logoUrl", "slogan", "description", "whatsapp", "email"];

/* Só o que a vitrine pública lê de fora do documento. Uma função à parte para
   a lista existir num lugar só: acrescentar um controle de página aqui e
   esquecer de espelhá-lo é como o editor passa a mostrar algo que o ar não
   tem. */
function opcoesDaPagina(root) {
  const p = root?.props || {};
  const saida = {};
  if (p.appearanceMode === "dark" || p.appearanceMode === "light") saida.appearanceMode = p.appearanceMode;
  if (typeof p.globalFont === "string" && p.globalFont) saida.globalFont = p.globalFont;
  /* Seções zebradas: booleano no config, e a página do imóvel lê de lá também. */
  if (p.zebrado === "sim" || p.zebrado === "nao") saida.zebrado = p.zebrado === "sim";
  /* O estilo da divisória da zebra (ver `campoEstiloDaZebra`). */
  if (ESTILOS_DA_ZEBRA.includes(p.zebraEstilo)) saida.zebraEstilo = p.zebraEstilo;
  /* Cabeçalho fixo ao rolar: booleano, ligado por padrão (ver `campoCabecalhoFixo`). */
  if (p.cabecalhoFixo === "sim" || p.cabecalhoFixo === "nao") saida.cabecalhoFixo = p.cabecalhoFixo === "sim";
  if (p.larguraDaPagina === "livre" || p.larguraDaPagina === "travada") saida.larguraLivre = p.larguraDaPagina === "livre";
  saida.espacamento = { interno: Number(p.espacoInterno) || 0, externo: Number(p.espacoExterno) || 0 };
  saida.larguraDasPecas = Number(p.larguraDasPecas) || 100;
  /* Cor própria implica NÃO herdar a do painel — senão a pessoa escolhe uma cor,
     nada muda, e o motivo (uma caixa marcada noutra tela) fica invisível. */
  if (typeof p.corPrimaria === "string" && p.corPrimaria) {
    saida.corPrimaria = p.corPrimaria;
    saida.herdarCoresDoPainel = false;
  }
  if (typeof p.corSecundaria === "string" && p.corSecundaria) saida.corSecundaria = p.corSecundaria;
  return saida;
}

/* O que, da raiz, é cadastro. Só o que foi realmente preenchido: string vazia
   aqui apagaria do banco um dado que a pessoa não pediu para apagar. */
function doCadastro(root) {
  const p = root?.props || {};
  const saida = {};
  for (const campo of CAMPOS_DO_CADASTRO) {
    if (typeof p[campo] === "string" && p[campo] !== "") saida[campo] = p[campo];
  }
  return saida;
}

/* Fora do componente: um objeto novo a cada render faria o Puck remontar a
   barra da peça a cada tecla digitada. */
/* `drawerItem` veste o cartão da gaveta com a miniatura da peça — a mesma que o
   editor clássico usa, lida do mesmo catálogo. O fantasma do arrasto é um clone
   do cartão, então ele acompanha sem um segundo lugar para manter. Ver
   `puck/PreviaDaPeca`. */
/* `puck` envolve a interface inteira, e é só para pôr `NomesDasSecoes` e
   `ArrastoNaEstrutura` DENTRO da árvore do Puck — é lá que o estado dele pode
   ser assinado e o `dispatch` existe. Não desenham nada na página (o
   renomear da Estrutura abre por portal). */
const SOBRESCRITAS = {
  actionBar: BarraDaPeca,
  drawerItem: CartaoDaGaveta,
  puck: ({ children }) => (
    <>
      {children}
      <NomesDasSecoes />
      <ArrastoNaEstrutura />
    </>
  ),
};

/* ── OS TAMANHOS DE TELA DA PRÉVIA ─────────────────────────────────────────
   Aparelhos de verdade, e não os "Small/Medium/Large" de fábrica do Puck (360,
   768 e 1280): 768 é exatamente a fronteira entre celular e computador da
   vitrine (`BREAKPOINT_MOBILE`), e o "Medium" caía do lado do computador —
   a prévia de tablet mostrava outra coisa que um tablet mostra.

   A prévia é um iframe dessa largura, e é isso que a torna fiel: as regras de
   celular e tablet da vitrine (styles.css) leem a largura da janela, e a
   janela do iframe tem a do aparelho. Fora do componente, como `SOBRESCRITAS`. */
const TELAS = [
  { width: 390, height: "auto", icon: "Smartphone", label: "Celular" },
  { width: 820, height: "auto", icon: "Tablet", label: "Tablet" },
  { width: 1280, height: "auto", icon: "Monitor", label: "Computador" },
  { width: "100%", height: "auto", icon: "FullWidth", label: "Largura toda" },
];

export function VitrinePuckPage() {
  const { tenantSlug } = useParams();
  const [carga, setCarga] = useState({ estado: "carregando" });
  const [avisosAbertos, setAvisosAbertos] = useState(true);
  const [recado, setRecado] = useState("");
  /* Qual gaveta está aberta: "modelos", "historico" ou nenhuma. Uma variável
     em vez de dois booleanos porque as duas nunca convivem — e dois
     booleanos permitem o estado impossível de ambas abertas. */
  const [gaveta, setGaveta] = useState(null);
  /* As versões PUBLICADAS, do servidor; e as antigas deste navegador (o
     histórico de antes de 31/10/2026, que vivia só no localStorage). */
  const [versoes, setVersoes] = useState([]);
  const [versoesLocais, setVersoesLocais] = useState([]);
  const [linkCopiado, setLinkCopiado] = useState(false);
  /* Há rascunho no servidor (alterações não publicadas)? */
  const [temRascunho, setTemRascunho] = useState(false);
  const [situacao, setSituacao] = useState("em-dia");
  const [publicando, setPublicando] = useState(false);
  /* Outra aba ou pessoa gravou por cima: a mensagem do servidor, e a tela para. */
  const [conflito, setConflito] = useState(null);
  /* Sobe para buscar tudo de novo (recarregar depois de um conflito). */
  const [recarga, setRecarga] = useState(0);

  /* ── A ALTURA É MEDIDA, NÃO DECLARADA ─────────────────────────────────────
     O Puck desenha a prévia num iframe e assume a altura do contêiner: sem uma
     altura definida ele nasce com zero e a tela fica em branco.

     A primeira tentativa foi `position: fixed; inset: 0`, e ela MENTIU. A rota
     vive dentro do painel, e o invólucro de transição de rota tem
     `filter: blur(0px)` — o que faz dele o bloco de contenção de qualquer
     `fixed` lá dentro. Como esse invólucro é dimensionado pelo próprio filho, a
     caixa tinha altura ZERO: o `inset: 0` resolvia contra nada e o editor
     desenhava derramado para fora dela, junto com tudo que fosse ancorado ao
     rodapé. Na tela parecia certo; no medidor, 1480 × 0.

     Então mede-se: o que sobra da janela abaixo de onde o bloco começa. Isso
     acompanha a faixa de teste, que aparece para uns e não para outros — e é a
     razão de não haver um número escrito aqui. */
  const caixa = useRef(null);
  const [altura, setAltura] = useState(640);

  /* ── AUTOSAVE ─────────────────────────────────────────────────────────────
     Mesma ideia do editor antigo: um segundo de silêncio e grava. Sem isso a
     pessoa perde uma tarde de trabalho ao fechar a aba, e "lembre-se de apertar
     Publicar" é o tipo de instrução que só é lembrada depois da primeira perda.

     Ele NÃO dispara na abertura, e essa trava é o ponto delicado da tela: a
     primeira coisa que acontece aqui é a tradução da vitrine antiga, e gravar
     isso sozinho migraria toda imobiliária que apenas ABRISSE o editor, sem ter
     mexido em nada. A referência guarda o documento como ele chegou; enquanto o
     que o Puck devolve for igual, não há o que salvar.

     Desde 31/10/2026 a gravação é de RASCUNHO, e não da página no ar: quem
     leva ao ar é o "Publicar". Ver o cabeçalho deste arquivo. */
  const cadastroRef = useRef({});
  /* A versão do rascunho em que esta tela se baseia (0 = não há rascunho). */
  const versaoRef = useRef(0);
  /* O documento mais recente que o Puck entregou: o cadastro editado na
     prancheta não muda o documento, e precisa de um para ir junto. */
  const ultimoDocumento = useRef(null);
  const gravarRef = useRef(null);

  /* ── A TRAVA: SÓ GRAVA DEPOIS DE UMA AÇÃO DE VERDADE ─────────────────────

     A primeira versão comparava o documento com ele mesmo na abertura e só
     salvava quando diferisse. MEDIDO, não funcionou: o Puck normaliza o
     documento ao carregar — e o `resolveData` de cada peça roda logo depois —,
     então um segundo `onChange` chega com um documento diferente sem ninguém
     ter tocado em nada. Toda imobiliária que apenas ABRISSE o editor era
     migrada em silêncio.

     `onAction` é o sinal certo, porque ele só existe quando alguém agiu:
     arrastar, digitar num campo, excluir uma peça — e também o despacho da
     nossa ponte de edição no lugar. Enquanto ninguém agiu, não há o que
     salvar, por mais que o documento mude de forma por dentro. */
  /* A regra (a trava, uma gravação de cada vez, a falha que não se perde) mora
     em `puck/autosave.js`, que tem teste. Aqui só se liga. */
  const autosave = useMemo(() => criarAutosave({
    gravar: (dados) => gravarRef.current(dados),
    aoMudarSituacao: setSituacao,
  }), []);
  const armar = useCallback(() => autosave.armar(), [autosave]);
  const aoMudar = useCallback((dados) => {
    ultimoDocumento.current = dados;
    autosave.aoMudar(dados);
  }, [autosave]);

  useLayoutEffect(() => {
    /* ── SEM OBSERVADOR NO CORPO ───────────────────────────────────────────
       A primeira versão media a altura de novo a cada mudança do `body`, para
       acompanhar a faixa de teste que entra depois do carregamento. Só que
       nesta rota a faixa não existe: o `AdminLayout` reconhece o editor de
       vitrine e não desenha cabeçalho nem faixa. O observador ficou observando
       o que não muda.

       E ele era um risco real: a altura que este efeito escreve entra no
       `body`, o `body` avisa o observador, o observador mede de novo. O guarda
       de 1px segura isso enquanto a conta for estável — mas basta uma barra de
       rolagem aparecendo e sumindo para o par oscilar, e o Puck recalcula o
       zoom automático a cada redimensionamento do quadro. O resultado é a
       prancheta pulsando sem parar.

       Não consegui reproduzir isso aqui; o que dá para afirmar é que o laço era
       POSSÍVEL e que o observador não tinha mais função. Ficou a medição no
       carregamento e no redimensionamento da janela, que é o que basta. */
    const medir = () => {
      const topo = caixa.current?.getBoundingClientRect().top ?? 0;
      const nova = Math.max(480, Math.round(window.innerHeight - topo));
      setAltura((antiga) => (Math.abs(antiga - nova) > 1 ? nova : antiga));
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [carga.estado]);

  /* ── NÃO SE MEXE NO BODY. NENHUMA DAS DUAS FORMAS ────────────────────────

     A ideia era travar a rolagem da janela de fora enquanto o editor estivesse
     aberto. Duas tentativas, as duas erradas pelo mesmo motivo:

       classe no body    o Puck ESPELHA o className do body hospedeiro no body
                         do iframe da prévia. A regra atravessou e travou a
                         rolagem da página sendo editada.
       style inline      ele espelha o atributo style também. Mesmo defeito,
                         disfarce diferente — e essa segunda custou uma medição
                         para ser encontrada, porque o CSS estava limpo.

     A trava não era necessária, e é essa a conclusão: a caixa do editor já é
     dimensionada para o que sobra da janela (ver acima), então não há nada para
     rolar do lado de fora. O que sobrava era um cinto sobre uma calça que já
     servia — e o cinto estava estrangulando a prévia.

     Fica o aviso para quem for mexer aqui: dentro do editor, o body do iframe é
     um espelho do body da aplicação. O que se pendurar num não fica só nele. */

  /* O tour desta tela aponta para `data-tour`, como o das outras onze — e quem
     desenha a barra e os painéis agora é o Puck, que não tem onde pôr o
     atributo. O carimbo vai depois do editor montar; ver `puck/alvosDoTour`.

     O atraso não é chute: o Puck monta a prévia num iframe e os painéis entram
     depois do primeiro quadro. Marcar cedo demais não acha nada, e o sintoma
     seria um tour com passos faltando — silencioso. */
  /* As sete fontes da vitrine, no documento hospedeiro — o Puck espelha os
     estilos dele dentro do iframe da prévia. Sem isto, trocar a fonte no
     inspetor não mudava nada visível: a família era aplicada e o navegador caía
     no padrão, porque a família não existia ali. A vitrine pública já faz esta
     mesma chamada. */
  useEffect(() => { loadShowcaseFonts(); }, []);

  /* ── A SAÍDA DA PÁGINA ─────────────────────────────────────────────────────
     O autosave espera um segundo de silêncio. Quem fechava a aba nesse
     segundo, ou depois de uma gravação que falhou, perdia a última alteração
     sem aviso nenhum. Agora:

       · fechar/recarregar a aba com algo não salvo pede confirmação
         (`beforeunload`: o navegador mostra o aviso dele, o texto não é nosso);
       · o que estiver pendente vai na saída com `keepalive`, que o navegador
         termina mesmo com a aba fechando — inclusive ao sair do editor por um
         link do próprio painel (o desmonte).

     `keepalive` tem teto de 64 kB por pedido; uma página maior que isso vai
     sem ele, no melhor esforço. */
  const enviarNaSaidaRef = useRef(null);
  enviarNaSaidaRef.current = () => {
    const dados = autosave.pendente;
    if (!dados || autosave.situacao === "pausado") return;
    const corpo = corpoDoRascunho(dados);
    const pequeno = JSON.stringify(corpo).length < 60_000;
    autosave.descartar();
    api.salvarRascunhoDaVitrine(tenantSlug, corpo, { keepalive: pequeno }).catch(() => {});
  };
  useEffect(() => {
    const aoSair = () => enviarNaSaidaRef.current?.();
    const aoFechar = (e) => {
      if (!autosave.temPendencia()) return undefined;
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("pagehide", aoSair);
    window.addEventListener("beforeunload", aoFechar);
    return () => {
      window.removeEventListener("pagehide", aoSair);
      window.removeEventListener("beforeunload", aoFechar);
      aoSair(); // saiu do editor sem fechar a aba
    };
  }, [autosave]);

  useEffect(() => { setVersoesLocais(lerHistorico(carga.tenant?.id)); }, [carga.tenant?.id]);

  const lerVersoes = useCallback(() => {
    api.listarVersoesDaVitrine(tenantSlug)
      .then((r) => setVersoes(r?.versoes || []))
      .catch(() => setVersoes([]));
  }, [tenantSlug]);
  useEffect(() => { if (carga.estado === "pronto") lerVersoes(); }, [carga.estado, lerVersoes]);

  useEffect(() => {
    if (carga.estado !== "pronto") return undefined;
    let desfazer = null;
    const t = setTimeout(() => { desfazer = marcarAlvosDoTour(); }, 1200);
    return () => { clearTimeout(t); desfazer?.(); };
  }, [carga.estado]);

  useEffect(() => {
    let vivo = true;
    setCarga({ estado: "carregando" });

    /* O que está no ar vem da vitrine pública; o rascunho, da rota do editor.
       Se o rascunho não puder ser lido, a tela NÃO abre: abrir sem ele faria o
       autosave criar outro por cima do que existe. */
    Promise.all([api.getPublicShowcase(tenantSlug), api.lerRascunhoDaVitrine(tenantSlug)])
      .then(([resposta, doEditor]) => {
        if (!vivo) return;
        const rascunho = doEditor?.rascunho || null;
        const cru = resposta?.tenant?.showcaseConfig;
        /* Já publicado pelo Puck? Então o documento GRAVADO é a verdade, e
           traduzir de novo seria jogar fora tudo o que a pessoa editou aqui —
           o formato antigo continua no banco justamente para não ser perdido,
           não para ser reimportado por cima do novo a cada abertura. */
        const jaMigrada = normalizeShowcaseConfig(cru).puck;
        const { data, avisos } = traduzirParaPuck(cru);

        /* A raiz nasce com o cadastro ATUAL. Sem isto os cinco campos
           apareceriam vazios num editor de uma imobiliária que tem logo,
           slogan e telefone cadastrados — e a leitura seria de que o dado
           sumiu, não de que o campo é novo. */
        const semente = {};
        for (const campo of CAMPOS_DO_CADASTRO) {
          if (resposta?.tenant?.[campo]) semente[campo] = resposta.tenant[campo];
        }
        /* Com rascunho, é ELE que se edita: é o trabalho que ainda não foi ao
           ar. O cadastro editado nele (manchete, WhatsApp…) também volta, para
           a prancheta mostrar o que a pessoa escreveu e não o que está no ar. */
        const documento = rascunho?.documento ? structuredClone(rascunho.documento) : (jaMigrada || data);
        documento.root = { ...documento.root, props: { ...semente, ...(documento.root?.props || {}) } };
        cadastroRef.current = { ...(rascunho?.cadastro || {}) };
        versaoRef.current = rascunho?.versao || 0;
        ultimoDocumento.current = documento;
        autosave.reiniciar();
        setTemRascunho(Boolean(rascunho));
        setConflito(null);

        setCarga({
          estado: "pronto",
          configCru: cru && typeof cru === "object" ? cru : {},
          data: documento,
          avisos: jaMigrada || rascunho ? [] : avisos,
          noAr: Boolean(jaMigrada),
          rascunhoDe: rascunho ? { quando: rascunho.atualizadoEm, quem: rascunho.atualizadoPorNome } : null,
          tenant: resposta?.tenant ? { ...resposta.tenant, ...(rascunho?.cadastro || {}) } : null,
          properties: resposta?.properties || [],
          vitrine: resposta?.vitrine || null,
        });
      })
      .catch((erro) => {
        if (!vivo) return;
        setCarga({ estado: "erro", mensagem: erro?.message || "Não consegui carregar esta vitrine." });
      });

    return () => { vivo = false; };
  }, [tenantSlug, recarga, autosave]);

  /* `metadata` é o que chega ao `resolveData` de cada componente e ao `root`.
     Vai dentro de um `useMemo` porque um objeto novo a cada render faria o Puck
     re-resolver os dados de todos os componentes sem nada ter mudado. */
  const metadata = useMemo(
    () => ({
      tenantSlug,
      dadosDaVitrine: carga.vitrine || null,
      /* O bloco que os blocos fixos consomem por contexto. Na prancheta ele traz
         a imobiliária e o acervo REAIS: um editor que desenha a grade com
         imóveis de mentira mostra uma página que não existe, e a pessoa só
         descobre a diferença depois de publicar. */
      aoEditarCadastro: (campo, valor) => {
        cadastroRef.current = { ...cadastroRef.current, [campo]: valor };
        /* Editar o cadastro é ação de gente, e não muda o documento: sem isto
           uma alteração só na manchete nunca seria gravada. Antes ela só
           ARMAVA o autosave e esperava a próxima mudança do documento, que
           podia não vir — a manchete se perdia ao fechar a aba. */
        autosave.armar();
        if (ultimoDocumento.current) autosave.aoMudar(ultimoDocumento.current);
      },
      pagina: {
        tenant: carga.tenant ? { ...carga.tenant, name: carga.tenant.name || tenantSlug } : null,
        tenantSlug,
        properties: carga.properties || [],
        whatsappHref: linkWhatsApp(carga.tenant || {}),
        carregando: false,
        erro: "",
      },
    }),
    [tenantSlug, carga.vitrine, carga.tenant, carga.properties, autosave],
  );

  /* ── O RASCUNHO ───────────────────────────────────────────────────────────
     O corpo de uma gravação: o documento, as opções de página que a vitrine lê
     de fora dele, e o cadastro editado na prancheta. A conta das opções e do
     cadastro é feita AQUI, e o servidor só confere a lista de chaves — um
     segundo cálculo lá divergiria no primeiro controle novo. */
  function corpoDoRascunho(dados) {
    return {
      documento: { content: dados.content, root: dados.root || {} },
      opcoes: opcoesDaPagina(dados.root),
      /* O inspetor da Página vem depois do `cadastroRef` de propósito: se a
         pessoa mexeu nos dois lugares, o inspetor é a escolha mais recente. */
      cadastro: { ...cadastroRef.current, ...doCadastro(dados.root) },
      versao: versaoRef.current,
    };
  }

  async function gravarRascunho(dados) {
    try {
      const r = await api.salvarRascunhoDaVitrine(tenantSlug, corpoDoRascunho(dados));
      versaoRef.current = r.versao;
      setTemRascunho(true);
      setRecado("");
    } catch (erro) {
      if (erro?.status === 409) {
        autosave.pausar();
        setConflito(erro.message);
        setRecado("");
      }
      throw erro;
    }
  }
  gravarRef.current = gravarRascunho;

  /* ── PUBLICAR ─────────────────────────────────────────────────────────────
     Primeiro garante que o rascunho está gravado (inclusive o que ainda
     esperava o segundo de silêncio), depois pede ao servidor para levá-lo ao
     ar. Quem mescla no `showcaseConfig` é o servidor, com o que estiver no
     banco naquela hora — ver o cabeçalho deste arquivo. */
  async function publicar() {
    if (publicando) return;
    setPublicando(true);
    try {
      const salvo = await autosave.agora();
      if (!salvo) { setRecado("Não consegui salvar o rascunho, então nada foi publicado."); return; }
      if (!versaoRef.current) { setRecado("Não há alterações para publicar."); return; }
      await api.publicarVitrine(tenantSlug, versaoRef.current);
      versaoRef.current = 0;
      setTemRascunho(false);
      setCarga((antes) => ({ ...antes, noAr: true, rascunhoDe: null }));
      lerVersoes();
      setRecado("Publicado. A vitrine já mostra esta versão.");
    } catch (erro) {
      if (erro?.status === 409) { autosave.pausar(); setConflito(erro.message); setRecado(""); }
      else setRecado(erro?.message || "Não consegui publicar.");
    } finally {
      setPublicando(false);
    }
  }

  async function descartarRascunho() {
    if (!window.confirm("Descartar as alterações não publicadas? A página volta a ser a que está no ar.")) return;
    autosave.descartar();
    try {
      await api.descartarRascunhoDaVitrine(tenantSlug);
      setRecarga((n) => n + 1);
    } catch (erro) {
      setRecado(erro?.message || "Não consegui descartar o rascunho.");
    }
  }

  /* Troca o documento inteiro e marca como mexido, para o autosave gravar.
     Sem armar, aplicar um modelo ficaria só na tela até a pessoa mexer em
     outra coisa — e ela publicaria achando que já estava salvo. */
  function trocarDocumento(documento) {
    autosave.armar();
    ultimoDocumento.current = documento;
    autosave.aoMudar(documento);
    setCarga((antes) => ({ ...antes, data: documento, chave: (antes.chave || 0) + 1 }));
  }

  function aplicarModelo(modelo) {
    /* O modelo é um `showcaseConfig`, e vira documento pelo MESMO tradutor da
       abertura. Um segundo caminho produziria páginas com estrutura diferente
       conforme a origem. */
    const { data } = traduzirParaPuck({ ...carga.configCru, ...modelo.config });
    trocarDocumento(data);
    setGaveta(null);
    setRecado(`Modelo "${modelo.name}" aplicado no rascunho. Confira e publique.`);
  }

  /* Restaurar NÃO publica: a versão volta como rascunho, e a pessoa confere. */
  async function restaurarVersao(versao) {
    try {
      const { versao: completa } = await api.lerVersaoDaVitrine(tenantSlug, versao.id);
      cadastroRef.current = { ...cadastroRef.current, ...(completa.cadastro || {}) };
      trocarDocumento(structuredClone(completa.documento));
      setGaveta(null);
      setRecado(`Versão de ${quandoFoi(new Date(versao.publicadoEm).getTime())} restaurada no rascunho. Publique para valer no ar.`);
    } catch (erro) {
      setRecado(erro?.message || "Não consegui abrir esta versão.");
    }
  }

  /* As antigas, do localStorage: só o documento (o cadastro não era guardado). */
  function restaurarVersaoLocal(versao) {
    const documento = documentoDaVersao(versao);
    if (!documento) { setRecado("Esta versão está ilegível."); return; }
    trocarDocumento(documento);
    setGaveta(null);
    setRecado(`Versão de ${quandoFoi(versao.quando)} restaurada no rascunho. Publique para valer no ar.`);
  }

  function recomecar() {
    /* Volta ao que o formato de coordenadas descreve — que continua gravado
       ao lado do documento, intocado. Não é 'apagar tudo': é desfazer a
       edição feita no editor novo, que é o arrependimento real. */
    const { data } = traduzirParaPuck(carga.configCru);
    trocarDocumento(data);
    setRecado("O rascunho voltou ao ponto de partida. Publique para valer no ar.");
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(`${baseDaVitrine(carga.tenant)}`);
      setLinkCopiado(true);
      setTimeout(() => setLinkCopiado(false), 2000);
    } catch {
      setRecado("O navegador não deixou copiar. O endereço é " + baseDaVitrine(carga.tenant));
    }
  }

  const ACOES = [
    { rotulo: linkCopiado ? "Link copiado" : "Copiar link da vitrine", ajuda: baseDaVitrine(carga.tenant),
      Icone: ICONES.LinkSimple, acao: copiarLink },
    { rotulo: "Modelos de página", ajuda: "Trocar a montagem inteira por uma pronta",
      Icone: ICONES.Layout, acao: () => setGaveta("modelos") },
    { rotulo: "Histórico de versões", ajuda: versoes.length ? `${versoes.length} publicação(ões) guardada(s)` : "Nada publicado ainda",
      Icone: ICONES.ClockCounterClockwise, desativado: !versoes.length && !versoesLocais.length, acao: () => setGaveta("historico") },
    ...(temRascunho ? [{ rotulo: "Descartar rascunho", ajuda: "Volta à página que está no ar", perigo: true,
      Icone: ICONES.ArrowCounterClockwise, acao: () => void descartarRascunho() }] : []),
    { rotulo: "Recomeçar", ajuda: "Volta ao ponto de partida desta vitrine", perigo: true,
      Icone: ICONES.ArrowCounterClockwise, acao: recomecar },
  ];

  if (carga.estado === "erro") {
    return (
      <div className="puck-aviso-tela">
        <p><strong>Não deu.</strong> {carga.mensagem}</p>
      </div>
    );
  }

  /* ── ESQUELETO, E NÃO "Carregando…" ──────────────────────────────────────
     O MESMO do editor clássico. A regra é a da vitrine: mostrar a FORMA do que
     vem — três colunas com o peso certo —, para nada pular de lugar quando o
     conteúdo real entra. Uma frase centralizada não diz nada sobre o que está
     chegando, e some de um quadro para o outro deixando a tela dar um salto.

     Reusar em vez de escrever um segundo: as duas telas carregam a mesma coisa
     (rail, prancheta, inspetor), e dois esqueletos divergiriam no primeiro
     ajuste de largura. */
  /* Dentro da MESMA caixa do editor, e não solto na página. Fora dela o
     esqueleto ficava sem os tokens da paleta (shimmer branco sobre painel
     branco, invisível), sem altura e sem o deslocamento que acompanha a barra
     lateral — e a tela dava um salto quando o editor real entrava, que é
     justamente o que um esqueleto existe para evitar. */
  if (carga.estado !== "pronto") {
    return (
      <div ref={caixa} className="puck-caixa" style={{ height: altura }}>
        <EditorEsqueleto />
      </div>
    );
  }

  return (
    <div ref={caixa} className="puck-caixa" style={{ height: altura }}>
      {/* As fotos dos imóveis chegam ao campo de imagem do banner por aqui —
          os mesmos imóveis que a prancheta já desenha. Ver `CampoImagemDoBanner`. */}
      <FotosDoAcervo imoveis={carga.properties}>
      <Puck
        config={configVitrine}
        data={carga.data}
        /* `key` no slug: trocar de imobiliária precisa REMONTAR o editor. O
           Puck guarda o documento em estado próprio a partir do `data` inicial,
           então trocar a prop sozinha deixaria a página anterior na tela. */
        key={`${tenantSlug}-${carga.chave || 0}`}
        /* A interface do Puck em português, como todo o resto do produto.
           Ver `puck/idioma.js`. */
        /* ── AS PEÇAS NÃO TROCAM DE LUGAR ENQUANTO SE ARRASTA ─────────────
           No modo de fábrica ("auto"), passar da metade da altura de uma peça
           já a faz trocar de posição ao vivo. Para reordenar isso é ótimo; para
           mirar a LATERAL de alguém é péssimo — o alvo escapa justamente
           quando se chega perto, e foi o que tornou o gesto de pôr lado a lado
           difícil de acertar.

           "static" mostra uma linha indicando onde a peça vai cair e deixa
           todo mundo parado até soltar. O alvo fica onde está, e a prévia de
           colunas tem sobre o que se desenhar. */
        dnd={{ behavior: "static" }}
        dictionary={DICIONARIO_PT}
        viewports={TELAS}
        /* Acrescenta "lado a lado" e "desagrupar" à barra da peça, sem tirar o
           que o Puck já desenha ali. Ver `puck/AcoesDaPeca`. */
        overrides={SOBRESCRITAS}
        headerTitle="Editar Página"
        metadata={metadata}
        /* O `children` que o Puck entrega aqui é o botão "Publicar" DELE, e
           não é usado: o nosso, mais abaixo, sabe se há rascunho a publicar. */
        renderHeaderActions={() => (
          <>
            {/* Não desenha nada: é o vigia que apaga seção que ficou sem peça
                dentro. Mora aqui porque precisa do `dispatch`, que só existe
                dentro do provedor do Puck. Ver `PodarSecoesVazias`. */}
            <PodarSecoesVazias />
            {/* Aparece só com duas ou mais peças escolhidas por ctrl/shift.
                Também não desenha nada no cabeçalho: ela é fixa na tela. */}
            <BarraDaSelecao />
            <MenuDoEditor itens={ACOES} />
            {/* O "Publicar" voltou (31/10/2026), agora com sentido: o autosave
                grava um RASCUNHO, e só este botão leva ao ar. Apagado quando
                não há nada a publicar, para a pessoa saber que o ar está em dia. */}
            <button
              type="button"
              className="puck-publicar"
              onClick={() => void publicar()}
              disabled={publicando || Boolean(conflito) || (!temRascunho && situacao === "em-dia")}
              title={temRascunho || situacao !== "em-dia" ? "Levar as alterações para a vitrine pública" : "Nada a publicar: a vitrine já está como esta página"}
            >
              {publicando ? "Publicando…" : "Publicar"}
            </button>
          </>
        )}
        onAction={armar}
        onChange={aoMudar}
      />
      </FotosDoAcervo>

      {/* Outra aba ou outra pessoa gravou por cima. A tela para de gravar e
          oferece recarregar: insistir apagaria o trabalho do outro. */}
      {conflito ? (
        <div className="puck-conflito" role="alert">
          <p><strong>{conflito}</strong> O que você mudou nesta aba depois disso não foi salvo.</p>
          <button type="button" onClick={() => setRecarga((n) => n + 1)}>Recarregar</button>
        </div>
      ) : null}

      {gaveta ? (
        <div className="puck-gaveta" role="dialog" aria-label={gaveta === "modelos" ? "Modelos de página" : "Histórico de versões"}>
          <header className="puck-gaveta__topo">
            <strong>{gaveta === "modelos" ? "Modelos de página" : "Histórico de versões"}</strong>
            <button type="button" onClick={() => setGaveta(null)} aria-label="Fechar">×</button>
          </header>

          {gaveta === "modelos" ? (
            <div className="puck-gaveta__corpo">
              <p>Trocam a montagem inteira. O que você já escreveu nos textos se perde — publique antes se quiser guardar.</p>
              {BUILDER_TEMPLATES.map((modelo) => (
                <button key={modelo.id} type="button" className="puck-gaveta__item puck-gaveta__item--modelo" onClick={() => aplicarModelo(modelo)}>
                  {/* A página em miniatura; passe o mouse para ver no celular. */}
                  <PreviaDoModelo tpl={modelo} altura={200} />
                  <strong>{modelo.name}</strong>
                  <em>{modelo.desc}</em>
                </button>
              ))}
            </div>
          ) : (
            <div className="puck-gaveta__corpo">
              <p>Uma por publicação, guardadas na sua conta: aparecem em qualquer computador. Restaurar traz a versão para o rascunho, sem publicar.</p>
              {versoes.map((versao) => (
                <button key={versao.id} type="button" className="puck-gaveta__item" onClick={() => void restaurarVersao(versao)}>
                  <strong>{quandoFoi(new Date(versao.publicadoEm).getTime())}</strong>
                  <em>{versao.publicadoPorNome ? `Publicada por ${versao.publicadoPorNome} · ` : ""}Restaurar esta versão</em>
                </button>
              ))}
              {versoesLocais.length ? (
                <>
                  <p className="puck-gaveta__sub">Antigas, guardadas só neste navegador:</p>
                  {versoesLocais.map((versao) => (
                    <button key={versao.quando} type="button" className="puck-gaveta__item" onClick={() => restaurarVersaoLocal(versao)}>
                      <strong>{quandoFoi(versao.quando)}</strong>
                      <em>Restaurar esta versão</em>
                    </button>
                  ))}
                </>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {/* A barra de situação. Responde as duas perguntas que importam: o que
          está NO AR, e se o que estou vendo já foi salvo. */}
      <div className={`puck-situacao${temRascunho || situacao !== "em-dia" ? " puck-situacao--rascunho" : carga.noAr ? " puck-situacao--no-ar" : ""}`}>
        <span className="puck-situacao__ponto" aria-hidden />
        <span>
          {temRascunho || situacao !== "em-dia"
            ? "Alterações não publicadas. A vitrine pública continua como estava até você publicar."
            : carga.noAr
              ? "Publicado. A vitrine pública está igual a esta página."
              : "A vitrine pública ainda usa o formato antigo. Ela passa a desenhar por esta página quando você publicar."}
        </span>
        {situacao === "salvando" ? <em className="puck-situacao__recado">Salvando rascunho…</em>
          : situacao === "falhou" ? <em className="puck-situacao__recado puck-situacao__recado--erro">Não consegui salvar. Tento de novo na próxima alteração.</em>
            : recado ? <em className="puck-situacao__recado">{recado}</em> : null}
      </div>

    </div>
  );
}
