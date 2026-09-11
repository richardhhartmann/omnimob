import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Puck } from "@puckeditor/core";
/* Sem `import "@puckeditor/core/puck.css"`: da versão 0.22 em diante o Puck
   injeta o próprio estilo, e o import faz ele avisar no console que o pulou.
   Ficou aqui na primeira tentativa porque é o que a documentação antiga manda —
   foi o console da biblioteca que corrigiu. */
import { api } from "../api";
import { normalizeShowcaseConfig } from "../utils/showcaseConfig";
import { linkWhatsApp } from "../components/showcase/tema.js";
import { loadShowcaseFonts } from "../utils/showcaseFonts";
import { configVitrine } from "../puck/configVitrine.jsx";
import { DICIONARIO_PT } from "../puck/idioma.js";
import { BarraDaPeca } from "../puck/AcoesDaPeca.jsx";
import { traduzirParaPuck } from "../puck/traduzirConfig";
import { marcarAlvosDoTour } from "../puck/alvosDoTour.js";
import { ICONES, MenuDoEditor } from "../puck/MenuDoEditor.jsx";
import { PodarSecoesVazias } from "../puck/PodarSecoesVazias.jsx";
import { CartaoDaGaveta } from "../puck/PreviaDaPeca.jsx";
import { BarraDaSelecao } from "../puck/BarraDaSelecao.jsx";
import { documentoDaVersao, guardarVersao, lerHistorico, quandoFoi } from "../puck/historicoDeVersoes.js";
import { BUILDER_TEMPLATES } from "../components/builder/data/templates";
import { baseDaVitrine } from "../utils/enderecoVitrine";
import { EditorEsqueleto } from "../components/builder/EditorEsqueleto.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   O EDITOR DE VITRINE.

   É esta a tela de "editar página", para todo mundo — não há mais dois editores
   a escolher. Quem nunca migrou entra e vê a própria vitrine já TRADUZIDA de
   coordenadas para árvore, pronta para editar; quem já migrou vê o documento
   gravado. O clássico continua existindo em `/editar/classico`, como volta.

   ── A ABERTURA NÃO GRAVA ──

   A tradução acontece toda vez que a tela abre, e por isso o autosave tem uma
   trava explícita: sem ela, abrir o editor e não mexer em nada já migraria a
   imobiliária. Ver `aoMudar`.

   ── O QUE É GRAVADO, E ONDE ──

   Uma chamada só, com as duas coisas que a prancheta edita:

     showcaseConfig.puck   o documento — peças, ordem, textos, estilos de bloco
     colunas do Tenant     manchete, descrição, e-mail, WhatsApp

   Os segundos parecem documento e não são: são o cadastro da imobiliária, o
   mesmo que alimenta as Configurações e o feed dos portais. Ver o cabeçalho de
   `puck/PonteDeEdicao`.

   ── A VOLTA É REAL ──

   O formato antigo (`layout`, `mobileLayout`, `widgets`) fica gravado, intocado,
   ao lado do novo. "Voltar ao editor antigo" apaga UMA chave e leva para o
   clássico — e a página de antes volta inteira, porque nunca chegou a sair.

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
const SOBRESCRITAS = { actionBar: BarraDaPeca, drawerItem: CartaoDaGaveta };

