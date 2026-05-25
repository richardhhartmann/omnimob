import { useEffect, useState } from "react";
import { api } from "../api";
import { BtnAtivar, BtnDesativar, BtnEditar, BtnNovo } from "../components/ActionIcons";

const FORM_EMPTY = {
  nome: "", cpf: "", rg: "", nascimento: "", email: "", telefone: "", whatsapp: "",
  cep: "", endereco: "", bairro: "", cidade: "", estado: "", observacoes: "", ativo: true,
};

export function ClientesPage({ session }) {
  const tenantSlug = session?.tenant?.slug;
  const [clientes, setClientes] = useState([]);
  const [view, setView] = useState("list");
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!tenantSlug) return;
    api.listClientes(tenantSlug).then(setClientes).catch(() => {});
  }, [tenantSlug]);

  function abrirCriar() {
    setEditando(null);
    setForm(FORM_EMPTY);
    setError("");
    setView("form");
  }

  function abrirEditar(c) {
    setEditando(c);
    setForm({
      nome: c.nome || "", cpf: c.cpf || "", rg: c.rg || "",
      nascimento: c.nascimento ? c.nascimento.slice(0, 10) : "",
      email: c.email || "", telefone: c.telefone || "", whatsapp: c.whatsapp || "",
      cep: c.cep || "", endereco: c.endereco || "", bairro: c.bairro || "",
      cidade: c.cidade || "", estado: c.estado || "", observacoes: c.observacoes || "",
      ativo: c.ativo,
    });
    setError("");
    setView("form");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = { ...form };
      if (editando) {
        const updated = await api.updateCliente(tenantSlug, editando.id, payload);
        setClientes((prev) => prev.map((c) => c.id === updated.id ? updated : c));
      } else {
        const created = await api.createCliente(tenantSlug, payload);
        setClientes((prev) => [...prev, created]);
      }
      setView("list");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleAtivo(c) {
    try {
      if (c.ativo) {
        await api.desativarCliente(tenantSlug, c.id);
        setClientes((prev) => prev.map((x) => x.id === c.id ? { ...x, ativo: false } : x));
      } else {
        const updated = await api.updateCliente(tenantSlug, c.id, { ativo: true });
        setClientes((prev) => prev.map((x) => x.id === updated.id ? updated : x));
      }
    } catch (err) {
      alert(err.message);
    }
  }

  function setField(k, v) { setForm((p) => ({ ...p, [k]: v })); }

  if (view === "form") {
    return (
      <section className="glass-panel" style={{ animation: "fadeIn 0.3s ease-in-out" }}>
        <h2 style={{ marginBottom: "24px" }}>{editando ? "Editar Cliente" : "Novo Cliente"}</h2>
        {error ? <div className="error">{error}</div> : null}
        <form className="grid" onSubmit={handleSubmit}>
          <input placeholder="Nome completo" value={form.nome} onChange={(e) => setField("nome", e.target.value)} required disabled={loading} />
          <div className="grid grid-2">
            <input placeholder="CPF" value={form.cpf} onChange={(e) => setField("cpf", e.target.value)} disabled={loading} />
            <input placeholder="RG" value={form.rg} onChange={(e) => setField("rg", e.target.value)} disabled={loading} />
          </div>
          <input type="date" placeholder="Nascimento" value={form.nascimento} onChange={(e) => setField("nascimento", e.target.value)} disabled={loading} />
          <input type="email" placeholder="Email" value={form.email} onChange={(e) => setField("email", e.target.value)} disabled={loading} />
          <div className="grid grid-2">
            <input placeholder="Telefone" value={form.telefone} onChange={(e) => setField("telefone", e.target.value)} disabled={loading} />
            <input placeholder="WhatsApp" value={form.whatsapp} onChange={(e) => setField("whatsapp", e.target.value)} disabled={loading} />
          </div>
          <input placeholder="CEP" value={form.cep} onChange={(e) => setField("cep", e.target.value)} disabled={loading} />
          <input placeholder="Endereço" value={form.endereco} onChange={(e) => setField("endereco", e.target.value)} disabled={loading} />
          <div className="grid grid-2">
            <input placeholder="Bairro" value={form.bairro} onChange={(e) => setField("bairro", e.target.value)} disabled={loading} />
            <input placeholder="Cidade" value={form.cidade} onChange={(e) => setField("cidade", e.target.value)} disabled={loading} />
          </div>
          <input placeholder="Estado (UF)" value={form.estado} onChange={(e) => setField("estado", e.target.value.toUpperCase())} maxLength={2} disabled={loading} />
          <textarea placeholder="Observações" value={form.observacoes} onChange={(e) => setField("observacoes", e.target.value)} disabled={loading} rows={3} />

          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px" }}>
            <input type="checkbox" checked={form.ativo} onChange={(e) => setField("ativo", e.target.checked)} disabled={loading} />
            Cliente ativo
          </label>

          <div className="actions" style={{ marginTop: "24px" }}>
            <button type="submit" disabled={loading} style={{ width: "auto", padding: "10px 20px" }}>
              {editando ? "Salvar Alterações" : "Criar Cliente"}
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
        <h2 style={{ margin: 0 }}>Clientes</h2>
        <BtnNovo onClick={abrirCriar} label="Novo Cliente" />
      </div>

      {clientes.length === 0 ? (
        <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "48px 0" }}>Nenhum cliente cadastrado.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {clientes.map((c) => (
            <div key={c.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px",
              padding: "16px 20px", borderRadius: "12px",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{
                  width: "38px", height: "38px", borderRadius: "50%", flexShrink: 0,
                  background: c.ativo ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.06)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "15px", fontWeight: "700",
                }}>
                  {c.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: "600", fontSize: "15px" }}>{c.nome}</div>
                  <div style={{ fontSize: "12px", opacity: 0.5, marginTop: "2px" }}>
                    {[c.email, c.telefone || c.whatsapp, c.cidade].filter(Boolean).join(" · ") || "Sem contato"}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{
                  fontSize: "11px", fontWeight: "600", padding: "3px 10px", borderRadius: "20px",
                  background: c.ativo ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.06)",
                  color: c.ativo ? "#10b981" : "var(--text-muted)",
                }}>
                  {c.ativo ? "Ativo" : "Inativo"}
                </span>
                <BtnEditar onClick={() => abrirEditar(c)} />
                {c.ativo
                  ? <BtnDesativar onClick={() => toggleAtivo(c)} />
                  : <BtnAtivar onClick={() => toggleAtivo(c)} />
                }
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
