import { useEffect, useRef, useState } from "react";
import { useNavigate, useOutletContext, useParams, useLocation } from "react-router-dom";
import { useTituloDaTela } from "../utils/contextoDeCabecalho.jsx";
import { api } from "../api";
import { BtnEditar, BtnExcluir, BtnGerenciar, BtnNovo } from "../components/ActionIcons";
import { useConfirm } from "../components/ConfirmModal";

import { TIPOS_CONTRATO, TIPOS_CONTRATO_KEYS } from "../utils/tiposContrato.js";
import { IconeEstrela } from "../components/Icones.jsx";
import { ConviteDeCriacao } from "../components/ConviteDeCriacao.jsx";
import { Tag, PlusCircle, PencilSimple, ListChecks } from "@phosphor-icons/react";
import { degrausAte } from "../utils/trilhaDoPainel";
import { useSaidaDaTela } from "../components/useSaidaDaTela";

const AREA_OPTIONS = [
  { key: "areaTerreno",    label: "Área do terreno" },
  { key: "areaConstruida", label: "Área construída" },
  { key: "areaPrivativa",  label: "Área privativa" },
  { key: "areaTotal",      label: "Área total" },
];

const AREA_LABEL = Object.fromEntries(AREA_OPTIONS.map((o) => [o.key, o.label]));

function emptyTipoForm() {
  return { descricao: "", areaFields: [] };
}

function emptyAtributoForm() {
  return { descricao: "", grupo: "" };
}

