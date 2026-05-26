import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { BtnAtivar, BtnDesativar, BtnEditar, BtnNovo } from "../components/ActionIcons";

const FORM_EMPTY = {
  nome: "", cpf: "", rg: "", nascimento: "", email: "", telefone: "", whatsapp: "",
  cep: "", endereco: "", bairro: "", cidade: "", estado: "", observacoes: "", ativo: true,
};

function formatarData(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function ClientesPage({ session }) {
  const tenantSlug = session?.tenant?.slug;
  const [clientes, setClientes] = useState([]);
  const [view, setView] = useState("list");
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const searchTimer = useRef(null);

  function carregarClientes(searchTerm = "") {
    if (!tenantSlug) return;
    api.listClientes(tenantSlug, { search: searchTerm }).then(setClientes).catch(() => {});
  }

  useEffect(() => {
    carregarClientes();
  }, [tenantSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearchChange(e) {
    const val = e.target.value;
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => carregarClientes(val), 350);
  }

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
      if (!payload.nascimento) payload.nascimento = null;
      if (editando) {
        const updated = await api.updateCliente(tenantSlug, editando.id, payload);
        setClientes((prev) => prev.map((c) => c.id === updated.id ? updated : c));
      } else {
        const created = await api.createCliente(tenantSlug, payload);
        setClientes((prev) => [...prev, created].sort((a, b) => a.nome.localeCompare(b.nome)));
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

          <div style={{ marginBottom: "4px", fontSize: "11px", fontWeight: "600", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Dados Pessoais
          </div>
          <input placeholder="Nome completo *" value={form.nome} onChange={(e) => setField("nome", e.target.value)} required disabled={loading} />
          <div className="grid grid-2">
            <input placeholder="CPF" value={form.cpf} onChange={(e) => setField("cpf", e.target.value)} disabled={loading} />
            <input placeholder="RG" value={form.rg} onChange={(e) => setField("rg", e.target.value)} disabled={loading} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "12px", opacity: 0.55 }}>Data de Nascimento</label>
            <input type="date" value={form.nascimento} onChange={(e) => setField("nascimento", e.target.value)} disabled={loading} />
          </div>

          <div style={{ marginTop: "8px", marginBottom: "4px", fontSize: "11px", fontWeight: "600", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Contato
          </div>
          <input type="email" placeholder="E-mail" value={form.email} onChange={(e) => setField("email", e.target.value)} disabled={loading} />
          <div className="grid grid-2">
            <input placeholder="Telefone" value={form.telefone} onChange={(e) => setField("telefone", e.target.value)} disabled={loading} />
            <input placeholder="WhatsApp" value={form.whatsapp} onChange={(e) => setField("whatsapp", e.target.value)} disabled={loading} />
          </div>

          <div style={{ marginTop: "8px", marginBottom: "4px", fontSize: "11px", fontWeight: "600", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Endereço
          </div>
          <div className="grid grid-2">
            <input placeholder="CEP" value={form.cep} onChange={(e) => setField("cep", e.target.value)} disabled={loading} />
            <input placeholder="Estado (UF)" value={form.estado} onChange={(e) => setField("estado", e.target.value.toUpperCase())} maxLength={2} disabled={loading} />
          </div>
          <input placeholder="Endereço (rua e número)" value={form.endereco} onChange={(e) => setField("endereco", e.target.value)} disabled={loading} />
          <div className="grid grid-2">
            <input placeholder="Bairro" value={form.bairro} onChange={(e) => setField("bairro", e.target.value)} disabled={loading} />
            <input placeholder="Cidade" value={form.cidade} onChange={(e) => setField("cidade", e.target.value)} disabled={loading} />
          </div>

          <div style={{ marginTop: "8px", marginBottom: "4px", fontSize: "11px", fontWeight: "600", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Observações
          </div>
          <textarea
            placeholder="Anotações internas sobre o cliente…"
            value={form.observacoes}
            onChange={(e) => setField("observacoes", e.target.value)}
            disabled={loading}
            rows={3}
            style={{ resize: "vertical" }}
          />

          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px", marginTop: "4px" }}>
            <input type="checkbox" checked={form.ativo} onChange={(e) => setField("ativo", e.target.checked)} disabled={loading} />
            Cliente ativo
          </label>

          <div className="actions" style={{ marginTop: "24px" }}>
            <button type="submit" disabled={loading} style={{ width: "auto", padding: "10px 20px" }}>
              {loading ? "Salvando…" : editando ? "Salvar Alterações" : "Criar Cliente"}
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <h2 style={{ margin: 0 }}>Clientes</h2>
        <BtnNovo onClick={abrirCriar} label="Novo Cliente" />
      </div>

      <input
        placeholder="Buscar por nome, CPF, e-mail ou telefone…"
        value={search}
        onChange={handleSearchChange}
        style={{ marginBottom: "16px" }}
      />

      {clientes.length === 0 ? (
        <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "48px 0" }}>
          {search ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {clientes.map((c) => (
            <div key={c.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px",
              padding: "14px 18px", borderRadius: "12px",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              opacity: c.ativo ? 1 : 0.6,
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
                    {[
                      c.cpf && `CPF: ${c.cpf}`,
                      c.email,
                      c.telefone || c.whatsapp,
                      c.cidade && c.estado ? `${c.cidade}/${c.estado}` : c.cidade,
                      c.nascimento && formatarData(c.nascimento),
                    ].filter(Boolean).join(" · ") || "Sem informações de contato"}
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
