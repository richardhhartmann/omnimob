import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { BtnAtivar, BtnDesativar, BtnEditar, BtnNovo } from "../components/ActionIcons";
import { Avatar, Chip, FilterTabs, SearchInput, StatCard, StatGrid, StatusPill } from "../components/adminUi";
import { SelectCustom } from "../components/SelectCustom";
import { SkeletonStats, SkeletonListRows } from "../components/Skeleton";

const FORM_EMPTY = { nome: "", login: "", cargoCodigo: "", ativo: true, forcaAlterarSenha: false };

export function UsuariosPage({ session }) {
  const tenantSlug = session?.tenant?.slug;
  const [usuarios, setUsuarios] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [view, setView] = useState("list"); // "list" | "form"
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_EMPTY);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | inactive

  useEffect(() => {
    if (!tenantSlug) return;
    Promise.all([
      api.listUsuarios(tenantSlug),
      api.listCargos(tenantSlug),
    ]).then(([u, c]) => { setUsuarios(u); setCargos(c); }).catch(() => {}).finally(() => setInitialLoading(false));
  }, [tenantSlug]);

  const stats = useMemo(() => ({
    total: usuarios.length,
    ativos: usuarios.filter((u) => u.ativo).length,
    inativos: usuarios.filter((u) => !u.ativo).length,
    cargos: new Set(usuarios.map((u) => u.cargo?.descricao).filter(Boolean)).size,
  }), [usuarios]);

  const visiveis = useMemo(() => {
    const q = search.trim().toLowerCase();
    return usuarios.filter((u) => {
      const matchesSearch = !q || [u.nome, u.login, u.cargo?.descricao].filter(Boolean).some((v) => v.toLowerCase().includes(q));
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? u.ativo : !u.ativo);
      return matchesSearch && matchesStatus;
    });
  }, [usuarios, search, statusFilter]);

  function abrirCriar() {
    setEditando(null);
    setForm(FORM_EMPTY);
    setError("");
    setView("form");
  }

  function abrirEditar(u) {
    setEditando(u);
    setForm({ nome: u.nome, login: u.login, cargoCodigo: String(u.cargoCodigo), ativo: u.ativo, forcaAlterarSenha: u.forcaAlterarSenha });
    setError("");
    setView("form");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    // O combo é um botão, então o `required` do HTML não se aplica: validamos aqui.
    if (!form.cargoCodigo) {
      setError("Selecione o cargo do usuário.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (editando) {
        // Na edição, a senha não é alterável pelo painel — só nome/login/cargo/
        // status e a flag de forçar troca de senha.
        const payload = {
          nome: form.nome,
          login: form.login,
          cargoCodigo: Number(form.cargoCodigo),
          ativo: form.ativo,
          forcaAlterarSenha: form.forcaAlterarSenha,
        };
        const updated = await api.updateUsuario(tenantSlug, editando.id, payload);
        setUsuarios((prev) => prev.map((u) => u.id === updated.id ? updated : u));
      } else {
        // Novo usuário: sem senha; ele define a própria no primeiro acesso.
        const created = await api.createUsuario(tenantSlug, {
          nome: form.nome,
          login: form.login,
          cargoCodigo: Number(form.cargoCodigo),
          ativo: form.ativo,
        });
        setUsuarios((prev) => [...prev, created]);
      }
      setView("list");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleAtivo(u) {
    try {
      if (u.ativo) {
        await api.desativarUsuario(tenantSlug, u.id);
        setUsuarios((prev) => prev.map((x) => x.id === u.id ? { ...x, ativo: false } : x));
      } else {
        const updated = await api.updateUsuario(tenantSlug, u.id, { ativo: true });
        setUsuarios((prev) => prev.map((x) => x.id === updated.id ? updated : x));
      }
    } catch (err) {
      alert(err.message);
    }
  }

  if (view === "form") {
    return (
      <section className="main-content glass-panel" style={{ maxWidth: "1100px", animation: "fadeIn 0.3s ease-in-out" }}>
        <h2 style={{ marginBottom: "24px" }}>{editando ? "Editar Usuário" : "Novo Usuário"}</h2>
        {error ? <div className="error">{error}</div> : null}
        <form className="grid" onSubmit={handleSubmit}>
          <input
            placeholder="Nome completo"
            value={form.nome}
            onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
            required disabled={loading}
          />
          <input
            placeholder="Login"
            value={form.login}
            onChange={(e) => setForm((p) => ({ ...p, login: e.target.value }))}
            required disabled={loading}
          />
          <SelectCustom
            value={form.cargoCodigo}
            placeholder="Selecione o cargo"
            disabled={loading}
            options={cargos.map((c) => ({ value: String(c.id), label: c.descricao }))}
            onChange={(v) => setForm((p) => ({ ...p, cargoCodigo: v }))}
          />

          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px" }}>
              <input type="checkbox" checked={form.ativo} onChange={(e) => setForm((p) => ({ ...p, ativo: e.target.checked }))} disabled={loading} />
              Usuário ativo
            </label>
            {/* Forçar troca só faz sentido na edição; novos usuários já definem
                a senha no primeiro acesso (força troca é sempre true). */}
            {editando && (
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px" }}>
                <input type="checkbox" checked={form.forcaAlterarSenha} onChange={(e) => setForm((p) => ({ ...p, forcaAlterarSenha: e.target.checked }))} disabled={loading} />
                Forçar alteração de senha no próximo acesso
              </label>
            )}
          </div>

          {!editando && (
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5 }}>
              O usuário não recebe senha aqui. No primeiro acesso, ele informa o login e
              define a própria senha na tela seguinte.
            </p>
          )}

          <div className="actions" style={{ marginTop: "24px" }}>
            <button type="submit" disabled={loading} style={{ width: "auto", padding: "10px 20px" }}>
              {editando ? "Salvar Alterações" : "Criar Usuário"}
            </button>
            <button type="button" className="button-secondary" onClick={() => setView("list")} disabled={loading} style={{ width: "auto", padding: "10px 20px" }}>
              Cancelar
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <div className="main-content" style={{ maxWidth: "1100px", animation: "fadeIn 0.3s ease-in-out" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <header>
          <h1 style={{ fontSize: "28px", margin: "0 0 6px" }}>Usuários</h1>
          <p style={{ color: "var(--text-muted)", margin: 0 }}>Quem tem acesso ao painel e com qual cargo.</p>
        </header>
        <BtnNovo onClick={abrirCriar} label="Novo Usuário" />
      </div>

      {initialLoading ? <SkeletonStats count={4} /> : (
      <StatGrid>
        <StatCard label="Total" value={stats.total} accent="#6366f1" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></svg>} />
        <StatCard label="Ativos" value={stats.ativos} accent="#10b981" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>} />
        <StatCard label="Inativos" value={stats.inativos} accent="#94a3b8" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>} />
        <StatCard label="Cargos em uso" value={stats.cargos} accent="#a78bfa" icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>} />
      </StatGrid>
      )}

      <div className="glass-panel" style={{ padding: "16px", marginBottom: "20px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, login ou cargo…" />
        <FilterTabs value={statusFilter} onChange={setStatusFilter} options={[
          { key: "all", label: "Todos" },
          { key: "active", label: "Ativos" },
          { key: "inactive", label: "Inativos" },
        ]} />
      </div>

      {initialLoading ? (
        <SkeletonListRows count={5} />
      ) : visiveis.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: "center", padding: "48px 24px" }}>
          <p style={{ color: "var(--text-muted)", margin: 0 }}>
            {search || statusFilter !== "all" ? "Nenhum usuário encontrado com estes filtros." : "Nenhum usuário cadastrado."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {visiveis.map((u) => (
            <div key={u.id} className="glass-panel" style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px",
              padding: "14px 18px", opacity: u.ativo ? 1 : 0.6,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0, flex: 1 }}>
                <Avatar name={u.nome} seed={u.login || u.nome} size={42} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: "600", fontSize: "15px" }}>{u.nome}</span>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>@{u.login}</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
                    {u.cargo?.descricao ? <Chip color="#a78bfa">{u.cargo.descricao}</Chip> : null}
                    {u.forcaAlterarSenha ? <Chip color="#f59e0b" title="O usuário deverá trocar a senha no próximo acesso">Trocar senha</Chip> : null}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <StatusPill active={u.ativo} />
                <BtnEditar onClick={() => abrirEditar(u)} />
                {u.ativo
                  ? <BtnDesativar onClick={() => toggleAtivo(u)} />
                  : <BtnAtivar onClick={() => toggleAtivo(u)} />
                }
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
