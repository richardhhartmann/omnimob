import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowCounterClockwise, ArrowLeft, ArrowsClockwise, ChatsCircle, Check, Checks, Clock, Headset,
  Lock, MagnifyingGlass, MapPin, NavigationArrow, PaperPlaneRight, Paperclip, Tag, User, WarningCircle,
} from "@phosphor-icons/react";
import { adminApi } from "../../api";
import { TextoDoChamado } from "../../components/TextoDoChamado.jsx";
import { comprimirImagem, imagensDaAreaDeTransferencia } from "../../utils/imagemDoChamado";
import { catalogoDeTelas, comMencoes, consultaDoArroba, filtrarTelas } from "../../utils/mencoes";
import { ROTULO_CATEGORIA } from "../../utils/suporte";
import { uploadToCloudinary } from "../../utils/uploadToCloudinary";
import { printComoArquivo } from "../../utils/capturarTela";

/* ────────────────────────────────────────────────────────────────────────────
   A CAIXA DE ENTRADA DO SUPORTE — no desenho do WhatsApp Web: as conversas à
   esquerda, a conversa aberta à direita, e a resposta sai dali mesmo. Porte da
   aba de chamados do VYA (`vya_chamados.js`).

   Do outro lado desta tela está o modal de Ajuda dentro do painel de cada
   imobiliária (`components/AjudaModal.jsx`). O que ele grava chega aqui.

   ── AS DECISÕES ──

   1. A ORDEM VEM DO SERVIDOR. `GET /api/admin/chamados` já devolve a fila
      ordenada pelo que espera resposta NOSSA (e, dentro disso, pela
      prioridade que o plano compra). Reordenar aqui seria decidir duas vezes.

   2. A LISTA VEM INTEIRA, O FILTRO É LOCAL. São no máximo 400 registros;
      trocar de filtro é instantâneo.

   3. A CONVERSA É SOB DEMANDA, guardada pelo número de QUEM PEDIU — não pelo
      que volta do servidor. Uma resposta lenta de um chamado que já não está
      na tela não pode desenhar por cima do que está.

   4. QUEM RESPONDE APARECE. O suporte é uma equipe: cada balão do nosso lado
      leva o nome de quem escreveu, e a caixa de escrever diz "Respondendo
      como <você>" — é esse nome que o cliente vai ver.

   5. "@" CITA UMA TELA (`utils/mencoes.js`). A escolhida entra legível na
      caixa e, ao enviar, vira a menção que o cliente clica em Meus chamados.

   6. O CARGO MANDA. Sem `resolverChamado` a caixa de escrever vira um aviso e
      os botões de resolver e reabrir somem. As rotas conferem de novo — isto
      aqui é só não oferecer o que vai ser recusado.
   ──────────────────────────────────────────────────────────────────────────── */

const STATUS = {
  ABERTO:             { rotulo: "Aberto",             cor: "#a5b4fc", fundo: "rgba(129,140,248,0.14)" },
  EM_ATENDIMENTO:     { rotulo: "Em atendimento",     cor: "#fbbf24", fundo: "rgba(251,191,36,0.14)" },
  AGUARDANDO_CLIENTE: { rotulo: "Aguardando cliente", cor: "#f9a8d4", fundo: "rgba(244,114,182,0.14)" },
  RESOLVIDO:          { rotulo: "Resolvido",          cor: "#86efac", fundo: "rgba(52,211,153,0.14)" },
};
/* De quem é a vez. Decide o selo "sua vez" e o contador da aba: um chamado
   AGUARDANDO_CLIENTE não é trabalho nosso parado. */
const NOSSA_VEZ = { ABERTO: true, EM_ATENDIMENTO: true };
const PLANO = { PREMIUM: "Premium", PROFISSIONAL: "Profissional", BASICO: "Básico" };
const PRIORIDADE = { URGENTE: "urgente", ALTA: "alta", MEDIA: "média", BAIXA: "baixa" };

const FILTROS = [
  { id: "abertos", rotulo: "Em aberto" },
  { id: "nossa", rotulo: "Nossa vez" },
  { id: "resolvidos", rotulo: "Resolvidos" },
  { id: "todos", rotulo: "Todos" },
];

/* As cores dos nomes nos balões e dos avatares, como nos grupos do WhatsApp:
   a mesma pessoa (ou imobiliária) sempre com a mesma cor. */
const CORES = ["#f59e0b", "#34d399", "#60a5fa", "#f472b6", "#a78bfa", "#fb923c", "#2dd4bf", "#facc15", "#f87171", "#818cf8"];
const FUNDOS = ["#7c4a03", "#065f46", "#1e40af", "#9d174d", "#5b21b6", "#9a3412", "#115e59", "#854d0e", "#991b1b", "#3730a3"];
const MAX_ANEXOS = 3;

function hash(s) {
  let h = 0;
  for (const ch of String(s || "")) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}
const corDe = (s) => CORES[hash(s) % CORES.length];
const fundoDe = (s) => FUNDOS[hash(s) % FUNDOS.length];

function iniciais(nome) {
  const partes = String(nome || "").trim().split(/[\s._-]+/).filter(Boolean);
  if (!partes.length) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2);
  return partes[0][0] + partes[1][0];
}

const data = (iso) => { const d = iso ? new Date(iso) : null; return d && !Number.isNaN(d.getTime()) ? d : null; };
const mesmoDia = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const hora = (iso) => data(iso)?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) || "";

/* A hora da lista, como no WhatsApp: hoje a hora, ontem "Ontem", na semana o
   dia, e daí para trás a data. */
