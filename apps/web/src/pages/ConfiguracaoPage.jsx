import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
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

// ─── Primitivos ───────────────────────────────────────────────────────────────

function Campo({ label, hint, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
        {label}
      </label>
      {children}
      {hint && <span style={{ fontSize: "11px", color: "var(--text-muted)", opacity: 0.65 }}>{hint}</span>}
    </div>
  );
}

function Secao({ icone, titulo, cor, children }) {
  const accent = cor || "rgba(99,102,241,0.7)";
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "18px", overflow: "hidden" }}>
      {/* Header da seção */}
      <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: `${accent}20`, color: accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {icone}
        </div>
        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", letterSpacing: "-0.2px" }}>{titulo}</h3>
      </div>
      {/* Conteúdo */}
      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {children}
      </div>
    </div>
  );
}

function ColorPicker({ label, value, onChange, hint }) {
  const [hexInput, setHexInput] = useState(value || "");

  useEffect(() => { setHexInput(value || ""); }, [value]);

  function handleHexChange(raw) {
    setHexInput(raw);
    if (/^#[0-9a-fA-F]{6}$/.test(raw)) onChange(raw);
  }

  return (
    <Campo label={label} hint={hint}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#6366f1"}
            onChange={(e) => { onChange(e.target.value); setHexInput(e.target.value); }}
            style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
          />
          <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: value || "#6366f1", border: "2px solid rgba(255,255,255,0.15)", boxShadow: `0 0 0 4px ${value || "#6366f1"}22` }} />
        </div>
        <input
          type="text"
          value={hexInput}
          onChange={(e) => handleHexChange(e.target.value)}
          placeholder="#6366f1"
          style={{ flex: 1, fontFamily: "monospace", fontSize: "13px", letterSpacing: "0.05em" }}
          maxLength={7}
        />
      </div>
    </Campo>
  );
}

// ─── Preview de marca ─────────────────────────────────────────────────────────

function BrandPreview({ form }) {
  const initial = (form.name || "D").charAt(0).toUpperCase();
  const hasLogo = Boolean(form.logoUrl);

  return (
    <div style={{ position: "sticky", top: "80px", display: "flex", flexDirection: "column", gap: "16px" }}>
      <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
        Pré-visualização da marca
      </span>

      {/* Card de vitrine */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "18px", overflow: "hidden" }}>
        {/* Cabeçalho simulado da vitrine */}
        <div style={{ padding: "20px", background: `linear-gradient(135deg, ${form.primaryColor || "#6366f1"}18 0%, transparent 100%)`, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
            {hasLogo ? (
              <img src={form.logoUrl} alt="logo" style={{ width: "40px", height: "40px", borderRadius: "10px", objectFit: "contain", background: "rgba(255,255,255,0.05)" }} onError={(e) => { e.target.style.display = "none"; }} />
            ) : (
              <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: form.primaryColor || "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: "700", color: "#fff", flexShrink: 0 }}>
                {initial}
              </div>
            )}
            <div>
              <div style={{ fontWeight: "700", fontSize: "14px", lineHeight: 1.2 }}>{form.name || "Nome da empresa"}</div>
              {form.slogan && <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px", fontStyle: "italic" }}>{form.slogan}</div>}
            </div>
          </div>

          {/* Barra de cores */}
          <div style={{ display: "flex", gap: "6px" }}>
            <div style={{ flex: 1, height: "4px", borderRadius: "999px", background: form.primaryColor || "#6366f1" }} />
            <div style={{ width: "30%", height: "4px", borderRadius: "999px", background: form.secondaryColor || "#d4af37" }} />
          </div>
        </div>

        {/* Swatches de cor */}
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {[
            { label: "Cor primária", value: form.primaryColor || "#6366f1" },
            { label: "Cor secundária", value: form.secondaryColor || "#d4af37" },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "24px", height: "24px", borderRadius: "6px", background: value, border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: "12px", fontWeight: "500" }}>{label}</span>
                <span style={{ display: "block", fontSize: "10px", color: "var(--text-muted)", fontFamily: "monospace" }}>{value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contatos resumidos */}
      {(form.email || form.whatsapp || form.telefone) && (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <span style={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: "2px" }}>Contato</span>
          {form.email && <span style={{ fontSize: "12px" }}>✉ {form.email}</span>}
          {form.whatsapp && <span style={{ fontSize: "12px" }}>📱 {form.whatsapp}</span>}
          {form.telefone && <span style={{ fontSize: "12px" }}>☎ {form.telefone}</span>}
        </div>
      )}

      {(form.endereco || form.cidade) && (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: "2px" }}>Endereço</span>
          {form.endereco && <span style={{ fontSize: "12px" }}>{form.endereco}</span>}
          {(form.cidade || form.estado) && <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{[form.cidade, form.estado].filter(Boolean).join(" / ")}</span>}
        </div>
      )}

      <p style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", opacity: 0.6 }}>
        Atualiza conforme você edita
      </p>
    </div>
  );
}

