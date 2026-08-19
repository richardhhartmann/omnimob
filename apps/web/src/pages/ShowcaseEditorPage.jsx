import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DragDropProvider } from "@dnd-kit/react";

import { api } from "../api";
import { saveSession } from "../session";
import { baseDaVitrine } from "../utils/enderecoVitrine";
import { CHAVES, gravarNoTenant, lerDoTenant } from "../utils/chaveDoTenant";
import { AssistenteIA } from "../components/builder/ia/AssistenteIA.jsx";
import { useAssistenteIA } from "../components/builder/ia/useAssistenteIA";
import { planoLiberaIA } from "../utils/planos";
import { normalizeShowcaseConfig, widgetRect } from "../utils/showcaseConfig";
import { estiloDoTema, linkWhatsApp, LARGURA_DESKTOP_REFERENCIA, LARGURA_MOBILE_REFERENCIA } from "../components/showcase/tema.js";
import { comCelulaTrocada } from "../components/showcase/widgets/StatsWidget.jsx";
import { useConfirm } from "../components/ConfirmModal";

import { SENSORES_EDITOR } from "../components/builder/dndEditor";
import { OnboardingOverlay } from "../components/builder/OnboardingOverlay";
import { BuilderCanvas } from "../components/builder/canvas/BuilderCanvas";
import { BarraDeFormatacao } from "../components/builder/canvas/BarraDeFormatacao";
import { BuilderLeftRail } from "../components/builder/panels/BuilderLeftRail";
import { BuilderInspector } from "../components/builder/panels/BuilderInspector";
import { BuilderTopbar } from "../components/builder/toolbar/BuilderTopbar";
import { BUILDER_TEMPLATES } from "../components/builder/data/templates";
import { FONT_OPTIONS, PRESET_THEMES, RANDOM_COLOR_PAIRS, brilhoDaCor, detectTheme } from "../components/builder/data/temas";
import {
  BLOCK_KEYS,
  BLOCK_LABELS,
  blockPieceId,
  parsePieceId,
  pieceLabel,
  toPieces,
  widgetPieceId,
} from "../components/showcase/engine/pieces.js";
import {
  alinharPecas,
  alturaDoConteudo,
  ajustarAlturasMedidas,
  assentarLayout,
  assentarPecaNova,
  copiarDesktopParaMobile,
  distribuirPecas,
  mobileFoiPersonalizado,
  moverPeca,
  pieceRect,
  proximaPosicaoLivre,
  redimensionarPeca,
  reempilharPorConteudo,
  resetarPosicoes,
} from "../components/showcase/engine/layoutEngine.js";
import { useBuilderHistory } from "../components/builder/hooks/useBuilderHistory";
import { useBuilderInteraction } from "../components/builder/hooks/useBuilderInteraction";
import { useCanvasZoom } from "../components/builder/hooks/useCanvasZoom";
import { useAlturasReais } from "../components/showcase/useAlturasReais.js";
import { useShowcaseAutosave } from "../components/builder/hooks/useShowcaseAutosave";

/* ────────────────────────────────────────────────────────────────────────────
   Editor de Vitrine.

   Este arquivo tinha 2.600 linhas e fazia sete coisas: física de layout,
   medição de DOM, gestão de gesto, histórico, autosave, biblioteca de
   componentes e o desenho da página inteira. Agora ele COMPÕE:

     engine/  — colisão, cascata, encaixe, reflow. Objetos puros, sem DOM.
     hooks/   — gesto, histórico, zoom, autosave, alturas por ResizeObserver.
     canvas/  — a prancheta e as peças.
     panels/  — biblioteca e camadas à esquerda, inspetor à direita.
     toolbar/ — a barra superior.

   O que sobrou aqui é o que só existe aqui: carregar o tenant, guardar o
   formulário, e traduzir intenções da interface ("ocultar esta peça") em
   chamadas da engine.
   ──────────────────────────────────────────────────────────────────────────── */

const VAZIO = new Set();