export function VitrinePuckPage() {
  const { tenantSlug } = useParams();
  const navegar = useNavigate();
  const [carga, setCarga] = useState({ estado: "carregando" });
  const [avisosAbertos, setAvisosAbertos] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [recado, setRecado] = useState("");
  /* Qual gaveta está aberta: "modelos", "historico" ou nenhuma. Uma variável
     em vez de dois booleanos porque as duas nunca convivem — e dois
     booleanos permitem o estado impossível de ambas abertas. */
  const [gaveta, setGaveta] = useState(null);
  const [versoes, setVersoes] = useState([]);
  const [linkCopiado, setLinkCopiado] = useState(false);

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

     A gravação é uma só e serve às duas coisas — não existe rascunho separado
     da página no ar. Foi assim que o editor antigo sempre funcionou, e ter dois
     estados publicáveis exigiria uma conversa sobre versões que este produto
     ainda não tem. */
  const cadastroRef = useRef({});
  const temporizador = useRef(null);
  const publicarRef = useRef(null);

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
  const armado = useRef(false);
  const armar = useCallback(() => { armado.current = true; }, []);

  const aoMudar = useCallback((dados) => {
    if (!armado.current) return;
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => publicarRef.current?.(dados, { silencioso: true }), 1000);
  }, []);

  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current); }, []);

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

  useEffect(() => { setVersoes(lerHistorico(carga.tenant?.id)); }, [carga.tenant?.id]);

  useEffect(() => {
    if (carga.estado !== "pronto") return undefined;
    let desfazer = null;
    const t = setTimeout(() => { desfazer = marcarAlvosDoTour(); }, 1200);
    return () => { clearTimeout(t); desfazer?.(); };
  }, [carga.estado]);

  useEffect(() => {
    let vivo = true;
    setCarga({ estado: "carregando" });

    api
      .getPublicShowcase(tenantSlug)
      .then((resposta) => {
        if (!vivo) return;
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
        const documento = jaMigrada || data;
        documento.root = { ...documento.root, props: { ...semente, ...(documento.root?.props || {}) } };

        setCarga({
          estado: "pronto",
          configCru: cru && typeof cru === "object" ? cru : {},
          data: documento,
          avisos: jaMigrada ? [] : avisos,
          noAr: Boolean(jaMigrada),
          tenant: resposta?.tenant || null,
          properties: resposta?.properties || [],
          vitrine: resposta?.vitrine || null,
        });
      })
      .catch((erro) => {
        if (!vivo) return;
        setCarga({ estado: "erro", mensagem: erro?.message || "Não consegui carregar esta vitrine." });
      });

    return () => { vivo = false; };
  }, [tenantSlug]);

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
        /* Editar o cadastro é ação de gente, e não muda o documento — sem isto
           uma alteração só na manchete nunca seria gravada. */
        armado.current = true;
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
    [tenantSlug, carga.vitrine, carga.tenant, carga.properties],
  );

  /* ── PUBLICAR ─────────────────────────────────────────────────────────────
     Grava o documento do Puck DENTRO do `showcaseConfig`, ao lado do formato
     antigo — que não é tocado. É o que torna a migração reversível: enquanto
     `layout`, `mobileLayout` e `widgets` seguirem gravados, "Voltar ao editor
     antigo" é apagar uma chave, e a página de antes volta inteira.

     Espalha o config CRU, e não o normalizado: normalizar aqui reescreveria o
     documento de quem só quis apertar Publish — e uma migração que muda o que
     não foi pedido é como se perde a confiança num beta. */
  async function publicar(dados, { silencioso = false } = {}) {
    if (!silencioso) setSalvando(true);
    setRecado(silencioso ? "Salvando…" : "");
    try {
      await api.updateTenantProfile(tenantSlug, {
        /* O cadastro vai JUNTO, na mesma chamada. Manchete, e-mail e WhatsApp
           são editados na prancheta como qualquer outro texto, mas são colunas
           do `Tenant` e não do documento — ver o cabeçalho de `PonteDeEdicao`.
           Duas chamadas separadas deixariam meio salvamento no ar se a segunda
           falhasse. */
        ...cadastroRef.current,
        /* E o que foi editado no inspetor da Página. Vem depois do
           `cadastroRef` de propósito: se a pessoa mexeu nos dois lugares, o
           campo do inspetor é a escolha mais recente e explícita. */
        ...doCadastro(dados.root),
        showcaseConfig: {
          ...carga.configCru,
          /* As opções da página VOLTAM para o nível de cima do showcaseConfig, e
             não ficam só dentro do documento: quem lê tema, fonte e cores na
             vitrine publicada é `classeDeAparencia`/`estiloDoTema`, que
             recebem o config normalizado — não o documento do Puck. Deixá-las
             só lá dentro faria o controle funcionar no editor e não surtir
             efeito nenhum no ar. */
          ...opcoesDaPagina(dados.root),
          puck: { content: dados.content, root: dados.root || {} },
        },
      });
      setCarga((antes) => ({ ...antes, noAr: true, configCru: { ...antes.configCru, puck: dados } }));
      /* Um instantâneo por publicação. O desfazer do Puck só alcança a sessão
         aberta; isto é o que permite voltar a algo de ontem. */
      setVersoes(guardarVersao(carga.tenant?.id, dados));
      setRecado(silencioso ? "Salvo." : "Publicado. A vitrine pública já desenha por este documento.");
    } catch (erro) {
      setRecado(erro?.message || "Não consegui salvar.");
    } finally {
      if (!silencioso) setSalvando(false);
    }
  }

  async function voltarAoAntigo() {
    setSalvando(true);
    setRecado("");
    try {
      /* A chave é REMOVIDA, não zerada. Mandar `puck: null` não apagou o
         documento numa verificação contra o banco de dev — e o botão que
         promete devolver a página antiga falhando em silêncio é pior que não
         existir. Ausência é o que a normalização já entende como "não migrada",
         então é ela que se manda. */
      const { puck, ...semPuck } = carga.configCru;
      await api.updateTenantProfile(tenantSlug, { showcaseConfig: semPuck });
      setCarga((antes) => ({ ...antes, noAr: false, configCru: semPuck }));
      setRecado("A vitrine voltou ao editor antigo. Nada do que estava lá foi perdido.");
      /* E leva junto: apagar o documento sem mostrar onde editar agora deixaria
         a pessoa numa tela que acabou de deixar de valer. */
      navegar("/vitrine/" + tenantSlug + "/editar/classico", { replace: true });
    } catch (erro) {
      setRecado(erro?.message || "Não consegui voltar.");
    } finally {
      setSalvando(false);
    }
  }

  publicarRef.current = publicar;

  /* Troca o documento inteiro e marca como mexido, para o autosave gravar.
     Sem armar, aplicar um modelo ficaria só na tela até a pessoa mexer em
     outra coisa — e ela publicaria achando que já estava salvo. */
  function trocarDocumento(documento) {
    armado.current = true;
    setCarga((antes) => ({ ...antes, data: documento, chave: (antes.chave || 0) + 1 }));
  }

  function aplicarModelo(modelo) {
    /* O modelo é um `showcaseConfig`, e vira documento pelo MESMO tradutor da
       abertura. Um segundo caminho produziria páginas com estrutura diferente
       conforme a origem. */
    const { data } = traduzirParaPuck({ ...carga.configCru, ...modelo.config });
    trocarDocumento(data);
    setGaveta(null);
    setRecado(`Modelo "${modelo.name}" aplicado. Nada foi gravado ainda — confira e publique.`);
  }

  function restaurarVersao(versao) {
    const documento = documentoDaVersao(versao);
    if (!documento) { setRecado("Esta versão está ilegível."); return; }
    trocarDocumento(documento);
    setGaveta(null);
    setRecado(`Versão de ${quandoFoi(versao.quando)} restaurada. Publique para valer no ar.`);
  }

  function recomecar() {
    /* Volta ao que o formato de coordenadas descreve — que continua gravado
       ao lado do documento, intocado. Não é 'apagar tudo': é desfazer a
       edição feita no editor novo, que é o arrependimento real. */
    const { data } = traduzirParaPuck(carga.configCru);
    trocarDocumento(data);
    setRecado("A página voltou ao ponto de partida. Publique para valer no ar.");
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
    { rotulo: "Histórico de versões", ajuda: versoes.length ? `${versoes.length} guardada(s) neste navegador` : "Nada guardado ainda",
      Icone: ICONES.ClockCounterClockwise, desativado: !versoes.length, acao: () => setGaveta("historico") },
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
        /* Acrescenta "lado a lado" e "desagrupar" à barra da peça, sem tirar o
           que o Puck já desenha ali. Ver `puck/AcoesDaPeca`. */
        overrides={SOBRESCRITAS}
        headerTitle="Editar Página"
        metadata={metadata}
        renderHeaderActions={({ children }) => (
          <>
            {/* Não desenha nada: é o vigia que apaga seção que ficou sem peça
                dentro. Mora aqui porque precisa do `dispatch`, que só existe
                dentro do provedor do Puck. Ver `PodarSecoesVazias`. */}
            <PodarSecoesVazias />
            {/* Aparece só com duas ou mais peças escolhidas por ctrl/shift.
                Também não desenha nada no cabeçalho: ela é fixa na tela. */}
            <BarraDaSelecao />
            <MenuDoEditor itens={ACOES} />
            {children}
          </>
        )}
        onAction={armar}
        onChange={aoMudar}
        onPublish={publicar}
      />

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
                <button key={modelo.id} type="button" className="puck-gaveta__item" onClick={() => aplicarModelo(modelo)}>
                  <strong>{modelo.name}</strong>
                  <em>{modelo.desc}</em>
                </button>
              ))}
            </div>
          ) : (
            <div className="puck-gaveta__corpo">
              <p>Guardadas neste navegador, uma por publicação. Não saem daqui e não vão para o banco.</p>
              {versoes.map((versao) => (
                <button key={versao.quando} type="button" className="puck-gaveta__item" onClick={() => restaurarVersao(versao)}>
                  <strong>{quandoFoi(versao.quando)}</strong>
                  <em>Restaurar esta versão</em>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* A barra de situação. Diz o que está NO AR, que é a única pergunta que
          importa quando existem dois renderizadores para a mesma página — e
          oferece a volta no mesmo lugar, porque quem precisa dela já está
          insatisfeito e não deve ter de procurar. */}
      <div className={`puck-situacao${carga.noAr ? " puck-situacao--no-ar" : ""}`}>
        <span className="puck-situacao__ponto" aria-hidden />
        <span>
          {carga.noAr
            ? "A vitrine pública está desenhando por este documento."
            : "Rascunho. A vitrine pública ainda desenha pelo editor antigo."}
        </span>
        {recado ? <em className="puck-situacao__recado">{recado}</em> : null}
        {carga.noAr ? (
          <button type="button" className="puck-situacao__voltar" onClick={voltarAoAntigo} disabled={salvando}>
            {salvando ? "Aguarde…" : "Voltar ao editor antigo"}
          </button>
        ) : null}
      </div>

    </div>
  );
}