// ── Checkboxes de campos de área ──────────────────────────────────────────────
function AreaFieldsEditor({ value, onChange }) {
  function toggle(key) {
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  }

  return (
    <div>
      <span style={{ display: "block", marginBottom: "10px", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Campos de área exibidos no formulário
      </span>
      <p style={{ fontSize: "12px", color: "var(--text-muted)", opacity: 0.7, marginBottom: "12px", lineHeight: 1.5 }}>
        O primeiro campo marcado será obrigatório. Se nenhum for marcado, todos os campos aparecem.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
        {AREA_OPTIONS.map((opt, i) => {
          const checked = value.includes(opt.key);
          const isPrincipal = checked && value[0] === opt.key;
          return (
            <label key={opt.key} style={{
              display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px",
              borderRadius: "10px", cursor: "pointer",
              border: checked ? "1px solid rgba(99,102,241,0.5)" : "1px solid var(--linha-08, rgba(255,255,255,0.08))",
              background: checked ? "rgba(99,102,241,0.10)" : "var(--sup-02, rgba(255,255,255,0.02))",
              transition: "all 0.15s", userSelect: "none",
            }}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(opt.key)}
                style={{ accentColor: "#6366f1", width: "14px", height: "14px", flexShrink: 0 }}
              />
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: "13px", fontWeight: 500 }}>{opt.label}</span>
                {isPrincipal && (
                  <span style={{ display: "block", fontSize: "10px", fontWeight: 600, color: "#818cf8", marginTop: "2px" }}>
                    principal · obrigatório
                  </span>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

/* Parametrização dos tipos de contrato liberados no cadastro de imóvel.
   Salva na hora (otimista) e volta atrás se a API recusar. */
function TiposContratoCard({ tenantSlug }) {
  const [ativos, setAtivos] = useState(null); // null = ainda carregando
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [salvoEm, setSalvoEm] = useState(null);

  useEffect(() => {
    if (!tenantSlug) return;
    api.getTenantProfile(tenantSlug)
      .then((t) => {
        const lista = t?.tiposContrato;
        // Lista vazia = nunca parametrizado; mostramos todos marcados.
        setAtivos(Array.isArray(lista) && lista.length > 0 ? lista : TIPOS_CONTRATO_KEYS);
      })
      .catch(() => setAtivos(TIPOS_CONTRATO_KEYS));
  }, [tenantSlug]);

  async function toggle(key) {
    if (!ativos || salvando) return;
    const proximos = ativos.includes(key) ? ativos.filter((k) => k !== key) : [...ativos, key];

    // Zero tipos ativos travaria o cadastro de imóveis por completo.
    if (proximos.length === 0) {
      setErro("Mantenha ao menos um tipo de contrato ativo.");
      return;
    }

    const anteriores = ativos;
    setAtivos(proximos);
    setErro("");
    setSalvando(true);
    try {
      await api.updateTiposContrato(tenantSlug, proximos);
      setSalvoEm(Date.now());
    } catch (err) {
      setAtivos(anteriores);
      setErro(err.message || "Não foi possível salvar. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div style={{
      marginBottom: "24px", padding: "18px 20px", borderRadius: "12px",
      background: "var(--sup-03, rgba(255,255,255,0.03))", border: "1px solid var(--linha-08, rgba(255,255,255,0.08))",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <span style={{ fontWeight: "600", fontSize: "15px" }}>Tipos de contrato</span>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.6 }}>
            Escolha quais naturezas de negócio aparecem no cadastro de imóveis desta imobiliária.
          </p>
        </div>
        <span style={{ fontSize: "11px", color: "var(--text-muted)", opacity: 0.8 }}>
          {salvando ? "Salvando…" : salvoEm ? "Salvo" : ""}
        </span>
      </div>

      {erro ? (
        <div style={{ marginTop: "12px", padding: "8px 12px", borderRadius: "8px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", fontSize: "12px" }}>
          {erro}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: "8px", marginTop: "14px" }}>
        {TIPOS_CONTRATO.map((t) => {
          const checked = ativos ? ativos.includes(t.key) : false;
          return (
            <label key={t.key} style={{
              display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 12px",
              borderRadius: "10px", cursor: ativos ? "pointer" : "wait", userSelect: "none",
              border: checked ? `1px solid ${t.cor}66` : "1px solid var(--linha-08, rgba(255,255,255,0.08))",
              background: checked ? `${t.cor}1f` : "var(--sup-02, rgba(255,255,255,0.02))",
              transition: "all 0.15s ease", opacity: ativos ? 1 : 0.5,
            }}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(t.key)}
                disabled={!ativos}
                style={{ accentColor: t.cor, width: "15px", height: "15px", flexShrink: 0, marginTop: "2px" }}
              />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: "13px", fontWeight: "600" }}>{t.label}</span>
                <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.5, marginTop: "2px" }}>
                  {t.descricao}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function TiposImovelPage({ session }) {
  const navigate = useNavigate();
  // Mesmo canal de aviso do resto do painel. Ver o comentário em CargosPage.
  const showToast = useOutletContext()?.showToast;
  const tenantSlug = session?.tenant?.slug;
  const [tipos, setTipos] = useState([]);
  /* ── A VISTA SAI DA ROTA ─────────────────────────────────────────────────
     Eram quatro estados num `useState`, e esta tela tinha o pior caso do
     painel: dois níveis de aninhamento (um atributo mora DENTRO de um tipo)
     vivendo inteiramente em memória. Editar um atributo e apertar F5 devolvia a
     pessoa à lista de tipos, dois níveis acima.

     Cinco endereços, um por sub-tela — ver o bloco de rotas em `App.jsx`. */
  const { tipoId, atributoId } = useParams();
  const caminho = useLocation().pathname;
  const criandoTipo = caminho === "/tipos-imovel/novo";
  const criandoAtributo = caminho.endsWith("/atributos/novo");
  const view = criandoTipo ? "tipoForm"
    : criandoAtributo || atributoId ? "atributoForm"
    : caminho.includes("/atributos") ? "atributos"
    : tipoId ? "tipoForm"
    : "list";
  const [editandoTipo, setEditandoTipo] = useState(null);
  const [tipoAtivo, setTipoAtivo] = useState(null);
  const [editandoAtributo, setEditandoAtributo] = useState(null);
  const [tipoForm, setTipoForm] = useState(emptyTipoForm());
  const [atributoForm, setAtributoForm] = useState(emptyAtributoForm());
  /* ── ATRIBUTOS ANTES DE O TIPO EXISTIR ───────────────────────────────────
     Atributo é filho de um tipo no banco: `POST /tipos/:id/atributos` precisa
     do id, e o id só nasce quando o tipo é gravado. Isso empurrava a pessoa
     para um fluxo de dois tempos — cadastre o tipo, volte à lista, clique em
     gerenciar, só então descreva o que ele tem —, e "Casa" sem nenhum atributo
     é um tipo que ainda não serve para cadastrar imóvel nenhum.

     Aqui eles ficam em memória enquanto o formulário está aberto e são gravados
     logo depois do tipo, em `handleTipoSubmit`. */
  const [atributosNovos, setAtributosNovos] = useState([]);
  const [rascunhoAtributo, setRascunhoAtributo] = useState({ descricao: "", grupo: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { confirm, modal: confirmModal } = useConfirm();

  useEffect(() => {
    if (!tenantSlug) return;
    api.getTiposImovel(tenantSlug)
      .then((lista) => {
        setTipos(lista);
        const n = Array.isArray(lista) ? lista.length : 0;
        showToast?.(
          n === 1 ? "1 tipo de imóvel carregado." : `${n} tipos de imóvel carregados.`,
        );
      })
      .catch(() => {});
  }, [tenantSlug]);

  // ─── Tipo CRUD ────────────────────────────────────────────────────────────

  function abrirCriarTipo() {
    navigate("/tipos-imovel/novo");
  }

  function preencherTipo(t) {
    setEditandoTipo(t);
    setTipoForm({
      descricao: t.descricao,
      areaFields: Array.isArray(t.areaFields) ? t.areaFields : [],
    });
    setError("");
  }

  function abrirEditarTipo(t) {
    preencherTipo(t);
    preenchidoPara.current = `tipo:${t.id}`;
    navigate(`/tipos-imovel/${t.id}`);
  }

  /* Acrescenta o rascunho a lista. Recusa nome vazio e nome repetido — o
     servidor recusaria o duplicado depois, e descobrir isso so ao salvar o tipo
     deixaria a pessoa sem saber qual dos dez atributos era o problema. */
  function adicionarAtributoRascunho() {
    const descricao = rascunhoAtributo.descricao.trim();
    if (!descricao) return;
    const grupo = rascunhoAtributo.grupo.trim();
    if (atributosNovos.some((a) => a.descricao.toLowerCase() === descricao.toLowerCase())) {
      showToast?.(`"${descricao}" ja esta na lista.`, "error");
      return;
    }
    setAtributosNovos((prev) => [...prev, { descricao, grupo }]);
    /* O GRUPO fica: quem cadastra "Piscina / Lazer" quase sempre cadastra
       "Churrasqueira / Lazer" logo em seguida, e reescreve-lo a cada item e o
       tipo de atrito que faz a pessoa parar no terceiro. */
    setRascunhoAtributo((r) => ({ descricao: "", grupo: r.grupo }));
  }

  /* Enter acrescenta o atributo em vez de ENVIAR o formulario. Sem isto,
     digitar "Piscina" e apertar Enter criaria o tipo sem o atributo que a
     pessoa acabou de escrever — e ela so descobriria na tela seguinte. */
  function aoTeclarNoRascunho(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    adicionarAtributoRascunho();
  }

  async function handleTipoSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (editandoTipo) {
        const updated = await api.updateTipoImovel(tenantSlug, editandoTipo.id, tipoForm);
        setTipos((prev) => prev.map((t) => t.id === updated.id ? { ...t, descricao: updated.descricao, areaFields: updated.areaFields } : t));
        showToast?.(`Tipo "${updated.descricao}" atualizado.`);
        navigate("/tipos-imovel");
      } else {
        const created = await api.createTipoImovel(tenantSlug, tipoForm);

        /* Os atributos rascunhados viram registros agora que existe um id.
           Em série e não em paralelo: são poucos, e a ordem em que a pessoa os
           digitou é a ordem em que ela espera vê-los. */
        const criados = [];
        for (const a of atributosNovos) {
          try {
            criados.push(await api.createAtributo(tenantSlug, created.id, {
              descricao: a.descricao, grupo: a.grupo || null,
            }));
          } catch (err) {
            /* O TIPO já existe — falhar aqui não pode desfazer isso nem parecer
               que nada foi salvo. Avisa qual atributo ficou de fora e segue. */
            showToast?.(`Tipo criado, mas o atributo "${a.descricao}" falhou: ${err.message}`, "error");
          }
        }

        setTipos((prev) => [...prev, { ...created, atributos: criados }]);
        showToast?.(
          criados.length
            ? `Tipo "${created.descricao}" criado com ${criados.length} atributo(s).`
            : `Tipo "${created.descricao}" criado.`,
        );
        /* Vai para os atributos do tipo recém-criado, e não para a lista: quem
           acabou de descrever um tipo quase sempre quer continuar descrevendo. */
        navigate(`/tipos-imovel/${created.id}/atributos`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteTipo(t) {
    if (!await confirm(`Excluir o tipo "${t.descricao}" e todos os seus atributos?`, "Excluir")) return;
    try {
      await api.deleteTipoImovel(tenantSlug, t.id);
      setTipos((prev) => prev.filter((x) => x.id !== t.id));
      showToast?.(`Tipo "${t.descricao}" excluído.`);
    } catch (err) {
      showToast?.(err.message, "error");
    }
  }

  // ─── Atributo CRUD ────────────────────────────────────────────────────────

  function abrirGerenciarAtributos(t) {
    setTipoAtivo(t);
    navigate(`/tipos-imovel/${t.id}/atributos`);
  }

  function abrirCriarAtributo() {
    navigate(`/tipos-imovel/${tipoId}/atributos/novo`);
  }

  function preencherAtributo(a) {
    setEditandoAtributo(a);
    setAtributoForm({ descricao: a.descricao, grupo: a.grupo || "" });
    setError("");
  }

  function abrirEditarAtributo(a) {
    preencherAtributo(a);
    preenchidoPara.current = `atributo:${a.id}`;
    navigate(`/tipos-imovel/${tipoId}/atributos/${a.id}`);
  }

  /* ── AS SUB-TELAS SE PREENCHEM A PARTIR DA URL ───────────────────────────
     Um efeito só para os quatro casos, porque eles compartilham a mesma fonte:
     `tipos`, que já vem do servidor com os atributos aninhados. Não há chamada
     nova — o que faltava era ler a lista em vez de depender de um clique.

     `tipoAtivo` é sincronizado SEMPRE que há `tipoId`, e não só na vista de
     atributos: o formulário de atributo mostra o nome do tipo na trilha e usa
     `tipoAtivo.id` para gravar. Sem isso, abrir o link de um atributo direto
     gravaria contra `null`.

     `preenchidoPara` impede o efeito de reescrever o que a pessoa está
     digitando quando a lista recarregar. */
  const preenchidoPara = useRef(null);
  useEffect(() => {
    const tipo = tipoId ? tipos.find((t) => t.id === tipoId) : null;
    if (tipo && tipo !== tipoAtivo) setTipoAtivo(tipo);

    if (criandoTipo) {
      if (preenchidoPara.current === "tipo:novo") return;
      preenchidoPara.current = "tipo:novo";
      setEditandoTipo(null); setTipoForm(emptyTipoForm()); setError("");
      setAtributosNovos([]); setRascunhoAtributo({ descricao: "", grupo: "" });
      return;
    }
    if (criandoAtributo) {
      if (preenchidoPara.current === "atributo:novo") return;
      preenchidoPara.current = "atributo:novo";
      setEditandoAtributo(null); setAtributoForm(emptyAtributoForm()); setError("");
      return;
    }
    if (view === "list") { preenchidoPara.current = null; return; }
    if (!tipos.length) return;   // a lista ainda não chegou

    if (!tipo) {
      showToast?.("Não encontrei este tipo de imóvel.", "error");
      navigate("/tipos-imovel", { replace: true });
      return;
    }
    if (view === "tipoForm") {
      if (preenchidoPara.current === `tipo:${tipoId}`) return;
      preenchidoPara.current = `tipo:${tipoId}`;
      preencherTipo(tipo);
      return;
    }
    if (view === "atributoForm") {
      if (preenchidoPara.current === `atributo:${atributoId}`) return;
      const a = (tipo.atributos || []).find((x) => x.id === atributoId);
      if (!a) {
        showToast?.("Não encontrei este atributo.", "error");
        navigate(`/tipos-imovel/${tipoId}/atributos`, { replace: true });
        return;
      }
      preenchidoPara.current = `atributo:${atributoId}`;
      preencherAtributo(a);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoId, atributoId, criandoTipo, criandoAtributo, view, tipos]);

  async function handleAtributoSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = { descricao: atributoForm.descricao, grupo: atributoForm.grupo || null };
      if (editandoAtributo) {
        const updated = await api.updateAtributo(tenantSlug, editandoAtributo.id, payload);
        setTipos((prev) => prev.map((t) =>
          t.id === tipoAtivo.id ? { ...t, atributos: t.atributos.map((a) => a.id === updated.id ? updated : a) } : t
        ));
        setTipoAtivo((prev) => ({ ...prev, atributos: prev.atributos.map((a) => a.id === updated.id ? updated : a) }));
        showToast?.(`Atributo "${updated.descricao}" atualizado.`);
      } else {
        const created = await api.createAtributo(tenantSlug, tipoAtivo.id, payload);
        setTipos((prev) => prev.map((t) =>
          t.id === tipoAtivo.id ? { ...t, atributos: [...t.atributos, created] } : t
        ));
        setTipoAtivo((prev) => ({ ...prev, atributos: [...prev.atributos, created] }));
        showToast?.(`Atributo "${created.descricao}" criado.`);
      }
      navigate(`/tipos-imovel/${tipoId}/atributos`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAtributo(a) {
    if (!await confirm(`Excluir o atributo "${a.descricao}"?`, "Excluir")) return;
    try {
      await api.deleteAtributo(tenantSlug, a.id);
      setTipos((prev) => prev.map((t) =>
        t.id === tipoAtivo.id ? { ...t, atributos: t.atributos.filter((x) => x.id !== a.id) } : t
      ));
      setTipoAtivo((prev) => ({ ...prev, atributos: prev.atributos.filter((x) => x.id !== a.id) }));
      showToast?.(`Atributo "${a.descricao}" excluído.`);
    } catch (err) {
      showToast?.(err.message, "error");
    }
  }

  // ─── Formulário de Tipo ───────────────────────────────────────────────────

  /* Esc sobe UM degrau da trilha, e não sempre até a lista: de "Novo Atributo"
     ele volta aos atributos do tipo, que é de onde se veio. As vistas trocam por
     estado dentro de `/tipos-imovel`, então o atalho global não alcança nenhuma
     delas. */
  /* ── O TÍTULO E A TRILHA ACOMPANHAM A SUB-TELA ──────────────────────────
     Eram três trilhas desenhadas dentro do conteúdo, uma por sub-tela, logo
     abaixo da faixa que já desenha a sua — e a de cima falando sempre de
     "Categoria de Imóvel", inclusive com um atributo aberto dois níveis abaixo.

     O degrau do meio ("Casa", "Apartamento") é o que a rota não teria como
     saber: ele é o NOME do tipo, e sai do registro. Ver `useTituloDaTela`. */
  const degrauDoTipo = tipoAtivo ? {
    chave: "atributos",
    rotulo: tipoAtivo.descricao,
    Icone: ListChecks,
    aoIr: () => navigate(`/tipos-imovel/${tipoAtivo.id}/atributos`),
  } : null;

  useTituloDaTela({
    titulo: view === "tipoForm" ? (editandoTipo ? "Editar Tipo de Imóvel" : "Novo Tipo de Imóvel")
      : view === "atributoForm" ? (editandoAtributo ? "Editar Atributo" : "Novo Atributo")
      : view === "atributos" ? (tipoAtivo?.descricao || "Atributos")
      : "Categoria de Imóvel",
    subtitulo: view === "atributos" ? "Os atributos que este tipo de imóvel aceita."
      : view === "atributoForm" ? (tipoAtivo?.descricao || null)
      : view === "tipoForm" ? (editandoTipo?.descricao || "Um novo tipo de imóvel para o acervo.")
      : "Os tipos de imóvel do acervo e os atributos de cada um.",
    trilha: view === "list" ? undefined : [
      ...degrausAte("/tipos-imovel", navigate),
      ...(view === "tipoForm" ? [{
        chave: "tipoForm",
        rotulo: editandoTipo ? "Editar Tipo de Imóvel" : "Novo Tipo de Imóvel",
        Icone: editandoTipo ? PencilSimple : PlusCircle,
        aoIr: () => {},
      }] : []),
      ...(view !== "tipoForm" && degrauDoTipo ? [degrauDoTipo] : []),
      ...(view === "atributoForm" ? [{
        chave: "atributoForm",
        rotulo: editandoAtributo ? "Editar Atributo" : "Novo Atributo",
        Icone: editandoAtributo ? PencilSimple : PlusCircle,
        aoIr: () => {},
      }] : []),
    ],
  });

  /* Esc sobe UM nível, e não volta direto à lista: de um atributo aberto,
     "sair" é voltar aos atributos daquele tipo, e não abandonar o tipo. */
  useSaidaDaTela(
    () => navigate(view === "atributoForm" ? `/tipos-imovel/${tipoId}/atributos` : "/tipos-imovel"),
    view !== "list",
  );

  if (view === "tipoForm") {
    return (
      <section key={view} className="glass-panel" style={{ animation: "fadeIn 0.3s ease-in-out" }}>
        {confirmModal}
        {error ? <div className="error">{error}</div> : null}
        <form onSubmit={handleTipoSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Nome do tipo <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              placeholder="Ex: Apartamento, Casa, Terreno"
              value={tipoForm.descricao}
              onChange={(e) => setTipoForm((p) => ({ ...p, descricao: e.target.value }))}
              required disabled={loading}
            />
          </div>

          <div style={{ background: "var(--sup-02, rgba(255,255,255,0.02))", border: "1px solid var(--linha-07, rgba(255,255,255,0.07))", borderRadius: "12px", padding: "16px" }}>
            <AreaFieldsEditor
              value={tipoForm.areaFields}
              onChange={(v) => setTipoForm((p) => ({ ...p, areaFields: v }))}
            />
          </div>

          {/* -- ATRIBUTOS ----------------------------------------------------
              No cadastro eles ficam AQUI, e nao atras de um segundo passo. Um
              tipo sem atributo nao descreve imovel nenhum, e mandar a pessoa
              gravar, voltar a lista e clicar em "gerenciar" para so entao dizer
              que Casa tem piscina e pedir que ela termine um cadastro que ainda
              nao esta pronto.

              Na EDICAO o bloco vira um botao: ali os atributos ja existem, tem
              id, podem ser renomeados e excluidos — e essa e a tela de gerencia,
              que ja sabe fazer tudo isso. Duplica-la aqui seriam dois lugares
              para a mesma coisa. */}
          {editandoTipo ? (
            <div style={{ background: "var(--sup-02, rgba(255,255,255,0.02))", border: "1px solid var(--linha-07, rgba(255,255,255,0.07))", borderRadius: "12px", padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600 }}>Atributos</div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  {(editandoTipo.atributos || []).length} cadastrado(s) para este tipo.
                </div>
              </div>
              <button
                type="button"
                className="button-secondary"
                onClick={() => navigate(`/tipos-imovel/${editandoTipo.id}/atributos`)}
                style={{ width: "auto", padding: "10px 16px" }}
              >
                Gerenciar atributos
              </button>
            </div>
          ) : (
            <div style={{ background: "var(--sup-02, rgba(255,255,255,0.02))", border: "1px solid var(--linha-07, rgba(255,255,255,0.07))", borderRadius: "12px", padding: "16px" }}>
              <div style={{ display: "block", marginBottom: "6px", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Atributos
              </div>
              <p style={{ margin: "0 0 12px", fontSize: "12.5px", color: "var(--text-muted)" }}>
                O que este tipo pode ter — piscina, churrasqueira, vaga coberta. Da para
                acrescentar mais depois; eles sao gravados junto com o tipo.
              </p>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <input
                  placeholder="Nome do atributo (ex: Piscina)"
                  value={rascunhoAtributo.descricao}
                  onChange={(e) => setRascunhoAtributo((r) => ({ ...r, descricao: e.target.value }))}
                  disabled={loading}
                  style={{ flex: "2 1 200px" }}
                  onKeyDown={aoTeclarNoRascunho}
                />
                <input
                  placeholder="Grupo (opcional)"
                  value={rascunhoAtributo.grupo}
                  onChange={(e) => setRascunhoAtributo((r) => ({ ...r, grupo: e.target.value }))}
                  disabled={loading}
                  style={{ flex: "1 1 140px" }}
                  onKeyDown={aoTeclarNoRascunho}
                />
                <button
                  type="button"
                  className="button-secondary"
                  onClick={adicionarAtributoRascunho}
                  disabled={loading || !rascunhoAtributo.descricao.trim()}
                  style={{ width: "auto", padding: "10px 16px" }}
                >
                  Adicionar
                </button>
              </div>

              {atributosNovos.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" }}>
                  {atributosNovos.map((a, i) => (
                    <span
                      key={`${a.descricao}-${i}`}
                      style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "12.5px", padding: "5px 10px", borderRadius: "999px", background: "var(--sup-03, rgba(255,255,255,0.05))", border: "1px solid var(--linha-08, rgba(255,255,255,0.08))" }}
                    >
                      {a.descricao}
                      {a.grupo ? <em style={{ color: "var(--text-muted)", fontStyle: "normal" }}>· {a.grupo}</em> : null}
                      <button
                        type="button"
                        onClick={() => setAtributosNovos((prev) => prev.filter((_, x) => x !== i))}
                        aria-label={`Remover ${a.descricao}`}
                        style={{ width: "auto", padding: 0, background: "none", border: 0, color: "var(--text-muted)", cursor: "pointer", fontSize: "14px", lineHeight: 1 }}
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="actions" style={{ marginTop: "8px" }}>
            <button type="submit" disabled={loading} style={{ width: "auto", padding: "10px 20px" }}>
              {editandoTipo ? "Salvar Alterações" : "Criar Tipo"}
            </button>
            <button type="button" className="button-secondary" onClick={() => navigate("/tipos-imovel")} disabled={loading} style={{ width: "auto", padding: "10px 20px" }}>
              Cancelar
            </button>
          </div>
        </form>
      </section>
    );
  }

  // ─── Formulário de Atributo ───────────────────────────────────────────────

  if (view === "atributoForm") {
    const gruposExistentes = [...new Set(
      (tipoAtivo?.atributos || []).map((a) => a.grupo).filter(Boolean)
    )].sort();

    return (
      <section key={view} className="glass-panel" style={{ animation: "fadeIn 0.3s ease-in-out" }}>
        {confirmModal}
        {error ? <div className="error">{error}</div> : null}
        <form className="grid" onSubmit={handleAtributoSubmit}>
          <input
            placeholder="Nome do atributo (ex: Piscina, Churrasqueira)"
            value={atributoForm.descricao}
            onChange={(e) => setAtributoForm((p) => ({ ...p, descricao: e.target.value }))}
            required disabled={loading}
          />
          <div>
            <input
              list="grupos-existentes"
              placeholder="Grupo (ex: Lazer, Segurança) — opcional"
              value={atributoForm.grupo}
              onChange={(e) => setAtributoForm((p) => ({ ...p, grupo: e.target.value }))}
              disabled={loading}
            />
            {gruposExistentes.length > 0 && (
              <datalist id="grupos-existentes">
                {gruposExistentes.map((g) => <option key={g} value={g} />)}
              </datalist>
            )}
          </div>
          <div className="actions" style={{ marginTop: "24px" }}>
            <button type="submit" disabled={loading} style={{ width: "auto", padding: "10px 20px" }}>
              {editandoAtributo ? "Salvar Alterações" : "Criar Atributo"}
            </button>
            <button type="button" className="button-secondary" onClick={() => navigate(`/tipos-imovel/${tipoId}/atributos`)} disabled={loading} style={{ width: "auto", padding: "10px 20px" }}>
              Cancelar
            </button>
          </div>
        </form>
      </section>
    );
  }

  // ─── Gerenciar Atributos de um Tipo ──────────────────────────────────────

  if (view === "atributos" && tipoAtivo) {
    const grupos = [...new Set((tipoAtivo.atributos || []).map((a) => a.grupo || "Geral"))];
    const semAtributos = (tipoAtivo.atributos || []).length === 0;

    return (
      <section
        key={view}
        className={semAtributos ? undefined : "glass-panel"}
        style={{ animation: "fadeIn 0.3s ease-in-out" }}
      >
        {confirmModal}
        {/* A trilha subiu para a faixa do painel — uma só, no mesmo lugar em
            toda tela. O que sobra desta linha é o botão. */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: "24px" }}>
          <div style={{ marginLeft: "auto" }}>
            {semAtributos ? null : <BtnNovo onClick={abrirCriarAtributo} label="Novo Atributo" />}
          </div>
        </div>

        {semAtributos ? (
          /* O convite carrega o botão que saiu do topo — e com ele a tecla "N".
             Uma frase cinza dizendo que não há nada, num tipo recém-criado que
             nunca terá nada até alguém agir, é a informação menos útil da tela. */
          <ConviteDeCriacao
            plena
            accent="#8b5cf6"
            icone={<ListChecks size={34} weight="duotone" />}
            titulo={`Pronto para criar o primeiro atributo de ${tipoAtivo.descricao}?`}
            texto="Atributo é o que este tipo pode ter — piscina, churrasqueira, portaria 24h. É por eles que o cliente filtra na vitrine."
            acaoLabel="Cadastrar atributo"
            onAcao={abrirCriarAtributo}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {grupos.map((grupo) => {
              const itens = (tipoAtivo.atributos || []).filter((a) => (a.grupo || "Geral") === grupo);
              return (
                <div key={grupo}>
                  <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.45, display: "block", marginBottom: "8px" }}>
                    {grupo}
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {itens.map((a) => (
                      <div key={a.id} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 16px", borderRadius: "10px",
                        background: "var(--sup-04, rgba(255,255,255,0.04))", border: "1px solid var(--linha-08, rgba(255,255,255,0.08))",
                      }}>
                        <span style={{ fontSize: "14px", fontWeight: "500" }}>{a.descricao}</span>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <BtnEditar onClick={() => abrirEditarAtributo(a)} />
                          <BtnExcluir onClick={() => handleDeleteAtributo(a)} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  // ─── Lista de Tipos ───────────────────────────────────────────────────────

  return (
    /* Sem nenhum tipo, o painel de vidro sai e fica só a moldura do convite —
       duas caixas empilhadas para um conteúdo só. */
    <section
      key={view}
      className={tipos.length === 0 ? undefined : "glass-panel"}
      style={{ animation: "fadeIn 0.3s ease-in-out" }}
    >
      {confirmModal}
      {/* A trilha subiu para a faixa do painel, que a desenha a partir da rota —
          uma só, no mesmo lugar em toda tela. Ver `CabecalhoDoPainel`. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <h2 style={{ margin: 0 }}>Tipos de Imóvel e Atributos</h2>
        {/* Vazio: o convite já traz o botão e a tecla. */}
        {tipos.length === 0 ? null : <BtnNovo onClick={abrirCriarTipo} label="Novo Tipo" />}
      </div>

      {/* A tira de tipos de contrato sai enquanto não houver nenhum tipo de
          imóvel: sem categoria não se cadastra imóvel nenhum, e decidir se
          "Aluguel" está ativo antes disso é uma pergunta sem consequência. Ela
          volta assim que existir o primeiro tipo, e o convite fica com a área
          inteira em vez de espremido embaixo de um painel de ajuste. */}
      {tipos.length > 0 ? <TiposContratoCard tenantSlug={tenantSlug} /> : null}

      {tipos.length === 0 ? (
        <ConviteDeCriacao
          plena
          accent="#8b5cf6"
          icone={<Tag size={34} weight="duotone" />}
          titulo="Pronto para criar seu primeiro tipo de imóvel?"
          texto="O tipo é o que organiza o acervo — Apartamento, Casa, Terreno — e é nele que moram os atributos que cada categoria pede."
          acaoLabel="Cadastrar tipo"
          onAcao={abrirCriarTipo}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {tipos.map((t) => {
            const fields = Array.isArray(t.areaFields) ? t.areaFields : [];
            return (
              <div key={t.id} style={{
                padding: "16px 20px", borderRadius: "12px",
                background: "var(--sup-04, rgba(255,255,255,0.04))", border: "1px solid var(--linha-08, rgba(255,255,255,0.08))",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: "600", fontSize: "15px" }}>{t.descricao}</span>
                      <span style={{ fontSize: "12px", opacity: 0.4 }}>
                        {(t.atributos || []).length} atributo(s)
                      </span>
                    </div>

                    {/* Campos de área */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "8px" }}>
                      {fields.length === 0 ? (
                        <span style={{ fontSize: "11px", opacity: 0.35, fontStyle: "italic" }}>
                          Todos os campos de área (não configurado)
                        </span>
                      ) : fields.map((k, i) => (
                        <span key={k} style={{
                          fontSize: "11px", fontWeight: "600", padding: "2px 9px", borderRadius: "20px",
                          background: i === 0 ? "rgba(99,102,241,0.18)" : "var(--sup-07, rgba(255,255,255,0.07))",
                          color: i === 0 ? "#a5b4fc" : "var(--text-muted)",
                          border: i === 0 ? "1px solid rgba(99,102,241,0.3)" : "1px solid transparent",
                        }}>
                          {i === 0 ? <IconeEstrela size={10} style={{ marginRight: 4, color: "#d4af37" }} /> : null}{AREA_LABEL[k] ?? k}
                        </span>
                      ))}
                    </div>

                    {/* Atributos */}
                    {(t.atributos || []).length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "8px" }}>
                        {(t.atributos || []).map((a) => (
                          <span key={a.id} style={{
                            fontSize: "11px", fontWeight: "600", padding: "2px 9px", borderRadius: "20px",
                            background: "rgba(16,185,129,0.10)", color: "#6ee7b7",
                          }}>
                            {a.descricao}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                    <BtnGerenciar onClick={() => abrirGerenciarAtributos(t)} title="Gerenciar atributos" />
                    <BtnEditar onClick={() => abrirEditarTipo(t)} />
                    <BtnExcluir onClick={() => handleDeleteTipo(t)} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