// ─── Estado inicial ───────────────────────────────────────────────────────────

const EMPTY = {
  name: "", cnpj: "", creci: "", slogan: "",
  whatsapp: "", telefone: "", email: "",
  cep: "", endereco: "", cidade: "", estado: "",
  logoUrl: "", primaryColor: "#6366f1", secondaryColor: "#d4af37",
};

// ─── Página principal ─────────────────────────────────────────────────────────

export function ConfiguracaoPage({ session }) {
  const tenantSlug = session?.tenant?.slug;
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [cepLoading, setCepLoading] = useState(false);
  const loadedRef = useRef(false);
  const debounceRef = useRef(null);

  // ── Redes Sociais ──
  const [searchParams, setSearchParams] = useSearchParams();
  const [socialStatus, setSocialStatus] = useState(null);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialMsg, setSocialMsg] = useState(null); // { type: "success"|"error", text }
  const [oauthLoading, setOauthLoading] = useState(false);
  const [disconnectLoading, setDisconnectLoading] = useState(false);

  // Processa retorno do OAuth Meta na URL
  useEffect(() => {
    const social = searchParams.get("social");
    if (!social) return;
    const page = searchParams.get("page");
    const msg = searchParams.get("msg");
    const hasIg = searchParams.get("instagram") === "ok";
    if (social === "connected") {
      const igText = hasIg ? " e Instagram" : ". Instagram não conectado (vincule sua conta Business ao Facebook).";
      setSocialMsg({ type: "success", text: `Facebook${igText} conectados com sucesso! Página: "${page}".` });
    } else if (social === "error") {
      setSocialMsg({ type: "error", text: msg || "Erro ao conectar conta." });
    }
    // Limpa params da URL
    setSearchParams({}, { replace: true });
  }, []);

  // Carrega status das redes sociais
  useEffect(() => {
    if (!tenantSlug) return;
    setSocialLoading(true);
    api.getSocialStatus(tenantSlug)
      .then(setSocialStatus)
      .catch(() => {})
      .finally(() => setSocialLoading(false));
  }, [tenantSlug]);

  async function handleConectarRedes() {
    if (!tenantSlug) return;
    setOauthLoading(true);
    try {
      const { url } = await api.getSocialOAuthUrl(tenantSlug);
      window.location.href = url;
    } catch (err) {
      setSocialMsg({ type: "error", text: err.message || "Não foi possível iniciar a autenticação." });
      setOauthLoading(false);
    }
  }

  async function handleDesconectarRedes() {
    if (!tenantSlug) return;
    setDisconnectLoading(true);
    try {
      await api.disconnectSocial(tenantSlug);
      setSocialStatus({ facebook: { connected: false, pageName: null }, instagram: { connected: false } });
      setSocialMsg({ type: "success", text: "Contas desconectadas com sucesso." });
    } catch (err) {
      setSocialMsg({ type: "error", text: err.message || "Erro ao desconectar." });
    } finally {
      setDisconnectLoading(false);
    }
  }

  useEffect(() => {
    if (!tenantSlug) return;
    api.getTenantProfile(tenantSlug)
      .then((t) => {
        setForm({
          name: t.name || "",
          cnpj: t.cnpj || "",
          creci: t.creci || "",
          slogan: t.slogan || "",
          whatsapp: t.whatsapp || "",
          telefone: t.telefone || "",
          email: t.email || "",
          cep: t.cep ? formatCep(t.cep) : "",
          endereco: t.endereco || "",
          cidade: t.cidade || "",
          estado: t.estado || "",
          logoUrl: t.logoUrl || "",
          primaryColor: t.primaryColor || "#6366f1",
          secondaryColor: t.secondaryColor || "#d4af37",
        });
        loadedRef.current = true;
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tenantSlug]);

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
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "18px", padding: "64px", textAlign: "center", color: "var(--text-muted)" }}>
        Carregando configurações...
      </div>
    );
  }

  const saveIndicator = {
    idle: null,
    saving: (
      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text-muted)" }}>
        <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--text-muted)", animation: "pulse 1s infinite" }} />
        Salvando…
      </div>
    ),
    saved: (
      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#86efac" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        Salvo com sucesso
      </div>
    ),
    error: (
      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#fca5a5" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
        Erro ao salvar
      </div>
    ),
  }[saveStatus];

  const inputStyle = {
    width: "100%", boxSizing: "border-box",
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "10px", color: "inherit", padding: "11px 14px", fontSize: "14px",
    outline: "none",
  };

  return (
    <div style={{ animation: "fadeIn 0.3s ease-in-out", display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* ── Cabeçalho ─── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: "0 0 4px 0", fontSize: "24px", fontWeight: "700" }}>Configurações</h2>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)" }}>
            Dados cadastrais, contato e identidade visual da imobiliária
          </p>
        </div>
        <div style={{ minHeight: "24px" }}>{saveIndicator}</div>
      </div>

      {/* ── Layout principal ─── */}
      <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>

        {/* ── Formulário ─── */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Dados da Empresa */}
          <Secao cor="#6366f1" titulo="Dados da Empresa" icone={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          }>
            <Campo label="Nome da Imobiliária">
              <input style={inputStyle} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Imobiliária Centro" />
            </Campo>
            <Campo label="Slogan" hint="Frase exibida na vitrine pública abaixo do nome.">
              <input style={inputStyle} value={form.slogan} onChange={(e) => set("slogan", e.target.value)} placeholder="Ex: Seu lar ideal com segurança e confiança." />
            </Campo>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Campo label="CNPJ">
                <input style={inputStyle} value={form.cnpj} onChange={(e) => set("cnpj", formatCnpj(e.target.value))} placeholder="00.000.000/0000-00" inputMode="numeric" />
              </Campo>
              <Campo label="CRECI">
                <input style={inputStyle} value={form.creci} onChange={(e) => set("creci", e.target.value)} placeholder="CRECI-SP 12345-F" />
              </Campo>
            </div>
          </Secao>

          {/* Contato */}
          <Secao cor="#10b981" titulo="Contato" icone={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          }>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Campo label="WhatsApp">
                <input style={inputStyle} value={form.whatsapp} onChange={(e) => set("whatsapp", formatTelefone(e.target.value))} placeholder="(00) 00000-0000" inputMode="numeric" />
              </Campo>
              <Campo label="Telefone Fixo">
                <input style={inputStyle} value={form.telefone} onChange={(e) => set("telefone", formatTelefone(e.target.value))} placeholder="(00) 0000-0000" inputMode="numeric" />
              </Campo>
            </div>
            <Campo label="E-mail">
              <input style={inputStyle} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="contato@imobiliaria.com.br" type="email" />
            </Campo>
          </Secao>

          {/* Endereço */}
          <Secao cor="#f59e0b" titulo="Endereço" icone={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
          }>
            <Campo label="CEP">
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input
                  style={{ ...inputStyle, maxWidth: "150px" }}
                  value={form.cep}
                  onChange={(e) => set("cep", formatCep(e.target.value))}
                  onBlur={handleCepBlur}
                  placeholder="00000-000"
                  inputMode="numeric"
                  maxLength={9}
                  disabled={cepLoading}
                />
                {cepLoading && <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Buscando…</span>}
              </div>
            </Campo>
            <Campo label="Endereço">
              <input style={inputStyle} value={form.endereco} onChange={(e) => set("endereco", e.target.value)} placeholder="Rua, número e complemento" />
            </Campo>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: "12px" }}>
              <Campo label="Cidade">
                <input style={inputStyle} value={form.cidade} onChange={(e) => set("cidade", e.target.value)} placeholder="Cidade" />
              </Campo>
              <Campo label="UF">
                <input style={inputStyle} value={form.estado} onChange={(e) => set("estado", e.target.value.toUpperCase())} placeholder="SP" maxLength={2} />
              </Campo>
            </div>
          </Secao>

          {/* Identidade Visual */}
          <Secao cor="#8b5cf6" titulo="Identidade Visual" icone={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="13.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="10.5" r="2.5" />
              <circle cx="8.5" cy="7.5" r="2.5" /><circle cx="6.5" cy="12.5" r="2.5" />
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
            </svg>
          }>
            <Campo label="URL do Logotipo" hint="Cole o endereço de uma imagem hospedada online.">
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input style={{ ...inputStyle, flex: 1 }} value={form.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} placeholder="https://..." />
                {form.logoUrl && (
                  <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <img src={form.logoUrl} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} onError={(e) => { e.target.style.display = "none"; }} />
                  </div>
                )}
              </div>
            </Campo>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <ColorPicker
                label="Cor Primária"
                hint="Botões, destaques e elementos principais."
                value={form.primaryColor}
                onChange={(v) => set("primaryColor", v)}
              />
              <ColorPicker
                label="Cor Secundária"
                hint="Badges, acentos e elementos complementares."
                value={form.secondaryColor}
                onChange={(v) => set("secondaryColor", v)}
              />
            </div>

            {/* Pré-visualização de botões */}
            <div style={{ marginTop: "4px", padding: "16px", background: "rgba(255,255,255,0.02)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", marginRight: "4px" }}>Preview:</span>
              <span style={{ padding: "6px 16px", borderRadius: "8px", background: form.primaryColor || "#6366f1", color: "#fff", fontSize: "12px", fontWeight: "600" }}>
                Ver detalhes
              </span>
              <span style={{ padding: "6px 16px", borderRadius: "8px", background: "transparent", border: `1px solid ${form.primaryColor || "#6366f1"}`, color: form.primaryColor || "#6366f1", fontSize: "12px", fontWeight: "600" }}>
                Saiba mais
              </span>
              <span style={{ padding: "4px 12px", borderRadius: "999px", background: `${form.secondaryColor || "#d4af37"}22`, color: form.secondaryColor || "#d4af37", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Disponível
              </span>
            </div>
          </Secao>

          {/* Redes Sociais */}
          <Secao cor="#1877f2" titulo="Redes Sociais" icone={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          }>
            {/* Mensagem de retorno do OAuth */}
            {socialMsg && (
              <div style={{
                padding: "12px 14px", borderRadius: "10px", fontSize: "13px",
                background: socialMsg.type === "success" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                border: `1px solid ${socialMsg.type === "success" ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
                color: socialMsg.type === "success" ? "#6ee7b7" : "#fca5a5",
                display: "flex", alignItems: "flex-start", gap: "10px",
              }}>
                <span style={{ marginTop: "1px" }}>{socialMsg.type === "success" ? "✓" : "✗"}</span>
                <span>{socialMsg.text}</span>
                <button type="button" onClick={() => setSocialMsg(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: "inherit", cursor: "pointer", opacity: 0.6, fontSize: "14px", flexShrink: 0 }}>✕</button>
              </div>
            )}

            <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.6" }}>
              Conecte sua <strong style={{ color: "var(--text)" }}>Página do Facebook</strong> e conta <strong style={{ color: "var(--text)" }}>Business do Instagram</strong> para publicar imóveis diretamente pelo painel.
            </p>

            {/* Status das plataformas */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {/* Facebook */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#1877f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "600", fontSize: "13px" }}>Facebook</div>
                  <div style={{ fontSize: "11px", marginTop: "2px", color: socialStatus?.facebook?.connected ? "#6ee7b7" : "var(--text-muted)" }}>
                    {socialLoading ? "Verificando…" : socialStatus?.facebook?.connected ? `✓ Página: "${socialStatus.facebook.pageName}"` : "Não conectado"}
                  </div>
                </div>
              </div>

              {/* Instagram */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "600", fontSize: "13px" }}>Instagram</div>
                  <div style={{ fontSize: "11px", marginTop: "2px", color: socialStatus?.instagram?.connected ? "#6ee7b7" : "var(--text-muted)" }}>
                    {socialLoading ? "Verificando…" : socialStatus?.instagram?.connected ? "✓ Conta Business conectada" : "Não conectado"}
                  </div>
                </div>
              </div>
            </div>

            {/* Ações */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleConectarRedes}
                disabled={oauthLoading}
                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 18px", borderRadius: "9px", fontSize: "13px", fontWeight: "600", background: "rgba(24,119,242,0.15)", border: "1px solid rgba(24,119,242,0.4)", color: "#60a5fa", cursor: oauthLoading ? "wait" : "pointer", opacity: oauthLoading ? 0.6 : 1 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
                {oauthLoading ? "Redirecionando…" : socialStatus?.facebook?.connected ? "Reconectar conta" : "Conectar Facebook & Instagram"}
              </button>

              {socialStatus?.facebook?.connected && (
                <button
                  type="button"
                  onClick={handleDesconectarRedes}
                  disabled={disconnectLoading}
                  style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 18px", borderRadius: "9px", fontSize: "13px", fontWeight: "600", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5", cursor: disconnectLoading ? "wait" : "pointer", opacity: disconnectLoading ? 0.6 : 1 }}
                >
                  {disconnectLoading ? "Desconectando…" : "Desconectar"}
                </button>
              )}
            </div>

            <p style={{ margin: 0, fontSize: "11px", color: "var(--text-muted)", opacity: 0.6, lineHeight: "1.6" }}>
              <strong>Pré-requisito:</strong> a conta do Instagram deve ser do tipo Business ou Creator, vinculada à Página do Facebook. A autenticação usa o Meta Graph API v19.0 com permissões <code>pages_manage_posts</code> e <code>instagram_content_publish</code>.
            </p>
          </Secao>

        </div>

        {/* ── Preview lateral ─── */}
        <div style={{ width: "280px", flexShrink: 0 }}>
          <BrandPreview form={form} />
        </div>

      </div>
    </div>
  );
}
