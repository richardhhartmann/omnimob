import { useEffect, useRef, useState } from "react";
import { api } from "../api";

// ─── Formatadores ─────────────────────────────────────────────────────────────

function formatCnpj(v) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatTelefone(v) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function formatCep(v) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

// ─── Componente de seção ──────────────────────────────────────────────────────

function Secao({ icone, titulo, children }) {
  return (
    <div className="glass-panel" style={{ padding: "28px 32px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <div style={{
          width: "36px", height: "36px", borderRadius: "10px",
          background: "rgba(99,102,241,0.15)", color: "#a5b4fc",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          {icone}
        </div>
        <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "600" }}>{titulo}</h3>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {children}
      </div>
    </div>
  );
}

function Campo({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={{ fontSize: "12px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.5 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function ColorPicker({ label, value, onChange }) {
  return (
    <Campo label={label}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <input
          type="color"
          value={value || "#6366f1"}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: "40px", height: "40px", padding: "2px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.15)", background: "transparent", cursor: "pointer" }}
        />
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#6366f1"
          style={{ flex: 1, fontFamily: "monospace", fontSize: "13px" }}
        />
      </div>
    </Campo>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

const EMPTY = {
  name: "", cnpj: "", creci: "",
  whatsapp: "", telefone: "", email: "",
  cep: "", endereco: "", cidade: "", estado: "",
  logoUrl: "", slogan: "", primaryColor: "#6366f1", secondaryColor: "#d4af37",
};

export function ConfiguracaoPage({ session }) {
  const tenantSlug = session?.tenant?.slug;
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const [cepLoading, setCepLoading] = useState(false);
  const loadedRef = useRef(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!tenantSlug) return;
    api.getTenantProfile(tenantSlug)
      .then((t) => {
        setForm({
          name: t.name || "",
          cnpj: t.cnpj || "",
          creci: t.creci || "",
          whatsapp: t.whatsapp || "",
          telefone: t.telefone || "",
          email: t.email || "",
          cep: t.cep ? formatCep(t.cep) : "",
          endereco: t.endereco || "",
          cidade: t.cidade || "",
          estado: t.estado || "",
          logoUrl: t.logoUrl || "",
          slogan: t.slogan || "",
          primaryColor: t.primaryColor || "#6366f1",
          secondaryColor: t.secondaryColor || "#d4af37",
        });
        loadedRef.current = true;
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tenantSlug]);

  // Auto-save com debounce de 1500ms após qualquer alteração no form
  useEffect(() => {
    if (!loadedRef.current || !tenantSlug) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveStatus("idle");
    debounceRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await api.updateTenantConfiguracao(tenantSlug, {
          ...form,
          cep: form.cep.replace(/\D/g, ""),
        });
        setSaveStatus("saved");
        debounceRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
      } catch {
        setSaveStatus("error");
      }
    }, 1500);
  }, [form]);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCepBlur() {
    const clean = form.cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((prev) => ({
          ...prev,
          endereco: data.logradouro || prev.endereco,
          cidade: data.localidade || prev.cidade,
          estado: data.uf || prev.estado,
        }));
      }
    } catch {}
    finally { setCepLoading(false); }
  }

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>
        Carregando configurações...
      </div>
    );
  }

  const statusLabel = {
    idle: null,
    saving: <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Salvando…</span>,
    saved: <span style={{ fontSize: "13px", color: "#86efac" }}>✓ Salvo com sucesso</span>,
    error: <span style={{ fontSize: "13px", color: "#fca5a5" }}>Erro ao salvar</span>,
  }[saveStatus];

  return (
    <div style={{ animation: "fadeIn 0.3s ease-in-out", display: "flex", flexDirection: "column", gap: "0" }}>

      {/* Cabeçalho */}
      <div className="glass-panel" style={{ marginBottom: "24px", padding: "24px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: "0 0 4px 0", fontSize: "22px", fontWeight: "700" }}>Configurações da Empresa</h2>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>Dados cadastrais, contato e identidade visual da imobiliária</p>
        </div>
        <div>{statusLabel}</div>
      </div>

      {/* Grid de seções */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "20px" }}>

        {/* Dados Legais */}
        <Secao titulo="Dados Legais" icone={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        }>
          <Campo label="Nome da Imobiliária">
            <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Imobiliária Centro" />
          </Campo>
          <Campo label="CNPJ">
            <input
              value={form.cnpj}
              onChange={(e) => set("cnpj", formatCnpj(e.target.value))}
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
            />
          </Campo>
          <Campo label="CRECI">
            <input value={form.creci} onChange={(e) => set("creci", e.target.value)} placeholder="Ex: CRECI-SP 12345-F" />
          </Campo>
        </Secao>

        {/* Contato */}
        <Secao titulo="Contato" icone={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        }>
          <Campo label="WhatsApp">
            <input
              value={form.whatsapp}
              onChange={(e) => set("whatsapp", formatTelefone(e.target.value))}
              placeholder="(00) 00000-0000"
              inputMode="numeric"
            />
          </Campo>
          <Campo label="Telefone Fixo">
            <input
              value={form.telefone}
              onChange={(e) => set("telefone", formatTelefone(e.target.value))}
              placeholder="(00) 0000-0000"
              inputMode="numeric"
            />
          </Campo>
          <Campo label="E-mail">
            <input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="contato@imobiliaria.com.br" type="email" />
          </Campo>
        </Secao>

        {/* Endereço */}
        <Secao titulo="Endereço" icone={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
          </svg>
        }>
          <Campo label="CEP">
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                value={form.cep}
                onChange={(e) => set("cep", formatCep(e.target.value))}
                onBlur={handleCepBlur}
                placeholder="00000-000"
                inputMode="numeric"
                maxLength={9}
                disabled={cepLoading}
                style={{ flex: 1 }}
              />
              {cepLoading && <span style={{ fontSize: "12px", color: "var(--text-muted)", alignSelf: "center" }}>Buscando…</span>}
            </div>
          </Campo>
          <Campo label="Endereço">
            <input value={form.endereco} onChange={(e) => set("endereco", e.target.value)} placeholder="Rua, número e complemento" />
          </Campo>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px" }}>
            <Campo label="Cidade">
              <input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} placeholder="Cidade" />
            </Campo>
            <Campo label="UF">
              <input value={form.estado} onChange={(e) => set("estado", e.target.value.toUpperCase())} placeholder="SP" maxLength={2} style={{ width: "64px" }} />
            </Campo>
          </div>
        </Secao>

      </div>


    </div>
  );
}
