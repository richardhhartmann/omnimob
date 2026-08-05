import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useConfirm } from "../components/ConfirmModal";
import { SelectCustom } from "../components/SelectCustom";
import { SkeletonStats, SkeletonListRows } from "../components/Skeleton";

function formatDate(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// Tempo relativo amigável ("agora", "há 2h", "ontem", ou a data).
function timeAgo(iso) {
  if (!iso) return "-";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d} dias`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Inicial e cor estável (por hash do nome) para o avatar do lead.
function initial(name) {
  const c = (name || "").trim().charAt(0);
  return c ? c.toUpperCase() : "?";
}
function leadColor(seed) {
  const s = seed || "?";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h}, 55%, 52%)`;
}

const PAGE_SIZE = 8;

// ─── Ícones ───────────────────────────────────────────────────────────────────

const IconWhats = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" /></svg>
);
const IconMail = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" /></svg>
);
const IconHome = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
);
const IconCopy = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
);
const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
);

// ─── Card de métrica ──────────────────────────────────────────────────────────

function StatCard({ label, value, accent, icon }) {
  return (
    <div className="glass-panel" style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
      <div style={{ width: "42px", height: "42px", borderRadius: "12px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${accent}22`, color: accent }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: "24px", fontWeight: "700", lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>{label}</div>
      </div>
    </div>
  );
}

export function LeadsPage({ session }) {
  const tenantSlug = session?.tenant?.slug || "";
  const { confirm, modal: confirmModal } = useConfirm();
  const [data, setData] = useState({ leads: [], total: 0, page: 1, limit: 100 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [copied, setCopied] = useState(null);

  // Filtros (client-side sobre os leads carregados)
  const [search, setSearch] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [contactFilter, setContactFilter] = useState("all"); // all | whatsapp | email
  const [sortOrder, setSortOrder] = useState("recent"); // recent | old
  const [page, setPage] = useState(1);

  async function loadLeads() {
    if (!tenantSlug) return;
    setLoading(true);
    setError("");
    try {
      const result = await api.listLeads(tenantSlug, { page: 1, limit: 100 });
      setData(result);
      // Atualiza o "último total visto" para sumir o badge na sidebar
      try { localStorage.setItem(`domus_leads_seen_${tenantSlug}`, String(result.total ?? (result.leads?.length ?? 0))); } catch {}
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadLeads(); }, [tenantSlug]);

  function exportCSV() {
    const rows = [
      ["Nome", "Telefone", "E-mail", "Imóvel", "Mensagem", "Data"],
      ...allLeads.map((l) => [
        l.name || "",
        l.phone || "",
        l.email || "",
        l.property?.title || "",
        (l.message || "").replace(/\n/g, " "),
        formatDate(l.createdAt),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${tenantSlug}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  useEffect(() => { setPage(1); }, [search, propertyFilter, contactFilter, sortOrder]);

  async function handleDelete(leadId) {
    if (!await confirm("Remover este lead?", "Remover")) return;
    setDeletingId(leadId);
    try {
      await api.deleteLead(tenantSlug, leadId);
      await loadLeads();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  async function copyToClipboard(text, key) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      /* ignore */
    }
  }

  function openWhatsApp(lead) {
    const phone = (lead.phone || "").replace(/\D/g, "");
    const msg = `Olá ${lead.name || ""}! Tudo bem? Vi que você demonstrou interesse no imóvel "${lead.property?.title || ""}".`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg.trim())}`, "_blank");
  }

  const allLeads = data.leads || [];

  // Imóveis distintos para o filtro
  const properties = useMemo(() => {
    const map = new Map();
    for (const l of allLeads) {
      if (l.property?.id && !map.has(l.property.id)) map.set(l.property.id, l.property.title || "Imóvel");
    }
    return [...map.entries()].map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title));
  }, [allLeads]);

  // Estatísticas
  const stats = useMemo(() => {
    const sevenDays = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return {
      total: data.total,
      whats: allLeads.filter((l) => l.phone).length,
      email: allLeads.filter((l) => l.email).length,
      recent: allLeads.filter((l) => new Date(l.createdAt).getTime() >= sevenDays).length,
    };
  }, [allLeads, data.total]);

  // Filtro + ordenação
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = allLeads.filter((l) => {
      const matchesSearch =
        !q ||
        [l.name, l.email, l.phone, l.message, l.property?.title]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(q));
      const matchesProperty = !propertyFilter || l.property?.id === propertyFilter;
      const matchesContact =
        contactFilter === "all" ||
        (contactFilter === "whatsapp" && l.phone) ||
        (contactFilter === "email" && l.email);
      return matchesSearch && matchesProperty && matchesContact;
    });
    list = [...list].sort((a, b) => {
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return sortOrder === "recent" ? db - da : da - db;
    });
    return list;
  }, [allLeads, search, propertyFilter, contactFilter, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = search || propertyFilter || contactFilter !== "all";

  const inputStyle = {
    width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "inherit",
    padding: "10px 12px", fontSize: "14px", outline: "none",
  };

  return (
    <div className="main-content" style={{ maxWidth: "1100px" }}>
      {confirmModal}
      <header style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "28px", marginBottom: "6px" }}>Gestão de Leads</h1>
        <p style={{ color: "var(--text-muted)", margin: 0 }}>
          Contatos captados pela sua vitrine pública. Responda rápido para aumentar a conversão.
        </p>
      </header>

      {error ? <div className="error" style={{ marginBottom: "16px" }}>{error}</div> : null}

      {/* Métricas */}
      {loading ? <SkeletonStats count={4} /> : (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <StatCard label="Total de leads" value={stats.total} accent="#6366f1" icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
        } />
        <StatCard label="Com WhatsApp" value={stats.whats} accent="#25d366" icon={<IconWhats />} />
        <StatCard label="Com e-mail" value={stats.email} accent="#0ea5e9" icon={<IconMail />} />
        <StatCard label="Últimos 7 dias" value={stats.recent} accent="#f59e0b" icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></svg>
        } />
      </div>
      )}

      {/* Barra de filtros */}
      <div className="glass-panel" style={{ padding: "16px", marginBottom: "20px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
        {/*
        {allLeads.length > 0 && (
          <button
            type="button"
            onClick={exportCSV}
            style={{
              display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px",
              borderRadius: "8px", border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.05)", color: "#94a3b8",
              fontSize: "13px", fontWeight: 500, cursor: "pointer", width: "auto",
              boxShadow: "none", transform: "none", transition: "background 0.15s, color 0.15s", flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.10)"; e.currentTarget.style.color = "#f1f5f9"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#94a3b8"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Exportar CSV
          </button>
        )}
          */}
        <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input
            placeholder="Buscar por nome, e-mail, telefone, imóvel..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: "36px" }}
          />
        </div>
        <SelectCustom
          value={propertyFilter}
          placeholder="Todos os imóveis"
          style={{ minWidth: "200px", maxWidth: "260px" }}
          options={[{ value: "", label: "Todos os imóveis" }, ...properties.map((p) => ({ value: p.id, label: p.title }))]}
          onChange={setPropertyFilter}
        />
        <SelectCustom
          value={sortOrder}
          style={{ minWidth: "160px" }}
          options={[
            { value: "recent", label: "Mais recentes" },
            { value: "old", label: "Mais antigos" },
          ]}
          onChange={setSortOrder}
        />
        {/* Filtro de contato */}
        <div style={{ display: "flex", background: "rgba(0,0,0,0.2)", borderRadius: "10px", padding: "3px", border: "1px solid rgba(255,255,255,0.08)" }}>
          {[
            { key: "all", label: "Todos" },
            { key: "whatsapp", label: "WhatsApp" },
            { key: "email", label: "E-mail" },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setContactFilter(opt.key)}
              style={{
                width: "auto", padding: "7px 14px", borderRadius: "7px", border: "none", fontSize: "13px", fontWeight: "600", cursor: "pointer",
                background: contactFilter === opt.key ? "rgba(99,102,241,0.25)" : "transparent",
                color: contactFilter === opt.key ? "#fff" : "var(--text-muted)",
                transition: "all 0.2s",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <SkeletonListRows count={5} /> : null}

      {/* Estados vazios */}
      {!loading && allLeads.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: "center", padding: "56px 24px" }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "16px" }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></svg>
          <p style={{ color: "var(--text-muted)", fontSize: "16px", margin: 0 }}>
            Nenhum lead registrado ainda. Quando visitantes manifestarem interesse pela vitrine, aparecerão aqui.
          </p>
        </div>
      ) : !loading && filtered.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: "center", padding: "48px 24px" }}>
          <p style={{ color: "var(--text-muted)", fontSize: "15px", marginBottom: "16px" }}>Nenhum lead encontrado com estes filtros.</p>
          <button type="button" className="button-secondary" style={{ width: "auto", padding: "8px 16px" }}
            onClick={() => { setSearch(""); setPropertyFilter(""); setContactFilter("all"); setSortOrder("recent"); }}>
            Limpar filtros
          </button>
        </div>
      ) : null}

      {/* Lista de leads */}
      {!loading && pageItems.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {pageItems.map((lead) => {
            const phoneDigits = (lead.phone || "").replace(/\D/g, "");
            const color = leadColor(lead.name || lead.email || lead.id);
            return (
              <div
                key={lead.id}
                className="glass-panel"
                style={{ padding: "16px 18px", display: "flex", gap: "16px", alignItems: "flex-start", transition: "border-color 0.2s, transform 0.2s" }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
              >
                {/* Avatar */}
                <div style={{ width: "44px", height: "44px", borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: color, color: "#fff", fontWeight: "700", fontSize: "18px" }}>
                  {initial(lead.name)}
                </div>

                {/* Conteúdo */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "8px" }}>
                    <span style={{ fontSize: "15px", fontWeight: "600" }}>
                      {lead.name || <span style={{ color: "var(--text-muted)", fontWeight: "400" }}>Sem nome</span>}
                    </span>
                    <span style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", color: "#a5b4fc", background: "rgba(99,102,241,0.15)", padding: "2px 8px", borderRadius: "999px" }}>
                      {lead.source === "showcase" ? "Vitrine" : (lead.source || "Lead")}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }} title={formatDate(lead.createdAt)}>
                      {timeAgo(lead.createdAt)}
                    </span>
                  </div>

                  {/* Chips de contato + imóvel */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: lead.message ? "10px" : 0 }}>
                    {lead.phone ? (
                      <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer" style={chipStyle("#25d366")}>
                        <IconWhats /> {lead.phone}
                      </a>
                    ) : null}
                    {lead.email ? (
                      <a href={`mailto:${lead.email}`} style={chipStyle("#0ea5e9")}>
                        <IconMail /> {lead.email}
                      </a>
                    ) : null}
                    {lead.property?.id ? (
                      <Link to={`/imoveis/${lead.property.id}`} style={chipStyle("#a78bfa")}>
                        <IconHome /> {lead.property.title || "Imóvel"}
                      </Link>
                    ) : null}
                    {!lead.phone && !lead.email ? (
                      <span style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>Sem contato informado</span>
                    ) : null}
                  </div>

                  {lead.message ? (
                    <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)", lineHeight: "1.5", background: "rgba(255,255,255,0.03)", padding: "10px 12px", borderRadius: "8px", borderLeft: "2px solid rgba(99,102,241,0.4)" }}>
                      {lead.message}
                    </p>
                  ) : null}
                </div>

                {/* Ações */}
                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  {lead.phone ? (
                    <button type="button" className="btn-whatsapp" onClick={() => openWhatsApp(lead)} title="Responder no WhatsApp"
                      style={actionStyle("#25d366")}>
                      <IconWhats />
                    </button>
                  ) : null}
                  {(lead.phone || lead.email) ? (
                    <button type="button" onClick={() => copyToClipboard(lead.phone || lead.email, lead.id)} title="Copiar contato"
                      style={actionStyle(copied === lead.id ? "#10b981" : "#94a3b8")}>
                      {copied === lead.id
                        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        : <IconCopy />}
                    </button>
                  ) : null}
                  <button type="button" className="btn-danger" onClick={() => handleDelete(lead.id)} disabled={deletingId === lead.id} title="Remover lead"
                    style={actionStyle("#f87171")}>
                    <IconTrash />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Aviso de limite de carga */}
      {!loading && data.total > allLeads.length ? (
        <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "12px", marginTop: "16px" }}>
          Exibindo os {allLeads.length} leads mais recentes de {data.total}.
        </p>
      ) : null}

      {/* Paginação (client-side) */}
      {!loading && totalPages > 1 ? (
        <div style={{ display: "flex", gap: "8px", marginTop: "20px", justifyContent: "center", alignItems: "center" }}>
          <button type="button" className="button-secondary" style={{ width: "auto", padding: "8px 16px" }} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </button>
          <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>
            Página {page} de {totalPages}{hasFilters ? ` · ${filtered.length} resultado${filtered.length !== 1 ? "s" : ""}` : ""}
          </span>
          <button type="button" className="button-secondary" style={{ width: "auto", padding: "8px 16px" }} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Próxima
          </button>
        </div>
      ) : null}
    </div>
  );
}

// Chip de contato (link)
function chipStyle(color) {
  return {
    display: "inline-flex", alignItems: "center", gap: "6px",
    fontSize: "12px", fontWeight: "500", color,
    background: `${color}1a`, border: `1px solid ${color}33`,
    padding: "4px 10px", borderRadius: "999px", textDecoration: "none",
    maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  };
}

// Botão de ação (ícone)
function actionStyle(color) {
  return {
    width: "34px", height: "34px", padding: 0, borderRadius: "9px",
    display: "flex", alignItems: "center", justifyContent: "center",
    background: `${color}18`, border: `1px solid ${color}33`, color,
    cursor: "pointer", flexShrink: 0, transition: "all 0.2s",
  };
}
