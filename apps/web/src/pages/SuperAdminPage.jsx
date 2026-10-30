import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Buildings, ChartPieSlice, ClipboardText, ClockCounterClockwise, EnvelopeSimple, GraduationCap, IdentificationBadge, Key, Lifebuoy, Megaphone, ShieldCheck, Sparkle, Star, UserPlus, UsersThree } from "@phosphor-icons/react";
import { api, adminApi, setApiToken } from "../api";
import { saveSession } from "../session";
import { AdminShell } from "../components/AdminShell";
import { useConfirm } from "../components/ConfirmModal";
import { SelectCustom } from "../components/SelectCustom";
import { PLANOS } from "../utils/planos";
import { enderecoVisivel } from "../utils/enderecoVitrine";
import { slugify, motivoLocal, MOTIVO_SLUG } from "../utils/slug";
import { AdminChamadosPage, CHAMADOS_CSS } from "./admin/AdminChamadosPage";
import { AdminTutoriaisPage, TUTORIAIS_CSS } from "./admin/AdminTutoriaisPage";
import { AdminSegurancaPage, SEGURANCA_CSS } from "./admin/AdminSegurancaPage";
import { AdminUsuariosPage, USUARIOS_CSS } from "./admin/AdminUsuariosPage";
import { AdminCargosPage, CARGOS_CSS } from "./admin/AdminCargosPage";
import { AdminVersoesPage, VERSOES_CSS } from "./admin/AdminVersoesPage";
import { AdminAuditoriaPage, AUDITORIA_CSS } from "./admin/AdminAuditoriaPage";
import { AdminAvaliacoesPage, AVALIACOES_CSS } from "./admin/AdminAvaliacoesPage";
import { AdminNovidadesPage, NOVIDADES_CSS } from "./admin/AdminNovidadesPage";
import { AdminUsoPage, USO_CSS } from "./admin/AdminUsoPage";
import { AdminInteressadosPage, INTERESSADOS_CSS } from "./admin/AdminInteressadosPage";
import { AdminComunicadosPage, COMUNICADOS_CSS } from "./admin/AdminComunicadosPage";
import { AdminEmailsPage } from "./admin/AdminEmailsPage";
import { AdminAcessosPage, ACESSOS_CSS } from "./admin/AdminAcessosPage";
import {
  ACCENT_SOFT,
  Alert,
  Button,
  Eyebrow,
  Field,
  MINT,
  Reveal,
  StatValue,
  useReveal,
} from "../styles/omnimobKit";

/* Painel super-admin — mesma identidade da landing: fundo quase-preto, topbar
   de vidro, grid de hairline com contagem progressiva, micro-labels em mono e
   botões pill. A lógica é a mesma de antes; só a camada visual mudou. */

const STATUS_META = {
  TRIAL: { label: "Trial", color: "#a5b4fc", bg: "rgba(129,140,248,0.14)", border: "rgba(129,140,248,0.30)" },
  EM_DIA: { label: "Em dia", color: "#86efac", bg: "rgba(52,211,153,0.14)", border: "rgba(52,211,153,0.30)" },
  ATRASADO: { label: "Atrasado", color: "#fca5a5", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.30)" },
  CANCELADO: { label: "Cancelado", color: "#cbd5e1", bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.25)" },
};
const STATUS_OPCOES = Object.keys(STATUS_META);

/* O plano deixou de ser texto livre: escrever "Profissional" com acento, sem
   acento ou abreviado gerava tenants que o `planoMiddleware` não reconhece e
   que caem no Básico sem ninguém perceber. A lista é a mesma de `planos.js`, e
   o resumo sai dos próprios flags do plano para não desencontrar da tabela. */
const PLANO_OPCOES = PLANOS.map((p) => ({
  value: p.key,
  label: p.nome,
  color: p.cor,
  description:
    [p.redes && "redes sociais", p.tour360 && "tour 360°", p.ia && "IA"].filter(Boolean).join(" · ") ||
    "recursos essenciais",
}));

const EMPTY_FORM = {
  name: "", slug: "", email: "", whatsapp: "", plano: "",
  statusPagamento: "TRIAL", valorMensal: "", proximoVencimento: "",
  /* O add-on do Omnimob Flow. Nasce DESLIGADO, e é o padrão certo: este campo
     decide o que a conta paga, e um esquecimento com o padrão invertido entrega
     o módulo de graça. */
  temFlow: false,
};

// ─── Endereço da vitrine ─────────────────────────────────────────────────────
/* Mesmo comportamento do cadastro da landing (`TrialModal`): o slug nasce do
   nome, não é digitado, e a disponibilidade aparece enquanto se escreve. Duas
   portas de entrada que compusessem o endereço de formas diferentes dariam
   endereços diferentes para o mesmo nome. */
const ESPERA_SLUG = 450;
const SLUG_VAZIO = { valor: "", estado: "vazio", mensagem: "" };
/* O endereço mostrado enquanto se digita o nome. Sai da mesma função que
   monta o link de verdade: quando o subdomínio for ligado, esta tela passa a
   anunciar `imobiliaria.omnimob.app` sem ninguém lembrar de vir aqui. */
const SELO_SLUG = {
  vazio: "",
  checando: "verificando…",
  livre: "✓ disponível",
  indisponivel: "✕ indisponível",
  erro: "não verificado",
};