function quandoCurto(iso) {
  const d = data(iso);
  if (!d) return "";
  const hoje = new Date();
  if (mesmoDia(d, hoje)) return hora(iso);
  const ontem = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1);
  if (mesmoDia(d, ontem)) return "Ontem";
  if ((hoje - d) / 86400000 < 7) return d.toLocaleDateString("pt-BR", { weekday: "long" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function rotuloDoDia(d) {
  const hoje = new Date();
  if (mesmoDia(d, hoje)) return "Hoje";
  const ontem = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1);
  if (mesmoDia(d, ontem)) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function Selo({ status }) {
  const m = STATUS[status] || STATUS.ABERTO;
  return <span className="wa-selo" style={{ color: m.cor, background: m.fundo }}>{m.rotulo}</span>;
}

/* Quem atendeu este chamado, pelos nomes nas falas do suporte. */
function atendidoPor(c) {
  const nomes = [];
  for (const m of c?.conversa || []) {
    if (m.autorTipo === "SUPORTE" && m.autorNome && !nomes.includes(m.autorNome)) nomes.push(m.autorNome);
  }
  if (nomes.length <= 1) return nomes[0] || "";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}`;
}

/* A descrição é a PRIMEIRA fala do cliente: separada da conversa, o problema
   seria lido num lugar e as respostas em outro. */
function falasDe(c) {
  return [
    {
      id: "abertura",
      autorTipo: "CLIENTE",
      autorNome: c.interno ? c.abertoPor || "Equipe" : c.usuario,
      texto: c.descricao,
      prints: c.prints,
      criadoEm: c.criadoEm,
    },
    ...(c.conversa || []),
  ];
}

export function AdminChamadosPage({ aoContar, ativa = true, tenantSlug = "" }) {
  const [todos, setTodos] = useState([]);
  const [porStatus, setPorStatus] = useState({});
  const [internosAbertos, setInternosAbertos] = useState(0);
  const [eu, setEu] = useState({ nome: "Suporte Omnimob", podeResponder: false, podeResolver: false, veInternos: false });
  const [carregouUmaVez, setCarregouUmaVez] = useState(false);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [erroLista, setErroLista] = useState("");
  const [filtro, setFiltro] = useState("abertos");
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState(null);       // número da conversa na tela
  const [conversas, setConversas] = useState({});   // número → chamado com a conversa
  const [erroConversa, setErroConversa] = useState("");
  const [pendente, setPendente] = useState(null);   // a fala otimista, enquanto sobe
  const [enviando, setEnviando] = useState(false);
  const [mudandoStatus, setMudandoStatus] = useState(false);
  const [erroEnvio, setErroEnvio] = useState("");
  const [texto, setTexto] = useState("");
  const [anexos, setAnexos] = useState([]);         // { blob, dataUrl }
  const [arroba, setArroba] = useState(null);       // { inicio, fim, itens, ativo }
  const [lupa, setLupa] = useState(null);

  const rascunhos = useRef({});
  const pedidoDaConversa = useRef(0);
  const carregandoRef = useRef(false);
  const caixaRef = useRef(null);
  const fioRef = useRef(null);
  const waRef = useRef(null);
  const arquivoRef = useRef(null);
  const forcarFim = useRef(false);
  const telas = useMemo(() => catalogoDeTelas(), []);

  /* ── A LISTA ─────────────────────────────────────────────────────────── */
  const carregarLista = useCallback(async (silencioso = false) => {
    if (carregandoRef.current) return;
    carregandoRef.current = true;
    if (!silencioso) { setErroLista(""); setCarregandoLista(true); }
    try {
      const d = await adminApi.listChamados();
      setTodos(d.chamados || []);
      setPorStatus(d.porStatus || {});
      setInternosAbertos(Number(d.internosAbertos || 0));
      if (d.eu) setEu(d.eu);
      setCarregouUmaVez(true);
      setErroLista("");
    } catch (e) {
      if (!silencioso) setErroLista(e.message || "Erro ao carregar os chamados.");
    } finally {
      carregandoRef.current = false;
      setCarregandoLista(false);
    }
  }, []);

  useEffect(() => { carregarLista(false); }, [carregarLista]);

  const nossos = (porStatus.ABERTO || 0) + (porStatus.EM_ATENDIMENTO || 0);
  const totalGeral = Object.values(porStatus).reduce((a, n) => a + (n || 0), 0);
  const emAberto = totalGeral - (porStatus.RESOLVIDO || 0);
  // O número da aba é o que espera a gente — é ele que diz que chegou trabalho.
  useEffect(() => { if (carregouUmaVez) aoContar?.(nossos); }, [nossos, carregouUmaVez, aoContar]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return todos.filter((c) => {
      // O cliente em foco: o contador do menu continua o de todos.
      if (tenantSlug && c.tenantSlug !== tenantSlug) return false;
      if (filtro === "abertos" && c.resolvido) return false;
      if (filtro === "nossa" && !NOSSA_VEZ[c.status]) return false;
      if (filtro === "resolvidos" && !c.resolvido) return false;
      if (filtro === "internos" && !c.interno) return false;
      if (!termo) return true;
      return [c.titulo, c.tenantNome, c.tenantSlug, c.usuario, c.abertoPor].some((v) => String(v || "").toLowerCase().includes(termo))
        || String(c.numero) === termo.replace(/^#|^n[ºo°]?\s*/, "");
    });
  }, [todos, filtro, busca, tenantSlug]);

  /* Uma resposta do servidor atualiza a conversa guardada e a linha da lista
     — sempre pelo número do PEDIDO. */
  const guardar = useCallback((numero, chamado) => {
    if (!chamado) return;
    setConversas((x) => ({ ...x, [numero]: chamado }));
    setTodos((lista) => lista.map((c) => (c.numero === numero
      ? { ...c, status: chamado.status, resolvido: chamado.resolvido, atualizadoEm: chamado.atualizadoEm, titulo: chamado.titulo, mensagens: (chamado.conversa || []).length }
      : c)));
  }, []);

  /* ── A CONVERSA ──────────────────────────────────────────────────────── */
  const atualizarConversa = useCallback(async (numero, silencioso) => {
    const meu = ++pedidoDaConversa.current;
    try {
      const c = await adminApi.lerChamado(numero);
      guardar(numero, c);
      if (meu === pedidoDaConversa.current && !silencioso) { setErroConversa(""); forcarFim.current = true; }
    } catch (e) {
      if (!silencioso && meu === pedidoDaConversa.current) setErroConversa(e.message || "Não consegui carregar a conversa.");
    }
  }, [guardar]);

  function abrir(numero) {
    if (aberta != null && aberta !== numero) rascunhos.current[aberta] = texto;
    setAberta(numero);
    setTexto(rascunhos.current[numero] || "");
    setAnexos([]);
    setPendente(null);
    setErroEnvio("");
    setErroConversa("");
    setArroba(null);
    forcarFim.current = true;
    atualizarConversa(numero, false);
    if (window.matchMedia?.("(pointer: fine)").matches) setTimeout(() => caixaRef.current?.focus(), 0);
  }

  function fechar() {
    if (aberta != null) rascunhos.current[aberta] = texto;
    setAberta(null);
    setArroba(null);
  }

  /* As duas colunas rolam por dentro; a caixa inteira mede o que sobra da
     janela abaixo do topo dela. Sem isso a página rolaria as duas juntas. */
  useLayoutEffect(() => {
    function ajustar() {
      const el = waRef.current;
      if (!el) return;
      const topo = el.getBoundingClientRect().top + window.scrollY;
      el.style.height = `${Math.max(480, Math.floor(window.innerHeight - topo - 22))}px`;
    }
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
    // `ativa`: escondida, a aba mede topo 0; a altura certa só sai ao reaparecer.
  }, [carregouUmaVez, ativa]);

  /* A conversa aberta e a fila se atualizam sozinhas: a conversa a cada 15 s,
     a fila a cada 30 s — o contador da aba é o que avisa que chegou trabalho. */
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden || !ativa || aberta == null || enviando) return;
      atualizarConversa(aberta, true);
    }, 15000);
    return () => clearInterval(id);
  }, [aberta, enviando, atualizarConversa, ativa]);
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) carregarLista(true); }, 30000);
    return () => clearInterval(id);
  }, [carregarLista]);

  const atual = aberta != null ? conversas[aberta] || todos.find((c) => c.numero === aberta) || null : null;
  const temConversa = aberta != null && Boolean(conversas[aberta]);

  /* Quem estava lendo mais acima não é arrastado para baixo por uma
     atualização automática; quem estava no fim acompanha a conversa. */
  const noFim = useRef(true);
  const aoRolarFio = () => {
    const f = fioRef.current;
    if (f) noFim.current = f.scrollHeight - f.scrollTop - f.clientHeight < 80;
  };
  useLayoutEffect(() => {
    const f = fioRef.current;
    if (!f) return;
    if (forcarFim.current || noFim.current) { f.scrollTop = f.scrollHeight; forcarFim.current = false; }
  });

  /* ── ESCREVER E ENVIAR ───────────────────────────────────────────────── */
  function autoAltura() {
    const c = caixaRef.current;
    if (!c) return;
    c.style.height = "auto";
    c.style.height = `${Math.min(c.scrollHeight + 2, 160)}px`;
  }
  useLayoutEffect(autoAltura, [texto, aberta]);

  async function anexar(arquivos) {
    const lista = [...(arquivos || [])].filter((a) => String(a?.type).startsWith("image/"));
    if (!lista.length) return;
    const espaco = MAX_ANEXOS - anexos.length;
    if (espaco <= 0) { setErroEnvio(`Até ${MAX_ANEXOS} imagens por mensagem.`); return; }
    try {
      const novas = await Promise.all(lista.slice(0, espaco).map((a) => comprimirImagem(a)));
      setAnexos((x) => [...x, ...novas].slice(0, MAX_ANEXOS));
      setErroEnvio(lista.length > espaco ? `Até ${MAX_ANEXOS} imagens por mensagem.` : "");
    } catch (e) {
      setErroEnvio(e.message);
    }
  }

  async function enviar() {
    if (enviando || aberta == null || !eu.podeResponder) return;
    const numero = aberta;
    const limpo = texto.trim();
    if (!limpo) {
      if (anexos.length) setErroEnvio("Escreva uma mensagem para acompanhar a imagem.");
      caixaRef.current?.focus();
      return;
    }
    const final = comMencoes(limpo, telas);
    const mandando = anexos;
    setArroba(null);
    setEnviando(true);
    setErroEnvio("");
    setTexto("");
    rascunhos.current[numero] = "";
    setAnexos([]);
    setPendente({ autorTipo: "SUPORTE", autorNome: eu.nome, texto: final, prints: mandando.map((a) => a.dataUrl), criadoEm: new Date().toISOString(), estado: "enviando" });
    forcarFim.current = true;
    try {
      /* As imagens sobem do navegador para o Cloudinary, como no lado do
         cliente; o chamado guarda só a URL. */
      const prints = [];
      for (const a of mandando) {
        // eslint-disable-next-line no-await-in-loop
        const r = await uploadToCloudinary(printComoArquivo(a.blob, "suporte"));
        if (r?.url) prints.push(r.url);
      }
      const r = await adminApi.responderChamado(numero, final, prints);
      guardar(numero, r.chamado);
      setPendente(null);
      carregarLista(true);
    } catch (e) {
      /* O texto volta para a caixa: perder o que se escreveu por uma falha de
         rede seria o pior desfecho possível. */
      setPendente((p) => (p ? { ...p, estado: "falhou" } : p));
      setTexto((t) => t || limpo);
      setAnexos(mandando);
      setErroEnvio(`Não foi enviada: ${e.message}`);
    } finally {
      setEnviando(false);
    }
  }

  async function mudarStatus(status) {
    if (aberta == null) return;
    const numero = aberta;
    setMudandoStatus(true);
    try {
      const r = await adminApi.atualizarChamado(numero, { status });
      guardar(numero, r.chamado);
      forcarFim.current = true;
      carregarLista(true);
    } catch (e) {
      setErroEnvio(e.message || "Não foi possível atualizar.");
    } finally {
      setMudandoStatus(false);
    }
  }

  /* ── O "@": CITAR UMA TELA ───────────────────────────────────────────── */
  function atualizarArroba(valor, cursor) {
    const q = consultaDoArroba(valor, cursor, telas);
    if (!q) { setArroba(null); return; }
    const itens = filtrarTelas(q.consulta, telas);
    setArroba(itens.length ? { inicio: q.inicio, fim: q.fim, itens, ativo: 0 } : null);
  }

  function escolherTela(i) {
    const c = caixaRef.current;
    if (!arroba || !c || !arroba.itens[i]) return;
    const t = arroba.itens[i];
    const antes = texto.slice(0, arroba.inicio);
    const depois = texto.slice(arroba.fim).replace(/^ /, "");
    const inserido = `@${t.rotulo} `;
    const novo = antes + inserido + depois;
    setTexto(novo);
    setArroba(null);
    const pos = (antes + inserido).length;
    requestAnimationFrame(() => { c.focus(); c.setSelectionRange(pos, pos); });
  }

  function aoTeclar(e) {
    if (arroba?.itens.length) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const passo = e.key === "ArrowDown" ? 1 : -1;
        setArroba((a) => ({ ...a, ativo: (a.ativo + passo + a.itens.length) % a.itens.length }));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); escolherTela(arroba.ativo); return; }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setArroba(null); return; }
    }
    /* Enter envia, Shift+Enter quebra a linha — como no WhatsApp. Durante a
       composição de acentos (IME) o Enter é do teclado, não nosso. */
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      enviar();
    }
  }

  // A lupa fecha no Esc.
  useEffect(() => {
    if (!lupa) return undefined;
    const fecharLupa = (e) => { if (e.key === "Escape") setLupa(null); };
    document.addEventListener("keydown", fecharLupa);
    return () => document.removeEventListener("keydown", fecharLupa);
  }, [lupa]);

  /* ── DESENHO ─────────────────────────────────────────────────────────── */
  function balao(m, anterior, estado) {
    if (m.autorTipo === "SISTEMA") {
      return <div key={m.id} className="wa-nota"><span>{m.texto}</span></div>;
    }
    const lado = m.autorTipo === "SUPORTE" ? "suporte" : "cliente";
    const nome = m.autorNome || (lado === "suporte" ? "Suporte Omnimob" : "Cliente");
    const seguida = Boolean(
      anterior && anterior.autorTipo === m.autorTipo && anterior.autorNome === m.autorNome
      && data(m.criadoEm) && data(anterior.criadoEm) && data(m.criadoEm) - data(anterior.criadoEm) < 5 * 60000,
    );
    return (
      <div key={m.id || `p-${m.criadoEm}`} className={`wa-msg wa-msg--${lado}${seguida ? " is-seguida" : ""}`}>
        <div className={`wa-balao${estado === "enviando" ? " is-enviando" : estado === "falhou" ? " is-falhou" : ""}`}>
          {seguida ? null : (
            <span className="wa-balao__autor" style={{ "--cor": lado === "suporte" ? "#a5b4fc" : corDe(nome) }}>
              {nome}{lado === "suporte" ? <small>suporte</small> : null}
            </span>
          )}
          {m.prints?.length ? (
            <div className="wa-balao__anexos">
              {m.prints.map((src, i) => (
                <button key={src.slice(-32) + i} type="button" onClick={() => setLupa(src)}>
                  <img src={src} alt="Anexo" loading="lazy" />
                </button>
              ))}
            </div>
          ) : null}
          <div className="wa-balao__texto"><TextoDoChamado texto={m.texto} abrirEmNovaAba className="wa-tela" /></div>
          <span className="wa-balao__hora">
            {hora(m.criadoEm)}
            {estado === "enviando" ? <Clock size={11} /> : estado === "falhou" ? <WarningCircle size={11} color="#f87171" /> : lado === "suporte" ? <Checks size={12} /> : null}
          </span>
        </div>
      </div>
    );
  }

  function fio(c) {
    const saida = [];
    let diaAnterior = null;
    let anterior = null;
    for (const m of falasDe(c)) {
      const d = data(m.criadoEm);
      if (d && (!diaAnterior || !mesmoDia(d, diaAnterior))) {
        saida.push(<div key={`dia-${d.toDateString()}`} className="wa-dia"><span>{rotuloDoDia(d)}</span></div>);
        diaAnterior = d;
        anterior = null;
      }
      saida.push(balao(m, anterior));
      anterior = m;
    }
    if (pendente) saida.push(balao({ ...pendente, id: "pendente" }, anterior, pendente.estado));
    return saida;
  }

  const filtros = eu.veInternos ? [...FILTROS, { id: "internos", rotulo: "Internos", interno: true }] : FILTROS;

  return (
    <div className={`wa${aberta != null ? " is-conversa" : ""}`} ref={waRef}>
      {/* ── A coluna das conversas ── */}
      <aside className="wa-lista">
        <header className="wa-lista__topo">
          <div className="wa-lista__titulo">
            <strong>Chamados</strong>
            <small>
              {!carregouUmaVez ? "carregando…"
                : nossos ? <><b>{nossos} esperando a gente</b> · {emAberto} em aberto</>
                  : emAberto ? `${emAberto} em aberto · nenhum esperando a gente` : "tudo em dia"}
            </small>
          </div>
          <button
            type="button"
            className={`wa-icone-btn${carregandoLista ? " is-girando" : ""}`}
            title="Atualizar"
            onClick={() => { carregarLista(false); if (aberta != null) atualizarConversa(aberta, true); }}
          >
            <ArrowsClockwise size={16} />
          </button>
        </header>
        <label className="wa-busca">
          <MagnifyingGlass size={13} />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar imobiliária, assunto, pessoa ou nº…"
            autoComplete="off"
          />
        </label>
        <div className="wa-filtros" role="group" aria-label="Filtro de chamados">
          {filtros.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`wa-chip${f.interno ? " is-interno" : ""}${filtro === f.id ? " is-on" : ""}`}
              onClick={() => setFiltro(f.id)}
            >
              {f.rotulo}
              {f.interno && internosAbertos ? <span className="wa-chip__n">{internosAbertos}</span> : null}
            </button>
          ))}
        </div>
        {!carregouUmaVez && carregandoLista ? <p className="wa-estado">Carregando os chamados…</p> : null}
        {erroLista ? <p className="wa-estado wa-estado--erro">{erroLista}</p> : null}
        {carregouUmaVez && !visiveis.length ? (
          <p className="wa-estado">{busca.trim() ? "Nenhum chamado com essa busca." : "Nenhum chamado por aqui."}</p>
        ) : null}
        <ul className="wa-conversas">
          {visiveis.map((c) => {
            const quem = c.interno ? (c.abertoPor ? `${c.abertoPor} (equipe)` : "Equipe") : c.usuario || "—";
            return (
              <li
                key={c.numero}
                className={`wa-item${NOSSA_VEZ[c.status] ? " is-nossa" : ""}${aberta === c.numero ? " is-ativo" : ""}`}
                onClick={() => abrir(c.numero)}
                onKeyDown={(e) => { if (e.key === "Enter") abrir(c.numero); }}
                tabIndex={0}
              >
                <span className="wa-avatar" style={{ "--cor": fundoDe(c.tenantSlug || c.tenantNome) }}>{iniciais(c.tenantNome)}</span>
                <div className="wa-item__corpo">
                  <div className="wa-item__linha">
                    <span className="wa-item__nome">{c.tenantNome}</span>
                    {c.interno ? <span className="wa-tag">Interno</span> : null}
                    <span className="wa-item__hora">{quandoCurto(c.atualizadoEm || c.criadoEm)}</span>
                  </div>
                  <div className="wa-item__linha">
                    <span className="wa-item__titulo"><b>#{c.numero}</b> · {c.titulo}</span>
                    {NOSSA_VEZ[c.status]
                      ? <span className="wa-vez" title="Esperando resposta da equipe">sua vez</span>
                      : c.resolvido ? <Checks size={13} className="wa-ok" aria-label="Resolvido" /> : null}
                  </div>
                  <div className="wa-item__linha">
                    <span className="wa-item__sub">{quem} · {ROTULO_CATEGORIA[c.categoria] || c.categoria}</span>
                    <Selo status={c.status} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* ── A conversa ── */}
      <section className="wa-chat">
        {aberta == null || !atual ? (
          <div className="wa-chat__vazio">
            <ChatsCircle size={48} weight="duotone" />
            <strong>Selecione um chamado</strong>
            <span>A conversa abre aqui, e a resposta sai direto para o cliente.</span>
          </div>
        ) : (
          <>
            <header className="wa-chat__topo">
              <button type="button" className="wa-icone-btn wa-voltar" title="Voltar" onClick={fechar}><ArrowLeft size={16} /></button>
              <span className="wa-avatar wa-avatar--p" style={{ "--cor": fundoDe(atual.tenantSlug || atual.tenantNome) }}>{iniciais(atual.tenantNome)}</span>
              <div className="wa-chat__quem">
                <strong>{atual.tenantNome} · #{atual.numero} — {atual.titulo}</strong>
                <small>{atual.tenantSlug}</small>
              </div>
              <div className="wa-chat__acoes">
                <Selo status={atual.status} />
                {eu.podeResolver ? (
                  atual.resolvido ? (
                    <button type="button" className="wa-acao" disabled={mudandoStatus} onClick={() => mudarStatus("ABERTO")}>
                      <ArrowCounterClockwise size={13} /> Reabrir
                    </button>
                  ) : (
                    <button type="button" className="wa-acao wa-acao--ok" disabled={mudandoStatus} onClick={() => mudarStatus("RESOLVIDO")}>
                      <Check size={13} weight="bold" /> Resolver
                    </button>
                  )
                ) : null}
              </div>
            </header>
            <div className="wa-chat__info">
              {atual.interno ? (
                <>
                  <span className="wa-tag">Interno</span>
                  <span>aberto por <b>{atual.abertoPor || "equipe"}</b> (na conta de {atual.tenantNome})</span>
                </>
              ) : (
                <span><User size={11} /> <b>{atual.usuario || "—"}</b></span>
              )}
              <span><Tag size={11} /> {ROTULO_CATEGORIA[atual.categoria] || atual.categoria || "—"}</span>
              {/* De quem é o chamado e quanto ele pesa na fila: sem isto, uma
                  dúvida no topo parece erro até se ver que é de um Premium. */}
              <span>{PLANO[atual.tenantPlano] || atual.tenantPlano} · prioridade {PRIORIDADE[atual.prioridade] || "média"}</span>
              {atual.rota ? <span><MapPin size={11} /> aconteceu em <code>{atual.rota}</code></span> : null}
              {atendidoPor(conversas[aberta]) ? <span><Headset size={11} /> atendido por <b>{atendidoPor(conversas[aberta])}</b></span> : null}
            </div>

            <div className="wa-fio" ref={fioRef} onScroll={aoRolarFio}>
              {erroConversa ? <p className="wa-estado wa-estado--erro">{erroConversa}</p>
                : !temConversa ? <p className="wa-estado">Carregando a conversa…</p>
                  : fio(conversas[aberta])}
            </div>

            {eu.podeResponder ? (
              <footer className="wa-compor">
                <div className="wa-compor__quem">
                  <Headset size={13} />
                  <span>Respondendo como <strong>{eu.nome}</strong></span>
                  {atual.resolvido ? <span className="wa-compor__aviso">Responder reabre o chamado</span> : null}
                </div>
                {anexos.length ? (
                  <div className="wa-compor__anexos">
                    {anexos.map((a, i) => (
                      <span key={a.dataUrl.slice(-24) + i} className="wa-compor__anexo">
                        <img src={a.dataUrl} alt="" />
                        <button type="button" title="Remover" onClick={() => setAnexos((x) => x.filter((_, j) => j !== i))}>×</button>
                      </span>
                    ))}
                  </div>
                ) : null}
                {arroba ? (
                  <div className="wa-arroba" role="listbox" onMouseDown={(e) => e.preventDefault()}>
                    <div className="wa-arroba__topo"><NavigationArrow size={11} weight="fill" /> Citar uma tela · ↑↓ escolhe, Enter confirma</div>
                    {arroba.itens.map((t, i) => (
                      <button
                        key={t.caminho}
                        type="button"
                        role="option"
                        aria-selected={i === arroba.ativo}
                        className={`wa-arroba__item${i === arroba.ativo ? " is-ativo" : ""}`}
                        onClick={() => escolherTela(i)}
                      >
                        <strong>{t.titulo}</strong>
                        <small>{t.grupo ? `${t.grupo} · ${t.caminho}` : t.caminho}</small>
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="wa-compor__linha">
                  <button type="button" className="wa-icone-btn" title="Anexar imagem (ou cole com Ctrl+V)" onClick={() => arquivoRef.current?.click()}>
                    <Paperclip size={18} />
                  </button>
                  <input ref={arquivoRef} type="file" accept="image/*" multiple hidden onChange={(e) => { anexar(e.target.files); e.target.value = ""; }} />
                  <textarea
                    ref={caixaRef}
                    rows={1}
                    value={texto}
                    placeholder={`Escreva para ${atual.tenantNome}… (@ cita uma tela · Enter envia · Shift+Enter quebra a linha)`}
                    onChange={(e) => {
                      setTexto(e.target.value);
                      rascunhos.current[aberta] = e.target.value;
                      atualizarArroba(e.target.value, e.target.selectionStart);
                    }}
                    onKeyDown={aoTeclar}
                    onBlur={() => setTimeout(() => setArroba(null), 120)}
                    onPaste={(e) => {
                      const imagens = imagensDaAreaDeTransferencia(e);
                      if (imagens.length) { e.preventDefault(); anexar(imagens); }
                    }}
                  />
                  <button type="button" className="wa-enviar" title="Enviar (Enter)" disabled={enviando} onClick={enviar}>
                    <PaperPlaneRight size={17} weight="fill" />
                  </button>
                </div>
                {erroEnvio ? <p className="wa-erro-envio">{erroEnvio}</p> : null}
              </footer>
            ) : (
              <footer className="wa-compor is-leitura"><Lock size={14} /> Seu cargo pode ler os chamados, mas não responder.</footer>
            )}
          </>
        )}
      </section>

      {/* A lupa das imagens: cresce aqui mesmo, sem tirar ninguém da fila. */}
      {lupa ? (
        <div className="wa-lupa" onClick={() => setLupa(null)} role="presentation">
          <img src={lupa} alt="Anexo" />
        </div>
      ) : null}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   CHAMADOS — o desenho do WhatsApp Web

   Duas colunas: as conversas à esquerda, a conversa aberta à direita. A altura
   é a da janela (medida no componente), e cada coluna rola por dentro — a
   lista não anda quando se lê a conversa, e vice-versa.

   Balões: o cliente à esquerda, o suporte à direita, cada um com o NOME de
   quem escreveu e a hora no canto. As anotações de sistema ("Resolvido por
   …") são pílulas no meio, como os avisos do WhatsApp.

   Os botões levam `.dl-root` na frente porque o styles.css global estiliza
   `button` e `input` por elemento, e venceria a classe solta.
   ════════════════════════════════════════════════════════════════════════════ */
export const CHAMADOS_CSS = `
.wa {
  --wa-fundo: #0c0c0e;
  --wa-painel: var(--surface);
  --wa-barra: #17171b;
  --wa-entrada: #1c1c21;
  --wa-saida: #2b2c63;
  --wa-saida-borda: rgba(129, 140, 248, 0.28);
  position: relative;
  display: grid; grid-template-columns: minmax(300px, 370px) minmax(0, 1fr);
  height: calc(100vh - 150px); min-height: 480px;
  border: 1px solid var(--line); border-radius: 16px; overflow: hidden;
  background: var(--wa-painel);
}

/* ── A coluna das conversas ── */
.wa-lista { display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--line); background: var(--wa-painel); }
.wa-lista__topo {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 14px 16px; background: var(--wa-barra); border-bottom: 1px solid var(--line);
}
.wa-lista__titulo { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.wa-lista__titulo strong { font-size: 15px; color: var(--strong); letter-spacing: -0.015em; }
.wa-lista__titulo small { font-size: 11.5px; color: var(--placeholder); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wa-lista__titulo small b { color: var(--gold); font-weight: 700; }
.dl-root .wa-icone-btn {
  flex: none; width: 34px; height: 34px; padding: 0; border-radius: 999px; border: 0;
  background: transparent; color: var(--subtle); cursor: pointer; box-shadow: none; transform: none;
  display: inline-flex; align-items: center; justify-content: center;
  transition: background 0.15s ease, color 0.15s ease;
}
.dl-root .wa-icone-btn:hover { background: rgba(255, 255, 255, 0.07); color: var(--strong); box-shadow: none; transform: none; }
.dl-root .wa-icone-btn:disabled { opacity: 0.4; cursor: default; }
.wa-icone-btn.is-girando svg { animation: waGira 0.8s linear infinite; }
@keyframes waGira { to { transform: rotate(360deg); } }

.wa-busca {
  display: flex; align-items: center; gap: 10px; margin: 10px 12px 6px; padding: 0 12px;
  border-radius: 10px; background: var(--bg-alt); border: 1px solid var(--line); color: var(--placeholder);
}
.dl-root .wa-busca input {
  flex: 1; height: 36px; border: 0; background: transparent; padding: 0; box-shadow: none;
  color: var(--strong); font-family: inherit; font-size: 12.5px; outline: none;
}
.wa-filtros { display: flex; gap: 6px; padding: 4px 12px 10px; flex-wrap: wrap; border-bottom: 1px solid var(--line-soft); }
.dl-root .wa-chip {
  width: auto; display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 12px; border-radius: 999px; border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.03); color: var(--subtle); box-shadow: none; transform: none;
  font-family: inherit; font-size: 11.5px; font-weight: 600; cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.dl-root .wa-chip:hover { color: var(--strong); border-color: rgba(255, 255, 255, 0.16); box-shadow: none; transform: none; }
.dl-root .wa-chip.is-on { background: rgba(99, 102, 241, 0.16); border-color: rgba(129, 140, 248, 0.45); color: #e0e7ff; }
.dl-root .wa-chip.is-interno.is-on { background: rgba(212, 175, 55, 0.14); border-color: rgba(212, 175, 55, 0.4); color: #f3e2a4; }
.wa-chip__n {
  min-width: 17px; height: 17px; padding: 0 5px; border-radius: 999px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--gold); color: #17130a; font-size: 10px; font-weight: 800;
}
.wa-estado { margin: 0; padding: 28px 18px; text-align: center; font-size: 12.5px; color: var(--placeholder); }
.wa-estado--erro { color: var(--danger); }

.wa-conversas { list-style: none; margin: 0; padding: 0; flex: 1; min-height: 0; overflow-y: auto; }
.wa-item {
  position: relative; display: flex; align-items: center; gap: 12px;
  padding: 11px 14px 11px 12px; cursor: pointer; outline: none;
  border-bottom: 1px solid var(--line-soft);
  transition: background 0.12s ease;
}
.wa-item:hover, .wa-item:focus-visible { background: rgba(255, 255, 255, 0.035); }
.wa-item.is-ativo { background: rgba(99, 102, 241, 0.12); }
.wa-item.is-ativo::before { content: ""; position: absolute; left: 0; top: 8px; bottom: 8px; width: 3px; border-radius: 0 3px 3px 0; background: var(--accent-soft); }
.wa-avatar {
  flex: none; width: 44px; height: 44px; border-radius: 999px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--cor, #3f3f46); color: #fff;
  font-size: 14px; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}
.wa-avatar--p { width: 38px; height: 38px; font-size: 13px; }
.wa-item__corpo { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.wa-item__linha { display: flex; align-items: center; gap: 8px; min-width: 0; }
.wa-item__nome { flex: 1; min-width: 0; font-size: 13.5px; font-weight: 600; color: var(--strong); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wa-item__hora { flex: none; font-size: 11px; color: var(--placeholder); font-variant-numeric: tabular-nums; }
.wa-item.is-nossa .wa-item__hora { color: var(--gold); font-weight: 600; }
.wa-item__titulo { flex: 1; min-width: 0; font-size: 12.5px; color: var(--subtle); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wa-item__titulo b { color: var(--default); font-weight: 600; }
.wa-item__sub { flex: 1; min-width: 0; font-size: 11.5px; color: var(--placeholder); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wa-vez {
  flex: none; min-width: 20px; height: 20px; padding: 0 7px; border-radius: 999px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--gold); color: #17130a; font-size: 10px; font-weight: 800; letter-spacing: 0.02em;
}
.wa-ok { flex: none; color: var(--mint); }
.wa-tag {
  flex: none; display: inline-flex; align-items: center; gap: 4px;
  padding: 1px 7px; border-radius: 999px; font-size: 9.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
  background: rgba(212, 175, 55, 0.14); color: #e8cf7a; border: 1px solid rgba(212, 175, 55, 0.3);
}
.wa-selo {
  flex: none; display: inline-flex; align-items: center; gap: 5px;
  padding: 2px 8px; border-radius: 999px; font-size: 10.5px; font-weight: 600; white-space: nowrap;
}

/* ── A conversa ── */
.wa-chat { position: relative; display: flex; flex-direction: column; min-width: 0; min-height: 0; background: var(--wa-fundo); }
/* O fundo "de papel" do WhatsApp, em pontos discretos: sem ele a conversa é um
   vazio preto e os balões flutuam sem chão. */
.wa-chat::before {
  content: ""; position: absolute; inset: 0; pointer-events: none; opacity: 0.55;
  background-image: radial-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1.3px);
  background-size: 18px 18px;
}
.wa-chat > * { position: relative; }
.wa-chat__vazio {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  padding: 30px; text-align: center; color: var(--placeholder);
}
.wa-chat__vazio svg { color: #2e2e36; margin-bottom: 8px; }
.wa-chat__vazio strong { font-size: 17px; color: var(--default); font-weight: 600; }
.wa-chat__vazio span { font-size: 12.5px; max-width: 320px; line-height: 1.55; }

.wa-chat__topo {
  flex: none; display: flex; align-items: center; gap: 12px;
  padding: 10px 16px; background: var(--wa-barra); border-bottom: 1px solid var(--line);
}
.dl-root .wa-voltar { display: none; }
.wa-chat__quem { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.wa-chat__quem strong { font-size: 14px; color: var(--strong); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wa-chat__quem small { font-size: 11.5px; color: var(--placeholder); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wa-chat__acoes { flex: none; display: flex; align-items: center; gap: 8px; }
.dl-root .wa-acao {
  width: auto; display: inline-flex; align-items: center; gap: 7px; height: 32px; padding: 0 13px;
  border-radius: 999px; border: 1px solid var(--line); background: rgba(255, 255, 255, 0.04); box-shadow: none; transform: none;
  color: var(--default); font-family: inherit; font-size: 12px; font-weight: 600; cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
.dl-root .wa-acao:hover { background: rgba(255, 255, 255, 0.08); color: var(--strong); box-shadow: none; transform: none; }
.dl-root .wa-acao--ok { border-color: rgba(52, 211, 153, 0.35); color: #6ee7b7; background: rgba(52, 211, 153, 0.08); }
.dl-root .wa-acao--ok:hover { background: rgba(52, 211, 153, 0.16); color: #a7f3d0; }
.dl-root .wa-acao:disabled { opacity: 0.5; cursor: default; }

.wa-chat__info {
  flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px;
  padding: 7px 16px; font-size: 11.5px; color: var(--placeholder);
  background: rgba(23, 23, 27, 0.85); border-bottom: 1px solid var(--line-soft);
}
.wa-chat__info span { display: inline-flex; align-items: center; gap: 6px; }
.wa-chat__info code {
  font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 10.5px;
  padding: 1px 6px; border-radius: 5px; background: rgba(255, 255, 255, 0.05); color: var(--subtle);
}
.wa-chat__info b { color: var(--default); font-weight: 600; }

.wa-fio { flex: 1; min-height: 0; overflow-y: auto; padding: 16px 7% 18px; display: flex; flex-direction: column; gap: 2px; }
.wa-dia { align-self: center; margin: 10px 0 8px; }
.wa-dia span {
  display: inline-block; padding: 4px 11px; border-radius: 8px;
  background: #1c1c21; color: var(--subtle); font-size: 11px; font-weight: 600;
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.35);
}
.wa-nota { align-self: center; margin: 8px 0; max-width: 80%; text-align: center; }
.wa-nota span {
  display: inline-block; padding: 5px 12px; border-radius: 8px;
  background: rgba(212, 175, 55, 0.1); color: #e8cf7a; font-size: 11.5px; line-height: 1.45;
  border: 1px solid rgba(212, 175, 55, 0.2);
}
.wa-msg { display: flex; margin-top: 8px; }
.wa-msg.is-seguida { margin-top: 2px; }
.wa-msg--suporte { justify-content: flex-end; }
.wa-balao {
  position: relative; max-width: min(640px, 72%); min-width: 96px;
  padding: 6px 9px 7px 10px; border-radius: 9px;
  background: var(--wa-entrada); color: var(--default);
  font-size: 13.5px; line-height: 1.5;
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.04);
}
.wa-msg--suporte .wa-balao { background: var(--wa-saida); border-color: var(--wa-saida-borda); color: #eef0ff; }
/* O rabinho do balão, só na primeira fala de uma sequência. */
.wa-msg:not(.is-seguida) .wa-balao::before {
  content: ""; position: absolute; top: 0; width: 10px; height: 12px;
  background: inherit; border-top: inherit;
}
.wa-msg--cliente:not(.is-seguida) .wa-balao { border-top-left-radius: 0; }
.wa-msg--cliente:not(.is-seguida) .wa-balao::before { left: -8px; clip-path: polygon(100% 0, 0 0, 100% 100%); }
.wa-msg--suporte:not(.is-seguida) .wa-balao { border-top-right-radius: 0; }
.wa-msg--suporte:not(.is-seguida) .wa-balao::before { right: -8px; clip-path: polygon(0 0, 100% 0, 0 100%); }
.wa-balao__autor { display: block; margin-bottom: 2px; font-size: 12px; font-weight: 700; color: var(--cor, var(--accent-soft)); }
.wa-balao__autor small { font-weight: 500; color: var(--placeholder); margin-left: 4px; }
.wa-balao__texto { white-space: pre-wrap; word-wrap: break-word; overflow-wrap: anywhere; }
.dl-root .wa-balao__texto a { color: #93c5fd; text-decoration: underline; }
/* A hora "flutua" no fim da última linha, como no WhatsApp: um espaço
   invisível reserva o lugar dela no texto. */
.wa-balao__texto::after { content: ""; display: inline-block; width: 52px; }
.wa-balao__hora {
  position: absolute; right: 9px; bottom: 5px;
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10.5px; color: rgba(255, 255, 255, 0.45); font-variant-numeric: tabular-nums;
}
.wa-msg--suporte .wa-balao__hora { color: rgba(224, 231, 255, 0.6); }
.wa-balao.is-enviando { opacity: 0.7; }
.wa-balao.is-falhou { border-color: rgba(248, 113, 113, 0.55); }
.wa-balao__anexos { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 4px; margin: 2px 0 6px; }
.dl-root .wa-balao__anexos button {
  display: block; width: 100%; padding: 0; border: 0; border-radius: 7px; overflow: hidden; cursor: zoom-in; background: #000; box-shadow: none; transform: none;
}
.wa-balao__anexos img { display: block; width: 100%; max-height: 220px; object-fit: cover; }

/* A menção de uma tela: um selo que abre a tela (aba nova). */
.dl-root .wa-balao__texto a.wa-tela {
  display: inline-flex; align-items: center; gap: 6px; margin: 0 1px; padding: 1px 9px 1px 8px;
  border-radius: 999px; font-size: 12.5px; font-weight: 600; text-decoration: none; vertical-align: 1px;
  background: rgba(129, 140, 248, 0.16); color: #c7d2fe; border: 1px solid rgba(129, 140, 248, 0.35);
  transition: background 0.15s ease;
}
.dl-root .wa-balao__texto a.wa-tela:hover { background: rgba(129, 140, 248, 0.28); color: #fff; }
.dl-root .wa-msg--suporte .wa-balao__texto a.wa-tela { background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.22); color: #eef0ff; }

/* ── Quem responde, e a caixa de escrever ── */
.wa-compor { position: relative; flex: none; padding: 8px 14px 12px; background: var(--wa-barra); border-top: 1px solid var(--line); }
/* O "@": a lista das telas, por cima da caixa. */
.wa-arroba {
  position: absolute; left: 14px; right: 14px; bottom: calc(100% - 4px); z-index: 5;
  max-height: 320px; overflow-y: auto; padding: 5px;
  border-radius: 12px; background: var(--surface-2); border: 1px solid var(--line);
  box-shadow: 0 24px 60px -20px rgba(0, 0, 0, 0.9);
}
.wa-arroba__topo {
  display: flex; align-items: center; gap: 7px; padding: 6px 9px 8px;
  font-size: 10.5px; color: var(--placeholder); letter-spacing: 0.02em;
}
.dl-root .wa-arroba__item {
  display: flex; flex-direction: column; align-items: flex-start; gap: 1px; width: 100%;
  padding: 7px 10px; border: 0; border-radius: 8px; background: transparent; cursor: pointer; box-shadow: none; transform: none;
  font-family: inherit; text-align: left;
}
.wa-arroba__item strong { font-size: 13px; font-weight: 600; color: var(--strong); }
.wa-arroba__item small { font-size: 11px; color: var(--placeholder); }
.dl-root .wa-arroba__item:hover, .dl-root .wa-arroba__item.is-ativo { background: rgba(99, 102, 241, 0.16); box-shadow: none; transform: none; }
.wa-arroba__item.is-ativo strong { color: #e0e7ff; }
.wa-compor__quem { display: flex; align-items: center; gap: 7px; margin: 0 0 7px 4px; font-size: 11.5px; color: var(--placeholder); }
.wa-compor__quem strong { color: var(--accent-soft); font-weight: 700; }
.wa-compor__aviso { margin-left: auto; color: #e8cf7a; }
.wa-compor__anexos { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 8px 4px; }
.wa-compor__anexo { position: relative; width: 64px; height: 64px; border-radius: 9px; overflow: hidden; border: 1px solid var(--line); }
.wa-compor__anexo img { width: 100%; height: 100%; object-fit: cover; }
.dl-root .wa-compor__anexo button {
  position: absolute; top: 3px; right: 3px; width: 20px; height: 20px; padding: 0; border-radius: 999px; border: 0;
  background: rgba(0, 0, 0, 0.7); color: #fff; font-size: 12px; line-height: 1; cursor: pointer; box-shadow: none; transform: none;
}
.wa-compor__linha { display: flex; align-items: flex-end; gap: 8px; }
.dl-root .wa-compor textarea {
  /* border-box: com content-box o min-height somava ao padding e a caixa
     vazia nascia com 90px. */
  box-sizing: border-box;
  flex: 1; min-height: 42px; max-height: 160px; resize: none;
  padding: 11px 14px; border-radius: 12px; box-shadow: none;
  background: var(--wa-entrada); border: 1px solid var(--line); color: var(--strong);
  font-family: inherit; font-size: 13.5px; line-height: 1.45; outline: none;
}
.dl-root .wa-compor textarea:focus { border-color: rgba(129, 140, 248, 0.55); }
.dl-root .wa-compor .wa-icone-btn { width: 42px; height: 42px; }
.dl-root .wa-enviar {
  flex: none; width: 42px; height: 42px; padding: 0; border-radius: 999px; border: 0; box-shadow: none;
  background: var(--accent); color: #fff; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  transition: background 0.15s ease, transform 0.15s ease, opacity 0.15s ease;
}
.dl-root .wa-enviar:hover { background: #575ce0; box-shadow: none; }
.dl-root .wa-enviar:active { transform: scale(0.94); }
.dl-root .wa-enviar:disabled { opacity: 0.45; cursor: default; }
.wa-compor.is-leitura {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 16px; font-size: 12.5px; color: var(--placeholder);
}
.wa-erro-envio { margin: 6px 0 0 4px; font-size: 12px; color: var(--danger); }

/* A lupa das imagens. */
.wa-lupa {
  position: fixed; inset: 0; z-index: 200; display: flex; align-items: center; justify-content: center;
  padding: 32px; background: rgba(5, 5, 6, 0.9); cursor: zoom-out;
}
.wa-lupa img { max-width: 100%; max-height: 100%; border-radius: 10px; box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.9); }

/* Estreito: uma coluna por vez, como no celular. */
@media (max-width: 900px) {
  .wa { grid-template-columns: 1fr; }
  .wa .wa-chat { display: none; }
  .wa.is-conversa .wa-lista { display: none; }
  .wa.is-conversa .wa-chat { display: flex; }
  .dl-root .wa-voltar { display: inline-flex; }
  .wa-fio { padding: 12px 10px 14px; }
  .wa-balao { max-width: 88%; }
}
`;

export default AdminChamadosPage;
