import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { api } from "../api";
import { BtnEditar, BtnExcluir, BtnGerenciar, BtnNovo } from "../components/ActionIcons";
import { useConfirm } from "../components/ConfirmModal";

import { TIPOS_CONTRATO, TIPOS_CONTRATO_KEYS } from "../utils/tiposContrato.js";
import { IconeEstrela } from "../components/Icones.jsx";
import { ConviteDeCriacao } from "../components/ConviteDeCriacao.jsx";
import { Tag, PlusCircle, PencilSimple, ListChecks } from "@phosphor-icons/react";
import { Trilha } from "../components/Trilha.jsx";
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
  const [view, setView] = useState("list"); // "list" | "tipoForm" | "atributos" | "atributoForm"
  const [editandoTipo, setEditandoTipo] = useState(null);
  const [tipoAtivo, setTipoAtivo] = useState(null);
  const [editandoAtributo, setEditandoAtributo] = useState(null);
  const [tipoForm, setTipoForm] = useState(emptyTipoForm());
  const [atributoForm, setAtributoForm] = useState(emptyAtributoForm());
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
    setEditandoTipo(null);
    setTipoForm(emptyTipoForm());
    setError("");
    setView("tipoForm");
  }

  function abrirEditarTipo(t) {
    setEditandoTipo(t);
    setTipoForm({
      descricao: t.descricao,
      areaFields: Array.isArray(t.areaFields) ? t.areaFields : [],
    });
    setError("");
    setView("tipoForm");
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
      } else {
        const created = await api.createTipoImovel(tenantSlug, tipoForm);
        setTipos((prev) => [...prev, { ...created, atributos: [] }]);
        showToast?.(`Tipo "${created.descricao}" criado.`);
      }
      setView("list");
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
    setView("atributos");
  }

  function abrirCriarAtributo() {
    setEditandoAtributo(null);
    setAtributoForm(emptyAtributoForm());
    setError("");
    setView("atributoForm");
  }

  function abrirEditarAtributo(a) {
    setEditandoAtributo(a);
    setAtributoForm({ descricao: a.descricao, grupo: a.grupo || "" });
    setError("");
    setView("atributoForm");
  }

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
      setView("atributos");
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
  useSaidaDaTela(
    () => setView(view === "atributoForm" ? "atributos" : "list"),
    view === "tipoForm" || view === "atributos" || view === "atributoForm",
  );

  if (view === "tipoForm") {
    return (
      <section key={view} className="glass-panel" style={{ animation: "fadeIn 0.3s ease-in-out" }}>
        {confirmModal}
        <div style={{ marginBottom: "24px" }}>
          <Trilha
            itens={[
              ...degrausAte("/tipos-imovel", navigate, () => setView("list")),
              {
                chave: "tipoForm",
                rotulo: editandoTipo ? "Editar Tipo de Imóvel" : "Novo Tipo de Imóvel",
                Icone: editandoTipo ? PencilSimple : PlusCircle,
                aoIr: () => setView("tipoForm"),
              },
            ]}
          />
        </div>
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

          <div className="actions" style={{ marginTop: "8px" }}>
            <button type="submit" disabled={loading} style={{ width: "auto", padding: "10px 20px" }}>
              {editandoTipo ? "Salvar Alterações" : "Criar Tipo"}
            </button>
            <button type="button" className="button-secondary" onClick={() => setView("list")} disabled={loading} style={{ width: "auto", padding: "10px 20px" }}>
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
        {/* Três degraus: o atributo mora DENTRO de um tipo, e a linha "Tipo:
            Casa" que ficava embaixo do título dizia isso sem deixar voltar. */}
        <div style={{ marginBottom: "24px" }}>
          <Trilha
            itens={[
              ...degrausAte("/tipos-imovel", navigate, () => setView("list")),
              {
                chave: "atributos",
                rotulo: tipoAtivo?.descricao || "Atributos",
                Icone: ListChecks,
                aoIr: () => setView("atributos"),
              },
              {
                chave: "atributoForm",
                rotulo: editandoAtributo ? "Editar Atributo" : "Novo Atributo",
                Icone: editandoAtributo ? PencilSimple : PlusCircle,
                aoIr: () => setView("atributoForm"),
              },
            ]}
          />
        </div>
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
            <button type="button" className="button-secondary" onClick={() => setView("atributos")} disabled={loading} style={{ width: "auto", padding: "10px 20px" }}>
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
        {/* A trilha no lugar do botão "voltar" — é a troca que Configurações e
            Relatórios já fizeram, e o motivo está no cabeçalho de `Trilha.jsx`:
            ela diz onde a página MORA, e não por onde a pessoa passou. */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <Trilha
            itens={[
              ...degrausAte("/tipos-imovel", navigate, () => setView("list")),
              {
                chave: "atributos",
                rotulo: tipoAtivo.descricao,
                Icone: ListChecks,
                aoIr: () => setView("atributos"),
              },
            ]}
          />
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
      <div style={{ marginBottom: "14px" }}>
        <Trilha itens={degrausAte("/tipos-imovel", navigate)} />
      </div>
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