function fmtMoney(v) {
  if (v == null || v === "") return "—";
  return `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(v) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("pt-BR");
}
function toDateInput(v) {
  if (!v) return "";
  return new Date(v).toISOString().slice(0, 10);
}

// Grid de métricas com um observer só: os quatro números contam juntos
// enquanto as células entram em cascata.
function StatsGrid({ stats, pronto }) {
  const [ref, visivel] = useReveal();
  const CELULAS = [
    { label: "Tenants", value: stats.total, cor: "var(--strong)" },
    { label: "Em dia", value: stats.emDia, cor: MINT },
    { label: "Atrasados", value: stats.atrasado, cor: "#fca5a5" },
    { label: "Trial", value: stats.trial, cor: ACCENT_SOFT },
  ];

  return (
    <div className="dl-grid-hair dl-grid-hair--4 sa-stats" ref={ref}>
      {CELULAS.map((c, i) => (
        <div
          key={c.label}
          className={`dl-reveal${visivel ? " is-visible" : ""} dl-cell dl-stat`}
          style={{ transitionDelay: `${i * 110}ms` }}
        >
          <span className="dl-mono dl-index">[{String(i + 1).padStart(2, "0")}]</span>
          <strong className="dl-stat__n" style={{ color: c.cor }}>
            <StatValue raw={String(c.value)} ativo={visivel && pronto} />
          </strong>
          <span className="dl-stat__l">{c.label}</span>
        </div>
      ))}
    </div>
  );
}

/* Abas do painel. A ordem é a da rotina: primeiro quem são os clientes, depois
   o que eles estão pedindo, depois se eles entenderam o produto.

   Cada aba tem a PERMISSÃO que a abre (`permissao`, a coluna do cargo). Aba
   sem permissão some do menu — não fica desabilitada — e não abre por estado:
   ver `abasPermitidas` abaixo. Quem decide de verdade é o servidor, rota a
   rota; aqui é só para não desenhar uma porta que dá em 403. */
const ABAS = [
  {
    chave: "tenants",
    permissao: "verTenants",
    rotulo: "Tenants",
    nota: "imobiliárias provisionadas, cobrança e provisionamento",
    icone: <Buildings size={16} />,
  },
  {
    chave: "chamados",
    permissao: "verChamados",
    rotulo: "Chamados",
    nota: "suporte aberto pelo botão de Ajuda dentro dos painéis",
    icone: <Lifebuoy size={16} />,
  },
  {
    chave: "tutoriais",
    permissao: "verTutoriais",
    rotulo: "Tutoriais",
    nota: "quanto do tour cada pessoa percorreu",
    icone: <GraduationCap size={16} />,
  },
  {
    chave: "avaliacoes",
    permissao: "verAvaliacoes",
    rotulo: "Avaliações",
    nota: "o que os usuários acham do painel",
    icone: <Star size={16} />,
  },
  {
    chave: "novidades",
    permissao: "verNovidades",
    rotulo: "Novidades",
    nota: "a apresentação semanal para os clientes",
    icone: <Sparkle size={16} />,
  },
  {
    chave: "comunicados",
    permissao: "verComunicados",
    rotulo: "Comunicados",
    nota: "o aviso avulso, para um cliente ou para todos",
    icone: <Megaphone size={16} />,
  },
  {
    chave: "uso",
    permissao: "verUso",
    rotulo: "Controle de Uso",
    nota: "quem usa, quem esfriou e quem parou",
    icone: <ChartPieSlice size={16} />,
  },
  {
    chave: "interessados",
    permissao: "verInteressados",
    rotulo: "Interessados",
    nota: "quem pediu contato comercial pela landing",
    icone: <UserPlus size={16} />,
  },
  {
    chave: "emails",
    permissao: "verEmails",
    rotulo: "E-mails",
    nota: "quem usa o painel sem e-mail cadastrado",
    icone: <EnvelopeSimple size={16} />,
  },
  {
    chave: "acessos",
    permissao: "verAcessos",
    rotulo: "Contas e acesso",
    nota: "sessões abertas, convites pendentes e Google",
    icone: <Key size={16} />,
  },
  /* Sem permissão própria (`null`): todo cargo do painel vê. É a primeira
     pergunta do suporte — "isso já estava no ar quando o cliente reclamou?". */
  {
    chave: "versoes",
    permissao: null,
    rotulo: "Versionamento",
    nota: "as versões da Omnimob e o que cada uma mudou",
    icone: <ClockCounterClockwise size={16} />,
  },
  /* Quem opera a plataforma, e o que cada um alcança. Depois das abas de
     rotina e antes da conta própria: é gestão, não operação. */
  {
    chave: "usuarios",
    permissao: "verUsuarios",
    rotulo: "Usuários",
    nota: "quem entra neste painel e com qual cargo",
    icone: <UsersThree size={16} />,
  },
  {
    chave: "cargos",
    permissao: "verCargos",
    rotulo: "Cargos",
    nota: "permissões por aba e por ação",
    icone: <IdentificationBadge size={16} />,
  },
  {
    chave: "auditoria",
    permissao: "verAuditoria",
    rotulo: "Auditoria",
    nota: "quem da Omnimob mexeu em usuários e cargos",
    icone: <ClipboardText size={16} />,
  },
  /* Por último, e é o lugar certo: não é rotina, é a conta de quem opera. Só
     se mexe nela ao trocar de celular ou ao ligar o segundo fator. */
  {
    chave: "seguranca",
    permissao: "verSeguranca",
    rotulo: "Segurança",
    nota: "verificação em duas etapas desta conta",
    icone: <ShieldCheck size={16} />,
  },
];

/* `permissoes` nulo é "ainda não sei" (antes do `/eu`): nem a aba livre aparece,
   senão um cargo vazio veria o Versionamento piscar antes do aviso de vazio. */
/* ── O CLIENTE EM FOCO (porte do painel do VYA) ──
   Mora no endereço (`?cliente=<slug>`): recarregar ou mandar o link mantém. As
   abas com dado de cliente mostram só o dele; as da equipe dizem que não mudam.
   Abas fora deste mapa: "mostrando só o que é deste cliente". */
const NOTA_DO_FOCO = {
  tenants: "A lista mostra só este cliente.",
  novidades: "A apresentação é a mesma para todos; o Quem viu mostra só as pessoas deste cliente.",
  interessados: "Esta aba é do site da Omnimob e não muda com o cliente.",
  comunicados: "O formulário já vem para este cliente; a lista mostra todos os avisos.",
  versoes: "As versões são da Omnimob inteira e não mudam com o cliente.",
  usuarios: "Esta aba é da equipe da Omnimob e não muda com o cliente.",
  cargos: "Esta aba é da equipe da Omnimob e não muda com o cliente.",
  auditoria: "A trilha é da equipe da Omnimob e não muda com o cliente.",
  seguranca: "Esta aba é da sua conta e não muda com o cliente.",
};

const abasPermitidas = (permissoes) =>
  permissoes ? ABAS.filter((a) => a.permissao === null || permissoes[a.permissao]) : [];

export function SuperAdminPage({ session, onLogout }) {
  const navegar = useNavigate();
  /* Quem sou e o que alcanço. Começa com o que veio no login (para o primeiro
     quadro não piscar vazio) e é RELIDO do servidor ao abrir: um rebaixamento
     feito ontem precisa aparecer hoje, e a sessão guardada não sabe dele. */
  const [eu, setEu] = useState(() => ({
    id: session?.id || null,
    cargoId: session?.cargoId ?? null,
    permissoes: session?.permissoes || null,
    versao: null,
    catalogo: null,
  }));
  const permissoes = eu.permissoes || {};
  const abasVisiveis = abasPermitidas(eu.permissoes);
  /* A aba mora no endereço (`?aba=`): F5 volta nela, e um link — o de um
     e-mail de chamado, por exemplo — abre direto onde precisa. */
  const [abaEscolhida, setAbaEscolhida] = useState(() => new URLSearchParams(window.location.search).get("aba") || "tenants");
  function setAba(chave) {
    setAbaEscolhida(chave);
    const url = new URL(window.location.href);
    url.searchParams.set("aba", chave);
    window.history.replaceState(null, "", url);
  }
  /* A aba escolhida só vale se o cargo a alcança; senão cai na primeira que
     alcança. O endereço é só um pedido: o cargo continua decidindo. */
  const aba = abasVisiveis.some((a) => a.chave === abaEscolhida) ? abaEscolhida : abasVisiveis[0]?.chave;
  /* Cada aba monta na primeira vez que abre e depois fica montada, escondida:
     a resposta pela metade num chamado ou a busca digitada não se perdem numa
     ida e volta (o mesmo do painel do VYA). */
  const [montadas, setMontadas] = useState(() => new Set());
  const [focoSlug, setFocoSlug] = useState(() => new URLSearchParams(window.location.search).get("cliente") || "");
  function focar(slug) {
    setFocoSlug(slug);
    const url = new URL(window.location.href);
    if (slug) url.searchParams.set("cliente", slug);
    else url.searchParams.delete("cliente");
    window.history.replaceState(null, "", url);
  }
  useEffect(() => {
    if (aba) setMontadas((m) => (m.has(aba) ? m : new Set(m).add(aba)));
  }, [aba]);
  const painel = (chave, conteudo) =>
    montadas.has(chave) && abasVisiveis.some((a) => a.chave === chave) ? (
      <section key={chave} hidden={aba !== chave}>{conteudo}</section>
    ) : null;

  useEffect(() => {
    adminApi.eu()
      .then((r) => setEu({ id: r.id, cargoId: r.cargoId ?? null, permissoes: r.permissoes, versao: r.versao || null, catalogo: r.catalogo || null }))
      .catch((err) => {
        /* Acesso encerrado (desativado, token velho): sai avisando, em vez de
           deixar a tela cheia de 401. */
        if (err?.status === 401) onLogout?.();
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Contado pela aba de chamados quando ela carrega, e exibido no menu — é o
  // único número do painel que pede ação imediata.
  const [chamadosAbertos, setChamadosAbertos] = useState(0);
  // Avaliação não lida: o mesmo princípio do contador de chamados.
  const [avaliacoesNovas, setAvaliacoesNovas] = useState(0);
  // Interessado esperando contato: trabalho do comercial, como chamado aberto.
  const [interessadosNovos, setInteressadosNovos] = useState(0);

  const { confirm, modal: confirmModal } = useConfirm();
  // Qual imobiliária está abrindo agora. Trava o botão daquela linha, e só dela.
  const [entrando, setEntrando] = useState(null);
  /* A senha recém-gerada, para o cartão que a mostra. Some ao fechar, e não
     volta: o texto não é guardado em lugar nenhum além do hash. */
  const [senhaGerada, setSenhaGerada] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  /* Endereço derivado do nome. estado: "vazio" | "checando" | "livre" |
     "indisponivel" | "erro" */
  const [slug, setSlug] = useState(SLUG_VAZIO);
  /* Credenciais do admin recém-criado. Só existem nesta resposta — depois disto
     o banco guarda apenas o hash —, então o modal para no lugar e mostra o que
     precisa ser repassado à imobiliária. */
  const [criado, setCriado] = useState(null);
  /* Ativação manual (ver o bloco no rodapé do modal de edição). `ativacao`
     guarda o que o SERVIDOR gravou — data, valor e módulos —, e não o que a
     tela pediu: a conta da data é dele. */
  const [periodoAtivacao, setPeriodoAtivacao] = useState("mensal");
  const [ativando, setAtivando] = useState(false);
  const [ativacao, setAtivacao] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setTenants(await adminApi.listTenants());
    } catch (err) {
      setError(err.message || "Erro ao carregar tenants.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (permissoes.verTenants) load();
  }, [permissoes.verTenants]);

  /* O contador do menu é buscado na entrada, não quando a aba de chamados
     abre: um badge que só aparece depois de você clicar no item não avisa
     nada. Conta o que espera resposta NOSSA (Aberto + Em atendimento) — um
     chamado aguardando o cliente não é trabalho parado. Sai dos contadores
     do servidor, que não sofrem o corte da lista. */
  useEffect(() => {
    if (!permissoes.verChamados) return;
    adminApi.listChamados({ resolvido: false })
      .then((r) => setChamadosAbertos((r.porStatus?.ABERTO || 0) + (r.porStatus?.EM_ATENDIMENTO || 0)))
      .catch(() => {});
  }, [permissoes.verChamados]);
  useEffect(() => {
    if (!permissoes.verAvaliacoes) return;
    adminApi.listAvaliacoes({ naoLidas: "1", limit: 1 }).then((r) => setAvaliacoesNovas(r.naoLidas || 0)).catch(() => {});
  }, [permissoes.verAvaliacoes]);
  useEffect(() => {
    if (!permissoes.verInteressados) return;
    adminApi.listInteressados({ pendentes: "1", limit: 1 }).then((r) => setInteressadosNovos(r.pendentes || 0)).catch(() => {});
  }, [permissoes.verInteressados]);

  /* O que dá para julgar sem rede (tamanho, caracteres, nomes reservados) é
     julgado na hora; só o "esse já é de alguém" pergunta ao servidor, e espera
     a digitação parar. A resposta anterior é abortada a cada tecla, então uma
     consulta lenta nunca sobrescreve uma mais nova. Na edição não roda: o slug
     de um tenant existente não muda, mesmo que o nome mude. */
  const nomeDigitado = form.name;
  useEffect(() => {
    if (!modalOpen || editingId || criado) return undefined;

    const bruto = nomeDigitado.trim();
    const valor = slugify(bruto);

    if (bruto.length < 2) {
      setSlug({ valor, estado: "vazio", mensagem: "" });
      return undefined;
    }

    const motivo = motivoLocal(bruto);
    if (motivo) {
      setSlug({ valor, estado: "indisponivel", mensagem: MOTIVO_SLUG[motivo] });
      return undefined;
    }

    setSlug({ valor, estado: "checando", mensagem: "" });

    const controle = new AbortController();
    const timer = setTimeout(() => {
      api
        .verificarSlugOmnimob(bruto, { signal: controle.signal })
        .then((r) =>
          setSlug({
            valor: r.slug || valor,
            estado: r.disponivel ? "livre" : "indisponivel",
            mensagem: r.mensagem || "",
          }),
        )
        .catch((erro) => {
          if (erro.name === "AbortError") return;
          // Sem resposta não dá para afirmar nada, e travar o cadastro por causa
          // de uma consulta que caiu seria pior: o servidor confere de novo no
          // envio.
          setSlug({ valor, estado: "erro", mensagem: "" });
        });
    }, ESPERA_SLUG);

    return () => {
      clearTimeout(timer);
      controle.abort();
    };
  }, [modalOpen, editingId, criado, nomeDigitado]);

  /* Planos fora da lista aparecem como estão: tenants criados antes do combo
     têm o plano escrito à mão, e abrir o cadastro para mexer no vencimento não
     pode trocar silenciosamente o plano de quem já paga. */
  const planoOpcoes = useMemo(() => {
    if (!form.plano || PLANO_OPCOES.some((o) => o.value === form.plano)) return PLANO_OPCOES;
    return [...PLANO_OPCOES, { value: form.plano, label: form.plano, description: "valor atual, fora da lista" }];
  }, [form.plano]);

  const stats = useMemo(() => {
    const by = (s) => tenants.filter((t) => t.statusPagamento === s).length;
    return { total: tenants.length, emDia: by("EM_DIA"), atrasado: by("ATRASADO"), trial: by("TRIAL") };
  }, [tenants]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const doFoco = focoSlug ? tenants.filter((t) => t.slug === focoSlug) : tenants;
    if (!q) return doFoco;
    return doFoco.filter((t) => `${t.name} ${t.slug} ${t.email}`.toLowerCase().includes(q));
  }, [tenants, search, focoSlug]);
  // O nome chega com a lista; até lá (ou se o slug sumiu dela), o próprio slug.
  const foco = focoSlug ? tenants.find((t) => t.slug === focoSlug) || { id: "", slug: focoSlug, name: focoSlug } : null;

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setSlug(SLUG_VAZIO);
    setCriado(null);
    setAtivacao(null);
    setModalOpen(true);
  }

  function openEdit(t) {
    setEditingId(t.id);
    setForm({
      name: t.name || "", slug: t.slug || "", email: t.email || "", whatsapp: t.whatsapp || "",
      plano: t.plano || "", statusPagamento: t.statusPagamento || "TRIAL",
      temFlow: Array.isArray(t.modulos) && t.modulos.includes("FLOW"),
      valorMensal: t.valorMensal ?? "", proximoVencimento: toDateInput(t.proximoVencimento),
    });
    setFormError("");
    setSlug(SLUG_VAZIO);
    setCriado(null);
    setAtivacao(null);
    setModalOpen(true);
  }

  function fecharModal() {
    setModalOpen(false);
    setCriado(null);
  }

  function setField(k, v) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  /* ── Ativar a conta à mão, como se a assinatura tivesse sido paga ─────────

     A tela NÃO calcula a data nem o valor. Ela escolhe o período, e quem faz as
     duas contas é a rota — a mesma `fidelizarTrial` do caminho pago. Uma cópia
     da regra aqui divergiria da de lá no primeiro ajuste, e o sintoma seria uma
     conta que vence num dia diferente do que o painel prometeu.

     Depois de ativar, o formulário é REESCRITO com o que voltou. Sem isso, um
     "Salvar" logo em seguida mandaria de volta o status e o vencimento antigos
     que ainda estavam nos campos — desfazendo em silêncio o que acabou de ser
     feito. */
  async function ativarComoPago() {
    const anual = periodoAtivacao === "anual";
    const ok = await confirm(
      `Ativar ${form.name || "esta imobiliária"} como paga por ${anual ? "12 meses" : "1 mês"}?

` +
        "A conta passa a EM_DIA, volta a ficar ativa e sai da fila de remoção, sem nenhuma " +
        "cobrança no provedor. O período é somado ao vencimento atual quando ele ainda está no " +
        "futuro. Fica registrado no Registro de Atividade da imobiliária, com o seu e-mail.",
      anual ? "Ativar por 12 meses" : "Ativar por 1 mês",
      "primary",
    );
    if (!ok) return;

    setAtivando(true);
    setFormError("");
    try {
      const r = await adminApi.fidelizarTenant(editingId, {
        plano: form.plano || undefined,
        periodo: periodoAtivacao,
        /* A lista completa, como no salvar: o servidor grava o array inteiro. */
        modulos: form.temFlow ? ["HUB", "FLOW"] : ["HUB"],
      });
      setAtivacao(r.ativacao || null);
      setForm((prev) => ({
        ...prev,
        statusPagamento: "EM_DIA",
        plano: r.ativacao?.plano || prev.plano,
        valorMensal: r.ativacao?.valorMensal ?? prev.valorMensal,
        proximoVencimento: toDateInput(r.ativacao?.ate) || prev.proximoVencimento,
      }));
      await load();
    } catch (err) {
      setFormError(err.message || "Não foi possível ativar a conta.");
    } finally {
      setAtivando(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    // O botão já fica desligado nestes casos; a trava aqui é para o Enter, que
    // envia o formulário sem passar por ele.
    if (!editingId && (slug.estado === "indisponivel" || slug.estado === "checando")) return;
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        name: form.name, email: form.email, whatsapp: form.whatsapp, plano: form.plano,
        statusPagamento: form.statusPagamento,
        /* Sempre a lista COMPLETA, e não só o que mudou: o servidor grava o
           array inteiro, então mandar apenas `["FLOW"]` tiraria o Hub da conta.
           O Hub é garantido do lado de lá também (`modulosDoCorpo`), mas mandar
           certo daqui é o que mantém a intenção legível. */
        modulos: form.temFlow ? ["HUB", "FLOW"] : ["HUB"],
        valorMensal: form.valorMensal === "" ? null : Number(form.valorMensal),
        proximoVencimento: form.proximoVencimento || null,
      };
      if (editingId) {
        await adminApi.updateTenant(editingId, payload);
        setModalOpen(false);
        await load();
      } else {
        // O slug não vai no envio: quem o compõe é o servidor, a partir do nome.
        const res = await adminApi.createTenant(payload);
        // O modal não fecha — as credenciais do admin só existem nesta resposta.
        setCriado({ slug: res.slug, admin: res.admin || null, warning: res.warning || "" });
        await load();
      }
    } catch (err) {
      setFormError(err.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  /* ── Entrar na conta como o Administrador dela ─────────────────────────────

     PERGUNTA ANTES, e não é cerimônia: a ação deixa registro na trilha da
     imobiliária, com nome e hora. Quem clica precisa saber disso ANTES de
     clicar — descobrir depois, pelo cliente perguntando "quem entrou aqui
     ontem?", é a pior ordem possível.

     A sessão do super-admin NÃO é apagada. Ela vive noutra chave do
     `localStorage` (`adminRequest` usa a sua, `saveSession` a do painel), então
     sair da imobiliária devolve o super-admin de onde ele estava. */
  async function entrarComo(t) {
    /* `confirm` é posicional aqui — (mensagem, rótulo, tom) —, a mesma forma
       que `handleDelete` usa. Tom "primary" e não "danger": entrar não destrói
       nada, e pintar de vermelho o que não apaga gasta o vermelho. */
    const ok = await confirm(
      `Entrar em ${t.name} como o Administrador dela?

` +
        "A sessão dura 2 horas. O acesso fica registrado no Registro de Atividade da imobiliária, " +
        "com o seu e-mail e a hora — e tudo que você fizer lá dentro será gravado como se fosse " +
        "o Administrador dela.",
      "Entrar",
      "primary",
    );
    if (!ok) return;

    setEntrando(t.id);
    setError("");
    try {
      const sessao = await adminApi.entrarNoTenant(t.id);
      /* A ordem importa: grava, aponta o cliente HTTP para o token novo, e só
         então navega. Navegar antes faria a primeira tela pedir dados com o
         token que ainda não existe. */
      saveSession(sessao);
      setApiToken(sessao.token);
      /* Recarrega em vez de `navegar("/")`: a sessão do painel é lida uma vez,
         na montagem do `App`, e trocá-la por baixo de uma árvore já montada
         deixaria metade da tela com os dados do super-admin. */
      window.location.assign("/");
    } catch (err) {
      /* ── A CONTA AINDA NÃO TEM SENHA DEFINIDA ────────────────────────────

         A imobiliária nasce com uma senha temporária que aparece UMA vez, no
         modal da criação. Fechar aquele modal e clicar em "Entrar" deixava a
         conta num beco: o super-admin entrava, e o cliente ficava sem forma
         nenhuma de acessar — a senha tinha se perdido.

         Agora o servidor recusa entrar nesse estado (a exigência de trocar a
         senha temporária existe justamente porque ela viajou), e a saída é
         reemitir: uma temporária nova, mostrada uma vez, que o cliente é
         obrigado a trocar no primeiro acesso. Ninguém aqui fica sabendo a
         senha real de ninguém. */
      if (err?.body?.precisaDefinirSenha) {
        setEntrando(null);
        const gerar = await confirm(
          `${t.name} ainda não definiu a senha do Administrador, então não dá para entrar na conta ` +
            "— a exigência de trocar a senha temporária existe justamente porque ela viajou. " +
            "Quer gerar uma nova senha temporária para passar ao cliente? Ela aparece uma vez só, " +
            "e ele terá de trocá-la no primeiro acesso.",
          "Gerar nova senha",
          "primary",
        );
        if (gerar) await reemitirSenha(t);
        return;
      }
      setError(err.message);
      setEntrando(null);
    }
  }

  /* Reemite a senha temporária do Administrador. Serve para o caso acima e para
     o chamado mais comum de todos — "o cliente perdeu o acesso e não recebe o
     e-mail de recuperação" —, que até aqui não tinha resposta nenhuma. */
  async function reemitirSenha(t) {
    setEntrando(t.id);
    try {
      const r = await adminApi.reemitirSenhaAdmin(t.id);
      setSenhaGerada({ tenant: t.name, ...r });
    } catch (err) {
      setError(err.message);
    } finally {
      setEntrando(null);
    }
  }

  async function handleDelete(t) {
    const ok = await confirm(
      `Excluir o tenant "${t.name}"? Isso remove usuários, imóveis, leads e chamados — e cancela ` +
      "no Stripe qualquer assinatura ativa desta imobiliária. A ação é irreversível.",
      "Excluir",
    );
    if (!ok) return;
    try {
      const r = await adminApi.deleteTenant(t.id);
      await load();

      /* O que sobrou no Stripe precisa ser dito. Uma assinatura que resistiu ao
         cancelamento continua cobrando todo mês por um ambiente que não existe
         mais, e depois da exclusão não há nada no painel apontando para ela —
         se este aviso não aparecer, ninguém descobre até a fatura. */
      const s = r?.stripe;
      if (s?.falhas?.length) {
        alert(
          `Tenant excluído, mas ${s.falhas.length} assinatura(s) no Stripe NÃO foram canceladas:\n` +
          `${s.falhas.map((f) => `· ${f.id || "?"}: ${f.motivo}`).join("\n")}\n\n` +
          `Cancele à mão no painel do Stripe (slug "${r.slug}").`,
        );
      }
    } catch (err) {
      alert(err.message || "Erro ao excluir.");
    }
  }

  const badges = { chamados: chamadosAbertos, avaliacoes: avaliacoesNovas, interessados: interessadosNovos };
  const abas = abasVisiveis.map((a) => (badges[a.chave] != null ? { ...a, badge: badges[a.chave] } : a));

  return (
    <AdminShell
      session={session}
      onLogout={onLogout}
      abas={abas}
      aba={aba}
      aoTrocarAba={setAba}
      versao={eu.versao}
      seletor={permissoes.verTenants && tenants.length ? (
        <select className="dl-input as-foco" value={focoSlug} onChange={(e) => focar(e.target.value)} aria-label="Cliente em foco">
          <option value="">Todos os clientes</option>
          {tenants.map((t) => <option key={t.id} value={t.slug}>{t.name}</option>)}
        </select>
      ) : null}
      css={`${CSS}\n${CHAMADOS_CSS}\n${TUTORIAIS_CSS}\n${SEGURANCA_CSS}\n${USUARIOS_CSS}\n${CARGOS_CSS}\n${VERSOES_CSS}\n${AUDITORIA_CSS}\n${AVALIACOES_CSS}\n${NOVIDADES_CSS}\n${USO_CSS}\n${INTERESSADOS_CSS}\n${COMUNICADOS_CSS}\n${ACESSOS_CSS}`}
    >
      {confirmModal}

      {/* Cargo sem aba nenhuma: a pessoa entrou e não alcança nada. Dizer
          isso é melhor que um painel em branco. */}
      {abasVisiveis.length === 0 && eu.permissoes ? (
        <div className="sa-empty">
          <p className="sa-empty__title">Seu cargo não abre nenhuma aba</p>
          <p className="sa-empty__desc">Peça a um Administrador da plataforma para ajustar as permissões do seu cargo.</p>
        </div>
      ) : null}

      {foco && aba ? (
        <div className="sa-foco">
          <div>
            <strong>{foco.name}</strong> <span className="dl-mono">/{foco.slug}</span>
            <p>{NOTA_DO_FOCO[aba] || "Mostrando só o que é deste cliente."}</p>
          </div>
          {permissoes.entrarNoTenant && foco.id ? (
            <Button as="button" type="button" variant="outline" className="dl-btn--sm" arrow={false} disabled={entrando === foco.id} onClick={() => entrarComo(foco)}>
              {entrando === foco.id ? "Entrando…" : "Entrar como administrador"}
            </Button>
          ) : null}
          <button type="button" className="sa-foco__fechar" onClick={() => focar("")} aria-label="Voltar a todos os clientes" title="Voltar a todos os clientes">×</button>
        </div>
      ) : null}

      {painel("chamados", <AdminChamadosPage aoContar={setChamadosAbertos} ativa={aba === "chamados"} tenantSlug={focoSlug} />)}
      {painel("tutoriais", <AdminTutoriaisPage tenantSlug={focoSlug} />)}
      {painel("avaliacoes", <AdminAvaliacoesPage aoContar={setAvaliacoesNovas} tenantId={foco?.id || ""} />)}
      {painel("novidades", <AdminNovidadesPage podePublicar={Boolean(permissoes.publicarNovidades)} tenantId={foco?.id || ""} />)}
      {painel("uso", <AdminUsoPage tenantSlug={focoSlug} />)}
      {painel("interessados", <AdminInteressadosPage aoContar={setInteressadosNovos} />)}
      {painel("comunicados", <AdminComunicadosPage tenants={tenants} foco={foco?.id ? foco : null} />)}
      {painel("emails", <AdminEmailsPage tenantId={foco?.id || ""} />)}
      {painel("acessos", <AdminAcessosPage tenantId={foco?.id || ""} podeEncerrar={Boolean(permissoes.encerrarSessoes)} />)}
      {painel("usuarios", <AdminUsuariosPage podeGerenciar={Boolean(permissoes.gerenciarUsuarios)} euId={eu.id} />)}
      {painel("cargos", <AdminCargosPage meuCargoId={eu.cargoId} />)}
      {painel("seguranca", <AdminSegurancaPage />)}
      {painel("versoes", <AdminVersoesPage />)}
      {painel("auditoria", <AdminAuditoriaPage catalogo={eu.catalogo} />)}

      {painel("tenants", (
        <>
        {/* ── Cabeçalho ── */}
        <Reveal className="sa-head">
          <Eyebrow>ADMINISTRAÇÃO DA PLATAFORMA</Eyebrow>
          <h1 className="dl-h2 sa-title">
            <span className="dl-h2__strong">Tenants da Omnimob</span>
            <span className="dl-h2__soft">e situação de cobrança.</span>
          </h1>
        </Reveal>

        <StatsGrid stats={stats} pronto={!loading} />
        <p className="dl-mono dl-note sa-note">// {tenants.length} imobiliárias provisionadas nesta instância</p>

        {/* ── Busca + ação ── */}
        <div className="sa-bar">
          <input
            className="dl-input sa-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, slug ou e-mail…"
          />
          {permissoes.editarTenant ? (
            <Button as="button" type="button" variant="accent" onClick={openCreate}>
              Novo tenant
            </Button>
          ) : null}
        </div>

        {error ? <Alert tone="danger">{error}</Alert> : null}
        {loading ? <p className="dl-mono sa-loading">// carregando tenants…</p> : null}

        {!loading && filtered.length === 0 ? (
          <div className="sa-empty">
            <p className="sa-empty__title">Nenhum tenant encontrado</p>
            <p className="sa-empty__desc">
              {search ? "Ajuste a busca ou limpe o filtro." : "Cadastre a primeira imobiliária para começar."}
            </p>
          </div>
        ) : null}

        {/* ── Lista ── */}
        <div className="sa-list">
          {filtered.map((t, i) => {
            const sm = STATUS_META[t.statusPagamento] || STATUS_META.TRIAL;
            return (
              <Reveal key={t.id} className="sa-row" delay={Math.min(i, 8) * 55}>
                <div className="sa-row__main">
                  <div className="sa-row__title">
                    <span className="sa-row__name">{t.name}</span>
                    <span className="dl-mono sa-row__slug">/{t.slug}</span>
                    <span
                      className="dl-pill"
                      style={{ background: sm.bg, color: sm.color, borderColor: sm.border }}
                    >
                      {sm.label}
                    </span>
                    {!t.ativo ? (
                      <span className="dl-pill" style={{ background: "rgba(148,163,184,0.12)", color: "#cbd5e1", borderColor: "rgba(148,163,184,0.25)" }}>
                        Inativo
                      </span>
                    ) : null}
                  </div>

                  <dl className="sa-meta">
                    <div><dt className="dl-mono">PLANO</dt><dd>{t.plano || "—"}</dd></div>
                    <div><dt className="dl-mono">MENSAL</dt><dd>{fmtMoney(t.valorMensal)}</dd></div>
                    <div><dt className="dl-mono">VENCE</dt><dd>{fmtDate(t.proximoVencimento)}</dd></div>
                    <div><dt className="dl-mono">USO</dt><dd>{t.usuarios} usuários · {t.properties} imóveis</dd></div>
                  </dl>
                </div>

                <div className="sa-row__actions">
                  <Button href={`/vitrine/${t.slug}`} target="_blank" rel="noreferrer" variant="ghost" className="dl-btn--sm" arrow={false}>
                    Vitrine
                  </Button>
                  {/* Botão sem permissão SOME — não aparece desabilitado. Um
                      botão cinza convida a perguntar "por que não posso?"; a
                      resposta certa é o cargo, e ela mora na aba Cargos. */}
                  {permissoes.editarTenant ? (
                    <Button as="button" type="button" variant="outline" className="dl-btn--sm" arrow={false} onClick={() => openEdit(t)}>
                      Editar
                    </Button>
                  ) : null}
                  {/* ── ENTRAR NA CONTA DO CLIENTE ────────────────────────
                      "Não consigo publicar" é impossível de responder sem ver
                      a tela que a pessoa está vendo, e a alternativa que
                      existia era pedir a senha dela — que depois continua com
                      quem pediu.

                      Fica ao lado de Editar e ANTES de Excluir de propósito:
                      é uma ação de suporte, não destrutiva, e encostá-la no
                      botão vermelho aumentaria a chance do clique errado. */}
                  {permissoes.entrarNoTenant ? (
                    <Button
                      as="button" type="button" variant="outline" className="dl-btn--sm" arrow={false}
                      disabled={entrando === t.id}
                      onClick={() => entrarComo(t)}
                    >
                      {entrando === t.id ? "Entrando…" : "Entrar"}
                    </Button>
                  ) : null}
                  {/* A imobiliária de demonstração não tem "Excluir": a rota
                      recusa de qualquer jeito (403 TENANT_PROTEGIDO), e um botão
                      que só devolve erro ensina que a tela está quebrada. O
                      selo diz o motivo no lugar dele. */}
                  {t.protegido ? (
                    <span className="sa-protegido" title="A imobiliária de demonstração não pode ser excluída.">
                      🔒 Demonstração
                    </span>
                  ) : permissoes.excluirTenant ? (
                    <Button as="button" type="button" variant="danger" className="dl-btn--sm" arrow={false} onClick={() => handleDelete(t)}>
                      Excluir
                    </Button>
                  ) : null}
                </div>
              </Reveal>
            );
          })}
        </div>
        </>
      ))}

      {/* ── A senha reemitida ─────────────────────────────────────────────
          O MESMO desenho do cartão de credenciais da criação (`sa-credenciais`),
          e não um segundo: as duas telas dizem a mesma coisa — "anote agora,
          isto não volta" — e um segundo desenho divergiria na primeira palavra
          que alguém trocasse. */}
      {senhaGerada ? (
        <div className="sa-modal" onClick={() => setSenhaGerada(null)}>
          <div className="sa-modal__card" onClick={(e) => e.stopPropagation()}>
            <div className="sa-modal__head">
              <Eyebrow>SENHA REEMITIDA</Eyebrow>
              <h2 className="sa-modal__title">{senhaGerada.tenant}</h2>
            </div>

            <div className="sa-credenciais">
              <span className="dl-mono sa-modal__extra-label">// acesso do administrador</span>
              <dl className="sa-credenciais__lista">
                <div>
                  <dt className="dl-mono">LOGIN</dt>
                  <dd>{senhaGerada.login}</dd>
                </div>
                <div>
                  <dt className="dl-mono">SENHA PROVISÓRIA</dt>
                  <dd>{senhaGerada.senha}</dd>
                </div>
              </dl>
              <p className="sa-credenciais__nota">
                Anote agora: a senha não volta a ser exibida. No primeiro acesso o sistema
                exige que {senhaGerada.nome} defina uma nova — esta serve só para chegar lá.
                A troca fica registrada no Registro de Atividade da imobiliária.
              </p>
            </div>

            <div className="sa-modal__actions">
              <Button as="button" type="button" onClick={() => setSenhaGerada(null)} arrow={false}>
                Anotei
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Modal de cadastro/edição ── */}
      {modalOpen ? (
        <div className="sa-modal" onClick={fecharModal}>
          <form className="sa-modal__card" onClick={(e) => e.stopPropagation()} onSubmit={handleSave}>
            {criado ? (
              /* Ambiente criado. A senha aparece uma vez só — daqui em diante o
                 banco tem apenas o hash dela. */
              <>
                <div className="sa-modal__head">
                  <Eyebrow>PROVISIONADO</Eyebrow>
                  <h2 className="sa-modal__title">{form.name} está no ar</h2>
                </div>

                {criado.warning ? <Alert tone="danger">{criado.warning}</Alert> : null}

                <p className="sa-endereco sa-endereco--fixo">
                  <span className="dl-mono sa-endereco__url">
                    <b>{enderecoVisivel(criado.slug)}</b>
                  </span>
                  <span className="sa-endereco__nota">Endereço da vitrine pública.</span>
                </p>

                {criado.admin ? (
                  <div className="sa-credenciais">
                    <span className="dl-mono sa-modal__extra-label">// acesso do administrador</span>
                    <dl className="sa-credenciais__lista">
                      <div>
                        <dt className="dl-mono">LOGIN</dt>
                        <dd>{criado.admin.login}</dd>
                      </div>
                      <div>
                        <dt className="dl-mono">SENHA PROVISÓRIA</dt>
                        <dd>{criado.admin.senha}</dd>
                      </div>
                    </dl>
                    <p className="sa-credenciais__nota">
                      Anote agora: a senha não volta a ser exibida. No primeiro acesso o sistema
                      obriga a definir uma nova.
                    </p>
                  </div>
                ) : null}

                <div className="sa-modal__foot">
                  {criado.admin ? (
                    /* Leva ao login com os campos já preenchidos.

                       As credenciais viajam no state do roteador, NÃO na URL:
                       query string vai parar no histórico do navegador, no
                       Referer e em qualquer log pelo caminho — e isto aqui é
                       uma senha. A LoginPage lê o state e o apaga em seguida,
                       então nem o botão "voltar" a traz de volta.

                       Sem `target="_blank"`: o state do roteador não atravessa
                       aba nova, e o link abriria com os campos vazios. */
                    <Button
                      as="button"
                      type="button"
                      variant="ghost"
                      arrow={false}
                      onClick={() =>
                        navegar("/login", {
                          state: {
                            credenciais: { login: criado.admin.login, senha: criado.admin.senha },
                            origem: "provisionamento",
                          },
                        })
                      }
                    >
                      Ir para o login
                    </Button>
                  ) : null}
                  <Button as="button" type="button" variant="primary" arrow={false} onClick={fecharModal}>
                    Concluir
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="sa-modal__head">
                  <Eyebrow>{editingId ? "EDITAR" : "PROVISIONAR"}</Eyebrow>
                  <h2 className="sa-modal__title">{editingId ? "Editar tenant" : "Novo tenant"}</h2>
                </div>

                {formError ? <Alert tone="danger">{formError}</Alert> : null}

                <div className="sa-form-grid">
                  {/* O nome não é só um rótulo: é dele que sai o endereço da
                      vitrine, único entre todas as imobiliárias. Por isso o campo
                      ocupa a linha inteira e mostra o endereço se formando. */}
                  <div className="sa-nome">
                    <Field label="Nome *">
                      <input className="dl-input" required value={form.name} onChange={(e) => setField("name", e.target.value)} />
                    </Field>

                    {editingId ? (
                      <p className="sa-endereco sa-endereco--fixo">
                        <span className="dl-mono sa-endereco__url">
                          <b>{enderecoVisivel(form.slug)}</b>
                        </span>
                        <span className="sa-endereco__nota">
                          O endereço da vitrine não muda depois de criado, mesmo que o nome mude.
                        </span>
                      </p>
                    ) : form.name.trim() ? (
                      <span className={`sa-endereco is-${slug.estado}`} aria-live="polite">
                        <span className="sa-endereco__linha">
                          <span className="dl-mono sa-endereco__url">
                            <b>{enderecoVisivel(slug.valor)}</b>
                          </span>
                          <span className="sa-endereco__selo">{SELO_SLUG[slug.estado]}</span>
                        </span>
                        <span className="sa-endereco__nota">
                          {slug.mensagem || "Endereço da vitrine, gerado a partir do nome."}
                        </span>
                      </span>
                    ) : null}
                  </div>

                  <Field label="E-mail">
                    <input className="dl-input" type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} />
                  </Field>
                  <Field label="WhatsApp">
                    <input className="dl-input" value={form.whatsapp} onChange={(e) => setField("whatsapp", e.target.value)} placeholder="5511999999999" />
                  </Field>
                  <Field label="Plano">
                    <SelectCustom
                      value={form.plano}
                      options={planoOpcoes}
                      onChange={(v) => setField("plano", v)}
                      placeholder="Selecione o plano"
                    />
                  </Field>
                  <Field label="Status pagamento">
                    <SelectCustom
                      value={form.statusPagamento}
                      options={STATUS_OPCOES.map((s) => ({ value: s, label: STATUS_META[s].label, color: STATUS_META[s].color }))}
                      onChange={(v) => setField("statusPagamento", v)}
                    />
                  </Field>
                  <Field label="Valor mensal (R$)">
                    <input className="dl-input" type="number" step="0.01" value={form.valorMensal} onChange={(e) => setField("valorMensal", e.target.value)} />
                  </Field>
                  <Field label="Próximo vencimento">
                    <input className="dl-input" type="date" value={form.proximoVencimento} onChange={(e) => setField("proximoVencimento", e.target.value)} />
                  </Field>
                </div>

                {/* ── O add-on do Flow ────────────────────────────────────
                    Fora da grade de campos e com uma linha explicando o que
                    ele entrega: é a única escolha deste formulário que muda o
                    PRODUTO, e não um dado cadastral. Numa célula ao lado de
                    "Valor mensal" ela leria como mais um campo de preenchimento.

                    Ao TIRAR o Flow de uma conta que o tinha, nada é apagado —
                    negócios, contratos e comissões continuam no banco. O que
                    some é o acesso. O aviso está aqui porque quem desmarca a
                    caixa precisa saber disso antes de salvar. */}
                <label className="sa-addon">
                  <input
                    type="checkbox"
                    className="sw"
                    checked={form.temFlow}
                    onChange={(e) => setField("temFlow", e.target.checked)}
                  />
                  <span>
                    <strong>Incluir o Omniflow</strong>
                    <small>
                      Captação por webhook, funil de negócios, minutas contratuais, assinatura
                      digital e comissão. Sem isto a conta fica só com o Omnimob.
                      {editingId && !form.temFlow
                        ? " Ao remover, os negócios e contratos continuam guardados — só o acesso é fechado."
                        : ""}
                    </small>
                  </span>
                </label>

                {/* ── Ativar sem passar pelo provedor ─────────────────────
                    Só na EDIÇÃO: numa conta que ainda não existe não há o que
                    ativar, e o cadastro já nasce com o vencimento do teste.

                    Separado dos campos por uma razão de natureza: os campos
                    acima são um formulário — nada acontece até "Salvar" —, e
                    este botão AGE na hora, sozinho. Misturá-lo à grade faria a
                    ativação parecer mais um dado a preencher.

                    Ele existe porque dá para chegar quase lá na mão (status,
                    plano, valor, vencimento), e o "quase" é o problema: pela
                    grade, `suspensoEm` continuava marcado e a faxina levava,
                    dias depois, uma conta já paga. */}
                {editingId ? (
                  <div className="sa-ativar">
                    <div className="sa-ativar__texto">
                      <strong>Ativar como paga</strong>
                      <small>
                        Para quem pagou por fora — transferência, acordo comercial, cortesia ou
                        ambiente de demonstração. A conta vai para EM_DIA, volta a ficar ativa e sai
                        da fila de remoção, sem cobrar nada no provedor. O prazo é somado ao
                        vencimento atual quando ele ainda está no futuro, e o valor sai da tabela de
                        preços do provedor.
                      </small>
                    </div>

                    <div className="sa-ativar__acao">
                      {/* Rádio de verdade, e não dois botões: são duas opções do
                          mesmo campo, e é o que faz as setas do teclado andarem
                          entre elas sem código nosso. */}
                      <div className="sa-ativar__periodo" role="radiogroup" aria-label="Período da ativação">
                        {[
                          { chave: "mensal", rotulo: "1 mês" },
                          { chave: "anual", rotulo: "12 meses" },
                        ].map((op) => (
                          <label
                            key={op.chave}
                            className={`sa-ativar__opcao${periodoAtivacao === op.chave ? " is-on" : ""}`}
                          >
                            <input
                              type="radio"
                              name="sa-periodo-ativacao"
                              value={op.chave}
                              checked={periodoAtivacao === op.chave}
                              onChange={() => setPeriodoAtivacao(op.chave)}
                            />
                            {op.rotulo}
                          </label>
                        ))}
                      </div>
                      <Button
                        as="button"
                        type="button"
                        variant="primary"
                        arrow={false}
                        disabled={ativando}
                        onClick={ativarComoPago}
                      >
                        {ativando ? "Ativando…" : "Ativar como paga"}
                      </Button>
                    </div>

                    {/* O que ficou gravado, dito pelo servidor. A tela não
                        recalcula a data — ver `ativarComoPago`. */}
                    {ativacao ? (
                      <p className="sa-ativar__ok" aria-live="polite">
                        Conta em dia até <b>{new Date(ativacao.ate).toLocaleDateString("pt-BR")}</b>
                        {ativacao.valorMensal
                          ? ` — R$ ${Number(ativacao.valorMensal).toFixed(2).replace(".", ",")}/mês registrados`
                          : ""}
                        {ativacao.modulos?.includes("FLOW") ? ", com o Omniflow." : "."}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {!editingId ? (
                  <p className="dl-mono sa-modal__extra-label">
                    // o acesso do administrador é criado junto, com senha provisória e troca
                    obrigatória no primeiro login
                  </p>
                ) : null}

                <div className="sa-modal__foot">
                  <Button as="button" type="button" variant="ghost" arrow={false} onClick={fecharModal}>
                    Cancelar
                  </Button>
                  {/* Desligado enquanto o endereço não fecha: seguir com um slug
                      ocupado só adiaria a mesma recusa para o fim do cadastro. */}
                  <Button
                    as="button"
                    type="submit"
                    variant="primary"
                    disabled={saving || (!editingId && (slug.estado === "indisponivel" || slug.estado === "checando"))}
                  >
                    {saving ? "Salvando…" : editingId ? "Salvar" : "Criar tenant"}
                  </Button>
                </div>
              </>
            )}
          </form>
        </div>
      ) : null}
    </AdminShell>
  );
}

/* Só o que é DESTA aba. A moldura — fundo, topbar, sidebar — mora no
   `AdminShell`, junto do JSX que a usa. */
const CSS = `
/* ── O cliente em foco: a faixa no topo das abas ── */
.sa-foco {
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  margin-bottom: 20px; padding: 12px 16px; border-radius: 14px;
  background: rgba(99,102,241,0.07); border: 1px solid rgba(99,102,241,0.30);
}
.sa-foco > div { flex: 1; min-width: 0; }
.sa-foco strong { color: var(--strong); font-size: 14px; }
.sa-foco .dl-mono { color: var(--placeholder); font-size: 9.5px; text-transform: none; }
.sa-foco p { margin: 4px 0 0; font-size: 12px; color: var(--subtle); }
.dl-root .sa-foco__fechar {
  width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 17px; line-height: 1;
  background: none; border: 1px solid var(--line); color: var(--subtle); box-shadow: none; transform: none;
}
.dl-root .sa-foco__fechar:hover { color: var(--strong); border-color: #34343c; background: none; box-shadow: none; transform: none; }

/* ── O add-on do Flow, no formulario de tenant ──
   No ROSA do modulo (#ec0b5b), e nao no jade que estava aqui: o Flow tem uma
   cor so, e ela e a da palavra "flow" na arte.────────────────────────────
   Fora da grade de campos de proposito: e a unica escolha deste formulario que
   muda o PRODUTO, e nao um dado cadastral. Numa celula ao lado de "Valor
   mensal" ela leria como mais um campo de preenchimento.
   (Sem crases nestes comentarios: template literal.) */
.sa-addon {
  display: flex; align-items: flex-start; gap: 12px;
  margin-top: 18px; padding: 14px 16px; border-radius: 12px; cursor: pointer;
  background: rgba(236,11,91,0.06); border: 1px solid rgba(236,11,91,0.24);
}
.sa-addon > span { display: flex; flex-direction: column; gap: 3px; }
.sa-addon strong { font-size: 13.5px; }
.sa-addon small { font-size: 12px; line-height: 1.55; color: var(--subtle, #b6b6c2); }
/* Ativacao manual. Em ambar e nao no menta do add-on do Flow: aquele bloco e
   uma escolha de produto, este e uma acao de excecao — dinheiro que entrou por
   fora. A cor separa "o que a conta tem" de "o que nos fizemos por ela".
   Sem CRASE nenhuma nestes comentarios: este CSS mora num template literal. */
.sa-ativar {
  margin-top: 18px; padding: 14px 16px; border-radius: 12px;
  display: flex; flex-direction: column; gap: 12px;
  background: rgba(212,175,55,0.06); border: 1px solid rgba(212,175,55,0.24);
}
.sa-ativar__texto { display: flex; flex-direction: column; gap: 3px; }
.sa-ativar__texto strong { font-size: 13.5px; }
.sa-ativar__texto small { font-size: 12px; line-height: 1.55; color: var(--subtle, #b6b6c2); }
.sa-ativar__acao { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.sa-ativar__periodo { display: flex; gap: 6px; }
.sa-ativar__opcao {
  display: inline-flex; align-items: center; cursor: pointer; user-select: none;
  padding: 7px 14px; border-radius: 999px; font-size: 12.5px;
  border: 1px solid var(--hairline, rgba(255,255,255,0.12));
  color: var(--subtle, #b6b6c2); background: transparent;
  transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}
/* O input existe para o teclado e para o leitor de tela; quem desenha o estado
   e a etiqueta. Nada de display:none, que tiraria o foco junto. */
.sa-ativar__opcao input { position: absolute; opacity: 0; width: 0; height: 0; }
.sa-ativar__opcao:hover { color: var(--strong, #fff); }
.sa-ativar__opcao.is-on {
  background: rgba(212,175,55,0.16); border-color: rgba(212,175,55,0.5);
  color: var(--strong, #fff);
}
.sa-ativar__opcao:focus-within { outline: 2px solid rgba(212,175,55,0.6); outline-offset: 2px; }
.sa-ativar__ok { margin: 0; font-size: 12.5px; color: var(--strong, #fff); }

.sa-head { margin-bottom: 34px; }
.sa-title { max-width: 22ch; }
.sa-stats { margin-top: 4px; }
.sa-note { margin-top: 16px; margin-bottom: 34px; }

.sa-bar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 20px; }
.dl-root .sa-search { max-width: 340px; flex: 1 1 240px; }
.sa-loading { color: var(--placeholder); text-transform: none; letter-spacing: 0.05em; padding: 18px 0; }

.sa-empty {
  padding: 56px 24px; text-align: center;
  border: 1px dashed var(--line); border-radius: 18px; background: var(--bg-alt);
}
.sa-empty__title { font-size: 15px; font-weight: 700; color: var(--strong); letter-spacing: -0.02em; }
.sa-empty__desc { font-size: 13px; line-height: 1.7; color: var(--subtle); margin-top: 8px; }

/* ── Lista de tenants ── */
.sa-list { display: grid; gap: 10px; }
.sa-row {
  display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap;
  padding: 20px 22px; border-radius: 16px;
  background: var(--surface); border: 1px solid var(--line);
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.85s var(--ease-out), opacity 0.85s var(--ease-out);
}
.sa-row:hover { border-color: #34343c; background: var(--surface-2); }
.sa-row__main { min-width: 240px; flex: 1; }
.sa-row__title { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.sa-row__name { font-size: 15.5px; font-weight: 700; color: var(--strong); letter-spacing: -0.025em; }
.sa-row__slug { color: var(--placeholder); font-size: 9.5px; text-transform: none; }

.sa-meta { display: flex; gap: 26px; flex-wrap: wrap; margin-top: 12px; }
.sa-meta dt { color: #55555f; font-size: 8.5px; letter-spacing: 0.13em; }
.sa-meta dd { margin: 3px 0 0; font-size: 12.5px; color: var(--subtle); }

.sa-row__actions { display: flex; gap: 8px; flex-shrink: 0; flex-wrap: wrap; }

/* ── Modal ── */
.sa-modal {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.72); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.sa-modal__card {
  width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto;
  padding: 30px; border-radius: 22px;
  background: #121214; border: 1px solid var(--line);
  box-shadow: 0 60px 120px -40px rgba(0,0,0,0.95);
  display: flex; flex-direction: column; gap: 18px;
}
.sa-modal__head { display: grid; gap: 10px; }
/* Ocupa a linha inteira do grid de dois campos: é uma frase, não um campo. */
.sa-resumo {
  grid-column: 1 / -1; margin: 0; display: grid; gap: 4px;
  padding: 10px 12px; border-radius: 10px;
  background: rgba(255,255,255,0.03); border: 1px solid var(--line);
}
.sa-resumo strong { font-size: 13px; font-weight: 600; color: var(--strong); line-height: 1.45; }
.sa-modal__title { font-size: 24px; font-weight: 800; letter-spacing: -0.035em; color: var(--strong); }
.sa-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.sa-modal__extra-label { color: var(--placeholder); font-size: 9.5px; text-transform: none; letter-spacing: 0.05em; line-height: 1.6; }
/* O selo que ocupa o lugar do "Excluir" na imobiliária de demonstração. */
.sa-protegido {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 10px; border-radius: 999px;
  font-size: 11px; font-weight: 600; letter-spacing: 0.02em; color: #e8d79b;
  background: rgba(212,175,55,0.10); border: 1px solid rgba(212,175,55,0.28);
  cursor: help;
}
.sa-modal__foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }

/* ── Endereço da vitrine ──────────────────────────────────────────────────
   Colado no campo do nome, com respiro menor que o do próximo campo: é
   consequência do que foi digitado ali em cima, não um campo novo. A caixa
   troca de cor conforme o estado e o texto de apoio troca junto, sem a linha
   pular. Mesma peça do cadastro da landing. */
.sa-nome { grid-column: 1 / -1; display: grid; gap: 6px; }
.sa-endereco {
  display: grid; gap: 5px;
  padding: 9px 12px; border-radius: 10px;
  background: rgba(255,255,255,0.03); border: 1px solid var(--line);
  transition: background 0.22s ease, border-color 0.22s ease;
}
.sa-endereco__linha { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
/* Sem o caixa-alta do .dl-mono: o slug é minúsculo de verdade, e mostrá-lo em
   maiúsculas seria prometer um endereço que não é o que vai ser criado. */
.sa-endereco__url {
  flex: 1 1 auto; min-width: 0; font-size: 11px; color: var(--placeholder);
  text-transform: none; letter-spacing: 0.02em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.sa-endereco__url b { color: var(--subtle); font-weight: 600; }
.sa-endereco__selo {
  flex: 0 0 auto; font-size: 10.5px; font-weight: 600; letter-spacing: 0.01em;
  color: var(--placeholder);
}
.sa-endereco__nota { font-size: 11px; line-height: 1.5; color: var(--placeholder); }

.sa-endereco.is-checando .sa-endereco__selo { color: var(--subtle); }
.sa-endereco.is-livre { background: rgba(52,211,153,0.08); border-color: rgba(52,211,153,0.3); }
.sa-endereco.is-livre .sa-endereco__url b { color: #86efac; }
.sa-endereco.is-livre .sa-endereco__selo { color: #86efac; }
.sa-endereco.is-indisponivel { background: rgba(248,113,113,0.09); border-color: rgba(248,113,113,0.3); }
.sa-endereco.is-indisponivel .sa-endereco__selo { color: #fca5a5; }
.sa-endereco.is-indisponivel .sa-endereco__nota { color: #fca5a5; }

/* ── Credenciais do admin recém-criado ── */
.sa-credenciais {
  display: grid; gap: 12px; padding: 16px 18px; border-radius: 14px;
  background: rgba(212,175,55,0.07); border: 1px solid rgba(212,175,55,0.26);
}
.sa-credenciais__lista { display: grid; gap: 12px; }
.sa-credenciais__lista dt { color: #55555f; font-size: 8.5px; letter-spacing: 0.13em; }
.sa-credenciais__lista dd {
  margin: 4px 0 0; font-size: 15px; font-weight: 600; color: var(--strong);
  font-family: 'JetBrains Mono', ui-monospace, monospace; letter-spacing: 0.01em;
  word-break: break-all; user-select: all;
}
.sa-credenciais__nota { font-size: 11.5px; line-height: 1.6; color: var(--subtle); }

@media (max-width: 720px) {
  .sa-form-grid { grid-template-columns: 1fr; }
  .sa-row { align-items: flex-start; }
  .sa-row__actions { width: 100%; }
  .sa-meta { gap: 16px; }
}
`;
