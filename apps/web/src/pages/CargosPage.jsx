import { useEffect, useState } from "react";
import { api } from "../api";
import { BtnEditar, BtnExcluir, BtnNovo } from "../components/ActionIcons";

const PERMISSOES = [
  { key: "acessarPainel",     label: "Acessar Painel" },
  { key: "editarPagina",      label: "Editar Vitrine" },
  { key: "gerenciarImoveis",  label: "Gerenciar Imóveis" },
  { key: "gerenciarLeads",    label: "Gerenciar Leads" },
  { key: "gerenciarUsuarios", label: "Gerenciar Usuários" },
  { key: "gerenciarClientes", label: "Gerenciar Clientes" },
  { key: "verRelatorios",     label: "Ver Relatórios" },
  { key: "publicarRedes",     label: "Publicar em Redes" },
];

function emptyForm() {
  const f = { descricao: "" };
  for (const p of PERMISSOES) f[p.key] = false;
  return f;
}

export function CargosPage({ session, onSessionUpdate }) {
  const tenantSlug = session?.tenant?.slug;
  const [cargos, setCargos] = useState([]);
  const [view, setView] = useState("list");
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!tenantSlug) return;
    api.listCargos(tenantSlug).then(setCargos).catch(() => {});
  }, [tenantSlug]);

  function abrirCriar() {
    setEditando(null);
    setForm(emptyForm());
    setError("");
    setView("form");
  }

  function abrirEditar(c) {
    setEditando(c);
    const f = { descricao: c.descricao };
    for (const p of PERMISSOES) f[p.key] = Boolean(c[p.key]);
    setForm(f);
    setError("");
    setView("form");
  }

  function atualizarSessaoSeProprioCargoFoi(updatedCargo) {
    if (updatedCargo.id === session?.usuario?.cargo?.id && onSessionUpdate) {
      onSessionUpdate({
        ...session,
        usuario: { ...session.usuario, cargo: updatedCargo },
      });
    }
  }

  // Auto-save ao tickar um checkbox (só quando editando)
  async function handlePermissaoChange(key, value) {
    const ehProprioCargoDoUsuario = editando?.id === session?.usuario?.cargo?.id;
    if (key === "acessarPainel" && ehProprioCargoDoUsuario) return; // bloqueado

    const newForm = { ...form, [key]: value };
    setForm(newForm);
    setSaving(true);
    try {
      const updated = await api.updateCargo(tenantSlug, editando.id, newForm);
      setCargos((prev) => prev.map((c) => c.id === updated.id ? updated : c));
      atualizarSessaoSeProprioCargoFoi(updated);
    } catch (err) {
      setForm(form); // reverte
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Salva somente a descrição (ou cria novo cargo com tudo)
  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (editando) {
        const updated = await api.updateCargo(tenantSlug, editando.id, { descricao: form.descricao });
        setCargos((prev) => prev.map((c) => c.id === updated.id ? { ...c, descricao: updated.descricao } : c));
        atualizarSessaoSeProprioCargoFoi({ ...session?.usuario?.cargo, descricao: updated.descricao });
        setView("list");
      } else {
        const created = await api.createCargo(tenantSlug, form);
        setCargos((prev) => [...prev, created]);
        setView("list");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(c) {
    if (!confirm(`Excluir o cargo "${c.descricao}"?`)) return;
    try {
      await api.deleteCargo(tenantSlug, c.id);
      setCargos((prev) => prev.filter((x) => x.id !== c.id));
    } catch (err) {
      alert(err.message);
    }
  }

  if (view === "form") {
    const ehProprioCargoDoUsuario = editando?.id === session?.usuario?.cargo?.id;

    return (
      <section className="glass-panel" style={{ animation: "fadeIn 0.3s ease-in-out" }}>
        <h2 style={{ marginBottom: "24px" }}>{editando ? "Editar Cargo" : "Novo Cargo"}</h2>
        {error ? <div className="error">{error}</div> : null}
        <form className="grid" onSubmit={handleSubmit}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              placeholder="Nome do cargo (ex: Corretor, Gerente)"
              value={form.descricao}
              onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
              required disabled={loading}
              style={{ flex: 1 }}
            />
            <button type="submit" disabled={loading} style={{ width: "auto", padding: "10px 20px", flexShrink: 0 }}>
              {editando ? "Salvar nome" : "Criar Cargo"}
            </button>
            <button type="button" className="button-secondary" onClick={() => setView("list")} disabled={loading} style={{ width: "auto", padding: "10px 16px", flexShrink: 0 }}>
              Voltar
            </button>
          </div>

          <div style={{ marginTop: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <span style={{ fontSize: "14px", fontWeight: "600" }}>Permissões</span>
              {editando && (
                <span style={{ fontSize: "12px", opacity: 0.45 }}>
                  {saving ? "Salvando…" : "Salvo automaticamente"}
                </span>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "8px" }}>
              {PERMISSOES.map(({ key, label }) => {
                const locked = key === "acessarPainel" && ehProprioCargoDoUsuario;
                const checked = locked ? true : Boolean(form[key]);
                const isAutoSaving = editando !== null;

                return (
                  <label
                    key={key}
                    title={locked ? "Você não pode remover esta permissão do seu próprio cargo" : undefined}
                    style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: "10px 14px", borderRadius: "10px",
                      cursor: locked || saving ? "not-allowed" : "pointer",
                      border: checked ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.1)",
                      background: checked ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.03)",
                      transition: "all 0.15s ease", fontSize: "13px", userSelect: "none",
                      opacity: locked ? 0.55 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        isAutoSaving
                          ? handlePermissaoChange(key, e.target.checked)
                          : setForm((p) => ({ ...p, [key]: e.target.checked }))
                      }
                      disabled={loading || locked || saving}
                      style={{ accentColor: "#6366f1", width: "14px", height: "14px", flexShrink: 0 }}
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="glass-panel" style={{ animation: "fadeIn 0.3s ease-in-out" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <h2 style={{ margin: 0 }}>Cargos e Permissões</h2>
        <BtnNovo onClick={abrirCriar} label="Novo Cargo" />
      </div>

      {cargos.length === 0 ? (
        <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "48px 0" }}>Nenhum cargo cadastrado.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {cargos.map((c) => (
            <div key={c.id} style={{
              padding: "16px 20px", borderRadius: "12px",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <span style={{ fontWeight: "600", fontSize: "15px" }}>{c.descricao}</span>
                  {c._count?.usuarios > 0 && (
                    <span style={{ marginLeft: "10px", fontSize: "12px", opacity: 0.4 }}>
                      {c._count.usuarios} usuário(s)
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <BtnEditar onClick={() => abrirEditar(c)} />
                  <BtnExcluir onClick={() => handleDelete(c)} />
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {PERMISSOES.filter((p) => c[p.key]).map((p) => (
                  <span key={p.key} style={{
                    fontSize: "11px", fontWeight: "600", padding: "2px 9px", borderRadius: "20px",
                    background: "rgba(99,102,241,0.15)", color: "#a5b4fc",
                  }}>
                    {p.label}
                  </span>
                ))}
                {PERMISSOES.every((p) => !c[p.key]) && (
                  <span style={{ fontSize: "12px", opacity: 0.4 }}>Sem permissões</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
