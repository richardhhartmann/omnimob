import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { BtnEditar, BtnExcluir, BtnNovo } from "../components/ActionIcons";
import { Avatar, SearchInput, StatCard, StatGrid } from "../components/adminUi";
import { useConfirm } from "../components/ConfirmModal";

const PERMISSOES = [
  { key: "acessarPainel",     label: "Acessar Painel" },
  { key: "editarPagina",      label: "Editar Vitrine" },
  { key: "gerenciarImoveis",  label: "Gerenciar Imóveis" },
  { key: "gerenciarLeads",    label: "Gerenciar Leads" },
  { key: "gerenciarUsuarios", label: "Gerenciar Usuários" },
  { key: "gerenciarClientes", label: "Gerenciar Clientes" },
  { key: "gerenciarCargos",   label: "Gerenciar Cargos" },
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
  const { confirm, modal: confirmModal } = useConfirm();
  const [cargos, setCargos] = useState([]);
  const [view, setView] = useState("list");
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!tenantSlug) return;
    api.listCargos(tenantSlug).then(setCargos).catch(() => {});
  }, [tenantSlug]);

  const stats = useMemo(() => ({
    total: cargos.length,
    usuarios: cargos.reduce((sum, c) => sum + (c._count?.usuarios || 0), 0),
    semPermissao: cargos.filter((c) => PERMISSOES.every((p) => !c[p.key])).length,
  }), [cargos]);

  const visiveis = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cargos;
    return cargos.filter((c) => c.descricao?.toLowerCase().includes(q));
  }, [cargos, search]);

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
    if (!await confirm(`Excluir o cargo "${c.descricao}"?`, "Excluir")) return;
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
      <section className="main-content glass-panel" style={{ maxWidth: "1100px", animation: "fadeIn 0.3s ease-in-out" }}>
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
    <div className="main-content" style={{ maxWidth: "1100px", animation: "fadeIn 0.3s ease-in-out" }}>
      {confirmModal}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ margin: 0 }}>Cargos e Permissões</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "14px", margin: "4px 0 0" }}>Defina o que cada cargo pode fazer no painel.</p>
        </div>
        <BtnNovo onClick={abrirCriar} label="Novo Cargo" />
      </div>

      <StatGrid>
        <StatCard label="Cargos" value={stats.total} accent="#6366f1" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>} />
        <StatCard label="Usuários vinculados" value={stats.usuarios} accent="#10b981" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></svg>} />
        <StatCard label="Sem permissões" value={stats.semPermissao} accent="#f59e0b" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>} />
      </StatGrid>

      <div className="glass-panel" style={{ padding: "16px", marginBottom: "20px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cargo…" />
      </div>

      {visiveis.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: "center", padding: "48px 24px" }}>
          <p style={{ color: "var(--text-muted)", margin: 0 }}>
            {search ? "Nenhum cargo encontrado." : "Nenhum cargo cadastrado."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {visiveis.map((c) => (
            <div key={c.id} className="glass-panel" style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <Avatar name={c.descricao} seed={c.descricao + c.id} size={38} />
                  <div>
                    <div style={{ fontWeight: "600", fontSize: "15px" }}>{c.descricao}</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                      {c._count?.usuarios > 0 ? `${c._count.usuarios} usuário${c._count.usuarios !== 1 ? "s" : ""}` : "Nenhum usuário"}
                      {" · "}
                      {PERMISSOES.filter((p) => c[p.key]).length} permiss{PERMISSOES.filter((p) => c[p.key]).length !== 1 ? "ões" : "ão"}
                    </div>
                  </div>
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
    </div>
  );
}
