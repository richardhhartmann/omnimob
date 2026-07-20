import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../api";
import { useConfirm } from "../components/ConfirmModal";

const STATUS_META = {
  TRIAL: { label: "Trial", color: "#a5b4fc", bg: "rgba(129,140,248,0.15)", border: "rgba(129,140,248,0.3)" },
  EM_DIA: { label: "Em dia", color: "#86efac", bg: "rgba(34,197,94,0.15)", border: "rgba(34,197,94,0.3)" },
  ATRASADO: { label: "Atrasado", color: "#fca5a5", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)" },
  CANCELADO: { label: "Cancelado", color: "#cbd5e1", bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.25)" },
};
const STATUS_OPCOES = Object.keys(STATUS_META);

const EMPTY_FORM = {
  name: "", slug: "", email: "", whatsapp: "", plano: "",
  statusPagamento: "TRIAL", valorMensal: "", proximoVencimento: "",
  adminLogin: "", adminSenha: "",
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

const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "10px 12px",
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "9px", color: "#fff", fontSize: "13px", outline: "none",
};

export function SuperAdminPage({ session, onLogout }) {
  const { confirm, modal: confirmModal } = useConfirm();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

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

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const by = (s) => tenants.filter((t) => t.statusPagamento === s).length;
    return { total: tenants.length, emDia: by("EM_DIA"), atrasado: by("ATRASADO"), trial: by("TRIAL") };
  }, [tenants]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((t) => `${t.name} ${t.slug} ${t.email}`.toLowerCase().includes(q));
  }, [tenants, search]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(t) {
    setEditingId(t.id);
    setForm({
      name: t.name || "", slug: t.slug || "", email: t.email || "", whatsapp: t.whatsapp || "",
      plano: t.plano || "", statusPagamento: t.statusPagamento || "TRIAL",
      valorMensal: t.valorMensal ?? "", proximoVencimento: toDateInput(t.proximoVencimento),
      adminLogin: "", adminSenha: "",
    });
    setFormError("");
    setModalOpen(true);
  }

  function setField(k, v) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        name: form.name, email: form.email, whatsapp: form.whatsapp, plano: form.plano,
        statusPagamento: form.statusPagamento,
        valorMensal: form.valorMensal === "" ? null : Number(form.valorMensal),
        proximoVencimento: form.proximoVencimento || null,
      };
      if (editingId) {
        await adminApi.updateTenant(editingId, payload);
      } else {
        const createPayload = { ...payload, slug: form.slug };
        if (form.adminLogin && form.adminSenha) {
          createPayload.adminLogin = form.adminLogin;
          createPayload.adminSenha = form.adminSenha;
        }
        const res = await adminApi.createTenant(createPayload);
        if (res?.warning) alert(res.warning);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(t) {
    if (!await confirm(`Excluir o tenant "${t.name}"? Isso remove usuários, imóveis e leads. Esta ação é irreversível.`, "Excluir")) return;
    try {
      await adminApi.deleteTenant(t.id);
      await load();
    } catch (err) {
      alert(err.message || "Erro ao excluir.");
    }
  }

  const statBox = (label, value, color) => (
    <div className="glass-panel" style={{ padding: "16px 20px", flex: 1, minWidth: "120px" }}>
      <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: "28px", fontWeight: "700", color, marginTop: "4px" }}>{value}</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f172a, #1e1b4b, #312e81)", color: "#f8fafc" }}>
      {confirmModal}
      {/* Topbar */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 28px", borderBottom: "1px solid rgba(255,255,255,0.08)", position: "sticky", top: 0, background: "rgba(15,23,42,0.85)", backdropFilter: "blur(12px)", zIndex: 10 }}>
        <div>
          <span style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--accent)" }}>Domus</span>
          <div style={{ fontSize: "18px", fontWeight: "700" }}>Super-Admin</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>{session?.nome || session?.email}</span>
          <button onClick={onLogout} className="button-secondary" style={{ padding: "8px 14px" }}>Sair</button>
        </div>
      </header>

      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "28px" }}>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "24px" }}>
          {statBox("Tenants", stats.total, "#fff")}
          {statBox("Em dia", stats.emDia, "#86efac")}
          {statBox("Atrasados", stats.atrasado, "#fca5a5")}
          {statBox("Trial", stats.trial, "#a5b4fc")}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, slug ou e-mail…" style={{ ...inputStyle, maxWidth: "320px" }} />
          <button onClick={openCreate} style={{ padding: "10px 18px", borderRadius: "9px", border: "none", background: "var(--accent)", color: "#fff", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}>
            + Novo tenant
          </button>
        </div>

        {error ? <div style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", marginBottom: "16px" }}>{error}</div> : null}
        {loading ? <p style={{ color: "var(--text-muted)" }}>Carregando…</p> : null}

        {!loading && filtered.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)" }}>Nenhum tenant encontrado.</div>
        ) : null}

        <div style={{ display: "grid", gap: "12px" }}>
          {filtered.map((t) => {
            const sm = STATUS_META[t.statusPagamento] || STATUS_META.TRIAL;
            return (
              <div key={t.id} className="glass-panel" style={{ padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                <div style={{ minWidth: "200px", flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "16px", fontWeight: "700" }}>{t.name}</span>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>/{t.slug}</span>
                    <span style={{ padding: "3px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: "700", background: sm.bg, color: sm.color, border: `1px solid ${sm.border}` }}>{sm.label}</span>
                    {!t.ativo ? <span style={{ padding: "3px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: "700", background: "rgba(148,163,184,0.12)", color: "#cbd5e1" }}>Inativo</span> : null}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px", display: "flex", gap: "16px", flexWrap: "wrap" }}>
                    <span>Plano: {t.plano || "—"}</span>
                    <span>Mensal: {fmtMoney(t.valorMensal)}</span>
                    <span>Vence: {fmtDate(t.proximoVencimento)}</span>
                    <span>{t.usuarios} usuários · {t.properties} imóveis</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                  <a href={`/vitrine/${t.slug}`} target="_blank" rel="noreferrer" className="button-secondary" style={{ padding: "8px 12px", fontSize: "12px", textDecoration: "none" }}>Vitrine</a>
                  <button onClick={() => openEdit(t)} className="button-secondary" style={{ padding: "8px 12px", fontSize: "12px" }}>Editar</button>
                  <button className="btn-danger" onClick={() => handleDelete(t)} style={{ padding: "8px 12px", fontSize: "12px", borderRadius: "8px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", cursor: "pointer" }}>Excluir</button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {modalOpen ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }} onClick={() => setModalOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={handleSave} className="glass-panel" style={{ width: "100%", maxWidth: "520px", maxHeight: "90vh", overflowY: "auto", padding: "28px", display: "flex", flexDirection: "column", gap: "14px", background: "rgba(18,18,30,0.99)" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "700", margin: 0 }}>{editingId ? "Editar tenant" : "Novo tenant"}</h2>

            {formError ? <div style={{ padding: "10px 14px", borderRadius: "10px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: "13px" }}>{formError}</div> : null}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Nome *"><input required value={form.name} onChange={(e) => setField("name", e.target.value)} style={inputStyle} /></Field>
              <Field label="Slug *"><input required value={form.slug} onChange={(e) => setField("slug", e.target.value.toLowerCase())} disabled={!!editingId} style={{ ...inputStyle, opacity: editingId ? 0.5 : 1 }} placeholder="ex: imobiliaria-x" /></Field>
              <Field label="E-mail"><input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} style={inputStyle} /></Field>
              <Field label="WhatsApp"><input value={form.whatsapp} onChange={(e) => setField("whatsapp", e.target.value)} style={inputStyle} placeholder="5511999999999" /></Field>
              <Field label="Plano"><input value={form.plano} onChange={(e) => setField("plano", e.target.value)} style={inputStyle} placeholder="Básico / Pro…" /></Field>
              <Field label="Status pagamento">
                <select value={form.statusPagamento} onChange={(e) => setField("statusPagamento", e.target.value)} style={inputStyle}>
                  {STATUS_OPCOES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                </select>
              </Field>
              <Field label="Valor mensal (R$)"><input type="number" step="0.01" value={form.valorMensal} onChange={(e) => setField("valorMensal", e.target.value)} style={inputStyle} /></Field>
              <Field label="Próximo vencimento"><input type="date" value={form.proximoVencimento} onChange={(e) => setField("proximoVencimento", e.target.value)} style={inputStyle} /></Field>
            </div>

            {!editingId ? (
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "12px" }}>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>Usuário admin inicial (opcional)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <Field label="Login do admin"><input value={form.adminLogin} onChange={(e) => setField("adminLogin", e.target.value)} style={inputStyle} /></Field>
                  <Field label="Senha do admin"><input type="text" value={form.adminSenha} onChange={(e) => setField("adminSenha", e.target.value)} style={inputStyle} /></Field>
                </div>
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "6px" }}>
              <button type="button" onClick={() => setModalOpen(false)} className="button-secondary" style={{ padding: "10px 16px" }}>Cancelar</button>
              <button type="submit" disabled={saving} style={{ padding: "10px 20px", borderRadius: "9px", border: "none", background: "var(--accent)", color: "#fff", fontWeight: "700", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>{label}</span>
      {children}
    </label>
  );
}
