import { useEffect, useState } from "react";
import { api } from "../api";
import { BtnEditar, BtnExcluir, BtnGerenciar, BtnNovo, BtnVoltar } from "../components/ActionIcons";
import { useConfirm } from "../components/ConfirmModal";

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
              border: checked ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.08)",
              background: checked ? "rgba(99,102,241,0.10)" : "rgba(255,255,255,0.02)",
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

export function TiposImovelPage({ session }) {
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
    api.getTiposImovel(tenantSlug).then(setTipos).catch(() => {});
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
      } else {
        const created = await api.createTipoImovel(tenantSlug, tipoForm);
        setTipos((prev) => [...prev, { ...created, atributos: [] }]);
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
    } catch (err) {
      alert(err.message);
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
      } else {
        const created = await api.createAtributo(tenantSlug, tipoAtivo.id, payload);
        setTipos((prev) => prev.map((t) =>
          t.id === tipoAtivo.id ? { ...t, atributos: [...t.atributos, created] } : t
        ));
        setTipoAtivo((prev) => ({ ...prev, atributos: [...prev.atributos, created] }));
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
    } catch (err) {
      alert(err.message);
    }
  }

  // ─── Formulário de Tipo ───────────────────────────────────────────────────

  if (view === "tipoForm") {
    return (
      <section className="glass-panel" style={{ animation: "fadeIn 0.3s ease-in-out" }}>
        {confirmModal}
        <h2 style={{ marginBottom: "24px" }}>{editandoTipo ? "Editar Tipo de Imóvel" : "Novo Tipo de Imóvel"}</h2>
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

          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "16px" }}>
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
      <section className="glass-panel" style={{ animation: "fadeIn 0.3s ease-in-out" }}>
        {confirmModal}
        <h2 style={{ marginBottom: "4px" }}>{editandoAtributo ? "Editar Atributo" : "Novo Atributo"}</h2>
        <p style={{ fontSize: "13px", opacity: 0.5, marginBottom: "24px" }}>Tipo: {tipoAtivo?.descricao}</p>
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

    return (
      <section className="glass-panel" style={{ animation: "fadeIn 0.3s ease-in-out" }}>
        {confirmModal}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <BtnVoltar onClick={() => setView("list")} label="Tipos" />
          <h2 style={{ margin: 0 }}>Atributos — {tipoAtivo.descricao}</h2>
          <div style={{ marginLeft: "auto" }}>
            <BtnNovo onClick={abrirCriarAtributo} label="Novo Atributo" />
          </div>
        </div>

        {(tipoAtivo.atributos || []).length === 0 ? (
          <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "48px 0" }}>
            Nenhum atributo cadastrado para este tipo.
          </p>
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
                        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
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
    <section className="glass-panel" style={{ animation: "fadeIn 0.3s ease-in-out" }}>
      {confirmModal}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <h2 style={{ margin: 0 }}>Tipos de Imóvel e Atributos</h2>
        <BtnNovo onClick={abrirCriarTipo} label="Novo Tipo" />
      </div>

      {tipos.length === 0 ? (
        <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "48px 0" }}>Nenhum tipo de imóvel cadastrado.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {tipos.map((t) => {
            const fields = Array.isArray(t.areaFields) ? t.areaFields : [];
            return (
              <div key={t.id} style={{
                padding: "16px 20px", borderRadius: "12px",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
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
                          background: i === 0 ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.07)",
                          color: i === 0 ? "#a5b4fc" : "var(--text-muted)",
                          border: i === 0 ? "1px solid rgba(99,102,241,0.3)" : "1px solid transparent",
                        }}>
                          {i === 0 ? "★ " : ""}{AREA_LABEL[k] ?? k}
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
