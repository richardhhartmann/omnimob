import { useEffect, useState } from "react";
import { api } from "../api";
import { BtnAtivar, BtnDesativar, BtnEditar, BtnNovo } from "../components/ActionIcons";

const FORM_EMPTY = { nome: "", login: "", senha: "", cargoCodigo: "", ativo: true, forcaAlterarSenha: false };

export function UsuariosPage({ session }) {
  const tenantSlug = session?.tenant?.slug;
  const [usuarios, setUsuarios] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [view, setView] = useState("list"); // "list" | "form"
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!tenantSlug) return;
    Promise.all([
      api.listUsuarios(tenantSlug),
      api.listCargos(tenantSlug),
    ]).then(([u, c]) => { setUsuarios(u); setCargos(c); }).catch(() => {});
  }, [tenantSlug]);

  function abrirCriar() {
    setEditando(null);
    setForm(FORM_EMPTY);
    setError("");
    setView("form");
  }

  function abrirEditar(u) {
    setEditando(u);
    setForm({ nome: u.nome, login: u.login, senha: "", cargoCodigo: String(u.cargoCodigo), ativo: u.ativo, forcaAlterarSenha: u.forcaAlterarSenha });
    setError("");
    setView("form");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = {
        nome: form.nome,
        login: form.login,
        cargoCodigo: Number(form.cargoCodigo),
        ativo: form.ativo,
        forcaAlterarSenha: form.forcaAlterarSenha,
      };
      if (form.senha) payload.senha = form.senha;

      if (editando) {
        const updated = await api.updateUsuario(tenantSlug, editando.id, payload);
        setUsuarios((prev) => prev.map((u) => u.id === updated.id ? updated : u));
      } else {
        if (!form.senha) { setError("Senha é obrigatória para novo usuário."); setLoading(false); return; }
        payload.senha = form.senha;
        const created = await api.createUsuario(tenantSlug, payload);
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
      <section className="glass-panel" style={{ animation: "fadeIn 0.3s ease-in-out" }}>
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
          <input
            type="password"
            placeholder={editando ? "Nova senha (deixe em branco para manter)" : "Senha"}
            value={form.senha}
            onChange={(e) => setForm((p) => ({ ...p, senha: e.target.value }))}
            disabled={loading}
          />
          <select
            value={form.cargoCodigo}
            onChange={(e) => setForm((p) => ({ ...p, cargoCodigo: e.target.value }))}
            required disabled={loading}
          >
            <option value="" disabled hidden>Selecione o cargo</option>
            {cargos.map((c) => <option key={c.id} value={c.id}>{c.descricao}</option>)}
          </select>

          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px" }}>
              <input type="checkbox" checked={form.ativo} onChange={(e) => setForm((p) => ({ ...p, ativo: e.target.checked }))} disabled={loading} />
              Usuário ativo
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px" }}>
              <input type="checkbox" checked={form.forcaAlterarSenha} onChange={(e) => setForm((p) => ({ ...p, forcaAlterarSenha: e.target.checked }))} disabled={loading} />
              Forçar alteração de senha no próximo acesso
            </label>
          </div>

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
    <section className="glass-panel" style={{ animation: "fadeIn 0.3s ease-in-out" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <h2 style={{ margin: 0 }}>Usuários</h2>
        <BtnNovo onClick={abrirCriar} label="Novo Usuário" />
      </div>

      {usuarios.length === 0 ? (
        <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "48px 0" }}>Nenhum usuário cadastrado.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {usuarios.map((u) => (
            <div key={u.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px",
              padding: "16px 20px", borderRadius: "12px",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{
                  width: "38px", height: "38px", borderRadius: "50%", flexShrink: 0,
                  background: u.ativo ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.06)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "15px", fontWeight: "700",
                }}>
                  {u.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: "600", fontSize: "15px" }}>{u.nome}</div>
                  <div style={{ fontSize: "12px", opacity: 0.5, marginTop: "2px" }}>@{u.login} · {u.cargo?.descricao}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{
                  fontSize: "11px", fontWeight: "600", padding: "3px 10px", borderRadius: "20px",
                  background: u.ativo ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.06)",
                  color: u.ativo ? "#10b981" : "var(--text-muted)",
                }}>
                  {u.ativo ? "Ativo" : "Inativo"}
                </span>
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
    </section>
  );
}