function novoWidgetId() {
  return `widget-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function montarWidgetDoTemplate(template, id, caixa) {
  return {
    id,
    type: template.type,
    title: template.title,
    content: template.content,
    ctaLabel: template.ctaLabel || "",
    ctaUrl: template.ctaUrl || "",
    backgroundColor: "",
    color: "",
    hidden: false,
    locked: false,
    // Um widget novo nasce com os dois modos iguais. Depois cada modo anda só.
    layout: {
      desktop: { ...caixa },
      mobile: { ...caixa },
    },
  };
}

export function ShowcaseEditorPage({ session, onSessionUpdate }) {
  const { confirm, modal: confirmModal } = useConfirm();
  const tenantSlug = session?.tenant?.slug || "";
  /* Identidade da imobiliária para o armazenamento local. O slug muda de dono
     ao longo do tempo; o id, não. Ver `utils/chaveDoTenant.js`. */
  const tenantId = session?.tenant?.id || "";

  // ── Estado do documento ───────────────────────────────────────────────────
  const [form, setForm] = useState({
    whatsapp: "", email: "", description: "", slogan: "", logoUrl: "",
    primaryColor: "#6366f1", secondaryColor: "#d4af37",
    showcaseHeadline: "", showcaseSubheadline: "",
    showcaseConfig: normalizeShowcaseConfig(null),
  });
  const formRef = useRef(form);
  formRef.current = form;

  const [carregando, setCarregando] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [erroCarga, setErroCarga] = useState("");
  const [previewProperties, setPreviewProperties] = useState([]);
  const [carouselIndexes, setCarouselIndexes] = useState({});

  // ── Estado da ferramenta ──────────────────────────────────────────────────
  const [mode, setMode] = useState("desktop");
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const [selecionada, setSelecionada] = useState(null);
  const [multiSelecao, setMultiSelecao] = useState(() => new Set());
  const [abaRail, setAbaRail] = useState("adicionar");
  const [railColapsado, setRailColapsado] = useState(false);
  const [inspetorColapsado, setInspetorColapsado] = useState(false);
  const [estiloCopiado, setEstiloCopiado] = useState(null);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [novaPecaId, setNovaPecaId] = useState(null);
  const [arrastoBiblioteca, setArrastoBiblioteca] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [mostrarOnboarding, setMostrarOnboarding] = useState(
    () => !localStorage.getItem("domus-builder-onboarded")
  );

  /* O gesto em andamento. Fica FORA do `form` de propósito: durante um arrasto
     o layout muda a cada quadro, e escrever isso no formulário dispararia
     normalização, render de todos os cartões de imóvel e reagendamento do
     autosave sessenta vezes por segundo. Ao soltar, o resultado é gravado uma
     vez só — ver `useBuilderInteraction`. */
  const [gestoVivo, setGestoVivo] = useState(null);

  const canvasRef = useRef(null);
  const stageRef = useRef(null);

  // ── Derivados ─────────────────────────────────────────────────────────────
  const configSalvo = useMemo(() => normalizeShowcaseConfig(form.showcaseConfig), [form.showcaseConfig]);
  const config = gestoVivo?.config || configSalvo;
  const configRef = useRef(config);
  configRef.current = config;

  /* Widgets da biblioteca são singleton por `type`: se já existe uma instância
     salva — mesmo oculta — esse tipo deixa de ser oferecido em "Adicionar".
     Usamos `configSalvo`, não o preview de `gestoVivo`, para o cartão não sumir
     debaixo do ponteiro enquanto um novo widget ainda está sendo arrastado. */
  const tiposWidgetsUsados = useMemo(
    () => new Set((configSalvo.widgets || []).map((w) => w.type).filter(Boolean)),
    [configSalvo.widgets]
  );

  const isLightMode = config.appearanceMode === "light";
  const globalFont = config.globalFont || "Inter";
  const isMobile = mode === "mobile";

  /* A imobiliária como os componentes compartilhados a esperam: o que veio da
     sessão (CRECI, cidade — campos que o editor não edita) por baixo, e o
     formulário em edição por cima. É o mesmo objeto que a vitrine pública
     entrega ao renderizador, e por isso o cabeçalho e o rodapé desenham a
     mesma coisa nos dois lugares. */
  const previewTenant = useMemo(
    () => ({
      ...(session?.tenant || {}),
      name: session?.tenant?.name || "Imobiliária",
      slug: tenantSlug,
      ...form,
    }),
    [form, session?.tenant, tenantSlug]
  );

  /* As mesmas variáveis CSS que a vitrine publicada monta, pela mesma função.
     Eram duas expressões parecidas em arquivos diferentes — e "parecidas" é
     como um fallback diverge do outro sem ninguém perceber. */
  const previewStyle = useMemo(() => estiloDoTema(previewTenant, config), [previewTenant, config]);

  const whatsappHref = useMemo(() => linkWhatsApp(previewTenant), [previewTenant]);

  const currentTheme = useMemo(
    () => detectTheme(form.primaryColor, form.secondaryColor),
    [form.primaryColor, form.secondaryColor]
  );

  const alturaCanvas = useMemo(() => alturaDoConteudo(config, mode), [config, mode]);
  const rectSelecionada = selecionada ? pieceRect(config, mode, selecionada) : null;

  // ── Escrita no documento ──────────────────────────────────────────────────
  const aplicarEstado = useCallback((novoForm) => {
    setForm(novoForm);
    setGestoVivo(null);
  }, []);

  const { registrar, desfazer, refazer, podeDesfazer, podeRefazer } = useBuilderHistory(formRef, aplicarEstado);

  const atualizarCampo = useCallback((campo, valor) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }, []);

  /** Toda escrita no `showcaseConfig` passa por aqui. */
  const atualizarConfig = useCallback((atualizador, { comHistorico = false } = {}) => {
    if (comHistorico) registrar();
    setForm((prev) => {
      const base = normalizeShowcaseConfig(prev.showcaseConfig);
      const proximo = typeof atualizador === "function" ? atualizador(base) : atualizador;
      return proximo === base ? prev : { ...prev, showcaseConfig: proximo };
    });
    setGestoVivo(null);
  }, [registrar]);

  /* `reempilhar` só é declarado lá embaixo (depende da medição de alturas), e o
     assistente é declarado aqui. A ref liga os dois sem obrigar nenhum deles a
     mudar de lugar por causa do outro. */
  const reempilharRef = useRef(null);

  /* ── Assistente de IA (Premium) ───────────────────────────────────────────
     Ele escreve pelo MESMO `atualizarConfig` e pelo MESMO `registrar` que o
     resto do editor — nada de caminho paralelo. É o que faz o resultado da IA
     ser indistinguível do resultado do mouse: mesma engine, mesmo histórico,
     mesmo autosave. Ver `components/builder/ia/`. */
  const iaLiberada = planoLiberaIA(session?.tenant?.plano);
  const assistente = useAssistenteIA({
    tenantSlug,
    configRef,
    formRef,
    modeRef,
    atualizarConfig,
    atualizarCampo,
    registrar,
    aoSelecionar: setSelecionada,
    aoCompactar: () => reempilharRef.current?.(),
    imoveis: previewProperties.length,
  });

  // ── Carga inicial ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      if (!tenantSlug) return;
      setCarregando(true);
      setErroCarga("");
      try {
        const [perfil, vitrine] = await Promise.all([
          api.getTenantProfile(tenantSlug),
          api.getPublicShowcase(tenantSlug),
        ]);
        if (cancelado) return;
        setForm({
          whatsapp: perfil.whatsapp || "",
          email: perfil.email || "",
          description: perfil.description || "",
          slogan: perfil.slogan || "",
          logoUrl: perfil.logoUrl || "",
          primaryColor: perfil.primaryColor || "#6366f1",
          secondaryColor: perfil.secondaryColor || "#d4af37",
          showcaseHeadline: perfil.showcaseHeadline || "",
          showcaseSubheadline: perfil.showcaseSubheadline || "",
          /* Assenta na abertura: configuração gravada por uma versão antiga do
             editor pode chegar com peças sobrepostas, e sem isto ela abriria
             assim e continuaria assim até alguém arrastar cada uma na mão. */
          showcaseConfig: assentarLayout(normalizeShowcaseConfig(perfil.showcaseConfig)),
        });
        setPreviewProperties(vitrine.properties || []);
        const indices = {};
        (vitrine.properties || []).forEach((p) => { indices[p.id] = 0; });
        setCarouselIndexes(indices);
        setPronto(true);
      } catch (err) {
        if (!cancelado) setErroCarga(err.message);
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }
    carregar();
    return () => { cancelado = true; };
  }, [tenantSlug]);

  // Fontes do Google usadas pela vitrine, para o canvas mostrar o que o
  // visitante vai ver.
  useEffect(() => {
    const familias = FONT_OPTIONS.map((f) => f.value.replace(/ /g, "+")).join("&family=");
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${familias}&display=swap`;
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch {} };
  }, []);

  /* Histórico visual, chaveado pelo ID da imobiliária e nunca pelo slug: com
     slug, a empresa que assinasse um endereço liberado por outra abria o editor
     e encontrava os LAYOUTS SALVOS da anterior. Ver `utils/chaveDoTenant.js`. */
  useEffect(() => {
    const bruto = lerDoTenant(CHAVES.historicoEditor, tenantId);
    if (!bruto) return;
    try {
      setHistorico(JSON.parse(bruto));
    } catch {
      /* JSON corrompido: começa vazio em vez de derrubar o editor */
    }
  }, [tenantId]);

  // ── Autosave ──────────────────────────────────────────────────────────────
  const { estado: estadoAutosave, erro: erroSalvamento } = useShowcaseAutosave({
    valor: form,
    ativo: pronto && Boolean(tenantSlug) && !gestoVivo,
    salvar: (valor) => api.updateTenantProfile(tenantSlug, valor),
    aoSalvar: (atualizado) => {
      const proximaSessao = { ...session, tenant: { ...session.tenant, ...atualizado } };
      saveSession(proximaSessao);
      onSessionUpdate(proximaSessao);
      const instantaneo = {
        id: Date.now(),
        label: "Auto-salvo",
        timestamp: new Date().toLocaleString("pt-BR"),
        data: JSON.stringify(formRef.current),
      };
      setHistorico((prev) => {
        const proximo = [instantaneo, ...prev].slice(0, 10);
        gravarNoTenant(CHAVES.historicoEditor, tenantId, JSON.stringify(proximo));
        return proximo;
      });
    },
  });

  /* ── Espaço de tela ────────────────────────────────────────────────────────
     Abaixo de 1180px os três painéis abertos deixam menos de 700px para a
     página, e editar layout por uma fresta é pior que não ver a biblioteca.

     Isto já era feito por media query, escondendo o corpo do painel — mas o
     componente não sabia, então a aba continuava acesa apontando para um painel
     invisível e clicar nela não fazia nada. Agora quem decide é o estado: a
     tira de ícones é o estado real, e expandir continua sendo escolha de quem
     está usando. */
  useEffect(() => {
    const consulta = window.matchMedia("(max-width: 1180px)");
    const aplicar = (e) => setRailColapsado(e.matches);
    setRailColapsado(consulta.matches);
    consulta.addEventListener("change", aplicar);
    return () => consulta.removeEventListener("change", aplicar);
  }, []);

  // ── Zoom ──────────────────────────────────────────────────────────────────
  const { zoom, zoomRef, setZoom, ajustarALargura } = useCanvasZoom(stageRef, {
    larguraCanvasPx: LARGURA_DESKTOP_REFERENCIA,
  });

  /* A folha tem largura fixa (1280) e a janela do editor quase nunca tem isso
     sobrando. Sem este encaixe inicial, o editor abria com barra de rolagem
     horizontal e metade da página fora de vista — a primeira impressão era de
     algo quebrado. Roda uma vez, quando os dados chegam. */
  const encaixouRef = useRef(false);
  useEffect(() => {
    if (!pronto || encaixouRef.current) return;
    encaixouRef.current = true;
    ajustarALargura();
  }, [pronto, ajustarALargura]);

  // ── Alturas reais ─────────────────────────────────────────────────────────
  const aoMedirAlturas = useCallback((alturas) => {
    const proximo = ajustarAlturasMedidas(configRef.current, modeRef.current, alturas);
    if (proximo) atualizarConfig(proximo);
  }, [atualizarConfig]);

  const { registrarPeca, medirAgora } = useAlturasReais({
    aoMedir: aoMedirAlturas,
    pausado: Boolean(gestoVivo),
  });

  /* Uma medição ao soltar o gesto.

     Durante o arrasto o observador fica pausado — reflow no meio de um
     movimento faria a peça pular sob o ponteiro. Mas redimensionar MUDA a
     altura do conteúdo (uma coluna mais estreita quebra mais linhas), e essa
     medição chegaria justamente enquanto ele está calado. Sem esta varredura
     final, a caixa guardada ficaria menor que a desenhada e a peça de baixo
     pareceria invadida. */
  useEffect(() => {
    if (gestoVivo) return;
    const alturas = medirAgora();
    if (Object.keys(alturas).length) aoMedirAlturas(alturas);
  }, [gestoVivo, medirAgora, aoMedirAlturas]);

  // ── Gesto ─────────────────────────────────────────────────────────────────
  const interacao = useBuilderInteraction({
    configRef,
    modeRef,
    canvasRef,
    zoomRef,
    aoRegistrarHistorico: registrar,
    aoPrever: setGestoVivo,
    aoConfirmar: (novoConfig) => atualizarConfig(novoConfig),
  });

  function aoIniciarArrasto(event) {
    const pieceId = String(event.operation?.source?.id || "");
    if (!parsePieceId(pieceId)) return;
    interacao.iniciar(pieceId, "drag");
  }

  function aoMoverArrasto(event) {
    const t = event.operation?.transform;
    interacao.mover(t?.x || 0, t?.y || 0);
  }

  // ── Seleção ───────────────────────────────────────────────────────────────
  const aoSelecionar = useCallback((pieceId, event) => {
    if (!pieceId) {
      setSelecionada(null);
      setMultiSelecao(new Set());
      return;
    }
    if (event?.shiftKey) {
      const proximo = new Set(multiSelecao);
      if (proximo.has(pieceId)) {
        proximo.delete(pieceId);
        if (selecionada === pieceId) setSelecionada(proximo.values().next().value || null);
      } else {
        proximo.add(pieceId);
        // A última peça adicionada vira a referência do inspetor, enquanto a
        // seleção coletiva continua inteira para a barra de alinhamento.
        setSelecionada(pieceId);
      }
      setMultiSelecao(proximo);
      return;
    }
    setSelecionada(pieceId);
    setMultiSelecao(new Set([pieceId]));
  }, [multiSelecao, selecionada]);

  const aoIniciarPseudoSecao = useCallback((pieceIds, event) => {
    const ids = Array.from(new Set(pieceIds || []));
    if (!ids.length) return;
    setMultiSelecao(new Set(ids));
    setSelecionada(ids[0]);
    interacao.aoPegarPseudoSecao(ids, event);
  }, [interacao]);

  /* Esc limpa a seleção — e fecha o histórico quando ele está aberto, que era o
     único painel do editor sem saída pelo teclado (só clicando no ✕ ou fora). */
  useEffect(() => {
    const aoTeclar = (e) => {
      if (e.key !== "Escape") return;
      if (mostrarHistorico) {
        setMostrarHistorico(false);
        return;
      }
      setSelecionada(null);
      setMultiSelecao(new Set());
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [mostrarHistorico]);

  // Peça selecionada que some (oculta/excluída) não pode continuar governando o
  // inspetor — ele mostraria controles de algo que não está mais na tela.
  useEffect(() => {
    if (!selecionada) return;
    const existe = toPieces(config, mode).some((p) => p.id === selecionada);
    if (!existe) {
      setSelecionada(null);
      setMultiSelecao(new Set());
    }
  }, [config, mode, selecionada]);

  // ── Ações sobre peças ─────────────────────────────────────────────────────
  const ocultarPeca = useCallback((pieceId) => {
    const alvo = parsePieceId(pieceId);
    if (!alvo) return;
    atualizarConfig((prev) => (
      alvo.kind === "block"
        ? { ...prev, hiddenBlocks: Array.from(new Set([...(prev.hiddenBlocks || []), alvo.key])) }
        : { ...prev, widgets: prev.widgets.map((w) => (w.id === alvo.key ? { ...w, hidden: true } : w)) }
    ), { comHistorico: true });
  }, [atualizarConfig]);

  const restaurarPeca = useCallback((pieceId) => {
    const alvo = parsePieceId(pieceId);
    if (!alvo) return;
    atualizarConfig((prev) => (
      alvo.kind === "block"
        ? { ...prev, hiddenBlocks: (prev.hiddenBlocks || []).filter((k) => k !== alvo.key) }
        : { ...prev, widgets: prev.widgets.map((w) => (w.id === alvo.key ? { ...w, hidden: false } : w)) }
    ), { comHistorico: true });
  }, [atualizarConfig]);

  const alternarTrava = useCallback((pieceId) => {
    const alvo = parsePieceId(pieceId);
    if (!alvo) return;
    atualizarConfig((prev) => {
      if (alvo.kind === "block") {
        const travados = prev.lockedBlocks || [];
        return {
          ...prev,
          lockedBlocks: travados.includes(alvo.key)
            ? travados.filter((k) => k !== alvo.key)
            : [...travados, alvo.key],
        };
      }
      return { ...prev, widgets: prev.widgets.map((w) => (w.id === alvo.key ? { ...w, locked: !w.locked } : w)) };
    });
  }, [atualizarConfig]);

  const removerWidget = useCallback((pieceId) => {
    const alvo = parsePieceId(pieceId);
    if (alvo?.kind !== "widget") return;
    atualizarConfig((prev) => ({ ...prev, widgets: prev.widgets.filter((w) => w.id !== alvo.key) }), { comHistorico: true });
  }, [atualizarConfig]);

  const atualizarWidget = useCallback((widgetId, campo, valor) => {
    atualizarConfig((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) => (w.id === widgetId ? { ...w, [campo]: valor } : w)),
    }));
  }, [atualizarConfig]);

  // ── Biblioteca ────────────────────────────────────────────────────────────
  const criarWidget = useCallback((template, rect) => {
    if (!template?.type || tiposWidgetsUsados.has(template.type)) return;

    const novoId = novoWidgetId();
    atualizarConfig((prev) => {
      const modo = modeRef.current;
      const posicao = rect || proximaPosicaoLivre(prev, modo, template.tamanho?.w ?? 50);
      const caixa = {
        x: posicao.x,
        y: posicao.y,
        w: template.tamanho?.w ?? posicao.w ?? 50,
        h: template.tamanho?.h ?? posicao.h ?? 220,
      };
      const novo = montarWidgetDoTemplate(template, novoId, caixa);
      return assentarPecaNova(
        { ...prev, widgets: [...prev.widgets, novo] },
        modo,
        widgetPieceId(novoId)
      );
    }, { comHistorico: true });
    setSelecionada(widgetPieceId(novoId));
    setNovaPecaId(novoId);
    setTimeout(() => setNovaPecaId(null), 700);
  }, [atualizarConfig, tiposWidgetsUsados]);

  /* Arrastar da biblioteca para o canvas.
     Fora da folha continua existindo um fantasma leve. No instante em que o
     ponteiro entra no canvas, o "fantasma" vira um widget REAL dentro de um
     config transitório e passa pela mesma engine dos widgets existentes. */
  const aoArrastarDaBiblioteca = useCallback((template, event) => {
    if (event.button != null && event.button !== 0) return;
    if (!template?.type || tiposWidgetsUsados.has(template.type)) return;

    const inicioX = event.clientX;
    const inicioY = event.clientY;
    const novoId = novoWidgetId();
    const pieceId = widgetPieceId(novoId);
    const base = configRef.current;
    const modo = modeRef.current;

    let arrastou = false;
    let ultimoConfig = null;
    let dentroNoUltimoQuadro = false;

    const aoMover = (e) => {
      if (!arrastou && Math.hypot(e.clientX - inicioX, e.clientY - inicioY) < 12) return;
      arrastou = true;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const caixaCanvas = canvas.getBoundingClientRect();
      const dentro =
        e.clientX >= caixaCanvas.left && e.clientX <= caixaCanvas.right &&
        e.clientY >= caixaCanvas.top && e.clientY <= caixaCanvas.bottom;

      setArrastoBiblioteca({
        template,
        x: e.clientX,
        y: e.clientY,
        dentroCanvas: dentro,
      });

      if (!dentro) {
        dentroNoUltimoQuadro = false;
        ultimoConfig = null;
        setGestoVivo(null);
        return;
      }

      dentroNoUltimoQuadro = true;

      const escala = modo === "mobile" ? 1 : zoomRef.current || 1;
      const xPct = ((e.clientX - caixaCanvas.left) / Math.max(caixaCanvas.width, 1)) * 100;
      const yPx = (e.clientY - caixaCanvas.top) / escala;
      const largura = template.tamanho?.w ?? 50;
      const altura = template.tamanho?.h ?? 220;

      const caixaInicial = {
        x: Math.max(0, Math.min(xPct, 100 - largura)),
        y: Math.max(0, yPx),
        w: largura,
        h: altura,
      };

      /*
       * Recriar só o widget temporário a partir da base congelada é importante:
       * assim o outro modo (desktop/mobile) acompanha a posição mais recente,
       * mas nenhuma deformação de um frame vira a entrada do frame seguinte.
       */
      const widgetTemporario = montarWidgetDoTemplate(template, novoId, caixaInicial);
      const configComPreview = {
        ...base,
        widgets: [...(base.widgets || []), widgetTemporario],
      };

      const previsto = moverPeca(
        configComPreview,
        modo,
        pieceId,
        { x: caixaInicial.x, y: caixaInicial.y },
        {
          larguraCanvas: Math.max(caixaCanvas.width, 1),
          cursorX: xPct,
          ignorarLinhaOrigem: true,
        }
      );

      ultimoConfig = previsto.config;
      setGestoVivo({
        ...previsto,
        pieceId,
        tipo: "insert",
      });
    };

    const limpar = () => {
      window.removeEventListener("pointermove", aoMover);
      window.removeEventListener("pointerup", aoSoltar);
      window.removeEventListener("pointercancel", aoCancelar);
    };

    const aoSoltar = () => {
      limpar();
      setArrastoBiblioteca(null);

      // Clique puro continua sendo responsabilidade do onClick do cartão.
      if (!arrastou) return;

      if (!dentroNoUltimoQuadro || !ultimoConfig) {
        setGestoVivo(null);
        return;
      }

      atualizarConfig(ultimoConfig, { comHistorico: true });
      setSelecionada(pieceId);
      setNovaPecaId(novoId);
      setTimeout(() => setNovaPecaId(null), 700);
    };

    const aoCancelar = () => {
      limpar();
      setArrastoBiblioteca(null);
      setGestoVivo(null);
    };

    window.addEventListener("pointermove", aoMover);
    window.addEventListener("pointerup", aoSoltar);
    window.addEventListener("pointercancel", aoCancelar);
  }, [atualizarConfig, zoomRef, tiposWidgetsUsados]);

  // ── Página ────────────────────────────────────────────────────────────────
  const definirModoAparencia = useCallback((modo) => {
    atualizarConfig((prev) => {
      const inverter = (cor) => {
        const c = cor || (prev.appearanceMode === "light" ? "#1e293b" : "#f8fafc");
        const brilho = brilhoDaCor(c);
        if (modo === "dark" && brilho < 128) return "#f8fafc";
        if (modo === "light" && brilho >= 128) return "#1e293b";
        return cor;
      };
      const estilos = {};
      for (const [k, v] of Object.entries(prev.blockStyles)) {
        estilos[k] = v.color ? { ...v, color: inverter(v.color) } : v;
      }
      return {
        ...prev,
        appearanceMode: modo,
        blockStyles: estilos,
        highlightStyles: prev.highlightStyles.map((hs) => (hs.color ? { ...hs, color: inverter(hs.color) } : hs)),
        widgets: prev.widgets.map((w) => (w.color ? { ...w, color: inverter(w.color) } : w)),
      };
    }, { comHistorico: true });
  }, [atualizarConfig]);

  const aplicarPreset = useCallback((chave) => {
    const preset = PRESET_THEMES[chave];
    if (!preset) return;
    registrar();
    setForm((prev) => ({ ...prev, primaryColor: preset.primaryColor, secondaryColor: preset.secondaryColor }));
  }, [registrar]);

  const sortearCores = useCallback(() => {
    registrar();
    const atual = (formRef.current?.primaryColor || "").toLowerCase();
    let par;
    let tentativas = 0;
    do {
      par = RANDOM_COLOR_PAIRS[Math.floor(Math.random() * RANDOM_COLOR_PAIRS.length)];
      tentativas += 1;
    } while (par[0].toLowerCase() === atual && tentativas < 10);
    setForm((prev) => ({ ...prev, primaryColor: par[0], secondaryColor: par[1] }));
  }, [registrar]);

  const aplicarTemplate = useCallback((template) => {
    registrar();
    setForm((prev) => {
      const base = normalizeShowcaseConfig(prev.showcaseConfig);
      return {
        ...prev,
        primaryColor: template.primaryColor,
        secondaryColor: template.secondaryColor,
        showcaseConfig: assentarLayout(normalizeShowcaseConfig({ ...base, ...template.config })),
      };
    });
    setGestoVivo(null);
  }, [registrar]);

  /* Reempilhar por conteúdo depois que o navegador pintou: as alturas só
     existem depois do layout, e medir antes devolve a caixa declarada — que é
     exatamente o número que estamos tentando corrigir. */
  const reempilhar = useCallback(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const alturas = medirAgora();
      if (!Object.keys(alturas).length) return;
      atualizarConfig((prev) => reempilharPorConteudo(prev, modeRef.current, alturas));
    }));
  }, [medirAgora, atualizarConfig]);
  reempilharRef.current = reempilhar;

  const aoResetarPosicoes = useCallback(() => {
    atualizarConfig((prev) => resetarPosicoes(prev, modeRef.current), { comHistorico: true });
    reempilhar();
  }, [atualizarConfig, reempilhar]);

  const aoResetarTudo = useCallback(async () => {
    const ok = await confirm(
      "Isto devolve layout, cores, textos e widgets ao padrão. Seus imóveis não são afetados.",
      "Resetar tudo"
    );
    if (!ok) return;
    registrar();
    setForm((prev) => ({
      ...prev,
      showcaseHeadline: "",
      showcaseSubheadline: "",
      showcaseConfig: assentarLayout(normalizeShowcaseConfig(null)),
    }));
    setGestoVivo(null);
    reempilhar();
  }, [confirm, registrar, reempilhar]);

  const aoCopiarDesktop = useCallback(async () => {
    if (mobileFoiPersonalizado(configRef.current)) {
      const ok = await confirm(
        "O layout mobile já foi ajustado. Copiar do desktop substitui essas posições — inclusive as dos widgets.",
        "Copiar do desktop"
      );
      if (!ok) return;
    }
    atualizarConfig((prev) => copiarDesktopParaMobile(prev), { comHistorico: true });
  }, [confirm, atualizarConfig]);

  const aoCopiarLink = useCallback(() => {
    navigator.clipboard?.writeText(baseDaVitrine());
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2000);
  }, []);

  // ── Camadas ───────────────────────────────────────────────────────────────
  const camadas = useMemo(() => {
    const itens = [];
    for (const key of BLOCK_KEYS) {
      const oculta = (config.hiddenBlocks || []).includes(key);
      itens.push({
        pieceId: blockPieceId(key),
        kind: "block",
        rotulo: BLOCK_LABELS[key],
        oculta,
        travada: (config.lockedBlocks || []).includes(key),
        y: oculta ? Number.MAX_SAFE_INTEGER : pieceRect(config, mode, blockPieceId(key))?.y ?? 0,
      });
    }
    for (const w of config.widgets || []) {
      itens.push({
        pieceId: widgetPieceId(w.id),
        kind: "widget",
        rotulo: pieceLabel(config, widgetPieceId(w.id)),
        oculta: w.hidden === true,
        travada: w.locked === true,
        y: w.hidden ? Number.MAX_SAFE_INTEGER : widgetRect(w, mode).y,
      });
    }
    return itens.sort((a, b) => a.y - b.y);
  }, [config, mode]);

  /* ── A ÚNICA porta de escrita de texto do editor ──────────────────────────
     Todo texto editável da vitrine — título, destaque, rodapé, campo de widget,
     célula de estatística — chega aqui com a mesma chave que o componente
     compartilhado declarou em `data-rich-sync`. Os dois caminhos que precisam
     gravar usam esta função: o `onBlur` do próprio campo e a barra de formatação
     flutuante, que grava à força porque clicar nela não tira o foco do texto. */
  const aoEditarTexto = useCallback((chave, html) => {
    if (!chave) return;
    if (chave === "footerTitle") {
      atualizarConfig((prev) => ({ ...prev, footerTitle: html }));
      return;
    }
    const partes = chave.split("|");

    if (partes[0] === "form") {
      atualizarCampo(partes[1], html);
      return;
    }

    if (partes[0] === "highlight") {
      const indice = parseInt(partes[1], 10);
      atualizarConfig((prev) => ({
        ...prev,
        highlights: prev.highlights.map((item, i) => (i === indice ? { ...item, [partes[2]]: html } : item)),
      }));
      return;
    }

    if (partes[0] === "widget") {
      /* `widget|<id>|stat|<par>|<celula>` — o bloco de números guarda tudo numa
         string com barras, e cada célula é editada no lugar. A recomposição
         mora no próprio componente, que é quem conhece o formato. */
      if (partes[2] === "stat") {
        const par = parseInt(partes[3], 10);
        const celula = parseInt(partes[4], 10);
        atualizarConfig((prev) => ({
          ...prev,
          widgets: prev.widgets.map((w) =>
            w.id === partes[1] ? { ...w, content: comCelulaTrocada(w.content, par, celula, html) } : w
          ),
        }));
        return;
      }
      atualizarWidget(partes[1], partes[2], html);
    }
  }, [atualizarConfig, atualizarCampo, atualizarWidget]);

  // ── Feixe de ações de peça entregue ao canvas ─────────────────────────────
  const acoesCanvas = useMemo(() => ({
    ocultar: ocultarPeca,
    alternarTrava,
  }), [ocultarPeca, alternarTrava]);

  const acoesMulti = useMemo(() => ({
    alinhar: (tipo) => {
      const ids = Array.from(multiSelecao);
      if (ids.length < 2) return;
      atualizarConfig((prev) => alinharPecas(prev, mode, ids, tipo), { comHistorico: true });
    },
    distribuir: (eixo) => {
      const ids = Array.from(multiSelecao);
      if (ids.length < 3) return;
      atualizarConfig((prev) => distribuirPecas(prev, mode, ids, eixo), { comHistorico: true });
    },
  }), [multiSelecao, atualizarConfig, mode]);

  const alvoSelecionado = selecionada ? parsePieceId(selecionada) : null;

  const acoesInspetor = {
    // Página
    atualizarCampo,
    definirModoAparencia,
    definirFonte: (fonte) => atualizarConfig((prev) => ({ ...prev, globalFont: fonte })),
    aplicarPreset,
    sortearCores,
    restaurar: restaurarPeca,
    // Peça
    registrarHistorico: registrar,
    moverPara: (delta) => {
      if (!selecionada || !rectSelecionada) return;
      const destino = { x: rectSelecionada.x, y: rectSelecionada.y, ...delta };
      /* Sem encaixe: aqui a pessoa DIGITOU um número, e corrigir 248 para 250
         porque havia uma guia por perto seria desfazer o pedido dela. O encaixe
         é uma ajuda para a mão, não para o teclado. */
      atualizarConfig((prev) => moverPeca(prev, mode, selecionada, destino, {
        larguraCanvas: canvasRef.current?.getBoundingClientRect().width || 1200,
        encaixar: false,
      }).config);
    },
    redimensionarPara: (delta) => {
      if (!selecionada || !rectSelecionada) return;
      const tamanho = { w: rectSelecionada.w, h: rectSelecionada.h, ...delta };
      atualizarConfig((prev) => redimensionarPeca(prev, mode, selecionada, tamanho).config);
    },
    atualizarEstiloBloco: (campo, valor) => {
      if (alvoSelecionado?.kind !== "block") return;
      atualizarConfig((prev) => ({
        ...prev,
        blockStyles: {
          ...prev.blockStyles,
          [alvoSelecionado.key]: { ...prev.blockStyles[alvoSelecionado.key], [campo]: valor },
        },
      }));
    },
    limparEstiloBloco: () => {
      if (alvoSelecionado?.kind !== "block") return;
      atualizarConfig((prev) => ({
        ...prev,
        blockStyles: {
          ...prev.blockStyles,
          [alvoSelecionado.key]: { backgroundColor: "", color: "", backgroundImage: "", backgroundOverlay: 0, backgroundBrightness: 1 },
        },
      }), { comHistorico: true });
    },
    copiarEstilo: () => {
      if (alvoSelecionado?.kind !== "block") return;
      setEstiloCopiado({ pieceId: selecionada, estilo: { ...config.blockStyles[alvoSelecionado.key] } });
    },
    podeColar: Boolean(estiloCopiado) && estiloCopiado?.pieceId !== selecionada && alvoSelecionado?.kind === "block",
    colarEstilo: () => {
      if (!estiloCopiado || alvoSelecionado?.kind !== "block") return;
      atualizarConfig((prev) => ({
        ...prev,
        blockStyles: { ...prev.blockStyles, [alvoSelecionado.key]: { ...estiloCopiado.estilo } },
      }), { comHistorico: true });
    },
    atualizarWidget: (campo, valor) => {
      if (alvoSelecionado?.kind !== "widget") return;
      atualizarWidget(alvoSelecionado.key, campo, valor);
    },
    limparEstiloWidget: () => {
      if (alvoSelecionado?.kind !== "widget") return;
      atualizarConfig((prev) => ({
        ...prev,
        widgets: prev.widgets.map((w) => (w.id === alvoSelecionado.key ? { ...w, backgroundColor: "", color: "" } : w)),
      }), { comHistorico: true });
    },
    adicionarDestaque: () => atualizarConfig((prev) => ({
      ...prev,
      highlights: [...prev.highlights, { title: "Novo destaque", description: "Descreva o benefício aqui." }],
      highlightStyles: [...prev.highlightStyles, { backgroundColor: "", color: "" }],
    }), { comHistorico: true }),
    removerDestaque: (indice) => atualizarConfig((prev) => (
      prev.highlights.length <= 1 ? prev : {
        ...prev,
        highlights: prev.highlights.filter((_, i) => i !== indice),
        highlightStyles: prev.highlightStyles.filter((_, i) => i !== indice),
      }
    ), { comHistorico: true }),
    atualizarEstiloDestaque: (indice, campo, valor) => atualizarConfig((prev) => ({
      ...prev,
      highlightStyles: prev.highlightStyles.map((row, i) => (i === indice ? { ...row, [campo]: valor } : row)),
    })),
    alternarTrava: () => selecionada && alternarTrava(selecionada),
    ocultar: () => selecionada && ocultarPeca(selecionada),
    remover: () => selecionada && removerWidget(selecionada),
  };

  const proximaFoto = useCallback((id, total) => {
    setCarouselIndexes((prev) => ({ ...prev, [id]: ((prev[id] || 0) + 1) % total }));
  }, []);
  const fotoAnterior = useCallback((id, total) => {
    setCarouselIndexes((prev) => ({ ...prev, [id]: ((prev[id] || 0) - 1 + total) % total }));
  }, []);

  const estadoSalvamento = carregando ? "carregando" : estadoAutosave;

  return (
    <DragDropProvider
      sensors={SENSORES_EDITOR}
      onDragStart={aoIniciarArrasto}
      onDragMove={aoMoverArrasto}
      onDragEnd={interacao.terminar}
    >
      {confirmModal}

      <div className="editor-shell showcase-editor-full">
        <BuilderTopbar
          estadoSalvamento={estadoSalvamento}
          mode={mode}
          onMode={setMode}
          mobilePersonalizado={isMobile && mobileFoiPersonalizado(config)}
          onCopiarDesktop={aoCopiarDesktop}
          onDesfazer={desfazer}
          onRefazer={refazer}
          podeDesfazer={podeDesfazer}
          podeRefazer={podeRefazer}
          zoom={zoom}
          onZoom={setZoom}
          onAjustarZoom={ajustarALargura}
          onResetarPosicoes={aoResetarPosicoes}
          onResetarTudo={aoResetarTudo}
          onHistorico={() => setMostrarHistorico(true)}
          onCopiarLink={aoCopiarLink}
          linkCopiado={linkCopiado}
          linkVitrine={baseDaVitrine()}
        />

        {erroCarga || erroSalvamento ? (
          <div className="editor-alerta">{erroCarga || erroSalvamento}</div>
        ) : null}

        {/* Abaixo de ~760px não sobra canvas utilizável depois das barras. Em vez
            de entregar uma tela apertada sem explicação, o editor diz o que
            está acontecendo — e continua funcionando para ajustes rápidos. */}
        <p className="editor-aviso-estreito">
            Esta tela é estreita para montar layout. Dá para ajustar textos e cores por aqui;
            para arrastar e redimensionar, use um monitor maior.
        </p>

        <div className="editor-workspace">
          <BuilderLeftRail
            aba={abaRail}
            onAba={setAbaRail}
            colapsado={railColapsado}
            onAlternarColapso={() => setRailColapsado((v) => !v)}
            onAdicionarWidget={(template) => criarWidget(template)}
            onArrastarWidget={aoArrastarDaBiblioteca}
            tiposWidgetsUsados={tiposWidgetsUsados}
            camadas={camadas}
            selecionada={selecionada}
            onSelecionarCamada={(pieceId) => aoSelecionar(pieceId)}
            onAlternarVisibilidade={(pieceId) => {
              const oculta = camadas.find((c) => c.pieceId === pieceId)?.oculta;
              return oculta ? restaurarPeca(pieceId) : ocultarPeca(pieceId);
            }}
            onAlternarTrava={alternarTrava}
            templates={BUILDER_TEMPLATES}
            onAplicarTemplate={aplicarTemplate}
            painelIA={
              <AssistenteIA
                liberado={iaLiberada}
                assistente={assistente}
                aoAssinar={() => window.open("/configuracoes?ver=plano", "_blank")}
              />
            }
          />

          <div className="editor-stage" ref={stageRef}>
            <div className="editor-stage-inner showcase-body" style={previewStyle}>
              {isMobile ? <span className="editor-mode-badge">Layout mobile</span> : null}
              {/* ── Por que a folha vive dentro de um invólucro dimensionado ──
                  `transform: scale()` não muda a CAIXA do elemento, só o
                  desenho. Com origem no centro e zoom acima de 100%, a folha
                  transbordava para os dois lados — e o transbordo do lado
                  ESQUERDO não vira área rolável em nenhum navegador. A parte
                  esquerda da página ficava inalcançável justamente quando a
                  pessoa aproximava para ajustar um detalhe.

                  Com a origem no canto e um invólucro do tamanho JÁ escalado,
                  a área de rolagem bate com o que se vê, e o centramento
                  continua sendo do flex do palco. */}
              <div
                className={isMobile ? "editor-device" : "editor-paper-wrap"}
                style={
                  isMobile
                    ? { width: `${LARGURA_MOBILE_REFERENCIA}px` }
                    : { width: `${LARGURA_DESKTOP_REFERENCIA * zoom}px`, height: `${alturaCanvas * zoom}px` }
                }
              >
                <div
                  className={isMobile ? undefined : "editor-paper"}
                  style={isMobile ? undefined : {
                    width: `${LARGURA_DESKTOP_REFERENCIA}px`,
                    transform: `scale(${zoom})`,
                    transformOrigin: "top left",
                  }}
                >
                <BuilderCanvas
                  canvasRef={canvasRef}
                  mode={mode}
                  config={config}
                  tenant={previewTenant}
                  tenantSlug={tenantSlug}
                  properties={previewProperties}
                  carouselIndexes={carouselIndexes}
                  onProxima={proximaFoto}
                  onAnterior={fotoAnterior}
                  whatsappHref={whatsappHref}
                  aoEditarTexto={aoEditarTexto}
                  selecionada={selecionada}
                  multiSelecao={multiSelecao}
                  encostados={gestoVivo?.encostadas || VAZIO}
                  guias={gestoVivo?.guias}
                  gesto={gestoVivo}
            iaTrabalhando={assistente.estado === "executando"}
                  novaPecaId={novaPecaId}
                  registrarPeca={registrarPeca}
                  aoSelecionar={aoSelecionar}
                  aoIniciarResize={interacao.aoPegarAlcaDeResize}
                  acoes={acoesCanvas}
                  acoesMulti={acoesMulti}
                  aoIniciarPseudoSecao={aoIniciarPseudoSecao}
                  zoom={isMobile ? 1 : zoom}
                  altura={alturaCanvas}
                />
                </div>
              </div>
            </div>
          </div>

          <BuilderInspector
            colapsado={inspetorColapsado}
            onAlternarColapso={() => setInspetorColapsado((v) => !v)}
            selecionada={selecionada}
            config={config}
            form={form}
            tenantName={session?.tenant?.name || ""}
            rect={rectSelecionada}
            mode={mode}
            isLightMode={isLightMode}
            currentTheme={currentTheme}
            acoes={acoesInspetor}
          />
        </div>
      </div>

      <BarraDeFormatacao aoSincronizar={aoEditarTexto} />

      {/* Fantasma do arrasto da biblioteca — por portal, pela viewport.

          O cartão nascia dentro de um ancestral com `transform` (a animação de
          entrada do conteúdo termina em matrix identidade, invisível a olho nu
          mas suficiente para virar BLOCO DE CONTENÇÃO). A partir daí `fixed`
          deixa de medir pela janela e passa a medir por ele, e o fantasma
          aparecia deslocado da mão. É a armadilha recorrente desta base. */}
      {arrastoBiblioteca && !arrastoBiblioteca.dentroCanvas
        ? createPortal(
            <div className="editor-ghost" style={{ left: arrastoBiblioteca.x, top: arrastoBiblioteca.y }}>
              <span className="editor-ghost-preview">{arrastoBiblioteca.template.preview}</span>
              <strong>{arrastoBiblioteca.template.nome}</strong>
              <em>Solte no canvas</em>
            </div>,
            document.body
          )
        : null}

      {mostrarOnboarding ? (
        <OnboardingOverlay
          onDismiss={() => {
            localStorage.setItem("domus-builder-onboarded", "1");
            setMostrarOnboarding(false);
          }}
        />
      ) : null}

      {mostrarHistorico
        ? createPortal(
            <div className="editor-modal-backdrop" onClick={() => setMostrarHistorico(false)}>
              <div className="editor-modal" onClick={(e) => e.stopPropagation()}>
                <header className="editor-modal-head">
                  <h3>Histórico de versões</h3>
                  <button type="button" className="editor-icon-button is-ghost" onClick={() => setMostrarHistorico(false)}>✕</button>
                </header>
                <button
                  type="button"
                  className="editor-button is-accent"
                  onClick={() => {
                    const instantaneo = {
                      id: Date.now(),
                      label: "Versão manual",
                      timestamp: new Date().toLocaleString("pt-BR"),
                      data: JSON.stringify(formRef.current),
                    };
                    setHistorico((prev) => {
                      const proximo = [instantaneo, ...prev].slice(0, 10);
                      gravarNoTenant(CHAVES.historicoEditor, tenantId, JSON.stringify(proximo));
                      return proximo;
                    });
                  }}
                >
                  + Salvar versão agora
                </button>
                <div className="editor-modal-list">
                  {historico.length === 0 ? (
                    <p className="editor-hint">Nenhuma versão salva ainda. O histórico é preenchido a cada salvamento.</p>
                  ) : historico.map((snap) => (
                    <div key={snap.id} className="editor-modal-item">
                      <div>
                        <strong>{snap.label}</strong>
                        <span>{snap.timestamp}</span>
                      </div>
                      <button
                        type="button"
                        className="editor-button is-quiet"
                        onClick={() => {
                          registrar();
                          try { aplicarEstado(JSON.parse(snap.data)); } catch {}
                          setMostrarHistorico(false);
                        }}
                      >
                        Restaurar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </DragDropProvider>
  );
}
